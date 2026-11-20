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
  // 3.26: los modelos que se quedaron sin cupo (Gemini da cupo por modelo): «prov:modelo» → hasta cuándo no se usa
  const sinCupo = {};
  const agotadosDe = (prov) => { const o = {}; Object.keys(sinCupo).forEach((k) => { if (k.startsWith(prov + ":")) o[k.slice(prov.length + 1)] = sinCupo[k]; }); return o; };
  /** Todos los modelos de la cuenta que sirven para conversar, en el orden de la rotación (se guarda con el modelo automático). */
  function rotacion(c) {
    const cache = (c.a.modeloAuto || {})[c.prov] || {};
    return [cache.m].concat(cache.alt || []).filter(Boolean);
  }
  /** El modelo que se usa: el que escribiste en Ajustes, o el rápido de tu cuenta (se revisa cada semana). */
  async function model(c) {
    c = c || cfg();
    if (c.prov === "local") return "local";
    if (c.modelo) return c.modelo;
    c.a.modeloAuto = c.a.modeloAuto || {};
    const cache = c.a.modeloAuto[c.prov];
    const ok = cache && cache.k === cacheKey(c);
    const libre = () => (window.JL16 && window.JL16.siguiente(rotacion(c), [], agotadosDe(c.prov))) || cache.m;
    if (ok && Date.now() - cache.t < 7 * 864e5 && (cache.v || 0) >= 326) return libre();
    let m = c.p.modelo, alt = [];
    try {
      const r = L.modelsRequest(c.prov, c.key, c.base);
      const res = await fetchT(r.url, { headers: r.headers }, 6000);
      if (res.ok) {
        const raw = await res.json();
        const ids = L.modelsFrom(c.prov, raw);
        m = L.pickModel(c.prov, ids) || m || (c.prov === "propio" ? ids[0] : "");
        const L16 = window.JL16;
        // 3.26: la rotación usa TODOS los modelos de la cuenta que conversan (no solo 4)
        alt = (L16 ? L16.ordenar(c.prov === "gemini" ? L16.deGemini(raw) : L16.deOtros(raw), c.p.prefer) : L.pickModels(c.prov, ids)).filter((x) => x !== m);
      } else if (ok) return libre();                                                   // no respondió bien: el que ya funcionaba
    } catch (e) { if (ok) return libre(); }
    if (m) { c.a.modeloAuto[c.prov] = { m, alt, t: Date.now(), k: cacheKey(c), v: 326 }; window.JD.save(); }
    return (window.JL16 && window.JL16.siguiente([m].concat(alt), [], agotadosDe(c.prov))) || m;
  }
  let stopped = false;
  function stop() { stopped = true; if (ctrl) { ctrl.abort(); ctrl = null; } const P = native() && plug("IALocal"); if (P && P.detener) P.detener().catch(() => {}); }

  /** Abre la conexión con la IA antes de preguntar (al tocar el micrófono): ahorra el saludo inicial con el servidor. */
  let warmAt = 0;
  async function warm() {
    const c = cfg();
    // 3.22: se carga de una vez solo si de verdad va a responder (es la principal o no hay internet), y la 12B solo si la escogiste de principal
    const vaLocal = c.prov === "local" || (!navigator.onLine && localListo());
    const pesada = gemmaSt && /12b/i.test(gemmaSt.nombre || "");
    if (vaLocal && gemmaSt && gemmaSt.gemma && (!pesada || c.prov === "local")) { const P = native() && plug("IALocal"); if (P && P.precargar) P.precargar().catch(() => {}); }
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
  // ======================================================================== 3.21: CAMBIO AUTOMÁTICO NUBE ⇄ CELULAR
  // Jarvis escoge solo quién responde: la nube cuando hay buena conexión; el celular (Gemma o Qwen) cuando no hay internet,
  // la conexión está muy lenta, la nube acaba de fallar o se acabó el cupo. Cuando la nube vuelve, regresa solo.
  const ruta = { caida: 0, agotado: {}, modo: "" };
  const nube = (x) => x.prov !== "local" && x.prov !== "propio";
  const localListo = () => !!(gemmaSt && gemmaSt.listo);
  function conexion() {
    const nc = navigator.connection || {};
    // 3.22: ya no se adivina «conexión lenta» por lo que dice el celular (en muchos Android lo reporta mal y mandaba todo al celular)
    return { online: navigator.onLine !== false, lenta: nc.effectiveType === "slow-2g", ahorroDatos: !!nc.saveData };
  }
  /** El orden en que se prueba: → [cfg]. */
  function plan(opts) {
    const a = window.JD.load().ajustes, c = cfg(), b = opts && opts.sinRespaldo ? null : backupCfg();
    const lista = [c];
    if (b) lista.push(b);
    const auto = a.iaAuto !== false && !(opts && opts.sinRespaldo);
    if (auto && localListo() && !lista.some((x) => x.prov === "local")) lista.push(cfgFor("local", false));   // aunque no la pusieras de respaldo
    const hoy = Date.now(), k = conexion();
    const vale = (x) => x.prov === "local" || x.prov === "propio" || !!x.key;
    const mal = (x) => nube(x) && (!k.online || (ruta.agotado[x.prov] || 0) > hoy || (auto && (ruta.caida > hoy || k.lenta)));
    const buenas = lista.filter((x) => vale(x) && !mal(x)), malas = lista.filter((x) => vale(x) && mal(x));
    const out = buenas.concat(malas);
    return out.length ? out : [c];
  }
  function anunciar(modo, cual) {
    if (ruta.modo === modo) return;
    ruta.modo = modo;
    try { window.dispatchEvent(new CustomEvent("jarvis-ia", { detail: { modo, cual } })); } catch (e) { /* nada */ }
  }
  async function chat(opts) {
    const p = plan(opts);
    fuentes = [];
    for (let i = 0; i < p.length; i++) {
      const c = p[i], hay = i < p.length - 1;
      let got = false;
      const o = Object.assign({}, opts, { onDelta: (d, all) => { got = true; if (opts.onDelta) opts.onDelta(d, all); }, rapidoFalla: hay });
      try {
        const t0 = Date.now();
        const t = await via(c, o, hay ? (nube(c) && i === 0 ? 2 : 1) : 3);
        if (window.JDIAG) window.JDIAG.log("ia", `${c.prov} · ${Date.now() - t0} ms${last && last.ms ? " · 1ª palabra " + last.ms + " ms" : ""}`);
        if (nube(c)) { ruta.caida = 0; anunciar("nube", c.p.nombre); } else if (c.prov === "local") anunciar("local", "");
        return t;
      } catch (e) {
        if (window.JDIAG) window.JDIAG.log("ia-falla", `${c.prov} · ${e.code || e.status || ""} · ${String(e.message || "").slice(0, 60)}`);
        if (!hay || got || e.code === "abort" || !(L.retryable(e) || e.code === "sin_internet" || e.code === "sin_clave" || e.code === "sin_local" || e.status === 429 || e.status === 403 || e.status === 401 || e.status === 404)) throw e;
        if (nube(c)) {
          if (e.status === 429) ruta.agotado[c.prov] = Date.now() + 10 * 60000;          // se acabó el cupo: 10 minutos con otra
          else if (e.code === "red" || e.code === "lento" || e.code === "sin_internet") ruta.caida = Date.now() + 60000;   // 3.22: solo si falló la red (no por un error del servidor)
        }
        const sig = p[i + 1];
        if (opts.onAviso) opts.onAviso(e.code === "sin_internet" ? `Sin internet: respondo con ${nombre(sig)}…` : e.status === 429 ? `Se acabó el cupo de ${nombre(c)} por ahora; respondo con ${nombre(sig)}…` : `${nombre(c)} está lenta; respondo con ${nombre(sig)}…`);
      }
    }
  }
  /** Con la nube caída, se revisa en silencio cada tanto si ya volvió (sin gastar una pregunta). */
  async function probarNube() {
    const c = cfg(); if (!nube(c) || !c.key || !navigator.onLine) return;
    try {
      const url = c.prov === "gemini" ? `${c.base}/models?pageSize=1&key=${encodeURIComponent(c.key)}` : L.modelsRequest(c.prov, c.key, c.base).url;
      const r = await fetchT(url, { headers: c.prov === "gemini" ? {} : L.modelsRequest(c.prov, c.key, c.base).headers, cache: "no-store" }, 5000);
      if (r.ok) { ruta.caida = 0; anunciar("nube", c.p.nombre); }
    } catch (e) { /* sigue caída */ }
  }
  setInterval(() => { if (ruta.caida > Date.now() && !document.hidden) probarNube(); }, 30000);
  window.addEventListener("online", () => { ruta.caida = 0; setTimeout(probarNube, 1500); });
  window.addEventListener("offline", () => { if (localListo()) anunciar("local", ""); else anunciar("sin", ""); });   // 3.22: se carga cuando la necesites, no apenas se va el internet
  const nombre = (c) => c.prov === "local" ? (gemmaSt && /qwen/i.test(gemmaSt.nombre || "") ? "Qwen en el celular" : gemmaSt && /gemma/i.test(gemmaSt.nombre || "") ? "Gemma en el celular" : "la IA del celular") : c.p.nombre;

  /** Con un proveedor: si no arranca, está saturado o se cae la red, reintenta (y si hace falta usa otro modelo de la cuenta). */
  async function via(c, opts, intentos) {
    if (c.prov === "local") return localChat(opts);
    if (opts.system && opts.system.indexOf("\u0001") >= 0) opts = Object.assign({}, opts, { system: opts.system.replace("\u0001", " ") });
    let m = await model(c);
    const tried = [];
    let saltos = 0;
    for (let intento = 0; intento < intentos; intento++) {
      const key = c.prov + ":" + m;
      const fast = !(c.a.sinRapido || {})[key];
      let got = false;
      const o = Object.assign({}, opts, { fast, modelo: m, onDelta: (d, all) => { got = true; if (opts.onDelta) opts.onDelta(d, all); } });
      try { return await chat1(c, o); }
      catch (e) {
        // 3.28: el modelo no acepta Google Maps o la Búsqueda: se repite sin esas herramientas
        if (e.status === 400 && (opts.mapas || opts.buscar) && !got) { opts = Object.assign({}, opts, { mapas: false, buscar: false }); intento--; continue; }
        // el modelo no acepta «sin pensar»: se quita ese ajuste (y se recuerda para la próxima)
        if (fast && e.status === 400 && e.rapido) { c.a.sinRapido = Object.assign(c.a.sinRapido || {}, { [key]: true }); window.JD.save(); intento--; continue; }
        if (got || e.code === "abort") throw e;
        // 3.26: sin cupo (o el modelo ya no existe): se pasa al siguiente modelo de la cuenta sin gastar un intento
        if ((e.status === 429 || e.status === 404) && c.a.rotarModelos !== false && saltos < 12 && window.JL16) {
          sinCupo[c.prov + ":" + m] = Date.now() + (e.status === 429 ? 60 * 60000 : 24 * 3600e3);
          tried.push(m);
          const otro = window.JL16.siguiente(rotacion(c), tried, agotadosDe(c.prov));
          if (otro) {
            saltos++;
            if (window.JDIAG) window.JDIAG.log("ia-modelo", `${c.prov} · ${m} ${e.status === 429 ? "sin cupo" : "no disponible"} → ${otro}`);
            if (opts.onAviso && saltos === 1) opts.onAviso(e.status === 429 ? `${m} se quedó sin cupo; sigo con ${otro}…` : `Pruebo con ${otro}…`);
            m = otro; intento--; continue;
          }
          throw e;                                                                     // todos los modelos sin cupo: la siguiente IA
        }
        if (intento === intentos - 1) throw e;
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
  async function chat1(c, { system, messages, onDelta, json = false, maxTokens = 1500, temperature = 0.6, stream = true, fast = true, buscar = false, mapas = false, modelo = "", rapidoFalla = false, aparte = false }) {
    if (!c.key && !c.p.sinClave) { const e = new Error(`Falta la clave de ${c.p.nombre}. Ponla en Ajustes (el engranaje de arriba).`); e.code = "sin_clave"; throw e; }
    if (c.prov === "propio" && !c.base) { const e = new Error("Falta la dirección de tu servidor (Ollama o LM Studio). Ponla en Ajustes."); e.code = "sin_clave"; throw e; }
    if (!navigator.onLine && c.prov !== "propio") { const e = new Error("No hay internet. Las órdenes de la app siguen funcionando; para la IA sin internet, descarga la IA del celular en Ajustes."); e.code = "sin_internet"; throw e; }
    const m = modelo || await model(c);
    if (!m) { const e = new Error(`No encontré un modelo en ${c.p.nombre}. Escríbelo en Ajustes › Modelo.`); e.code = "sin_clave"; throw e; }
    const req = L.chatRequest(c.prov, { key: c.key, model: m, system, messages, stream, json, maxTokens, temperature, fast, base: c.base });
    if (buscar && c.prov === "gemini") req.body.tools = [{ google_search: {} }];     // 3.0: «investiga…» con la Búsqueda de Google
    // 3.28: preguntas de lugares con Google Maps (lugares reales, abiertos, distancias), cerca de donde estás
    if (mapas && c.prov === "gemini") {
      req.body.tools = (req.body.tools || []).concat([{ googleMaps: {} }]);
      if (mapas.lat != null && mapas.lng != null) req.body.toolConfig = { retrievalConfig: { latLng: { latitude: +mapas.lat, longitude: +mapas.lng } } };
    }
    if (!aparte) fuentes = [];
    const t0 = performance.now();
    warmAt = Date.now();
    // 3.26: el probador hace varias peticiones a la vez («aparte»): no cortan la conversación ni se cortan entre ellas
    let my;
    if (aparte) my = new AbortController();
    else { if (ctrl) ctrl.abort(); stopped = false; ctrl = new AbortController(); my = ctrl; }
    // vigilante: si no llega nada a tiempo, o la respuesta se queda quieta 20 s, se corta (y se reintenta o pasa a la de respaldo)
    let wd = null;
    const watch = (ms) => { clearTimeout(wd); wd = setTimeout(() => my.abort("lento"), ms); };
    const first = c.prov === "propio" ? 60000 : buscar ? 25000 : stream ? (rapidoFalla ? 7000 : 15000) : Math.max(25000, maxTokens * 12);   // 3.21: con el celular de respaldo, se espera menos
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
            if (gm && gm.groundingChunks) gm.groundingChunks.forEach((g) => {
              const w = g.web || g.maps;                                                 // 3.28: también los lugares de Google Maps
              if (w && w.uri && !fuentes.some((f) => f.uri === w.uri)) fuentes.push({ uri: w.uri, titulo: (g.maps ? "📍 " : "") + (w.title || w.uri), mapa: !!g.maps });
            });
            const d = L.deltaText(c.prov, ev);
            if (d) { if (!full && !aparte) last = { ms: Math.round(performance.now() - t0), modelo: m, prov: c.prov }; full += d; if (onDelta) onDelta(d, full); }
          });
        }
        const tail = L.parseSSE(buf + "\n\n");
        tail.datos.forEach((ev) => { const d = L.deltaText(c.prov, ev); if (d) { full += d; if (onDelta) onDelta(d, full); } });
      } else {
        const j = await res.json();
        full = stream ? L.deltaText(c.prov, j) : L.fullText(c.prov, j);
        if (!aparte) last = { ms: Math.round(performance.now() - t0), modelo: m, prov: c.prov };
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
    if (gemma) { const h = fijo.match(/\s*Hoy es [^\n]*?son las \d{1,2}:\d{2}(?:\s*[ap]\.\s?m\.)?\.*\s*/); if (h) { fijo = fijo.replace(h[0], " "); cambia = h[0].trim() + " " + cambia; } }
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
      let r;
      try { r = await P.generar({ prompt, sistema: sys, mensajes, imagenes, maxTokens: Math.min(Math.max(256, maxTokens), gemma ? 2048 : 1024), temperatura: json ? 0.3 : 0.7 }); }
      catch (e) {                                                     // 3.20: Gemma 4 12B sin memoria libre suficiente
        const mm = String((e && e.message) || "").match(/memoria:(\d+)/);
        if (mm) throw Object.assign(new Error(`Gemma 4 12B necesita unos 7 GB de memoria libre y ahora hay ${(mm[1] / 1024).toFixed(1).replace(".", ",")} GB. Cierra otras apps o di «usa Gemma E4B».`), { code: "sin_local" });
        throw e;
      }
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
      if (m === "nunca" || !gemmaSt || !gemmaSt.listo || !gemmaSt.gemma || gemmaSt.oye === false || /12b/i.test(gemmaSt.nombre || "")) return false;   // 3.19: solo los modelos que oyen (Gemma 4)
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
  /** 3.26: el probador. Un modelo exacto de un proveedor → {ok, ms, texto} o {ok: false, error}. */
  async function probarModelo(prov, modelo) {
    const c = cfgFor(prov, false);
    c.modelo = modelo;
    const t0 = performance.now();
    try {
      const t = await chat1(c, { system: "Responde en una sola palabra.", messages: [{ role: "user", content: "Di: listo" }], stream: false, maxTokens: 30, modelo, fast: true, aparte: true });
      const ms = Math.round(performance.now() - t0);
      delete sinCupo[prov + ":" + modelo];
      return { ok: true, ms, texto: String(t || "").trim() };
    } catch (e) {
      if (e.status === 400 && e.rapido) {                                              // no acepta «sin pensar»: se prueba sin ese ajuste
        try { const t = await chat1(c, { system: "Responde en una sola palabra.", messages: [{ role: "user", content: "Di: listo" }], stream: false, maxTokens: 30, modelo, fast: false, aparte: true }); return { ok: true, ms: Math.round(performance.now() - t0), texto: String(t || "").trim() }; } catch (e2) { e = e2; }
      }
      if (e.status === 429) sinCupo[prov + ":" + modelo] = Date.now() + 60 * 60000;
      return { ok: false, ms: Math.round(performance.now() - t0), error: { status: e.status || 0, code: e.code || "", message: e.message || String(e) } };
    }
  }
  /** Todos los modelos de la cuenta de un proveedor (para la lista y el probador). → [{id, nombre}] */
  async function modelosCuenta(prov) {
    const c = cfgFor(prov, false);
    if (!c.key && !c.p.sinClave) throw Object.assign(new Error(`Falta la clave de ${c.p.nombre}.`), { code: "sin_clave" });
    const r = L.modelsRequest(prov, c.key, c.base);
    const res = await fetchT(r.url, { headers: r.headers, cache: "no-store" }, 10000);
    if (!res.ok) { let j = null; try { j = await res.json(); } catch (e) { /* nada */ } throw Object.assign(new Error(L.apiError(prov, res.status, j)), { status: res.status }); }
    const raw = await res.json();
    const L16 = window.JL16;
    const lista = prov === "gemini" ? L16.deGemini(raw) : L16.deOtros(raw);
    const orden = L16.ordenar(lista, c.p.prefer);
    const por = {}; lista.forEach((x) => (por[x.id] = x));
    return orden.map((id) => por[id] || { id });
  }
  async function test(prov) {
    const t0 = performance.now();
    const c = prov ? cfgFor(prov, prov === cfg().prov) : cfg();
    const t = await via(c, { system: "Responde en una sola palabra.", messages: [{ role: "user", content: "Di: listo" }], stream: false, maxTokens: c.prov === "local" ? 256 : 20 }, 1);
    return { ok: true, texto: t.trim(), ms: Math.round(performance.now() - t0), modelo: await model(c) };
  }
  window.JIA = { chat, json, test, probarModelo, modelosCuenta, sinCupo: () => Object.assign({}, sinCupo), rotacion: (prov) => rotacion(cfgFor(prov || cfg().prov, false)), stop, model, warm, last: () => last, fuentes: () => fuentes.slice(), proveedor: () => cfg().prov, cfgFor, plan: (o) => plan(o || {}).map((x) => x.prov), ruta: () => Object.assign({}, ruta) };
})();
