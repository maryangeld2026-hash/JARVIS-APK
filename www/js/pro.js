/* Jarvis para Android 3.18 · Jarvis ve tu pantalla · reuniones (graba con la pantalla apagada, transcribe, acta y tareas) ·
   memoria de largo plazo (chats, notas, documentos y, si quieres, tus mensajes) · compras y trámites (precios, requisitos,
   llenar formularios con tus datos) · subtítulos en vivo encima de cualquier app · Jarvis en el reloj y en los audífonos.
   Nunca paga, envía ni confirma por ti; tus datos de formularios no van a la IA. Se engancha a window.JX como los demás. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L13 = window.JL13, L12 = window.JL12, V = window.JV, IA = window.JIA, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const claves = () => D.ajustes.claves || {};
  const gemKey = () => (claves().gemini || "").trim();
  const hayIA = () => D.ajustes.proveedor !== "local" && !!(claves()[D.ajustes.proveedor] || "").trim();
  const docente = () => D.ajustes.docente === true;
  const estudiantes = () => [].concat(...(D.cursos || []).map((c) => c.estudiantes || [])).filter((n) => n && n.length > 3);
  const tieneNombres = (t) => docente() && estudiantes().some((n) => L13.norm(t).includes(L13.norm(n)));
  const sinNombres = (t) => (docente() ? String(t).split("\n").filter((l) => !estudiantes().some((n) => L13.norm(l).includes(L13.norm(n)))).join("\n") : String(t));
  const hoyTexto = () => new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const abrirUrl = (url) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url }).catch(() => {}); window.open(url, "_blank"); };
  function botones(e, ops) {
    const box = mk("div", "doc-acts");
    ops.filter(Boolean).forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => fn(b)); box.append(b); });
    e.append(box); return box;
  }
  function aviso(texto) {
    const LN = plug("LocalNotifications");
    if (LN) LN.schedule({ notifications: [{ id: 781018, title: "Jarvis", body: texto, schedule: { at: new Date(Date.now() + 200) } }] }).catch(() => {});
    const B = plug("Burbuja"); if (B && B.estado) B.estado({ modo: "idle", texto }).catch(() => {});
  }
  /** Gemini directo (audio, búsqueda en Google): → {texto, fuentes:[{title, uri}]} */
  async function gem(parts, o) {
    o = o || {};
    const key = gemKey(); if (!key) { const e = new Error("Para esto necesito la clave de Gemini (gratis): ponla en Ajustes › Inteligencia artificial."); e.code = "sin_gemini"; throw e; }
    const m = await IA.model(IA.cfgFor("gemini", false));
    const body = { contents: [{ role: "user", parts }], generationConfig: Object.assign({ temperature: 0.3, maxOutputTokens: o.maxTokens || 1500 }, o.json ? { responseMimeType: "application/json" } : {}) };
    if (o.buscar) body.tools = [{ google_search: {} }];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status === 429 ? "Gemini está ocupado o se acabó el cupo gratis por ahora; intenta en un rato." : "Gemini no respondió (" + r.status + ").");
    const j = await r.json(), c = (j.candidates || [])[0] || {};
    const fuentes = (((c.groundingMetadata || {}).groundingChunks) || []).map((x) => x.web).filter((w) => w && w.uri);
    return { texto: ((c.content || {}).parts || []).map((p) => p.text || "").join("").trim(), fuentes };
  }
  const fuentesMd = (f) => (f.length ? "\n\n**Fuentes:** " + f.slice(0, 6).map((w, i) => `[${i + 1}. ${w.title || "enlace"}](${w.uri})`).join(" · ") : "");

  // ======================================================================== 1) JARVIS VE TU PANTALLA
  let pantallaT = 0;                                                                   // cuándo se tomó la última foto de la pantalla
  async function revisarPantalla() {
    const T = plug("Telefono"); if (!T || !T.pantalla) return;
    try { const p = (await T.pantalla({})) || {}; pantallaT = Math.max(p.t || 0, 0); } catch (e) { /* nada */ }
  }
  async function verPantalla(q) {
    const T = plug("Telefono");
    if (!T || !T.pantalla) return R("Ver la pantalla funciona en la app instalada.", "err");
    let p = {}; try { p = await T.pantalla({ imagen: true }); } catch (e) { p = {}; }
    if (!p.activo) { const { e } = A.add("assistant", "Para ver tu pantalla necesito el control por voz de Jarvis (Accesibilidad).", "tool"); return botones(e, [["Abrir el ajuste", () => T.abrirAccesibilidad && T.abrirAccesibilidad()]]); }
    const fresca = !!p.img && Date.now() - (p.imgT || 0) < 5 * 60000;
    const texto = p.texto && Date.now() - (p.t || 0) < 5 * 60000 ? String(p.texto) : "";
    if (!fresca && !texto) return R(`Llámame desde la app que estás viendo (con la burbuja, el botón de asistente o diciendo «Jarvis») y ahí me dices «mira mi pantalla».${p.conFoto === false ? " En este Android solo puedo leer el texto de la pantalla, no verla." : ""}`, "err");
    if (!hayIA()) return R("Para entender tu pantalla necesito la IA: pon tu clave en Ajustes.", "err");
    const conFoto = fresca && !tieneNombres(texto);                                    // con nombres de estudiantes en pantalla: solo el texto, sin esos renglones
    const u = A.add("user", "📱 " + q);
    if (conFoto) { const im = mk("img", "msg-img"); im.src = "data:image/jpeg;base64," + p.img; u.e.prepend(im); }
    A.setState("thinking");
    try {
      const msg = conFoto ? { role: "user", content: L13.pantallaPrompt(q, p.app), image: { mime: "image/jpeg", data: p.img } }
        : { role: "user", content: L13.pantallaPrompt(q, p.app) + "\n\n(No tengo la foto; este es el texto de la pantalla:)\n" + sinNombres(texto).slice(0, 6000) };
      const t = await IA.chat({ system: A.systemPrompt ? A.systemPrompt(true) : "Eres Jarvis.", messages: [msg], stream: false, maxTokens: 900, temperature: 0.4 });
      const { e } = A.add("assistant", t, "");
      e.innerHTML = A.md(t);
      botones(e, [["↩ Volver a " + (p.app || "la app"), () => { const W = plug("Ventana"); if (W) W.minimizar().catch(() => {}); }], ["🌐 Traducir la pantalla", () => A.dispatch("traduce esta pantalla")]]);
      if (D.ajustes.voz) V.say(window.JL.forSpeech(t));
      if (X.onReply) X.onReply(t);
    } catch (er) { R(er.message || String(er), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }

  // ======================================================================== 2) REUNIONES
  let reuIv = null;
  async function grabar() {
    const G = plug("Grabadora");
    if (!G || !G.iniciar) { if (X._x37 && X._x37.meeting) return X._x37.meeting(); return R("Grabar reuniones funciona en la app instalada.", "err"); }
    const O = plug("Oido"); if (O && O.permiso) { try { const p = await O.permiso(); if (!p.ok) return R("Necesito permiso para usar el micrófono.", "err"); } catch (e) { /* sigue */ } }
    V.hush(); (V.cancelListening || V.stopListening)();
    let r; try { r = await G.iniciar({ id: "r" + Date.now() }); } catch (e) { return R(e.message || "No pude empezar a grabar.", "err"); }
    D.reuniones = D.reuniones || [];
    if (!D.reuniones.some((x) => x.id === r.id)) D.reuniones.unshift({ id: r.id, t: Date.now(), estado: "grabando" });
    save();
    R("🔴 **Grabando la reunión.** Puedes apagar la pantalla o usar otras apps: sigo grabando (lo ves en el aviso). Avísales a los presentes que estás grabando.\n\n" +
      "Al terminar, dime «termina la grabación» y te hago el resumen, los acuerdos y las tareas. _Android no deja que las apps graben llamadas: si es una llamada, ponla en altavoz y grábala así (con permiso de la otra persona)._",
      "tool", "Grabando. Puedes apagar la pantalla. Cuando termine, dime: termina la grabación.");
    hoja();
  }
  function hoja() {
    const G = plug("Grabadora"); if (!G) return;
    let sh = $("#reu18-sh"); if (sh) sh.remove();
    sh = mk("div", "sheet reu18"); sh.id = "reu18-sh";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.setAttribute("aria-label", "Ocultar"); x.addEventListener("click", () => cerrarHoja());
    hd.append(mk("h2", "", "🔴 Grabando"), x);
    const sc = mk("div", "scroll reu18-in"), tm = mk("p", "reu-t", "00:00"); tm.id = "reu18-t";
    const row = mk("div", "row wrap");
    const pb = mk("button", "btn", "⏸ Pausa"); pb.type = "button"; pb.id = "reu18-pausa";
    pb.addEventListener("click", async () => { const s = await G.estado(); if (s.pausado) await G.seguir(); else await G.pausar(); });
    const fin = mk("button", "btn primary", "⏹ Terminar y resumir"); fin.type = "button"; fin.id = "reu18-fin"; fin.addEventListener("click", () => parar(true));
    row.append(pb, fin);
    sc.append(tm, mk("p", "hint", "Sigue grabando aunque cierres esta ventana o apagues la pantalla. El audio se queda en el celular hasta que pidas el resumen."), row);
    inn.append(hd, sc); sh.append(inn); document.body.append(sh); sh.hidden = false;
    const pinta = async () => {
      let s; try { s = (await G.estado()) || {}; } catch (e) { return; }
      if (!s.grabando) { cerrarHoja(); return; }
      const seg = s.segundos || 0; tm.textContent = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
      pb.textContent = s.pausado ? "▶ Seguir" : "⏸ Pausa"; $("h2", hd).textContent = s.pausado ? "⏸ En pausa" : "🔴 Grabando";
    };
    clearInterval(reuIv); reuIv = setInterval(pinta, 1000); pinta();
  }
  function cerrarHoja() { clearInterval(reuIv); reuIv = null; const sh = $("#reu18-sh"); if (sh) sh.remove(); }
  async function parar(resumir) {
    const G = plug("Grabadora"); if (!G || !G.detener || $("#reu-sh:not([hidden])")) return X._x37 && X._x37.endMeeting ? X._x37.endMeeting(true) : null;
    const s = await G.estado().catch(() => ({}));
    if (!s.grabando) { cerrarHoja(); return s.pendiente ? resumirReunion(s.pendiente) : R("No estoy grabando nada."); }
    const r = await G.detener();
    cerrarHoja();
    const ru = (D.reuniones || []).find((x) => x.id === r.id); if (ru) { ru.estado = "grabada"; ru.seg = r.segundos; save(); }
    await espera(900);
    if (resumir) return resumirReunion(r.id, r.segundos);
    R(`Listo, guardé la grabación (${L13.durTexto(r.segundos)}). Dime «resume la última reunión» cuando quieras el acta.`);
  }
  async function resumirReunion(id, seg, ya) {
    const G = plug("Grabadora"); if (!G) return;
    if (!gemKey()) return R("Guardé la grabación. Para transcribirla y hacer el acta necesito la clave de Gemini (gratis): ponla en Ajustes › Inteligencia artificial y dime «resume la última reunión».", "err");
    if (docente() && !ya) {
      const { e } = A.add("assistant", "En la reunión pudieron decirse nombres de estudiantes. Para transcribirla, el audio va a Gemini. ¿Sigo?", "tool");
      return botones(e, [["Sí, transcríbela", (b) => { b.parentNode.remove(); resumirReunion(id, seg, true); }], ["Ahora no", (b) => { b.parentNode.remove(); R("Listo, la grabación queda guardada."); }]]);
    }
    let ps; try { ps = await G.partes({ id }); } catch (e) { ps = { lista: [] }; }
    const partes = ps.lista || []; seg = seg || ps.segundos;
    if (!partes.length) { G.listo({ id }).catch(() => {}); return R("La grabación quedó vacía."); }
    const { m, e } = A.add("assistant", `Transcribiendo la reunión (${L13.durTexto(seg)})…`, ""); e.classList.add("typing"); A.setState("thinking");
    let trans = "";
    try {
      for (let i = 0; i < partes.length; i++) {
        e.textContent = `Transcribiendo la parte ${i + 1} de ${partes.length}…`;
        const b = await G.leer({ ruta: partes[i].ruta });
        const t = await gem([{ inline_data: { mime_type: "audio/aac", data: b.data } }, { text: L13.transcribePrompt(i + 1, partes.length) }], { maxTokens: 8000, });
        trans += (trans ? "\n\n" : "") + (partes.length > 1 ? `— Parte ${i + 1} —\n` : "") + t.texto;
      }
      e.textContent = "Haciendo el acta…";
      const aj = await gem([{ text: L13.actaPrompt(trans, hoyTexto()) }], { json: true, maxTokens: 4000 });
      const acta = L13.actaLimpia(window.JL.extractJSON(aj.texto));
      const fecha = new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }), md = L13.actaMd(acta, fecha, L13.durTexto(seg));
      m.content = md; e.classList.remove("typing"); e.innerHTML = A.md(md);
      D.docs = D.docs || [];
      D.docs.unshift({ id: window.JD.uid(), titulo: "Transcripción · " + acta.titulo, md: trans, fecha: Date.now(), tipo: "reunion" });
      const doc = { id: window.JD.uid(), titulo: "Acta · " + acta.titulo, md, fecha: Date.now(), tipo: "acta" }; D.docs.unshift(doc);
      const ru = (D.reuniones || []).find((x) => x.id === id); if (ru) Object.assign(ru, { estado: "lista", titulo: acta.titulo, doc: doc.id, seg });
      save(); G.listo({ id }).catch(() => {});
      const ordenes = acta.tareas.map((t) => L13.tareaOrden(t)).filter(Boolean);
      botones(e, [ordenes.length && [`📅 Crear ${ordenes.length} recordatorio${ordenes.length > 1 ? "s" : ""}`, async (b) => { b.disabled = true; for (const o of ordenes) await A.dispatch(o); b.textContent = "📅 Listos"; }],
        ["📤 Compartir", () => N.share({ title: doc.titulo, text: md }).catch(() => {})],
        ["🗑 Borrar el audio", (b) => { G.borrar({ id }).catch(() => {}); b.textContent = "Audio borrado"; b.disabled = true; }]]);
      V.say(`Listo el acta: ${acta.resumen.split(/(?<=\.)\s/)[0] || acta.titulo}${acta.tareas.length ? ` Quedaron ${acta.tareas.length} tareas.` : ""}`);
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; e.textContent = (er.message || String(er)) + " La grabación sigue guardada: dime «resume la última reunión» para intentarlo otra vez."; }
    save(); if (A.getState() === "thinking") A.setState("idle");
  }
  function listaReuniones() {
    const l = (D.reuniones || []).slice(0, 10);
    if (!l.length) return R("Todavía no has grabado reuniones. Di «graba la reunión» para empezar.");
    const dia = (t) => new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
    R("🎙️ **Tus reuniones**\n" + l.map((r) => `- ${dia(r.t)} · ${r.titulo || "Reunión"}${r.seg ? " · " + L13.durTexto(r.seg) : ""}${r.estado === "lista" ? " ✓" : r.estado === "grabando" ? " (grabando)" : " (sin resumir)"}`).join("\n") + "\n\nLas actas quedan en Material.");
  }

  // ======================================================================== 4) MEMORIA DE LARGO PLAZO
  async function reunir() {
    const E = [];
    const chat = (lista, nombre) => (lista || []).forEach((m) => { if (m && m.content && (!m.cls || m.cls === "")) E.push({ fuente: nombre, de: m.role === "user" ? "Tú" : "Jarvis", texto: String(m.content).slice(0, 1500), t: m.t }); });
    chat(D.chat, "Chat");
    (D.convs || []).forEach((c) => chat(c.chat, "Chat «" + (c.nombre || "conversación") + "»"));
    (D.memoria || []).forEach((m) => E.push({ fuente: "Memoria", texto: m.texto, t: m.t }));
    (D.docs || []).forEach((d) => String(d.md || "").split(/\n{2,}/).forEach((p) => { if (p.trim().length > 20) E.push({ fuente: "Documento «" + (d.titulo || "") + "»", texto: p.slice(0, 1200), t: d.fecha }); }));
    ["bitacora", "diario", "observador", "compromisos"].forEach((k) => (Array.isArray(D[k]) ? D[k] : []).forEach((x) => { if (x && x.texto) E.push({ fuente: k === "bitacora" ? "Diario personal" : k, texto: String(x.texto).slice(0, 1200), t: x.t }); }));
    (D.recordatorios || []).forEach((r) => E.push({ fuente: "Recordatorio", texto: r.texto, t: r.creado || r.cuando }));
    (D.traducciones || []).forEach((r) => E.push({ fuente: "Traducción", texto: `${r.o} → ${r.tr}`, t: r.t }));
    (D.canciones || []).forEach((c) => E.push({ fuente: "Canción", texto: `${c.titulo} — ${c.artista}`, t: c.t }));
    let msgs = false;
    const M = plug("Mensajes");
    if (M && M.archivo) { try { const r = await M.archivo({ dias: 30 }); msgs = !!r.activo; (r.lista || []).forEach((x) => E.push({ fuente: x.a || "Mensaje", de: x.d, texto: x.x, t: x.t })); } catch (e) { /* nada */ } }
    return { E: E.filter((x) => x.texto), msgs };
  }
  async function memoria(it) {
    A.setState("thinking");
    try {
      const { E, msgs } = await reunir();
      let extra = [];
      if (hayIA() && navigator.onLine) { try { const j = await Promise.race([IA.json({ system: "Respondes solo JSON.", messages: [{ role: "user", content: L13.expandirPrompt(sinNombres(it.q)) }], maxTokens: 200 }), espera(5000).then(() => null)]); extra = ((j && j.palabras) || []).slice(0, 10).map(String); } catch (e) { /* sin sinónimos */ } }
      const r = L13.buscarMem(E, it.q, { persona: it.persona, ventana: it.ventana, extra, max: 10 });
      const nota = !msgs && plug("Mensajes") ? "\n\n_Si quieres que también recuerde tus mensajes de WhatsApp y otros chats (30 días, solo en el celular), actívalo en Ajustes › Memoria._" : "";
      if (!r.length) return R(`No encontré nada sobre eso en lo que tengo guardado, ${A.trato()}.${nota}`);
      const items = r.map((x) => Object.assign({}, x, { texto: sinNombres(x.texto) })).filter((x) => x.texto.trim());
      const dia = (t) => (t ? new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "");
      const lista = items.slice(0, 6).map((x, i) => `${i + 1}. ${x.fuente}${x.de ? " · " + x.de : ""}${x.t ? " · " + dia(x.t) : ""}: «${String(x.texto).replace(/\s+/g, " ").slice(0, 110)}»`).join("\n");
      if (!hayIA() || !items.length) return R("🧠 **Lo que encontré:**\n" + lista + nota, "tool", `Encontré ${items.length} cosas. Te las muestro.`);
      const t = await IA.chat({ system: (A.systemPrompt ? A.systemPrompt(true) : "Eres Jarvis.") + " Ahora respondes buscando en la memoria de la persona.", messages: [{ role: "user", content: L13.memPrompt(it.q, items, hoyTexto()) }], stream: false, maxTokens: 700, temperature: 0.3 });
      const md = "🧠 " + t + "\n\n<small>" + lista.replace(/\n/g, "<br>") + "</small>" + nota;
      const { e } = A.add("assistant", md, "tool mem");
      e.innerHTML = A.md(md);
      if (D.ajustes.voz) V.say(window.JL.forSpeech(t.replace(/\[\d+\]/g, "")));
      if (X.onReply) X.onReply(t);
    } catch (er) { R(er.message || String(er), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }

  // ======================================================================== 5) COMPRAS Y TRÁMITES
  async function precios(producto) {
    A.setState("thinking");
    try {
      const r = await gem([{ text: L13.preciosPrompt(producto) }], { buscar: true, maxTokens: 1500 });
      const tabla = L13.preciosTabla(r.texto), barato = tabla[0];
      const md = `🛒 **${producto}**\n\n${r.texto}${fuentesMd(r.fuentes)}\n\n_Yo no compro ni pago: tú decides y pagas en la tienda._`;
      const { e } = A.add("assistant", md, "tool compra"); e.innerHTML = A.md(md);
      const url = (t) => { const f = r.fuentes.find((w) => L13.norm(w.title || "").includes(L13.norm(t).split(" ")[0])); return f ? f.uri : "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(producto + " " + t); };
      botones(e, [barato && ["🛍️ Abrir " + barato.tienda, () => abrirUrl(url(barato.tienda))], ["🔔 Revisar cada lunes", () => A.dispatch(`cada lunes a las 9 de la mañana compara precios de ${producto}`)],
        ["🔎 Ver en Google Shopping", () => abrirUrl("https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(producto))]]);
      V.say(barato ? `Lo más barato que encontré: ${barato.tienda}, por ${barato.precio.toLocaleString("es-CO")} pesos.` : "Te dejo los precios en la pantalla.");
    } catch (er) { R(er.message || String(er), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  async function tramite(q) {
    A.setState("thinking");
    try {
      const r = await gem([{ text: L13.tramitePrompt(q) }], { buscar: true, maxTokens: 1500 });
      const md = `🏛️ **${q.charAt(0).toUpperCase() + q.slice(1)}**\n\n${r.texto}${fuentesMd(r.fuentes)}`;
      const { e } = A.add("assistant", md, "tool"); e.innerHTML = A.md(md);
      const oficial = r.fuentes.find((w) => /\.gov\.co|gov\.co|cancilleria|registraduria|runt|simit|dian|policia/i.test((w.title || "") + w.uri));
      botones(e, [oficial && ["🌐 Página oficial", () => abrirUrl(oficial.uri)], ["⏰ Recuérdamelo mañana", () => A.dispatch(`recuérdame mañana a las 9 de la mañana hacer el trámite: ${q}`)]]);
      V.say("Te dejo en la pantalla los requisitos, el costo y los pasos.");
    } catch (er) { R(er.message || String(er), "err"); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  async function formulario() {
    const T = plug("Telefono");
    if (!T || !T.agenteUi) return R("Llenar formularios funciona en la app instalada.", "err");
    const p = D.perfil || {};
    if (!Object.values(p).some(Boolean)) { const { e } = A.add("assistant", "Primero guarda tus datos en **Ajustes › Mis datos para formularios**. Se quedan solo en este celular y no van a la IA ni a las copias.", "tool"); return botones(e, [["Abrir Ajustes", () => { const b = $("#btn-ajustes"); if (b) b.click(); setTimeout(() => { const s = $("#aj-perfil"); if (s) { const d = s.closest("details"); if (d) d.open = true; s.scrollIntoView({ block: "center" }); } }, 500); }]]); }
    try { await T.agenteUi(); } catch (e) { const { e: e2 } = A.add("assistant", "Para escribir en otras apps necesito el control por voz de Jarvis (Accesibilidad).", "tool"); return botones(e2, [["Abrir el ajuste", () => T.abrirAccesibilidad && T.abrirAccesibilidad()]]); }
    R("Vuelvo al formulario y lo lleno con tus datos. Nunca escribo contraseñas ni datos de tarjetas, y no lo envío: eso lo revisas y lo tocas tú.", "tool", "Vuelvo al formulario y lo lleno. Tú lo revisas y lo envías.");
    await Promise.race([V.idle(), espera(5000)]);
    const W = plug("Ventana"); if (W) await W.minimizar().catch(() => {});
    await espera(1300);
    let ui; try { ui = await T.agenteUi(); } catch (e) { return aviso("Perdí el control de la pantalla."); }
    if (!ui || ui.pkg === "co.jarvis.docente") return aviso("No encontré el formulario. Ábrelo y llámame desde ahí (burbuja o botón de asistente).");
    const map = L13.mapearCampos(ui.nodos || [], p);
    if (!map.length) return aviso("No encontré campos de un formulario que yo pueda llenar en esta pantalla.");
    let ok = 0; const hechos = [];
    for (const c of map) { try { const r = await T.agenteAccion({ accion: "escribir", i: c.i, texto: c.v }); if (r && r.ok) { ok++; hechos.push(c.k); } } catch (e) { /* sigue */ } await espera(150); }
    const NOM = { nombre: "nombre", apellido: "apellidos", nombreCompleto: "nombre", email: "correo", telefono: "celular", documento: "documento", direccion: "dirección", ciudad: "ciudad", barrio: "barrio", fechaNac: "fecha de nacimiento", empresa: "empresa", cargo: "cargo" };
    const txt = ok ? `✍️ Llené ${ok} campo${ok > 1 ? "s" : ""} (${hechos.map((k) => NOM[k] || k).join(", ")}). Revísalo y envíalo tú.` : "No pude escribir en esos campos.";
    A.add("assistant", txt, "tool"); aviso(txt);
  }

  // ======================================================================== 6) SUBTÍTULOS EN VIVO
  async function subtitulos(it) {
    const S = plug("Subtitulos");
    if (!S) return R("Los subtítulos en vivo funcionan en la app instalada.", "err");
    if (it.su === "off") { await S.detener().catch(() => {}); return R("Listo, quité los subtítulos."); }
    const de = it.de || D.ajustes.subDe || "en-US", a = it.a || D.ajustes.subA || "es";
    const O = plug("Oido"); if (O && O.permiso) { try { await O.permiso(); } catch (e) { /* sigue */ } }
    V.hush(); (V.cancelListening || V.stopListening)();
    try { await S.iniciar({ de, a, tam: +D.ajustes.subTam || 22 }); }
    catch (e) {
      if (e.code === "overlay") { const { e: e2 } = A.add("assistant", "Para mostrar los subtítulos encima de otras apps necesito el permiso «Mostrar sobre otras apps».", "tool"); return botones(e2, [["Dar el permiso", () => { const B = plug("Burbuja"); if (B && B.pedirPermiso) B.pedirPermiso().catch(() => {}); }]]); }
      return R(e.message || "No pude empezar los subtítulos.", "err");
    }
    const n = (x) => L12 ? L12.nombre(String(x).slice(0, 2)) : x;
    R(`💬 **Subtítulos en vivo:** ${n(de)}${de.slice(0, 2) !== a ? " → " + n(a) : ""}. Abre tu video o acércate a quien habla: la franja aparece abajo y la puedes arrastrar. ` +
      "Oigo por el micrófono, así que funciona con el sonido por el parlante (con audífonos no lo oigo). Para quitarlos toca ✕ o dime «quita los subtítulos».", "tool", "Listo, subtítulos en vivo. Abre tu video.");
    await Promise.race([V.idle(), espera(5000)]);
    const W = plug("Ventana"); if (W) W.minimizar().catch(() => {});
  }

  // ======================================================================== 7) RELOJ Y AUDÍFONOS
  let audifonos = false;
  const modoAudifonos = () => D.ajustes.modoAudifonos === true || (audifonos && D.ajustes.audifonosAuto !== false);
  async function reloj(on) {
    const Rj = plug("Reloj"); if (!Rj) return R("Jarvis en el reloj funciona en la app instalada.", "err");
    D.ajustes.reloj = on; save();
    await Rj.activar({ on }).catch(() => {});
    R(on ? "⌚ Listo. En tu reloj (y en el celular) aparece el aviso de Jarvis: toca **Preguntar**, háblale y la respuesta llega al reloj. Funciona con relojes que dejan responder avisos (Wear OS, Galaxy Watch y otros). Jarvis debe quedar abierto o minimizado en el celular."
      : "Quité el aviso de Jarvis del reloj.");
  }
  let relojOcupado = Promise.resolve();
  function preguntaReloj(texto) {
    relojOcupado = relojOcupado.then(async () => {
      const Rj = plug("Reloj"); if (!Rj || !texto) return;
      const n0 = D.chat.length;
      try { await A.handle(texto, false); } catch (e) { /* abajo */ }
      await espera(400);
      const r = D.chat.slice(n0).filter((m) => m.role === "assistant" && m.content).map((m) => m.content).join("\n");
      await Rj.responder({ pregunta: texto, texto: L13.paraReloj(r) || "Listo." }).catch(() => {});
    });
    return relojOcupado;
  }

  // ======================================================================== AJUSTES
  function ajustes() {
    const box = $("#aj2"); if (!box || $("#aj-318")) return;
    const sec = mk("div"); sec.id = "aj-318";
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked, i)); l.append(i, document.createTextNode(" " + label)); sec.append(l); return i; };
    sec.append(mk("h3", "sub", "Jarvis ve tu pantalla"));
    chk("Al llamarme desde otra app, tomar una foto de la pantalla para «mira mi pantalla» (Android 11 o más; nunca en apps de bancos ni de claves)", D.ajustes.pantallaFoto !== false, (v) => { D.ajustes.pantallaFoto = v; save(); const T = plug("Telefono"); if (T && T.pantallaFoto) T.pantallaFoto({ on: v }).catch(() => {}); });
    sec.append(mk("p", "hint", "La foto se queda en la memoria del celular 5 minutos y solo va a la IA cuando me preguntas por tu pantalla."));
    sec.append(mk("h3", "sub", "Memoria"));
    chk("Recordar mis mensajes de WhatsApp, Telegram y otros chats por 30 días (solo en este celular) para preguntas como «¿qué me dijo Carlos del contrato?»", D.ajustes.archivarMsgs === true, (v) => { D.ajustes.archivarMsgs = v; save(); const M = plug("Mensajes"); if (M) M.config({ archivar: v }).catch(() => {}); });
    const bb = mk("button", "btn", "🗑 Borrar la memoria de mensajes"); bb.type = "button"; bb.addEventListener("click", () => { const M = plug("Mensajes"); if (M && M.borrarArchivo) M.borrarArchivo().then(() => A.toast("Borrada.")).catch(() => {}); }); sec.append(bb);
    sec.append(mk("p", "hint", "Necesita «Leer y responder mensajes» activado. Busco también en tus chats con Jarvis, notas, documentos, actas y diario."));
    sec.append(mk("h3", "sub", "Mis datos para formularios"));
    const pf = mk("div", "aj-perfil"); pf.id = "aj-perfil";
    D.perfil = D.perfil || {};
    L13.PERFIL.forEach(([k, t]) => { const i = mk("input", "inp"); i.placeholder = t; i.value = D.perfil[k] || ""; i.autocomplete = "off"; i.addEventListener("change", () => { D.perfil[k] = i.value.trim(); save(); }); pf.append(i); });
    sec.append(pf, mk("p", "hint", "Se quedan solo en este celular: no van a la IA ni a las copias. Di «llena este formulario» desde el formulario. Nunca escribo contraseñas ni datos de tarjetas, y nunca envío."));
    sec.append(mk("h3", "sub", "Subtítulos en vivo"));
    const row = mk("div", "row wrap");
    const sd = mk("select", "inp half"); [["en-US", "Del inglés"], ["fr-FR", "Del francés"], ["pt-BR", "Del portugués"], ["de-DE", "Del alemán"], ["it-IT", "Del italiano"], ["ja-JP", "Del japonés"], ["ko-KR", "Del coreano"], ["es-CO", "Del español (sin traducir)"]].forEach(([k, t]) => sd.append(new Option(t, k)));
    sd.value = D.ajustes.subDe || "en-US"; sd.addEventListener("change", () => { D.ajustes.subDe = sd.value; save(); });
    const st = mk("select", "inp half"); [["18", "Letra mediana"], ["22", "Letra grande"], ["28", "Letra muy grande"]].forEach(([k, t]) => st.append(new Option(t, k)));
    st.value = String(D.ajustes.subTam || 22); st.addEventListener("change", () => { D.ajustes.subTam = +st.value; save(); });
    row.append(sd, st); sec.append(row);
    sec.append(mk("h3", "sub", "Reloj y audífonos"));
    chk("Jarvis en el reloj (aviso con «Preguntar» para hablarle desde el reloj)", D.ajustes.reloj === true, (v) => reloj(v));
    chk("Modo audífonos automático: al conectarlos, respuestas cortas y todo en voz", D.ajustes.audifonosAuto !== false, (v) => { D.ajustes.audifonosAuto = v; save(); });
    sec.append(mk("p", "hint", "Para llamar a Jarvis desde los audífonos (mantener presionado el botón), escoge Jarvis como «App de asistente digital» en los Ajustes del celular."));
    box.append(sec);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, promptExtra: X.promptExtra };
  X.intent = function (text) {
    const ac = L13.accIntent(text); if (ac) return Object.assign({ p318: "acc" }, ac);
    const su = L13.subIntent(text); if (su) return Object.assign({ p318: "sub" }, su);
    const re = L13.reuIntent(text); if (re) return Object.assign({ p318: "reu" }, re);
    const pa = L13.pantallaIntent(text, false); if (pa) return Object.assign({ p318: "pan" }, pa);
    const co = L13.compraIntent(text); if (co) return Object.assign({ p318: "co" }, co);
    const me = L13.memIntent(text); if (me) return Object.assign({ p318: "mem" }, me);
    const otra = base.intent(text);
    if (otra) return otra;
    // recién te llamaron desde otra app: «¿qué significa este error?» es sobre la pantalla (solo si no es otra orden de Jarvis)
    const pr = Date.now() - pantallaT < 90000 && L13.pantallaIntent(text, true);
    return pr ? Object.assign({ p318: "pan" }, pr) : null;
  };
  X.run = async function (it, text) {
    if (!it.p318) return base.run(it, text);
    switch (it.p318) {
      case "pan": return verPantalla(it.q);
      case "reu":
        if (it.re === "grabar") return grabar();
        if (it.re === "parar") return parar(true);
        if (it.re === "pausa" || it.re === "seguir") { const G = plug("Grabadora"); if (!G) return R("No estoy grabando."); await (it.re === "pausa" ? G.pausar() : G.seguir()); return R(it.re === "pausa" ? "Grabación en pausa." : "Sigo grabando."); }
        if (it.re === "lista") return listaReuniones();
        { const G = plug("Grabadora"); const s = G ? await G.estado().catch(() => ({})) : {}; const ult = (D.reuniones || [])[0];
          if (s.pendiente) return resumirReunion(s.pendiente);
          if (ult && ult.doc) { const d = (D.docs || []).find((x) => x.id === ult.doc); if (d) { const { e } = A.add("assistant", d.md, "tool"); e.innerHTML = A.md(d.md); return; } }
          if (ult) return resumirReunion(ult.id, ult.seg);
          return R("No tengo reuniones grabadas."); }
      case "mem": return memoria(it);
      case "co": return it.co === "precios" ? precios(it.producto) : it.co === "tramite" ? tramite(it.q) : formulario();
      case "sub": return subtitulos(it);
      case "acc":
        if (it.acc === "reloj") return reloj(it.on);
        D.ajustes.modoAudifonos = it.on; save();
        return R(it.on ? "🎧 Modo audífonos: respondo corto y todo en voz." : "Modo audífonos apagado.");
    }
  };
  X.promptExtra = function (q) { return base.promptExtra(q) + (modoAudifonos() ? L13.AUDIFONOS : ""); };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { ajustes(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /pantalla y reuniones/.test(x[0]))) C.splice(1, 0, ["📱 Pantalla y reuniones · 🧠 memoria · 🛒 compras", ["Mira mi pantalla", "Graba la reunión", "¿Qué me dijo Carlos del contrato?", "Compara precios de un televisor de 55 pulgadas", "¿Cómo saco el pasaporte?", "Llena este formulario", "Pon subtítulos del inglés", "Activa Jarvis en el reloj"]]);
    // la grabadora: si está grabando, la hoja; si quedó una sin resumir, se ofrece
    const G = plug("Grabadora");
    const revisarG = async () => {
      if (!G || !G.estado) return; let s; try { s = (await G.estado()) || {}; } catch (e) { return; }
      if (s.grabando && !$("#reu18-sh")) hoja();
      else if (!s.grabando && s.pendiente && D.ajustes.reuOfrecida !== s.pendiente) {
        D.ajustes.reuOfrecida = s.pendiente; save();
        const { e } = A.add("assistant", "🎙️ Tienes una reunión grabada sin resumir. ¿Hago el acta con los acuerdos y las tareas?", "tool");
        botones(e, [["📝 Sí, hazla", (b) => { b.parentNode.remove(); resumirReunion(s.pendiente); }], ["Después", (b) => b.parentNode.remove()]]);
      }
    };
    setTimeout(revisarG, 1200);
    // reloj y audífonos
    const Rj = plug("Reloj");
    if (Rj && Rj.estado) {
      window.JON(Rj, "pregunta", (d) => { if (d && d.texto) preguntaReloj(d.texto); });
      window.JON(Rj, "audifonos", (d) => {
        const antes = audifonos; audifonos = !!(d && d.audifonos);
        if (audifonos !== antes && D.ajustes.audifonosAuto !== false) {                // con audífonos, todo en voz (y al quitarlos, como estaba)
          if (audifonos && !D.ajustes.voz) { D.ajustes.voz = true; D.ajustes.vozPorAudifonos = true; save(); }
          else if (!audifonos && D.ajustes.vozPorAudifonos) { D.ajustes.voz = false; D.ajustes.vozPorAudifonos = false; save(); }
        }
        if (audifonos !== antes && D.ajustes.audifonosAuto !== false) A.toast(audifonos ? `🎧 ${d.nombre || "Audífonos"} conectados: respondo corto y en voz.` : "🎧 Audífonos desconectados.", 3500);
      });
      Promise.resolve(Rj.estado()).then((s) => { s = s || {}; audifonos = !!s.audifonos; if (s.pendiente) preguntaReloj(s.pendiente); }).catch(() => {});
      if (D.ajustes.reloj && Rj.activar) Promise.resolve(Rj.activar({ on: true })).catch(() => {});
    }
    const T = plug("Telefono"); if (T && T.pantallaFoto && D.ajustes.pantallaFoto === false) T.pantallaFoto({ on: false }).catch(() => {});
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { revisarPantalla(); revisarG(); } });
    revisarPantalla();
  };
  X._p318 = { verPantalla, grabar, parar, resumirReunion, memoria, precios, tramite, formulario, subtitulos, reloj, preguntaReloj, modoAudifonos: () => modoAudifonos() };
})();
