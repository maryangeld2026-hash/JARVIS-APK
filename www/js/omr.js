/* Jarvis para Android 3.4 · calificar hojas de respuesta con la cámara, sin internet y sin IA.
   1. «Prepara las hojas de respuesta del quiz para 7A» (o el botón «Hojas de burbujas» del quiz): un PDF con una hoja
      por estudiante (con su nombre y un código) y 3 en blanco.
   2. «Califica las hojas»: le tomas foto a cada hoja; el celular la endereza, lee las burbujas y da la nota al instante.
   3. «Terminé de calificar»: el análisis (promedio, quiénes van bajo 3,0, las preguntas más difíciles y la opción errada
      que más marcaron), las notas al seguimiento y una guía de refuerzo para cada estudiante con solo lo que falló.
   Los nombres nunca salen del celular: la lectura de las hojas es local. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL, L4 = window.JL4, V = window.JV, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const fmt = (x) => String(x).replace(".", ",");
  const BLANCAS = 3;

  // ======================================================================== EL PDF DE LAS HOJAS
  async function makeSheets(it, curso) {
    const qz = it.quiz, n = qz.preguntas.length, nOps = Math.max(...qz.preguntas.map((p) => p.opciones.length));
    if (n > 50) throw new Error("Las hojas sirven para quices de hasta 50 preguntas.");
    if (curso.estudiantes.length > 120) throw new Error("El curso tiene demasiados estudiantes para un solo juego de hojas (máximo 120).");
    const lay = L4.sheetLayout(n, nOps), hash = L4.quizHash(it.id);
    await window.JPDF.libs();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "letter" });
    doc.addFileToVFS("dv.ttf", window.JARVIS_FUENTE.regular); doc.addFont("dv.ttf", "DV", "normal");
    doc.addFileToVFS("dvb.ttf", window.JARVIS_FUENTE.bold); doc.addFont("dvb.ttf", "DV", "bold");
    const nombres = curso.estudiantes.concat(Array.from({ length: BLANCAS }, () => ""));
    nombres.forEach((nombre, k) => {
      if (k) doc.addPage();
      const idx = k < curso.estudiantes.length ? k : 120 + (k - curso.estudiantes.length);
      doc.setFillColor(0, 0, 0);
      lay.marks.forEach(([x, y]) => doc.rect(x, y, lay.mk, lay.mk, "F"));
      doc.setFont("DV", "bold"); doc.setFontSize(13); doc.setTextColor(0);
      doc.text(String(qz.titulo).slice(0, 60), 32, 30);
      doc.setFont("DV", "normal"); doc.setFontSize(11);
      doc.text("Nombre: " + (nombre || "______________________________________"), 32, 39);
      doc.text(`Curso: ${curso.nombre}     Fecha: ____________     ${n} preguntas`, 32, 46);
      doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text("Rellena por completo un solo círculo por pregunta, con lápiz o lapicero oscuro. No dobles ni rayes los cuadros negros.", 32, 53);
      // el código de la hoja (no lo rellenes)
      const bits = L4.codeBits(idx, hash), cs = lay.codeSize;
      doc.setDrawColor(0); doc.setLineWidth(0.35);
      lay.code.forEach(([x, y], b) => { if (bits[b]) doc.rect(x, y, cs, cs, "F"); else doc.rect(x, y, cs, cs, "S"); });
      doc.setFontSize(7); doc.text("código de la hoja · no rellenar", lay.code[0][0], lay.code[0][1] + cs + 3.5);
      // las burbujas
      doc.setTextColor(0);
      lay.q.forEach((q) => {
        doc.setFont("DV", "bold"); doc.setFontSize(9.5); doc.text(String(q.n) + ".", q.numX, q.y + 1.2);
        doc.setFont("DV", "normal"); doc.setFontSize(Math.max(5.5, lay.r * 2.2));
        q.ops.forEach(([x, y], o) => {
          if (o >= qz.preguntas[q.n - 1].opciones.length) return;
          doc.setLineWidth(0.3); doc.circle(x, y, lay.r, "S");
          doc.setTextColor(140); doc.text(L4.LETRAS[o], x, y + lay.r * 0.42, { align: "center" }); doc.setTextColor(0);
        });
      });
      doc.setFontSize(7); doc.setTextColor(150); doc.text("Jarvis · hoja de respuestas", 32, lay.H - 14);
    });
    const ses = { id: window.JD.uid(), quizId: it.id, titulo: qz.titulo, curso: curso.nombre, alumnos: curso.estudiantes.slice(), clave: qz.preguntas.map((p) => p.correcta), n, nOps, hash, res: {}, fecha: Date.now() };
    D.hojas = [ses].concat((D.hojas || []).filter((h) => !(h.quizId === it.id && h.curso === curso.nombre))).slice(0, 30); save();
    const b64 = doc.output("datauristring").split(",")[1];
    await N.share({ title: "Hojas de respuesta · " + qz.titulo, fileName: `hojas-${slug(qz.titulo)}-${slug(curso.nombre)}.pdf`, mime: "application/pdf", base64: b64 });
    return ses;
  }
  const slug = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "quiz";

  // ======================================================================== CALIFICAR
  let ses = null;
  function current(hint) {
    const hs = D.hojas || [];
    if (hint) { const k = L4.norm(hint); const h = hs.find((x) => L4.norm(x.curso) === k || L4.norm(x.titulo).includes(k)); if (h) return h; }
    return hs[0] || null;
  }
  function open(hint) {
    ses = current(hint);
    if (!ses) return A.reply("Primero prepara las hojas: en la pestaña Quices, toca «Hojas de burbujas» en el quiz, o dime «prepara las hojas de respuesta del quiz para 7A».", "err");
    let sh = $("#omr-sh");
    if (!sh) { sh = mk("div", "sheet"); sh.id = "omr-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full");
    const hd = mk("div", "sheet-h"); hd.append(mk("h2", "", "Calificar hojas"));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => { sh.hidden = true; }); hd.append(x);
    const sc = mk("div", "scroll");
    sc.append(mk("p", "hint", `${ses.titulo} · ${ses.curso} · ${ses.n} preguntas. Toma la foto de frente, con la hoja entera y buena luz. La lectura es en el celular: sin internet y sin IA.`));
    const cam = mk("input"); cam.type = "file"; cam.accept = "image/*"; cam.setAttribute("capture", "environment"); cam.hidden = true;
    const gal = mk("input"); gal.type = "file"; gal.accept = "image/*"; gal.multiple = true; gal.hidden = true;
    const row = mk("div", "row wrap");
    const bc = mk("button", "btn primary big", "📷 Tomar foto de una hoja"); bc.type = "button"; bc.addEventListener("click", () => cam.click());
    const bg = mk("button", "btn", "🖼️ Varias de la galería"); bg.type = "button"; bg.addEventListener("click", () => gal.click());
    row.append(bc, bg); sc.append(row, cam, gal);
    const out = mk("div", "omr-out"); out.id = "omr-out"; sc.append(out);
    const prog = mk("p", "hint omr-prog"); sc.append(prog);
    const list = mk("ul", "lista omr-list"); sc.append(list);
    const acts = mk("div", "row wrap");
    const btn = (t, fn, cls = "") => { const b = mk("button", "btn " + cls, t); b.type = "button"; b.addEventListener("click", fn); acts.append(b); };
    btn("📊 Terminé: análisis", () => { sh.hidden = true; analysis(); });
    btn("➕ Notas al seguimiento", () => toTracking());
    btn("📝 Guías de refuerzo", () => { sh.hidden = true; guides(); });
    btn("🔑 Cambiar la clave", () => changeKey());
    sc.append(acts);
    inn.append(hd, sc); sh.append(inn);
    const go = async (files) => { for (const f of files) { await readPhoto(f); } paintList(); };
    cam.addEventListener("change", () => { const f = [...cam.files]; cam.value = ""; go(f); });
    gal.addEventListener("change", () => { const f = [...gal.files]; gal.value = ""; go(f); });
    paintList();
  }
  function paintList() {
    const list = $(".omr-list"), prog = $(".omr-prog"); if (!list) return;
    const rs = Object.values(ses.res).sort((a, b) => a.nombre.localeCompare(b.nombre));
    prog.textContent = `${rs.length} de ${ses.alumnos.length} calificadas.`;
    list.textContent = "";
    rs.forEach((r) => { const li = mk("li"); li.append(mk("span", "grow", r.nombre), mk("b", r.nota < (D.ajustes.escala.basico || 3) ? "bajo" : "", fmt(r.nota))); list.append(li); });
  }
  async function gray(file, max = 1400) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error("No pude abrir la foto.")); i.src = url; });
      const k = Math.min(1, max / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g2 = c.getContext("2d", { willReadFrequently: true }); g2.drawImage(img, 0, 0, w, h);
      const d = g2.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) g[j] = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0;
      return { g, w, h };
    } finally { URL.revokeObjectURL(url); }
  }
  async function readPhoto(file) {
    const out = $("#omr-out"); out.className = "omr-out"; out.textContent = "Leyendo la hoja…";
    try {
      const { g, w, h } = await gray(file);
      const lay = L4.sheetLayout(ses.n, ses.nOps);
      const r = L4.readSheet(g, w, h, lay);
      if (!r.ok) { out.className = "omr-out err"; out.textContent = r.error; V.say("No pude leer la hoja. Toma la foto otra vez."); return; }
      if (r.hash !== ses.hash) { out.className = "omr-out err"; out.textContent = "Esta hoja es de otro quiz. Abre «Calificar hojas» del quiz correcto."; V.say("Esta hoja es de otro quiz."); return; }
      let nombre = r.idx < ses.alumnos.length ? ses.alumnos[r.idx] : null;
      if (!nombre) nombre = await pickName();
      if (!nombre) { out.textContent = "Sin estudiante: no la guardé."; return; }
      const gr = L4.gradeSheet(r.resp, ses.clave);
      const antes = ses.res[nombre];
      ses.res[nombre] = { nombre, resp: r.resp, nota: gr.nota, aciertos: gr.aciertos, t: Date.now() };
      save();
      const mal = gr.det.filter((d) => !d.bien && d.r >= 0).map((d) => d.n);
      out.className = "omr-out ok";
      out.innerHTML = "";
      out.append(mk("div", "omr-name", nombre), mk("div", "omr-nota" + (gr.nota < (D.ajustes.escala.basico || 3) ? " bajo" : ""), fmt(gr.nota)),
        mk("div", "hint", `${gr.aciertos} de ${gr.total} bien` + (mal.length ? ` · erró: ${mal.join(", ")}` : "") + (gr.blancos.length ? ` · en blanco: ${gr.blancos.join(", ")}` : "") + (gr.dobles.length ? ` · doble marca: ${gr.dobles.join(", ")}` : "") + (antes ? " · (reemplazó la anterior)" : "")));
      V.hush(); V.say(`${nombre.split(" ")[0]}: ${fmt(gr.nota)}.`);
      if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* nada */ } }
    } catch (e) { out.className = "omr-out err"; out.textContent = e.message || String(e); }
  }
  function pickName() {
    return new Promise((ok) => {
      const out = $("#omr-out"); out.innerHTML = ""; out.className = "omr-out";
      out.append(mk("div", "", "Hoja en blanco: ¿de quién es?"));
      const s = mk("select", "inp"); s.append(new Option("Escoge el estudiante…", ""));
      ses.alumnos.filter((n) => !ses.res[n]).concat(ses.alumnos.filter((n) => ses.res[n])).forEach((n) => s.append(new Option(n + (ses.res[n] ? " (ya calificada)" : ""), n)));
      const b = mk("button", "btn primary", "Guardar"); b.type = "button";
      b.addEventListener("click", () => ok(s.value || null));
      out.append(s, b);
    });
  }
  function changeKey() {
    const cur = ses.clave.map((c) => L4.LETRAS[c] || "?").join(" ");
    const t = prompt("Escribe la clave correcta, una letra por pregunta (por ejemplo: A C B D …):", cur);
    if (t == null) return;
    const k = t.toUpperCase().replace(/[^A-E]/g, "").split("").map((c) => L4.LETRAS.indexOf(c));
    if (k.length !== ses.n) return A.toast(`Necesito ${ses.n} letras y escribiste ${k.length}.`, 5000);
    ses.clave = k;
    Object.values(ses.res).forEach((r) => { const g = L4.gradeSheet(r.resp, k); r.nota = g.nota; r.aciertos = g.aciertos; });
    save(); paintList(); A.toast("Clave cambiada: recalifiqué todas las hojas.");
  }

  // ======================================================================== DESPUÉS DE CALIFICAR
  function analysis(hint) {
    ses = ses || current(hint);
    if (!ses) return A.reply("No hay hojas calificadas todavía.", "err");
    const a = L4.sheetAnalysis(ses.res, ses.clave, D.ajustes.escala.basico || 3);
    if (!a) return A.reply("Todavía no has calificado ninguna hoja. Dime «califica las hojas».", "err");
    const it = (D.quices || []).find((q) => q.id === ses.quizId);
    const enun = (n) => it ? L.plainMath ? L.plainMath(it.quiz.preguntas[n - 1].enunciado).slice(0, 90) : it.quiz.preguntas[n - 1].enunciado.slice(0, 90) : "";
    const md = `### Análisis: ${ses.titulo} · ${ses.curso}\n\n` +
      `- **${a.n}** hojas calificadas de ${ses.alumnos.length}. Promedio: **${fmt(a.prom)}**.\n` +
      `- Bajo ${fmt(D.ajustes.escala.basico || 3)}: ${a.bajos.length ? `**${a.bajos.length}** (${a.bajos.join(", ")})` : "nadie 🎉"}.\n\n` +
      "**Las preguntas más difíciles:**\n" + a.dificiles.map((d) => `- Pregunta ${d.n}: ${d.pct} % la acertó${d.errada ? `; la opción errada más marcada fue la ${d.errada.op} (${d.errada.veces})` : ""}.${enun(d.n) ? ` «${enun(d.n)}»` : ""}`).join("\n") +
      "\n\n| Pregunta | % bien |\n|---|---|\n" + a.preg.map((p) => `| ${p.n} | ${p.pct} % |`).join("\n");
    const doc = { id: window.JD.uid(), titulo: `Análisis: ${ses.titulo} · ${ses.curso}`, md, fecha: Date.now(), tipo: "analisis" };
    D.docs = D.docs || []; D.docs.unshift(doc); save();
    const { e } = A.add("assistant", md, "tool"); e.innerHTML = A.md(md);
    const h = X._h || {};
    if (h.docActions) e.append(h.docActions(doc));
    const more = mk("div", "doc-acts");
    [["Notas al seguimiento", toTracking], ["Guías de refuerzo", guides], ["Refuerzo para el curso", () => A.handle(`hazme actividades de refuerzo sobre: ${a.dificiles.map((d) => enun(d.n)).filter(Boolean).join("; ")}`, false)]].forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", fn); more.append(b); });
    e.append(more);
    A.say(`Califiqué ${a.n} hojas. El promedio es ${fmt(a.prom)}. ${a.bajos.length ? `${a.bajos.length} quedaron bajo ${fmt(D.ajustes.escala.basico || 3)}.` : "Nadie quedó en bajo."} La pregunta más difícil fue la ${a.dificiles[0].n}.`);
  }
  function toTracking() {
    if (!ses) return;
    const c = D.cursos.find((x) => x.nombre === ses.curso);
    if (!c) return A.toast("No encontré el curso " + ses.curso + ".");
    c.notas = c.notas || { actividades: [], valores: {} };
    const nombre = ("Hoja: " + ses.titulo).slice(0, 40);
    let act = c.notas.actividades.find((x) => x.nombre === nombre);
    if (!act) { act = { id: "a" + window.JD.uid(), nombre, peso: 1 }; c.notas.actividades.push(act); }
    let k = 0;
    Object.values(ses.res).forEach((r) => { (c.notas.valores[r.nombre] = c.notas.valores[r.nombre] || {})[act.id] = r.nota; k++; });
    save();
    A.reply(`Listo: pasé ${k} notas de «${ses.titulo}» al seguimiento de ${c.nombre}, en la actividad «${nombre}».`);
  }
  function guides() {
    ses = ses || current();
    if (!ses) return;
    const it = (D.quices || []).find((q) => q.id === ses.quizId);
    if (!it) return A.reply("No encontré el quiz de estas hojas (¿lo borraste?). Sin él no puedo armar las guías.", "err");
    const pq = it.quiz.preguntas;
    const parts = Object.values(ses.res).sort((a, b) => a.nombre.localeCompare(b.nombre)).map((r) => {
      const mal = pq.map((p, i) => ({ p, i, r: r.resp[i] })).filter((x) => x.r !== ses.clave[x.i]);
      if (!mal.length) return `## ${r.nombre}\n\n¡Todo bien! ${fmt(r.nota)}. Reto extra: inventa una pregunta parecida a la más difícil y resuélvela.\n`;
      return `## ${r.nombre} · ${fmt(r.nota)}\n\nRepasa estas preguntas:\n\n` + mal.map((x) => `**${x.i + 1}.** ${x.p.enunciado}\n\n- Marcaste: ${x.r >= 0 ? L4.LETRAS[x.r] + ") " + x.p.opciones[x.r] : x.r === -2 ? "dos opciones" : "nada"}\n- La correcta: **${L4.LETRAS[ses.clave[x.i]]}) ${x.p.opciones[ses.clave[x.i]]}**${x.p.explicacion ? `\n- Por qué: ${x.p.explicacion}` : ""}\n- Practica: resuelve otro ejercicio igual, cambiando los números.`).join("\n\n") + "\n";
    });
    const md = `# Guías de refuerzo · ${ses.titulo} · ${ses.curso}\n\nUna guía por estudiante, con solo las preguntas que falló.\n\n` + parts.join("\n---\n\n");
    const doc = { id: window.JD.uid(), titulo: `Guías de refuerzo: ${ses.titulo} · ${ses.curso}`, md, fecha: Date.now(), tipo: "refuerzo" };
    D.docs = D.docs || []; D.docs.unshift(doc); save();
    const { e } = A.add("assistant", `Listas las guías de refuerzo de ${ses.curso} (${parts.length} estudiantes). Están en Material; desde aquí las pasas a Word o PDF para imprimir.`, "tool");
    const h = X._h || {}; if (h.docActions) e.append(h.docActions(doc));
    A.say("Listas las guías de refuerzo. Las guardé en Material.");
  }

  // ======================================================================== ÓRDENES Y BOTONES
  function sheetsFor(it, cursoHint) {
    const c = (cursoHint && L.findCourse(D.cursos, L4.norm(cursoHint))) || D.cursos.find((x) => x.nombre === it.curso) || A.courseFor(null);
    if (!c) return A.reply(D.cursos.length ? "¿Para qué curso? Dime «prepara las hojas de respuesta del quiz para 7A»." : "Primero crea un curso con su lista, en la pestaña Clase.", "err");
    A.toast("Preparando las hojas…");
    return makeSheets(it, c).then(() => A.reply(`Listas las hojas de respuesta de «${it.quiz.titulo}» para ${c.nombre}: una por estudiante y ${BLANCAS} en blanco. Imprímelas; cuando las tengas resueltas, dime «califica las hojas».`))
      .catch((e) => { if (e && e.name !== "AbortError") A.reply("No pude hacer las hojas: " + (e.message || e), "err"); });
  }
  const base = { intent: X.intent, run: X.run, quizButtons: X.quizButtons, init: X.init };
  X.intent = function (text) {
    const t = L4.norm(text).replace(/^jarvis\s+/, "");
    let m;
    if ((m = t.match(/^(?:prepara(?:me)?|haz(?:me)?|genera(?:me)?|imprime)\s+(?:las\s+)?hojas\s+de\s+(?:respuestas?|burbujas)(?:\s+del\s+(?:quiz|examen|simulacro)(?:\s+de\s+(.+?))?)?(?:\s+para\s+(.+))?$/))) return { omr: true, kind: "hojas", tema: (m[1] || "").trim(), curso: (m[2] || "").trim() };
    if ((m = t.match(/^(?:califica(?:me)?|calificar|revisa(?:r)?)\s+(?:las\s+)?hojas(?:\s+(?:de\s+respuestas?\s+)?(?:de|del)\s+(.+))?$/))) return { omr: true, kind: "calificar", hint: (m[1] || "").trim() };
    if (/^(?:termine|ya termine)\s+de\s+calificar|^analisis\s+de\s+(?:las\s+)?hojas|^como\s+les\s+fue\s+en\s+(?:las\s+hojas|el\s+quiz)/.test(t)) return { omr: true, kind: "analisis" };
    if (/^(?:prepara(?:me)?|haz(?:me)?)\s+(?:el\s+|las\s+)?(?:refuerzo|guias de refuerzo)$/.test(t)) return { omr: true, kind: "guias" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.omr) return base.run(it, text);
    if (it.kind === "hojas") {
      const q = it.tema ? (D.quices || []).find((x) => L4.norm(x.quiz.titulo + " " + (x.tema || "")).includes(L4.norm(it.tema))) : (A.getQuiz() || (D.quices || [])[0]);
      if (!q) return A.reply(it.tema ? `No encontré un quiz de «${it.tema}».` : "Primero crea un quiz: «hazme un quiz de fracciones de 10 preguntas».", "err");
      return sheetsFor(q, it.curso);
    }
    if (it.kind === "calificar") return open(it.hint);
    if (it.kind === "analisis") return analysis();
    if (it.kind === "guias") return guides();
  };
  X.quizButtons = function (btn, it) {
    base.quizButtons(btn, it);
    btn("🫧 Hojas de burbujas", "", () => sheetsFor(it, it.curso));
    btn("📷 Calificar hojas", "", () => { const h = (D.hojas || []).find((x) => x.quizId === it.id); if (!h) return A.toast("Primero imprime las «Hojas de burbujas» de este quiz.", 5000); D.hojas = [h].concat(D.hojas.filter((x) => x !== h)); open(); });
  };
  X.init = function (api) { A = api; D = api.D; D.hojas = D.hojas || []; base.init(api); };
  X._omr = { open, analysis, guides, makeSheets };
})();
