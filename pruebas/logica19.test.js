// Pruebas de la lógica 3.30 (lo nuevo de los asistentes de 2026, a la manera de Jarvis)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica19.js");
const L0 = require("../www/js/logica.js");

test("1 · Gemini 3.8 Live gana a los modelos viejos de audio nativo", () => {
  const ids = ["gemini-2.5-flash-native-audio-preview-12-2025", "gemini-3.8-live", "gemini-3.8-live-extended-thinking", "gemini-3.5-transcribe-live", "gemini-live-2.5-flash-preview", "gemini-3.1-flash-live-preview"];
  assert.equal(L.rankLive(ids)[0], "gemini-3.8-live");
  assert.equal(L.rankLive(ids, "pensar")[0], "gemini-3.8-live-extended-thinking");
  assert.ok(!L.rankLive(ids).includes("gemini-3.5-transcribe-live"));
  assert.equal(L.rankLive(["gemini-live-2.5-flash-preview", "gemini-2.5-flash-native-audio-preview-12-2025"])[0], "gemini-2.5-flash-native-audio-preview-12-2025");
  assert.equal(L.versionLive("gemini-3.8-live"), 3.8);
  assert.ok(L.liveAsincrono("gemini-3.8-live") && L.liveAsincrono("gemini-2.5-flash-native-audio-preview-12-2025"));
  assert.ok(!L.liveAsincrono("gemini-live-2.5-flash-preview") && !L.liveAsincrono("gemini-2.0-flash-live-001"));
  assert.equal(L.herramientaLive(true).behavior, "NON_BLOCKING");
  assert.equal(L.herramientaLive(false).behavior, undefined);
  assert.deepEqual(L.respuestaLive({ id: "a", name: "jarvis_orden" }, "listo", true), { id: "a", name: "jarvis_orden", response: { resultado: "listo", scheduling: "WHEN_IDLE" } });
});

test("2 · dictado ordenado", () => {
  assert.deepEqual(L.dictadoLargoIntent("dictado ordenado"), { dl: true, tipo: "texto" });
  assert.equal(L.dictadoLargoIntent("voy a dictar"), null);          // el dictado con puntuación de siempre
  assert.equal(L.dictadoLargoIntent("modo dictado"), null);
  assert.deepEqual(L.dictadoLargoIntent("Jarvis, toma dictado de un acta"), { dl: true, tipo: "acta" });
  assert.equal(L.dictadoLargoIntent("dicta mis observaciones").tipo, "observaciones");
  assert.equal(L.dictadoLargoIntent("dictame un mensaje para Ana"), null);    // ese es el dictado pulido de siempre
  assert.equal(L.autocorrecciones("nos vemos el martes, perdón, el miércoles en la sala"), "nos vemos el miércoles en la sala");
  assert.equal(L.autocorrecciones("la reunión es a las 3, digo, a las 4"), "la reunión es a las 4");
  assert.equal(L.comandosVoz("primera idea punto y aparte segunda idea nueva línea tercera"), "primera idea.\n\nsegunda idea\ntercera");
  const o = L.ordenadoLocal("eh bueno pues la reunión es el martes, perdón, el jueves punto y aparte hay que hay que llevar el informe");
  assert.equal(o, "La reunión es el jueves.\n\nHay que llevar el informe.");
  assert.match(L.promptOrdenado("hola", "acta"), /un\/una acta/);
  assert.equal(L.modeloTranscribir(["gemini-3.5-flash", "gemini-3.5-transcribe", "gemini-3.8-live"]), "gemini-3.5-transcribe");
  assert.equal(L.modeloTranscribir(["gemini-3.5-pro", "gemini-3.5-flash-lite", "gemini-3.5-flash"]), "gemini-3.5-flash-lite");
});

