"""Prueba de punta a punta de la 3.10: carro, encontrar el celular, pagos, rutina de la noche, modo cocina, «¿qué dice
esta pantalla?», Gmail, diario, idiomas, conversor, casa inteligente, botón de la cortina, reportar un problema y arranque."""
import os, sys, json, base64, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
def b64u(s): return base64.urlsafe_b64encode(s.encode()).decode().rstrip("=")
MSG = {"id": "m1", "threadId": "t1", "snippet": "¿Nos vemos el lunes?", "payload": {"mimeType": "text/plain", "headers": [{"name": "From", "value": '"Carolina Ruiz" <caro@x.co>'}, {"name": "Subject", "value": "Reunión"}, {"name": "Message-ID", "value": "<a1@x>"}],
       "body": {"data": b64u("Hola, ¿nos vemos el lunes a las 3 para la reunión?")}}}
SENT = []

def gem(route):
    r = route.request; u = r.url
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    t = json.dumps(body, ensure_ascii=False)
    if ":streamGenerateContent" in u or ":generateContent" in u: ASKED.append(t)
    if "receta casera" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps({"titulo": "Arroz blanco", "porciones": 4, "ingredientes": ["2 tazas de arroz", "4 tazas de agua", "sal"],
            "pasos": [{"texto": "Lava el arroz", "minutos": None}, {"texto": "Hierve el agua con sal y agrega el arroz", "minutos": None}, {"texto": "Tapa y cocina a fuego bajo", "minutos": 20}]})}]}}]})
    return e2e.gemini(route)

