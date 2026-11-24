// Pruebas de la lógica 3.34 (once habilidades de asistente general)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica22.js");
const NOW = new Date(2026, 10, 24, 13, 0).getTime();       // martes 24 de noviembre, 1 p. m.
const T = (h, m) => new Date(2026, 10, 24, h, m || 0).getTime();

test("organizar el día", () => {
  assert.deepEqual(L.tareasDe("llamar al banco, hacer mercado 1 hora y estudiar 2 horas"), [{ t: "Llamar al banco", min: 30 }, { t: "Hacer mercado", min: 60 }, { t: "Estudiar", min: 120 }]);
  assert.deepEqual(L.organizarIntent("organiza mi tarde: llamar al banco y hacer mercado 1 hora").tareas.map((x) => x.t), ["Llamar al banco", "Hacer mercado"]);
  assert.deepEqual(L.organizarIntent("planea mi día"), { od: "plan", parte: "dia", tareas: [] });
  assert.deepEqual(L.organizarIntent("reorganiza mi día"), { od: "replan" });
  const ev = [{ titulo: "Reunión", inicio: T(14), fin: T(15) }, { titulo: "Cita médica", inicio: T(17), fin: T(18) }];
  const p = L.planDia(ev, [{ t: "Banco", min: 30 }, { t: "Estudiar", min: 120 }, { t: "Mercado", min: 60 }, { t: "Leer", min: 200 }], NOW, "tarde");
  assert.deepEqual(p.bloques.map((b) => [b.t, new Date(b.ini).getHours() + ":" + new Date(b.ini).getMinutes()]), [["Banco", "13:15"], ["Mercado", "15:10"]]);
  assert.deepEqual(p.sobran.map((x) => x.t), ["Estudiar", "Leer"]);           // 2 horas no caben entre la reunión y la cita
  assert.match(L.planTexto(p, ev), /1:15 p\. m\.–1:45 p\. m\.\*\* Banco[\s\S]*📅 Reunión[\s\S]*No alcanzó el tiempo para: Estudiar, Leer/);
});

test("choques en la agenda y hora de salir", () => {
  const ev = [{ titulo: "A", inicio: T(9), fin: T(10), lugar: "Oficina" }, { titulo: "B", inicio: T(9, 30), fin: T(10, 30), lugar: "Oficina" }, { titulo: "C", inicio: T(10, 40), fin: T(11), lugar: "Unicentro" }];
  const c = L.conflictos(ev);
  assert.deepEqual(c.map((x) => x.tipo + ":" + x.a.titulo + x.b.titulo), ["cruce:AB", "apretado:BC"]);
  assert.match(L.conflictosTexto(c), /se cruza con «B»[\s\S]*solo hay 10 min/);
  assert.deepEqual(L.agendaIntent("¿tengo choques en mi agenda mañana?", NOW), { ag: "choques", fecha: "2026-11-25" });
  assert.deepEqual(L.salirIntent("avísame cuándo salir"), { hs: "on" });
  assert.deepEqual(L.salirIntent("¿a qué hora salgo para la cita médica?"), { hs: "cuando", q: "cita medica" });
  assert.equal(L.minutosDe("MINUTOS: 35"), 35); assert.equal(L.minutosDe("Unos 40 minutos"), 40); assert.equal(L.minutosDe("no sé"), null);
  assert.equal(L.horaSalida(T(17), 35), T(16, 15));
});

test("temas, cocina y viajes", () => {
  assert.deepEqual(L.temasIntent("sígueme el tema del dólar"), { te: "seguir", q: "dólar" });
  assert.deepEqual(L.temasIntent("sígueme las noticias de Millonarios"), { te: "seguir", q: "Millonarios" });
  assert.deepEqual(L.temasIntent("deja de seguir el tema del dólar"), { te: "quitar", q: "dolar" });
  assert.deepEqual(L.temasIntent("resumen de mis temas"), { te: "resumen" });
  assert.match(L.PROMPT_TEMAS(["dólar"], "hoy"), /neutral/);
  assert.deepEqual(L.cocinaIntent("¿qué cocino con esto?"), { co: "foto" });
  assert.deepEqual(L.cocinaIntent("qué puedo cocinar con arroz, huevos y tomate"), { co: "texto", ingredientes: "arroz, huevos y tomate" });
  assert.equal(L.recetasValidas({ recetas: [{ nombre: "Arroz con huevo", minutos: "20", usa: ["arroz"] }, {}] }).recetas[0].minutos, 20);
  const v = L.viajeIntent("mi vuelo es el AV 123 mañana a las 6 de la mañana a Cartagena", NOW);
  assert.deepEqual(v, { vu: "agregar", vuelo: "AV123", fecha: "2026-11-25", hora: [6, 0], destino: "cartagena" });
  const a = L.avisosVuelo(v, NOW);
  assert.equal(a.length, 1);                                    // el check-in (24 h antes) ya pasó; queda «sal para el aeropuerto»
  assert.equal(new Date(a[0].at).getHours(), 3); assert.equal(new Date(a[0].at).getMinutes(), 30);
  assert.deepEqual(L.viajeIntent("lista para empacar para Medellín 4 días", NOW), { vu: "maleta", destino: "medellin", dias: 4 });
  assert.deepEqual(L.viajeIntent("¿cómo va mi vuelo?", NOW), { vu: "estado" });
  assert.equal(L.viajeIntent("mi vuelo es el AV123 el 15 de diciembre a las 6 de la mañana", NOW).fecha, "2026-12-15");   // «de la mañana» no es «mañana»
});