test("3 · widget a tu medida", () => {
  const now = new Date(2026, 10, 23, 10).getTime();
  assert.equal(L.fecha("el 15 de diciembre", now), "2026-12-15");
  assert.equal(L.fecha("el 2 de enero", now), "2027-01-02");
  assert.equal(L.fecha("15/12", now), "2026-12-15");
  assert.equal(L.fecha("el viernes", now), "2026-11-27");
  assert.equal(L.fecha("mañana", now), "2026-11-24");
  assert.equal(L.fecha("31 de febrero", now), null);
  assert.equal(L.cuentaTexto("Navidad", "2026-12-25", now), "⏳ Faltan 32 días para Navidad");
  assert.equal(L.cuentaTexto("el paseo", "2026-11-24", now), "⏳ Mañana es el paseo");
  assert.equal(L.cuentaTexto("el paseo", "2026-11-23", now), "🎉 ¡Hoy es el paseo!");
  assert.deepEqual(L.widgetLibreIntent("Jarvis, crea un widget con la cuenta regresiva para vacaciones el 12 de diciembre"), { wl: "la cuenta regresiva para vacaciones el 12 de diciembre" });
  const s = L.widgetLocal("la cuenta regresiva para vacaciones el 12 de diciembre", now);
  assert.deepEqual(s.bloques, [{ cuenta: { etiqueta: "vacaciones", fecha: "2026-12-12" } }]);
  const s2 = L.widgetLocal("mis pagos y mis recordatorios", now);
  assert.deepEqual(s2.bloques.map((b) => b.fuente), ["pagos", "recordatorios"]);
  assert.equal(L.widgetLocal("el clima de Tokio", now), null);
  // lo que diga la IA se revisa: fuera lo desconocido y el código
  const v = L.specValida({ titulo: "<script>alert(1)</script> Mi semana bonita y larguísima", bloques: [{ fuente: "pagos" }, { fuente: "eval" }, { cuenta: { etiqueta: "fin", fecha: "2026-12-01" } }, { texto: "Hola {x}" }, { html: "<b>" }, { fuente: "agenda" }], orden: "mis pagos" });
  assert.equal(v.titulo.includes("<"), false);
  assert.equal(v.titulo.length <= 28, true);
  assert.deepEqual(v.bloques, [{ fuente: "pagos" }, { cuenta: { etiqueta: "fin", fecha: "2026-12-01" } }, { texto: "Hola x" }, { fuente: "agenda" }]);
  assert.equal(L.specValida({ error: "no se puede" }), null);
  const r = L.widgetRender({ titulo: "x", bloques: [{ fuente: "pagos" }, { cuenta: { etiqueta: "fin", fecha: "2026-11-25" } }] }, (k) => k === "pagos" ? "✅ Luz" : "", now);
  assert.equal(r, "Pagos del mes:\n✅ Luz\n\n⏳ Faltan 2 días para fin");
});

test("4 · cuidar el celular", () => {
  assert.deepEqual(L.celularIntent("libera espacio"), { cel: "espacio" });
  assert.deepEqual(L.celularIntent("cuánto espacio me queda"), { cel: "espacio" });
  assert.deepEqual(L.celularIntent("tengo el celular lleno"), { cel: "espacio" });
  assert.deepEqual(L.celularIntent("¿qué apps ven mi ubicación?"), { cel: "permisos", p: "ubicacion" });
  assert.deepEqual(L.celularIntent("qué apps tienen acceso a mi micrófono"), { cel: "permisos", p: "microfono" });
  assert.deepEqual(L.celularIntent("silencia todo menos las llamadas de mi familia"), { cel: "silencio", quien: "favoritos", min: 0, repetidas: false });
  assert.deepEqual(L.celularIntent("no molestar excepto mis contactos por 2 horas"), { cel: "silencio", quien: "contactos", min: 120, repetidas: false });
  assert.equal(L.celularIntent("silencia todo menos el perro"), null);
  const t = L.espacioTexto({ total: 128 * 2 ** 30, libre: 6 * 2 ** 30, jarvis: [{ que: "IA del celular", bytes: 2.6 * 2 ** 30 }, { que: "nada", bytes: 1 }], cache: 0 });
  assert.match(t, /Se está llenando|casi lleno/);
  assert.match(t, /IA del celular: 2,6 GB/);
  assert.ok(!/nada/.test(t));
  assert.match(L.permisosTexto([{ nombre: "Maps", fondo: true }, { nombre: "Uber" }], "ubicacion"), /Siempre.*Maps[\s\S]*mientras las usas.*Uber/);
  assert.match(L.permisosTexto([], "camara"), /Ninguna app/);
});

test("5 · sugerencias desde tus notificaciones", () => {
  const s = L.sugerir({ app: "com.whatsapp", titulo: "Carolina", texto: "Hola profe, la reunión de padres es mañana a las 3 pm en el salón 2" });
  assert.equal(s[0].tipo, "agenda");
  assert.equal(s[0].orden, "recuérdame reunión con Carolina mañana a las 3 pm");
  const p = L0.parseReminder(s[0].orden, new Date(2026, 10, 23, 10));         // la orden la entiende Jarvis
  assert.equal(p.cuando.getDate(), 24); assert.equal(p.cuando.getHours(), 15);
  const d = L.sugerir({ app: "com.whatsapp", titulo: "Andrés", texto: "Te espero en la Calle 45 # 12-30, apto 301" });
  assert.ok(d.some((x) => x.tipo === "lugar" && x.orden === "cómo llego a Calle 45 # 12-30, Colombia"));
  const l = L.sugerir({ app: "com.whatsapp", titulo: "Mamá", texto: "Mija compra leche, huevos y pan por favor" });
  assert.equal(l[0].orden, "agrega leche, huevos y pan a la lista");
  assert.deepEqual(L.sugerir({ app: "com.whatsapp", titulo: "Banco", texto: "Tu código de verificación es 123456, mañana a las 3" }), []);
  assert.deepEqual(L.sugerir({ app: "com.nequi", titulo: "Nequi", texto: "Recibiste plata, cita mañana a las 3" }), []);
  assert.deepEqual(L.sugerir({ app: "x", titulo: "y", texto: "jajaja qué risa" }), []);
  assert.deepEqual(L.sugerenciasIntent("sugerencias de mis mensajes"), { sg: "ver" });
  assert.deepEqual(L.sugerenciasIntent("activa las sugerencias de mis notificaciones"), { sg: "on" });
});

