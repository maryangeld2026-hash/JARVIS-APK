"""Prueba de punta a punta de la 3.30 (lo nuevo de los asistentes de 2026): dictado ordenado con Gemini, widget a tu medida,
cuidar el celular, sugerencias desde los mensajes, buscar por significado (también en la memoria), pedidos con el agente,
contestador de llamadas y Gemini Nano."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nativo330.js")).read()
PEDIDOS = []

def gem(route):
    u = route.request.url
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.8-live", "supportedGenerationMethods": ["bidiGenerateContent"]}]})
    if ":generateContent" in u and "streamGenerateContent" not in u:
        body = route.request.post_data or ""
        PEDIDOS.append(body[:400])
        if "audio/wav" in body:
            return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "Acta de la reunión del 23 de noviembre.\n\n- Se aprobó la salida pedagógica.\n- La entrega de notas es el viernes."}]}}]})
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("Según tus notas, la salida pedagógica al museo es el viernes, señor."))

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
        ctx.route("https://huggingface.co/**", lambda r: r.fulfill(status=404, body=""))
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: d.accept())
        pg.goto(base); pg.wait_for_timeout(300)
        pg.evaluate("window.JD ? JD.save(true) : 0")
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false, nombre: 'Mary Ángel' },
          docs: [{ id: 'd1', titulo: 'Circular de noviembre', md: 'La salida pedagógica al museo de ciencias es el viernes 28. Los estudiantes deben traer el permiso firmado.', fecha: Date.now() - 864e5 }] }))""")
        pg.reload(); pg.wait_for_timeout(3200)
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        clear = lambda: pg.evaluate("window.__log.length = 0")
        # 1) Ajustes: cada parte en su tema
        pg.click("#btn-ajustes"); pg.wait_for_timeout(800)
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-330 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["voz", "ia", "ia", "celular", "celular", "celular", "celular"], "Ajustes 3.30 repartidos en Voz, IA y Celular " + str(temas))
        vivo = pg.evaluate("(() => { const d = [...document.querySelectorAll('details.aj-grupo')].find(x => x.querySelector('summary').textContent === 'Conversación en vivo'); return d ? d.dataset.tema + '|' + d.textContent : ''; })()")
        check(vivo.startswith("voz|") and "Gemini 3.8 Live" in vivo, "«Conversación en vivo» (arriba en Voz) con el selector de Gemini 3.8 Live")
        pg.click("#btn-ajustes-cerrar"); pg.wait_for_timeout(300)
        # 2) dictado ordenado (con Gemini: el audio va a Gemini y vuelve limpio)
        clear(); say("toma dictado de un acta", 2500)
        check(any(x.startswith("grabar ") for x in logs()), "graba el dictado largo (sin cortarse en las pausas)")
        check(any("audio/wav" in x for x in PEDIDOS), "el audio va a Gemini para transcribirlo ordenado")
        check("Se aprobó la salida pedagógica" in last(), "sale el acta limpia con su lista · " + last()[:80])
        check(pg.evaluate("(JD.load().dictados || []).length") == 1, "el dictado queda guardado (para buscarlo después)")
        # 3) widget a tu medida
        clear(); say("crea un widget con la cuenta regresiva para vacaciones el 12 de diciembre", 1500)
        w = pg.evaluate("window.__widget || {}")
        check(w.get("titulo") == "Cuenta regresiva" and "vacaciones" in w.get("texto", "") and w.get("fijar"), "widget con la cuenta regresiva " + json.dumps(w, ensure_ascii=False)[:120])
        say("crea un widget con mis pagos y mis recordatorios", 1500)
        w = pg.evaluate("window.__widget || {}")
        check(w.get("titulo") == "Mi resumen" and "Pagos del mes" in w.get("texto", "") and "Recordatorios" in w.get("texto", ""), "widget con dos cosas juntas")
        # 4) cuidar el celular
        say("libera espacio", 1200)
        check("Se está llenando" in last() and "IA del celular" in last(), "«libera espacio»: cuánto queda y qué ocupa Jarvis · " + last()[:80])
        clear(); pg.click(".msg.jarvis:last-of-type button:has-text('Liberar espacio de Android')"); pg.wait_for_timeout(300)
        check("liberar" in logs(), "abre «Liberar espacio» de Android")
        say("¿qué apps ven mi ubicación?", 1200)
        check("Maps" in last() and "Siempre" in last(), "qué apps ven la ubicación (y cuáles siempre)")
        clear(); say("silencia todo menos las llamadas de mi familia por 2 horas", 1200)
        check("silencio favoritos 120" in logs() and "favoritos" in last(), "silencio con excepciones por 2 horas")
        clear(); say("quita el silencio", 900)
        check("fin silencio" in logs(), "«quita el silencio» vuelve como estaba")
        # 5) sugerencias desde los mensajes
        say("sugerencias de mis mensajes", 1200)
        t = last()
        check("Agendar" in t and "lista" in t and "código" not in t.lower(), "sugerencias: cita y lista (nada del código del banco) · " + t[:120])
        n0 = pg.evaluate("(JD.load().recordatorios || []).length")
        pg.click(".msg.jarvis:last-of-type button:has-text('Agendar')"); pg.wait_for_timeout(1500)
        check(pg.evaluate("(JD.load().recordatorios || []).length") == n0 + 1, "tocar la sugerencia crea el recordatorio")
        clear(); say("activa las sugerencias de mis mensajes", 900)
        check(any('"sugerencias":true' in x for x in logs()), "activar las sugerencias (las revisa el celular)")
        # 6) buscar por significado
        clear(); say("busca en mi celular lo del paseo", 2000)
        check(any(x.startswith("indexar ") for x in logs()) and "Circular de noviembre" in last(), "«busca en mi celular lo del paseo» encuentra la circular del museo · " + last()[:100])
        clear(); say("¿dónde anoté lo del paseo?", 3500)
        check(any(x.startswith("buscar task: search result") for x in logs()), "la memoria de largo plazo también busca por significado")
        check("museo" in pg.inner_text(".msg.jarvis:last-of-type"), "y encuentra la salida al museo aunque dijiste «paseo»")
        # 7) pedidos, contestador y Gemini Nano
        say("pídeme un domicilio de hamburguesa", 2500)
        check("Rappi" in pg.inner_text("#chat"), "«pídeme un domicilio…» va al agente en Rappi (hasta antes de pagar)")
        clear(); say("activa el contestador de llamadas", 1200)
        check(any(x.startswith("contestador True") or x.startswith("contestador true") for x in logs()) and "Contestador activo" in last(), "contestador de llamadas por mensaje")
        check("filtro silenciar" in logs(), "y silencia las llamadas de números desconocidos")
        say("¿tengo Gemini Nano?", 900)
        check("Gemini Nano listo" in last(), "«¿tengo Gemini Nano?»")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.30)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
