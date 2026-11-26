"""Prueba de punta a punta de la 3.39: videos (Veo si la clave lo permite; si no, el video gratis hecho en el celular con
imágenes de IA, movimiento, textos y la voz de Jarvis) y el atajo a Infinall."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e332 as R, e2e338 as I
from playwright.sync_api import sync_playwright

PCM = base64.b64encode(b"\x00\x00" * (24000 * 2)).decode()
VEO = {"estado": 429, "polls": 0}
PEDIDOS = {"veo": [], "sense": [], "tts": [], "guion": []}
GUION = {"titulo": "Perro surfista", "escenas": [{"imagen": "un perro en la playa", "texto": "Un día de sol", "voz": "Era un día de sol en la playa."},
  {"imagen": "el perro sobre una tabla", "texto": "¡A surfear!", "voz": "Y Max decidió surfear."}, {"imagen": "el perro feliz en la ola", "texto": "¡Lo logró!", "voz": "Y lo logró."}]}

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.1-flash-image", "supportedGenerationMethods": ["generateContent"]},
        {"name": "models/gemini-3.1-flash-tts-preview", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/veo-3.1-fast-generate-001", "supportedGenerationMethods": ["predictLongRunning"]}]})
    if ":predictLongRunning" in u:
        PEDIDOS["veo"].append(json.loads(body))
        if VEO["estado"] != 200: return route.fulfill(status=VEO["estado"], json={"error": {"code": VEO["estado"], "message": "Quota exceeded, limit: 0, model: veo-3.1-fast"}})
        return route.fulfill(json={"name": "models/veo-3.1-fast-generate-001/operations/op123", "done": False})
    if "/operations/op123" in u:
        VEO["polls"] += 1
        return route.fulfill(json={"name": "op123", "done": True, "response": {"generateVideoResponse": {"generatedSamples": [{"video": {"uri": "https://generativelanguage.googleapis.com/v1beta/files/vid1:download?alt=media"}}]}}})
    if "files/vid1" in u: return route.fulfill(status=200, body=b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4000, headers={"content-type": "video/mp4", "access-control-allow-origin": "*"})
    if "image:generateContent" in u: return route.fulfill(status=429, json={"error": {"code": 429, "message": "limit: 0"}})
    if "tts" in u:
        PEDIDOS["tts"].append(json.loads(body)["contents"][0]["parts"][0]["text"])
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": PCM}}]}}]})
    if "guion" in body.lower() or "escenas" in body:
        PEDIDOS["guion"].append(body)
        t = json.dumps(GUION)
    else: t = "Listo, señor."
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(t))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": t}]}}]})

def sense(route):
    h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    PEDIDOS["sense"].append(json.loads(route.request.post_data or "{}"))
    return route.fulfill(json={"data": [{"b64_json": I.PNG}]}, headers=h)

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO", permissions=["clipboard-read", "clipboard-write"])
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(R.NATIVE); ctx.add_init_script(I.GALERIA)
        ctx.add_init_script("window.Capacitor && (window.Capacitor.Plugins.CapacitorHttp, 0)")
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://token.sensenova.ai/**", sense)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX', sensenova: 'sk-sense' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false, v337: 1 } }))""")
        pg.reload(); pg.wait_for_timeout(3500)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        # 1) Veo no está en el plan gratis → video gratis hecho en el celular (guion, imágenes, voz, grabación)
        say("hazme un video de un perro surfeando", 1000)
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type video') || /No pude hacer el video/.test(LASTJ())", timeout=60000)
        check(PEDIDOS["veo"] and PEDIDOS["veo"][0]["parameters"]["aspectRatio"] == "9:16", "primero intenta con Veo (vertical) · " + str(PEDIDOS["veo"][:1])[:80])
        check(pg.evaluate("JD.load().ajustes.vidVeoNo") == pg.evaluate("new Date().toDateString()"), "Veo sin cupo: hoy no lo vuelve a intentar")
        check(PEDIDOS["guion"] and len(PEDIDOS["sense"]) == 3, f"escribe el guion y crea una imagen por escena ({len(PEDIDOS['sense'])} con SenseNova)")
        check(PEDIDOS["tts"] and "Max decidió surfear" in PEDIDOS["tts"][0], "la voz de Jarvis narra el guion")
        src = pg.evaluate("(document.querySelector('.msg.jarvis:last-of-type video') || {}).src || ''")
        check(src.startswith("blob:") and "en tu celular" in last() and "Perro surfista" in last(), "el video queda en el chat, listo para ver · " + last()[:80])
        tam = pg.evaluate("(async () => { const r = await fetch(document.querySelector('.msg.jarvis:last-of-type video').src); const b = await r.blob(); return [b.size, b.type]; })()")
        check(tam[0] > 5000 and tam[1].startswith("video/"), f"es un video de verdad ({tam[0]} bytes, {tam[1]})")
        pg.click(".msg.jarvis:last-of-type button:has-text('Guardar en la galería')"); pg.wait_for_timeout(800)
        g = pg.evaluate("window.__gal")
        check(g and g[-1].startswith("jarvis-video-un-perro-surfeando video/"), "«💾 Guardar en la galería» (Películas › Jarvis) · " + str(g[-1:])[:80])
        # 2) con una clave que sí permite Veo: el video lo hace la IA de Google
        pg.evaluate("delete JD.load().ajustes.vidVeoNo; JD.save()"); VEO["estado"] = 200
        say("crea un video de un atardecer en Cartagena, horizontal", 1000)
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type video') || /No pude/.test(LASTJ())", timeout=40000)
        check("Veo de Google" in last() and VEO["polls"] >= 1 and PEDIDOS["veo"][-1]["parameters"]["aspectRatio"] == "16:9", "con Veo: espera el trabajo y descarga el video (horizontal) · " + last()[:70])
        # 3) la hoja «🎬 Crear video» y el menú 📎
        check(pg.locator("#adj-menu #adj-vid").count() == 1, "📎 › «🎬 Crear un video»")
        say("haz un video", 500)
        check(pg.is_visible("#vid-sh"), "«haz un video» (sin decir de qué) abre el creador")
        pg.locator("#vid-sh .icon-btn").first.click(); pg.wait_for_timeout(200)
        # 4) atajo a Infinall
        pg.evaluate("window.__log.length = 0")
        say("abre Infinall para un anuncio de mi panadería", 800)
        clip = pg.evaluate("navigator.clipboard.readText()")
        check(any(x == "url https://app.infinall.ai/home" for x in pg.evaluate("window.__log")) and clip == "un anuncio de mi panadería" and "Pegar" in last(), "«abre Infinall para…»: abre la página con la descripción copiada")
        # 5) lo de YouTube sigue igual
        check(pg.evaluate("(JX.intent('hazme un resumen de este video') || {}).v339") is None, "«resumen de este video» sigue siendo lo de YouTube")
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        check(pg.evaluate("document.querySelector('#aj-339 details.aj-grupo').dataset.tema") == "ia", "Ajustes › Inteligencia artificial › Crear videos")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.39)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
