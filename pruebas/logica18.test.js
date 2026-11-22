// Pruebas de la lógica 3.29 (GGUF, Whisper y voz neural, como PocketPal AI)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica18.js");

test("catálogo GGUF", () => {
  assert.ok(L.CATALOGO.length >= 6);
  const o = L.locales();
  assert.equal(o.gguf_qwen35_4b.url, "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_0.gguf");
  assert.ok(Object.values(o).every((x) => /\.gguf$/.test(x.archivo) && x.gguf && x.mb > 100));
});

test("buscador de Hugging Face", () => {
  assert.match(L.urlBuscar("llama 3"), /api\/models\?search=llama%203&filter=gguf&sort=downloads/);
  assert.deepEqual(L.repos([{ id: "a/b-GGUF", downloads: 5 }]), [{ repo: "a/b-GGUF", descargas: 5, likes: 0 }]);
  const t = [{ type: "file", path: "M-Q4_0.gguf", lfs: { size: 2.5e9 } }, { type: "file", path: "M-Q4_K_M.gguf", size: 2.7e9 }, { type: "file", path: "mmproj-F16.gguf", size: 1e9 },
    { type: "file", path: "M-IQ2_XXS.gguf", size: 1.3e9 }, { type: "file", path: "README.md" }, { type: "file", path: "M-00001-of-00002.gguf", size: 9e9 }];
  const a = L.archivosGguf(t);
  assert.deepEqual(a.map((x) => x.cuant), ["IQ2_XXS", "Q4_0", "Q4_K_M"]);
  assert.equal(L.recomendado(a).cuant, "Q4_K_M");
  assert.equal(L.cabe(2600, 8000), "ok");
  assert.equal(L.cabe(2600, 4000), "no");
});

test("velocidad y cuándo usar el dictado o la voz", () => {
  assert.equal(L.velocidadTexto({ leer: 120.33, escribir: 9.4 }), "Lee 120,3 palabras por segundo y escribe 9,4 (rápida).");
  assert.equal(L.usarAhora("sin_internet", true, true), false);
  assert.equal(L.usarAhora("sin_internet", true, false), true);
  assert.equal(L.usarAhora("siempre", true, true), true);
  assert.equal(L.usarAhora("siempre", false, true), false);
  assert.equal(L.usarAhora("nunca", true, false), false);
});

test("órdenes", () => {
  assert.deepEqual(L.motoresIntent("mide la velocidad de la IA del celular"), { mo: "velocidad" });
  assert.deepEqual(L.motoresIntent("usa la voz neural"), { mo: "voz", on: true });
  assert.deepEqual(L.motoresIntent("vuelve a la voz normal"), { mo: "voz", on: false });
  assert.deepEqual(L.motoresIntent("busca modelos gguf de llama"), { mo: "buscar", q: "llama" });
  assert.deepEqual(L.motoresIntent("activa el dictado sin internet"), { mo: "dictado", on: true });
  assert.equal(L.motoresIntent("usa la voz de Gemini"), null);
});
