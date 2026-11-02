/* Jarvis para Android · la IA (Gemini, ChatGPT o Claude), directo desde el celular con tu clave. */
(function () {
  "use strict";
  const L = window.JL;
  let ctrl = null;

  /** fetch con tiempo límite: en el celular una conexión puede quedarse colgada sin avisar. */
  function fetchT(url, opts, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return fetch(url, Object.assign({}, opts, { signal: c.signal })).finally(() => clearTimeout(t));
  }
  function cfg() {
    const a = window.JD.load().ajustes;
    return { prov: a.proveedor, key: (a.claves[a.proveedor] || "").trim(), modelo: (a.modelo || "").trim(), a };
  }
  /** El modelo que se usa: el que escribiste en Ajustes, o el rápido de tu cuenta (se revisa cada semana). */
  async function model() {
    const c = cfg();
    if (c.modelo) return c.modelo;
    const cache = c.a.modeloAuto[c.prov];
    if (cache && cache.k === c.key.slice(-6) && Date.now() - cache.t < 7 * 864e5) return cache.m;
    let m = L.PROVIDERS[c.prov].modelo, alt = [];
    try {
      const r = L.modelsRequest(c.prov, c.key);
      const res = await fetchT(r.url, { headers: r.headers }, 6000);
      if (res.ok) { const ids = L.modelsFrom(c.prov, await res.json()); m = L.pickModel(c.prov, ids) || m; alt = L.pickModels(c.prov, ids).filter((x) => x !== m); }
      else if (cache && cache.k === c.key.slice(-6)) return cache.m;                   // no respondió bien: el que ya funcionaba
    } catch (e) { if (cache && cache.k === c.key.slice(-6)) return cache.m; }
    if (m) { c.a.modeloAuto[c.prov] = { m, alt, t: Date.now(), k: c.key.slice(-6) }; window.JD.save(); }
    return m;
  }
  let stopped = false;
  function stop() { stopped = true; if (ctrl) { ctrl.abort(); ctrl = null; } }

  /** Habla con la IA. onDelta(trozo, todo) va llegando en streaming. → texto completo. */
  /** Abre la conexión con la IA antes de preguntar (al tocar el micrófono): ahorra el saludo inicial con el servidor. */
  let warmAt = 0;
  async function warm() {
    const c = cfg();
    if (!c.key || !navigator.onLine || Date.now() - warmAt < 45000) return;
    warmAt = Date.now();
    try {
      const L0 = L.PROVIDERS[c.prov];
      const url = c.prov === "gemini" ? `${L0.base}/models?pageSize=1&key=${encodeURIComponent(c.key)}` : L.modelsRequest(c.prov, c.key).url;
      await fetchT(url, { headers: c.prov === "gemini" ? {} : L.modelsRequest(c.prov, c.key).headers, cache: "no-store" }, 5000);
    } catch (e) { /* solo era para calentar */ }
  }
  let last = { ms: 0 }, fuentes = [];
  /** 3.1: si la IA no arranca, está saturada o se cae la red, Jarvis reintenta solo (y si hace falta usa otro modelo rápido
      de tu cuenta). Solo reintenta si todavía no había llegado nada de la respuesta, para no repetir. */
  async function chat(opts) {
    const c = cfg();
    let m = await model();
    const tried = [];
    for (let intento = 0; intento < 3; intento++) {
      const key = c.prov + ":" + m;
      const fast = !(c.a.sinRapido || {})[key];
      let got = false;
      const o = Object.assign({}, opts, { fast, modelo: m, onDelta: (d, all) => { got = true; if (opts.onDelta) opts.onDelta(d, all); } });
      try { return await chat1(o); }
      catch (e) {
        // el modelo no acepta «sin pensar»: se quita ese ajuste (y se recuerda para la próxima)
        if (fast && e.status === 400 && e.rapido) { c.a.sinRapido = Object.assign(c.a.sinRapido || {}, { [key]: true }); window.JD.save(); intento--; continue; }
        if (got || e.code === "abort" || intento === 2) throw e;
        tried.push(m);
        if (e.status === 404 && !c.modelo) { m = await model(); if (tried.includes(m)) throw e; }
        else if (L.retryable(e)) {
          const cache = c.a.modeloAuto[c.prov] || {};
          const otro = !c.modelo && (intento >= 1 || e.status === 503 || e.status === 529) ? (cache.alt || []).find((x) => !tried.includes(x)) : null;
          if (otro) m = otro;
          if (opts.onAviso) opts.onAviso(otro ? "La IA está saturada; pruebo con otro modelo…" : "La IA no respondió; reintento…");
          await new Promise((r) => setTimeout(r, e.status === 429 ? 2500 : 700));
          if (stopped) throw Object.assign(new Error("Detenido."), { code: "abort" });
        } else throw e;
      }
    }
  }
  async function chat1({ system, messages, onDelta, json = false, maxTokens = 1500, temperature = 0.6, stream = true, fast = true, buscar = false, modelo = "" }) {
    const c = cfg();
    if (!c.key) { const e = new Error("Falta la clave de la IA. Ponla en Ajustes (el engranaje de arriba)."); e.code = "sin_clave"; throw e; }
    if (!navigator.onLine) throw new Error("No hay internet. Las herramientas de la clase siguen funcionando; la IA necesita conexión.");
    const m = modelo || await model();
    const req = L.chatRequest(c.prov, { key: c.key, model: m, system, messages, stream, json, maxTokens, temperature, fast });
    if (buscar && c.prov === "gemini") req.body.tools = [{ google_search: {} }];     // 3.0: «investiga…» con la Búsqueda de Google
    fuentes = [];
    const t0 = performance.now();
    warmAt = Date.now();
    if (ctrl) ctrl.abort();
    stopped = false;
    ctrl = new AbortController();
    const my = ctrl;
    // vigilante: si no llega nada en 15 s (25 s si busca en internet) o la respuesta se queda quieta 20 s, se corta y se reintenta
    let wd = null;
    const watch = (ms) => { clearTimeout(wd); wd = setTimeout(() => my.abort("lento"), ms); };
    watch(buscar ? 25000 : stream ? 15000 : Math.max(25000, maxTokens * 12));
    const tmo = setTimeout(() => my.abort("tiempo"), 120000);
    let res;
    try {
      res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: my.signal });
    } catch (e) {
      clearTimeout(tmo); clearTimeout(wd);
      if (ctrl === my) ctrl = null;
      throw abortErr(my, "", e);
    }
    if (!res.ok) {
      clearTimeout(tmo); clearTimeout(wd);
      if (ctrl === my) ctrl = null;
      let j = null; try { j = await res.json(); } catch (e) { /* sin cuerpo */ }
      const er = new Error(L.apiError(c.prov, res.status, j)); er.status = res.status;
      er.rapido = req.rapido && /think|reason|budget|level|effort|unknown|unsupported|not supported|invalid/i.test(JSON.stringify(j || {}));
      if (res.status === 404 && !c.modelo) { delete c.a.modeloAuto[c.prov]; window.JD.save(); }
      throw er;
    }
    let full = "";
    try {
      if (stream && res.body && res.body.getReader) {
        const rd = res.body.getReader(), dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          watch(20000);
          buf += dec.decode(value, { stream: true });
          const p = L.parseSSE(buf);
          buf = p.resto;
          p.datos.forEach((ev) => {
            if (ev.error) throw new Error(L.apiError(c.prov, 500, ev));
            const gm = c.prov === "gemini" && ev.candidates && ev.candidates[0] && ev.candidates[0].groundingMetadata;
            if (gm && gm.groundingChunks) gm.groundingChunks.forEach((g) => { if (g.web && g.web.uri && !fuentes.some((f) => f.uri === g.web.uri)) fuentes.push({ uri: g.web.uri, titulo: g.web.title || g.web.uri }); });
            const d = L.deltaText(c.prov, ev);
            if (d) { if (!full) last = { ms: Math.round(performance.now() - t0), modelo: m }; full += d; if (onDelta) onDelta(d, full); }
          });
        }
        const tail = L.parseSSE(buf + "\n\n");
        tail.datos.forEach((ev) => { const d = L.deltaText(c.prov, ev); if (d) { full += d; if (onDelta) onDelta(d, full); } });
      } else {
        const j = await res.json();
        full = stream ? L.deltaText(c.prov, j) : L.fullText(c.prov, j);
        if (onDelta && full) onDelta(full, full);
      }
    } catch (e) {
      if (my.signal.aborted) throw abortErr(my, full, e);
      throw e;
    } finally { clearTimeout(tmo); clearTimeout(wd); if (ctrl === my) ctrl = null; }
    if (!full && !json) { const er = new Error("La IA no devolvió texto."); er.code = "lento"; throw er; }
    return full;
  }
  function abortErr(my, full, e) {
    const why = my.signal.aborted ? my.signal.reason : "red";
    const er = new Error(why === "lento" ? "La IA no está respondiendo ahora. Intenta de nuevo en un momento."
      : why === "tiempo" ? "La IA tardó demasiado en responder." : why === "red" ? "No pude conectarme con la IA. Revisa el internet." : "Detenido.");
    er.code = why === "lento" || why === "red" ? why : why === "tiempo" ? "lento" : "abort";
    er.partial = full; er.cause = e;
    return er;
  }
  /** Pide un JSON (quiz, revisión de una foto). → objeto o null. */
  async function json(opts) {
    const t = await chat(Object.assign({ json: true, stream: false, temperature: 0.4, maxTokens: 6000 }, opts));
    return L.extractJSON(t);
  }
  async function test() {
    const t0 = performance.now();
    const t = await chat({ system: "Responde en una sola palabra.", messages: [{ role: "user", content: "Di: listo" }], stream: false, maxTokens: 20 });
    return { ok: true, texto: t.trim(), ms: Math.round(performance.now() - t0), modelo: await model() };
  }
  window.JIA = { chat, json, test, stop, model, warm, last: () => last, fuentes: () => fuentes.slice(), proveedor: () => cfg().prov };
})();
