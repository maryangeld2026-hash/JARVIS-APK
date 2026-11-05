"""Prueba de punta a punta de la 3.17: traductor (IA, sin internet, privacidad, conversación cara a cara, lo último) y reconocer canciones
(AudD, Gemini con pista y búsqueda, historial, ponerla)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    s = json.dumps(body, ensure_ascii=False)
    ASKED.append(s)
    txt = "Listo."
    if "audio/wav" in s:
        txt = json.dumps({"titulo": "", "artista": "", "seguro": False, "pista": "pop latino en español con guitarra"})
    elif body.get("tools") and "Título — Artista" in s:
        txt = "**La Tortura** — Shakira"
    elif "Traduce al inglés" in s and "baño" in s:
        txt = json.dumps({"traduccion": "Where is the bathroom?", "de": "es", "pronunciacion": "uér is de bázrum", "nota": ""})
    elif "Traduce al portugués" in s:
        txt = json.dumps({"traduccion": "Olá, senhor, como posso ajudar?", "de": "es", "pronunciacion": "olá, sinhôr", "nota": ""})
    if ":streamGenerateContent" in u:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Hola, señor, ¿en qué le ayudo?"))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": txt}]}}]})

NATIVE = """
window.__log = []; window.__spk = []; window.__oir = []; window.__paq = ['es']; window.__audd = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80, ahorro: false, sinRestriccion: false }), stop: async () => {} };
const TR = { 'buenos días|fr': 'Bonjour', '¿Dónde está el museo?|en': 'Where is the museum?', 'It is two blocks away|es': 'Está a dos cuadras', 'Carolina Ruiz sacó buena nota|en': 'Carolina Ruiz got a good grade' };
const P = {
  TextToSpeech: { addListener: on, stop: async () => {}, speak: async (o) => { window.__spk.push({ t: o.text, lang: o.lang }); window.__said.push(o.text); await new Promise((r) => setTimeout(r, 20)); }, getSupportedVoices: async () => ({ voices: [] }) },
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {} },
  Oido: { addListener: on, disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), detener: async () => {}, cancelar: async () => {},
    escuchar: async (o) => { log('oir ' + o.idioma); await new Promise((r) => setTimeout(r, 60)); return { texto: window.__oir.shift() || '' }; } },
  Traductor: {
    modelos: async () => ({ lista: window.__paq.slice() }),
    detectar: async (o) => ({ idioma: /[a-z] is |the /i.test(o.texto) ? 'en' : 'es' }),
    descargar: async (o) => { log('bajar ' + o.idioma); window.__paq.push(o.idioma); },
    traducir: async (o) => { log('traducir ' + JSON.stringify(o));
      if (!window.__paq.includes(o.a) && o.a !== 'en' && !o.descargar) { const e = new Error('Falta el paquete'); e.code = 'falta_modelo'; e.data = { falta: o.a }; throw e; }
      const k = o.texto + '|' + o.a; return { texto: TR[k] || ('[' + o.a + '] ' + o.texto), de: o.de || (/[a-z] is /i.test(o.texto) ? 'en' : 'es'), a: o.a }; } },
  Musica: { addListener: on, grabar: async (o) => { log('grabar ' + o.seg); window.__fire('nivel', { v: 0.4, t: 5 }); await new Promise((r) => setTimeout(r, 80)); return { ruta: '/cache/jarvis_cancion.wav', segundos: o.seg, nivel: 0.3 }; },
    audd: async (o) => { log('audd'); return { json: window.__audd.shift() || '{"status":"success","result":null}' }; }, base64: async () => ({ data: 'UklGRg==' }), borrarAudio: async () => log('borrar-audio'),
    apps: async () => ({ google: true, shazam: false }), abrir: async (o) => log('abrir ' + o.app) },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'IALocal' ? undefined : generic) }) };
