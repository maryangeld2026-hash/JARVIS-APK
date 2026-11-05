"""Prueba de punta a punta de la 3.7: solucionario verificado, figuras, acudientes, reunión, clase completa, mensajes,
voz natural con IA, sincronizar con el PC, datos cifrados y la conversación en vivo (con un Gemini Live de mentira)."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

TTS = []

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-3.5-flash-tts", "supportedGenerationMethods": ["generateContent"]},
                                              {"name": "models/gemini-live-3.5-flash-native-audio", "supportedGenerationMethods": ["bidiGenerateContent"]}]})
    body = json.loads(r.post_data or "{}"); t = json.dumps(body, ensure_ascii=False)
    ultimo = json.dumps((body.get("contents") or [{}])[-1], ensure_ascii=False)
    if "tts" in u:
        TTS.append(t)
        pcm = base64.b64encode(b"\x00\x00" * 2400).decode()
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"inlineData": {"mimeType": "audio/L16;codec=pcm;rate=24000", "data": pcm}}]}}]})
    if "ACTA" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "### Asistentes\n- Marta\n### Acuerdos\n- Salida el viernes"}]}}]})
    if "2x + 3 = 11" in ultimo and "MAL" in ultimo:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Restamos 3 y dividimos: la solución es x = 5."))
    if "2x + 3 = 11" in ultimo:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Restamos 3 a ambos lados y dividimos entre 2: x = 4."))
    return e2e.gemini(route)

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
window.__oir = [];
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 30)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, writeFile: async (o) => { log('archivo ' + o.path); return { uri: 'file:///x' }; }, share: async (o) => log('compartir'), getSupportedVoices: async () => ({ voices: [] }) };
const P = {
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Oido: { disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), addListener: on, escuchar: async () => { await new Promise(r => setTimeout(r, 60)); const t = window.__oir.shift(); if (t === undefined) await new Promise(r => setTimeout(r, 400)); return { texto: t || '' }; }, detener: async () => {}, cancelar: async () => {}, vigilar: async () => ({ ok: false }), dejarDeVigilar: async () => {} },
  Mensajes: { activo: async () => ({ activo: true }), permiso: async () => {}, recientes: async () => ({ lista: [{ clave: 'k1', app: 'WhatsApp', de: 'Carolina Ruiz', texto: '¿Nos vemos mañana a las 3?', t: Date.now() - 60000, puedeResponder: true }, { clave: 'k2', app: 'Mensajes', de: 'Banco', texto: 'Su código es 1234', t: Date.now() - 30000, puedeResponder: false }] }), responder: async (o) => { log('responder ' + o.clave + ' ' + o.texto); return { ok: true }; } },
  CapacitorHttp: { request: async (o) => { log('http ' + o.method + ' ' + o.url); if (o.method === 'GET') return { status: 200, data: { cursos: { '7A': ['Ana Rojas', 'Beto Díaz', 'Pablo Mora', 'Caro Gil'] }, notas: { '7A': { 'Caro Gil': [{ actividad: 'Taller', nota: 3.8 }] } }, asistencia: {}, observador: {} } }; return { status: 200, data: { mezclado: { cursos: 0, estudiantes: 0, notas: 2, fallas: 0, observador: 0 } } }; } },
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Telefono' ? undefined : generic) }) };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO", permissions=["microphone"])
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        live = {"setup": None, "audio": 0, "tool": None}
        def ws_handler(ws):
            def on_msg(m):
                j = json.loads(m)
                if "setup" in j:
                    live["setup"] = j["setup"]; ws.send(json.dumps({"setupComplete": {}}))
                elif "realtimeInput" in j and "video" in j["realtimeInput"]:
                    live["video"] = live.get("video", 0) + 1
                elif "realtimeInput" in j:
                    live["audio"] += 1
                    if live["audio"] == 3:
                        ws.send(json.dumps({"serverContent": {"inputTranscription": {"text": "pon cinco minutos"}}}))
                        ws.send(json.dumps({"toolCall": {"functionCalls": [{"id": "f1", "name": "jarvis_orden", "args": {"orden": "pon 5 minutos"}}]}}))
                elif "toolResponse" in j:
                    live["tool"] = j["toolResponse"]
                    pcm = base64.b64encode(b"\x00\x10" * 4800).decode()
                    ws.send(json.dumps({"serverContent": {"outputTranscription": {"text": "Listo, puse cinco minutos."}, "modelTurn": {"parts": [{"inlineData": {"mimeType": "audio/pcm;rate=24000", "data": pcm}}]}}}))
                    ws.send(json.dumps({"serverContent": {"turnComplete": True}}))
            ws.on_message(on_msg)
        ctx.route_web_socket("wss://generativelanguage.googleapis.com/**", ws_handler)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # datos de antes, sin cifrar: la 3.7 los cifra al abrir
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, nombre: 'Profe María' },
          cursos: [{ id: 'c1', nombre: '7A', estudiantes: ['Ana Rojas', 'Beto Díaz', 'Pablo Mora'], notas: { actividades: [{ id: 'a1', nombre: 'Quiz 1', peso: 1 }], valores: { 'Pablo Mora': { a1: 2.4 }, 'Ana Rojas': { a1: 4.6 }, 'Beto Díaz': { a1: 3.5 } } } }], cursoActual: 'c1' }))""")
        pg.reload(); pg.wait_for_timeout(1600)
        st = pg.evaluate("({ plano: localStorage.getItem('jarvis.android.v1'), cif: localStorage.getItem('jarvis.android.v1.c'), cursos: JD.load().cursos.length, on: JD.cifrado() })")
        check(st["plano"] is None and st["cif"] and '"ct"' in st["cif"] and "Pablo" not in st["cif"] and st["cursos"] == 1 and st["on"], "datos cifrados: ya no hay nada legible en el celular")
        pg.reload(); pg.wait_for_timeout(1600)
        check(pg.evaluate("JD.load().cursos[0].estudiantes.length") == 3, "al volver a abrir, los datos cifrados se leen bien")
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        # solucionario
        say("resuelve 3x - 5 = x + 7", 2500)
        check("x = 6" in last().replace(" ", " ") or "x=6" in last().replace(" ", "") and "Comprobación" in last(), "resolver con pasos y comprobación: " + last()[:80].replace("\n", " "))
        say("calcula 3/4 + 2/5", 800); check("23" in last() and "20" in last(), "calcular fracciones (23/20)")
        say("deriva x^3 + 2x", 800); check(pg.locator(".msg.jarvis:last-of-type .katex").count() >= 1, "derivada con la fórmula dibujada")
        say("resuelve el sistema x + y = 10, x - y = 2", 800); check("6" in last() and "4" in last(), "sistema de ecuaciones")
        say("verifica que x = 5 es solución de 2x + 3 = 11", 800); check("No" in last(), "verificar una solución equivocada")
        # la IA se equivoca: el motor de álgebra lo nota
        say("MAL explícame cómo resolver 2x + 3 = 11", 2500)
        check(pg.locator(".msg.jarvis:last-of-type .verif.mal").count() == 1, "respuesta equivocada de la IA: aviso «Ojo»")
        say("explícame cómo resolver 2x + 3 = 11", 2500)
        check(pg.locator(".msg.jarvis:last-of-type .verif.ok").count() == 1, "respuesta correcta de la IA: «Verificado»")
        # figuras
        say("dibuja un triángulo rectángulo con catetos 3 y 4", 600)
        check(pg.locator(".msg.jarvis:last-of-type .fig svg").count() == 1 and "5" in last(), "figura exacta: triángulo 3-4-5")
        pg.screenshot(path="/tmp/claude-0/e2e37-figura.png")
        say("dibuja un plano cartesiano con A(2,3), B(-1,4) y C(0,-2) y únelos", 600); check(pg.locator(".msg.jarvis:last-of-type .fig svg polygon").count() == 1, "plano cartesiano con puntos unidos")
        # acudientes
        pg.evaluate("JD.load().acudientes = { '7A': { 'Pablo Mora': '3001234567', 'Ana Rojas': '3109998877' } }")
        say("avísale a los acudientes de los que van en riesgo en 7A", 600)
        check(pg.is_visible("#acudm-sh") and pg.locator("#acudm-sh .acud-card").count() == 1 and "2,4" in pg.input_value("#acudm-sh textarea"), "mensaje al acudiente de Pablo (en riesgo) con su promedio")
        pg.click("#acudm-sh .acud-card .btn"); pg.wait_for_timeout(200)
        check(any(x.startswith("url https://wa.me/573001234567?text=") for x in logs()), "abre WhatsApp del acudiente con el mensaje")
        pg.click("#acudm-sh .icon-btn")
        # reunión
        pg.evaluate("window.__oir.push('buenos días a todos, acordamos la salida pedagógica el viernes', 'Marta se encarga de los permisos')")
        say("modo reunión", 1500)
        check("salida pedagógica" in pg.input_value("#reu-sh textarea"), "reunión: transcribe lo que oye")
        pg.click("#reu-sh >> text=Terminar y hacer el acta"); pg.wait_for_timeout(1500)
        check("Acuerdos" in last() and pg.evaluate("JD.load().docs.some(d => d.tipo === 'acta')"), "acta de la reunión con la IA")
        # mensajes
        say("¿qué me escribieron?", 600)
        check("Carolina Ruiz" in last() and "Banco" in last(), "leer los mensajes que llegaron")
        say("respóndele a Carolina que sí, mañana a las 3", 600)
        pg.click(".msg.jarvis:last-of-type >> text=Sí, enviar"); pg.wait_for_timeout(300)
        check("responder k1 sí, mañana a las 3" in logs(), "responder a Carolina (después de confirmar)")
        # voz natural con IA (y los nombres nunca van a la IA)
        pg.evaluate("JD.load().ajustes.vozIA = 'gemini'; JD.load().ajustes.voz = true")
        n0 = len(TTS)
        pg.evaluate("window.__jarvis.say('Hola profe, así sueno con la voz natural.')"); pg.wait_for_timeout(1200)
        check(len(TTS) > n0 and "AUDIO" in TTS[-1], "voz natural: pide el audio a Gemini")
        n1 = len(TTS)
        pg.evaluate("window.__jarvis.say('Pablo Mora va con 2,4.')"); pg.wait_for_timeout(800)
        check(len(TTS) == n1, "con nombres de estudiantes, habla la voz del celular (no va a la IA)")
        pg.evaluate("JD.load().ajustes.vozIA = ''")
        # sincronizar con el PC
        pg.evaluate("JD.load().ajustes.pc = 'http://192.168.1.20:8766/?k=abc'")
        say("sincroniza con el computador", 800)
        check("Sincronizado" in last() and "Caro Gil" in pg.evaluate("JD.load().cursos[0].estudiantes.join()") and any(x.startswith("http POST") for x in logs()), "sincronizar con el PC en los dos sentidos")
        # clase completa
        say("prepárame la clase de mañana de 7A sobre fracciones", 9000)
        check("Clase de 7A lista" in last(), "clase de mañana: plan + quiz + ticket")
        # conversación en vivo (Gemini Live de mentira)
        check(not pg.is_visible("#proyector"), "preparar la clase no deja el proyector abierto")
        pg.click("#btn-live"); pg.wait_for_timeout(4000)
        check(live["setup"] and "native-audio" in live["setup"]["model"] and live["setup"]["generationConfig"]["responseModalities"] == ["AUDIO"], "en vivo: se conecta al modelo de voz en vivo de la cuenta")
        check(live["audio"] >= 3, f"en vivo: manda tu voz en tiempo real ({live['audio']} paquetes)")
        check(live["tool"] and "5 minutos" in json.dumps(live["tool"], ensure_ascii=False) and pg.evaluate("window.__jarvis.timer.end > 0"), "en vivo: hace la orden de la app (temporizador) y le responde al modelo")
        check("puse cinco minutos" in pg.inner_text("#live-tr"), "en vivo: transcripción de lo que dice Jarvis")
        pg.screenshot(path="/tmp/claude-0/e2e37-vivo.png")
        pg.click("#live-sh >> text=Colgar"); pg.wait_for_timeout(300)
        check(not pg.is_visible("#live-sh") and "puse cinco minutos" in pg.evaluate("JD.load().chat.map(m => m.content).join(' ')"), "colgar: la conversación queda en el chat")
        # 3.9: intérprete en vivo
        live["setup"] = None
        say("modo intérprete con inglés", 4500)
        check(live["setup"] and "intérprete en vivo entre español y inglés" in json.dumps(live["setup"]["systemInstruction"], ensure_ascii=False), "intérprete: conversación en vivo con instrucción de traducir")
        if pg.is_visible("#live-sh"): pg.click("#live-sh >> text=Colgar"); pg.wait_for_timeout(300)
        # 3.10: practicar idiomas
        live["setup"] = None
        say("practiquemos inglés", 4500)
        check(live["setup"] and "profesor de inglés" in json.dumps(live["setup"]["systemInstruction"], ensure_ascii=False), "practicar inglés en vivo")
        if pg.is_visible("#live-sh"): pg.click("#live-sh >> text=Colgar"); pg.wait_for_timeout(300)
        # 3.11: visión en vivo (cámara de prueba de Chromium)
        live["setup"] = None; live["video"] = 0
        say("mira esto", 5500)
        check(live["setup"] and "VES por la cámara" in json.dumps(live["setup"]["systemInstruction"], ensure_ascii=False) and live["video"] >= 2, f"visión en vivo: manda imágenes de la cámara ({live['video']})")
        check(pg.locator("#live-video").count() == 1, "visión en vivo: se ve la cámara")
        if pg.is_visible("#live-sh"): pg.click("#live-sh >> text=Colgar"); pg.wait_for_timeout(300)
        # 3.7.1: ahorro de batería
        say("modo ahorro", 400)
        check(pg.evaluate("document.body.classList.contains('ahorro') && JD.load().ajustes.ahorroActivo"), "modo ahorro: se activa con la voz")
        pg.evaluate("JD.load().ajustes.vozIA = 'gemini'"); n2 = len(TTS)
        pg.evaluate("window.__jarvis.say('Hola profe, ahorrando batería.')"); pg.wait_for_timeout(800)
        check(len(TTS) == n2, "modo ahorro: usa la voz del celular, no la IA")
        pg.evaluate("JD.load().ajustes.vozIA = ''")
        say("qué me está gastando la batería", 400)
        check("batería" in last().lower(), "qué gasta batería: responde")
        pg.click("#btn-ajustes"); pg.wait_for_timeout(250); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-bat select").count() == 2 and "modo ahorro de Jarvis activo" in pg.inner_text("#aj-bat"), "Ajustes › Batería")
        pg.click("#btn-ajustes-cerrar")
        say("diagnóstico de batería", 600)
        check("Diagnóstico de batería" in last() and "Micrófono abierto" in last(), "diagnóstico de batería")
        r = pg.evaluate("window.JX._bat.ritmo([{t: 0, n: 90, c: 0}, {t: 3600e3, n: 86, c: 0}, {t: 7200e3, n: 80, c: 0}, {t: 9000e3, n: 95, c: 1}])")
        check(r and abs(r["porHora"] - 5) < 0.01, "diagnóstico: cuánto baja por hora sin cargar")
        say("quita el modo ahorro", 400)
        check(not pg.evaluate("document.body.classList.contains('ahorro')"), "modo ahorro: se quita")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.7)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
