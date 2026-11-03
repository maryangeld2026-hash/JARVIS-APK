// Pruebas de la lógica 3.7: solucionario verificado, figuras, acudientes y reunión
const test = require("node:test");
const assert = require("node:assert/strict");
const L6 = require("../www/js/logica6.js");
// nerdamer como en el navegador (su versión «all» espera window, no require)
const vm = require("vm"), ctx = { console }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
vm.runInContext(require("fs").readFileSync(__dirname + "/../www/vendor/nerdamer.min.js", "utf8"), ctx);
const n = ctx.nerdamer;

test("órdenes del solucionario", () => {
  assert.deepEqual(L6.casIntent("resuelve 2x + 3 = 11"), { kind: "cas_resolver", eq: "2x + 3 = 11", v: "", pasos: false });
  assert.equal(L6.casIntent("resuelve 3x - 5 = x + 7 paso a paso").pasos, true);
  assert.equal(L6.casIntent("deriva x^3 + 2x").kind, "cas_derivar");
  assert.equal(L6.casIntent("integral de x^2").expr, "x^2");
  assert.equal(L6.casIntent("factoriza x^2 - 9").kind, "cas_factorizar");
  assert.equal(L6.casIntent("calcula 3/4 + 2/5").kind, "cas_calcular");
  assert.equal(L6.casIntent("calcula el promedio de 7A"), null);
  assert.deepEqual(L6.casIntent("resuelve el sistema x + y = 10, x - y = 2").eqs, ["x + y = 10", "x - y = 2"]);
  assert.equal(L6.casIntent("verifica que x = 4 es solución de 2x + 3 = 11").kind, "cas_verificar");
  assert.equal(L6.casIntent("¿qué hora es?"), null);
  assert.equal(L6.toNerd("2x² + 3·x − 1"), "2x^2+3*x-1");
  assert.equal(L6.toNerd("raíz de 16 más 3 por 2"), "sqrt(16)+3*2");
  assert.equal(L6.toNerd("1,5x = 3"), "1.5x=3");
});

test("resolver y verificar con el motor de álgebra", () => {
  const r = L6.solveEq(n, "2x + 3 = 11");
  assert.ok(r.ok); assert.deepEqual(r.sol, ["4"]);
  assert.deepEqual(L6.solveEq(n, "x^2 - 5x + 6 = 0").sol.sort(), ["2", "3"]);
  assert.deepEqual(L6.solveEq(n, "3x = 2").sol, ["2/3"]);
  assert.equal(L6.checkEq(n, "2x + 3 = 11", "x", "4").ok, true);
  assert.equal(L6.checkEq(n, "2x + 3 = 11", "x", "5").ok, false);
  const p = L6.linearSteps(n, "3x - 5 = x + 7");
  assert.equal(p.sol, "6"); assert.equal(p.pasos.length, 5); assert.match(p.pasos[4].m, /✓/);
  assert.equal(L6.linearSteps(n, "x^2 = 4"), null);
  assert.equal(L6.answerValue("Restamos 3 y dividimos entre 2: **x = 4**."), "4");
  assert.equal(L6.answerValue("La solución es $x = \\frac{3}{2}$"), "(3)/(2)");
  assert.equal(L6.answerValue("sin respuesta"), null);
  assert.equal(L6.eqIn("explícame paso a paso cómo resolver 2x + 3 = 11"), "2x + 3 = 11");
});

test("figuras exactas", () => {
  const f = L6.figIntent("dibuja un triángulo rectángulo con catetos 3 y 4");
  assert.deepEqual(f, { tipo: "rect", a: 3, b: 4 });
  const s = L6.figSVG(f); assert.match(s.svg, /^<svg/); assert.match(s.texto, /= 5\$/);
  assert.match(L6.figSVG(L6.figIntent("dibújame un triángulo de lados 3, 4 y 5")).texto, /Herón\): \$6\$/);
  assert.match(L6.figSVG({ tipo: "tri", a: 1, b: 2, c: 10 }).error, /no se forma/);
  assert.equal(L6.figIntent("dibuja un hexágono").n, 6);
  assert.equal(L6.figIntent("dibuja un círculo de radio 5").r, 5);
  assert.equal(L6.figIntent("dibuja un círculo de diámetro 10").r, 5);
  assert.deepEqual(L6.figIntent("dibuja la recta numérica del -5 al 5 con los puntos -2 y 3/4"), { tipo: "recta", a: -5, b: 5, pts: ["-2", "3/4"] });
  const pl = L6.figIntent("dibuja un plano cartesiano con A(2,3), B(-1,4) y C(0,-2) y únelos");
  assert.equal(pl.pts.length, 3); assert.equal(pl.unir, true); assert.match(L6.figSVG(pl).svg, /<polygon/);
  assert.deepEqual(L6.figIntent("dibuja 3/4 en un círculo"), { tipo: "fraccion", nu: 3, de: 4, forma: "circulo" });
  assert.equal((L6.figSVG({ tipo: "fraccion", nu: 3, de: 4, forma: "circulo" }).svg.match(/<path/g) || []).length, 4);
  assert.equal(L6.figIntent("dibuja un ángulo de 90 grados").g, 90);
  assert.equal(L6.figIntent("dibuja un rectángulo de base 6 y altura 4").h, 4);
  assert.equal(L6.figIntent("explícame los triángulos"), null);
});

