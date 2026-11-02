/* Jarvis para Android 3.0 · lógica pura de las habilidades que vienen del Jarvis del computador. Probada con node.
   Documentos con IA (plan de clase, guía, rúbrica, correo, acta, planeación, informe para la familia…), observador,
   diario de clase, compromisos, horario, periodo, «¿cuánto necesita para pasar?», tendencias, gráficas de funciones
   (con un evaluador propio: nunca se ejecuta código), tarjetas de estudio, Kahoot y Anki. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./logica.js"), require("./logica2.js"));
  else root.JL3 = factory(root.JL, root.JL2);
})(typeof self !== "undefined" ? self : this, function (L, L2) {
  "use strict";
  const norm = L.norm;
  const s = (x, max) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, max);
  const cut = (text, re) => { const m = String(text).match(re); return m ? m.slice(1).map((x) => (x == null ? "" : String(x).trim())) : null; };

  // ======================================================================== DOCUMENTOS CON IA
  /* Cada plantilla: re (sobre el texto ORIGINAL, sin distinguir mayúsculas), titulo(args), prompt(args, ctx). La IA responde en
     markdown; nunca recibe nombres de estudiantes (el informe para la familia usa «[ESTUDIANTE]» y el nombre se pone aquí). */
  const T = (s) => new RegExp(s, "i");
  const DOCS = [
    { id: "plan_clase", re: T("^(?:jarvis[,\\s]+)?(?:plan[eé]a(?:me)?|prep[aá]ra(?:me)?|haz(?:me)?|dise[ñn]a(?:me)?)\\s+(?:la\\s+|una\\s+|el\\s+)?(?:clase|plan de clase|sesi[oó]n)\\s+(?:de|sobre)\\s+(.+)$"),
      titulo: (a) => "Plan de clase: " + a[0], prompt: (a, c) => `Diseña un plan de clase de ${c.duracion || 55} minutos sobre «${a[0]}»${c.grado} para un colegio en Colombia${c.asig}. ` +
        "Incluye: objetivo (con el estándar o DBA del MEN si aplica), saberes previos, momentos (inicio, desarrollo, cierre) con tiempos, una actividad práctica, preguntas para verificar comprensión, tarea y evaluación. Fórmulas en LaTeX entre $…$." },
    { id: "guia", re: T("^(?:jarvis[,\\s]+)?(?:haz(?:me)?|crea(?:me)?|prep[aá]ra(?:me)?|dise[ñn]a(?:me)?)\\s+(?:una\\s+)?gu[ií]a(?:\\s+viva|\\s+de\\s+estudio|\\s+de\\s+aprendizaje)?\\s+(?:de|sobre)\\s+(.+)$"),
      titulo: (a) => "Guía: " + a[0], prompt: (a, c) => `Crea una guía de aprendizaje sobre «${a[0]}»${c.grado}${c.asig}: explicación clara con ejemplos resueltos paso a paso, 6 ejercicios graduados (de fácil a reto) y su clave al final. Fórmulas en LaTeX entre $…$.` },
    { id: "rubrica", re: T("\\br[uú]brica\\s+(?:de|para)\\s+(.+)$"),
      titulo: (a) => "Rúbrica: " + a[0], prompt: (a, c) => `Crea una rúbrica para evaluar «${a[0]}»${c.grado}, como tabla markdown: 4 a 5 criterios y los niveles Superior, Alto, Básico y Bajo (escala 1 a 5 de Colombia), con descriptores concretos.` },
    { id: "solucionario", re: T("\\b(?:haz(?:me)?|prep[aá]ra(?:me)?)\\s+(?:el\\s+)?solucionario\\s+(?:de|del)\\s+(.+)$"),
      titulo: (a) => "Solucionario: " + a[0], prompt: (a) => `Haz el solucionario, paso a paso y con la respuesta final resaltada, de: ${a[0]}. Fórmulas en LaTeX entre $…$.` },
    { id: "retro_texto", re: T("\\b(?:retroalimenta|revisa|corrige)\\s+(?:este|el)\\s+(?:texto|trabajo|escrito|ensayo|p[aá]rrafo)(?:\\s+de\\s+[^:]+)?\\s*:\\s*([\\s\\S]{20,})$"),
      titulo: () => "Retroalimentación", prompt: (a) => "Da retroalimentación formativa a este texto de un estudiante (sin poner nota): lo que está bien, 3 aspectos a mejorar con ejemplos concretos de cómo reescribirlos, y una pregunta para que reflexione. Tono amable. Texto:\n\n" + a[0] },
    { id: "nivelar", re: T("\\b(?:nivela|simplifica|adapta)\\s+(?:este\\s+)?texto(?:\\s+para\\s+([^:]+))?\\s*:\\s*([\\s\\S]{20,})$"),
      titulo: () => "Texto adaptado", prompt: (a) => `Adapta este texto ${a[0] ? "para " + a[0] : "para estudiantes que leen con dificultad"}: frases cortas, vocabulario sencillo, sin perder las ideas, y 3 preguntas de comprensión al final. Texto:\n\n${a[1]}` },
    { id: "correo", re: T("^(?:jarvis[,\\s]+)?(?:redacta(?:me)?|escr[ií]be(?:me)?|hazme)\\s+(?:un|una)\\s+(correo|email|mensaje|circular|carta|comunicado)\\s+(.+)$"),
      titulo: (a) => a[0].charAt(0).toUpperCase() + a[0].slice(1), prompt: (a, c) => `Redacta ${/circular|carta|comunicado/i.test(a[0]) ? "una" : "un"} ${a[0]} ${a[1]}. Firma como ${c.nombre || "la docente"}. Tono cordial y profesional, en español de Colombia, listo para enviar. Sin inventar datos: deja [entre corchetes] lo que falte.` },
    { id: "agenda_reunion", re: T("\\bagenda\\s+(?:de|para)\\s+(?:la\\s+)?reuni[oó]n\\b(.*)$"),
      titulo: () => "Agenda de reunión", prompt: (a) => `Prepara la agenda de una reunión ${a[0] || "de área"} en un colegio: objetivo, puntos con tiempos, responsables [por definir] y compromisos esperados. Breve.` },
    { id: "acta", re: T("\\b(?:haz|empieza|redacta|escribe)\\s+(?:el\\s+|un\\s+)?acta\\b(?:\\s+de\\s+(?:la\\s+)?reuni[oó]n)?\\s*:?\\s*([\\s\\S]*)$"),
      titulo: () => "Acta de reunión", prompt: (a) => "Redacta un acta formal de reunión de colegio (fecha, asistentes [por completar], orden del día, desarrollo, compromisos con responsable y fecha). " + (a[0] ? "Esto fue lo que se trató:\n" + a[0] : "Deja la estructura lista para completar.") },
    { id: "planeacion", re: T("\\b(?:planea|prep[aá]rame|haz(?:me)?)\\s+(?:mi\\s+|la\\s+)?(?:a[ñn]o|periodo|planeaci[oó]n(?:\\s+anual|\\s+del\\s+periodo)?)\\b(?:\\s+(?:de|para|sobre)\\s+(.+))?$"),
      titulo: (a) => "Planeación" + (a[0] ? ": " + a[0] : ""), prompt: (a, c) => `Haz una planeación por semanas (tabla markdown: semana, tema, actividad clave, evaluación) para ${a[0] || "matemáticas"}${c.grado} en Colombia, de ${c.semanas || 10} semanas, alineada a los estándares del MEN.` },
    { id: "podcast", re: T("\\bpodcast\\s+(?:de\\s+repaso\\s+)?(?:de|sobre)\\s+(.+)$"),
      titulo: (a) => "Podcast de repaso: " + a[0], prompt: (a, c) => `Escribe el guion de un podcast de repaso de 3 minutos sobre «${a[0]}»${c.grado}, para que lo lea una sola voz, cercano y con ejemplos cotidianos. Sin fórmulas en LaTeX: dilas en palabras.`, podcast: true },
    { id: "refuerzo", re: T("\\b(?:actividades?\\s+de\\s+refuerzo|refuerzo\\s+de(?:l)?|ejercicios\\s+de\\s+refuerzo)\\s+(?:de|sobre|para)?\\s*(.+)$"),
      titulo: (a) => "Refuerzo: " + a[0], prompt: (a, c) => `Diseña actividades de refuerzo sobre «${a[0]}»${c.grado}: explicación corta del error típico, 2 ejemplos resueltos y 6 ejercicios graduados con clave. Fórmulas en LaTeX entre $…$.` },
    { id: "dua", re: T("\\b(?:adapta|ajusta)\\s+(?:la\\s+clase|el\\s+taller|la\\s+actividad)\\s+(?:de|sobre)?\\s*(.+?)\\s+para\\s+(?:un\\s+|una\\s+)?(?:estudiante\\s+)?(?:con\\s+)?(.+)$"),
      titulo: (a) => "Ajuste razonable: " + a[0], prompt: (a) => `Propón ajustes razonables (DUA, Decreto 1421 de Colombia) a la clase de «${a[0]}» para un estudiante con ${a[1]}: objetivos flexibles, apoyos, actividad adaptada y forma de evaluar.` },
    { id: "explica_padres", re: T("\\b(?:expl[ií]cale|c[oó]mo\\s+le\\s+explico)\\s+(?:a\\s+)?(?:los\\s+)?(?:padres|acudientes|familia)\\s+(.+)$"),
      titulo: (a) => "Para la familia: " + a[0], prompt: (a) => `Explica a padres de familia, en lenguaje sencillo y cálido, ${a[0]}, con 3 ideas para apoyar a sus hijos en casa.` },
  ];
  function docIntent(text) {
    for (const d of DOCS) { const a = cut(text, d.re); if (a && a.join("").trim().length >= 2) return { kind: "doc", doc: d.id, args: a }; }
    return null;
  }
  function docById(id) { return DOCS.find((d) => d.id === id); }

  // ======================================================================== TARJETAS DE ESTUDIO (Anki) Y KAHOOT
  function cardsPrompt(tema, n = 12) {
    return `Crea ${n} tarjetas de estudio (pregunta corta / respuesta corta) sobre «${tema}» para estudiantes de colegio. Fórmulas en LaTeX entre $…$. ` +
      'Devuelve SOLO JSON: {"titulo": "…", "tarjetas": [{"frente": "…", "reverso": "…"}]}';
  }
  function cleanCards(obj) {
    const c = (obj && Array.isArray(obj.tarjetas) ? obj.tarjetas : []).map((x) => ({ frente: s(x && x.frente, 300), reverso: s(x && x.reverso, 400) })).filter((x) => x.frente && x.reverso).slice(0, 40);
    return c.length ? { mazo: { titulo: s(obj.titulo, 100) || "Tarjetas", tarjetas: c } } : { error: "La IA no devolvió tarjetas." };
  }
  /** Anki importa texto separado por tabuladores: frente, reverso. */
  function ankiTSV(mazo) { return mazo.tarjetas.map((t) => [L.plainMath(t.frente), L.plainMath(t.reverso)].map((x) => x.replace(/[\t\n]+/g, " ")).join("\t")).join("\n"); }
  /** Las filas de la plantilla de Kahoot (Question, Answer 1-4, Time limit, Correct answer). */
  function kahootRows(quiz, secs = 30) {
    const head = ["Question - max 120 characters", "Answer 1 - max 75 characters", "Answer 2 - max 75 characters", "Answer 3 - max 75 characters", "Answer 4 - max 75 characters",
      "Time limit (sec) – 5, 10, 20, 30, 60, 90, 120, or 240 secs", "Correct answer(s) - choose at least one"];
    const rows = quiz.preguntas.map((q) => {
      const ops = q.opciones.slice(0, 4).map((o) => L.plainMath(o).slice(0, 75));
      while (ops.length < 4) ops.push("");
      return [L.plainMath(q.enunciado).slice(0, 120)].concat(ops, [secs, q.correcta < 4 ? q.correcta + 1 : 1]);
    });
    return [head].concat(rows);
  }

  // ======================================================================== GRÁFICAS: evaluador propio (sin eval)
  /** «y = x^2 - 4», «f(x)=2x+1», «sin(x)» → función de x, o null. Solo números, x, + - * / ^, paréntesis y funciones conocidas. */
  function compileFn(src) {
    let e = String(src || "").toLowerCase().replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/, "").replace(/\$/g, "").replace(/\\cdot|·|×/g, "*").replace(/÷/g, "/")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt").replace(/π/g, "pi").replace(/\bsen\b/g, "sin").replace(/,/g, ".").trim();
    const toks = [];
    const re = /\s*(?:(\d+(?:\.\d+)?)|(sqrt|sin|cos|tan|abs|log|ln|exp|pi|e|x)|([-+*/^()]))/y;
    let m, i = 0;
    while (i < e.length) {
      re.lastIndex = i; m = re.exec(e);
      if (!m || m[0].length === 0) { if (/\s/.test(e[i])) { i++; continue; } return null; }
      i = re.lastIndex;
      toks.push(m[1] ? ["n", parseFloat(m[1])] : m[2] ? (["pi", "e", "x"].includes(m[2]) ? ["v", m[2]] : ["f", m[2]]) : ["o", m[3]]);
    }
    // multiplicación implícita: 2x, 3(x+1), x(x-1), )(
    const t2 = [];
    toks.forEach((tk, k) => {
      const prev = t2[t2.length - 1];
      const prevEnds = prev && (prev[0] === "n" || prev[0] === "v" || (prev[0] === "o" && prev[1] === ")"));
      const starts = tk[0] === "n" || tk[0] === "v" || tk[0] === "f" || (tk[0] === "o" && tk[1] === "(");
      if (prevEnds && starts) t2.push(["o", "*"]);
      t2.push(tk); void k;
    });
    let p = 0;
    const peek = () => t2[p], take = () => t2[p++];
    const F = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, abs: Math.abs, log: Math.log10, ln: Math.log, exp: Math.exp };
    function expr() { let a = term(); while (peek() && peek()[0] === "o" && (peek()[1] === "+" || peek()[1] === "-")) { const o = take()[1], b = term(), l = a; a = o === "+" ? (x) => l(x) + b(x) : (x) => l(x) - b(x); } return a; }
    function term() { let a = unary(); while (peek() && peek()[0] === "o" && (peek()[1] === "*" || peek()[1] === "/")) { const o = take()[1], b = unary(), l = a; a = o === "*" ? (x) => l(x) * b(x) : (x) => l(x) / b(x); } return a; }
    function unary() { if (peek() && peek()[0] === "o" && peek()[1] === "-") { take(); const a = unary(); return (x) => -a(x); } if (peek() && peek()[0] === "o" && peek()[1] === "+") { take(); return unary(); } return power(); }
    function power() { const b = atom(); if (peek() && peek()[0] === "o" && peek()[1] === "^") { take(); const ex = unary(); return (x) => Math.pow(b(x), ex(x)); } return b; }
    function atom() {
      const tk = take();
      if (!tk) throw new Error("fin");
      if (tk[0] === "n") { const v = tk[1]; return () => v; }
      if (tk[0] === "v") return tk[1] === "x" ? (x) => x : tk[1] === "pi" ? () => Math.PI : () => Math.E;
      if (tk[0] === "f") { const f = F[tk[1]]; const a = atom(); return (x) => f(a(x)); }
      if (tk[0] === "o" && tk[1] === "(") { const a = expr(); const c = take(); if (!c || c[1] !== ")") throw new Error(")"); return a; }
      throw new Error("token");
    }
    try {
      const fn = expr();
      if (p !== t2.length) return null;
      const test = fn(1.234);
      return typeof test === "number" ? fn : null;
    } catch (er) { return null; }
  }
  /** Puntos para dibujar en [a, b], con cortes donde la función no existe o salta (asíntotas). */
  function samplePlot(fn, a = -10, b = 10, n = 400) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; let y = fn(x); if (!isFinite(y) || Math.abs(y) > 1e6) y = null; pts.push([x, y]); }
    const ys = pts.map((p) => p[1]).filter((y) => y != null).sort((u, v) => u - v);
    if (!ys.length) return { pts, ymin: -10, ymax: 10 };
    let lo = ys[Math.floor(ys.length * 0.03)], hi = ys[Math.ceil(ys.length * 0.97) - 1];
    if (hi - lo < 1e-6) { lo -= 1; hi += 1; }
    const pad = (hi - lo) * 0.12;
    return { pts, ymin: Math.min(lo - pad, 0 - pad * 0.2), ymax: Math.max(hi + pad, 0 + pad * 0.2) };
  }
  function graphIntent(text) {
    const a = cut(text, /\b(?:gr[aá]f[ií]ca(?:me)?|dibuja(?:me)?\s+(?:la\s+)?(?:gr[aá]f[ií]ca|funci[oó]n)(?:\s+de)?|plotea)\s*:?\s*(.+)$/i);
    if (!a) return null;
    const src = a[0].replace(/^(?:la\s+funci[oó]n|de)\s+/i, "");
    return compileFn(src) ? { kind: "graficar", expr: src.replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, "").trim() } : null;
  }

  // ======================================================================== OBSERVADOR, DIARIO, COMPROMISOS, PERIODO, HORARIO
  function dataIntent(text) {
    const t = norm(text);
    let a;
    if ((a = cut(text, /^(?:jarvis[,\s]+)?(?:anota|escribe|registra|pon)\s+en\s+el\s+observador\s+de\s+(.+?)\s+que\s+(.+)$/i))) return { kind: "obs_add", quien: a[0], texto: a[1] };
    if ((a = cut(t, /^(?:que hay|que tiene|muestrame|lee)\s+(?:en\s+)?el\s+observador\s+de\s+(.+)$/))) return { kind: "obs_ver", quien: a[0] };
    if ((a = cut(text, /^(?:jarvis[,\s]+)?hoy\s+en\s+(\S+)\s+(?:vimos|trabajamos|explique|expliqué|hicimos)\s+(.+)$/i))) return { kind: "diario_add", curso: a[0], texto: a[1] };
    if ((a = cut(t, /^(?:que (?:vimos|hemos visto|temas vimos|temas hemos visto)|que temas llevo|diario de clase)\s+(?:en|de|con)\s+(\S+)/))) return { kind: "diario_ver", curso: a[0] };
    if ((a = cut(text, /^(?:jarvis[,\s]+)?(?:qued[eé]\s+en|me\s+compromet[ií]\s+a|tengo\s+el\s+compromiso\s+de)\s+(.+)$/i))) return { kind: "comp_add", texto: a[0] };
    if (/^(?:que compromisos tengo|mis compromisos|que tengo pendiente|que debo)\b/.test(t)) return { kind: "comp_ver" };
    if ((a = cut(t, /^(?:ya\s+(?:le\s+)?(?:envie|mande|cumpli|hice|entregue|llame)|listo lo de|ya quedo lo de)\s+(.+)$/))) return { kind: "comp_ok", texto: a[0] };
    if ((a = cut(t, /\b(?:el\s+)?periodo\s+(?:termina|acaba|cierra)\s+el\s+(\d{1,2})\s+de\s+(\w+)/))) return { kind: "periodo_set", dia: +a[0], mes: a[1] };
    if (/\b(?:cuanto falta para (?:terminar|acabar|cerrar) el periodo|cuando (?:termina|acaba) el periodo)\b/.test(t)) return { kind: "periodo_ver" };
    if (/\b(?:que clase tengo|que clase sigue|cual es mi (?:siguiente|proxima) clase|a que curso voy|que tengo ahora)\b/.test(t)) return { kind: "clase_ahora" };
    if (/\b(?:como viene mi dia|que tengo hoy en el colegio|como esta mi dia)\b/.test(t)) return { kind: "mi_dia" };
    if ((a = cut(t, /^(?:cuanto necesita|que nota necesita|cuanto le falta a)\s+(.+?)\s+(?:para pasar|para ganar|para aprobar)/))) return { kind: "necesita", quien: a[0] };
    if (/\b(?:quienes pueden perder|quien puede perder|quienes van perdiendo) (?:el ano|el periodo|la materia)\b/.test(t)) return { kind: "riesgo_ano" };
    if (/\b(?:quien(?:es)? (?:viene|vienen) bajando|quien(?:es)? (?:ha|han) bajado)\b/.test(t)) return { kind: "tendencia", dir: "baja" };
    if (/\b(?:a quien(?:es)? (?:debo|puedo|hay que) felicitar|quien(?:es)? (?:viene|vienen) subiendo|quien(?:es)? (?:ha|han) mejorado)\b/.test(t)) return { kind: "tendencia", dir: "sube" };
    if ((a = cut(t, /^(?:ficha de|muestrame a|muestrame la ficha de|todo sobre)\s+(.+)$/))) return { kind: "ficha", quien: a[0] };
    if ((a = cut(t, /^(?:ponte|se|sé|habla|cambia a(?: modo)?)\s+(relajado|serio|formal|motivador|divertido|calmado|normal|amable|breve)\b/))) return { kind: "personalidad", modo: a[0] };
    if ((a = cut(t, /^(?:estamos en|ahora estoy en|cambia a la asignatura de|la clase es de)\s+(matematicas|tecnologia|informatica|fisica|quimica|estadistica|geometria|ciencias|espanol|ingles|sociales|artes|\w+)$/))) return { kind: "asignatura", asig: a[0] };
    if (/\b(?:en que asignatura estamos|que asignatura)\b/.test(t)) return { kind: "asignatura", asig: "" };
    if (/\b(?:que hiciste hoy|que has hecho hoy|resumen de hoy|que hicimos hoy)\b/.test(t)) return { kind: "hoy_hice" };
    if (/\b(?:resumen semanal|resumen de la semana|como me fue (?:esta|en la) semana)\b/.test(t)) return { kind: "semanal" };
    if (/\b(?:retrospectiva|balance del (?:ano|periodo))\b/.test(t)) return { kind: "retro" };
    if (/\b(?:mapa de errores|errores mas comunes|en que se equivocan)\b/.test(t)) return { kind: "errores" };
    if ((a = cut(text, /\b(?:tarjetas|flashcards|fichas)\s+(?:de\s+estudio\s+)?(?:de|sobre)\s+(.+)$/i))) return { kind: "tarjetas", tema: a[0] };
    if ((a = cut(text, /\b(?:simulacro|prueba)\s+(?:tipo\s+)?(?:saber|icfes)(?:\s+(?:de|sobre|para)\s+(.+))?$/i))) return { kind: "saber", tema: a[0] || "" };
    if ((a = cut(text, /^(?:jarvis[,\s]+)?(?:investiga(?:\s+a\s+fondo)?|busca\s+en\s+internet|averigua|consulta\s+en\s+internet|qu[eé]\s+(?:dice|hay de nuevo en)\s+internet\s+sobre)\s+(.+)$/i))) return { kind: "investigar", q: a[0], fondo: /a fondo/i.test(text) };
    return null;
  }
  const MESES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  function periodEnd(dia, mes, now = new Date()) {
    const m = MESES[norm(mes)];
    if (m == null) return null;
    let d = new Date(now.getFullYear(), m, dia, 23, 59);
    if (d < now - 864e5 * 30) d = new Date(now.getFullYear() + 1, m, dia, 23, 59);
    return d;
  }
  /** Horario escrito como «lunes 7:00-7:55 7A», una clase por línea (también «lun 7-8 10B Álgebra»). */
  const DIAS = { lunes: 1, lun: 1, martes: 2, mar: 2, miercoles: 3, mie: 3, jueves: 4, jue: 4, viernes: 5, vie: 5, sabado: 6, sab: 6, domingo: 0, dom: 0 };
  function parseSchedule(text) {
    const out = [];
    String(text || "").split(/\n+/).forEach((ln) => {
      const t = norm(ln);
      const m = t.match(/^(lunes|lun|martes|mar|miercoles|mie|jueves|jue|viernes|vie|sabado|sab|domingo|dom)\s+(\d{1,2})(?::(\d{2}))?\s*(?:-|a|hasta)\s*(\d{1,2})(?::(\d{2}))?\s+(.+)$/);
      if (!m) return;
      const ini = +m[2] * 60 + (+m[3] || 0), fin = +m[4] * 60 + (+m[5] || 0);
      if (fin <= ini) return;
      const rest = String(ln).trim().split(/\s+/).slice(-m[6].split(" ").length).join(" ");
      out.push({ dia: DIAS[m[1]], ini, fin, que: rest });
    });
    return out.sort((a, b) => a.dia - b.dia || a.ini - b.ini);
  }
  const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  function classNow(sched, now = new Date()) {
    const d = now.getDay(), m = now.getHours() * 60 + now.getMinutes();
    const today = sched.filter((c) => c.dia === d);
    const cur = today.find((c) => c.ini <= m && m < c.fin);
    const next = today.find((c) => c.ini > m);
    return { ahora: cur ? Object.assign({ falta: cur.fin - m }, cur) : null, siguiente: next ? Object.assign({ en: next.ini - m }, next) : null, hoy: today };
  }
  function classNowSpoken(sched, now = new Date()) {
    if (!sched.length) return "No tengo tu horario. Escríbelo en Ajustes › Horario (una clase por línea, por ejemplo «lunes 7:00-7:55 7A»).";
    const c = classNow(sched, now);
    const p = [];
    if (c.ahora) p.push(`Ahora tienes ${c.ahora.que}, hasta las ${hhmm(c.ahora.fin)} (faltan ${c.ahora.falta} minutos).`);
    if (c.siguiente) p.push(`${c.ahora ? "Luego" : "Tu siguiente clase es"} ${c.siguiente.que} a las ${hhmm(c.siguiente.ini)}${c.siguiente.en <= 90 ? `, en ${c.siguiente.en} minutos` : ""}.`);
    if (!p.length) p.push(c.hoy.length ? "Ya terminaste las clases de hoy." : "Hoy no tienes clases en tu horario.");
    return p.join(" ");
  }

  // ======================================================================== NOTAS: CUÁNTO NECESITA, TENDENCIAS, PERDER EL AÑO
  /** Nota que necesita en la próxima actividad (del mismo peso que el promedio de pesos) para llegar a «básico». */
  function neededToPass(notas, name, basico = 3.0) {
    const v = (notas.valores || {})[name] || {};
    let sum = 0, w = 0;
    notas.actividades.forEach((a) => { if (typeof v[a.id] === "number") { const p = a.peso > 0 ? a.peso : 1; sum += v[a.id] * p; w += p; } });
    if (!w) return { sinNotas: true };
    const prom = sum / w;
    if (prom >= basico) return { ya: true, promedio: Math.round(prom * 100) / 100 };
    const pw = w / Math.max(1, notas.actividades.filter((a) => typeof v[a.id] === "number").length);
    const need = (basico * (w + pw) - sum) / pw;
    return { promedio: Math.round(prom * 100) / 100, necesita: Math.round(need * 10) / 10, posible: need <= 5 };
  }
  /** Compara la última actividad con el promedio de las anteriores. → [{nombre, cambio}] (de mayor a menor cambio). */
  function trends(course, dir) {
    const n = course.notas || { actividades: [], valores: {} };
    if (n.actividades.length < 2) return [];
    const last = n.actividades[n.actividades.length - 1], prev = n.actividades.slice(0, -1);
    const out = [];
    (course.estudiantes || []).forEach((name) => {
      const v = n.valores[name] || {};
      if (typeof v[last.id] !== "number") return;
      const ps = prev.map((a) => v[a.id]).filter((x) => typeof x === "number");
      if (!ps.length) return;
      const base = ps.reduce((a, b) => a + b, 0) / ps.length, ch = Math.round((v[last.id] - base) * 10) / 10;
      if ((dir === "baja" && ch <= -0.5) || (dir === "sube" && ch >= 0.5)) out.push({ nombre: name, cambio: ch, ultima: v[last.id], actividad: last.nombre });
    });
    return out.sort((a, b) => (dir === "baja" ? a.cambio - b.cambio : b.cambio - a.cambio));
  }
  /** Para el informe a la familia, sin el nombre: actividades y notas. */
  function anonGrades(notas, name) {
    const v = (notas.valores || {})[name] || {};
    return notas.actividades.map((a) => `${a.nombre}: ${typeof v[a.id] === "number" ? String(v[a.id]).replace(".", ",") : "sin nota"}`).join("; ");
  }
  const PERSONAS = {
    relajado: "Habla relajado y cercano, con humor suave.", serio: "Habla serio y directo, sin bromas.", formal: "Habla formal y respetuoso.",
    motivador: "Habla con energía y motivación, celebra los logros.", divertido: "Habla divertido, con humor sano.", calmado: "Habla con calma y pausado.",
    amable: "Habla muy amable y paciente.", breve: "Responde lo más corto posible.", normal: "",
  };

  return { DOCS, docIntent, docById, cardsPrompt, cleanCards, ankiTSV, kahootRows, compileFn, samplePlot, graphIntent, dataIntent, periodEnd, parseSchedule,
    classNow, classNowSpoken, hhmm, neededToPass, trends, anonGrades, PERSONAS };
});
