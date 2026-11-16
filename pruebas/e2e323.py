"""Prueba de punta a punta de la 3.23: el orbe abre la conversación en tiempo real (con búsqueda en Google y órdenes), cuelga por silencio,
si no arranca sigue con la escucha normal, búsqueda automática en preguntas de actualidad (con fuentes), Ajustes por temas y formas de llamar a Jarvis."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
CONF = {"bidi": True}

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        ms = [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]
        if CONF["bidi"]: ms.append({"name": "models/gemini-live-3.5-flash-native-audio", "supportedGenerationMethods": ["bidiGenerateContent"]})
        return route.fulfill(json={"models": ms})
    body = r.post_data or ""
    ASKED.append(body)
    if '"google_search"' in body:
        ev = "data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": "Anoche ganó Millonarios 2 a 1, señor."}]}, "groundingMetadata": {"groundingChunks": [{"web": {"uri": "https://www.eltiempo.com/deportes", "title": "eltiempo.com"}}]}}]}) + "\r\n\r\n"
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=ev)
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("La fotosíntesis convierte la luz en energía, señor."))

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Telefono: { addListener: on, checkPermissions: async () => ({}), contactos: async () => ({ lista: [] }), controlActivo: async () => ({ activo: true }), abrirAccesibilidad: async () => log('accesibilidad'),
    atajoVolumen: async (o) => { log('volumen ' + o.on); return { activo: true, on: o.on }; }, ajustesAsistente: async () => log('asistente'), pantalla: async () => ({ activo: false }) },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' || n === 'IALocal' ? undefined : generic) }) };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO", permissions=["microphone"])
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        live = {"setup": None, "n": 0}
        def ws_handler(ws):
            live["n"] += 1
            def on_msg(m):
                j = json.loads(m)
                if "setup" in j: live["setup"] = j["setup"]; ws.send(json.dumps({"setupComplete": {}}))
            ws.on_message(on_msg)
        ctx.route_web_socket("wss://generativelanguage.googleapis.com/**", ws_handler)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        # 1) el orbe abre la conversación en tiempo real
        pg.click("#btn-mic"); pg.wait_for_timeout(3500)
        st = live["setup"] or {}
        tools = json.dumps(st.get("tools", []))
        check(pg.is_visible("#live-sh") and live["n"] == 1, "tocar el orbe abre la conversación en tiempo real")
        check('"googleSearch"' in tools and "jarvis_orden" in tools, "en vivo: busca en Google lo actual y hace las órdenes de la app")
        check("busca en Google" in json.dumps(st.get("systemInstruction", {}), ensure_ascii=False), "en vivo: la instrucción le pide buscar lo actual")
        # cuelga por silencio
        pg.evaluate("window.JX._live.estado().ultimo = Date.now() - 60000"); pg.wait_for_timeout(5600)
        check(not pg.is_visible("#live-sh"), "cuelga solo tras el silencio (ahorra batería)")
        # 2) si no hay modelo en vivo, sigue con la escucha normal sin errores
        CONF["bidi"] = False; pg.evaluate("delete JD.load().ajustes.liveModelo; JD.load().ajustes.vivoFallaT = 0")
        pg.evaluate("window.__heard.push('qué es la fotosíntesis')")
        pg.click("#btn-mic"); pg.wait_for_timeout(4000)
        check(not pg.is_visible("#live-sh") and "fotosíntesis" in pg.inner_text("#chat") and "energía" in last(), "si la conversación en vivo no arranca, escucha de la forma normal")
        check(pg.evaluate("JD.load().ajustes.vivoFallaT > 0"), "y por unas horas no vuelve a intentarlo (responde de una)")
        # 3) modo normal elegido
        pg.evaluate("JD.load().ajustes.modoConv = 'normal'; JD.load().ajustes.vivoFallaT = 0"); CONF["bidi"] = True; n0 = live["n"]
        pg.evaluate("window.__heard.push('hola')"); pg.click("#btn-mic"); pg.wait_for_timeout(2500)
        check(live["n"] == n0 and not pg.is_visible("#live-sh"), "modo normal: el orbe escucha sin conversación en vivo")
        # 4) búsqueda automática de lo actual
        say("¿quién ganó el partido de anoche?", 2000)
        check('"google_search"' in ASKED[-1] and "Millonarios" in last() and "Fuentes" in last() and "eltiempo.com" in last(), "pregunta de actualidad: busca en Google y muestra las fuentes")
        say("¿qué es la fotosíntesis?", 1500)
        check('"google_search"' not in ASKED[-1], "pregunta de siempre: responde directo (más rápido)")
        sp = pg.evaluate("window.__jarvis.systemPrompt()")
        check("Responde cualquier pregunta de cualquier tema" in sp, "la instrucción le pide responder cualquier tema")
        # 5) Ajustes por temas
        pg.click("#btn-ajustes"); pg.wait_for_timeout(600)
        temas = pg.evaluate("[...document.querySelectorAll('.aj-tema')].map(x => x.dataset.tema)")
        vis = pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).length")
        check(len(temas) >= 8 and "ia" in temas and "voz" in temas and vis == 0, f"Ajustes: tarjetas por tema ({len(temas)}) y los grupos escondidos")
        pg.click(".aj-tema[data-tema=voz]"); pg.wait_for_timeout(300)
        prim = pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).map(d => d.querySelector('summary').textContent)")
        check(prim and prim[0] in ("Formas de llamar a Jarvis", "Conversación") and all(pg.evaluate(f"[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).every(d => d.dataset.tema === 'voz')") for _ in [0]), "Voz y conversación: primero Conversación y Formas de llamar")
        pg.fill("#aj-buscar", "batería"); pg.wait_for_timeout(200)
        check(pg.evaluate("document.querySelector('#aj-home').hidden") and pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).length") >= 2, "el buscador busca en todos los temas")
        pg.fill("#aj-buscar", ""); pg.wait_for_timeout(100)
        pg.click("#aj-volver .chip"); pg.wait_for_timeout(200)
        check(pg.is_visible("#aj-home"), "‹ Ajustes vuelve a las tarjetas")
        # 6) formas de llamar a Jarvis
        pg.click(".aj-tema[data-tema=voz]"); pg.wait_for_timeout(200)
        pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).forEach(d => d.open = true)"); pg.wait_for_timeout(200)
        check(pg.locator(".forma").count() >= 9 and "🔋 media" in pg.inner_text(".formas"), "formas de llamar a Jarvis con lo que gasta cada una")
        pg.check("#atajo-vol"); pg.wait_for_timeout(300)
        check("volumen true" in pg.evaluate("window.__log"), "activar «mantener bajar volumen»")
        # los tests viejos: abrir todos los grupos los muestra todos
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].every(d => !d.hidden)"), "si se abren todos los grupos, se ven todos")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.23)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