test("acudientes", () => {
  const g = L6.parseGuardians("1. Ana Rojas 300 123 4567\nPablo Mora; +57 310 999 8877\nNadie 3001112233\nBeto sin número", ["Ana Rojas", "Pablo Mora", "Beto Díaz"]);
  assert.deepEqual(g.mapa, { "Ana Rojas": "3001234567", "Pablo Mora": "+573109998877" });
  assert.deepEqual(g.sinEncontrar, ["Nadie"]);
  assert.deepEqual(L6.guardianIntent("avísale a los acudientes de los que van en riesgo en 7A"), { kind: "acud_riesgo", curso: "7A", extra: "" });
  assert.equal(L6.guardianIntent("manda un mensaje a los acudientes de 7A: mañana hay salida pedagógica").texto, "mañana hay salida pedagógica");
  assert.equal(L6.guardianIntent("manda las notas a los acudientes de 8B").kind, "acud_notas");
  const m = L6.guardianMsg("riesgo", { nombre: "Pablo Mora", curso: "7A", promedio: 2.6, faltas: 2, necesita: 3.8, docente: "Profe María" });
  assert.match(m, /Pablo va con un promedio de 2,6/); assert.match(m, /3,8/); assert.doesNotMatch(m, /Mora/);
});

test("reunión y clase completa", () => {
  assert.equal(L6.meetingIntent("modo reunión").kind, "reunion");
  assert.deepEqual(L6.meetingIntent("prepárame la clase de mañana de 7A"), { kind: "clase_completa", curso: "7a", cuando: "manana", tema: "" });
  assert.deepEqual(L6.meetingIntent("prepara mi clase de 8B para mañana sobre potencias"), { kind: "clase_completa", curso: "8b", cuando: "manana", tema: "potencias" });
  assert.match(L6.meetingPrompt("hola"), /ACTA/);
});

test("sincronizar con el PC: ida y vuelta sin perder nada", () => {
  let n = 0; const uid = () => "u" + (++n);
  const D = { cursos: [{ id: "c1", nombre: "7A", estudiantes: ["Ana Rojas", "Pablo Mora"], notas: { actividades: [{ id: "a1", nombre: "Quiz 1", peso: 1 }], valores: { "Ana Rojas": { a1: 4.5 } } } }],
    asistencia: [{ fecha: "2026-11-02", curso: "7A", faltas: ["Pablo Mora"], tardes: [] }], observador: { "Pablo Mora": [{ t: Date.parse("2026-11-02"), texto: "No trajo la tarea", curso: "7A" }] } };
  const pc = L6.toPC(D);
  assert.deepEqual(pc.cursos, { "7A": ["Ana Rojas", "Pablo Mora"] });
  assert.deepEqual(pc.notas["7A"]["Ana Rojas"], [{ actividad: "Quiz 1", nota: 4.5, fecha: "" }]);
  assert.deepEqual(pc.asistencia["7A"], { "2026-11-02": ["Pablo Mora"] });
  assert.equal(pc.observador["7A"]["Pablo Mora"][0].texto, "No trajo la tarea");
  // lo que viene del PC: un curso nuevo, una nota nueva, una distinta (gana la del celular), una falla y una anotación
  const r = L6.fromPC(D, { cursos: { "7A": ["Ana Rojas", "Pablo Mora", "Caro Gil"], "8B": ["Tomás Vega"] },
    notas: { "7A": { "Ana Rojas": [{ actividad: "Quiz 1", nota: 3.0 }], "Caro Gil": [{ actividad: "Taller", nota: 3.8 }] } },
    asistencia: { "7A": { "2026-11-03": ["Ana Rojas"] } }, observador: { "7A": { "Pablo Mora": [{ fecha: "2026-11-02", texto: "No trajo la tarea" }, { fecha: "2026-11-03", texto: "Participó" }] } } }, uid);
  assert.deepEqual(r, { cursos: 1, estudiantes: 2, notas: 1, fallas: 1, observador: 1 });
  const c = D.cursos[0];
  assert.equal(c.notas.valores["Ana Rojas"].a1, 4.5);
  assert.equal(c.notas.valores["Caro Gil"][c.notas.actividades.find((a) => a.nombre === "Taller").id], 3.8);
  assert.equal(D.observador["Pablo Mora"].length, 2);
  // otra vez lo mismo: no se duplica nada
  assert.deepEqual(L6.fromPC(D, L6.toPC(D), uid), { cursos: 0, estudiantes: 0, notas: 0, fallas: 0, observador: 0 });
});
