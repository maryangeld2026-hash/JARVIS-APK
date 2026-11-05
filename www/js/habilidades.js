/* Jarvis para Android 3.0 · las habilidades del Jarvis del computador que faltaban:
   documentos con IA (plan de clase, guía, rúbrica, correo, circular, acta, agenda, planeación, solucionario, podcast,
   refuerzo, ajustes razonables…), observador del estudiante, diario de clase, compromisos, horario y clase actual,
   periodo, «¿cuánto necesita para pasar?», tendencias, ficha del estudiante, personalidad, asignatura, «¿qué hiciste
   hoy?», resumen semanal, retrospectiva, mapa de errores, tarjetas de estudio (Anki), simulacro Saber, Kahoot,
   gráficas de funciones, investigar en internet (con fuentes) y preguntar por una foto desde la conversación. */
(function () {
  "use strict";
  const L = window.JL, L2 = window.JL2, L3 = window.JL3, V = window.JV, N = window.JN, IA = window.JIA;
  const X = window.JX;
  if (!X || !L3) return;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const uid = () => window.JD.uid();
  const slug = (t) => String(t || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60) || "documento";
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const ab64 = (buf) => { let bin = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
  function loadScript(src) { return new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No pude cargar " + src)); document.head.appendChild(s); }); }
  const today = () => new Date().toDateString();
  /** Pinta el markdown mientras llega, pero como mucho 4 veces por segundo (con KaTeX, pintar en cada trozo traba el celular). */
  function painter(e) { let t = 0, pend = null; return (txt) => { pend = txt; const now = performance.now(); if (now - t > 250) { t = now; e.innerHTML = A.md(pend); } }; }

  function ensure() {
    D.docs = D.docs || []; D.observador = D.observador || {}; D.diario = D.diario || []; D.compromisos = D.compromisos || [];
    D.mazos = D.mazos || []; D.erroresLog = D.erroresLog || [];
    D.ajustes.horario = D.ajustes.horario || ""; D.ajustes.periodoFin = D.ajustes.periodoFin || 0;
    D.ajustes.persona = D.ajustes.persona || "normal"; D.ajustes.asignatura = D.ajustes.asignatura || "matemáticas";
  }
  const cursos = () => { const cur = A.courseFor(null); return cur ? [cur].concat(D.cursos.filter((c) => c !== cur)) : D.cursos; };
  const nt = (c) => { if (c && !c.notas) c.notas = { actividades: [], valores: {} }; return c; };
  function who(quien) { D.cursos.forEach(nt); return L2.findStudent(cursos(), quien); }
  function ctx() {
    const c = A.courseFor(null), g = c && (c.nombre.match(/\d{1,2}/) || [])[0];
    return { grado: g ? ` para grado ${g}` : "", asig: D.ajustes.asignatura && !/^matem/i.test(D.ajustes.asignatura) ? ` (asignatura: ${D.ajustes.asignatura})` : "", nombre: D.ajustes.nombre, duracion: 55, semanas: 10 };
  }

  // ======================================================================== DOCUMENTOS CON IA
  async function makeDoc(id, args) {
    const d = L3.docById(id), titulo = d.titulo(args);
    const { m, e } = A.add("assistant", "", "");
    e.classList.add("typing");
    A.setState("thinking");
    let last = 0;
    try {
      const full = await IA.chat({ system: "Eres un docente experto de un colegio en Colombia. Escribe en español, en markdown claro (títulos con ###, listas, tablas si ayudan).",
        messages: [{ role: "user", content: d.prompt(args, ctx()) }], maxTokens: 3500, temperature: 0.5,
        onDelta: (_, all) => { m.content = all; const now = performance.now(); if (now - last > 250) { last = now; e.innerHTML = A.md(all); } } });
      m.content = `### ${titulo}\n\n` + full.replace(/^\s*#{1,3}\s+.*\n/, "");
      e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      const doc = { id: uid(), titulo, md: m.content, fecha: Date.now(), tipo: id, podcast: !!d.podcast };
      D.docs.unshift(doc); D.docs = D.docs.slice(0, 120); save();
      e.append(docActions(doc));
      A.say(d.podcast ? "Listo el guion del podcast. Toca «Escuchar» para oírlo." : `Listo: ${titulo}. Lo guardé en Material, y desde ahí lo pasas a Word, PDF o lo compartes.`);
      if (window.JX.onReply) window.JX.onReply("Listo: " + titulo);
    } catch (er) { e.classList.remove("typing"); m.content = er.message; m.cls = "err"; e.classList.add("err"); e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }
  function docActions(doc) {
    const box = mk("div", "doc-acts");
    const b = (l, fn, cls = "") => { const x = mk("button", "chip " + cls, l); x.type = "button"; x.addEventListener("click", fn); box.append(x); };
    b("Word", () => docWord(doc).catch((e) => A.toast("No pude hacer el Word: " + e.message, 6000)));
    b("PDF", () => docPDF(doc).catch((e) => A.toast("No pude hacer el PDF: " + e.message, 6000)));
    b("Compartir", () => N.share({ title: doc.titulo, text: L.plainMath(doc.md.replace(/^#+\s*/gm, "").replace(/\*\*/g, "*")) }).catch(() => {}));
    b(doc.podcast ? "▶ Escuchar" : "🔊 Leer", () => { V.hush(); L.forSpeech(doc.md).split(/(?<=[.!?…])\s+/).forEach((f) => V.say(f)); });
    return box;
  }
  async function docWord(doc) {
    if (!window.docx) await loadScript("vendor/docx.iife.js");
    const Xd = window.docx;
    const runs = (t) => {
      const out = [];
      String(L.plainMath(t)).split(/(\*\*[^*]+\*\*)/).forEach((p) => { if (!p) return; const bold = /^\*\*.*\*\*$/.test(p); out.push(new Xd.TextRun({ text: bold ? p.slice(2, -2) : p.replace(/\*/g, ""), bold, font: "Calibri", size: 24 })); });
      return out;
    };
    const kids = [];
    const lines = doc.md.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (/^\s*\|.*\|\s*$/.test(ln)) {                                     // tabla markdown → tabla de Word
        const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())); i++; }
        i--;
        kids.push(new Xd.Table({ rows: rows.map((r, ri) => new Xd.TableRow({ children: r.map((c) => new Xd.TableCell({ children: [new Xd.Paragraph({ children: ri === 0 ? [new Xd.TextRun({ text: L.plainMath(c).replace(/\*/g, ""), bold: true, font: "Calibri", size: 22 })] : runs(c) })] })) })) }));
        continue;
      }
      const h = ln.match(/^\s*(#{1,4})\s+(.*)$/), li = ln.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
      if (h) kids.push(new Xd.Paragraph({ heading: h[1].length <= 2 ? Xd.HeadingLevel.HEADING_1 : Xd.HeadingLevel.HEADING_2, children: [new Xd.TextRun({ text: L.plainMath(h[2]).replace(/\*/g, ""), bold: true, font: "Calibri", size: h[1].length <= 3 ? 30 : 26 })] }));
      else if (li) kids.push(new Xd.Paragraph({ bullet: { level: 0 }, children: runs(li[1]) }));
      else if (ln.trim()) kids.push(new Xd.Paragraph({ spacing: { after: 120 }, children: runs(ln) }));
    }
    const docx = new Xd.Document({ creator: "Jarvis", title: doc.titulo, sections: [{ children: kids }] });
    const blob = await Xd.Packer.toBlob(docx);
    await N.share({ title: doc.titulo, fileName: slug(doc.titulo) + ".docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: ab64(await blob.arrayBuffer()) });
  }
  async function docPDF(doc) {
    await window.JPDF.libs();
    const { jsPDF } = window.jspdf;
    const p = new jsPDF({ unit: "mm", format: "letter" });
    p.addFileToVFS("dv.ttf", window.JARVIS_FUENTE.regular); p.addFont("dv.ttf", "DV", "normal");
    p.addFileToVFS("dvb.ttf", window.JARVIS_FUENTE.bold); p.addFont("dvb.ttf", "DV", "bold");
    const W = p.internal.pageSize.getWidth(), H = p.internal.pageSize.getHeight(), M = 18;
    let y = M;
    const put = (t, size, bold, ind = 0) => { p.setFont("DV", bold ? "bold" : "normal"); p.setFontSize(size); p.splitTextToSize(t, W - 2 * M - ind).forEach((l) => { if (y > H - 16) { p.addPage(); y = M; } p.text(l, M + ind, y); y += size * 0.45; }); y += 1.5; };
    doc.md.split("\n").forEach((ln) => {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(ln)) return;
      const t = L.plainMath(ln).replace(/\*\*/g, "").replace(/\*/g, "");
      const h = t.match(/^\s*#{1,4}\s+(.*)$/), li = t.match(/^\s*(?:[-•*])\s+(.*)$/);
      if (h) { y += 2; put(h[1], 14, true); } else if (/^\s*\|/.test(t)) put(t.replace(/^\s*\||\|\s*$/g, "").split("|").map((c) => c.trim()).join("   ·   "), 10.5, false);
      else if (li) put("•  " + li[1], 11, false, 4); else if (t.trim()) put(t, 11, false); else y += 2;
    });
    await N.share({ title: doc.titulo, fileName: slug(doc.titulo) + ".pdf", mime: "application/pdf", base64: p.output("datauristring").split(",")[1] });
  }
  /** Material guardado: en la pestaña Quices (que ahora dice «Material»). */
  function renderDocs() {
    let box = $("#docs-box");
    const host = $("#v-quices .scroll");
    if (!host) return;
    if (!box) {
      box = mk("div"); box.id = "docs-box";
      host.append(box);
      const t = $('.tabs button[data-tab="quices"] span'); if (t) t.textContent = "Material";
    }
    box.textContent = "";
    box.append(mk("h3", "sub", "Documentos"));
    const ul = mk("ul", "lista");
    if (!D.docs.length) ul.append(mk("li", "hint", "Pídeme «planéame la clase de…», «hazme una guía de…», «redacta un correo a…», «rúbrica para…», «planea mi periodo de…»."));
    D.docs.forEach((d) => {
      const li = mk("li", "click"), g = mk("div", "grow", d.titulo); g.append(mk("small", "", new Date(d.fecha).toLocaleDateString("es-CO")));
      const x = mk("button", "x"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>';
      x.addEventListener("click", (ev) => { ev.stopPropagation(); if (confirm("¿Borrar «" + d.titulo + "»?")) { D.docs = D.docs.filter((y) => y !== d); save(); renderDocs(); } });
      li.append(g, x); li.addEventListener("click", () => openDoc(d)); ul.append(li);
    });
    box.append(ul);
    if (D.mazos.length) {
      box.append(mk("h3", "sub", "Tarjetas de estudio"));
      const u2 = mk("ul", "lista");
      D.mazos.forEach((mz) => { const li = mk("li", "click"), g = mk("div", "grow", mz.titulo); g.append(mk("small", "", `${mz.tarjetas.length} tarjetas`)); li.append(g); li.addEventListener("click", () => openCards(mz)); u2.append(li); });
      box.append(u2);
    }
  }
  function sheet(id, title) {
    let sh = $("#" + id);
    if (!sh) {
      sh = mk("div", "sheet"); sh.id = id; sh.hidden = true;
      sh.innerHTML = `<div class="sheet-in full"><div class="sheet-h"><h2></h2><button class="icon-btn" type="button" aria-label="Cerrar"><svg><use href="#i-x"/></svg></button></div><div class="scroll"></div></div>`;
      document.body.append(sh);
      sh.querySelector(".sheet-h button").addEventListener("click", () => (sh.hidden = true));
    }
    sh.querySelector("h2").textContent = title;
    const body = sh.querySelector(".scroll"); body.textContent = "";
    sh.hidden = false;
    return body;
  }
  function openDoc(d) {
    const body = sheet("doc-ver", d.titulo);
    const art = mk("div", "doc-md msg jarvis"); art.innerHTML = A.md(d.md); body.append(art, docActions(d));
  }
  function openCards(mz) {
    const body = sheet("mazo-ver", mz.titulo);
    let i = 0, back = false;
    const card = mk("div", "flash"), nav = mk("div", "row");
    const draw = () => { const t = mz.tarjetas[i]; card.classList.toggle("back", back); card.innerHTML = `<small>${i + 1} / ${mz.tarjetas.length} · ${back ? "respuesta" : "pregunta"}</small><div>${A.mdInline(back ? t.reverso : t.frente)}</div>`; };
    card.addEventListener("click", () => { back = !back; draw(); });
    const b = (l, fn, cls = "") => { const x = mk("button", "btn " + cls, l); x.type = "button"; x.addEventListener("click", fn); nav.append(x); };
    b("◀", () => { i = (i - 1 + mz.tarjetas.length) % mz.tarjetas.length; back = false; draw(); });
    b("Voltear", () => { back = !back; draw(); }, "primary");
    b("▶", () => { i = (i + 1) % mz.tarjetas.length; back = false; draw(); });
    const ex = mk("div", "row wrap");
    const e1 = mk("button", "btn small", "Exportar a Anki"); e1.type = "button";
    e1.addEventListener("click", () => N.share({ title: mz.titulo, fileName: slug(mz.titulo) + "-anki.txt", mime: "text/plain", base64: b64(L3.ankiTSV(mz)) }).catch(() => {}));
    ex.append(e1, mk("span", "hint", "En Anki: Archivo › Importar (separado por tabuladores)."));
    body.append(card, nav, ex); draw();
  }

  // ======================================================================== GRÁFICAS
  function plot(expr) {
    const fn = L3.compileFn(expr);
    if (!fn) return A.reply("No entendí esa función. Escríbela así: «grafica y = x^2 - 4».", "err");
    const { m, e } = A.add("assistant", `Gráfica de $y = ${expr.replace(/\*/g, "\\cdot ")}$`, "tool");
    void m;
    const cv = mk("canvas", "plot"); cv.width = 640; cv.height = 420; e.append(cv);
    drawPlot(cv, fn);
    const fs = mk("button", "chip", "⛶ Pantalla completa"); fs.type = "button";
    fs.addEventListener("click", () => { const big = mk("div", "plot-full"); const c2 = mk("canvas"); c2.width = Math.round(innerWidth * devicePixelRatio); c2.height = Math.round(innerHeight * devicePixelRatio); big.append(c2); const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.addEventListener("click", () => big.remove()); big.append(x); document.body.append(big); drawPlot(c2, fn, true); });
    e.append(fs);
    A.say(`Ahí está la gráfica de y igual a ${L.mathWords(expr)}.`);
  }
  function drawPlot(cv, fn, big) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, P = L3.samplePlot(fn, -10, 10, 600);
    const X0 = -10, X1 = 10, sx = (x) => ((x - X0) / (X1 - X0)) * W, sy = (y) => H - ((y - P.ymin) / (P.ymax - P.ymin)) * H;
    g.fillStyle = "#050b14"; g.fillRect(0, 0, W, H);
    g.strokeStyle = "rgba(46,230,255,.12)"; g.lineWidth = 1;
    const stepY = Math.pow(10, Math.floor(Math.log10((P.ymax - P.ymin) / 5)));
    for (let x = X0; x <= X1; x++) { g.beginPath(); g.moveTo(sx(x), 0); g.lineTo(sx(x), H); g.stroke(); }
    for (let y = Math.ceil(P.ymin / stepY) * stepY; y <= P.ymax; y += stepY) { g.beginPath(); g.moveTo(0, sy(y)); g.lineTo(W, sy(y)); g.stroke(); }
    g.strokeStyle = "rgba(232,244,255,.7)"; g.lineWidth = big ? 3 : 1.5;
    g.beginPath(); g.moveTo(0, sy(0)); g.lineTo(W, sy(0)); g.moveTo(sx(0), 0); g.lineTo(sx(0), H); g.stroke();
    g.fillStyle = "rgba(232,244,255,.6)"; g.font = `${big ? 26 : 13}px sans-serif`;
    for (let x = X0 + 2; x < X1; x += 2) if (x) g.fillText(String(x), sx(x) + 3, Math.min(H - 4, Math.max(14, sy(0) + (big ? 28 : 14))));
    g.strokeStyle = "#2ee6ff"; g.lineWidth = big ? 6 : 3; g.shadowColor = "#2ee6ff"; g.shadowBlur = big ? 14 : 6;
    g.beginPath(); let pen = false, prev = null;
    P.pts.forEach(([x, y]) => {
      if (y == null || (prev != null && Math.abs(y - prev) > (P.ymax - P.ymin) * 0.8)) { pen = false; prev = y; return; }
      const px = sx(x), py = sy(y);
      if (!pen) { g.moveTo(px, py); pen = true; } else g.lineTo(px, py);
      prev = y;
    });
    g.stroke(); g.shadowBlur = 0;
  }

  // ======================================================================== INVESTIGAR Y FOTO EN LA CONVERSACIÓN
  async function research(q, fondo) {
    const { m, e } = A.add("assistant", "", "");
    e.classList.add("typing"); A.setState("thinking");
    const gem = IA.proveedor() === "gemini";
    try {
      const full = await IA.chat({ system: "Eres un asistente de investigación para una persona en Colombia. Responde en español con datos actuales y concretos" + (fondo ? ", en un informe con secciones (### ) y conclusiones" : ", breve") + ". Si algo no es seguro, dilo.",
        messages: [{ role: "user", content: q }], buscar: true, maxTokens: fondo ? 3500 : 1200, onDelta: ((pt) => (_, all) => { m.content = all; pt(all); })(painter(e)) });
      const f = IA.fuentes();
      m.content = full + (f.length ? "\n\n**Fuentes:**\n" + f.slice(0, 6).map((x) => `- ${x.titulo} ${x.uri}`).join("\n") : gem ? "" : "\n\n*(Con ChatGPT o Claude la respuesta no busca en internet: usa lo que el modelo ya sabe.)*");
      e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      if (fondo) { const doc = { id: uid(), titulo: "Investigación: " + q.slice(0, 60), md: "### " + q + "\n\n" + m.content, fecha: Date.now(), tipo: "investigacion" }; D.docs.unshift(doc); e.append(docActions(doc)); }
      A.say(L.forSpeech(full).split(/(?<=[.!?])\s+/).slice(0, 3).join(" "));
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }
  function shrink(file, max = 1600) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => no(new Error("No pude abrir esa imagen.")); img.src = URL.createObjectURL(file); });
  }
  async function photoQuestion(file) {
    const q = $("#in-texto").value.trim() || "¿Qué hay en esta imagen? Si es un ejercicio o un tablero, explícalo y resuélvelo paso a paso.";
    $("#in-texto").value = "";
    let url; try { url = await shrink(file); } catch (e) { return A.toast(e.message); }
    const u = A.add("user", q); const im = mk("img", "msg-img"); im.src = url; u.e.prepend(im);
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    try {
      const full = await IA.chat({ system: "Eres Jarvis, asistente personal en Colombia. Responde en español; fórmulas en LaTeX entre $…$.",
        messages: [{ role: "user", content: q, image: { mime: "image/jpeg", data: url.split(",")[1] } }], maxTokens: 2500, onDelta: ((pt) => (_, all) => { m.content = all; pt(all); })(painter(e)) });
      m.content = full; e.classList.remove("typing"); e.innerHTML = A.md(full);
      A.say(L.forSpeech(full).split(/(?<=[.!?])\s+/).slice(0, 3).join(" "));
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }

  // ======================================================================== DATOS: OBSERVADOR, DIARIO, COMPROMISOS…
  const fecha = (t) => new Date(t).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
  async function data(it, text) {
    const R = A.reply, now = new Date();
    switch (it.kind) {
      case "obs_add": { const f = who(it.quien); if (!f) return R(`No encontré a «${it.quien}» en tus cursos.`); (D.observador[f.nombre] = D.observador[f.nombre] || []).push({ t: Date.now(), texto: it.texto, curso: f.curso.nombre }); save(); return R(`Anotado en el observador de ${f.nombre}: «${it.texto}».`); }
      case "obs_ver": { const f = who(it.quien); if (!f) return R(`No encontré a «${it.quien}».`); const o = D.observador[f.nombre] || []; return R(o.length ? `**Observador de ${f.nombre}:**\n` + o.map((x) => `- ${fecha(x.t)}: ${x.texto}`).join("\n") : `El observador de ${f.nombre} está vacío.`, "tool", o.length ? `${f.nombre} tiene ${o.length} anotaciones. Están en la pantalla.` : null); }
      case "diario_add": { const c = L.findCourse(D.cursos, it.curso); D.diario.push({ t: Date.now(), curso: c ? c.nombre : it.curso.toUpperCase(), texto: it.texto }); save(); return R(`Anotado en el diario de ${c ? c.nombre : it.curso.toUpperCase()}: ${it.texto}.`); }
      case "diario_ver": { const k = L.norm(it.curso); const l = D.diario.filter((x) => L.norm(x.curso) === k); return R(l.length ? `**Lo que han visto en ${l[0].curso}:**\n` + l.map((x) => `- ${fecha(x.t)}: ${x.texto}`).join("\n") : `No tengo anotado nada de ${it.curso.toUpperCase()}. Dime «hoy en ${it.curso.toUpperCase()} vimos…».`, "tool", l.length ? `En ${l[0].curso} llevan ${l.length} temas. Están en la pantalla.` : null); }
      case "comp_add": D.compromisos.push({ id: uid(), t: Date.now(), texto: it.texto, hecho: false }); save(); return R(`Anotado el compromiso: «${it.texto}». Cuando lo cumplas, dime «ya…».`);
      case "comp_ver": { const p = D.compromisos.filter((c) => !c.hecho); return R(p.length ? "**Compromisos pendientes:**\n" + p.map((c) => `- ${c.texto} (desde ${fecha(c.t)})`).join("\n") : "No tienes compromisos pendientes.", "tool", p.length ? `Tienes ${p.length} compromisos pendientes: ${p.slice(0, 3).map((c) => c.texto).join("; ")}.` : null); }
      case "comp_ok": { const w = L.norm(it.texto).split(" ").filter((x) => x.length >= 4); const c = D.compromisos.filter((x) => !x.hecho).map((x) => ({ x, sc: w.filter((y) => L.norm(x.texto).includes(y)).length })).sort((a, b) => b.sc - a.sc)[0]; if (!c || !c.sc) return R("No encontré ese compromiso entre los pendientes."); c.x.hecho = true; save(); return R(`¡Bien! Marqué como cumplido: «${c.x.texto}».`); }
      case "periodo_set": { const d = L3.periodEnd(it.dia, it.mes); if (!d) return R("No entendí la fecha."); D.ajustes.periodoFin = d.getTime(); save(); return R(`Listo: el periodo termina el ${d.toLocaleDateString("es-CO", { day: "numeric", month: "long" })}.`); }
      case "periodo_ver": { if (!D.ajustes.periodoFin) return R("Dime cuándo termina: «el periodo termina el 28 de noviembre»."); const dias = Math.ceil((D.ajustes.periodoFin - Date.now()) / 864e5); return R(dias > 0 ? `Faltan ${dias} días para terminar el periodo (${new Date(D.ajustes.periodoFin).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}).` : "El periodo ya terminó. Dime la fecha del siguiente."); }
      case "clase_ahora": return R(L3.classNowSpoken(L3.parseSchedule(D.ajustes.horario), now));
      case "mi_dia": {
        const parts = [], h = L3.parseSchedule(D.ajustes.horario), c = L3.classNow(h, now);
        if (c.hoy.length) parts.push(`Hoy tienes ${c.hoy.length} clases: ${c.hoy.map((x) => `${x.que} a las ${L3.hhmm(x.ini)}`).join(", ")}.`);
        const rs = D.recordatorios.filter((r) => !r.avisado && new Date(r.cuando).toDateString() === now.toDateString());
        if (rs.length) parts.push(`Recordatorios: ${rs.map((r) => r.texto).join(", ")}.`);
        const p = D.compromisos.filter((x) => !x.hecho); if (p.length) parts.push(`Tienes ${p.length} compromisos pendientes.`);
        D.cursos.forEach((k) => { nt(k); const st = L2.courseStats(k, D.ajustes.escala); if (st.riesgo.length) parts.push(`En ${k.nombre} hay ${st.riesgo.length} en riesgo.`); });
        if (D.ajustes.periodoFin) { const dias = Math.ceil((D.ajustes.periodoFin - Date.now()) / 864e5); if (dias > 0 && dias <= 21) parts.push(`Faltan ${dias} días para cerrar el periodo.`); }
        return R(parts.join(" ") || "Tu día está despejado: no tengo clases, recordatorios ni pendientes para hoy.");
      }
      case "necesita": {
        const f = who(it.quien); if (!f) return R(`No encontré a «${it.quien}».`);
        const r = L3.neededToPass(f.curso.notas, f.nombre, D.ajustes.escala.basico);
        if (r.sinNotas) return R(`${f.nombre} todavía no tiene notas.`);
        if (r.ya) return R(`${f.nombre} ya va ganando, con ${L2.fmtNota(r.promedio)}.`);
        return R(r.posible ? `${f.nombre} va con ${L2.fmtNota(r.promedio)}. Para llegar a ${L2.fmtNota(D.ajustes.escala.basico)} necesita sacar ${L2.fmtNota(r.necesita)} en la próxima actividad.` : `${f.nombre} va con ${L2.fmtNota(r.promedio)}: con una sola actividad no le alcanza (necesitaría ${L2.fmtNota(r.necesita)}). Necesita un plan de recuperación.`);
      }
      case "riesgo_ano": {
        const out = [];
        D.cursos.forEach((k) => { nt(k); const st = L2.courseStats(k, D.ajustes.escala); st.riesgo.forEach((r) => { const n = L3.neededToPass(k.notas, r.nombre, D.ajustes.escala.basico); out.push(`- ${r.nombre} (${k.nombre}): ${L2.fmtNota(r.promedio)}${n.necesita ? ` · necesita ${L2.fmtNota(n.necesita)}` : ""}`); }); });
        return R(out.length ? `**Pueden perder (${out.length}):**\n` + out.join("\n") : "Con las notas que tengo, nadie va perdiendo.", "tool", out.length ? `Hay ${out.length} estudiantes que pueden perder. Están en la pantalla.` : null);
      }
      case "tendencia": {
        const out = [];
        cursos().forEach((k) => { nt(k); L3.trends(k, it.dir).slice(0, 6).forEach((x) => out.push(`- ${x.nombre} (${k.nombre}): ${x.cambio > 0 ? "+" : ""}${L2.fmtNota(x.cambio).replace("-", "−")} en «${x.actividad}» (${L2.fmtNota(x.ultima)})`)); });
        return R(out.length ? `**${it.dir === "baja" ? "Vienen bajando" : "Para felicitar"}:**\n` + out.join("\n") : it.dir === "baja" ? "Nadie viene bajando en la última actividad." : "Nadie subió claramente en la última actividad.", "tool", out.length ? `${out.length} estudiantes. Están en la pantalla.` : null);
      }
      case "ficha": {
        const f = who(it.quien); if (!f) return R(`No encontré a «${it.quien}».`);
        const n = f.curso.notas, prom = L2.average(n, f.nombre), v = (n.valores || {})[f.nombre] || {};
        const obs = D.observador[f.nombre] || [], fotos = D.fotos.filter((x) => x.estudiante === f.nombre);
        return R(`### ${f.nombre} · ${f.curso.nombre}\n**Promedio:** ${L2.fmtNota(prom)} (${L.performance(prom, D.ajustes.escala) || "sin notas"})\n` +
          (n.actividades.length ? n.actividades.map((a) => `- ${a.nombre}: ${typeof v[a.id] === "number" ? L2.fmtNota(v[a.id]) : "—"}`).join("\n") + "\n" : "") +
          (obs.length ? `\n**Observador:**\n` + obs.slice(-5).map((x) => `- ${fecha(x.t)}: ${x.texto}`).join("\n") + "\n" : "") +
          (fotos.length ? `\n**Trabajos calificados con foto:** ${fotos.length} (último: ${L2.fmtNota(fotos[0].nota)})` : ""), "tool", `${f.nombre} va con ${L2.fmtNota(prom)}. Su ficha está en la pantalla.`);
      }
      case "personalidad": D.ajustes.persona = it.modo; save(); return R(it.modo === "normal" ? "Vuelvo a mi forma de hablar de siempre." : `Listo, me pongo ${it.modo}.`);
      case "asignatura": if (!it.asig) return R(`Estamos en ${D.ajustes.asignatura}.`); D.ajustes.asignatura = it.asig; save(); return R(`Listo, estamos en ${it.asig}. Lo tendré en cuenta en las explicaciones y el material.`);
      case "hoy_hice": {
        const hoyMsgs = D.chat.filter((m) => m.role === "user" && new Date(m.t).toDateString() === today());
        const q = D.quices.filter((x) => new Date(x.fecha).toDateString() === today()).length, d = D.docs.filter((x) => new Date(x.fecha).toDateString() === today()).length;
        return R(hoyMsgs.length ? `Hoy me pediste ${hoyMsgs.length} cosas${q ? `, hicimos ${q} quiz(es)` : ""}${d ? ` y ${d} documento(s)` : ""}. Lo último:\n` + hoyMsgs.slice(-8).map((m) => "- " + m.content.slice(0, 90)).join("\n") : "Hoy todavía no me has pedido nada.", "tool", hoyMsgs.length ? `Hoy me pediste ${hoyMsgs.length} cosas. Están en la pantalla.` : null);
      }
      case "semanal": {
        const w = Date.now() - 7 * 864e5, cnt = (l, k = "fecha") => l.filter((x) => (x[k] || x.t || 0) >= w).length;
        const fotos = D.fotos.filter((x) => x.fecha >= w), prom = fotos.length ? fotos.reduce((a, x) => a + x.nota, 0) / fotos.length : null;
        const lines = [`- Quices: ${cnt(D.quices)} · documentos: ${cnt(D.docs)} · tarjetas: ${cnt(D.mazos, "t")}`, `- Trabajos calificados con foto: ${fotos.length}${prom != null ? ` (promedio ${L2.fmtNota(prom)})` : ""}`,
          `- Temas vistos: ${D.diario.filter((x) => x.t >= w).map((x) => `${x.curso}: ${x.texto}`).join("; ") || "sin anotar"}`, `- Compromisos pendientes: ${D.compromisos.filter((x) => !x.hecho).length}`];
        D.cursos.forEach((k) => { nt(k); const st = L2.courseStats(k, D.ajustes.escala); if (st.actividades) lines.push(`- ${k.nombre}: promedio ${L2.fmtNota(st.promedio)}, ${st.riesgo.length} en riesgo`); });
        return R("**Resumen de la semana**\n" + lines.join("\n"), "tool", "Aquí está el resumen de tu semana.");
      }
      case "retro": case "errores": return aiFromData(it.kind);
      case "tarjetas": {
        A.setState("thinking");
        try { const r = L3.cleanCards(await IA.json({ system: "Eres un docente experto.", messages: [{ role: "user", content: L3.cardsPrompt(it.tema) }] })); if (r.error) throw new Error(r.error);
          const mz = Object.assign(r.mazo, { id: uid(), t: Date.now() }); D.mazos.unshift(mz); save(); openCards(mz); renderDocs(); return R(`Listas ${mz.tarjetas.length} tarjetas de «${mz.titulo}». Tócalas para voltearlas; puedes exportarlas a Anki.`); }
        finally { if (A.getState() === "thinking") A.setState("idle"); }
      }
      case "saber": {
        const c = A.courseFor(null), g = c && (c.nombre.match(/\d{1,2}/) || [])[0];
        const q = await A.makeQuiz({ tema: `simulacro tipo prueba Saber ${g || "11"} (ICFES)${it.tema ? " de " + it.tema : " de matemáticas"}: preguntas de selección múltiple con contexto, como en la prueba real`, n: 10, grado: g ? +g : 11, tipo: "quiz", curso: c && c.nombre });
        if (q) R(`Listo el simulacro tipo Saber con ${q.quiz.preguntas.length} preguntas. Está en la pestaña Material (Word, PDF, Forms, Kahoot o proyector).`);
        return;
      }
      case "investigar": return research(it.q, it.fondo);
    }
    void text;
  }
  async function aiFromData(kind) {
    let prompt;
    if (kind === "errores") {
      const errs = D.erroresLog.slice(0, 80).map((x) => x.e);
      if (errs.length < 2) return A.reply("Todavía no tengo errores registrados: califica algunas fotos de trabajos y te muestro los más comunes.");
      prompt = "Estos son errores encontrados al revisar trabajos de matemáticas de estudiantes (sin nombres):\n- " + errs.join("\n- ") +
        "\n\nAgrúpalos en un «mapa de errores»: los 3 a 5 errores más comunes con cuántas veces aparecen, por qué ocurren y una actividad de refuerzo corta para cada uno. Markdown.";
    } else {
      const st = D.cursos.map((k) => { nt(k); const x = L2.courseStats(k, D.ajustes.escala); return `${k.nombre}: ${k.estudiantes.length} estudiantes, promedio ${L2.fmtNota(x.promedio)}, ${x.riesgo.length} en riesgo, distribución ${JSON.stringify(x.distribucion)}`; });
      prompt = `Haz una retrospectiva breve de mi trabajo como docente (qué salió bien, qué mejorar, 3 metas) con estos datos (sin nombres de estudiantes):\n${st.join("\n")}\nQuices hechos: ${D.quices.length}. Documentos: ${D.docs.length}. Temas vistos: ${D.diario.slice(-20).map((x) => x.curso + ": " + x.texto).join("; ") || "sin anotar"}.`;
    }
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    try {
      const full = await IA.chat({ system: "Eres un experto en pedagogía de las matemáticas en Colombia. Escribe en markdown.", messages: [{ role: "user", content: prompt }], maxTokens: 2500, onDelta: ((pt) => (_, all) => { m.content = all; pt(all); })(painter(e)) });
      m.content = full; e.classList.remove("typing"); e.innerHTML = A.md(full);
      const doc = { id: uid(), titulo: kind === "errores" ? "Mapa de errores" : "Retrospectiva", md: "### " + (kind === "errores" ? "Mapa de errores" : "Retrospectiva") + "\n\n" + full, fecha: Date.now(), tipo: kind };
      D.docs.unshift(doc); e.append(docActions(doc)); A.say(`Listo: ${doc.titulo}. Está en la pantalla y en Material.`);
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }
  /** Informe para la familia: la IA recibe las notas sin el nombre; el nombre lo pone el celular. */
  async function familyReport(quien) {
    const f = who(quien);
    if (!f) return A.reply(`No encontré a «${quien}».`);
    const n = f.curso.notas, prom = L2.average(n, f.nombre), obs = (D.observador[f.nombre] || []).slice(-5).map((x) => x.texto).join("; ");
    const prompt = `Redacta un informe breve y respetuoso para la familia de [ESTUDIANTE] (curso ${f.curso.nombre}) en ${D.ajustes.asignatura}: fortalezas, aspectos por mejorar y 3 recomendaciones para casa. ` +
      `Notas: ${L3.anonGrades(n, f.nombre) || "sin notas"}. Promedio: ${L2.fmtNota(prom)} (${L.performance(prom, D.ajustes.escala) || "—"}).` + (obs ? ` Observaciones: ${obs}.` : "") + ` Firma: ${D.ajustes.nombre || "la docente"}. Usa siempre «[ESTUDIANTE]» en lugar del nombre.`;
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    try {
      const full = await IA.chat({ system: "Eres una docente en Colombia que escribe a las familias con calidez.", messages: [{ role: "user", content: prompt }], maxTokens: 1800, onDelta: ((pt) => (_, all) => { m.content = all.replace(/\[ESTUDIANTE\]/g, f.nombre); pt(m.content); })(painter(e)) });
      m.content = `### Informe para la familia de ${f.nombre}\n\n` + full.replace(/\[ESTUDIANTE\]/g, f.nombre);
      e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      const doc = { id: uid(), titulo: "Informe para la familia: " + f.nombre, md: m.content, fecha: Date.now(), tipo: "familia" };
      D.docs.unshift(doc); e.append(docActions(doc)); A.say("Listo el informe para la familia. Revísalo antes de enviarlo.");
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }
  /** Plan de recuperación del curso: la IA recibe las actividades y cuántos van mal en cada una (sin nombres). */
  async function recoveryPlan(cursoTxt) {
    const c = (cursoTxt && L.findCourse(D.cursos, cursoTxt)) || A.courseFor(null);
    if (!c) return A.reply("¿De qué curso? Primero importa o crea el curso con sus notas.");
    nt(c);
    const st = L2.courseStats(c, D.ajustes.escala);
    if (!st.actividades) return A.reply(`${c.nombre} no tiene notas todavía.`);
    const bajas = c.notas.actividades.map((a) => `${a.nombre}: ${c.estudiantes.filter((n) => { const v = (c.notas.valores[n] || {})[a.id]; return typeof v === "number" && v < D.ajustes.escala.basico; }).length} de ${c.estudiantes.length} por debajo de básico`);
    const temas = D.diario.filter((x) => L.norm(x.curso) === L.norm(c.nombre)).slice(-10).map((x) => x.texto).join("; ");
    return makeDocCustom(`Plan de recuperación: ${c.nombre}`, `Diseña un plan de recuperación para ${st.riesgo.length} estudiantes en riesgo del curso ${c.nombre} en ${D.ajustes.asignatura}. Resultados por actividad: ${bajas.join("; ")}.` +
      (temas ? ` Temas vistos: ${temas}.` : "") + " Incluye: temas a reforzar, 3 actividades de recuperación con fecha sugerida, cómo evaluarlas y un mensaje modelo para las familias. Markdown.");
  }
  async function makeDocCustom(titulo, prompt) {
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    try {
      const full = await IA.chat({ system: "Eres un docente experto de un colegio en Colombia. Escribe en markdown.", messages: [{ role: "user", content: prompt }], maxTokens: 3000, onDelta: ((pt) => (_, all) => { m.content = all; pt(all); })(painter(e)) });
      m.content = `### ${titulo}\n\n` + full; e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      const doc = { id: uid(), titulo, md: m.content, fecha: Date.now(), tipo: "custom" }; D.docs.unshift(doc); e.append(docActions(doc));
      A.say(`Listo: ${titulo}. Está en Material.`);
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }

  // ======================================================================== KAHOOT (botón en los quices)
  async function kahoot(it) {
    if (!window.XLSX) await loadScript("vendor/xlsx.mini.min.js");
    const ws = window.XLSX.utils.aoa_to_sheet(L3.kahootRows(it.quiz));
    const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, ws, "Kahoot");
    await N.share({ title: it.quiz.titulo + " (Kahoot)", fileName: slug(it.quiz.titulo) + "-kahoot.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: window.XLSX.write(wb, { type: "base64", bookType: "xlsx" }) });
    A.toast("En Kahoot: Crear › Importar hoja de cálculo, y sube este archivo.", 6000);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, promptExtra: X.promptExtra, quizButtons: X.quizButtons, settings: X.settings, afterGrade: X.afterGrade };
  X.intent = function (text) {
    const t = L.norm(text);
    let m;
    if ((m = t.match(/\binforme\s+(?:para\s+)?(?:la\s+familia|los\s+padres|los\s+acudientes|el\s+acudiente)\s+de\s+(.+)$/))) return { kind: "h_familia", quien: m[1] };
    if ((m = t.match(/\bplan(?:es)?\s+de\s+(?:recuperacion|nivelacion|mejoramiento)\b(?:\s+(?:de|para)\s+(\S+))?/))) return { kind: "h_recuperacion", curso: m[1] || "" };
    return L3.graphIntent(text) || L3.docIntent(text) || L3.dataIntent(text) || base.intent(text);
  };
  X.run = function (it, text) {
    if (it.kind === "doc") return makeDoc(it.doc, it.args);
    if (it.kind === "graficar") return plot(it.expr);
    if (it.kind === "h_familia") return familyReport(it.quien);
    if (it.kind === "h_recuperacion") return recoveryPlan(it.curso);
    const known = ["obs_add", "obs_ver", "diario_add", "diario_ver", "comp_add", "comp_ver", "comp_ok", "periodo_set", "periodo_ver", "clase_ahora", "mi_dia", "necesita", "riesgo_ano",
      "tendencia", "ficha", "personalidad", "asignatura", "hoy_hice", "semanal", "retro", "errores", "tarjetas", "saber", "investigar"];
    if (known.includes(it.kind)) return data(it, text);
    return base.run(it, text);
  };
  X.promptExtra = function (q) {
    const p = L3.PERSONAS[D.ajustes.persona] || "";
    return base.promptExtra(q) + (p ? " " + p : "") + (D.ajustes.docente === true && D.ajustes.asignatura ? ` La clase actual es de ${D.ajustes.asignatura}.` : "");   // 3.16: sin modo docente, nada de clases
  };
  X.quizButtons = function (btn, it) { base.quizButtons(btn, it); btn("Kahoot", "", () => kahoot(it).catch((e) => A.toast("No pude hacer el archivo de Kahoot: " + e.message, 6000))); };
  X.afterGrade = function (box, rev, whoName, c) {
    (rev.errores || []).forEach((e) => D.erroresLog.unshift({ t: Date.now(), e: String(e).slice(0, 200), curso: c ? c.nombre : "" }));
    D.erroresLog = D.erroresLog.slice(0, 300); save();
    base.afterGrade(box, rev, whoName, c);
  };
  X.hoyExtra = function () {
    const out = [];
    if (!D) return out;
    const c = L3.classNow(L3.parseSchedule(D.ajustes.horario));
    if (c.ahora) out.push({ txt: `● ${c.ahora.que} · faltan ${c.ahora.falta} min`, cls: "run", cmd: "¿qué clase tengo ahora?" });
    else if (c.siguiente && c.siguiente.en <= 120) out.push({ txt: `⏭ ${c.siguiente.que} en ${c.siguiente.en} min`, cmd: "¿qué clase tengo ahora?" });
    const p = D.compromisos.filter((x) => !x.hecho).length; if (p) out.push({ txt: `✓ ${p} compromiso${p > 1 ? "s" : ""}`, cmd: "¿qué compromisos tengo?" });
    if (D.ajustes.periodoFin) { const d = Math.ceil((D.ajustes.periodoFin - Date.now()) / 864e5); if (d > 0 && d <= 30) out.push({ txt: `📅 ${d} días para cerrar el periodo`, cmd: "¿cuánto falta para terminar el periodo?" }); }
    return out;
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    const box = $("#aj2"); if (!box || $("#aj-h3")) return;
    const sec = mk("div"); sec.id = "aj-h3";
    sec.append(mk("h3", "sub", "Horario y colegio"));
    sec.append(mk("p", "hint", "Una clase por línea: «lunes 7:00-7:55 7A». Así te digo qué clase tienes ahora y la siguiente."));
    const ta = mk("textarea", "inp"); ta.rows = 6; ta.placeholder = "lunes 7:00-7:55 7A\nlunes 8:00-8:55 10B\nmartes 7:00-8:50 9C"; ta.value = D.ajustes.horario;
    ta.addEventListener("change", () => { D.ajustes.horario = ta.value; save(); const n = L3.parseSchedule(ta.value).length; A.toast(`Horario guardado: ${n} clase${n === 1 ? "" : "s"}.`); });
    sec.append(ta);
    const row = mk("div", "row wrap");
    const asig = mk("input", "inp half"); asig.value = D.ajustes.asignatura; asig.placeholder = "Asignatura"; asig.addEventListener("change", () => { D.ajustes.asignatura = asig.value.trim() || "matemáticas"; save(); });
    const per = mk("select", "inp half"); Object.keys(L3.PERSONAS).forEach((k) => per.append(new Option("Personalidad: " + k, k))); per.value = D.ajustes.persona; per.addEventListener("change", () => { D.ajustes.persona = per.value; save(); });
    row.append(asig, per); sec.append(row);
    box.prepend(sec);
  };
  X.init = function (api) {
    A = api; D = api.D;
    // 3.1: primero lo que se ve (el botón de la cámara); si algo de los otros módulos falla, no se lleva esto por delante
    camButton();
    try { ensure(); } catch (e) { console.error(e); }
    try { base.init(api); } catch (e) { console.error("init", e); A.toast("Una parte de Jarvis no arrancó: " + (e.message || e), 6000); }
    try { save(); renderDocs(); } catch (e) { console.error(e); }
    const q = document.querySelector('.tabs button[data-tab="quices"]'); if (q) q.addEventListener("click", () => setTimeout(renderDocs, 50));
  };
  function camButton() {
    // 3.2: el botón junto al campo de escribir abre un menú: tomar foto con la cámara, escoger de la galería o subir un documento
    const f = $("#f-escribir");
    if (!f || $("#btn-foto-chat")) return;
    const b = mk("button", "icon-btn"); b.type = "button"; b.id = "btn-foto-chat"; b.setAttribute("aria-label", "Adjuntar: cámara, foto o documento");
    b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 11.5 12.6 20a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15.6 7.4"/></svg>';
    const file = (id, accept, capture) => { const i = mk("input"); i.type = "file"; i.id = id; i.accept = accept; i.hidden = true; if (capture) i.setAttribute("capture", "environment"); f.append(i); return i; };
    const cam = file("chat-cam-in", "image/*", true), gal = file("chat-foto-in", "image/*", false);
    const doc = file("chat-doc-in", ".pdf,.doc,.docx,.odt,.rtf,.txt,.md,.csv,.tsv,.json,.html,.xml,.xls,.xlsx,.ods,.pptx,application/pdf,text/*,application/*", false);
    const menu = mk("div", "adj-menu"); menu.id = "adj-menu"; menu.hidden = true;
    [["📷", "Tomar foto", cam], ["🖼️", "Foto de la galería", gal], ["📄", "Documento (PDF, Word, Excel, texto…)", doc]].forEach(([ic, t, inp]) => {
      const o = mk("button", "adj-op"); o.type = "button"; o.append(mk("span", "adj-ic", ic), mk("span", "", t));
      o.addEventListener("click", () => { menu.hidden = true; inp.click(); });
      menu.append(o);
    });
    $(".dock").append(menu);
    b.addEventListener("click", (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) menu.hidden = true; });
    const go = (inp, fn) => inp.addEventListener("change", () => { const fl = inp.files[0]; inp.value = ""; if (fl) fn(fl); });
    go(cam, photoQuestion); go(gal, photoQuestion); go(doc, (fl) => (/^image\//.test(fl.type) ? photoQuestion(fl) : docQuestion(fl)));
    f.prepend(b);
  }

  // ======================================================================== 3.2: DOCUMENTOS EN LA CONVERSACIÓN
  /** Saca el texto de un documento en el celular. PDF va tal cual a la IA (Gemini, ChatGPT y Claude lo leen). */
  async function docText(file) {
    const name = file.name || "documento", ext = (name.split(".").pop() || "").toLowerCase();
    if (ext === "pdf" || file.type === "application/pdf") {
      if (file.size > 15 * 1024 * 1024) throw new Error("Ese PDF es muy grande (más de 15 MB). Prueba con uno más liviano o solo las páginas que necesitas.");
      const b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = () => no(new Error("No pude leer el PDF.")); r.readAsDataURL(file); });
      return { pdf: { mime: "application/pdf", data: b64, nombre: name } };
    }
    if (/^(xlsx|xls|ods|csv|tsv)$/.test(ext)) {
      if (!window.XLSX) await loadScript("vendor/xlsx.mini.min.js");
      const wb = window.XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
      return { texto: wb.SheetNames.slice(0, 8).map((n) => `## Hoja «${n}»\n` + window.XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join("\n\n") };
    }
    if (/^(docx|odt|pptx)$/.test(ext)) {
      if (!window.XLSX) await loadScript("vendor/xlsx.mini.min.js");
      const z = window.XLSX.CFB.read(new Uint8Array(await file.arrayBuffer()), { type: "array" });
      const paths = ext === "docx" ? ["/word/document.xml"] : ext === "odt" ? ["/content.xml"]
        : z.FullPaths.filter((p) => /\/ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)[1]) - parseInt(b.match(/(\d+)\.xml/)[1]));
      const out = paths.map((p, i) => { const e = window.XLSX.CFB.find(z, p); if (!e || !e.content) return "";
        const xml = new TextDecoder().decode(e.content instanceof Uint8Array ? e.content : new Uint8Array(e.content));
        const t = xml.replace(/<\/(?:w:p|text:p|text:h|a:p)>/g, "\n").replace(/<w:tab\/>/g, "\t").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
        return ext === "pptx" ? `## Diapositiva ${i + 1}\n${t.trim()}` : t; });
      return { texto: out.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
    }
    if (ext === "doc") throw new Error("Los .doc viejos de Word no se pueden leer aquí. Ábrelo en Word y guárdalo como .docx o PDF.");
    const t = await file.text();
    if (/[\u0000-\u0008\u000E-\u001F]/.test(t.slice(0, 2000))) throw new Error("No sé leer ese tipo de archivo. Sirven PDF, Word (.docx), Excel, PowerPoint (.pptx), texto y CSV.");
    return { texto: ext === "html" || ext === "xml" ? t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ") : ext === "rtf" ? t.replace(/\\[a-z]+-?\d* ?|[{}]/g, "") : t };
  }
  async function docQuestion(file) {
    const q = $("#in-texto").value.trim() || "Resume este documento en puntos clave y dime qué puedo hacer con él en clase.";
    $("#in-texto").value = "";
    const u = A.add("user", q); u.e.prepend(mk("div", "msg-doc", "📄 " + (file.name || "documento")));
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); e.textContent = "Leyendo el documento…"; A.setState("thinking");
    try {
      const d = await docText(file);
      if (d.texto != null && !d.texto.trim()) throw new Error("El documento no tiene texto que pueda leer (¿es una imagen escaneada? Mándalo como foto o PDF).");
      const MAX = 60000, corto = d.texto && d.texto.length > MAX;
      const content = d.pdf ? q : `${q}\n\n--- Documento «${file.name}» ---\n${d.texto.slice(0, MAX)}${corto ? "\n[… el documento sigue; solo se leyó el comienzo]" : ""}`;
      e.textContent = "";
      const full = await IA.chat({ system: "Eres Jarvis, asistente personal en Colombia. Te comparten un documento: respóndele sobre él en español, claro y ordenado; fórmulas en LaTeX entre $…$.",
        messages: [{ role: "user", content, doc: d.pdf || null }], maxTokens: 3000, onDelta: ((pt) => (_, all) => { m.content = all; pt(all); })(painter(e)) });
      m.content = full + (corto ? "\n\n*(El documento era largo: leí las primeras páginas.)*" : "");
      e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      A.say(L.forSpeech(full).split(/(?<=[.!?])\s+/).slice(0, 2).join(" "));
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }
  X._h = { photoQuestion, docWord, docPDF, docActions, docText, docQuestion, makeDoc, plot, research, data, familyReport, recoveryPlan, kahoot, renderDocs, openCards };
})();