"""

BONITO = json.dumps({"status": "success", "result": {"title": "Bonito", "artist": "Jarabe de Palo", "album": "Bonito", "release_date": "2003-01-01", "spotify": {"external_urls": {"spotify": "https://open.spotify.com/track/abc"}}}})

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
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: true, v316: 1, vozJarvis316: 1 } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=700: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        spk = lambda: pg.evaluate("window.__spk")
        # 1) traducir con IA
        pg.evaluate("window.__spk.length = 0")
        say("Traduce al inglés: ¿Dónde está el baño?", 1500)
        check("Where is the bathroom?" in last() and "uér is" in last(), "traduce con IA y da la pronunciación")
        check(any(x["lang"] == "en-US" and "bathroom" in x["t"] for x in spk()), "lo dice con la voz en inglés")
        check(pg.locator(".msg.jarvis:last-child .doc-acts button", has_text="Despacio").count() == 1, "botones: otra vez, despacio, copiar, guardar")
        # 2) sin internet: con los paquetes del celular
        ctx.set_offline(True)
        say("traduce buenos días al francés", 900)
        check("Sin internet no tengo el paquete de francés" in last(), "sin internet y sin paquete: dice cómo bajarlo")
        pg.evaluate("window.__paq.push('fr')")
        say("traduce buenos días al francés", 900)
        check("Bonjour" in last() and "sin internet" in last(), "sin internet: traduce dentro del celular")
        ctx.set_offline(False)
        # 3) privacidad: nombres de estudiantes nunca van a la IA
        pg.evaluate("const d = JD.load(); d.ajustes.docente = true; d.cursos.push({ id: 'c1', nombre: '7A', estudiantes: ['Carolina Ruiz'] })")
        n0 = len(ASKED)
        say("traduce al inglés: Carolina Ruiz sacó buena nota", 900)
        check("good grade" in last() and not any("Carolina" in x for x in ASKED[n0:]), "con nombres de estudiantes traduce en el celular (no va a la IA)")
        pg.evaluate("JD.load().ajustes.docente = false")
        # 4) modo conversación cara a cara
        say("ayúdame a hablar con alguien en inglés", 600)
        check(pg.is_visible("#trad-sh") and "Inglés" in pg.inner_text("#trad-mic-otro"), "abre el traductor de conversación (español ⇄ inglés)")
        pg.evaluate("window.__spk.length = 0; window.__oir.push('¿Dónde está el museo?')")
        pg.click("#trad-mic-mio"); pg.wait_for_timeout(900)
        check("oir es-CO" in logs() and "Where is the museum?" in pg.inner_text("#trad-otro") and any(x["lang"] == "en-US" for x in spk()), "yo hablo en español → lo traduce y lo dice en inglés")
        pg.evaluate("window.__spk.length = 0; window.__oir.push('It is two blocks away')")
        pg.click("#trad-mic-otro"); pg.wait_for_timeout(900)
        check("oir en-US" in logs() and "Está a dos cuadras" in pg.inner_text("#trad-mio") and any(x["lang"] == "es-CO" and "cuadras" in x["t"] for x in spk()), "la otra persona habla en inglés → me lo dice en español")
        check(any(x.startswith("traducir ") and '"de":"en"' in x for x in logs()), "la conversación usa el traductor del celular (más rápido)")
        pg.check("#trad-sh .trad-opc input >> nth=1"); pg.wait_for_timeout(100)
        check(pg.evaluate("document.querySelector('#trad-sh .sheet-in').classList.contains('gira')"), "cara a cara: gira el lado de la otra persona")
        pg.click("#trad-sh .sheet-h .icon-btn"); pg.wait_for_timeout(200)
        check(not pg.is_visible("#trad-sh"), "se cierra el traductor")
        # 5) canciones con AudD
        pg.evaluate(f"window.__audd.push({json.dumps(BONITO)}); window.__spk.length = 0")
        say("¿qué canción es esta?", 1500)
        check("Bonito" in last() and "Jarabe de Palo" in last() and "grabar 10" in logs() and "borrar-audio" in logs(), "reconoce la canción con AudD (y borra el audio)")
        check(any("Es «Bonito», de Jarabe de Palo." in x["t"] for x in spk()), "dice qué canción es")
        pg.locator(".msg.jarvis:last-child .doc-acts button", has_text="Spotify").click(); pg.wait_for_timeout(200)
        check("url https://open.spotify.com/track/abc" in logs(), "abre la canción en Spotify")
        # 6) AudD no la conoce: Gemini escucha, da una pista y busca en Google
        say("qué está sonando", 2000)
        check("La Tortura" in last() and "Shakira" in last() and any("audio/wav" in x for x in ASKED) and any('"google_search"' in x for x in ASKED), "si AudD no la reconoce: Gemini + búsqueda en Google")
        say("mis canciones", 500)
        check("Bonito" in last() and "La Tortura" in last(), "historial de canciones")
        say("ponla", 500)
        check(any("youtube.com/results?search_query=La%20Tortura" in x for x in logs()), "«ponla» abre la última en YouTube")
        # 7) traducir lo último
        say("hola", 1500)
        say("traduce eso al portugués", 1500)
        check("Olá, senhor" in last(), "traduce lo último que dijo Jarvis")
        check(pg.evaluate("JD.load().traducciones.length") >= 4, "guarda el historial de traducciones")
        # 8) ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-317").count() == 1 and "Francés ✓" in pg.inner_text("#aj-317"), "Ajustes › Traductor (paquetes) y Canciones (clave AudD)")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.17)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
