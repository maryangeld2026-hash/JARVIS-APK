/* Jarvis para Android · la IA, directo desde el celular con tu clave: Gemini, ChatGPT, Claude, Groq, OpenRouter, DeepSeek,
   Mistral, tu propio servidor (Ollama o LM Studio en el PC) o la IA del celular (sin internet).
   3.2: IA de respaldo. Si no hay internet o la principal está lenta o saturada, Jarvis responde con la de respaldo. */
(function () {
  "use strict";
  const L = window.JL;
  let ctrl = null;
  const plug = (n) => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  /** fetch con tiempo límite: en el celular una conexión puede quedarse colgada sin avisar. */
  function fetchT(url, opts, ms) {
    const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
    return fetch(url, Object.assign({}, opts, { signal: c.signal })).finally(() => clearTimeout(t));
  }
  /** La configuración de un proveedor. principal: el de Ajustes (con su modelo escrito a mano, si lo hay). */
  function cfgFor(prov, principal) {
    const a = window.JD.load().ajustes;
    const p = L.PROVIDERS[prov] || {};
    return { prov, p, key: ((a.claves || {})[prov] || "").trim(), modelo: principal ? (a.modelo || "").trim() : "",
      base: prov === "propio" ? (a.propioUrl || "").trim().replace(/\/+$/, "") : p.base, a };
  }
  const cfg = () => cfgFor(window.JD.load().ajustes.proveedor, true);
  function backupCfg() {
    const a = window.JD.load().ajustes;
    if (!a.respaldo || a.respaldo === a.proveedor || !L.PROVIDERS[a.respaldo]) return null;
    const c = cfgFor(a.respaldo, false);
    if (c.prov === "local") return c;
    if (c.prov === "propio") return c.base ? c : null;
    return c.key ? c : null;
  }
  const cacheKey = (c) => (c.key || "").slice(-6) + "|" + (c.prov === "propio" ? c.base : "");

  /** El modelo que se usa: el que escribiste en Ajustes, o el rápido de tu cuenta (se revisa cada semana). */
  async function model(c) {
    c = c || cfg();
    if (c.prov === "local") return "local";
    if (c.modelo) return c.modelo;
    const cache = c.a.modeloAuto[c.prov];
    const ok = cache && cache.k === cacheKey(c);
    if (ok && Date.now() - cache.t < 7 * 864e5) return cache.m;
    let m = c.p.modelo, alt = [];
    try {
      const r = L.modelsRequest(c.prov, c.key, c.base);
      const res = await fetchT(r.url, { headers: r.headers }, 6000);
      if (res.ok) {
        const ids = L.modelsFrom(c.prov, await res.json());
        m = L.pickModel(c.prov, ids) || m || (c.prov === "propio" ? ids[0] : "");
        alt = L.pickModels(c.prov, ids).filter((x) => x !== m);
      } else if (ok) return cache.m;                                                   // no respondió bien: el que ya funcionaba
    } catch (e) { if (ok) return cache.m; }
    if (m) { c.a.modeloAuto[c.prov] = { m, alt, t: Date.now(), k: cacheKey(c) }; window.JD.save(); }
    return m;
  }
  let stopped = false;
  function stop() { stopped = true; if (ctrl) { ctrl.abort(); ctrl = null; } const P = native() && plug("IALocal"); if (P && P.detener) P.detener().catch(() => {}); }

  /** Abre la conexión con la IA antes de preguntar (al tocar el micrófono): ahorra el saludo inicial con el servidor. */
  let warmAt = 0;
  async function warm() {
    const c = cfg();
    // 3.15: si va a responder Gemma (es la principal, o no hay internet y es la de respaldo), se carga de una vez
    const bk = backupCfg();
    if ((c.prov === "local" || (!navigator.onLine && bk && bk.prov === "local")) && gemmaSt && gemmaSt.gemma) { const P = native() && plug("IALocal"); if (P && P.precargar) P.precargar().catch(() => {}); }
    if (c.a.ahorroActivo) return;                               // 3.7.1: en modo ahorro no se calienta la conexión
    if (c.prov === "local" || (!c.key && !c.p.sinClave) || !navigator.onLine || Date.now() - warmAt < 45000) return;
    warmAt = Date.now();
    try {
      const url = c.prov === "gemini" ? `${c.base}/models?pageSize=1&key=${encodeURIComponent(c.key)}` : L.modelsRequest(c.prov, c.key, c.base).url;
      await fetchT(url, { headers: c.prov === "gemini" ? {} : L.modelsRequest(c.prov, c.key, c.base).headers, cache: "no-store" }, 5000);
    } catch (e) { /* solo era para calentar */ }
  }
  let last = { ms: 0 }, fuentes = [];

  /** Habla con la IA. onDelta(trozo, todo) va llegando en streaming. → texto completo.
      Si la principal no puede (sin internet, lenta, saturada) y hay IA de respaldo, responde la de respaldo. */
  async function chat(opts) {
    const c = cfg(), b = opts.sinRespaldo ? null : backupCfg();
    const nube = (x) => x.prov !== "local" && x.prov !== "propio";
    if (!navigator.onLine && nube(c) && b && !nube(b)) {
      if (opts.onAviso) opts.onAviso(`Sin internet: respondo con ${nombre(b)}…`);
      return via(b, opts, 3);
    }
    let got = false;
    const o = Object.assign({}, opts, { onDelta: (d, all) => { got = true; if (opts.onDelta) opts.onDelta(d, all); }, rapidoFalla: !!b });
    try { return await via(c, o, b ? 1 : 3); }
    catch (e) {
      if (!b || got || e.code === "abort" || !(L.retryable(e) || e.code === "sin_internet" || e.code === "sin_clave" || e.code === "sin_local")) throw e;
      if (opts.onAviso) opts.onAviso(e.code === "sin_internet" ? `Sin internet: respondo con ${nombre(b)}…` : `La IA principal está lenta; respondo con ${nombre(b)}…`);
      return via(b, opts, 2);
    }
  }
  const nombre = (c) => c.prov === "local" ? "la IA del celular" : c.p.nombre;

  /** Con un proveedor: si no arranca, está saturado o se cae la red, reintenta (y si hace falta usa otro modelo de la cuenta). */
  async function via(c, opts, intentos) {
    if (c.prov === "local") return localChat(opts);
    if (opts.system && opts.system.indexOf("\u0001") >= 0) opts = Object.assign({}, opts, { system: opts.system.replace("\u0001", " ") });
    let m = await model(c);
    const tried = [];
    for (let intento = 0; intento < intentos; intento++) {
      const key = c.prov + ":" + m;
      const fast = !(c.a.sinRapido || {})[key];
      let got = false;
      const o = Object.assign({}, opts, { fast, modelo: m, onDelta: (d, all) => { got = true; if (opts.onDelta) opts.onDelta(d, all); } });
      try { return await chat1(c, o); }
      catch (e) {
        // el modelo no acepta «sin pensar»: se quita ese ajuste (y se recuerda para la próxima)
        if (fast && e.status === 400 && e.rapido) { c.a.sinRapido = Object.assign(c.a.sinRapido || {}, { [key]: true }); window.JD.save(); intento--; continue; }
        if (got || e.code === "abort" || intento === intentos - 1) throw e;
        tried.push(m);
        if (e.status === 404 && !c.modelo) { m = await model(c); if (tried.includes(m)) throw e; }
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
  async function chat1(c, { system, messages, onDelta, json = false, maxTokens = 1500, temperature = 0.6, stream = true, fast = true, buscar = false, modelo = "", rapidoFalla = false }) {
    if (!c.key && !c.p.sinClave) { const e = new Error(`Falta la clave de ${c.p.nombre}. Ponla en Ajustes (el engranaje de arriba).`); e.code = "sin_clave"; throw e; }
    if (c.prov === "propio" && !c.base) { const e = new Error("Falta la dirección de tu servidor (Ollama o LM Studio). Ponla en Ajustes."); e.code = "sin_clave"; throw e; }
    if (!navigator.onLine && c.prov !== "propio") { const e = new Error("No hay internet. Las órdenes de la app siguen funcionando; para la IA sin internet, descarga la IA del celular en Ajustes."); e.code = "sin_internet"; throw e; }
    const m = modelo || await model(c);
    if (!m) { const e = new Error(`No encontré un modelo en ${c.p.nombre}. Escríbelo en Ajustes › Modelo.`); e.code = "sin_clave"; throw e; }
    const req = L.chatRequest(c.prov, { key: c.key, model: m, system, messages, stream, json, maxTokens, temperature, fast, base: c.base });
    if (buscar && c.prov === "gemini") req.body.tools = [{ google_search: {} }];     // 3.0: «investiga…» con la Búsqueda de Google
    fuentes = [];
    const t0 = performance.now();
    warmAt = Date.now();
    if (ctrl) ctrl.abort();
    stopped = false;
    ctrl = new AbortController();
    const my = ctrl;
    // vigilante: si no llega nada a tiempo, o la respuesta se queda quieta 20 s, se corta (y se reintenta o pasa a la de respaldo)
    let wd = null;
    const watch = (ms) => { clearTimeout(wd); wd = setTimeout(() => my.abort("lento"), ms); };
    const first = c.prov === "propio" ? 60000 : buscar ? 25000 : stream ? (rapidoFalla ? 9000 : 15000) : Math.max(25000, maxTokens * 12);
    watch(first);
    const tmo = setTimeout(() => my.abort("tiempo"), 120000);
    let res;
    try {
      res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: my.signal });
    } catch (e) {
      clearTimeout(tmo); clearTimeout(wd);
      if (ctrl === my) ctrl = null;
      throw abortErr(my, "", e, c);
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
            if (d) { if (!full) last = { ms: Math.round(performance.now() - t0), modelo: m, prov: c.prov }; full += d; if (onDelta) onDelta(d, full); }
          });
        }
        const tail = L.parseSSE(buf + "\n\n");
        tail.datos.forEach((ev) => { const d = L.deltaText(c.prov, ev); if (d) { full += d; if (onDelta) onDelta(d, full); } });
      } else {
        const j = await res.json();
        full = stream ? L.deltaText(c.prov, j) : L.fullText(c.prov, j);
        last = { ms: Math.round(performance.now() - t0), modelo: m, prov: c.prov };
        if (onDelta && full) onDelta(full, full);
      }
    } catch (e) {
      if (my.signal.aborted) throw abortErr(my, full, e, c);
      throw e;
    } finally { clearTimeout(tmo); clearTimeout(wd); if (ctrl === my) ctrl = null; }
    if (!full && !json) { const er = new Error("La IA no devolvió texto."); er.code = "lento"; throw er; }
    return full;
  }
  function abortErr(my, full, e, c) {
    const why = my.signal.aborted ? my.signal.reason : "red";
    const er = new Error(why === "lento" ? "La IA no está respondiendo ahora. Intenta de nuevo en un momento."
      : why === "tiempo" ? "La IA tardó demasiado en responder."
      : why === "red" ? (c && c.prov === "propio" ? "No pude conectarme con tu servidor. Revisa que el PC esté encendido, en el mismo wifi, y la dirección en Ajustes." : "No pude conectarme con la IA. Revisa el internet.")
      : "Detenido.");
    er.code = why === "lento" || why === "red" ? why : why === "tiempo" ? "lento" : "abort";
    er.partial = full; er.cause = e;
    return er;
  }

  // ======================================================================== IA DEL CELULAR (sin internet)
  /** El modelo pequeño corre dentro del celular (IALocal.java, con MediaPipe). Más lento y sencillo, pero no necesita internet. */
  async function localChat({ system, messages, onDelta, json = false, maxTokens = 700 }) {
    const P = native() && plug("IALocal");
    if (!P) throw Object.assign(new Error("La IA del celular funciona en la app instalada (el APK)."), { code: "sin_local" });
    const st = await P.estado().catch(() => ({}));
    if (!st.listo) throw Object.assign(new Error("La IA del celular no está descargada. Ve a Ajustes › IA de respaldo y toca «Descargar»."), { code: "sin_local" });
    if ((!st.gemma || st.ve === false) && messages.some((m) => m.image || m.doc)) throw new Error("La IA del celular que estás usando no ve fotos ni PDF. Usa Gemma 4 o Qwen 3.5 con visión (Ajustes › IA de respaldo) para que los vea sin internet.");
    const imagenes = messages.filter((m) => m.image).slice(-4).map((m) => ({ data: m.image.data, mime: m.image.mime }));
    // 3.14: un PDF sin internet: sus primeras páginas como imágenes para Gemma
    let notaPdf = "";
    const pdf = messages.filter((m) => m.doc && m.doc.data).slice(-1)[0];
    if (pdf && P.pdfPaginas) {
      const r = await P.pdfPaginas({ data: pdf.doc.data, max: Math.max(1, 4 - imagenes.length) });
      (r.paginas || []).forEach((d) => imagenes.push({ data: d, mime: "image/jpeg" }));
      if (r.total > (r.paginas || []).length) notaPdf = `\n\n(Del PDF de ${r.total} páginas solo pude ver las primeras ${(r.paginas || []).length}.)`;
    }
    const gemma = /\.litertlm$/.test(st.nombre || "");           // 3.12: Gemma 4 entiende instrucciones largas y la conversación completa
    // 3.15: para Gemma, la instrucción fija va aparte (se reutiliza entre preguntas: responde más rápido) y lo que cambia
    // (la hora, lo que recuerdo de ti para esta pregunta) va junto a tu mensaje
    let fijo = String(system || ""), cambia = "";
    const k = fijo.indexOf("\u0001");
    if (k >= 0) { cambia = fijo.slice(k + 1).trim(); fijo = fijo.slice(0, k); }
    if (gemma) { const h = fijo.match(/\s*Hoy es [^.]+, son las [^.]+\.\s*/); if (h) { fijo = fijo.replace(h[0], " "); cambia = h[0].trim() + " " + cambia; } }
    const sys = fijo.slice(0, gemma ? 5000 : 900) + (st.familia === "qwen35" ? " Responde directamente, sin mostrar tu razonamiento." : "") + " Responde en español" + (gemma ? ". Si te piden explicar algo, explícalo completo y en orden." : ", breve.") + (json ? " Responde SOLO con el objeto JSON pedido, sin texto antes ni después." : "") + (gemma ? "" : " " + cambia.slice(0, 400));
    const prompt = L.localPrompt(sys, messages.map((m) => ({ role: m.role, content: m.content })));
    const mensajes = messages.slice(gemma ? -8 : -10).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content || "").slice(0, gemma ? 1800 : 4000) }));
    if (gemma && cambia && mensajes.length && mensajes[mensajes.length - 1].role === "user") mensajes[mensajes.length - 1].content = `(${cambia.slice(0, 1200)})\n\n${mensajes[mensajes.length - 1].content}`;
    if (gemma && maxTokens === 700) maxTokens = 1800;                // las explicaciones largas ya no se cortan
    const t0 = performance.now();
    stopped = false;
    let h = null, parcial = "";
    if (onDelta) h = await window.JON(P, "parcial", (d) => { if (stopped || !d || !d.texto) return; if (!parcial) last = { ms: Math.round(performance.now() - t0), modelo: "IA del celular", prov: "local" }; parcial = L.cleanLocal(d.texto); onDelta("", parcial); });
    try {
      const r = await P.generar({ prompt, sistema: sys, mensajes, imagenes, maxTokens: Math.min(Math.max(256, maxTokens), gemma ? 2048 : 1024), temperatura: json ? 0.3 : 0.7 });
      if (stopped) throw Object.assign(new Error("Detenido."), { code: "abort" });
      const text = L.cleanLocal(r && r.texto) + (notaPdf || "");
      if (!parcial) last = { ms: Math.round(performance.now() - t0), modelo: (r && r.motor) || "IA del celular", prov: "local" };
      if (onDelta && text && text !== parcial) onDelta(text.slice(parcial.length), text);
      if (!text) throw new Error("La IA del celular no devolvió texto.");
      return text;
    } finally { if (h && h.remove) h.remove(); }
  }

  // ======================================================================== 3.13: Gemma 4 entiende tu voz sin internet
  let gemmaSt = null;
  async function gemmaEstado() { const P = native() && plug("IALocal"); if (!P) return null; try { gemmaSt = await P.estado(); } catch (e) { gemmaSt = null; } return gemmaSt; }
  setTimeout(gemmaEstado, 3000);
  window.addEventListener("offline", gemmaEstado);
  window.__gemmaVoz = {
    refrescar: gemmaEstado,
    usar() {
      const m = (window.JD.load().ajustes.vozGemma) || "sin_internet";
      if (m === "nunca" || !gemmaSt || !gemmaSt.listo || !gemmaSt.gemma || gemmaSt.oye === false) return false;   // 3.19: solo los modelos que oyen (Gemma 4)
      return m === "siempre" || !navigator.onLine;
    },
    async oir(onPartial, opts) {
      const P = plug("IALocal");
      if (onPartial) onPartial("🎙️ Te escucho (Gemma, sin internet)…");
      const g = await P.grabar({ maxSeg: 20, esperaMs: (opts && opts.espera) || 8000 });
      if (!g || !g.hablo) return "";
      if (onPartial) onPartial("Entendiendo lo que dijiste…");
      const r = await P.generar({ sistema: "Eres un transcriptor exacto de audio en español de Colombia.", mensajes: [{ role: "user", content: "Escribe exactamente lo que dice la persona en este audio, en español, sin comillas y sin explicar nada más. Si no se entiende nada, responde solo: (nada)" }],
        audio: g.ruta, maxTokens: 220, temperatura: 0 });
      let t = L.cleanLocal((r && r.texto) || "").trim().replace(/^["«]|["»]$/g, "");
      if (/^\(?nada\)?\.?$/i.test(t)) t = "";
      return t;
    },
    parar() { const P = native() && plug("IALocal"); if (P && P.pararGrabacion) P.pararGrabacion().catch(() => {}); },
  };

  /** Pide un JSON (quiz, revisión de una foto). → objeto o null. */
  async function json(opts) {
    const t = await chat(Object.assign({ json: true, stream: false, temperature: 0.4, maxTokens: 6000 }, opts));
    return L.extractJSON(t);
  }
  async function test(prov) {
    const t0 = performance.now();
    const c = prov ? cfgFor(prov, prov === cfg().prov) : cfg();
    const t = await via(c, { system: "Responde en una sola palabra.", messages: [{ role: "user", content: "Di: listo" }], stream: false, maxTokens: c.prov === "local" ? 256 : 20 }, 1);
    return { ok: true, texto: t.trim(), ms: Math.round(performance.now() - t0), modelo: await model(c) };
  }
  window.JIA = { chat, json, test, stop, model, warm, last: () => last, fuentes: () => fuentes.slice(), proveedor: () => cfg().prov, cfgFor };
})();
