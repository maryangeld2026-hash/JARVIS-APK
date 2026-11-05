/* Jarvis para Android 3.4 · lo que el celular hace bien:
   · el botón de asistente, los atajos del ícono, el widget y «Compartir › Jarvis» desde otras apps;
   · botones bajo cada respuesta (Proyectar, Word, Más corto, Oír, Graficar, WhatsApp, Copiar) y la tarjeta «Ahora»;
   · pasar lista, «No molestar» en clase, WhatsApp a los padres, escanear y leer texto sin internet,
     huella o PIN, tamaño de letra, la voz de Jarvis y avisos con botones.
   Se engancha a window.JX como hud.js y habilidades.js. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL, L3 = window.JL3, L4 = window.JL4, V = window.JV, N = window.JN, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const native = () => V.native();
  const plug = (n) => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const W = () => native() && plug("Ventana");
  const H = () => X._h || {};
  const sched = () => L3.parseSchedule(D.ajustes.horario || "");

  // ======================================================================== LO QUE LLEGA DE AFUERA
  async function entradas() {
    const P = W(); if (!P) return;
    let r; try { r = await P.pendientes(); } catch (e) { return; }
    for (const e of (r && r.lista) || []) { try { await entrada(e); } catch (er) { console.error(er); A.toast(er.message || String(er), 6000); } }
  }
  async function entrada(e) {
    if (e.tipo === "atajo") {
      A.tab("hablar");
      if (/^orden:/.test(e.atajo || "")) { const o = e.atajo.slice(6); A.add("assistant", "▶ Automático: " + o, "tool orden"); return A.dispatch ? A.dispatch(o) : A.handle(o, false); }   // 3.9: disparadores
      switch (e.atajo) {
        case "hablar": setTimeout(() => (A.wake ? A.wake() : A.listen(false)), 350); return;
        case "tiempo5": A.startTimer(300); return A.reply("Listo: 5 minutos. Te aviso cuando termine.");
        case "parar_tiempo": { const b = $("#btn-tiempo-parar"); if (b) b.click(); return A.reply("Paré el temporizador."); }
        case "foto": return askPick("¿Qué quieres hacer?", [["📷 Calificar hojas de respuesta", () => X._omr && X._omr.open()], ["📷 Foto a la conversación", () => clickInput("#chat-cam-in")], ["🖼️ De la galería", () => clickInput("#chat-foto-in")]]);
        case "lista": return openAttendance(null);
      }
      return;
    }
    if (e.tipo === "compartir") {
      A.tab("hablar");
      if (e.error) return A.reply(e.error, "err");
      if (e.base64) {
        const bytes = Uint8Array.from(atob(e.base64), (c) => c.charCodeAt(0));
        const file = new File([bytes], e.nombre || "archivo", { type: e.mime || "application/octet-stream" });
        const img = /^image\//.test(file.type);
        return askPick(`Recibí «${file.name}». ¿Qué hago?`, (img
          ? [["Explícame o resuélvelo", "¿Qué hay en esta imagen? Si es un ejercicio o un tablero, explícalo y resuélvelo paso a paso."], ["Califícalo como trabajo", null, () => gradeShared(file)], ["Lee el texto", null, () => ocrFile(file)]]
          : [["Resúmelo", "Resume este documento en puntos clave."], ["Hazme un quiz con esto", "Hazme un quiz de 5 preguntas de selección múltiple con base en este documento, con la respuesta correcta y una explicación."], ["Ideas para la clase", "Dime cómo puedo usar este documento en clase: 3 actividades concretas."]])
          .map(([t, q, fn]) => [t, fn || (() => { $("#in-texto").value = q; return img ? H().photoQuestion(file) : H().docQuestion(file); })]));
      }
      if (e.texto) {
        const t = e.texto.trim();
        return askPick(`Recibí este texto:\n\n> ${t.slice(0, 280).replace(/\n/g, "\n> ")}${t.length > 280 ? "…" : ""}\n\n¿Qué hago?`, [
          ["Resúmelo", () => A.handle("Resume esto en puntos clave:\n\n" + t, false)],
          ["Respóndele (a un padre o colega)", () => A.handle("Ayúdame a responder este mensaje con cordialidad y en pocas líneas:\n\n" + t, false)],
          ["Guárdalo en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: t.split("\n")[0].slice(0, 60) || "Texto compartido", md: t, fecha: Date.now(), tipo: "nota" }); save(); A.reply("Guardado en Material."); }],
          ["Recuérdamelo", () => A.handle("recuérdame " + t.slice(0, 120), false)],
          ["🔊 Léelo en voz alta", () => (X._vida ? X._vida.leerCompartido(t) : A.say(t))]]);
      }
    }
  }
  function clickInput(sel) { const i = $(sel); if (i) i.click(); }
  /** Pregunta con botones dentro de la conversación. */
  function askPick(text, ops) {
    const { e } = A.add("assistant", text, "tool");
    e.innerHTML = A.md(text);
    const box = mk("div", "doc-acts");
    ops.forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => { box.querySelectorAll("button").forEach((x) => (x.disabled = true)); b.classList.add("on"); fn(); }); box.append(b); });
    e.append(box);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    A.say(text.split("\n")[0]);
  }
  async function gradeShared(file) {
    const inp = $("#foto-in"); if (!inp) return;
    const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; inp.dispatchEvent(new Event("change"));
    A.tab("clase");
  }

  // ======================================================================== BOTONES BAJO CADA RESPUESTA
  function afterAnswer(e, m) {
    if (!e || e.querySelector(".resp-acts")) return;
    const box = mk("div", "resp-acts"), text = m.content;
    const b = (ic, t, fn) => { const x = mk("button", "ra", ""); x.type = "button"; x.title = t; x.setAttribute("aria-label", t); x.append(mk("span", "", ic), mk("small", "", t)); x.addEventListener("click", (ev) => { ev.stopPropagation(); fn(x); }); box.append(x); };
    b("📽", "Proyectar", () => X._ && X._.projectText ? X._.projectText(text) : A.toast("El proyector no está listo."));
    b("📄", "Word", () => H().docWord({ titulo: titleOf(text), md: text }).catch((er) => A.toast("No pude hacer el Word: " + er.message, 6000)));
    b("✂", "Más corto", () => A.handle("Dilo más corto: en 2 o 3 frases.", false));
    b("🔊", "Oír", () => { V.hush(); L.forSpeech(text).split(/(?<=[.!?…])\s+/).forEach((f) => V.say(f)); });
    const fx = L4.fnFromAnswer(text);
    if (fx && L3.compileFn(fx)) b("📈", "Graficar", () => H().plot(fx));
    b("💬", "WhatsApp", () => openUrl(L4.waLink(text)));
    b("📋", "Copiar", (x) => { const t = L.plainMath ? L.plainMath(text) : text; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => A.toast("Copiado.")).catch(() => N.share({ title: "Jarvis", text: t }).catch(() => {})); });
    e.append(box);
  }
  const titleOf = (t) => (String(t).split("\n").find((l) => l.trim()) || "Respuesta de Jarvis").replace(/^#+\s*|\*\*/g, "").slice(0, 70);
  function openUrl(url) {
    const P = W();
    if (P) return P.abrir({ url }).catch((e) => A.toast(e.message || "No pude abrir WhatsApp.", 5000));
    window.open(url, "_blank");
  }

  // ======================================================================== TARJETA «AHORA»
  const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  function ahora() {
    const s = L4.ahoraState(sched(), new Date());
    const card = mk("div", "ahora ahora-" + s.modo);
    const btns = mk("div", "ahora-b");
    const btn = (t, cmd, fill) => { const x = mk("button", "chip", t + (fill ? " …" : "")); x.type = "button"; x.addEventListener("click", (ev) => { ev.stopPropagation(); if (fill) { const i = $("#in-texto"); i.value = cmd; i.focus(); } else A.handle(cmd, false); }); btns.append(x); };
    const head = (k, v) => { const h = mk("div", "ahora-h"); h.append(mk("span", "ahora-k", k), mk("b", "", v)); card.append(h); };
    if (s.modo === "sin_horario") return null;
    if (s.modo === "clase") {
      const c = L4.courseOf(s.clase.que);
      head("EN CLASE", `${s.clase.que} · faltan ${s.falta} min`);
      const bar = mk("div", "ahora-bar"); const fill = mk("i"); fill.style.width = s.pct + "%"; if (s.falta <= 5) bar.classList.add("fin"); bar.append(fill); card.append(bar);
      btn("Escoge un estudiante", `escoge un estudiante de ${c}`); btn("Pasar lista", `pasa lista de ${c}`); btn("5 minutos", "pon 5 minutos"); btn("Ticket de salida", `ticket de salida de `, true); btn("Hoy vimos", `hoy en ${c} vimos `, true);
    } else if (s.modo === "antes") {
      const c = L4.courseOf(s.clase.que);
      head("PRÓXIMA", `${s.clase.que} · ${hhmm(s.clase.ini)}${s.en <= 120 ? ` (en ${s.en} min)` : ""}`);
      btn(`¿Qué vimos en ${c}?`, `¿qué vimos en ${c}?`); btn("Prepárame la clase", `planéame la clase de  para ${c}`, true); btn("Quiz rápido", `hazme un quiz de 5 preguntas de  para ${c}`, true);
    } else if (s.modo === "despues") {
      head("CLASES DE HOY", "terminadas por ahora");
      btn("¿Qué hice hoy?", "¿qué hiciste hoy?"); btn("Calificar hojas", "califica las hojas"); btn("¿Quiénes van en riesgo?", "¿quiénes están en riesgo?");
    } else if (s.modo === "noche") {
      head(s.domingo ? "LA SEMANA" : "MAÑANA", s.manana.length ? s.manana.map((c) => `${hhmm(c.ini)} ${c.que}`).join(" · ") : "sin clases");
      s.manana.slice(0, 3).forEach((c) => btn(`Preparar ${L4.courseOf(c.que)}`, `planéame la clase de  para ${L4.courseOf(c.que)}`, true));
      if (s.domingo) btn("Prepárame la semana", "planea mi semana de clases: ", true);
    }
    // barra del periodo
    if (D.ajustes.periodoFin) {
      const d = Math.ceil((D.ajustes.periodoFin - Date.now()) / 864e5);
      if (d > 0 && d <= 90) { const p = mk("div", "ahora-per"); p.textContent = `Periodo: faltan ${d} día${d === 1 ? "" : "s"} para el cierre`; card.append(p); }
    }
    if (btns.childElementCount) card.append(btns);
    return card;
  }
  /** La cabecera dice «EN CLASE · 7A · 12 MIN» cuando estás en clase y Jarvis está quieto. */
  function headStatus() {
    if (!A || A.getState() !== "idle") return;
    const s = L4.ahoraState(sched(), new Date()), st = $("#status");
    if (!st) return;
    const t = s.modo === "clase" ? `EN CLASE · ${L4.courseOf(s.clase.que)} · ${s.falta} MIN` : s.modo === "antes" && s.en <= 30 ? `${L4.courseOf(s.clase.que)} EN ${s.en} MIN` : "LISTO";
    if (st.textContent !== t) st.textContent = t;
  }
  /** El widget de la pantalla de inicio: la clase de ahora o la próxima, y el próximo recordatorio. */
  let lastWidget = "";
  function widget() {
    const P = W(); if (!P) return;
    const s = L4.ahoraState(sched(), new Date());
    const titulo = s.modo === "clase" ? `En clase: ${s.clase.que}` : s.modo === "antes" ? `Próxima: ${s.clase.que} a las ${hhmm(s.clase.ini)}` : s.modo === "noche" && s.manana.length ? `Mañana: ${s.manana[0].que} a las ${hhmm(s.manana[0].ini)}` : "Jarvis";
    const next = (D.recordatorios || []).filter((r) => !r.avisado && r.cuando > Date.now()).sort((a, b) => a.cuando - b.cuando)[0];
    const sub = s.modo === "clase" ? `Faltan ${s.falta} min · toca 🎙️ para hablarme` : next ? `⏰ ${next.texto.slice(0, 40)} · ${new Date(next.cuando).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}` : "Toca el micrófono para hablarme";
    const k = titulo + "|" + sub;
    if (k === lastWidget) return;
    lastWidget = k; P.widget({ titulo, sub }).catch(() => {});
  }

  // ======================================================================== PASAR LISTA
  function findCourse(q) { return (q && L.findCourse(D.cursos, L4.norm(q))) || A.courseFor(null); }
  function todayRec(c) {
    D.asistencia = D.asistencia || [];
    const k = L4.dayKey();
    let r = D.asistencia.find((x) => x.fecha === k && x.curso === c.nombre);
    if (!r) { r = { fecha: k, curso: c.nombre, faltas: [], tardes: [] }; D.asistencia.unshift(r); D.asistencia = D.asistencia.slice(0, 2000); }
    return r;
  }
  function openAttendance(q) {
    const c = findCourse(q);
    if (!c) return A.reply(D.cursos.length ? "¿De qué curso? Dime «pasa lista de 7A»." : "Primero crea un curso con su lista, en la pestaña Clase.", "err");
    const r = todayRec(c);
    let sh = $("#lista-sh");
    if (!sh) { sh = mk("div", "sheet"); sh.id = "lista-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in");
    const hd = mk("div", "sheet-h"); hd.append(mk("h2", "", `Lista de ${c.nombre} · hoy`));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => close()); hd.append(x);
    const sc = mk("div", "scroll"), info = mk("p", "hint", "Toca un nombre: ✓ vino → ✗ faltó → ⏱ llegó tarde.");
    const ul = mk("ul", "lista asis");
    const cnt = L4.countAbsences(D.asistencia, c.nombre);
    c.estudiantes.forEach((n) => {
      const li = mk("li", "asis-li"), st = mk("b", "asis-st"), nm = mk("span", "grow", n), tot = cnt[n] && cnt[n].faltas ? mk("small", "", `${cnt[n].faltas} falla${cnt[n].faltas === 1 ? "" : "s"}`) : null;
      const draw = () => { const f = r.faltas.includes(n), t = r.tardes.includes(n); st.textContent = f ? "✗" : t ? "⏱" : "✓"; li.dataset.s = f ? "f" : t ? "t" : "p"; };
      li.addEventListener("click", () => {
        const f = r.faltas.includes(n), t = r.tardes.includes(n);
        r.faltas = r.faltas.filter((y) => y !== n); r.tardes = r.tardes.filter((y) => y !== n);
        if (!f && !t) r.faltas.push(n); else if (f) r.tardes.push(n);
        save(); draw();
      });
      li.append(st, nm); if (tot) li.append(tot); draw(); ul.append(li);
    });
    const foot = mk("div", "sheet-f");
    const close = () => { sh.hidden = true; save(); A.reply(r.faltas.length ? `Lista de ${c.nombre} guardada. Faltaron ${r.faltas.length}: ${r.faltas.join(", ")}.` + (r.tardes.length ? ` Llegaron tarde: ${r.tardes.join(", ")}.` : "") : `Lista de ${c.nombre} guardada: vinieron todos.`, "tool", r.faltas.length ? `Guardé la lista. Faltaron ${r.faltas.length}.` : "Guardé la lista. Vinieron todos."); };
    const ok = mk("button", "btn primary", "Guardar lista"); ok.type = "button"; ok.addEventListener("click", close);
    sc.append(info, ul); inn.append(hd, sc, foot); foot.append(ok); sh.append(inn);
    foot.prepend(mk("span", "hint asis-cnt"));
    const cntEl = foot.querySelector(".asis-cnt"); const repaint = () => { cntEl.textContent = `${c.estudiantes.length - r.faltas.length} vinieron · ${r.faltas.length} faltaron · ${r.tardes.length} tarde`; };
    ul.addEventListener("click", repaint); repaint();
  }
  function who(q) {
    const all = []; D.cursos.forEach((c) => c.estudiantes.forEach((n) => all.push({ n, c })));
    const k = L4.norm(q), parts = k.split(" ").filter(Boolean);
    return all.find((x) => L4.norm(x.n) === k) || all.find((x) => parts.every((p) => L4.norm(x.n).split(" ").some((w) => w.startsWith(p)))) || null;
  }
  function attendance(it) {
    if (it.kind === "lista_abrir") return openAttendance(it.curso);
    if (it.kind === "faltas_add") {
      const c = findCourse(it.curso) || (who(it.nombres[0]) || {}).c;
      if (!c) return A.reply("¿En qué curso? Dime «faltaron Pablo y Ana en 7A».", "err");
      const r = todayRec(c), ok = [], no = [];
      it.nombres.forEach((q) => { const f = who(q); const n = f && f.c === c ? f.n : null; if (!n) return no.push(q); ok.push(n); const lst = it.tipo === "tarde" ? r.tardes : r.faltas; if (!lst.includes(n)) lst.push(n); if (it.tipo !== "tarde") r.tardes = r.tardes.filter((y) => y !== n); });
      save();
      return A.reply((ok.length ? `Anotado en ${c.nombre}: ${ok.join(", ")} ${it.tipo === "tarde" ? "llegó tarde" : ok.length > 1 ? "faltaron" : "faltó"}.` : "") + (no.length ? ` No encontré a ${no.join(", ")} en ${c.nombre}.` : ""), no.length && !ok.length ? "err" : "tool");
    }
    if (it.kind === "faltas_ver") {
      const f = who(it.quien); if (!f) return A.reply(`No encontré a «${it.quien}».`, "err");
      const x = L4.countAbsences(D.asistencia || [], f.c.nombre)[f.n];
      return A.reply(x ? `${f.n} lleva ${x.faltas} falla${x.faltas === 1 ? "" : "s"}${x.tardes ? ` y ${x.tardes} llegada${x.tardes === 1 ? "" : "s"} tarde` : ""}${x.fechas.length ? ` (la última: ${x.fechas[0]})` : ""}.` : `${f.n} no tiene fallas anotadas.`);
    }
    if (it.kind === "faltas_curso" || it.kind === "faltas_top") {
      const c = it.kind === "faltas_curso" ? findCourse(it.curso) : null;
      const x = Object.entries(L4.countAbsences(D.asistencia || [], c ? c.nombre : null)).filter(([, v]) => v.faltas).sort((a, b) => b[1].faltas - a[1].faltas);
      if (!x.length) return A.reply(`No hay fallas anotadas${c ? " en " + c.nombre : ""}.`);
      return A.reply(`**Fallas${c ? " en " + c.nombre : ""}:**\n` + x.slice(0, 15).map(([n, v]) => `- ${n}: ${v.faltas}${v.tardes ? ` (+${v.tardes} tarde)` : ""}`).join("\n"), "tool", `${x[0][0]} es quien más falta: ${x[0][1].faltas} veces. La lista está en la pantalla.`);
    }
  }

  // ======================================================================== ESCANEAR Y LEER TEXTO (sin internet)
  async function scan(conTexto) {
    const P = native() && plug("Escaner");
    if (!P) return A.toast("El escáner funciona en la app instalada (el APK).");
    try {
      const r = await P.escanear({ paginas: 8, texto: !!conTexto });
      if (r.cancelado || !r.paginas || !r.paginas.length) return;
      if (conTexto) {
        const t = (r.texto || "").trim();
        if (!t) return A.reply("No encontré texto en lo que escaneaste.", "err");
        return askPick(`**Texto leído (${r.paginas.length} página${r.paginas.length > 1 ? "s" : ""}, sin internet):**\n\n${t.slice(0, 1500)}${t.length > 1500 ? "…" : ""}`, [
          ["Copiar", () => (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => A.toast("Copiado.")).catch(() => {})],
          ["Guardar en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: "Escaneo: " + t.split("\n")[0].slice(0, 50), md: t, fecha: Date.now(), tipo: "nota" }); save(); A.toast("Guardado en Material."); }],
          ["Resúmelo con la IA", () => A.handle("Resume este texto en puntos clave:\n\n" + t.slice(0, 20000), false)]]);
      }
      // las páginas escaneadas: a un PDF y a la IA, o a Material
      await window.JPDF.libs();
      const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "letter" });
      for (let i = 0; i < r.paginas.length; i++) {
        if (i) doc.addPage();
        const img = await loadImg("data:image/jpeg;base64," + r.paginas[i]);
        const pw = 215.9, ph = 279.4, k = Math.min(pw / img.width, ph / img.height);
        doc.addImage("data:image/jpeg;base64," + r.paginas[i], "JPEG", (pw - img.width * k) / 2, (ph - img.height * k) / 2, img.width * k, img.height * k);
      }
      const b64 = doc.output("datauristring").split(",")[1];
      const file = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "escaneo.pdf", { type: "application/pdf" });
      askPick(`Escaneé ${r.paginas.length} página${r.paginas.length > 1 ? "s" : ""}. ¿Qué hago?`, [
        ["Compartir el PDF", () => N.share({ title: "Escaneo", fileName: `escaneo-${L4.dayKey()}.pdf`, mime: "application/pdf", base64: b64 }).catch(() => {})],
        ["Resúmelo", () => { $("#in-texto").value = "Resume este documento en puntos clave."; H().docQuestion(file); }],
        ["Hazme un quiz con esto", () => { $("#in-texto").value = "Hazme un quiz de 5 preguntas de selección múltiple con base en este documento."; H().docQuestion(file); }]]);
    } catch (e) { A.reply(e.message || String(e), "err"); }
  }
  const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  async function ocrFile(file) {
    const P = native() && plug("Escaner");
    if (!P) return A.toast("Leer texto sin internet funciona en la app instalada.");
    const b64 = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(file); });
    try { const r = await P.leerTexto({ base64: b64 }); A.reply(r.texto && r.texto.trim() ? "**Texto de la imagen (leído sin internet):**\n\n" + r.texto.trim() : "No encontré texto en la imagen.", r.texto ? "tool" : "err", "Listo, el texto está en la pantalla."); }
    catch (e) { A.reply(e.message || String(e), "err"); }
  }
  function attachMenu() {
    const menu = $("#adj-menu"); if (!menu || menu.querySelector("[data-scan]")) return;
    [["🗂️", "Escanear documento (recorta la hoja sola)", () => scan(false)], ["🔤", "Leer texto de una hoja (sin internet)", () => scan(true)], ["🫧", "Calificar hojas de respuesta", () => X._omr && X._omr.open()]].forEach(([ic, t, fn]) => {
      const o = mk("button", "adj-op"); o.type = "button"; o.dataset.scan = "1"; o.append(mk("span", "adj-ic", ic), mk("span", "", t));
      o.addEventListener("click", () => { menu.hidden = true; fn(); }); menu.append(o);
    });
  }

  // ======================================================================== HUELLA O PIN
  let hiddenAt = 0, locked = false;
  async function lock() {
    if (!D.ajustes.bloqueo || locked || !W()) return;
    locked = true;
    let cov = $("#candado");
    if (!cov) { cov = mk("div", "candado"); cov.id = "candado"; cov.innerHTML = '<div><div class="cand-ic">🔒</div><b>Jarvis está protegido</b><p class="hint">Tus datos de estudiantes están a salvo.</p></div>'; const b = mk("button", "btn primary", "Desbloquear"); b.type = "button"; b.addEventListener("click", tryUnlock); cov.firstChild.append(b); document.body.append(cov); }
    cov.hidden = false;
    tryUnlock();
  }
  async function tryUnlock() {
    try { const r = await W().verificar({ titulo: "Abrir Jarvis" }); if (r.ok) { locked = false; $("#candado").hidden = true; } }
    catch (e) { locked = false; $("#candado").hidden = true; }
  }

  // ======================================================================== LETRA, VOZ, NO MOLESTAR
  const LETRA = { normal: 100, grande: 115, enorme: 132 };
  function applyLetra() {
    const p = LETRA[D.ajustes.letra] || 100, P = W();
    if (P) P.textZoom({ p }).catch(() => {});
    else document.documentElement.style.fontSize = p + "%";
    document.body.dataset.letra = D.ajustes.letra || "normal";
  }
  async function voices() {
    const T = native() && plug("TextToSpeech");
    if (T) { try { const r = await T.getSupportedVoices(); return ((r && r.voices) || []).map((v, i) => ({ i, name: v.name || v.voiceURI, lang: v.lang || "", local: v.localService })).filter((v) => /^es/i.test(v.lang)); } catch (e) { return []; } }
    if (window.speechSynthesis) return speechSynthesis.getVoices().map((v, i) => ({ i, name: v.name, lang: v.lang, local: v.localService, web: true })).filter((v) => /^es/i.test(v.lang));
    return [];
  }
  async function applySilencio() {
    const P = W(); if (!P) return;
    const bloques = D.ajustes.silencioClase ? L4.silenceBlocks(sched(), new Date(), 8) : [];
    try { await P.silencio({ bloques }); } catch (e) { /* nada */ }
  }

  // ======================================================================== AVISOS CON BOTONES
  function notifActions() {
    const LN = native() && plug("LocalNotifications"); if (!LN) return;
    window.JON(LN, "localNotificationActionPerformed", (ev) => {
      const id = ev && ev.notification && ev.notification.extra && ev.notification.extra.rid;
      const r = (D.recordatorios || []).find((x) => x.id === id);
      if (!r) return;
      if (ev.actionId === "posponer") { r.cuando = Date.now() + 10 * 60000; r.avisado = false; save(); N.notifyAt(r.id, "Jarvis te recuerda", r.texto, r.cuando, { acciones: true }); A.toast("Pospuesto 10 minutos: " + r.texto); }
      else if (ev.actionId === "listo") { r.avisado = true; save(); }
    });
  }

  // ======================================================================== AJUSTES
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-34")) return;
    const sec = mk("div"); sec.id = "aj-34";
    const h3 = (t) => sec.append(mk("h3", "sub", t));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked, i)); l.append(i, document.createTextNode(" " + label)); sec.append(l); return i; };
    const row = (...els) => { const r = mk("div", "row wrap"); r.append(...els); sec.append(r); return r; };
    const button = (t, fn) => { const b = mk("button", "btn", t); b.type = "button"; b.addEventListener("click", fn); return b; };
    h3("Pantalla");
    const ls = mk("select", "inp"); [["normal", "Letra normal"], ["grande", "Letra grande"], ["enorme", "Letra muy grande (para proyectar)"]].forEach(([k, t]) => ls.append(new Option(t, k)));
    ls.value = D.ajustes.letra || "normal"; ls.addEventListener("change", () => { D.ajustes.letra = ls.value; save(); applyLetra(); }); sec.append(ls);
    h3("Cómo te llama Jarvis");
    const tr = mk("select", "inp"); [["profesor", "Profesor («¿Sí, profesor?»)"], ["profesora", "Profesora"], ["señor", "Señor"], ["señora", "Señora"], ["profe", "Profe"], ["nombre", "Por mi nombre (el de «¿Cómo te llamo?»)"]].forEach(([k, t]) => tr.append(new Option(t, k)));
    tr.value = D.ajustes.trato || (D.ajustes.docente === true ? "profesor" : "señor"); tr.addEventListener("change", () => { D.ajustes.trato = tr.value; save(); V.hush(); V.say("¿Sí, " + A.trato() + "?"); }); sec.append(tr);
    h3("La voz de Jarvis");
    const vs = mk("select", "inp"); vs.append(new Option("La voz del celular (automática)", "")); sec.append(vs);
    voices().then((l) => { l.forEach((v) => vs.append(new Option(`${v.name} · ${v.lang}${v.local ? " · sin internet" : ""}`, v.web ? "w:" + v.name : String(v.i)))); vs.value = D.ajustes.vozWeb ? "w:" + D.ajustes.vozWeb : D.ajustes.vozIdx != null ? String(D.ajustes.vozIdx) : ""; });
    vs.addEventListener("change", () => { const v = vs.value; D.ajustes.vozWeb = v.startsWith("w:") ? v.slice(2) : ""; D.ajustes.vozIdx = v && !v.startsWith("w:") ? +v : null; save(); V.setOptions({ voice: D.ajustes.vozIdx == null ? -1 : D.ajustes.vozIdx, webVoice: D.ajustes.vozWeb }); V.hush(); V.say("Hola, así sueno ahora."); });
    sec.append(button("🎩 Voz y estilo de Jarvis (masculina, grave y serena)", () => vozJarvis(false)));
    sec.append(mk("p", "hint", "Escoge la voz masculina del celular más parecida, baja un poco el tono y pone la personalidad de mayordomo elegante. Si usas la voz natural con IA, cambia a una voz grave."));
    h3("Seguridad");
    chk("Pedir huella, rostro o PIN para abrir Jarvis", D.ajustes.bloqueo, async (v, i) => {
      if (v && W()) { const r = await W().verificar({ titulo: "Activar el bloqueo" }).catch(() => ({ ok: false })); if (!r.ok) { i.checked = false; return; } if (r.sinBloqueo) { A.toast("Tu celular no tiene huella ni PIN configurados.", 6000); i.checked = false; return; } }
      D.ajustes.bloqueo = v; save();
    });
    h3("En clase");
    const st = mk("p", "hint", "");
    chk("Silenciar el celular («No molestar») durante mis clases, según el horario", D.ajustes.silencioClase, async (v, i) => {
      if (v && W()) { const p = await W().silencioPermiso().catch(() => ({ permitido: false })); if (!p.permitido) { st.textContent = "Android necesita que le des permiso a Jarvis para «No molestar». Te abro esa opción: actívala y vuelve."; W().silencioPedir(); D.ajustes.silencioClase = true; save(); return; } }
      D.ajustes.silencioClase = v; save(); applySilencio(); st.textContent = v ? (sched().length ? "Listo: en tus clases el celular queda en silencio (las alarmas sí suenan)." : "Escribe tu horario arriba para que funcione.") : "";
    });
    sec.append(st);
    h3("Jarvis en el celular");
    sec.append(mk("p", "hint", "Para llamar a Jarvis manteniendo presionado el botón de inicio, escógelo como «App de asistente digital» en los Ajustes del celular. El widget lo agregas manteniendo presionada la pantalla de inicio › Widgets › Jarvis. Al mantener presionado el ícono de Jarvis salen atajos: Hablar, 5 minutos, Calificar y Pasar lista."));
    row(button("Poner a Jarvis como asistente", () => W() ? W().ajustesSistema({ accion: "android.settings.VOICE_INPUT_SETTINGS" }).catch(() => W().ajustesSistema({ accion: "android.settings.MANAGE_DEFAULT_APPS_SETTINGS" })) : A.toast("Funciona en la app instalada.")),
      button("Usar el calendario del celular", async () => { const C = native() && plug("Calendario"); if (!C) return A.toast("Funciona en la app instalada."); const p = await C.permiso().catch(() => ({ ok: false })); A.toast(p.ok ? "Listo: «¿qué tengo mañana?» y «agenda…» usan el calendario del celular." : "Sin permiso del calendario.", 5000); }));
    box.prepend(sec);
  }

  // ======================================================================== 3.16: VOZ DE JARVIS
  async function vozJarvis(silencioso) {
    const l = await voices(), v = window.JL7.vozJarvis(l);
    const a = D.ajustes;
    if (v) { if (v.web) { a.vozWeb = v.name; a.vozIdx = null; } else { a.vozIdx = v.i; a.vozWeb = ""; } }
    a.tono = v ? 0.9 : 0.8; a.velocidad = 1.05;                                      // sin voz de hombre, se baja más el tono de la que haya
    (a.estilo = a.estilo || {}).estilo = "jarvis";
    if (a.vozIA === "gemini") a.vozIAnombre = "Charon"; else if (a.vozIA === "openai") a.vozIAnombre = "onyx";
    save();
    if (A.applyVoice) A.applyVoice();
    if (silencioso) return;
    V.hush();
    A.reply(v ? `Hecho. A partir de ahora sueno así, ${A.trato()}. Espero estar a la altura.` : `Hecho, ${A.trato()}. Su celular no tiene una voz masculina en español, así que bajé el tono de la actual. Puede instalar más voces en Ajustes del teléfono › Salida de texto a voz › Google › Instalar datos de voz.`);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, hoyExtra: X.hoyExtra };
  X.intent = function (text) {
    const a = L4.asisIntent(text); if (a) return Object.assign({ m34: true }, a);
    const t = L4.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:pon(?:te)?|usa|cambia a|activa)\s+(?:la\s+)?voz (?:de|como|tipo|estilo)\s+jarvis(?: de iron ?man)?$|^(?:habla|suena)\s+como\s+(?:el\s+)?jarvis(?: de iron ?man)?$/.test(t)) return { m34: true, kind: "voz_jarvis" };
    if (/^(?:mandalo|envialo|compartelo|pasalo)\s+(?:por|a)\s+whatsapp$|^(?:por\s+)?whatsapp$/.test(t)) return { m34: true, kind: "wa_ultimo" };
    if (/^(?:escanea(?:r|me)?|escanear)\s+(?:un\s+|el\s+|este\s+)?(?:documento|hoja|pagina|papel)$/.test(t)) return { m34: true, kind: "escanear" };
    if (/^(?:lee|leeme)\s+(?:el\s+)?texto\s+de\s+(?:una|la|esta)\s+(?:hoja|pagina|foto)$/.test(t)) return { m34: true, kind: "ocr" };
    if (/^(?:letra|texto)\s+(?:mas\s+)?(grande|normal|enorme|mas grande|pequena|mas pequena)$/.test(t)) return { m34: true, kind: "letra", v: /enorme|mas grande/.test(t) ? (D.ajustes.letra === "grande" ? "enorme" : "grande") : /normal|pequena/.test(t) ? "normal" : "grande" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.m34) return base.run(it, text);
    if (/^(?:lista_abrir|faltas_)/.test(it.kind)) return attendance(it);
    if (it.kind === "wa_ultimo") { const m = (D.chat || []).filter((x) => x.role === "assistant" && !x.cls).pop(); return m ? openUrl(L4.waLink(m.content)) : A.reply("Todavía no hay una respuesta para mandar.", "err"); }
    if (it.kind === "voz_jarvis") return vozJarvis(false);
    if (it.kind === "escanear") return scan(false);
    if (it.kind === "ocr") return scan(true);
    if (it.kind === "letra") { D.ajustes.letra = it.v; save(); applyLetra(); return A.reply(`Listo: letra ${it.v === "enorme" ? "muy grande" : it.v}.`); }
  };
  X.afterAnswer = afterAnswer;
  const baseOnState = X.onState;
  X.onState = function (s) { if (baseOnState) baseOnState(s); if (s === "idle") setTimeout(headStatus, 0); };
  X.ahora = ahora;
  X.onTimer = function (end, secs) {
    const P = W(); if (!P) return;
    if (end) P.temporizador({ fin: end, texto: L.spokenDuration ? L.spokenDuration(secs) : "Temporizador" }).catch(() => {});
    else P.quitarTemporizador().catch(() => {});
  };
  X.hoyExtra = function () {
    const items = base.hoyExtra ? base.hoyExtra() : [];
    const m = D ? L4.ahoraState(sched(), new Date()).modo : "sin_horario";
    return m === "clase" || m === "antes" ? items.filter((x) => !/^(?:●|⏭)/.test(x.txt)) : items;   // la tarjeta «Ahora» ya lo dice
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    D.asistencia = D.asistencia || [];
    try { base.init(api); } catch (e) { console.error("init", e); }
    try { applyLetra(); attachMenu(); notifActions(); applySilencio(); widget(); } catch (e) { console.error(e); }
    const P = W();
    if (P) window.JON(P, "entrada", () => entradas());
    setTimeout(entradas, 400);
    if (D.ajustes.bloqueo) lock();
    if (!D.ajustes.vozJarvis316) { D.ajustes.vozJarvis316 = 1; save(); if (native()) setTimeout(() => vozJarvis(true).catch(() => {}), 1200); }   // 3.16: una vez, la voz de Jarvis
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      entradas(); widget(); applySilencio();
      if (D.ajustes.bloqueo && hiddenAt && Date.now() - hiddenAt > 90000) lock();
    });
    window.JEVERY(20000, () => { headStatus(); widget(); });
    setTimeout(headStatus, 800);
    // botón «Pasar lista» en la pestaña Clase
    const k = $("#k-azar");
    if (k && !$("#btn-lista")) { const b = mk("button", "btn", "📋 Pasar lista"); b.type = "button"; b.id = "btn-lista"; b.addEventListener("click", () => openAttendance(null)); const r = mk("div", "row lista-row"); r.append(b); k.before(r); }
  };
  X._mas = { entrada, entradas, afterAnswer, ahora, openAttendance, attendance, scan };
})();
