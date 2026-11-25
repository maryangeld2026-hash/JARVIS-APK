"""Prueba de punta a punta de la 3.37: un Jarvis más humano y más inteligente (personalidad natural, voz natural por defecto,
respuestas con variedad, la plata dicha como plata, memoria que pregunta, pensar a fondo lo difícil y la conversación en vivo
con audio proactivo y diálogo afectivo, con su plan B)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e335 as T
from playwright.sync_api import sync_playwright

WS = """
window.__ws = [];
window.WebSocket = class { constructor(u) { this.u = u; this.sent = []; this.readyState = 0; window.__ws.push(this); setTimeout(() => { this.readyState = 1; this.onopen && this.onopen(); }, 20); }
  send(d) { this.sent.push(JSON.parse(d)); } close() {} };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        errs = []
        def nuevo(aj, extra="{}"):
            ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, locale="es-CO")
            ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(T.NATIVE); ctx.add_init_script(WS); ctx.add_init_script("window.__vozPorDefecto = true"); ctx.route("https://generativelanguage.googleapis.com/**", T.gem)
            pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(base); pg.wait_for_timeout(300)
            pg.evaluate(f"localStorage.setItem('jarvis.android.v1', JSON.stringify(Object.assign({{ ajustes: {json.dumps(aj)} }}, {extra})))")
            pg.reload(); pg.wait_for_timeout(3800); return pg
        A0 = {"proveedor": "gemini", "claves": {"gemini": "AIzaX"}, "seguir": False, "voz": True, "v316": 1, "vozJarvis316": 1, "bienvenida": True, "buscarAuto": False, "estilo": {"estilo": "jarvis"}}
        # 1) al actualizar: personalidad natural y voz natural de Gemini (si nunca escogiste otra)
        pg = nuevo(A0)
        a = pg.evaluate("JD.load().ajustes")
        check(a["estilo"]["estilo"] == "natural" and a.get("v337") == 1, "al actualizar, la personalidad pasa a «natural»")
        check(a.get("vozIA") == "gemini" and a.get("vozIAnombre") == "Charon", "con clave de Gemini, la voz natural queda puesta (Charon, la de siempre de Jarvis)")
        sp = pg.evaluate("window.__jarvis.systemPrompt()")
        check("persona real de Colombia" in sp and "Trátala de tú" in sp and "cansada, triste" in sp and "J.A.R.V.I.S." not in sp and "«señor»" not in sp, "las instrucciones: natural, de tú, lee el ánimo, sin mayordomo ni «señor»")
        check(pg.evaluate("window.__jarvis.trato()") == "", "sin «señor»: por su nombre o sin nada")
        pg2 = nuevo(dict(A0, vozIA=""))
        check(pg2.evaluate("JD.load().ajustes.vozIA") == "", "quien escogió la voz del celular, la conserva")
        pg2.context.close()
        # 2) respuestas fijas con variedad (en las demás pruebas se apaga para que no cambien)
        pg.evaluate("window.__sinVariar = false; JD.load().ajustes.vozIA = ''")
        say = lambda t, w=900: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        prim = set()
        for _ in range(10):
            say("quita la rutina de sueño", 250); prim.add(pg.evaluate("LASTJ()").split(" ")[0].strip(",.:!"))
        check(len(prim) >= 2 and prim <= {"Listo", "Hecho", "Ya", "Perfecto", "Dale"}, "no siempre dice «Listo»: " + str(sorted(prim)))
        # 3) la plata se dice como plata y los emojis no se leen
        pg.evaluate("window.__said = []")
        say("divide 180 mil entre 4 con el 10% de propina", 900)
        dicho = " ".join(pg.evaluate("window.__said"))
        check("pesos" in dicho and "$" not in dicho and "🧾" not in dicho and "igual a" not in dicho, "dice «198.000 pesos» (antes lo leía como fórmula) · " + dicho[:90])
        # 4) memoria que pregunta
        say("mañana tengo una entrevista de trabajo", 1500)
        sg = pg.evaluate("JD.load().seguimientos || []")
        check(len(sg) == 1 and sg[0]["tema"] == "la entrevista de trabajo", "anota la entrevista de mañana " + str(sg))
        pg.evaluate("const d = JD.load(); d.seguimientos[0].dia -= 2 * 864e5; d.ajustes.segUlt = ''; JX._a337.preguntar()"); pg.wait_for_timeout(300)
        q = pg.evaluate("LASTJ()")
        check("entrevista de trabajo" in q and "?" in q, "al día siguiente: «¿cómo te fue en la entrevista de trabajo?» · " + q[:60])
        check(pg.evaluate("JD.load().chat.slice(-1)[0].cls") == "", "la pregunta queda en la conversación (tu respuesta le llega a la IA con contexto)")
        n = pg.evaluate("document.querySelectorAll('.msg.jarvis').length"); pg.evaluate("JX._a337.preguntar()"); pg.wait_for_timeout(200)
        check(pg.evaluate("document.querySelectorAll('.msg.jarvis').length") == n, "no pregunta dos veces el mismo día")
        # 5) lo difícil se piensa a fondo (con la conversación de antes y sin el ajuste de «no pensar»)
        T.BODIES.clear()
        say("¿qué me conviene más, un crédito a 24 meses al 1,8 % mensual o ahorrar un año y pagar de contado con 10 % de descuento?", 2500)
        body = next((x for x in T.BODIES if "Razonamiento" in x), "")
        check(body and "entrevista de trabajo" in body and "thinkingLevel" not in body and "thinkingBudget" not in body, "pregunta difícil: piensa a fondo, con lo que se habló antes")
        T.BODIES.clear(); say("¿qué hora es en Tokio?", 1500)
        check(not any("Razonamiento" in x for x in T.BODIES), "lo fácil sigue rápido")
        say("vuelve a ser el mayordomo", 600)
        check(pg.evaluate("JD.load().ajustes.estilo.estilo") == "jarvis" and "señor" in pg.evaluate("LASTJ()"), "«vuelve a ser el mayordomo» lo devuelve")
        say("háblame más natural", 600)
        check(pg.evaluate("JD.load().ajustes.estilo.estilo") == "natural", "«háblame más natural»")
        # 6) en vivo al tocar el orbe, con audio proactivo y diálogo afectivo, y su plan B
        pg.evaluate("window.__sinVivo = false; Object.assign(JD.load().ajustes, { liveModelo: 'gemini-3.8-flash-live', liveAsinc: false })")
        check(pg.evaluate("JX.vivoPrincipal()") is True, "con internet y clave: el orbe abre la conversación en vivo")
        pg.evaluate("JD.load().ajustes.docente = true"); check(pg.evaluate("JX.vivoPrincipal()") is False, "en modo docente no (el audio de la clase no sale sin preguntar)")
        pg.evaluate("JD.load().ajustes.docente = false")
        pg.click("#btn-mic"); pg.wait_for_timeout(2500)
        ws = pg.evaluate("window.__ws.map(w => (w.sent[0] || {}).setup || null)")
        s0 = ws[0] if ws else None
        check(s0 and s0.get("proactivity") == {"proactiveAudio": True} and s0.get("enableAffectiveDialog") is True, "en vivo: pide audio proactivo y diálogo afectivo")
        pg.evaluate("const w = window.__ws[0]; w.onclose && w.onclose({ code: 1007, reason: 'Unknown name \"proactivity\"' })"); pg.wait_for_timeout(2500)
        ws = pg.evaluate("window.__ws.map(w => (w.sent[0] || {}).setup || null)")
        check(len(ws) >= 2 and ws[1] and "proactivity" not in ws[1] and pg.evaluate("JD.load().ajustes.liveSinExtras") == "gemini-3.8-flash-live", "si el modelo no lo acepta, vuelve a conectar sin eso (y lo recuerda)")
        pg.evaluate("JX._live.stop('')")
        # 7) Ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        check(pg.evaluate("document.querySelector('#aj-337 details.aj-grupo').dataset.tema") == "voz" and pg.locator("#aj-337 input[type=checkbox]").count() == 4, "Ajustes › Voz › «Más humano y más listo» (4 opciones)")
        check(pg.evaluate("[...document.querySelectorAll('#ajustes select option')].some(o => o.value === 'natural')"), "la personalidad natural también se escoge en Ajustes")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.37)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
