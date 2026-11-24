// Pruebas de la lógica 3.35 (diez habilidades más)
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../www/js/logica23.js");
const NOW = new Date(2026, 10, 24, 13, 0).getTime();

test("dividir la cuenta", () => {
  assert.deepEqual(L.cuentaIntent("divide 180 mil entre 4 con el 10% de propina"), { cu: "dividir", total: 180000, n: 4, propina: 10 });
  assert.deepEqual(L.cuentaIntent("divide $95.000 entre tres sin propina"), { cu: "dividir", total: 95000, n: 3, propina: 0 });
  assert.deepEqual(L.cuentaIntent("reparte 120000 entre 5"), { cu: "dividir", total: 120000, n: 5, propina: null });
  assert.deepEqual(L.cuentaIntent("divide esta cuenta"), { cu: "foto" });
  assert.deepEqual(L.cuentaIntent("¿cuánto es la propina del 15% de 80 mil?"), { cu: "propina", total: 80000, propina: 15 });
  assert.equal(L.cuentaIntent("divide la pantalla"), null);
  const d = L.dividir(180000, 4, 10);
  assert.equal(d.total, 198000); assert.equal(d.cada, 49500);
  assert.match(L.divisionTexto(d), /\$198\.000[\s\S]*\$49\.500 cada uno/);
  const d3 = L.dividir(100000, 3, 0); assert.equal(d3.cada, 33400); assert.match(L.divisionTexto(d3), /redondeado/);
  const items = [{ nombre: "Bandeja", precio: 30000 }, { nombre: "Ajiaco", precio: 20000 }, { nombre: "Limonada", precio: 10000 }];
  assert.deepEqual(L.porPersona(items, { Ana: [0], Luis: [1, 2] }, 10), { Ana: 33000, Luis: 33000 });
  assert.deepEqual(L.porPersonaCompartido(items, { Ana: [0, 2], Luis: [1, 2] }, 0), { Ana: 35000, Luis: 25000 });
});

test("tiempo de pantalla", () => {
  assert.deepEqual(L.pantallaIntent("¿cuánto usé el celular hoy?"), { pa: "ver", semana: false });
  assert.deepEqual(L.pantallaIntent("tiempo de pantalla esta semana"), { pa: "ver", semana: true });
  assert.deepEqual(L.pantallaIntent("avísame si paso más de una hora en TikTok"), { pa: "limite", app: "tiktok", min: 60 });
  assert.deepEqual(L.pantallaIntent("avísame si paso más de 30 minutos en Instagram al día"), { pa: "limite", app: "instagram", min: 30 });
  assert.deepEqual(L.pantallaIntent("quita el límite de tiktok"), { pa: "quitar", app: "tiktok" });
  assert.match(L.pantallaTexto([{ nombre: "TikTok", min: 200 }, { nombre: "WhatsApp", min: 130 }]), /5 h 30 min[\s\S]*1\. TikTok: 3 h 20 min[\s\S]*ponle un límite/);
  assert.equal(L.appDe("tiktok", [{ nombre: "TikTok", pkg: "com.zhiliaoapp.musically" }]).pkg, "com.zhiliaoapp.musically");
});

test("grupos y traducción", () => {
  assert.equal(L.grupoIntent("¿qué dijeron en el grupo de la familia?").gr, "familia");
  assert.equal(L.grupoIntent("resume el grupo del colegio hoy").gr, "colegio");
  const ms = [{ de: "Familia: Mamá", texto: "Almuerzo el domingo" }, { de: "Juan", texto: "hola" }, { de: "Familia (3 mensajes): Tío", texto: "Llevo postre" }];
  assert.deepEqual(L.delGrupo(ms, "familia").map((m) => m.de), ["Mamá", "Tío"]);
  assert.match(L.PROMPT_GRUPO("Familia", L.delGrupo(ms, "familia")), /Mamá: Almuerzo/);
  assert.deepEqual(L.traducirIntent("tradúceme el mensaje de John"), { tr: "leer", de: "john" });
  assert.deepEqual(L.traducirIntent("respóndele a John en inglés que llego a las 5"), { tr: "responder", de: "John", idioma: "inglés", texto: "llego a las 5" });
  assert.equal(L.traducirIntent("traduce la pantalla"), null);
});

test("wifi en QR", () => {
  assert.deepEqual(L.wifiIntent("mi wifi se llama CasaPerez y la clave es abc;123"), { wf: "guardar", red: "CasaPerez", clave: "abc;123" });
  assert.deepEqual(L.wifiIntent("comparte el wifi"), { wf: "qr" });
  assert.deepEqual(L.wifiIntent("olvida la clave del wifi"), { wf: "borrar" });
  assert.equal(L.wifiQR("Casa Pérez", "abc;123"), "WIFI:T:WPA;S:Casa Pérez;P:abc\\;123;;");
  assert.equal(L.wifiQR("Libre", ""), "WIFI:T:nopass;S:Libre;;");
});

