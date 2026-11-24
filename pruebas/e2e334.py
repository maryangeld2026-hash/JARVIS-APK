"""Prueba de punta a punta de la 3.34: organizar el día, choques, hora de salir, temas, cocina, viaje, precios, hojas (Excel y
Google Sheets), Google Docs y Notion, contactos y rutina de sueño."""
import os, sys, json, base64, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; window.__cola = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic2 = anyP({ addListener: on, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) });
const H = 3600e3, hoy = new Date(); hoy.setHours(0, 0, 0, 0); const T = (d, h, m) => hoy.getTime() + d * 864e5 + h * H + (m || 0) * 60000;
const EV = () => [{ titulo: 'Reunión de padres', inicio: T(0, 23, 0), fin: T(0, 23, 30), lugar: 'Colegio San José, Bogotá', todoElDia: false },
  { titulo: 'Cita médica', inicio: T(1, 9), fin: T(1, 10), lugar: 'Clínica del Country', todoElDia: false }, { titulo: 'Almuerzo', inicio: T(1, 9, 30), fin: T(1, 11), lugar: 'Clínica del Country', todoElDia: false }];
const P = {
  LocalNotifications: anyP({ addListener: on, schedule: async (o) => { (o.notifications || []).forEach((n) => log('noti ' + n.id + ' ' + n.title + ' | ' + n.body)); }, cancel: async () => {}, checkPermissions: async () => ({ display: 'granted' }), registerActionTypes: async () => {} }),
  Calendario: anyP({ eventos: async (o) => ({ lista: EV().filter((e) => e.inicio >= o.desde && e.inicio < o.hasta) }), crear: async (o) => { log('crear ' + o.titulo); return { ok: true }; }, permiso: async () => ({ ok: true }) }),
  Rutina: anyP({ config: async (o) => log('rutina ' + JSON.stringify(o)), brief: async () => ({ texto: '', t: 0 }), precios: async () => ({ lista: [{ q: 'AirPods Pro 3', precio: 949000, tienda: 'Falabella' }] }) }),
  Lugares: anyP({ aqui: async () => ({ lat: 4.65, lng: -74.05 }) }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url) }),
  Share: anyP({ share: async (o) => log('share ' + (o.files || []).join(',')) }), Filesystem: anyP({ writeFile: async (o) => ({ uri: 'file://' + o.path }) }),
  CapacitorHttp: { request: async (o) => { log('nativo ' + o.method + ' ' + o.url); const r = await fetch(o.url, { method: o.method, headers: o.headers, body: o.data ? JSON.stringify(o.data) : undefined }); let d = null; try { d = await r.json(); } catch (e) {} return { status: r.status, data: d }; } },
  Telefono: anyP({ addListener: on, contactos: async () => ({ lista: [] }), apps: async () => ({ lista: [] }) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Oido' || n === 'IALocal' || n === 'VozNeural' ? undefined : generic2) }) };
"""
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
BODIES = []

def responder(body):
    if "MINUTOS:" in body: return "MINUTOS: 35"
    if "recetas" in body: return json.dumps({"veo": ["huevos", "arroz", "tomate"], "recetas": [{"nombre": "Arroz con huevo", "minutos": 20, "usa": ["arroz", "huevos"]}, {"nombre": "Huevos pericos", "minutos": 10, "usa": ["huevos", "tomate"]}]})
    if "para empacar" in body: return json.dumps({"items": ["Cédula", "Tiquetes", "Bloqueador", "Vestido de baño", "Cargador"]})
    if "estado del vuelo" in body: return "El vuelo AV123 está a tiempo (fuente: FlightAware)."
    if "PRECIO:" in body: return "PRECIO: 949000\nTIENDA: Falabella"
    if "Para cada tema" in body: return "💵 Dólar: cerró en $3.900 (fuente: Banco de la República)."
    return "Listo, señor."

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}]})
    BODIES.append(body)
    t = responder(body)
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(t))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": t}]}}]})

DRIVE = []
def drive(route):
    DRIVE.append((route.request.method, route.request.url, (route.request.post_data or "")[:400]))
    return route.fulfill(json={"id": "ID123"}, headers={"access-control-allow-origin": "*"})
NOTION = []
def notion(route):
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*"})
    NOTION.append((dict(route.request.headers), route.request.post_data or ""))
    return route.fulfill(json={"id": "p1", "url": "https://www.notion.so/p1"}, headers={"access-control-allow-origin": "*"})

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    png = os.path.join(tempfile.mkdtemp(), "nevera.png"); open(png, "wb").write(base64.b64decode(PNG))
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://www.googleapis.com/upload/drive/**", drive)
        ctx.route("https://api.notion.com/**", notion)
        ctx.route("https://geocoding-api.open-meteo.com/**", lambda r: r.fulfill(json={"results": [{"latitude": 10.4, "longitude": -75.5}]}, headers={"access-control-allow-origin": "*"}))
        ctx.route("https://api.open-meteo.com/**", lambda r: r.fulfill(json={"daily": {"temperature_2m_max": [31, 32], "temperature_2m_min": [25, 26], "precipitation_probability_max": [20, 40]}}, headers={"access-control-allow-origin": "*"}))
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false,
          google: { clienteWeb: 'cid' }, notionToken: 'ntn_x', notionPagina: 'https://www.notion.so/Jarvis-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d' },
          docs: [{ id: 'd1', titulo: 'Acta de padres', md: '# Acta\\n- Salida al museo\\n- Notas el viernes', fecha: Date.now() }] }))""")
        pg.reload(); pg.wait_for_timeout(3200)
        pg.evaluate("void (JX._.gfetch = async (url, opt) => { const r = await fetch(url, opt); return r.json(); })")   # Google ya conectado
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-334 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["rutinas", "rutinas", "datos"], "Ajustes 3.34 en Rutinas y Privacidad " + str(temas))
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 1) organizar el día
        say("organiza mi día: llamar al banco, hacer mercado 1 hora", 1500)
        check("Así te propongo el día" in last() or "No alcanzó" in last() or "No hay nada" in last(), "organiza el día en los huecos del calendario · " + last()[:70])
        clear()
        btn = pg.locator(".msg.jarvis:last-of-type button:has-text('Agendarlo')")
        if btn.count(): btn.click(); pg.wait_for_timeout(800)
        check(not btn.count() or any(x.startswith("crear 🎯") for x in logs()), "agenda los bloques solo si le dices que sí")
        # 2) choques
        say("¿tengo choques en mi agenda mañana?", 1200)
        check("se cruza con «Almuerzo»" in last(), "choques de mañana: la cita médica se cruza con el almuerzo")
        # 3) hora de salir
        clear(); say("avísame cuándo salir", 3000)
        check("Reunión de padres" in last() and any("Hora de salir" in x and "35 min" in x for x in logs()), "hora de salir: estima el trayecto (35 min) y programa el aviso · " + last()[-90:])
        # 4) temas
        clear(); say("sígueme el tema del dólar", 1200)
        check(any('"temas":["dólar"]' in x and '"key":"AIzaX"' in x for x in logs()), "temas: se lo pasa a Android para la mañana")
        say("resumen de mis temas", 2000)
        check("Dólar" in last() and any("google_search" in x for x in BODIES), "resumen de mis temas (busca en internet)")
        # 5) cocina
        with pg.expect_file_chooser() as fc:
            pg.fill("#in-texto", "¿qué cocino con esto?"); pg.press("#in-texto", "Enter")
        fc.value.set_files(png); pg.wait_for_timeout(2000)
        check("Arroz con huevo" in last() and pg.locator(".msg.jarvis:last-of-type button:has-text('Cocinemos')").count() == 2, "¿qué cocino con esto?: recetas con botón para cocinar")
        # 6) viaje
        clear(); say("mi vuelo es el AV123 el 15 de diciembre a las 6 de la mañana a Cartagena", 1500)
        check("AV123" in last() and any("check-in" in x for x in logs()) and any("aeropuerto" in x for x in logs()), "vuelo guardado con avisos de check-in y de salir al aeropuerto")
        say("lista para empacar para Cartagena 4 días", 2500)
        check("Bloqueador" in last() and pg.evaluate("(JD.load().listas.maleta || {items: []}).items.length") == 5, "lista para empacar con el clima del destino")
        # 7) precios
        clear(); say("avísame cuando los AirPods Pro 3 bajen de 900 mil", 1200)
        check(any('"precios":[{"q":"AirPods Pro 3","max":900000}]' in x for x in logs()), "alerta de precio para revisar cada mañana")
        say("mis alertas de precio", 1000)
        check("949.000" in last() and "Falabella" in last(), "muestra el último precio encontrado")
        # 8) hojas
        say("anota en mi hoja de ventas: 3 arepas, 15 mil", 900)
        say("anota en mi hoja de ventas: 2 jugos, 8 mil", 900)
        check("Hoy llevas $23.000" in last(), "hoja de ventas por voz con total del día · " + last()[:80])
        clear(); say("exporta la hoja de ventas a Excel", 2000)
        check(any(x.startswith("share file://ventas.xlsx") for x in logs()), "exporta a Excel")
        say("pasa la hoja de ventas a Google Sheets", 1500)
        check(any("google-apps.spreadsheet" in d[2] and "3,arepas,15000" in d[2] for d in DRIVE), "sube la hoja a Google Sheets (CSV convertido)")
        # 9) Docs y Notion
        say("guarda el documento acta de padres en Google Docs", 1500)
        check(any("google-apps.document" in d[2] and "<h1>Acta</h1>" in d[2] for d in DRIVE), "guarda el documento en Google Docs")
        clear(); say("guarda el documento acta de padres en Notion", 1500)
        check(NOTION and NOTION[-1][0].get("notion-version") == "2022-06-28" and "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" in NOTION[-1][1] and any(x.startswith("nativo POST https://api.notion.com") for x in logs()), "guarda en Notion (por la vía nativa)")
        # 10) contactos
        clear(); say("recuérdame hablar con mi tía Rosa cada mes", 1000)
        check(any("mi tía Rosa" in x for x in logs()), "no perder el contacto: aviso programado")
        # 11) sueño
        clear(); say("activa la rutina de sueño a las 10 de la noche", 1000)
        check(any('"sueno":{"on":true,"hora":"22:00"' in x for x in logs()), "rutina de sueño a las 10 p. m.")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.34)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
