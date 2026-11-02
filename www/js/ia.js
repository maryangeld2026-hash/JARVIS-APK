/* Jarvis para Android · la IA (Gemini, ChatGPT o Claude), directo desde el celular con tu clave. */
(function () {
  "use strict";
  const L = window.JL;
  let ctrl = null;

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
    let m = L.PROVIDERS[c.prov].modelo;
    try {
      const r = L.modelsRequest(c.prov, c.key);
      const res = await fetch(r.url, { headers: r.headers });
      if (res.ok) m = L.pickModel(c.prov, L.modelsFrom(c.prov, await res.json())) || m;
    } catch (e) { /* sin lista de modelos: el de siempre */ }
    if (m) { c.a.modeloAuto[c.prov] = { m, t: Date.now(), k: c.key.slice(-6) }; window.JD.save(); }
    return m;
  }
  function stop() { if (ctrl) { ctrl.abort(); ctrl = null; } }

  /** Habla con la IA. onDelta(trozo, todo) va llegando en streaming. → texto completo. */
  async function chat({ system, messages, onDelta, json = false, maxTokens = 1500, temperature = 0.6, stream = true }) {
    const c = cfg();
    if (!c.key) { const e = new Error("Falta la clave de la IA. Ponla en Ajustes (el engranaje de arriba)."); e.code = "sin_clave"; throw e; }
    if (!navigator.onLine) throw new Error("No hay internet. Las herramientas de la clase siguen funcionando; la IA necesita conexión.");
    const m = await model();
    const req = L.chatRequest(c.prov, { key: c.key, model: m, system, messages, stream, json, maxTokens, temperature });
    stop();
    ctrl = new AbortController();
    const my = ctrl;
    const tmo = setTimeout(() => my.abort("tiempo"), 60000);
    let res;
    try {
      res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: my.signal });
    } catch (e) {
      clearTimeout(tmo);
      if (my.signal.aborted) { const er = new Error(my.signal.reason === "tiempo" ? "La IA tardó demasiado en responder." : "Detenido."); er.code = "abort"; throw er; }
      throw new Error("No pude conectarme con la IA. Revisa el internet.");
    }
    if (!res.ok) {
      clearTimeout(tmo);
      let j = null; try { j = await res.json(); } catch (e) { /* sin cuerpo */ }
      const er = new Error(L.apiError(c.prov, res.status, j)); er.status = res.status;
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
          buf += dec.decode(value, { stream: true });
          const p = L.parseSSE(buf);
          buf = p.resto;
          p.datos.forEach((ev) => {
            if (ev.error) throw new Error(L.apiError(c.prov, 500, ev));
            const d = L.deltaText(c.prov, ev);
            if (d) { full += d; if (onDelta) onDelta(d, full); }
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
      if (my.signal.aborted) { const er = new Error("Detenido."); er.code = "abort"; er.partial = full; throw er; }
      throw e;
    } finally { clearTimeout(tmo); if (ctrl === my) ctrl = null; }
    return full;
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
  window.JIA = { chat, json, test, stop, model };
})();
