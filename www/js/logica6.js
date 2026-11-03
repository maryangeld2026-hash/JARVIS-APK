/* Jarvis para Android 3.7 · lógica pura (se prueba con node):
   el solucionario verificado (con el motor de álgebra nerdamer, sin internet), las figuras exactas en SVG,
   los mensajes a acudientes, el modo reunión y las órdenes de esta versión. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!]+/g, " ").replace(/\s+/g, " ").trim();
  const lead = /^(?:jarvis|oye jarvis|hola jarvis)[,\s]+/i;

  // ======================================================================== SOLUCIONARIO (motor de álgebra)
  /** Lo que se dice o escribe → lo que entiende el motor. */
  function toNerd(e) {
    return String(e || "").trim()
      .replace(/\$+/g, "").replace(/\\left|\\right/g, "").replace(/\\cdot|\\times|·|×/g, "*").replace(/÷|:(?=\s*\d)/g, "/").replace(/−|–/g, "-")
      .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, "($1)/($2)").replace(/\\sqrt\s*\{([^{}]+)\}/g, "sqrt($1)").replace(/\^\s*\{([^{}]+)\}/g, "^($1)")
      .replace(/²/g, "^2").replace(/³/g, "^3").replace(/√\s*\(/g, "sqrt(").replace(/√\s*(\w+)/g, "sqrt($1)")
      .replace(/\bra[ií]z\s+(?:cuadrada\s+)?de\s+([\w.]+)/gi, "sqrt($1)").replace(/\bsen\s*\(/gi, "sin(")
      .replace(/\s+(?:al\s+cuadrado)/gi, "^2").replace(/\s+(?:al\s+cubo)/gi, "^3").replace(/\s+por\s+/gi, "*").replace(/\s+entre\s+|\s+sobre\s+|\s+dividido\s+(?:en|por|entre)\s+/gi, "/")
      .replace(/\s+m[aá]s\s+/gi, "+").replace(/\s+menos\s+/gi, "-").replace(/\s+(?:es\s+)?igual\s+a\s+/gi, "=")
      .replace(/(\d),(\d)/g, "$1.$2").replace(/[{}]/g, "").replace(/\s+/g, "").replace(/\.$/, "");
  }
  function casIntent(text) {
    const raw = String(text || "").trim().replace(lead, "").replace(/^[¿¡]+/, "").replace(/\?+$/, "");
    let m;
    if ((m = raw.match(/^(?:verifica|comprueba|revisa)\s+(?:que\s+|si\s+)?([a-z])\s*=\s*([^\s,;]+)\s+(?:es|sea)\s+(?:la\s+)?soluci[oó]n\s+de\s+(.+)$/i))) return { kind: "cas_verificar", v: m[1], valor: m[2], eq: m[3] };
    if ((m = raw.match(/^(?:resuelve|soluciona|resolver)\s+(?:el\s+)?sistema\s*:?\s*(.+)$/i))) {
      const eqs = [];
      m[1].split(/\s*[;,]\s*/).forEach((p) => {
        // «x + y = 10 y x - y = 2»: se corta en el «y» que viene después del primer «=»
        let rest = p;
        while ((rest.match(/=/g) || []).length > 1) {
          const i = rest.indexOf("="), cut = rest.slice(i).search(/\s+y\s+/);
          if (cut < 0) break;
          eqs.push(rest.slice(0, i + cut)); rest = rest.slice(i + cut).replace(/^\s+y\s+/, "");
        }
        eqs.push(rest);
      });
      return { kind: "cas_sistema", eqs: eqs.map((x) => x.trim()).filter((x) => /=/.test(x)) };
    }
    if ((m = raw.match(/^(?:resuelve|soluciona|despeja|resolver|halla\s+x\s+en|encuentra\s+x\s+en)\s+(?:la\s+ecuaci[oó]n\s+)?(.+?=.+?)(?:\s+(?:para|en)\s+([a-z]))?(?:\s+paso\s+a\s+paso)?$/i))) return { kind: "cas_resolver", eq: m[1], v: m[2] || "", pasos: /paso\s+a\s+paso/i.test(raw) };
    if ((m = raw.match(/^(?:deriva|derivada\s+de|derivar|calcula\s+la\s+derivada\s+de)\s+(.+?)(?:\s+(?:respecto\s+a|con\s+respecto\s+a)\s+([a-z]))?$/i))) return { kind: "cas_derivar", expr: m[1], v: m[2] || "x" };
    if ((m = raw.match(/^(?:integra|integral\s+de|integrar|calcula\s+la\s+integral\s+de)\s+(.+?)(?:\s+(?:respecto\s+a|dx))?$/i))) return { kind: "cas_integrar", expr: m[1].replace(/\s*dx$/i, ""), v: "x" };
    if ((m = raw.match(/^(?:factoriza|factorizar|factoriza\s+la\s+expresi[oó]n)\s+(.+)$/i))) return { kind: "cas_factorizar", expr: m[1] };
    if ((m = raw.match(/^(?:expande|desarrolla|expandir)\s+(.+)$/i))) return { kind: "cas_expandir", expr: m[1] };
    if ((m = raw.match(/^(?:simplifica|simplificar|reduce)\s+(.+)$/i))) return { kind: "cas_simplificar", expr: m[1] };
    if ((m = raw.match(/^(?:calcula|cu[aá]nto\s+es|cu[aá]nto\s+da|opera|haz\s+la\s+operaci[oó]n)\s+(.+)$/i)) && /^[\d\s.,+\-*/x×÷^()²³√ ]+$|ra[ií]z|al cuadrado|por|entre|m[aá]s|menos/i.test(m[1]) && /\d/.test(m[1]) && !/[a-wyz]{3,}/i.test(m[1].replace(/ra[ií]z|cuadrad[oa]|cubo|por|entre|m[aá]s|menos|sobre|de|al/gi, ""))) return { kind: "cas_calcular", expr: m[1] };
    return null;
  }
  const fmtNum = (s) => String(s).replace(/(\d)\.(\d)/g, "$1,$2");
  /** Pasa la salida del motor a LaTeX sencillo para mostrarla bonita. */
  function toTex(s) {
    return String(s).replace(/\*/g, " \\cdot ").replace(/sqrt\(([^()]+)\)/g, "\\sqrt{$1}").replace(/\(([^()]+)\)\/\(([^()]+)\)/g, "\\frac{$1}{$2}")
      .replace(/(\d+)\/(\d+)/g, "\\frac{$1}{$2}").replace(/\^(\d+)/g, "^{$1}").replace(/\^\(([^()]+)\)/g, "^{$1}").replace(/\s+/g, " ").trim();
  }
  /** Resolver con el motor. n: nerdamer. → {ok, sol:[texto], tex, error} */
  function solveEq(n, eq, v) {
    const e = toNerd(eq);
    if ((e.match(/=/g) || []).length !== 1) return { ok: false, error: "Escribe una ecuación con un solo «=»." };
    const vars = (e.match(/[a-z]/gi) || []).filter((c) => !/[e]/.test(c) || !/exp|e\(/.test(e));
    const x = v || (vars.includes("x") ? "x" : vars.find((c) => /[a-z]/i.test(c)) || "x");
    try {
      const r = n.solve(e, x);
      const arr = String(r.toString()).replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!arr.length) return { ok: true, x, sol: [], tex: [], nada: true };
      return { ok: true, x, sol: arr.map((s) => { try { return n(s).text("fractions"); } catch (er) { return s; } }), dec: arr.map((s) => { try { return +n(s).evaluate().text("decimals"); } catch (er) { return NaN; } }) };
    } catch (er) { return { ok: false, error: "No pude resolver esa ecuación: revisa cómo está escrita." }; }
  }
  /** ¿x = valor cumple la ecuación? */
  function checkEq(n, eq, v, valor) {
    try {
      const [L, R] = toNerd(eq).split("=");
      const sub = {}; sub[v || "x"] = toNerd(valor);
      const a = +n(L).evaluate(sub).text("decimals"), b = +n(R).evaluate(sub).text("decimals");
      return { ok: Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)), izq: a, der: b };
    } catch (er) { return { ok: null }; }
  }
  /** Pasos de una ecuación lineal ax + b = cx + d (si no es lineal → null). */
  function linearSteps(n, eq, v = "x") {
    try {
      const [L, R] = toNerd(eq).split("=");
      const d = n(`expand((${L})-(${R}))`).toString();
      const a = +n(`diff(${d},${v})`).evaluate().text("decimals");
      if (!isFinite(a) || a === 0) return null;
      if (+n(`diff(${d},${v},2)`).evaluate().text("decimals") !== 0) return null;
      const sub = {}; sub[v] = 0;
      const b = +n(d).evaluate(sub).text("decimals");
      const fr = (x) => n(String(x)).text("fractions");
      const solTxt = n(`(${-b})/(${a})`).text("fractions");
      const pasos = [
        { t: "La ecuación", m: `${L} = ${R}` },
        { t: "Pasa todo a un lado y agrupa", m: `${fr(a)}${v} ${b < 0 ? "-" : "+"} ${fr(Math.abs(b))} = 0` },
        { t: `Deja los términos con ${v} solos`, m: `${fr(a)}${v} = ${fr(-b)}` },
        { t: `Divide entre ${fr(a)}`, m: `${v} = ${solTxt}` },
      ];
      const ck = checkEq(n, eq, v, solTxt);
      pasos.push({ t: "Comprobación", m: `${v} = ${solTxt} ⇒ ${fmtNum(ck.izq)} = ${fmtNum(ck.der)} ✓` });
      return { pasos, sol: solTxt };
    } catch (er) { return null; }
  }
  /** El resultado final de una respuesta de la IA («x = 4», «la solución es x = -3/2»). */
  function answerValue(text, v = "x") {
    const re = new RegExp(`(?:^|[^a-z])${v}\\s*=\\s*(-?\\s*\\d+(?:[.,]\\d+)?(?:\\s*/\\s*\\d+)?|-?\\\\frac\\{\\d+\\}\\{\\d+\\})`, "gi");
    let m, last = null;
    while ((m = re.exec(String(text || "")))) last = m[1];
    return last ? toNerd(last.replace(/\s+/g, "")) : null;
  }
  /** Ecuación dentro de una petición («explícame paso a paso cómo resolver 2x + 3 = 11»). */
  function eqIn(text) {
    const tok = "(?:[\\d.,()+\\-*/^²³√ ]|(?<![a-záéíóúñ])[a-z](?![a-záéíóúñ]))";
    const m = String(text || "").match(new RegExp(`(${tok}+=${tok}+)`, "i"));
    if (!m) return null;
    const e = m[1].trim().replace(/[.,]+$/, "").replace(/\s+[yeo]$/, "").trim();
    return /x/i.test(e) ? e : null;
  }

  // ======================================================================== FIGURAS EXACTAS (SVG)
  const num = (s) => parseFloat(String(s).replace(",", "."));
  function figIntent(text) {
    const t = norm(String(text || "").replace(lead, "")).replace(/[.,;]$/, "");
    if (!/^(?:dibuja(?:me)?|haz(?:me)?|traza(?:me)?|muestrame|grafica(?:me)?|pinta(?:me)?)\b/.test(t)) return null;
    let m;
    const N = "(\\d+(?:[.,]\\d+)?)";
    if ((m = t.match(new RegExp(`triangulo\\s+rectangulo\\s+(?:con\\s+|de\\s+)?catetos?\\s+(?:de\\s+)?${N}\\s+(?:y|,)\\s+${N}`)))) return { tipo: "rect", a: num(m[1]), b: num(m[2]) };
    if ((m = t.match(new RegExp(`triangulo\\s+(?:con\\s+|de\\s+)?lados?\\s+(?:de\\s+)?${N}\\s*,?\\s+${N}\\s*,?\\s*(?:y\\s+)?${N}`)))) return { tipo: "tri", a: num(m[1]), b: num(m[2]), c: num(m[3]) };
    if ((m = t.match(new RegExp(`(?:triangulo\\s+)?equilatero\\s+(?:de\\s+lado\\s+)?${N}`)))) return { tipo: "tri", a: num(m[1]), b: num(m[1]), c: num(m[1]) };
    if ((m = t.match(new RegExp(`cuadrado\\s+(?:de\\s+)?(?:lado\\s+)?${N}`)))) return { tipo: "rectangulo", b: num(m[1]), h: num(m[1]) };
    if ((m = t.match(new RegExp(`rectangulo\\s+(?:de\\s+)?(?:base\\s+)?${N}\\s+(?:por|x|y|de\\s+altura|altura)\\s+(?:altura\\s+)?${N}`)))) return { tipo: "rectangulo", b: num(m[1]), h: num(m[2]) };
    if ((m = t.match(new RegExp(`(?:circulo|circunferencia)\\s+(?:de\\s+)?(radio|diametro)\\s+(?:de\\s+)?${N}`)))) return { tipo: "circulo", r: m[1] === "diametro" ? num(m[2]) / 2 : num(m[2]) };
    if ((m = t.match(/poligono\s+regular\s+de\s+(\d{1,2})\s+lados|(pentagono|hexagono|heptagono|octagono|octogono|decagono)(?:\s+regular)?/))) { const k = m[1] ? +m[1] : { pentagono: 5, hexagono: 6, heptagono: 7, octagono: 8, octogono: 8, decagono: 10 }[m[2]]; return k >= 3 && k <= 20 ? { tipo: "poligono", n: k } : null; }
    if ((m = t.match(/angulo\s+de\s+(\d{1,3})\s*(?:grados|°)?/))) return +m[1] > 0 && +m[1] <= 360 ? { tipo: "angulo", g: +m[1] } : null;
    if ((m = t.match(/recta\s+numerica(?:\s+del?\s+(-?\d+)\s+al?\s+(-?\d+))?(?:\s+(?:con|marcando|y\s+marca)\s+(?:los\s+puntos\s+|el\s+punto\s+)?(.+))?/))) {
      const pts = m[3] ? (m[3].match(/-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/g) || []) : [];
      let a = m[1] != null ? +m[1] : -5, b = m[2] != null ? +m[2] : 5; if (a > b) [a, b] = [b, a];
      return b - a <= 40 ? { tipo: "recta", a, b, pts } : null;
    }
    if (/plano\s+cartesiano/.test(t)) {
      const pts = [...String(text).matchAll(/([A-Z])?\s*\(\s*(-?\d+(?:[.,]\d+)?)\s*[,;]\s*(-?\d+(?:[.,]\d+)?)\s*\)/g)].map((p, i) => ({ l: p[1] || "ABCDEFGH"[i], x: num(p[2]), y: num(p[3]) }));
      return { tipo: "plano", pts, unir: /\b(?:une|unelos|une los|poligono|triangulo|figura)\b/.test(t) };
    }
    if ((m = t.match(/(?:la\s+)?fraccion\s+(\d{1,2})\s*\/\s*(\d{1,2})|(\d{1,2})\s*\/\s*(\d{1,2})\s+(?:en|como|con)\s+(?:un\s+)?(circulo|torta|pastel|barra|rectangulo)/))) {
      const nu = +(m[1] || m[3]), de = +(m[2] || m[4]);
      return de >= 1 && de <= 24 && nu >= 0 && nu <= de * 3 ? { tipo: "fraccion", nu, de, forma: /barra|rectangulo/.test(t) ? "barra" : "circulo" } : null;
    }
    return null;
  }
  const r2 = (x) => Math.round(x * 100) / 100;
  const lbl = (x) => fmtNum(r2(x));
  const INK = "#0b2236", ACC = "#008fb3", FILL = "rgba(0,170,210,.16)", RED = "#d8344a";
  const svg = (w, h, body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="DejaVu Sans, Arial, sans-serif"><title>${title}</title><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`;
  const txt = (x, y, s, o = {}) => `<text x="${r2(x)}" y="${r2(y)}" font-size="${o.size || 17}" fill="${o.fill || INK}" text-anchor="${o.anchor || "middle"}" dominant-baseline="middle"${o.bold ? ' font-weight="700"' : ""}>${s}</text>`;
  /** Escala unos puntos (en unidades) para que quepan en el lienzo. → función (x,y) → [px, py] */
  function fit(pts, W, H, pad) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min((W - 2 * pad) / Math.max(1e-9, x1 - x0), (H - 2 * pad) / Math.max(1e-9, y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    return (x, y) => [ox + (x - x0) * k, H - (oy + (y - y0) * k)];
  }
  function figSVG(f) {
    const W = 480, H = 360;
    if (f.tipo === "rect") {
      const c = Math.hypot(f.a, f.b), P = fit([[0, 0], [f.b, 0], [0, f.a]], W, H, 60);
      const [Ax, Ay] = P(0, 0), [Bx, By] = P(f.b, 0), [Cx, Cy] = P(0, f.a), s = 16;
      return { svg: svg(W, H, `<polygon points="${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` +
        `<polyline points="${Ax + s},${Ay} ${Ax + s},${Ay - s} ${Ax},${Ay - s}" fill="none" stroke="${INK}" stroke-width="2"/>` +
        txt((Ax + Bx) / 2, Ay + 22, lbl(f.b)) + txt(Ax - 24, (Ay + Cy) / 2, lbl(f.a)) + txt((Bx + Cx) / 2 + 22, (By + Cy) / 2 - 14, `c = ${lbl(c)}`, { fill: ACC, bold: true }), "Triángulo rectángulo"),
        texto: `Triángulo rectángulo de catetos ${lbl(f.a)} y ${lbl(f.b)}. Por Pitágoras, la hipotenusa es $\\sqrt{${lbl(f.a)}^2 + ${lbl(f.b)}^2} = ${lbl(c)}$. Área: $${lbl(f.a * f.b / 2)}$. Perímetro: $${lbl(f.a + f.b + c)}$.` };
    }
    if (f.tipo === "tri") {
      const { a, b, c } = f;
      if (a + b <= c || a + c <= b || b + c <= a) return { error: `Con lados ${lbl(a)}, ${lbl(b)} y ${lbl(c)} no se forma un triángulo: la suma de dos lados debe ser mayor que el tercero.` };
      const x = (b * b + c * c - a * a) / (2 * c), y = Math.sqrt(Math.max(0, b * b - x * x));
      const P = fit([[0, 0], [c, 0], [x, y]], W, H, 60), [Ax, Ay] = P(0, 0), [Bx, By] = P(c, 0), [Cx, Cy] = P(x, y);
      const ang = (o, p, q) => Math.acos((p * p + q * q - o * o) / (2 * p * q)) * 180 / Math.PI;
      const s = (a + b + c) / 2, area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      return { svg: svg(W, H, `<polygon points="${Ax},${Ay} ${Bx},${By} ${Cx},${Cy}" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` +
        txt((Ax + Bx) / 2, Ay + 22, lbl(c)) + txt((Ax + Cx) / 2 - 22, (Ay + Cy) / 2, lbl(b)) + txt((Bx + Cx) / 2 + 22, (By + Cy) / 2, lbl(a)) +
        txt(Ax + 30, Ay - 14, lbl(ang(a, b, c)) + "°", { size: 14, fill: ACC }) + txt(Bx - 30, By - 14, lbl(ang(b, a, c)) + "°", { size: 14, fill: ACC }) + txt(Cx, Cy + 26, lbl(ang(c, a, b)) + "°", { size: 14, fill: ACC }), "Triángulo"),
        texto: `Triángulo de lados ${lbl(a)}, ${lbl(b)} y ${lbl(c)}. Perímetro: $${lbl(a + b + c)}$. Área (fórmula de Herón): $${lbl(area)}$.` };
    }
    if (f.tipo === "rectangulo") {
      const P = fit([[0, 0], [f.b, f.h]], W, H, 60), [x0, y0] = P(0, 0), [x1, y1] = P(f.b, f.h), cuad = f.b === f.h;
      return { svg: svg(W, H, `<rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` + txt((x0 + x1) / 2, y0 + 22, lbl(f.b)) + txt(x0 - 26, (y0 + y1) / 2, lbl(f.h)) +
        `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${ACC}" stroke-dasharray="6 5" stroke-width="2"/>` + txt((x0 + x1) / 2 + 30, (y0 + y1) / 2 - 12, `d = ${lbl(Math.hypot(f.b, f.h))}`, { fill: ACC, size: 15 }), cuad ? "Cuadrado" : "Rectángulo"),
        texto: `${cuad ? "Cuadrado de lado " + lbl(f.b) : `Rectángulo de base ${lbl(f.b)} y altura ${lbl(f.h)}`}. Área: $${lbl(f.b * f.h)}$. Perímetro: $${lbl(2 * (f.b + f.h))}$. Diagonal: $${lbl(Math.hypot(f.b, f.h))}$.` };
    }
    if (f.tipo === "circulo") {
      const cx = W / 2, cy = H / 2, R = 130;
      return { svg: svg(W, H, `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${FILL}" stroke="${INK}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>` +
        `<line x1="${cx}" y1="${cy}" x2="${cx + R}" y2="${cy}" stroke="${ACC}" stroke-width="3"/>` + txt(cx + R / 2, cy - 16, `r = ${lbl(f.r)}`, { fill: ACC, bold: true }), "Círculo"),
        texto: `Círculo de radio ${lbl(f.r)} (diámetro ${lbl(2 * f.r)}). Área: $\\pi r^2 \\approx ${lbl(Math.PI * f.r * f.r)}$. Perímetro: $2\\pi r \\approx ${lbl(2 * Math.PI * f.r)}$.` };
    }
    if (f.tipo === "poligono") {
      const cx = W / 2, cy = H / 2 + 6, R = 140, pts = [];
      for (let k = 0; k < f.n; k++) { const a = -Math.PI / 2 + (2 * Math.PI * k) / f.n; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
      const nom = { 3: "Triángulo equilátero", 4: "Cuadrado", 5: "Pentágono", 6: "Hexágono", 7: "Heptágono", 8: "Octágono", 9: "Eneágono", 10: "Decágono" }[f.n] || `Polígono regular de ${f.n} lados`;
      const int = (180 * (f.n - 2)) / f.n;
      return { svg: svg(W, H, `<polygon points="${pts.map((p) => p.map(r2).join(",")).join(" ")}" fill="${FILL}" stroke="${INK}" stroke-width="3"/>` + pts.map((p) => `<circle cx="${r2(p[0])}" cy="${r2(p[1])}" r="4" fill="${INK}"/>`).join(""), nom),
        texto: `${nom}: ${f.n} lados iguales y ${f.n} ángulos iguales. Cada ángulo interior mide $${lbl(int)}°$ y suman $${180 * (f.n - 2)}°$. Tiene $${(f.n * (f.n - 3)) / 2}$ diagonales.` };
    }
    if (f.tipo === "angulo") {
      const cx = 150, cy = 240, L = 200, a = (f.g * Math.PI) / 180, ex = cx + L * Math.cos(-a), ey = cy + L * Math.sin(-a), r = 55;
      const large = f.g > 180 ? 1 : 0, ax = cx + r * Math.cos(-a), ay = cy + r * Math.sin(-a);
      const tipo = f.g < 90 ? "agudo" : f.g === 90 ? "recto" : f.g < 180 ? "obtuso" : f.g === 180 ? "llano" : f.g < 360 ? "cóncavo" : "completo";
      return { svg: svg(W, H, `<line x1="${cx}" y1="${cy}" x2="${cx + L}" y2="${cy}" stroke="${INK}" stroke-width="3"/><line x1="${cx}" y1="${cy}" x2="${r2(ex)}" y2="${r2(ey)}" stroke="${INK}" stroke-width="3"/>` +
        (f.g === 90 ? `<polyline points="${cx + 26},${cy} ${cx + 26},${cy - 26} ${cx},${cy - 26}" fill="none" stroke="${ACC}" stroke-width="3"/>` : `<path d="M ${cx + r} ${cy} A ${r} ${r} 0 ${large} 0 ${r2(ax)} ${r2(ay)}" fill="none" stroke="${ACC}" stroke-width="3"/>`) +
        txt(cx + (r + 28) * Math.cos(-a / 2), cy + (r + 28) * Math.sin(-a / 2), f.g + "°", { fill: ACC, bold: true, size: 20 }) + `<circle cx="${cx}" cy="${cy}" r="4" fill="${INK}"/>`, "Ángulo"),
        texto: `Ángulo de ${f.g}°: es un ángulo ${tipo}.` + (f.g < 180 ? ` Su complemento${f.g < 90 ? " mide " + (90 - f.g) + "°, y su" : ""} suplemento mide ${180 - f.g}°.` : "") };
    }
    if (f.tipo === "recta") {
      const x0 = 40, x1 = W - 40, y = H / 2, k = (x1 - x0) / (f.b - f.a), X = (v) => x0 + (v - f.a) * k;
      let body = `<line x1="${x0 - 15}" y1="${y}" x2="${x1 + 15}" y2="${y}" stroke="${INK}" stroke-width="3"/><polygon points="${x1 + 22},${y} ${x1 + 10},${y - 7} ${x1 + 10},${y + 7}" fill="${INK}"/><polygon points="${x0 - 22},${y} ${x0 - 10},${y - 7} ${x0 - 10},${y + 7}" fill="${INK}"/>`;
      const step = f.b - f.a > 20 ? 5 : f.b - f.a > 12 ? 2 : 1;
      for (let v = f.a; v <= f.b; v++) { const big = v % step === 0; body += `<line x1="${r2(X(v))}" y1="${y - (big ? 10 : 5)}" x2="${r2(X(v))}" y2="${y + (big ? 10 : 5)}" stroke="${INK}" stroke-width="2"/>` + (big ? txt(X(v), y + 28, v, { size: 15 }) : ""); }
      const vals = f.pts.map((p) => ({ s: p, v: /\//.test(p) ? p.split("/").map(num).reduce((a, b2) => a / b2) : num(p) })).filter((p) => p.v >= f.a && p.v <= f.b);
      vals.forEach((p, i) => { body += `<circle cx="${r2(X(p.v))}" cy="${y}" r="7" fill="${RED}"/>` + txt(X(p.v), y - 26 - (i % 2) * 18, p.s.replace(".", ","), { fill: RED, bold: true }); });
      return { svg: svg(W, 180, body.replace(new RegExp(`y1="${y}"|y2="${y}"|cy="${y}"`, "g"), (s) => s), "Recta numérica").replace(`viewBox="0 0 ${W} 180"`, `viewBox="0 ${y - 90} ${W} 180"`),
        texto: `Recta numérica del ${f.a} al ${f.b}${vals.length ? ", con " + vals.map((p) => p.s.replace(".", ",")).join(", ") : ""}.` };
    }
    if (f.tipo === "plano") {
      const ps = f.pts, mx = Math.max(5, ...ps.map((p) => Math.ceil(Math.abs(p.x)) + 1), ...ps.map((p) => Math.ceil(Math.abs(p.y)) + 1));
      const S = Math.min(W, H) - 40, c = { x: W / 2, y: H / 2 }, k = S / 2 / mx, P = (x, y) => [c.x + x * k, c.y - y * k];
      let body = "";
      for (let v = -mx; v <= mx; v++) { const [gx] = P(v, 0), [, gy] = P(0, v); body += `<line x1="${r2(gx)}" y1="${r2(c.y - S / 2)}" x2="${r2(gx)}" y2="${r2(c.y + S / 2)}" stroke="#d7e3ec"/><line x1="${r2(c.x - S / 2)}" y1="${r2(gy)}" x2="${r2(c.x + S / 2)}" y2="${r2(gy)}" stroke="#d7e3ec"/>`; if (v && (mx <= 10 || v % 2 === 0)) body += txt(gx, c.y + 13, v, { size: 11, fill: "#56708a" }) + txt(c.x - 12, gy, v, { size: 11, fill: "#56708a" }); }
      body += `<line x1="${c.x - S / 2}" y1="${c.y}" x2="${c.x + S / 2}" y2="${c.y}" stroke="${INK}" stroke-width="2"/><line x1="${c.x}" y1="${c.y - S / 2}" x2="${c.x}" y2="${c.y + S / 2}" stroke="${INK}" stroke-width="2"/>` + txt(c.x + S / 2 - 6, c.y - 12, "x", { size: 14 }) + txt(c.x + 12, c.y - S / 2 + 8, "y", { size: 14 });
      if (f.unir && ps.length >= 2) body += `<polygon points="${ps.map((p) => P(p.x, p.y).map(r2).join(",")).join(" ")}" fill="${FILL}" stroke="${ACC}" stroke-width="2.5"/>`;
      ps.forEach((p) => { const [px, py] = P(p.x, p.y); body += `<circle cx="${r2(px)}" cy="${r2(py)}" r="6" fill="${RED}"/>` + txt(px + 8, py - 14, `${p.l}(${lbl(p.x)}, ${lbl(p.y)})`, { size: 14, anchor: "start", fill: RED, bold: true }); });
      return { svg: svg(W, H, body, "Plano cartesiano"), texto: ps.length ? `Plano cartesiano con ${ps.map((p) => `${p.l}(${lbl(p.x)}, ${lbl(p.y)})`).join(", ")}.` + (ps.length === 2 ? ` La distancia entre ${ps[0].l} y ${ps[1].l} es $${lbl(Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y))}$.` : "") : "Plano cartesiano." };
    }
    if (f.tipo === "fraccion") {
      const enteros = Math.ceil(Math.max(f.nu, 1) / f.de), parts = [];
      for (let u = 0; u < enteros; u++) {
        const llenas = Math.max(0, Math.min(f.de, f.nu - u * f.de));
        if (f.forma === "barra") {
          const bw = 400 / f.de, y = 30 + u * 70;
          for (let k = 0; k < f.de; k++) parts.push(`<rect x="${40 + k * bw}" y="${y}" width="${bw}" height="50" fill="${k < llenas ? ACC : "#fff"}" stroke="${INK}" stroke-width="2"/>`);
        } else {
          const cx = enteros > 1 ? 130 + u * 220 : 240, cy = 175, R = enteros > 1 ? 95 : 140;
          for (let k = 0; k < f.de; k++) {
            const a0 = -Math.PI / 2 + (2 * Math.PI * k) / f.de, a1 = -Math.PI / 2 + (2 * Math.PI * (k + 1)) / f.de;
            const d = f.de === 1 ? `M ${cx - R} ${cy} A ${R} ${R} 0 1 0 ${cx + R} ${cy} A ${R} ${R} 0 1 0 ${cx - R} ${cy}` : `M ${cx} ${cy} L ${r2(cx + R * Math.cos(a0))} ${r2(cy + R * Math.sin(a0))} A ${R} ${R} 0 0 1 ${r2(cx + R * Math.cos(a1))} ${r2(cy + R * Math.sin(a1))} Z`;
            parts.push(`<path d="${d}" fill="${k < llenas ? ACC : "#fff"}" stroke="${INK}" stroke-width="2"/>`);
          }
        }
      }
      const h = f.forma === "barra" ? 40 + enteros * 70 : H;
      return { svg: svg(f.forma === "barra" && enteros === 1 ? W : enteros > 2 ? 140 + enteros * 220 : W, h, parts.join(""), "Fracción"), texto: `La fracción $\\frac{${f.nu}}{${f.de}}$: ${f.de === 1 ? "la unidad completa" : `la unidad partida en ${f.de} partes iguales, de las que se toman ${f.nu}`}${f.nu > f.de ? ` (es mayor que 1: ${Math.floor(f.nu / f.de)} enteros y $\\frac{${f.nu % f.de}}{${f.de}}$)` : ""}.` };
    }
    return { error: "No sé dibujar eso todavía." };
  }

  // ======================================================================== ACUDIENTES
  /** «Ana Rojas 300 123 4567» o «Ana Rojas; 3001234567» por línea → {nombre: número} (solo los del curso) */
  function parseGuardians(text, estudiantes) {
    const out = {}, miss = [];
    String(text || "").split(/\n+/).forEach((ln) => {
      const m = ln.match(/^(.*?)[\s;,:\t-]*(\+?\d[\d\s().-]{6,}\d)\s*$/);
      if (!m) return;
      const q = norm(m[1].replace(/^\d+[.)]\s*/, ""));
      if (!q) return;
      const hit = (estudiantes || []).find((n) => norm(n) === q) || (estudiantes || []).find((n) => q.split(" ").every((w) => norm(n).split(" ").includes(w)));
      if (hit) out[hit] = m[2].replace(/[^\d+]/g, ""); else miss.push(m[1].trim());
    });
    return { mapa: out, sinEncontrar: miss };
  }
  function guardianIntent(text) {
    const raw = String(text || "").trim().replace(lead, ""), t = norm(raw);
    let m;
    if ((m = raw.match(/^(?:av[ií]sale|escr[ií]bele|m[aá]ndale\s+(?:un\s+)?mensaje|env[ií]ale\s+(?:un\s+)?mensaje)\s+a\s+los\s+acudientes\s+de\s+(?:los\s+que\s+(?:van|est[aá]n)\s+en\s+riesgo|los\s+estudiantes\s+en\s+riesgo)\s+(?:en|de)\s+(\S+)(?:\s*[:,]\s*(.+))?$/i))) return { kind: "acud_riesgo", curso: m[1], extra: (m[2] || "").trim() };
    if ((m = raw.match(/^(?:m[aá]nda(?:les)?|env[ií]a(?:les)?)\s+las\s+notas\s+a\s+los\s+acudientes\s+(?:de|del)\s+(\S+)$/i))) return { kind: "acud_notas", curso: m[1] };
    if ((m = raw.match(/^(?:m[aá]nda(?:les)?|env[ií]a(?:les)?|escr[ií]be(?:les)?)\s+(?:un\s+)?mensaje\s+a\s+(?:todos\s+)?los\s+acudientes\s+(?:de|del)\s+(\S+)\s*[:,]?\s*(?:diciendo(?:les)?\s+(?:que\s+)?|que\s+)?(.+)$/i))) return { kind: "acud_todos", curso: m[1], texto: m[2].trim() };
    if ((m = t.match(/^(?:acudientes|telefonos de (?:los )?acudientes|contactos de (?:los )?acudientes)(?:\s+de\s+(\S+))?$/))) return { kind: "acud_ver", curso: m[1] || "" };
    return null;
  }
  const first = (n) => String(n).split(" ")[0];
  /** Mensaje para el acudiente (se arma en el celular: el nombre no va a la IA). */
  function guardianMsg(tipo, d) {
    const firma = d.docente ? `\n\n${d.docente}` : "";
    const saludo = `Buen día. Le escribe ${d.docente ? d.docente + ", " : ""}docente de ${d.asignatura || "matemáticas"} de ${first(d.nombre)} (${d.curso}).`;
    if (tipo === "riesgo") return `${saludo}\n\nLe cuento que ${first(d.nombre)} va con un promedio de ${String(d.promedio).replace(".", ",")} en el periodo${d.faltas ? ` y lleva ${d.faltas} falla${d.faltas === 1 ? "" : "s"}` : ""}. Con su apoyo en casa todavía puede mejorar${d.necesita ? `: para aprobar necesita sacar ${String(d.necesita).replace(".", ",")} en la próxima actividad` : ""}.${d.extra ? "\n\n" + d.extra : ""}\n\nQuedo atenta a cualquier inquietud.${firma}`;
    if (tipo === "notas") return `${saludo}\n\nEstas son las notas de ${first(d.nombre)} hasta hoy:\n${d.lineas.join("\n")}\nPromedio: ${String(d.promedio).replace(".", ",")}.${firma}`;
    return `${saludo}\n\n${d.texto}${firma}`;
  }

  // ======================================================================== REUNIÓN Y CLASE DE MAÑANA
  function meetingIntent(text) {
    const t = norm(String(text || "").replace(lead, ""));
    if (/^(?:modo\s+reunion|empieza\s+(?:la\s+)?reunion|graba(?:r)?\s+(?:la\s+)?reunion|toma\s+(?:el\s+)?acta(?:\s+de\s+la\s+reunion)?|escucha\s+la\s+reunion)$/.test(t)) return { kind: "reunion" };
    let m;
    if ((m = t.match(/^(?:prepara(?:me)?|alista(?:me)?)\s+(?:mi\s+|la\s+)?clase\s+de\s+(manana|hoy|mañana)\s+(?:de|en|para)\s+(\S+)(?:\s+(?:de|sobre)\s+(.+))?$/)) || (m = t.match(/^(?:prepara(?:me)?|alista(?:me)?)\s+(?:mi\s+|la\s+)?clase\s+(?:de|en|para)\s+(\S+)\s+(?:de|para)\s+(manana|hoy)(?:\s+(?:de|sobre)\s+(.+))?$/))) {
      const cuando = /manana|hoy/.test(m[1]) ? m[1] : m[2], curso = /manana|hoy/.test(m[1]) ? m[2] : m[1];
      return { kind: "clase_completa", curso, cuando, tema: (m[3] || "").trim() };
    }
    return null;
  }
  function meetingPrompt(trans) {
    return `Esta es la transcripción automática (puede tener errores) de una reunión de docentes en un colegio de Colombia. Escribe el ACTA en español, en Markdown, con estas secciones:\n### Asistentes (los que se mencionan)\n### Temas tratados\n### Acuerdos\n### Tareas (tabla: tarea | responsable | fecha)\n### Próxima reunión\nSé fiel a lo dicho; si algo no se dijo, escribe «no se mencionó».\n\nTRANSCRIPCIÓN:\n${String(trans).slice(0, 60000)}`;
  }

  // ======================================================================== SINCRONIZAR CON EL JARVIS DEL PC
  /** Los datos del celular en el formato del PC: {cursos:{c:[est]}, notas:{c:{est:[{actividad,nota,fecha}]}}, asistencia:{c:{fecha:[est]}}, observador:{c:{est:[{fecha,tipo,texto}]}}} */
  function toPC(D) {
    const out = { cursos: {}, notas: {}, asistencia: {}, observador: {} };
    (D.cursos || []).forEach((c) => {
      out.cursos[c.nombre] = (c.estudiantes || []).slice();
      const n = c.notas || { actividades: [], valores: {} }, nc = (out.notas[c.nombre] = {});
      Object.entries(n.valores || {}).forEach(([est, v]) => {
        (n.actividades || []).forEach((a) => { if (typeof v[a.id] === "number") (nc[est] = nc[est] || []).push({ actividad: a.nombre, nota: v[a.id], fecha: a.fecha || "" }); });
      });
    });
    (D.asistencia || []).forEach((r) => { if (r.faltas && r.faltas.length) ((out.asistencia[r.curso] = out.asistencia[r.curso] || {})[r.fecha] = r.faltas.slice()); });
    Object.entries(D.observador || {}).forEach(([est, l]) => (l || []).forEach((o) => {
      const c = o.curso || ((D.cursos || []).find((x) => (x.estudiantes || []).includes(est)) || {}).nombre || "";
      if (!c) return;
      ((out.observador[c] = out.observador[c] || {})[est] = out.observador[c][est] || []).push({ fecha: new Date(o.t || Date.now()).toISOString().slice(0, 10), tipo: o.tipo || "", texto: o.texto });
    }));
    return out;
  }
  /** Mezcla lo del PC en el celular, sin borrar nada: lo que falta se agrega y, si hay dos notas distintas, gana la del celular. → resumen */
  function fromPC(D, pc, uid) {
    const k = (s) => norm(s).replace(/\s+/g, "");
    const r = { cursos: 0, estudiantes: 0, notas: 0, fallas: 0, observador: 0 };
    D.cursos = D.cursos || [];
    const curso = (nombre) => {
      let c = D.cursos.find((x) => k(x.nombre) === k(nombre));
      if (!c) { c = { id: uid(), nombre, estudiantes: [] }; D.cursos.push(c); r.cursos++; }
      c.notas = c.notas || { actividades: [], valores: {} };
      return c;
    };
    Object.entries(pc.cursos || {}).forEach(([nombre, ests]) => {
      const c = curso(nombre);
      (ests || []).forEach((e) => { if (!c.estudiantes.some((x) => k(x) === k(e))) { c.estudiantes.push(e); r.estudiantes++; } });
    });
    Object.entries(pc.notas || {}).forEach(([nombre, porEst]) => {
      const c = curso(nombre);
      Object.entries(porEst || {}).forEach(([est, l]) => {
        const e = c.estudiantes.find((x) => k(x) === k(est)) || est;
        if (!c.estudiantes.includes(e)) { c.estudiantes.push(e); r.estudiantes++; }
        (l || []).forEach((it) => {
          if (typeof it.nota !== "number") return;
          let a = c.notas.actividades.find((x) => k(x.nombre) === k(it.actividad));
          if (!a) { a = { id: "a" + uid(), nombre: String(it.actividad).slice(0, 40), peso: 1, fecha: it.fecha || "" }; c.notas.actividades.push(a); }
          const v = (c.notas.valores[e] = c.notas.valores[e] || {});
          if (typeof v[a.id] !== "number") { v[a.id] = it.nota; r.notas++; }
        });
      });
    });
    D.asistencia = D.asistencia || [];
    Object.entries(pc.asistencia || {}).forEach(([nombre, porFecha]) => {
      const c = curso(nombre);
      Object.entries(porFecha || {}).forEach(([fecha, ns]) => {
        let reg = D.asistencia.find((x) => x.fecha === fecha && x.curso === c.nombre);
        if (!reg) { reg = { fecha, curso: c.nombre, faltas: [], tardes: [] }; D.asistencia.push(reg); }
        (ns || []).forEach((n) => { const e = c.estudiantes.find((x) => k(x) === k(n)) || n; if (!reg.faltas.includes(e)) { reg.faltas.push(e); r.fallas++; } });
      });
    });
    D.observador = D.observador || {};
    Object.entries(pc.observador || {}).forEach(([nombre, porEst]) => {
      const c = curso(nombre);
      Object.entries(porEst || {}).forEach(([est, l]) => {
        const e = c.estudiantes.find((x) => k(x) === k(est)) || est, mio = (D.observador[e] = D.observador[e] || []);
        (l || []).forEach((o) => { if (!mio.some((x) => norm(x.texto) === norm(o.texto))) { mio.push({ t: Date.parse(o.fecha) || Date.now(), texto: o.texto, curso: c.nombre, tipo: o.tipo || "" }); r.observador++; } });
      });
    });
    return r;
  }

  const API = { norm, toNerd, casIntent, toTex, solveEq, checkEq, linearSteps, answerValue, eqIn, fmtNum, figIntent, figSVG, parseGuardians, guardianIntent, guardianMsg, meetingIntent, meetingPrompt, toPC, fromPC };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JL6 = API;
})(typeof window !== "undefined" ? window : this);