test("informe del mes", () => {
  assert.deepEqual(L.informeIntent("informe del mes"), { inf: "actual" });
  assert.deepEqual(L.informeIntent("¿cómo me fue con la plata el mes pasado?"), { inf: "pasado" });
  const a = { total: 1200000, cats: [["Comida", 600000], ["Transporte", 300000], ["Ocio", 100000]] }, b = { total: 1000000, cats: [["Comida", 400000], ["Transporte", 300000]] };
  const t = L.informeTexto("noviembre", a, b, [{ nombre: "Arriendo", dia: 1 }]);
  assert.match(t, /\$1\.200\.000\*\* \(▲ 20 % más[\s\S]*Comida: \$600\.000 \(▲ 50 %\)[\s\S]*Transporte: \$300\.000 \(= 0 %\)[\s\S]*Ocio: \$100\.000 \(nuevo\)[\s\S]*Donde más subió: \*\*Comida[\s\S]*Arriendo el 1/);
});

test("mantenimiento del vehículo", () => {
  assert.deepEqual(L.vehiculoIntent("le cambié el aceite al carro hoy a los 45.000 km"), { ve: "servicio", servicio: "aceite", km: 45000, tipo: "carro" });
  assert.deepEqual(L.vehiculoIntent("rote las llantas a la moto"), { ve: "servicio", servicio: "llantas", km: null, tipo: "moto" });
  assert.deepEqual(L.vehiculoIntent("el carro va en 49800 km"), { ve: "km", km: 49800, tipo: "carro" });
  assert.deepEqual(L.vehiculoIntent("¿qué le toca al carro?"), { ve: "ver", tipo: "carro" });
  assert.equal(L.vehiculoIntent("mi moto es una NKD 125").modelo, "NKD 125");
  assert.equal(L.kmDe("45 mil km"), 45000);
  const hace = new Date(2026, 5, 1).getTime();
  const v = { tipo: "carro", km: 49800, servicios: { aceite: { km: 45000, t: hace }, frenos: { km: 45000, t: hace } } };
  const p = L.proximos(v, NOW);
  assert.equal(p[0].k, "aceite"); assert.equal(p[0].pronto, true); assert.equal(p[0].faltaKm, 200);
  assert.match(L.vehiculoTexto(v, NOW), /Tu carro · 49\.800 km[\s\S]*⚠️ Pronto \*\*Cambio de aceite\*\*: a los 50\.000 km \(faltan 200 km\)/);
});

test("¿dónde dejé…?", () => {
  assert.deepEqual(L.cosasIntent("dejé las llaves en el cajón de la cocina"), { cs: "guardar", cosa: "llaves", lugar: "en el cajón de la cocina" });
  assert.deepEqual(L.cosasIntent("guardé el pasaporte debajo del colchón"), { cs: "guardar", cosa: "pasaporte", lugar: "debajo del colchón" });
  assert.equal(L.cosasIntent("dejé el carro en el centro comercial"), null);
  assert.deepEqual(L.cosasIntent("¿dónde dejé las llaves?"), { cs: "buscar", cosa: "llaves" });
  assert.equal(L.cosasIntent("dejé las llaves del carro en el cajón").cosa, "llaves del carro");
  assert.equal(L.cosasIntent("¿dónde dejé el carro?"), null);
  const l = [{ cosa: "llaves del carro", lugar: "en el cajón", t: 1 }, { cosa: "pasaporte", lugar: "en la maleta", t: 2 }];
  assert.equal(L.buscarCosa(l, "llave").lugar, "en el cajón");
  assert.equal(L.buscarCosa(l, "pasaportes").lugar, "en la maleta");
  assert.equal(L.buscarCosa(l, "gafas"), null);
});

test("tarjetas de repaso", () => {
  assert.deepEqual(L.tarjetasIntent("hazme tarjetas de repaso de la Revolución Francesa"), { ta: "crear", tema: "la Revolución Francesa", n: 10 });
  assert.equal(L.tarjetasIntent("hazme 20 tarjetas sobre verbos irregulares").n, 20);
  assert.deepEqual(L.tarjetasIntent("repasemos"), { ta: "repasar" });
  let c = { p: "a", r: "b" };
  c = L.calificar(c, 1, NOW); assert.equal(c.caja, 1); assert.equal(new Date(c.prox).getDate(), 27);
  c = L.calificar(c, 2, NOW); assert.equal(c.caja, 3);
  c = L.calificar(c, 0, NOW); assert.equal(c.caja, 0); assert.equal(new Date(c.prox).getDate(), 25);
  const mz = [{ id: "m1", tarjetas: [{ p: 1 }, { p: 2, prox: NOW + 864e5 }, { p: 3, prox: NOW - 1 }] }];
  assert.deepEqual(L.pendientes(mz, NOW).map((x) => x.i), [0, 2]);
});

test("modos expertos", () => {
  assert.deepEqual(L.modoIntent("modo abogado"), { mo: "activar", k: "abogado" });
  assert.deepEqual(L.modoIntent("habla como un profe de inglés"), { mo: "activar", k: "ingles" });
  assert.deepEqual(L.modoIntent("modo normal"), { mo: "salir" });
  assert.deepEqual(L.modoIntent("sal del modo abogado"), { mo: "salir" });
  assert.deepEqual(L.modoIntent("crea un modo llamado Vendedor que me ayude a escribir ofertas cortas"), { mo: "crear", nombre: "Vendedor", instr: "me ayude a escribir ofertas cortas" });
  assert.deepEqual(L.modoIntent("modo pirata"), { mo: "propio", nombre: "pirata" });
  assert.deepEqual(L.modoIntent("mis modos"), { mo: "ver" });
  assert.match(L.MODOS.abogado[1], /consultorio jurídico/);
  assert.match(L.MODOS.psicologo[1], /106/);
});
