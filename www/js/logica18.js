/* Jarvis para Android 3.29 · lógica pura (se prueba con node). Lo de PocketPal AI dentro de Jarvis:
   modelos GGUF (catálogo y buscador de Hugging Face), dictado sin internet (Whisper) y voz neural (Supertonic). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!;«»"“”.,]/g, " ").replace(/\s+/g, " ").trim();
  const HF = "https://huggingface.co";

  /** Modelos GGUF recomendados (los mismos que usa PocketPal AI, que hablan bien español). [clave, repo, archivo, MB, rango, nombre, ramMin] */
  const CATALOGO = [
    ["gguf_lfm25_12b", "LiquidAI/LFM2.5-1.2B-Instruct-GGUF", "LFM2.5-1.2B-Instruct-Q4_K_M.gguf", 731, 3.5, "LFM2.5 1,2B (GGUF · 0,7 GB · muy rápida, 4 GB de RAM)", 3500],
    ["gguf_gemma3_1b", "ggml-org/gemma-3-1b-it-GGUF", "gemma-3-1b-it-Q4_K_M.gguf", 806, 3, "Gemma 3 1B (GGUF · 0,8 GB · rápida)", 3500],
    ["gguf_qwen3_17b", "bartowski/Qwen_Qwen3-1.7B-GGUF", "Qwen_Qwen3-1.7B-Q4_K_M.gguf", 1282, 4.5, "Qwen3 1,7B (GGUF · 1,3 GB · buena en español)", 5000],
    ["gguf_smollm3_3b", "bartowski/HuggingFaceTB_SmolLM3-3B-GGUF", "HuggingFaceTB_SmolLM3-3B-Q4_0.gguf", 1811, 5.5, "SmolLM3 3B (GGUF · 1,8 GB)", 6000],
    ["gguf_ministral3_3b", "bartowski/mistralai_Ministral-3-3B-Instruct-2512-GGUF", "mistralai_Ministral-3-3B-Instruct-2512-Q4_0.gguf", 2046, 6, "Ministral 3 3B (GGUF · 2 GB · de Mistral)", 6500],
    ["gguf_phi4mini", "bartowski/microsoft_Phi-4-mini-instruct-GGUF", "microsoft_Phi-4-mini-instruct-Q4_0.gguf", 2331, 6, "Phi-4 mini (GGUF · 2,3 GB · de Microsoft)", 7000],
    ["gguf_qwen35_4b", "unsloth/Qwen3.5-4B-GGUF", "Qwen3.5-4B-Q4_0.gguf", 2583, 7, "Qwen 3.5 4B (GGUF · 2,6 GB · la más lista de esta lista)", 7500],
    ["gguf_gemma4_e2b", "unsloth/gemma-4-E2B-it-GGUF", "gemma-4-E2B-it-Q4_0.gguf", 3041, 6.5, "Gemma 4 E2B (GGUF · 3 GB)", 8000],
  ];
  const urlArchivo = (repo, archivo) => `${HF}/${repo}/resolve/main/${archivo.split("/").map(encodeURIComponent).join("/")}`;
  /** Para app.js (LOCALES): {clave: {rango, nombre, archivo, url, mb, ramMin, gguf}} */
  function locales() {
    const o = {};
    CATALOGO.forEach(([k, repo, archivo, mb, rango, nombre, ramMin]) => { o[k] = { rango, nombre, archivo, url: urlArchivo(repo, archivo), mb, ramMin, gguf: true }; });
    return o;
  }

  // ======================================================================== BUSCADOR DE HUGGING FACE
  /** La búsqueda de repositorios con modelos GGUF. */
  function urlBuscar(q, n) {
    return `${HF}/api/models?search=${encodeURIComponent(String(q || "").trim())}&filter=gguf&sort=downloads&direction=-1&limit=${n || 15}`;
  }
  const urlArbol = (repo) => `${HF}/api/models/${repo}/tree/main?recursive=true`;
  /** De la respuesta de /api/models → [{repo, descargas, likes}] */
  function repos(json) {
    return (Array.isArray(json) ? json : []).map((m) => ({ repo: m.id || m.modelId, descargas: m.downloads || 0, likes: m.likes || 0 })).filter((x) => x.repo);
  }
  /** Del árbol del repositorio → los .gguf que sirven para conversar (sin proyectores de visión), con su tamaño y cuantización. */
  function archivosGguf(tree) {
    return (Array.isArray(tree) ? tree : [])
      .filter((f) => f && f.type !== "directory" && /\.gguf$/i.test(f.path || "") && !/mmproj|imatrix|-of-\d+\.gguf$/i.test(f.path))
      .map((f) => {
        const mb = Math.round(((f.lfs && f.lfs.size) || f.size || 0) / 1048576);
        const q = ((f.path.match(/(?:^|[-_.])((?:I?Q\d(?:_[A-Z0-9]+)*|F16|BF16|F32))(?=[-_.]|\.gguf$)/i) || [])[1] || "").toUpperCase();
        return { archivo: f.path, mb, cuant: q };
      })
      .sort((a, b) => a.mb - b.mb);
  }
  /** La cuantización recomendada (equilibrio entre calidad y tamaño): Q4_K_M, si no Q4_0, si no la más pequeña de 4 bits. */
  function recomendado(archivos) {
    const l = archivos || [];
    return l.find((x) => x.cuant === "Q4_K_M") || l.find((x) => x.cuant === "Q4_0") || l.find((x) => /^I?Q4/.test(x.cuant)) || l[0] || null;
  }
  /** ¿Cabe en este celular? (memoria total en MB) → "ok" | "justo" | "no" */
  function cabe(mb, ramMb) {
    if (!ramMb) return "ok";
    if (mb + 1500 <= ramMb * 0.6) return "ok";
    if (mb + 800 <= ramMb * 0.75) return "justo";
    return "no";
  }

  // ======================================================================== VELOCIDAD
  /** {leer, escribir} (tokens por segundo) → texto */
  function velocidadTexto(r) {
    if (!r || !(r.escribir > 0)) return "No se pudo medir.";
    const f = (x) => (Math.round(x * 10) / 10).toString().replace(".", ",");
    const nivel = r.escribir >= 15 ? "muy rápida" : r.escribir >= 8 ? "rápida" : r.escribir >= 4 ? "aceptable" : "lenta para conversar";
    return `Lee ${f(r.leer)} palabras por segundo y escribe ${f(r.escribir)} (${nivel}).`;
  }

  // ======================================================================== DICTADO Y VOZ: ¿CUÁNDO?
  /** modo: "nunca" | "sin_internet" | "siempre" */
  function usarAhora(modo, listo, enLinea) {
    if (!listo || !modo || modo === "nunca") return false;
    return modo === "siempre" || !enLinea;
  }
  const VOCES = [["M1", "Hombre 1 (grave)"], ["M2", "Hombre 2"], ["M3", "Hombre 3"], ["M4", "Hombre 4"], ["M5", "Hombre 5"], ["F1", "Mujer 1"], ["F2", "Mujer 2"], ["F3", "Mujer 3"], ["F4", "Mujer 4"], ["F5", "Mujer 5"]];

  /** Órdenes: «mide la velocidad de la IA del celular», «usa la voz neural», «busca modelos GGUF de Llama» */
  function motoresIntent(text) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis)\s+/, "");
    if (/^(?:mide|medir|prueba|cual es)\s+(?:la\s+)?velocidad\s+de\s+(?:la\s+)?ia\s+(?:del\s+celular|local|sin internet)$/.test(t)) return { mo: "velocidad" };
    if (/^(?:usa|activa|pon|ponme)\s+(?:la\s+)?voz\s+neural(?:\s+sin internet)?$/.test(t)) return { mo: "voz", on: true };
    if (/^(?:quita|desactiva|apaga)\s+(?:la\s+)?voz\s+neural$|^(?:usa|vuelve a)\s+(?:la\s+)?voz\s+(?:normal|del celular)$/.test(t)) return { mo: "voz", on: false };
    let m = t.match(/^(?:busca(?:me)?|buscar)\s+(?:un\s+|el\s+)?(?:modelos?\s+)?gguf\s+(?:de\s+)?(.+)$|^(?:busca(?:me)?|buscar)\s+(?:el\s+)?modelo\s+(.+?)\s+(?:en|de)\s+hugging\s*face$/);
    if (m) return { mo: "buscar", q: (m[1] || m[2]).trim() };
    if (/^(?:activa|usa|pon)\s+(?:el\s+)?dictado\s+sin\s+internet$/.test(t)) return { mo: "dictado", on: true };
    return null;
  }

  const API = { norm, HF, CATALOGO, urlArchivo, locales, urlBuscar, urlArbol, repos, archivosGguf, recomendado, cabe, velocidadTexto, usarAhora, VOCES, motoresIntent };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL18 = API;
})(typeof window !== "undefined" ? window : globalThis);
