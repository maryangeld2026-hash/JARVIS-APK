/* Jarvis para Android · lógica pura (sin pantalla ni red), probada con node en android-app/pruebas.
   Órdenes por voz de la clase, estudiante al azar, grupos, tiempos, recordatorios, quices, calificación de fotos,
   y las peticiones a la IA (Gemini, ChatGPT o Claude). Nunca se ejecuta código que escriba la IA: solo se leen datos
   con forma fija (JSON) y se validan aquí. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JL = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ======================================================================== TEXTO
  function norm(text) {
    return String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^\w\s/:+.,-]/g, " ").replace(/[.,]+(\s|$)/g, " ").replace(/\s+/g, " ").trim();
  }
  const NUM = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
    once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
    veinticinco: 25, treinta: 30, cuarenta: 40, cuarentaicinco: 45, cincuenta: 50, sesenta: 60, noventa: 90, cien: 100 };
  const NUMW = Object.keys(NUM).sort((a, b) => b.length - a.length).join("|");
  function toNum(w) {
    if (w == null) return null;
    w = String(w).trim();
    if (/^\d+([.,]\d+)?$/.test(w)) return parseFloat(w.replace(",", "."));
    if (w in NUM) return NUM[w];
    const m = w.match(/^(veinti|treinta y |cuarenta y |cincuenta y )(\w+)$/);
    if (m && m[2] in NUM) return ({ "veinti": 20, "treinta y ": 30, "cuarenta y ": 40, "cincuenta y ": 50 })[m[1]] + NUM[m[2]];
    return null;
  }
  const N = `(\\d+(?:[.,]\\d+)?|${NUMW}|veinti\\w+)`;

  // ======================================================================== CURSOS Y ESTUDIANTES
  /** Nombres pegados de una lista (uno por línea, o separados por comas o punto y coma), sin numeración ni repetidos. */
  function parseNames(text) {
    const seen = new Set(), out = [];
    String(text || "").split(/[\n;]+|,(?![^(]*\))/).forEach((raw) => {
      let n = raw.replace(/^\s*(?:\d+[.)-]?|[-•*·])\s*/, "").replace(/\s+/g, " ").trim();
      n = n.replace(/\t.*$/, "").trim();
      if (n.length < 2 || n.length > 80 || /^(nombre|nombres|estudiante|apellidos?)$/i.test(n)) return;
      const k = norm(n);
      if (!seen.has(k)) { seen.add(k); out.push(n); }
    });
    return out;
  }
  /** Un CSV/TSV exportado de una planilla: la columna que parece de nombres (o la primera). */
  function namesFromTable(text) {
    const rows = String(text || "").split(/\r?\n/).map((r) => r.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, "").trim()));
    if (!rows.length) return [];
    const head = rows[0].map(norm);
    let col = head.findIndex((h) => /nombre|estudiante|alumno/.test(h));
    const ap = head.findIndex((h) => /apellido/.test(h));
    let body = rows.slice(col >= 0 || ap >= 0 ? 1 : 0);
    if (col < 0 && ap < 0) {
      col = 0;
      let best = -1;
      (rows[0] || []).forEach((c, k) => { const letters = body.filter((r) => /[a-záéíóúñ]{3}/i.test(r[k] || "")).length; if (letters > best) { best = letters; col = k; } });
    }
    const names = body.map((r) => [ap >= 0 ? r[ap] : "", col >= 0 ? r[col] : ""].filter(Boolean).join(" ").trim()).filter((x) => /[a-záéíóúñ]{2}/i.test(x));
    return parseNames(names.join("\n"));
  }
  function findCourse(courses, text) {
    const t = " " + norm(text) + " ";
    let best = null;
    (courses || []).forEach((c) => {
      const k = norm(c.nombre);
      if (k && t.includes(" " + k + " ") && (!best || k.length > norm(best.nombre).length)) best = c;
    });
    return best;
  }

  /** Estudiante al azar sin repetir hasta que pasen todos. state: {usados: [...]} (se devuelve uno nuevo). */
  function pickStudent(names, usados, rnd = Math.random) {
    const all = (names || []).filter(Boolean);
    if (!all.length) return null;
    let left = all.filter((n) => !(usados || []).includes(n));
    let reset = false;
    if (!left.length) { left = all.slice(); reset = true; }
    const name = left[Math.floor(rnd() * left.length) % left.length];
    const next = (reset ? [] : (usados || []).filter((n) => all.includes(n))).concat([name]);
    return { name, usados: next, quedan: all.length - next.length, reinicio: reset };
  }
  function shuffle(list, rnd = Math.random) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /** Grupos equilibrados: {grupos: n} o {tamano: k}. */
  function makeGroups(names, opt, rnd = Math.random) {
    const all = shuffle((names || []).filter(Boolean), rnd);
    if (!all.length) return [];
    let n = opt && opt.grupos ? Math.round(opt.grupos) : opt && opt.tamano ? Math.ceil(all.length / Math.max(1, Math.round(opt.tamano))) : 4;
    n = Math.max(1, Math.min(all.length, n));
    const out = Array.from({ length: n }, () => []);
    all.forEach((s, i) => out[i % n].push(s));
    return out;
  }

  // ======================================================================== TIEMPOS
  /** «5 minutos», «un minuto y medio», «media hora», «90 segundos», «2:30» → segundos (o null). */
  function parseDuration(text) {
    const t = norm(text);
    let m = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m && !/\b(?:a las|para las)\b/.test(t)) return +m[1] * 60 + +m[2];
    if (/\bmedia hora\b/.test(t)) return 1800 + extra(t);
    if (/\bun cuarto de hora\b/.test(t)) return 900;
    let secs = 0, found = false;
    const re = new RegExp(`${N}\\s*(horas?|h|minutos?|mins?|min|segundos?|segs?|s)\\b`, "g");
    while ((m = re.exec(t))) {
      const v = toNum(m[1]);
      if (v == null) continue;
      found = true;
      secs += /^h/.test(m[2]) ? v * 3600 : /^m/.test(m[2]) ? v * 60 : v;
    }
    if (found && /\by medio\b/.test(t)) secs += /\bhoras?\b/.test(t) ? 1800 : 30;
    if (!found) {
      m = t.match(new RegExp(`\\b(?:de|por)\\s+${N}\\b`));
      if (m && /temporizador|cronometro|cuenta regresiva|tiempo/.test(t)) { const v = toNum(m[1]); if (v != null) { secs = v * 60; found = true; } }
    }
    return found && secs > 0 ? Math.round(secs) : null;
    function extra(s) { return /\by (?:cinco|5) minutos\b/.test(s) ? 300 : 0; }
  }
  function fmtClock(secs) {
    secs = Math.max(0, Math.round(secs));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : String(m)) + ":" + String(s).padStart(2, "0");
  }
  function spokenDuration(secs) {
    const m = Math.floor(secs / 60), s = secs % 60;
    const p = [];
    if (m) p.push(m === 1 ? "un minuto" : `${m} minutos`);
    if (s) p.push(s === 1 ? "un segundo" : `${s} segundos`);
    return p.join(" y ") || "0 segundos";
  }

  /** «recuérdame llamar a la coordinadora a las 3 de la tarde», «en 20 minutos», «mañana a las 7» → {texto, cuando: Date} */
  function parseReminder(text, now = new Date()) {
    const t = norm(text);
    const m0 = t.match(/^(?:por favor\s+)?(?:recuerdame|recordarme|avisame|acuerdame|recordatorio(?: de| para)?)\s+(?:que\s+|de\s+|para\s+)?(.+)$/);
    if (!m0) return null;
    let body = m0[1], when = null, m;
    const rel = body.match(new RegExp(`\\b(?:en|dentro de)\\s+(${N}\\s*(?:horas?|minutos?|mins?|segundos?)(?:\\s+y\\s+(?:medio|${N}\\s*(?:minutos?|segundos?)))?|media hora)\\b`));
    if (rel) {
      const s = parseDuration(rel[1]);
      if (s) { when = new Date(now.getTime() + s * 1000); body = body.replace(rel[0], " "); }
    }
    if (!when && (m = body.match(new RegExp(`\\b(manana|pasado manana|hoy)?\\s*(?:a las|a la|para las)\\s+(\\d{1,2}|${NUMW})(?::(\\d{2})|\\s+y\\s+(media|cuarto|${N}))?\\s*(de la manana|de la tarde|de la noche|am|pm|a m|p m)?\\s*(manana|pasado manana)?`)))) {
      let h = toNum(m[2]), min = m[3] ? +m[3] : m[4] === "media" ? 30 : m[4] === "cuarto" ? 15 : m[4] ? toNum(m[4]) : 0;
      if (h == null || h > 23) return null;
      const per = m[6] || "";                                   // m[5] es el número de dentro de m[4]
      if (/tarde|noche|pm|p m/.test(per) && h < 12) h += 12;
      if (/manana|am|a m/.test(per) && h === 12) h = 0;
      const d = new Date(now.getTime());
      d.setHours(h, min || 0, 0, 0);
      const day = m[1] || m[7] || "";
      if (day === "manana") d.setDate(d.getDate() + 1);
      else if (day === "pasado manana") d.setDate(d.getDate() + 2);
      else if (!per && h < 12 && h >= 1 && h <= 6 && d <= now) d.setHours(h + 12);   // «a las 3» después de la mañana: de la tarde
      if (!day && d <= now) d.setDate(d.getDate() + 1);
      when = d;
      body = body.replace(m[0], " ");
    }
    body = body.replace(/\s+/g, " ").replace(/^(?:que|de|para)\s+/, "").trim();
    if (!when || !body) return { texto: body, cuando: when, falta: !when ? "hora" : "texto" };
    // el texto original, con sus tildes y mayúsculas
    const orig = String(text).split(/\s+/).map((w) => w.replace(/^[¿¡«"(]+|[?!.,;:»")]+$/g, ""));
    const out = [];
    let k = 0;
    body.split(" ").forEach((w) => {
      for (let j = k; j < orig.length; j++) if (norm(orig[j]) === w) { out.push(orig[j]); k = j + 1; return; }
      out.push(w);
    });
    body = out.join(" ");
    return { texto: body.charAt(0).toUpperCase() + body.slice(1), cuando: when };
  }
  function spokenWhen(d, now = new Date()) {
    const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
    const h = d.getHours(), m = d.getMinutes();
    const hh = (h % 12 || 12) + (m ? ":" + String(m).padStart(2, "0") : "");
    const part = h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche";
    return `${days === 0 ? "hoy" : days === 1 ? "mañana" : days === 2 ? "pasado mañana" : d.toLocaleDateString("es-CO")} a las ${hh} ${part}`;
  }

  // ======================================================================== ÓRDENES DE LA CLASE
  /** Qué pidió la profe. → {kind, ...} o null (entonces va a la IA). */
  function intent(text, courses) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis|hola jarvis)\s+/, "");
    if (!t) return null;
    const course = findCourse(courses, t);
    let m;
    if (/^(?:callate|silencio|deten(?:te)?|para|basta|stop|ya)$/.test(t)) return { kind: "callar" };
    if (/\b(?:que hora es|dime la hora)\b/.test(t)) return { kind: "hora" };
    if (/\b(?:que (?:dia|fecha) es hoy|que fecha es|a como estamos)\b/.test(t)) return { kind: "fecha" };
    if (/\b(?:(?:para|deten|cancela|quita|apaga)\s+(?:el\s+)?(?:temporizador|cronometro|tiempo|alarma)|ya (?:termino|paso) el tiempo)\b/.test(t)) return { kind: "tiempo_parar" };
    if (/\b(?:cuanto (?:tiempo )?(?:falta|queda)|cuanto le queda)\b/.test(t)) return { kind: "tiempo_falta" };
    if (/\b(?:temporizador|cronometro|cuenta regresiva|pon(?:me|le)? (?:un )?tiempo|dales|dale|tienen)\b/.test(t) || /^(?:pon|ponme)\s/.test(t) && /\b(?:minutos?|segundos?|media hora)\b/.test(t)) {
      const s = parseDuration(t);
      if (s) return { kind: "tiempo", segundos: s };
      if (/temporizador|cronometro|cuenta regresiva/.test(t)) return { kind: "tiempo", segundos: null };
    }
    if (/\b(?:recuerdame|recordarme|avisame|acuerdame)\b/.test(t)) return { kind: "recordar", frase: text };
    if (/\b(?:que recordatorios|mis recordatorios|que me tienes que recordar)\b/.test(t)) return { kind: "recordatorios" };
    if ((m = t.match(/\b(?:escoge|elige|saca|selecciona|dime|llama(?: a)?|pasa)\s+(?:a\s+)?(?:un|una|otro|otra)?\s*(?:estudiante|alumno|alumna|nino|nina|persona|voluntario|voluntaria|al azar)\b/)) ||
        /\b(?:estudiante|alumno) al azar\b|\bquien (?:pasa|sigue|responde)\b/.test(t)) return { kind: "azar", curso: course && course.id };
    if ((m = t.match(new RegExp(`\\b(?:haz|hazme|forma|arma|organiza|divide(?:los)?(?: en)?|crea|saca)\\s+(?:me\\s+)?(?:los\\s+)?(?:en\\s+)?${N}?\\s*(?:grupos|equipos|parejas|trios)\\b(?:\\s+de\\s+${N})?`)))) {
      const n = toNum(m[1]), k = toNum(m[2]);
      if (/parejas/.test(m[0])) return { kind: "grupos", tamano: 2, curso: course && course.id };
      if (/trios/.test(m[0])) return { kind: "grupos", tamano: 3, curso: course && course.id };
      return k ? { kind: "grupos", tamano: k, curso: course && course.id } : { kind: "grupos", grupos: n || 4, tamano: null, curso: course && course.id };
    }
    if ((m = t.match(new RegExp(`\\bgrupos de\\s+${N}\\b`)))) return { kind: "grupos", tamano: toNum(m[1]), curso: course && course.id };
    if (/\b(?:califica|calificame|revisa|corrige|evalua)\b.*\b(?:foto|trabajo|taller|cuaderno|examen|hoja|tarea)\b|\b(?:toma(?:le)? (?:una )?foto|abre la camara)\b/.test(t))
      return { kind: "foto", curso: course && course.id };
    if ((m = t.match(/\b(?:haz|hazme|crea|creame|prepara|preparame|genera|arma|dame)\s+(?:me\s+)?(?:un|una)?\s*(quiz|quices|evaluacion|examen|prueba|taller|cuestionario)\b(.*)$/))) {
      const rest = m[2] || "";
      const nm = rest.match(new RegExp(`\\b(?:de|con)\\s+${N}\\s+preguntas\\b`)) || rest.match(new RegExp(`\\b${N}\\s+preguntas\\b`));
      const GR = /\b(?:(?:para|de|en)\s+(?:el\s+)?)?(?:grado\s+(\d{1,2})\b|(\d{1,2})\s*(?:°|o\b|grado\b)|(\d{1,2})\s*[a-d]\b)/;
      const rest2 = rest.replace(nm ? nm[0] : "", " ");
      const gm = rest2.match(GR);
      let topic = rest2.replace(GR, " ")
        .replace(course ? new RegExp("\\b(?:para|de|en)?\\s*" + norm(course.nombre).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b") : /$^/, " ")
        .replace(/^\s*(?:de|sobre|acerca de|del|de la|de los|de las)\s+/, "").replace(/\s+/g, " ").trim();
      topic = topic.replace(/^(?:sobre|de)\s+/, "").trim();
      return { kind: "quiz", tipo: m[1] === "taller" ? "taller" : "quiz", tema: topic, n: nm ? toNum(nm[1]) : null, grado: gm ? +(gm[1] || gm[2] || gm[3]) : course ? +((course.nombre.match(/\d{1,2}/) || [])[0]) || null : null, curso: course && course.id };
    }
    return null;
  }

  // ======================================================================== IA: PETICIONES (Gemini, ChatGPT, Claude)
  const PROVIDERS = {
    gemini: { nombre: "Google Gemini", modelo: "gemini-3.5-flash-lite", base: "https://generativelanguage.googleapis.com/v1beta",
      prefer: [/^gemini-[\d.]+-flash-lite$/, /^gemini-[\d.]+-flash$/, /^gemini-[\d.]+-flash/], clave: "https://aistudio.google.com/apikey", pista: "AIza…" },
    openai: { nombre: "ChatGPT (OpenAI)", modelo: "", base: "https://api.openai.com/v1",
      prefer: [/^gpt-[\d.]+-mini$/, /^gpt-[\d.]+-nano$/, /^gpt-[\d.]+$/], clave: "https://platform.openai.com/api-keys", pista: "sk-…" },
    claude: { nombre: "Claude (Anthropic)", modelo: "claude-haiku-5-5", base: "https://api.anthropic.com/v1",
      prefer: [/^claude-haiku/, /^claude-sonnet/, /^claude/], clave: "https://console.anthropic.com/settings/keys", pista: "sk-ant-…" },
  };
  /** El mejor modelo de la lista que da la cuenta (el rápido y barato de cada proveedor). */
  function pickModel(provider, ids) {
    const p = PROVIDERS[provider];
    if (!p) return "";
    const list = (ids || []).map(String).filter((x) => !/(?:preview|exp|audio|realtime|tts|image|embed|vision|search|transcribe|instruct|whisper|dall|davinci|babbage|moderation|codex|computer)/i.test(x));
    const ver = (x) => (x.match(/\d+(?:\.\d+)?/g) || []).map(parseFloat).reduce((a, v, i) => a + v / Math.pow(100, i), 0);
    for (const re of p.prefer) {
      const hits = list.filter((x) => re.test(x)).sort((a, b) => ver(b) - ver(a));
      if (hits.length) return hits[0];
    }
    return p.modelo || list[0] || "";
  }
  function modelsRequest(provider, key) {
    const p = PROVIDERS[provider];
    if (provider === "gemini") return { url: `${p.base}/models?pageSize=200&key=${encodeURIComponent(key)}`, headers: {} };
    if (provider === "openai") return { url: `${p.base}/models`, headers: { Authorization: `Bearer ${key}` } };
    return { url: `${p.base}/models?limit=100`, headers: claudeHeaders(key) };
  }
  function modelsFrom(provider, json) {
    if (provider === "gemini") return ((json && json.models) || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, ""));
    return ((json && json.data) || []).map((m) => m.id);
  }
  function claudeHeaders(key) {
    return { "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" };
  }
  /** messages: [{role: "user"|"assistant", content: texto, image?: {mime, data(base64)}}] */
  /** «Pensamiento» del modelo: retrasa la primera palabra varios segundos. Para conversar se apaga (o se baja al mínimo),
      igual que en el Jarvis del computador. Si el modelo no acepta el ajuste, ia.js lo quita y repite la petición. */
  function speedOptions(provider, model) {
    const m = String(model || "").toLowerCase();
    if (provider === "gemini") {
      if (/^gemini-[12]\./.test(m)) return /flash/.test(m) ? { thinkingConfig: { thinkingBudget: 0 } } : null;
      if (/flash/.test(m)) return { thinkingConfig: { thinkingLevel: /lite/.test(m) ? "minimal" : "low" } };
      return null;
    }
    if (provider === "openai") {
      if (/^gpt-5(?:\b|[.-])/.test(m)) return { reasoning_effort: "minimal" };
      if (/^(?:gpt-[6-9]|o\d)/.test(m)) return { reasoning_effort: "low" };
    }
    return null;
  }
  function chatRequest(provider, { key, model, system, messages, stream = true, json = false, maxTokens = 1500, temperature = 0.6, fast = true }) {
    const p = PROVIDERS[provider];
    const sp = fast ? speedOptions(provider, model) : null;
    if (provider === "gemini") {
      const contents = messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user",
        parts: [...(m.image ? [{ inline_data: { mime_type: m.image.mime, data: m.image.data } }] : []), { text: String(m.content || "") }] }));
      const body = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
      if (system) body.systemInstruction = { parts: [{ text: system }] };
      if (json) body.generationConfig.responseMimeType = "application/json";
      if (sp) Object.assign(body.generationConfig, sp);
      const op = stream ? "streamGenerateContent?alt=sse&" : "generateContent?";
      return { url: `${p.base}/models/${encodeURIComponent(model)}:${op}key=${encodeURIComponent(key)}`, headers: { "content-type": "application/json" }, body, rapido: !!sp };
    }
    if (provider === "openai") {
      const msgs = (system ? [{ role: "system", content: system }] : []).concat(messages.map((m) => ({ role: m.role,
        content: m.image ? [{ type: "text", text: String(m.content || "") }, { type: "image_url", image_url: { url: `data:${m.image.mime};base64,${m.image.data}` } }] : String(m.content || "") })));
      const body = { model, messages: msgs, stream, max_completion_tokens: maxTokens };
      if (json) body.response_format = { type: "json_object" };
      if (sp) Object.assign(body, sp);
      return { url: `${p.base}/chat/completions`, headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" }, body, rapido: !!sp };
    }
    const msgs = messages.map((m) => ({ role: m.role, content: m.image
      ? [{ type: "image", source: { type: "base64", media_type: m.image.mime, data: m.image.data } }, { type: "text", text: String(m.content || "") }]
      : String(m.content || "") }));
    const body = { model, max_tokens: maxTokens, messages: msgs, stream };
    if (system) body.system = system + (json ? " Responde SOLO con el objeto JSON pedido, sin texto antes ni después." : "");
    return { url: `${p.base}/messages`, headers: claudeHeaders(key), body };
  }
  /** Eventos «data: …» de una respuesta en streaming (SSE). → {datos: [objetos], resto} */
  function parseSSE(buffer) {
    const out = [];
    const parts = String(buffer).split(/\r?\n\r?\n/);
    const rest = parts.pop();
    parts.forEach((block) => {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") return;
      try { out.push(JSON.parse(data)); } catch (e) { /* trozo incompleto o comentario */ }
    });
    return { datos: out, resto: rest };
  }
  function deltaText(provider, ev) {
    if (!ev) return "";
    if (provider === "gemini") return ((((ev.candidates || [])[0] || {}).content || {}).parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
    if (provider === "openai") return ((((ev.choices || [])[0] || {}).delta || {}).content) || "";
    return ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta" ? ev.delta.text || "" : "";
  }
  function fullText(provider, json) {
    if (provider === "gemini") return deltaText("gemini", json);
    if (provider === "openai") return ((((json.choices || [])[0] || {}).message || {}).content) || "";
    return ((json.content || []).filter((c) => c.type === "text").map((c) => c.text).join("")) || "";
  }
  function apiError(provider, status, json) {
    const msg = (json && (json.error && (json.error.message || json.error.status) || json.message)) || "";
    if (status === 400 && /api key|API_KEY|invalid/i.test(msg) || status === 401 || status === 403) return "La clave no sirve o no tiene permiso. Revísala en Ajustes.";
    if (status === 429) return "Se acabó la cuota de la IA por ahora (demasiadas peticiones). Espera un minuto o revisa tu plan.";
    if (status === 404) return "Ese modelo no existe en tu cuenta. En Ajustes, pon el modelo en «Automático».";
    if (status >= 500) return "El servicio de IA está fallando ahora mismo. Intenta de nuevo en un momento.";
    return msg ? `La IA respondió con un error: ${msg.slice(0, 160)}` : `La IA respondió con un error (${status}).`;
  }
  /** El primer objeto JSON de un texto (la IA a veces lo envuelve en ```json … ```). */
  function extractJSON(text) {
    const s = String(text || "").replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/, "");
    try { return JSON.parse(s); } catch (e) { /* sigue */ }
    const a = s.indexOf("{"), b = s.lastIndexOf("}");
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (e) { return null; } }
    return null;
  }

  // ======================================================================== VOZ: FRASES PARA IR HABLANDO
  /** De lo que va llegando en streaming, las frases completas para decir ya. → {frases, resto} */
  function takeSentences(buf, first) {
    const frases = [];
    let rest = String(buf), m;
    const re = /[.!?…:;](?=\s|$)\s*/g;
    let last = 0;
    while ((m = re.exec(rest))) {
      if (/\d$/.test(rest.slice(0, m.index)) && /^\.\d/.test(rest.slice(m.index))) continue;   // 3.5
      const s = rest.slice(last, m.index + 1).trim();
      if (s.length > 1) frases.push(s);
      last = re.lastIndex;
    }
    rest = rest.slice(last);
    if (first && !frases.length && rest.length > 40) {                        // la 1ª frase larga: se dice hasta la coma
      const c = rest.slice(35, 140).search(/,\s/);
      if (c >= 0 && !/\$/.test(rest.slice(0, 35 + c))) { frases.push(rest.slice(0, 35 + c + 1).trim()); rest = rest.slice(35 + c + 1); }
    }
    return { frases, resto: rest };
  }
  /** Texto para leer en voz alta: sin marcas de formato, y las fórmulas dichas en palabras. */
  function forSpeech(text) {
    let s = String(text || "");
    s = s.replace(/```[\s\S]*?```/g, " ").replace(/\$\$?([^$]+)\$\$?/g, (m, f) => " " + mathWords(f) + " ");
    s = s.replace(/^\s*#{1,4}\s+/gm, "").replace(/^\s*>\s?/gm, "").replace(/\*\*|__|`/g, "").replace(/^\s*[-•*]\s+/gm, "").replace(/^\s*\|.*\|\s*$/gm, " ");
    s = s.replace(/https?:\/\/\S+/g, "el enlace").replace(/\s+/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
    return s;
  }
  function mathWords(f) {
    let s = String(f);
    for (let i = 0; i < 3; i++) s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1 sobre $2").replace(/\\sqrt\{([^{}]*)\}/g, "raíz de $1");
    return s.replace(/\^\{?2\}?/g, " al cuadrado").replace(/\^\{?3\}?/g, " al cubo").replace(/\^\{?([^{}\s]+)\}?/g, " a la $1")
      .replace(/\\cdot|\\times|\*/g, " por ").replace(/\\div|÷/g, " dividido ").replace(/\\pm/g, " más o menos ").replace(/\\pi/g, " pi ")
      .replace(/\\leq?|≤/g, " menor o igual que ").replace(/\\geq?|≥/g, " mayor o igual que ").replace(/\\neq|≠/g, " distinto de ")
      .replace(/</g, " menor que ").replace(/>/g, " mayor que ").replace(/=/g, " igual a ").replace(/\+/g, " más ").replace(/(\w)\s*-\s*(\w)/g, "$1 menos $2")
      .replace(/\\[a-zA-Z]+/g, " ").replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  }
  function trimHistory(history, budget = 6000, perMsg = 900) {
    const out = [];
    let total = 0;
    (history || []).slice().reverse().forEach((m, i) => {
      if (total > budget) return;
      let c = String(m.content || "");
      if (c.length > perMsg && i > 0) c = c.slice(0, perMsg).replace(/\s+\S*$/, "") + " […]";
      if (total + c.length > budget && out.length) { total = budget + 1; return; }
      total += c.length;
      out.push({ role: m.role, content: c });
    });
    return out.reverse();
  }

  // ======================================================================== QUICES
  function quizPrompt({ tema, n, grado, tipo }) {
    n = Math.max(1, Math.min(20, Math.round(n || 5)));
    return `Crea ${tipo === "taller" ? "un taller" : "un quiz"} de ${n} preguntas sobre «${tema}»${grado ? ` para estudiantes de grado ${grado}` : ""} en Colombia, en español. ` +
      "Preguntas claras, de dificultad progresiva, con contexto cotidiano cuando ayude. Cada una con 4 opciones, una sola correcta, " +
      "distractores plausibles (errores típicos de los estudiantes) y una explicación corta de la respuesta. Las fórmulas en LaTeX entre $…$. " +
      'Devuelve SOLO JSON: {"titulo": "…", "instrucciones": "…", "preguntas": [{"enunciado": "…", "opciones": ["…","…","…","…"], "correcta": 0, "explicacion": "…"}]}';
  }
  /** Valida y limpia el quiz que devolvió la IA. → {quiz} o {error} */
  function cleanQuiz(obj, want) {
    if (!obj || typeof obj !== "object") return { error: "La IA no devolvió un quiz con el formato esperado." };
    const s = (x, max) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, max);
    const qs = [];
    (Array.isArray(obj.preguntas) ? obj.preguntas : []).forEach((q) => {
      if (!q || typeof q !== "object") return;
      const en = s(q.enunciado || q.pregunta, 600);
      let ops = (Array.isArray(q.opciones) ? q.opciones : []).map((o) => s(o, 240).replace(/^[a-dA-D][).:-]\s+/, "")).filter(Boolean);
      let c = typeof q.correcta === "number" ? q.correcta : /^[a-d]$/i.test(String(q.correcta || "").trim()) ? "abcd".indexOf(String(q.correcta).trim().toLowerCase()) : ops.indexOf(s(q.correcta, 240));
      if (!en || ops.length < 2 || ops.length > 6 || !(c >= 0 && c < ops.length)) return;
      if (new Set(ops.map(norm)).size !== ops.length) return;                 // opciones repetidas
      qs.push({ enunciado: en, opciones: ops, correcta: c, explicacion: s(q.explicacion, 500) });
    });
    if (!qs.length) return { error: "La IA no devolvió preguntas válidas. Intenta de nuevo." };
    return { quiz: { titulo: s(obj.titulo, 120) || (want && want.tema ? "Quiz: " + want.tema : "Quiz"), instrucciones: s(obj.instrucciones, 300), preguntas: qs.slice(0, 20) } };
  }
  /** Las preguntas con las opciones barajadas (para varias versiones del mismo quiz). */
  function shuffleQuiz(quiz, rnd = Math.random) {
    return Object.assign({}, quiz, { preguntas: quiz.preguntas.map((q) => {
      const order = shuffle(q.opciones.map((_, i) => i), rnd);
      return Object.assign({}, q, { opciones: order.map((i) => q.opciones[i]), correcta: order.indexOf(q.correcta) });
    }) });
  }
  /** Texto para compartir por WhatsApp (sin la clave). */
  function quizText(quiz, withKey) {
    const L = "abcdef";
    let out = `*${quiz.titulo}*\n` + (quiz.instrucciones ? quiz.instrucciones + "\n" : "") + "\n";
    quiz.preguntas.forEach((q, i) => {
      out += `${i + 1}. ${plainMath(q.enunciado)}\n` + q.opciones.map((o, k) => `   ${L[k]}) ${plainMath(o)}`).join("\n") + "\n\n";
    });
    if (withKey) out += "*Respuestas:* " + quiz.preguntas.map((q, i) => `${i + 1}${L[q.correcta]}`).join(" · ");
    return out.trim();
  }
  /** LaTeX sencillo → texto legible (para el PDF y WhatsApp). */
  function plainMath(text) {
    return String(text || "").replace(/\$\$?([^$]+)\$\$?/g, (m, f) => {
      for (let i = 0; i < 4; i++) f = f.replace(/\\sqrt\{([^{}]*)\}/g, (x, a) => (/^\w+$/.test(a) ? "√" + a : `√(${a})`))
        .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (x, a, b) => `${/^[\w.]+$/.test(a) ? a : "(" + a + ")"}/${/^[\w.]+$/.test(b) ? b : "(" + b + ")"}`);
      return f.replace(/\\(pm|cdot|times|div|leq?|geq?|neq|pi|approx|infty|degree|circ)\b/g, (x, o) => ({ pm: "±", cdot: "·", times: "×", div: "÷", le: "≤", leq: "≤", ge: "≥", geq: "≥", neq: "≠", pi: "π", approx: "≈", infty: "∞", degree: "°", circ: "°" }[o]))
        .replace(/\^\{?2\}?/g, "²").replace(/\^\{?3\}?/g, "³").replace(/\^\{([^{}]*)\}/g, "^($1)").replace(/_\{([^{}]*)\}/g, "_$1")
        .replace(/\\left|\\right/g, "").replace(/\\[a-zA-Z]+/g, "").replace(/[{}]/g, "").trim();
    });
  }

  // ======================================================================== CALIFICAR LA FOTO DE UN TRABAJO
  function gradePrompt({ consigna, escala }) {
    const e = escala || { min: 1, max: 5 };
    return "Eres un docente de matemáticas en Colombia revisando la foto del trabajo de un estudiante. " +
      (consigna ? `La actividad era: «${consigna}». ` : "Deduce de la foto cuál era la actividad. ") +
      `Revisa el procedimiento paso a paso (no solo el resultado), señala el primer error si lo hay y pon una nota de ${e.min} a ${e.max} (con un decimal). ` +
      "Sé justo y amable; si la foto no se lee, dilo. Las fórmulas en LaTeX entre $…$. " +
      'Devuelve SOLO JSON: {"legible": true, "nota": 4.2, "resumen": "una o dos frases", "aciertos": ["…"], "errores": ["…"], "sugerencia": "qué practicar"}';
  }
  function cleanGrade(obj, escala) {
    const e = escala || { min: 1, max: 5 };
    if (!obj || typeof obj !== "object") return { error: "La IA no devolvió la revisión con el formato esperado." };
    const s = (x, max) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, max);
    const arr = (x) => (Array.isArray(x) ? x : x ? [x] : []).map((y) => s(y, 300)).filter(Boolean).slice(0, 6);
    if (obj.legible === false) return { revision: { legible: false, nota: null, resumen: s(obj.resumen, 400) || "La foto no se lee bien. Toma otra con más luz y de frente.", aciertos: [], errores: [], sugerencia: "" } };
    let nota = parseFloat(String(obj.nota).replace(",", "."));
    if (!isFinite(nota)) return { error: "La IA no puso una nota. Intenta de nuevo." };
    nota = Math.round(Math.max(e.min, Math.min(e.max, nota)) * 10) / 10;
    return { revision: { legible: true, nota, resumen: s(obj.resumen, 400), aciertos: arr(obj.aciertos), errores: arr(obj.errores), sugerencia: s(obj.sugerencia, 300) } };
  }
  /** Desempeño según la escala colombiana (ajustable): bajo, básico, alto, superior. */
  function performance(nota, esc) {
    const e = Object.assign({ basico: 3.0, alto: 4.0, superior: 4.6 }, esc || {});
    if (nota == null) return "";
    return nota >= e.superior ? "superior" : nota >= e.alto ? "alto" : nota >= e.basico ? "básico" : "bajo";
  }

  /** Lo que dice mientras la IA arranca (como el «A ver…» del computador), según lo que preguntaste. */
  const ACKS = { pregunta: ["A ver…", "Déjame ver…", "Buena pregunta…"], pedido: ["Voy con eso…", "Ya te lo preparo…", "Listo, un momento…"], otro: ["Mmm…", "A ver…"] };
  function ackFor(text, rnd = Math.random) {
    const t = norm(text);
    const k = /^(?:que|como|cual|cuales|cuando|donde|quien|por que|cuanto|explica|explicame|dime)\b/.test(t) || /\?$/.test(String(text).trim()) ? "pregunta"
      : /^(?:haz|hazme|crea|creame|escribe|escribeme|redacta|prepara|preparame|dame|genera|ayudame|organiza|planea)\b/.test(t) ? "pedido" : "otro";
    const l = ACKS[k];
    return l[Math.floor(rnd() * l.length) % l.length];
  }

  return { norm, speedOptions, ackFor, toNum, parseNames, namesFromTable, findCourse, pickStudent, shuffle, makeGroups, parseDuration, fmtClock, spokenDuration,
    parseReminder, spokenWhen, intent, PROVIDERS, pickModel, modelsRequest, modelsFrom, chatRequest, parseSSE, deltaText, fullText, apiError,
    extractJSON, takeSentences, forSpeech, mathWords, trimHistory, quizPrompt, cleanQuiz, shuffleQuiz, quizText, plainMath, gradePrompt,
    cleanGrade, performance };
});
