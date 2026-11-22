"""Prueba de punta a punta de la 3.29 (lo de PocketPal AI): modelos GGUF (catálogo, buscador de Hugging Face, velocidad y
conversación), dictado sin internet con Whisper y voz neural sin internet (Supertonic)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nativo329.js")).read()

def gem(route):
    u = route.request.url
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("La fotosíntesis convierte la luz en energía, señor."))

def hf(route):
    u = route.request.url
    if "/api/models?search=" in u:
        return route.fulfill(json=[{"id": "bartowski/Llama-3.2-3B-Instruct-GGUF", "downloads": 123456}, {"id": "unsloth/Llama-3.2-1B-Instruct-GGUF", "downloads": 9999}], headers={"access-control-allow-origin": "*"})
    if "/tree/main" in u:
        return route.fulfill(json=[{"type": "file", "path": "Llama-3.2-3B-Instruct-Q4_0.gguf", "lfs": {"size": 1917000000}}, {"type": "file", "path": "Llama-3.2-3B-Instruct-Q4_K_M.gguf", "lfs": {"size": 2019000000}}, {"type": "file", "path": "README.md", "size": 10}], headers={"access-control-allow-origin": "*"})
    return route.fulfill(status=404, body="")

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
        ctx.route("https://huggingface.co/**", hf)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: true, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false } }))""")
        pg.reload(); pg.wait_for_timeout(3200)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        # 1) Ajustes: catálogo, buscador y velocidad
        pg.click("#btn-ajustes"); pg.wait_for_timeout(600)
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-329 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["ia", "voz", "voz"], "Ajustes: GGUF en Inteligencia artificial; Whisper y voz neural en Voz " + str(temas))
        check(pg.locator("#aj-329 .doc-acts").first.locator("button").count() >= 6, "catálogo de modelos GGUF recomendados")
        check(pg.evaluate("Object.keys(window.__jarvis.LOCALES).filter(k => /^gguf_/.test(k)).length") >= 6, "los GGUF también salen en «IA de respaldo › modelo»")
        pg.fill("#gg-q", "llama"); pg.click("#aj-329 button:has-text('Buscar')"); pg.wait_for_timeout(800)
        check(pg.locator("#gg-res .local-fila").count() == 2 and "Llama-3.2-3B" in pg.inner_text("#gg-res"), "buscar «llama» en Hugging Face")
        pg.click("#gg-res .local-fila >> nth=0 >> button:has-text('Ver')"); pg.wait_for_timeout(800)
        check(pg.locator("#gg-res .gguf-arch button").count() == 2 and "⭐" in pg.inner_text("#gg-res .gguf-arch button.on"), "ver los archivos: la cuantización recomendada (Q4_K_M) marcada")
        clear(); pg.click("#gg-res .gguf-arch button.on"); pg.wait_for_timeout(600)
        l = logs()
        check(any(x.startswith("bajar Llama-3.2-3B-Instruct-Q4_K_M.gguf https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf") for x in l), "descarga el GGUF escogido " + str(l[:2]))
        pg.click("#aj-329 button:has-text('Velocidad')"); pg.wait_for_timeout(500)
        check("escribe 11,2" in pg.inner_text("#gg-st"), "medir la velocidad del modelo")
        # 2) voz neural
        check(pg.locator("#aj-329 select").count() >= 3, "ajustes de Whisper y de la voz neural")
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        say("usa la voz neural", 1500)
        check(pg.evaluate("JD.load().ajustes.vozNeural") == "siempre", "«usa la voz neural»")
        clear(); say("hola", 2500)
        l = logs()
        check(any(x.startswith("preparar M1") for x in l) and "reproducir 7" in l, "Jarvis habla con la voz neural (prepara la frase y la reproduce) " + str(l[:4]))
        say("vuelve a la voz normal", 900)
        check(pg.evaluate("JD.load().ajustes.vozNeural") == "nunca", "«vuelve a la voz normal»")
        # 3) dictado con Whisper
        say("activa el dictado sin internet", 900)
        pg.evaluate("JD.load().ajustes.seguir = false")                       # sin conversación continua (el simulador responde al instante)
        clear(); pg.click("#btn-mic"); pg.wait_for_timeout(3000)
        check(any(x.startswith("dictado") for x in logs()) and "fotosíntesis" in pg.inner_text("#chat"), "el orbe escucha con Whisper (sin internet) y responde")
        # 4) conversación con el modelo GGUF
        pg.evaluate("JD.load().ajustes.proveedor = 'local'; JD.save()")
        clear(); say("¿qué es un volcán?", 2500)
        g = pg.evaluate("window.__gen || {}")
        check("generar" in logs() and "GGUF" in last() or "Respondo con el modelo GGUF" in last(), "responde el modelo GGUF")
        check(isinstance(g.get("mensajes"), list) and len(g.get("sistema", "")) <= 3700 and g.get("maxTokens", 0) <= 1024, "al GGUF le llega la conversación completa, ajustada a su memoria")
        say("mide la velocidad de la IA del celular", 1200)
        check("escribe 11,2" in last(), "«mide la velocidad de la IA del celular» · " + last()[:120])
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.29)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
