"""Prueba de punta a punta de la 3.9: gastos (y avisos del banco), listas, medicamentos, hábitos, pausas, cumpleaños,
disparadores, modo conducción (responder hablando), «¿qué me perdí?», recibo y tarjeta con la cámara, leer en voz alta,
preguntarle a tus notas, intérprete, noticias, emergencia, temporizadores con nombre y planeador semanal."""
import os, sys, json, base64
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import e2e
from playwright.sync_api import sync_playwright

ASKED = []
RSS = """<rss><channel><item><title>Sube el dólar en Colombia - El Tiempo</title><link>https://n.co/1</link><source url="x">El Tiempo</source></item>
<item><title>Nuevo metro de Bogotá avanza - Semana</title><link>https://n.co/2</link><source url="y">Semana</source></item>
<item><title>Lluvias en el país - Caracol</title><link>https://n.co/3</link><source url="z">Caracol</source></item></channel></rss>"""
PAGINA = "<html><title>La historia del café</title><body><nav><p>menú del sitio que no se debe leer jamás nunca</p></nav><article><h1>La historia del café</h1><p>El café llegó a Colombia en el siglo XVIII y se volvió el producto más famoso del país.</p><p>Hoy se cultiva en muchas regiones de las montañas andinas.</p></article></body></html>"

def gem(route):
    r = route.request; u = r.url
    body = json.loads(r.post_data or "{}") if r.post_data else {}
    t = json.dumps(body, ensure_ascii=False)
    if ":streamGenerateContent" in u or ":generateContent" in u:
        ASKED.append(t)
    if "recibo, factura" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps({"total": 45900, "comercio": "Éxito", "categoria": "mercado", "fecha": ""})}]}}]})
    if "tarjeta de presentación" in t:
        return route.fulfill(json={"candidates": [{"content": {"parts": [{"text": json.dumps({"nombre": "Laura Gómez", "telefono": "+57 300 555 1234", "email": "laura@x.co", "empresa": "Acme", "cargo": "Gerente"})}]}}]})
    if "Fragmentos:" in t:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("La salida pedagógica es el viernes 20 (Acta de reunión de área)."))
    if "planeación de mi semana" in t:
        return route.fulfill(status=200, headers={"content-type": "text/event-stream"}, body=e2e.sse("| Día | Curso | Tema |\n|---|---|---|\n| lunes | 7A | Fracciones |"))
    return e2e.gemini(route)

