// Pruebas de la lógica 3.28 (Google Maps, tareas largas, volumen de Jarvis, Mi día)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica17.js");

test("preguntas de lugares → Google Maps", () => {
  for (const t of ["¿qué restaurantes buenos hay cerca abiertos ahora?", "¿dónde hay una farmacia cerca?", "¿a cuánto queda el aeropuerto?", "¿cuánto me demoro a Unicentro caminando?", "recomiéndame un café por aquí", "¿qué hay para hacer en Bogotá?"])
    assert.equal(L.necesitaMapas(t), true, t);
  for (const t of ["¿qué es la fotosíntesis?", "llévame a la casa", "cómo llego al centro", "hola", "¿quién ganó el partido?"])
    assert.equal(L.necesitaMapas(t), false, t);
});

test("tareas largas", () => {
  assert.deepEqual(L.tareaIntent("investiga a fondo el mercado de carros eléctricos en Colombia"), { tarea: "el mercado de carros eléctricos en Colombia" });
  assert.deepEqual(L.tareaIntent("Jarvis, haz una investigación sobre la historia del café y avísame cuando esté"), { tarea: "la historia del café" });
  assert.deepEqual(L.tareaIntent("mis tareas"), { tarea: "", ver: true });
  assert.equal(L.tareaIntent("investiga qué es un agujero negro"), null);
  const i = L.intentosTarea(["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
  assert.deepEqual(i[0], { agent: "deep-research-preview-04-2026" });
  assert.ok(i.some((x) => x.model === "gemini-3.8-flash"));
  assert.equal(L.textoInteraccion({ outputs: [{ type: "thought", text: "x" }, { type: "text", text: "Hola" }] }), "Hola");
  assert.equal(L.textoInteraccion({ output_text: "Listo" }), "Listo");
  assert.match(L.promptTarea("el café"), /fuentes/);
});

test("volumen de Jarvis", () => {
  assert.deepEqual(L.volumenJarvisIntent("sube el volumen de Jarvis"), { vj: "subir" });
  assert.deepEqual(L.volumenJarvisIntent("baja tu volumen"), { vj: "bajar" });
  assert.deepEqual(L.volumenJarvisIntent("habla más duro"), { vj: "subir" });
  assert.deepEqual(L.volumenJarvisIntent("volumen de jarvis al máximo"), { vj: "max" });
  assert.equal(L.volumenJarvisIntent("sube el volumen"), null);          // ese es el del celular (ya existía)
});

test("Mi día", () => {
  for (const t of ["mi día", "¿cómo viene mi día?", "dame mi resumen del día"]) assert.equal(L.miDiaIntent(t), true, t);
  assert.equal(L.miDiaIntent("¿qué tengo hoy?"), false);
  assert.match(L.promptMiDia("datos"), /Próximos pasos/);
});
