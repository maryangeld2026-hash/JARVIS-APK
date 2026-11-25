"""Prueba de punta a punta de la 3.36: la pantalla más ordenada sin perder nada (panel compacto, «Callar» solo al hablar,
configuración primero, 4 sugerencias, modo experto en la barra, botones de respuesta con «⋯ Más», catálogo con buscador,
Ajustes con los respaldos juntos y botones de buen tamaño)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e, e2e335 as T
from playwright.sync_api import sync_playwright

A = {"proveedor": "gemini", "claves": {"gemini": "AIzaX"}, "seguir": False, "voz": False, "v316": 1, "vozJarvis316": 1, "bienvenida": True, "buscarAuto": False, "nombre": "Mary"}

def main():
    srv = e2e.serve(); base = f"http://127.0.0.1:{srv.server_address[1]}/index.html"
    fails = []
    def check(c, w):
        print(("✓ " if c else "✗ ") + w)
        if not c: fails.append(w)
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--no-sandbox"])
        errs = []
        def nuevo(aj, w=390, h=844):
            ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=True, has_touch=True, locale="es-CO")
            ctx.add_init_script(e2e.FAKE_VOICE); ctx.add_init_script(T.NATIVE); ctx.route("https://generativelanguage.googleapis.com/**", T.gem)
            pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.goto(base); pg.wait_for_timeout(300)
            pg.evaluate(f"localStorage.setItem('jarvis.android.v1', JSON.stringify({{ ajustes: {json.dumps(aj)} }}))")
            pg.reload(); pg.wait_for_timeout(3500); return pg
        caja = lambda pg, sel: pg.evaluate(f"(() => {{ const r = document.querySelector({json.dumps(sel)}).getBoundingClientRect(); return [r.width, r.height, r.top, r.left]; }})()")
        # 1) primera vez: la configuración va antes de los ejemplos
        pg = nuevo({})
        orden = pg.evaluate("[...document.querySelector('#chat .empty').children].map(e => e.className)")
        check("bienv" in orden and orden.index("bienv") < orden.index("sug"), "primera vez: «Configuremos a Jarvis» antes de los ejemplos " + str(orden))
        # 2) inicio: 4 sugerencias + «¿Qué puedes hacer?», sin repetirlas arriba
        pg = nuevo(A)
        sug = pg.evaluate("[...document.querySelectorAll('#chat .empty .sug .chip')].map(c => c.textContent)")
        check(len(sug) == 5 and sug[-1] == "¿Qué puedes hacer?" and "Activa el modo docente" not in sug, "inicio: 4 sugerencias y «¿Qué puedes hacer?» " + str(sug))
        check(not pg.is_visible(".hoy-chips"), "las sugerencias ya no salen repetidas arriba")
        check(pg.get_attribute("#in-texto", "placeholder") == "Escribe aquí…", "el campo dice «Escribe aquí…» (no se corta)")
        # 3) panel compacto: [Seguir] micrófono [En vivo]; «Callar» solo cuando Jarvis piensa o habla
        dock = caja(pg, ".dock")
        check(dock[1] <= 150, f"panel del micrófono más bajo: {dock[1]:.0f} px (antes ~200)")
        check(pg.evaluate("!!document.querySelector('.dock-izq #btn-conv') && !!document.querySelector('.dock-der #btn-live') && !!document.querySelector('.dock-der #btn-callar')"), "Seguir a la izquierda; En vivo y Callar a la derecha")
        check(not pg.is_visible("#btn-callar") and pg.is_visible("#btn-live"), "sin hablar: no se ve «Callar»; se ve «En vivo»")
        pg.evaluate("window.__jarvis.setState('speaking')"); pg.wait_for_timeout(150)
        check(pg.is_visible("#btn-callar") and not pg.is_visible("#btn-live"), "hablando: aparece «Callar» en el mismo lugar")
        pg.click("#btn-callar"); pg.evaluate("window.__jarvis.setState('idle')"); pg.wait_for_timeout(150)
        mic = caja(pg, "#btn-mic"); pg.evaluate("window.__jarvis.setState('listening')"); pg.wait_for_timeout(300)
        mic2 = pg.evaluate("document.querySelector('#btn-mic').getBoundingClientRect().width")
        check(mic2 > mic[0] * 1.1, f"escuchando, el micrófono crece ({mic[0]:.0f} → {mic2:.0f} px)")
        pg.evaluate("window.__jarvis.setState('idle')")
        # 4) tamaños para el dedo
        tam = pg.evaluate("[...document.querySelectorAll('.top .icon-btn, .convbar .conv-b, #btn-mic, #btn-conv, #btn-live, #f-escribir .icon-btn')].filter(e => e.offsetParent).map(e => Math.round(Math.min(e.getBoundingClientRect().width, e.getBoundingClientRect().height)))")
        check(tam and min(tam) >= 40, f"botones de 40 px o más: {tam}")
        chips = pg.evaluate("[...document.querySelectorAll('#chat .chip')].map(e => e.getBoundingClientRect().height)")
        check(chips and min(chips) >= 40, "los ejemplos miden 40 px o más")
        # 5) conversación: el reloj se esconde; el modo experto queda en la barra, sin tapar nada
        say = lambda t, w=1500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        say("modo abogado", 800)
        check(not pg.is_visible(".hoy-top"), "con conversación, el reloj de arriba se esconde")
        check(pg.evaluate("!!document.querySelector('#convbar #modo-exp')") and pg.is_visible("#modo-exp"), "el modo experto va en la barra de la conversación")
        r1, r2 = caja(pg, "#modo-exp"), caja(pg, ".top")
        check(r1[2] >= r2[2] + r2[1] - 1, "el modo experto ya no se monta sobre otra cosa")
        say("¿me pueden echar sin justa causa?", 2500)
        vis = pg.evaluate("[...document.querySelectorAll('.msg.jarvis:last-of-type .resp-acts > .ra')].map(e => e.title)")
        check(vis == ["Oír", "Copiar", "Compartir", "Más opciones"], "bajo la respuesta: Oír, Copiar, Compartir y «⋯ Más» " + str(vis))
        check(not pg.is_visible(".msg.jarvis:last-of-type .ra[title=WhatsApp]"), "lo demás queda guardado en «⋯ Más»")
        pg.click(".msg.jarvis:last-of-type .ra[title='Más opciones']"); pg.wait_for_timeout(200)
        mas = pg.evaluate("[...document.querySelectorAll('.msg.jarvis:last-of-type .ra-mas .ra')].filter(e => e.offsetParent).map(e => e.title)")
        check({"Más corto", "WhatsApp", "Word", "Proyectar"} <= set(mas), "«⋯ Más» muestra Más corto, WhatsApp, Word y Proyectar " + str(mas))
        pg.click(".msg.jarvis:last-of-type .ra[title=Compartir]"); pg.wait_for_timeout(200)
        say("modo normal", 800)
        check(pg.locator("#modo-exp").count() == 0, "al salir del modo, se quita de la barra")
        # 6) «Lo que puedo hacer»: secciones plegables y buscador
        say("¿qué puedes hacer?", 1200)
        secs = pg.locator("#cat-sh details.cat-sec").count()
        check(secs >= 10 and pg.locator("#cat-sh details.cat-sec[open]").count() == 0, f"catálogo en {secs} secciones plegables")
        pg.fill("#cat-sh .cat-buscar", "arroz"); pg.wait_for_timeout(200)
        vis = pg.evaluate("[...document.querySelectorAll('#cat-sh .chip')].filter(c => c.offsetParent).map(c => c.textContent)")
        check("Pon 10 minutos para el arroz" in vis and all("arroz" in v.lower() for v in vis) and len(vis) < 5, "el buscador encuentra el ejemplo " + str(vis))
        pg.click("#cat-sh >> text=Pon 10 minutos para el arroz"); pg.wait_for_timeout(500)
        check(not pg.is_visible("#cat-sh") and pg.evaluate("(JD.load().timers || []).some(t => t.nombre === 'arroz')"), "tocar el ejemplo lo hace")
        say("¿qué puedes hacer?", 1000); pg.fill("#cat-sh .cat-buscar", "zzzz"); pg.wait_for_timeout(150)
        check(pg.is_visible("#cat-sh .cat-nada"), "si no lo encuentra, lo dice")
        pg.locator("#cat-sh .icon-btn").first.click(); pg.wait_for_timeout(300)
        # 7) Ajustes: los tres respaldos en uno, sin el tema «Más» de un solo grupo, y «Listo»
        pg.click("#btn-ajustes"); pg.wait_for_timeout(900)
        tit = pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo summary')].map(s => s.textContent)")
        check("Si la IA principal falla (respaldo)" in tit and not any(t.startswith(("Respaldo gratis", "Segunda IA en la nube", "IA de respaldo")) for t in tit), "los tres respaldos quedan en «Si la IA principal falla»")
        check(len([t for t in tit if t == "Memoria"]) == 1, "los grupos repetidos («Memoria») quedan en uno")
        g = pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].find(d => d.querySelector('summary').textContent.startsWith('Si la IA principal'))")
        subs = pg.evaluate("[...[...document.querySelectorAll('#ajustes details.aj-grupo')].find(d => d.querySelector('summary').textContent.startsWith('Si la IA principal')).querySelectorAll('h4.aj-sub')].map(h => h.textContent)")
        check(len(subs) == 3 and pg.evaluate("!!document.querySelector('#a-respaldo') && !!document.querySelector('.pm-ds input') && !!document.querySelector('#aj-332 input, .aj-grupo input[placeholder*=Groq], .aj-grupo input')"), "dentro: gratis en la nube, tu respaldo con la IA del celular, y DeepSeek " + str(subs))
        temas = pg.evaluate("[...document.querySelectorAll('.aj-tema')].map(x => x.dataset.tema)")
        check("mas" not in temas and "celular" in temas, "ya no está el tema «Más» con un solo ajuste " + str(temas))
        check(pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo summary')].filter(s => s.dataset.ic === '⚙️').length") <= 2, "casi todos los grupos tienen su propio ícono")
        check(pg.inner_text("#btn-guardar-aj").strip() == "Listo", "el botón de abajo dice «Listo» (todo se guarda solo)")
        pg.click(".aj-tema[data-tema=ia]"); pg.wait_for_timeout(300)
        pg.evaluate("[...document.querySelectorAll('#ajustes details.aj-grupo')].find(d => d.querySelector('summary').textContent.startsWith('Si la IA principal')).open = true")
        pg.wait_for_timeout(200); pg.screenshot(path="/tmp/jarvis336-respaldo.png")
        pg.click("#btn-guardar-aj"); pg.wait_for_timeout(300)
        check(not pg.is_visible("#ajustes"), "«Listo» cierra los Ajustes")
        # 8) celular pequeño: el saludo y las sugerencias se ven completos
        pg = nuevo(A, 360, 640)
        e = caja(pg, "#chat .empty"); d = caja(pg, ".dock")
        check(e[2] > 0 and e[2] + e[1] <= d[2] + 2, f"celular pequeño: el inicio cabe completo sobre el panel ({e[2] + e[1]:.0f} ≤ {d[2]:.0f})")
        # 9) modo docente: en clase siguen las sugerencias de la clase y «Proyectar» a la vista
        pg = nuevo(dict(A, docente=True))
        check(pg.is_visible("nav.tabs") and pg.evaluate("document.querySelector('.dock').getBoundingClientRect().bottom") <= pg.evaluate("document.querySelector('nav.tabs').getBoundingClientRect().top") + 1, "modo docente: el panel no tapa las pestañas")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.36)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
