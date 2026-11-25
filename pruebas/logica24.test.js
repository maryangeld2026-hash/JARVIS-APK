// Pruebas de la lógica 3.37 (un Jarvis más humano y más inteligente)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica24.js");
const NOW = new Date(2026, 10, 24, 21, 0).getTime();          // martes 24 de noviembre, 9 p. m.
const dia = (d) => { const x = new Date(2026, 10, 24 + d); x.setHours(0, 0, 0, 0); return x.getTime(); };
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test("respuestas con variedad y sin comas sueltas", () => {
  assert.equal(L.variar("Listo, quité la rutina de sueño.", seq(0.2)), "Hecho, quité la rutina de sueño.");
  assert.equal(L.variar("🔑 Listo: anotado.", seq(0.7)), "🔑 Dale: anotado.");
  assert.equal(L.variar("Ya te ayudo.", seq(0.2)), "Ya te ayudo.");
  assert.equal(L.variar("Listo señor", seq(0)), "Listo señor");                 // solo «Listo» seguido de signo
  assert.equal(L.pulir("Hecho, . Hasta pronto, ."), "Hecho. Hasta pronto.");
  assert.equal(L.pulir("¿Sí, ?"), "¿Sí?");
  assert.match(L.NATURAL, /de «tú»/); assert.match(L.ANIMO, /cansada, triste/);
});

test("memoria que pregunta: «¿cómo te fue en…?»", () => {
  assert.deepEqual(L.seguimientoDe("mañana tengo cita médica a las 8", NOW), { tema: "la cita médica", dia: dia(1) });
  assert.deepEqual(L.seguimientoDe("el viernes tengo una entrevista de trabajo", NOW), { tema: "la entrevista de trabajo", dia: dia(3) });
  assert.deepEqual(L.seguimientoDe("tengo examen de ingles pasado mañana", NOW), { tema: "el examen de ingles", dia: dia(2) });
  assert.deepEqual(L.seguimientoDe("hoy tengo partido", NOW), { tema: "el partido", dia: dia(0) });
  assert.equal(L.seguimientoDe("tengo cita médica por la mañana", NOW), null);   // sin día claro no se adivina
  assert.equal(L.seguimientoDe("mañana tengo clase a las 7", NOW), null);         // lo de todos los días no
  assert.equal(L.seguimientoDe("qué es una cita bibliográfica", NOW), null);
  const s = { tema: "la cita médica", dia: dia(1) };
  assert.equal(L.tocaPreguntar(s, NOW), false);
  assert.equal(L.tocaPreguntar(s, dia(1) + 19 * 3600e3), true);
  assert.equal(L.tocaPreguntar(s, dia(6)), false);
  assert.equal(L.tocaPreguntar(Object.assign({ preguntado: true }, s), dia(1) + 19 * 3600e3), false);
  assert.equal(L.pregunta(s, seq(0)), "Oye, ¿cómo te fue en la cita médica?");
});

test("preguntas difíciles → pensar más", () => {
  assert.equal(L.dificil("¿qué me conviene más, un crédito a 24 meses al 1,8 % o pagar de contado con descuento del 10 %?"), true);
  assert.equal(L.dificil("compara el plan de datos de Claro con el de Tigo para alguien que viaja mucho"), true);
  assert.equal(L.dificil("¿por qué el cielo es azul y en los atardeceres se pone naranja?"), true);
  assert.equal(L.dificil("¿qué hora es?"), false);
  assert.equal(L.dificil("hola, ¿cómo estás? cuéntame algo bonito de tu día por favor"), false);
  assert.equal(L.dificil("recuérdame mañana a las 8 llamar a mi mamá para su cumpleaños"), false);
});

test("la voz dice la plata como plata y no lee emojis", () => {
  const LL = require("../www/js/logica.js");
  assert.equal(LL.forSpeech("🧾 Cuenta: $180.000 + propina del 10 % ($18.000) = **$198.000**."), "Cuenta: 180.000 pesos + propina del 10 % (18.000 pesos) = 198.000 pesos.");
  assert.equal(LL.forSpeech("Cuesta $20 mil · en Éxito"), "Cuesta 20 mil, en Éxito");
  assert.equal(LL.forSpeech("**Ojo:** $\\frac{3}{4}+x^2$"), "Ojo: 3 sobre 4 más x al cuadrado");
  assert.equal(LL.forSpeech("La recta $y = 2x + 1$ sube"), "La recta y igual a 2x más 1 sube");
});

test("personalidad natural en las instrucciones", () => {
  const L7 = require("../www/js/logica7.js");
  const p = L7.personaPrompt({ estilo: "natural" });
  assert.match(p, /persona real de Colombia/); assert.match(p, /cansada, triste/); assert.doesNotMatch(p, /J\.A\.R\.V\.I\.S/);
  assert.match(L7.personaPrompt({}), /J\.A\.R\.V\.I\.S\./);
});
