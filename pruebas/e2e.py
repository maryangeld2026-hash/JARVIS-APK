"""Prueba de punta a punta de Jarvis para Android en un celular simulado (Chrome, 412×915), con la IA simulada.

    python3 pruebas/e2e.py [carpeta_capturas]

La voz se simula (reconocimiento y síntesis del navegador) y las peticiones a Gemini se responden aquí, en streaming,
igual que lo hace Google. Falla (código 1) si algo no sale como debe.
"""
import json
import os
import sys
import threading
import functools
import http.server

from playwright.sync_api import sync_playwright

WWW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "capturas")
os.makedirs(OUT, exist_ok=True)

QUIZ = {"titulo": "Fracciones equivalentes", "instrucciones": "Marca la respuesta correcta.", "preguntas": [
    {"enunciado": "¿Qué fracción es equivalente a $\\frac{1}{2}$?", "opciones": ["$\\frac{2}{4}$", "$\\frac{2}{3}$", "$\\frac{1}{3}$", "$\\frac{3}{4}$"], "correcta": 0,
     "explicacion": "Multiplicamos numerador y denominador por 2."},
    {"enunciado": "Simplifica $\\frac{6}{8}$", "opciones": ["$\\frac{3}{4}$", "$\\frac{2}{3}$", "$\\frac{6}{4}$", "$\\frac{1}{2}$"], "correcta": 0, "explicacion": "Dividimos entre 2."},
    {"enunciado": "¿Cuál NO es equivalente a $\\frac{2}{3}$?", "opciones": ["$\\frac{4}{6}$", "$\\frac{6}{9}$", "$\\frac{3}{4}$", "$\\frac{8}{12}$"], "correcta": 2, "explicacion": "3/4 es mayor."}]}
GRADE = {"legible": True, "nota": 3.8, "resumen": "Planteó bien la ecuación $2x+3=11$, pero al despejar restó mal.",
         "aciertos": ["Escribió los datos", "Ordenó el procedimiento"], "errores": ["Restó 3 en un solo lado"], "sugerencia": "Practicar la transposición de términos."}
STEPS = {"titulo": "Resolver $2x+3=11$", "pasos": [{"titulo": "Restar 3", "explicacion": "$2x=8$"}, {"titulo": "Dividir entre 2", "explicacion": "$x=4$"},
                                                   {"titulo": "Comprobación", "explicacion": "$2(4)+3=11$"}]}
TICKET = {"titulo": "Ticket: fracciones", "preguntas": ["¿Qué es una fracción equivalente?", "Simplifica $\\frac{4}{8}$", "Explica con tus palabras cómo comparar fracciones."]}
CARDS = {"titulo": "Potencias", "tarjetas": [{"frente": "$2^3$", "reverso": "8"}, {"frente": "$5^0$", "reverso": "1"}]}
ANSWER = ("Claro, profe. Para explicar los números negativos, empieza con algo cotidiano, como la temperatura o un ascensor que baja al sótano. "
          "Luego usa la recta numérica: $-3 < 0 < 3$. Así ven que el signo indica la dirección.")

FAKE_VOICE = """
(() => {
  window.LASTJ = () => { const a = document.querySelectorAll('.msg.jarvis'); return a.length ? a[a.length - 1].textContent : ''; };
  window.__said = [];
  window.__heard = [];
  class FakeRec {
    constructor() { this.lang = ""; }
    start() { const t = window.__heard.shift() || ""; setTimeout(() => {
      if (!t) { this.onend && this.onend(); return; }
      const res = [{ 0: { transcript: t }, isFinal: true, length: 1 }]; res.length = 1;
      this.onresult && this.onresult({ resultIndex: 0, results: res }); this.onend && this.onend(); }, 250); }
    stop() {}
  }
  window.webkitSpeechRecognition = FakeRec; window.SpeechRecognition = FakeRec;
  const synth = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return []; }, onvoiceschanged: null };
  Object.defineProperty(window, "speechSynthesis", { value: synth });
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
})();
"""


