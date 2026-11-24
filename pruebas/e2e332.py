"""Prueba de punta a punta de la 3.32: cadena de respaldo Gemini → Groq (gratis) → OpenRouter → IA del celular."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic2 = anyP({ addListener: on, checkPermissions: async () => ({ display: 'granted' }), speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) });
const P = {
  IALocal: anyP({ addListener: on, estado: async () => ({ listo: true, gemma: true, nombre: 'gemma-4-E2B-it.litertlm', mb: 2500, familia: 'gemma', ve: true, oye: false, libreMb: 9000 }),
    modelos: async () => ({ lista: [] }), memoria: async () => ({ totalMb: 8000, discoMb: 20000 }), precargar: async () => ({ listo: true }),
    generar: async (o) => { log('local'); return { texto: 'Te respondo desde la IA del celular.', motor: 'Gemma 4 · CPU' }; } }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url) }),
  CapacitorHttp: { request: async (o) => { log('nativo ' + o.method + ' ' + o.url); const r = await fetch(o.url, { method: o.method, headers: o.headers, body: o.data ? JSON.stringify(o.data) : undefined }); let d = null; try { d = await r.json(); } catch (e) { /* nada */ } return { status: r.status, data: d }; } },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' ? undefined : generic2) }) };
"""
ESTADO = {"gemini": 200, "groq": 200, "numes": 200}
GROQ = []
NUMES = []

def numes(route):
    u = route.request.url; h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    if u.endswith("/models"): return route.fulfill(json={"data": [{"id": "moonshotai/kimi-k3.1-pro"}, {"id": "z-ai/glm-5.3-flash:free"}, {"id": "qwen/qwen3.8-27b:free"}]}, headers=h)
    body = json.loads(route.request.post_data or "{}"); NUMES.append(body)
    if ESTADO["numes"] != 200: return route.fulfill(status=ESTADO["numes"], json={"error": {"message": "busy"}}, headers=h)
    return route.fulfill(json={"choices": [{"message": {"content": "Te respondo con Numes, señor."}}]}, headers=h)

def gem(route):
    u = route.request.url
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    if ESTADO["gemini"] != 200: return route.fulfill(status=ESTADO["gemini"], json={"error": {"code": ESTADO["gemini"], "message": "The model is overloaded."}})
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Respondo con Gemini, señor."))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "listo"}]}}]})

def groq(route):
    u = route.request.url; h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    if u.endswith("/models"): return route.fulfill(json={"data": [{"id": "llama-3.1-8b-instant"}, {"id": "openai/gpt-oss-120b"}, {"id": "qwen/qwen3.8-27b"}]}, headers=h)
    body = json.loads(route.request.post_data or "{}"); GROQ.append(body)
    if ESTADO["groq"] != 200: return route.fulfill(status=ESTADO["groq"], json={"error": {"message": "Rate limit reached"}}, headers=h)
    if body.get("stream"):
        sse = "".join("data: " + json.dumps({"choices": [{"delta": {"content": c}}]}) + "\n\n" for c in ["Te respondo ", "con Groq, ", "señor."]) + "data: [DONE]\n\n"
        return route.fulfill(status=200, headers=dict(h, **{"content-type": "text/event-stream"}), body=sse)
    return route.fulfill(json={"choices": [{"message": {"content": "listo"}}]}, headers=h)

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
        ctx.route("https://api.groq.com/**", groq)
        ctx.route("https://api.numes.ai/**", numes)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', respaldo: 'local', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false, modeloAuto: { groq: { m: 'llama-3.1-8b-instant', k: 'x' } } } }))""")
        pg.reload(); pg.wait_for_timeout(3200)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        check(not pg.evaluate("(JD.load().ajustes.modeloAuto || {}).groq"), "quien tenía Llama 3.1 8B (ya no es gratis) pasa al modelo nuevo")
        say("¿cuál es mi respaldo?", 1200)
        check("Groq" in last() and "Gemini" in last(), "«¿cuál es mi respaldo?» recomienda Groq · " + last()[:80])
        say("usa Groq de respaldo", 1000)
        check("clave" in last() and "Groq" in last(), "sin clave: explica cómo sacarla gratis (y que no la escriba en el chat)")
        # Ajustes: pegar la clave, probar y usar
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        tema = pg.evaluate("(document.querySelector('#aj-332 details.aj-grupo') || {dataset:{}}).dataset.tema")
        check(tema == "ia", "Ajustes › Inteligencia artificial › «Respaldo gratis en la nube»")
        pg.evaluate("document.querySelectorAll('#aj-332 details').forEach(d => { d.hidden = false; d.open = true; })")
        pg.fill("#aj-332 .resp-gratis >> nth=0 >> input", "gsk_prueba123")
        pg.click("#aj-332 .resp-gratis >> nth=0 >> button:has-text('Probar y usar')"); pg.wait_for_timeout(1500)
        a = pg.evaluate("JD.load().ajustes")
        check(a.get("respaldo") == "groq" and a["claves"].get("groq") == "gsk_prueba123", "Groq queda de primer respaldo " + str([a.get("respaldo"), a.get("respaldo2")]))
        check(any(x.get("model") == "openai/gpt-oss-120b" for x in GROQ), "usa GPT-OSS 120B de Groq (no el Llama viejo)")
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 1) Gemini bien
        say("¿qué es un volcán?", 2000)
        check("Respondo con Gemini" in last(), "con Gemini en línea responde Gemini")
        # 2) Gemini caída → Groq
        ESTADO["gemini"] = 503; GROQ.clear()
        say("¿qué es la fotosíntesis?", 6000)
        check("con Groq" in last(), "Gemini caída: responde Groq · " + last()[:60])
        sysl = max([len(next((m["content"] for m in x.get("messages", []) if m.get("role") == "system"), "")) for x in GROQ] or [0])
        check(0 < sysl <= 5000, f"a Groq le llega la instrucción corta ({sysl} letras)")
        # 3) Groq también sin cupo → IA del celular
        ESTADO["groq"] = 429
        say("¿qué es un átomo?", 6000)
        check("IA del celular" in last() or "desde la IA del celular" in last(), "Groq sin cupo: responde la IA del celular · " + last()[:60])
        # 4) Numes de segundo respaldo (por la vía nativa, solo modelos gratis)
        pg.evaluate("(() => { const a = JD.load().ajustes; a.claves.numes = 'nm-prueba'; Object.assign(a, JL21.ponerRespaldo(a, 'numes', 2)); JD.save(); })()")
        pg.evaluate("window.__log.length = 0")
        say("¿qué es la luna?", 6000)
        check("con Numes" in last(), "Gemini caída y Groq sin cupo: responde Numes · " + last()[:60])
        nb = NUMES[-1] if NUMES else {}
        check(nb.get("model", "").endswith(":free") and nb.get("provider") == {"max_price": {"prompt": 0, "completion": 0}} and nb.get("stream") is False, "a Numes solo le pide modelos gratis (nunca de pago) · " + str(nb.get("model")))
        check(any(x.startswith("nativo POST https://api.numes.ai/api/v1/chat/completions") for x in pg.evaluate("window.__log")), "Numes va por la vía nativa de Android (su API no acepta la vista web)")
        ESTADO["numes"] = 503
        say("¿qué es un cometa?", 6000)
        check("IA del celular" in last(), "y si Numes tampoco: la IA del celular")
        say("¿cuál es mi respaldo?", 1000)
        check(last().find("Gemini") < last().find("Groq") < last().find("celular") and last().find("Gemini") >= 0, "la cadena: Gemini → Groq → IA del celular")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.32)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
