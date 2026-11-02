// Pruebas de la lógica 2.0:  node --test pruebas/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica.js");
const L2 = require("../www/js/logica2.js");

const CURSO = { id: "c1", nombre: "7A", estudiantes: ["Ana Rojas", "Beto Díaz", "Caro Gil", "Dani Ruiz"] };

test("importar la planilla de notas", () => {
  const rows = [["Colegio X — Planilla 7A"], ["N°", "Apellidos", "Nombres", "Taller 1", "Quiz 1", "Observaciones", "Definitiva"],
    [1, "Rojas", "Ana", 4.5, "4,8", "", 4.6], [2, "Díaz", "Beto", 2.5, 2.8, "Falta", 2.6], [3, "Gil", "Caro", 3.5, "", "", 3.5], ["", "", "", "", "", "", ""]];
  const r = L2.sheetToGrades(rows);
  assert.deepEqual(r.estudiantes, ["Rojas Ana", "Díaz Beto", "Gil Caro"]);
  assert.deepEqual(r.actividades.map((a) => a.nombre), ["Taller 1", "Quiz 1"]);
  assert.deepEqual(r.valores["Rojas Ana"], { a3: 4.5, a4: 4.8 });
  assert.deepEqual(r.valores["Gil Caro"], { a3: 3.5 });
  assert.ok(L2.sheetToGrades([["a", "b"], [1, 2]]).error);
});

test("promedios, riesgo y desempeño", () => {
  const c = Object.assign({}, CURSO, { notas: { actividades: [{ id: "t1", nombre: "Taller 1", peso: 1 }, { id: "q1", nombre: "Quiz 1", peso: 2 }],
    valores: { "Ana Rojas": { t1: 4.5, q1: 4.8 }, "Beto Díaz": { t1: 2.5, q1: 2.8 }, "Caro Gil": { t1: 3.5 }, "Dani Ruiz": { t1: 2.0, q1: 4.0 } } } });
  assert.equal(L2.average(c.notas, "Ana Rojas"), 4.7);
  assert.equal(L2.average(c.notas, "Caro Gil"), 3.5);
  const st = L2.courseStats(c);
  assert.deepEqual(st.riesgo.map((r) => r.nombre), ["Beto Díaz"]);
  assert.equal(st.filas.find((r) => r.nombre === "Ana Rojas").desempeno, "superior");
  assert.equal(st.filas.find((r) => r.nombre === "Caro Gil").faltan, 1);
  assert.equal(L2.fmtNota(3.456), "3,5");
  const tab = L2.gradeTable(c);
  assert.deepEqual(tab[0], ["Estudiante", "Taller 1", "Quiz 1", "Promedio", "Desempeño"]);
  assert.deepEqual(tab[2], ["Beto Díaz", 2.5, 2.8, 2.7, "bajo"]);
  assert.equal(L2.findStudent([c], "¿cómo va rojas?").nombre, "Ana Rojas");
  assert.equal(L2.findStudent([c], "cómo va Beto Díaz").nombre, "Beto Díaz");
  assert.equal(L2.findStudent([c], "cómo va Pedro"), null);
  assert.deepEqual(L2.parseGradeEntry("ponle 4,5 a Ana Rojas en el taller 1"), { nota: 4.5, quien: "ana rojas", actividad: "taller 1" });
  assert.equal(L2.findActivity(c.notas, "quiz 1").id, "q1");
});

test("memoria y lecciones", () => {
  assert.deepEqual(L2.memoryIntent("Recuerda que los lunes tengo reunión de área"), { kind: "mem_guardar", texto: "los lunes tengo reunión de área" });
  assert.equal(L2.memoryIntent("recuérdame llamar a mamá a las 3"), null);                 // eso es un recordatorio
  assert.equal(L2.memoryIntent("De ahora en adelante los quices con 5 preguntas").kind, "leccion");
  assert.equal(L2.memoryIntent("¿qué sabes de mí?").kind, "mem_ver");
  assert.equal(L2.memoryIntent("olvida que tengo reunión").texto, "tengo reunion");
  const ctx = L2.memoryContext([{ texto: "Doy clase en el colegio San José", t: 1 }, { texto: "Mi coordinadora es Marta", t: 2 }], [{ texto: "Quices de 5 preguntas" }], "¿quién es la coordinadora?");
  assert.match(ctx, /Lecciones.*Quices de 5 preguntas/); assert.match(ctx, /Mi coordinadora es Marta/);
});

