// Pruebas de la lógica 3.23
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica14.js");
const HOY = new Date(2026, 10, 15).getTime();

test("¿buscar en internet?", () => {
  for (const t of ["¿quién ganó el partido de anoche?", "¿cuánto está el dólar hoy?", "¿cuáles son las noticias de hoy en Colombia?", "¿quién es el actual presidente de Francia?", "¿cuándo juega Millonarios?", "¿qué pasó con las elecciones de 2026?", "¿hay pico y placa en Bogotá mañana?", "¿cuándo es el estreno de la nueva temporada de The Last of Us?"])
    assert.equal(L.necesitaBuscar(t, HOY), true, t);
  for (const t of ["¿qué es la fotosíntesis?", "explícame las fracciones equivalentes", "hola", "recuérdame hoy a las 3 llamar a mamá", "¿cuál es el área de un círculo de radio 3?", "cuéntame un chiste"])
    assert.equal(L.necesitaBuscar(t, HOY), false, t);
});
test("Ajustes por temas", () => {
  assert.equal(L.temaDe("Inteligencia artificial"), "ia");
  assert.equal(L.temaDe("IA de respaldo (sin internet o conexión lenta)"), "ia");
  assert.equal(L.temaDe("«Jarvis» en segundo plano"), "voz");
  assert.equal(L.temaDe("Voz natural con IA"), "voz");
  assert.equal(L.temaDe("Tú"), "tu");
  assert.equal(L.temaDe("Memoria"), "tu");
  assert.equal(L.temaDe("Medicamentos"), "rutinas");
  assert.equal(L.temaDe("Reloj y audífonos"), "celular");
  assert.equal(L.temaDe("Diseño y rapidez"), "aspecto");
  assert.equal(L.temaDe("Lo que gasta batería ahora"), "bateria");
  assert.equal(L.temaDe("Copia de seguridad en el celular"), "datos");
  assert.equal(L.temaDe("Horario y colegio"), "docente");
  assert.equal(L.temaDe("Algo nuevo"), "mas");
  assert.equal(L.FORMAS.filter((f) => f[3] === "media").length, 1);
});
