"""Prueba de punta a punta de la 3.37.1: la voz natural sin mezclar dos voces y sin errores
(una sola voz por respuesta, reintento sin estilo, aviso claro si falla, Charon de vuelta, y la conversación en vivo con v1alpha y plan B)."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e335 as T, e2e337 as U
from playwright.sync_api import sync_playwright

PCM = base64.b64encode(b"\x00\x00" * 12000).decode()      # medio segundo de silencio
TTS = []          # [texto pedido, respuesta]
MODO = {"falla": set(), "sinEstilo": False}
RESP = ["Primera frase de la respuesta. Segunda frase que sigue. Tercera frase para terminar."]

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.1-flash-tts-preview", "supportedGenerationMethods": ["generateContent"]}]})
    if "tts" in u:
        t = json.loads(body)["contents"][0]["parts"][0]["text"]
        primera = MODO["sinEstilo"] and t not in MODO.setdefault("vistos", set())
        if primera: MODO["vistos"].add(t)
        falla = any(k in t for k in MODO["falla"]) or primera
        TTS.append((t, "500" if falla else "ok"))
        if falla: return route.fulfill(status=500, json={"error": {"code": 500, "message": "Model tried to generate text, but it should only be used for TTS."}})
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": PCM}}]}}]})
    if "streamGenerateContent" in u: return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(RESP[0]))
    return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": RESP[0]}]}}]})

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        errs = []
        ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(T.NATIVE); ctx.add_init_script(U.WS); ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: true, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false,
          estilo: { estilo: 'natural' }, v337: 1, vozIA: 'gemini', vozIAnombre: 'Achird' } }))""")
        pg.reload(); pg.wait_for_timeout(3800)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        # 1) vuelve Charon (la 3.37 había puesto Achird y en vivo sonaba otra voz)
        check(pg.evaluate("JD.load().ajustes.vozIAnombre") == "Charon", "la voz natural vuelve a ser Charon (la de siempre de Jarvis)")
        # 2) todo bien: las tres frases con la voz natural, nada con la del celular
        pg.evaluate("window.__said = []"); say("cuéntame algo", 6000)
        check(len([x for x in TTS if x[1] == "ok"]) >= 1 and not pg.evaluate("window.__said"), "voz natural: toda la respuesta con la misma voz (nada con la del celular)")
        # 3) si el modelo «contesta» en vez de leer, se repite sin el estilo y sigue la voz natural
        TTS.clear(); MODO["sinEstilo"] = True; RESP[0] = "Esta es otra respuesta distinta. Con dos frases."; pg.evaluate("window.__said = []; JV.hush()")
        say("y otra cosa", 6000)
        check(any(x[1] == "500" for x in TTS) and any(x[1] == "ok" for x in TTS) and all(not x[0].startswith(("Dilo", "Lee ")) for x in TTS) and not pg.evaluate("window.__said"), "si Gemini no devuelve el audio, lo pide otra vez (sigue la voz natural, solo con el texto)")
        MODO["sinEstilo"] = False
        # 4) si una frase falla del todo: desde ahí, el resto de la respuesta con la voz del celular (no se mezclan) y un aviso claro
        TTS.clear(); MODO["falla"] = {"Segunda"}; pg.evaluate("window.__said = []; JV.hush()")
        pg.evaluate("JV.say('Uno: empieza bien.'); setTimeout(() => { JV.say('Segunda: aquí falla.'); setTimeout(() => JV.say('Tercera: ya no cambia.'), 900); }, 50)"); pg.wait_for_timeout(7000)
        dicho = " ".join(pg.evaluate("window.__said"))
        check("Segunda" in dicho and "Tercera" in dicho and "Uno" not in dicho, "falla una frase: esa y las que siguen con la voz del celular, sin volver a cambiar · " + dicho[:80])
        toast = pg.evaluate("(document.querySelector('#toast') || {}).textContent || ''")
        check("voz natural no está disponible" in toast and "voz del celular" in toast, "avisa por qué cambió la voz · " + toast[:90])
        check(any(x["k"] == "voz-ia" for x in pg.evaluate("JDIAG.lista()")), "queda en la bitácora para «Reportar un problema»")
        n = len(TTS); pg.evaluate("window.__said = []; JV.hush(); JV.say('Cuarta frase.')"); pg.wait_for_timeout(1500)
        check(len(TTS) == n and "Cuarta" in " ".join(pg.evaluate("window.__said")), "después de fallar, un rato con la voz del celular (no una frase sí y otra no)")
        MODO["falla"] = set()
        # 5) en vivo: lo nuevo va por v1alpha; si no lo acepta, se reconecta por v1beta sin eso
        pg.evaluate("window.__sinVivo = false; Object.assign(JD.load().ajustes, { liveModelo: 'gemini-3.8-flash-live', liveAsinc: false, liveSinExtras: '', vivoFallaT: 0 })")
        pg.click("#btn-mic"); pg.wait_for_timeout(2500)
        ws = pg.evaluate("window.__ws.map(w => [w.u.includes('v1alpha') ? 'v1alpha' : 'v1beta', !!((w.sent[0] || {}).setup || {}).proactivity])")
        check(ws and ws[-1] == ["v1alpha", True], "en vivo: el audio proactivo y el afectivo van por v1alpha " + str(ws))
        pg.evaluate("const w = window.__ws[window.__ws.length - 1]; w.onerror && w.onerror({}); w.onclose && w.onclose({ code: 1007, reason: 'Unknown name' })"); pg.wait_for_timeout(2500)
        ws = pg.evaluate("window.__ws.map(w => [w.u.includes('v1alpha') ? 'v1alpha' : 'v1beta', !!((w.sent[0] || {}).setup || {}).proactivity])")
        st = pg.evaluate("(document.querySelector('#live-st') || {}).textContent || ''")
        check(ws[-1] == ["v1beta", False] and "Se perdió" not in st, "si no lo acepta: se reconecta por v1beta, sin mostrar error " + str(ws))
        # 6) se cae ya conectada, antes de que hablaran: sigue la escucha normal, sin mensaje de error
        pg.evaluate("window.__escuchoNormal = 0; new MutationObserver(() => { if (document.body.dataset.state === 'listening') window.__escuchoNormal++; }).observe(document.body, { attributes: true, attributeFilter: ['data-state'] })")
        pg.evaluate("const w = window.__ws[window.__ws.length - 1]; JX._live.onMsg({ setupComplete: {} }); w.onclose && w.onclose({ code: 1011, reason: 'quota' })"); pg.wait_for_timeout(1200)
        check(not pg.is_visible("#live-sh") and "se cerró" not in pg.evaluate("LASTJ()") and pg.evaluate("window.__escuchoNormal || 0") >= 1, "si la conversación en vivo se cae al empezar: sigue la escucha normal, sin error")
        check(pg.evaluate("Date.now() - JD.load().ajustes.vivoFallaT < 60000") and pg.evaluate("JX.vivoPrincipal()") is False, "y por 10 minutos el orbe usa la escucha normal")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.37.1)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
