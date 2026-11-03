// Pruebas de la lógica 3.6: control del celular, dictado, notas de voz, banco, versiones, práctica con QR y lugares
const test = require("node:test");
const assert = require("node:assert/strict");
const L5 = require("../www/js/logica5.js");

test("órdenes para controlar el celular", () => {
  const k = (t) => (L5.phoneIntent(t) || {}).kind;
  assert.deepEqual(L5.phoneIntent("llama a mi mamá"), { kind: "llamar", quien: "mamá" });
  assert.deepEqual(L5.phoneIntent("Jarvis, llámale a Juan Pérez"), { kind: "llamar", quien: "Juan Pérez" });
  assert.deepEqual(L5.phoneIntent("mándale un whatsapp a Carolina diciendo que llego en 10 minutos"), { kind: "wa", quien: "Carolina", texto: "llego en 10 minutos" });
  assert.deepEqual(L5.phoneIntent("envía un WhatsApp a la coordinadora: mañana no hay clase"), { kind: "wa", quien: "la coordinadora", texto: "mañana no hay clase" });
  assert.deepEqual(L5.phoneIntent("manda un mensaje a Pedro que ya salí"), { kind: "sms", quien: "Pedro", texto: "ya salí" });
  assert.deepEqual(L5.phoneIntent("abre WhatsApp"), { kind: "abrir_app", app: "whatsapp" });
  assert.deepEqual(L5.phoneIntent("abre la app de calculadora"), { kind: "abrir_app", app: "calculadora" });
  assert.equal(L5.phoneIntent("abre los ajustes"), null);                       // eso son los Ajustes de Jarvis
  assert.equal(L5.phoneIntent("en el computador abre Word"), null);
  assert.deepEqual(L5.phoneIntent("cierra YouTube"), { kind: "cerrar_app", app: "youtube" });
  assert.equal(L5.phoneIntent("cierra jarvis"), null);
  assert.deepEqual(L5.phoneIntent("prende la linterna"), { kind: "linterna", on: true });
  assert.deepEqual(L5.phoneIntent("apaga la linterna"), { kind: "linterna", on: false });
  assert.equal(L5.phoneIntent("sube el volumen").accion, "subir");
  assert.deepEqual(L5.phoneIntent("pon una alarma a las 5 y 30 de la mañana"), { kind: "alarma", hora: 5, minuto: 30, texto: "Jarvis" });
  assert.deepEqual(L5.phoneIntent("ponme una alarma a las 3 de la tarde para la reunión"), { kind: "alarma", hora: 15, minuto: 0, texto: "La reunion" });
  assert.equal(L5.phoneIntent("despiértame a las 6").hora, 6);
  assert.equal(k("ve al inicio"), "global"); assert.equal(L5.phoneIntent("atrás").accion, "atras");
  assert.equal(L5.phoneIntent("toma una captura de pantalla").accion, "captura");
  assert.equal(L5.phoneIntent("bloquea el celular").accion, "bloquear");
  assert.deepEqual(L5.phoneIntent("¿cómo llego a la Universidad Nacional?"), { kind: "mapa", lugar: "la Universidad Nacional" });
  assert.equal(L5.phoneIntent("busca en youtube fracciones equivalentes").q, "fracciones equivalentes");
  assert.equal(k("modo dictado"), "dictado"); assert.equal(k("voy a dictar"), "dictado");
  assert.deepEqual(L5.phoneIntent("nota de voz: comprar marcadores"), { kind: "nota_voz", texto: "comprar marcadores" });
  assert.equal(L5.phoneIntent("anota en el observador de Pablo que…"), null);   // eso lo hace el observador
  assert.equal(k("modo bolsillo"), "bolsillo");
  assert.equal(k("resumen de la mañana"), "rutina");
  assert.equal(L5.phoneIntent("¿qué hora es?"), null);
  assert.equal(L5.phoneIntent("pasa lista de 7A"), null);
  assert.equal(L5.phoneIntent("llama lista"), null);
});

test("buscar contactos y apps, número de WhatsApp, sí y no", () => {
  const c = [{ nombre: "Mamá" }, { nombre: "Juan Pérez" }, { nombre: "Juana Ruiz" }, { nombre: "Coordinadora Marta" }];
  assert.equal(L5.bestMatch("mamá", c).nombre, "Mamá");
  assert.equal(L5.bestMatch("juan", c).nombre, "Juan Pérez");
  assert.equal(L5.bestMatch("la coordinadora", c), null);
  assert.equal(L5.bestMatch("coordinadora", c).nombre, "Coordinadora Marta");
  const apps = [{ nombre: "WhatsApp", paquete: "com.whatsapp" }, { nombre: "Cámara", paquete: "com.sec.android.app.camera" }, { nombre: "Fotos", paquete: "com.google.android.apps.photos" }];
  assert.equal(L5.appMatch("wasap", apps).paquete, "com.whatsapp");
  assert.equal(L5.appMatch("camara", apps).paquete, "com.sec.android.app.camera");
  assert.equal(L5.appMatch("galeria", apps).paquete, "com.google.android.apps.photos");
  assert.equal(L5.waNumber("300 123 4567"), "573001234567");
  assert.equal(L5.waNumber("+57 (300) 123-4567"), "573001234567");
  assert.ok(L5.isYes("sí, llámalo")); assert.ok(L5.isNo("no, cancela")); assert.ok(!L5.isYes("no"));
});

