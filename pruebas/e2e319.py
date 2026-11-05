"""Prueba de punta a punta de la 3.19: varias IA del celular (Gemma 4 y Qwen 3.5), escoger cuál uso, Qwen sin «razonamiento», fotos y voz según el modelo."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const CAP = (n) => ({ nombre: n, mb: /4B/.test(n) ? 2750 : /0\\.8B/.test(n) ? 1240 : 2580, familia: /gemma/i.test(n) ? 'gemma' : 'qwen35', ve: /gemma|-VL/i.test(n), oye: /gemma/i.test(n) });
window.__mods = ['gemma-4-E2B-it.litertlm']; window.__act = 'gemma-4-E2B-it.litertlm';
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  IALocal: { addListener: on,
    estado: async () => Object.assign({ listo: !!window.__act, gemma: true, libreMb: 20000, cargada: false }, window.__act ? CAP(window.__act) : { nombre: '' }),
    modelos: async () => ({ lista: window.__mods.map((n) => Object.assign(CAP(n), { activo: n === window.__act })), libreMb: 20000 }),
    usar: async (o) => { log('usar ' + o.nombre); window.__act = o.nombre; return CAP(o.nombre); },
    memoria: async () => ({ totalMb: 11800, libreMb: 6000, discoMb: 20000 }),
    descargar: async (o) => { log('descargar ' + o.nombre); fire('progreso', { p: 50, mb: 1300 }); window.__mods.push(o.nombre); window.__act = o.nombre; return { ok: true, mb: 2750 }; },
    borrar: async (o) => { log('borrar ' + (o && o.nombre)); window.__mods = window.__mods.filter((x) => x !== o.nombre); if (window.__act === o.nombre) window.__act = window.__mods[0] || ''; },
    precargar: async () => ({ listo: true }), grabar: async () => ({ ruta: '/c/v.wav', hablo: true }), pararGrabacion: async () => {}, detener: async () => {}, cancelar: async () => {},
    generar: async (o) => { log('generar ' + window.__act + ' ' + JSON.stringify({ s: (o.sistema || '').slice(-120), img: (o.imagenes || []).length }));
      if (/qwen/i.test(window.__act)) { fire('parcial', { texto: '<think>El usuario saluda' }); await new Promise((r) => setTimeout(r, 60)); return { texto: '<think>El usuario saluda, respondo.</think>\\n\\nBuenas noches, señor. ¿En qué le ayudo?', motor: 'Qwen 3.5 · CPU' }; }
      return { texto: 'Hola, señor.', motor: 'Gemma · CPU' }; } },
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
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'local', seguir: false, voz: false, v316: 1, vozJarvis316: 1, localModelo: 'qwen35_4b' } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=900: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        # descargar Qwen 3.5 4B sin borrar Gemma
        pg.click("#btn-ajustes"); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        opts = pg.evaluate("[...document.querySelectorAll('#a-local-modelo option')].map(o => o.value)")
        check(all(k in opts for k in ["qwen35_4b", "qwen35_2b", "qwen35_08b", "gemma4e4b", "qwen05"]), "Qwen 3.5 (4B, 2B y 0,8B) junto a Gemma 4 y Qwen 2.5")
        pg.select_option("#a-local-modelo", "qwen35_4b"); pg.click("#btn-local-bajar"); pg.wait_for_timeout(900)
        check("descargar Qwen3.5-4B_mixed_int4.litertlm" in logs(), "descarga Qwen 3.5 4B")
        filas = pg.locator("#a-local-lista .local-fila")
        check(filas.count() == 2 and "Gemma 4 E2B" in pg.inner_text("#a-local-lista") and "✅ Qwen 3.5 4B" in pg.inner_text("#a-local-lista"), "Gemma se queda: las dos en la lista, Qwen en uso")
        pg.locator("#a-local-lista .local-fila", has_text="Gemma").locator("button", has_text="Usar").click(); pg.wait_for_timeout(500)
        check("usar gemma-4-E2B-it.litertlm" in logs() and "✅ Gemma 4 E2B" in pg.inner_text("#a-local-lista"), "escoger cuál uso desde Ajustes")
        pg.click("#btn-ajustes-cerrar")
        # por voz
        say("¿qué IA del celular tengo?", 600)
        check("Gemma 4 E2B" in last() and "Qwen 3.5 4B" in last() and "entiende tu voz" in last(), "lista las IA del celular con lo que hace cada una")
        say("usa Qwen", 600)
        check("usar Qwen3.5-4B_mixed_int4.litertlm" in logs() and "Qwen 3.5 4B" in last(), "«usa Qwen» cambia a Qwen 3.5 4B")
        # responde con Qwen sin mostrar su razonamiento
        say("hola", 1200)
        check("Buenas noches, señor" in last() and "think" not in last() and "El usuario" not in last(), "Qwen responde sin mostrar su «razonamiento»")
        g = [x for x in logs() if x.startswith("generar Qwen")]
        check(g and "sin mostrar tu razonamiento" in g[-1], "a Qwen se le pide responder directo")
        check(pg.evaluate("window.__gemmaVoz && !window.__gemmaVoz.usar()"), "con Qwen la voz sin internet no usa la IA del celular (no oye audio)")
        say("descarga qwen 3.5 0,8b", 900)
        check(pg.is_visible("#ajustes") and pg.input_value("#a-local-modelo") == "qwen35_08b", "«descarga Qwen 3.5 0,8B» abre Ajustes con ese modelo")
        pg.click("#btn-ajustes-cerrar")
        say("usa gemma 4 e4b", 500)
        check("No tengo Gemma 4 E4B" in last() and "descarga Gemma 4 E4B" in last(), "si no está descargada, lo dice")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.19)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
