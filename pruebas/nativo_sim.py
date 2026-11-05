import sys; import os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright
srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 360, "height": 760}, is_mobile=True, has_touch=True)
    ctx.add_init_script(e2e.FAKE_VOICE)
    ctx.add_init_script("""window.__plan = [{texto:'qué hora es', motor:'google'}, {texto:'', motor:'google', nivel:-2}];
    const lst = {}; const generic = { addListener: () => ({ remove() {} }), speak: async () => {}, stop: async () => {}, modelo: async () => ({}), estado: async () => {} };
    const Oido = { disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }),
      diagnostico: async () => ({ permiso: true, google: true, celular: true, vosk: false, servicio: 'com.google.android.tts/...', servicios: ['com.google.android.as'], equipo: 'Samsung A54', android: '15 (API 35)', fondoActivo: true, fondoGrabando: false, ultimoError: 'google:cliente' }),
      addListener: (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() { lst[n] = lst[n].filter((x) => x !== f); } }; },
      escuchar: (o) => new Promise((r) => { const pl = o.motor ? { texto: o.motor === 'celular' ? 'probando' : '', motor: o.motor, error: o.motor === 'google' ? 'cliente' : undefined } : (window.__plan.shift() || { texto: '' });
        setTimeout(() => (lst.estado || []).forEach((f) => f({ s: 'listo' })), 150);
        setTimeout(() => r(pl), 700); }),
      detener: async () => {}, cancelar: async () => {} };
    window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => n === 'Oido' ? Oido : n === 'SpeechRecognition' ? undefined : generic }) };""")
    pg = ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e))); pg.goto(base); pg.wait_for_timeout(1200)
    pg.tap("#btn-mic"); pg.wait_for_timeout(80); print("al tocar:", pg.evaluate("document.body.dataset.state"), "|", pg.inner_text("#live"))
    pg.wait_for_timeout(300); print("listo:", pg.inner_text("#live"))
    pg.wait_for_timeout(2500); print("respuesta:", pg.evaluate("LASTJ()")[:40])
    pg.evaluate("JD.load().ajustes.seguir=false"); pg.tap("#btn-mic"); pg.wait_for_timeout(1200); print("sin voz:", pg.inner_text("#live"))
    pg.tap("#btn-ajustes"); pg.wait_for_timeout(300); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.tap("#btn-mic-test"); pg.wait_for_timeout(2500)
    txt = pg.inner_text("#mic-test"); print(txt); print("errores:", errs)
    assert "Funciona" in txt and "not a function" not in txt and not errs, "la prueba del micrófono falló"
    print("Todo bien (simulación nativa).")
    b.close()
srv.shutdown()
