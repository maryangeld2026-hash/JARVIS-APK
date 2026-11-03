// Pruebas de la lógica 3.4: asistencia, horario, respuestas y la lectura de hojas de burbujas
const test = require("node:test");
const assert = require("node:assert/strict");
const L4 = require("../www/js/logica4.js");
const L3 = require("../www/js/logica3.js");

test("asistencia por voz", () => {
  assert.deepEqual(L4.asisIntent("pasa lista de 7A"), { kind: "lista_abrir", curso: "7a" });
  assert.equal(L4.asisIntent("pasar lista").kind, "lista_abrir");
  assert.deepEqual(L4.asisIntent("Faltaron Pablo Mora y Ana Rojas en 7A"), { kind: "faltas_add", nombres: ["Pablo Mora", "Ana Rojas"], curso: "7A", tipo: "falta" });
  assert.deepEqual(L4.asisIntent("no vino Tomás").nombres, ["Tomás"]);
  assert.equal(L4.asisIntent("llegó tarde Ana").tipo, "tarde");
  assert.equal(L4.asisIntent("Ana llegó tarde").tipo, "tarde");
  assert.deepEqual(L4.asisIntent("¿cuántas fallas tiene Pablo Mora?"), { kind: "faltas_ver", quien: "pablo mora" });
  assert.deepEqual(L4.asisIntent("fallas de 7A"), { kind: "faltas_curso", curso: "7a" });
  assert.equal(L4.asisIntent("¿qué hora es?"), null);
  const c = L4.countAbsences([{ fecha: "2026-11-02", curso: "7A", faltas: ["Ana", "Beto"], tardes: [] }, { fecha: "2026-11-03", curso: "7A", faltas: ["Ana"], tardes: ["Beto"] }], "7A");
  assert.equal(c.Ana.faltas, 2); assert.equal(c.Beto.tardes, 1);
});

test("horario: No molestar y tarjeta Ahora", () => {
  const h = L3.parseSchedule("lunes 7:00-7:55 7A\nlunes 7:55-8:50 8B\nlunes 10:00-11:00 9C\nmartes 7:00-8:00 10A");
  const lunes = new Date(2026, 10, 2, 6, 0);
  const b = L4.silenceBlocks(h, lunes, 2);
  assert.equal(b.length, 3);                                            // 7A y 8B seguidas se unen; 9C; y el martes
  assert.equal(new Date(b[0].ini).getHours(), 7); assert.equal(new Date(b[0].fin).getHours(), 8); assert.equal(new Date(b[0].fin).getMinutes(), 50);
  const en = L4.ahoraState(h, new Date(2026, 10, 2, 7, 30));
  assert.equal(en.modo, "clase"); assert.equal(en.clase.que, "7A"); assert.equal(en.falta, 25); assert.equal(en.pct, 55);
  assert.equal(L4.ahoraState(h, new Date(2026, 10, 2, 9, 30)).modo, "antes");
  assert.equal(L4.ahoraState(h, new Date(2026, 10, 2, 19, 0)).modo, "noche");
  assert.equal(L4.ahoraState(h, new Date(2026, 10, 2, 19, 0)).manana[0].que, "10A");
  assert.equal(L4.ahoraState([], new Date()).modo, "sin_horario");
  assert.equal(L4.courseOf("10B Álgebra"), "10B");
});

test("graficar desde una respuesta y WhatsApp", () => {
  assert.equal(L4.fnFromAnswer("La recta es $y = 2x + 1$, con pendiente 2."), "2x + 1");
  assert.equal(L4.fnFromAnswer("Tomemos f(x) = x^2 - 4 y busquemos sus raíces"), "x^2 - 4");
  assert.equal(L4.fnFromAnswer("$f(x) = \\frac{1}{x}$"), "(1)/(x)");
  assert.ok(L3.compileFn(L4.fnFromAnswer("$y = \\sqrt{x}$")));
  assert.equal(L4.fnFromAnswer("La capital de Francia es París."), null);
  assert.match(L4.waLink("**Hola** papás\n\n$\\frac{1}{2}$"), /^https:\/\/wa\.me\/\?text=/);
  assert.match(decodeURIComponent(L4.waLink("**Hola**")), /\*Hola\*/);
});

// ---------------------------------------------------------------------------- hojas de burbujas
/** Dibuja una hoja «fotografiada»: perspectiva, luz desigual y ruido. marks: {pregunta: opción} */
function photo(lay, bits, marks, { w = 900, h = 1200, tilt = 0.06, light = 0.25, noise = 18, pencil = 70, seed = 1 } = {}) {
  // dónde quedan las esquinas de la hoja en la foto (un poco torcida)
  const pad = 40, t = tilt * w;
  const dst = [[pad + t, pad], [w - pad, pad + t * 0.6], [pad, h - pad - t * 0.4], [w - pad - t * 0.7, h - pad]];
  const sheetCorners = [[0, 0], [lay.W, 0], [0, lay.H], [lay.W, lay.H]];
  const inv = L4.homography(dst, sheetCorners);
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const g = new Uint8Array(w * h);
  const ink = (x, y) => {                                            // tinta en el punto (mm) de la hoja → 0 papel … 1 negro
    for (const [mx, my] of lay.marks) if (x >= mx && x <= mx + lay.mk && y >= my && y <= my + lay.mk) return 1;
    for (let b = 0; b < lay.code.length; b++) { const [cx, cy] = lay.code[b], cs = lay.codeSize;
      if (x >= cx && x <= cx + cs && y >= cy && y <= cy + cs) { if (bits[b]) return 1; if (x < cx + 0.35 || x > cx + cs - 0.35 || y < cy + 0.35 || y > cy + cs - 0.35) return 0.8; } }
    for (const q of lay.q) for (let k = 0; k < q.ops.length; k++) {
      const [bx, by] = q.ops[k], d = Math.hypot(x - bx, y - by);
      if (marks[q.n] === k && d <= lay.r * 0.95) return pencil / 100;
      if (Math.abs(d - lay.r) < 0.18) return 0.75;                     // el círculo impreso
      if (d < lay.r * 0.45 && ((Math.round((x - bx) * 3) + Math.round((y - by) * 3)) % 3 === 0)) return 0.45;   // la letra adentro
    }
    if (y > 24 && y < 52 && x > 32 && x < 183 && Math.round(x * 2) % 7 === 0) return 0.6;                    // texto del encabezado
    return 0;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [sx, sy] = inv(x, y);
    const paper = 235 - light * 120 * (x / w) - light * 60 * (y / h);   // luz desigual
    let v = sx < 0 || sy < 0 || sx > lay.W || sy > lay.H ? 70 : paper * (1 - ink(sx, sy)) + 15 * ink(sx, sy);
    v += (rnd() - 0.5) * noise;
    g[y * w + x] = Math.max(0, Math.min(255, v));
  }
  return { g, w, h };
}

