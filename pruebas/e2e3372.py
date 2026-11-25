"""Prueba de punta a punta de la 3.37.2: la voz natural ya no lee la instrucción («Lee en español latino neutro…»), las frases largas
no se cortan ni entra la voz del celular encima, el «¿Sí?» al llamar a Jarvis es un tono, y SenseNova como respaldo gratis."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e332 as R
from playwright.sync_api import sync_playwright

SEG = 22                                                       # una frase larga: 22 segundos de audio (antes, hacia los 19 s entraba la voz del celular)
PCM_LARGO = base64.b64encode(b"\x00\x00" * (24000 * SEG)).decode()
PCM = base64.b64encode(b"\x00\x00" * 12000).decode()
TTS = []
SENSE = []
ESTADO = {"gemini": 200, "sense": 200}
RESP = ["Respondo con Gemini, señor."]

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.1-flash-tts-preview", "supportedGenerationMethods": ["generateContent"]}]})
    if "tts" in u:
        t = json.loads(body)["contents"][0]["parts"][0]["text"]; TTS.append(t)
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": PCM_LARGO if "larga" in t else PCM}}]}}]})
    if ESTADO["gemini"] != 200: return route.fulfill(status=ESTADO["gemini"], json={"error": {"code": ESTADO["gemini"], "message": "The model is overloaded."}})
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(RESP[0]))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": RESP[0]}]}}]})

def sense(route):
    u = route.request.url; h = {"access-control-allow-origin": "*", "access-control-allow-headers": "*"}
    if route.request.method == "OPTIONS": return route.fulfill(status=204, headers=h)
    if u.endswith("/models"): return route.fulfill(json={"data": [{"id": "sensenova-6.8-flash-lite"}, {"id": "sensenova-6.8-flash"}, {"id": "sensenova-u1.5-fast"}]}, headers=h)
    body = json.loads(route.request.post_data or "{}"); SENSE.append(body)
    if ESTADO["sense"] != 200: return route.fulfill(status=ESTADO["sense"], json={"error": {"message": "busy"}}, headers=h)
    return route.fulfill(json={"choices": [{"message": {"content": "Te respondo con SenseNova."}}]}, headers=h)

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(R.NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        ctx.route("https://token.sensenova.ai/**", sense)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: true, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false,
          estilo: { estilo: 'jarvis' }, v337: 1, v3371: 1, vozIA: 'gemini', vozIAnombre: 'Charon' } }))""")
        pg.reload(); pg.wait_for_timeout(3500)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        # 1) la voz natural recibe SOLO lo que hay que decir (antes leía «Lee en español latino neutro, como un mayordomo…»)
        say("¿qué es un volcán?", 5000)
        check(TTS and all(not t.startswith(("Lee ", "Dilo ")) and "mayordomo" not in t and "español latino" not in t for t in TTS), "a la voz natural solo le llega el texto, sin instrucciones que lea en voz alta · " + str(TTS[:2]))
        check(not pg.evaluate("window.__said"), "y toda la respuesta suena con la voz natural (nada con la del celular)")
        # 2) una frase larga (22 s) no se da por trabada: no entra la voz del celular encima ni se corta
        TTS.clear(); pg.evaluate("window.__said = []; JV.hush(); JV.say('Esta es una frase larga que tarda bastante en decirse.'); setTimeout(() => JV.say('Y esta va después.'), 300)")
        pg.wait_for_timeout((SEG + 4) * 1000)
        check(not pg.evaluate("window.__said") and len(TTS) >= 2, "frase larga: termina con la voz natural y la siguiente sigue igual (no entra otra voz)")
        # 3) al llamar a Jarvis («Jarvis» o el botón): un tono, no un «¿Sí?» que vaya a internet
        TTS.clear(); pg.evaluate("window.__said = []; JV.hush(); window.__tono = 0; const O = window.AudioContext; window.AudioContext = class extends O { createOscillator() { window.__tono++; return super.createOscillator(); } }; 0")
        pg.evaluate("window.__jarvis.wake()"); pg.wait_for_timeout(1500)
        check(pg.evaluate("window.__tono") >= 2 and not TTS and not pg.evaluate("window.__said"), "al llamar a Jarvis con la voz natural: suena un tono (sin pedirle nada a Gemini ni mezclar voces)")
        pg.evaluate("JV.cancelListening ? JV.cancelListening() : JV.stopListening(); window.__jarvis.setState('idle')")
        # 4) SenseNova de respaldo: por la vía nativa, sin streaming y con el modelo 6.8 Flash
        say("usa sensenova de respaldo", 1200)
        check("SenseNova" in pg.evaluate("LASTJ()") and "clave" in pg.evaluate("LASTJ()"), "«usa SenseNova de respaldo» sin clave: dice dónde sacarla · " + pg.evaluate("LASTJ()")[:80])
        pg.evaluate("(() => { const a = JD.load().ajustes; a.claves.sensenova = 'sk-sense'; Object.assign(a, JL21.ponerRespaldo(a, 'sensenova', 1)); a.vozIA = ''; JD.save(); })()")
        ESTADO["gemini"] = 503; pg.evaluate("window.__log.length = 0")
        say("¿qué es la luna?", 6000)
        check("con SenseNova" in pg.evaluate("LASTJ()"), "Gemini caída: responde SenseNova · " + pg.evaluate("LASTJ()")[:60])
        sb = SENSE[-1] if SENSE else {}
        check(sb.get("model") == "sensenova-6.8-flash" and sb.get("stream") is False and "response_format" not in sb, "le pide SenseNova 6.8 Flash, sin streaming · " + str(sb.get("model")))
        check(any(x.startswith("nativo POST https://token.sensenova.ai/v1/chat/completions") for x in pg.evaluate("window.__log")), "SenseNova va por la vía nativa de Android")
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        check("SenseNova" in pg.evaluate("document.querySelector('#ajustes').textContent"), "SenseNova aparece en Ajustes › Si la IA principal falla")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.37.2)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
