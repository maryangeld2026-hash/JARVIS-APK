"""Prueba de punta a punta de la 3.18: Jarvis ve tu pantalla, reuniones (grabar → transcribir → acta → recordatorios), memoria de largo
plazo (con mensajes y privacidad), compras y trámites, llenar formularios, subtítulos en vivo, reloj y audífonos."""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []

def gem(route):
    r = route.request; u = r.url
    if "/models?" in u:
        return route.fulfill(json={"models": [{"name": "models/gemini-3.5-flash-lite", "supportedGenerationMethods": ["generateContent"]}]})
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    s = json.dumps(body, ensure_ascii=False)
    ASKED.append(s)
    meta = None
    if "audio/aac" in s:
        txt = "[00:00] Persona 1: Revisamos el presupuesto. Ana enviará el informe el 15 de enero."
    elif "Haz el acta" in s:
        txt = json.dumps({"titulo": "Presupuesto 2027", "resumen": "Se revisó el presupuesto del próximo año.", "temas": ["Presupuesto"], "acuerdos": ["Subir el 5 %"],
                          "tareas": [{"tarea": "Enviar el informe", "responsable": "Ana", "fecha": "2027-01-15", "hora": "09:00"}], "pendientes": []})
    elif "image/jpeg" in s and "pantalla" in s:
        txt = "Estás en los ajustes de Wi-Fi. Toca «Redes guardadas» para ver tus redes."
    elif "Respóndeme usando SOLO estos recuerdos" in s:
        txt = "Carlos te dijo que te manda el contrato del apartamento para firmarlo [1]."
    elif "palabras clave parecidas" in s:
        txt = json.dumps({"palabras": ["arriendo", "firmar"]})
    elif "tiendas de Colombia" in s:
        txt = "| Tienda | Producto exacto | Precio (COP) |\n|---|---|---|\n| Alkosto | TV 55\" 4K | $1.899.900 |\n| Éxito | TV 55\" 4K | $2.099.900 |\n\nConviene Alkosto por precio."
        meta = {"groundingChunks": [{"web": {"uri": "https://www.alkosto.com/tv-55", "title": "alkosto.com"}}, {"web": {"uri": "https://www.exito.com/tv", "title": "exito.com"}}]}
    elif "Explícame el trámite" in s:
        txt = "1) Se hace en la Cancillería…"
        meta = {"groundingChunks": [{"web": {"uri": "https://www.cancilleria.gov.co/tramites_servicios/pasaportes", "title": "cancilleria.gov.co"}}]}
    else:
        txt = "Hola, señor."
    cand = {"content": {"parts": [{"text": txt}]}}
    if meta: cand["groundingMetadata"] = meta
    if ":streamGenerateContent" in u:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse(txt))
    return route.fulfill(json={"candidates": [cand]})

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
const ahora = Date.now(), DIA = 864e5;
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => log('noti ' + o.notifications[0].body), cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80, ahorro: false, sinRestriccion: false }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
window.__gr = { grabando: false, pausado: false, segundos: 0, id: '', pendiente: '' };
window.__subOk = false;
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), minimizar: async () => log('minimizar'), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {} },
  Oido: { addListener: on, disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), detener: async () => {}, cancelar: async () => {}, escuchar: async () => ({ texto: '' }) },
  Telefono: { addListener: on, checkPermissions: async () => ({}), contactos: async () => ({ lista: [] }), controlActivo: async () => ({ activo: true }), abrirAccesibilidad: async () => log('accesibilidad'),
    pantalla: async (o) => ({ activo: true, app: 'Ajustes', texto: 'Wi-Fi\\nRedes guardadas', t: ahora, conFoto: true, img: o && o.imagen ? '/9j/AAAA' : undefined, imgT: ahora }),
    pantallaFoto: async (o) => log('pantallaFoto ' + o.on),
    agenteUi: async () => ({ pkg: 'com.android.chrome', nodos: [{ i: 0, t: 'Nombres' }, { i: 1, t: '[Tu nombre]', e: 1 }, { i: 2, t: '[Correo electrónico]', e: 1 }, { i: 3, t: '[Contraseña]', e: 1, p: 1 }, { i: 4, t: 'Enviar', c: 1 }] }),
    agenteAccion: async (o) => { log('accion ' + o.accion + ' ' + o.i + ' ' + (o.texto || '')); return { ok: true }; } },
  Grabadora: {
    iniciar: async (o) => { log('grabar'); Object.assign(window.__gr, { grabando: true, segundos: 65, id: o.id }); return { id: o.id }; },
    estado: async () => Object.assign({}, window.__gr),
    pausar: async () => { window.__gr.pausado = true; log('pausa'); }, seguir: async () => { window.__gr.pausado = false; },
    detener: async () => { log('detener'); const r = { id: window.__gr.id, segundos: 1920 }; Object.assign(window.__gr, { grabando: false, pendiente: window.__gr.id }); return r; },
    partes: async () => ({ lista: [{ ruta: '/files/reuniones/x/parte_1.aac', mb: 2.3 }, { ruta: '/files/reuniones/x/parte_2.aac', mb: 1.1 }], segundos: 1920 }),
    leer: async (o) => { log('leer ' + o.ruta); return { data: 'QUFD' }; }, listo: async () => { log('listo'); window.__gr.pendiente = ''; }, borrar: async () => log('borrar-audio') },
  Mensajes: { addListener: on, config: async (o) => log('msgs ' + JSON.stringify(o)), recientes: async () => ({ lista: [] }), activo: async () => ({ activo: true }), banco: async () => ({ lista: [] }), activas: async () => ({ lista: [] }),
    archivo: async () => ({ activo: true, lista: [
      { a: 'WhatsApp', d: 'Carlos Pérez', x: 'Te mando el contrato del apartamento mañana para firmarlo', t: ahora - 14 * DIA },
      { a: 'WhatsApp', d: 'Mamá', x: 'Pedro Gómez sacó 2.0 en el contrato de matemáticas', t: ahora - 14 * DIA },
      { a: 'WhatsApp', d: 'Ana', x: 'Nos vemos el viernes', t: ahora - 2 * DIA } ] }), borrarArchivo: async () => log('borrar-archivo') },
  Subtitulos: { iniciar: async (o) => { if (!window.__subOk) { const e = new Error('overlay'); e.code = 'overlay'; throw e; } log('subs ' + o.de + '>' + o.a); }, detener: async () => log('subs-off'), estado: async () => ({ activo: false }) },
  Burbuja: { addListener: on, pedirPermiso: async () => log('permiso-overlay'), estado: async (o) => { if (o && o.texto) log('burbuja ' + o.texto); }, permitido: async () => ({ permitido: true }) },
  Reloj: { addListener: on, activar: async (o) => log('reloj ' + o.on), responder: async (o) => log('reloj-resp ' + o.texto), estado: async () => ({ audifonos: false, pendiente: '' }) },
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'IALocal' || n === 'Traductor' || n === 'Musica' ? undefined : generic) }) };
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
        pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: false, v316: 1, vozJarvis316: 1 } }))""")
        pg.reload(); pg.wait_for_timeout(1800)
        say = lambda t, w=900: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        btn = lambda t: pg.locator(".msg.jarvis .doc-acts button", has_text=t).last
        # 1) pantalla
        say("mira mi pantalla", 1500)
        check("Redes guardadas" in last() and any("image/jpeg" in x and "/9j/AAAA" in x for x in ASKED), "mira mi pantalla: manda la foto de la pantalla a la IA y explica")
        check(btn("Volver a Ajustes").count() == 1, "botón para volver a la app")
        n0 = len(ASKED)
        say("¿qué significa este error?", 1500)
        check(len(ASKED) > n0 and "image/jpeg" in ASKED[-1], "recién llamado desde otra app: «este error» usa la pantalla")
        # 2) reuniones
        say("graba la reunión", 1500)
        check("grabar" in logs() and pg.is_visible("#reu18-sh") and pg.inner_text("#reu18-t") == "01:05", "graba la reunión (con la hoja y el tiempo)")
        pg.click("#reu18-pausa"); pg.wait_for_timeout(300)
        check("pausa" in logs(), "pausa la grabación")
        pg.click("#reu18-fin"); pg.wait_for_timeout(3500)
        check("detener" in logs() and sum(1 for x in logs() if x.startswith("leer ")) == 2 and sum(1 for x in ASKED if "audio/aac" in x) == 2, "transcribe las dos partes con Gemini")
        check("Presupuesto 2027" in last() and "Acuerdos" in last() and "Enviar el informe — Ana" in last() and "listo" in logs(), "hace el acta con acuerdos y tareas")
        r0 = pg.evaluate("JD.load().recordatorios.length")
        btn("Crear 1 recordatorio").click(); pg.wait_for_timeout(900)
        check(pg.evaluate("JD.load().recordatorios.length") == r0 + 1 and any("informe" in x["texto"] for x in pg.evaluate("JD.load().recordatorios")), "crea el recordatorio de la tarea")
        check(pg.evaluate("JD.load().docs.some(d => d.tipo === 'acta')"), "el acta queda en Material")
        # 3) memoria con privacidad
        pg.evaluate("const d = JD.load(); d.ajustes.docente = true; d.cursos.push({ id: 'c1', nombre: '7A', estudiantes: ['Pedro Gómez'] })")
        n0 = len(ASKED)
        say("¿Qué me dijo Carlos del contrato hace dos semanas?", 2000)
        check("Carlos te dijo" in last() and "WhatsApp · Carlos Pérez" in last(), "memoria: busca en tus mensajes y cita la fuente")
        check(not any("Pedro Gómez" in x for x in ASKED[n0:]), "memoria: los nombres de estudiantes no van a la IA")
        pg.evaluate("JD.load().ajustes.docente = false")
        # 4) compras y trámites
        say("compara precios de un televisor de 55 pulgadas", 1500)
        check("Alkosto" in last() and "Fuentes" in last() and "no compro" in last(), "compara precios con fuentes (y nunca compra)")
        btn("Abrir Alkosto").click(); pg.wait_for_timeout(200)
        check("url https://www.alkosto.com/tv-55" in logs(), "abre la tienda más barata")
        say("¿Cómo saco el pasaporte?", 1500)
        check("Cancillería" in last() and btn("Página oficial").count() == 1, "trámites: requisitos con la página oficial")
        # 5) formularios
        say("llena este formulario", 600)
        check("Mis datos para formularios" in last(), "sin datos guardados: pide guardarlos en Ajustes")
        pg.evaluate("JD.load().perfil = { nombre: 'Juan', email: 'juan@correo.co' }")
        n0 = len(ASKED)
        say("llena este formulario con mis datos", 3000)
        lg = logs()
        check("minimizar" in lg and "accion escribir 1 Juan" in lg and "accion escribir 2 juan@correo.co" in lg and not any(x.startswith("accion escribir 3") for x in lg), "llena nombre y correo, nunca la contraseña")
        check(not any(x.startswith("accion tocar") for x in lg) and not any("juan@correo.co" in x for x in ASKED[n0:]), "no envía el formulario y tus datos no van a la IA")
        check(any(x.startswith("noti ✍️ Llené 2 campos") for x in lg), "avisa lo que llenó")
        # 6) subtítulos
        say("pon subtítulos del inglés", 700)
        check("Mostrar sobre otras apps" in last(), "subtítulos: pide el permiso de mostrar sobre otras apps")
        btn("Dar el permiso").click(); pg.wait_for_timeout(200)
        check("permiso-overlay" in logs(), "abre el permiso")
        pg.evaluate("window.__subOk = true")
        say("pon subtítulos del inglés", 1200)
        check("subs en-US>es" in logs() and "Subtítulos en vivo" in last(), "subtítulos en vivo del inglés al español")
        say("quita los subtítulos", 500)
        check("subs-off" in logs(), "quita los subtítulos")
        # 7) reloj y audífonos
        say("activa Jarvis en el reloj", 500)
        check("reloj true" in logs() and "Preguntar" in last(), "Jarvis en el reloj")
        pg.evaluate("window.__fire('pregunta', { texto: '¿qué hora es?' })"); pg.wait_for_timeout(1200)
        check(any(x.startswith("reloj-resp Son las") for x in logs()), "pregunta desde el reloj → la respuesta llega al reloj")
        pg.evaluate("window.__fire('audifonos', { audifonos: true, nombre: 'Buds' })"); pg.wait_for_timeout(300)
        check(pg.evaluate("JD.load().ajustes.voz") is True, "con audífonos: todo en voz")
        say("hola, ¿cómo estás?", 1500)
        check("escucha por audífonos" in ASKED[-1], "con audífonos: respuestas cortas para el oído")
        pg.evaluate("window.__fire('audifonos', { audifonos: false })"); pg.wait_for_timeout(200)
        check(pg.evaluate("JD.load().ajustes.voz") is False, "al quitarlos, la voz vuelve como estaba")
        # ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(500); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-318").count() == 1 and pg.locator("#aj-perfil input").count() == 11, "Ajustes: pantalla, memoria, mis datos, subtítulos, reloj")
        check(pg.evaluate("JSON.stringify(JD.backup ? JD.backup() : {})").find("juan@correo.co") < 0, "la copia de seguridad no lleva tus datos personales")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.18)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