test("hoja de burbujas: código, layout y nota", () => {
  const bits = L4.codeBits(23, 5);
  assert.equal(bits[0], 1); assert.equal(bits[11], 0);
  assert.deepEqual(L4.decodeBits(bits), { idx: 23, hash: 5 });
  const lay = L4.sheetLayout(30, 4);
  assert.equal(lay.q.length, 30); assert.equal(lay.cols, 2);
  assert.ok(lay.q.every((q) => q.y + lay.r < lay.H - 25));
  const g = L4.gradeSheet([0, 1, -1, 2, -2], [0, 1, 2, 2, 3]);
  assert.equal(g.aciertos, 3); assert.equal(g.nota, 3.4); assert.deepEqual(g.blancos, [3]); assert.deepEqual(g.dobles, [5]);
});

test("lee una hoja fotografiada (torcida, con sombra y ruido)", () => {
  const lay = L4.sheetLayout(12, 4);
  const key = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 0, 6: 1, 7: 2, 8: 3, 9: 1, 10: 2 };      // 11 en blanco, 12 doble (abajo)
  const bits = L4.codeBits(7, 3);
  for (const [opt, label] of [[{}, "recta"], [{ tilt: 0.1, light: 0.4, noise: 26, pencil: 55, seed: 9 }, "difícil"]]) {
    const ph = photo(lay, bits, key, opt);
    const r = L4.readSheet(ph.g, ph.w, ph.h, lay);
    assert.ok(r.ok, label + ": " + r.error);
    assert.equal(r.idx, 7, label + " estudiante"); assert.equal(r.hash, 3, label + " quiz");
    for (let n = 1; n <= 10; n++) assert.equal(r.resp[n - 1], key[n], `${label}: pregunta ${n}`);
    assert.equal(r.resp[10], -1, label + ": en blanco");
  }
  // la foto al revés (girada 180°)
  const ph3 = photo(lay, bits, key, { seed: 4 });
  const rev = new Uint8Array(ph3.g.length); for (let i = 0; i < rev.length; i++) rev[i] = ph3.g[rev.length - 1 - i];
  const r3 = L4.readSheet(rev, ph3.w, ph3.h, lay);
  assert.ok(r3.ok, r3.error); assert.equal(r3.idx, 7, "al revés: estudiante"); assert.equal(r3.resp[3], 3, "al revés: pregunta 4");
  // doble marca
  const lay2 = L4.sheetLayout(3, 4);
  const ph2 = photo(lay2, L4.codeBits(1, 0), { 1: 2, 3: 1 }, {});
  // marca extra a mano en la pregunta 1, opción A
  const H = L4.homography([[0, 0], [lay2.W, 0], [0, lay2.H], [lay2.W, lay2.H]], [[40 + 0.06 * 900, 40], [860, 40 + 0.06 * 900 * 0.6], [40, 1160 - 0.06 * 900 * 0.4], [860 - 0.06 * 900 * 0.7, 1160]]);
  const [bx, by] = lay2.q[0].ops[0];
  for (let a = 0; a < 360; a += 2) for (let rr = 0; rr <= lay2.r * 0.9; rr += 0.15) { const [x, y] = H(bx + rr * Math.cos(a * Math.PI / 180), by + rr * Math.sin(a * Math.PI / 180)); ph2.g[Math.round(y) * 900 + Math.round(x)] = 60; }
  const r2 = L4.readSheet(ph2.g, ph2.w, ph2.h, lay2);
  assert.ok(r2.ok, r2.error);
  assert.deepEqual(r2.resp, [-2, -1, 1]);
  // sin las marcas de las esquinas: avisa en vez de inventar
  const blank = new Uint8Array(400 * 500).fill(220);
  assert.equal(L4.readSheet(blank, 400, 500, lay).ok, false);
});

test("análisis de la evaluación", () => {
  const res = { a: { nombre: "Ana", nota: 2.5, resp: [0, 2, 2] }, b: { nombre: "Beto", nota: 5, resp: [0, 1, 2] }, c: { nombre: "Caro", nota: 3.7, resp: [0, 2, 1] } };
  const a = L4.sheetAnalysis(res, [0, 1, 2]);
  assert.equal(a.n, 3); assert.equal(a.prom, 3.7); assert.deepEqual(a.bajos, ["Ana"]);
  assert.equal(a.dificiles[0].n, 2); assert.equal(a.dificiles[0].pct, 33); assert.deepEqual(a.dificiles[0].errada, { op: "C", veces: 2 });
});
