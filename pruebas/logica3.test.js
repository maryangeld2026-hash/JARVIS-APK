// Pruebas de la lógica 3.0 (habilidades del Jarvis del computador)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica.js");
const L3 = require("../www/js/logica3.js");

test("documentos con IA", () => {
  const t = (x) => (L3.docIntent(x) || {}).doc;
  assert.equal(t("Planéame la clase de fracciones equivalentes"), "plan_clase");
  assert.deepEqual(L3.docIntent("prepara la clase sobre ecuaciones lineales").args, ["ecuaciones lineales"]);
  assert.equal(t("hazme una guía de funciones cuadráticas"), "guia");
  assert.equal(t("rúbrica para la exposición de estadística"), "rubrica");
  assert.equal(t("redacta un correo a los padres de 7A sobre la salida pedagógica"), "correo");
  assert.equal(t("escribe una circular para la reunión de padres"), "correo");
  assert.equal(t("agenda de la reunión de área"), "agenda_reunion");
  assert.equal(t("haz el acta de la reunión: se habló del PEI"), "acta");
  assert.equal(t("planea mi periodo de geometría"), "planeacion");
  assert.equal(t("podcast de repaso de porcentajes"), "podcast");
  assert.equal(t("retroalimenta este texto de Ana: La fotosíntesis es cuando las plantas comen luz del sol y ya"), "retro_texto");
  assert.equal(t("nivela este texto para grado 5: Las fracciones representan partes de un todo dividido en partes iguales."), "nivelar");
  assert.equal(t("hazme el solucionario del taller de ecuaciones"), "solucionario");
  assert.equal(t("adapta la clase de fracciones para un estudiante con TDAH"), "dua");
  assert.equal(L3.docIntent("¿cuál es la capital de Francia?"), null);
  assert.equal(L3.docIntent("hazme un quiz de fracciones"), null);              // eso lo hace el quiz
  const d = L3.docById("plan_clase");
  assert.match(d.prompt(["fracciones"], { grado: " para grado 7", asig: "", duracion: 55 }), /55 minutos sobre «fracciones» para grado 7/);
});

test("gráficas con evaluador propio", () => {
  const f = L3.compileFn("y = x^2 - 4");
  assert.equal(f(3), 5);
  assert.equal(L3.compileFn("2x+1")(2), 5);
  assert.equal(L3.compileFn("3(x+1)")(1), 6);
  assert.equal(L3.compileFn("sqrt(x)")(9), 3);
  assert.equal(L3.compileFn("x²")(4), 16);
  assert.ok(Math.abs(L3.compileFn("sen(pi/2)")(0) - 1) < 1e-9);
  assert.equal(L3.compileFn("-x^2")(2), -4);
  assert.equal(L3.compileFn("alert(1)"), null);
  assert.equal(L3.compileFn("x; process.exit()"), null);
  assert.equal(L3.compileFn("constructor"), null);
  const p = L3.samplePlot(L3.compileFn("1/x"), -5, 5, 100);
  assert.ok(p.pts.some((q) => q[1] === null) || p.ymax > 0);
  assert.equal(L3.graphIntent("grafica y = x^2 - 4").expr, "x^2 - 4");
  assert.equal(L3.graphIntent("grafícame la función 2x + 3").expr, "2x + 3");
  assert.equal(L3.graphIntent("grafica a Juan"), null);
});

