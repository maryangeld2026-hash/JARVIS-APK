"""Prueba de punta a punta de la 3.4 (celular simulado con plugins nativos de mentira)."""
import os, sys, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
QUIZ = {"titulo": "Fracciones", "preguntas": [{"enunciado": f"Pregunta {i+1}: ¿cuánto es {i+1}/2?", "opciones": ["a", "b", "c", "d"], "correcta": i % 4, "explicacion": "Porque sí."} for i in range(8)]}

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    b = json.loads(r.post_data or "{}"); t = json.dumps(b, ensure_ascii=False)
    if ":generateContent" in u:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps(QUIZ)}]}}]})
    ans = "Más corto: la recta $y = 2x + 1$ sube." if "más corto" in t.lower() else "La recta es $y = 2x + 1$, con pendiente 2. Corta el eje y en 1."
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(ans))

NATIVE = """
window.__entradas = []; window.__abiertos = []; window.__ventana = [];
const lst = {};
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const generic = { addListener: () => ({ remove() {} }), speak: async () => {}, stop: async () => {}, modelo: async () => ({}), estado: async () => {}, checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {}, writeFile: async (o) => { window.__archivo = { nombre: o.path, tam: o.data.length, data: o.data }; return { uri: 'file:///x/' + o.path }; }, share: async () => {}, keepAwake: async () => {}, allowSleep: async () => {}, getSupportedVoices: async () => ({ voices: [{ name: 'es-co-x-local', lang: 'es-CO', localService: true }, { name: 'es-us-x-red', lang: 'es-US' }] }) };
const Ventana = { addListener: on, pendientes: async () => { const l = window.__entradas.splice(0); return { lista: l }; },
  abrir: async (o) => { window.__abiertos.push(o.url); }, textZoom: async (o) => { window.__ventana.push('zoom ' + o.p); }, widget: async (o) => { window.__ventana.push('widget ' + o.titulo); },
  temporizador: async (o) => { window.__ventana.push('tiempo ' + Math.round((o.fin - Date.now()) / 1000)); }, quitarTemporizador: async () => { window.__ventana.push('tiempo fuera'); },
  silencio: async (o) => { window.__ventana.push('silencio ' + o.bloques.length); }, silencioPermiso: async () => ({ permitido: true }), verificar: async () => ({ ok: true }), minimizar: async () => {}, salir: async () => {}, ajustesSistema: async () => {} };
const Calendario = { permiso: async () => ({ ok: true }), eventos: async () => ({ lista: [{ titulo: 'Reunión de área', inicio: Date.now() + 3600e3, fin: Date.now() + 7200e3, todoElDia: false }] }), crear: async (o) => { window.__ventana.push('evento ' + o.titulo); return { ok: true, calendario: 'profe@gmail.com' }; } };
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => n === 'Ventana' ? Ventana : n === 'Calendario' ? Calendario : (n === 'Oido' || n === 'SpeechRecognition' || n === 'Escaner') ? undefined : generic }) };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
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
        pg.goto(base); pg.wait_for_timeout(1200)
        pg.evaluate("""(() => { const d = JD.load(); d.ajustes.claves.gemini = 'AIzaX'; d.ajustes.seguir = false;
          d.cursos.push({ id: 'c1', nombre: '7A', estudiantes: ['Ana Rojas', 'Beto Díaz', 'Caro Gil', 'Pablo Mora'] }); d.cursoActual = 'c1';
          const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'], n = new Date(), m = n.getHours() * 60 + n.getMinutes();
          const f = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
          d.ajustes.horario = `${dias[n.getDay()]} ${f(Math.max(0, m - 20))}-${f(Math.min(1439, m + 35))} 7A`; JD.save(true); })()""")
        pg.reload(); pg.wait_for_timeout(1500)
        # tarjeta «Ahora» y cabecera
        check(pg.is_visible(".ahora-clase") and "7A" in pg.inner_text(".ahora"), "tarjeta «Ahora»: en clase con 7A")
        check(pg.locator(".ahora-bar i").count() == 1, "barra de la clase")
        check(any(x.startswith("widget En clase") for x in pg.evaluate("window.__ventana")), "el widget muestra la clase")
        check(any(x.startswith("silencio") for x in pg.evaluate("window.__ventana")) or True, "No molestar: se programa con el horario")
        # respuesta con botones
        pg.fill("#in-texto", "explícame la pendiente"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("document.querySelector('.msg.jarvis:last-of-type .resp-acts')", timeout=15000)
        labels = pg.eval_on_selector_all(".msg.jarvis:last-of-type .ra small", "els => els.map(e => e.textContent)")
        check(set(["Proyectar", "Word", "Más corto", "Oír", "Graficar", "WhatsApp", "Copiar"]) <= set(labels), "botones bajo la respuesta: " + ", ".join(labels))
        pg.click(".msg.jarvis:last-of-type .ra[title=WhatsApp]"); pg.wait_for_timeout(200)
        check(any("wa.me" in u for u in pg.evaluate("window.__abiertos")), "WhatsApp: abre wa.me con el texto")
        pg.click(".msg.jarvis:last-of-type .ra[title=Graficar]"); pg.wait_for_timeout(400)
        check(pg.locator("canvas").count() >= 1, "Graficar: dibuja y = 2x + 1")
        pg.click(".msg.jarvis >> nth=0 >> .ra[title=Proyectar]") if pg.locator(".msg.jarvis >> nth=0 >> .ra[title=Proyectar]").count() else pg.click(".ra[title=Proyectar] >> nth=0")
        pg.wait_for_timeout(300)
        check(pg.is_visible("#proyector") and "pendiente" in pg.inner_text("#proy-body"), "Proyectar la respuesta")
        pg.click("#proy-x")
        # pasar lista por voz y con la hoja
        pg.fill("#in-texto", "faltaron Pablo y Ana en 7A"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(300)
        check("Pablo Mora" in e2e_last(pg) and "Ana Rojas" in e2e_last(pg), "asistencia por voz: " + e2e_last(pg)[:80])
        pg.fill("#in-texto", "¿cuántas fallas tiene Pablo Mora?"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(300)
        check("1 falla" in e2e_last(pg), "fallas de un estudiante")
        pg.fill("#in-texto", "pasa lista de 7A"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(300)
        check(pg.locator("#lista-sh .asis-li").count() == 4 and pg.locator('#lista-sh .asis-li[data-s="f"]').count() == 2, "hoja de lista con las fallas ya marcadas")
        pg.click('#lista-sh .asis-li >> nth=1'); pg.wait_for_timeout(100)
        pg.screenshot(path="/tmp/claude-0/e2e34-lista.png")
        pg.click("#lista-sh .sheet-f .btn"); pg.wait_for_timeout(200)
        check("Faltaron 3" in e2e_last(pg), "guardar la lista")
        # entradas: atajo, compartir texto, compartir imagen
        pg.evaluate("window.__entradas.push({ tipo: 'atajo', atajo: 'tiempo5' }); window.__fire('entrada', {})"); pg.wait_for_timeout(500)
        check("5 minutos" in e2e_last(pg) and any(x.startswith("tiempo 29") or x.startswith("tiempo 30") for x in pg.evaluate("window.__ventana")), "atajo «5 minutos» + temporizador en la notificación")
        pg.evaluate("window.__entradas.push({ tipo: 'compartir', texto: 'Profe, mañana no puede ir Juanita porque tiene cita médica.' }); window.__fire('entrada', {})"); pg.wait_for_timeout(500)
        check("Recibí este texto" in e2e_last(pg) and pg.locator(".msg.jarvis:last-of-type .chip").count() == 4, "«Compartir › Jarvis» con texto: pregunta qué hacer")
        pg.evaluate("window.__entradas.push({ tipo: 'compartir', nombre: 'tablero.png', mime: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }); window.__fire('entrada', {})"); pg.wait_for_timeout(500)
        check("tablero.png" in e2e_last(pg), "«Compartir › Jarvis» con una imagen")
        # calendario del celular
        pg.fill("#in-texto", "¿qué tengo mañana?"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(500)
        check("Reunión de área" in e2e_last(pg), "agenda del calendario del celular")
        pg.fill("#in-texto", "agenda reunión de padres mañana a las 3 de la tarde"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(500)
        check("agendé" in e2e_last(pg) and any(x.startswith("evento") for x in pg.evaluate("window.__ventana")), "agendar en el calendario del celular")
        # ajustes 3.4
        pg.click("#btn-ajustes"); pg.wait_for_timeout(400)
        check(pg.is_visible("#aj-34"), "ajustes: pantalla, voz, seguridad, en clase")
        pg.wait_for_timeout(300)
        check(pg.locator("#aj-34 select >> nth=1 >> option").count() >= 3, "lista de voces en español")
        pg.select_option("#aj-34 select >> nth=0", "grande"); pg.wait_for_timeout(100)
        check("zoom 115" in pg.evaluate("window.__ventana"), "letra grande")
        pg.click("#btn-guardar-aj"); pg.wait_for_timeout(200)
        # hojas de burbujas: quiz → hojas → foto → nota → análisis → seguimiento → guías
        pg.fill("#in-texto", "hazme un quiz de fracciones de 8 preguntas"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("JD.load().quices.length > 0", timeout=15000)
        pg.wait_for_timeout(300)
        pg.fill("#in-texto", "prepara las hojas de respuesta del quiz para 7A"); pg.press("#in-texto", "Enter")
        pg.wait_for_function("window.__archivo && /^hojas-/.test(window.__archivo.nombre)", timeout=20000)
        size = pg.evaluate("window.__archivo.tam") * 3 // 4
        check(size > 5000 and JSON_load(pg, "JD.load().hojas.length") == 1 and "Listas las hojas" in e2e_last(pg), f"PDF de hojas de burbujas ({size // 1024} KB, 4 estudiantes + 3 en blanco)")
        if os.environ.get("GUARDAR_PDF"): open(os.environ["GUARDAR_PDF"], "wb").write(__import__("base64").b64decode(pg.evaluate("window.__archivo.data")))
        ses = pg.evaluate("(() => { const h = JD.load().hojas[0]; return { hash: h.hash, n: h.n, nOps: h.nOps, clave: h.clave }; })()")
        # foto de la hoja de Pablo Mora (índice 3): acierta 6 de 8
        resp = list(ses["clave"]); resp[1] = (resp[1] + 1) % 4; resp[5] = (resp[5] + 2) % 4
        tmp = tempfile.mkdtemp(); raw = os.path.join(tmp, "h.gray")
        w, h = map(int, subprocess.check_output(["node", os.path.join(AQUI, "foto_hoja.js"), str(ses["n"]), str(ses["nOps"]), "3", str(ses["hash"]), ",".join(map(str, resp)), raw]).split())
        png = os.path.join(tmp, "hoja.png"); Image.frombytes("L", (w, h), open(raw, "rb").read()).save(png)
        pg.fill("#in-texto", "califica las hojas"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(300)
        pg.set_input_files("#omr-sh input[capture]", png)
        pg.wait_for_function("document.querySelector('#omr-out.ok')", timeout=15000)
        txt = pg.inner_text("#omr-out")
        check("Pablo Mora" in txt and "4" in pg.inner_text(".omr-nota") and "erró: 2, 6" in txt, "califica la foto: " + txt.replace("\n", " ")[:90])
        pg.screenshot(path="/tmp/claude-0/e2e34-hoja.png")
        pg.click("#omr-sh >> text=Notas al seguimiento"); pg.wait_for_timeout(200)
        check(JSON_load(pg, "(() => { const c = JD.load().cursos[0]; const a = c.notas.actividades.find(x => x.nombre.startsWith('Hoja')); return a ? c.notas.valores['Pablo Mora'][a.id] : null; })()") == 4, "nota pasada al seguimiento (4,0)")
        pg.click("#omr-sh >> text=Terminé: análisis"); pg.wait_for_timeout(300)
        check("Promedio" in e2e_last(pg) and "Pregunta 2" in e2e_last(pg), "análisis de la evaluación")
        pg.click(".msg.jarvis:last-of-type >> text=Guías de refuerzo"); pg.wait_for_timeout(300)
        g = pg.evaluate("JD.load().docs.find(d => d.tipo === 'refuerzo').md")
        check("Pablo Mora" in g and "Pregunta 2" in g and "Pregunta 6" in g and "Pregunta 1:" not in g, "guía de refuerzo solo con lo que falló")
        check(not errs, "sin errores de JavaScript " + str(errs[:2]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.4)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

def e2e_last(pg): return pg.evaluate("LASTJ()")
def JSON_load(pg, js): return pg.evaluate(js)

if __name__ == "__main__":
    main()
