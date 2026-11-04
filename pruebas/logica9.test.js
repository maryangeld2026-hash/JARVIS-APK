// Pruebas de la lógica 3.10
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica9.js");

test("carro y encontrar el celular", () => {
  assert.deepEqual(L.carroIntent("¿dónde dejé el carro?"), { carro: "ver" });
  assert.deepEqual(L.carroIntent("guarda dónde parqueé"), { carro: "guardar" });
  assert.deepEqual(L.carroIntent("mi carro es el bluetooth Mazda"), { carro: "bt", nombre: "mazda" });
  assert.deepEqual(L.carroIntent("activa encontrar mi celular con la clave girasol"), { buscar: "on", clave: "girasol" });
  assert.match(L.caminar(4.6, -74.08), /destination=4\.600000,-74\.080000&travelmode=walking/);
  assert.equal(L.haceCuanto(Date.now() - 25 * 60000), "hace 25 minutos");
  assert.equal(L.metros(L.distancia({ lat: 4.6, lng: -74.08 }, { lat: 4.601, lng: -74.08 })), "110 m");
});

test("pagos y suscripciones", () => {
  assert.deepEqual(L.pagoIntent("la luz se paga el 15"), { pago: "add", nombre: "luz", dia: 15, monto: null });
  assert.deepEqual(L.pagoIntent("Netflix cada mes el 3 por 45 mil"), { pago: "add", nombre: "netflix", dia: 3, monto: 45000 });
  assert.deepEqual(L.pagoIntent("el arriendo se paga el 1 de cada mes y cuesta 1 millón"), { pago: "add", nombre: "arriendo", dia: 1, monto: 1000000 });
  assert.deepEqual(L.pagoIntent("ya pagué la luz"), { pago: "pagado", nombre: "luz" });
  assert.equal(L.pagoIntent("mis pagos").pago, "ver");
  assert.equal(L.pagoIntent("cuánto pago al mes en suscripciones").pago, "ver");
  assert.equal(L.pagoIntent("borra el pago de netflix").nombre, "netflix");
  assert.equal(L.pagoIntent("pagué 120.000 de luz"), null);
  const now = new Date(2026, 10, 10).getTime();
  const e = L.pagosEstado([{ nombre: "luz", dia: 15 }, { nombre: "agua", dia: 5, pagos: [new Date(2026, 10, 4).getTime()] }, { nombre: "gas", dia: 5 }], now);
  assert.deepEqual(e.map((x) => [x.nombre, x.en, x.pagado]), [["gas", -5, false], ["luz", 5, false], ["agua", 25, true]]);
  assert.deepEqual(L.pagosAvisos([{ nombre: "luz", dia: 15 }, { nombre: "x", dia: 1 }]).map((a) => a.dia), [15, 13, 1]);
});

test("rutina de la noche y modo cocina", () => {
  assert.deepEqual(L.nocheIntent("buenas noches"), { noche: true, alarma: null });
  assert.deepEqual(L.nocheIntent("buenas noches, despiértame a las 5 y media"), { noche: true, alarma: { h: 5, m: 30 } });
  assert.equal(L.nocheIntent("buenas noches a todos los estudiantes"), null);
  assert.deepEqual(L.cocinaIntent("cocinemos arroz con pollo para 4 personas"), { cocina: true, plato: "arroz con pollo", porciones: 4 });
  assert.deepEqual(L.cocinaIntent("modo cocina"), { cocina: true, plato: "", porciones: null });
  assert.equal(L.cocinaIntent("receta de arepas"), null);
  assert.equal(L.cocinaIntent("receta de arepas paso a paso").plato, "arepas");
  assert.equal(L.cocinaCmd("siguiente"), "siguiente"); assert.equal(L.cocinaCmd("repite"), "repite"); assert.equal(L.cocinaCmd("ya terminé"), "terminar"); assert.equal(L.cocinaCmd("pon 5 minutos"), null);
  assert.equal(L.minutosDe("Hornea 25 minutos a 180 grados"), 25); assert.equal(L.minutosDe("cocina por una hora"), 60); assert.equal(L.minutosDe("revuelve"), null);
  const r = L.recetaClean({ titulo: "Arroz", ingredientes: ["2 tazas de arroz", { cantidad: "1", nombre: "cebolla" }], pasos: [{ texto: "Sofríe la cebolla", minutos: null }, "Cocina 20 minutos tapado"] });
  assert.deepEqual(r.ingredientes, ["2 tazas de arroz", "1 cebolla"]); assert.deepEqual(r.pasos.map((p) => p.min), [null, 20]);
});

