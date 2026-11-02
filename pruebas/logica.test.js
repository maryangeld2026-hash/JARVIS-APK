// Pruebas de la lógica de Jarvis para Android:  node --test pruebas/logica.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica.js");

const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const CURSOS = [{ id: "c1", nombre: "7A", estudiantes: ["Ana Rojas", "Beto Díaz", "Caro Gil", "Dani Ruiz", "Eva Mora"] },
  { id: "c2", nombre: "10B", estudiantes: ["Juan", "Luis"] }];

test("nombres pegados y de una planilla", () => {
  assert.deepEqual(L.parseNames("1. Ana Rojas\n2) Beto Díaz\n- Caro Gil; ana rojas\n\nNombre"), ["Ana Rojas", "Beto Díaz", "Caro Gil"]);
  assert.deepEqual(L.parseNames("Ana, Beto, Caro"), ["Ana", "Beto", "Caro"]);
  assert.deepEqual(L.namesFromTable("Código;Apellidos;Nombres;Nota\n1;Rojas;Ana;4\n2;Díaz;Beto;3"), ["Rojas Ana", "Díaz Beto"]);
  assert.deepEqual(L.namesFromTable("Estudiante,Nota\nAna Rojas,4.5\nBeto Díaz,3.2"), ["Ana Rojas", "Beto Díaz"]);
  assert.equal(L.findCourse(CURSOS, "escoge un estudiante de 7a").id, "c1");
  assert.equal(L.findCourse(CURSOS, "haz grupos en 10B").id, "c2");
  assert.equal(L.findCourse(CURSOS, "haz grupos"), null);
});

test("estudiante al azar sin repetir hasta que pasen todos", () => {
  const names = CURSOS[0].estudiantes;
  let usados = [], vistos = new Set();
  for (let i = 0; i < 5; i++) { const r = L.pickStudent(names, usados); usados = r.usados; vistos.add(r.name); }
  assert.equal(vistos.size, 5);
  const r = L.pickStudent(names, usados);
  assert.equal(r.reinicio, true);
  assert.equal(r.usados.length, 1);
  assert.equal(L.pickStudent([], []), null);
});

test("grupos equilibrados", () => {
  const names = Array.from({ length: 23 }, (_, i) => "E" + i);
  const g = L.makeGroups(names, { grupos: 5 }, seq(0.3, 0.7, 0.1));
  assert.equal(g.length, 5);
  assert.deepEqual(g.map((x) => x.length).sort(), [4, 5, 5, 5, 4].sort());
  assert.equal(new Set(g.flat()).size, 23);
  assert.equal(L.makeGroups(names, { tamano: 2 }).length, 12);
  assert.equal(L.makeGroups(["a", "b"], { grupos: 9 }).length, 2);
});

test("duraciones", () => {
  assert.equal(L.parseDuration("pon un temporizador de 5 minutos"), 300);
  assert.equal(L.parseDuration("un minuto y medio"), 90);
  assert.equal(L.parseDuration("media hora"), 1800);
  assert.equal(L.parseDuration("90 segundos"), 90);
  assert.equal(L.parseDuration("dos minutos y 30 segundos"), 150);
  assert.equal(L.parseDuration("temporizador de diez"), 600);
  assert.equal(L.parseDuration("2:30"), 150);
  assert.equal(L.parseDuration("hola"), null);
  assert.equal(L.fmtClock(125), "2:05");
  assert.equal(L.spokenDuration(90), "un minuto y 30 segundos");
});

test("recordatorios", () => {
  const now = new Date(2026, 10, 2, 11, 0, 0);
  let r = L.parseReminder("recuérdame llamar a la coordinadora a las 3 de la tarde", now);
  assert.equal(r.texto, "Llamar a la coordinadora");
  assert.equal(r.cuando.getHours(), 15);
  r = L.parseReminder("recuérdame revisar los cuadernos en 20 minutos", now);
  assert.equal(r.cuando.getTime() - now.getTime(), 20 * 60000);
  assert.equal(r.texto, "Revisar los cuadernos");
  r = L.parseReminder("recuérdame mañana a las 7 llevar las guías", now);
  assert.equal(r.cuando.getDate(), 3);
  assert.equal(r.cuando.getHours(), 7);
  assert.equal(r.texto, "Llevar las guías");
  r = L.parseReminder("recuérdame a las 3 la reunión", now);                // a las 3 sin «de la tarde», ya pasaron las 11: es de la tarde
  assert.equal(r.cuando.getHours(), 15);
  r = L.parseReminder("recuérdame comprar marcadores", now);
  assert.equal(r.falta, "hora");
  assert.equal(L.parseReminder("qué hora es", now), null);
  assert.match(L.spokenWhen(new Date(2026, 10, 2, 15, 30), now), /^hoy a las 3:30 de la tarde/);
});

