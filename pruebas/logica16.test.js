// Pruebas de la lógica 3.26 (modelos de la cuenta y probador)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica16.js");
const LJ = require("../www/js/logica.js");

const RAW = { models: [
  "gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.5-pro", "gemini-3-flash", "gemini-3-flash-lite", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
  "gemini-2.0-flash", "gemini-2.0-flash-001", "gemini-2.0-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest",
  "gemma-4-27b-it", "gemma-4-12b-it", "gemma-4-4b-it", "gemini-3.6-flash-preview-10-2026", "gemini-exp-1206",
].map((n) => ({ name: "models/" + n, displayName: n.toUpperCase(), supportedGenerationMethods: ["generateContent", "countTokens"] }))
  .concat([
    { name: "models/text-embedding-005", supportedGenerationMethods: ["embedContent"] },
    { name: "models/gemini-3.5-flash-preview-tts", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-3.5-flash-image", supportedGenerationMethods: ["generateContent"] },
    { name: "models/gemini-live-3.5-flash-native-audio", supportedGenerationMethods: ["bidiGenerateContent"] },
    { name: "models/imagen-5.0-generate", supportedGenerationMethods: ["predict"] },
  ]) };

test("los modelos de la cuenta que conversan", () => {
  const l = L.deGemini(RAW);
  assert.equal(l.length, 19);
  assert.ok(!l.some((m) => /embed|tts|image|native-audio|imagen/.test(m.id)));
});

test("el orden de la rotación", () => {
  const o = L.ordenar(L.deGemini(RAW), LJ.PROVIDERS.gemini.prefer);
  assert.equal(o.length, 19);
  assert.equal(o[0], "gemini-3.5-flash-lite");
  assert.equal(o[1], "gemini-3-flash-lite");
  assert.ok(o.indexOf("gemini-3.5-pro") > o.indexOf("gemini-3.5-flash"));
  assert.ok(o.indexOf("gemma-4-27b-it") > o.indexOf("gemini-2.5-pro"));
  assert.deepEqual(o.slice(-2).sort(), ["gemini-3.6-flash-preview-10-2026", "gemini-exp-1206"].sort());
});

test("el siguiente modelo (sin los probados ni los sin cupo)", () => {
  const o = ["a", "b", "c", "d"];
  assert.equal(L.siguiente(o, [], {}), "a");
  assert.equal(L.siguiente(o, ["a"], { b: Date.now() + 60000 }), "c");
  assert.equal(L.siguiente(o, ["a"], { b: Date.now() - 1 }), "b");
  assert.equal(L.siguiente(o, ["a", "b", "c", "d"], {}), null);
});

test("el probador: clasificar y resumir", () => {
  assert.equal(L.clasificar({ ok: true, ms: 640 }).texto, "✓ 0,6 s");
  assert.equal(L.clasificar({ ok: false, error: { status: 429 } }).estado, "cupo");
  assert.equal(L.clasificar({ ok: false, error: { status: 404 } }).estado, "no");
  assert.equal(L.clasificar({ ok: false, error: { status: 403, message: "API key not valid" } }).estado, "clave");
  const s = L.resumen([{ id: "a", r: { ok: true, ms: 900 } }, { id: "b", r: { ok: true, ms: 500 } }, { id: "c", r: { ok: false, error: { status: 429 } } }], "Google Gemini");
  assert.match(s, /2 de 3 modelos responden/);
  assert.match(s, /`b` \(0,5 s\)/);
  assert.match(s, /1 sin cupo/);
});

test("órdenes del probador", () => {
  assert.deepEqual(L.probadorIntent("prueba los modelos"), { pm: "probar", prov: "" });
  assert.deepEqual(L.probadorIntent("Jarvis, prueba los modelos de DeepSeek"), { pm: "probar", prov: "deepseek" });
  assert.deepEqual(L.probadorIntent("probador de modelos de gemini"), { pm: "probar", prov: "gemini" });
  assert.deepEqual(L.probadorIntent("prueba la IA"), { pm: "probar", prov: "" });
  assert.deepEqual(L.probadorIntent("¿qué modelos tengo?"), { pm: "lista", prov: "" });
  assert.equal(L.probadorIntent("prueba este vestido"), null);
  assert.equal(L.probadorIntent("¿qué es un modelo atómico?"), null);
});

test("DeepSeek V4.1 Flash", () => {
  const p = LJ.PROVIDERS.deepseek;
  assert.equal(p.modelo, "deepseek-flash");
  assert.equal(p.base, "https://api.deepseek.com");
  assert.equal(LJ.pickModel("deepseek", ["deepseek-v4-pro", "deepseek-flash", "deepseek-chat"]), "deepseek-flash");
  const r = LJ.chatRequest("deepseek", { key: "sk-x", model: "deepseek-flash", system: "s", messages: [{ role: "user", content: "hola" }] });
  assert.equal(r.url, "https://api.deepseek.com/chat/completions");
  assert.equal(r.body.model, "deepseek-flash");
});
