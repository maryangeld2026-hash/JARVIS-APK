"""Prueba de punta a punta de la 3.8: asistente general (modo docente opcional), la IA hace órdenes de la app,
memoria automática, corrección de voz, órdenes programadas, habilidades propias, clima, conversaciones y uso de la IA."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []

def gem(route):
    r = route.request; u = r.url
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    ultimo = json.dumps((body.get("contents") or [{}])[-1], ensure_ascii=False)
    if ":streamGenerateContent" in u or ":generateContent" in u:
        ASKED.append(json.dumps(body, ensure_ascii=False))
    if "médico" in ultimo:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"},
                             body=e2e.sse("Claro, ya mismo lo dejo listo.\n<<orden: pon 10 minutos>>\n<<orden: borra todos mis recordatorios>>\n<<recordar: Tiene cita médica los martes>>"))
    if "café" in ultimo:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"},
                             body=e2e.sse("¡Qué rico! Lo tendré en cuenta.\n<<recordar: Su clave del banco es 4455>>\n<<recordar: Le gusta el café sin azúcar>>"))
    return e2e.gemini(route)

def meteo(route):
    u = route.request.url
    if "geocoding" in u:
        return route.fulfill(json={"results": [{"name": "Medellín", "latitude": 6.25, "longitude": -75.56, "country_code": "CO"}]})
    return route.fulfill(json={"current": {"temperature_2m": 24.2, "apparent_temperature": 25, "weather_code": 1, "precipitation": 0},
        "daily": {"time": ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"], "weather_code": [80, 0, 3, 61, 2, 1, 0],
                  "temperature_2m_max": [27, 28, 26, 25, 27, 28, 29], "temperature_2m_min": [16, 17, 16, 15, 16, 17, 18], "precipitation_probability_max": [70, 5, 20, 60, 10, 0, 0]},
        "hourly": {"time": [], "precipitation_probability": []}})

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 30)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => { log('programa ' + o.notifications.length + ' ' + JSON.stringify(o.notifications[0].schedule)); }, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, writeFile: async (o) => ({ uri: 'file:///x' }), share: async (o) => log('compartir'), getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 80, ahorro: false, sinRestriccion: false }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Lugares: { aqui: async (o) => { log('aqui ' + JSON.stringify(o)); return { lat: 4.65, lng: -74.06, precision: 900 }; }, programar: async () => {}, quitar: async () => {}, fondoActivo: async () => ({ ok: true }) },
  Telefono: { checkPermissions: async () => ({ contactos: 'granted' }), contactos: async (o) => ({ lista: [{ nombre: 'Carolina Ruiz', numero: '3001112233' }, { nombre: 'Mamá', numero: '3009998877' }] }),
    llamar: async (o) => log('llamar ' + o.numero), sms: async () => {}, apps: async () => ({ lista: [] }), abrirApp: async () => {}, linterna: async (o) => log('linterna ' + o.on), volumen: async (o) => log('volumen ' + JSON.stringify(o)), alarma: async (o) => log('alarma'), controlActivo: async () => ({ activo: false }) },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' ? undefined : generic) }) };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://api.open-meteo.com/**", meteo); ctx.route("https://geocoding-api.open-meteo.com/**", meteo)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: false, nombre: 'María' } }))""")
        pg.reload(); pg.wait_for_timeout(1500)
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        msgs = lambda n: pg.evaluate(f"[...document.querySelectorAll('.msg.jarvis')].slice(-{n}).map(e => e.textContent)")
        # asistente general
        check(pg.evaluate("document.body.classList.contains('sin-docente')"), "sin cursos: asistente general (modo docente apagado)")
        check("estudiante" not in pg.inner_text("#chat").lower(), "las sugerencias de inicio no son de la clase")
        say("hola, ¿qué puedes hacer?", 1500)
        sp = ASKED[-1] if ASKED else ""
        check("asistente personal" in sp and "docente" not in sp.split("Puedes hacer")[0] and "<<orden:" in sp, "el prompt es de asistente personal y explica las órdenes")
        # la IA hace órdenes de la app
        say("tengo médico a las 3, ayúdame a no olvidarlo y pon 10 minutos", 2500)
        m = msgs(5); allm = " | ".join(m)
        check("<<" not in allm and "Claro, ya mismo" in allm, "las etiquetas no se ven en el chat")
        check(pg.evaluate("window.__jarvis.timer.end > 0"), "la IA puso el temporizador (orden de la app)")
        check(any("No hice «borra todos mis recordatorios»" in x for x in m), "no hace órdenes que borran datos")
        check(any(x.get("texto") == "Tiene cita médica los martes" and x.get("auto") for x in pg.evaluate("JD.load().memoria")), "memoria automática")
        say("me encanta el café", 1500)
        mem = [x["texto"] for x in pg.evaluate("JD.load().memoria")]
        check("Le gusta el café sin azúcar" in mem and not any("clave" in x for x in mem), "memoria automática: nunca guarda claves")
        # corrección de la voz
        pg.evaluate("JD.load().ajustes.vocab = 'Bancolombia'")
        pg.evaluate("window.JX.corregir('x')"); pg.wait_for_timeout(200)
        check(pg.evaluate("window.JX.corregir('llama a carolina ruis')") == "llama a Carolina Ruiz", "corrige nombres de tus contactos")
        check(pg.evaluate("window.JX.corregir('abre vancolombia')") == "abre Bancolombia", "corrige tus palabras")
        # clima
        say("¿cómo está el clima?", 900)
        check("24 °C" in last() and any(x.startswith('aqui {"aprox":true}') for x in logs()), "clima con ubicación aproximada (sin GPS)")
        say("va a llover mañana en Medellín", 900)
        check("Mañana en Medellín" in last() and "despejado" in last(), "clima de mañana en otra ciudad")
        n0 = len([x for x in logs() if x.startswith("aqui")])
        say("el clima de la semana", 900)
        check("pronóstico de la semana" in last() and len([x for x in logs() if x.startswith("aqui")]) == n0, "clima de la semana (reusa la ubicación: no vuelve a pedirla)")
        # habilidades propias
        say("cuando diga modo enfoque, pon 25 minutos y luego dime el clima", 400)
        check("Aprendí la habilidad" in last() and pg.evaluate("JD.load().misHab.length") == 1, "aprende una habilidad propia")
        pg.evaluate("window.__jarvis.timer.end = 0")
        say("modo enfoque", 1500)
        check(pg.evaluate("window.__jarvis.timer.end > 0") and "°C" in last(), "la habilidad hace sus pasos (temporizador y clima)")
        # órdenes programadas
        say("cada lunes a las 6 de la mañana dime el clima", 400)
        check("Listo: los lunes, a las 6:00 a. m." in last() and any('"weekday":2' in x and '"hour":6' in x for x in logs()), "orden programada con aviso de Android (sin despertar a Jarvis)")
        pg.evaluate("const p = JD.load().programadas[0]; p.creada = 0; p.dias = [new Date().getDay()]; const d = new Date(Date.now() - 60000); p.h = d.getHours(); p.m = d.getMinutes();")
        pg.evaluate("window.JX._gen.revisar()"); pg.wait_for_timeout(1200)
        check(any("Orden programada" in x for x in msgs(4)) and "°C" in last(), "si Jarvis está abierto a la hora, la hace solo")
        say("mis órdenes programadas", 300); check("dime el clima" in last() and "borra la orden programada" in last(), "lista de órdenes programadas")
        # conversaciones
        say("nueva conversación sobre el viaje", 300)
        check("viaje" in pg.inner_text("#convbar").lower() and pg.evaluate("JD.load().convs.length") == 1, "conversación nueva (la anterior queda guardada)")
        say("busca en el chat café", 400)
        check("General" in last() and "café" in last(), "buscar en todas las conversaciones")
        say("cambia a la conversación general", 400)
        check("café" in pg.inner_text("#chat"), "volver a la conversación anterior")
        # uso de la IA
        say("cuánto he gastado de la IA", 300)
        check("Uso de la IA este mes" in last() and "Gemini" in last(), "uso de la IA")
        # ajustes
        if pg.is_visible("#alarma"): pg.click("#btn-alarma")          # la prueba forzó el fin del temporizador
        pg.click("#btn-ajustes"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-gen").count() == 1 and "modo enfoque" in pg.inner_text("#aj-gen"), "Ajustes › Asistente con habilidades y órdenes")
        pg.click("#btn-ajustes-cerrar")
        # modo docente
        say("activa el modo docente", 300)
        check(pg.is_visible(".tabs button[data-tab=clase]"), "modo docente: aparecen Clase y Quices")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.8)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
