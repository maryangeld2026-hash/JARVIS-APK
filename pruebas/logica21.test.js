// Pruebas de la lógica 3.32 (cadena de respaldo de la IA)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica21.js");
const L0 = require("../www/js/logica.js");

test("respaldos en orden", () => {
  assert.deepEqual(L.respaldos({ proveedor: "gemini", respaldo: "groq", respaldo2: "openrouter" }), ["groq", "openrouter"]);
  assert.deepEqual(L.respaldos({ proveedor: "gemini", respaldo: "gemini", respaldo2: "groq" }), ["groq"]);
  assert.deepEqual(L.ponerRespaldo({ proveedor: "gemini", respaldo: "deepseek" }, "groq"), { respaldo: "groq", respaldo2: "deepseek" });
  assert.deepEqual(L.ponerRespaldo({ proveedor: "gemini", respaldo: "local" }, "groq"), { respaldo: "groq", respaldo2: "" });
  assert.deepEqual(L.ponerRespaldo({ proveedor: "gemini", respaldo: "groq" }, "openrouter", 2), { respaldo: "groq", respaldo2: "openrouter" });
  const c = L.cadena({ proveedor: "gemini", respaldo: "groq", respaldo2: "openrouter" }, { gemini: "Gemini", groq: "Groq", openrouter: "OpenRouter", local: "IA del celular" }, true);
  assert.deepEqual(c.map((x) => x.prov + ":" + x.papel), ["gemini:principal", "groq:respaldo 1", "openrouter:respaldo 2", "local:sin internet"]);
  const t = L.cadenaTexto({ proveedor: "gemini", respaldo: "groq" }, { gemini: "Gemini", groq: "Groq", local: "IA del celular" }, { gemini: "falla", groq: "ok" }, false);
  assert.match(t, /1\. ⚠️ \*\*Gemini\*\*[\s\S]*2\. ✅ \*\*Groq\*\*/);
  assert.match(t, /descarga la IA del celular/);
});

test("órdenes por voz", () => {
  assert.deepEqual(L.respaldoIntent("usa Groq de respaldo"), { rs: "poner", prov: "groq", pos: 1 });
  assert.deepEqual(L.respaldoIntent("pon OpenRouter de segundo respaldo"), { rs: "poner", prov: "openrouter", pos: 2 });
  assert.deepEqual(L.respaldoIntent("¿cuál es mi respaldo?"), { rs: "ver" });
  assert.deepEqual(L.respaldoIntent("¿qué pasa si Gemini falla?"), { rs: "ver" });
  assert.deepEqual(L.respaldoIntent("prueba el respaldo"), { rs: "probar" });
  assert.equal(L.respaldoIntent("usa groq"), null);
});

test("versión corta para los gratis y errores que pasan al siguiente", () => {
  const o = L.compactar({ system: "x".repeat(9000), messages: Array.from({ length: 10 }, (_, i) => ({ role: "user", content: "m" + i + "y".repeat(3000) })), maxTokens: 4000 });
  assert.equal(o.system.length, 5000); assert.equal(o.messages.length, 6); assert.equal(o.messages[5].content.length, 1500); assert.equal(o.maxTokens, 1200);
  assert.ok(L.corto("groq", "openai/gpt-oss-120b") && L.corto("openrouter", "google/gemma-4-31b-it:free") && !L.corto("openrouter", "openai/gpt-5-mini") && !L.corto("gemini", "x"));
  assert.ok(L.pasaAlSiguiente(413) && L.pasaAlSiguiente(503) && L.pasaAlSiguiente(402) && !L.pasaAlSiguiente(400));
});

test("los modelos que escoge Jarvis en los gratis", () => {
  assert.equal(L0.pickModel("groq", ["llama-3.1-8b-instant", "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "whisper-large-v3"]), "openai/gpt-oss-120b");
  assert.equal(L0.pickModel("groq", ["qwen/qwen3.8-27b", "llama-3.1-8b-instant"]), "qwen/qwen3.8-27b");
  assert.equal(L0.pickModel("openrouter", ["openai/gpt-5-mini", "google/gemma-4-31b-it:free", "meta-llama/llama-4-scout:free"]), "google/gemma-4-31b-it:free");
  assert.equal(L0.pickModel("openrouter", ["openai/gpt-5-mini", "nvidia/nemotron-3-ultra:free"]), "nvidia/nemotron-3-ultra:free");
});