test("6 · buscar en tus cosas", () => {
  assert.deepEqual(L.buscarIntent("busca en mi celular la circular de noviembre"), { bq: "la circular de noviembre" });
  assert.equal(L.buscarIntent("¿dónde guardé la clave del wifi?"), null);      // eso es de la memoria de largo plazo
  assert.equal(L.buscarIntent("busca en todo lo del paseo"), null);
  assert.equal(L.buscarIntent("¿dónde queda la farmacia?"), null);
  const dm = L.deMemoria([{ fuente: "Chat", de: "Tú", texto: "la salida pedagógica es el viernes", t: 1 }, { fuente: "Chat", texto: "ok", t: 2 }, { fuente: "Memoria", texto: "Mi hija se llama Sara y estudia en el Rosario", t: 5 }]);
  assert.equal(dm.length, 2); assert.equal(dm[0].titulo, "Memoria"); assert.equal(dm[1].item.de, "Tú");
  assert.deepEqual(L.buscarIntent("busca la nota sobre la salida pedagógica"), { bq: "la salida pedagogica" });
  assert.equal(L.buscarIntent("busca en google el clima"), null);
  assert.equal(L.hash("hola"), L.hash("hola"));
  assert.notEqual(L.hash("hola"), L.hash("hola."));
  const tr = L.trozos([{ titulo: "Acta", texto: "A".repeat(500) + ".\n\n" + "B".repeat(500) }, { titulo: "Vacía", texto: "" }]);
  assert.equal(tr.length, 2);
  assert.ok(tr.every((x) => x.titulo === "Acta" && x.id));
  assert.equal(L.consultaEmb("hola"), "task: search result | query: hola");
  assert.equal(L.docEmb("Acta", "texto"), "title: Acta | text: texto");
  assert.deepEqual(L.fusionar(["a", "b", "c"], ["c", "d"], 3), ["c", "a", "b"]);
  const lista = [{ id: "1", titulo: "Circular", texto: "La salida pedagógica al museo es el viernes" }, { id: "2", titulo: "Mercado", texto: "Leche y pan" }];
  assert.deepEqual(L.porPalabras(lista, "salidas pedagógicas"), ["1"]);
  assert.deepEqual(L.ajustesSis("la clave del wifi").map((x) => x.titulo), ["Wi-Fi"]);
});

test("pedidos con el agente: hasta antes de pagar", () => {
  assert.deepEqual(L.pedidoIntent("pídeme un domicilio de hamburguesa"), { agente: "app", app: "Rappi", meta: "pideme un domicilio de hamburguesa" });
  assert.equal(L.pedidoIntent("pide almuerzo").app, "Rappi");
  assert.equal(L.pedidoIntent("pide una pizza en DiDi"), null);     // eso ya lo entiende el agente con su app
  assert.equal(L.pedidoIntent("hazme el mercado en el Éxito"), null);
  assert.equal(L.pedidoIntent("haz el mercado en Rappi").app, "Rappi");
  assert.ok(L.riesgoExtra("Buscar conductor") && L.riesgoExtra("Confirmar recogida") && L.riesgoExtra("Pedir UberX") && L.riesgoExtra("Desliza para pagar") && L.riesgoExtra("Ofrecer tarifa"));
  assert.ok(!L.riesgoExtra("Elegir destino") && !L.riesgoExtra("Agregar al carrito"));
});

test("contestador de llamadas y Gemini Nano", () => {
  assert.deepEqual(L.contestadorIntent("activa el contestador de llamadas"), { cont: "on", texto: "" });
  assert.deepEqual(L.contestadorIntent("Activa el contestador que diga: Estoy en clase, te llamo a las 12"), { cont: "on", texto: "Estoy en clase, te llamo a las 12" });
  assert.deepEqual(L.contestadorIntent("quita el contestador"), { cont: "off" });
  assert.match(L.contestadorTexto("Mary"), /asistente de Mary/);
  assert.deepEqual(L.nanoIntent("usa Gemini Nano"), { nano: "usar" });
  const p = L.promptNano("Eres Jarvis.", [{ role: "user", content: "x".repeat(5000) }, { role: "assistant", content: "ok" }, { role: "user", content: "hola" }], 3000);
  assert.ok(p.length <= 3000 && p.endsWith("Persona: hola\nAsistente:"));
});
