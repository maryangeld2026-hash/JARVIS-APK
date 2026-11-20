"""Prueba de punta a punta de la 3.28: Google Maps en las preguntas de lugares, tareas largas en segundo plano (Interactions API),
volumen de Jarvis, agenda privada (escoger el contacto) y «Mi día»."""
import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "nativo328.js")).read()
PED = []; INTER = []

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u: return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}, {"name": "models/gemini-3.8-flash", "supportedGenerationMethods": ["generateContent"]}]})
    if "/interactions" in u:
        if r.method == "POST":
            b = json.loads(r.post_data or "{}"); INTER.append(b)
            if b.get("agent"): return route.fulfill(status=404, json={"error": {"code": 404, "message": "Agent not available for this key"}})
            return route.fulfill(json={"id": "int-42", "status": "in_progress"})
        return route.fulfill(json={"id": "int-42", "status": "completed", "outputs": [{"type": "text", "text": "## Informe\\nLos carros eléctricos crecen 40 % en Colombia."}]})
    body = r.post_data or ""; PED.append(body)
    if '"googleMaps"' in body:
        ev = "data: " + json.dumps({"candidates": [{"content": {"parts": [{"text": "Cerca tienes Crepes & Waffles, abierto hasta las 10, señor."}]}, "groundingMetadata": {"groundingChunks": [{"maps": {"uri": "https://maps.google.com/?cid=123", "title": "Crepes & Waffles", "placeId": "p1"}}]}}]}) + "\r\n\r\n"
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=ev)
    txt = "Tu día: 2 recordatorios. Próximos pasos: llamar a mamá." if "Mi día" in body else "Respuesta normal, señor."
    return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(txt))

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
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { proveedor: 'gemini', claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1, bienvenida: true, buscarAuto: false } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=1800: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        # 1) Google Maps
        say("¿qué restaurantes buenos hay cerca abiertos ahora?", 2500)
        b0 = json.loads(PED[-1])
        check('googleMaps' in json.dumps(b0.get("tools")) and b0.get("toolConfig", {}).get("retrievalConfig", {}).get("latLng", {}).get("latitude") == 4.65, "pregunta de lugares: Gemini con Google Maps y la ubicación aproximada")
        check("Crepes" in last() and "📍 Crepes & Waffles" in last(), "la respuesta muestra el lugar de Maps como fuente")
        say("¿qué es la fotosíntesis?", 1500)
        check('googleMaps' not in PED[-1], "pregunta normal: sin Maps")
        # 2) tareas largas
        say("investiga a fondo los carros eléctricos en Colombia", 2500)
        check(len(INTER) == 2 and INTER[0].get("agent") and INTER[1].get("model") == "gemini-3.8-flash" and INTER[1].get("background") is True, "tarea larga: prueba el agente de investigación y sigue con un modelo en segundo plano " + str([list(x.keys()) for x in INTER]))
        check("vigilar int-42" in logs() and "segundo plano" in pg.inner_text("#chat"), "la tarea queda vigilada (aunque se cierre Jarvis)")
        pg.evaluate("window.__tareas = [{ id: 'int-42', estado: 'completed', texto: '## Informe\\nLos carros eléctricos crecen 40 % en Colombia.', fin: Date.now() }]")
        pg.evaluate("window.JX._tareas.revisar()"); pg.wait_for_timeout(800)
        check("Lista tu investigación" in pg.inner_text("#chat") and "40 %" in pg.inner_text("#chat"), "al terminar, el informe aparece en la conversación")
        say("mis tareas", 900)
        check("Tus tareas largas" in last() and "✅" in last(), "«mis tareas»")
        pg.evaluate("window.__cola.push({ tipo: 'atajo', atajo: 'tarea:int-42' }); window.__emit('entrada', {})"); pg.wait_for_timeout(900)
        check(pg.locator(".msg.jarvis:has-text('Lista tu investigación')").count() >= 2, "tocar la notificación abre el informe")
        # 3) volumen de Jarvis
        say("sube el volumen de Jarvis", 900)
        check("volj subir" in logs() and "propio volumen" in last(), "«sube el volumen de Jarvis» (volumen propio en Android 17)")
        # 4) agenda privada / sin permiso: escoger el contacto
        say("mándale un whatsapp a Ana que ya voy", 1200)
        check("elegir" in logs(), "sin permiso de contactos: Jarvis abre la agenda para escoger a la persona")
        # 5) Mi día
        say("mi día", 2000)
        check("Próximos pasos" in last() and "Mi día" in PED[-1], "«Mi día» con próximos pasos")
        # 6) Ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(600)
        pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        temas = pg.evaluate("[...document.querySelectorAll('#aj-328 details.aj-grupo')].map(d => d.dataset.tema)")
        check(temas == ["ia", "rutinas", "datos", "celular", "voz"], "Ajustes repartidos por temas " + str(temas))
        pg.uncheck("#aj-328 details:nth-of-type(1) input[type=checkbox]"); pg.wait_for_timeout(100)
        check(pg.evaluate("JD.load().ajustes.mapasAuto") is False, "se puede apagar Google Maps")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.28)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
