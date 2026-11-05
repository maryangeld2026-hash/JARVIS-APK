// Pruebas de la lógica 3.18
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica13.js");

test("pantalla", () => {
  assert.deepEqual(L.pantallaIntent("mira mi pantalla"), { q: L.PANT_DEF });
  assert.deepEqual(L.pantallaIntent("¿qué ves en mi pantalla?"), { q: L.PANT_DEF });
  assert.deepEqual(L.pantallaIntent("En esta pantalla, ¿dónde cambio la contraseña?"), { q: "¿dónde cambio la contraseña?" });
  assert.equal(L.pantallaIntent("¿qué significa este error?"), null);
  assert.deepEqual(L.pantallaIntent("¿qué significa este error?", true), { q: "¿qué significa este error?" });
  assert.equal(L.pantallaIntent("qué hora es", true), null);
});
test("reuniones", () => {
  for (const t of ["graba la reunión", "Jarvis, graba esta clase", "empieza a grabar", "modo reunión"]) assert.deepEqual(L.reuIntent(t), { re: "grabar" }, t);
  assert.deepEqual(L.reuIntent("termina la grabación"), { re: "parar" });
  assert.deepEqual(L.reuIntent("pausa la grabación"), { re: "pausa" });
  assert.deepEqual(L.reuIntent("resume la última reunión"), { re: "ultima" });
  assert.equal(L.reuIntent("graba una nota de voz"), null);
  const a = L.actaLimpia({ titulo: "Presupuesto", resumen: "Se habló del presupuesto.", acuerdos: ["Subir 5%"], tareas: [{ tarea: "Enviar el informe", responsable: "Ana", fecha: "2026-11-12", hora: "09:00" }, { tarea: "" }] });
  assert.equal(a.tareas.length, 1);
  assert.match(L.actaMd(a, "4 de noviembre", "32 min"), /# Presupuesto[\s\S]*Acuerdos[\s\S]*Enviar el informe — Ana \(12 de noviembre 09:00\)/);
  assert.equal(L.tareaOrden(a.tareas[0], new Date(2026, 10, 4).getTime()), "recuérdame el 12 de noviembre a las 9 de la mañana enviar el informe");
  assert.equal(L.tareaOrden(a.tareas[0], new Date(2026, 10, 20).getTime()), null);
  assert.equal(L.durTexto(3720), "1 h 2 min");
});
test("memoria de largo plazo", () => {
  const ahora = new Date(2026, 10, 4, 20).getTime(), D = 864e5;
  const m = L.memIntent("¿Qué me dijo Carlos del contrato hace dos semanas?", ahora);
  assert.equal(m.persona, "Carlos"); assert.ok(m.ventana && m.ventana.desde < ahora - 10 * D && m.ventana.hasta > ahora - 18 * D);
  assert.equal(L.memIntent("qué hora es"), null);
  assert.ok(L.memIntent("en qué quedamos con el arriendo"));
  const E = [
    { fuente: "WhatsApp", de: "Carlos Pérez", texto: "Te mando el contrato del apartamento mañana para firmarlo", t: ahora - 14 * D },
    { fuente: "WhatsApp", de: "Ana", texto: "El contrato de Ana llega el viernes", t: ahora - 2 * D },
    { fuente: "Nota", texto: "Comprar leche y pan", t: ahora - 14 * D },
  ];
  const r = L.buscarMem(E, m.q, { persona: m.persona, ventana: m.ventana });
  assert.equal(r[0].de, "Carlos Pérez");
  assert.ok(!r.some((x) => /leche/.test(x.texto)));
  assert.match(L.memPrompt("q", r, "hoy"), /\[1\] \(WhatsApp · Carlos Pérez · 2026-10-21\)/);
});
test("compras, trámites y formularios", () => {
  assert.deepEqual(L.compraIntent("compara precios del iPhone 16 de 128 GB"), { co: "precios", producto: "iPhone 16 de 128 GB" });
  assert.deepEqual(L.compraIntent("¿Dónde está más barato un televisor de 55 pulgadas?"), { co: "precios", producto: "un televisor de 55 pulgadas" });
  assert.deepEqual(L.compraIntent("¿Cómo saco el pasaporte?"), { co: "tramite", q: "pasaporte" });
  assert.equal(L.compraIntent("cómo hago arroz"), null);
  assert.deepEqual(L.compraIntent("llena este formulario con mis datos"), { co: "form" });
  const t = L.preciosTabla("| Tienda | Producto | Precio (COP) |\n|---|---|---|\n| Éxito | TV 55 | $2.399.900 |\n| **Alkosto** | TV 55 | $2.199.000 |");
  assert.deepEqual(t[0], { tienda: "Alkosto", producto: "TV 55", precio: 2199000 });
  assert.equal(L.campoDe("Correo electrónico"), "email"); assert.equal(L.campoDe("Contraseña"), null); assert.equal(L.campoDe("Número de tarjeta"), null);
  const nodos = [{ i: 0, t: "Nombres" }, { i: 1, t: "[Escribe tu nombre]", e: 1 }, { i: 2, t: "[Correo]", e: 1 }, { i: 3, t: "[Contraseña]", e: 1, p: 1 }, { i: 4, t: "[Celular]", e: 1 }, { i: 5, t: "[CVV]", e: 1 }];
  assert.deepEqual(L.mapearCampos(nodos, { nombre: "Juan", email: "j@x.co", telefono: "3001234567" }), [{ i: 1, k: "nombre", v: "Juan" }, { i: 2, k: "email", v: "j@x.co" }, { i: 4, k: "telefono", v: "3001234567" }]);
});
test("subtítulos, reloj y audífonos", () => {
  assert.deepEqual(L.subIntent("pon subtítulos en vivo del inglés"), { su: "on", de: "en-US", a: "" });
  assert.deepEqual(L.subIntent("subtitula el video"), { su: "on", de: "", a: "" });
  assert.deepEqual(L.subIntent("quita los subtítulos"), { su: "off" });
  assert.equal(L.subIntent("pon música"), null);
  assert.deepEqual(L.accIntent("activa Jarvis en el reloj"), { acc: "reloj", on: true });
  assert.deepEqual(L.accIntent("modo audífonos"), { acc: "audifonos", on: true });
  assert.equal(L.paraReloj("**Hola** <small>x</small>\n\n- uno"), "Hola x\n- uno");
});
test("3.19: escoger la IA del celular", () => {
  const LOC = { gemma4e2b: { rango: 6, nombre: "Gemma 4 E2B", archivo: "gemma-4-E2B-it.litertlm", mb: 2600 }, gemma4e4b: { rango: 8, nombre: "Gemma 4 E4B", archivo: "gemma-4-E4B-it.litertlm", mb: 3700 },
    qwen35_4b: { rango: 7, nombre: "Qwen 3.5 4B", archivo: "Qwen3.5-4B_mixed_int4.litertlm", mb: 2800 }, qwen35_2b: { rango: 5, nombre: "Qwen 3.5 2B con visión", archivo: "Qwen3.5-2B-VL_int8.litertlm", mb: 3200 },
    qwen35_08b: { rango: 3, nombre: "Qwen 3.5 0,8B con visión", archivo: "Qwen3.5-0.8B-VL_int8.litertlm", mb: 1300 }, qwen05: { rango: 1, nombre: "Qwen 2.5 0,5B", archivo: "q.task", mb: 550 } };
  const pick = (t, solo) => { const i = L.localIntent(t); return i && L.elegirLocal(i.q, LOC, solo); };
  assert.equal(pick("usa qwen"), "qwen35_4b");
  assert.equal(pick("usa Qwen 3.5 con visión"), "qwen35_2b");
  assert.equal(pick("descarga qwen 3.5 0,8b"), "qwen35_08b");
  assert.equal(pick("cambia a gemma e2b"), "gemma4e2b");
  assert.equal(pick("usa qwen", ["Qwen3.5-0.8B-VL_int8.litertlm", "gemma-4-E4B-it.litertlm"]), "qwen35_08b");
  assert.deepEqual(L.localIntent("¿qué IA del celular tengo?"), { lo: "lista" });
  assert.equal(L.localIntent("usa el temporizador"), null);
});
test("3.20: Gemma 4 12B por voz", () => {
  const LOC = { gemma4e4b: { rango: 8, nombre: "Gemma 4 E4B", archivo: "gemma-4-E4B-it.litertlm", mb: 3700 }, gemma4_12b: { rango: 7.5, nombre: "Gemma 4 12B · EXPERIMENTAL", archivo: "gemma-4-12B-it.litertlm", mb: 6600 },
    qwen35_2b: { rango: 5, nombre: "Qwen 3.5 2B con visión", archivo: "Qwen3.5-2B-VL_int8.litertlm", mb: 3200 } };
  const pick = (t) => { const i = L.localIntent(t); return i && L.elegirLocal(i.q, LOC); };
  assert.equal(pick("usa gemma 12b"), "gemma4_12b");
  assert.equal(pick("usa Gemma 4 12B"), "gemma4_12b");
  assert.equal(pick("usa gemma"), "gemma4e4b");
  assert.equal(pick("usa qwen 3.5 2b"), "qwen35_2b");
});
