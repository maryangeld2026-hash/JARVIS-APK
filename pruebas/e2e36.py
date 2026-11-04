"""Prueba de punta a punta de la 3.6: control del celular, dictado, notas de voz, banco, versiones, práctica con QR,
informes, copia, lugares, resumen de la mañana, modo bolsillo e interrumpir (celular simulado)."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
window.__oir = [];
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 60)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => log('agenda ' + o.notifications[0].title), cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, writeFile: async (o) => { log('archivo ' + (o.directory || '') + ' ' + o.path); return { uri: 'file:///x' }; }, share: async () => {}, getSupportedVoices: async () => ({ voices: [] }), libs: async () => {} };
const P = {
  Telefono: { contactos: async () => ({ lista: [{ nombre: 'Mamá', numero: '300 111 2233' }, { nombre: 'Juan Pérez', numero: '+57 300 123 4567' }] }), llamar: async (o) => { log('llamar ' + o.numero); return { directo: true }; },
    sms: async (o) => { log('sms ' + o.numero + ' ' + o.texto); return { enviado: true }; }, apps: async () => ({ lista: [{ nombre: 'WhatsApp', paquete: 'com.whatsapp' }, { nombre: 'YouTube', paquete: 'com.google.android.youtube' }] }),
    abrirApp: async (o) => log('abrir ' + o.paquete), cerrarApp: async (o) => log('cerrar ' + o.paquete), linterna: async (o) => log('linterna ' + o.on), volumen: async (o) => { log('volumen ' + o.accion); return { nivel: 9, max: 15 }; },
    alarma: async (o) => log(`alarma ${o.hora}:${o.minuto}`), global: async (o) => (o.accion === 'inicio' ? (log('inicio'), {}) : { necesitaPermiso: true }), ip: async () => ({ ip: '192.168.1.50' }), controlActivo: async () => ({ activo: false }), abrirAccesibilidad: async () => {} },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Aula: { addListener: on, iniciar: async (o) => { window.__pagina = o.pagina; window.__clave = o.clave; return { puerto: 8777 }; }, detener: async () => log('aula fuera') },
  Lugares: { aqui: async () => ({ lat: 4.6, lng: -74.08 }), programar: async (o) => log('lugar ' + o.texto + ' ' + (o.salir ? 'salir' : 'llegar')), fondoActivo: async () => ({ activo: true }), permisoFondo: async () => {} },
  Oido: { disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), addListener: on, escuchar: async () => { await new Promise(r => setTimeout(r, 80)); return { texto: window.__oir.shift() || '' }; },
    detener: async () => {}, cancelar: async () => {}, vigilar: async () => { log('vigilar'); return { ok: true }; }, dejarDeVigilar: async () => log('dejar') },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' ? undefined : generic) }) };
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
        pg.goto(base); pg.wait_for_timeout(1200); pg.evaluate("JD.load().ajustes.docente = true; JD.save(); document.body.classList.remove('sin-docente')")
        pg.evaluate("""(() => { const d = JD.load(); d.ajustes.seguir = false; d.ajustes.voz = true;
          d.cursos.push({ id: 'c1', nombre: '7A', estudiantes: ['Ana Rojas', 'Beto Díaz', 'Pablo Mora'] }); d.cursoActual = 'c1';
          const q = (id, t, ps) => ({ id, fecha: Date.now(), tema: t, quiz: { titulo: t, preguntas: ps.map((e, i) => ({ enunciado: e, opciones: ['a', 'b', 'c', 'd'], correcta: i % 4, explicacion: 'x' })) } });
          d.quices = [q('q1', 'fracciones', ['1/2 + 1/2', '2/4', '3/6', '1/3 de 9']), q('q2', 'potencias', ['2^3', '3^2'])]; JD.save(true); })()""")
        pg.reload(); pg.wait_for_timeout(1400)
        say = lambda t: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(450))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        # llamar, con confirmación
        say("llama a mi mamá")
        check("¿Llamo a Mamá" in last() and not any(x.startswith("llamar") for x in logs()), "llamar: pregunta antes")
        say("sí")
        check("llamar 300 111 2233" in logs(), "llamar: llama al decir «sí»")
        # WhatsApp a un contacto
        say("mándale un whatsapp a Juan diciendo que llego tarde")
        pg.click(".msg.jarvis:last-of-type .chip.on"); pg.wait_for_timeout(300)
        check(any("wa.me/573001234567?text=llego%20tarde" in x for x in logs()), "WhatsApp: abre el chat de Juan con el mensaje listo")
        say("manda un mensaje a Juan que ya salí"); say("no")
        check(not any(x.startswith("sms") for x in logs()) and "no lo hago" in last(), "SMS: con «no» no lo envía")
        # apps, linterna, volumen, alarma, botones del sistema
        say("abre wasap"); check("abrir com.whatsapp" in logs(), "abrir una app (WhatsApp)")
        say("cierra YouTube"); check("cerrar com.google.android.youtube" in logs() and "segundo plano" in last(), "cerrar una app (y explica el límite de Android)")
        say("prende la linterna"); check("linterna True" in logs() or "linterna true" in logs(), "linterna")
        say("sube el volumen"); check("volumen subir" in logs() and "60 %" in last(), "volumen")
        say("pon una alarma a las 6 y 15 de la mañana"); check("alarma 6:15" in logs(), "alarma")
        say("ve al inicio"); check("inicio" in logs(), "ir al inicio")
        say("atrás"); check("Accesibilidad" in last(), "«atrás» pide activar el control en Accesibilidad")
        say("¿cómo llego a la Universidad Nacional?"); check(any(x.startswith("url geo:") for x in logs()), "mapas")
        # dictado
        pg.evaluate("window.__oir.push('hola coma qué tal punto', 'nueva línea segunda frase', 'fin del dictado')")
        say("modo dictado"); pg.wait_for_timeout(1500)
        d = pg.evaluate("(JD.load().docs.find(x => x.tipo === 'dictado') || {}).md")
        check(d == "Hola, qué tal.\nSegunda frase", "dictado con puntuación: " + json.dumps(d))
        # nota de voz
        say("nota de voz: Pablo Mora no trajo la tarea")
        check("observador de Pablo Mora" in last() and pg.evaluate("JD.load().observador['Pablo Mora'].length") == 1, "nota de voz al observador")
        say("toma nota: comprar marcadores"); check("Material" in last(), "nota de voz general a Material")
        # banco y versiones
        say("ármame un quiz de 3 preguntas del banco de fracciones")
        check(pg.evaluate("JD.load().quices[0].quiz.preguntas.length") == 3 and "banco" in last(), "quiz del banco (sin IA)")
        say("qué hay en el banco"); check("Banco de preguntas: 6" in last(), "ver el banco")
        n0 = pg.evaluate("JD.load().quices.length")
        say("hazme las versiones A, B, C y D del quiz"); pg.wait_for_timeout(1500)
        hs = pg.evaluate("(() => { const q = JD.load().quices.slice(0, 4); return q.map(x => JL4.quizHash(x.id)); })()")
        check(pg.evaluate("JD.load().quices.length") == n0 + 3 and len(set(hs)) == 4, f"versiones A–D, cada una con su código de hoja {hs}")
        # práctica con QR
        pg.evaluate("window.__jarvis.setQuiz(JD.load().quices.find(q => q.id === 'q1'))")
        say("abre una práctica con QR"); pg.wait_for_timeout(600)
        check(pg.is_visible("#prac-sh") and pg.locator("#prac-sh .prac-qr svg").count() == 1 and "http://192.168.1.50:8777/" in pg.inner_text("#prac-sh"), "práctica: QR con la dirección del wifi")
        check("correcta" not in pg.evaluate("window.__pagina") and pg.evaluate("window.__clave") == [0, 1, 2, 3], "la página de los estudiantes no trae la clave")
        pg.evaluate("window.__fire('respuesta', { nombre: 'pablo mora', resp: [0, 1, 0, 0], aciertos: 2, total: 4 }); window.__fire('respuesta', { nombre: 'Ana', resp: [0, 1, 2, 3], aciertos: 4, total: 4 })")
        pg.wait_for_timeout(200)
        check("2 respuestas" in pg.inner_text("#prac-cnt"), "llegan las respuestas en vivo")
        pg.screenshot(path="/tmp/claude-0/e2e36-practica.png")
        pg.click("#prac-sh >> text=Terminar y ver resultados"); pg.wait_for_timeout(300)
        check("promedio" in last(), "resultados de la práctica")
        pg.click(".msg.jarvis:last-of-type >> text=Pasar al seguimiento"); pg.wait_for_timeout(200)
        check("Pasé 2 notas" in last(), "práctica al seguimiento (con nombres parecidos)")
        # informe, copia, lugares
        say("informe del periodo de Pablo Mora"); pg.wait_for_timeout(1500)
        check(any("informe-periodo-pablo-mora.pdf" in x for x in logs()), "informe del periodo en PDF")
        say("haz una copia de seguridad"); check(any(x.startswith("archivo DOCUMENTS Jarvis/copia-jarvis-") for x in logs()), "copia en Documentos › Jarvis")
        say("cuando llegue al colegio recuérdame imprimir las guías"); check("guarda este lugar" in last(), "lugar sin guardar: explica cómo")
        say("guarda este lugar como colegio"); say("cuando llegue al colegio recuérdame imprimir las guías")
        check("lugar imprimir las guías llegar" in logs(), "recordatorio por lugar")
        # resumen de la mañana, bolsillo, interrumpir
        pg.evaluate("JD.load().ajustes.horario = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][new Date().getDay()] + ' 7:00-8:00 7A'")
        say("resumen de la mañana"); check(("Buenos días" in last() or "Buenas" in last()) and "7A" in last(), "resumen de la mañana")
        say("modo bolsillo"); check(pg.evaluate("JD.load().ajustes.bolsillo && JD.load().ajustes.interrumpir"), "modo bolsillo")
        pg.evaluate("window.__jarvis.say('Esta es una respuesta larga que se puede interrumpir. Sigue y sigue y sigue.')"); pg.wait_for_timeout(100)
        check("vigilar" in logs(), "mientras habla, vigila si lo interrumpes")
        pg.evaluate("window.__fire('interrumpir', { palabra: 'basta' })"); pg.wait_for_timeout(200)
        check("Me callo" in pg.inner_text("#toast"), "«basta» lo calla")
        check(not errs, "sin errores de JavaScript " + str(errs[:2]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.6)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
