"""Prueba de punta a punta de la 3.11: el agente maneja una app (y se detiene antes de confirmar), actuar sobre la pantalla,
estafas, sugerencias, respuestas automáticas, filtro de llamadas, fotos, «¿qué hice?», dictado pulido, widget y presentación."""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
def gem(route):
    r = route.request; u = r.url
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    t = json.dumps(body, ensure_ascii=False)
    if ":streamGenerateContent" in u or ":generateContent" in u: ASKED.append(t)
    J = lambda o: route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps(o, ensure_ascii=False)}]}}]})
    if "manejando la app «Uber»" in t:
        if "Confirmar UberX" in t: return J({"accion": "tocar", "i": 1, "porque": "confirmar"})
        if "Calle 80" in t: return J({"accion": "tocar", "i": 0})
        return J({"accion": "escribir", "i": 0, "texto": "Casa"})
    if "Saca de esta pantalla la cita" in t:
        return J({"ordenes": ["recuérdame reunión con Carolina mañana a las 3 de la tarde"], "explica": "Una reunión con Carolina mañana a las 3."})
    if "bien escrito" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Mañana no puedo ir porque tengo una cita médica."}]}}]})
    if "contenido de una presentación" in t:
        return J({"titulo": "Fracciones", "subtitulo": "Para grado 7", "diapositivas": [{"titulo": "¿Qué es una fracción?", "puntos": ["Partes de un todo", "Numerador y denominador"], "notas": "Empieza con una pizza."}, {"titulo": "Sumar fracciones", "puntos": ["Mismo denominador", "Distinto denominador"], "notas": "Usa ejemplos."}]})
    return e2e.gemini(route)

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
window.__oir = []; let pant = 0;
const SCREENS = [
  { pkg: 'com.ubercab', nodos: [{ i: 0, t: '¿A dónde vas?', c: 1, e: 1 }, { i: 1, t: 'Ingresar', c: 1 }] },
  { pkg: 'com.ubercab', nodos: [{ i: 0, t: 'Casa - Calle 80 # 20-10', c: 1 }, { i: 1, t: 'Trabajo', c: 1 }] },
  { pkg: 'com.ubercab', nodos: [{ i: 0, t: 'UberX $12.000', c: 1 }, { i: 1, t: 'Confirmar UberX', c: 1 }] } ];
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 15)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => { o.notifications.forEach((n) => log('noti ' + n.id + ' ' + n.title + ' ' + n.body)); }, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, writeFile: async (o) => { log('archivo ' + o.path); return { uri: 'file:///x' }; }, share: async (o) => log('compartir ' + (o.title || '') + ' ' + (o.files ? o.files.join(',') : '')), getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 70 }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Telefono: { checkPermissions: async () => ({ contactos: 'denied' }), apps: async () => ({ lista: [{ nombre: 'Uber', paquete: 'com.ubercab' }, { nombre: 'WhatsApp', paquete: 'com.whatsapp' }] }), abrirApp: async (o) => log('abrir ' + o.paquete),
    agenteUi: async () => SCREENS[Math.min(pant, 2)], agenteAccion: async (o) => { log('agente ' + o.accion + ' ' + o.i + ' ' + (o.texto || '')); pant++; return { ok: true }; }, volverAJarvis: async () => log('volver'),
    pantalla: async () => ({ activo: true, app: 'WhatsApp', texto: window.__pantalla || '', t: Date.now() - 10000 }), llamar: async (o) => log('llamar ' + o.numero), nuevoContacto: async () => {}, abrirAccesibilidad: async () => {},
    filtroLlamadas: async (o) => { log('filtro ' + o.modo + ' ' + o.negra); return { pedido: true, activo: false }; }, llamadasFiltradas: async () => ({ lista: [{ numero: '3005550000', que: 'silenciar', t: Date.now() - 3600e3 }] }), sms: async () => {} },
  Mensajes: { addListener: on, activo: async () => ({ activo: true }), permiso: async () => {}, config: async (o) => log('mensajes ' + JSON.stringify(o)), activas: async () => ({ lista: [] }), banco: async () => ({ lista: [] }), recientes: async () => ({ lista: [] }) },
  Fotos: { activar: async () => ({ ok: true }), buscar: async (o) => { log('fotos ' + o.terminos.join(',')); return { leidas: 340, lista: [{ uri: 'content://1', t: Date.now(), txt: 'REPUBLICA DE COLOMBIA IDENTIFICACION', et: ['paper'], mini: '/9j/4AAQSkZJRgABAQ==' }] }; }, abrir: async (o) => log('ver ' + o.uri), estado: async () => ({ leidas: 340 }) },
  Disparadores: { widgetDatos: async (o) => { log('widget ' + o.titulo + ' | ' + o.texto.replace(/\\n/g, ' / ')); return { fijado: !!o.fijar }; }, guardar: async () => {}, carro: async () => ({}) },
  Share: { share: async (o) => log('compartir ' + (o.title || '') + ' ' + (o.files || []).join(',')) },
  Filesystem: { writeFile: async (o) => { log('archivo ' + o.path); return { uri: 'file:///cache/' + o.path }; } },
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
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        now_ms = int(time.time() * 1000)
        log = [{"k": "como esta el clima", "texto": "¿cómo está el clima?", "t": now_ms - d * 864e5 - 5 * 60000} for d in (1, 2, 3, 4)]
        pg.evaluate("""(log) => localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: true, nombre: 'María' },
          cursos: [{ id: 'c1', nombre: '7A', estudiantes: ['Pablo Mora'] }], usoLog: log, pagos: [{ id: 'p1', nombre: 'luz', dia: 15, monto: 120000, pagos: [] }],
          gastos: [{ id: 'g1', monto: 25000, desc: 'almuerzo', cat: 'comida', tipo: 'gasto', t: Date.now() - 864e5 }] }))""", log)
        pg.reload(); pg.wait_for_timeout(5000)
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        # sugerencias que aprende
        dia = time.localtime().tm_wday
        if dia < 5:
            check("💡 ¿cómo está el clima?" in pg.inner_text("#hoy"), "sugerencia: lo que sueles pedir a esta hora")
        # agente
        say("pídeme un Uber a la casa", 9000)
        try: pg.wait_for_function("window.__log.some(x => x.startsWith('agente tocar 0'))", timeout=8000); pg.wait_for_timeout(3500)
        except Exception: pass
        L = logs()
        check("abrir com.ubercab" in L and "agente escribir 0 Casa" in L and "agente tocar 0 " in L, "agente: abre Uber, escribe el destino y escoge «Casa»")
        check("agente tocar 1 " not in L and "Confirmar UberX" in pg.inner_text("#chat"), "agente: se detiene antes de «Confirmar UberX» (lo tocas tú)")
        say("transfiere 50 mil en Nequi a Carolina", 400); check("no manejo apps de bancos" in last(), "agente: nunca usa apps de bancos")
        # actuar sobre lo que ves
        pg.evaluate("window.__pantalla = 'Carolina: Hola María\\nNos vemos mañana a las 3 en la sala 2\\nPablo Mora también va'")
        say("agéndalo", 1500)
        sent = ASKED[-1] if ASKED else ""
        check("sala 2" in sent and "Pablo Mora" not in sent and any(r["texto"].lower().startswith("reunión con carolina") for r in pg.evaluate("JD.load().recordatorios")), "actuar sobre la pantalla: «agéndalo» (sin nombres de estudiantes)")
        pg.evaluate("window.__pantalla = 'BANCOLOMBIA: Su cuenta será bloqueada en 24 horas. Verifique sus datos en bit.ly/x2'")
        say("¿esto es estafa?", 500); check("Muy probablemente es una estafa" in last(), "¿esto es estafa? (en el celular, sin IA)")
        pg.evaluate("window.__pantalla = 'Domicilios: llámanos al 300 123 4567'")
        say("llama a este número", 400); pg.click(".msg.jarvis:last-of-type >> text=3001234567"); pg.wait_for_timeout(200)
        check("llamar 3001234567" in logs(), "llama al número que está en la pantalla")
        # respuestas automáticas y llamadas
        say("responde que estoy en clase hasta las 11", 500)
        check(any('"autoResp":true' in x and "Estoy en clase" in x for x in logs()), "respuestas automáticas con hora de fin")
        say("silencia las llamadas de desconocidos", 400); check("filtro silenciar " in logs() and "filtro de llamadas" in last(), "filtro de llamadas (pide el papel a Android)")
        say("qué llamadas silenciaste", 400); check("3005550000" in last(), "llamadas filtradas")
        # fotos
        say("busca la foto de la cédula", 600)
        check(any(x.startswith("fotos cedula") and "republica" in x for x in logs()) and pg.locator(".msg.jarvis:last-of-type .foto-res img").count() == 1, "memoria fotográfica: busca la foto de la cédula")
        # qué hice ayer
        say("¿qué hice ayer?", 600); check("almuerzo" in last() and "$25.000" in last(), "¿qué hice ayer? (línea de tiempo)")
        # dictado pulido
        say("pule este mensaje para Carolina: eh este o sea mañana no no puedo ir pues tengo cita", 1500)
        check("Mañana no puedo ir porque tengo una cita médica." in last() and "WhatsApp a Carolina" in pg.inner_text(".msg.jarvis:last-of-type"), "dictado pulido con WhatsApp listo")
        # widget
        say("crea un widget con mis pagos del mes", 600)
        check(any(x.startswith("widget Pagos del mes | ") and "luz · el 15" in x for x in logs()), "widget a la carta con tus pagos")
        # presentación
        say("hazme una presentación de fracciones de 6 diapositivas", 6000)
        check("Lista la presentación «Fracciones»" in pg.inner_text("#chat"), "presentación por voz")
        pg.click(".msg.jarvis:last-of-type >> text=📤 Abrir o compartir el PowerPoint"); pg.wait_for_timeout(800)
        check(any("Fracciones.pptx" in x for x in logs()), "el PowerPoint sale listo para abrir o compartir")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.11)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