test("órdenes de la clase", () => {
  assert.deepEqual(L.intent("Jarvis, escoge un estudiante de 7A", CURSOS), { kind: "azar", curso: "c1" });
  assert.deepEqual(L.intent("¿quién pasa al tablero?", CURSOS), { kind: "azar", curso: null });
  assert.deepEqual(L.intent("haz 5 grupos en 7A", CURSOS), { kind: "grupos", grupos: 5, tamano: null, curso: "c1" });
  assert.deepEqual(L.intent("forma grupos de tres", CURSOS), { kind: "grupos", tamano: 3, curso: null });
  assert.equal(L.intent("hazme parejas", CURSOS).tamano, 2);
  assert.deepEqual(L.intent("pon un temporizador de 5 minutos", CURSOS), { kind: "tiempo", segundos: 300 });
  assert.deepEqual(L.intent("dales diez minutos", CURSOS), { kind: "tiempo", segundos: 600 });
  assert.equal(L.intent("para el temporizador", CURSOS).kind, "tiempo_parar");
  assert.equal(L.intent("¿cuánto falta?", CURSOS).kind, "tiempo_falta");
  assert.equal(L.intent("recuérdame llamar a mamá a las 6", CURSOS).kind, "recordar");
  assert.equal(L.intent("califica la foto del taller", CURSOS).kind, "foto");
  const q = L.intent("hazme un quiz de fracciones equivalentes de 8 preguntas para grado 7", CURSOS);
  assert.equal(q.kind, "quiz"); assert.equal(q.tema, "fracciones equivalentes"); assert.equal(q.n, 8); assert.equal(q.grado, 7);
  const q2 = L.intent("crea un taller sobre ecuaciones lineales para 7A", CURSOS);
  assert.equal(q2.tipo, "taller"); assert.equal(q2.tema, "ecuaciones lineales"); assert.equal(q2.curso, "c1");
  assert.equal(L.intent("qué hora es", CURSOS).kind, "hora");
  assert.equal(L.intent("cállate", CURSOS).kind, "callar");
  assert.equal(L.intent("explícame el teorema de Pitágoras", CURSOS), null);
  assert.equal(L.intent("¿cuál es la capital de Francia?", CURSOS), null);
});

test("peticiones a la IA", () => {
  const msgs = [{ role: "user", content: "hola" }, { role: "assistant", content: "¿Sí?" }, { role: "user", content: "mira", image: { mime: "image/jpeg", data: "AAA" } }];
  let r = L.chatRequest("gemini", { key: "K", model: "gemini-3.5-flash-lite", system: "S", messages: msgs });
  assert.match(r.url, /models\/gemini-3\.5-flash-lite:streamGenerateContent\?alt=sse&key=K$/);
  assert.equal(r.body.contents[1].role, "model");
  assert.deepEqual(r.body.contents[2].parts[0], { inline_data: { mime_type: "image/jpeg", data: "AAA" } });
  assert.equal(r.body.systemInstruction.parts[0].text, "S");
  r = L.chatRequest("gemini", { key: "K", model: "m", messages: msgs, stream: false, json: true });
  assert.match(r.url, /:generateContent\?key=K/); assert.equal(r.body.generationConfig.responseMimeType, "application/json");
  r = L.chatRequest("openai", { key: "K", model: "gpt-6-mini", system: "S", messages: msgs, json: true });
  assert.equal(r.body.messages[0].role, "system"); assert.equal(r.body.messages[3].content[1].image_url.url, "data:image/jpeg;base64,AAA");
  assert.equal(r.headers.Authorization, "Bearer K"); assert.deepEqual(r.body.response_format, { type: "json_object" });
  r = L.chatRequest("claude", { key: "K", model: "claude-haiku-5-5", system: "S", messages: msgs });
  assert.equal(r.headers["anthropic-dangerous-direct-browser-access"], "true"); assert.equal(r.body.system, "S");
  assert.equal(r.body.messages[2].content[0].source.data, "AAA");
});

test("streaming (SSE) de los tres proveedores", () => {
  const g = L.parseSSE('data: {"candidates":[{"content":{"parts":[{"text":"Hola, "}]}}]}\r\n\r\ndata: {"candidates":[{"content":{"parts":[{"text":"profe."}]}}]}\r\n\r\ndata: {"cand');
  assert.equal(g.datos.map((e) => L.deltaText("gemini", e)).join(""), "Hola, profe.");
  assert.equal(g.resto, 'data: {"cand');
  const o = L.parseSSE('data: {"choices":[{"delta":{"content":"Hola"}}]}\n\ndata: [DONE]\n\n');
  assert.equal(L.deltaText("openai", o.datos[0]), "Hola");
  const c = L.parseSSE('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hola"}}\n\nevent: ping\ndata: {"type":"ping"}\n\n');
  assert.equal(c.datos.map((e) => L.deltaText("claude", e)).join(""), "Hola");
  assert.equal(L.fullText("claude", { content: [{ type: "text", text: "ok" }] }), "ok");
  assert.match(L.apiError("gemini", 429, {}), /cuota/);
  assert.match(L.apiError("openai", 401, {}), /clave/);
  assert.deepEqual(L.extractJSON('Aquí está:\n```json\n{"a": 1}\n```'), { a: 1 });
  assert.equal(L.extractJSON("nada"), null);
});

