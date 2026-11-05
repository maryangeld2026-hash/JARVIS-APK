// Pruebas de la lógica 3.14
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica11.js");

test("preguntar cuando hay dos sentidos", () => {
  assert.equal(L.ambigua("muéstrame la lista", { docente: true }).opciones.length, 2);
  assert.equal(L.ambigua("muéstrame la lista", { docente: false }), null);
  assert.equal(L.ambigua("la lista del mercado", { docente: true }), null);
  assert.equal(L.ambigua("prende la luz", { casa: true }).opciones[0][1], "prende la linterna");
  assert.equal(L.ambigua("prende la luz", { casa: false }), null);
  assert.equal(L.ambigua("cuánto falta", { timer: true, timers: ["arroz"] }).opciones[1][1], "¿cuánto le falta al arroz?");
  assert.equal(L.ambigua("cuánto falta", { timer: true, timers: [] }), null);
  assert.ok(L.ambigua("borra todo"));
});

test("deshacer", () => {
  assert.equal(L.esDeshacer("deshaz eso"), true); assert.equal(L.esDeshacer("no, eso no"), true); assert.equal(L.esDeshacer("deshaz la lista"), false);
  const D = { ajustes: { docente: true, nombre: "Ana" }, gastos: [{ m: 1 }], listas: {} };
  const f = L.foto(D);
  D.gastos.push({ m: 2 }); D.ajustes.docente = false; D.pagos = [{ n: "luz" }];
  const c = L.cambios(f, D);
  assert.deepEqual(c.sort(), ["ajustes.docente", "gastos", "pagos"]);
  L.restaurar(f, D, c);
  assert.deepEqual(D.gastos, [{ m: 1 }]); assert.equal(D.ajustes.docente, true); assert.equal(D.pagos, undefined);
  assert.equal(L.nombreCambio("gastos"), "gastos"); assert.equal(L.nombreCambio("ajustes.docente"), "un ajuste");
});

test("pensar, catálogo, bienvenida", () => {
  assert.deepEqual(L.pensarIntent("piensa bien: si ahorro 200 mil al mes, ¿cuánto tengo en 3 años?"), { pensar: true, q: "si ahorro 200 mil al mes, ¿cuánto tengo en 3 años?" });
  assert.equal(L.pensarIntent("pon 5 minutos"), null);
  const s = L.separarPensar("### Razonamiento\n200 × 36 = 7.200\n### Respuesta\nTendrás 7,2 millones.");
  assert.equal(s.respuesta, "Tendrás 7,2 millones."); assert.match(s.razon, /7\.200/);
  assert.equal(L.separarPensar("Hola").respuesta, "Hola");
  assert.ok(L.CATALOGO.length >= 8 && L.CATALOGO.every(([, l]) => l.length >= 4));
  assert.deepEqual(L.ayudaIntent("¿qué puedes hacer?"), { ayuda: true });
  assert.equal(L.bienvenidaPendiente({ ajustes: { claves: {} }, chat: [] }), true);
  assert.equal(L.bienvenidaPendiente({ ajustes: { claves: { gemini: "x" } }, chat: [] }), false);
  assert.equal(L.bienvenidaPendiente({ ajustes: { bienvenida: true, claves: {} } }), false);
});
