/* Jarvis para Android 3.17 · traductor de idiomas y reconocer canciones.
   · Traductor: «traduce al inglés: …», «¿cómo se dice … en francés?», «traduce eso», «traduce esta pantalla», «traduce este menú» (foto),
     y el modo conversación (cara a cara, por turnos, en voz alta). Con IA cuando hay internet; sin internet con los paquetes del celular.
   · Canciones: «¿qué canción es esta?», «voy a tararear», «mis canciones», «ponla».
   Todo corre solo cuando lo pides (no gasta batería en segundo plano). Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L12 = window.JL12, V = window.JV, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const docente = () => D.ajustes.docente === true;
  const claves = () => D.ajustes.claves || {};
  const hayIA = () => D.ajustes.proveedor === "local" ? false : !!(claves()[D.ajustes.proveedor] || "").trim();
  const abrirUrl = (url) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url }).catch(() => {}); window.open(url, "_blank"); };
  /** Botones bajo un mensaje (no se desactivan: se pueden tocar varias veces). */
  function botones(e, ops) {
    const box = mk("div", "doc-acts");
    ops.filter(Boolean).forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => fn(b)); box.append(b); });
    e.append(box);
  }
  /** Los nombres de los estudiantes nunca van a la IA: ese texto se traduce dentro del celular. */
  function conNombres(t) {
    if (!docente()) return false;
    const n = L12.norm(t);
    return [].concat(...D.cursos.map((c) => c.estudiantes || [])).some((x) => { const p = L12.norm(x).split(" ").filter((w) => w.length > 2); return p.length >= 2 && p.filter((w) => n.includes(w)).length >= 2; });
  }

  // ======================================================================== TRADUCIR
  let paquetes = null;                                                                 // los idiomas bajados al celular
  async function bajados(refrescar) {
    const T = plug("Traductor"); if (!T) return [];
    if (!paquetes || refrescar) { try { paquetes = ((await T.modelos()) || {}).lista || []; } catch (e) { paquetes = []; } }
    return paquetes;
  }
  const tiene = (l, c) => c === "en" || l.includes(c);
  /** → {texto, de, a, pron, nota, motor}. modo «conv»: lo más rápido (en la conversación cada segundo cuenta). */
  async function traducir(texto, a, de, modo) {
    const T = plug("Traductor"), pref = D.ajustes.traductor || "auto";
    const l = await bajados();
    const privado = conNombres(texto);
    const celularListo = T && L12.offline(a) && (!de || tiene(l, de)) && tiene(l, a);
    let usarCel = T && L12.offline(a) && (pref === "celular" || privado || !navigator.onLine || !hayIA() || (pref === "auto" && modo === "conv" && celularListo));
    if (privado && !T) throw new Error("Ese texto tiene nombres de tus estudiantes y por privacidad no lo mando a la IA. En la app instalada lo traduzco dentro del celular.");
    if (!usarCel) {
      try {
        const j = await IA.json({ system: "Eres un traductor profesional. Respondes solo JSON válido.", messages: [{ role: "user", content: L12.tradPrompt(texto, a, de) }], maxTokens: 1500, temperature: 0.2 });
        const r = L12.tradLimpia(j, texto);
        if (r) return Object.assign(r, { a, de: r.de || de || "", motor: "IA" });
      } catch (e) { if (!T || !L12.offline(a)) throw e; }
      usarCel = true;
    }
    if (!T) throw new Error("Para traducir necesito la IA (pon una clave en Ajustes) o la app instalada.");
    const bajar = navigator.onLine;                                                    // con internet, el paquete que falte se baja solo (una vez)
    if (bajar && !celularListo) A.toast(`Bajando el paquete de ${L12.nombre(a)} para traducir sin internet (unos 30 MB, una sola vez)…`, 6000);
    try {
      const r = await T.traducir({ texto, de: de || "", a, descargar: bajar });
      if (bajar && !celularListo) bajados(true);
      return { texto: r.texto, de: r.de, a: r.a, pron: "", nota: r.igual ? "Ya estaba en " + L12.nombre(a) + "." : "", original: texto, motor: "celular" };
    } catch (e) {
      if (e.code === "falta_modelo") throw new Error(`Sin internet no tengo el paquete de ${L12.nombre((e.data && e.data.falta) || a)}. Cuando tengas internet dime «descarga el ${L12.nombre((e.data && e.data.falta) || a)} para traducir sin internet».`);
      if (e.code === "detectar") throw new Error("No reconocí en qué idioma está. Dime de qué idioma es o abre el traductor.");
      throw e;
    }
  }
  function historial(r) {
    D.traducciones = D.traducciones || [];
    D.traducciones.unshift({ t: Date.now(), de: r.de, a: r.a, o: String(r.original || "").slice(0, 500), tr: String(r.texto).slice(0, 800) });
    if (D.traducciones.length > 100) D.traducciones.length = 100;
    save();
  }
  /** Muestra una traducción y la dice con la voz del idioma. */
  function mostrar(r) {
    historial(r);
    const md = `${L12.bandera(r.a)} **${r.texto}**` + (r.pron ? `\n\n🗣️ _${r.pron}_` : "") + (r.nota ? `\n\n💡 ${r.nota}` : "") +
      `\n\n<small>${r.de ? L12.nombre(r.de) + " → " : ""}${L12.nombre(r.a)} · ${r.motor === "celular" ? "sin internet, en el celular" : "con IA"}</small>`;
    const { e } = A.add("assistant", md, "tool trad");
    e.innerHTML = A.md(md);
    const decir = (lento) => { V.hush(); if (lento) V.setOptions({ rate: 0.75 }); V.say(r.texto, L12.locale(r.a)); if (lento) V.idle().then(() => { if (A.applyVoice) A.applyVoice(); }); };
    botones(e, [["🔊 Otra vez", () => decir(false)], ["🐢 Despacio", () => decir(true)],
      ["📋 Copiar", () => { try { navigator.clipboard.writeText(r.texto); A.toast("Copiado."); } catch (er) { A.toast("No pude copiar."); } }],
      ["⭐ Guardar", (b) => { D.frases = D.frases || []; D.frases.unshift({ t: Date.now(), de: r.de, a: r.a, o: r.original, tr: r.texto }); save(); b.textContent = "⭐ Guardada"; }],
      ["🌐 Conversar", () => panel(r.a === "es" ? r.de || "en" : r.a)]]);
    if (D.ajustes.voz) { if (r.de && r.a !== "es") V.say(`En ${L12.nombre(r.a)}:`); V.say(r.texto, L12.locale(r.a)); }
    if (window.JX.onReply) window.JX.onReply(r.texto);
  }
  async function traducirYMostrar(texto, a, de) {
    A.setState("thinking");
    try { mostrar(await traducir(texto, a || D.ajustes.tradOtro || "en", de)); }
    catch (e) { R(e.message || String(e), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  /** Lo último que dijo Jarvis (o lo último que dijo alguien). */
  function ultimoTexto() {
    const c = (D.chat || []).slice().reverse();
    const m = c.find((x) => x.role === "assistant" && x.content && !/\berr\b/.test(x.cls || "") && !/^▶/.test(x.content));
    return m ? m.content.replace(/<small>[\s\S]*?<\/small>/g, "").replace(/[*_#>`]/g, "").trim() : "";
  }
  async function pantalla(a) {
    const T = plug("Telefono"); if (!T || !T.pantalla) return R("Traducir la pantalla funciona en la app instalada.", "err");
    let p; try { p = await T.pantalla({}); } catch (e) { p = {}; }
    if (!p.activo) return R("Necesito el control por voz de Jarvis (Accesibilidad) para leer la pantalla.", "err");
    if (!p.texto || Date.now() - p.t > 5 * 60000) return R("Llámame desde la app que estás viendo (burbuja, botón de asistente o «Jarvis») y dime «traduce esta pantalla».", "err");
    return traducirYMostrar(String(p.texto).slice(0, 3500), a || "es");
  }
  // foto: el texto se lee dentro del celular (ML Kit) y luego se traduce; si no hay texto latino, la IA mira la foto
  let camIn = null, camA = "es";
  function shrink(file, max) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, (max || 1600) / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => no(new Error("No pude abrir la foto.")); img.src = URL.createObjectURL(file); });
  }
  function foto(a) {
    camA = a || "es";
    if (!camIn) {
      camIn = mk("input"); camIn.type = "file"; camIn.accept = "image/*"; camIn.setAttribute("capture", "environment"); camIn.hidden = true; document.body.append(camIn);
      camIn.addEventListener("change", async () => { const f = camIn.files && camIn.files[0]; camIn.value = ""; if (f) fotoLista(f); });
    }
    const { e } = A.add("assistant", `📷 Tómale la foto al letrero, menú o texto y lo traduzco al ${L12.nombre(camA)}.`, "tool");
    botones(e, [["📷 Tomar la foto", () => camIn.click()], ["🖼️ De la galería", () => { camIn.removeAttribute("capture"); camIn.click(); setTimeout(() => camIn.setAttribute("capture", "environment"), 1500); }]]);
  }
  async function fotoLista(file) {
    let url; try { url = await shrink(file); } catch (e) { return R(e.message, "err"); }
    const u = A.add("user", "🌐 Traduce esta foto"); const im = mk("img", "msg-img"); im.src = url; u.e.prepend(im);
    A.setState("thinking");
    try {
      let texto = "";
      const E = plug("Escaner");
      if (E && E.leerTexto) { try { texto = (((await E.leerTexto({ base64: url })) || {}).texto || "").trim(); } catch (e) { texto = ""; } }
      if (texto.length >= 3) return mostrar(await traducir(texto.slice(0, 3500), camA));
      if (!hayIA() || !navigator.onLine) return R("No encontré texto en la foto. Prueba más cerca y con luz.", "err");
      const j = await IA.json({ system: "Lees fotos con cuidado y respondes solo JSON válido.", messages: [{ role: "user", content: `Lee todo el texto de la foto (letrero, menú, etiqueta…) y tradúcelo al ${L12.nombre(camA)}. Devuelve {"traduccion": "…", "de": "código ISO 639-1", "pronunciacion": "", "nota": "qué es lo que se ve, en una frase"}. Si no hay texto, {"traduccion": ""}.`, image: { mime: "image/jpeg", data: url.split(",")[1] } }], maxTokens: 1500 });
      const r = L12.tradLimpia(j, "(texto de la foto)");
      if (!r) return R("No encontré texto en la foto.", "err");
      mostrar(Object.assign(r, { a: camA, motor: "IA" }));
    } catch (e) { R(e.message || String(e), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  async function bajarIdioma(c) {
    const T = plug("Traductor");
    if (!T) return R("Los paquetes sin internet son para la app instalada.", "err");
    if (!L12.offline(c)) return R(`El ${L12.nombre(c)} no tiene paquete sin internet; lo traduzco con la IA.`, "err");
    if (!navigator.onLine) return R("Necesito internet para bajar el paquete.", "err");
    A.toast(`Bajando el ${L12.nombre(c)} (unos 30 MB)…`, 5000);
    try { await T.descargar({ idioma: c, wifi: false }); await bajados(true); R(`Hecho. Ya traduzco ${L12.nombre(c)} sin internet, ${A.trato()}.`); }
    catch (e) { R(e.message || String(e), "err"); }
  }

  // ======================================================================== MODO CONVERSACIÓN (cara a cara)
  let conv = null;                                                                     // {mio, otro, auto, vivo}
  function panel(otro, escuchar) {
    let sh = $("#trad-sh"); if (sh) sh.remove();
    conv = { mio: D.ajustes.tradMio || "es", otro: otro || D.ajustes.tradOtro || "en", auto: !!D.ajustes.tradAuto, vivo: true, gira: !!D.ajustes.tradGira };
    if (conv.otro === conv.mio) conv.otro = conv.mio === "en" ? "es" : "en";
    sh = mk("div", "sheet trad-sh"); sh.id = "trad-sh";
    const inn = mk("div", "sheet-in full"), hd = mk("div", "sheet-h");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.setAttribute("aria-label", "Cerrar"); x.addEventListener("click", cerrar);
    hd.append(mk("h2", "", "🌐 Traductor"), x);
    const sel = (v, fn) => { const s = mk("select", "inp half"); Object.keys(L12.IDIOMAS).forEach((k) => s.append(new Option(`${L12.bandera(k)} ${may(k)}`, k))); s.value = v; s.addEventListener("change", () => fn(s.value)); return s; };
    const fila = mk("div", "row trad-idiomas");
    const sMio = sel(conv.mio, (v) => { conv.mio = D.ajustes.tradMio = v; save(); pintar(); }), sOtro = sel(conv.otro, (v) => { conv.otro = D.ajustes.tradOtro = v; save(); pintar(); });
    const sw = mk("button", "icon-btn", "⇄"); sw.type = "button"; sw.setAttribute("aria-label", "Cambiar idiomas"); sw.addEventListener("click", () => { const t = conv.mio; conv.mio = conv.otro; conv.otro = t; sMio.value = conv.mio; sOtro.value = conv.otro; pintar(); });
    fila.append(sMio, sw, sOtro);
    const ladoOtro = mk("div", "trad-lado otro"), ladoMio = mk("div", "trad-lado mio");
    ladoOtro.id = "trad-otro"; ladoMio.id = "trad-mio";
    [ladoOtro, ladoMio].forEach((l) => { l.append(mk("div", "trad-idi"), mk("div", "trad-orig"), mk("div", "trad-tr")); });
    const mics = mk("div", "row trad-mics");
    const bm = mk("button", "btn primary trad-mic"); bm.type = "button"; bm.id = "trad-mic-mio"; bm.addEventListener("click", () => turno("mio"));
    const bo = mk("button", "btn trad-mic"); bo.type = "button"; bo.id = "trad-mic-otro"; bo.addEventListener("click", () => turno("otro"));
    mics.append(bm, bo);
    const esc = mk("form", "row trad-escribir"); const inp = mk("input", "inp"); inp.id = "trad-in"; inp.placeholder = "O escribe aquí (detecto el idioma)"; const env = mk("button", "btn", "Traducir"); env.type = "submit";
    esc.append(inp, env);
    esc.addEventListener("submit", async (ev) => { ev.preventDefault(); const t = inp.value.trim(); if (!t) return; inp.value = ""; await turnoTexto(t); });
    const opc = mk("div", "row wrap trad-opc");
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); opc.append(l); return i; };
    chk("Turnos automáticos", conv.auto, (v) => { conv.auto = D.ajustes.tradAuto = v; save(); });
    chk("Cara a cara (girar su lado)", conv.gira, (v) => { conv.gira = D.ajustes.tradGira = v; save(); inn.classList.toggle("gira", v); });
    const est = mk("p", "hint trad-estado"); est.id = "trad-estado";
    const sc = mk("div", "scroll trad-scroll");
    sc.append(fila, ladoOtro, ladoMio, est, mics, esc, opc);
    inn.append(hd, sc); inn.classList.toggle("gira", conv.gira); sh.append(inn); document.body.append(sh); sh.hidden = false;
    pintar();
    estado(navigator.onLine && hayIA() ? "Toca tu botón y habla. Traduzco y lo digo en voz alta." : "Sin internet: traduzco con los paquetes del celular.");
    if (escuchar) setTimeout(() => turno("otro"), 300);
  }
  const may = (c) => { const n = L12.nombre(c); return n.charAt(0).toUpperCase() + n.slice(1); };
  function pintar() {
    if (!conv) return;
    const bm = $("#trad-mic-mio"), bo = $("#trad-mic-otro");
    if (bm) bm.textContent = `🎙️ ${L12.bandera(conv.mio)} ${may(conv.mio)}`;
    if (bo) bo.textContent = `🎙️ ${L12.bandera(conv.otro)} ${may(conv.otro)}`;
    const io = $("#trad-otro .trad-idi"), im = $("#trad-mio .trad-idi");
    if (io) io.textContent = `${L12.bandera(conv.otro)} ${may(conv.otro)}`;
    if (im) im.textContent = `${L12.bandera(conv.mio)} ${may(conv.mio)}`;
  }
  const estado = (t) => { const e = $("#trad-estado"); if (e) e.textContent = t; };
  function lado(k, orig, tr) {
    const l = $("#trad-" + k); if (!l) return;
    $(".trad-orig", l).textContent = orig || ""; $(".trad-tr", l).textContent = tr || "";
  }
  function cerrar() {
    if (conv) conv.vivo = false;
    conv = null;
    V.hush(); (V.cancelListening || V.stopListening)();
    const sh = $("#trad-sh"); if (sh) sh.remove();
    A.setState("idle");
  }
  /** Un turno: escucha en el idioma de ese lado, traduce al otro y lo dice en voz alta. */
  let fallos = 0;
  async function turno(quien) {
    const c = conv; if (!c || !c.vivo) return;
    const de = quien === "mio" ? c.mio : c.otro, a = quien === "mio" ? c.otro : c.mio;
    V.hush();
    if (window.JX.beforeListen) { try { await Promise.race([window.JX.beforeListen(), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* sigue */ } }
    if (conv !== c) return;
    estado(`🎙️ Escuchando en ${L12.nombre(de)}…`);
    A.setState("listening");
    let texto = "";
    try { texto = await V.listen((p) => lado(quien === "mio" ? "mio" : "otro", p, ""), { idioma: L12.locale(de), espera: 9000, silencio: 1400 }); }
    catch (e) { if (conv === c) { estado(e.message); A.setState("idle"); } return; }
    if (conv !== c) return;
    A.setState("idle");
    if (!texto) { fallos++; estado(fallos >= 2 ? "No oí nada. Toca un botón cuando quieran hablar." : "No oí nada; vuelvo a escuchar…"); if (c.auto && fallos < 2) return turno(quien); return; }
    fallos = 0;
    await traducirTurno(texto, de, a, quien);
    if (c.auto && conv === c) turno(quien === "mio" ? "otro" : "mio");
  }
  async function turnoTexto(t) {
    const c = conv; if (!c) return;
    let de = c.mio;
    const T = plug("Traductor");
    if (T) { try { const d = ((await T.detectar({ texto: t })) || {}).idioma; if (d) de = d; } catch (e) { /* mi idioma */ } }
    const a = L12.destinoDe(de, c.mio, c.otro);
    await traducirTurno(t, de, a, de === c.otro ? "otro" : "mio");
  }
  async function traducirTurno(texto, de, a, quien) {
    const c = conv;
    estado("Traduciendo…"); A.setState("thinking");
    try {
      const r = await traducir(texto, a, de, "conv");
      if (conv !== c) return;
      lado(quien === "mio" ? "mio" : "otro", texto, "");
      lado(quien === "mio" ? "otro" : "mio", "", r.texto);
      historial(r);
      estado(`${L12.nombre(de)} → ${L12.nombre(a)} · ${r.motor === "celular" ? "sin internet" : "con IA"}`);
      A.setState("speaking");
      V.say(r.texto, L12.locale(a));
      await V.idle();
    } catch (e) { estado(e.message || String(e)); }
    finally { if (A.getState() !== "listening") A.setState("idle"); }
  }

  // ======================================================================== CANCIONES
  let nivelH = null;
  async function gemini(parts, opts) {
    const key = (claves().gemini || "").trim(); if (!key) throw new Error("sin_gemini");
    const m = await IA.model(IA.cfgFor("gemini", false));
    const body = { contents: [{ role: "user", parts }], generationConfig: Object.assign({ temperature: 0.2, maxOutputTokens: 400 }, opts.json ? { responseMimeType: "application/json" } : {}) };
    if (opts.buscar) body.tools = [{ google_search: {} }];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("gemini " + r.status);
    const j = await r.json();
    return ((((j.candidates || [])[0] || {}).content || {}).parts || []).map((p) => p.text || "").join("").trim();
  }
  async function reconocer(tararear) {
    const M = plug("Musica");
    if (!M) return R("Reconocer canciones funciona en la app instalada.", "err");
    if (!navigator.onLine) return R("Para reconocer canciones necesito internet.", "err");
    const O = plug("Oido");
    if (O && O.permiso) { try { const p = await O.permiso(); if (!p.ok) return R("Necesito permiso para usar el micrófono.", "err"); } catch (e) { /* sigue */ } }
    V.hush(); (V.cancelListening || V.stopListening)();
    if (window.JX.beforeListen) { try { await Promise.race([window.JX.beforeListen(), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* sigue */ } }
    const seg = tararear ? 12 : 10;
    const { e } = A.add("assistant", tararear ? "🎵 Tararea o canta la canción ahora…" : "🎵 Escuchando la música… acerca el celular a donde suena.", "tool musica");
    const barra = mk("div", "mus-barra"), lleno = mk("i"); barra.append(lleno); e.append(barra);
    try { nivelH = await window.JON(M, "nivel", (d) => { if (d) { lleno.style.width = Math.round(Math.min(1, (d.t || 0) / seg) * 100) + "%"; barra.style.setProperty("--v", String(Math.min(1, (d.v || 0) * 3))); } }); } catch (er) { nivelH = null; }
    A.setState("listening");
    let g;
    try { g = await M.grabar({ seg }); }
    catch (er) { A.setState("idle"); return R(er.message || "No pude usar el micrófono.", "err"); }
    finally { if (nivelH && nivelH.remove) nivelH.remove(); nivelH = null; barra.remove(); }
    A.setState("thinking");
    let c = null, nota = "";
    try {
      if (g.nivel != null && g.nivel < 0.01) { A.setState("idle"); return R("No oí nada de música. Súbele el volumen o acerca el celular, y me dices otra vez.", "err"); }
      if (!tararear) {                                                               // 1) AudD: la huella de la canción (lo más preciso)
        try {
          const a = await M.audd({ ruta: g.ruta, token: (claves().audd || "").trim() });
          const p = L12.auddParse(a.json);
          if (p && !p.error) c = p;
          else if (p && p.error === "limite") nota = " Se acabaron las búsquedas gratis de hoy en AudD; con una clave de audd.io (en Ajustes › Canciones) tienes muchas más.";
          else if (p && p.error === "clave") nota = " La clave de AudD no sirve; revísala en Ajustes › Canciones.";
        } catch (er) { /* sigue con Gemini */ }
      }
      if (!c && (claves().gemini || "").trim()) {                                   // 2) Gemini escucha el audio (también lo que tarareas)
        try {
          const b = await M.base64({ ruta: g.ruta });
          const t = await gemini([{ inline_data: { mime_type: "audio/wav", data: b.data } }, { text: L12.geminiCancionPrompt(tararear) }], { json: true });
          const j = L12.geminiCancionLimpia(window.JL.extractJSON(t));
          if (j.seguro) c = { titulo: j.titulo, artista: j.artista, fuente: "Gemini" };
          else if (j.pista) c = L12.busquedaCancion(await gemini([{ text: L12.busquedaPrompt(j.pista) }], { buscar: true }));   // 3) con la pista, busca en Google
        } catch (er) { /* nada */ }
      }
    } finally { M.borrarAudio({ ruta: g.ruta }).catch(() => {}); if (A.getState() === "thinking") A.setState("idle"); }
    if (!c) {
      let apps = {}; try { apps = (await M.apps()) || {}; } catch (er) { /* nada */ }
      const { e: e2 } = A.add("assistant", `No logré reconocer la canción, ${A.trato()}.${nota}${!(claves().gemini || "").trim() && !nota ? " Con la clave de Gemini también puedo intentarlo con lo que tararees." : ""}`, "tool");
      botones(e2, [["🔁 Otra vez", () => reconocer(tararear)], apps.google && ["🔎 Con Google", () => M.abrir({ app: "google" }).catch(() => {})], apps.shazam && ["Shazam", () => M.abrir({ app: "shazam" }).catch(() => {})]]);
      return V.say(`No logré reconocerla.${nota ? " Se acabaron las búsquedas gratis de hoy." : ""}`);
    }
    guardarCancion(c);
    mostrarCancion(c, true);
  }
  function guardarCancion(c) {
    D.canciones = D.canciones || [];
    const ult = D.canciones[0];
    if (ult && L12.mismaCancion(ult, c) && Date.now() - ult.t < 10 * 60000) return;
    D.canciones.unshift({ t: Date.now(), titulo: c.titulo, artista: c.artista, album: c.album || "", fecha: c.fecha || "", spotify: c.spotify || "", apple: c.apple || "", fuente: c.fuente || "" });
    if (D.canciones.length > 200) D.canciones.length = 200;
    save();
  }
  function mostrarCancion(c, decir) {
    const md = L12.cancionTexto(c) + (c.fuente ? `\n\n<small>Reconocida con ${c.fuente}</small>` : "");
    const { e } = A.add("assistant", md, "tool musica");
    e.innerHTML = A.md(md);
    if (c.portada) { const im = mk("img", "mus-portada"); im.src = c.portada; im.alt = ""; im.loading = "lazy"; e.prepend(im); }
    botones(e, [["▶ YouTube", () => abrirUrl(L12.ytBuscar(c))], ["🎧 Spotify", () => abrirUrl(c.spotify || L12.spotifyBuscar(c))], c.apple && [" Apple Music", () => abrirUrl(c.apple)],
      ["🌐 ¿De qué trata?", () => A.dispatch(`¿De qué trata la canción ${c.titulo}${c.artista ? " de " + c.artista : ""}? Explícalo en pocas frases, sin citar la letra.`)]]);
    if (decir) V.say(`Es «${c.titulo}»${c.artista ? ", de " + c.artista : ""}.`);
    if (window.JX.onReply) window.JX.onReply(`${c.titulo} — ${c.artista}`);
  }
  function listaCanciones() {
    const l = D.canciones || [];
    if (!l.length) return R("Todavía no he reconocido canciones. Dime «¿qué canción es esta?» cuando suene una.");
    const dia = (t) => new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
    R("🎵 **Tus canciones**\n" + l.slice(0, 20).map((c) => `- ${c.titulo}${c.artista ? " — " + c.artista : ""} (${dia(c.t)})`).join("\n"), "tool", `La última fue ${l[0].titulo}${l[0].artista ? ", de " + l[0].artista : ""}.`);
  }

  // ======================================================================== AJUSTES
  async function ajustes() {
    const box = $("#aj2"); if (!box || $("#aj-317")) return;
    const sec = mk("div"); sec.id = "aj-317";
    sec.append(mk("h3", "sub", "Traductor"));
    const sm = mk("select", "inp"); [["auto", "Automático: con IA si hay internet, sin internet con el celular"], ["ia", "Siempre con IA (más natural)"], ["celular", "Siempre en el celular (privado, sin internet)"]].forEach(([k, t]) => sm.append(new Option(t, k)));
    sm.value = D.ajustes.traductor || "auto"; sm.addEventListener("change", () => { D.ajustes.traductor = sm.value; save(); }); sec.append(sm);
    sec.append(mk("label", "lbl", "Idiomas para traducir sin internet (unos 30 MB cada uno)"));
    const lista = mk("div", "sug trad-paq"); sec.append(lista);
    const pintarPaq = async () => {
      lista.textContent = "";
      if (!plug("Traductor")) { lista.append(mk("p", "hint", "Funciona en la app instalada.")); return; }
      const l = await bajados(true);
      ["en", "fr", "pt", "de", "it", "zh", "ja", "ko", "ru", "ar", "nl", "hi", "tr"].forEach((k) => {
        const ya = tiene(l, k);
        const b = mk("button", "chip" + (ya ? " on" : ""), `${L12.bandera(k)} ${may(k)}${ya ? " ✓" : " ⬇"}`); b.type = "button";
        b.addEventListener("click", async () => {
          const T = plug("Traductor");
          if (ya) { if (k === "en") return A.toast("El inglés siempre queda: lo usan los demás idiomas."); if (!confirm(`¿Borrar el paquete de ${L12.nombre(k)}?`)) return; try { await T.borrar({ idioma: k }); } catch (e) { A.toast(e.message); } }
          else { b.disabled = true; b.textContent = "Bajando…"; try { await T.descargar({ idioma: k, wifi: false }); } catch (e) { A.toast(e.message, 5000); } }
          pintarPaq();
        });
        lista.append(b);
      });
    };
    pintarPaq();
    sec.append(mk("p", "hint", "Di «abre el traductor» para conversar cara a cara, «traduce al inglés: …», «¿cómo se dice … en francés?» o «traduce este menú»."));
    sec.append(mk("h3", "sub", "Canciones"));
    sec.append(mk("label", "lbl", "Clave de AudD (opcional, audd.io). Sin clave tienes unas pocas búsquedas gratis al día; con la clave de Gemini también reconozco lo que tarareas."));
    const k = mk("input", "inp"); k.type = "password"; k.autocomplete = "off"; k.placeholder = "Clave de AudD (se queda solo en este celular)"; k.value = claves().audd || "";
    k.addEventListener("change", () => { D.ajustes.claves = D.ajustes.claves || {}; D.ajustes.claves.audd = k.value.trim(); save(); }); sec.append(k);
    box.append(sec);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const mu = L12.musicaIntent(text); if (mu) return Object.assign({ t317: "mu" }, mu);
    const tr = L12.tradIntent(text); if (tr) return Object.assign({ t317: "tr" }, tr);
    // «modo intérprete»: con Gemini en vivo si hay internet y clave; si no, la conversación por turnos de aquí
    const n = L12.norm(text).replace(/^jarvis\s+/, "");
    const mi = n.match(/^(?:modo interprete|interprete|se mi interprete|traductor en vivo)(?:\s+(?:con|en|al|a|de)\s+(?:el\s+)?([a-z]+))?$/);
    if (mi && !(navigator.onLine && (claves().gemini || "").trim() && X._live)) return { t317: "tr", tr: "panel", otro: (mi[1] && L12.codigo(mi[1])) || "" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.t317) return base.run(it, text);
    if (it.t317 === "mu") {
      if (it.mu === "reconocer") return reconocer(!!it.tararear);
      if (it.mu === "lista") return listaCanciones();
      const c = (D.canciones || [])[0];
      if (!c) return R("Todavía no he reconocido ninguna canción.");
      if (it.mu === "ultima") return mostrarCancion(c, true);
      R(`Pongo «${c.titulo}» en YouTube.`); return abrirUrl(L12.ytBuscar(c));
    }
    switch (it.tr) {
      case "texto": return traducirYMostrar(it.texto, it.a);
      case "ultimo": { const t = ultimoTexto(); if (!t) return R("No tengo nada para traducir todavía."); return traducirYMostrar(t.slice(0, 3500), it.a || (D.ajustes.tradOtro || "en")); }
      case "pantalla": return pantalla(it.a);
      case "foto": return foto(it.a);
      case "bajar": return bajarIdioma(it.idioma);
      case "panel": return panel(it.otro, it.escuchar);
    }
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    ajustes().then(() => { if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); }).catch((e) => console.error(e));
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Traductor/.test(x[0]))) C.splice(1, 0, ["🌐 Traductor y 🎵 canciones", ["Abre el traductor", "Traduce al inglés: ¿dónde queda la estación?", "¿Cómo se dice «mucho gusto» en francés?", "Traduce este menú", "¿Qué canción es esta?", "Voy a tararear una canción", "Mis canciones"]]);
  };
  X._t317 = { traducir, panel, cerrar, reconocer, mostrarCancion, listaCanciones, conv: () => conv };
})();
