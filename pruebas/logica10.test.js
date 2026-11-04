// Pruebas de la lógica 3.11
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica10.js");

test("agente que maneja tus apps", () => {
  assert.deepEqual(L.agenteIntent("pídeme un Uber a la casa"), { agente: "app", app: "Uber", meta: "pideme un uber a la casa" });
  assert.equal(L.agenteIntent("busca en Mercado Libre audífonos baratos").app, "Mercado Libre");
  assert.equal(L.agenteIntent("pon en Spotify música para estudiar").app, "Spotify");
  assert.equal(L.agenteIntent("hazlo tú en Rappi: pide lo de siempre").app, "Rappi");
  assert.equal(L.agenteIntent("transfiere 50 mil en Nequi a Carolina").agente, "banco");
  assert.equal(L.agenteIntent("pon 5 minutos"), null);
  assert.equal(L.agenteIntent("¿cómo está el clima?"), null);
  assert.equal(L.riesgo("Confirmar pedido"), true); assert.equal(L.riesgo("Pagar $45.900"), true); assert.equal(L.riesgo("Solicitar UberX"), true); assert.equal(L.riesgo("Buscar"), false); assert.equal(L.riesgo("¿A dónde vas?"), false);
  const nodos = [{ i: 0, t: "¿A dónde vas?", c: 1, e: 1 }, { i: 1, t: "Confirmar UberX", c: 1 }, { i: 2, t: "(contraseña)", e: 1, p: 1 }];
  assert.match(L.uiTexto(nodos), /\[0\] ¿A dónde vas\? ·toca ·escribe\n\[1\] Confirmar UberX ·toca\n\[2\] \(contraseña\) ·escribe ·CONTRASEÑA/);
  assert.deepEqual(L.accionOk({ accion: "escribir", i: 0, texto: "Casa" }, nodos).accion, "escribir");
  assert.equal(L.accionOk({ accion: "tocar", i: 1 }, nodos).alto, true);
  assert.match(L.accionOk({ accion: "escribir", i: 2, texto: "1234" }, nodos).error, /contraseña/);
  assert.match(L.accionOk({ accion: "tocar", i: 9 }, nodos).error, /no está/);
  assert.match(L.agentePrompt("pide un uber", "Uber", "[0] x", ["toqué buscar"]), /1\. toqué buscar/);
});

test("actuar sobre la pantalla, visión, sugerencias", () => {
  assert.deepEqual(L.verAccionIntent("agéndalo"), { ver: "agenda" });
  assert.deepEqual(L.verAccionIntent("agrégalo a la lista"), { ver: "lista" });
  assert.deepEqual(L.verAccionIntent("¿esto es estafa?"), { ver: "estafa" });
  assert.deepEqual(L.telefonos("Llámanos al 300 123 4567 o al (601) 555 1234"), ["3001234567", "6015551234"]);
  assert.deepEqual(L.visionIntent("mira esto"), { vision: true });
  const d = (dd, h, m) => new Date(2026, 10, dd, h, m).getTime();
  const log = [2, 3, 4, 5].map((dd) => ({ k: "clima", texto: "¿cómo está el clima?", t: d(dd, 6, 40 + dd) }));
  const p = L.patrones(log, d(6, 6, 50));
  assert.equal(p.length, 1); assert.equal(p[0].k, "clima"); assert.equal(p[0].dias, 4);
  assert.equal(L.patrones(log, d(6, 15, 0)).length, 0, "a otra hora no sugiere");
  assert.equal(L.patrones(log.concat([{ k: "clima", texto: "x", t: d(6, 6, 30) }]), d(6, 6, 50)).length, 0, "si ya lo pediste hoy, no");
  assert.equal(L.patrones(log, d(8, 6, 50)).length, 0, "es de entre semana: el domingo no");
});

test("estafas", () => {
  const a = L.estafa("BANCOLOMBIA: Su cuenta será bloqueada en las próximas 24 horas. Verifique sus datos en bit.ly/x2aB");
  assert.equal(a.nivel, "alto"); assert.ok(a.por.some((x) => /bloqueada/.test(x)) && a.por.some((x) => /acortado/.test(x)));
  assert.equal(L.estafa("Hola ma, soy tu hijo, cambié de número, préstame 200 mil por Nequi").nivel, "alto");
  assert.equal(L.estafa("¡Felicitaciones! Ganaste un premio, reclama tu bono aquí https://premio.co").nivel, "alto");
  assert.equal(L.estafa("Nos vemos mañana a las 3 en la reunión").nivel, "ninguno");
  assert.equal(L.estafa("Te comparto el link de la reunión https://meet.google.com/abc").nivel, "bajo");
});