test("alertas de precio y pesos", () => {
  assert.equal(L.pesos("300 mil"), 300000); assert.equal(L.pesos("1,2 millones"), 1200000); assert.equal(L.pesos("$1.200.000"), 1200000);
  assert.deepEqual(L.precioIntent("avísame cuando los AirPods Pro 3 bajen de 900 mil"), { pr: "agregar", q: "AirPods Pro 3", max: 900000 });
  assert.deepEqual(L.precioIntent("mis alertas de precio"), { pr: "ver" });
  assert.deepEqual(L.precioDe("PRECIO: 849.900\nTIENDA: Falabella"), { precio: 849900, tienda: "Falabella" });
  assert.deepEqual(L.precioDe("PRECIO: 0"), { precio: 0, tienda: "" });
});

test("hojas de cálculo por voz", () => {
  assert.deepEqual(L.filaDe("3 arepas, 15 mil"), { cantidad: 3, desc: "arepas", valor: 15000 });
  assert.deepEqual(L.filaDe("arriendo 800000"), { cantidad: 1, desc: "arriendo", valor: 800000 });
  assert.deepEqual(L.filaDe("dos jugos a $8.000"), { cantidad: 2, desc: "jugos", valor: 8000 });
  assert.deepEqual(L.hojaIntent("anota en mi hoja de ventas: 3 arepas, 15 mil"), { hj: "anotar", hoja: "ventas", fila: { cantidad: 3, desc: "arepas", valor: 15000 } });
  assert.deepEqual(L.hojaIntent("¿cuánto llevo en la hoja de ventas hoy?"), { hj: "total", hoja: "ventas", hoy: true });
  assert.deepEqual(L.hojaIntent("exporta la hoja de ventas a Excel"), { hj: "excel", hoja: "ventas" });
  assert.deepEqual(L.hojaIntent("pasa mi hoja de ventas a Google Sheets"), { hj: "google", hoja: "ventas" });
  const h = { filas: [["2026-11-24", 3, "arepas", 15000], ["2026-11-01", 1, "jugo", 5000], ["2026-10-30", 1, "x", 100]] };
  assert.deepEqual(L.totales(h, NOW), { total: 20100, hoy: 15000, mes: 20000, filas: 3 });
  assert.equal(L.csv({ filas: [["2026-11-24", 1, 'pan "rico", tajado', 3000]] }), 'Fecha,Cantidad,Descripción,Valor\n2026-11-24,1,"pan ""rico"", tajado",3000');
  const mp = L.multipart({ name: "x" }, "text/csv", "a,b", "B");
  assert.ok(mp.cuerpo.startsWith("--B\r\nContent-Type: application/json") && mp.cuerpo.endsWith("--B--"));
});

test("Google Docs, Notion, contactos y sueño", () => {
  assert.deepEqual(L.documentoIntent("guarda el documento acta de padres en Google Docs"), { dc: "docs", q: "acta de padres", ultimo: false });
  assert.deepEqual(L.documentoIntent("guarda esto en Notion"), { dc: "notion", q: "", ultimo: true });
  assert.equal(L.notionId("https://www.notion.so/Mis-notas-1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d?pvs=4"), "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");
  assert.equal(L.notionBloques("a".repeat(4000)).length, 3);
  assert.equal(L.notionPagina("p", "T", "hola").parent.page_id, "p");
  assert.equal(L.mdHtml("# Título\n- **uno**\n- dos\nfin"), "<html><body><h1>Título</h1><ul><li><b>uno</b></li><li>dos</li></ul><p>fin</p></body></html>");
  assert.deepEqual(L.contactoIntent("recuérdame hablar con mi tía Rosa cada mes"), { ct: "agregar", nombre: "mi tía Rosa", dias: 30 });
  assert.deepEqual(L.contactoIntent("recuérdame llamar a mi papá cada 2 semanas"), { ct: "agregar", nombre: "mi papá", dias: 14 });
  assert.deepEqual(L.contactoIntent("ya hablé con mi tía Rosa"), { ct: "hecho", nombre: "mi tia rosa" });
  assert.ok(L.contactoPendiente({ dias: 30, ultimo: NOW - 31 * 864e5 }, NOW) && !L.contactoPendiente({ dias: 30, ultimo: NOW - 5 * 864e5 }, NOW));
  assert.deepEqual(L.suenoIntent("activa la rutina de sueño a las 10 de la noche"), { su: "on", hora: "22:00" });
  assert.deepEqual(L.suenoIntent("quiero acostarme a las 10:30"), { su: "on", hora: "22:30" });
  assert.deepEqual(L.suenoIntent("quita la rutina de sueño"), { su: "off" });
});
