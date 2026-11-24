// Pruebas de la lógica 3.31 (doce habilidades nuevas)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica20.js");
const NOW = new Date(2026, 10, 23, 22, 0).getTime();          // lunes 23 de noviembre de 2026, 10 p. m.

test("festivos de Colombia 2026 (Ley Emiliani)", () => {
  assert.deepEqual(L.festivos(2026).map((x) => x.fecha), ["2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
    "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25"]);
  assert.equal(L.festivos(2027).length, 18);
  assert.equal(L.pascua(2027).getDate(), 28);                  // 28 de marzo de 2027
  assert.equal(L.festivo(new Date(2026, 11, 8)).nombre, "Inmaculada Concepción");
  assert.equal(L.proximosFestivos(NOW, 2)[0].fecha, "2026-12-08");
  assert.equal(L.proximosFestivos(NOW, 3)[2].fecha, "2027-01-01");
  assert.ok(L.esPuente("2026-11-16") && !L.esPuente("2026-12-08"));
});

test("pico y placa en Bogotá y Medellín", () => {
  // Bogotá: martes 24 (par) no circulan 1-5; miércoles 25 (impar) no circulan 6-0
  assert.equal(L.picoPlaca("bogota", 3, new Date(2026, 10, 24)).aplica, true);
  assert.equal(L.picoPlaca("bogota", 8, new Date(2026, 10, 24)).aplica, false);
  assert.equal(L.picoPlaca("bogota", 8, new Date(2026, 10, 25)).aplica, true);
  assert.equal(L.picoPlaca("bogota", 3, new Date(2026, 10, 28)).motivo, "es fin de semana");
  assert.match(L.picoPlaca("bogota", 4, new Date(2026, 10, 16)).motivo, /festivo/);
  // Medellín: lunes 5 y 8, martes 1 y 4, miércoles 0 y 2, jueves 3 y 6, viernes 7 y 9
  assert.equal(L.picoPlaca("medellin", 4, new Date(2026, 10, 24)).aplica, true);
  assert.equal(L.picoPlaca("medellin", 0, new Date(2026, 10, 25)).aplica, true);
  assert.equal(L.picoPlaca("medellin", 9, new Date(2026, 10, 27)).aplica, true);
  assert.equal(L.picoPlaca("medellin", 9, new Date(2026, 10, 26)).aplica, false);
  assert.equal(L.picoPlaca("cali", 1, new Date(2026, 10, 24)).conocida, false);
  assert.equal(L.ciudadDe("vivo en Envigado"), "medellin");
  assert.match(L.picoTexto(L.picoPlaca("bogota", 3, new Date(2026, 10, 24)), 3, new Date(2026, 10, 24), NOW), /Sí, mañana tienes pico y placa/);
  assert.deepEqual(L.picoIntent("¿tengo pico y placa mañana?", NOW), { pp: "consulta", fecha: "2026-11-24", digito: null, ciudad: null });
  assert.deepEqual(L.picoIntent("mi placa termina en 7", NOW), { pp: "placa", digito: 7, ciudad: null });
  assert.deepEqual(L.picoIntent("mi placa termina en cinco y vivo en Bogotá", NOW), { pp: "placa", digito: 5, ciudad: "bogota" });
  assert.deepEqual(L.picoIntent("avísame el pico y placa", NOW), { pp: "avisar", on: true });
  assert.deepEqual(L.picoIntent("¿mañana es festivo?", NOW), { fe: "dia", fecha: "2026-11-24" });
  assert.deepEqual(L.picoIntent("¿cuál es el próximo puente?", NOW), { fe: "proximo", puente: true });
  assert.deepEqual(L.picoIntent("festivos de diciembre", NOW), { fe: "lista", mes: 11 });
  assert.deepEqual(L.diasConPico("bogota", 2, NOW, 6), ["2026-11-24", "2026-11-26"]);
});

