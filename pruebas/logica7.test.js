// Pruebas de la lógica 3.8: asistente general
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica7.js");

test("etiquetas de la IA: se ocultan y se leen", () => {
  const t = "Listo, te ayudo.\n<<orden: recuérdame a las 2 ir al médico>>\n<<orden: dime el clima>>\n<<recordar: Tiene cita médica los martes>>";
  assert.equal(L.visible(t), "Listo, te ayudo.");
  assert.deepEqual(L.tags(t), { ordenes: ["recuérdame a las 2 ir al médico", "dime el clima"], recordar: ["Tiene cita médica los martes"] });
  assert.equal(L.visible("Hola <<ord"), "Hola");
  assert.equal(L.visible("Hola <"), "Hola");
  assert.equal(L.ordenSegura("borra todos mis recordatorios"), false);
  assert.equal(L.ordenSegura("pon 5 minutos"), true);
  assert.equal(L.recuerdoOk("Le gusta el café sin azúcar"), true);
  assert.equal(L.recuerdoOk("Su clave del banco es 1234"), false);
  assert.equal(L.recuerdoOk("Pablo Mora va perdiendo", ["Pablo Mora"]), false);
  assert.equal(L.memDup([{ texto: "Le gusta el café sin azúcar" }], "le gusta el cafe sin azucar"), true);
});

test("corrección de lo que oyó el micrófono", () => {
  assert.equal(L.corregir("llama a pablo mora", ["Pablo Mora"]), "llama a Pablo Mora");
  assert.equal(L.corregir("escoge un estudiante de siete a", [], ["7A", "8B"]), "escoge un estudiante de 7A");
  assert.equal(L.corregir("las notas de octavo b", [], ["7A", "8B"]), "las notas de 8B");
  assert.equal(L.corregir("pon 5 minutos", [], ["7A"]), "pon 5 minutos");
  assert.equal(L.corregir("mándale un mensaje a carolina ruis", ["Carolina Ruiz", "Caro Gil"]), "mándale un mensaje a Carolina Ruiz");
  assert.equal(L.corregir("abre la app de vancolombia", ["Bancolombia"]), "abre la app de Bancolombia");
  assert.equal(L.corregir("compra una rosa", ["Rosa Díaz"]), "compra una rosa");
  assert.equal(L.corregir("hola, ana rojas.", ["Ana Rojas"]), "hola, Ana Rojas.");
});

test("órdenes programadas", () => {
  assert.deepEqual(L.progIntent("cada lunes a las 6 de la mañana dime el clima"), { prog: true, dias: [1], h: 6, m: 0, orden: "dime el clima" });
  assert.deepEqual(L.progIntent("todos los días a las 7 y media lee mis recordatorios"), { prog: true, dias: [0, 1, 2, 3, 4, 5, 6], h: 7, m: 30, orden: "lee mis recordatorios" });
  assert.deepEqual(L.progIntent("los viernes a las 4 haz el resumen de la semana"), { prog: true, dias: [5], h: 16, m: 0, orden: "haz el resumen de la semana" });
  assert.deepEqual(L.progIntent("de lunes a viernes a las 9:15 pm activa el modo ahorro").dias, [1, 2, 3, 4, 5]);
  assert.equal(L.progIntent("de lunes a viernes a las 9:15 pm activa el modo ahorro").h, 21);
  assert.deepEqual(L.progIntent("los lunes y miércoles a las 8 de la noche dime mi agenda").dias, [1, 3]);
  assert.equal(L.progIntent("cada lunes dime el clima"), null);
  assert.equal(L.progIntent("pon 5 minutos"), null);
  const p = { dias: [1], h: 6, m: 0 };
  const lunes = new Date(2026, 10, 2, 5, 0).getTime();          // lunes 2 de noviembre de 2026, 5:00
  assert.equal(L.nextFire(p, lunes), new Date(2026, 10, 2, 6, 0).getTime());
  assert.equal(L.nextFire(p, new Date(2026, 10, 2, 7, 0).getTime()), new Date(2026, 10, 9, 6, 0).getTime());
  assert.equal(L.lastDue(p, new Date(2026, 10, 3, 7, 0).getTime()), new Date(2026, 10, 2, 6, 0).getTime());
  assert.equal(L.diasTxt([1, 2, 3, 4, 5]), "de lunes a viernes");
  assert.equal(L.diasTxt([1, 3]), "los lunes y miércoles");
  assert.equal(L.hhmm(16, 5), "4:05 p. m.");
});