test("dictado con puntuación por voz", () => {
  assert.equal(L5.dictPunct("hola coma qué tal punto nos vemos mañana"), "Hola, qué tal. Nos vemos mañana");
  assert.equal(L5.dictPunct("querida familia dos puntos nueva línea les escribo"), "Querida familia:\nLes escribo");
  assert.equal(L5.dictPunct("abre interrogación vienes cierra interrogación"), "¿Vienes?");
  assert.equal(L5.dictPunct("primero punto y aparte segundo"), "Primero.\n\nSegundo");
  assert.ok(L5.dictStop("fin del dictado")); assert.ok(L5.dictUndo("borra la última frase"));
});

test("notas de voz: a dónde van", () => {
  const n = ["Pablo Mora", "Ana Rojas"];
  assert.deepEqual(L5.noteRoute("Pablo Mora no trajo la tarea", n), { destino: "observador", quien: "Pablo Mora" });
  assert.deepEqual(L5.noteRoute("hoy en 7A vimos fracciones", n), { destino: "diario", curso: "7A" });
  assert.equal(L5.noteRoute("tengo que imprimir las guías", n).destino, "compromiso");
  assert.equal(L5.noteRoute("comprar marcadores", n).destino, "nota");
});

test("banco de preguntas y versiones A–D", () => {
  const qz = (t, ps) => ({ id: t, tema: t, quiz: { titulo: t, preguntas: ps.map((e) => ({ enunciado: e, opciones: ["a", "b", "c", "d"], correcta: 1 })) } });
  const b = L5.bank([qz("fracciones", ["1/2+1/2", "2/4 = ?", "1/3 de 9"]), qz("potencias", ["2^3", "1/2+1/2"])]);
  assert.equal(b.length, 4);                                           // la repetida no se cuenta dos veces
  assert.deepEqual(L5.bankTopics(b)[0], { tema: "fracciones", n: 3 });
  assert.equal(L5.bankPick(b, "fracciones", 2, 5).length, 2);
  assert.equal(L5.bankPick(b, "", 10, 5).length, 4);
  assert.deepEqual(L5.bankIntent("ármame un quiz de 8 preguntas del banco de fracciones"), { kind: "banco_quiz", n: 8, tema: "fracciones" });
  assert.deepEqual(L5.bankIntent("haz un quiz del banco de potencias de 5 preguntas"), { kind: "banco_quiz", n: 5, tema: "potencias" });
  assert.equal(L5.bankIntent("hazme las versiones A, B, C y D del quiz").kind, "versiones");
  const base = { titulo: "Q", preguntas: [0, 1, 2, 3, 4].map((i) => ({ enunciado: "P" + i, opciones: ["w" + i, "x" + i, "y" + i, "z" + i], correcta: i % 4 })) };
  const v = L5.versions(base, 4);
  assert.equal(v.length, 4); assert.equal(v[0].preguntas[0].enunciado, "P0"); assert.equal(v[2].version, "C");
  v.forEach((q) => q.preguntas.forEach((p) => { const orig = base.preguntas.find((o) => o.enunciado === p.enunciado); assert.equal(p.opciones[p.correcta], orig.opciones[orig.correcta]); }));
  assert.notDeepEqual(v[1].preguntas.map((p) => p.enunciado), v[2].preguntas.map((p) => p.enunciado));
});

test("página de la práctica: sin la clave", () => {
  const html = L5.practicePage({ titulo: "Q <1>", preguntas: [{ enunciado: "¿2+2?", opciones: ["3", "4"], correcta: 1 }] });
  assert.match(html, /Q &lt;1&gt;/); assert.match(html, /name="q0" value="1"/);
  assert.doesNotMatch(html, /correcta/);
});

test("recordatorios por lugar", () => {
  assert.deepEqual(L5.placeIntent("guarda este lugar como el colegio"), { kind: "lugar_guardar", lugar: "colegio" });
  assert.deepEqual(L5.placeIntent("cuando llegue al colegio recuérdame imprimir las guías"), { kind: "lugar_rec", salir: false, lugar: "colegio", texto: "imprimir las guías" });
  assert.deepEqual(L5.placeIntent("recuérdame comprar pan cuando salga del colegio"), { kind: "lugar_rec", salir: true, lugar: "colegio", texto: "comprar pan" });
  assert.equal(L5.placeIntent("recuérdame a las 3 llamar"), null);
});

test("dictado: nueva línea al empezar", () => {
  assert.equal(L5.dictPunct("nueva línea segunda frase"), "\nSegunda frase");
});
