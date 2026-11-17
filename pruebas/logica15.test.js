// Pruebas de la lógica 3.24 (Nexo Escritorio)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica15.js");

test("órdenes para el escritorio", () => {
  const c = (t) => L.nexoIntent(t);
  assert.deepEqual(c("Jarvis, abre el escritorio"), { nx: "abrir" });
  assert.deepEqual(c("abre el escritorio en el monitor"), { nx: "abrir" });
  assert.deepEqual(c("abre el modo escritorio en la tele"), { nx: "abrir" });
  assert.deepEqual(c("escritorio en el celular"), { nx: "aqui" });
  assert.deepEqual(c("cierra el escritorio"), { nx: "cerrar" });
  assert.deepEqual(c("abre el touchpad"), { nx: "touchpad" });
  assert.deepEqual(c("abre el menú de inicio"), { nx: "inicio" });
  assert.deepEqual(c("abre el centro de control"), { nx: "panel" });
  assert.deepEqual(c("minimiza todo"), { nx: "mostrar" });
  assert.deepEqual(c("¿está conectado el monitor?"), { nx: "estado" });
  assert.deepEqual(c("busca recetas de arepas en el monitor"), { nx: "buscar", q: "recetas de arepas" });
  assert.deepEqual(c("abre YouTube a pantalla completa en el monitor"), { nx: "app", app: "youtube", modo: "completa" });
  assert.deepEqual(c("abre Spotify en ventana"), { nx: "app", app: "spotify", modo: "ventana" });
  assert.deepEqual(c("abre netflix en la tele"), { nx: "app", app: "netflix", modo: "" });
  assert.deepEqual(c("abre Chrome a la izquierda y Word a la derecha en el monitor"), { nx: "apps", lista: [{ app: "chrome", modo: "izquierda" }, { app: "word", modo: "derecha" }] });
});

test("lo que NO es del escritorio sigue igual", () => {
  for (const t of ["abre YouTube", "pon 10 minutos", "abre la ventana", "¿qué es la fotosíntesis?", "pon una alarma a las 6", "abre WhatsApp", "busca recetas de arepas"])
    assert.equal(L.nexoIntent(t), null, t);
});

test("escenas", () => {
  const e = L.escenasDe("Trabajo: Chrome izquierda, Word derecha\nCine = Netflix pantalla completa\nlínea sin formato");
  assert.equal(e.length, 2);
  assert.deepEqual(e[0], { nombre: "Trabajo", apps: [{ app: "chrome", modo: "izquierda" }, { app: "word", modo: "derecha" }] });
  assert.equal(L.escenaIntent("pon el escritorio de trabajo", e).nombre, "Trabajo");
  assert.equal(L.escenaIntent("modo cine", e).nombre, "Cine");
  assert.equal(L.escenaIntent("modo avión", e), null);
});

test("lo que sabe la IA", () => {
  const p = L.prompt({ monitor: "HDMI", abierto: true }, L.escenasDe("Trabajo: Chrome izquierda"));
  assert.match(p, /Nexo Escritorio/);
  assert.match(p, /<<orden: abre chrome a la izquierda en el monitor>>/);
  assert.match(p, /monitor conectado \(HDMI\)/);
  assert.match(p, /Trabajo/);
  assert.equal(L.describir({ nx: "app", app: "chrome", modo: "izquierda" }), "Abro chrome a la izquierda en el monitor.");
  // la orden que escribe la IA la entiende la misma lógica
  assert.deepEqual(L.nexoIntent("abre chrome a la izquierda en el monitor"), { nx: "app", app: "chrome", modo: "izquierda" });
});

test("formas de conexión", () => {
  assert.equal(L.FORMAS.length, 4);
  assert.deepEqual(L.FORMAS.map((f) => f[0]), ["cable", "inalambrica", "computador", "celular"]);
  assert.deepEqual(L.nexoIntent("busca pantallas"), { nx: "pantallas" });
  assert.deepEqual(L.nexoIntent("conéctame a la TV inalámbrica"), { nx: "pantallas" });
  assert.deepEqual(L.nexoIntent("¿cómo conecto el monitor?"), { nx: "formas" });
  assert.deepEqual(L.nexoIntent("¿cómo conecto el celular a la tele?"), { nx: "formas" });
  assert.deepEqual(L.nexoIntent("prepara el celular para el escritorio"), { nx: "preparar" });
  assert.equal(L.nexoIntent("¿cómo conecto los audífonos?"), null);
  assert.equal(L.tipoConexion("scrcpy"), "computador");
  assert.equal(L.tipoConexion("HDMI Screen"), "cable");
  assert.equal(L.tipoConexion("Wireless display"), "inalambrica");
  assert.equal(L.tipoConexion(""), "");
  assert.match(L.SCRCPY.cable, /--new-display=.*--start-app=com\.nexo\.escritorio/);
});