test("YouTube", () => {
  assert.equal(L.ytId("https://youtu.be/dQw4w9WgXcQ?si=x"), "dQw4w9WgXcQ");
  assert.equal(L.ytId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.deepEqual(L.ytIntent("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10"), { yt: "resumen", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  assert.equal(L.ytIntent("resume este video https://youtu.be/dQw4w9WgXcQ").yt, "resumen");
  assert.deepEqual(L.ytIntent("¿qué receta hacen? https://youtu.be/dQw4w9WgXcQ"), { yt: "pregunta", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", q: "¿qué receta hacen?" });
  assert.deepEqual(L.ytIntent("en el video, ¿qué ingredientes usan?", "U"), { yt: "pregunta", url: "U", q: "que ingredientes usan" });
  assert.equal(L.ytIntent("en el video, ¿qué ingredientes usan?", null), null);
});

test("imágenes con Gemini", () => {
  assert.deepEqual(L.imagenIntent("Jarvis, haz una imagen de un volcán en erupción para niños"), { img: "crear", prompt: "una imagen de un volcán en erupción para niños" });
  assert.equal(L.imagenIntent("dibújame un gato astronauta"), null);       // «dibújame un gato…» sin «imagen» (es otra orden)
  assert.equal(L.imagenIntent("crea una invitación de cumpleaños con globos").img, "crear");
  assert.equal(L.imagenIntent("quítale el fondo a esta foto").img, "editar");
  assert.equal(L.imagenIntent("ponla en estilo caricatura").img, "editar");
  assert.equal(L.imagenIntent("haz un resumen del tema"), null);
  assert.equal(L.modeloImagen(["gemini-2.5-flash-image", "gemini-3.1-flash-lite-image", "gemini-3.1-flash-image", "imagen-4.0-generate-001"]), "gemini-3.1-flash-image");
  assert.equal(L.modeloImagen(["gemini-2.5-flash-image"]), "gemini-2.5-flash-image");
});

test("notas de voz y lluvia", () => {
  assert.ok(L.esAudio("audio/ogg", "x") && L.esAudio("", "PTT-2026.opus") && !L.esAudio("image/png", "a.png"));
  assert.equal(L.mimeAudio("audio/opus", ""), "audio/ogg");
  assert.equal(L.mimeAudio("", "nota.m4a"), "audio/mp4");
  const h = { hourly: { time: ["2026-11-23T14:00", "2026-11-23T15:00", "2026-11-23T16:00"], precipitation_probability: [20, 85, 90], precipitation: [0, 3.2, 6], weather_code: [3, 63, 65] } };
  const r = L.lluviaFuerte(h, new Date(2026, 10, 23, 13, 30).getTime());
  assert.equal(r.hora, "2026-11-23T15:00");
  assert.match(L.lluviaTexto(r), /Lluvia fuerte hacia las 3 p\. m\. \(85 %, 3,2 mm\)/);
  assert.equal(L.lluviaFuerte({ hourly: { time: ["2026-11-23T14:00"], precipitation_probability: [60], precipitation: [0.5], weather_code: [61] } }, new Date(2026, 10, 23, 13).getTime()), null);
  assert.deepEqual(L.alertasIntent("avísame si va a llover fuerte"), { al: true });
});

test("mapas mentales", () => {
  assert.deepEqual(L.mapaIntent("hazme un mapa mental de la fotosíntesis"), { mm: "mapa mental", tema: "la fotosíntesis", doc: "" });
  assert.equal(L.mapaIntent("haz un mapa conceptual del documento circular").doc, "circular");
  const m = L.mapaValido({ tema: "Fotosíntesis", ramas: [{ t: "Qué es", hijos: [{ t: "Proceso de las plantas" }, "Usa luz"] }, { t: "Fases", hijos: [{ t: "Luminosa" }] }, { x: 1 }] });
  assert.equal(m.ramas.length, 2); assert.equal(m.ramas[0].hijos[1].t, "Usa luz");
  const s = L.svgMapa(Object.assign({}, m, { tema: "<b>Foto</b> & síntesis" }));
  assert.ok(s.startsWith("<svg") && s.includes("&lt;b&gt;Foto&lt;/b&gt; &amp;") && !s.includes("<b>"));
  assert.match(L.mapaTexto(m), /- \*\*Fases\*\*\n  - Luminosa/);
  assert.equal(L.mapaValido({ nada: 1 }), null);
});

test("resumen en audio a dos voces", () => {
  assert.equal(L.audioResumenIntent("hazme un podcast del documento acta de padres").doc, "acta de padres");
  assert.equal(L.audioResumenIntent("haz un resumen en audio de la revolución francesa").tema, "la revolución francesa");
  const g = L.guionValido({ titulo: "X", lineas: [{ quien: "ana", t: "Hola **hoy**" }, { quien: "Pedro", t: "no" }, { quien: "Luis", t: "¿Y?" }] });
  assert.deepEqual(g.lineas, [{ quien: "Ana", t: "Hola hoy" }, { quien: "Luis", t: "¿Y?" }]);
  const p = L.pedidoTTS(g);
  assert.equal(p.generationConfig.speechConfig.multiSpeakerVoiceConfig.speakerVoiceConfigs.length, 2);
  assert.match(p.contents[0].parts[0].text, /Ana: Hola hoy\nLuis: ¿Y\?/);
  assert.equal(L.modeloTTS(["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.5-flash"]), "gemini-3.8-flash-tts");
  const w = L.wavDePCM(Buffer.from([1, 0, 2, 0]).toString("base64"), 24000);
  const b = Buffer.from(w, "base64");
  assert.equal(b.slice(0, 4).toString(), "RIFF"); assert.equal(b.readUInt32LE(24), 24000); assert.equal(b.length, 48);
  assert.equal(L.wavDePCM(w), w);
  assert.equal(L.tasaDe("audio/L16;codec=pcm;rate=24000"), 24000);
});

test("tutor, salud y concentración", () => {
  assert.deepEqual(L.tutorIntent("ayúdame con este ejercicio paso a paso"), { tu: "empezar" });
  assert.equal(L.tutorFin("ya entendí"), "salir"); assert.equal(L.tutorFin("dame la respuesta"), "respuesta"); assert.equal(L.tutorFin("es 12"), null);
  assert.deepEqual(L.saludIntent("¿cómo dormí esta semana?"), { sa: "sueno", rango: "semana" });
  assert.deepEqual(L.saludIntent("¿cuántos pasos llevo hoy?"), { sa: "pasos", rango: "hoy" });
  assert.deepEqual(L.saludIntent("conecta Health Connect"), { sa: "conectar" });
  const r = { pasos: [{ dia: "2026-11-23", n: 6543 }, { dia: "2026-11-22", n: 10000 }], sueno: [{ ini: NOW - 10 * 3600e3, fin: NOW - 3 * 3600e3 }], pulso: { prom: 71.4, min: 52, max: 120 } };
  assert.match(L.saludTexto(r, { sa: "pasos", rango: "hoy" }, NOW), /Hoy llevas \*\*6\.543 pasos\*\*/);
  assert.match(L.saludTexto(r, { sa: "sueno", rango: "anoche" }, NOW), /Anoche dormiste \*\*7 h\*\*/);
  assert.match(L.saludTexto(r, { sa: "corazon" }, NOW), /promedio \*\*71 lpm\*\*/);
  assert.deepEqual(L.enfoqueIntent("necesito concentrarme 50 minutos"), { en: "iniciar", min: 50 });
  assert.deepEqual(L.enfoqueIntent("modo concentración por una hora"), { en: "iniciar", min: 60 });
  assert.deepEqual(L.enfoqueIntent("pomodoro"), { en: "iniciar", min: 25 });
  assert.deepEqual(L.enfoqueIntent("termina la concentración"), { en: "parar" });
  assert.match(L.enfoqueResumen([{ ini: NOW - 3600e3, min: 50 }, { ini: NOW - 3 * 864e5, min: 25 }], NOW), /1 h 15 min.*2 sesiones \(hoy 50 min\)/);
});

test("paquetes y vencimientos", () => {
  assert.deepEqual(L.paqueteIntent("rastrea el paquete 2045678912 de Servientrega"), { pq: "agregar", guia: "2045678912", empresa: "servientrega" });
  assert.deepEqual(L.paqueteIntent("rastrea la guía 700123456789"), { pq: "agregar", guia: "700123456789", empresa: null });
  assert.deepEqual(L.paqueteIntent("¿cómo va mi paquete?"), { pq: "ver" });
  assert.deepEqual(L.vencIntent("mi SOAT vence el 15 de marzo", NOW), { ve: "agregar", que: "SOAT", fecha: "2027-03-15" });
  assert.deepEqual(L.vencIntent("la tecnomecánica vence el 2 de diciembre", NOW), { ve: "agregar", que: "Revisión técnico-mecánica", fecha: "2026-12-02" });
  assert.deepEqual(L.vencIntent("la garantía de la nevera es de 12 meses, la compré hoy", NOW), { ve: "agregar", que: "Garantía de nevera", fecha: "2027-11-23", garantia: true });
  assert.deepEqual(L.vencIntent("¿qué se me vence?", NOW), { ve: "ver" });
  assert.deepEqual(L.vencIntent("guarda la garantía de esta factura", NOW), { ve: "foto" });
  const a = L.avisosVenc({ que: "SOAT", fecha: "2026-12-02" }, NOW);
  assert.equal(a.length, 3);                                   // a un mes ya pasó: avisa a 7 días, 1 día y el día
  assert.match(a[0].texto, /SOAT vence en una semana \(2 de diciembre\)/);
  assert.match(L.vencLista([{ que: "SOAT", fecha: "2026-12-02" }], NOW), /⚠️|⏳/);
});