test("órdenes nuevas", () => {
  const C = [CURSO];
  assert.deepEqual(L2.intent2("¿quiénes están en riesgo en 7A?", C), { kind: "riesgo", curso: "c1" });
  assert.equal(L2.intent2("cómo va Ana Rojas", C).kind, "estudiante");
  assert.equal(L2.intent2("ponle 4,5 a Ana en el taller 1", C).kind, "poner_nota");
  assert.deepEqual(L2.intent2("modo tutor de fracciones", C), { kind: "tutor", tema: "fracciones" });
  assert.equal(L2.intent2("sal del modo tutor", C).kind, "tutor_off");
  assert.equal(L2.intent2("explícame paso a paso cómo resolver 2x + 3 = 11", C).kind, "pasos");
  assert.equal(L2.intent2("ticket de salida de fracciones", C).tema, "fracciones");
  assert.equal(L2.intent2("modo proyector", C).kind, "proyector");
  assert.equal(L2.intent2("proyecta el quiz", C).que, "quiz");
  assert.deepEqual(L2.intent2("en el computador abre Word", C), { kind: "pc", orden: "abre Word" });
  assert.equal(L2.intent2("¿qué tengo hoy?", C).kind, "agenda");
  assert.equal(L2.intent2("agenda reunión de padres mañana a las 3", C).kind, "agendar");
  assert.equal(L2.intent2("trae los estudiantes de Classroom", C).kind, "classroom");
  assert.equal(L2.intent2("pasa el quiz a Forms", C).kind, "forms");
  assert.equal(L2.intent2("el quiz en Word", C).kind, "word");
  assert.deepEqual(L2.intent2("activa manos libres", C), { kind: "manos_libres", on: true });
  assert.deepEqual(L2.intent2("quita la burbuja", C), { kind: "burbuja", on: false });
  assert.equal(L2.intent2("¿cuál es la capital de Francia?", C), null);
});

test("pasos y ticket", () => {
  const r = L2.cleanSteps({ titulo: "Ecuación", pasos: [{ titulo: "Restar 3", explicacion: "$2x=8$" }, {}, { titulo: "Dividir", explicacion: "$x=4$" }] });
  assert.equal(r.pasos.pasos.length, 2);
  assert.ok(L2.cleanSteps({}).error);
  assert.deepEqual(L2.cleanTicket({ preguntas: ["a", { enunciado: "b" }, ""] }).ticket.preguntas, ["a", "b"]);
  assert.match(L2.tutorRule("fracciones"), /Nunca des la respuesta final/);
});

test("palabra Jarvis y el computador", () => {
  assert.equal(L2.afterWake("Jarvis, escoge un estudiante"), "escoge un estudiante");
  assert.equal(L2.afterWake("oye yarvis pon 5 minutos"), "pon 5 minutos");
  assert.equal(L2.afterWake("Jarvis"), "");
  assert.equal(L2.afterWake("abran el libro"), null);
  assert.deepEqual(L2.pcLink("http://192.168.1.20:8766/?k=abc123"), { base: "http://192.168.1.20:8766", token: "abc123" });
  assert.equal(L2.pcLink("http://192.168.1.20:8766/"), null);
});

test("Google: calendario, Classroom, Forms y Drive", () => {
  const now = new Date(2026, 10, 2, 11, 0);
  assert.match(L2.calendarListURL(now, 0), /calendars\/primary\/events\?singleEvents=true.*timeMin=2026-11-0/);
  assert.match(L2.eventsSpoken({ items: [{ summary: "Consejo académico", start: { dateTime: new Date(2026, 10, 2, 14, 0).toISOString() } }] }, now), /Consejo académico · hoy a las 2 de la tarde/);
  const ev = L2.eventFromText("agenda reunión de padres mañana a las 3 de la tarde", now);
  assert.equal(ev.summary, "Reunión de padres");
  assert.equal(new Date(ev.start.dateTime).getHours(), 15);
  assert.deepEqual(L2.rosterNames({ students: [{ profile: { name: { fullName: "Ana Rojas" } } }, { profile: { name: { givenName: "Beto", familyName: "Díaz" } } }] }), ["Ana Rojas", "Beto Díaz"]);
  const quiz = L.cleanQuiz({ titulo: "Q", preguntas: [{ enunciado: "¿$\\frac{1}{2}$?", opciones: ["$\\frac{2}{4}$", "1"], correcta: 0, explicacion: "x" }] }).quiz;
  const f = L2.formsRequests(quiz);
  assert.equal(f.create.info.title, "Q");
  const item = f.batch.requests.find((r) => r.createItem && r.createItem.location.index === 1).createItem.item;
  assert.equal(item.title, "¿1/2?");
  assert.equal(item.questionItem.question.grading.correctAnswers.answers[0].value, "2/4");
  const mp = L2.driveMultipart('{"a":1}');
  assert.match(mp.body, /"parents":\["appDataFolder"\]/); assert.match(mp.body, /\{"a":1\}/);
});
