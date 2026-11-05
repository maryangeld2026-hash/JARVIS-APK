// Pruebas de la lógica 3.17: traductor y canciones
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica12.js");

test("órdenes del traductor: texto con sus mayúsculas y tildes", () => {
  assert.deepEqual(L.tradIntent("Traduce al inglés: ¿Dónde está el baño?"), { tr: "texto", texto: "¿Dónde está el baño?", a: "en" });
  assert.deepEqual(L.tradIntent("traduce Buenos días, señor García al francés"), { tr: "texto", texto: "Buenos días, señor García", a: "fr" });
  assert.deepEqual(L.tradIntent("¿Cómo se dice «me encanta este lugar» en japonés?"), { tr: "texto", texto: "me encanta este lugar", a: "ja" });
  assert.deepEqual(L.tradIntent("qué significa \"I'm looking forward to it\""), { tr: "texto", texto: "I'm looking forward to it", a: "es" });
  assert.deepEqual(L.tradIntent("Jarvis, cómo le digo gracias por todo en portugués"), { tr: "texto", texto: "gracias por todo", a: "pt" });
  assert.equal(L.tradIntent("qué es la fotosíntesis"), null);
  assert.equal(L.tradIntent("pon 10 minutos"), null);
});
test("órdenes del traductor: conversación, lo último, pantalla, foto y paquetes", () => {
  assert.deepEqual(L.tradIntent("abre el traductor"), { tr: "panel", otro: "" });
  assert.deepEqual(L.tradIntent("modo traductor en inglés"), { tr: "panel", otro: "en" });
  assert.deepEqual(L.tradIntent("ayúdame a hablar con alguien en francés"), { tr: "panel", otro: "fr" });
  assert.equal(L.tradIntent("traduce lo que dicen en alemán").escuchar, true);
  assert.deepEqual(L.tradIntent("tradúcelo al italiano"), { tr: "ultimo", a: "it" });
  assert.deepEqual(L.tradIntent("traduce eso al italiano"), { tr: "ultimo", a: "it" });
  assert.deepEqual(L.tradIntent("traduce esta pantalla"), { tr: "pantalla", a: "" });
  assert.deepEqual(L.tradIntent("traduce este menú al español"), { tr: "foto", a: "es" });
  assert.deepEqual(L.tradIntent("descarga el inglés para traducir sin internet"), { tr: "bajar", idioma: "en" });
});
test("idiomas y respuesta de la IA", () => {
  assert.equal(L.codigo("Inglés"), "en"); assert.equal(L.codigo("al francés"), "fr"); assert.equal(L.codigo("xx"), null);
  assert.equal(L.locale("pt"), "pt-BR"); assert.equal(L.offline("qu"), false);
  assert.match(L.tradPrompt("hola", "en"), /inglés.*JSON/s);
  assert.deepEqual(L.tradLimpia({ traduccion: "Hello", de: "es", pronunciacion: "jelóu", nota: "" }, "Hola"), { texto: "Hello", de: "es", pron: "jelóu", nota: "", original: "Hola" });
  assert.equal(L.tradLimpia({}, "x"), null);
  assert.equal(L.destinoDe("es", "es", "en"), "en"); assert.equal(L.destinoDe("en", "es", "en"), "es"); assert.equal(L.destinoDe("fr", "es", "en"), "es");
});
test("órdenes de canciones", () => {
  for (const t of ["¿qué canción es esta?", "qué está sonando", "cómo se llama esta canción", "Jarvis, reconoce esta canción", "shazam", "quién canta esto", "qué canción suena"]) assert.deepEqual(L.musicaIntent(t), { mu: "reconocer" }, t);
  assert.deepEqual(L.musicaIntent("voy a tararear una canción"), { mu: "reconocer", tararear: true });
  assert.deepEqual(L.musicaIntent("mis canciones"), { mu: "lista" });
  assert.deepEqual(L.musicaIntent("ponme la última canción"), { mu: "ultima_poner" });
  assert.equal(L.musicaIntent("pon música"), null);
});
test("AudD, Gemini y búsqueda", () => {
  const ok = { status: "success", result: { title: "Bonito", artist: "Jarabe de Palo", album: "Bonito", release_date: "2003-01-01", spotify: { external_urls: { spotify: "https://open.spotify.com/track/x" }, album: { images: [{ url: "https://i/x.jpg" }] } } } };
  const c = L.auddParse(JSON.stringify(ok));
  assert.equal(c.titulo, "Bonito"); assert.equal(c.artista, "Jarabe de Palo"); assert.equal(c.spotify, "https://open.spotify.com/track/x"); assert.equal(c.portada, "https://i/x.jpg");
  assert.equal(L.auddParse({ status: "success", result: null }), null);
  assert.equal(L.auddParse({ status: "error", error: { error_code: 901 } }).error, "limite");
  assert.deepEqual(L.geminiCancionLimpia({ titulo: "X", artista: "Y", seguro: true, pista: "a" }), { titulo: "X", artista: "Y", seguro: true, pista: "a" });
  assert.equal(L.geminiCancionLimpia({ titulo: "", seguro: true }).seguro, false);
  assert.deepEqual(L.busquedaCancion("**La Tortura** — Shakira"), { titulo: "La Tortura", artista: "Shakira", fuente: "Gemini + Google" });
  assert.equal(L.busquedaCancion("no sé"), null);
  assert.match(L.cancionTexto(c), /Bonito.*Jarabe de Palo.*2003/s);
  assert.ok(L.mismaCancion(c, { titulo: "bonito", artista: "Jarabe De Palo" }));
  assert.equal(L.ytBuscar(c), "https://www.youtube.com/results?search_query=Bonito%20Jarabe%20de%20Palo");
});
