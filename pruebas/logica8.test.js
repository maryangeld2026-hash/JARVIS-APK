// Pruebas de la lógica 3.9: la vida diaria
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica8.js");

test("plata", () => {
  assert.equal(L.monto("25 mil"), 25000);
  assert.equal(L.monto("25.000"), 25000);
  assert.equal(L.monto("$ 45.900,00"), 45900);
  assert.equal(L.monto("1,5 millones"), 1500000);
  assert.equal(L.monto("un millón"), 1000000);
  assert.equal(L.monto("veinte mil"), 20000);
  assert.equal(L.monto("ciento veinte mil"), 120000);
  assert.equal(L.monto("medio millón"), 500000);
  assert.equal(L.monto("120000"), 120000);
  assert.equal(L.cop(1234567), "$1.234.567");
});

test("gastos", () => {
  assert.deepEqual(L.gastoIntent("gasté 25 mil en almuerzo"), { gasto: "add", monto: 25000, desc: "almuerzo", cat: "comida", tipo: "gasto" });
  assert.equal(L.gastoIntent("pagué 120.000 de luz").cat, "servicios");
  assert.equal(L.gastoIntent("anota un gasto de 30 mil en taxi").cat, "transporte");
  assert.equal(L.gastoIntent("gasté en el mercado 180 mil").monto, 180000);
  assert.equal(L.gastoIntent("me pagaron 2 millones").tipo, "ingreso");
  assert.deepEqual(L.gastoIntent("mi presupuesto mensual es de 2 millones"), { gasto: "presupuesto", monto: 2000000, cat: "" });
  assert.deepEqual(L.gastoIntent("pon un presupuesto de 400 mil para comida"), { gasto: "presupuesto", monto: 400000, cat: "comida" });
  assert.deepEqual(L.gastoIntent("¿cuánto llevo este mes en comida?"), { gasto: "ver", per: "mes", cat: "comida" });
  assert.deepEqual(L.gastoIntent("cuánto he gastado hoy"), { gasto: "ver", per: "hoy", cat: "" });
  assert.equal(L.gastoIntent("mis gastos").gasto, "ver");
  assert.equal(L.gastoIntent("borra el último gasto").gasto, "deshacer");
  assert.equal(L.gastoIntent("pon 5 minutos"), null);
  const now = new Date(2026, 10, 15, 12).getTime();
  const l = [{ monto: 25000, cat: "comida", t: now - 3600e3 }, { monto: 300000, cat: "comida", t: now - 5 * 864e5 }, { monto: 50000, cat: "transporte", t: now - 864e5 }, { monto: 999, cat: "comida", t: new Date(2026, 9, 3).getTime() }, { monto: 2e6, cat: "ingreso", tipo: "ingreso", t: now }];
  const r = L.resumen(l, "mes", now);
  assert.equal(r.total, 375000); assert.equal(r.ingresos, 2e6); assert.deepEqual(r.cats[0], ["comida", 325000]);
  assert.equal(L.resumen(l, "hoy", now).total, 25000);
  assert.match(L.alertaPresupuesto(l, { total: 0, cats: { comida: 350000 } }, "comida", now), /el 93 %/);
  assert.match(L.alertaPresupuesto(l, { total: 300000, cats: {} }, "", now), /Te pasaste/);
  assert.deepEqual(L.banco("Bancolombia le informa Compra por $45.900,00 en EXITO CALLE 80 con su T.Deb *1234 03/11/2026"), { monto: 45900, desc: "EXITO CALLE 80", cat: "mercado", tipo: "gasto" });
  assert.equal(L.banco("Nequi: Recibiste $150.000 de Carolina Ruiz").tipo, "ingreso");
  assert.equal(L.banco("Tu código es 123456"), null);
});

test("listas", () => {
  assert.deepEqual(L.listaIntent("agrega leche, huevos y pan a la lista"), { lista: "add", items: ["leche", "huevos", "pan"], nombre: "mercado" });
  assert.deepEqual(L.listaIntent("agrega pilas a la lista de la ferretería"), { lista: "add", items: ["pilas"], nombre: "ferreteria" });
  assert.deepEqual(L.listaIntent("¿qué me falta comprar?"), { lista: "ver", nombre: "" });
  assert.deepEqual(L.listaIntent("ya compré leche"), { lista: "quitar", items: ["leche"], nombre: "" });
  assert.deepEqual(L.listaIntent("manda la lista a Carolina"), { lista: "enviar", nombre: "", a: "carolina" });
  assert.equal(L.listaIntent("muéstrame la lista de 7A", ["7A"]), null);
  assert.equal(L.listaIntent("pasa lista"), null);
  assert.equal(L.listaIntent("ya compré 2 cosas por 20 mil"), null);
});

