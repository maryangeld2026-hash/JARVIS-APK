"""Prueba de punta a punta de la 3.35: dividir la cuenta, tiempo de pantalla, resumir grupos, traducir mensajes, wifi en QR,
informe del mes, mantenimiento del vehículo, ¿dónde dejé…?, tarjetas de repaso y modos expertos."""
import os, sys, json, base64, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic2 = anyP({ addListener: on, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) });
const ahora = Date.now();
window.__permUso = false;
const P = {
  LocalNotifications: anyP({ addListener: on, schedule: async (o) => { (o.notifications || []).forEach((n) => log('noti ' + n.id + ' ' + n.title + ' | ' + n.body + ' | ' + JSON.stringify(n.schedule))); }, cancel: async () => {}, checkPermissions: async () => ({ display: 'granted' }), registerActionTypes: async () => {} }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Uso: { permiso: async () => ({ ok: window.__permUso }), abrirPermiso: async () => { log('abrirPermiso'); window.__permUso = true; },
    uso: async (o) => ({ lista: [{ nombre: 'TikTok', pkg: 'com.zhiliaoapp.musically', min: 200 }, { nombre: 'WhatsApp', pkg: 'com.whatsapp', min: 130 }] }),
    apps: async () => ({ apps: [{ nombre: 'TikTok', pkg: 'com.zhiliaoapp.musically' }, { nombre: 'WhatsApp', pkg: 'com.whatsapp' }] }),
    limites: async (o) => log('limites ' + JSON.stringify(o.lista)) },
  Mensajes: anyP({ addListener: on, activo: async () => ({ activo: true }), permiso: async () => log('permisoMsg'),
    recientes: async () => ({ lista: [
      { clave: 'k1', app: 'WhatsApp', de: 'Familia: Mamá', texto: 'El almuerzo del domingo es a la 1', t: ahora - 3600e3, puedeResponder: true },
      { clave: 'k2', app: 'WhatsApp', de: 'Familia: Tío Jorge', texto: 'Yo llevo el postre', t: ahora - 3000e3, puedeResponder: true },
      { clave: 'k3', app: 'WhatsApp', de: 'Familia: Laura', texto: '¿Quién recoge a la abuela?', t: ahora - 2000e3, puedeResponder: true },
      { clave: 'k4', app: 'WhatsApp', de: 'Familia: Mamá', texto: 'Tú, porfa', t: ahora - 1000e3, puedeResponder: true },
      { clave: 'k5', app: 'WhatsApp', de: 'John Smith', texto: 'Hi! Are we still meeting tomorrow at 5?', t: ahora - 500e3, puedeResponder: true }] }),
    archivo: async () => ({ activo: false, lista: [] }),
    responder: async (o) => log('responder ' + o.clave + ' ' + o.texto) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Oido' || n === 'IALocal' || n === 'VozNeural' ? undefined : generic2) }) };
"""
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
BODIES = []

def responder(body):
    if "cuenta de restaurante" in body: return json.dumps({"items": [{"nombre": "Bandeja paisa", "precio": 38000}, {"nombre": "Ajiaco", "precio": 32000}, {"nombre": "Limonada", "precio": 10000}], "subtotal": 80000, "total": 80000, "propina_incluida": False})
    if "quién pidió qué" in body: return json.dumps({"asignacion": {"Ana": [0, 2], "Luis": [1, 2]}})
    if "lo que se habló en el grupo" in body: return "- Almuerzo el domingo a la 1.\\n- El tío Jorge lleva el postre.\\n- Te piden recoger a la abuela."
    if "En qué idioma" in body: return json.dumps({"idioma": "inglés", "traduccion": "¡Hola! ¿Seguimos con la reunión mañana a las 5?"})
    if "Traduce al" in body: return "Yes, see you tomorrow at 5!"
    if "tarjetas de repaso" in body: return json.dumps({"tarjetas": [{"p": "¿En qué año empezó la Revolución Francesa?", "r": "1789"}, {"p": "¿Qué se tomó el 14 de julio?", "r": "La Bastilla"}]})
    if "consejos cortos" in body: return "1. Cocina más en casa."
    if "MODO ACTIVO" in body: return "Según la ley colombiana… Es orientación general."
    return "Listo, señor."

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}]})
    BODIES.append(body)
    t = responder(body)
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(t))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": t}]}}]})

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    png = os.path.join(tempfile.mkdtemp(), "cuenta.png"); open(png, "wb").write(base64.b64decode(PNG))
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""(() => { const d = new Date(), M = (k, dia, monto, cat) => ({ id: 'g' + k, t: new Date(d.getFullYear(), d.getMonth() + k, dia, 12).getTime(), monto, cat, tipo: 'gasto', desc: cat });
          localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false },
          gastos: [M(0, 1, 600000, 'Comida'), M(0, 1, 300000, 'Transporte'), M(-1, 5, 400000, 'Comida'), M(-1, 6, 300000, 'Transporte')],
          pagos: [{ nombre: 'Arriendo', dia: 28, monto: 1200000, pagos: [] }] })); })()""")
        pg.reload(); pg.wait_for_timeout(3200)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        tap = lambda t, w=900: (pg.locator(f".msg.jarvis:last-of-type button:has-text('{t}')").first.click(), pg.wait_for_timeout(w))
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-335 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["celular", "celular", "rutinas", "tu"], "Ajustes 3.35 en Celular, Rutinas y Tú " + str(temas))
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 1) dividir la cuenta
        say("divide 180 mil entre 4 con el 10% de propina", 900)
        check("$198.000" in last() and "$49.500 cada uno" in last(), "divide la cuenta con propina · " + last()[:80])
        with pg.expect_file_chooser() as fc:
            pg.fill("#in-texto", "divide esta cuenta"); pg.press("#in-texto", "Enter")
        fc.value.set_files(png); pg.wait_for_timeout(2000)
        check("Bandeja paisa" in last() and "$80.000" in last(), "lee la cuenta de la foto · " + last()[:60])
        tap("Entre 2")
        check("$88.000" in last() and "$44.000 cada uno" in last(), "foto: dividida entre 2 con propina")
        say("pidieron: Ana la bandeja, Luis el ajiaco y la limonada la compartimos", 1500)
        check("Ana: $47.300" in last() and "Luis: $40.700" in last(), "cada quien lo suyo (lo compartido se divide) · " + last()[:120])
        # 2) tiempo de pantalla
        clear(); say("¿cuánto usé el celular hoy?", 900)
        check("Acceso al uso" in last(), "pide el permiso de Acceso al uso primero")
        tap("Abrir el ajuste")
        check("abrirPermiso" in logs(), "abre el ajuste de Android (no lo cambia solo)")
        say("¿cuánto usé el celular hoy?", 900)
        check("5 h 30 min" in last() and "TikTok: 3 h 20 min" in last(), "tiempo de pantalla de hoy · " + last()[:90])
        say("avísame si paso más de una hora en TikTok", 900)
        check(any('"pkg":"com.zhiliaoapp.musically"' in x and '"min":60' in x for x in logs()), "límite diario de TikTok para Android")
        # 3) grupos
        say("¿qué dijeron en el grupo de la familia?", 1500)
        check("recoger a la abuela" in last() and any("Mamá: El almuerzo" in x for x in BODIES), "resume el grupo de la familia · " + last()[:90])
        # 4) traducir
        say("tradúceme el mensaje de John", 1500)
        check("inglés" in last() and "Seguimos con la reunión" in last(), "traduce un mensaje que llegó en inglés")
        clear(); say("respóndele a John en su idioma que sí, nos vemos mañana a las 5", 1500)
        check("Yes, see you tomorrow at 5!" in last() and not any(x.startswith("responder") for x in logs()), "traduce la respuesta y pregunta antes de enviar")
        tap("Sí, enviar")
        check("responder k5 Yes, see you tomorrow at 5!" in logs(), "envía la respuesta traducida solo al confirmar")
        # 5) wifi
        say("comparte el wifi", 800)
        check("no deja que las apps lean" in last(), "wifi: explica que hay que decirle la clave una vez")
        say("mi wifi se llama CasaPerez y la clave es abc;12345", 800)
        hist = pg.evaluate("JSON.stringify(JD.load().chat.slice(-4))")
        check("abc;12345" not in hist and "••••••" in hist, "la clave del wifi no queda en la conversación")
        say("comparte el wifi", 1200)
        check(pg.locator(".msg.jarvis:last-of-type .prac-qr svg").count() == 1, "muestra el QR del wifi")
        # 6) informe del mes
        say("informe del mes", 900)
        check("$900.000" in last() and "▲ 29 %" in last() and "Comida: $600.000 (▲ 50 %)" in last(), "informe del mes con comparación · " + last()[:120])
        clear(); tap("Mándamelo")
        check(any("Tu informe del mes" in x and '"day":1' in x for x in logs()), "programa el informe el 1.º de cada mes")
        # 7) vehículo
        clear(); say("le cambié el aceite al carro a los 45.000 km", 900)
        check("Cambio de aceite" in last() and any("Cambio de aceite (carro)" in x for x in logs()), "anota el cambio de aceite y programa el aviso")
        say("el carro va en 49.800 km", 900)
        check("Pronto: Cambio de aceite" in last(), "avisa que el aceite toca pronto por kilometraje · " + last()[:80])
        # 8) dónde dejé
        say("dejé las llaves del carro en el cajón de la cocina", 800)
        say("¿dónde dejé las llaves?", 800)
        check("en el cajón de la cocina" in last(), "¿dónde dejé las llaves? · " + last()[:90])
        say("¿dónde dejé el carro?", 900)
        check("cajón" not in last(), "«¿dónde dejé el carro?» sigue siendo el de parqueo")
        # 9) tarjetas de repaso
        say("hazme tarjetas de repaso de la Revolución Francesa", 1500)
        check("2 tarjetas" in last(), "crea tarjetas de repaso con la IA")
        tap("Repasar ya"); tap("Ver respuesta")
        check("1789" in last(), "repaso: muestra la respuesta")
        tap("Bien"); tap("Ver respuesta"); tap("Otra vez", 1200)
        check("1 de 2 bien" in last(), "repaso terminado con su puntaje · " + last()[:60])
        prox = pg.evaluate("JD.load().mazos[0].tarjetas.map(c => c.caja)")
        check(prox == [1, 0], "repetición espaciada: la que supo sube de caja, la otra vuelve mañana " + str(prox))
        # 10) modos expertos
        say("modo abogado", 800)
        check("Abogado" in last() and pg.locator("#modo-exp").count() == 1, "activa el modo abogado (con aviso visible)")
        say("¿me pueden echar sin justa causa?", 2000)
        check(any("MODO ACTIVO" in x and "abogado colombiano" in x for x in BODIES), "el modo cambia las instrucciones de la IA")
        say("modo normal", 800)
        check(pg.locator("#modo-exp").count() == 0 and "salí del modo" in last(), "modo normal")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.35)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
