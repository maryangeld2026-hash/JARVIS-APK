/* Jarvis para Android 2.0 · lo nuevo: seguimiento de notas (con Excel), memoria y lecciones, modo tutor, paso a paso,
   ticket de salida, modo proyector, Word, Google (Calendario, Classroom, Forms, Drive), el Jarvis del computador,
   manos libres («Jarvis, …») y la burbuja flotante. Se engancha a app.js con window.JX. */
(function () {
  "use strict";
  const L = window.JL, L2 = window.JL2, V = window.JV, N = window.JN, IA = window.JIA;
  let A = null, D = null;                                     // A: lo que expone app.js; D: los datos
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const cap = () => window.Capacitor;
  const native = () => V.native();
  const plug = (n) => (cap() && cap().Plugins && cap().Plugins[n]) || null;
  function loadScript(src) { return new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No pude cargar " + src)); document.head.appendChild(s); }); }
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const ab64 = (buf) => { let bin = ""; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };
  const slug = (t) => String(t || "archivo").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "archivo";

  function ensureData() {
    D.memoria = D.memoria || []; D.lecciones = D.lecciones || [];
    D.tutor = D.tutor || { on: false, tema: "" };
    D.ajustes.google = Object.assign({ clienteWeb: "", cuenta: "" }, D.ajustes.google || {});
    D.ajustes.pc = D.ajustes.pc || "";
    D.ajustes.manosLibres = !!D.ajustes.manosLibres; D.ajustes.burbuja = !!D.ajustes.burbuja;
    D.tickets = D.tickets || [];
    D.cursos.forEach((c) => { c.notas = c.notas || { actividades: [], valores: {} }; });
  }

  // ======================================================================== ÓRDENES
  function intent(text) { return L2.intent2(text, D.cursos); }
  async function run(it, text) {
    const R = A.reply;
    switch (it.kind) {
      case "mem_guardar": D.memoria.push({ id: window.JD.uid(), texto: it.texto, t: Date.now() }); save(); return R(`Listo, lo recordaré: «${it.texto}».`);
      case "leccion": D.lecciones.push({ id: window.JD.uid(), texto: it.texto, t: Date.now() }); save(); return R("Entendido. Lo tendré en cuenta siempre.");
      case "mem_ver": {
        if (!D.memoria.length && !D.lecciones.length) return R("Todavía no me has contado nada para recordar. Dime, por ejemplo: «recuerda que los lunes tengo reunión de área».");
        return R((D.lecciones.length ? "**Lecciones:**\n" + D.lecciones.map((l) => "- " + l.texto).join("\n") + "\n\n" : "") +
          (D.memoria.length ? "**Lo que sé de ti:**\n" + D.memoria.map((m) => "- " + m.texto).join("\n") : ""), "tool", `Sé ${D.memoria.length} cosas de ti y tengo ${D.lecciones.length} lecciones. Están en la pantalla.`);
      }
      case "mem_olvidar": {
        const k = L.norm(it.texto).split(" ").filter((w) => w.length >= 4);
        const hit = (x) => k.length && k.every((w) => L.norm(x.texto).includes(w));
        const n0 = D.memoria.length + D.lecciones.length;
        D.memoria = D.memoria.filter((x) => !hit(x)); D.lecciones = D.lecciones.filter((x) => !hit(x)); save();
        return R(n0 - D.memoria.length - D.lecciones.length ? "Listo, lo olvidé." : "No encontré eso en lo que recuerdo.");
      }
      case "tutor": D.tutor = { on: true, tema: it.tema }; save(); markTutor(); return R(`Modo tutor${it.tema ? " de " + it.tema : ""} activado: guiaré con preguntas y pistas, sin dar la respuesta. «Sal del modo tutor» para terminar.`);
      case "tutor_off": D.tutor = { on: false, tema: "" }; save(); markTutor(); return R("Salí del modo tutor.");
      case "pasos": return steps(it.tema);
      case "ticket": return ticket(it.tema, it.curso);
      case "proyector": openProjector(it.que || ""); return R("Abrí el modo proyector. Transmite la pantalla del celular al televisor (Transmitir o Smart View) y gíralo de lado.");
      case "proyector_cerrar": closeProjector(); return R("Cerré el modo proyector.");
      case "riesgo": return risk(it.curso);
      case "estudiante": return student(it.quien);
      case "poner_nota": return putGrade(it);
      case "manos_libres": setHandsFree(it.on); return R(it.on ? "Manos libres activado: mientras la app esté abierta, dime «Jarvis…» y lo que necesites." : "Manos libres apagado.");
      case "burbuja": return bubble(it.on, true);
      case "pc": return pc(it.orden);
      case "agenda": return agenda(it.dia);
      case "agendar": return schedule(text);
      case "classroom": return classroom();
      case "forms": { const q = A.getQuiz() || D.quices[0]; if (!q) return R("Primero crea un quiz («hazme un quiz de…»)."); return forms(q); }
      case "word": { const q = A.getQuiz() || D.quices[0]; if (!q) return R("Primero crea un quiz («hazme un quiz de…»)."); await word(q); return R("Listo el Word del quiz.", "tool"); }
      case "drive": return driveSave(true);
    }
  }
  function promptExtra(q) {
    return L2.memoryContext(D.memoria, D.lecciones, q || "") + (D.tutor.on ? L2.tutorRule(D.tutor.tema) : "");
  }
  function markTutor() { document.body.classList.toggle("tutor", !!D.tutor.on); const b = $("#tutor-pill"); if (b) { b.hidden = !D.tutor.on; b.textContent = "TUTOR" + (D.tutor.tema ? " · " + D.tutor.tema.toUpperCase() : ""); } }

  // ======================================================================== SEGUIMIENTO DE NOTAS
  function nt(c) { if (c && !c.notas) c.notas = { actividades: [], valores: {} }; return c; }
  function course(id) { return nt(A.courseFor(id)); }
  function cursosAqui() { const cur = course(null); D.cursos.forEach(nt); return cur ? [cur].concat(D.cursos.filter((c) => c !== cur)) : D.cursos; }
  function risk(id) {
    const c = course(id);
    if (!c) return A.reply("Primero crea un curso en la pestaña Clase.");
    const st = L2.courseStats(c, D.ajustes.escala);
    if (!st.actividades) return A.reply(`El curso ${c.nombre} todavía no tiene notas. En Clase › Seguimiento puedes importar tu planilla de Excel o crear actividades.`);
    const r = st.riesgo;
    const txt = `**${c.nombre}** · promedio ${L2.fmtNota(st.promedio)} · ${st.actividades} actividades\n` +
      (r.length ? `En riesgo (${r.length}):\n` + r.map((x) => `- ${x.nombre}: ${L2.fmtNota(x.promedio)}${x.bajas ? ` (${x.bajas} notas bajas)` : ""}${x.faltan ? `, le faltan ${x.faltan}` : ""}`).join("\n") : "Nadie está en riesgo. 🎉");
    A.reply(txt, "tool", r.length ? `En ${c.nombre} hay ${r.length} en riesgo: ${r.slice(0, 5).map((x) => x.nombre.split(" ")[0] + " con " + L2.fmtNota(x.promedio)).join(", ")}.` : `En ${c.nombre} nadie está en riesgo. El promedio es ${L2.fmtNota(st.promedio)}.`);
  }
  function student(quien) {
    const f = L2.findStudent(cursosAqui(), quien);
    if (!f) return A.reply(`No encontré a «${quien}» en tus cursos.`);
    const n = f.curso.notas, v = (n.valores || {})[f.nombre] || {};
    const prom = L2.average(n, f.nombre), perf = L.performance(prom, D.ajustes.escala);
    const lines = n.actividades.map((a) => `- ${a.nombre}: ${typeof v[a.id] === "number" ? L2.fmtNota(v[a.id]) : "sin nota"}`);
    A.reply(`**${f.nombre}** (${f.curso.nombre}) · promedio ${L2.fmtNota(prom)}${perf ? " · " + perf : ""}\n` + (lines.join("\n") || "Sin notas todavía."), "tool",
      prom == null ? `${f.nombre} todavía no tiene notas.` : `${f.nombre} va con ${L2.fmtNota(prom)}, desempeño ${perf}.`);
  }
  function putGrade(it) {
    const f = L2.findStudent(cursosAqui(), it.quien);
    if (!f) return A.reply(`No encontré a «${it.quien}» en tus cursos.`);
    let a = L2.findActivity(f.curso.notas, it.actividad);
    if (!a) { a = { id: "a" + window.JD.uid(), nombre: it.actividad.charAt(0).toUpperCase() + it.actividad.slice(1), peso: 1 }; f.curso.notas.actividades.push(a); }
    (f.curso.notas.valores[f.nombre] = f.curso.notas.valores[f.nombre] || {})[a.id] = it.nota; save(); renderTrack(f.curso);
    A.reply(`Anotado: ${L2.fmtNota(it.nota)} a ${f.nombre} en «${a.nombre}».`);
  }
  function renderClase(c) {
    let card = $("#k-seg");
    if (!card) {
      card = mk("article", "card"); card.id = "k-seg";
      card.innerHTML = '<h2>Seguimiento de notas</h2><div id="seg-res"></div><div class="row wrap">' +
        '<button class="btn primary" type="button" id="btn-seg-ver">Ver y editar notas</button><button class="btn" type="button" id="btn-seg-xlsx">Importar Excel</button>' +
        '<button class="btn" type="button" id="btn-seg-exp">Exportar Excel</button><button class="btn" type="button" id="btn-seg-cr">Traer de Classroom</button></div>' +
        '<input type="file" id="seg-in" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>' +
        '<p class="hint">Las notas se quedan en el celular: a la IA nunca se mandan nombres ni notas de estudiantes. Pregúntame «¿quién está en riesgo en 7A?» o «¿cómo va Ana?».</p>';
      $("#cursos").after(card);
      $("#btn-seg-ver").addEventListener("click", () => { const c2 = course(null); if (c2) openGrid(c2); else A.toast("Primero crea un curso."); });
      $("#btn-seg-xlsx").addEventListener("click", () => $("#seg-in").click());
      $("#seg-in").addEventListener("change", importExcel);
      $("#btn-seg-exp").addEventListener("click", () => { const c2 = course(null); if (c2) exportExcel(c2); });
      $("#btn-seg-cr").addEventListener("click", classroom);
    }
    renderTrack(c);
  }
  function renderTrack(c) {
    nt(c);
    const box = $("#seg-res");
    if (!box) return;
    box.textContent = "";
    if (!c) { box.append(mk("p", "hint", "Crea un curso o importa tu planilla de Excel: cada hoja se vuelve un curso.")); return; }
    const st = L2.courseStats(c, D.ajustes.escala);
    if (!st.actividades) { box.append(mk("p", "hint", `${c.nombre} aún no tiene notas.`)); return; }
    const top = mk("div", "seg-top");
    top.append(mk("b", "", L2.fmtNota(st.promedio)), mk("span", "", `promedio de ${c.nombre} · ${st.actividades} actividades`));
    const dist = mk("div", "seg-dist");
    [["bajo", "Bajo"], ["básico", "Básico"], ["alto", "Alto"], ["superior", "Superior"]].forEach(([k, l]) => { const x = mk("span", "d-" + k.normalize("NFD").replace(/[̀-ͯ]/g, ""), `${l} ${st.distribucion[k] || 0}`); dist.append(x); });
    box.append(top, dist);
    if (st.riesgo.length) {
      const ul = mk("ul", "lista");
      st.riesgo.slice(0, 8).forEach((r) => { const li = mk("li"), g = mk("div", "grow", r.nombre); g.append(mk("small", "", `${L2.fmtNota(r.promedio)} · ${r.bajas} notas bajas${r.faltan ? ` · le faltan ${r.faltan}` : ""}`)); li.append(mk("span", "dot-r"), g); ul.append(li); });
      box.append(mk("h4", "seg-h", `En riesgo (${st.riesgo.length})`), ul);
    } else box.append(mk("p", "hint", "Nadie está en riesgo."));
  }
  async function xlsxLib() { if (!window.XLSX) await loadScript("vendor/xlsx.mini.min.js"); return window.XLSX; }
  async function importExcel(ev) {
    const f = ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    try {
      const X = await xlsxLib();
      const wb = X.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
      let made = 0, upd = 0;
      wb.SheetNames.forEach((name) => {
        const rows = X.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
        const g = L2.sheetToGrades(rows);
        if (g.error || g.estudiantes.length < 2) return;
        let c = L.findCourse(D.cursos, name) || D.cursos.find((x) => L.norm(x.nombre) === L.norm(name));
        if (!c) { c = { id: window.JD.uid(), nombre: name.slice(0, 20), estudiantes: [], usados: [] }; D.cursos.push(c); made++; } else upd++;
        c.estudiantes = Array.from(new Set(c.estudiantes.concat(g.estudiantes)));
        c.notas = { actividades: g.actividades, valores: g.valores };
        D.cursoActual = c.id;
      });
      save(); A.renderClase();
      A.toast(made + upd ? `Listo: ${made} curso(s) nuevo(s) y ${upd} actualizado(s) desde «${f.name}».` : "No encontré hojas con nombres y notas en ese archivo.", 6000);
    } catch (e) { A.toast("No pude leer ese Excel: " + e.message, 6000); }
  }
  async function exportExcel(c) {
    nt(c);
    const X = await xlsxLib();
    const ws = X.utils.aoa_to_sheet(L2.gradeTable(c, D.ajustes.escala));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, c.nombre.slice(0, 30));
    const out = X.write(wb, { type: "base64", bookType: "xlsx" });
    await N.share({ title: `Notas ${c.nombre}`, fileName: `notas-${slug(c.nombre)}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64: out }).catch(() => {});
  }
  // la planilla para ver y editar
  function openGrid(c) {
    nt(c);
    let sh = $("#notas-ed");
    if (!sh) {
      sh = mk("div", "sheet"); sh.id = "notas-ed"; sh.hidden = true; sh.setAttribute("role", "dialog");
      sh.innerHTML = '<div class="sheet-in full"><div class="sheet-h"><h2 id="ne-t">Notas</h2><button class="icon-btn" id="ne-x" type="button" aria-label="Cerrar"><svg><use href="#i-x"/></svg></button></div>' +
        '<div class="row wrap pad"><button class="btn small" id="ne-act" type="button">+ Actividad</button><span class="hint">Toca una casilla para poner o cambiar la nota.</span></div><div class="scroll"><div class="grid-wrap" id="ne-grid"></div></div></div>';
      document.body.append(sh);
      $("#ne-x").addEventListener("click", () => { sh.hidden = true; A.renderClase(); });
    }
    $("#ne-act").onclick = () => {
      const n = prompt("Nombre de la actividad (por ejemplo «Taller 3»):");
      if (!n || !n.trim()) return;
      const p = parseFloat(String(prompt("Peso (1 = normal, 2 = vale doble):", "1") || "1").replace(",", "."));
      c.notas.actividades.push({ id: "a" + window.JD.uid(), nombre: n.trim().slice(0, 40), peso: p > 0 ? p : 1 }); save(); draw();
    };
    $("#ne-t").textContent = "Notas · " + c.nombre;
    function draw() {
      const g = $("#ne-grid"); g.textContent = "";
      const t = mk("table", "grid"), hr = mk("tr");
      hr.append(mk("th", "", "Estudiante"));
      c.notas.actividades.forEach((a) => {
        const th = mk("th", "click", a.nombre + (a.peso !== 1 ? ` ×${a.peso}` : ""));
        th.title = "Tocar para renombrar o borrar";
        th.addEventListener("click", () => {
          const n = prompt(`Nuevo nombre para «${a.nombre}» (déjalo vacío para BORRAR la actividad):`, a.nombre);
          if (n === null) return;
          if (!n.trim()) { if (confirm(`¿Borrar «${a.nombre}» y sus notas?`)) { c.notas.actividades = c.notas.actividades.filter((x) => x !== a); Object.values(c.notas.valores).forEach((v) => delete v[a.id]); } }
          else a.nombre = n.trim().slice(0, 40);
          save(); draw();
        });
        hr.append(th);
      });
      hr.append(mk("th", "", "Prom."));
      t.append(hr);
      c.estudiantes.forEach((name) => {
        const tr = mk("tr"); tr.append(mk("td", "nm", name));
        const v = c.notas.valores[name] = c.notas.valores[name] || {};
        c.notas.actividades.forEach((a) => {
          const td = mk("td", "click " + cls(v[a.id]), typeof v[a.id] === "number" ? L2.fmtNota(v[a.id]) : "·");
          td.addEventListener("click", () => {
            const x = prompt(`${name} · ${a.nombre} (de 1 a 5; vacío para quitar):`, typeof v[a.id] === "number" ? String(v[a.id]).replace(".", ",") : "");
            if (x === null) return;
            const n = parseFloat(x.replace(",", "."));
            if (!x.trim()) delete v[a.id]; else if (n >= 0 && n <= 5) v[a.id] = Math.round(n * 100) / 100; else return A.toast("La nota va de 1 a 5.");
            save(); draw();
          });
          tr.append(td);
        });
        const p = L2.average(c.notas, name);
        tr.append(mk("td", "prom " + cls(p), L2.fmtNota(p)));
        t.append(tr);
      });
      g.append(t);
    }
    const cls = (x) => (typeof x !== "number" ? "" : "g-" + L.performance(x, D.ajustes.escala).normalize("NFD").replace(/[̀-ͯ]/g, ""));
    draw(); sh.hidden = false;
  }
  function afterGrade(box, rev, who, c) {
    if (!c || !who || rev.nota == null) return;
    const b = mk("button", "btn small", `Guardar ${L2.fmtNota(rev.nota)} en el seguimiento de ${who.split(" ")[0]}`); b.type = "button";
    b.addEventListener("click", () => {
      const name = prompt("¿En qué actividad?", ($("#foto-consigna").value || "Trabajo en clase").slice(0, 40));
      if (!name) return;
      putGrade({ nota: rev.nota, quien: who, actividad: name }); b.disabled = true; b.textContent = "Guardada ✓";
    });
    box.append(b);
  }

  // ======================================================================== PASO A PASO Y TICKET DE SALIDA
  let lastSteps = null, lastTicket = null;
  async function steps(tema) {
    A.setState("thinking");
    try {
      const r = L2.cleanSteps(await IA.json({ system: "Eres un docente de matemáticas paciente y claro.", messages: [{ role: "user", content: L2.stepsPrompt(tema) }] }));
      if (r.error) throw new Error(r.error);
      lastSteps = r.pasos;
      const txt = `**${r.pasos.titulo}**\n` + r.pasos.pasos.map((p, i) => `${i + 1}. **${p.titulo}**: ${p.explicacion}`).join("\n");
      A.reply(txt, "tool", `${r.pasos.titulo}. Son ${r.pasos.pasos.length} pasos. Primero: ${r.pasos.pasos[0].titulo}. ${r.pasos.pasos[0].explicacion}`);
      const b = mk("button", "chip", "▣ Mostrar paso a paso en el proyector"); b.type = "button"; b.addEventListener("click", () => openProjector("pasos"));
      const last = document.querySelector("#chat .msg.jarvis:last-of-type"); if (last) last.append(b);
    } finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  async function ticket(tema, cursoId) {
    if (!tema) return A.reply("¿De qué tema? Por ejemplo: «ticket de salida de fracciones equivalentes».");
    A.setState("thinking");
    try {
      const r = L2.cleanTicket(await IA.json({ system: "Eres un docente experto en evaluación formativa.", messages: [{ role: "user", content: L2.ticketPrompt(tema) }] }));
      if (r.error) throw new Error(r.error);
      lastTicket = Object.assign(r.ticket, { curso: (course(cursoId) || {}).nombre || "", votos: { verde: 0, amarillo: 0, rojo: 0 }, fecha: Date.now(), tema });
      D.tickets.unshift(lastTicket); D.tickets = D.tickets.slice(0, 50); save();
      A.reply(`**${r.ticket.titulo}**\n` + r.ticket.preguntas.map((q, i) => `${i + 1}. ${q}`).join("\n"), "tool", "Listo el ticket de salida. Lo abro en el proyector.");
      openProjector("ticket");
    } finally { if (A.getState() === "thinking") A.setState("idle"); }
  }

  // ======================================================================== MODO PROYECTOR
  let proj = null, pState = { que: "", i: 0, reveal: false };
  function openProjector(que) {
    if (!proj) {
      proj = mk("div", "proy"); proj.id = "proyector"; proj.hidden = true;
      proj.innerHTML = '<div class="proy-bar"><span class="brand"><span class="dot"></span>JARVIS</span><span class="proy-tabs"></span><button class="icon-btn" id="proy-x" type="button" aria-label="Cerrar"><svg><use href="#i-x"/></svg></button></div><div class="proy-body" id="proy-body"></div><div class="proy-nav" id="proy-nav"></div>';
      document.body.append(proj);
      $("#proy-x").addEventListener("click", closeProjector);
      const tabs = proj.querySelector(".proy-tabs");
      [["tiempo", "Tiempo"], ["estudiante", "Estudiante"], ["grupos", "Grupos"], ["quiz", "Quiz"], ["pasos", "Pasos"], ["ticket", "Ticket"]].forEach(([k, l]) => {
        const b = mk("button", "chip", l); b.type = "button"; b.dataset.k = k; b.addEventListener("click", () => { pState = { que: k, i: 0, reveal: false }; drawProj(); }); tabs.append(b);
      });
      setInterval(() => { if (!proj.hidden && pState.que === "tiempo") drawProj(); }, 500);
    }
    pState = { que: que || pState.que || "tiempo", i: 0, reveal: false };
    proj.hidden = false; N.keepAwake(true);
    try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {}); } catch (e) { /* no se puede girar solo */ }
    drawProj();
  }
  function closeProjector() { if (proj) proj.hidden = true; N.keepAwake(false); try { screen.orientation.unlock(); } catch (e) { /* nada */ } }
  function drawProj() {
    const body = $("#proy-body"), nav = $("#proy-nav");
    proj.querySelectorAll(".proy-tabs .chip").forEach((b) => b.classList.toggle("on", b.dataset.k === pState.que));
    body.textContent = ""; nav.textContent = "";
    const navBtn = (l, fn, cls = "") => { const b = mk("button", "btn " + cls, l); b.type = "button"; b.addEventListener("click", fn); nav.append(b); };
    const q = pState.que;
    if (q === "tiempo") {
      const t = A.timer, left = t.end ? Math.max(0, Math.ceil((t.end - Date.now()) / 1000)) : (D.ultimoTiempo || 300);
      body.append(mk("div", "p-clock" + (t.end ? (left <= 10 ? " low" : " run") : ""), L.fmtClock(left)));
      [1, 3, 5, 10].forEach((m) => navBtn(m + " min", () => { A.startTimer(m * 60); drawProj(); }));
      navBtn("Parar", () => { document.querySelector("#btn-tiempo-parar").click(); drawProj(); });
    } else if (q === "estudiante") {
      body.append(mk("div", "p-name", $("#azar-nombre").textContent || "—"));
      navBtn("Escoger otro", () => { document.querySelector("#btn-azar").click(); setTimeout(drawProj, 1100); }, "primary");
    } else if (q === "grupos") {
      const g = A.getGroups();
      if (!g) body.append(mk("div", "p-msg", "Haz los grupos en la pestaña Clase o di «haz 4 grupos»."));
      else { const w = mk("div", "p-groups"); g.g.forEach((x, i) => { const d = mk("div", "grupo"); d.append(mk("b", "", "GRUPO " + (i + 1))); x.forEach((n) => d.append(mk("div", "", n))); w.append(d); }); body.append(w); }
    } else if (q === "quiz") {
      const it = A.getQuiz() || D.quices[0];
      if (!it) { body.append(mk("div", "p-msg", "Crea un quiz primero.")); return; }
      const qz = it.quiz, p = qz.preguntas[Math.min(pState.i, qz.preguntas.length - 1)];
      body.append(mk("div", "p-k", `${qz.titulo} · pregunta ${pState.i + 1} de ${qz.preguntas.length}`));
      const en = mk("div", "p-q"); en.innerHTML = A.mdInline(p.enunciado); body.append(en);
      const ol = mk("ol", "p-ops"); p.opciones.forEach((o, k) => { const li = mk("li", pState.reveal && k === p.correcta ? "ok" : pState.reveal ? "no" : ""); li.innerHTML = A.mdInline(o); ol.append(li); });
      if (p.opciones.length >= 4) ol.classList.add("two");
      body.append(ol);
      if (pState.reveal && p.explicacion) { const e = mk("div", "p-exp"); e.innerHTML = "✓ " + A.mdInline(p.explicacion); body.append(e); }
      navBtn("◀", () => { pState.i = Math.max(0, pState.i - 1); pState.reveal = false; drawProj(); });
      navBtn(pState.reveal ? "Ocultar" : "Mostrar respuesta", () => { pState.reveal = !pState.reveal; drawProj(); }, "primary");
      navBtn("▶", () => { pState.i = Math.min(qz.preguntas.length - 1, pState.i + 1); pState.reveal = false; drawProj(); });
    } else if (q === "pasos") {
      if (!lastSteps) { body.append(mk("div", "p-msg", "Pídeme «explícame paso a paso…».")); return; }
      { const k = mk("div", "p-k"); k.innerHTML = A.mdInline(lastSteps.titulo); body.append(k); }
      lastSteps.pasos.slice(0, pState.i + 1).forEach((p, k) => { const d = mk("div", "p-step" + (k === pState.i ? " now" : "")); d.innerHTML = `<b>${k + 1}. ${A.mdInline(p.titulo)}</b> ${A.mdInline(p.explicacion)}`; body.append(d); });
      navBtn("◀", () => { pState.i = Math.max(0, pState.i - 1); drawProj(); });
      navBtn("Siguiente paso ▶", () => { pState.i = Math.min(lastSteps.pasos.length - 1, pState.i + 1); drawProj(); }, "primary");
    } else if (q === "ticket") {
      const t = lastTicket || D.tickets[0];
      if (!t) { body.append(mk("div", "p-msg", "Pídeme «ticket de salida de…».")); return; }
      body.append(mk("div", "p-k", t.titulo + (t.curso ? " · " + t.curso : "")));
      const ol = mk("ol", "p-ops big"); t.preguntas.forEach((x) => { const li = mk("li"); li.innerHTML = A.mdInline(x); ol.append(li); }); body.append(ol);
      const sem = mk("div", "p-sem");
      [["verde", "Entendí"], ["amarillo", "Más o menos"], ["rojo", "No entendí"]].forEach(([k, l]) => {
        const b = mk("button", "sem " + k); b.type = "button"; b.append(mk("b", "", String(t.votos[k] || 0)), mk("span", "", l));
        b.addEventListener("click", () => { t.votos[k] = (t.votos[k] || 0) + 1; save(); drawProj(); });
        sem.append(b);
      });
      body.append(sem);
      navBtn("Reiniciar conteo", () => { t.votos = { verde: 0, amarillo: 0, rojo: 0 }; save(); drawProj(); });
    }
  }
  function onPick() { if (proj && !proj.hidden && pState.que === "estudiante") drawProj(); }
  function onGroups() { if (proj && !proj.hidden && pState.que === "grupos") drawProj(); }

  // ======================================================================== WORD
  async function word(it) {
    if (!window.docx) await loadScript("vendor/docx.iife.js");
    const X = window.docx, q = it.quiz, L_ = "abcdef";
    const P = (text, o = {}) => new X.Paragraph({ spacing: { after: o.after ?? 120 }, indent: o.indent ? { left: o.indent } : undefined, children: [new X.TextRun({ text, bold: !!o.bold, size: o.size || 24, font: "Calibri" })] });
    const kids = [P(q.titulo, { bold: true, size: 32, after: 200 }), P("Nombre: ________________________________   Curso: " + (it.curso || "________") + "   Fecha: ____________", { after: 240 })];
    if (q.instrucciones) kids.push(P(q.instrucciones, { after: 240 }));
    q.preguntas.forEach((p, i) => { kids.push(P(`${i + 1}. ${L.plainMath(p.enunciado)}`, { bold: true, after: 80 })); p.opciones.forEach((o, k) => kids.push(P(`${L_[k]}) ${L.plainMath(o)}`, { indent: 400, after: 40 }))); kids.push(P("", { after: 120 })); });
    kids.push(new X.Paragraph({ children: [new X.PageBreak()] }), P("Respuestas", { bold: true, size: 28, after: 200 }));
    q.preguntas.forEach((p, i) => kids.push(P(`${i + 1}. ${L_[p.correcta]}) ${L.plainMath(p.opciones[p.correcta])}${p.explicacion ? " — " + L.plainMath(p.explicacion) : ""}`, { after: 80 })));
    const doc = new X.Document({ creator: "Jarvis", title: q.titulo, sections: [{ properties: {}, children: kids }] });
    const blob = await X.Packer.toBlob(doc);
    await N.share({ title: q.titulo, fileName: slug(q.titulo) + ".docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", base64: ab64(await blob.arrayBuffer()) });
  }
  function quizButtons(btn, it) {
    btn("Word", "i-pdf", () => word(it).catch((e) => A.toast("No pude hacer el Word: " + e.message, 6000)));
    btn("Google Forms", "i-quiz", () => forms(it));
    btn("Proyectar", "", () => { A.setQuiz(it); openProjector("quiz"); });
  }

  // ======================================================================== GOOGLE
  let gToken = null, gExp = 0;
  async function google() {
    if (gToken && Date.now() < gExp) return gToken;
    const SL = native() && plug("SocialLogin");
    const cid = (D.ajustes.google.clienteWeb || "").trim();
    if (!SL) throw new Error("Google funciona en la app instalada (el APK), no en el navegador.");
    if (!cid) throw new Error("Falta conectar Google: en Ajustes › Google pon el «ID de cliente web» (la guía está en el README del proyecto).");
    await SL.initialize({ google: { webClientId: cid, mode: "online" } });
    const r = await SL.login({ provider: "google", options: { scopes: L2.SCOPES } });
    const res = r && r.result;
    const tok = res && res.accessToken && (res.accessToken.token || res.accessToken);
    if (!tok || typeof tok !== "string") throw new Error("Google no dio permiso para el calendario, Classroom y Forms. Vuelve a conectar y acepta los permisos.");
    gToken = tok; gExp = Date.now() + 50 * 60000;
    if (res.profile && res.profile.email) { D.ajustes.google.cuenta = res.profile.email; save(); }
    return tok;
  }
  async function gfetch(url, opt = {}) {
    const tok = await google();
    const res = await fetch(url, Object.assign({}, opt, { headers: Object.assign({ Authorization: "Bearer " + tok }, opt.headers || {}) }));
    if (res.status === 401) { gToken = null; throw new Error("Se venció el permiso de Google. Intenta de nuevo."); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j.error && j.error.message) || "Google respondió con un error (" + res.status + ").");
    return j;
  }
  async function agenda(dia) {
    try { A.reply(L2.eventsSpoken(await gfetch(L2.calendarListURL(new Date(), dia)), new Date())); }
    catch (e) { A.reply(e.message, "err"); }
  }
  async function schedule(text) {
    const ev = L2.eventFromText(text);
    if (!ev) return A.reply("Dime qué y cuándo: «agenda reunión de padres mañana a las 3 de la tarde».");
    try { await gfetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ev) });
      A.reply(`Listo, agendé «${ev.summary}» ${L.spokenWhen(new Date(ev.start.dateTime))} en tu Google Calendar.`); }
    catch (e) { A.reply(e.message, "err"); }
  }
  async function classroom() {
    try {
      const j = await gfetch("https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=50");
      const cs = j.courses || [];
      if (!cs.length) return A.reply("No encontré cursos activos en tu Google Classroom.");
      let n = 0;
      for (const c of cs) {
        const r = await gfetch(`https://classroom.googleapis.com/v1/courses/${encodeURIComponent(c.id)}/students?pageSize=200`);
        const names = L2.rosterNames(r);
        if (!names.length) continue;
        let k = D.cursos.find((x) => x.classroom === c.id) || D.cursos.find((x) => L.norm(x.nombre) === L.norm(c.name));
        if (!k) { k = { id: window.JD.uid(), nombre: c.name.slice(0, 24), estudiantes: [], usados: [], notas: { actividades: [], valores: {} } }; D.cursos.push(k); }
        k.classroom = c.id; k.estudiantes = Array.from(new Set(k.estudiantes.concat(names))); n++;
      }
      save(); A.renderClase();
      A.reply(`Listo: traje ${n} curso(s) de Classroom con sus estudiantes.`);
    } catch (e) { A.reply(e.message, "err"); }
  }
  async function forms(it) {
    try {
      A.toast("Creando el formulario en Google Forms…", 3000);
      const f = L2.formsRequests(it.quiz);
      const made = await gfetch("https://forms.googleapis.com/v1/forms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.create) });
      await gfetch(`https://forms.googleapis.com/v1/forms/${made.formId}:batchUpdate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.batch) });
      const url = made.responderUri || `https://docs.google.com/forms/d/${made.formId}/viewform`;
      A.reply(`Listo el quiz en Google Forms, con la clave para que se califique solo:\n${url}\n\nEdítalo en https://docs.google.com/forms/d/${made.formId}/edit`, "tool", "Listo el quiz en Google Forms. El enlace está en la pantalla.");
    } catch (e) { A.reply(e.message, "err"); }
  }
  async function driveSave(say) {
    try {
      const json = JSON.stringify(window.JD.backup());
      const list = await gfetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + encodeURIComponent("name='jarvis-android-copia.json'") + "&fields=files(id)");
      const id = list.files && list.files[0] && list.files[0].id;
      const mp = L2.driveMultipart(json, "jarvis-android-copia.json", id ? null : ["appDataFolder"]);
      await gfetch(id ? `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        { method: id ? "PATCH" : "POST", headers: { "content-type": "multipart/related; boundary=" + mp.boundary }, body: mp.body });
      D.ajustes.google.copia = Date.now(); save();
      if (say) A.reply("Listo: guardé la copia de tus datos en tu Google Drive (en una carpeta privada de la app, sin tu clave de IA).");
    } catch (e) { if (say) A.reply(e.message, "err"); }
  }
  async function driveRestore() {
    const list = await gfetch("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=" + encodeURIComponent("name='jarvis-android-copia.json'") + "&fields=files(id,modifiedTime)");
    const f = list.files && list.files[0];
    if (!f) throw new Error("No hay ninguna copia de Jarvis en tu Drive todavía.");
    const tok = await google();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, { headers: { Authorization: "Bearer " + tok } });
    window.JD.restore(await res.json());
  }

  // ======================================================================== EL JARVIS DEL COMPUTADOR
  async function pc(orden) {
    const link = L2.pcLink(D.ajustes.pc);
    if (!link) return A.reply("Para mandar órdenes al computador, en Ajustes › Computador pega la dirección del «panel del celular» de tu Jarvis de Windows (la que sale en el QR).");
    const H = plug("CapacitorHttp");
    try {
      let out;
      if (native() && H) {
        const r = await H.request({ url: link.base + "/api/orden", method: "POST", headers: { "X-Jarvis-Token": link.token, "content-type": "application/json" }, data: { texto: orden }, connectTimeout: 8000, readTimeout: 60000 });
        if (r.status === 403) throw new Error("El computador no aceptó la clave: copia otra vez la dirección del panel del celular.");
        out = (r.data && r.data.text) || "";
      } else {
        const r = await fetch(link.base + "/api/orden", { method: "POST", headers: { "X-Jarvis-Token": link.token, "content-type": "application/json" }, body: JSON.stringify({ texto: orden }) });
        out = (await r.json()).text || "";
      }
      A.reply("🖥️ " + (out || "Hecho en el computador."));
    } catch (e) {
      A.reply(e.message && /clave/.test(e.message) ? e.message : "No pude hablar con el computador: debe estar prendido, con Jarvis abierto y en el mismo wifi que el celular.", "err");
    }
  }

  // ======================================================================== MANOS LIBRES Y BURBUJA
  let hfOn = false, hfLoop = null;
  function setHandsFree(on) {
    D.ajustes.manosLibres = !!on; save(); hfOn = !!on;
    document.body.classList.toggle("manoslibres", hfOn);
    const p = $("#hf-pill"); if (p) p.hidden = !hfOn;
    N.keepAwake(hfOn);
    clearTimeout(hfLoop);
    if (hfOn) tickHF();
  }
  async function tickHF() {
    if (!hfOn) return;
    if (window.__jarvisFondo) { hfLoop = setTimeout(tickHF, 3000); return; }     // 2.2: ya escucha el servicio de fondo
    if (document.hidden || A.getState() !== "idle" || V.isSpeaking()) { hfLoop = setTimeout(tickHF, 1200); return; }
    hfMode = true;
    await A.listen(true);
    hfMode = false;
    hfLoop = setTimeout(tickHF, 400);
  }
  let hfMode = false;
  /** Con manos libres, solo atiende lo que empieza por «Jarvis». → true si ya lo manejó (o lo ignoró). */
  function heard(text) {
    if (!hfMode) return false;
    const rest = L2.afterWake(text);
    if (rest === null) return true;                                        // conversación del salón: no era para Jarvis
    if (rest === "") { A.say("¿Sí?"); hfMode = false; setTimeout(() => A.listen(false), 700); return true; }
    A.handle(rest, true);
    return true;
  }
  async function bubble(on, talk) {
    const B = native() && plug("Burbuja");
    if (!B) { if (talk) A.reply("La burbuja flotante funciona en la app instalada (el APK)."); return; }
    try {
      if (on) {
        const p = await B.permitido();
        if (!p.permitido) { if (talk) A.reply("Android necesita que permitas «Mostrar sobre otras apps» para Jarvis. Te abro esa opción: actívala y vuelve a pedírmelo."); await B.pedirPermiso(); return; }
        await B.mostrar(); D.ajustes.burbuja = true; save();
        if (talk) A.reply("Listo: la burbuja de Jarvis queda flotando sobre las otras apps. Tócala para hablarme; arrástrala a donde quieras.");
      } else { await B.ocultar(); D.ajustes.burbuja = false; save(); if (talk) A.reply("Quité la burbuja."); }
    } catch (e) { if (talk) A.reply("No pude con la burbuja: " + (e.message || e), "err"); }
  }

  // ======================================================================== AJUSTES 2.0
  function settings() {
    let box = $("#aj2");
    if (!box) {
      box = mk("div"); box.id = "aj2";
      const before = [...document.querySelectorAll("#ajustes .sub")].find((h) => /Tus datos/i.test(h.textContent));
      if (before) before.before(box); else $("#ajustes .scroll").append(box);
    }
    box.innerHTML = "";
    // memoria
    box.append(mk("h3", "sub", "Memoria"));
    box.append(mk("p", "hint", "Dime «recuerda que…» o «de ahora en adelante…». Aquí puedes borrar lo que no quieras."));
    const ul = mk("ul", "lista");
    D.lecciones.map((x) => ["Lección", x, "lecciones"]).concat(D.memoria.map((x) => ["Dato", x, "memoria"])).forEach(([k, x, key]) => {
      const li = mk("li"), g = mk("div", "grow", x.texto); g.append(mk("small", "", k));
      const del = mk("button", "x"); del.type = "button"; del.innerHTML = '<svg><use href="#i-x"/></svg>';
      del.addEventListener("click", () => { D[key] = D[key].filter((y) => y !== x); save(); settings(); });
      li.append(g, del); ul.append(li);
    });
    if (!ul.children.length) ul.append(mk("li", "hint", "Nada todavía."));
    box.append(ul);
    // manos libres y burbuja
    box.append(mk("h3", "sub", "Manos libres"));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); box.append(l); };
    chk("Escuchar «Jarvis…» mientras la app está abierta (la pantalla queda encendida)", D.ajustes.manosLibres, (v) => setHandsFree(v));
    chk("Burbuja flotante sobre las otras apps (tócala para hablarme)", D.ajustes.burbuja, (v) => bubble(v, false));
    // Google
    box.append(mk("h3", "sub", "Google (Calendario, Classroom, Forms y Drive)"));
    box.append(mk("p", "hint", "Necesita un «ID de cliente web» de Google Cloud (se crea una vez; los pasos están en el README del proyecto en GitHub)."));
    const gi = mk("input", "inp"); gi.placeholder = "123456-abc.apps.googleusercontent.com"; gi.value = D.ajustes.google.clienteWeb; gi.spellcheck = false;
    gi.addEventListener("change", () => { D.ajustes.google.clienteWeb = gi.value.trim(); gToken = null; save(); });
    box.append(gi);
    const row = mk("div", "row wrap"), st = mk("span", "hint", D.ajustes.google.cuenta ? "Conectado: " + D.ajustes.google.cuenta : "");
    const bc = mk("button", "btn", "Conectar con Google"); bc.type = "button";
    bc.addEventListener("click", async () => { st.textContent = "Conectando…"; try { gToken = null; await google(); st.textContent = "Conectado" + (D.ajustes.google.cuenta ? ": " + D.ajustes.google.cuenta : "."); } catch (e) { st.textContent = e.message; } });
    const bd = mk("button", "btn", "Copia en Drive"); bd.type = "button"; bd.addEventListener("click", () => driveSave(true).then(() => A.toast("Copia guardada en tu Drive.")));
    const br = mk("button", "btn", "Restaurar de Drive"); br.type = "button";
    br.addEventListener("click", async () => { if (!confirm("¿Reemplazar los datos de este celular por la copia de Drive?")) return; try { await driveRestore(); A.toast("Copia restaurada. Recargando…"); setTimeout(() => location.reload(), 900); } catch (e) { A.toast(e.message, 6000); } });
    row.append(bc, bd, br, st); box.append(row);
    // computador
    box.append(mk("h3", "sub", "El Jarvis del computador"));
    box.append(mk("p", "hint", "Pega la dirección del «panel del celular» de tu Jarvis de Windows (Ajustes › Celular, la del QR). Después dime «en el computador abre Word». Funciona en el mismo wifi."));
    const pi = mk("input", "inp"); pi.placeholder = "http://192.168.1.20:8766/?k=…"; pi.value = D.ajustes.pc; pi.spellcheck = false;
    pi.addEventListener("change", () => { D.ajustes.pc = pi.value.trim(); save(); });
    box.append(pi);
  }

  // ======================================================================== ARRANQUE
  function init(api) {
    A = api; D = api.D;
    try { ensureData(); save(); initUI(); } catch (e) { console.error("init 2.0", e); }
  }
  function initUI() {
    const top = $(".top"), gear = $("#btn-ajustes");
    const pb = mk("button", "icon-btn"); pb.type = "button"; pb.id = "btn-proy"; pb.setAttribute("aria-label", "Modo proyector");
    pb.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
    pb.addEventListener("click", () => openProjector(""));
    top.insertBefore(pb, gear);
    const pills = mk("div", "pills");
    const tp = mk("span", "pill-s", "TUTOR"); tp.id = "tutor-pill"; tp.hidden = true; tp.title = "Modo tutor (toca para salir)";
    tp.addEventListener("click", () => run({ kind: "tutor_off" }));
    const hp = mk("span", "pill-s hf", "MANOS LIBRES"); hp.id = "hf-pill"; hp.hidden = true; hp.addEventListener("click", () => setHandsFree(false));
    pills.append(tp, hp); $(".brand").after(pills);
    markTutor();
    if (D.ajustes.manosLibres) setHandsFree(true);
    const B = native() && plug("Burbuja");
    if (B) {
      B.addListener("toque", () => { A.tab("hablar"); setTimeout(() => A.listen(false), 400); }).catch(() => {});
      if (D.ajustes.burbuja) bubble(true, false);
    }
    // copia automática en Drive una vez al día si ya conectaste Google
    if (native() && D.ajustes.google.cuenta && Date.now() - (D.ajustes.google.copia || 0) > 20 * 3600e3) setTimeout(() => driveSave(false), 15000);
  }
  window.JX = { init, intent, run, promptExtra, heard, renderClase, afterGrade, quizButtons, settings, onPick, onGroups, _: { openProjector, closeProjector, risk, student } };
})();