test("habilidades propias", () => {
  const h = L.habIntent("cuando diga modo gimnasio, pon mi música, silencia el celular y cuenta 45 minutos");
  assert.equal(h.frase, "modo gimnasio");
  assert.deepEqual(h.pasos, ["pon mi musica", "silencia el celular", "cuenta 45 minutos"]);
  const h2 = L.habIntent("cuando te diga buenas noches: apaga la linterna y luego pon una alarma a las 6");
  assert.equal(h2.frase, "buenas noches");
  assert.deepEqual(h2.pasos, ["apaga la linterna", "pon una alarma a las 6"]);
  assert.equal(L.habIntent("pon 5 minutos"), null);
  const lista = [{ frase: "modo gimnasio", pasos: [] }];
  assert.equal(L.habMatch("Jarvis, modo gimnasio", lista), lista[0]);
  assert.equal(L.habMatch("activa el modo gimnasio", lista), lista[0]);
  assert.equal(L.habMatch("modo gimnasio de la casa", lista), null);
});

test("clima", () => {
  assert.deepEqual(L.climaIntent("¿cómo está el clima?"), { clima: true, dia: 0, ciudad: "" });
  assert.deepEqual(L.climaIntent("va a llover mañana"), { clima: true, dia: 1, ciudad: "" });
  assert.deepEqual(L.climaIntent("qué temperatura hace en Medellín"), { clima: true, dia: 0, ciudad: "medellin" });
  assert.equal(L.climaIntent("el clima de la semana").dia, "semana");
  assert.equal(L.climaIntent("el clima en Cali mañana").ciudad, "cali");
  assert.equal(L.climaIntent("escoge un estudiante"), null);
  assert.equal(L.climaIntent("pon 5 minutos"), null);
  const j = { current: { temperature_2m: 18.4, apparent_temperature: 18, weather_code: 2 },
    daily: { time: ["2026-11-03", "2026-11-04"], weather_code: [61, 0], temperature_2m_max: [21, 23], temperature_2m_min: [12, 11], precipitation_probability_max: [80, 5] },
    hourly: { time: ["2026-11-03T13:00", "2026-11-03T14:00"], precipitation_probability: [20, 70] } };
  const s = L.climaTexto(j, 0, "Bogotá", new Date("2026-11-03T08:00").getTime());
  assert.match(s, /Ahora en Bogotá hay 18 °C, parcialmente nublado/);
  assert.match(s, /las 2 de la tarde/);
  assert.match(L.climaTexto(j, 1, ""), /Mañana: despejado, entre 11 y 23 °C\. No se espera lluvia/);
  assert.match(L.climaUrl(4.6, -74.08), /latitude=4\.600&longitude=-74\.080/);
});

test("conversaciones y búsqueda", () => {
  assert.deepEqual(L.convIntent("nueva conversación sobre el viaje a Cartagena"), { conv: "nueva", nombre: "el viaje a cartagena" });
  assert.deepEqual(L.convIntent("nueva conversación"), { conv: "nueva", nombre: "" });
  assert.deepEqual(L.convIntent("cambia a la conversación del trabajo"), { conv: "cambiar", nombre: "trabajo" });
  assert.deepEqual(L.convIntent("busca en el chat la receta de arepas"), { conv: "buscar", q: "la receta de arepas" });
  assert.equal(L.convIntent("mis conversaciones").conv, "lista");
  const convs = [{ id: "a", nombre: "General", chat: [{ role: "user", content: "dame la receta de arepas de huevo", t: 5 }] }, { id: "b", nombre: "Trabajo", chat: [{ role: "user", content: "reunión del lunes", t: 9 }] }];
  assert.equal(L.convFind(convs, "trabajo").id, "b");
  assert.equal(L.convFind(convs, "trabajos").id, "b");
  const r = L.buscar(convs, "receta arepas");
  assert.equal(r.length, 1); assert.equal(r[0].conv, "a"); assert.match(r[0].frag, /receta de arepas/);
  assert.equal(L.convNombre("¿cuál es la capital de Francia y qué visitar?"), "Cuál es la capital de");
});

test("uso de la IA y personalidad", () => {
  let u = L.usoAdd(null, "gemini", "a".repeat(400), "b".repeat(40), new Date("2026-11-03").getTime());
  u = L.usoAdd(u, "gemini", "a".repeat(40), "", new Date("2026-11-04").getTime());
  assert.deepEqual(u.prov.gemini, { n: 2, tin: 110, tout: 10 });
  const u2 = L.usoAdd(u, "groq", "x", "y", new Date("2026-12-01").getTime());
  assert.equal(u2.mes, "2026-12"); assert.equal(u2.antes.mes, "2026-11"); assert.equal(u2.prov.groq.n, 1);
  assert.equal(L.fmtK(1234), "1 mil"); assert.equal(L.fmtK(2500000), "2,5 M");
  assert.match(L.personaPrompt({ estilo: "formal", largo: "corto", humor: true }), /usted.*1 o 2 frases.*humor/);
});
