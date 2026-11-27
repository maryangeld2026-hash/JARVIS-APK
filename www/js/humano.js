/* Jarvis para Android 3.37 · más humano y más inteligente:
   personalidad natural (de tú, como una persona real) · voz natural por defecto con Gemini · tocar el orbe abre la conversación en vivo ·
   memoria que pregunta («¿cómo te fue en la entrevista?») · las preguntas difíciles se piensan a fondo solas.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL24, LL = window.JL, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const aj = () => D.ajustes;
  const R = (t, cls, sp) => A.reply(t, cls || "tool", sp);
  const claveGemini = () => (((aj().claves || {}).gemini) || "").trim();
  const estilo = () => ((aj().estilo || {}).estilo) || "jarvis";
  const nube = () => aj().proveedor !== "local" && !!(((aj().claves || {})[aj().proveedor]) || "").trim() && navigator.onLine;

  // ======================================================================== UNA VEZ: LA PERSONALIDAD NATURAL Y LA VOZ NATURAL
  function migrar() {
    let cambio = false;
    if (!aj().v337) { aj().v337 = 1; cambio = true; if (estilo() === "jarvis") { (aj().estilo = aj().estilo || {}).estilo = "natural"; } }
    // la voz natural con IA, si tienes clave de Gemini y nunca escogiste otra (si se acaba el cupo o no hay internet, habla la del celular)
    // (en las pruebas automáticas, solo cuando se pide)
    if (aj().vozIA === undefined && claveGemini() && (!window.__sinVivo || window.__vozPorDefecto)) { aj().vozIA = "gemini"; if (!aj().vozIAnombre) aj().vozIAnombre = "Charon"; cambio = true; }
    // 3.37.1: la 3.37 había puesto «Achird» y en vivo sonaba otra voz distinta a la de siempre: vuelve Charon (la de Jarvis), salvo que tú la hayas escogido
    if (!aj().v3371) { aj().v3371 = 1; cambio = true; if (aj().vozIAnombre === "Achird" && !aj().vozElegida) aj().vozIAnombre = "Charon"; }
    if (cambio) save();
  }

  // ======================================================================== EN VIVO AL TOCAR EL ORBE
  /** Lo más humano que hay hoy: lo interrumpes cuando quieras y responde con su propia voz. Solo con internet y clave de Gemini;
      en modo docente no (el audio de la clase no sale del celular sin preguntar), ni en modo ahorro, ni si falló hace poco. */
  X.vivoPrincipal = function () {
    if (window.__sinVivo || !D) return false;
    return aj().vivoPrincipal !== false && !!claveGemini() && navigator.onLine && !aj().ahorroActivo && aj().docente !== true && Date.now() - (aj().vivoFallaT || 0) > 10 * 60000;
  };

  // ======================================================================== MEMORIA QUE PREGUNTA
  function anotarSeguimiento(text) {
    if (aj().seguimientos === false) return;
    const s = L.seguimientoDe(text, Date.now()); if (!s) return;
    D.seguimientos = (D.seguimientos || []).filter((x) => !(x.tema === s.tema && x.dia === s.dia) && x.dia > Date.now() - 7 * 864e5);
    D.seguimientos.push(s); if (D.seguimientos.length > 20) D.seguimientos.shift();
    save();
  }
  const hoyK = () => new Date().toDateString();
  /** Al abrir Jarvis (máximo una vez al día): «Oye, ¿cómo te fue en la cita médica?». */
  function preguntar() {
    if (!D || aj().seguimientos === false || aj().segUlt === hoyK() || document.hidden) return;
    const s = (D.seguimientos || []).find((x) => L.tocaPreguntar(x, Date.now())); if (!s) return;
    s.preguntado = true; aj().segUlt = hoyK(); save();
    const q = L.pregunta(s);
    A.add("assistant", q, "");                  // como parte de la conversación: tu respuesta le llega a la IA con contexto
    if (aj().voz) A.say(q);
  }

  // ======================================================================== PENSAR A FONDO LO DIFÍCIL
  async function pensarSolo(q) {
    const hist = LL.trimHistory((D.chat || []).filter((m) => !m.cls || m.cls === "").slice(-9, -1).map((m) => ({ role: m.role, content: m.content })));
    if (aj().voz) A.say(estilo() === "natural" ? L.PIENSO[Math.floor(Math.random() * L.PIENSO.length)] : "Permítame pensarlo con calma…");
    return X._mejoras.pensar(q, hist);
  }

  // ======================================================================== POR VOZ
  function ordenIntent(text) {
    const t = L.norm(text).replace(/^jarvis /, "");
    if (/^(?:habla|hablame|se|actua) (?:mas )?(?:natural|humano|normal como una persona)$|^(?:personalidad|modo) natural$|^no seas tan robot(?:ico)?$/.test(t)) return { h: "natural" };
    if (/^(?:vuelve a ser|se) (?:el )?mayordomo$|^personalidad (?:de )?(?:jarvis|mayordomo)$|^habla como (?:el )?mayordomo$/.test(t)) return { h: "jarvis" };
    if (/^no me preguntes (?:como me fue|por mis cosas)$|^(?:quita|apaga) (?:los )?seguimientos$/.test(t)) return { h: "seg", on: false };
    if (/^(?:preguntame|pregunta) como me fue$|^(?:activa|prende) (?:los )?seguimientos$/.test(t)) return { h: "seg", on: true };
    return null;
  }
  function orden(it) {
    if (it.h === "natural" || it.h === "jarvis") {
      (aj().estilo = aj().estilo || {}).estilo = it.h; save();
      return R(it.h === "natural" ? "¡Listo! Desde ya te hablo como una persona normal, de tú y sin tanta ceremonia." : "Como usted diga. Vuelvo a mis modales de mayordomo, señor.");
    }
    aj().seguimientos = it.on; save();
    return R(it.on ? "Dale. Cuando me cuentes que tienes una cita, una entrevista o un examen, después te pregunto cómo te fue." : "Listo, no te vuelvo a preguntar cómo te fue en tus cosas.");
  }

  // ======================================================================== 3.40: APRENDE DE TUS CORRECCIONES
  /** «eso fue muy largo», «habla más despacio», «no me digas señor»: Jarvis lo cambia de una vez y lo recuerda (no hay que ir a Ajustes). */
  function aprende(c) {
    const est = aj().estilo = aj().estilo || {};
    if (c.largo) est.largo = c.largo;
    if (c.velocidad) { aj().velocidad = Math.max(0.6, Math.min(1.6, Math.round(((+aj().velocidad || 1) + c.velocidad) * 100) / 100)); if (A.applyVoice) A.applyVoice(); }
    if (c.trato) { aj().trato = aj().nombre ? "nombre" : ""; if (c.tu && est.estilo !== "amigo" && est.estilo !== "natural") est.estilo = "natural"; }
    if (c.emojis === false) est.sinEmojis = true;
    if (c.humor != null) est.humor = c.humor;
    (D.aprendido = D.aprendido || []).push({ t: Date.now(), que: Object.keys(c).filter((k) => k !== "dice").join(",") }); if (D.aprendido.length > 50) D.aprendido.shift();
    save();
    return R(c.dice + (c.velocidad ? ` (velocidad ${String(aj().velocidad).replace(".", ",")})` : "") + " Si quieres cambiarlo otra vez, solo dímelo.");
  }

  // ======================================================================== 3.40: «¿DE QUÉ HABLAMOS AYER?»
  async function recuerdo(it) {
    const L27 = window.JL27;
    const convs = [{ chat: D.chat || [] }].concat((D.convs || []).map((c) => ({ chat: c.chat || [] })));
    const l = L27.mensajesDel(convs, it.dia, Date.now()).filter((m) => !/^(?:¿?de qu[eé] hablamos|res[uú]meme lo que hablamos)/i.test(m.content));
    const cuando = it.dia === "semana" ? "esta semana" : it.dia;
    if (!l.length) return R(`🗓️ No tengo conversaciones de ${cuando}.`);
    if (!nube()) return R(`🗓️ ${cuando.charAt(0).toUpperCase() + cuando.slice(1)} me preguntaste:\n` + l.filter((m) => m.role === "user").slice(0, 8).map((m) => "- " + String(m.content).slice(0, 90)).join("\n"));
    A.setState("thinking");
    try {
      let txt = L27.PROMPT_RECUERDO(it.dia, l);
      if (aj().docente === true) (D.cursos || []).forEach((c) => (c.estudiantes || []).forEach((n) => { if (n && n.length > 3) txt = txt.split(n).join("un estudiante"); }));
      const t = await IA.chat({ system: "Resumes conversaciones pasadas con calidez y precisión, en español de Colombia.", messages: [{ role: "user", content: txt }], stream: false, maxTokens: 600 });
      A.setState("idle"); return R(`🗓️ **Lo que hablamos ${cuando}:**\n${t}`);
    } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-337")) return;
    const s = mk("div"); s.id = "aj-337";
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); s.append(l); return i; };
    s.append(mk("h3", "sub", "Más humano y más listo"));
    chk("Al tocar el orbe, conversar en vivo con Gemini (lo puedes interrumpir; con internet)", aj().vivoPrincipal !== false, (v) => { aj().vivoPrincipal = v; save(); });
    chk("En vivo: que no le conteste al ruido y se adapte a cómo suenas", aj().liveHumano !== false, (v) => { aj().liveHumano = v; aj().liveSinExtras = ""; save(); });
    chk("Preguntarme cómo me fue (citas, entrevistas, exámenes que le cuente)", aj().seguimientos !== false, (v) => { aj().seguimientos = v; save(); });
    chk("Pensar a fondo las preguntas difíciles (tarda unos segundos más)", aj().pensarAuto !== false, (v) => { aj().pensarAuto = v; save(); });
    s.append(mk("p", "hint", "La personalidad (natural, mayordomo, formal…) está en Tú y tu asistente › Asistente, y la voz en Voz › Voz natural con IA. Si se acaba el cupo gratis o no hay internet, Jarvis habla con la voz del celular. En modo docente, el orbe no usa la conversación en vivo."));
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (!D) return base.intent(text);
    const raw = String(text || "");
    const o = raw.length < 80 ? ordenIntent(raw) : null; if (o) return { h337: "orden", it: o };
    const L27 = window.JL27;
    if (L27) {
      const c = L27.correccionIntent(raw); if (c) return { h337: "aprende", it: c };        // 3.40: aprende de tus correcciones
      const rc = L27.recuerdoIntent(raw); if (rc) return { h337: "recuerdo", it: rc };      // 3.40: «¿de qué hablamos ayer?»
    }
    try { if (raw.length < 220 && !/\n/.test(raw)) anotarSeguimiento(raw); } catch (e) { /* nada */ }
    const r = base.intent(text); if (r) return r;
    // lo que va a la IA: si es difícil, se piensa a fondo (con la conversación de antes)
    if (aj().pensarAuto !== false && nube() && X._mejoras && X._mejoras.pensar && L.dificil(raw) && !/^(?:piensa|razona|analiza a fondo|modo pensar)/i.test(raw.trim())) return { h337: "pensar", q: raw };
    return null;
  };
  X.run = async function (it, text) {
    if (!it.h337) return base.run(it, text);
    if (it.h337 === "orden") return orden(it.it);
    if (it.h337 === "aprende") return aprende(it.it);
    if (it.h337 === "recuerdo") return recuerdo(it.it);
    if (it.h337 === "pensar") return pensarSolo(it.q);
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    try { migrar(); } catch (e) { console.error(e); }
    setTimeout(preguntar, 5000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(preguntar, 1500); });
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Más humano/.test(x[0]))) C.push(["🙂 Más humano", ["Mañana tengo una entrevista de trabajo", "¿Qué me conviene más: un crédito a 12 meses al 2 % o ahorrar 6 meses?", "Háblame más natural", "Vuelve a ser el mayordomo"]]);
  };
  X._a337 = { migrar, preguntar, anotarSeguimiento, pensarSolo, ordenIntent };
})();