def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=WWW)
    h.log_message = lambda *a: None
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def sse(text, size=24):
    chunks = [text[i:i + size] for i in range(0, len(text), size)]
    return "".join("data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": c}]}}]}) + "\r\n\r\n" for c in chunks)


BODIES = []


def gemini(route):
    req = route.request
    url = req.url
    if "/models?" in url:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-3.5-pro", "supportedGenerationMethods": ["generateContent"]}]})
    body = json.loads(req.post_data or "{}")
    BODIES.append(body)
    asked = json.dumps(body, ensure_ascii=False)
    if ":generateContent" in url:
        out = (GRADE if "inline_data" in asked else CARDS if "tarjetas de estudio" in asked.lower() else STEPS if "paso a paso" in asked.lower() else TICKET if "ticket de salida" in asked.lower()
               else QUIZ if "quiz" in asked.lower() else {"ok": True})
        if "MODO TUTOR" in asked:
            out = "¿Qué crees que pasa si multiplicas arriba y abajo por 2?"
        if "Di: listo" in asked:
            out = "listo"
        text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False)
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": text}]}}]})
    if body.get("tools"):
        ev = "data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": "Según el ICFES, los resultados de 2026 mejoraron en matemáticas."}]},
                                                    "groundingMetadata": {"groundingChunks": [{"web": {"uri": "https://www.icfes.gov.co/resultados", "title": "icfes.gov.co"}}]}}]}) + "\r\n\r\n"
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=ev)
    lastmsg = json.dumps((body.get("contents") or [{}])[-1], ensure_ascii=False)
    if "PRUEBA503" in lastmsg and "flash-lite" in url:              # 3.1: el modelo saturado → reintenta con otro
        return route.fulfill(status=503, json={"error": {"code": 503, "message": "The model is overloaded.", "status": "UNAVAILABLE"}})
    if "PRUEBA503" in lastmsg:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse("Respondí con el otro modelo."))
    tutor = "MODO TUTOR" in asked
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse("¿Qué crees que pasa si multiplicas arriba y abajo por 2?" if tutor else ANSWER))


def LASTJ_PY(pg):
    return pg.evaluate("LASTJ()")


