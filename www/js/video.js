/* Jarvis para Android 3.39 · videos:
   «hazme un video de…» → primero Veo de Google (video hecho por IA, si tu clave de Gemini lo permite: el plan gratis no hace videos);
   si no, gratis: Jarvis arma en el celular un video de 15 a 30 s con imágenes de IA, movimiento suave, textos y su voz.
   Y el atajo a Infinall para anuncios (abre la página con la descripción copiada). Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL26, L25 = window.JL25, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const aj = () => D.ajustes;
  const R = (t, cls, sp) => A.reply(t, cls || "tool", sp);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const clave = (p) => (((aj().claves || {})[p]) || "").trim();
  const hoy = () => new Date().toDateString();
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const hayIA = () => aj().proveedor === "local" || !!clave(aj().proveedor);
  const sinNombres = (t) => (X._a338 && X._a338.sinNombres ? X._a338.sinNombres(t) : t);
  let ocupado = false, modelos = null, ultimo = null;

  async function listaModelos() {
    if (modelos) return modelos;
    const key = clave("gemini"); if (!key) return [];
    try { const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`); modelos = r.ok ? ((await r.json()).models || []).map((m) => String(m.name).replace(/^models\//, "")) : []; } catch (e) { modelos = []; }
    return modelos;
  }
  /** Un mensaje que va diciendo cómo va. */
  function avance(texto) {
    const { m, e } = A.add("assistant", texto, "tool");
    return (t) => { m.content = t; e.innerHTML = A.md(t); };
  }
  const b64DeBlob = (bl) => new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(",")[1]); f.onerror = () => no(new Error("No pude leer el video.")); f.readAsDataURL(bl); });
  const blobDeB64 = (b64, mime) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };

  // ======================================================================== 1. VEO (video hecho por IA, con clave que lo permita)
  async function conVeo(o, paso) {
    const key = clave("gemini");
    if (!key || aj().videoVeo === false || aj().vidVeoNo === hoy()) return null;
    const m = L.veoModelo(await listaModelos()); if (!m) return null;
    paso("🎬 Pidiéndole el video a Veo de Google…");
    const H = { "x-goog-api-key": key, "content-type": "application/json" };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:predictLongRunning`, { method: "POST", headers: H,
      body: JSON.stringify({ instances: [{ prompt: sinNombres(o.desc) + ". Si alguien habla, que sea en español." }], parameters: { aspectRatio: o.formato === "horizontal" ? "16:9" : "9:16" } }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const msg = (j.error || {}).message || ""; if (L.sinCupo(r.status, msg)) { aj().vidVeoNo = hoy(); save(); } throw new Error("Veo " + r.status + (msg ? ": " + msg.slice(0, 90) : "")); }
    const nombre = j.name; if (!nombre) throw new Error("Veo no devolvió el trabajo.");
    const t0 = Date.now();
    let op = j;
    while (!op.done) {
      if (Date.now() - t0 > 7 * 60000) throw new Error("Veo tardó demasiado.");
      paso(`🎬 Veo está haciendo tu video… (${Math.round((Date.now() - t0) / 1000)} s; suele tardar 1 o 2 minutos)`);
      await dormir(8000);
      const rp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${nombre}`, { headers: H });
      op = await rp.json().catch(() => ({}));
      if (op.error) throw new Error("Veo: " + (op.error.message || "falló"));
    }
    const muestra = ((((op.response || {}).generateVideoResponse || {}).generatedSamples || [])[0] || {}).video || {};
    if (!muestra.uri) throw new Error("Veo no devolvió el video (puede que la descripción no esté permitida).");
    paso("🎬 Descargando el video…");
    let b64;
    const Hh = plug("CapacitorHttp");
    if (Hh) { try { const d = await Hh.request({ method: "GET", url: muestra.uri, headers: { "x-goog-api-key": key }, responseType: "blob", readTimeout: 180000 }); if (typeof d.data === "string" && d.data.length > 100) b64 = d.data; } catch (e) { /* se intenta directo */ } }
    if (!b64) { const rv = await fetch(muestra.uri, { headers: { "x-goog-api-key": key } }); if (!rv.ok) throw new Error("No pude descargar el video de Veo."); b64 = await b64DeBlob(await rv.blob()); }
    return { b64, mime: "video/mp4", por: "Veo de Google (video hecho por IA)" };
  }

  // ======================================================================== 2. EL VIDEO GRATIS, HECHO EN EL CELULAR
  async function vozNarrada(texto) {
    const key = clave("gemini");
    if (!texto || !key || aj().videoVoz === false || aj().vozIAagotada === hoy() || !window.AudioContext) return null;
    const tts = (await listaModelos()).filter((x) => /tts/i.test(x)).sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a))[0];
    if (!tts) return null;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${tts}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: texto }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: aj().vozIAnombre || "Charon" } } } } }) });
      if (!r.ok) return null;
      const j = await r.json(), p = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((x) => x.inlineData || x.inline_data);
      if (!p) return null;
      const d = p.inlineData || p.inline_data, rate = +((String(d.mimeType || d.mime_type).match(/rate=(\d+)/) || [])[1] || 24000);
      const bin = Uint8Array.from(atob(d.data), (c) => c.charCodeAt(0)), pcm = new Int16Array(bin.buffer, 0, bin.length >> 1);
      return { pcm, rate };
    } catch (e) { return null; }
  }
  const cargarImg = (src) => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error("No pude abrir una imagen.")); im.src = src; });

  /** Graba el video en el celular: cada imagen con movimiento suave, fundido entre escenas, el texto abajo y la voz. → Blob */
  function grabar(imgs, escenas, formato, voz) {
    return new Promise((ok, no) => {
      if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return no(new Error("Este celular no permite grabar videos desde la app."));
      const [W, H] = L.TAM[formato] || L.TAM.vertical;
      const cv = mk("canvas"); cv.width = W; cv.height = H; const g = cv.getContext("2d");
      const stream = cv.captureStream(30);
      let ac = null, total = 0;
      if (voz) {
        ac = new AudioContext(); const dest = ac.createMediaStreamDestination();
        const buf = ac.createBuffer(1, voz.pcm.length, voz.rate), ch = buf.getChannelData(0); for (let i = 0; i < voz.pcm.length; i++) ch[i] = voz.pcm[i] / 32768;
        const src = ac.createBufferSource(); src.buffer = buf; src.connect(dest); voz.src = src; total = buf.duration;
        dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      }
      const dur = L.tiempos(escenas, total), fin = dur.reduce((a, b) => a + b, 0);
      const mime = L.mimeVideo((m) => MediaRecorder.isTypeSupported(m));
      let rec; try { rec = new MediaRecorder(stream, Object.assign({ videoBitsPerSecond: 3500000 }, mime ? { mimeType: mime } : {})); } catch (e) { return no(new Error("No pude empezar a grabar: " + e.message)); }
      const partes = []; rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) partes.push(ev.data); };
      rec.onstop = () => { try { if (ac) ac.close(); } catch (e) { /* nada */ } ok(new Blob(partes, { type: (rec.mimeType || mime || "video/webm").replace(/;.*$/, "") })); };
      const pinta = (im, i, p, alfa) => {
        const c = L.camara(i, p), k = Math.max(W / im.width, H / im.height) * c.s, w = im.width * k, h = im.height * k;
        g.globalAlpha = alfa; g.drawImage(im, (W - w) / 2 + c.x * W, (H - h) / 2 + c.y * H, w, h); g.globalAlpha = 1;
      };
      const letrero = (txt, alfa) => {
        if (!txt) return;
        const fs = Math.round(W * 0.06); g.font = `700 ${fs}px sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        const ls = L.renglones(txt, W * 0.84, (s) => g.measureText(s).width), alto = ls.length * fs * 1.25 + fs;
        g.globalAlpha = 0.55 * alfa; g.fillStyle = "#000"; g.fillRect(0, H - alto - H * 0.08, W, alto);
        g.globalAlpha = alfa; g.fillStyle = "#fff"; ls.forEach((l, k) => g.fillText(l, W / 2, H - H * 0.08 - alto + fs * 0.9 + k * fs * 1.25)); g.globalAlpha = 1;
      };
      const t0 = performance.now(), FUNDIDO = 0.6;
      const cuadro = () => {
        const t = (performance.now() - t0) / 1000;
        let i = 0, ini = 0; while (i < dur.length - 1 && t >= ini + dur[i]) { ini += dur[i]; i++; }
        const p = Math.min(1, (t - ini) / dur[i]);
        g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
        pinta(imgs[i], i, p, 1);
        const falta = ini + dur[i] - t;
        if (i < dur.length - 1 && falta < FUNDIDO) pinta(imgs[i + 1], i + 1, 0, 1 - falta / FUNDIDO);
        letrero(escenas[i].texto, Math.min(1, (t - ini) / 0.4));
        if (t >= fin + 0.3) { clearInterval(reloj); if (rec.state !== "inactive") rec.stop(); }
      };
      rec.start(500); cuadro();
      const reloj = setInterval(cuadro, 1000 / 30);
      if (voz && voz.src) voz.src.start();
    });
  }

  async function hechoEnCelular(o, paso) {
    const soloGratisLento = !clave("sensenova") && (!clave("gemini") || aj().imgGeminiNo === hoy());
    const n = soloGratisLento ? 3 : 5;
    paso("🎬 Escribiendo el guion…");
    let guion = null;
    if (hayIA() && navigator.onLine) { try { guion = L.escenasValidas(await IA.json({ system: "Eres guionista de videos cortos para redes. Respondes solo JSON.", messages: [{ role: "user", content: L.PROMPT_GUION(sinNombres(o.desc), n) }], maxTokens: 1500, temperature: 0.7 }), n); } catch (e) { guion = null; } }
    if (!guion) guion = L.escenasSimples(sinNombres(o.desc), n);
    const imgs = [];
    for (let i = 0; i < guion.escenas.length; i++) {
      paso(`🎨 Creando la imagen ${i + 1} de ${guion.escenas.length}…` + (soloGratisLento ? " (con el servicio gratis va de a una, tarda un poco)" : ""));
      const { r } = await X._a338.generar(L25.promptFinal(guion.escenas[i].imagen, o.estilo || ""), o.formato, Math.floor(Math.random() * 1e6));
      if (r) { try { const d = r.b64 ? { b64: r.b64, mime: r.mime || "image/png" } : await X._a338.datos(r); imgs.push(await cargarImg(`data:${d.mime};base64,${d.b64}`)); } catch (e) { /* se repite la anterior */ } }
      if (imgs.length < i + 1) { if (!imgs.length) continue; imgs.push(imgs[imgs.length - 1]); }
      if (r && /Pollinations/.test(r.por) && i < guion.escenas.length - 1) { paso(`⏳ Imagen ${i + 1} lista. El servicio gratis pide esperar un momento entre imágenes…`); await dormir(46000); }
    }
    if (!imgs.length) throw new Error("No pude crear las imágenes del video.");
    while (imgs.length < guion.escenas.length) imgs.push(imgs[imgs.length - 1]);
    let voz = null;
    if (o.voz !== false) { paso("🎙️ Grabando la voz…"); voz = await vozNarrada(guion.escenas.map((e) => e.voz).filter(Boolean).join(" ")); }
    paso("🎬 Armando el video (se graba en tiempo real, unos segundos)…");
    const blob = await grabar(imgs, guion.escenas, o.formato, voz);
    return { b64: await b64DeBlob(blob), mime: blob.type || "video/webm", por: "Jarvis en tu celular (imágenes de IA" + (voz ? " y su voz" : "") + ")", titulo: guion.titulo };
  }

  // ======================================================================== CREAR Y MOSTRAR
  async function crear(o) {
    if (!o.desc) return hoja(o);
    if (ocupado) return R("🎬 Ya estoy haciendo un video. Espera a que termine.");
    if (!navigator.onLine) return R("🎬 Para crear videos necesito internet.", "err");
    o = Object.assign({ formato: "vertical", voz: aj().videoVoz !== false }, o, { formato: o.formato || "vertical" });
    ocupado = true; A.setState("thinking");
    const paso = avance("🎬 Preparando tu video…");
    let v = null; const fallas = [];
    try {
      try { v = await conVeo(o, paso); } catch (e) { fallas.push(e.message); if (window.JDIAG) window.JDIAG.log("video", e.message); }
      if (!v) { if (fallas.length) paso("🎬 Veo no está disponible con tu clave. Lo hago gratis en tu celular…"); v = await hechoEnCelular(o, paso); }
    } catch (e) {
      if (window.JDIAG) window.JDIAG.log("video", e.message || String(e));
      ocupado = false; A.setState("idle"); paso("🎬 No pude hacer el video.");
      return R("🎬 No pude hacer el video: " + (e.message || e) + " Intenta otra vez en un minuto.", "err");
    }
    ocupado = false; A.setState("idle"); paso("🎬 ¡Listo!");
    ultimo = Object.assign({}, o, v); mostrar(ultimo);
  }
  function mostrar(v) {
    const { e } = A.add("assistant", `🎬 Aquí está tu video: ${v.titulo || v.desc}`, "tool");
    const vid = mk("video", "msg-img gen-vid"); vid.controls = true; vid.playsInline = true; vid.setAttribute("playsinline", ""); vid.src = URL.createObjectURL(blobDeB64(v.b64, v.mime)); e.append(vid);
    e.append(mk("small", "gen-por", "Hecho con " + v.por));
    const box = mk("div", "doc-acts");
    const b = (t, fn) => { const x = mk("button", "chip", t); x.type = "button"; x.addEventListener("click", fn); box.append(x); };
    b("💾 Guardar en la galería", () => guardar(v));
    b("📤 Compartir", () => compartir(v));
    b("🔄 Otra versión", () => crear({ desc: v.desc, formato: v.formato, voz: v.voz }));
    e.append(box);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    A.say("Listo, aquí está tu video.");
  }
  const nombre = (v) => "jarvis-video-" + L.norm(v.desc).replace(/[^a-z0-9]+/g, "-").slice(0, 36).replace(/-$/, "");
  async function guardar(v) {
    const G = plug("Galeria");
    if (G) { try { await G.guardar({ base64: v.b64, mime: v.mime, nombre: nombre(v) }); return A.toast("💾 Guardado en la galería (Películas › Jarvis).", 4000); } catch (e) { /* se comparte */ } }
    return compartir(v);
  }
  function compartir(v) {
    const ext = /webm/.test(v.mime) ? "webm" : "mp4";
    if (window.JN && window.JN.share) return window.JN.share({ title: "Video de Jarvis", fileName: nombre(v) + "." + ext, mime: v.mime, base64: v.b64 }).catch(() => {});
  }

  // ======================================================================== LA HOJA «🎬 CREAR VIDEO»
  function hoja(pre) {
    let sh = $("#vid-sh"); if (sh) sh.remove();
    sh = mk("div", "sheet"); sh.id = "vid-sh";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h"), sc = mk("div", "scroll");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.addEventListener("click", () => sh.remove());
    hd.append(mk("h2", "", "🎬 Crear video"), x);
    const ta = mk("textarea", "inp img-desc"); ta.rows = 3; ta.placeholder = "¿De qué es el video? Ej.: invitación al cumpleaños de mi mamá, con flores y globos"; ta.value = (pre && pre.desc) || "";
    let fmt = (pre && pre.formato) || "vertical";
    const r = mk("div", "sug img-ops");
    L25.FORMATOS.forEach(([k, t]) => { const c = mk("button", "chip" + (fmt === k ? " on" : ""), t); c.type = "button"; c.dataset.k = k; c.addEventListener("click", () => { fmt = k; r.querySelectorAll(".chip").forEach((y) => y.classList.toggle("on", y.dataset.k === fmt)); }); r.append(c); });
    const lv = mk("label", "lbl check"), cv = mk("input"); cv.type = "checkbox"; cv.checked = aj().videoVoz !== false; lv.append(cv, document.createTextNode(" Con la voz de Jarvis narrando"));
    const ir = mk("button", "btn primary wide", "🎬 Crear video"); ir.type = "button";
    ir.addEventListener("click", () => { const d = ta.value.trim(); if (d.length < 3) { ta.focus(); return A.toast("Escribe de qué es el video.", 3000); } sh.remove(); A.add("user", "🎬 " + d); crear({ desc: d, formato: fmt, voz: cv.checked }); });
    sc.append(ta, mk("p", "hint", "Formato:"), r, lv, ir, mk("p", "hint", "Si tu clave de Gemini permite Veo, el video lo hace la IA de Google. Si no, Jarvis lo arma gratis en tu celular con imágenes de IA, movimiento y su voz (15 a 30 segundos)."));
    inn.append(hd, sc); sh.append(inn); document.body.append(sh); sh.hidden = false;
    setTimeout(() => ta.focus(), 100);
  }

  // ======================================================================== ATAJO A INFINALL
  const INFINALL = "https://app.infinall.ai/home";
  async function infinall(it) {
    let copiado = false;
    if (it.desc) { try { await navigator.clipboard.writeText(it.desc); copiado = true; } catch (e) { /* sin portapapeles */ } }
    const W = plug("Ventana");
    if (W && W.abrir) W.abrir({ url: INFINALL }).catch(() => window.open(INFINALL, "_blank")); else window.open(INFINALL, "_blank");
    return R(`🟣 Abrí **Infinall** (anuncios con IA para productos y tiendas).` + (it.desc ? (copiado ? ` Copié «${it.desc}»: mantén presionado donde escribes allá y toca **Pegar**.` : ` Escribe allá: «${it.desc}».`) : " Allá pegas el enlace de tu producto o lo describes, y arma el anuncio.") +
      "\n\n_Es un servicio aparte: entras con tu propia cuenta y Jarvis no escribe tus contraseñas. Para un video rápido sin salir de aquí, dime «hazme un video de…»._");
  }

  // ======================================================================== AJUSTES Y MENÚ
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-339")) return;
    const s = mk("div"); s.id = "aj-339";
    s.append(mk("h3", "sub", "Crear videos"));
    s.append(mk("p", "hint", "Di «hazme un video de…» o toca 📎 › 🎬 Crear un video. Primero intenta con Veo de Google (necesita una clave de Gemini con facturación); si no, lo arma gratis en tu celular con imágenes de IA, movimiento suave, textos y la voz de Jarvis. Para anuncios de un producto: «abre Infinall para un anuncio de…»."));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); s.append(l); };
    chk("Intentar primero con Veo (video hecho por IA; gasta de tu cuenta de Google)", aj().videoVeo !== false, (v) => { aj().videoVeo = v; aj().vidVeoNo = ""; save(); });
    chk("Narrar los videos con la voz de Jarvis", aj().videoVoz !== false, (v) => { aj().videoVoz = v; save(); });
    box.append(s);
  }
  function enMenu() {
    const menu = $("#adj-menu"); if (!menu || $("#adj-vid", menu)) return;
    const o = mk("button", "adj-op"); o.type = "button"; o.id = "adj-vid"; o.append(mk("span", "adj-ic", "🎬"), mk("span", "", "Crear un video"));
    o.addEventListener("click", () => { menu.hidden = true; hoja(); });
    const img = $("#adj-img", menu); if (img) img.after(o); else menu.prepend(o);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (!D) return base.intent(text);
    const v = L.videoIntent(text);
    if (v) return { v339: v.vi, it: v };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.v339) return base.run(it, text);
    if (it.v339 === "infinall") return infinall(it.it);
    return crear(it.it);
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    enMenu(); setTimeout(enMenu, 2500);
    const C = window.JL11 && window.JL11.CATALOGO;
    const cat = C && C.find((x) => /Crear imágenes/.test(x[0]));
    if (cat && !cat[1].some((x) => /video/i.test(x))) { cat[0] = "🎨 Crear imágenes y videos"; cat[1].push("Hazme un video de un perro surfeando", "Haz un video de invitación para el cumpleaños de mi mamá", "Abre Infinall para un anuncio de mi panadería"); }
  };
  X._a339 = { crear, hoja, infinall, grabar, ultimo: () => ultimo };
})();
