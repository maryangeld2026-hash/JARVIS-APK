/* Jarvis para Android 2.0 · lógica pura nueva: seguimiento de notas, memoria, tutor, paso a paso, ticket de salida,
   Google (Calendario, Classroom, Forms, Drive), el Jarvis del computador y la palabra «Jarvis». Probada con node.
   Igual que logica.js: lo que devuelve la IA se valida aquí; nunca se ejecuta código suyo. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./logica.js"));
  else root.JL2 = factory(root.JL);
})(typeof self !== "undefined" ? self : this, function (L) {
  "use strict";
  const norm = L.norm;
  const s = (x, max) => String(x == null ? "" : x).replace(/\s+/g, " ").trim().slice(0, max);
  const num = (v) => {
    if (typeof v === "number") return isFinite(v) ? v : null;
    const t = String(v == null ? "" : v).trim().replace(",", ".");
    return /^\d+(?:\.\d+)?$/.test(t) ? parseFloat(t) : null;
  };

  // ======================================================================== SEGUIMIENTO DE NOTAS
  /* Un curso guarda: notas = {actividades: [{id, nombre, peso}], valores: {estudiante: {idActividad: nota}}} */
  const SKIP_COL = /^(?:n|no|nro|num|numero|#|item|codigo|cod|id|documento|doc|identificacion|ti|cc|tipo|genero|sexo|edad|grado|curso|grupo|observaciones?|obs)$/;
  const FINAL_COL = /\b(?:definitiva|promedio|final|nota final|acumulado|total|desempeno|valoracion)\b/;
  /** De las filas de una hoja (lista de listas) → {estudiantes, actividades, valores} o {error}. */
  function sheetToGrades(rows, maxNota = 5) {
    rows = (rows || []).map((r) => (r || []).map((c) => (c == null ? "" : c)));
    let h = rows.findIndex((r) => r.filter((c) => String(c).trim()).length >= 2 && r.some((c) => /nombre|estudiante|alumno|apellido/i.test(String(c))));
    if (h < 0) h = 0;
    const head = rows[h].map((c) => norm(c));
    const body = rows.slice(h + 1).filter((r) => r.some((c) => String(c).trim()));
    const nameCols = head.map((c, i) => (/nombre|estudiante|alumno|apellido/.test(c) ? i : -1)).filter((i) => i >= 0);
    let nc = nameCols;
    if (!nc.length) {                                                    // sin rótulos: la columna con más texto
      let best = -1, col = 0;
      head.forEach((_, k) => { const n = body.filter((r) => /[a-záéíóúñ]{3}/i.test(String(r[k] || "")) && num(r[k]) == null).length; if (n > best) { best = n; col = k; } });
      nc = [col];
    }
    // «Apellidos» antes que «Nombres» se juntan en ese orden, como en la planilla
    const est = [], valores = {};
    const acts = [];
    head.forEach((c, k) => {
      if (nc.includes(k) || SKIP_COL.test(c) || FINAL_COL.test(c)) return;
      const vals = body.map((r) => num(r[k])).filter((v) => v != null);
      if (vals.length < Math.max(1, body.length * 0.3) || vals.some((v) => v < 0 || v > maxNota)) return;
      acts.push({ id: "a" + k, nombre: s(rows[h][k], 60) || `Nota ${acts.length + 1}`, peso: 1, col: k });
    });
    body.forEach((r) => {
      const name = s(nc.map((k) => r[k]).filter((x) => String(x).trim()).join(" "), 80);
      if (!/[a-záéíóúñ]{2}/i.test(name) || num(name) != null) return;
      if (est.includes(name)) return;
      est.push(name);
      const v = {};
      acts.forEach((a) => { const x = num(r[a.col]); if (x != null) v[a.id] = Math.round(x * 100) / 100; });
      valores[name] = v;
    });
    if (!est.length) return { error: "No encontré la columna de los nombres de los estudiantes en esa hoja." };
    return { estudiantes: est, actividades: acts.map(({ id, nombre, peso }) => ({ id, nombre, peso })), valores };
  }
  /** Promedio ponderado del estudiante (solo actividades con nota). null si no tiene notas. */
  function average(notas, name) {
    const v = (notas && notas.valores && notas.valores[name]) || {};
    let sum = 0, w = 0;
    ((notas && notas.actividades) || []).forEach((a) => { const x = v[a.id]; if (typeof x === "number") { const p = a.peso > 0 ? a.peso : 1; sum += x * p; w += p; } });
    return w ? Math.round((sum / w) * 100) / 100 : null;
  }
  /** Resumen del curso: promedio, quiénes van en riesgo (por debajo de básico o con muchas notas bajas) y faltantes. */
  function courseStats(course, esc) {
    const e = Object.assign({ basico: 3.0, alto: 4.0, superior: 4.6 }, esc || {});
    const notas = course.notas || { actividades: [], valores: {} };
    const rows = (course.estudiantes || []).map((n) => {
      const v = (notas.valores || {})[n] || {};
      const prom = average(notas, n);
      const bajas = notas.actividades.filter((a) => typeof v[a.id] === "number" && v[a.id] < e.basico).length;
      const falta = notas.actividades.filter((a) => typeof v[a.id] !== "number").length;
      return { nombre: n, promedio: prom, desempeno: L.performance(prom, e), bajas, faltan: falta };
    });
    const conNota = rows.filter((r) => r.promedio != null);
    const prom = conNota.length ? Math.round(conNota.reduce((a, r) => a + r.promedio, 0) / conNota.length * 100) / 100 : null;
    const riesgo = rows.filter((r) => (r.promedio != null && r.promedio < e.basico) || (r.bajas >= 2 && r.bajas >= notas.actividades.length / 2))
      .sort((a, b) => (a.promedio ?? 9) - (b.promedio ?? 9));
    const dist = { bajo: 0, "básico": 0, alto: 0, superior: 0 };
    conNota.forEach((r) => { dist[r.desempeno] = (dist[r.desempeno] || 0) + 1; });
    return { filas: rows, promedio: prom, riesgo, distribucion: dist, actividades: notas.actividades.length };
  }
  function fmtNota(x) { return x == null ? "—" : (Math.round(x * 10) / 10).toFixed(1).replace(".", ","); }
  /** Encuentra al estudiante que nombraste (nombre, apellido o parte), en el curso que sea. */
  function findStudent(courses, text) {
    const t = " " + norm(text) + " ";
    let best = null, score = 0;
    (courses || []).forEach((c) => (c.estudiantes || []).forEach((n) => {
      const parts = norm(n).split(" ").filter((p) => p.length >= 3);
      const hit = parts.filter((p) => t.includes(" " + p + " ")).length;
      const sc = t.includes(" " + norm(n) + " ") ? 10 : hit && hit === parts.length ? 9 : hit;   // «Beto Díaz» = «Díaz Beto»
      if (sc > score) { score = sc; best = { curso: c, nombre: n }; }                               // en empate gana el primer curso (el actual)
    }));
    return score > 0 ? best : null;
  }
  /** «ponle 4,5 a Ana Rojas en el taller 2» → {nota, actividad, texto} */
  function parseGradeEntry(text) {
    const t = norm(text);
    const m = t.match(/^(?:ponle|pon(?:le)?|anota(?:le)?|registra(?:le)?|calificale)\s+(?:un\s+|una\s+)?(\d(?:[.,]\d{1,2})?)\s+(?:a|al|para)\s+(.+?)\s+(?:en|de|del)\s+(?:el\s+|la\s+)?(.+)$/);
    if (!m) return null;
    const nota = num(m[1]);
    if (nota == null || nota > 5) return null;
    return { nota, quien: m[2], actividad: m[3] };
  }
  function findActivity(notas, text) {
    const t = norm(text);
    return ((notas && notas.actividades) || []).find((a) => norm(a.nombre) === t) || ((notas && notas.actividades) || []).find((a) => norm(a.nombre).includes(t) || t.includes(norm(a.nombre))) || null;
  }
  /** Tabla para Excel/CSV: nombre, cada actividad, promedio y desempeño. */
  function gradeTable(course, esc) {
    const st = courseStats(course, esc), acts = (course.notas || {}).actividades || [];
    const head = ["Estudiante"].concat(acts.map((a) => a.nombre), ["Promedio", "Desempeño"]);
    const rows = st.filas.map((r) => [r.nombre].concat(acts.map((a) => { const x = ((course.notas.valores || {})[r.nombre] || {})[a.id]; return typeof x === "number" ? x : ""; }), [r.promedio ?? "", r.desempeno]));
    return [head].concat(rows);
  }

  // ======================================================================== MEMORIA
  function memoryIntent(text) {
    const t = norm(text);
    let m;
    if (/^(?:que sabes de mi|que recuerdas de mi|que te he ensenado|que lecciones tienes)$/.test(t)) return { kind: "mem_ver" };
    if ((m = t.match(/^(?:olvida|borra de tu memoria|ya no recuerdes)\s+(?:que\s+|lo de\s+)?(.{3,})$/))) return { kind: "mem_olvidar", texto: m[1] };
    if ((m = text.match(/^\s*(?:jarvis[,\s]+)?(?:de ahora en adelante|a partir de ahora|siempre que|cuando te pida|nunca)\b[\s,]*(.{6,})$/i))) return { kind: "leccion", texto: s(text.replace(/^\s*jarvis[,\s]+/i, ""), 300) };
    if ((m = text.match(/^\s*(?:jarvis[,\s]+)?(?:recuerda|recuérdalo|apunta|ten en cuenta|que no se te olvide)\s+(?:que\s+)?(.{4,})$/i)) && !/^\s*(?:jarvis[,\s]+)?recu[eé]rdame\b/i.test(text))
      return { kind: "mem_guardar", texto: s(m[1].replace(/[.]+$/, ""), 300) };
    return null;
  }
  /** Lo que se manda a la IA: las lecciones siempre; los datos, los que tienen que ver con la pregunta (o los más recientes). */
  function memoryContext(mem, lecciones, question, max = 1800) {
    const q = new Set(norm(question).split(" ").filter((w) => w.length >= 4));
    const rel = (mem || []).map((m) => ({ m, sc: norm(m.texto).split(" ").filter((w) => q.has(w)).length })).sort((a, b) => b.sc - a.sc || b.m.t - a.m.t);
    let out = "";
    if ((lecciones || []).length) out += " Lecciones que la profe te enseñó (síguelas siempre): " + lecciones.slice(-15).map((l, i) => `(${i + 1}) ${l.texto}`).join(" ") + ".";
    const facts = rel.filter((x, i) => x.sc > 0 || i < 8).map((x) => x.m.texto);
    if (facts.length) out += " Lo que sabes de la profe: " + facts.join("; ") + ".";
    return out.slice(0, max);
  }

  // ======================================================================== ÓRDENES NUEVAS (2.0)
  function intent2(text, courses) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis|hola jarvis)\s+/, "");
    if (!t) return null;
    const course = L.findCourse(courses, t);
    let m;
    const mem = memoryIntent(text);
    if (mem) return mem;
    if ((m = t.match(/^(?:en el (?:computador|pc|portatil)|dile al (?:computador|pc)(?: que)?|en mi (?:computador|pc))[\s,:]+(.{3,})$/))) return { kind: "pc", orden: text.replace(/^.*?(?:computador|pc|port[aá]til)(?:\s+que)?[\s,:]+/i, "").trim() };
    if (/\b(?:sal del modo proyector|quita el proyector|cierra el proyector)\b/.test(t)) return { kind: "proyector_cerrar" };
    if (/\b(?:sal del modo tutor|desactiva el (?:modo )?tutor|quita el (?:modo )?tutor)\b/.test(t)) return { kind: "tutor_off" };
    if (/\b(?:modo proyector|proyecta(?:lo)?|ponlo en el (?:televisor|proyector|tablero)|pantalla grande)\b/.test(t)) return { kind: "proyector", que: /quiz/.test(t) ? "quiz" : /grupo/.test(t) ? "grupos" : /tiempo|reloj|temporizador/.test(t) ? "tiempo" : /paso/.test(t) ? "pasos" : /ticket/.test(t) ? "ticket" : "" };
    if ((m = t.match(/\b(?:modo tutor|activa el tutor|se mi tutor|tutor socratico)\b(?:\s+(?:de|para|en)\s+(.+))?/))) return { kind: "tutor", tema: m[1] || "" };
    if ((m = t.match(/\b(?:explica(?:me|le|les)?|resuelve(?:me)?|muestra(?:me)?)\s+(?:como resolver\s+|como se resuelve\s+|como hacer\s+)?(?:paso a paso|por pasos)\s*(?:como\s+)?(.*)$/)) ||
        (m = t.match(/\b(?:paso a paso|por pasos)\s+(?:de\s+|como\s+)?(.+)$/))) return { kind: "pasos", tema: (m[1] || "").replace(/^(?:como|el|la|los|las)\s+/, "").trim() || text };
    if ((m = t.match(/\b(?:ticket|boleto|tiquete) de salida\b(?:\s+(?:de|sobre)\s+(.+))?/))) return { kind: "ticket", tema: m[1] || "", curso: course && course.id };
    if (/\b(?:quien(?:es)? (?:esta|estan|va|van) (?:en riesgo|mal|perdiendo)|estudiantes en riesgo|quien(?:es)? (?:pierde|pierden)|como va(?:n)? (?:el curso|el grupo|el grado)|como va \d{1,2}\s*[a-d]?\b)/.test(t))
      return { kind: "riesgo", curso: course && course.id };
    if ((m = t.match(/\b(?:promedio|como va(?: el promedio)?) (?:de|del)\s+(?:curso\s+)?(.+)$/)) && course) return { kind: "riesgo", curso: course.id };
    if ((m = t.match(/^(?:como va|como le va a|como esta|notas de|que notas tiene|cual es el promedio de)\s+(.+)$/))) return { kind: "estudiante", quien: m[1] };
    if (parseGradeEntry(text)) return Object.assign({ kind: "poner_nota" }, parseGradeEntry(text));
    if (/\b(?:manos libres|escuchame siempre|quedate escuchando)\b/.test(t)) return { kind: "manos_libres", on: !/\b(?:apaga|quita|desactiva|deja de)\b/.test(t) };
    if (/\b(?:burbuja|boton flotante)\b/.test(t)) return { kind: "burbuja", on: !/\b(?:quita|oculta|apaga|cierra)\b/.test(t) };
    if (/\b(?:que tengo (?:hoy|manana|esta semana)|mi agenda|mi calendario|que hay en (?:el|mi) calendario|que eventos tengo)\b/.test(t)) return { kind: "agenda", dia: /manana/.test(t) ? 1 : /semana/.test(t) ? 7 : 0 };
    if ((m = t.match(/^(?:agenda(?:me)?|pon en (?:el|mi) calendario|crea un evento)\s+(.+)$/))) return { kind: "agendar", frase: text };
    if (/\b(?:classroom)\b/.test(t) && /\b(?:trae|importa|carga|baja|pasa)\b/.test(t)) return { kind: "classroom" };
    if (/\b(?:forms|formulario)\b/.test(t) && /\b(?:pasa|crea|haz|sube|convierte|manda)\b/.test(t)) return { kind: "forms" };
    if (/\bword\b/.test(t) && /\b(?:quiz|taller|evaluacion)\b/.test(t)) return { kind: "word" };
    if (/\b(?:sincroniza|guarda en drive|copia en drive|respalda en drive)\b/.test(t)) return { kind: "drive" };
    return null;
  }

  // ======================================================================== TUTOR, PASO A PASO, TICKET
  function tutorRule(tema) {
    return " MODO TUTOR SOCRÁTICO" + (tema ? ` de ${tema}` : "") + ": hablas con estudiantes. Nunca des la respuesta final de un ejercicio: " +
      "guía con preguntas cortas, una a la vez, da pistas graduales, celebra los avances y corrige el error con otra pregunta. Usa ejemplos cotidianos de Colombia.";
  }
  function stepsPrompt(tema) {
    return `Explica paso a paso, para estudiantes de colegio, en español de Colombia: «${tema}». Entre 3 y 8 pasos; cada paso con un título corto y ` +
      "una explicación de una o dos frases (fórmulas en LaTeX entre $…$). Termina con un paso «Comprobación» si aplica. " +
      'Devuelve SOLO JSON: {"titulo": "…", "pasos": [{"titulo": "…", "explicacion": "…"}]}';
  }
  function cleanSteps(obj) {
    if (!obj || !Array.isArray(obj.pasos)) return { error: "La IA no devolvió los pasos con el formato esperado." };
    const pasos = obj.pasos.map((p) => ({ titulo: s(p && p.titulo, 120), explicacion: s(p && (p.explicacion || p.texto), 700) })).filter((p) => p.titulo || p.explicacion).slice(0, 10);
    if (!pasos.length) return { error: "La IA no devolvió pasos." };
    return { pasos: { titulo: s(obj.titulo, 120) || "Paso a paso", pasos } };
  }
  function ticketPrompt(tema) {
    return `Crea un ticket de salida de 3 preguntas cortas sobre «${tema}» para verificar si los estudiantes entendieron la clase de hoy: ` +
      "una de recordar, una de aplicar y una de explicar con sus palabras. Fórmulas en LaTeX entre $…$. " +
      'Devuelve SOLO JSON: {"titulo": "…", "preguntas": ["…", "…", "…"]}';
  }
  function cleanTicket(obj) {
    const qs = (obj && Array.isArray(obj.preguntas) ? obj.preguntas : []).map((q) => s(typeof q === "string" ? q : q && (q.enunciado || q.pregunta), 300)).filter(Boolean).slice(0, 5);
    if (!qs.length) return { error: "La IA no devolvió el ticket." };
    return { ticket: { titulo: s(obj.titulo, 100) || "Ticket de salida", preguntas: qs } };
  }

  // ======================================================================== PALABRA «JARVIS» (manos libres)
  /** «Jarvis, abre…», «yarvis pon…», «oye Jarvis…» → el resto ("" si solo dijo Jarvis), o null si no te dirigías a Jarvis. */
  function afterWake(text) {
    const t = norm(text);
    const m = t.match(/^(?:oye\s+|hola\s+|ey\s+|ya\s+)?(?:jarvis|yarvis|jarvi|harvis|charvis|jarbis|yarbis|jervis|travis)\b[\s,]*(.*)$/);
    return m ? m[1].trim() : null;
  }

  // ======================================================================== EL JARVIS DEL COMPUTADOR
  /** La dirección del panel del celular del computador (http://192.168.1.20:8766/?k=…) → {base, token} */
  function pcLink(url) {
    try {
      const u = new URL(String(url || "").trim());
      const k = u.searchParams.get("k") || "";
      if (!/^https?:$/.test(u.protocol) || !k) return null;
      return { base: `${u.protocol}//${u.host}`, token: k };
    } catch (e) { return null; }
  }

  // ======================================================================== GOOGLE (peticiones REST con el permiso de tu cuenta)
  const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly", "https://www.googleapis.com/auth/forms.body", "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/drive.file"];
  function dayRange(now, days) {
    const a = new Date(now.getTime()); a.setHours(0, 0, 0, 0);
    if (days === 1) a.setDate(a.getDate() + 1);
    const b = new Date(a.getTime()); b.setDate(b.getDate() + (days === 7 ? 7 : 1));
    return [a, b];
  }
  function calendarListURL(now, days) {
    const [a, b] = dayRange(now, days);
    return "https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=25" +
      `&timeMin=${encodeURIComponent(a.toISOString())}&timeMax=${encodeURIComponent(b.toISOString())}`;
  }
  function eventsSpoken(json, now) {
    const items = (json && json.items) || [];
    if (!items.length) return "No tienes eventos en el calendario para ese día.";
    return items.slice(0, 10).map((e) => {
      const st = e.start && (e.start.dateTime || e.start.date);
      const d = st ? new Date(st) : null;
      const when = e.start && e.start.dateTime ? L.spokenWhen(d, now) : "todo el día";
      return `- ${s(e.summary, 120) || "(sin título)"} · ${when}`;
    }).join("\n");
  }
  /** «agenda reunión de padres mañana a las 3» → cuerpo del evento (1 hora) */
  function eventFromText(text, now = new Date()) {
    const r = L.parseReminder("recuérdame " + String(text).replace(/^\s*(?:jarvis[,\s]+)?(?:agenda(?:me)?|pon en (?:el|mi) calendario|crea un evento(?: de| para)?)\s+/i, ""), now);
    if (!r || !r.cuando || !r.texto) return null;
    const end = new Date(r.cuando.getTime() + 3600e3);
    return { summary: r.texto, start: { dateTime: r.cuando.toISOString() }, end: { dateTime: end.toISOString() } };
  }
  function rosterNames(json) {
    return ((json && json.students) || []).map((st) => s(st.profile && st.profile.name && (st.profile.name.fullName || [st.profile.name.givenName, st.profile.name.familyName].filter(Boolean).join(" ")), 80)).filter(Boolean);
  }
  /** Un quiz → las peticiones de Forms: crear el formulario y luego volverlo cuestionario con sus preguntas y la clave. */
  function formsRequests(quiz) {
    const create = { info: { title: quiz.titulo, documentTitle: quiz.titulo } };
    const requests = [{ updateSettings: { settings: { quizSettings: { isQuiz: true } }, updateMask: "quizSettings.isQuiz" } }];
    if (quiz.instrucciones) requests.push({ updateFormInfo: { info: { description: quiz.instrucciones }, updateMask: "description" } });
    requests.push({ createItem: { item: { title: "Nombre completo", questionItem: { question: { required: true, textQuestion: { paragraph: false } } } }, location: { index: 0 } } });
    quiz.preguntas.forEach((q, i) => {
      const opts = q.opciones.map((o) => L.plainMath(o));
      requests.push({ createItem: { location: { index: i + 1 }, item: { title: L.plainMath(q.enunciado), questionItem: { question: { required: true,
        grading: { pointValue: 1, correctAnswers: { answers: [{ value: opts[q.correcta] }] }, ...(q.explicacion ? { whenRight: { text: L.plainMath(q.explicacion) }, whenWrong: { text: L.plainMath(q.explicacion) } } : {}) },
        choiceQuestion: { type: "RADIO", options: opts.map((value) => ({ value })), shuffle: true } } } } } });
    });
    return { create, batch: { requests } };
  }
  /** Copia en Drive (carpeta privada de la app): multipart para crear o reemplazar el archivo. */
  function driveMultipart(json, name = "jarvis-android-copia.json", parents = ["appDataFolder"]) {
    const b = "jarvis" + Math.random().toString(36).slice(2);
    const meta = JSON.stringify(parents ? { name, parents } : { name });
    return { boundary: b, body: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--` };
  }

  return { sheetToGrades, average, courseStats, fmtNota, findStudent, parseGradeEntry, findActivity, gradeTable, memoryIntent, memoryContext, intent2,
    tutorRule, stepsPrompt, cleanSteps, ticketPrompt, cleanTicket, afterWake, pcLink, SCOPES, calendarListURL, eventsSpoken, eventFromText, rosterNames,
    formsRequests, driveMultipart };
});
