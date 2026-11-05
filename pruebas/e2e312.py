"""Prueba de punta a punta de la 3.12: Gemma 4 dentro del celular (LiteRT-LM), con un motor de mentira."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
const fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
let listo = false;
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); }, stop: async () => {}, checkPermissions: async () => ({}), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {}, keepAwake: async () => {}, allowSleep: async () => {}, getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async () => {}, textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  IALocal: { addListener: on, estado: async () => ({ listo, gemma: listo, nombre: listo ? 'gemma-4-E2B-it.litertlm' : '', mb: listo ? 2580 : 0, libreMb: 20000 }), memoria: async () => ({ totalMb: 7800, libreMb: 3000, discoMb: 20000 }),
    descargar: async (o) => { log('descargar ' + o.nombre + ' ' + o.url); fire('progreso', { p: 50, mb: 1290 }); listo = true; return { ok: true, mb: 2580 }; },
    grabar: async (o) => { log('grabar'); return { ruta: '/cache/gemma_voz.wav', segundos: 2.1, hablo: true }; }, pararGrabacion: async () => {},
    generar: async (o) => { log('generar ' + JSON.stringify({ s: (o.sistema || '').slice(0, 40), n: (o.mensajes || []).length, ult: (o.mensajes || []).slice(-1)[0], max: o.maxTokens, img: (o.imagenes || []).length, audio: o.audio || '' }));
      if ((o.mensajes || []).slice(-1)[0].content.includes('explícame los pasos')) { const t = 'Estos son los pasos:\\n' + Array.from({ length: 14 }, (_, i) => '- Paso ' + (i + 1) + ' de la receta con bastantes palabras para que el texto quede largo y sin ningún punto final').join('\\n') + '\\n- Y al final sirves caliente'; fire('parcial', { texto: t.slice(0, 300) }); return { texto: t, motor: 'Gemma · GPU' }; }
      if (o.audio) return { texto: 'pon cinco minutos', motor: 'Gemma · CPU' };
      if ((o.imagenes || []).length) return { texto: 'Veo un gato sobre una mesa.', motor: 'Gemma · CPU', ve: true }; fire('parcial', { texto: 'París es' }); await new Promise(r => setTimeout(r, 80)); return { texto: 'París es la capital de Francia.', motor: 'Gemma · CPU' }; },
    detener: async () => log('detener'), cancelar: async () => {}, borrar: async () => { listo = false; } },
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
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0"); pg.evaluate("localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: {}, seguir: false, voz: false, proveedor: 'gemini', respaldo: 'local' } }))")
        pg.reload(); pg.wait_for_timeout(2500)
        pg.click("#btn-ajustes"); pg.wait_for_timeout(250); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(400)
        opts = pg.evaluate("[...document.querySelectorAll('#a-local-modelo option')].map(o => o.value)")
        check(opts[:2] == ["gemma4e2b", "gemma4e4b"], "Gemma 4 E2B y E4B en la lista de la IA del celular")
        pg.select_option("#a-local-modelo", "gemma4e4b"); pg.click("#btn-local-bajar"); pg.wait_for_timeout(800)
        check(any("descargar gemma-4-E4B-it.litertlm https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm" in x for x in pg.evaluate("window.__log")), "descarga Gemma 4 E4B (avisa si la RAM es poca)")
        check("Lista en este celular (gemma-4-E2B" in pg.inner_text("#a-local-st"), "estado: lista en el celular")
        pg.click("#btn-ajustes-cerrar")
        pg.evaluate("JD.load().ajustes.proveedor = 'local'")
        pg.fill("#in-texto", "¿cuál es la capital de Francia?"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(1500)
        gen = [x for x in pg.evaluate("window.__log") if x.startswith("generar ")]
        g = json.loads(gen[-1][8:]) if gen else {}
        check("París es la capital de Francia." in pg.evaluate("LASTJ()") and g.get("ult", {}).get("content", "").endswith("¿cuál es la capital de Francia?") and "son las" in g.get("ult", {}).get("content", "") and g.get("s", "").startswith("Eres Jarvis") and g.get("max") == 1800, "responde con Gemma (conversación con roles y sistema)")
        # respuesta larga en lista: la voz la dice completa
        pg.evaluate("JD.load().ajustes.voz = true; window.__said.length = 0")
        pg.fill("#in-texto", "explícame los pasos para hacer arroz"); pg.press("#in-texto", "Enter"); pg.wait_for_timeout(2500)
        said = " ".join(pg.evaluate("window.__said"))
        check("Paso 14" in said and "sirves caliente" in said and max(len(x) for x in pg.evaluate("window.__said")) <= 420, "la voz dice la explicación completa (listas largas por partes)"); print("   piezas:", [len(x) for x in pg.evaluate("window.__said")])
        pg.evaluate("JD.load().ajustes.voz = false")
        # fotos con Gemma
        img = "/tmp/claude-0/gato.png"
        from PIL import Image; Image.new("RGB", (40, 40), "orange").save(img)
        pg.set_input_files("#chat-foto-in", img); pg.wait_for_timeout(1500)
        g2 = [x for x in pg.evaluate("window.__log") if x.startswith("generar ")]
        check(g2 and json.loads(g2[-1][8:]).get("img") == 1 and "Veo un gato" in pg.evaluate("LASTJ()"), "Gemma ve fotos sin internet")
        # voz con Gemma (sin internet)
        ctx.set_offline(True); pg.evaluate("window.__gemmaVoz.refrescar()"); pg.wait_for_timeout(300)
        pg.click("#btn-mic"); pg.wait_for_timeout(2500)
        L = pg.evaluate("window.__log")
        check("grabar" in L and any('"audio":"/cache/gemma_voz.wav"' in x for x in L) and pg.evaluate("window.__jarvis.timer.end > 0"), "sin internet, Gemma entiende tu voz («pon cinco minutos»)")
        ctx.set_offline(False)
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.12)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
