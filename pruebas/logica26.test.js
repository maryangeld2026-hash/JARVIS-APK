// Pruebas de la lógica 3.39 (videos y atajo a Infinall)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica26.js");

test("se entiende como lo dirías", () => {
  assert.deepEqual(L.videoIntent("hazme un video de un perro surfeando"), { vi: "crear", desc: "un perro surfeando", formato: "vertical" });
  assert.deepEqual(L.videoIntent("Jarvis, crea un video sobre el ciclo del agua para el tablero"), { vi: "crear", desc: "el ciclo del agua para el tablero", formato: "horizontal" });
  assert.equal(L.videoIntent("quiero un video para el cumpleaños de mi mamá").desc, "el cumpleaños de mi mamá");
  assert.deepEqual(L.videoIntent("haz un video"), { vi: "crear", desc: "", formato: "" });
  assert.deepEqual(L.videoIntent("abre Infinall para un anuncio de mi panadería"), { vi: "infinall", desc: "un anuncio de mi panadería" });
  assert.deepEqual(L.videoIntent("hazme un anuncio de mis tortas en Infinall"), { vi: "infinall", desc: "un anuncio de mis tortas" });
  assert.deepEqual(L.videoIntent("abre infinall"), { vi: "infinall", desc: "" });
  assert.equal(L.videoIntent("hazme un resumen de este video de YouTube"), null);
  assert.equal(L.videoIntent("pon un video de música"), null);
  assert.equal(L.videoIntent("haz una videollamada a mamá"), null);
});

test("guion, tiempos y movimiento", () => {
  assert.equal(L.escenasValidas({ escenas: [{ imagen: "a" }] }, 5), null);
  const g = L.escenasValidas({ titulo: "T", escenas: [{ imagen: "a", texto: "uno", voz: "hola" }, { imagen: "b", texto: "dos", voz: "chao chao" }, { imagen: "c" }] }, 2);
  assert.equal(g.escenas.length, 2); assert.equal(g.titulo, "T");
  const s = L.escenasSimples("un perro surfeando", 3);
  assert.equal(s.escenas.length, 3); assert.match(s.escenas[1].imagen, /^un perro surfeando, plano medio/); assert.equal(s.escenas[0].texto, "un perro surfeando");
  assert.deepEqual(L.tiempos([{}, {}], 0), [3.5, 3.5]);
  const t = L.tiempos([{ voz: "x".repeat(40) }, { voz: "x".repeat(120) }], 10);
  assert.ok(Math.abs(t[0] + t[1] - 10.8) < 0.01 && t[1] > t[0]);
  assert.deepEqual(L.camara(0, 0), { s: 1, x: 0, y: 0 }); assert.ok(Math.abs(L.camara(0, 1).s - 1.12) < 1e-9);
  assert.equal(L.mimeVideo((m) => /webm/.test(m)), "video/webm;codecs=vp9,opus");
  assert.equal(L.mimeVideo((m) => m === "video/mp4"), "video/mp4");
  assert.equal(L.veoModelo(["gemini-3.5-flash", "veo-3.1-generate-preview", "veo-3.1-fast-generate-001", "veo-2.0-generate-001"]), "veo-3.1-fast-generate-001");
  assert.equal(L.sinCupo(400, "limit: 0"), true);
  assert.deepEqual(L.renglones("uno dos tres cuatro", 9, (s) => s.length), ["uno dos", "tres", "cuatro"]);
});
