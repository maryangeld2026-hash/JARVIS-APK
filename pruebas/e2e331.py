"""Prueba de punta a punta de la 3.31: imágenes, YouTube, notas de voz, pico y placa y festivos, alertas de lluvia, mapas mentales,
resumen en audio, tutor con la cámara, Health Connect, modo concentración, paquetes y vencimientos."""
import os, sys, json, base64, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nativo331.js")).read()
PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
PEDIDOS = []
MAPA = {"tema": "Fotosíntesis", "ramas": [{"t": "Qué es", "hijos": [{"t": "Plantas hacen alimento"}]}, {"t": "Fases", "hijos": [{"t": "Luminosa"}, {"t": "Oscura"}]}, {"t": "Ingredientes", "hijos": [{"t": "Luz, agua, CO2"}]}]}
GUION = {"titulo": "Los volcanes", "lineas": [{"quien": "Ana", "t": "Hoy hablamos de volcanes."}, {"quien": "Luis", "t": "¿Por qué hacen erupción?"}, {"quien": "Ana", "t": "Por el magma que sube."}]}

def texto_para(body):
    if "mapa mental" in body: return json.dumps(MAPA)
    if "guion de un resumen en audio" in body: return json.dumps(GUION)
    if "tutor paciente" in body: return "Mira: el ejercicio pide sumar fracciones. Primera pista: ¿cuál es el denominador común de 2 y 3?" if body.count('"user"') <= 1 else "¡Muy bien, es 6! Ahora convierte cada fracción."
    return "Listo, señor."

