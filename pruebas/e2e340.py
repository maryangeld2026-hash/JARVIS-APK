"""Prueba de punta a punta de la 3.40: sin «scratch» al terminar de hablar (fundidos), imágenes 2.0 (mejor descripción, texto exacto
encima, 3 opciones, plantillas, más estilos), videos 2.0 (duración, música, portada, imágenes en paralelo, con tus fotos)
y más humano (aprende de tus correcciones, «¿de qué hablamos ayer?»)."""
import os, sys, io, json, base64, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e332 as R, e2e338 as I
from PIL import Image
from playwright.sync_api import sync_playwright

def png(color, w=96, h=96):
    b = io.BytesIO(); Image.new("RGB", (w, h), color).save(b, "PNG"); return base64.b64encode(b.getvalue()).decode()
PNGS = [png((40, 120, 200)), png((230, 140, 40)), png((60, 170, 90))]
PCM_FUERTE = base64.b64encode(b"\x20\x4e" * 24000).decode()          # medio segundo a volumen alto constante: si termina en seco, «clic»
PED = {"sense": [], "tts": [], "texto": []}
K = [0]

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.1-flash-tts-preview", "supportedGenerationMethods": ["generateContent"]}]})
    if "tts" in u:
        PED["tts"].append(json.loads(body)["contents"][0]["parts"][0]["text"])
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": PCM_FUERTE}}]}}]})
    PED["texto"].append(body)
    if "Convert this request" in body: t = "A detailed cinematic prompt of the requested scene, warm light, rich colors, high detail."
    elif "escenas" in body: t = json.dumps({"titulo": "Max surfea", "escenas": [{"imagen": "perro en la playa", "texto": "Un día de sol", "voz": "Era un día de sol."}, {"imagen": "perro en la tabla", "texto": "¡A surfear!", "voz": "Max se animó."}, {"imagen": "perro en la ola", "texto": "¡Lo logró!", "voz": "Y lo logró."}]})
    elif "de qué hablamos" in body: t = "- Hablamos de la receta de arepas.\n- Me pediste recordar la cita del martes."
    else: t = "Listo."
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(t))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": t}]}}]})

def sense(route):
    h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    PED["sense"].append(json.loads(route.request.post_data or "{}")); K[0] += 1
    return route.fulfill(json={"data": [{"b64_json": PNGS[K[0] % 3]}]}, headers=h)