NATIVE = """
window.__log = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__fire = (n, d) => (lst[n] || []).forEach((f) => f(d));
window.__oir = [];
const generic = { addListener: on, speak: async (o) => { window.__said.push(o.text); await new Promise(r => setTimeout(r, 20)); }, stop: async () => {}, modelo: async () => ({}), estado: async () => {},
  checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async (o) => { o.notifications.forEach((n) => log('noti ' + n.id + ' ' + n.title + ' ' + JSON.stringify(n.schedule))); }, cancel: async () => {}, registerActionTypes: async (o) => log('tipos ' + o.types.map(t => t.id).join(',')),
  keepAwake: async () => {}, allowSleep: async () => {}, writeFile: async (o) => ({ uri: 'file:///x' }), share: async (o) => log('compartir'), getSupportedVoices: async () => ({ voices: [] }), config: async () => {}, bateriaEstado: async () => ({ nivel: 80, ahorro: false, sinRestriccion: false }) };
const P = {
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Ventana: { addListener: on, pendientes: async () => ({ lista: [] }), abrir: async (o) => log('url ' + o.url), textZoom: async () => {}, widget: async () => {}, silencio: async () => {}, temporizador: async () => {}, quitarTemporizador: async () => {}, verificar: async () => ({ ok: true }) },
  Oido: { disponible: async () => ({ disponible: true }), permiso: async () => ({ ok: true }), addListener: on, escuchar: async () => { await new Promise(r => setTimeout(r, 60)); const t = window.__oir.shift(); if (t === undefined) await new Promise(r => setTimeout(r, 300)); return { texto: t || '' }; }, detener: async () => {}, cancelar: async () => {}, vigilar: async () => ({ ok: false }), dejarDeVigilar: async () => {} },
  Lugares: { aqui: async (o) => { log('aqui ' + JSON.stringify(o)); return { lat: 4.65, lng: -74.06, precision: 12 }; }, programar: async (o) => log('geocerca ' + o.id + ' ' + o.texto + ' ' + o.salir), quitar: async (o) => log('quitar ' + o.id), fondoActivo: async () => ({ ok: true }) },
  Telefono: { checkPermissions: async () => ({ contactos: 'granted' }), contactos: async (o) => ({ lista: [{ nombre: 'Carolina Ruiz', numero: '3001112233' }] }),
    cumpleanos: async () => ({ lista: [{ nombre: 'Carolina Ruiz', fecha: '--' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0') }] }),
    nuevoContacto: async (o) => log('contacto ' + o.nombre + ' ' + o.telefono), llamar: async (o) => log('llamar ' + o.numero), sms: async (o) => { log('sms ' + o.numero + ' ' + o.texto); return { enviado: true }; },
    apps: async () => ({ lista: [] }), abrirApp: async () => {}, linterna: async (o) => log('linterna ' + o.on), volumen: async (o) => log('volumen'), alarma: async (o) => log('alarma'), controlActivo: async () => ({ activo: false }) },
  Mensajes: { addListener: on, activo: async () => ({ activo: true }), permiso: async () => {}, config: async (o) => log('mensajes ' + JSON.stringify(o)),
    recientes: async () => ({ lista: [] }), responder: async (o) => { log('responder ' + o.clave + ' ' + o.texto); return { ok: true }; },
    activas: async () => ({ lista: [{ app: 'WhatsApp', titulo: 'Mamá', texto: 'hola' }, { app: 'WhatsApp', titulo: 'Carolina Ruiz', texto: '¿vienes?' }, { app: 'Gmail', titulo: 'Banco', texto: 'extracto' }] }),
    banco: async () => ({ lista: [{ clave: 'b1', app: 'Bancolombia', texto: 'Bancolombia: Compraste $32.500,00 en RAPPI con tu T.Cred *1234', t: Date.now() - 1000 }] }) },
  Disparadores: { guardar: async (o) => log('disparadores ' + JSON.stringify(o.reglas)), permisoBluetooth: async () => ({ ok: true }), bluetooth: async () => ({ lista: ['Mazda CX-30', 'Galaxy Buds'] }) },
  CapacitorHttp: { request: async (o) => { log('http ' + o.url); if (/news\\.google/.test(o.url)) return { status: 200, data: window.__RSS }; return { status: 200, data: window.__PAGINA }; } },
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
        ctx.add_init_script("window.__RSS = " + json.dumps(RSS) + "; window.__PAGINA = " + json.dumps(PAGINA) + ";")
        ctx.route("https://generativelanguage.googleapis.com/**", gem)
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(300)
        dia = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
        pg.evaluate("window.JD ? JD.save(true) : 0"); pg.evaluate("""localStorage.setItem('jarvis.android.v1', JSON.stringify({ ajustes: { claves: { gemini: 'AIzaX' }, seguir: false, voz: true, nombre: 'María', horario: 'lunes 7:00-7:55 7A\\nmiércoles 8:00-8:55 8B',
          confianza: 'Mamá: 3009998877' }, cursos: [{ id: 'c1', nombre: '7A', estudiantes: ['Pablo Mora', 'Ana Rojas'] }, { id: 'c2', nombre: '8B', estudiantes: ['Beto Díaz'] }],
          docs: [{ id: 'd1', titulo: 'Acta reunión de área', md: 'Acordamos la salida pedagógica para el viernes 20. Marta trae los permisos.', fecha: Date.now() - 864e5, tipo: 'acta' }, { id: 'd2', titulo: 'Nota: Pablo Mora', md: 'Pablo Mora debe la salida pedagógica', fecha: Date.now(), tipo: 'nota' }],
          lugares: { casa: { nombre: 'casa', lat: 4.7, lng: -74.05 } } }))""")
        pg.reload(); pg.wait_for_timeout(4200)
        say = lambda t, w=500: (pg.fill("#in-texto", t), pg.press("#in-texto", "Enter"), pg.wait_for_timeout(w))
        last = lambda: pg.evaluate("LASTJ()")
        logs = lambda: pg.evaluate("window.__log")
        msgs = lambda n: pg.evaluate(f"[...document.querySelectorAll('.msg.jarvis')].slice(-{n}).map(e => e.textContent)")
        # gastos
        check(any(g["desc"] == "RAPPI" and g["monto"] == 32500 and g.get("auto") for g in pg.evaluate("JD.load().gastos")) is False, "sin activar, no lee los avisos del banco")
        say("gasté 25 mil en almuerzo"); check("$25.000" in last() and "comida" in last(), "anota un gasto por voz")
        say("pon un presupuesto de 30 mil para comida"); say("gasté 4 mil en un tinto")
        check("93 %" in last() or "Ojo" in last(), "aviso del presupuesto al 80 %: " + last()[:90])
        say("pagué 120.000 de luz"); say("cuánto llevo este mes")
        check("$149.000" in last() and "servicios" in last(), "resumen del mes por categorías")
        pg.evaluate("JD.load().ajustes.gastosAuto = true"); pg.evaluate("window.JX._vida.revisarBanco()"); pg.wait_for_timeout(300)
        check(any(g["desc"] == "RAPPI" and g["monto"] == 32500 and g.get("auto") for g in pg.evaluate("JD.load().gastos")), "anota el aviso del banco (Rappi $32.500)")
        # listas
        say("agrega leche, huevos y pan a la lista"); say("ya compré leche"); say("qué me falta comprar")
        check("huevos" in last() and "pan" in last() and "leche" not in last(), "lista del mercado: agregar, tachar, ver")
        say("muéstrame la lista de 7A", 600); check("mercado" not in last().lower(), "«la lista de 7A» no es la del mercado")
        # medicamentos, hábitos, pausas
        say("recuérdame tomar la pastilla de la presión a las 8 y a las 8 de la noche")
        check("8:00 a. m. y 8:00 p. m." in last() and any('"hour":20' in x and "pastilla" in x for x in logs()) and any("jarvis_med" in x for x in logs()), "medicamento con aviso diario y botones")
        say("ya hice ejercicio"); check("Hacer ejercicio" in last(), "hábito marcado")
        say("mis rachas"); check("hacer ejercicio" in last() and "pastilla" in last(), "rachas de hábitos y tomas")
        say("pausas activas cada hora de 8 a 5"); check("lunes a viernes" in last() and any("Pausa activa" in x for x in logs()), "pausas activas programadas")
        # cumpleaños
        say("quién cumple años hoy", 900)
        check("Carolina Ruiz" in pg.inner_text("#chat") and pg.locator(".msg.jarvis:last-of-type .chip").count() == 3, "cumpleaños de los contactos y felicitación lista")
        say("el cumpleaños de Ana es el 5 de marzo"); check("5 de marzo" in last(), "cumpleaños anotado a mano")
        # disparadores
        say("cuando conecte el carro, modo conducción", 800)
        check("Mazda CX-30" in pg.inner_text("#chat"), "disparador Bluetooth: ofrece escoger el carro")
        pg.click(".msg.jarvis:last-of-type >> text=Mazda CX-30"); pg.wait_for_timeout(300)
        check(any('"dispositivo":"Mazda CX-30"' in x and "modo conduccion" in x for x in logs()), "disparador Bluetooth guardado en Android")
        say("al poner a cargar el celular, activa el modo ahorro"); check(any('"tipo":"carga_on"' in x for x in logs()), "disparador del cargador")
        say("cuando llegue a la casa, silencia el celular y pon 5 minutos")
        check(any(x.startswith("geocerca disp-") and "automatico" in x for x in logs()) and pg.evaluate("JD.load().misHab.length") == 1, "disparador por lugar con varias cosas (habilidad automática)")
        pg.evaluate("window.__fire('entrada', {})")
        # modo conducción
        say("modo conducción", 600); check("Modo conducción" in last() and any('"conduccion":true' in x for x in logs()), "modo conducción encendido")
        pg.evaluate("window.__oir.push('dile que voy en camino', 'sí')")
        pg.evaluate("window.__fire('llego', { clave: 'k9', app: 'WhatsApp', de: 'Carolina Ruiz', texto: '¿Ya vienes?', t: Date.now(), puedeResponder: true })")
        pg.wait_for_timeout(4500)
        check(any("Mensaje de Carolina Ruiz" in x for x in pg.evaluate("window.__said")), "modo conducción: te lee el mensaje")
        check("responder k9 voy en camino" in logs(), "modo conducción: respondes hablando (y confirmas)")
        say("ya llegué"); check("apagado" in last(), "modo conducción apagado")
        # qué me perdí
        say("qué me perdí", 600); check("Tienes 3 notificaciones" in last() and "WhatsApp 2" in last(), "«¿qué me perdí?»")
        # cámara inteligente
        img = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "www", "icon.png")
        if not os.path.exists(img):
            from PIL import Image; img = "/tmp/claude-0/recibo.png"; Image.new("RGB", (60, 80), "white").save(img)
        pg.set_input_files("#cam-recibo-in", img); pg.wait_for_timeout(1500)
        check("$45.900" in last() and "Éxito" in last(), "foto de un recibo: lee total y comercio")
        pg.click(".msg.jarvis:last-of-type >> text=✅ Anotar"); pg.wait_for_timeout(300)
        check(any(g["monto"] == 45900 for g in pg.evaluate("JD.load().gastos")), "el recibo queda anotado como gasto")
        pg.set_input_files("#cam-tarjeta-in", img); pg.wait_for_timeout(1500)
        pg.click(".msg.jarvis:last-of-type >> text=Guardar en contactos"); pg.wait_for_timeout(300)
        check("contacto Laura Gómez +57 300 555 1234" in logs(), "tarjeta de presentación → nuevo contacto")
        # leer en voz alta
        n0 = len(pg.evaluate("window.__said"))
        say("léeme este artículo https://cafe.co/historia", 2500)
        said = " ".join(pg.evaluate("window.__said")[n0:])
        check("siglo XVIII" in said and "menú" not in said, "lee en voz alta una página (sin menús)")
        # notas
        say("según mis notas, cuándo es la salida pedagógica", 1500)
        sent = ASKED[-1] if ASKED else ""
        check("viernes 20" in last() and "Acta reunión" in sent and "Pablo Mora" not in sent, "pregúntale a tus notas (sin nombres de estudiantes)")
        # noticias
        say("dame las noticias", 900); check("Sube el dólar" in last() and "El Tiempo" in last(), "noticias (sin clave)")
        # emergencia
        say("emergencia", 600); check("Emergencia" in last() and pg.locator(".msg.jarvis:last-of-type .chip").count() == 3, "emergencia: ofrece enviar ubicación o llamar al 123")
        say("sí", 800)
        check(any(x.startswith("sms 3009998877 🚨 María necesita ayuda. Ubicación: https://maps.google.com/?q=4.650000,-74.060000") for x in logs()), "emergencia: envía la ubicación por SMS")
        # temporizadores con nombre
        say("pon 10 minutos para el arroz"); say("pon 25 minutos para el horno")
        check(pg.evaluate("JD.load().timers.length") == 2 and any("¡Listo: arroz!" in x for x in logs()), "dos temporizadores con nombre (con aviso de Android)")
        say("cuánto le falta al arroz"); check("arroz le faltan 9 min" in last() or "arroz le faltan 10 min" in last(), "cuánto le falta al arroz")
        pg.evaluate("JD.load().timers[0].fin = Date.now() - 10"); pg.wait_for_timeout(1500)
        check(any("Se acabó el tiempo de arroz" in x for x in msgs(3)), "suena el del arroz")
        say("cancela el del horno"); check(pg.evaluate("JD.load().timers.length") == 0, "cancelar el del horno")
        # planeador semanal
        say("planea mi semana de clases sobre fracciones", 2000)
        sent = ASKED[-1] if ASKED else ""
        check("lunes: 7A (55 minutos)" in sent and "miércoles: 8B" in sent and pg.evaluate("JD.load().docs[0].tipo") == "semana", "planeador semanal con el horario (guardado en Material)")
        # resumen de la mañana
        say("resumen de la mañana", 1500)
        check("cumple años Carolina" in last() and "Noticias" in last() and "gastos" in last(), "resumen de la mañana con cumpleaños, gastos y noticias")
        # ajustes
        pg.click("#btn-ajustes"); pg.wait_for_timeout(250); pg.evaluate("document.querySelectorAll('#ajustes details').forEach(d => d.open = true)"); pg.wait_for_timeout(300)
        check(pg.locator("#aj-vida").count() == 1 and "Mazda" in pg.inner_text("#aj-vida") and "pastilla" in pg.inner_text("#aj-vida"), "Ajustes › Vida diaria")
        pg.click("#btn-ajustes-cerrar")
        check(not errs, "sin errores de JavaScript " + str(errs[:3]))
        b.close()
    srv.shutdown()
    print("\nTodo bien (3.9)." if not fails else f"\nFALLÓ: {fails}")
    sys.exit(1 if fails else 0)

if __name__ == "__main__":
    main()