test("escoger el modelo de la cuenta", () => {
  assert.equal(L.pickModel("gemini", ["gemini-3.0-flash", "gemini-3.5-flash-lite", "gemini-3.5-pro", "gemini-3.5-flash-lite-preview", "gemini-3.1-flash-lite"]), "gemini-3.5-flash-lite");
  assert.equal(L.pickModel("openai", ["gpt-6", "gpt-6-mini", "gpt-5-mini", "gpt-6-mini-realtime", "whisper-1"]), "gpt-6-mini");
  assert.equal(L.pickModel("claude", ["claude-sonnet-5-5", "claude-haiku-5-5", "claude-haiku-4-5"]), "claude-haiku-5-5");
  assert.equal(L.pickModel("gemini", []), "gemini-3.5-flash-lite");
  assert.deepEqual(L.modelsFrom("gemini", { models: [{ name: "models/a", supportedGenerationMethods: ["generateContent"] }, { name: "models/e", supportedGenerationMethods: ["embedContent"] }] }), ["a"]);
});

test("voz: frases para ir hablando y texto sin marcas", () => {
  let r = L.takeSentences("Claro. Las fracciones equivalentes representan", true);
  assert.deepEqual(r.frases, ["Claro."]); assert.equal(r.resto.trim(), "Las fracciones equivalentes representan");
  r = L.takeSentences("Las fracciones equivalentes son las que representan la misma cantidad, aunque tengan", true);
  assert.equal(r.frases[0], "Las fracciones equivalentes son las que representan la misma cantidad,");
  r = L.takeSentences("Vale 3.5 y más", false);
  assert.deepEqual(r.frases, []);
  assert.equal(L.forSpeech("**Ojo:** $\\frac{3}{4}+x^2$"), "Ojo: 3 sobre 4 más x al cuadrado");
  assert.equal(L.forSpeech("### Título\n- uno\n- dos"), "Título uno dos");
  const h = L.trimHistory([{ role: "user", content: "a" }, { role: "assistant", content: "x".repeat(3000) }, { role: "user", content: "b" }, { role: "assistant", content: "y".repeat(1000) }]);
  assert.equal(h[h.length - 1].content.length, 1000);
  assert.ok(h.every((m, i) => i === h.length - 1 || m.content.length <= 906));
});

test("quices: validar, barajar y compartir", () => {
  const raw = { titulo: "Fracciones", preguntas: [
    { enunciado: "¿Cuánto es $\\frac{1}{2}+\\frac{1}{4}$?", opciones: ["a) $\\frac{3}{4}$", "b) $\\frac{2}{6}$", "c) 1", "d) $\\frac{1}{8}$"], correcta: 0, explicacion: "Común denominador." },
    { enunciado: "Mala", opciones: ["1", "1"], correcta: 0 },
    { enunciado: "Otra", opciones: ["x", "y", "z"], correcta: "b" },
    { enunciado: "Sin correcta", opciones: ["x", "y"], correcta: 7 }] };
  const { quiz } = L.cleanQuiz(raw);
  assert.equal(quiz.preguntas.length, 2);
  assert.equal(quiz.preguntas[0].opciones[0], "$\\frac{3}{4}$");
  assert.equal(quiz.preguntas[1].correcta, 1);
  assert.ok(L.cleanQuiz({ preguntas: [] }).error);
  assert.ok(L.cleanQuiz(null).error);
  const sh = L.shuffleQuiz(quiz, seq(0.9, 0.1, 0.5));
  sh.preguntas.forEach((q, i) => assert.equal(q.opciones[q.correcta], quiz.preguntas[i].opciones[quiz.preguntas[i].correcta]));
  const txt = L.quizText(quiz, true);
  assert.match(txt, /^\*Fracciones\*/); assert.match(txt, /1\. ¿Cuánto es 1\/2\+1\/4\?/); assert.match(txt, /\*Respuestas:\* 1a · 2b/);
  assert.equal(L.plainMath("$\\sqrt{x^2+1} \\leq \\pi$"), "√(x²+1) ≤ π");
  assert.match(L.quizPrompt({ tema: "fracciones", n: 50, grado: 7 }), /20 preguntas sobre «fracciones» para estudiantes de grado 7/);
});

test("calificar la foto", () => {
  let r = L.cleanGrade({ legible: true, nota: "4,26", resumen: "Bien", aciertos: ["Planteó bien"], errores: "Signo", sugerencia: "Practicar signos" });
  assert.equal(r.revision.nota, 4.3); assert.deepEqual(r.revision.errores, ["Signo"]);
  assert.equal(L.cleanGrade({ nota: 9 }).revision.nota, 5);
  assert.equal(L.cleanGrade({ legible: false }).revision.nota, null);
  assert.ok(L.cleanGrade({ resumen: "sin nota" }).error);
  assert.equal(L.performance(4.7), "superior"); assert.equal(L.performance(2.9), "bajo"); assert.equal(L.performance(3.5), "básico");
  assert.match(L.gradePrompt({ consigna: "Resolver 2x+3=11" }), /Resolver 2x\+3=11/);
});
