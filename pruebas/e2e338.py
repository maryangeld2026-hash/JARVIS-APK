"""Prueba de punta a punta de la 3.38: crear imágenes de la forma más fácil (por voz o con 📎 › 🎨), con estilos y formatos,
y la cadena Gemini → SenseNova → Pollinations; guardar en la galería y compartir."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e332 as R
from playwright.sync_api import sync_playwright

PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
GALERIA = """window.__gal = []; (() => { const P0 = window.Capacitor.Plugins; window.Capacitor.Plugins = new Proxy({}, { get: (t, n) => n === 'Galeria' ? { guardar: async (o) => { window.__gal.push(o.nombre + ' ' + o.mime + ' ' + o.base64.length); return { uri: 'content://x' }; } } : P0[n] }); })();"""
GEM = {"img": 429}
PEDIDOS = {"gemini": [], "sense": [], "poll": []}

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.1-flash-image", "supportedGenerationMethods": ["generateContent"]}]})
    if "image:generateContent" in u:
        PEDIDOS["gemini"].append(json.loads(body))
        if GEM["img"] != 200: return route.fulfill(status=GEM["img"], json={"error": {"code": GEM["img"], "message": "Quota exceeded for metric: generate_content_free_tier_requests, limit: 0, model: gemini-3.1-flash-image"}})
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "image/png", "data": PNG}}]}}]})
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Listo, señor."))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Listo, señor."}]}}]})

def sense(route):
    h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    PEDIDOS["sense"].append(json.loads(route.request.post_data or "{}"))
    return route.fulfill(json={"data": [{"b64_json": PNG}]}, headers=h)

def poll(route):
    PEDIDOS["poll"].append(route.request.url)
    return route.fulfill(status=200, body=base64.b64decode(PNG), headers={"content-type": "image/png", "access-control-allow-origin": "*"})

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(R.NATIVE); ctx.add_init_script(GALERIA)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://token.sensenova.ai/**", sense)
        ctx.route("https://image.pollinations.ai/**", poll)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX', sensenova: 'sk-sense' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false, v337: 1 } }))""")
        pg.reload(); pg.wait_for_timeout(3500)
        say = lambda t, w=2500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        img = lambda: pg.evaluate("(document.querySelector('.msg.jarvis:last-of-type .gen-img') || {}).src || ''")
        # 1) «dibújame…»: Gemini gratis no deja (limit: 0) → SenseNova la hace
        say("dibújame un gato astronauta")
        check(img().startswith("data:image/png;base64,") and "SenseNova" in last() and "gato astronauta" in last(), "«dibújame un gato astronauta»: Gemini gratis no deja → la hace SenseNova · " + last()[:70])
        check(PEDIDOS["gemini"] and PEDIDOS["gemini"][0]["generationConfig"]["imageConfig"]["aspectRatio"] == "1:1", "primero intentó con Gemini (cuadrada)")
        check(PEDIDOS["sense"] and PEDIDOS["sense"][-1]["model"] == "sensenova-u1.5-fast" and "español" in PEDIDOS["sense"][-1]["prompt"], "a SenseNova le pide U1.5 Fast")
        n = len(PEDIDOS["gemini"])
        # 2) guardar en la galería y otra versión / otro estilo
        pg.click(".msg.jarvis:last-of-type button:has-text('Guardar en la galería')"); pg.wait_for_timeout(500)
        check(pg.evaluate("window.__gal").__len__() == 1 and pg.evaluate("window.__gal[0]").startswith("jarvis-un-gato-astronauta image/png"), "«💾 Guardar en la galería» (Imágenes › Jarvis)")
        pg.click(".msg.jarvis:last-of-type button:has-text('Otro estilo')"); pg.wait_for_timeout(300)
        pg.click(".msg.jarvis:last-of-type button:has-text('Anime')"); pg.wait_for_timeout(2500)
        check("Anime" in last() and "anime" in PEDIDOS["sense"][-1]["prompt"], "«🎭 Otro estilo» → Anime")
        check(len(PEDIDOS["gemini"]) == n, "Gemini sin cupo: hoy no lo vuelve a intentar (no hace esperar)")
        say("cámbiale: que sea de noche")
        check("Cambio: que sea de noche" in PEDIDOS["sense"][-1]["prompt"] and img(), "«cámbiale: que sea de noche» rehace la imagen con el cambio")
        # 3) sin SenseNova: Pollinations, gratis y sin clave, con el formato pedido
        pg.evaluate("delete JD.load().ajustes.claves.sensenova; JD.save()")
        say("imagen de un volcán para mi clase, vertical", 3500)
        check(PEDIDOS["poll"] and "width=576&height=1024" in PEDIDOS["poll"][-1] and "Pollinations" in last() and "pollinations" in img(), "sin claves de imágenes: Pollinations (gratis) en vertical")
        pg.click(".msg.jarvis:last-of-type button:has-text('Guardar en la galería')"); pg.wait_for_timeout(800)
        check(len(pg.evaluate("window.__gal")) == 2 and "jarvis-imagen-de-un-volcan" in pg.evaluate("window.__gal[1]"), "también se guarda la de Pollinations (la descarga primero)")
        # 4) la hoja «🎨 Crear imagen» (📎 o «quiero crear una imagen»)
        check(pg.locator("#adj-menu #adj-img").count() == 1, "📎 › «🎨 Crear una imagen» en el menú de adjuntar")
        say("quiero crear una imagen", 600)
        check(pg.is_visible("#img-sh"), "«quiero crear una imagen» abre el creador")
        pg.fill("#img-sh textarea", "una tarjeta de cumpleaños para mi mamá con flores")
        pg.click("#img-sh button:has-text('Acuarela')"); pg.click("#img-sh button:has-text('Horizontal')"); pg.click("#img-sh button:has-text('🎨 Crear')"); pg.wait_for_timeout(3500)
        check("width=1024&height=576" in PEDIDOS["poll"][-1] and "acuarela" in PEDIDOS["poll"][-1].lower() and "tarjeta de cumplea" in last(), "el creador: estilo Acuarela y formato Horizontal con un toque")
        # 5) con una clave de Gemini que sí crea imágenes
        pg.evaluate("delete JD.load().ajustes.imgGeminiNo; JD.save()"); GEM["img"] = 200
        say("hazme un logo para mi panadería La Espiga")
        check("Gemini" in last() and img().startswith("data:image/png") and "logo plano" in json.dumps(PEDIDOS["gemini"][-1]), "con Gemini (si tu clave lo permite): el logo, en estilo logo")
        # 6) lo que no es una imagen sigue igual
        check(pg.evaluate("JX.intent('dibuja la gráfica de y = 2x + 1') && JX.intent('dibuja la gráfica de y = 2x + 1').i338") is None, "«dibuja la gráfica de…» sigue siendo Graficar")
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        check(pg.evaluate("document.querySelector('#aj-338 details.aj-grupo').dataset.tema") == "ia", "Ajustes › Inteligencia artificial › Crear imágenes")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.38)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