test("órdenes de datos", () => {
  const k = (x) => (L3.dataIntent(x) || {}).kind;
  assert.deepEqual(L3.dataIntent("Anota en el observador de Pablo Mora que hoy no trajo el cuaderno"), { kind: "obs_add", quien: "Pablo Mora", texto: "hoy no trajo el cuaderno" });
  assert.equal(k("¿qué hay en el observador de Pablo?"), "obs_ver");
  assert.deepEqual(L3.dataIntent("hoy en 7A vimos fracciones equivalentes"), { kind: "diario_add", curso: "7A", texto: "fracciones equivalentes" });
  assert.equal(k("¿qué vimos en 7A?"), "diario_ver");
  assert.equal(k("quedé en mandarle la guía a la coordinadora"), "comp_add");
  assert.equal(k("¿qué compromisos tengo?"), "comp_ver");
  assert.equal(k("ya le envié la guía a la coordinadora"), "comp_ok");
  assert.deepEqual(L3.dataIntent("el periodo termina el 28 de noviembre"), { kind: "periodo_set", dia: 28, mes: "noviembre" });
  assert.equal(k("¿cuánto falta para terminar el periodo?"), "periodo_ver");
  assert.equal(k("¿qué clase tengo ahora?"), "clase_ahora");
  assert.equal(k("¿cómo viene mi día?"), "mi_dia");
  assert.equal(L3.dataIntent("¿cuánto necesita Pablo Mora para pasar?").quien, "pablo mora");
  assert.equal(k("¿quiénes pueden perder el año?"), "riesgo_ano");
  assert.equal(L3.dataIntent("¿quién viene bajando?").dir, "baja");
  assert.equal(L3.dataIntent("¿a quién debo felicitar?").dir, "sube");
  assert.equal(k("ficha de Pablo Mora"), "ficha");
  assert.equal(L3.dataIntent("ponte relajado").modo, "relajado");
  assert.equal(L3.dataIntent("estamos en tecnología").asig, "tecnologia");
  assert.equal(k("¿qué hiciste hoy?"), "hoy_hice");
  assert.equal(k("dame el resumen semanal"), "semanal");
  assert.equal(k("mapa de errores"), "errores");
  assert.equal(L3.dataIntent("tarjetas de estudio sobre potencias").tema, "potencias");
  assert.equal(k("hazme un simulacro saber de geometría"), "saber");
  assert.deepEqual(L3.dataIntent("investiga a fondo los resultados de las pruebas Saber 2026"), { kind: "investigar", q: "los resultados de las pruebas Saber 2026", fondo: true });
  assert.equal(L3.dataIntent("¿cuál es la capital de Francia?"), null);
});

test("periodo, horario y clase actual", () => {
  const now = new Date(2026, 10, 2, 9, 10);                                  // lunes
  assert.equal(L3.periodEnd(28, "noviembre", now).getDate(), 28);
  const h = L3.parseSchedule("lunes 7:00-7:55 7A\nLunes 8:00-8:55 10B Álgebra\nmartes 7-8 9C\nbasura");
  assert.equal(h.length, 3);
  assert.equal(h[1].que, "10B Álgebra");
  const c = L3.classNow(h, new Date(2026, 10, 2, 7, 30));
  assert.equal(c.ahora.que, "7A"); assert.equal(c.ahora.falta, 25); assert.equal(c.siguiente.que, "10B Álgebra");
  assert.match(L3.classNowSpoken(h, new Date(2026, 10, 2, 7, 30)), /Ahora tienes 7A, hasta las 7:55.*Luego 10B Álgebra a las 8:00/);
  assert.match(L3.classNowSpoken(h, now), /Ya terminaste/);
  assert.match(L3.classNowSpoken([], now), /No tengo tu horario/);
});

test("cuánto necesita, tendencias, Anki y Kahoot", () => {
  const n = { actividades: [{ id: "a", nombre: "T1", peso: 1 }, { id: "b", nombre: "Q1", peso: 1 }], valores: { Ana: { a: 2.0, b: 2.6 }, Beto: { a: 4.0, b: 4.5 }, Caro: { a: 4.5, b: 3.2 } } };
  const r = L3.neededToPass(n, "Ana", 3.0);
  assert.equal(r.promedio, 2.3); assert.equal(r.necesita, 4.4); assert.equal(r.posible, true);
  assert.equal(L3.neededToPass(n, "Beto").ya, true);
  const c = { estudiantes: ["Ana", "Beto", "Caro"], notas: n };
  assert.deepEqual(L3.trends(c, "baja").map((x) => x.nombre), ["Caro"]);
  assert.deepEqual(L3.trends(c, "sube").map((x) => x.nombre), ["Ana", "Beto"]);
  assert.equal(L3.anonGrades(n, "Ana"), "T1: 2; Q1: 2,6");
  const m = L3.cleanCards({ titulo: "Potencias", tarjetas: [{ frente: "$2^3$", reverso: "8" }, { frente: "" }] }).mazo;
  assert.equal(m.tarjetas.length, 1); assert.equal(L3.ankiTSV(m), "2³\t8");
  const quiz = L.cleanQuiz({ titulo: "Q", preguntas: [{ enunciado: "¿$\\frac{1}{2}$?", opciones: ["a", "b", "c"], correcta: 1 }] }).quiz;
  const k = L3.kahootRows(quiz);
  assert.equal(k.length, 2); assert.deepEqual(k[1], ["¿1/2?", "a", "b", "c", "", 30, 2]);
});

test("abrir ajustes por voz", () => {
  assert.equal(L.intent("abre los ajustes", []).kind, "ajustes");
  assert.equal(L.intent("Jarvis, ajustes", []).kind, "ajustes");
  assert.equal(L.intent("configuración", []).kind, "ajustes");
});