def gmail(route):
    u = route.request.url
    if "/messages/send" in u:
        SENT.append(json.loads(route.request.post_data)); return route.fulfill(json={"id": "s1"})
    if "/messages?" in u: return route.fulfill(json={"messages": [{"id": "m1"}]})
    return route.fulfill(json=MSG)

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
window.__oir = [];
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 15)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => { o.notifications.forEach((n) => log('noti ' + n.id + ' ' + n.title + ' ' + JSON.stringify(n.schedule))); }, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => log('pantalla on'), allowSleep: async () => log('pantalla off'), writeFile: async (o) => ({ uri: 'file:///x' }), share: async (o) => log('compartir ' + (o.title || '')), getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 64, ahorro: false, sinRestriccion: false }),
  initialize: async () => {}, login: async (o) => { log('google ' + o.options.scopes.join(' ')); return { result: { accessToken: { token: 'tok' }, profile: { email: 'yo@x.co' } } }; } };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Oido: { disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), addListener: on, escuchar: async () => { await new Promise(r => setTimeout(r, 40)); const t = window.__oir.shift(); if (t === undefined) await new Promise(r => setTimeout(r, 200)); return { texto: t || '' }; }, detener: async () => {}, cancelar: async () => {}, vigilar: async () => ({ ok: false }), dejarDeVigilar: async () => {} },
  Lugares: { aqui: async (o) => ({ lat: 4.6510, lng: -74.06, precision: 10 }), programar: async () => {}, quitar: async () => {} },
  Telefono: { checkPermissions: async () => ({ contactos: 'denied' }), contactos: async () => ({ lista: [] }), cumpleanos: async () => ({ lista: [] }), alarma: async (o) => log('alarma ' + o.hora + ':' + o.minuto), noMolestar: async (o) => { log('dnd ' + o.on); return { ok: true }; }, brillo: async (o) => { log('brillo ' + o.nivel); return { ok: true }; },
    pantalla: async () => ({ activo: true, app: 'Chrome', texto: 'Contrato de arriendo\\nEl contrato vence el 30 de junio\\nPablo Mora firmó\\nAtrás\\nEl canon es de 1.200.000', t: Date.now() - 20000 }), abrirAccesibilidad: async () => {}, sms: async () => {}, llamar: async () => {} },
  Disparadores: { guardar: async (o) => log('disparadores carro=' + o.carro), permisoBluetooth: async () => ({ ok: true }), bluetooth: async () => ({ lista: ['Mazda CX-30'] }), carro: async () => ({ lat: 4.6500, lng: -74.06, precision: 15, t: Date.now() - 40 * 60000 }),
    buscarCelular: async (o) => { log('buscar ' + JSON.stringify(o)); return { ok: true }; }, probarSonido: async () => log('sonido'), agregarBoton: async () => { log('boton'); return { pedido: true }; } },
  Mensajes: { addListener: on, activo: async () => ({ activo: true }), permiso: async () => {}, config: async () => {}, activas: async () => ({ lista: [] }), banco: async () => ({ lista: [] }) },
  CapacitorHttp: { request: async (o) => { log('http ' + o.method + ' ' + o.url + (o.data ? ' ' + JSON.stringify(o.data) : '')); if (/open\\.er-api/.test(o.url)) return { status: 200, data: JSON.stringify({ result: 'success', rates: { COP: 4000, USD: 1, EUR: 0.9 } }) };
    if (/\\/api\\/states/.test(o.url)) return { status: 200, data: [{ entity_id: 'light.sala', state: 'off', attributes: { friendly_name: 'Sala' } }, { entity_id: 'switch.ventilador', state: 'on', attributes: { friendly_name: 'Ventilador' } }] };
    if (/\\/api\\/services/.test(o.url)) return { status: 200, data: [] }; return { status: 200, data: '' }; } },
  SocialLogin: generic,
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' ? undefined : generic) }) };
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
        ctx.route("https://gmail.googleapis.com/**", gmail)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: true, nombre: 'María', google: { clienteWeb: 'cid.apps.googleusercontent.com' } },
          cursos: [{ id: 'c1', nombre: '7A', estudiantes: ['Pablo Mora'] }] }))""")
        t0 = time.time(); pg.reload(); pg.wait_for_function("window.__jarvis && document.querySelector('#chat')"); arranque = time.time() - t0
        check(arranque < 4, f"arranque rápido ({arranque:.2f} s)")
        pg.wait_for_timeout(4500)
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        said = lambda: pg.evaluate("window.__said")
        # carro
        say("mi carro es el bluetooth mazda", 600); check("Mazda CX-30" in last() and any("carro=Mazda CX-30" in x for x in logs()), "el carro: su Bluetooth (Android guarda dónde quedó al apagarlo)")
        say("¿dónde dejé el carro?", 800); check("hace 40 minutos" in last() and "110 m" in last(), "¿dónde dejé el carro? (hace cuánto y a qué distancia)")
        pg.click(".msg.jarvis:last-of-type >> text=🚶 Llévame caminando"); pg.wait_for_timeout(200)
        check(any("travelmode=walking" in x for x in logs()), "te lleva caminando al carro")
        # encontrar el celular
        say("activa encontrar mi celular con la clave girasol", 500)
        check("Jarvis girasol" in last() and any('"clave":"girasol"' in x and '"on":true' in x for x in logs()), "encontrar el celular por SMS con clave")
        # pagos
        say("la luz se paga el 15"); say("Netflix cada mes el 3 por 45 mil")
        check(any("Hoy se paga: netflix" in x and '"day":3' in x for x in logs()) and any("En 2 días: luz" in x and '"day":13' in x for x in logs()), "pagos con aviso mensual (y 2 días antes)")
        say("ya pagué netflix"); check("pagado" in last() and any(g["monto"] == 45000 for g in pg.evaluate("JD.load().gastos")), "«ya pagué»: marcado y anotado en gastos")
        say("mis pagos"); check("netflix" in last() and "luz" in last() and "$45.000 al mes" in last(), "mis pagos del mes")
        # rutina de la noche
        say("buenas noches, despiértame a las 5 y media", 1500)
        check("alarma 5:30" in logs() and "dnd true" in logs() and "brillo 15" in logs() and "Activé «No molestar»" in pg.inner_text("#chat"), "rutina de la noche: alarma, no molestar y brillo")
        # modo cocina
        pg.evaluate("window.__oir.push('siguiente')")
        say("cocinemos arroz blanco", 2500)
        check("Arroz blanco" in pg.inner_text("#chat") and "pantalla on" in logs(), "modo cocina: receta con ingredientes (pantalla prendida)")
        pg.wait_for_timeout(1500)
        check(any("Paso 1 de 3: Lava el arroz" in x for x in said()), "modo cocina: «siguiente» por voz, sin tocar")
        say("siguiente", 600); say("siguiente", 800)
        try: pg.wait_for_function("window.__said.some(x => x.includes('Paso 3 de 3')) && (JD.load().timers || []).some(t => t.nombre === 'paso 3')", timeout=10000)
        except Exception: pass
        check(any("Paso 3 de 3" in x for x in said()) and pg.evaluate("(JD.load().timers || []).some(t => t.nombre === 'paso 3')"), "modo cocina: el paso con tiempo pone el temporizador solo")
        say("repite", 300)
        try: pg.wait_for_function("window.__said.filter(x => x.includes('Paso 3 de 3')).length >= 2", timeout=8000)
        except Exception: pass
        check(sum(1 for x in said() if "Paso 3 de 3" in x) >= 2, "modo cocina: repite")
        say("terminar", 300); check("pantalla off" in logs() and pg.evaluate("!window.JX._casa.estado().cocina"), "modo cocina: terminar (apaga la pantalla prendida)")
        # pantalla
        say("¿qué dice esta pantalla?", 1500)
        sent = ASKED[-1] if ASKED else ""
        check("vence el 30 de junio" in sent and "Pablo Mora" not in sent and "Atrás" not in sent, "«¿qué dice esta pantalla?» (sin nombres de estudiantes)")
        # gmail
        say("¿tengo correos nuevos?", 1200)
        check("Carolina Ruiz" in last() and "Reunión" in last() and any("gmail.readonly" in x for x in logs()), "Gmail: correos sin leer (pide el permiso de Gmail)")
        say("respóndele al correo de Carolina que sí, nos vemos el lunes", 1200)
        pg.click(".msg.jarvis:last-of-type >> text=Sí, enviar"); pg.wait_for_timeout(500)
        raw = base64.urlsafe_b64decode(SENT[-1]["raw"] + "==").decode() if SENT else ""
        check(SENT and SENT[-1]["threadId"] == "t1" and "In-Reply-To: <a1@x>" in raw and "sí, nos vemos el lunes" in raw, "Gmail: responder (después de confirmar)")
        # diario
        say("querido diario, hoy estuve feliz y tranquila"); check("😄" in last(), "diario con ánimo")
        say("hoy fue un día triste y cansado"); say("cómo he estado esta semana")
        check("2 entradas" in last(), "cómo he estado esta semana")
        # conversor
        say("cuánto son 50 dólares", 600); check("$200.000" in last(), "moneda (tasa del día)")
        say("convierte 5 millas a km"); check("8,05 km" in last(), "unidades")
        say("qué hora es en Madrid"); check("Madrid" in last() and "Colombia" in last(), "hora en otra ciudad")
        # casa
        pg.evaluate("JD.load().ajustes.ha = { url: 'http://192.168.1.50:8123', token: 'abc' }")
        say("prende la luz de la sala", 900)
        check("Prendí Sala" in last() and any("/api/services/light/turn_on" in x and "light.sala" in x for x in logs()), "casa: prende la luz de la sala (Home Assistant)")
        say("prende la linterna", 400); check("Prendí" not in last(), "«prende la linterna» sigue siendo la linterna")
        # reporte
        pg.evaluate("console.error('falló algo con caro@x.co y Pablo Mora')")
        say("reportar un problema", 800)
        txt = pg.inner_text(".msg.jarvis:last-of-type")
        check("Informe listo" in txt and "falló algo con ‹correo› y ‹nombre›" in txt and "Pablo" not in txt, "reportar un problema (sin datos personales)")
        # ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(250); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-310").count() == 1, "Ajustes › Más y Casa")
        pg.click("#aj-310 >> text=➕ Botón «Jarvis» en la cortina"); pg.wait_for_timeout(200); check("boton" in logs(), "pide poner el botón en la cortina")
        pg.click("#btn-ajustes-cerrar")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    fails2 = [f for f in fails if f]
    print("\nTodo bien (3.10)." if not fails2 else f"\nFALLÓ: {fails2}")
    sys.exit(1 if fails2 else 0)

if __name__ == "__main__":
    main()
