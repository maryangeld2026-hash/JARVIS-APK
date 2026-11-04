/* Jarvis para Android 3.6 · el celular por voz y lo que faltaba:
   · llamar, SMS y WhatsApp a tus contactos (siempre pregunta antes), abrir y cerrar apps, linterna, volumen, alarmas,
     ir al inicio, atrás, notificaciones, bloquear, captura, mapas y YouTube;
   · dictado con puntuación por voz y notas de voz que se guardan donde van;
   · interrumpir a Jarvis hablándole, modo bolsillo y el resumen de la mañana;
   · práctica con QR en el wifi del salón, banco de preguntas y versiones A–D;
   · informe del periodo por estudiante, copia semanal en el celular y recordatorios por lugar.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL, L2 = window.JL2, L3 = window.JL3, L4 = window.JL4, L5 = window.JL5, V = window.JV, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const native = () => V.native();
  const plug = (n) => (native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const T = () => plug("Telefono");
  const R = (t, cls, sp) => A.reply(t, cls, sp);
  const soloApp = () => R("Eso funciona en la app instalada (el APK).", "err");
  const fmt = (x) => String(x).replace(".", ",");

  // ======================================================================== CONFIRMAR ANTES DE LLAMAR O ENVIAR
  let pend = null;
  function ask(text, fn) {
    pend = { fn, t: Date.now() };
    const { e } = A.add("assistant", text, "tool"); e.innerHTML = A.md(text);
    const box = mk("div", "doc-acts");
    const b = (t, yes) => { const x = mk("button", "chip" + (yes ? " on" : ""), t); x.type = "button"; x.addEventListener("click", () => { box.remove(); answer(yes); }); box.append(x); };
    b("Sí", true); b("No", false); e.append(box);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    A.say(text.replace(/\*\*/g, ""));
  }
  async function answer(yes) {
    const p = pend; pend = null;
    if (!p) return;
    if (!yes) return R("Listo, no lo hago.");
    try { await p.fn(); } catch (e) { R(e.message || String(e), "err"); }
  }

  // ======================================================================== CONTACTOS Y APPS
  let contactos = null, apps = null;
  async function contact(q) {
    const P = T(); if (!P) throw new Error("Llamar y enviar mensajes funciona en la app instalada (el APK).");
    if (!contactos) contactos = ((await P.contactos({ q: "" })) || {}).lista || [];
    const c = L5.bestMatch(q, contactos) || L5.bestMatch(q.replace(/^(?:la|el|mi|a)\s+/i, ""), contactos);
    if (!c) throw new Error(`No encontré a «${q}» en tus contactos.`);
    return c;
  }
  async function app(q) {
    const P = T(); if (!P) throw new Error("Abrir apps funciona en la app instalada (el APK).");
    if (!apps) apps = ((await P.apps()) || {}).lista || [];
    const a = L5.appMatch(q, apps);
    if (!a) throw new Error(`No encontré la app «${q}» en tu celular.`);
    return a;
  }
  async function phone(it) {
    const P = T();
    switch (it.kind) {
      case "llamar": {
        const c = await contact(it.quien);
        return ask(`¿Llamo a **${c.nombre}** (${c.numero})?`, async () => { await P.llamar({ numero: c.numero }); R(`Llamando a ${c.nombre}.`); });
      }
      case "wa": {
        const c = await contact(it.quien), n = L5.waNumber(c.numero);
        return ask(`¿Le mando por WhatsApp a **${c.nombre}**: «${it.texto}»?`, async () => {
          await plug("Ventana").abrir({ url: `https://wa.me/${n}?text=${encodeURIComponent(it.texto)}` });
          R(`Te dejé el mensaje listo en WhatsApp para ${c.nombre}: solo toca enviar.`, "tool", "Listo, toca enviar en WhatsApp.");
        });
      }
      case "sms": {
        const c = await contact(it.quien);
        return ask(`¿Le envío un mensaje de texto a **${c.nombre}**: «${it.texto}»?`, async () => { const r = await P.sms({ numero: c.numero, texto: it.texto }); R(r.enviado ? `Mensaje enviado a ${c.nombre}.` : `Te dejé el mensaje listo para ${c.nombre}: toca enviar.`); });
      }
      case "abrir_app": { const a = await app(it.app); await P.abrirApp({ paquete: a.paquete }); return R(`Abriendo ${a.nombre}.`); }
      case "cerrar_app": {
        const a = await app(it.app); await P.cerrarApp({ paquete: a.paquete });
        return R(`Cerré ${a.nombre} si estaba en segundo plano. Android no deja que una app cierre a otra que tienes en pantalla; para salir de ella di «ve al inicio».`);
      }
      case "linterna": await P.linterna({ on: it.on }); return R(it.on ? "Linterna encendida." : "Linterna apagada.");
      case "volumen": { const r = await P.volumen({ accion: it.accion }); return R(it.accion === "silencio" ? "Celular en silencio." : `Volumen ${Math.round((r.nivel / Math.max(1, r.max)) * 100)} %.`); }
      case "alarma": await P.alarma({ hora: it.hora, minuto: it.minuto, texto: it.texto }); return R(`Listo, alarma a las ${it.hora}:${String(it.minuto).padStart(2, "0")}.`);
      case "global": {
        const r = await P.global({ accion: it.accion });
        if (r.necesitaPermiso) return askControl();
        return r.ok === false ? R("Este celular no permite eso.", "err") : null;
      }
      case "mapa": return plug("Ventana").abrir({ url: "geo:0,0?q=" + encodeURIComponent(it.lugar) }).then(() => R(`Abrí el mapa para llegar a ${it.lugar}.`));
      case "youtube": return plug("Ventana").abrir({ url: "https://www.youtube.com/results?search_query=" + encodeURIComponent(it.q) }).then(() => R(`Busqué «${it.q}» en YouTube.`));
    }
  }
  function askControl() {
    const { e } = A.add("assistant", "Para eso necesito el control por voz. Actívalo una vez en *Ajustes del celular › Accesibilidad › Jarvis: control por voz*. Solo hace los botones del sistema; no lee la pantalla ni lo que escribes.", "tool");
    e.innerHTML = A.md(e.textContent);
    const b = mk("button", "chip on", "Abrir Accesibilidad"); b.type = "button"; b.addEventListener("click", () => T().abrirAccesibilidad()); const box = mk("div", "doc-acts"); box.append(b); e.append(box);
    A.say("Para eso necesito que actives mi control por voz en Accesibilidad.");
  }

  // ======================================================================== DICTADO
  let dict = null;
  function openDictation() {
    let sh = $("#dict-sh");
    if (!sh) { sh = mk("div", "sheet"); sh.id = "dict-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full");
    const hd = mk("div", "sheet-h"); hd.append(mk("h2", "", "Dictado"));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => stopDict(true)); hd.append(x);
    const sc = mk("div", "scroll");
    const st = mk("p", "hint dict-st", "Habla. Di «coma», «punto», «nueva línea» o «abre interrogación». Para terminar, «fin del dictado».");
    const ta = mk("textarea", "inp dict-ta"); ta.rows = 14; ta.placeholder = "Aquí va quedando lo que dictas. Puedes corregirlo con el teclado.";
    const live = mk("p", "dict-live");
    const row = mk("div", "row wrap");
    const btn = (t, fn, cls = "") => { const b = mk("button", "btn " + cls, t); b.type = "button"; b.addEventListener("click", fn); row.append(b); return b; };
    const pb = btn("⏸ Pausa", () => { dict.pausa = !dict.pausa; pb.textContent = dict.pausa ? "▶ Seguir" : "⏸ Pausa"; if (dict.pausa) V.cancelListening && V.cancelListening(); else loop(); });
    btn("📋 Copiar", () => (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => A.toast("Copiado.")).catch(() => {}));
    btn("💬 WhatsApp", () => plug("Ventana") ? plug("Ventana").abrir({ url: L4.waLink(ta.value) }) : window.open(L4.waLink(ta.value)));
    btn("📄 Word", () => X._h && X._h.docWord({ titulo: titleOf(ta.value), md: ta.value }));
    btn("💾 Guardar en Material", () => { saveDict(ta.value); A.toast("Guardado en Material."); }, "primary");
    sc.append(st, ta, live, row); inn.append(hd, sc); sh.append(inn);
    dict = { ta, live, st, pausa: false, partes: [] };
    loop();
  }
  const titleOf = (t) => (String(t).split("\n").find((l) => l.trim()) || "Dictado").slice(0, 60);
  function saveDict(t) { if (!t.trim()) return; D.docs = D.docs || []; D.docs.unshift({ id: window.JD.uid(), titulo: "Dictado: " + titleOf(t), md: t, fecha: Date.now(), tipo: "dictado" }); save(); }
  async function loop() {
    while (dict && !dict.pausa && !$("#dict-sh").hidden) {
      dict.live.textContent = "🎙️ Escuchando…";
      let t = "";
      try { t = await V.listen((p) => { dict.live.textContent = "🎙️ " + p; }, { espera: 20000, silencio: 2500 }); }
      catch (e) { dict.live.textContent = e.message || String(e); return; }
      if (!dict || dict.pausa) return;
      if (!t) continue;
      if (L5.dictStop(t)) return stopDict(false);
      if (L5.dictUndo(t)) { const p = dict.partes.pop(); if (p != null) dict.ta.value = dict.ta.value.slice(0, Math.max(0, dict.ta.value.length - p.length)); continue; }
      let piece = L5.dictPunct(t);
      const prev = dict.ta.value;
      const sep = !prev || /\n$/.test(prev) || /^\n/.test(piece) ? "" : " ";
      if (prev && !/[.!?…]\s*$/.test(prev) && !/\n$/.test(prev)) piece = piece.charAt(0).toLowerCase() + piece.slice(1);
      dict.partes.push(sep + piece);
      dict.ta.value = prev + sep + piece;
      dict.ta.scrollTop = dict.ta.scrollHeight;
    }
  }
  function stopDict(closeOnly) {
    const sh = $("#dict-sh"); if (!sh) return;
    const t = dict ? dict.ta.value.trim() : "";
    if (dict) dict.pausa = true;
    V.cancelListening && V.cancelListening();
    sh.hidden = true; dict = null;
    if (t && !closeOnly) { saveDict(t); R(`Terminé el dictado (${t.split(/\s+/).length} palabras) y lo guardé en Material.`); }
    else if (t) { saveDict(t); A.toast("Guardé el dictado en Material."); }
  }

  // ======================================================================== NOTAS DE VOZ
  async function voiceNote(texto) {
    if (!texto) {
      R("Te escucho: dime la nota.", "tool");
      await V.idle();
      try { texto = await V.listen((p) => ($("#live").textContent = p), { espera: 15000, silencio: 2200 }); } catch (e) { return R(e.message, "err"); }
      $("#live").textContent = "";
      if (!texto) return R("No te oí. Dime «nota de voz» y luego la nota.");
    }
    const nombres = []; D.cursos.forEach((c) => c.estudiantes.forEach((n) => nombres.push(n)));
    const r = L5.noteRoute(texto, nombres), t = Date.now();
    if (r.destino === "observador") {
      const c = D.cursos.find((x) => x.estudiantes.includes(r.quien));
      D.observador = D.observador || {}; (D.observador[r.quien] = D.observador[r.quien] || []).push({ t, texto, curso: c ? c.nombre : "" }); save();
      return R(`Guardado en el observador de ${r.quien}: «${texto}».`);
    }
    if (r.destino === "diario") { D.diario = D.diario || []; D.diario.push({ t, curso: r.curso, texto: texto.replace(/^(?:hoy\s+)?(?:en|con)\s+\S+\s+/i, "") }); save(); return R(`Guardado en el diario de ${r.curso}.`); }
    if (r.destino === "compromiso") { D.compromisos = D.compromisos || []; D.compromisos.push({ id: window.JD.uid(), t, texto, hecho: false }); save(); return R(`Anotado en tus compromisos: «${texto}».`); }
    D.docs = D.docs || []; D.docs.unshift({ id: window.JD.uid(), titulo: "Nota: " + texto.slice(0, 50), md: texto, fecha: t, tipo: "nota" }); save();
    return R(`Nota guardada en Material: «${texto}».`);
  }

  // ======================================================================== INTERRUMPIR, BOLSILLO, RUTINA
  // palabras poco comunes en las respuestas, para que Jarvis no se interrumpa con su propia voz
  const PALABRAS = ["jarvis", "yarvis", "basta", "silencio", "callate", "cállate"];
  let vigilando = false;
  function vigilar(on) {
    const O = plug("Oido"); if (!O || !O.vigilar) return;
    if (on && !vigilando && D.ajustes.interrumpir && !D.ajustes.ahorroActivo) { vigilando = true; O.vigilar({ palabras: PALABRAS }).then((r) => { if (!r || !r.ok) vigilando = false; }).catch(() => { vigilando = false; }); }
    else if (!on && vigilando) { vigilando = false; O.dejarDeVigilar().catch(() => {}); }
  }
  function onInterrupt(d) {
    vigilando = false;
    V.hush(); if (window.JIA) window.JIA.stop();
    const w = (d && d.palabra) || "";
    if (/^(?:jarvis|yarvis)$/.test(w)) setTimeout(() => A.wake ? A.wake() : A.listen(false), 200);
    else A.toast("Me callo.");
  }
  function bolsillo(on) {
    D.ajustes.bolsillo = on;
    if (on) { D.ajustes.seguir = true; D.ajustes.voz = true; D.ajustes.interrumpir = true; }
    save();
    const fc = $("#fondo-chk");
    if (on && !D.ajustes.fondo && fc) { fc.checked = true; fc.dispatchEvent(new Event("change")); }
    R(on ? "Modo bolsillo activado: te digo todo en voz alta, sigo escuchando después de cada respuesta y puedes interrumpirme diciendo «basta», «silencio» o «Jarvis». Guárdame en el bolsillo." : "Modo bolsillo apagado.");
  }
  async function summary() {
    const now = new Date(), s = L3.parseSchedule(D.ajustes.horario || ""), c = L3.classNow(s, now);
    const p = [];
    const h = now.getHours();
    p.push(`${h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"}, ${A.trato ? A.trato() : "profe"}. Hoy es ${now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}.`);
    const doc = D.ajustes.docente !== false;
    if (window.JX && window.JX.climaHoy) { try { const cl = await Promise.race([window.JX.climaHoy(), new Promise((r) => setTimeout(() => r(""), 4000))]); if (cl) p.push(cl); } catch (e) { /* sin clima */ } }
    if (!doc) { /* sin clases */ } else if (c.hoy.length) p.push(`Tienes ${c.hoy.length} clase${c.hoy.length > 1 ? "s" : ""}: ${c.hoy.map((x) => `${x.que} a las ${L3.hhmm(x.ini)}`).join(", ")}.`);
    else if (s.length) p.push("Hoy no tienes clases en tu horario.");
    const C = plug("Calendario");
    if (C && !(D.ajustes.google || {}).cuenta) {
      try {
        const ini = new Date(now); ini.setHours(0, 0, 0, 0); const fin = new Date(ini); fin.setDate(fin.getDate() + 1);
        const r = await C.eventos({ desde: ini.getTime(), hasta: fin.getTime() });
        const ev = (r.lista || []).filter((e) => !e.todoElDia);
        if (ev.length) p.push(`En tu calendario: ${ev.slice(0, 4).map((e) => `${e.titulo} a las ${new Date(e.inicio).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`).join("; ")}.`);
      } catch (e) { /* sin permiso: se omite */ }
    }
    const fin = new Date(now); fin.setHours(23, 59, 59, 999);
    const rec = (D.recordatorios || []).filter((r) => !r.avisado && r.cuando > now.getTime() && r.cuando <= fin.getTime());
    if (rec.length) p.push(`Recordatorios de hoy: ${rec.map((r) => r.texto).slice(0, 4).join("; ")}.`);
    const comp = (D.compromisos || []).filter((x) => !x.hecho);
    if (comp.length) p.push(`Tienes ${comp.length} compromiso${comp.length > 1 ? "s" : ""} pendiente${comp.length > 1 ? "s" : ""}${comp.length <= 3 ? ": " + comp.map((x) => x.texto).join("; ") : ""}.`);
    let riesgo = 0;
    if (doc) D.cursos.forEach((cu) => { if (cu.notas && cu.notas.actividades && cu.notas.actividades.length) { try { riesgo += L2.courseStats(cu, D.ajustes.escala).riesgo.length; } catch (e) { /* nada */ } } });
    if (riesgo) p.push(`${riesgo} estudiante${riesgo > 1 ? "s van" : " va"} en riesgo.`);
    if (doc && D.ajustes.periodoFin) { const d = Math.ceil((D.ajustes.periodoFin - Date.now()) / 864e5); if (d > 0 && d <= 21) p.push(`Faltan ${d} días para cerrar el periodo.`); }
    return p.join(" ");
  }
  async function routineNow() { const t = await summary(); R("☀️ " + t, "tool", t); }
  async function scheduleRoutine() {
    const LN = plug("LocalNotifications"); if (!LN) return;
    try { await LN.cancel({ notifications: [{ id: 777001 }] }); } catch (e) { /* no estaba */ }
    if (!D.ajustes.rutina) return;
    const [hh, mm] = String(D.ajustes.rutinaHora || "06:00").split(":").map(Number);
    const at = new Date(); at.setHours(hh || 6, mm || 0, 0, 0);
    if (at <= new Date()) at.setDate(at.getDate() + 1);
    const body = (await summary()).replace(/^[^.]+\.\s*/, "").slice(0, 300) || "Toca para oír tu día.";
    try { await LN.schedule({ notifications: [{ id: 777001, title: "☀️ Tu día, con Jarvis", body, schedule: { at, allowWhileIdle: true }, extra: { rutina: true } }] }); } catch (e) { /* sin permiso */ }
  }

  // ======================================================================== BANCO DE PREGUNTAS Y VERSIONES
  async function bankQuiz(it) {
    const b = L5.bank(D.quices);
    if (!b.length) return R("El banco está vacío: se llena solo con las preguntas de los quices que vayas haciendo.", "err");
    const ps = L5.bankPick(b, it.tema, it.n);
    if (!ps.length) return R(`No hay preguntas de «${it.tema}» en el banco. Temas: ${L5.bankTopics(b).slice(0, 6).map((x) => `${x.tema} (${x.n})`).join(", ")}.`, "err");
    const q = { id: window.JD.uid(), fecha: Date.now(), tema: it.tema || "banco", grado: "", tipo: "banco", curso: "", quiz: { titulo: `Quiz del banco${it.tema ? ": " + it.tema : ""}`, preguntas: ps } };
    D.quices.unshift(q); save(); A.setQuiz(q);
    R(`Armé un quiz de ${ps.length} preguntas del banco${it.tema ? " de " + it.tema : ""}, sin gastar IA. Está en la pestaña Quices.`);
    if (A.renderQuices) A.renderQuices();
  }
  function bankView() {
    const b = L5.bank(D.quices), t = L5.bankTopics(b);
    R(b.length ? `**Banco de preguntas: ${b.length}**\n` + t.map((x) => `- ${x.tema}: ${x.n}`).join("\n") + "\n\nDime «ármame un quiz de 10 preguntas del banco de fracciones»." : "El banco está vacío todavía: se llena solo con tus quices.", "tool", b.length ? `Tienes ${b.length} preguntas en el banco, de ${t.length} temas.` : null);
  }
  async function makeVersions(it, n = 4, cursoHint) {
    const vs = L5.versions(it.quiz, n);
    const saved = vs.map((qz, k) => {
      if (k === 0) return it;
      const q = { id: window.JD.uid() + k, fecha: Date.now(), tema: it.tema, grado: it.grado, tipo: it.tipo, curso: it.curso, version: qz.version, base: it.id, quiz: qz };
      return q;
    });
    // que cada versión tenga un código distinto en las hojas de burbujas
    const used = new Set([L4.quizHash(it.id)]);
    saved.slice(1).forEach((q) => { let tries = 0; while (used.has(L4.quizHash(q.id)) && tries++ < 50) q.id = window.JD.uid() + tries; used.add(L4.quizHash(q.id)); });
    D.quices = saved.slice(1).concat(D.quices); save();
    // un PDF con las versiones (con su clave al final de cada una)
    try {
      const parts = [];
      for (const q of saved) parts.push(await window.JPDF.quizPDF(q.quiz, { curso: q.curso, clave: true, version: q.quiz.version || "A" }));
      for (let k = 0; k < parts.length; k++) await N.share({ title: saved[k].quiz.titulo, fileName: `${slug(it.quiz.titulo)}-version-${"ABCD"[k]}.pdf`, mime: "application/pdf", base64: parts[k] });
    } catch (e) { if (e && e.name !== "AbortError") A.toast("No pude hacer los PDF: " + (e.message || e), 6000); }
    R(`Listas las ${n} versiones de «${it.quiz.titulo}» (A, B, C${n > 3 ? " y D" : ""}): las mismas preguntas en otro orden y con las opciones mezcladas. Cada versión quedó como un quiz en Quices, con su propia hoja de burbujas y su clave.`);
    if (A.renderQuices) A.renderQuices();
  }
  const slug = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "quiz";

  // ======================================================================== PRÁCTICA CON QR (wifi del salón)
  let practica = null;
  function loadQR() { return window.qrcode ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/qrcode.js"; s.onload = ok; s.onerror = () => no(new Error("No pude cargar el QR.")); document.head.append(s); }); }
  async function startPractice(it) {
    const Au = plug("Aula"), P = T();
    if (!Au || !P) return soloApp();
    const ip = ((await P.ip()) || {}).ip;
    if (!ip) return R("No encuentro el wifi. Conéctate al wifi del salón o activa el punto de acceso del celular, y que los estudiantes se conecten a la misma red.", "err");
    const r = await Au.iniciar({ pagina: L5.practicePage(it.quiz, L.plainMath || ((x) => x)), clave: it.quiz.preguntas.map((p) => p.correcta) });
    const url = `http://${ip}:${r.puerto}/`;
    await loadQR();
    const qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
    practica = { it, url, res: [] };
    let sh = $("#prac-sh");
    if (!sh) { sh = mk("div", "sheet"); sh.id = "prac-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full prac");
    const hd = mk("div", "sheet-h"); hd.append(mk("h2", "", "Práctica: " + it.quiz.titulo));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => stopPractice()); hd.append(x);
    const sc = mk("div", "scroll");
    const q = mk("div", "prac-qr"); q.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
    sc.append(q, mk("p", "prac-url", url), mk("p", "hint", "Que los estudiantes se conecten al mismo wifi (o a tu punto de acceso), escaneen el código con la cámara y respondan. Se califica en tu celular; la clave no sale de aquí."));
    const cnt = mk("p", "prac-cnt", "0 respuestas"); cnt.id = "prac-cnt";
    const ul = mk("ul", "lista omr-list"); ul.id = "prac-list";
    const row = mk("div", "row wrap");
    const b = (t, fn, cls = "") => { const y = mk("button", "btn " + cls, t); y.type = "button"; y.addEventListener("click", fn); row.append(y); };
    b("📽 Proyectar el QR", () => sh.classList.toggle("grande"));
    b("✅ Terminar y ver resultados", () => stopPractice(), "primary");
    sc.append(cnt, ul, row); inn.append(hd, sc); sh.append(inn);
    R(`Práctica abierta en ${url}. Muestra el QR a tus estudiantes.`, "tool", "Práctica abierta. Muestra el código QR a tus estudiantes.");
  }
  function onAnswer(d) {
    if (!practica || !d) return;
    const nota = Math.round((1 + 4 * (d.aciertos / Math.max(1, d.total))) * 10) / 10;
    const prev = practica.res.findIndex((x) => L4.norm(x.nombre) === L4.norm(d.nombre));
    const item = { nombre: d.nombre, resp: d.resp, aciertos: d.aciertos, total: d.total, nota };
    if (prev >= 0) practica.res[prev] = item; else practica.res.push(item);
    const ul = $("#prac-list"); if (!ul) return;
    ul.textContent = "";
    practica.res.slice().sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((r) => { const li = mk("li"); li.append(mk("span", "grow", r.nombre), mk("small", "", `${r.aciertos}/${r.total}`), mk("b", r.nota < (D.ajustes.escala.basico || 3) ? "bajo" : "", fmt(r.nota))); ul.append(li); });
    $("#prac-cnt").textContent = `${practica.res.length} respuesta${practica.res.length === 1 ? "" : "s"}`;
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) { /* nada */ } }
  }
  async function stopPractice() {
    const sh = $("#prac-sh"); if (sh) sh.hidden = true;
    const Au = plug("Aula"); if (Au) Au.detener().catch(() => {});
    if (!practica) return;
    const p = practica; practica = null;
    if (!p.res.length) return R("Cerré la práctica. Nadie alcanzó a responder.");
    D.practicas = D.practicas || []; D.practicas.unshift({ t: Date.now(), quizId: p.it.id, titulo: p.it.quiz.titulo, res: p.res }); D.practicas = D.practicas.slice(0, 50); save();
    const clave = p.it.quiz.preguntas.map((q) => q.correcta), res = {};
    p.res.forEach((r) => { res[r.nombre] = r; });
    const a = L4.sheetAnalysis(res, clave, D.ajustes.escala.basico || 3);
    const md = `### Resultados de la práctica: ${p.it.quiz.titulo}\n\n- ${a.n} respuestas · promedio **${fmt(a.prom)}**\n- Bajo ${fmt(D.ajustes.escala.basico || 3)}: ${a.bajos.length ? a.bajos.join(", ") : "nadie"}\n- La más difícil: pregunta ${a.dificiles[0].n} (${a.dificiles[0].pct} % bien${a.dificiles[0].errada ? `, la errada más marcada fue la ${a.dificiles[0].errada.op}` : ""})\n\n` + p.res.map((r) => `- ${r.nombre}: ${fmt(r.nota)} (${r.aciertos}/${r.total})`).join("\n");
    const { e } = A.add("assistant", md, "tool"); e.innerHTML = A.md(md);
    // pasar al seguimiento, si los nombres coinciden con un curso
    const c = A.courseFor(null);
    if (c) {
      const box = mk("div", "doc-acts"), btn = mk("button", "chip", `Pasar al seguimiento de ${c.nombre}`); btn.type = "button";
      btn.addEventListener("click", () => {
        c.notas = c.notas || { actividades: [], valores: {} };
        const act = { id: "a" + window.JD.uid(), nombre: ("Práctica: " + p.it.quiz.titulo).slice(0, 40), peso: 1 }; c.notas.actividades.push(act);
        let k = 0, no = [];
        p.res.forEach((r) => { const f = L5.bestMatch(r.nombre, c.estudiantes.map((n) => ({ nombre: n }))); if (f) { (c.notas.valores[f.nombre] = c.notas.valores[f.nombre] || {})[act.id] = r.nota; k++; } else no.push(r.nombre); });
        save(); btn.disabled = true;
        R(`Pasé ${k} notas a ${c.nombre}.` + (no.length ? ` No reconocí: ${no.join(", ")}.` : ""));
      });
      box.append(btn); e.append(box);
    }
    A.say(`Terminó la práctica: ${a.n} respuestas, promedio ${fmt(a.prom)}.`);
  }

  // ======================================================================== INFORME DEL PERIODO
  async function periodReport(quien, cursoQ) {
    let list = [];
    if (quien) {
      const all = []; D.cursos.forEach((c) => c.estudiantes.forEach((n) => all.push({ nombre: n, c })));
      const f = L5.bestMatch(quien, all);
      if (!f) return R(`No encontré a «${quien}».`, "err");
      list = [{ n: f.nombre, c: f.c }];
    } else {
      const c = (cursoQ && L.findCourse(D.cursos, L4.norm(cursoQ))) || A.courseFor(null);
      if (!c) return R("¿De qué curso? Dime «informes del periodo de 7A».", "err");
      list = c.estudiantes.map((n) => ({ n, c }));
    }
    await window.JPDF.libs();
    const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: "letter" });
    doc.addFileToVFS("dv.ttf", window.JARVIS_FUENTE.regular); doc.addFont("dv.ttf", "DV", "normal");
    doc.addFileToVFS("dvb.ttf", window.JARVIS_FUENTE.bold); doc.addFont("dvb.ttf", "DV", "bold");
    list.forEach(({ n, c }, k) => {
      if (k) doc.addPage();
      let y = 22;
      const line = (t, size = 11, bold = false, color = 0) => { doc.setFont("DV", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(color); doc.splitTextToSize(String(t), 175).forEach((l) => { if (y > 262) { doc.addPage(); y = 22; } doc.text(l, 20, y); y += size * 0.5; }); y += 1.5; };
      line("Informe del periodo", 17, true); line(`${n} · ${c.nombre} · ${new Date().toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}`, 11, false, 80); y += 3;
      const notas = c.notas || { actividades: [], valores: {} }, v = (notas.valores || {})[n] || {};
      const prom = L2.average ? L2.average(notas, n) : null, perf = prom != null ? L.performance(prom, D.ajustes.escala) : "";
      line("Notas", 13, true);
      if (notas.actividades.length) {
        notas.actividades.forEach((a) => line(`• ${a.nombre}: ${typeof v[a.id] === "number" ? fmt(v[a.id]) : "sin nota"}`));
        line(`Promedio: ${prom != null ? fmt(Math.round(prom * 10) / 10) : "—"}${perf ? " · desempeño " + perf : ""}`, 12, true);
        try { const nd = L3.neededToPass(notas, n, D.ajustes.escala.basico || 3); if (nd && !nd.ya && nd.necesita != null) line(nd.posible ? `Para llegar a básico necesita ${fmt(nd.necesita)} en la próxima actividad.` : "Con las actividades que faltan no alcanzaría el básico: necesita un plan de recuperación."); } catch (e) { /* nada */ }
      } else line("Todavía no hay notas en el seguimiento.", 11, false, 100);
      y += 2; line("Asistencia", 13, true);
      const a = L4.countAbsences(D.asistencia || [], c.nombre)[n];
      line(a ? `${a.faltas} falla${a.faltas === 1 ? "" : "s"} y ${a.tardes} llegada${a.tardes === 1 ? "" : "s"} tarde.` : "Sin fallas anotadas.");
      const obs = ((D.observador || {})[n] || []);
      y += 2; line("Observador", 13, true);
      if (obs.length) obs.slice(-8).forEach((o) => line(`• ${new Date(o.t).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}: ${o.texto}`)); else line("Sin anotaciones.", 11, false, 100);
      y += 4; line("Observaciones de la docente", 13, true);
      doc.setDrawColor(170); for (let i = 0; i < 5; i++) { if (y > 262) break; doc.line(20, y + 4, 195, y + 4); y += 9; }
      doc.setFontSize(8); doc.setTextColor(150); doc.text("Hecho con Jarvis, en el celular de la docente.", 20, 272);
    });
    const b64 = doc.output("datauristring").split(",")[1];
    await N.share({ title: "Informe del periodo", fileName: `informe-periodo-${slug(list.length === 1 ? list[0].n : list[0].c.nombre)}.pdf`, mime: "application/pdf", base64: b64 }).catch(() => {});
    R(list.length === 1 ? `Listo el informe del periodo de ${list[0].n}.` : `Listos los informes del periodo de ${list[0].c.nombre}: ${list.length} estudiantes, uno por página.`);
  }
  function reportIntent(text) {
    const t = L4.norm(text).replace(/^jarvis\s+/, ""); let m;
    if ((m = t.match(/^(?:haz(?:me)?|saca(?:me)?|genera(?:me)?|prepara(?:me)?)?\s*(?:el\s+|los\s+)?informes?\s+del\s+periodo\s+(?:de|del|para)\s+(.+)$/))) {
      const q = m[1].replace(/^(?:curso|grado)\s+/, "").trim();
      return /^\d{1,2}\s*[a-z]?\d?$/.test(q) ? { c36: true, kind: "informe", curso: q } : { c36: true, kind: "informe", quien: q };
    }
    return null;
  }

  // ======================================================================== COPIA SEMANAL EN EL CELULAR
  async function weeklyCopy(force) {
    const F = plug("Filesystem"); if (!F) return force ? soloApp() : null;
    if (!force && Date.now() - (D.ajustes.copiaLocal || 0) < 7 * 864e5) return;
    const json = JSON.stringify(window.JD.backup(), null, 1), name = `Jarvis/copia-jarvis-${L4.dayKey()}.json`;
    for (const dir of ["DOCUMENTS", "EXTERNAL"]) {
      try {
        await F.writeFile({ path: name, data: json, directory: dir, encoding: "utf8", recursive: true });
        D.ajustes.copiaLocal = Date.now(); D.ajustes.copiaDonde = dir === "DOCUMENTS" ? "Documentos › Jarvis" : "la carpeta de Jarvis"; save();
        if (force) R(`Copia guardada en ${D.ajustes.copiaDonde} (sin tus claves). Cada semana hago una sola.`);
        return;
      } catch (e) { /* se prueba la siguiente carpeta */ }
    }
    if (force) R("No pude guardar la copia en el celular. Usa «Guardar copia» en Ajustes para mandarla a Drive o al correo.", "err");
  }

  // ======================================================================== RECORDATORIOS POR LUGAR
  async function places(it) {
    const P = plug("Lugares"); if (!P) return soloApp();
    D.lugares = D.lugares || {};
    if (it.kind === "lugar_guardar") {
      const r = await P.aqui();
      D.lugares[L4.norm(it.lugar)] = { nombre: it.lugar, lat: r.lat, lng: r.lng }; save();
      return R(`Guardé este lugar como «${it.lugar}». Ahora dime, por ejemplo: «cuando llegue al ${it.lugar}, recuérdame…».`);
    }
    if (it.kind === "lugar_ver") {
      const ls = Object.values(D.lugares), rs = (D.recLugar || []);
      return R(`**Lugares:** ${ls.length ? ls.map((x) => x.nombre).join(", ") : "ninguno"}.\n` + (rs.length ? "**Recordatorios:**\n" + rs.map((r) => `- ${r.salir ? "Al salir de" : "Al llegar a"} ${r.lugar}: ${r.texto}`).join("\n") : "Sin recordatorios por lugar."));
    }
    const pl = D.lugares[it.lugar];
    if (!pl) return R(`No tengo guardado «${it.lugar}». Cuando estés allá, dime «guarda este lugar como ${it.lugar}».`, "err");
    const fondo = await P.fondoActivo();
    const id = "lugar-" + window.JD.uid();
    await P.programar({ id, lat: pl.lat, lng: pl.lng, radio: 150, texto: it.texto, salir: it.salir });
    D.recLugar = (D.recLugar || []).concat([{ id, lugar: pl.nombre, texto: it.texto, salir: it.salir }]); save();
    R(`Listo: ${it.salir ? "al salir de" : "cuando llegues a"} ${pl.nombre} te recuerdo «${it.texto}».` + (fondo.activo ? "" : " Para que funcione con Jarvis cerrado, en el permiso de ubicación escoge «Permitir todo el tiempo» (te abro esa pantalla)."));
    if (!fondo.activo) P.permisoFondo();
  }

  // ======================================================================== AJUSTES
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-36")) return;
    const sec = mk("div"); sec.id = "aj-36";
    const h3 = (t) => sec.append(mk("h3", "sub", t));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked, i)); l.append(i, document.createTextNode(" " + label)); sec.append(l); return i; };
    const button = (t, fn) => { const b = mk("button", "btn", t); b.type = "button"; b.addEventListener("click", fn); return b; };
    h3("Controlar el celular por voz");
    sec.append(mk("p", "hint", "«Llama a…», «mándale un WhatsApp a… diciendo…», «abre YouTube», «prende la linterna», «sube el volumen», «pon una alarma a las 6», «ve al inicio», «atrás», «toma una captura», «¿cómo llego a…?». Antes de llamar o enviar algo, Jarvis te pregunta. Para los botones del sistema (atrás, notificaciones, bloquear, captura), activa el control en Accesibilidad."));
    const st = mk("span", "hint");
    const r1 = mk("div", "row wrap"); r1.append(button("Activar el control (Accesibilidad)", () => T() ? T().abrirAccesibilidad() : soloApp()), st); sec.append(r1);
    if (T()) T().controlActivo().then((r) => { st.textContent = r.activo ? "Activo ✓" : "Apagado"; }).catch(() => {});
    h3("Mientras Jarvis habla");
    chk("Interrumpirlo hablándole («basta», «silencio», «cállate» o «Jarvis»). Usa la voz sin internet de «Jarvis en segundo plano»", D.ajustes.interrumpir, (v) => { D.ajustes.interrumpir = v; save(); });
    chk("Modo bolsillo: todo en voz alta, sigue escuchando y se puede interrumpir", D.ajustes.bolsillo, (v) => bolsillo(v));
    h3("Resumen de la mañana");
    const rh = mk("input", "inp tiny"); rh.type = "time"; rh.value = D.ajustes.rutinaHora || "06:00";
    rh.addEventListener("change", () => { D.ajustes.rutinaHora = rh.value; save(); scheduleRoutine(); });
    chk("Avisarme cada día con el resumen: clases, agenda, recordatorios y compromisos", D.ajustes.rutina, (v) => { D.ajustes.rutina = v; save(); scheduleRoutine(); });
    const r2 = mk("div", "row wrap"); r2.append(rh, button("Oír el resumen ahora", () => { $("#ajustes").hidden = true; routineNow(); })); sec.append(r2);
    h3("Copia de seguridad en el celular");
    sec.append(mk("p", "hint", `Una vez por semana, Jarvis guarda una copia (sin tus claves) en Documentos › Jarvis.${D.ajustes.copiaLocal ? " Última: " + new Date(D.ajustes.copiaLocal).toLocaleDateString("es-CO") + "." : ""}`));
    const r3 = mk("div", "row wrap"); r3.append(button("Hacer una copia ahora", () => weeklyCopy(true))); sec.append(r3);
    box.prepend(sec);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, quizButtons: X.quizButtons, onState: X.onState };
  X.intent = function (text) {
    if (pend && Date.now() - pend.t < 60000) { if (L5.isYes(text)) return { c36: true, kind: "confirmar", si: true }; if (L5.isNo(text)) return { c36: true, kind: "confirmar", si: false }; }
    const t0 = L4.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:abre|inicia|haz|empieza)(?:me)?\s+(?:una\s+|la\s+)?practica(?:\s+con\s+(?:el\s+)?qr)?(?:\s+del?\s+quiz)?$|^(?:quiz|practica)\s+(?:en vivo|con qr)$/.test(t0)) return { c36: true, kind: "practica" };
    if (/^(?:haz|guarda)(?:me)?\s+(?:una\s+)?copia(?:\s+de seguridad)?(?:\s+en el celular)?$/.test(t0)) return { c36: true, kind: "copia" };
    const b = L5.bankIntent(text); if (b) return Object.assign({ c36: true }, b);
    const l = L5.placeIntent(text); if (l) return Object.assign({ c36: true }, l);
    const r = reportIntent(text); if (r) return r;
    const p = L5.phoneIntent(text); if (p) return Object.assign({ c36: true }, p);
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.c36) return base.run(it, text);
    try {
      if (it.kind === "confirmar") return answer(it.si);
      if (["llamar", "wa", "sms", "abrir_app", "cerrar_app", "linterna", "volumen", "alarma", "global", "mapa", "youtube"].includes(it.kind)) { if (!T()) return soloApp(); return await phone(it); }
      if (it.kind === "dictado") return openDictation();
      if (it.kind === "nota_voz") return voiceNote(it.texto);
      if (it.kind === "bolsillo") return bolsillo(it.on);
      if (it.kind === "rutina") return routineNow();
      if (it.kind === "banco_quiz") return bankQuiz(it);
      if (it.kind === "banco_ver") return bankView();
      if (it.kind === "versiones") { const q = A.getQuiz() || (D.quices || [])[0]; if (!q) return R("Primero crea un quiz.", "err"); return makeVersions(q, Math.max(2, Math.min(4, it.n || 4)), it.curso); }
      if (it.kind === "practica") { const q = A.getQuiz() || (D.quices || [])[0]; if (!q) return R("Primero crea un quiz: «hazme un quiz de fracciones».", "err"); return startPractice(q); }
      if (it.kind === "informe") return periodReport(it.quien, it.curso);
      if (it.kind === "copia") return weeklyCopy(true);
      if (/^lugar_/.test(it.kind)) return places(it);
    } catch (e) { R(e.message || String(e), "err"); }
  };
  X.quizButtons = function (btn, it) {
    base.quizButtons(btn, it);
    btn("📶 Práctica con QR", "", () => startPractice(it).catch((e) => R(e.message || String(e), "err")));
    btn("🔀 Versiones A–D", "", () => makeVersions(it, 4).catch((e) => R(e.message || String(e), "err")));
  };
  X.onState = function (s) { if (base.onState) base.onState(s); vigilar(s === "speaking"); };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    const O = plug("Oido"); if (O) window.JON(O, "interrumpir", onInterrupt);
    const Au = plug("Aula"); if (Au) window.JON(Au, "respuesta", onAnswer);
    const LN = plug("LocalNotifications");
    if (LN) window.JON(LN, "localNotificationActionPerformed", (ev) => { if (ev && ev.notification && ev.notification.extra && ev.notification.extra.rutina) { A.tab("hablar"); setTimeout(routineNow, 600); setTimeout(scheduleRoutine, 4000); } });
    setTimeout(() => { scheduleRoutine(); weeklyCopy(false); }, 3000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(scheduleRoutine, 1500); });
    // botones del menú de adjuntar y de la pestaña Clase
    const menu = $("#adj-menu");
    if (menu && !menu.querySelector("[data-dict]")) {
      [["🎙️", "Dictado (con puntuación por voz)", openDictation]].forEach(([ic, t, fn]) => { const o = mk("button", "adj-op"); o.type = "button"; o.dataset.dict = "1"; o.append(mk("span", "adj-ic", ic), mk("span", "", t)); o.addEventListener("click", () => { menu.hidden = true; fn(); }); menu.append(o); });
    }
    const lr = $(".lista-row");
    if (lr && !$("#btn-informe")) { const b = mk("button", "btn", "📄 Informes del periodo"); b.type = "button"; b.id = "btn-informe"; b.addEventListener("click", () => periodReport(null, null).catch((e) => R(e.message, "err"))); lr.append(b); }
  };
  X._c36 = { phone, openDictation, stopDict, voiceNote, summary, routineNow, bankQuiz, makeVersions, startPractice, stopPractice, onAnswer, periodReport, weeklyCopy, places, onInterrupt, answer };
})();