def gem(route):
    u = route.request.url; body = route.request.post_data or ""
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/" + m, "supportedGenerationMethods": ["generateContent"]} for m in ["gemini-3.5-flash", "gemini-3.1-flash-image", "gemini-3.8-flash-tts"]]})
    PEDIDOS.append(body[:600])
    if ":generateContent" in u and "streamGenerateContent" not in u:
        if '"IMAGE"' in body: return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Un volcán feliz"}, {"inlineData": {"mimeType": "image/png", "data": PNG}}]}}]})
        if "multiSpeakerVoiceConfig" in body: return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": base64.b64encode(b"\x00\x01" * 2400).decode()}}]}}]})
        if "file_uri" in body: return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Resumen del video: trata de cómo hacer arepas.\n- 01:20 la masa"}]}}]})
        if "audio/ogg" in body: return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Hola, ¿cómo vas? Te llamo más tarde."}]}}]})
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": texto_para(body)}]}}]})
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(texto_para(body)))

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    png = os.path.join(tempfile.mkdtemp(), "ejercicio.png"); open(png, "wb").write(base64.b64decode(PNG))
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false } }))""")
        pg.reload(); pg.wait_for_timeout(3200)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        # Ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-331 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["rutinas", "rutinas", "voz"], "Ajustes 3.31: salud y pico y placa en Rutinas, notas de voz en Voz " + str(temas))
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 1) imágenes
        say("haz una imagen de un volcán en erupción para niños", 2000)
        check(pg.locator(".gen-img").count() == 1 and any('"IMAGE"' in x and "gemini-3.1-flash-image" not in x for x in PEDIDOS), "crea la imagen con Nano Banana y la muestra")
        say("ponla en estilo caricatura", 2000)
        check(pg.locator(".gen-img").count() == 2 and any('"IMAGE"' in x and "inline_data" in x for x in PEDIDOS), "la edita (manda la imagen anterior)")
        # 2) YouTube
        say("https://youtu.be/dQw4w9WgXcQ", 2000)
        check("Resumen del video" in last() and any("file_uri" in x and "dQw4w9WgXcQ" in x for x in PEDIDOS), "resume el video de YouTube")
        # 3) nota de voz compartida
        pg.evaluate("JX._a331.audio(btoa('OggS fake'), 'audio/ogg', 'PTT-1.opus')"); pg.wait_for_timeout(1500)
        check("Te llamo más tarde" in last(), "transcribe la nota de voz con Gemini")
        pg.evaluate("JD.load().ajustes.notasVoz = 'celular'"); clear()
        pg.evaluate("JX._a331.audio(btoa('OggS fake'), 'audio/ogg', 'PTT-1.opus')"); pg.wait_for_timeout(1200)
        check(any(x.startswith("whisper ") for x in logs()) and "reunión" in last(), "o con Whisper dentro del celular")
        # 4) pico y placa y festivos
        say("¿tengo pico y placa mañana?", 900)
        check("placa" in last() and "ciudad" in last(), "sin placa ni ciudad: las pide")
        say("mi placa termina en 3 y vivo en Bogotá", 900)
        esperado = pg.evaluate("(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12); return JL20.picoPlaca('bogota', 3, d).aplica; })()")
        say("¿tengo pico y placa mañana?", 900)
        check(("Sí, mañana tienes pico y placa" in last()) == esperado and "Bogotá" in last(), "«¿tengo pico y placa mañana?» con la regla de Bogotá · " + last()[:70])
        clear(); say("avísame el pico y placa", 1200)
        check(any(x.startswith("noti 792") for x in logs()) or "0 días" in last(), "avisos la noche anterior")
        say("¿cuál es el próximo festivo?", 900)
        check("próximo festivo" in last(), "próximo festivo · " + last()[:80])
        # 5) lluvia
        clear(); say("avísame si va a llover fuerte", 1500)
        check(any(x.startswith("clima true 4.65") for x in logs()) and "Lluvia fuerte" in last(), "alertas de lluvia fuerte (Android revisa cada 2 horas)")
        # 6) mapa mental
        say("hazme un mapa mental de la fotosíntesis", 2000)
        check(pg.locator(".mapa-mental svg").count() == 1 and "Luminosa" in pg.inner_text(".mapa-mental"), "dibuja el mapa mental")
        # 7) resumen en audio
        say("haz un resumen en audio de los volcanes", 2500)
        check(pg.locator(".msg.jarvis audio").count() == 1 and any("multiSpeakerVoiceConfig" in x for x in PEDIDOS), "resumen en audio a dos voces (Gemini TTS)")
        # 8) tutor
        with pg.expect_file_chooser() as fc:
            pg.fill("#in-texto", "ayúdame con este ejercicio paso a paso"); pg.press("#in-texto", "Enter")
        fc.value.set_files(png); pg.wait_for_timeout(2000)
        check("Primera pista" in last(), "tutor: da solo la primera pista · " + last()[:80])
        say("es 6", 1800)
        check("Muy bien" in last(), "tutor: sigue la conversación con la foto")
        say("ya entendí", 800)
        check("Muy bien!" in last() or "otro ejercicio" in last(), "tutor: termina")
        # 9) salud
        say("¿cómo dormí esta semana?", 1200)
        check("por noche" in last() and "Health Connect" in last(), "¿cómo dormí esta semana? · " + last()[:60])
        say("¿cuántos pasos llevo hoy?", 1000)
        check("4.321 pasos" in last(), "pasos de hoy")
        # 10) concentración
        clear(); say("necesito concentrarme 50 minutos", 1200)
        check("silencio favoritos 50" in logs() and any(x.startswith("noti 793001") for x in logs()), "modo concentración: silencio y aviso al terminar")
        clear(); say("termina la concentración", 900)
        check("fin silencio" in logs() and "concentración" in last(), "terminar la concentración")
        # 11) paquetes
        clear(); say("rastrea el paquete 2045678912 de Servientrega", 1200)
        check("url https://www.servientrega.com/wps/portal/rastreo-envio" in logs() and "2045678912" in last(), "rastrear: abre Servientrega con la guía copiada")
        # 12) vencimientos
        clear(); say("mi SOAT vence el 15 de marzo", 1200)
        check(pg.evaluate("(JD.load().vencimientos || []).length") == 1 and any("Vencimiento" in x for x in logs()), "vencimiento del SOAT con avisos · " + last()[:90] + " " + str(logs()[:3]) + " " + str(pg.evaluate("(JD.load().vencimientos || []).length")))
        say("¿qué se me vence?", 900)
        check("SOAT" in last(), "¿qué se me vence?")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.31)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
