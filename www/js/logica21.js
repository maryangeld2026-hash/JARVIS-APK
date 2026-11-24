/* Jarvis para Android 3.32 · lógica pura (se prueba con node): la cadena de respaldo de la IA.
   Gemini (principal) → Groq (gratis, sin tarjeta) → OpenRouter (modelos gratis) → IA del celular (sin internet). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "");

  /** Las IA de la nube gratis que Jarvis sabe usar de respaldo (en el orden recomendado). */
  const GRATIS = [
    { prov: "groq", nombre: "Groq", clave: "https://console.groq.com/keys", pista: "gsk_…", limite: "unas 1.000 preguntas al día, sin tarjeta", modelos: "GPT-OSS 120B o Qwen 3.8" },
    { prov: "openrouter", nombre: "OpenRouter (modelos gratis)", clave: "https://openrouter.ai/keys", pista: "sk-or-…", limite: "unas 50 preguntas al día gratis (1.000 si le cargas 10 dólares una vez)", modelos: "Gemma 4 31B y otros «:free»" },
    { prov: "mistral", nombre: "Mistral (plan Experiment)", clave: "https://console.mistral.ai/api-keys", pista: "…", limite: "gratis, pero Mistral puede usar tus preguntas para entrenar", modelos: "Mistral Small" },
  ];
  const esGratis = (p) => GRATIS.some((g) => g.prov === p);

  /** Los respaldos en orden, sin repetir la principal ni los vacíos. a: ajustes */
  function respaldos(a) {
    const l = [a.respaldo, a.respaldo2].filter((p, i, arr) => p && p !== a.proveedor && arr.indexOf(p) === i);
    return l;
  }
  /** Poner «prov» de primer respaldo (lo que había pasa a segundo; la IA del celular siempre queda al final sola). */
  function ponerRespaldo(a, prov, posicion) {
    const l = respaldos(a).filter((p) => p !== prov && p !== "local");
    if (posicion === 2) l.splice(1, 0, prov); else l.unshift(prov);
    return { respaldo: l[0] || "", respaldo2: l[1] || "" };
  }
  /** La cadena para mostrarla: [{prov, nombre, estado}] estados: {prov: "ok"|"sin_clave"|"falla"|"no"} */
  function cadena(a, nombres, locales) {
    const out = [{ prov: a.proveedor, papel: "principal" }];
    respaldos(a).filter((p) => p !== "local").forEach((p, i) => out.push({ prov: p, papel: `respaldo ${i + 1}` }));
    if (a.proveedor !== "local" && (locales || respaldos(a).includes("local"))) out.push({ prov: "local", papel: "sin internet" });
    return out.map((x) => Object.assign(x, { nombre: (nombres || {})[x.prov] || x.prov }));
  }
  function cadenaTexto(a, nombres, estados, locales) {
    const ic = { ok: "✅", sin_clave: "🔑", falla: "⚠️", no: "⬜", probando: "⏳" };
    const l = cadena(a, nombres, locales);
    return "🛟 **Así responde Jarvis:**\n" + l.map((x, i) => `${i + 1}. ${ic[(estados || {})[x.prov]] || "▫️"} **${x.nombre}** (${x.papel})`).join("\n") +
      (l.length < 3 ? "\n\nTe falta un respaldo gratis en la nube: di «usa Groq de respaldo»." : "") +
      (!l.some((x) => x.prov === "local") ? "\n\nY sin internet no hay quién responda: descarga la IA del celular en Ajustes › IA de respaldo." : "");
  }

  /** «usa Groq de respaldo», «pon OpenRouter de segundo respaldo», «¿cuál es mi respaldo?», «prueba el respaldo» */
  function respaldoIntent(text) {
    const t = lead(norm(text)); let m;
    if ((m = t.match(/^(?:usa|pon|activa|configura|instala)\s+(?:a\s+)?(groq|openrouter|open router|mistral|deepseek)\s+(?:de|como)\s+(?:(segundo|primer)\s+)?respaldo$/))) return { rs: "poner", prov: m[1].replace(/\s/g, ""), pos: m[2] === "segundo" ? 2 : 1 };
    if (/^(?:cual es|cuales son|como esta|como va)\s+(?:mi|el|la|los)\s+(?:respaldo|respaldos|cadena de respaldo|ia de respaldo)$|^(?:que pasa|quien responde)\s+(?:si|cuando)\s+(?:gemini|la ia)\s+(?:falla|no (?:esta|responde)|se cae)$/.test(t)) return { rs: "ver" };
    if (/^(?:prueba|revisa|proba)\s+(?:el|los|la|mi)\s+(?:respaldo|respaldos|cadena(?: de respaldo)?)$/.test(t)) return { rs: "probar" };
    if (/^(?:busca|recomiendame|cual es)\s+(?:una\s+)?ia\s+(?:gratis|gratuita)(?:\s+en la nube)?(?:\s+de respaldo)?$/.test(t)) return { rs: "ver" };
    return null;
  }

  /** Para los respaldos gratis (límite de tokens por minuto bajo): instrucción y conversación más cortas. */
  function compactar(o, lim) {
    const L = Object.assign({ sistema: 5000, mensajes: 6, letras: 1500 }, lim || {});
    const sys = String(o.system || "");
    const ms = (o.messages || []).slice(-L.mensajes).map((m) => Object.assign({}, m, { content: String(m.content || "").slice(-L.letras) }));
    return Object.assign({}, o, { system: sys.length > L.sistema ? sys.slice(0, L.sistema) : sys, messages: ms, maxTokens: Math.min(o.maxTokens || 1500, 1200) });
  }
  /** ¿Este proveedor y modelo necesitan la versión corta? */
  const corto = (prov, modelo) => prov === "groq" || (prov === "openrouter" && /:free$/.test(modelo || ""));
  /** Errores que deben pasar a la siguiente IA de la cadena (además de los de red y cupo). */
  const pasaAlSiguiente = (status) => [401, 402, 403, 404, 408, 409, 413, 429, 500, 502, 503, 504, 529].includes(+status);

  const API = { norm, GRATIS, esGratis, respaldos, ponerRespaldo, cadena, cadenaTexto, respaldoIntent, compactar, corto, pasaAlSiguiente };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL21 = API;
})(typeof window !== "undefined" ? window : globalThis);
