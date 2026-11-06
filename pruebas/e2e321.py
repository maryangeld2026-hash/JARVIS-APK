"""Prueba de punta a punta de la 3.21: cambio automático nube ⇄ celular (falla, cupo, sin internet, vuelve la nube), etiqueta de quién
responde, prompt con la parte fija primero (la nube lo reutiliza) y el diseño Cristal (ligero y clásico)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
MODO = {"v": "falla"}

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        if MODO["v"] == "falla": return route.abort()
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    ASKED.append(r.post_data or "")
    if MODO["v"] == "falla": return route.fulfill(status=503, json={"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})
    if MODO["v"] == "cupo": return route.fulfill(status=429, json={"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Respondo desde la nube, señor."))

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  IALocal: { addListener: on, estado: async () => ({ listo: true, gemma: true, nombre: 'gemma-4-E4B-it.litertlm', mb: 3600, familia: 'gemma', ve: true, oye: true, libreMb: 9000 }),
    modelos: async () => ({ lista: [{ nombre: 'gemma-4-E4B-it.litertlm', mb: 3600, activo: true, ve: true, oye: true }] }),
    precargar: async () => { log('precargar'); return { listo: true }; }, detener: async () => {},
    generar: async (o) => { log('local'); return { texto: 'Respondo desde Gemma en el celular, señor.', motor: 'Gemma · CPU' }; } },
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
        ctx = b.new_context(viewport={"width": 390, "height": 840}, is_mobile=True, has_touch=True, locale="es-CO")
        ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(NATIVE)
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, modeloAuto: { gemini: { m: 'gemini-3.5-flash-lite', alt: [], t: Date.now(), k: 'AIzaX|' } } } }))""")
        pg.reload(); pg.wait_for_timeout(3800)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        chip = lambda: pg.evaluate("(document.querySelector('#motor') || {}).dataset ? document.querySelector('#motor').dataset.m : ''")
        # diseño
        check(pg.evaluate("!!document.querySelector('#css-cristal') && !document.querySelector('#css-cristal').disabled"), "diseño Cristal cargado")
        check(chip() == "nube", "etiqueta: responde la nube")
        sp = pg.evaluate("window.__jarvis.systemPrompt()")
        check(sp.find("Hoy es") > sp.find("<<orden"), "la fecha y la hora van al final de lo fijo (la nube reutiliza el comienzo)")
        # 1) la nube falla → responde Gemma sola (sin haberla puesto de respaldo)
        say("¿qué es un agujero negro?", 2500)
        check("desde Gemma" in last() and "local" in pg.evaluate("window.__log"), "la nube falla: responde la IA del celular sola")
        check(chip() == "local" and "IA del celular" in pg.inner_text("body"), "la etiqueta cambia a LOCAL y avisa")
        n0 = len(ASKED)
        say("¿y una estrella?", 1500)
        check("desde Gemma" in last() and len(ASKED) == n0, "mientras la nube está caída, va directo al celular (sin esperar)")
        # 2) vuelve la nube
        MODO["v"] = "ok"
        pg.evaluate("window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(2500)
        check(chip() == "nube", "volvió la nube: la etiqueta vuelve a NUBE")
        say("¿y un planeta?", 1500)
        check("desde la nube" in last(), "y responde la nube otra vez")
        # 3) se acaba el cupo → celular
        MODO["v"] = "cupo"
        say("¿y un cometa?", 4500)
        check("desde Gemma" in last(), "se acabó el cupo (429): responde el celular")
        MODO["v"] = "ok"
        n0 = len(ASKED)
        say("¿y un asteroide?", 1500)
        check("desde Gemma" in last() and len(ASKED) == n0, "con el cupo agotado no insiste con la nube por un rato")
        pg.evaluate("window.JIA.ruta && 0")
        # 4) sin internet
        ctx.set_offline(True); pg.wait_for_timeout(300)
        check(pg.evaluate("JIA.plan()[0]") == "local", "sin internet: el plan empieza por el celular")
        ctx.set_offline(False)
        # 5) sin cambio automático y sin respaldo
        pg.evaluate("JD.load().ajustes.iaAuto = false")
        check(pg.evaluate("JIA.plan().join(',')") == "gemini", "sin cambio automático: solo la principal")
        pg.evaluate("JD.load().ajustes.iaAuto = true")
        # 6) diseño ligero y clásico
        pg.click("#btn-ajustes"); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(200)
        pg.select_option("#aj-321 select", "ligero"); pg.wait_for_timeout(100)
        check(pg.evaluate("document.body.classList.contains('cr-ligero')"), "Cristal ligero: sin desenfoque")
        pg.select_option("#aj-321 select", "clasico"); pg.wait_for_timeout(100)
        check(pg.evaluate("document.querySelector('#css-cristal').disabled"), "Clásico: vuelve el diseño de antes")
        pg.select_option("#aj-321 select", "cristal")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.21)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