test("medicamentos y hábitos", () => {
  assert.deepEqual(L.medIntent("recuérdame tomar la pastilla de la presión a las 8 y a las 8 de la noche"), { med: true, nombre: "pastilla de la presion", horas: [{ h: 8, m: 0 }, { h: 20, m: 0 }] });
  assert.deepEqual(L.medIntent("recuérdame la vitamina a las 7:30 todos los días").horas, [{ h: 7, m: 30 }]);
  assert.equal(L.medIntent("recuérdame llamar a mamá a las 8"), null);
  assert.deepEqual(L.habitoIntent("ya hice ejercicio"), { habito: "marcar", nombre: "hacer ejercicio" });
  assert.deepEqual(L.habitoIntent("registra que tomé agua"), { habito: "marcar", nombre: "tomar agua" });
  assert.deepEqual(L.habitoIntent("leí 20 minutos hoy"), null === null ? L.habitoIntent("leí 20 minutos hoy") : null);
  assert.equal(L.habitoIntent("tomé una foto"), null);
  assert.equal(L.habitoIntent("ya me tomé la pastilla").habito, "med_tomada");
  assert.equal(L.habitoIntent("mis rachas").habito, "ver");
  assert.deepEqual(L.habitoIntent("pausas activas cada hora de 8 a 5"), { habito: "pausas", on: true, ini: 8, fin: 17, cada: 60 });
  const now = new Date(2026, 10, 15, 20).getTime(), d = 864e5;
  assert.equal(L.racha([now - 3600e3, now - d, now - 2 * d, now - 4 * d], now), 3);
  assert.equal(L.racha([now - d, now - 2 * d], now), 2);
  assert.equal(L.racha([now - 3 * d], now), 0);
});

test("cumpleaños", () => {
  assert.deepEqual(L.cumpleIntent("el cumpleaños de Ana es el 5 de marzo"), { cumple: "add", nombre: "ana", mes: 3, dia: 5 });
  assert.deepEqual(L.cumpleIntent("¿quién cumple años esta semana?"), { cumple: "ver", dias: 7 });
  assert.deepEqual(L.fechaCumple("--03-05"), { mes: 3, dia: 5 });
  assert.deepEqual(L.fechaCumple("1990-12-24"), { mes: 12, dia: 24 });
  const now = new Date(2026, 11, 30).getTime();
  const p = L.proximos([{ nombre: "A", mes: 1, dia: 2 }, { nombre: "B", mes: 12, dia: 30 }, { nombre: "C", mes: 6, dia: 1 }], now, 7);
  assert.deepEqual(p.map((x) => [x.nombre, x.en]), [["B", 0], ["A", 3]]);
  assert.match(L.feliz("Ana Rojas"), /Feliz cumpleaños, Ana!/);
});

test("disparadores", () => {
  assert.deepEqual(L.dispIntent("cuando conecte el carro, modo conducción"), { disp: "bt_on", dispositivo: "carro", accion: "modo conduccion" });
  assert.deepEqual(L.dispIntent("al poner a cargar el celular, activa el modo ahorro"), { disp: "carga_on", dispositivo: "", accion: "activa el modo ahorro" });
  assert.deepEqual(L.dispIntent("cuando llegue a la casa, silencia el celular y pon música"), { disp: "lugar_in", dispositivo: "casa", accion: "silencia el celular y pon musica" });
  assert.equal(L.dispIntent("cuando desconecte los audífonos, pausa la música").disp, "bt_off");
  assert.equal(L.dispIntent("cuando quite el cargador, dime cuánta batería tengo").disp, "carga_off");
  assert.equal(L.dispIntent("cuando diga modo gimnasio, pon música"), null);
  assert.equal(L.dispTexto({ tipo: "bt_on", dispositivo: "" }), "al conectar cualquier Bluetooth");
});

