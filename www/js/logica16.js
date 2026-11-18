/* Jarvis para Android 3.26 · lógica pura (se prueba con node).
   Los modelos de la cuenta (Gemini y los demás): cuáles sirven para conversar, en qué orden se rotan cuando uno se queda
   sin cupo, y el probador (resumen de las pruebas). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!;«»"“”.]/g, " ").replace(/\s+/g, " ").trim();

  /** Lo que no sirve para conversar por texto (embeddings, voz, imágenes, en vivo, robots…). */
  const NO_CHAT = /(?:embed|aqa|-image\b|nano-banana|tts|text-to-speech|image-generation|imagen|veo|lyria|native-audio|audio|live|realtime|transcribe|whisper|dall|moderation|robotics|computer-use|-search-|attributed|learnlm|babbage|davinci|guard|ocr|rerank)/i;
  /** ¿Experimental o vista previa? (sirven, pero van al final de la rotación) */
  const PREVIA = /(?:preview|exp|experimental|-\d{2}-\d{2}$)/i;

  const ver = (x) => (String(x).match(/\d+(?:\.\d+)?/g) || []).slice(0, 3).map(parseFloat).reduce((a, v, i) => a + v / Math.pow(100, i), 0);

  /** Gemini: de la respuesta de /models → [{id, nombre, entrada, salida}] (solo los que generan texto). */
  function deGemini(json) {
    return ((json && json.models) || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => ({ id: String(m.name).replace(/^models\//, ""), nombre: m.displayName || "", entrada: m.inputTokenLimit || 0, salida: m.outputTokenLimit || 0 }))
      .filter((m) => !NO_CHAT.test(m.id));
  }
  /** Los demás (formato OpenAI o Claude): [{id}] */
  function deOtros(json) {
    return ((json && json.data) || []).map((m) => ({ id: String(m.id), nombre: m.display_name || "" })).filter((m) => !NO_CHAT.test(m.id));
  }

  /**
   * El orden de la rotación: primero los preferidos del proveedor (prefer, los rápidos y baratos), luego los estables
   * de versión más nueva, y al final las vistas previas. → ids
   */
  function ordenar(lista, prefer) {
    const ids = [...new Set((lista || []).map((m) => (typeof m === "string" ? m : m.id)))];
    const out = [];
    for (const re of prefer || []) ids.filter((x) => re.test(x) && !PREVIA.test(x)).sort((a, b) => ver(b) - ver(a)).forEach((x) => { if (!out.includes(x)) out.push(x); });
    const resto = ids.filter((x) => !out.includes(x));
    const estables = resto.filter((x) => !PREVIA.test(x)).sort((a, b) => peso(a) - peso(b) || ver(b) - ver(a) || a.localeCompare(b));
    const previas = resto.filter((x) => PREVIA.test(x)).sort((a, b) => peso(a) - peso(b) || ver(b) - ver(a) || a.localeCompare(b));
    return out.concat(estables, previas);
  }
  /** Rápidos primero (lite, flash, mini), luego los grandes (pro), luego los abiertos (gemma). */
  function peso(id) {
    const x = String(id).toLowerCase();
    if (/lite|nano|mini|instant|haiku|small|flash/.test(x)) return /lite|nano|mini|instant/.test(x) ? 0 : 1;
    if (/pro|sonnet|large|opus/.test(x)) return 2;
    if (/gemma/.test(x)) return 3;
    return 2;
  }

  /** El siguiente modelo para probar: el primero de la rotación que no se haya probado ni esté sin cupo. */
  function siguiente(orden, probados, agotados, ahora) {
    const t = ahora || Date.now();
    return (orden || []).find((m) => !(probados || []).includes(m) && !((agotados || {})[m] > t)) || null;
  }

  /** ¿Qué pasó en la prueba de un modelo? → {estado: ok|cupo|lento|clave|no|error, texto} */
  function clasificar(r) {
    if (r && r.ok) return { estado: "ok", texto: `✓ ${(r.ms / 1000).toFixed(1).replace(".", ",")} s` };
    const e = (r && r.error) || {};
    const st = e.status || 0, msg = String(e.message || "");
    if (st === 429 || /quota|cupo|RESOURCE_EXHAUSTED/i.test(msg)) return { estado: "cupo", texto: "✗ sin cupo ahora" };
    if (st === 401 || st === 403 || /api key|clave/i.test(msg)) return { estado: "clave", texto: "✗ la clave no sirve para este" };
    if (st === 404 || st === 400) return { estado: "no", texto: "✗ no disponible para conversar" };
    if (e.code === "lento" || e.code === "red" || st >= 500) return { estado: "lento", texto: "✗ no respondió a tiempo" };
    return { estado: "error", texto: "✗ " + (msg.slice(0, 60) || "error") };
  }

  /** Resumen del probador: «17 de 19 responden · el más rápido: gemini-3.5-flash-lite (0,6 s)…» */
  function resumen(resultados, proveedor) {
    const l = resultados || [];
    const ok = l.filter((x) => x.r && x.r.ok).sort((a, b) => a.r.ms - b.r.ms);
    const cupo = l.filter((x) => clasificar(x.r).estado === "cupo").length;
    let s = `**${proveedor || "La IA"}: ${ok.length} de ${l.length} modelo${l.length === 1 ? "" : "s"} responde${ok.length === 1 ? "" : "n"}.**`;
    if (ok.length) s += ` El más rápido: \`${ok[0].id}\` (${(ok[0].r.ms / 1000).toFixed(1).replace(".", ",")} s).`;
    if (cupo) s += ` ${cupo} sin cupo por ahora (se recupera solo; mientras tanto Jarvis usa los otros).`;
    return s;
  }

  /** «prueba los modelos», «probador de modelos de gemini», «prueba la ia», «qué modelos tengo» → {pm: probar|lista, prov?} */
  function probadorIntent(text) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis)[\s,]+/, "");
    const prov = /gemini|google/.test(t) ? "gemini" : /deepseek/.test(t) ? "deepseek" : /chatgpt|openai/.test(t) ? "openai" : /claude/.test(t) ? "claude" : /groq/.test(t) ? "groq" : /openrouter/.test(t) ? "openrouter" : /mistral/.test(t) ? "mistral" : "";
    if (/^(?:prueba(?:me)?|probar|proba|testea|revisa|chequea)\s+(?:todos\s+)?(?:los\s+)?modelos\b|^probador(?:\s+de\s+(?:los\s+)?modelos)?\b|^(?:prueba|probar|revisa)\s+(?:la\s+)?(?:ia|inteligencia artificial)(?:\s+de\s+(?:la\s+)?nube)?$/.test(t)) return { pm: "probar", prov };
    if (/^(?:que|cuales)\s+modelos\s+(?:tengo|hay|de ia tengo)\b|^(?:muestrame|dime|lista(?:me)?)\s+(?:los\s+)?modelos\b|^modelos de (?:mi cuenta|gemini|la ia)$/.test(t)) return { pm: "lista", prov };
    return null;
  }

  const API = { norm, NO_CHAT, PREVIA, deGemini, deOtros, ordenar, peso, siguiente, clasificar, resumen, probadorIntent };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL16 = API;
})(typeof window !== "undefined" ? window : globalThis);
