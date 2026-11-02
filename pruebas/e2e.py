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
ANSWER = ("Claro, profe. Para explicar los números negativos, empieza con algo cotidiano, como la temperatura o un ascensor que baja al sótano. "
          "Luego usa la recta numérica: $-3 < 0 < 3$. Así ven que el signo indica la dirección.")

FAKE_VOICE = """
(() => {
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


def gemini(route):
    req = route.request
    url = req.url
    if "/models?" in url:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-3.5-pro", "supportedGenerationMethods": ["generateContent"]}]})
    body = json.loads(req.post_data or "{}")
    asked = json.dumps(body, ensure_ascii=False)
    if ":generateContent" in url:
        out = GRADE if "inline_data" in asked else QUIZ if "quiz" in asked.lower() else {"ok": True}
        if "Di: listo" in asked:
            out = "listo"
        text = out if isinstance(out, str) else json.dumps(out, ensure_ascii=False)
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": text}]}}]})
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=sse(ANSWER))


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
        pg.screenshot(path=f"{OUT}/3-conversacion.png")

        # clase: curso, azar, grupos
        pg.click(".tabs button[data-tab=clase]")
        pg.click("text=+ Curso")
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
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type') && document.querySelector('.msg.jarvis:last-of-type').textContent.includes('grupos de 7A')")
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
        pg.evaluate("window.__heard.push('hazme un quiz de fracciones equivalentes de 3 preguntas para grado 6')")
        pg.click("#btn-mic")
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type') && document.querySelector('.msg.jarvis:last-of-type').textContent.includes('Fracciones equivalentes')", timeout=15000)
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

        # respaldo sin claves
        back = pg.evaluate("JSON.stringify(window.JD.backup())")
        check("AIzaPRUEBA" not in back and '"7A"' in back, "la copia de seguridad no lleva la clave")
        check(not errs, "sin errores de JavaScript" + (": " + "; ".join(errs) if errs else ""))
        b.close()
    srv.shutdown()
    print("\nTodo bien." if not fails else f"\nFallaron {len(fails)}: " + "; ".join(fails))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