def main():
    srv = serve()
    base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []

    def check(cond, what):
        print(("✓ " if cond else "✗ ") + what)
        if not cond:
            fails.append(what)

    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 412, "height": 915}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="es-CO",
                            permissions=["clipboard-read", "clipboard-write"])
        ctx.add_init_script(FAKE_VOICE)
        ctx.route("https://generativelanguage.googleapis.com/**", gemini)
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base)
        pg.wait_for_selector(".empty")
        pg.screenshot(path=f"{OUT}/1-inicio.png")

        # sin clave: las herramientas igual funcionan
        pg.evaluate("window.__heard.push('pon un temporizador de 3 minutos')")
        pg.click("#btn-mic")
        pg.wait_for_function("document.querySelectorAll('.msg').length >= 2")
        check("3 minutos" in pg.inner_text(".msg.jarvis >> nth=-1"), "temporizador por voz (sin clave de IA)")
        # 2.2: la conversación sigue sola (sin volver a tocar el micrófono) y el HUD
        pg.evaluate("window.__heard.push('escoge un estudiante'); window.__heard.push('qué hora es')")
        pg.click("#btn-mic")
        pg.wait_for_function("LASTJ().includes('Son las')", timeout=15000)
        check(True, "la conversación sigue: respondió la 2ª orden sin tocar el micrófono")
        check(pg.locator("#btn-mic .rx").count() == 1 and pg.locator("#leds i").count() == 4, "HUD: reactor y luces de estado")
        check(pg.locator("#hoy .hoy-chips .chip").count() >= 2, "HUD: panel Hoy con sugerencias")
        pg.screenshot(path=f"{OUT}/0-hud.png")
        check(pg.evaluate("window.__said.some(s => s.includes('3 minutos'))"), "lo dice en voz alta")

        # ajustes: clave de Gemini y prueba
        pg.click("#btn-ajustes")
        pg.fill("#a-clave", "AIzaPRUEBA")
        pg.click("#btn-probar")
        pg.wait_for_function("document.querySelector('#probar-res').textContent.startsWith('Funciona')")
        check("gemini-3.5-flash-lite" in pg.inner_text("#probar-res"), "escoge el modelo rápido de la cuenta y la prueba funciona")
        pg.fill("#a-nombre", "Profe Mary")
        pg.dispatch_event("#a-nombre", "change")
        pg.screenshot(path=f"{OUT}/2-ajustes.png")
        pg.click("#btn-ajustes-cerrar")

        # conversación con la IA en streaming, hablada por frases
        pg.evaluate("window.__said = []; window.__heard.push('¿cómo explico los números negativos?')")
        pg.click("#btn-mic")
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type .katex') !== null && !document.querySelector('.msg.typing')")
        check("recta numérica" in pg.inner_text(".msg.jarvis >> nth=-1"), "respuesta de la IA en la conversación, con fórmula dibujada")
        pg.wait_for_timeout(500)
        said = pg.evaluate("window.__said")
        print(said)
        check(len(said) >= 2 and said[0].startswith("Claro, profe"), f"empieza a hablar con la primera frase ({len(said)} frases dichas)")
        check(any("menor que" in s for s in said), "la fórmula se dice en palabras")
        check(any((b.get("generationConfig") or {}).get("thinkingConfig") == {"thinkingLevel": "minimal"} for b in BODIES), "pide la respuesta sin «pensar» (más rápida)")
        check("⚡" in pg.inner_text(".msg.jarvis >> nth=-1"), "muestra cuánto tardó en empezar a responder")
        pg.screenshot(path=f"{OUT}/3-conversacion.png")
        # 3.1: si el modelo está saturado, Jarvis reintenta solo con otro modelo rápido
        pg.fill("#in-texto", "PRUEBA503 ¿cómo explico la división?")
        pg.press("#in-texto", "Enter")
        pg.wait_for_function("LASTJ().includes('otro modelo')", timeout=15000)
        check("otro modelo" in LASTJ_PY(pg), "modelo saturado (503): reintenta solo con otro modelo")

        # clase: curso, azar, grupos
        pg.click(".tabs button[data-tab=clase]")
        pg.click("#cursos >> text=+ Curso")
        pg.fill("#c-nombre", "7A")
        pg.fill("#c-lista", "1. Ana Rojas\n2. Beto Díaz\n3. Caro Gil\n4. Dani Ruiz\n5. Eva Mora\n6. Fabio Paz\n7. Gina Sol\n8. Hugo Rey\n9. Iris Mar\n10. Juan Luz")
        check("10 estudiantes" in pg.inner_text("#c-cuenta"), "cuenta los estudiantes pegados")
        pg.click("#btn-c-guardar")
        pg.click("#btn-azar")
        pg.wait_for_function("document.querySelector('#azar-nombre').classList.contains('win')")
        check(pg.inner_text("#azar-nombre") in ["Ana Rojas", "Beto Díaz", "Caro Gil", "Dani Ruiz", "Eva Mora", "Fabio Paz", "Gina Sol", "Hugo Rey", "Iris Mar", "Juan Luz"], "escoge un estudiante del curso")
        pg.click("#btn-grupos")
        check(pg.locator(".grupo").count() == 4, "hace 4 grupos")
        pg.screenshot(path=f"{OUT}/4-clase.png", full_page=False)
        pg.click(".presets .chip[data-min='5']")
        pg.wait_for_timeout(600)
        check(pg.inner_text("#reloj") in ("5:00", "4:59"), "temporizador de 5 minutos andando")
        pg.locator("#k-tiempo").scroll_into_view_if_needed()
        pg.screenshot(path=f"{OUT}/5-temporizador.png")
        pg.click("#btn-tiempo-parar")

        # por voz: azar y grupos del curso
        pg.click(".tabs button[data-tab=hablar]")
        pg.evaluate("window.__heard.push('Jarvis haz grupos de 3 en 7A')")
        pg.click("#btn-mic")
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type') && LASTJ().includes('grupos de 7A')")
        check(True, "grupos por voz")

        # calificar una foto
        pg.click(".tabs button[data-tab=clase]")
        pg.fill("#foto-consigna", "Resolver 2x + 3 = 11")
        from PIL import Image
        img = os.path.join(OUT, "_trabajo.jpg")
        Image.new("RGB", (800, 600), (240, 240, 230)).save(img)
        pg.set_input_files("#foto-in", img)
        pg.wait_for_selector(".nota b", timeout=15000)
        check(pg.inner_text(".nota b") == "3,8" and "básico" in pg.inner_text(".nota span").lower(), "califica la foto: 3,8 básico")
        pg.locator("#k-foto").scroll_into_view_if_needed()
        pg.screenshot(path=f"{OUT}/6-foto.png")
        req_ok = pg.evaluate("JSON.stringify(window.__jarvis.D.fotos[0])")
        check("3.8" in req_ok, "queda en el registro de notas de fotos")

        # recordatorio
        pg.fill("#in-recordar", "llamar a la coordinadora en 20 minutos")
        pg.click("#f-recordar button[type=submit]")
        check("Llamar a la coordinadora" in pg.inner_text("#recordatorios"), "recordatorio guardado")

        # quiz por voz
        pg.click(".tabs button[data-tab=hablar]")
        pg.wait_for_timeout(1000)                                   # que termine la escucha continua de la orden anterior
        pg.evaluate("window.__heard.push('hazme un quiz de fracciones equivalentes de 3 preguntas para grado 6')")
        pg.click("#btn-mic")
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type') && LASTJ().includes('Fracciones equivalentes')", timeout=15000)
        pg.click(".tabs button[data-tab=quices]")
        check(pg.locator(".quiz ol.q > li").count() == 3, "el quiz aparece con 3 preguntas")
        check(pg.locator(".quiz .katex").count() >= 6, "fórmulas del quiz dibujadas")
        pg.click("text=Ver respuestas")
        pg.screenshot(path=f"{OUT}/7-quiz.png")
        with pg.expect_download() as dl:
            pg.click(".quiz-acts >> text=PDF")
        path = dl.value.path()
        data = open(path, "rb").read()
        check(data[:4] == b"%PDF" and len(data) > 3000, f"PDF del quiz ({len(data)} bytes)")
        dl.value.save_as(os.path.join(OUT, "quiz.pdf"))

        # ================= 2.0: memoria, seguimiento con Excel, riesgo, notas, tutor, pasos, ticket, proyector, Word
        pg.click(".tabs button[data-tab=hablar]")
        pg.fill("#in-texto", "Recuerda que los lunes tengo reunión de área"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("LASTJ().includes('lo recordaré')")
        check(pg.evaluate("window.__jarvis.D.memoria.length") == 1, "memoria: guarda lo que le cuentas")
        pg.fill("#in-texto", "De ahora en adelante los quices con 5 preguntas"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)
        check(pg.evaluate("window.__jarvis.D.lecciones.length") == 1, "lección guardada")

        import openpyxl
        wb = openpyxl.Workbook(); ws = wb.active; ws.title = "8B"
        ws.append(["Planilla de notas 8B"]); ws.append(["N°", "Apellidos", "Nombres", "Taller 1", "Quiz 1", "Definitiva"])
        for i, (ap, no, t, q) in enumerate([("Pérez", "Laura", 4.5, 4.8), ("Mora", "Pablo", 2.5, 2.2), ("Ríos", "Sara", 3.6, 3.9), ("Vega", "Tomás", 2.0, 2.9)], 1):
            ws.append([i, ap, no, t, q, None])
        xlsx = os.path.join(OUT, "_planilla.xlsx"); wb.save(xlsx)
        pg.click(".tabs button[data-tab=clase]")
        pg.set_input_files("#seg-in", xlsx)
        pg.wait_for_function("window.__jarvis.D.cursos.some(c => c.nombre === '8B')")
        check(pg.locator("#seg-res .lista li").count() == 2, "importa el Excel y marca 2 en riesgo")
        pg.locator("#k-seg").scroll_into_view_if_needed()
        pg.screenshot(path=f"{OUT}/8-seguimiento.png")
        pg.click("#btn-seg-ver")
        pg.wait_for_selector("table.grid")
        check(pg.locator("table.grid tr").count() == 5, "planilla de notas editable (4 estudiantes)")
        pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}/9-planilla.png")
        pg.click("#ne-x")
        pg.click(".tabs button[data-tab=hablar]")
        pg.fill("#in-texto", "¿quiénes están en riesgo en 8B?"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("LASTJ().includes('En riesgo')")
        txt = pg.inner_text(".msg.jarvis >> nth=-1")
        check("Mora Pablo" in txt and "Vega Tomás" in txt, "responde quién está en riesgo (sin la IA)")
        pg.fill("#in-texto", "ponle 4,5 a Pablo Mora en el quiz 1"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)
        check("Anotado" in pg.inner_text(".msg.jarvis >> nth=-1"), "pone una nota por voz")
        pg.fill("#in-texto", "cómo va Pablo Mora"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)
        check("3,5" in pg.inner_text(".msg.jarvis >> nth=-1"), "promedio del estudiante actualizado (3,5)")

        pg.fill("#in-texto", "modo tutor de fracciones"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)
        pg.fill("#in-texto", "no entiendo las fracciones equivalentes"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("LASTJ().includes('multiplicas')")
        check(pg.is_visible("#tutor-pill"), "modo tutor activo (responde con una pregunta)")
        pg.fill("#in-texto", "sal del modo tutor"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)

        pg.fill("#in-texto", "explícame paso a paso cómo resolver 2x + 3 = 11"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("LASTJ().includes('Dividir entre 2')", timeout=15000)
        pg.click("text=Mostrar paso a paso en el proyector")
        pg.click("#proy-nav >> text=Siguiente paso")
        check(pg.locator(".p-step").count() == 2, "paso a paso en el proyector")
        pg.screenshot(path=f"{OUT}/10-proyector-pasos.png")
        pg.click("#proy-x")

        pg.fill("#in-texto", "ticket de salida de fracciones"); pg.press("#in-texto", "Enter")
        pg.wait_for_selector(".p-sem", timeout=15000)
        pg.click(".sem.verde"); pg.click(".sem.verde"); pg.click(".sem.rojo")
        check(pg.inner_text(".sem.verde b") == "2", "ticket de salida con semáforo")
        pg.set_viewport_size({"width": 915, "height": 412})
        pg.screenshot(path=f"{OUT}/11-proyector-ticket.png")
        pg.click(".proy-tabs >> text=Quiz")
        pg.click("#proy-nav >> text=Mostrar respuesta")
        check(pg.locator(".p-ops li.ok").count() == 1, "quiz en el proyector, revela la respuesta")
        pg.screenshot(path=f"{OUT}/12-proyector-quiz.png")
        pg.set_viewport_size({"width": 412, "height": 915})
        pg.click("#proy-x")

        pg.click(".tabs button[data-tab=quices]")
        pg.click("#quices li >> nth=0")
        with pg.expect_download() as dl:
            pg.click(".quiz-acts >> text=Word")
        data = open(dl.value.path(), "rb").read()
        check(data[:2] == b"PK" and len(data) > 4000, f"quiz en Word ({len(data)} bytes)")
        dl.value.save_as(os.path.join(OUT, "quiz.docx"))
        with pg.expect_download() as dl:
            pg.evaluate("document.querySelector('#btn-seg-exp') || null")
            pg.click(".tabs button[data-tab=clase]"); pg.click("#btn-seg-exp")
        data = open(dl.value.path(), "rb").read()
        check(data[:2] == b"PK", "exporta el seguimiento a Excel")
        pg.click("#btn-ajustes")
        check(pg.locator("#aj2 .lista li").count() == 2, "ajustes: memoria y lecciones para borrar")
        pg.click("#btn-ajustes-cerrar")

        # respaldo sin claves
        back = pg.evaluate("JSON.stringify(window.JD.backup())")
        check("AIzaPRUEBA" not in back and '"7A"' in back, "la copia de seguridad no lleva la clave")

        # ================= 3.0: habilidades del computador
        pg.click(".tabs button[data-tab=hablar]")
        def say_(txt, wait):
            pg.fill("#in-texto", txt); pg.press("#in-texto", "Enter")
            pg.wait_for_function(f"LASTJ().includes({json.dumps(wait)})", timeout=15000)
        say_("planéame la clase de fracciones equivalentes", "Plan de clase")
        pg.wait_for_function("window.__jarvis.D.docs && window.__jarvis.D.docs.length >= 1", timeout=15000)
        check(pg.locator(".msg.jarvis >> nth=-1").locator(".doc-acts .chip").count() >= 3, "documento con IA (plan de clase) con Word/PDF/compartir")
        say_("grafica y = x^2 - 4", "Gráfica")
        check(pg.locator("canvas.plot").count() == 1, "gráfica de una función")
        pg.screenshot(path=f"{OUT}/13-grafica.png")
        say_("anota en el observador de Pablo Mora que hoy participó mucho", "Anotado en el observador")
        say_("hoy en 8B vimos potencias", "diario de 8B")
        say_("quedé en mandarle la guía a la coordinadora", "compromiso")
        say_("ya le mandé la guía a la coordinadora", "cumplido")
        say_("¿cuánto necesita Vega Tomás para pasar?", "necesita")
        say_("ficha de Pablo Mora", "Promedio")
        check("participó mucho" in LASTJ_PY(pg), "ficha del estudiante con observador")
        say_("¿quién viene bajando?", "")
        pg.evaluate("window.__jarvis.D.ajustes.horario = 'lunes 0:00-23:59 8B Potencias'")
        say_("¿qué clase tengo ahora?", "Ahora tienes 8B")
        say_("tarjetas de estudio sobre potencias", "tarjetas")
        check(pg.locator(".flash").count() == 1, "tarjetas de estudio (para voltear y exportar a Anki)")
        pg.click("#mazo-ver .sheet-h button")
        say_("investiga los resultados de las pruebas Saber 2026", "Fuentes")
        check("icfes.gov.co" in LASTJ_PY(pg), "investiga en internet con fuentes")
        pg.set_input_files("#chat-foto-in", os.path.join(OUT, "_trabajo.jpg"))
        pg.wait_for_function("document.querySelectorAll('.msg-img').length === 1 && !document.querySelector('.msg.typing')", timeout=15000)
        check(True, "pregunta por una foto desde la conversación")
        pg.click(".tabs button[data-tab=quices]")
        check(pg.locator("#docs-box .lista li").count() >= 1, "Material: documentos guardados")
        pg.click("#quices li >> nth=0")
        with pg.expect_download() as dl:
            pg.click(".quiz-acts >> text=Kahoot")
        data = open(dl.value.path(), "rb").read()
        check(data[:2] == b"PK", "quiz para Kahoot (hoja de cálculo)")
        pg.screenshot(path=f"{OUT}/14-material.png", full_page=True)
        pg.click(".tabs button[data-tab=hablar]")
        pg.fill("#in-texto", "escúchame siempre en segundo plano"); pg.press("#in-texto", "Enter")
        pg.wait_for_timeout(300)
        check("APK" in LASTJ_PY(pg), "«Jarvis» en segundo plano: en el navegador explica que es del APK")
        check(not errs, "sin errores de JavaScript" + (": " + "; ".join(errs) if errs else ""))
        b.close()
    srv.shutdown()
    print("\nTodo bien." if not fails else f"\nFallaron {len(fails)}: " + "; ".join(fails))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
