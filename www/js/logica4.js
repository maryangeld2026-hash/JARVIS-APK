/* Jarvis para Android 3.4 · lógica pura (se prueba en el computador con node):
   asistencia, «No molestar» en clase, la tarjeta «Ahora», funciones dentro de una respuesta, WhatsApp
   y la lectura de hojas de respuesta con burbujas (sin internet y sin IA: todo en el celular). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  const strip = (t) => norm(t).replace(/^(?:jarvis|oye jarvis|hola jarvis)\s+/, "");

  // ======================================================================== ASISTENCIA
  /** «Pablo y Ana Rojas, Tomás» → ["Pablo", "Ana Rojas", "Tomás"] */
  function splitNames(s) {
    return String(s || "").split(/\s*(?:,|\by\b|\be\b)\s*/i).map((x) => x.trim().replace(/^(?:el|la|los|las)\s+/i, "")).filter((x) => x && x.length > 1);
  }
  function asisIntent(text) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[,\s]+/i, ""), t = strip(text);
    let m;
    if ((m = t.match(/^(?:pasa(?:r|me)?|llama(?:r)?|toma(?:r)?)\s+(?:la\s+)?(?:lista|asistencia)(?:\s+(?:de|en|del|a)\s+(?:curso\s+)?(.+))?$/))) return { kind: "lista_abrir", curso: (m[1] || "").trim() };
    if ((m = raw.match(/^(?:hoy\s+)?(?:faltaron|falt[oó]|no\s+vinieron|no\s+vino|no\s+lleg[oó]|no\s+llegaron|est[aá]n?\s+ausentes?)\s+(.+?)(?:\s+(?:en|de)\s+(?:el\s+curso\s+)?([0-9]{1,2}\s*[°º-]?\s*[A-Za-z0-9]{0,2}))?\s*\.?$/i))) return { kind: "faltas_add", nombres: splitNames(m[1]), curso: (m[2] || "").trim(), tipo: "falta" };
    if ((m = raw.match(/^(?:hoy\s+)?(?:lleg[oó]|llegaron)\s+tarde\s+(.+?)(?:\s+(?:en|de)\s+([0-9]{1,2}\s*[A-Za-z0-9]{0,2}))?\s*\.?$/i))) return { kind: "faltas_add", nombres: splitNames(m[1]), curso: (m[2] || "").trim(), tipo: "tarde" };
    if ((m = raw.match(/^(.+?)\s+lleg[oó]\s+tarde(?:\s+(?:en|de)\s+([0-9]{1,2}\s*[A-Za-z0-9]{0,2}))?\s*\.?$/i))) return { kind: "faltas_add", nombres: splitNames(m[1]), curso: (m[2] || "").trim(), tipo: "tarde" };
    if ((m = t.match(/^(?:cuantas\s+(?:fallas|faltas|ausencias)\s+(?:tiene|lleva|va)|(?:fallas|faltas|asistencia)\s+de)\s+(.+)$/))) {
      const q = m[1].trim();
      return /^[0-9]{1,2}\s*[a-z0-9]{0,2}$/.test(q) || /^(?:curso|grado)\b/.test(q) ? { kind: "faltas_curso", curso: q.replace(/^(?:curso|grado)\s+/, "") } : { kind: "faltas_ver", quien: q };
    }
    if (/^(?:quien(?:es)?\s+(?:falta(?:n|ron)?|ha(?:n)?\s+faltado)\s+mas|(?:los\s+)?que\s+mas\s+faltan)\b/.test(t)) return { kind: "faltas_top" };
    return null;
  }
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  /** Cuenta fallas y llegadas tarde por estudiante. registros: [{fecha, curso, faltas:[], tardes:[]}] */
  function countAbsences(registros, curso) {
    const out = {};
    (registros || []).filter((r) => !curso || r.curso === curso).forEach((r) => {
      (r.faltas || []).forEach((n) => { (out[n] = out[n] || { faltas: 0, tardes: 0, fechas: [] }).faltas++; out[n].fechas.push(r.fecha); });
      (r.tardes || []).forEach((n) => { (out[n] = out[n] || { faltas: 0, tardes: 0, fechas: [] }).tardes++; });
    });
    return out;
  }

  // ======================================================================== HORARIO: «No molestar» y la tarjeta «Ahora»
  /** Las clases de los próximos días como bloques [{ini, fin}] en ms (para «No molestar» en clase). */
  function silenceBlocks(sched, now = new Date(), days = 8) {
    const out = [];
    for (let k = 0; k < days; k++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k);
      (sched || []).filter((c) => c.dia === d.getDay()).forEach((c) => {
        const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.ini / 60), c.ini % 60).getTime();
        const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(c.fin / 60), c.fin % 60).getTime();
        if (fin > now.getTime()) out.push({ ini, fin });
      });
    }
    // une clases seguidas (sin hueco de más de 6 min) para no prender y apagar el silencio entre una y otra
    out.sort((a, b) => a.ini - b.ini);
    const merged = [];
    out.forEach((b) => { const l = merged[merged.length - 1]; if (l && b.ini - l.fin <= 6 * 60000) l.fin = Math.max(l.fin, b.fin); else merged.push(Object.assign({}, b)); });
    return merged;
  }
  /** Qué mostrar en la tarjeta «Ahora». sched = parseSchedule(horario). */
  function ahoraState(sched, now = new Date()) {
    const h = now.getHours(), m = h * 60 + now.getMinutes(), d = now.getDay();
    if (!sched || !sched.length) return { modo: "sin_horario" };
    const hoy = sched.filter((c) => c.dia === d).sort((a, b) => a.ini - b.ini);
    const cur = hoy.find((c) => c.ini <= m && m < c.fin);
    if (cur) return { modo: "clase", clase: cur, falta: cur.fin - m, pct: Math.round(((m - cur.ini) / (cur.fin - cur.ini)) * 100), siguiente: hoy.find((c) => c.ini >= cur.fin) || null };
    const next = hoy.find((c) => c.ini > m);
    if (next && (next.ini - m <= 120 || h < 12)) return { modo: "antes", clase: next, en: next.ini - m };
    const tomorrow = sched.filter((c) => c.dia === (d + 1) % 7).sort((a, b) => a.ini - b.ini);
    if (h >= 17 || !hoy.length) return { modo: "noche", manana: tomorrow, domingo: d === 0 };
    return { modo: "despues", hoy, manana: tomorrow };
  }
  const courseOf = (que) => (String(que || "").match(/\b(\d{1,2}\s*[°º-]?\s*[A-Za-z]?\d?)\b/) || [])[1] || String(que || "").split(/\s+/)[0];

  // ======================================================================== RESPUESTAS: graficar, WhatsApp
  /** Una función que se pueda graficar dentro de una respuesta («y = 2x + 1», «f(x) = x^2 − 4»). → texto para compileFn, o null */
  function fnFromAnswer(text) {
    const src = String(text || "");
    const re = /(?:^|[\s$(*:])(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))\s*=\s*([^\n$;]{1,60})/g;
    let m;
    while ((m = re.exec(src))) {
      let e = m[1].replace(/\\left|\\right/g, "").replace(/\\cdot|\\times|·|×/g, "*").replace(/−/g, "-")
        .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)").replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)")
        .replace(/\^\s*\{([^{}]+)\}/g, "^($1)").replace(/[{}]/g, "").replace(/\\,|\\;|\\!/g, "").replace(/\*\*/g, "^");
      e = e.split(/\s+(?:donde|para|con|si|cuando|y|e|es|que|en|la|el)\b|[.,](?:\s|$)|\s{2,}/)[0].trim().replace(/[.,]+$/, "");
      if (/x/.test(e) && !/[a-wzA-WZ]{3,}/.test(e.replace(/sqrt|sin|sen|cos|tan|log|ln|abs|pi/g, ""))) return e;
    }
    return null;
  }
  function waLink(text) {
    const plain = String(text || "").replace(/\$\$?([^$]+)\$\$?/g, "$1").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2").replace(/\\[a-z]+/g, "")
      .replace(/^#+\s*/gm, "").replace(/\*\*([^*]+)\*\*/g, "*$1*").replace(/\n{3,}/g, "\n\n").trim();
    return "https://wa.me/?text=" + encodeURIComponent(plain.slice(0, 3500));
  }

  // ======================================================================== HOJAS DE RESPUESTA CON BURBUJAS
  /** Medidas de la hoja (carta, en mm). Lo usan el PDF y el lector, así siempre coinciden. */
  const LETRAS = "ABCDE";
  function sheetLayout(nPreg, nOps) {
    const W = 215.9, H = 279.4, mk = 10;                                   // marcas negras de 10 mm en las 4 esquinas
    const marks = [[12, 12], [W - 12 - mk, 12], [12, H - 12 - mk], [W - 12 - mk, H - 12 - mk]];
    const centers = marks.map(([x, y]) => [x + mk / 2, y + mk / 2]);
    const code = []; for (let b = 0; b < 12; b++) code.push([40 + b * 9, 62]);   // 12 casillas de código (la 1.ª siempre llena, la última siempre vacía)
    const perCol = nPreg > 25 ? Math.ceil(nPreg / 2) : nPreg, cols = Math.ceil(nPreg / perCol);
    const rowH = Math.min(8.4, 170 / perCol), y0 = 84, colW = 95;
    const q = [];
    for (let i = 0; i < nPreg; i++) {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x0 = 26 + c * colW, y = y0 + r * rowH;
      q.push({ n: i + 1, y, numX: x0, ops: Array.from({ length: nOps }, (_, k) => [x0 + 14 + k * 11, y]) });
    }
    return { W, H, mk, marks, centers, code, codeSize: 5, r: Math.min(3, rowH * 0.36), q, cols };
  }
  /** Código impreso de cada hoja: estudiante (7 bits) + control del quiz (3 bits). */
  function codeBits(idx, quizHash) {
    const v = ((idx & 127) << 3) | (quizHash & 7);
    const bits = [1];
    for (let b = 9; b >= 0; b--) bits.push((v >> b) & 1);
    bits.push(0);
    return bits;
  }
  function decodeBits(bits) {
    if (bits.length !== 12) return null;
    let v = 0; for (let b = 1; b <= 10; b++) v = (v << 1) | (bits[b] ? 1 : 0);
    return { idx: v >> 3, hash: v & 7 };
  }
  const quizHash = (id) => { let h = 0; for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 8; };

  /** Homografía de 4 puntos (src → dst). */
  function homography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const n = 8;
    for (let c = 0; c < n; c++) {                                          // eliminación de Gauss con pivoteo
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      if (Math.abs(A[c][c]) < 1e-12) return null;
      for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  }
  /** Umbral de Otsu de una imagen en grises (0–255). */
  function otsu(g) {
    const hist = new Array(256).fill(0); for (let i = 0; i < g.length; i++) hist[g[i] | 0]++;
    let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sB = 0, wB = 0, best = 0, th = 128;
    for (let t = 0; t < 256; t++) { wB += hist[t]; if (!wB) continue; const wF = g.length - wB; if (!wF) break; sB += t * hist[t];
      const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF); if (v > best) { best = v; th = t; } }
    return th;
  }
  /** Encuentra las 4 marcas negras de las esquinas. g: grises (w×h). → [[x,y]×4] (arriba-izq, arriba-der, abajo-izq, abajo-der) o null */
  function findMarks(g, w, h) {
    const th = Math.min(otsu(g), 110), lab = new Int32Array(w * h).fill(0), comps = [];
    const minA = (w * h) * 0.0004, maxA = (w * h) * 0.02;
    let id = 0; const stack = [];
    for (let s = 0; s < w * h; s++) {
      if (lab[s] || g[s] > th) continue;
      id++; let n = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
      stack.push(s); lab[s] = id;
      while (stack.length) {
        const p = stack.pop(), x = p % w, y = (p - x) / w;
        n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (n > maxA * 3) continue;
        const nb = [p - 1, p + 1, p - w, p + w];
        for (const q of nb) { if (q < 0 || q >= w * h || lab[q] || g[q] > th) continue; if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue; lab[q] = id; stack.push(q); }
      }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, fill = n / (bw * bh), ratio = bw / bh;
      if (n >= minA && n <= maxA && fill > 0.72 && ratio > 0.6 && ratio < 1.65) comps.push({ x: sx / n, y: sy / n, n, fill, bw, bh });
    }
    if (typeof globalThis !== "undefined" && globalThis.__omrDebug) globalThis.__omrDebug(comps);
    if (comps.length < 4) return null;
    const corners = [[0, 0], [w, 0], [0, h], [w, h]];
    const pick = corners.map(([cx, cy]) => comps.reduce((a, c) => (Math.hypot(c.x - cx, c.y - cy) < Math.hypot(a.x - cx, a.y - cy) ? c : a)));
    if (new Set(pick).size < 4) return null;
    // las marcas deben estar cerca de las esquinas (no en medio de la hoja)
    if (pick.some((c, i) => Math.hypot(c.x - corners[i][0], c.y - corners[i][1]) > Math.hypot(w, h) * 0.38)) return null;
    // y del mismo tamaño más o menos
    const ns = pick.map((c) => c.n), mn = Math.min(...ns), mx = Math.max(...ns);
    if (mx > mn * 3.5) return null;
    return pick.map((c) => [c.x, c.y]);
  }
  /** Lee una hoja. g: grises (Uint8 o array), w, h; lay = sheetLayout(...). → {ok, resp: [índice|-1 en blanco|-2 doble], bits, idx, hash, calidad} */
  function readSheet(g, w, h, lay) {
    const found = findMarks(g, w, h);
    if (!found) return { ok: false, error: "No encontré los 4 cuadros negros de las esquinas. Toma la foto de frente, con la hoja completa y buena luz." };
    // la foto puede estar girada o al revés: se prueba cada orientación y sirve la que tiene el código bien (1.ª casilla llena, última vacía)
    let best = null;
    for (const o of [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]]) {
      const r = readOriented(g, w, h, lay, o.map((i) => found[i]));
      if (r && r.valido) return r;
      if (r && (!best || r.calidad > best.calidad)) best = r;
    }
    return best && best.calidad > 0.3 ? best : { ok: false, error: "No pude leer el código de la hoja. ¿Es una hoja de Jarvis? Toma la foto otra vez, de frente." };
  }
  function readOriented(g, w, h, lay, marks) {
    const H = homography(lay.centers, marks);
    if (!H) return null;
    const pxPerMm = Math.hypot(marks[1][0] - marks[0][0], marks[1][1] - marks[0][1]) / (lay.centers[1][0] - lay.centers[0][0]);
    const dark = (mx, my, rmm) => {                                        // promedio de oscuridad en un círculo
      const [cx, cy] = H(mx, my), r = Math.max(1.5, rmm * pxPerMm);
      let s = 0, n = 0;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || (x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
        s += 255 - g[y * w + x]; n++;
      }
      return n ? s / n / 255 : 0;
    };
    const cs = lay.codeSize, cv = lay.code.map(([x, y]) => dark(x + cs / 2, y + cs / 2, cs * 0.32));
    const full = cv[0], empty = cv[cv.length - 1], span = Math.max(0.15, full - empty);
    const bits = cv.map((v) => ((v - empty) / span > 0.5 ? 1 : 0));
    const code = decodeBits(bits);
    const paper = dark((lay.centers[0][0] + lay.centers[1][0]) / 2, 40, 3);           // papel en blanco, para comparar
    const resp = lay.q.map((q) => {
      const v = q.ops.map(([x, y]) => dark(x, y, lay.r * 0.62));
      const base = Math.min(...v), rel = v.map((x) => (x - Math.min(base, paper + 0.05)) / span);
      const order = rel.map((x, i) => [x, i]).sort((a, b) => b[0] - a[0]);
      const [m1, i1] = order[0], m2 = order[1] ? order[1][0] : 0;
      if (m1 < 0.38) return -1;                                             // en blanco
      if (m2 > 0.38 && m2 > m1 * 0.72) return -2;                           // doble marca
      return i1;
    });
    return { ok: true, valido: bits[0] === 1 && bits[11] === 0 && full - empty > 0.25, resp, bits, idx: code ? code.idx : -1, hash: code ? code.hash : -1, calidad: Math.round(span * 100) / 100 };
  }
  /** Nota de 1 a 5 (escala colombiana) y detalle. */
  function gradeSheet(resp, clave) {
    let ok = 0; const det = clave.map((c, i) => { const r = resp[i]; const bien = r === c; if (bien) ok++; return { n: i + 1, r, c, bien }; });
    const nota = Math.round((1 + 4 * (ok / Math.max(1, clave.length))) * 10) / 10;
    return { aciertos: ok, total: clave.length, nota, det, dobles: det.filter((d) => d.r === -2).map((d) => d.n), blancos: det.filter((d) => d.r === -1).map((d) => d.n) };
  }
  /** Análisis de la evaluación: promedio, quiénes bajo 3,0, preguntas más difíciles y la opción errada más marcada. */
  function sheetAnalysis(results, clave, basico = 3.0) {
    const rs = Object.values(results || {});
    if (!rs.length) return null;
    const prom = Math.round((rs.reduce((a, r) => a + r.nota, 0) / rs.length) * 10) / 10;
    const bajos = rs.filter((r) => r.nota < basico).map((r) => r.nombre).sort();
    const preg = clave.map((c, i) => {
      const marcas = {}; let ok = 0;
      rs.forEach((r) => { const x = r.resp[i]; if (x === c) ok++; else if (x >= 0) marcas[x] = (marcas[x] || 0) + 1; });
      const errada = Object.entries(marcas).sort((a, b) => b[1] - a[1])[0];
      return { n: i + 1, pct: Math.round((ok / rs.length) * 100), errada: errada ? { op: LETRAS[+errada[0]], veces: errada[1] } : null };
    });
    return { n: rs.length, prom, bajos, dificiles: preg.slice().sort((a, b) => a.pct - b.pct).slice(0, 3), preg };
  }
  /** Nota en el formato del celular: 3,8 */
  const fmt = (x) => String(x).replace(".", ",");

  const API = { norm, splitNames, asisIntent, dayKey, countAbsences, silenceBlocks, ahoraState, courseOf, fnFromAnswer, waLink,
    LETRAS, sheetLayout, codeBits, decodeBits, quizHash, homography, otsu, findMarks, readSheet, gradeSheet, sheetAnalysis, fmt };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JL4 = API;
})(typeof window !== "undefined" ? window : this);
