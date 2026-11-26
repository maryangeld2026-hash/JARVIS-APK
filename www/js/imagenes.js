/* Jarvis para Android 3.38 · crear imágenes de la forma más fácil:
   dilo como te salga («dibújame un gato astronauta») o toca 📎 › 🎨 Crear imagen; escoge estilo y formato con un toque.
   Prueba en orden: Gemini (si tu clave lo permite) → SenseNova U1.5 (gratis en beta, con su clave) → Pollinations (gratis, sin clave).
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL25, L20 = window.JL20, IA = window.JIA;
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
  let ultima = null;               // {desc, estilo, formato, seed, src, b64, mime, por}
  let modelosGemini = null;

  /** En modo docente, los nombres de estudiantes no salen del celular. */
  function sinNombres(t) {
    if (aj().docente !== true) return t;
    let s = String(t);
    (D.cursos || []).forEach((c) => (c.estudiantes || []).forEach((n) => { if (n && n.length > 3) s = s.split(n).join("una persona"); }));
    return s;
  }

  // ======================================================================== LOS TRES SERVICIOS
  async function conGemini(prompt, fmt) {
    const key = clave("gemini");
    if (!key || aj().imgGeminiNo === hoy()) return null;
    if (!modelosGemini) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
      modelosGemini = r.ok ? ((await r.json()).models || []).map((m) => String(m.name).replace(/^models\//, "")) : [];
    }
    const m = L20.modeloImagen(modelosGemini);
    const body = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: L.formato(fmt)[4] } } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = ((j.error || {}).message) || "";
      if (L.sinCupo(r.status, msg)) { aj().imgGeminiNo = hoy(); save(); }       // el plan gratis no crea imágenes: hoy no se vuelve a intentar
      throw new Error("Gemini " + r.status + (msg ? ": " + msg.slice(0, 90) : ""));
    }
    const p = ((((j.candidates || [])[0] || {}).content || {}).parts || []).find((x) => (x.inlineData || x.inline_data) && /^image\//.test((x.inlineData || x.inline_data).mimeType || (x.inlineData || x.inline_data).mime_type || ""));
    if (!p) return null;
    const d = p.inlineData || p.inline_data;
    return { b64: d.data, mime: d.mimeType || d.mime_type, por: "Gemini" };
  }
  async function conSense(prompt, fmt) {
    const key = clave("sensenova");
    if (!key) return null;
    const res = await IA.fetchX("https://token.sensenova.ai/v1/images/generations", { method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" }, body: JSON.stringify(L.pedidoSense(prompt, fmt)) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("SenseNova " + res.status + ((j.error || {}).message ? ": " + String(j.error.message).slice(0, 90) : ""));
    const im = L.imagenDeRespuesta(j);
    return im ? Object.assign(im, { por: "SenseNova" }) : null;
  }
  /** Pollinations: gratis y sin clave. Se espera a que la imagen cargue (puede tardar unos segundos). */
  function conPollinations(prompt, fmt, seed) {
    if (aj().imgPollinations === false) return Promise.resolve(null);
    const url = L.urlPollinations(prompt, fmt, seed);
    return new Promise((ok, no) => {
      const im = new Image(); let listo = false;
      const t = setTimeout(() => { if (!listo) no(new Error("Pollinations tardó demasiado")); }, 90000);
      im.onload = () => { listo = true; clearTimeout(t); ok({ url, por: "Pollinations (gratis)" }); };
      im.onerror = () => { listo = true; clearTimeout(t); no(new Error("Pollinations no respondió (puede estar ocupado: una imagen a la vez)")); };
      im.src = url;
    });
  }

  // ======================================================================== CREAR
  /** La imagen sin mostrarla (3.39: también la usan los videos). → {r: {b64|url, mime, por} | null, fallas} */
  async function generar(prompt, fmt, seed) {
    const fallas = []; let r = null;
    for (const [nombre, fn] of [["Gemini", () => conGemini(prompt, fmt)], ["SenseNova", () => conSense(prompt, fmt)], ["Pollinations", () => conPollinations(prompt, fmt, seed)]]) {
      try { r = await fn(); if (r) break; } catch (e) { fallas.push(e.message || String(e)); if (window.JDIAG) window.JDIAG.log("imagen", nombre + ": " + (e.message || e)); }
    }
    return { r, fallas };
  }
  async function crear(o) {
    o = Object.assign({ estilo: "", formato: "cuadrada", seed: Math.floor(Math.random() * 1e6) }, o);
    if (!o.formato) o.formato = "cuadrada";
    if (!navigator.onLine) return R("🎨 Para crear imágenes necesito internet.", "err");
    const prompt = L.promptFinal(sinNombres(o.desc), o.estilo);
    A.setState("thinking"); A.toast("🎨 Creando la imagen… (puede tardar unos segundos)", 5000);
    const { r, fallas } = await generar(prompt, o.formato, o.seed);
    A.setState("idle");
    if (!r) {
      return R("🎨 No pude crear la imagen ahora" + (fallas.length ? ` (${fallas.slice(-1)[0]})` : "") + ". Intenta de nuevo en un minuto." +
        (!clave("sensenova") ? " Si pones la clave gratis de SenseNova en Ajustes › Inteligencia artificial › Si la IA principal falla, tengo otra opción más." : ""), "err");
    }
    ultima = Object.assign({}, o, r, { src: r.b64 ? `data:${r.mime};base64,${r.b64}` : r.url });
    mostrar(ultima);
    // para «ponla en estilo caricatura» / «quítale el fondo» (los edita Gemini con la última imagen)
    const u = ultima; datos(u).then((d) => { if (X._a331 && X._a331.ponerUltima) X._a331.ponerUltima({ mime: d.mime, data: d.b64 }); }).catch(() => {});
  }
  function mostrar(u) {
    const est = L.ESTILOS.find((x) => x[0] === u.estilo), fm = L.formato(u.formato);
    const { e } = A.add("assistant", `🎨 Aquí está: ${u.desc}` + (est ? ` · ${est[1].replace(/^\S+\s/, "")}` : "") + ` · ${fm[1].replace(/^\S+\s/, "")}`, "tool");
    const im = mk("img", "msg-img gen-img"); im.src = u.src; im.alt = u.desc.slice(0, 80); im.loading = "eager"; e.append(im);
    e.append(mk("small", "gen-por", "Hecha con " + u.por));
    const box = mk("div", "doc-acts");
    const b = (t, fn) => { const x = mk("button", "chip", t); x.type = "button"; x.addEventListener("click", fn); box.append(x); };
    b("💾 Guardar en la galería", () => guardar(u));
    b("📤 Compartir", () => compartir(u));
    b("🔄 Otra versión", () => crear({ desc: u.desc, estilo: u.estilo, formato: u.formato }));
    b("🎭 Otro estilo", () => opciones("estilo", u));
    b("📐 Otro formato", () => opciones("formato", u));
    b("✏️ Cambiarle algo", () => { const i = $("#in-texto"); if (i) { i.value = "cámbiale: "; i.focus(); } A.toast("Escribe qué le cambio (por ejemplo: «cámbiale: que sea de noche»).", 4000); });
    e.append(box);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    A.say("Listo, aquí está la imagen.");
  }
  function opciones(que, u) {
    const l = que === "estilo" ? L.ESTILOS : L.FORMATOS;
    const pick = X._vida && X._vida.pick;
    const ops = l.filter((x) => x[0] !== (que === "estilo" ? u.estilo : u.formato)).map((x) => [x[1], () => crear(Object.assign({}, u, { [que]: x[0], seed: undefined }))]);
    return pick ? pick(que === "estilo" ? "🎭 ¿En qué estilo?" : "📐 ¿En qué formato?", ops, false) : null;
  }
  /** La imagen en base64 (para guardar o compartir): si vino como enlace, se descarga. */
  async function datos(u) {
    if (u.b64) return { b64: u.b64, mime: u.mime || "image/png" };
    const r = await fetch(u.url); if (!r.ok) throw new Error("No pude descargar la imagen.");
    const bl = await r.blob();
    const b64 = await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(",")[1]); f.onerror = () => no(new Error("No pude leer la imagen.")); f.readAsDataURL(bl); });
    u.b64 = b64; u.mime = bl.type || "image/jpeg";
    return { b64, mime: u.mime };
  }
  const nombreArchivo = (u) => "jarvis-" + L.norm(u.desc).replace(/[^a-z0-9]+/g, "-").slice(0, 40).replace(/-$/, "");
  async function guardar(u) {
    let d; try { d = await datos(u); } catch (e) { return R(e.message, "err"); }
    const G = plug("Galeria");
    if (G) {
      try { await G.guardar({ base64: d.b64, mime: d.mime, nombre: nombreArchivo(u) }); return A.toast("💾 Guardada en la galería (Imágenes › Jarvis).", 4000); }
      catch (e) { if (!/SIN_GALERIA/.test(String(e && e.message))) A.toast("No pude guardarla en la galería: la comparto para que la guardes.", 4000); }
    }
    return compartir(u);
  }
  async function compartir(u) {
    let d; try { d = await datos(u); } catch (e) {
      if (u.url && window.JN && window.JN.share) return window.JN.share({ title: "Imagen de Jarvis", text: u.url }).catch(() => {});   // si no se deja descargar, se comparte el enlace
      return R(e.message, "err");
    }
    const ext = /jpe?g/.test(d.mime) ? "jpg" : "png";
    if (window.JN && window.JN.share) return window.JN.share({ title: "Imagen de Jarvis", fileName: nombreArchivo(u) + "." + ext, mime: d.mime, base64: d.b64 }).catch(() => {});
  }

  // ======================================================================== LA HOJA «🎨 CREAR IMAGEN»
  function hoja(pre) {
    let sh = $("#img-sh"); if (sh) sh.remove();
    sh = mk("div", "sheet"); sh.id = "img-sh";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h"), sc = mk("div", "scroll");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.addEventListener("click", () => sh.remove());
    hd.append(mk("h2", "", "🎨 Crear imagen"), x);
    const ta = mk("textarea", "inp img-desc"); ta.rows = 3; ta.placeholder = "¿Qué dibujo? Ej.: un gato astronauta flotando sobre Bogotá de noche"; ta.value = (pre && pre.desc) || "";
    const sel = { estilo: (pre && pre.estilo) || "", formato: (pre && pre.formato) || "cuadrada" };
    const fila = (que, l) => {
      const r = mk("div", "sug img-ops"); r.dataset.que = que;
      l.forEach(([k, t]) => { const c = mk("button", "chip" + (sel[que] === k ? " on" : ""), t); c.type = "button"; c.dataset.k = k; c.addEventListener("click", () => { sel[que] = sel[que] === k && que === "estilo" ? "" : k; r.querySelectorAll(".chip").forEach((y) => y.classList.toggle("on", y.dataset.k === sel[que])); }); r.append(c); });
      return r;
    };
    const ir = mk("button", "btn primary wide", "🎨 Crear"); ir.type = "button";
    ir.addEventListener("click", () => { const d = ta.value.trim(); if (d.length < 3) { ta.focus(); return A.toast("Escribe qué quieres que dibuje.", 3000); } sh.remove(); A.add("user", "🎨 " + d); crear({ desc: d, estilo: sel.estilo, formato: sel.formato }); });
    sc.append(ta, mk("p", "hint", "Estilo (opcional):"), fila("estilo", L.ESTILOS), mk("p", "hint", "Formato:"), fila("formato", L.FORMATOS), ir,
      mk("p", "hint", "También lo puedes decir: «dibújame un perro con gafas, estilo caricatura, vertical»."));
    inn.append(hd, sc); sh.append(inn); document.body.append(sh); sh.hidden = false;
    setTimeout(() => ta.focus(), 100);
  }
  function enMenu() {
    const menu = $("#adj-menu"); if (!menu || $("#adj-img", menu)) return;
    const o = mk("button", "adj-op"); o.type = "button"; o.id = "adj-img"; o.append(mk("span", "adj-ic", "🎨"), mk("span", "", "Crear una imagen"));
    o.addEventListener("click", () => { menu.hidden = true; hoja(); });
    menu.prepend(o);
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-338")) return;
    const s = mk("div"); s.id = "aj-338";
    s.append(mk("h3", "sub", "Crear imágenes"));
    s.append(mk("p", "hint", "Di «dibújame…» o toca 📎 › 🎨 Crear una imagen. Jarvis prueba primero con Gemini (su plan gratis no crea imágenes: necesita una clave con facturación), luego con SenseNova (gratis en beta, con su clave) y al final con Pollinations (gratis y sin clave; deja un logo pequeño en la esquina)."));
    const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = aj().imgPollinations !== false;
    i.addEventListener("change", () => { aj().imgPollinations = i.checked; save(); });
    l.append(i, document.createTextNode(" Usar Pollinations (gratis, sin clave) cuando las otras no puedan")); s.append(l);
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (!D || String(text).length > 400) return base.intent(text);
    const raw = String(text || "");
    const m = raw.match(/^\s*c[aá]mbiale\s*:?\s+(.{3,})$/i);
    if (m && ultima) return { i338: "crear", it: { desc: ultima.desc + ". Cambio: " + m[1].trim(), estilo: ultima.estilo, formato: ultima.formato } };
    const c = L.crearIntent(raw);
    if (c) return { i338: c.ci, it: c };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.i338) return base.run(it, text);
    if (it.i338 === "abrir") return hoja();
    return crear(it.it);
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    enMenu(); setTimeout(enMenu, 2000);
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Crear imágenes/.test(x[0]))) C.unshift(["🎨 Crear imágenes", ["Dibújame un gato astronauta", "Haz un logo para mi panadería", "Imagen de un atardecer en Cartagena, vertical para estados", "Crea una invitación de cumpleaños estilo caricatura", "Quiero crear una imagen"]]);
  };
  X._a338 = { crear, generar, datos, sinNombres: (t) => sinNombres(t), hoja, guardar, compartir, ultima: () => ultima };
})();