test("respuestas automáticas y llamadas", () => {
  const now = new Date(2026, 10, 3, 14, 0).getTime();
  const a = L.autoIntent("responde que estoy manejando por una hora", now);
  assert.equal(a.auto, "on"); assert.equal(a.hasta, now + 3600e3); assert.match(a.texto, /^Estoy manejando\. Te escribo apenas pueda/);
  assert.equal(new Date(L.autoIntent("responde que estoy en clase hasta las 4", now).hasta).getHours(), 16);
  assert.deepEqual(L.autoIntent("quita las respuestas automáticas"), { auto: "off" });
  assert.equal(L.autoIntent("responde que sí"), null);
  assert.deepEqual(L.llamadasIntent("silencia las llamadas de desconocidos"), { llamadas: "silenciar" });
  assert.deepEqual(L.llamadasIntent("bloquea el número 300 555 1234"), { llamadas: "negra", numero: "3005551234" });
  assert.deepEqual(L.llamadasIntent("quita el filtro de llamadas"), { llamadas: "off" });
});

test("fotos y línea de tiempo", () => {
  assert.deepEqual(L.fotosIntent("busca la foto de la cédula"), { fotos: "buscar", q: "cedula" });
  assert.deepEqual(L.fotosIntent("dónde está la foto del recibo de la nevera"), { fotos: "buscar", q: "recibo de la nevera" });
  assert.deepEqual(L.terminos("fotos de mi perro en la playa"), ["perro", "playa", "dog", "beach"]);
  assert.ok(L.terminos("cédula").includes("republica"));
  const now = new Date(2026, 10, 4, 10).getTime();                 // miércoles 4 de noviembre
  const r = L.tiempoIntent("¿qué hice el martes pasado?", now);
  assert.equal(new Date(r.desde).getDate(), 3); assert.equal(r.hasta - r.desde, 864e5);
  assert.equal(new Date(L.tiempoIntent("qué hice ayer", now).desde).getDate(), 3);
  assert.equal(new Date(L.tiempoIntent("qué hice el miércoles", now).desde).getDate(), 28);
  assert.equal(new Date(L.tiempoIntent("qué hice el 1 de noviembre", now).desde).getDate(), 1);
  assert.equal(new Date(L.tiempoIntent("qué hice la semana pasada", now).desde).getDate(), 26);
  const t = new Date(2026, 10, 3, 12).getTime();
  const ev = L.linea({ gastos: [{ t, monto: 25000, desc: "almuerzo", tipo: "gasto" }], bitacora: [{ t: t + 1, texto: "buen día" }], habitos: { "hacer ejercicio": [t - 3600e3] }, chat: [{ role: "user", content: "pon 5 minutos ya", t: t + 2 }] }, r.desde, r.hasta);
  assert.deepEqual(ev.map((e) => e.ic), ["✅", "💸", "📔", "💬"]); assert.match(ev[1].txt, /\$25\.000/);
});

test("dictado, widgets, presentaciones", () => {
  assert.deepEqual(L.dictadoIntent("pule este mensaje para mi jefe: eh este o sea mañana no puedo ir pues tengo cita"), { pulir: "texto", texto: "eh este o sea mañana no puedo ir pues tengo cita", para: "mi jefe" });
  assert.deepEqual(L.dictadoIntent("díctame un mensaje para Carolina"), { pulir: "dictar", tipo: "mensaje", para: "carolina" });
  assert.equal(L.sinMuletillas("eh este o sea mañana no no puedo ir pues tengo cita"), "Mañana no puedo ir tengo cita.");
  assert.deepEqual(L.widgetIntent("crea un widget con mis pagos del mes"), { widget: "pagos", que: "pagos del mes" });
  assert.equal(L.widgetIntent("hazme un widget de la lista del mercado").widget, "lista");
  assert.deepEqual(L.presentacionIntent("hazme una presentación de fracciones de 6 diapositivas"), { ppt: true, tema: "fracciones", n: 6, para: "" });
  assert.equal(L.presentacionIntent("crea una presentación sobre el cambio climático para mis estudiantes").para, "mis estudiantes");
  const c = L.cleanPpt({ titulo: "Fracciones", diapositivas: [{ titulo: "Qué es", puntos: ["a", "b"], notas: "n" }] }, 6);
  assert.equal(c.diapositivas.length, 1); assert.match(L.cleanPpt({}).error, /No pude/);
});
