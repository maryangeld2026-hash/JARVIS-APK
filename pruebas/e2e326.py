"""Prueba de punta a punta de la 3.26: los 19 modelos de la cuenta de Gemini (lista, escoger, rotación cuando uno se queda
sin cupo), el probador (en Ajustes y por voz) y DeepSeek V4.1 Flash como segunda IA en la nube."""
import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NOMBRES = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.5-pro", "gemini-3-flash", "gemini-3-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
  "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest",
  "gemma-4-27b-it", "gemma-4-12b-it", "gemma-4-4b-it", "gemini-3.6-flash-preview-10-2026", "gemini-exp-1206"]
MODELS = [{"name": "models/" + n, "displayName": n.upper(), "supportedGenerationMethods": ["generateContent"]} for n in NOMBRES] + [
  {"name": "models/text-embedding-005", "supportedGenerationMethods": ["embedContent"]},
  {"name": "models/gemini-3.5-flash-preview-tts", "supportedGenerationMethods": ["generateContent"]}]
SIN_CUPO = {"gemini-3.5-flash-lite", "gemini-2.5-pro"}
CAIDA = {"v": False}
USADOS = []; DS = []

def gem(route):
    u = route.request.url
    if "/models?" in u: return route.fulfill(json={"models": MODELS})
    m = re.search(r"/models/([^:]+):", u).group(1)
    USADOS.append(m)
    if CAIDA["v"]: return route.fulfill(status=503, json={"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})
    if m in SIN_CUPO: return route.fulfill(status=429, json={"error": {"code": 429, "message": "Quota exceeded", "status": "RESOURCE_EXHAUSTED"}})
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(f"Responde {m}, señor."))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "listo"}]}}]})

def deepseek(route):
    r = route.request; u = r.url
    if u.endswith("/models"): return route.fulfill(json={"data": [{"id": "deepseek-flash"}, {"id": "deepseek-v4-pro"}]})
    b = json.loads(r.post_data or "{}"); DS.append(b.get("model"))
    if b.get("stream"):
        ev = "data: " + json.dumps({"choices": [{"delta": {"content": "Responde DeepSeek V4.1 Flash, señor."}}]}) + "\n\ndata: [DONE]\n\n"
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=ev)
    return route.fulfill(json={"choices": [{"message": {"content": "listo"}}]})

NATIVE = """
window.__log = []; window.__cola = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__emit = (n, d) => (lst[n] || []).forEach((f) => f(d));
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const generic2 = anyP(generic); const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: window.__cola.splice(0) }), abrir: async (o) => log('url ' + o.url) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' || n === 'IALocal' ? undefined : generic2) }) };
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
        ctx.route("https://api.deepseek.com/**", deepseek)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=1800: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        # 1) rotación: el primero no tiene cupo → sigue con el siguiente de la cuenta
        say("¿qué es un volcán?", 3000)
        check(USADOS[:2] == ["gemini-3.5-flash-lite", "gemini-3-flash-lite"] and "Responde gemini-3-flash-lite" in last(), "sin cupo en el primero: sigue con el siguiente modelo " + str(USADOS[:3]))
        rot = pg.evaluate("JIA.rotacion('gemini')")
        check(len(rot) == 19, f"la rotación tiene los 19 modelos de la cuenta ({len(rot)})")
        n0 = len(USADOS); say("¿y un río?", 2500)
        check(USADOS[n0] == "gemini-3-flash-lite", "el modelo sin cupo no se vuelve a intentar por un rato")
        # 2) Ajustes: la lista y el probador
        pg.click("#btn-ajustes"); pg.wait_for_timeout(600)
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(200)
        check(pg.evaluate("document.querySelector('#aj-326 details.aj-grupo').dataset.tema") == "ia", "Ajustes › Inteligencia artificial › Modelos y probador")
        pg.click("#aj-326 button:has-text('Ver mis modelos')"); pg.wait_for_timeout(900)
        check(pg.locator("#pm-lista .pm-m:not(.pm-auto)").count() == 19 and "19 modelos" in pg.inner_text("#pm-res"), "la lista muestra los 19 modelos de la cuenta")
        pg.click("#aj-326 button:has-text('Probar todos')"); pg.wait_for_timeout(4000)
        res = pg.inner_text("#pm-res")
        check("17 de 19" in res and "sin cupo" in res, "probar todos: 17 de 19 responden, 2 sin cupo · " + res[:90])
        check(pg.locator("#pm-lista .pm-est[data-e=ok]").count() == 17 and pg.locator("#pm-lista .pm-est[data-e=cupo]").count() == 2, "cada modelo con su resultado")
        pg.click("#pm-lista .pm-m[data-id='gemini-3.5-pro'] input[type=radio]"); pg.wait_for_timeout(200)
        check(pg.evaluate("JD.load().ajustes.modelo") == "gemini-3.5-pro" and pg.input_value("#a-modelo") == "gemini-3.5-pro", "escoger un modelo de la lista")
        pg.click("#pm-lista .pm-auto input[type=radio]"); pg.wait_for_timeout(200)
        check(pg.evaluate("JD.load().ajustes.modelo") == "", "volver a «Automático»")
        # 3) DeepSeek como segunda
        pg.fill("#ajustes .pm-ds input", "sk-ds"); pg.dispatch_event("#ajustes .pm-ds input", "change"); pg.wait_for_timeout(100)
        pg.click("#ajustes .pm-ds button:has-text('Usar DeepSeek de respaldo')"); pg.wait_for_timeout(300)
        check(pg.evaluate("JD.load().ajustes.respaldo") == "deepseek" and pg.evaluate("JD.load().ajustes.claves.deepseek") == "sk-ds", "«Usar DeepSeek de respaldo» con su clave")
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        CAIDA["v"] = True
        say("¿qué es la lava?", 6000)
        check("DeepSeek V4.1 Flash" in last() and "deepseek-flash" in DS, "Gemini falla: responde DeepSeek V4.1 Flash (deepseek-flash) " + str(DS[:3]))
        CAIDA["v"] = False
        pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(300)
        # 4) por voz
        say("¿qué modelos tengo?", 1500)
        check("19 modelos para conversar" in last(), "«¿qué modelos tengo?» → los 19")
        say("prueba los modelos", 6000)
        l = last()
        check("17 de 19" in l and "Respaldo (DeepSeek V4.1 Flash): ✓" in l, "«prueba los modelos» → tabla, resumen y el respaldo · " + l[:120])
        say("prueba los modelos de DeepSeek", 3000)
        check("2 de 2" in last(), "«prueba los modelos de DeepSeek»")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.26)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