ESPIA = """window.__fuentes = []; (() => { const st = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function () {
  try { const b = this.buffer; if (b && b.length > 8000) { const c = b.getChannelData(0); window.__fuentes.push([c[0], c[c.length - 1], Math.max(...Array.from(c.subarray(c.length - 200)).map(Math.abs))]); } } catch (e) {} return st.apply(this, arguments); }; })();"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    fotos = []
    d = tempfile.mkdtemp()
    for i, c in enumerate([(200, 50, 50), (50, 200, 50), (50, 50, 200)]):
        f = os.path.join(d, f"foto{i}.png"); Image.new("RGB", (300, 400), c).save(f); fotos.append(f)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(R.NATIVE); ctx.add_init_script(I.GALERIA); ctx.add_init_script(ESPIA)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://token.sensenova.ai/**", sense)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        ayer = "Date.now() - 864e5"
        pg.evaluate(f"""localStorage.setItem('jarvis.android.v1', JSON.stringify({{ ajustes: {{ proveedor: 'gemini', claves: {{ gemini: 'AIzaX', sensenova: 'sk' }}, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false, v337: 1, v3371: 1, estilo: {{ estilo: 'natural' }}, imgGeminiNo: new Date().toDateString(), vidVeoNo: new Date().toDateString() }},
          chat: [{{ role: 'user', content: '¿cómo se hacen las arepas?', t: {ayer} }}, {{ role: 'assistant', content: 'Con harina de maíz…', t: {ayer} + 1000 }}] }}))""")
        pg.reload(); pg.wait_for_timeout(3500)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        img = lambda: pg.evaluate("(document.querySelector('.msg.jarvis:last-of-type .gen-img') || {}).src || ''")
        # 1) sin «scratch»: la voz natural empieza y termina en silencio (antes, en seco a todo volumen)
        pg.evaluate("Object.assign(JD.load().ajustes, { voz: true, vozIA: 'gemini', vozIAnombre: 'Charon' }); window.__fuentes.length = 0; JV.say('Hola, esta es una prueba de la voz.')"); pg.wait_for_timeout(3000)
        fu = pg.evaluate("window.__fuentes")
        check(fu and abs(fu[-1][0]) < 0.01 and abs(fu[-1][1]) < 0.01 and fu[-1][2] < 0.6, "la voz natural empieza y termina suave (sin «clic» ni «scratch») " + str(fu[-1:]))
        pg.evaluate("JD.load().ajustes.voz = false; JV.hush()")
        # 2) imágenes 2.0: la IA mejora la descripción y el texto exacto lo pone Jarvis encima
        say("haz un afiche de mi negocio de empanadas que diga «Empanadas a $2.500»", 3500)
        pr = PED["sense"][-1]["prompt"] if PED["sense"] else ""
        check(pr.startswith("A detailed cinematic prompt") and "Empanadas a" not in pr and "Sin letras" in pr, "la IA mejora la descripción (en inglés) y le pide dejar espacio para el texto · " + pr[:60])
        src = img()
        check(src.startswith("data:image/png") and base64.b64decode(src.split(",")[1])[:4] == b"\x89PNG" and src.split(",")[1] not in PNGS, "el texto «Empanadas a $2.500» lo escribe Jarvis encima (la imagen cambió)")
        # 3) 3 opciones para escoger
        n = len(PED["sense"])
        pg.click(".msg.jarvis:last-of-type button:has-text('3 opciones')"); pg.wait_for_timeout(3500)
        check(pg.locator(".msg.jarvis:last-of-type .img-grid img").count() == 3 and len(PED["sense"]) == n + 3, "«🖼️ 3 opciones»: tres más para escoger")
        pg.locator(".msg.jarvis:last-of-type .img-grid img").nth(1).click(); pg.wait_for_timeout(400)
        check(img() and "Aquí está" in last(), "al tocar una, queda como la imagen principal")
        # 4) más estilos y plantillas
        say("dibújame un gato en pixel art", 3000)
        check("pixel art" in PED["sense"][-1]["prompt"].lower(), "estilo nuevo: pixel art")
        say("quiero crear una imagen", 600)
        pg.click("#img-sh button:has-text('Invitación')"); pg.wait_for_timeout(200)
        val = pg.input_value("#img-sh textarea"); on = pg.evaluate("[...document.querySelectorAll('#img-sh .chip.on')].map(c => c.textContent)")
        check("Invitación" in val and any("Caricatura" in x for x in on) and any("Vertical" in x for x in on), "plantilla «🎉 Invitación»: llena el texto, el estilo y el formato · " + str(on))
        pg.locator("#img-sh .icon-btn").first.click()
        # 5) videos 2.0: duración, imágenes en paralelo, portada, música y voz
        n = len(PED["sense"])
        say("hazme un video de 15 segundos de un perro surfeando", 500)
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type video') || /No pude hacer el video/.test(LASTJ())", timeout=60000)
        check("música" in last() and "Max surfea" in last() and len(PED["sense"]) - n == 3, "video de 15 s: 3 escenas, con voz y música · " + last()[:90])
        tam = pg.evaluate("(async () => { const r = await fetch(document.querySelector('.msg.jarvis:last-of-type video').src); return (await r.blob()).size; })()")
        check(tam > 20000, f"el video se grabó ({tam} bytes)")
        # 6) video con tus fotos
        with pg.expect_file_chooser() as fc:
            pg.fill("#in-texto", "hazme un video con mis fotos del paseo"); pg.press("#in-texto", "Enter")
        fc.value.set_files(fotos)
        pg.wait_for_function("(document.querySelector('.msg.jarvis:last-of-type video') && /tus fotos/.test(LASTJ())) || /No pude hacer el video/.test(LASTJ())", timeout=40000)
        check("con tus fotos y música" in last() and "Paseo" in last(), "«hazme un video con mis fotos del paseo» (las fotos no salen del celular)")
        # 7) aprende de tus correcciones
        say("eso fue muy largo", 600)
        check(pg.evaluate("JD.load().ajustes.estilo.largo") == "corto" and "1 o 2 frases" in pg.evaluate("window.__jarvis.systemPrompt()"), "«eso fue muy largo» → desde ya responde corto")
        say("habla más despacio", 600)
        check(abs(pg.evaluate("JD.load().ajustes.velocidad") - 0.85) < 0.001, "«habla más despacio» → baja la velocidad de la voz")
        say("no uses emojis", 600)
        check("No uses emojis." in pg.evaluate("window.__jarvis.systemPrompt()"), "«no uses emojis» → la IA ya no los usa")
        # 8) «¿de qué hablamos ayer?»
        say("¿de qué hablamos ayer?", 2000)
        body = next((x for x in reversed(PED["texto"]) if "de qué hablamos" in x), "")
        check("arepas" in body and "Lo que hablamos ayer" in last() and "receta de arepas" in last(), "«¿de qué hablamos ayer?» resume lo de ayer")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.40)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
