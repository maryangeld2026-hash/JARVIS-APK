"""Prueba de punta a punta de la 3.24: Nexo Escritorio en las dos direcciones. La pestaña Escritorio (también sin modo docente),
órdenes de voz (abrir, apps a la izquierda/derecha, escenas, sin monitor), la IA escribe órdenes para el escritorio,
lo que se pregunta desde Nexo vuelve a Nexo con la respuesta, y si Nexo no está instalado ofrece descargarlo."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    body = r.post_data or ""
    ASKED.append(body)
    try: ult = json.dumps(json.loads(body)["contents"][-1], ensure_ascii=False)
    except Exception: ult = body
    if "organiza el escritorio" in ult:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Listo, señor.\n<<orden: abre spotify en ventana en el monitor>>"))
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("La fotosíntesis convierte la luz en energía, señor."))

NATIVE = """
window.__log = []; window.__cola = []; window.__nexo = { instalado: true, sinMonitor: false }; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__emit = (n, d) => (lst[n] || []).forEach((f) => f(d));
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: window.__cola.splice(0) }), abrir: async (o) => log('url ' + o.url) }),
  Nexo: anyP({ addListener: on,
    estado: async () => window.__nexo.instalado ? ({ instalado: true, version: '1.1', monitor: 'HDMI', monitorTam: '1920×1080' }) : ({ instalado: false, monitor: '' }),
    orden: async (o) => { log('nexo ' + o.accion + (o.app ? ' ' + o.app + ' ' + (o.modo || '-') : '') + (o.q ? ' ' + o.q : ''));
      const sm = window.__nexo.sinMonitor;
      setTimeout(() => window.__emit('resultado', { id: o.id, ok: !sm, codigo: sm ? 'sin_monitor' : 'ok', mensaje: sm ? 'No veo ningún monitor ni TV conectado.' : '', monitor: sm ? '' : 'HDMI', abierto: !sm, dondeAbierto: 'monitor', ventanas: 2 }), 60); },
    responder: async (o) => log('responder ' + o.pregunta + ' => ' + o.texto),
    abrir: async (o) => { log('ajuste ' + o.que); return { ok: true }; } }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' || n === 'IALocal' ? undefined : generic) }) };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, docente: false } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        # 1) la pestaña, también sin modo docente
        check(pg.is_visible(".tabs button[data-tab=escritorio]") and not pg.is_visible(".tabs button[data-tab=clase]"), "sin modo docente: pestañas Hablar y Escritorio (sin Clase)")
        pg.click(".tabs button[data-tab=escritorio]"); pg.wait_for_timeout(500)
        txt = pg.inner_text("#v-escritorio")
        check("Nexo Escritorio" in txt and "HDMI" in txt and pg.locator(".esc-b").count() == 8, "la pestaña muestra el monitor conectado y los botones")
        check(pg.locator(".esc-pt.on").count() == 1, "punto verde: Nexo instalado y monitor conectado")
        pg.click(".esc-b >> text=Abrir en el monitor"); pg.wait_for_timeout(600)
        check("nexo abrir" in logs() and pg.evaluate("document.body.dataset.tab") == "hablar", "botón «Abrir en el monitor» → Nexo abre el escritorio")
        # formas de conexión (3.24.1)
        pg.click(".tabs button[data-tab=escritorio]"); pg.wait_for_timeout(500)
        check(pg.locator("#v-escritorio .esc-forma").count() == 4 and pg.locator("#v-escritorio .esc-forma.on[data-forma=cable]").count() == 1, "pestaña: 4 formas de conexión, marcada la que está conectada (cable)")
        check("scrcpy --new-display" in pg.inner_text("#v-escritorio") and pg.locator("#v-escritorio .esc-det").count() == 1, "comandos de scrcpy y «Preparar el celular»")
        clear(); pg.click("#v-escritorio .esc-forma[data-forma=inalambrica] button:has-text(\"Buscar pantallas\")"); pg.wait_for_timeout(600)
        check("ajuste pantallas" in logs(), "«Buscar pantallas» abre Proyectar (Miracast) " + str(logs()) + last()[:80])
        pg.click(".tabs button[data-tab=escritorio]"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('#v-escritorio .esc-det').open = true")
        clear(); pg.click("#v-escritorio .esc-det button:has-text(\"Opciones de desarrollador\")"); pg.wait_for_timeout(300)
        check("ajuste desarrollador" in logs(), "botón «Opciones de desarrollador»")
        pg.click(".tabs button[data-tab=hablar]"); pg.wait_for_timeout(200)
        clear(); say("¿cómo conecto el monitor?", 900)
        check(pg.locator(".msg.jarvis >> nth=-1").locator(".esc-forma").count() == 4, "«¿cómo conecto el monitor?» → las 4 formas en la conversación")
        clear(); say("busca pantallas", 900)
        check("ajuste pantallas" in logs(), "«busca pantallas» por voz")
        say("prepara el celular para el escritorio", 900)
        check("formato libre" in last(), "«prepara el celular para el escritorio» → los pasos")
        # 2) voz: apps acomodadas
        clear(); say("abre Chrome a la izquierda y Word a la derecha en el monitor", 2600)
        check(logs()[:2] == ["nexo app chrome izquierda", "nexo app word derecha"], "«abre Chrome a la izquierda y Word a la derecha en el monitor» " + str(logs()))
        clear(); say("abre YouTube", 900)
        check(not any(x.startswith("nexo") for x in logs()), "«abre YouTube» a secas sigue siendo para el celular")
        # escenas
        clear(); say("pon el escritorio de trabajo", 2600)
        check(logs()[:2] == ["nexo app chrome izquierda", "nexo app docs derecha"] and "Trabajo" in last(), "escena «Trabajo»: Chrome izquierda y Docs derecha")
        clear(); say("busca recetas de arepas en el monitor", 900)
        check("nexo buscar recetas de arepas" in logs(), "«busca … en el monitor»")
        clear(); say("¿está conectado el monitor?", 900)
        check("HDMI" in last() and "2 apps" in last(), "estado: monitor y apps abiertas")
        # sin monitor
        pg.evaluate("window.__nexo.sinMonitor = true")
        say("abre el escritorio", 900)
        check("No veo ningún monitor" in last(), "sin monitor: Jarvis lo dice")
        pg.evaluate("window.__nexo.sinMonitor = false")
        # 3) la IA sabe de Nexo y escribe órdenes para el escritorio
        pg.evaluate("window.JX._nexo.refrescar()"); pg.wait_for_timeout(200)
        sp = pg.evaluate("window.__jarvis.systemPrompt()")
        check("Nexo Escritorio" in sp and "monitor conectado (HDMI)" in sp, "las instrucciones de la IA hablan de Nexo y del monitor")
        clear(); say("organiza el escritorio para escuchar música", 2500)
        check("nexo app spotify ventana" in logs(), "la IA escribe <<orden: abre spotify en ventana en el monitor>> y Jarvis lo hace " + str(logs()))
        # 4) Nexo → Jarvis → Nexo
        clear()
        pg.evaluate("window.__cola.push({ tipo: 'nexo', texto: '¿qué es la fotosíntesis?', origen: 'nexo' }); window.__emit('entrada', {})"); pg.wait_for_timeout(2000)
        r = [x for x in logs() if x.startswith("responder")]
        check("fotosíntesis" in pg.inner_text("#chat") and r and "qué es la fotosíntesis" in r[0] and "energía" in r[0], "pregunta desde Nexo: Jarvis responde y le devuelve la respuesta a Nexo " + str(r))
        clear(); say("¿y la respiración?", 1500)
        check(not any(x.startswith("responder") for x in logs()), "lo que preguntas en Jarvis no se manda a Nexo")
        # 5) Ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(600)
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(200)
        check(pg.locator("#aj-324").count() == 1 and pg.evaluate("document.querySelector('#aj-324 details.aj-grupo').dataset.tema") == "celular", "Ajustes › Celular y apps › Nexo Escritorio")
        pg.uncheck("#aj-324 input[type=checkbox]"); pg.wait_for_timeout(200)
        check(not pg.is_visible(".tabs button[data-tab=escritorio]") and not pg.is_visible(".tabs"), "esconder la pestaña (sin modo docente se esconde la barra)")
        pg.check("#aj-324 input[type=checkbox]"); pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 6) Nexo no instalado
        pg.evaluate("window.__nexo.instalado = false")
        clear(); say("abre el escritorio", 1000)
        check("Descargar Nexo" in last() and not any(x.startswith("nexo") for x in logs()), "sin Nexo: ofrece descargarlo")
        pg.click(".msg.jarvis >> nth=-1 >> text=Descargar Nexo Escritorio"); pg.wait_for_timeout(300)
        check(any("NexoEscritorio.apk" in x for x in logs()), "el botón abre la descarga del APK")
        sp = pg.evaluate("window.__jarvis.systemPrompt()")
        check("Nexo Escritorio" not in sp, "sin Nexo, la IA no habla del escritorio")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.24)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
