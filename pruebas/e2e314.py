"""Prueba de punta a punta de la 3.14: deshacer, preguntar cuando hay dos sentidos, modo pensar, catálogo, Ajustes
ordenados con buscador, bienvenida, Gemma lee PDF sin internet y búsqueda por significado en las notas."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
def gem(route):
    r = route.request; u = r.url
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    t = json.dumps(body, ensure_ascii=False)
    if ":streamGenerateContent" in u or ":generateContent" in u: ASKED.append(t)
    if "Razonamiento" in t:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("### Razonamiento\n200.000 × 36 = 7.200.000\n### Respuesta\nEn 3 años tendrás 7,2 millones."))
    if "podrían aparecer en esas notas" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps({"palabras": ["acudientes", "familias", "entrega de boletines"]})}]}}]})
    if "Fragmentos:" in t:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("La entrega de boletines con las familias es el jueves 12 (Acta de área)."))
    return e2e.gemini(route)

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); }, stop: async () => {}, checkPermissions: async () => ({}), requestPermissions: async () => ({}), schedule: async (o) => { o.notifications.forEach((n) => log('noti ' + n.id)); }, cancel: async (o) => log('cancel ' + JSON.stringify(o)), registerActionTypes: async () => {}, keepAwake: async () => {}, allowSleep: async () => {}, getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async () => {}, textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  IALocal: { addListener: on, estado: async () => ({ listo: true, gemma: true, nombre: 'gemma-4-E4B-it.litertlm', mb: 3490 }), memoria: async () => ({ totalMb: 11400 }),
    pdfPaginas: async (o) => { log('pdf ' + o.max); return { paginas: ['AAAA', 'BBBB'], total: 7 }; },
    generar: async (o) => { log('gemma ' + (o.imagenes || []).length); return { texto: 'El documento es una circular sobre la salida del viernes.', motor: 'Gemma · GPU' }; }, detener: async () => {} },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' ? undefined : generic) }) };
"""

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(1800)
        # bienvenida (instalación nueva)
        check(pg.locator("#chat .empty .bienv").count() == 1, "bienvenida de 1 minuto en una instalación nueva")
        pg.fill(".bienv input", "Laura"); pg.press(".bienv input", "Tab")
        pg.click(".bienv >> text=Sí"); pg.wait_for_timeout(400)
        check(pg.evaluate("JD.load().ajustes.nombre") == "Laura" and pg.evaluate("JD.load().ajustes.docente") is True, "bienvenida: nombre y modo docente")
        pg.click(".bienv >> text=Listo"); pg.wait_for_timeout(200)
        check(pg.evaluate("JD.load().ajustes.bienvenida") is True and pg.locator(".bienv").count() == 0, "bienvenida: queda lista")
        pg.evaluate("JD.load().ajustes.claves = { gemini: 'AIzaX' }; JD.load().ajustes.seguir = false; JD.load().ajustes.voz = false;")
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        # deshacer
        say("gasté 25 mil en almuerzo"); say("deshaz eso")
        check("Deshice «gasté 25 mil en almuerzo»" in last() and pg.evaluate("(JD.load().gastos || []).length") == 0, "deshacer un gasto")
        say("recuérdame a las 5 llamar a mamá", 600); n = pg.evaluate("JD.load().recordatorios.length"); say("no, eso no", 500)
        check(pg.evaluate("JD.load().recordatorios.length") == n - 1, "deshacer un recordatorio")
        say("deshaz eso", 300); check("No tengo nada para deshacer" in last(), "deshacer sin nada pendiente")
        # dos sentidos
        say("muéstrame la lista", 400)
        check("¿Cuál lista?" in last() and pg.locator(".msg.jarvis:last-of-type .chip").count() == 2, "«la lista»: pregunta cuál (mercado o asistencia)")
        # catálogo
        say("¿qué puedes hacer?", 400)
        check(pg.is_visible("#cat-sh") and pg.locator("#cat-sh .chip").count() > 30, "catálogo de lo que hace Jarvis")
        pg.click("#cat-sh >> text=Pon 10 minutos para el arroz"); pg.wait_for_timeout(500)
        check(not pg.is_visible("#cat-sh") and pg.evaluate("(JD.load().timers || []).some(t => t.nombre === 'arroz')"), "catálogo: tocar un ejemplo lo hace")
        # pensar
        say("piensa bien: si ahorro 200 mil al mes, ¿cuánto tengo en 3 años?", 1500)
        check("7,2 millones" in last() and pg.locator(".msg.jarvis:last-of-type details.pensar").count() == 1, "modo pensar: respuesta y razonamiento plegado")
        say("¿qué es la fotosíntesis?", 1200)
        # few-shot en el prompt
        check(any("<<orden: pon una alarma a las 6>>" in x for x in ASKED), "el prompt trae ejemplos de órdenes (sirve también a Gemma)")
        # búsqueda por significado
        pg.evaluate("JD.load().docs = [{ id: 'd1', titulo: 'Acta de área', md: 'La entrega de boletines con las familias será el jueves 12 en el auditorio.', fecha: Date.now(), tipo: 'acta' }]")
        say("según mis notas, cuándo es la reunión con los papás", 1800)
        check("jueves 12" in last() and any("podrían aparecer en esas notas" in x for x in ASKED), "búsqueda por significado: «reunión con los papás» encuentra «entrega de boletines con las familias»")
        # Gemma lee PDF sin internet
        pg.evaluate("JD.load().ajustes.proveedor = 'local'")
        pdf = "/tmp/claude-0/circular.pdf"; open(pdf, "wb").write(b"%PDF-1.4\n%prueba\n")
        pg.set_input_files("#chat-doc-in", pdf); pg.wait_for_timeout(1500)
        L = pg.evaluate("window.__log")
        check("pdf 4" in L and "gemma 2" in L and "circular" in last() and "solo pude ver las primeras 2" in last(), "Gemma lee un PDF sin internet (sus primeras páginas)")
        pg.evaluate("JD.load().ajustes.proveedor = 'gemini'")
        # ajustes ordenados
        pg.click("#btn-ajustes"); pg.wait_for_timeout(400)
        g = pg.locator("#ajustes details.aj-grupo").count()
        check(g >= 12 and pg.locator("#ajustes details.aj-grupo[open]").count() == 0, f"Ajustes en {g} grupos plegables")
        pg.fill("#aj-buscar", "batería"); pg.wait_for_timeout(200)
        vis = pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].filter(d => !d.hidden).map(d => d.querySelector('summary').textContent)")
        check(any("Batería" in v for v in vis) and len(vis) < g, "buscador de Ajustes: «batería»")
        pg.screenshot(path="/tmp/claude-0/s314-aj.png")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.14)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