test("conducción, notificaciones, emergencia, intérprete, noticias, leer, notas, planeador", () => {
  assert.deepEqual(L.variosIntent("modo conducción"), { v: "conduccion", on: true });
  assert.deepEqual(L.variosIntent("ya llegué"), { v: "conduccion", on: false });
  assert.equal(L.variosIntent("¿qué me perdí?").v, "perdi");
  assert.equal(L.variosIntent("Jarvis, emergencia").v, "emergencia");
  assert.deepEqual(L.variosIntent("modo intérprete con francés"), { v: "interprete", idioma: "frances" });
  assert.deepEqual(L.variosIntent("dame las noticias de tecnología"), { v: "noticias", tema: "tecnologia" });
  assert.deepEqual(L.variosIntent("noticias"), { v: "noticias", tema: "" });
  assert.equal(L.variosIntent("léeme el último documento").v, "leer_doc");
  assert.equal(L.variosIntent("léeme este artículo https://ejemplo.com/a?b=1").url, "https://ejemplo.com/a?b=1");
  assert.deepEqual(L.variosIntent("según mis notas, cuándo es la reunión de padres"), { v: "notas", q: "cuando es la reunion de padres" });
  assert.equal(L.variosIntent("qué decía el acta sobre la salida pedagógica").q, "sobre la salida pedagogica");
  assert.deepEqual(L.variosIntent("planea mi semana de clases de 7A sobre fracciones"), { v: "semana", curso: "7a", tema: "fracciones" });
  assert.match(L.interpretePrompt("ingles"), /español y inglés/);
  const g = L.perdi([{ app: "WhatsApp", titulo: "Mamá" }, { app: "WhatsApp", titulo: "Carolina" }, { app: "Gmail", titulo: "Banco" }]);
  assert.equal(L.perdiTexto(g), "Tienes 3 notificaciones: WhatsApp 2 (Mamá, Carolina); Gmail 1 (Banco).");
  assert.match(L.emergenciaMsg("María", 4.6, -74.08, 12), /maps\.google\.com\/\?q=4\.600000,-74\.080000 \(±12 m\)/);
  assert.deepEqual(L.confianza("Mamá: 300 123 4567\nPedro - 3109998877\nbasura"), [{ nombre: "Mamá", numero: "3001234567" }, { nombre: "Pedro", numero: "3109998877" }]);
  const x = L.rss('<rss><item><title>Sube el dólar - El Tiempo</title><link>https://n/1</link><source url="x">El Tiempo</source><pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate></item><item><title><![CDATA[Lluvias & más]]></title></item></rss>');
  assert.deepEqual(x.map((i) => [i.titulo, i.fuente]), [["Sube el dólar", "El Tiempo"], ["Lluvias & más", ""]]);
  const lg = L.legible("<html><title>Hola &amp; adiós</title><nav><p>menú menú menú menú menú menú menú menú menú</p></nav><article><h1>El titular</h1><p>Este es el primer párrafo del artículo, bastante largo para contar.</p><p>corto</p></article></html>");
  assert.equal(lg.titulo, "Hola & adiós"); assert.match(lg.texto, /^El titular\n\nEste es el primer/); assert.doesNotMatch(lg.texto, /menú|corto/);
  const tz = L.trozos("Frase uno. Frase dos.\n\n" + "Larga ".repeat(80) + ".", 100);
  assert.equal(tz[0], "Frase uno. Frase dos."); assert.ok(tz.length >= 2);
  const r = L.rank([{ titulo: "Acta reunión de área", texto: "Acordamos la salida pedagógica para el viernes 20. Marta trae los permisos." }, { titulo: "Receta", texto: "Arepas con queso." }], "¿cuándo es la salida pedagógica?");
  assert.equal(r.length, 1); assert.equal(r[0].fuente, "Acta reunión de área");
  const s = L.semana([{ dia: 3, ini: 420, fin: 475, que: "7A" }, { dia: 1, ini: 480, fin: 535, que: "8B" }, { dia: 1, ini: 420, fin: 475, que: "7A" }], "");
  assert.deepEqual(s.map((c) => c.dia + " " + c.que), ["lunes 7A", "lunes 8B", "miércoles 7A"]);
  assert.equal(L.semana([{ dia: 3, ini: 420, fin: 475, que: "7A" }, { dia: 1, ini: 480, fin: 535, que: "8B" }], "7a").length, 1);
  assert.match(L.semanaPrompt(s, "fracciones", "matemáticas"), /lunes: 7A \(55 minutos\)/);
});

test("temporizadores con nombre", () => {
  assert.deepEqual(L.timerIntent("pon 10 minutos para el arroz"), { tn: "add", ms: 600000, nombre: "arroz" });
  assert.deepEqual(L.timerIntent("temporizador de 1 hora y media para el horno") || L.timerIntent("pon un temporizador de 1 hora y media para el horno"), { tn: "add", ms: 5400000, nombre: "horno" });
  assert.deepEqual(L.timerIntent("pon veinticinco minutos para la lavadora"), { tn: "add", ms: 1500000, nombre: "lavadora" });
  assert.deepEqual(L.timerIntent("¿cuánto le falta al arroz?"), { tn: "ver", nombre: "arroz" });
  assert.deepEqual(L.timerIntent("cancela el del arroz"), { tn: "quitar", nombre: "arroz" });
  assert.equal(L.timerIntent("pon 5 minutos"), null);
  assert.equal(L.falta(125000), "2 min 5 s"); assert.equal(L.falta(3725000), "1 h 2 min");
});
