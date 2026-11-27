// Pruebas de la lógica 3.40 (imágenes y videos 2.0, aprende de tus correcciones, «¿de qué hablamos ayer?»)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica27.js");

test("texto exacto encima de la imagen", () => {
  assert.deepEqual(L.textoExacto("una invitación de cumpleaños con globos, que diga «¡Te espero el sábado!»"), { desc: "una invitación de cumpleaños con globos", texto: "¡Te espero el sábado!", pos: "arriba" });
  assert.deepEqual(L.textoExacto("un aviso de empanadas con el texto \"Empanadas a $2.500\""), { desc: "un aviso de empanadas", texto: "Empanadas a $2.500", pos: "abajo" });
  assert.deepEqual(L.textoExacto("un gato astronauta"), { desc: "un gato astronauta", texto: "", pos: "abajo" });
  assert.equal(L.textoExacto("un pastel que diga Feliz cumpleaños Ana").texto, "Feliz cumpleaños Ana");
  assert.match(L.SIN_TEXTO("arriba"), /parte de arriba/);
  assert.equal(L.PLANTILLAS.length, 6); assert.ok(L.ESTILOS_MAS.some((e) => e[0] === "cine"));
  assert.equal(L.promptLimpio('"A cute cat floating in space, soft light."'), "A cute cat floating in space, soft light.");
});

test("videos 2.0", () => {
  assert.deepEqual(L.fotosIntent("hazme un video con mis fotos del paseo a Santa Marta"), { vf: true, desc: "paseo a Santa Marta" });
  assert.deepEqual(L.fotosIntent("crea un video con mis fotos"), { vf: true, desc: "" });
  assert.equal(L.fotosIntent("hazme un video de un perro"), null);
  assert.equal(L.duracionDe("un video de 30 segundos de mi perro"), 30);
  assert.equal(L.duracionDe("un video de un minuto"), 60);
  assert.equal(L.duracionDe("un video de 5 s"), 10);
  assert.equal(L.duracionDe("un video de mi perro"), 0);
  assert.equal(L.escenasPara(30), 6); assert.equal(L.escenasPara(60, 8), 8); assert.equal(L.escenasPara(0), 4);
  assert.equal(L.animoDe("invitación para el cumpleaños de mi mamá"), "alegre");
  assert.equal(L.animoDe("homenaje en memoria de mi abuelo"), "suave");
  assert.equal(L.animoDe("el ciclo del agua"), "tranquilo");
  assert.deepEqual([0, 1, 2, 3].map(L.transicion), ["fundido", "deslizar", "acercar", "fundido"]);
});

test("aprende de tus correcciones", () => {
  assert.equal(L.correccionIntent("eso fue muy largo").largo, "corto");
  assert.equal(L.correccionIntent("dame más detalles").largo, "detallado");
  assert.equal(L.correccionIntent("habla más despacio").velocidad, -0.15);
  assert.equal(L.correccionIntent("hablas muy lento").velocidad, 0.15);
  assert.equal(L.correccionIntent("no me digas señor").trato, "nombre");
  assert.equal(L.correccionIntent("no uses emojis").emojis, false);
  assert.equal(L.correccionIntent("¿cuánto es 2 más 2?"), null);
});

test("¿de qué hablamos ayer?", () => {
  const NOW = new Date(2026, 10, 26, 22, 0).getTime(), H = 3600e3;
  assert.deepEqual(L.recuerdoIntent("¿de qué hablamos ayer?"), { dia: "ayer" });
  assert.deepEqual(L.recuerdoIntent("resúmeme lo que hablamos esta semana"), { dia: "semana" });
  assert.equal(L.recuerdoIntent("¿qué hablamos de política?"), null);
  const convs = [{ chat: [{ role: "user", content: "hola", t: NOW - 26 * H }, { role: "assistant", content: "error", cls: "err", t: NOW - 25 * H }, { role: "user", content: "hoy", t: NOW - H }] }, { chat: [{ role: "assistant", content: "receta de arepas", t: NOW - 24 * H }] }];
  assert.deepEqual(L.mensajesDel(convs, "ayer", NOW).map((m) => m.content), ["hola", "receta de arepas"]);
  assert.deepEqual(L.mensajesDel(convs, "hoy", NOW).map((m) => m.content), ["hoy"]);
  assert.match(L.PROMPT_RECUERDO("ayer", [{ role: "user", content: "hola" }]), /hablamos ayer[\s\S]*Tú: hola/);
});
