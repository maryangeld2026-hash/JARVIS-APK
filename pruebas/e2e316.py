"""Prueba de punta a punta de la 3.16: conversación fluida (voz en fila sin pausas, frases juntas, voz natural con menos pedidos),
apagar Jarvis de verdad, personalidad y voz de Jarvis, y nada de «profesor» sin el modo docente."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
TTS = []
LARGA = ("Por supuesto, señor. El café de olla se prepara en una olla de barro. Primero se calienta el agua con la panela. "
         "Cuando la panela se disuelve, se agrega la canela. Luego se echa el café molido y se deja reposar. "
         "Después se cuela con un colador de tela. Finalmente se sirve bien caliente, idealmente en pocillo de peltre.")

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-2.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]}]})
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    if "-tts:" in u:
        TTS.append(body["contents"][0]["parts"][0]["text"])
        pcm = base64.b64encode(b"\x00\x00" * 2400).decode()             # 0,1 s de silencio
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;rate=24000", "data": pcm}}]}}]})
    ASKED.append(json.dumps(body, ensure_ascii=False))
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(LARGA, 18))

NATIVE = """
window.__log = []; window.__spk = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
let activos = 0;
const TTS = { addListener: on, stop: async () => { log('tts-stop'); },
  // como Android: cada frase avisa al terminar; con queueStrategy 1 se pone en fila detrás de la que suena
  speak: (o) => { activos++; window.__spk.push({ t: o.text, q: o.queueStrategy, solapada: activos > 1, voice: o.voice, pitch: o.pitch }); window.__said.push(o.text);
    const fin = (window.__ttsFin = Math.max(window.__ttsFin || 0, Date.now()) + 120); return new Promise((r) => setTimeout(() => { activos--; r(); }, fin - Date.now())); },
  getSupportedVoices: async () => ({ voices: [{ name: 'es-us-x-esf-local', lang: 'es-US', localService: true }, { name: 'es-us-x-esd-network', lang: 'es-US' }, { name: 'es-us-x-esd-local', lang: 'es-US', localService: true }, { name: 'en-gb-x-rjs-local', lang: 'en-GB' }] }) };
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80, ahorro: false, sinRestriccion: false }) };
const P = {
  TextToSpeech: TTS,
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async () => {}, textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {},
    apagar: async () => log('apagar'), salir: async () => log('salir'), minimizar: async () => log('minimizar') },
  Escucha: { addListener: on, desactivar: async () => log('escucha-off'), estado: async () => ({ activo: false }), config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }) },
  Burbuja: { addListener: on, ocultar: async () => log('burbuja-off'), estado: async () => {} },
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
        b = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: true, trato: 'profesor', asignatura: 'matemáticas', estilo: { estilo: 'cercano' } } }))""")
        pg.reload(); pg.wait_for_timeout(2200)
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        A = lambda k: pg.evaluate(f"JD.load().ajustes.{k}")
        # personalidad y voz de Jarvis (se ponen solas una vez al actualizar)
        check(A("estilo")["estilo"] == "jarvis", "la personalidad de Jarvis queda puesta al actualizar")
        check(A("vozIdx") == 2 and abs(A("tono") - 0.9) < 0.01, "escoge sola la voz masculina del celular (sin internet) y baja el tono")
        check(pg.evaluate("window.__jarvis.trato()") == "señor", "sin modo docente: «señor», no «profesor»")
        # conversación: prompt sin cosas de la clase
        pg.evaluate("window.__said.length = 0; window.__spk.length = 0")
        say("cómo se hace el café de olla", 3500)
        sp = ASKED[-1] if ASKED else ""
        check("J.A.R.V.I.S." in sp and "«señor»" in sp, "el prompt tiene la personalidad de Jarvis")
        check("La clase actual" not in sp and "docente" not in sp.split("\\u0001")[0] and "la profe" not in sp, "sin modo docente: nada de clases ni asignatura en el prompt")
        spk = pg.evaluate("window.__spk")
        dicho = " ".join(x["t"] for x in spk)
        check("pocillo de peltre" in dicho and "café molido" in dicho, "dice la respuesta completa")
        check(all(x["q"] == 1 for x in spk) and any(x["solapada"] for x in spk), "voz en fila: la frase siguiente ya está lista mientras suena la anterior (sin pausas)")
        check(len(spk) < 6, f"junta frases cortas: {len(spk)} trozos para 7 frases")
        check(all(x["voice"] == 2 for x in spk), "habla con la voz de Jarvis")
        # callar corta de una
        pg.evaluate("window.__spk.length = 0")
        say("explícame otra vez", 250)
        pg.click("#btn-callar"); n = len(pg.evaluate("window.__spk")); pg.wait_for_timeout(1500)
        check(len(pg.evaluate("window.__spk")) == n and pg.evaluate("!JV.isSpeaking()"), "Callar detiene la voz y no sigue hablando")
        # voz natural con IA: las frases se juntan (menos pedidos)
        pg.evaluate("JD.load().ajustes.vozIA = 'gemini'; JD.load().ajustes.vozIAnombre = ''")
        TTS.clear()
        say("y el café de olla otra vez", 4500)
        check(0 < len(TTS) <= 4, f"voz natural: {len(TTS)} pedidos a la IA para 7 frases")
        check(all("mayordomo" in t for t in TTS) and all("profe" not in t for t in TTS), "voz natural con estilo de mayordomo elegante")
        pg.evaluate("JD.load().ajustes.vozIA = ''")
        # «pon la voz de Jarvis»
        pg.evaluate("JD.load().ajustes.vozIdx = 0; JD.load().ajustes.tono = 1.3")
        say("pon la voz de jarvis", 900)
        check(A("vozIdx") == 2 and "Hecho" in last(), "«pon la voz de Jarvis» la vuelve a poner")
        # apagar de verdad
        say("apágate", 2500)
        lg = logs()
        check("Apagando sistemas" in last() or "Me desconecto" in last(), "se despide al estilo de Jarvis")
        check("apagar" in lg and "escucha-off" in lg and "burbuja-off" in lg, "apagar: suelta la escucha, la burbuja y cierra del todo")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.16)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
