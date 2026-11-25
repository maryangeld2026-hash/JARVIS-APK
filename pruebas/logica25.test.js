// Pruebas de la lógica 3.38 (crear imágenes de la forma más fácil)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica25.js");

test("se entiende como lo dirías", () => {
  assert.deepEqual(L.crearIntent("dibújame un gato astronauta"), { ci: "crear", desc: "un gato astronauta", estilo: "", formato: "" });
  assert.deepEqual(L.crearIntent("Jarvis, pinta un atardecer en Cartagena en acuarela, vertical para estados"), { ci: "crear", desc: "un atardecer en Cartagena en acuarela, vertical para estados", estilo: "acuarela", formato: "vertical" });
  assert.equal(L.crearIntent("hazme un logo para mi panadería La Espiga").estilo, "logo");
  assert.equal(L.crearIntent("quiero una imagen de un perro con gafas").desc, "una imagen de un perro con gafas");
  assert.equal(L.crearIntent("imagen de un volcán para mi clase").ci, "crear");
  assert.equal(L.crearIntent("crea una invitación de cumpleaños estilo caricatura").estilo, "caricatura");
  assert.deepEqual(L.crearIntent("quiero crear una imagen"), { ci: "abrir" });
  assert.equal(L.crearIntent("dibuja la gráfica de y = 2x + 1"), null);       // eso lo hace «Graficar»
  assert.equal(L.crearIntent("dibuja un triángulo rectángulo con catetos 3 y 4"), null);   // figura exacta
  assert.equal(L.crearIntent("dibújame un triángulo feliz con sombrero").ci, "crear");
  assert.equal(L.crearIntent("hazme un mapa mental de la fotosíntesis"), null);
  assert.equal(L.crearIntent("¿qué es una imagen satelital?"), null);
});

test("estilos, formatos y servicios", () => {
  assert.match(L.promptFinal("un gato", "acuarela"), /^un gato\. Estilo: pintura en acuarela.*español/);
  assert.equal(L.urlPollinations("un gato", "vertical", 7), "https://image.pollinations.ai/prompt/un%20gato?width=576&height=1024&seed=7&safe=true");
  assert.deepEqual(L.pedidoSense("un gato", "horizontal"), { model: "sensenova-u1.5-fast", prompt: "un gato", n: 1, size: "1344x768" });
  assert.deepEqual(L.imagenDeRespuesta({ data: [{ b64_json: "iVBOR" }] }), { b64: "iVBOR", mime: "image/png" });
  assert.deepEqual(L.imagenDeRespuesta({ data: [{ url: "https://x/y.png" }] }), { url: "https://x/y.png" });
  assert.equal(L.imagenDeRespuesta({}), null);
  assert.equal(L.sinCupo(429, ""), true);
  assert.equal(L.sinCupo(400, "Quota exceeded for metric ... limit: 0"), true);
  assert.equal(L.sinCupo(500, "internal"), false);
});