test("pantalla, Gmail, diario, idiomas", () => {
  assert.deepEqual(L.pantallaIntent("¿qué dice esta pantalla?"), { pantalla: "resumen" });
  assert.deepEqual(L.pantallaIntent("explícame esto"), { pantalla: "explicar" });
  assert.deepEqual(L.pantallaIntent("ayúdame a responder este mensaje"), { pantalla: "responder" });
  assert.equal(L.limpiarPantalla("Hola\nHola\n10:45\nAtrás\nEl contrato vence el 30"), "Hola\nEl contrato vence el 30");
  assert.deepEqual(L.gmailIntent("¿tengo correos nuevos?"), { gmail: "ver" });
  assert.deepEqual(L.gmailIntent("resume mis correos de hoy"), { gmail: "resumen", cuando: "de hoy" });
  assert.deepEqual(L.gmailIntent("léeme el correo de Carolina"), { gmail: "leer", de: "carolina" });
  assert.deepEqual(L.gmailIntent("respóndele al correo de Carolina que sí, nos vemos el lunes"), { gmail: "responder", de: "carolina", texto: "sí, nos vemos el lunes" });
  const msg = { threadId: "t1", snippet: "hola", payload: { headers: [{ name: "From", value: '"Carolina Ruiz" <caro@x.co>' }, { name: "Subject", value: "Reunión" }, { name: "Message-ID", value: "<a1@x>" }], mimeType: "multipart/alternative",
    parts: [{ mimeType: "text/plain", body: { data: L.b64url("¿Nos vemos el lunes? ñandú") } }] } };
  assert.equal(L.quien(L.cabecera(msg, "from")), "Carolina Ruiz");
  assert.equal(L.cuerpo(msg), "¿Nos vemos el lunes? ñandú");
  const rr = L.respuesta(msg, "Sí, claro.");
  const raw = L.deB64url(rr.raw);
  assert.equal(rr.threadId, "t1"); assert.match(raw, /^To: "Carolina Ruiz" <caro@x\.co>\r\nSubject: Re: Reunión|^To: "Carolina Ruiz" <caro@x\.co>\r\nSubject: =\?UTF-8\?B\?/); assert.match(raw, /In-Reply-To: <a1@x>/); assert.match(raw, /\r\n\r\nSí, claro\.$/);
  assert.deepEqual(L.diarioIntent("querido diario, hoy fue un día muy productivo"), { diario: "add", texto: "hoy fue un día muy productivo" });
  assert.equal(L.diarioIntent("hoy fue un día pesado en el trabajo").diario, "add");
  assert.deepEqual(L.diarioIntent("cómo he estado esta semana"), { diario: "ver", dias: 7 });
  assert.equal(L.animo("estuve feliz y tranquila, logré terminar"), 5);
  assert.equal(L.animo("me sentí triste y cansada"), 1);
  assert.equal(L.animo("no estuvo tan bien"), 2);
  assert.equal(L.animo("fui al mercado"), 3);
  const ar = L.animoResumen([{ t: Date.now(), animo: 4 }, { t: Date.now(), animo: 2 }, { t: Date.now() - 30 * 864e5, animo: 1 }], Date.now(), 7);
  assert.deepEqual([ar.n, ar.prom, ar.buenos, ar.feos], [2, 3, 1, 1]);
  assert.deepEqual(L.idiomaIntent("practiquemos inglés"), { idioma: "ingles", nombre: "inglés", nivel: "" });
  assert.match(L.tutorPrompt("francés", "básico"), /profesor de francés.*nivel básico/);
});

test("conversor", () => {
  assert.deepEqual(L.conversorIntent("¿cuánto son 50 dólares?"), { conv: "moneda", n: 50, de: "USD", a: "COP" });
  assert.deepEqual(L.conversorIntent("100 euros a pesos"), { conv: "moneda", n: 100, de: "EUR", a: "COP" });
  assert.deepEqual(L.conversorIntent("cuánto son 200 mil pesos en dólares"), { conv: "moneda", n: 200000, de: "COP", a: "USD" });
  assert.deepEqual(L.conversorIntent("convierte 5 millas a km"), { conv: "unidad", n: 5, de: "millas", a: "km" });
  assert.equal(L.redondo(L.convertir(5, "millas", "km")), "8,05");
  assert.equal(L.redondo(L.convertir(100, "fahrenheit", "celsius")), "37,8");
  assert.equal(L.convertir(2, "libras", "kilos"), 1);
  assert.equal(L.conversorIntent("5 libras a litros"), null);
  assert.deepEqual(L.conversorIntent("qué hora es en Madrid"), { conv: "hora", lugar: "madrid" });
  assert.equal(L.zona("Nueva York"), "America/New_York");
  const h = L.horaEn("Asia/Tokyo", Date.UTC(2026, 10, 3, 12));
  assert.equal(h.dif, 14); assert.match(h.texto, /martes, 9:00/);
});

test("casa inteligente y reporte", () => {
  assert.deepEqual(L.casaIntent("prende la luz de la sala"), { casa: "on", obj: "luz de la sala", verbo: "prende" });
  assert.equal(L.casaIntent("apaga la linterna"), null);
  assert.equal(L.casaIntent("activa el modo ahorro"), null);
  assert.equal(L.casaIntent("está prendida la luz de la cocina").casa, "estado");
  const est = [{ entity_id: "light.sala", attributes: { friendly_name: "Sala" } }, { entity_id: "light.cocina", attributes: { friendly_name: "Luz cocina" } }, { entity_id: "switch.ventilador", attributes: { friendly_name: "Ventilador cuarto" } }, { entity_id: "sensor.t", attributes: { friendly_name: "Sala temperatura" } }];
  assert.equal(L.entidad(est, "luz de la sala").entity_id, "light.sala");
  assert.equal(L.entidad(est, "ventilador").entity_id, "switch.ventilador");
  assert.equal(L.entidad(est, "televisor"), null);
  assert.deepEqual(L.servicio({ entity_id: "cover.garaje" }, "on"), ["cover", "open_cover"]);
  assert.equal(L.limpiar("Error con caro@x.co clave AIzaSyABCDEFGHIJKLMN tel 300 123 4567 de Pablo Mora", ["Pablo Mora"]), "Error con ‹correo› clave ‹clave› tel ‹número› de ‹nombre›");
  assert.match(L.reporte({ version: "3.10", fecha: "x", ua: "Android", proveedor: "gemini", errores: [{ t: 0, m: "falló" }] }), /Jarvis 3\.10[\s\S]*- \d\d-\d\d \d\d:\d\d:\d\d falló/);
});
