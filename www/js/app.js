/* Jarvis para Android · la pantalla: conversación por voz, asistente personal, herramientas de la clase (modo docente), quices y ajustes. */
(function () {
  "use strict";
  const VERSION = "3.21";
  const L = window.JL, L7 = window.JL7, D = window.JD.load(), V = window.JV, N = window.JN, IA = window.JIA;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  if (D.ajustes.docente == null) D.ajustes.docente = D.cursos.length > 0 || !!(D.quices && D.quices.length);   // 3.8: el modo docente, solo si ya usas lo de la clase
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const md = (t) => (window.JMD ? window.JMD.md(t) : `<p>${esc(t)}</p>`);
  const mdInline = (t) => md(t).replace(/^<p>([\s\S]*)<\/p>$/, "$1");

  // ======================================================================== ESTADO Y AVISOS
  let state = "idle";
  const LABEL = { idle: "Listo", listening: "Escuchando…", thinking: "Pensando…", speaking: "Hablando" };
  function setState(s) { const was = state; state = s; document.body.dataset.state = s; $("#status").textContent = LABEL[s] || ""; if (window.JX && was !== s) window.JX.onState(s); }
  V.onSpeaking((on) => { if (on) setState("speaking"); else if (state === "speaking") setState("idle"); });
  let toastT = null;
  function toast(text, ms = 3200) { const t = $("#toast"); t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), ms); }
  function applyVoice() { V.setOptions({ rate: +D.ajustes.velocidad || 1, pitch: +D.ajustes.tono || 1, voice: D.ajustes.vozIdx == null ? -1 : +D.ajustes.vozIdx, webVoice: D.ajustes.vozWeb || "" }); }
  applyVoice();
  const say = (t) => { if (D.ajustes.voz) V.say(L.forSpeech(t)); };

  // ======================================================================== PESTAÑAS
  function tab(name) {
    document.body.dataset.tab = name;
    $$(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === name));
    $$(".view").forEach((v) => (v.hidden = v.dataset.view !== name));
    if (name === "clase") renderClase();
    if (name === "quices") renderQuices();
  }
  $$(".tabs button").forEach((b) => b.addEventListener("click", () => tab(b.dataset.tab)));

  // ======================================================================== CONVERSACIÓN
  const chat = $("#chat");
  function hora(ts) { return new Date(ts).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }); }
  function msgEl(m) {
    const e = mk("div", `msg ${m.role === "user" ? "user" : "jarvis"}${m.cls ? " " + m.cls : ""}`);
    if (m.role === "user") e.textContent = m.content; else e.innerHTML = md(m.content);
    const t = mk("span", "t", hora(m.t || Date.now())); e.append(t);
    return e;
  }
  function renderChat() {
    chat.textContent = "";
    const list = D.chat.slice(-60);
    if (!list.length) chat.append(emptyChat());
    list.forEach((m) => chat.append(msgEl(m)));
    chat.scrollTop = chat.scrollHeight;
  }
  function emptyChat() {
    const e = mk("div", "empty");
    e.append(mk("b", "", `Hola${D.ajustes.nombre ? ", " + D.ajustes.nombre : ""}. Soy Jarvis.`),
      mk("span", "", D.ajustes.claves[D.ajustes.proveedor] ? "Toca el micrófono y háblame, o escribe." : "Toca el micrófono y pídeme algo. Para conversar con la IA, pon tu clave en Ajustes (el engranaje)."));
    const s = mk("div", "sug");
    const ej = ["¿Qué puedes hacer?", "¿Cómo estará el clima mañana?", "Recuérdame a las 5 llamar a mamá", "Pon 5 minutos", "¿Qué tengo hoy?"];
    (D.ajustes.docente === true ? ej.concat(["Escoge un estudiante", "Hazme un quiz de fracciones de 5 preguntas"]) : ej.concat(["Cuando diga modo enfoque, silencia el celular y pon 25 minutos", "Activa el modo docente"])).forEach((x) => {
      const c = mk("button", "chip", x); c.type = "button"; c.addEventListener("click", () => handle(x, false)); s.append(c);
    });
    e.append(s);
    return e;
  }
  function add(role, content, cls) {
    const m = { role, content: String(content), t: Date.now(), cls: cls || "" };
    D.chat.push(m);
    if (D.chat.length > 200) D.chat.splice(0, D.chat.length - 200);
    save();
    $(".empty", chat)?.remove();
    const e = msgEl(m);
    chat.append(e);
    chat.scrollTop = chat.scrollHeight;
    return { m, e };
  }
  /** Jarvis contesta algo propio (herramientas): lo muestra y lo dice. */
  function reply(text, cls = "tool", spoken) { add("assistant", text, cls); say(D.ajustes.bolsillo ? text : (spoken || text)); if (window.JX) window.JX.onReply(spoken || text); }

  let pendingReminder = null, lastByVoice = false;
  async function handle(text, byVoice) {
    text = String(text || "").trim();
    if (!text) return;
    if (byVoice && window.JX && window.JX.corregir) { try { text = window.JX.corregir(text) || text; } catch (e) { /* sin corrección */ } }   // 3.8: tus nombres y palabras, bien escritos
    lastByVoice = byVoice;
    add("user", text);
    if (window.JX && window.JX.antes) { try { window.JX.antes(text); } catch (e) { /* nada */ } }   // 3.14: para «deshaz eso»
    if (pendingReminder) {                                    // «¿a qué hora te lo recuerdo?»
      const p = pendingReminder; pendingReminder = null;
      if (!/^(?:no|cancela|olvidalo|nada)$/.test(L.norm(text))) { addReminder(`recuérdame ${p} ${text}`, true); return afterTurn(); }
    }
    await dispatch(text);
    afterTurn();
  }
  /** Hace una orden (sin mostrarla como mensaje tuyo). noAI: si no es una orden de la app, no la manda a la IA → false. */
  async function dispatch(text, noAI) {
    const it2 = window.JX ? window.JX.intent(text) : null;           // 2.0: seguimiento, memoria, tutor, proyector, Google…
    if (it2) { try { await window.JX.run(it2, text); } catch (e) { reply(e.message || String(e), "err"); } return true; }
    const it = L.intent(text, D.cursos);
    if (it) { try { await doIntent(it, text); } catch (e) { reply(e.message || String(e), "err"); } return true; }
    if (noAI) return false;
    await askAI(text);
    return true;
  }
  async function afterTurn() {
    if (!(lastByVoice && D.ajustes.seguir)) return;
    await V.idle();
    await new Promise((r) => setTimeout(r, 300));              // que el micrófono no se oiga a Jarvis terminando de hablar
    if (state === "idle" && D.ajustes.seguir && !V.isSpeaking()) listen(true);
  }

  /** 3.8: Jarvis es un asistente personal; lo de la clase entra solo con el modo docente. live: la conversación en vivo (sin etiquetas). */
  function systemPrompt(live) {
    const a = D.ajustes, now = new Date(), doc = a.docente === true;
    const hace = "recordatorios y alarmas («recuérdame a las 3 llamar a mamá», «pon una alarma a las 6»), temporizador («pon 10 minutos»), llamar y mandar WhatsApp o SMS a tus contactos (la app pide confirmar), abrir apps, linterna, volumen, clima («dime el clima de mañana»), notas de voz, el calendario del celular, mapas, música en YouTube, modo ahorro" +
      (doc ? "; y de la clase: escoger un estudiante, hacer grupos, pasar lista, quices, notas y ticket de salida" : "");
    return `Eres Jarvis, el asistente personal de voz de ${a.nombre ? "«" + a.nombre + "»" : "la persona"}, en Colombia. Dirígete a la persona como «${trato()}». ` +
      "Hablas en español de Colombia, de forma directa. " + L7.personaPrompt(a.estilo) + " Tu respuesta se lee en voz alta. Las fórmulas, en LaTeX entre $…$. " +
      (doc ? `La persona también es docente${a.asignatura ? " de " + a.asignatura : ""}; sus cursos: ${D.cursos.map((c) => c.nombre).join(", ") || "ninguno todavía"}. No inventes datos de estudiantes. ` : "") +
      (live ? `Esta app hace: ${hace}. ` :
        `Puedes hacer cosas en el celular con las órdenes de esta app: ${hace}. Cuando te pidan hacer algo de eso (aunque sean varias cosas en una frase), contesta en una frase y escribe AL FINAL cada orden en su propia línea, así: <<orden: pon 10 minutos>>. ` +
        "Escribe cada orden completa y como la diría la persona. Si solo te preguntan algo, no escribas órdenes. " +
        "Ejemplos: «despiértame a las 6 y avísale a Ana que llego tarde» → «Listo.» y en líneas aparte <<orden: pon una alarma a las 6>> <<orden: mándale un whatsapp a Ana que llego tarde>>. «¿qué es la fotosíntesis?» → solo la explicación, sin órdenes. " +
        (a.memoriaAuto !== false ? "Si la persona te cuenta algo importante y duradero sobre ella (gustos, personas cercanas, fechas, rutinas, metas), escribe al final <<recordar: el dato en una frase corta>>. Nunca guardes claves, números de cuenta, datos de salud delicados ni datos de estudiantes. " : "")) +
      // 3.21: la fecha y la hora van al final de lo fijo: así el comienzo del mensaje es siempre igual y la nube lo reutiliza (responde antes)
      `Hoy es ${now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, son las ${hora(now).replace(/\.$/, "")}.` +
      (live ? " " : "\u0001") + (window.JX ? window.JX.promptExtra(lastQuestion) : "");      // 3.15: \u0001 separa lo fijo de lo que cambia (Gemma reutiliza lo fijo)
  }
  let lastQuestion = "";
  async function askAI(text) {
    lastQuestion = text;
    setState("thinking");
    const hist = L.trimHistory(D.chat.filter((m) => !m.cls || m.cls === "").slice(-13, -1).map((m) => ({ role: m.role, content: m.content })));
    const { m, e } = add("assistant", "", "");
    e.classList.add("typing");
    let spoken = 0, first = true, buf = "", lastDraw = 0, gotFirst = false, shown = "", raw = "";
    // si la IA tarda en arrancar, Jarvis dice algo corto de una vez (como «A ver…» en el computador): cero silencio
    const ackT = D.ajustes.voz && lastByVoice ? setTimeout(() => { if (!gotFirst && !V.isSpeaking()) V.say(L.ackFor(text)); }, 700) : null;
    const draw = (force) => {
      const now = performance.now();
      if (!force && now - lastDraw < 220) return;
      lastDraw = now;
      e.innerHTML = md(m.content || "…");
      chat.scrollTop = chat.scrollHeight;
    };
    try {
      const full = await IA.chat({ system: systemPrompt(), messages: hist.concat([{ role: "user", content: text }]), onAviso: (t) => { if (!gotFirst) { e.innerHTML = ""; e.append(mk("em", "hint", t)); $("#status").textContent = "REINTENTO"; } }, onDelta: (d, all) => {
        if (!gotFirst) { gotFirst = true; clearTimeout(ackT); }
        const vis = L7.visible(all), dv = vis.startsWith(shown) ? vis.slice(shown.length) : "";
        shown = vis; m.content = vis;
        draw();
        if (!D.ajustes.voz) return;
        buf += dv;
        const r = L.takeSentences(buf, first);
        buf = r.resto;
        r.frases.forEach((s) => { V.say(L.forSpeech(s)); spoken++; first = false; });
      } });
      raw = full || ""; m.content = L7.visible(raw) || (L7.tags(raw).ordenes.length ? "Listo." : "(sin respuesta)");
      if (D.ajustes.voz && buf.trim()) V.say(L.forSpeech(buf));
    } catch (er) {
      m.content = (m.content ? m.content + "\n\n" : "") + (er.code === "abort" ? "*(detenido)*" : er.message);
      m.cls = er.code === "abort" ? "" : "err";
      if (er.code !== "abort") { e.classList.add("err"); say(er.message); }
    }
    clearTimeout(ackT);
    e.classList.remove("typing");
    draw(true);
    const lt = IA.last ? IA.last() : null;
    const quien = lt && lt.prov && lt.prov !== D.ajustes.proveedor ? " · " + (lt.prov === "local" ? "IA del celular" : (L.PROVIDERS[lt.prov] || {}).nombre || lt.prov) : "";
    e.append(mk("span", "t", hora(m.t) + (gotFirst && lt && lt.ms ? ` · ⚡ ${(lt.ms / 1000).toFixed(1).replace(".", ",")} s` : "") + quien));
    save();
    if (state === "thinking") setState(V.isSpeaking() ? "speaking" : "idle");
    if (window.JX && m.cls !== "err") window.JX.onReply(m.content);
    if (window.JX && window.JX.afterAnswer && m.cls !== "err" && m.content) { try { window.JX.afterAnswer(e, m); } catch (er) { console.error(er); } }
    void spoken;
    if (raw && m.cls !== "err") await ordenesIA(raw);
  }
  /** 3.8: la IA usa las habilidades de Jarvis: hace las órdenes que escribió (las delicadas piden confirmar, como siempre) y guarda lo que vale la pena recordar. */
  async function ordenesIA(raw) {
    const tg = L7.tags(raw);
    if (tg.recordar.length && D.ajustes.memoriaAuto !== false) {
      const nombres = [].concat(...D.cursos.map((c) => c.estudiantes || []));
      D.memoria = D.memoria || [];
      tg.recordar.filter((r) => L7.recuerdoOk(r, nombres) && !L7.memDup(D.memoria, r)).forEach((r) => { D.memoria.push({ id: window.JD.uid(), texto: r, t: Date.now(), auto: true }); toast("🧠 Lo recordaré: " + r, 3500); });
      save();
    }
    for (const o of tg.ordenes) {
      if (!L7.ordenSegura(o)) { add("assistant", `No hice «${o}»: eso lo haces tú directamente.`, "tool"); continue; }
      if (D.ajustes.voz) await V.idle();
      add("assistant", "▶ " + o, "tool orden");
      const ok = await dispatch(o, true);
      if (!ok) add("assistant", `No sé hacer «${o}» todavía.`, "tool");
    }
  }

  // ---------------------------------------------------------------- micrófono
  let misses = 0, listenGen = 0, heardPart = false;
  /** auto: la conversación continua (no tocaste el orbe). wake: te activó «Jarvis» o el botón de asistente (espera más). */
  async function listen(auto, wake) {
    if (navigator.vibrate && !auto) { try { navigator.vibrate(20); } catch (e) { /* nada */ } }
    if (state === "listening") {
      // 3.2: si ya dijiste algo, tocar el orbe lo envía; si todavía no, vuelve a escuchar desde cero (antes parecía no hacer nada)
      if (heardPart || auto) { V.stopListening(); return; }
      (V.cancelListening || V.stopListening)();
    }
    if (V.isSpeaking()) V.hush();
    if (state === "thinking") { IA.stop(); }
    const my = ++listenGen; heardPart = false;
    setState("listening");                                    // 3.3: el orbe se pone verde de una vez, aunque el micrófono tarde en abrir
    $("#live").textContent = "Abriendo el micrófono…";
    if (window.JX && window.JX.beforeListen) { try { await Promise.race([window.JX.beforeListen(), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { /* sigue */ } }   // 2.2: suelta el micrófono de «Jarvis» en segundo plano
    if (my !== listenGen) return;
    if (IA.warm) IA.warm();                                   // mientras hablas, ya se abre la conexión con la IA
    if (!V.native()) $("#live").textContent = auto ? "Te escucho…" : "Te escucho… habla ahora";
    let text = "";
    // 3.5: más tiempo para empezar a hablar (antes Android cortaba a los ~5 s) y pausas de 1,6 s sin cortar la frase
    const espera = wake ? 14000 : auto ? 8000 : 11000;
    try { text = await V.listen((p) => { heardPart = true; $("#live").textContent = p; }, { espera, silencio: 1600 }); }
    catch (e) { if (my !== listenGen) return; setState("idle"); $("#live").textContent = ""; toast(e.message, 6000); return; }
    if (my !== listenGen) return;                              // otra escucha ya empezó (tocaste el orbe de nuevo)
    $("#live").textContent = "";
    setState("idle");
    if (!text && !auto) {                                       // tocaste el orbe y no se oyó nada: se dice por qué
      const r = V.lastListen ? V.lastListen() : null;
      $("#live").textContent = r && r.nivel != null && r.nivel > -100 && r.nivel < 1 ? "No te oí: el micrófono llega muy bajo. Acércate y toca de nuevo." : "No te oí. Toca el orbe y habla cuando diga «Habla ahora».";
      setTimeout(() => { if (state === "idle") $("#live").textContent = ""; }, 5000);
      return;
    }
    if (!text) { if (auto && !D.ajustes.manosLibres) { $("#live").textContent = "En espera · toca el micrófono para hablar"; setTimeout(() => { if (state === "idle") $("#live").textContent = ""; }, 4000); } return; }
    misses = 0;
    if (window.JX && window.JX.heard && window.JX.heard(text, auto)) return;   // 2.0: manos libres decide si iba para Jarvis
    handle(text, true);
  }
  $("#btn-mic").addEventListener("click", () => listen(false));
  // 3.5: al activarse (por «Jarvis», el asistente o la burbuja) saluda —«¿Sí, profesor?»— y espera a que termine de hablar para escuchar
  function trato() {
    const doc = D.ajustes.docente === true;
    let t = D.ajustes.trato || (doc ? "profesor" : "señor");
    if (!doc && /^profe/.test(t)) t = t === "profesora" ? "señora" : "señor";       // 3.16: sin el modo docente, nada de «profesor»
    return t === "nombre" ? (D.ajustes.nombre || (doc ? "profe" : "señor")) : t;
  }
  let saludo = 0;
  async function wake() {
    if (state === "listening") return;
    V.hush();
    const tr = trato(), f = ["¿Sí, " + tr + "?", "A su servicio, " + tr + ".", "Dígame, " + tr + ".", "Le escucho, " + tr + "."];
    if (D.ajustes.voz) {
      V.say(f[saludo++ % f.length]);
      await Promise.race([V.idle(), new Promise((r) => setTimeout(r, 2500))]);
      await new Promise((r) => setTimeout(r, 250));            // que el micrófono no oiga el final del saludo
    }
    return listen(false, true);
  }
  // 3.3: lo que va pasando con el micrófono, a la vista
  if (V.onListenState) V.onListenState((s, d) => {
    if (state !== "listening" || heardPart) return;
    if (s === "listo") $("#live").textContent = "🎙️ Habla ahora…";
    else if (s === "habla") $("#live").textContent = "Te oigo…";
    else if (s === "cambio") $("#live").textContent = "Ese micrófono no respondió; pruebo otro… habla ahora";
  });
  $("#btn-callar").addEventListener("click", () => { V.hush(); IA.stop(); (V.cancelListening || V.stopListening)(); setState("idle"); $("#live").textContent = ""; });
  const conv = $("#btn-conv");
  function convMark() { conv.setAttribute("aria-pressed", D.ajustes.seguir ? "true" : "false"); }
  conv.addEventListener("click", () => { D.ajustes.seguir = !D.ajustes.seguir; save(); convMark(); toast(D.ajustes.seguir ? "Conversación continua: después de responder, vuelvo a escuchar." : "Conversación continua apagada."); });
  $("#in-texto").addEventListener("focus", () => IA.warm && IA.warm());
  $("#f-escribir").addEventListener("submit", (ev) => { ev.preventDefault(); const i = $("#in-texto"); const t = i.value; i.value = ""; handle(t, false); });

  // ======================================================================== ÓRDENES DE LA CLASE
  function courseFor(id) {
    return D.cursos.find((c) => c.id === id) || D.cursos.find((c) => c.id === D.cursoActual) || (D.cursos.length === 1 ? D.cursos[0] : null);
  }
  const noCourse = "Primero crea un curso con la lista de estudiantes: en la pestaña Clase, toca «+ Curso».";
  async function doIntent(it, text) {
    const now = new Date();
    switch (it.kind) {
      case "callar": V.hush(); IA.stop(); return;
      case "ajustes": openSettings(); return reply("Abrí los Ajustes.");
      case "minimizar": reply("Listo, me minimizo. Aquí sigo."); await V.idle(); return appWindow("minimizar");
      case "salir": reply(["Apagando sistemas. Hasta pronto, " + trato() + ".", "Me desconecto. Aquí estaré cuando me necesite, " + trato() + "."][Date.now() % 2]); await Promise.race([V.idle(), new Promise((r) => setTimeout(r, 4000))]); return appWindow("salir");
      case "hora": return reply(`Son las ${hora(now).replace(/\.$/, "")}.`);
      case "fecha": return reply(`Hoy es ${now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`);
      case "tiempo": { const s = it.segundos || D.ultimoTiempo || 300; startTimer(s); return reply(`Listo: ${L.spokenDuration(s)}. Te aviso cuando termine.`); }
      case "tiempo_parar": stopTimer(); return reply("Temporizador detenido.");
      case "tiempo_falta": return reply(timer.end ? `Quedan ${L.spokenDuration(Math.max(0, Math.round((timer.end - Date.now()) / 1000)))}.` : "No hay ningún temporizador andando.");
      case "recordar": return addReminder(text, true);
      case "recordatorios": {
        const up = D.recordatorios.filter((r) => !r.avisado);
        return reply(up.length ? "Tus recordatorios:\n" + up.map((r) => `- ${r.texto} (${L.spokenWhen(new Date(r.cuando))})`).join("\n") : "No tienes recordatorios pendientes.");
      }
      case "azar": {
        const c = courseFor(it.curso);
        if (!c) return reply(noCourse);
        const r = pickFor(c);
        if (!r) return reply(`El curso ${c.nombre} no tiene estudiantes todavía.`);
        showPick(r, c);
        return reply(`**${r.name}**` + (r.reinicio ? " (ya habían pasado todos: empecé de nuevo)" : ""), "tool", r.name);
      }
      case "grupos": {
        const c = courseFor(it.curso);
        if (!c) return reply(noCourse);
        const g = L.makeGroups(c.estudiantes, it.tamano ? { tamano: it.tamano } : { grupos: it.grupos || 4 });
        showGroups(g, c);
        return reply(`Listos ${g.length} grupos de ${c.nombre}:\n` + g.map((x, i) => `${i + 1}. ${x.join(", ")}`).join("\n"), "tool", `Listos ${g.length} grupos. Están en la pantalla.`);
      }
      case "foto": tab("clase"); $("#k-foto").scrollIntoView({ behavior: "smooth" }); return reply("Toca «Tomar foto» y le tomas la foto al trabajo. Yo reviso el procedimiento y te propongo la nota.");
      case "quiz": {
        if (!it.tema) return reply("¿Sobre qué tema? Dime, por ejemplo: «hazme un quiz de fracciones equivalentes de 5 preguntas».");
        const c = it.curso ? courseFor(it.curso) : null;
        const q = await makeQuiz({ tema: it.tema, n: it.n || 5, grado: it.grado, tipo: it.tipo, curso: c && c.nombre });
        if (q) reply(`Listo ${it.tipo === "taller" ? "el taller" : "el quiz"} «${q.quiz.titulo}» con ${q.quiz.preguntas.length} preguntas. Está en la pestaña Quices: desde ahí lo compartes en PDF o por WhatsApp.`);
        return;
      }
    }
  }

  // ======================================================================== CLASE: CURSOS
  function renderClase() {
    const box = $("#cursos");
    box.textContent = "";
    D.cursos.forEach((c) => {
      const b = mk("button", "chip" + (c.id === D.cursoActual ? " on" : ""), c.nombre);
      b.type = "button"; b.append(mk("small", "", String(c.estudiantes.length)));
      b.addEventListener("click", () => { if (D.cursoActual === c.id) editCourse(c); else { D.cursoActual = c.id; save(); renderClase(); } });
      box.append(b);
    });
    const add = mk("button", "chip", "+ Curso"); add.type = "button"; add.addEventListener("click", () => editCourse(null)); box.append(add);
    if (!D.cursoActual && D.cursos[0]) { D.cursoActual = D.cursos[0].id; save(); }
    const c = courseFor(null);
    $("#azar-info").textContent = c ? `${c.nombre}: quedan ${c.estudiantes.filter((n) => !(c.usados || []).includes(n)).length} de ${c.estudiantes.length} por pasar. Toca el curso otra vez para editarlo.` : noCourse;
    const sel = $("#foto-estudiante");
    sel.innerHTML = '<option value="">Estudiante (opcional, para tu registro)</option>';
    (c ? c.estudiantes : []).forEach((n) => sel.append(new Option(n, n)));
    renderReminders(); renderPhotoLog();
    if (window.JX) window.JX.renderClase(c);
  }
  let editing = null;
  function editCourse(c) {
    editing = c;
    $("#curso-ed-t").textContent = c ? "Editar curso" : "Nuevo curso";
    $("#c-nombre").value = c ? c.nombre : "";
    $("#c-lista").value = c ? c.estudiantes.join("\n") : "";
    $("#btn-c-borrar").hidden = !c;
    countNames();
    $("#curso-ed").hidden = false;
  }
  function countNames() { const n = L.parseNames($("#c-lista").value).length; $("#c-cuenta").textContent = n ? `${n} estudiante${n === 1 ? "" : "s"}` : ""; }
  $("#c-lista").addEventListener("input", countNames);
  $("#btn-curso-cerrar").addEventListener("click", () => ($("#curso-ed").hidden = true));
  $("#btn-c-archivo").addEventListener("click", () => $("#c-archivo").click());
  $("#c-archivo").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    const txt = await f.text();
    const names = /[;,\t]/.test(txt.split("\n")[0] || "") ? L.namesFromTable(txt) : L.parseNames(txt);
    $("#c-lista").value = names.join("\n"); countNames();
    if (!$("#c-nombre").value) $("#c-nombre").value = f.name.replace(/\.[^.]+$/, "").slice(0, 20);
  });
  $("#btn-c-guardar").addEventListener("click", () => {
    const nombre = $("#c-nombre").value.trim(), est = L.parseNames($("#c-lista").value);
    if (!nombre) return toast("Ponle nombre al curso (por ejemplo 7A).");
    if (editing) Object.assign(editing, { nombre, estudiantes: est, usados: (editing.usados || []).filter((n) => est.includes(n)) });
    else { const c = { id: window.JD.uid(), nombre, estudiantes: est, usados: [] }; D.cursos.push(c); D.cursoActual = c.id; }
    save(); $("#curso-ed").hidden = true; renderClase(); toast(`Curso ${nombre} guardado (${est.length} estudiantes).`);
  });
  $("#btn-c-borrar").addEventListener("click", () => {
    if (!editing || !confirm(`¿Borrar el curso ${editing.nombre}?`)) return;
    D.cursos = D.cursos.filter((c) => c !== editing); if (D.cursoActual === editing.id) D.cursoActual = (D.cursos[0] || {}).id || "";
    save(); $("#curso-ed").hidden = true; renderClase();
  });

  // ---------------------------------------------------------------- estudiante al azar
  function pickFor(c) { const r = L.pickStudent(c.estudiantes, c.usados || []); if (r) { c.usados = r.usados; save(); } return r; }
  function showPick(r, c) {
    const el = $("#azar-nombre");
    let k = 0;
    el.classList.remove("win"); el.classList.add("spin");
    const spin = setInterval(() => { el.textContent = c.estudiantes[Math.floor(Math.random() * c.estudiantes.length)]; if (++k > 12) end(); }, 70);
    function end() { clearInterval(spin); el.classList.remove("spin"); el.textContent = r.name; if (window.JX) window.JX.onPick(r.name); void el.offsetWidth; el.classList.add("win"); if (navigator.vibrate) navigator.vibrate(60); renderClase(); }
  }
  $("#btn-azar").addEventListener("click", () => {
    const c = courseFor(null);
    if (!c) return toast(noCourse, 5000);
    const r = pickFor(c);
    if (!r) return toast("Ese curso no tiene estudiantes.");
    showPick(r, c);
    setTimeout(() => say(r.name), 900);
  });
  $("#btn-azar-reset").addEventListener("click", () => { const c = courseFor(null); if (c) { c.usados = []; save(); renderClase(); toast("Listo: empiezan todos de nuevo."); } });

  // ---------------------------------------------------------------- grupos
  let gN = 4, lastGroups = null;
  $$("#k-grupos .stepper button").forEach((b) => b.addEventListener("click", () => { gN = Math.max(1, Math.min(20, gN + +b.dataset.step)); $("#g-n").textContent = gN; }));
  function showGroups(g, c) {
    lastGroups = { g, c: c.nombre };
    const box = $("#grupos"); box.textContent = "";
    g.forEach((x, i) => { const d = mk("div", "grupo"); d.style.animationDelay = i * 60 + "ms"; d.append(mk("b", "", `GRUPO ${i + 1}`)); x.forEach((n) => d.append(mk("div", "", n))); box.append(d); });
    $("#btn-grupos-compartir").hidden = false;
    if (window.JX) window.JX.onGroups(g, c);
  }
  $("#btn-grupos").addEventListener("click", () => {
    const c = courseFor(null);
    if (!c) return toast(noCourse, 5000);
    const modo = $('input[name="gmodo"]:checked').value;
    showGroups(L.makeGroups(c.estudiantes, modo === "tamano" ? { tamano: gN } : { grupos: gN }), c);
  });
  $("#btn-grupos-compartir").addEventListener("click", () => {
    if (!lastGroups) return;
    const text = `*Grupos de ${lastGroups.c}*\n` + lastGroups.g.map((x, i) => `\n*Grupo ${i + 1}:* ${x.join(", ")}`).join("");
    N.share({ title: "Grupos", text }).then((how) => how === "copiado" && toast("Copiado: pégalo en WhatsApp.")).catch(() => {});
  });

  // ---------------------------------------------------------------- temporizador
  const timer = { end: 0, total: 0, iv: null, nid: "tiempo" };
  function startTimer(secs) {
    stopTimer(true);
    D.ultimoTiempo = secs; save();
    timer.total = secs; timer.end = Date.now() + secs * 1000;
    timer.iv = setInterval(tick, 500); tick();
    // 3.7.1: la pantalla queda encendida solo en temporizadores cortos (los de clase); en los largos avisa la notificación
    if (secs <= 15 * 60 || (D.ajustes.pantallaTemp && !D.ajustes.ahorroActivo)) N.keepAwake(true);
    N.notifyAt(timer.nid, "⏰ Se acabó el tiempo", `Pasaron ${L.spokenDuration(secs)}.`, timer.end);
    if (window.JX && window.JX.onTimer) window.JX.onTimer(timer.end, secs);
    $("#btn-tiempo").textContent = "Reiniciar";
  }
  function stopTimer(quiet) {
    clearInterval(timer.iv); timer.iv = null; timer.end = 0;
    N.cancelNotify(timer.nid); N.keepAwake(false);
    if (window.JX && window.JX.onTimer) window.JX.onTimer(0);
    $("#reloj").className = "clock"; $("#reloj").textContent = L.fmtClock(D.ultimoTiempo || 300); $("#reloj-barra").style.width = "100%";
    $("#btn-tiempo").textContent = "Empezar";
    if (!quiet) $("#alarma").hidden = true;
  }
  // 3.7.1: con Jarvis fuera de pantalla el reloj no se dibuja (la notificación y la alarma siguen); al volver se pone al día
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (timer.iv) { clearInterval(timer.iv); timer.iv = null; } }
    else if (timer.end && !timer.iv) { timer.iv = setInterval(tick, 500); tick(); }
  });
  function tick() {
    const left = Math.max(0, (timer.end - Date.now()) / 1000);
    const r = $("#reloj");
    r.textContent = L.fmtClock(Math.ceil(left));
    r.className = "clock run" + (left <= 10 ? " low" : "");
    $("#reloj-barra").style.width = (100 * left / timer.total) + "%";
    if (left <= 0) {
      clearInterval(timer.iv); timer.iv = null; timer.end = 0; N.keepAwake(false);
      r.className = "clock end"; r.textContent = "0:00";
      alarm("¡Se acabó el tiempo!");
    }
  }
  let beepT = null;
  function beep() {
    try {
      const ac = beep.ac || (beep.ac = new (window.AudioContext || window.webkitAudioContext)());
      [0, 0.25, 0.5].forEach((d) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, ac.currentTime + d); g.gain.exponentialRampToValueAtTime(0.4, ac.currentTime + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.2);
        o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.22); });
    } catch (e) { /* sin audio */ }
  }
  function alarm(text) {
    $("#alarma-t").textContent = text; $("#alarma").hidden = false;
    N.showNow("Jarvis", text); beep(); clearInterval(beepT); let n = 0; beepT = setInterval(() => { if (++n > 6 || $("#alarma").hidden) clearInterval(beepT); else beep(); }, 1500);
    say(text);
  }
  $("#btn-alarma").addEventListener("click", () => { $("#alarma").hidden = true; clearInterval(beepT); V.hush(); stopTimer(true); });
  $$(".presets .chip").forEach((b) => b.addEventListener("click", () => startTimer(+b.dataset.min * 60)));
  $("#btn-tiempo").addEventListener("click", () => startTimer(D.ultimoTiempo || 300));
  $("#btn-tiempo-parar").addEventListener("click", () => stopTimer());

  // ---------------------------------------------------------------- calificar la foto de un trabajo
  $("#btn-foto").addEventListener("click", () => { const i = $("#foto-in"); i.setAttribute("capture", "environment"); i.click(); });
  $("#btn-foto-galeria").addEventListener("click", () => { const i = $("#foto-in"); i.removeAttribute("capture"); i.click(); });
  function shrink(file, max = 1600) {
    return new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        ok(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => no(new Error("No pude abrir esa imagen."));
      img.src = URL.createObjectURL(file);
    });
  }
  $("#foto-in").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    const box = $("#foto-res");
    box.textContent = "";
    let url;
    try { url = await shrink(f); } catch (e) { return toast(e.message); }
    const img = mk("img"); img.src = url; img.alt = "Foto del trabajo"; box.append(img);
    const wait = mk("p", "hint", "Revisando el procedimiento…"); box.append(wait);
    setState("thinking");
    try {
      const esc5 = { min: 1, max: 5 };
      const obj = await IA.json({ system: "Eres un docente de matemáticas cuidadoso y justo.", messages: [{ role: "user", content: L.gradePrompt({ consigna: $("#foto-consigna").value.trim(), escala: esc5 }),
        image: { mime: "image/jpeg", data: url.split(",")[1] } }], maxTokens: 1500 });
      const r = L.cleanGrade(obj, esc5);
      wait.remove();
      if (r.error) throw new Error(r.error);
      showGrade(box, r.revision);
      const who = $("#foto-estudiante").value, c = courseFor(null);
      if (r.revision.nota != null) {
        D.fotos.unshift({ id: window.JD.uid(), fecha: Date.now(), curso: c ? c.nombre : "", estudiante: who, actividad: $("#foto-consigna").value.trim(), nota: r.revision.nota, resumen: r.revision.resumen });
        D.fotos = D.fotos.slice(0, 300); save(); renderPhotoLog();
        if (window.JX) window.JX.afterGrade(box, r.revision, who, c);          // 2.0: guardarla en el seguimiento
      }
      say((r.revision.nota != null ? `Le pondría ${String(r.revision.nota).replace(".", ",")}. ` : "") + r.revision.resumen);
    } catch (e) { wait.textContent = e.message; wait.className = "hint"; }
    if (state === "thinking") setState("idle");
  });
  function showGrade(box, r) {
    const perf = L.performance(r.nota, D.ajustes.escala);
    if (r.nota != null) { const n = mk("div", "nota " + perf.normalize("NFD").replace(/[̀-ͯ]/g, "")); n.append(mk("b", "", String(r.nota).replace(".", ",")), mk("span", "", perf)); box.append(n); }
    const p = mk("p"); p.innerHTML = mdInline(r.resumen); box.append(p);
    const list = (title, items) => { if (!items.length) return; box.append(mk("h4", "", title)); const ul = mk("ul"); items.forEach((x) => { const li = mk("li"); li.innerHTML = mdInline(x); ul.append(li); }); box.append(ul); };
    list("Lo que hizo bien", r.aciertos); list("Errores", r.errores);
    if (r.sugerencia) { box.append(mk("h4", "", "Para practicar")); const s = mk("p"); s.innerHTML = mdInline(r.sugerencia); box.append(s); }
    box.append(mk("p", "hint", "Es una propuesta: la nota la decides tú."));
  }
  function renderPhotoLog() {
    const box = $("#foto-registro"); box.textContent = "";
    if (!D.fotos.length) { box.append(mk("p", "hint", "Aún no has calificado fotos.")); return; }
    const t = mk("table");
    D.fotos.slice(0, 30).forEach((f) => { const tr = mk("tr"); [new Date(f.fecha).toLocaleDateString("es-CO"), f.curso, f.estudiante || "—", String(f.nota).replace(".", ",")].forEach((x) => tr.append(mk("td", "", x))); t.append(tr); });
    box.append(t);
  }
  $("#btn-foto-csv").addEventListener("click", () => {
    const rows = [["Fecha", "Curso", "Estudiante", "Actividad", "Nota", "Resumen"]].concat(D.fotos.map((f) => [new Date(f.fecha).toLocaleDateString("es-CO"), f.curso, f.estudiante, f.actividad, String(f.nota).replace(".", ","), f.resumen]));
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    N.share({ title: "Notas de fotos", fileName: "notas-fotos.csv", mime: "text/csv", base64: btoa(unescape(encodeURIComponent(csv))) }).catch(() => {});
  });

  // ---------------------------------------------------------------- recordatorios
  function addReminder(text, spoken) {
    const r = L.parseReminder(text);
    if (!r || !r.texto) { const m = "Dime qué te recuerdo y cuándo: «recuérdame llamar a la coordinadora a las 3 de la tarde»."; return spoken ? reply(m) : toast(m, 5000); }
    if (!r.cuando) { pendingReminder = r.texto; return spoken ? reply(`¿A qué hora te recuerdo «${r.texto}»?`) : toast("¿A qué hora? Agrega «a las…» o «en 20 minutos».", 5000); }
    const it = { id: window.JD.uid(), texto: r.texto, cuando: r.cuando.getTime(), avisado: false };
    D.recordatorios.push(it); D.recordatorios.sort((a, b) => a.cuando - b.cuando); save();
    N.notifyAt(it.id, "Jarvis te recuerda", it.texto, it.cuando, { acciones: true });
    renderReminders();
    const m = `Listo: te recuerdo «${it.texto}» ${L.spokenWhen(r.cuando)}.`;
    if (spoken) reply(m); else toast(m, 4000);
  }
  function renderReminders() {
    const ul = $("#recordatorios"); ul.textContent = "";
    const list = D.recordatorios.filter((r) => !r.avisado || Date.now() - r.cuando < 864e5);
    if (!list.length) { ul.append(mk("li", "hint", "No hay recordatorios.")); return; }
    list.forEach((r) => {
      const li = mk("li", r.avisado ? "pasado" : ""), g = mk("div", "grow", r.texto);
      g.append(mk("small", "", L.spokenWhen(new Date(r.cuando))));
      const x = mk("button", "x"); x.type = "button"; x.setAttribute("aria-label", "Borrar"); x.innerHTML = '<svg><use href="#i-x"/></svg>';
      x.addEventListener("click", () => { D.recordatorios = D.recordatorios.filter((y) => y !== r); N.cancelNotify(r.id); save(); renderReminders(); });
      li.append(g, x); ul.append(li);
    });
  }
  $("#f-recordar").addEventListener("submit", (ev) => {
    ev.preventDefault();
    let t = $("#in-recordar").value.trim();
    if (!t) return;
    if (!/^(?:recu[eé]rdame|av[ií]same|recordatorio)/i.test(t)) t = "recuérdame " + t;
    $("#in-recordar").value = "";
    addReminder(t, false);
  });
  window.JEVERY(15000, () => {                                // con la app abierta, Jarvis también avisa de viva voz (cerrada, avisa la notificación)
    const now = Date.now();
    D.recordatorios.forEach((r) => {
      if (!r.avisado && r.cuando <= now) { r.avisado = true; save(); if (now - r.cuando < 10 * 60000) { alarm("Recordatorio: " + r.texto); add("assistant", "⏰ **Recordatorio:** " + r.texto, "tool"); } renderReminders(); }
    });
  });

  // ======================================================================== QUICES
  let current = null;
  async function makeQuiz({ tema, n, grado, tipo, curso }) {
    setState("thinking");
    $("#btn-quiz").disabled = true; $("#btn-quiz").textContent = "Creando…";
    try {
      const obj = await IA.json({ system: "Eres un docente experto en evaluación de matemáticas en Colombia.", messages: [{ role: "user", content: L.quizPrompt({ tema, n, grado, tipo }) }] });
      const r = L.cleanQuiz(obj, { tema });
      if (r.error) throw new Error(r.error);
      const it = { id: window.JD.uid(), fecha: Date.now(), tema, grado, tipo, curso: curso || "", quiz: r.quiz };
      D.quices.unshift(it); D.quices = D.quices.slice(0, 100); save();
      current = it;
      if (document.body.dataset.tab === "quices") renderQuices();
      return it;
    } catch (e) {
      if (document.body.dataset.tab === "quices") toast(e.message, 6000); else reply(e.message, "err");
      return null;
    } finally {
      $("#btn-quiz").disabled = false; $("#btn-quiz").textContent = "Crear con IA";
      if (state === "thinking") setState("idle");
    }
  }
  const grados = $("#q-grado");
  for (let g = 1; g <= 11; g++) grados.append(new Option(`Grado ${g}`, String(g)));
  $("#f-quiz").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const tema = $("#q-tema").value.trim();
    if (!tema) return;
    const it = await makeQuiz({ tema, n: +$("#q-n").value, grado: +$("#q-grado").value || null, tipo: $("#q-tipo").value });
    if (it) { toast(`Listo: ${it.quiz.preguntas.length} preguntas.`); $("#quiz-ver").scrollIntoView({ behavior: "smooth" }); }
  });
  function renderQuices() {
    const ul = $("#quices"); ul.textContent = "";
    if (!D.quices.length) ul.append(mk("li", "hint", "Aún no hay quices. Crea uno arriba o pídelo por voz."));
    D.quices.forEach((q) => {
      const li = mk("li", "click"), g = mk("div", "grow", q.quiz.titulo);
      g.append(mk("small", "", `${q.quiz.preguntas.length} preguntas · ${new Date(q.fecha).toLocaleDateString("es-CO")}${q.grado ? " · grado " + q.grado : ""}${q.curso ? " · " + q.curso : ""}`));
      li.append(g); li.addEventListener("click", () => { current = q; renderQuiz(); $("#quiz-ver").scrollIntoView({ behavior: "smooth" }); });
      ul.append(li);
    });
    renderQuiz();
  }
  function renderQuiz() {
    const box = $("#quiz-ver"); box.textContent = "";
    if (!current) return;
    const q = current.quiz;
    const card = mk("div", "quiz hide-key");
    card.append(mk("h3", "", q.titulo));
    if (q.instrucciones) card.append(mk("p", "ins", q.instrucciones));
    const ol = mk("ol", "q");
    q.preguntas.forEach((p) => {
      const li = mk("li"), en = mk("div"); en.innerHTML = mdInline(p.enunciado.replace(/\\frac/g, "\\dfrac")); li.append(en);
      const ops = mk("ol", "op");
      p.opciones.forEach((o, k) => { const x = mk("li", k === p.correcta ? "ok" : ""); x.innerHTML = mdInline(o.replace(/\\frac/g, "\\dfrac")); ops.append(x); });
      li.append(ops);
      if (p.explicacion) { const e = mk("div", "exp"); e.innerHTML = "✓ " + mdInline(p.explicacion); li.append(e); }
      ol.append(li);
    });
    card.append(ol);
    const acts = mk("div", "quiz-acts");
    const btn = (label, icon, fn, cls = "") => { const b = mk("button", "btn " + cls); b.type = "button"; if (icon) b.innerHTML = `<svg><use href="#${icon}"/></svg>`; b.append(label); b.addEventListener("click", fn); acts.append(b); return b; };
    const keyBtn = btn("Ver respuestas", "", () => { const h = card.classList.toggle("hide-key"); keyBtn.lastChild.textContent = h ? "Ver respuestas" : "Ocultar respuestas"; });
    btn("PDF", "i-pdf", () => sharePDF(current, false), "primary");
    btn("PDF versión B", "i-pdf", () => sharePDF(current, true));
    btn("WhatsApp", "i-share", () => N.share({ title: q.titulo, text: L.quizText(q, false) }).then((h) => h === "copiado" && toast("Copiado: pégalo en WhatsApp.")).catch(() => {}));
    if (window.JX) window.JX.quizButtons(btn, current);                       // 2.0: Word, Forms y proyectar
    btn("Borrar", "", () => { if (!confirm("¿Borrar este quiz?")) return; D.quices = D.quices.filter((x) => x !== current); current = null; save(); renderQuices(); }, "danger");
    box.append(card, acts);
  }
  async function sharePDF(it, versionB) {
    toast("Preparando el PDF…", 2000);
    try {
      const quiz = versionB ? L.shuffleQuiz(it.quiz) : it.quiz;
      const b64 = await window.JPDF.quizPDF(quiz, { curso: it.curso, clave: true, version: versionB ? "B" : "" });
      const name = (it.quiz.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "quiz") + (versionB ? "-B" : "") + ".pdf";
      const how = await N.share({ title: it.quiz.titulo, fileName: name, mime: "application/pdf", base64: b64 });
      if (how === "descargado") toast("PDF descargado (con la hoja de respuestas al final).");
    } catch (e) { if (e && e.name !== "AbortError") toast("No pude hacer el PDF: " + (e.message || e), 6000); }
  }

  // ======================================================================== AJUSTES
  const A = D.ajustes;
  function openSettings() {
    $("#ajustes").hidden = false;                       // 3.0.2: primero se abre, pase lo que pase
    try { fillSettings(); } catch (e) { console.error(e); toast("Una parte de Ajustes no cargó: " + (e.message || e), 6000); }
  }
  function fillSettings() {
    const box = $("#a-proveedor"); box.textContent = "";
    const nota = (k, p) => p.nota || (k === "gemini" ? "tiene nivel gratuito" : "pago por uso");
    // 3.2: los tres de siempre como opciones, y los demás en una lista
    const main = ["gemini", "openai", "claude"];
    main.forEach((k) => {
      const p = L.PROVIDERS[k], l = mk("label"), r = mk("input"); r.type = "radio"; r.name = "prov"; r.value = k; r.checked = A.proveedor === k;
      r.addEventListener("change", () => { A.proveedor = k; A.modelo = ""; save(); fillKey(); markOther(); });
      l.append(r, mk("span", "", p.nombre + " · " + nota(k, p))); box.append(l);
    });
    const ol = mk("label"), orr = mk("input"); orr.type = "radio"; orr.name = "prov"; orr.value = "_otra"; orr.checked = !main.includes(A.proveedor);
    const sel = mk("select", "inp"); sel.id = "a-otra";
    Object.entries(L.PROVIDERS).filter(([k]) => !main.includes(k)).forEach(([k, p]) => sel.append(new Option(p.nombre + " · " + nota(k, p), k)));
    sel.value = main.includes(A.proveedor) ? "groq" : A.proveedor;
    const useOther = () => { A.proveedor = sel.value; A.modelo = ""; orr.checked = true; save(); fillKey(); };
    orr.addEventListener("change", useOther); sel.addEventListener("change", useOther);
    const sp = mk("span", "grow"); sp.append(document.createTextNode("Otra IA"), sel);
    ol.append(orr, sp); ol.classList.add("otra"); box.append(ol);
    function markOther() { orr.checked = !main.includes(A.proveedor); }
    fillKey();
    fillBackup();
    $("#a-velocidad").value = A.velocidad; $("#a-tono").value = A.tono; showRanges();
    $("#a-voz").checked = !!A.voz; $("#a-seguir").checked = !!A.seguir;
    $("#a-nombre").value = A.nombre || "";
    $("#a-basico").value = A.escala.basico; $("#a-alto").value = A.escala.alto; $("#a-superior").value = A.escala.superior;
    $("#acerca").textContent = `Jarvis para Android ${VERSION} · ${V.native() ? "app instalada" : "en el navegador"} · tus datos viven solo en este celular.`;
    $("#probar-res").textContent = "";
    if (window.JX) window.JX.settings();
  }
  function fillKey() {
    const p = L.PROVIDERS[A.proveedor] || L.PROVIDERS.gemini;
    $("#a-clave").value = A.claves[A.proveedor] || ""; $("#a-clave").placeholder = p.pista;
    $("#a-clave").disabled = A.proveedor === "local";
    $("#a-clave").closest(".scroll").querySelector('label[for="a-clave"]').hidden = $("#a-clave").hidden = A.proveedor === "local";
    $("#a-clave-link").href = p.clave || "#"; $("#a-clave-link").hidden = !p.clave;
    $("#a-modelo").value = A.modelo || ""; $("#a-modelo").hidden = $('label[for="a-modelo"]').hidden = A.proveedor === "local";
    $("#a-propio-box").hidden = A.proveedor !== "propio"; $("#a-propio").value = A.propioUrl || "";
    fillBackup();
  }
  // ---------------------------------------------------------------- 3.2: IA de respaldo e IA del celular
  const LOCALES = {
    gemma4e2b: { rango: 6, nombre: "Gemma 4 E2B de Google (2,6 GB · celulares con 8 GB de RAM o más) · recomendada", archivo: "gemma-4-E2B-it.litertlm", ramMin: 7000, mb: 2600,
      url: "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm" },
    gemma4e4b: { rango: 8, nombre: "Gemma 4 E4B de Google (3,7 GB · la más inteligente, celulares con 12 GB de RAM)", archivo: "gemma-4-E4B-it.litertlm", ramMin: 10500, mb: 3700,
      url: "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it.litertlm" },
    // 3.20: Gemma 4 12B, la más inteligente, experimental en celulares (en el procesador, necesita ~7 GB libres)
    gemma4_12b: { rango: 7.5, experimental: true, nombre: "Gemma 4 12B · EXPERIMENTAL (6,6 GB · la más inteligente; lenta, para celulares con 12 GB de RAM o más)", archivo: "gemma-4-12B-it.litertlm", ramMin: 11000, mb: 6600,
      url: "https://huggingface.co/litert-community/gemma-4-12B-it-litert-lm/resolve/main/gemma-4-12B-it.litertlm" },
    // 3.19: Qwen 3.5 (Alibaba, Apache 2.0) en LiteRT-LM: rápida en el procesador; las «VL» también ven fotos
    qwen35_4b: { rango: 7, nombre: "Qwen 3.5 4B (2,8 GB · la más lista de Qwen, solo texto, 8 GB de RAM o más)", archivo: "Qwen3.5-4B_mixed_int4.litertlm", ramMin: 7500, mb: 2800,
      url: "https://huggingface.co/warped-community/Qwen3.5-4B-litert-lm/resolve/main/Qwen3.5-4B_mixed_int4.litertlm" },
    qwen35_2b: { rango: 5, nombre: "Qwen 3.5 2B con visión (3,2 GB · ve fotos, 6 GB de RAM o más)", archivo: "Qwen3.5-2B-VL_int8.litertlm", ramMin: 5500, mb: 3200,
      url: "https://huggingface.co/warped-community/Qwen3.5-2B-litert-lm/resolve/main/Qwen3.5-2B-VL_int8.litertlm" },
    qwen35_08b: { rango: 3, nombre: "Qwen 3.5 0,8B con visión (1,3 GB · muy rápida, ve fotos)", archivo: "Qwen3.5-0.8B-VL_int8.litertlm", ramMin: 3500, mb: 1300,
      url: "https://huggingface.co/litert-community/Qwen3.5-0.8B/resolve/main/Qwen3.5-0.8B-VL_int8.litertlm" },
    qwen05: { rango: 1, nombre: "Liviana · Qwen 2.5 0,5B (550 MB)", archivo: "Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
      url: "https://huggingface.co/litert-community/Qwen2.5-0.5B-Instruct/resolve/main/Qwen2.5-0.5B-Instruct_multi-prefill-seq_q8_ekv1280.task" },
    qwen15: { rango: 2, nombre: "Mejor · Qwen 2.5 1,5B (1,6 GB, celulares con 6 GB de RAM o más)", archivo: "Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task",
      url: "https://huggingface.co/litert-community/Qwen2.5-1.5B-Instruct/resolve/main/Qwen2.5-1.5B-Instruct_multi-prefill-seq_q8_ekv1280.task" },
  };
  const IAL = () => V.native() && window.Capacitor.Plugins && window.Capacitor.Plugins.IALocal;
  function fillBackup() {
    const r = $("#a-respaldo"); if (!r) return;
    r.textContent = "";
    r.append(new Option("Ninguna", ""));
    Object.entries(L.PROVIDERS).filter(([k]) => k !== A.proveedor).forEach(([k, p]) => r.append(new Option(k === "local" ? "IA del celular (sin internet) · recomendada" : p.nombre, k)));
    r.value = A.respaldo && A.respaldo !== A.proveedor ? A.respaldo : "";
    const b = r.value, p = L.PROVIDERS[b];
    $("#a-resp-clave-box").hidden = !b || !p || p.sinClave;
    if (p && !p.sinClave) { $("#a-resp-nombre").textContent = p.nombre; $("#a-resp-clave").value = A.claves[b] || ""; $("#a-resp-clave").placeholder = p.pista; $("#a-resp-link").href = p.clave; }
    if (b === "propio" && A.proveedor !== "propio") { $("#a-propio-box").hidden = false; $("#a-propio").value = A.propioUrl || ""; }
    const showLocal = b === "local" || A.proveedor === "local";
    $("#a-local-box").hidden = !showLocal;
    const ms = $("#a-local-modelo");
    if (!ms.options.length) Object.entries(LOCALES).forEach(([k, x]) => ms.append(new Option(x.nombre, k)));
    ms.value = LOCALES[A.localModelo] ? A.localModelo : "qwen05";
    if (showLocal) localStatus();
  }
  async function localStatus() {
    const st = $("#a-local-st"), P = IAL();
    if (!P) { st.textContent = "La IA del celular funciona en la app instalada (el APK)."; return; }
    try {
      const e = await P.estado();
      st.textContent = e.listo ? `En uso: ${nombreLocal(e.nombre)} (${(e.mb / 1024).toFixed(1).replace(".", ",")} GB). Funciona sin internet.` : `No está descargada. Espacio libre: ${(e.libreMb / 1024).toFixed(1).replace(".", ",")} GB.`;
      $("#btn-local-borrar").hidden = true; $("#btn-local-probar").hidden = !e.listo;
      $("#btn-local-bajar").textContent = "Descargar";
      // 3.19: todas las que tienes descargadas, para escoger cuál uso
      const box = $("#a-local-lista"); box.textContent = "";
      const l = P.modelos ? ((await P.modelos()) || {}).lista || [] : [];
      l.forEach((x) => {
        const f = mk("div", "local-fila" + (x.activo ? " on" : ""));
        f.append(mk("span", "", `${x.activo ? "✅ " : ""}${nombreLocal(x.nombre)} · ${(x.mb / 1024).toFixed(1).replace(".", ",")} GB${x.ve ? " · 👁️" : ""}${x.oye ? " · 👂" : ""}`));
        if (!x.activo) { const u = mk("button", "chip", "Usar"); u.type = "button"; u.addEventListener("click", async () => { await P.usar({ nombre: x.nombre }).catch(() => {}); if (window.__gemmaVoz) window.__gemmaVoz.refrescar(); localStatus(); toast("Ahora uso " + nombreLocal(x.nombre) + " sin internet."); }); f.append(u); }
        const b = mk("button", "chip danger", "Borrar"); b.type = "button"; b.addEventListener("click", async () => { if (!confirm(`¿Borrar ${nombreLocal(x.nombre)}? Liberas ${(x.mb / 1024).toFixed(1).replace(".", ",")} GB.`)) return; await P.borrar({ nombre: x.nombre }).catch(() => {}); if (window.__gemmaVoz) window.__gemmaVoz.refrescar(); localStatus(); });
        f.append(b); box.append(f);
      });
    } catch (er) { st.textContent = er.message || String(er); }
  }
  /** 3.19: el nombre bonito de un modelo descargado («Qwen 3.5 4B», «Gemma 4 E4B»). */
  function nombreLocal(archivo) {
    const k = Object.keys(LOCALES).find((x) => LOCALES[x].archivo === archivo);
    return k ? LOCALES[k].nombre.split(" (")[0].replace(/^(?:Liviana|Mejor) · /, "") : String(archivo || "").replace(/\.(?:litertlm|task)$/, "").replace(/[_-](?:it|int8|mixed_int4|multi-prefill.*)$/i, "");
  }
  let bajando = false;
  async function localDownload() {
    const P = IAL(), st = $("#a-local-st");
    if (!P) return toast("La IA del celular funciona en la app instalada (el APK).");
    if (bajando) { P.cancelar(); return; }
    if (!navigator.onLine) return toast("Para descargarla necesitas internet (mejor wifi). Después funciona sin internet.", 5000);
    const m = LOCALES[A.localModelo || "qwen05"];
    if (m.ramMin && P.memoria) {                                 // 3.12: Gemma 4 necesita memoria (RAM) y espacio
      try {
        const mem = await P.memoria();
        if (mem.discoMb < m.mb + 500) return toast(`Las IA que ya tienes se quedan. ` + `No hay espacio: se necesitan ${((m.mb + 500) / 1024).toFixed(1).replace(".", ",")} GB libres y tienes ${(mem.discoMb / 1024).toFixed(1).replace(".", ",")} GB.`, 7000);
        if (mem.totalMb < m.ramMin && !confirm(`Tu celular tiene ${(mem.totalMb / 1024).toFixed(0)} GB de RAM y este modelo pide ${Math.round(m.ramMin / 1024 + 0.5)} GB. Puede ir muy lento o cerrarse. ${A.localModelo === "gemma4e4b" ? "Te recomiendo Gemma 4 E2B. " : ""}¿Descargarlo igual?`)) return;
      } catch (e) { /* sigue */ }
      if (m.experimental && !confirm("Gemma 4 12B es experimental en celulares: corre en el procesador, responde más lento que Gemma 4 E4B y necesita unos 7 GB de memoria libre (cierra otras apps). Si no alcanza la memoria, te aviso y puedes volver a otra IA. ¿Seguimos?")) return;
      if (!confirm(`Son ${(m.mb / 1024).toFixed(1).replace(".", ",")} GB: descárgalo con wifi y con Jarvis abierto. Si se corta, sigue donde iba. ¿Empiezo?`)) return;
    }
    bajando = true; $("#btn-local-bajar").textContent = "Cancelar";
    const h = await window.JON(P, "progreso", (d) => { st.textContent = `Descargando… ${d.p >= 0 ? d.p + " % · " : ""}${d.mb} MB (puedes seguir usando Jarvis)`; });
    try { await P.descargar({ url: m.url, nombre: m.archivo }); toast("Listo: la IA del celular quedó descargada. Ya funciona sin internet.", 5000); if (window.__gemmaVoz) window.__gemmaVoz.refrescar(); if (!A.respaldo && A.proveedor !== "local") { A.respaldo = "local"; save(true); } }
    catch (e) { toast("No se pudo descargar: " + (e.message || e), 7000); }
    finally { bajando = false; if (h && h.remove) h.remove(); fillBackup(); }
  }
  $("#a-respaldo").addEventListener("change", (e) => { A.respaldo = e.target.value; save(); fillBackup(); });
  $("#a-resp-clave").addEventListener("input", (e) => { if (A.respaldo) { A.claves[A.respaldo] = e.target.value.trim(); delete A.modeloAuto[A.respaldo]; save(); } });
  $("#a-propio").addEventListener("change", (e) => { A.propioUrl = e.target.value.trim(); delete A.modeloAuto.propio; save(); });
  $("#a-local-modelo").addEventListener("change", (e) => { A.localModelo = e.target.value; save(); });
  $("#a-voz-gemma").value = A.vozGemma || "sin_internet";
  $("#a-voz-gemma").addEventListener("change", (e) => { A.vozGemma = e.target.value; save(); });
  $("#btn-local-bajar").addEventListener("click", localDownload);
  $("#btn-local-borrar").addEventListener("click", async () => { if (!confirm("¿Borrar la IA del celular? Liberas el espacio; puedes volver a descargarla.")) return; try { await IAL().borrar(); } catch (e) { /* nada */ } localStatus(); });
  $("#btn-local-probar").addEventListener("click", async () => {
    const st = $("#a-local-st"); st.textContent = "Probando (la primera vez tarda unos segundos en cargar)…";
    try { const r = await IA.test("local"); st.textContent = `Funciona: «${r.texto.slice(0, 40)}» (${(r.ms / 1000).toFixed(1).replace(".", ",")} s).`; }
    catch (e) { st.textContent = e.message; }
  });
  // 3.3: prueba del micrófono, paso a paso (si algo falla, la captura de esta pantalla dice qué es)
  $("#btn-mic-test").addEventListener("click", async () => {
    const out = $("#mic-test"), b = $("#btn-mic-test");
    out.hidden = false; out.textContent = ""; b.disabled = true;
    V.hush(); (V.cancelListening || V.stopListening)();
    if (window.JX && window.JX.beforeListen) { try { await window.JX.beforeListen(); } catch (e) { /* sigue */ } }
    const line = (t, repl) => { const ls = out.textContent.split("\n").filter(Boolean); if (repl && ls.length && /^\s+«/.test(ls[ls.length - 1])) ls.pop(); ls.push(t); out.textContent = ls.join("\n"); out.scrollTop = out.scrollHeight; };
    try { await V.micTest(line); } catch (e) { line("Error: " + (e.message || e)); }
    b.disabled = false;
  });
  // botón «Guardar ajustes»: guarda todo de una vez y cierra
  $("#btn-guardar-aj").addEventListener("click", () => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();      // dispara el «change» del campo que estabas escribiendo
    A.claves[A.proveedor] = $("#a-clave").value.trim();
    A.modelo = $("#a-modelo").value.trim();
    A.nombre = $("#a-nombre").value.trim();
    if ($("#a-propio").value.trim() || A.proveedor === "propio" || A.respaldo === "propio") A.propioUrl = $("#a-propio").value.trim();
    if (A.respaldo && !$("#a-resp-clave-box").hidden) A.claves[A.respaldo] = $("#a-resp-clave").value.trim();
    [["a-basico", "basico"], ["a-alto", "alto"], ["a-superior", "superior"]].forEach(([id, k]) => { const v = parseFloat($("#" + id).value); if (v >= 1 && v <= 5) A.escala[k] = v; });
    window.JD.save(true);
    $("#ajustes").hidden = true; renderChat();
    toast("Ajustes guardados ✓");
    if (IA.warm) IA.warm();
  });
  function showRanges() { $("#a-velocidad-v").textContent = "× " + (+$("#a-velocidad").value).toFixed(1); $("#a-tono-v").textContent = (+$("#a-tono").value).toFixed(1); }
  $("#btn-ajustes").addEventListener("click", openSettings);
  // 3.2: minimizar o salir de Jarvis
  function appWindow(how) {
    const W = V.native() && window.Capacitor.Plugins && window.Capacitor.Plugins.Ventana;
    $("#salir-menu").hidden = true;
    if (!W) { toast(how === "salir" ? "En el navegador, cierra la pestaña." : "En el navegador no se puede minimizar."); return; }
    V.hush(); IA.stop(); (V.cancelListening || V.stopListening)(); setState("idle"); window.JD.save(true);
    if (how === "salir") {
      // 3.16: apagar de verdad: se suelta la escucha de «Jarvis», la burbuja, la IA del celular y se cierra el proceso
      const P = window.Capacitor.Plugins;
      ["Escucha", "Burbuja"].forEach((n) => { try { const x = P[n]; if (x) (x.desactivar || x.ocultar || (() => Promise.resolve())).call(x).catch(() => {}); } catch (e) { /* nada */ } });
      return (W.apagar ? W.apagar() : W.salir()).catch(() => W.salir().catch(() => {}));
    }
    return W.minimizar().catch(() => {});
  }
  $("#btn-salir").addEventListener("click", (e) => { e.stopPropagation(); $("#salir-menu").hidden = !$("#salir-menu").hidden; });
  document.addEventListener("click", (e) => { const m = $("#salir-menu"); if (!m.hidden && !m.contains(e.target)) m.hidden = true; });
  $("#btn-minimizar").addEventListener("click", () => appWindow("minimizar"));
  $("#btn-cerrar-app").addEventListener("click", () => appWindow("salir"));
  // 3.0.2: si algo falla en el celular, se ve en un aviso en vez de quedarse quieto
  let lastErr = 0;
  const showErr = (m) => { if (Date.now() - lastErr < 4000) return; lastErr = Date.now(); toast("Algo falló: " + String(m || "").slice(0, 140), 6000); };
  window.addEventListener("error", (e) => showErr(e.message));
  window.addEventListener("unhandledrejection", (e) => console.error("promesa:", e.reason));
  $(".brand").addEventListener("click", openSettings);  // tocar «JARVIS» también abre Ajustes
  window.__abrirAjustes = openSettings;
  $("#btn-ajustes-cerrar").addEventListener("click", () => { $("#ajustes").hidden = true; renderChat(); });
  $("#a-clave").addEventListener("input", (e) => { A.claves[A.proveedor] = e.target.value.trim(); delete A.modeloAuto[A.proveedor]; save(); });
  $("#a-modelo").addEventListener("change", (e) => { A.modelo = e.target.value.trim(); save(); });
  ["a-velocidad", "a-tono"].forEach((id) => $("#" + id).addEventListener("input", (e) => { A[id === "a-velocidad" ? "velocidad" : "tono"] = +e.target.value; save(); showRanges(); applyVoice(); }));
  $("#a-velocidad").addEventListener("change", () => { V.hush(); V.say("Así sueno ahora."); });
  $("#a-voz").addEventListener("change", (e) => { A.voz = e.target.checked; save(); });
  $("#a-seguir").addEventListener("change", (e) => { A.seguir = e.target.checked; save(); convMark(); });
  $("#a-nombre").addEventListener("change", (e) => { A.nombre = e.target.value.trim(); save(); });
  [["a-basico", "basico"], ["a-alto", "alto"], ["a-superior", "superior"]].forEach(([id, k]) => $("#" + id).addEventListener("change", (e) => { const v = parseFloat(e.target.value); if (v >= 1 && v <= 5) { A.escala[k] = v; save(); } }));
  $("#btn-probar").addEventListener("click", async () => {
    const out = $("#probar-res"); out.textContent = "Probando…";
    try { const r = await IA.test(); out.textContent = `Funciona (${r.modelo}, ${(r.ms / 1000).toFixed(1)} s).`; }
    catch (e) { out.textContent = e.message; }
  });
  $("#btn-respaldo").addEventListener("click", () => {
    const json = JSON.stringify(window.JD.backup(), null, 1);
    N.share({ title: "Copia de Jarvis", fileName: `jarvis-copia-${new Date().toISOString().slice(0, 10)}.json`, mime: "application/json", base64: btoa(unescape(encodeURIComponent(json))) })
      .then(() => toast("Copia lista. Guárdala en Drive o mándatela por correo (no lleva tu clave).", 5000)).catch(() => {});
  });
  $("#btn-restaurar").addEventListener("click", () => $("#restaurar-in").click());
  $("#restaurar-in").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    try { window.JD.restore(JSON.parse(await f.text())); toast("Copia restaurada. Recargando…"); setTimeout(() => location.reload(), 900); }
    catch (e) { toast(e.message || "Ese archivo no sirve.", 5000); }
  });
  $("#btn-borrar-chat").addEventListener("click", () => { if (confirm("¿Borrar toda la conversación?")) { D.chat = []; save(); renderChat(); } });

  // ======================================================================== ARRANQUE
  convMark();
  renderChat();
  if ("serviceWorker" in navigator && !V.native() && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  document.addEventListener("visibilitychange", () => { if (document.hidden && state === "listening") (V.cancelListening || V.stopListening)(); if (!document.hidden && IA.warm) IA.warm(); });
  if (IA.warm) setTimeout(() => IA.warm(), 1500);
  window.__jarvis = { handle, dispatch, renderChat, tab, D, startTimer, makeQuiz, renderClase, showGrade, reply, add, say, toast, listen, setState, courseFor, mdInline, md,
    getState: () => state, wake, trato, systemPrompt, applyVoice, LOCALES, nombreLocal, localStatus, getGroups: () => lastGroups, getQuiz: () => current, setQuiz: (q) => { current = q; }, renderQuices, timer, VERSION };
  if (window.JX) window.JX.init(window.__jarvis);
})();
