/* Jarvis para Android 3.9 · lógica pura (se prueba con node): la vida diaria.
   Gastos y presupuesto · listas · medicamentos y hábitos · cumpleaños · disparadores automáticos · modo conducción ·
   «¿qué me perdí?» · leer en voz alta · preguntarle a tus notas · intérprete · noticias · emergencia ·
   temporizadores con nombre · planeador semanal. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "");

  // ======================================================================== NÚMEROS Y PLATA
  const U = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
    dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
    treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
    seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900, medio: 0.5, media: 0.5 };
  const NUMW = Object.keys(U).sort((a, b) => b.length - a.length).join("|");
  /** «veinticinco», «ciento veinte», «tres» → número (hasta 999), o null. */
  function palabras(s) {
    const ws = norm(s).split(" ").filter((w) => w && w !== "y");
    if (!ws.length || !ws.every((w) => U[w] != null)) return null;
    return ws.reduce((a, w) => a + U[w], 0);
  }
  /** «25 mil», «25.000», «$25.000», «1,5 millones», «un millón», «veinte mil», «medio millón» → pesos */
  function monto(s) {
    const t = norm(String(s).replace(/\$/g, " $ ")).replace(/\bpesos?\b|\bcop\b/g, "").trim();
    let m = t.match(new RegExp(`(?:^|\\s|\\$)\\s*((?:\\d{1,3}(?:[.,]\\d{3})+|\\d+)(?:[.,]\\d+)?|(?:(?:${NUMW})\\s?)+?)\\s*(mil millones|millones|millon|mil|k|lucas?)?(?:\\s|$)`));
    if (!m) return null;
    let raw = m[1].trim(), n;
    if (/^\d/.test(raw)) {
      if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) n = +raw.replace(/[.,]/g, "");
      else if (/^\d{1,3}([.,]\d{3})+[.,]\d{1,2}$/.test(raw)) n = +raw.replace(/[.,]\d{1,2}$/, "").replace(/[.,]/g, "");
      else n = +raw.replace(",", ".");
    } else n = palabras(raw);
    if (n == null || isNaN(n)) return null;
    const mult = m[2] || "";
    if (/mil millones/.test(mult)) n *= 1e9; else if (/millon/.test(mult)) n *= 1e6; else if (/^(?:mil|k|luca|lucas)$/.test(mult)) n *= 1000;
    return n > 0 ? Math.round(n) : null;
  }
  const cop = (n) => "$" + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  // ======================================================================== GASTOS Y PRESUPUESTO
  const CATS = [
    ["comida", /\b(?:almuerzo|desayuno|cena|comida|restaurante|corrientazo|hamburguesa|pizza|empanada|tinto|cafe|onces|helado|domicilio|rappi|pollo|panaderia|pan|mecato|gaseosa|cerveza|bar)\b/],
    ["mercado", /\b(?:mercado|supermercado|exito|d1|ara|carulla|olimpica|jumbo|makro|tienda|fruver|plaza)\b/],
    ["transporte", /\b(?:taxi|uber|didi|cabify|indrive|bus|buseta|transmilenio|metro|mio|sitp|gasolina|tanqueada|peaje|parqueadero|moto|pasaje|vuelo|tiquete)\b/],
    ["servicios", /\b(?:luz|agua|gas|internet|celular|plan|recarga|energia|acueducto|epm|codensa|enel|claro|movistar|tigo|wom|telefono)\b/],
    ["vivienda", /\b(?:arriendo|administracion|hipoteca|cuota de la casa)\b/],
    ["salud", /\b(?:drogueria|farmacia|medicamento|medicina|pastillas?|medico|cita|odontologo|examen|eps|consulta)\b/],
    ["educación", /\b(?:colegio|universidad|matricula|pension|libro|libros|curso|cuadernos?|utiles|fotocopias?)\b/],
    ["entretenimiento", /\b(?:cine|netflix|spotify|disney|hbo|max|youtube|juego|concierto|paseo|fiesta|rumba)\b/],
    ["ropa", /\b(?:ropa|zapatos|tenis|camisa|pantalon|vestido|chaqueta)\b/],
    ["hogar", /\b(?:aseo|detergente|ferreteria|mueble|electrodomestico|homecenter)\b/],
  ];
  function categoria(desc) { const t = norm(desc); const c = CATS.find(([, re]) => re.test(t)); return c ? c[0] : "otros"; }
  function catDe(s) { const t = norm(s); const c = CATS.find(([k]) => norm(k) === t || norm(k).startsWith(t) || t.startsWith(norm(k))); return c ? c[0] : null; }

  /** «gasté 25 mil en almuerzo», «pagué 120.000 de luz», «anota un gasto de 30 mil en taxi», «me pagaron 2 millones» */
  function gastoIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(?:me\s+)?(?:gaste|pague|compre|invert[ií]|di)\s+(.+?)\s+(?:en|de|por|para)\s+(?:el |la |los |las |un |una )?(.+)$/)) ||
        (m = t.match(/^(?:anota|apunta|registra|guarda)\s+(?:un\s+)?gasto\s+(?:de\s+)?(.+?)\s+(?:en|de|por|para)\s+(?:el |la |los |las |un |una )?(.+)$/))) {
      const n = monto(m[1]); if (!n) return null;
      return { gasto: "add", monto: n, desc: m[2].slice(0, 60), cat: categoria(m[2]), tipo: "gasto" };
    }
    if ((m = t.match(/^(?:me\s+)?(?:gaste|pague)\s+(?:en|de)\s+(?:el |la |un |una )?(.+?)\s+((?:\$\s*)?[\d.,]+(?:\s*(?:mil|millones|millon))?|(?:\S+\s+)?mil|(?:\S+\s+)?millones?)$/))) {
      const n = monto(m[2]); if (!n) return null;
      return { gasto: "add", monto: n, desc: m[1].slice(0, 60), cat: categoria(m[1]), tipo: "gasto" };
    }
    if ((m = t.match(/^(?:me\s+(?:pagaron|consignaron|llego|llegaron|entro|entraron)|recibi|gane)\s+(.+?)(?:\s+(?:de|por|del)\s+(.+))?$/))) {
      const n = monto(m[1]); if (!n) return null;
      return { gasto: "add", monto: n, desc: (m[2] || "ingreso").slice(0, 60), cat: "ingreso", tipo: "ingreso" };
    }
    if ((m = t.match(/^(?:mi\s+)?presupuesto(?:\s+mensual)?(?:\s+(?:para|de|en)\s+(\S+))?\s+(?:es|sera|va a ser)\s+(?:de\s+)?(.+)$/)) ||
        (m = t.match(/^(?:pon|ponme|fija|define)\s+(?:un\s+)?presupuesto(?:\s+mensual)?\s+de\s+(.+?)(?:\s+(?:para|en)\s+(.+))?$/))) {
      const swap = /^(?:pon|ponme|fija|define)/.test(t);
      const n = monto(swap ? m[1] : m[2]); if (!n) return null;
      const c = swap ? m[2] : m[1];
      return { gasto: "presupuesto", monto: n, cat: c ? catDe(c) || categoria(c) : "" };
    }
    if (/^(?:borra|elimina|quita)\s+(?:el\s+)?ultimo\s+(?:gasto|movimiento)$/.test(t)) return { gasto: "deshacer" };
    if ((m = t.match(/^(?:cuanto|cuanta plata)\s+(?:he\s+gastado|llevo(?:\s+gastado)?|gaste|me he gastado|va(?:mos)?)(.*)$/)) || (m = t.match(/^(?:mis gastos|resumen de (?:mis )?gastos|como voy con (?:los gastos|el presupuesto|mi presupuesto)|en que (?:he gastado|se me va la plata))(.*)$/))) {
      const r = m[1] || "";
      if (/\b(?:ia|inteligencia artificial|tokens|gemini|chatgpt)\b/.test(r)) return null;      // «¿cuánto he gastado de la IA?» es otra cosa
      const per = /\bhoy\b/.test(r) ? "hoy" : /\bsemana\b/.test(r) ? "semana" : /\bmes pasado\b/.test(r) ? "mespasado" : "mes";
      const c = r.match(/\ben\s+(?:el |la |los |las )?([a-zñ]+(?:\s[a-zñ]+)?)/);
      const cat = c && !/^(?:este|esta|el|la|lo)$/.test(c[1]) ? catDe(c[1]) || categoria(c[1]) : "";
      return { gasto: "ver", per, cat: cat === "otros" && c ? (catDe(c[1]) || "otros") : cat };
    }
    return null;
  }
  function rango(per, now) {
    const d = new Date(now);
    if (per === "hoy") { const a = new Date(d); a.setHours(0, 0, 0, 0); return [a.getTime(), now + 1]; }
    if (per === "semana") { const a = new Date(d); a.setHours(0, 0, 0, 0); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); return [a.getTime(), now + 1]; }
    if (per === "mespasado") { const a = new Date(d.getFullYear(), d.getMonth() - 1, 1), b = new Date(d.getFullYear(), d.getMonth(), 1); return [a.getTime(), b.getTime()]; }
    return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), now + 1];
  }
  /** Suma por categoría en el periodo: {total, ingresos, cats:[[cat, total]], n} */
  function resumen(lista, per, now, cat) {
    const [a, b] = rango(per, now);
    const l = (lista || []).filter((g) => g.t >= a && g.t < b);
    const gs = l.filter((g) => g.tipo !== "ingreso" && (!cat || g.cat === cat));
    const by = {}; gs.forEach((g) => { by[g.cat] = (by[g.cat] || 0) + g.monto; });
    return { total: gs.reduce((s, g) => s + g.monto, 0), ingresos: l.filter((g) => g.tipo === "ingreso").reduce((s, g) => s + g.monto, 0), cats: Object.entries(by).sort((x, y) => y[1] - x[1]), n: gs.length };
  }
  /** Avisos del presupuesto después de anotar un gasto: «llevas el 82 % de comida». */
  function alertaPresupuesto(lista, pres, cat, now) {
    if (!pres) return "";
    const out = [];
    const chk = (lim, c, nombre) => { if (!lim) return; const r = resumen(lista, "mes", now, c).total, p = Math.round(r / lim * 100); if (p >= 100) out.push(`⚠️ Te pasaste del presupuesto ${nombre}: llevas ${cop(r)} de ${cop(lim)}.`); else if (p >= 80) out.push(`Ojo: llevas el ${p} % del presupuesto ${nombre} (${cop(r)} de ${cop(lim)}).`); };
    if (cat && pres.cats && pres.cats[cat]) chk(pres.cats[cat], cat, "de " + cat);
    chk(pres.total, "", "del mes");
    return out.join(" ");
  }
  /** El aviso del banco: «Bancolombia: Compraste $45.900,00 en EXITO CALLE 80 con tu T.Deb *1234» → {monto, desc, tipo} */
  function banco(texto) {
    const t = String(texto || "");
    const m = t.match(/\$\s?((?:\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,]\d{1,2})?)/);
    if (!m) return null;
    let raw = m[1], n;
    if (/^\d{1,3}([.,]\d{3})+[.,]\d{1,2}$/.test(raw)) n = +raw.replace(/[.,]\d{1,2}$/, "").replace(/[.,]/g, "");
    else if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) n = +raw.replace(/[.,]/g, "");
    else n = Math.round(+raw.replace(",", "."));
    if (!n || n < 100) return null;
    const ing = /\b(?:recibiste|te consignaron|abono|consignacion|transferencia recibida|recibio)\b/i.test(t);
    const c = t.slice(m.index + m[0].length).match(/^\s*(?:,\d{2})?\s*(?:en|a|de)\s+([A-Za-zÁÉÍÓÚÑáéíóúñ0-9&'.\- ]{2,40}?)(?=\s+(?:con|el|desde|por|a las|\d{2}[/:-])\b|[.,*]|$)/);
    const desc = c ? c[1].trim() : ing ? "ingreso" : "compra con tarjeta";
    return { monto: n, desc, cat: ing ? "ingreso" : categoria(desc), tipo: ing ? "ingreso" : "gasto" };
  }

  // ======================================================================== LISTAS
  function items(s) { return String(s).split(/\s*,\s*|\s+y\s+|\s+e\s+(?=[a-z])/).map((x) => x.replace(/^(?:un|una|unos|unas|el|la|los|las)\s+/, "").trim()).filter((x) => x.length > 1).slice(0, 25); }
  function nomLista(s) { const n = norm(s || "").replace(/^(?:del?|de la|para (?:el |la )?|las?|los?)\s+/, "").trim(); return n || "mercado"; }
  /** «agrega leche y huevos a la lista», «¿qué me falta comprar?», «ya compré leche», «manda la lista a Ana» */
  function listaIntent(text, cursos) {
    const t = lead(norm(text));
    const esCurso = (n) => (cursos || []).some((c) => norm(c).replace(/\s/g, "") === norm(n).replace(/\s/g, ""));
    let m;
    if ((m = t.match(/^(?:agrega|anade|agregale|pon|apunta|anota|mete)\s+(.+?)\s+(?:a|en)\s+(?:la\s+|mi\s+)?lista(?:\s+(?:del?|de la|de las|de los|para)\s+(.+))?$/))) {
      if (m[2] && esCurso(m[2])) return null;
      return { lista: "add", items: items(m[1]), nombre: nomLista(m[2]) };
    }
    if ((m = t.match(/^(?:hay que|tengo que|necesito)\s+comprar\s+(.+)$/))) return { lista: "add", items: items(m[1]), nombre: "mercado" };
    if ((m = t.match(/^(?:ya\s+)?(?:compre|tache|consegui)\s+(.+)$/)) && !/\bpor\b|\ben\b.*\d/.test(m[1]) && !/\d/.test(m[1])) return { lista: "quitar", items: items(m[1]), nombre: "" };
    if ((m = t.match(/^(?:quita|borra|tacha|saca)\s+(.+?)\s+de\s+la\s+lista(?:\s+(?:del?|de la)\s+(.+))?$/))) return { lista: "quitar", items: items(m[1]), nombre: m[2] ? nomLista(m[2]) : "" };
    if ((m = t.match(/^(?:borra|vacia|limpia|elimina)\s+(?:toda\s+)?la\s+lista(?:\s+(?:del?|de la)\s+(.+))?$/))) { if (m[1] && esCurso(m[1])) return null; return { lista: "vaciar", nombre: nomLista(m[1]) }; }
    if ((m = t.match(/^(?:manda|envia|comparte|pasale)\s+(?:la\s+)?lista(?:\s+(?:del?|de la)\s+(.+?))?\s+a\s+(.+)$/))) return { lista: "enviar", nombre: m[1] ? nomLista(m[1]) : "", a: m[2] };
    if ((m = t.match(/^(?:que (?:me )?falta (?:por )?comprar|que hay (?:que comprar|en (?:la|mi) lista(?: del? (.+))?)|que tengo en (?:la|mi) lista(?: del? (.+))?|(?:muestrame|leeme|dime|ver)\s+(?:la|mi)\s+lista(?: (?:del?|de la) (.+))?|mis listas|la lista del (.+))$/))) {
      const n = m[1] || m[2] || m[3] || m[4] || "";
      if (n && esCurso(n)) return null;
      return /^mis listas$/.test(t) ? { lista: "todas" } : { lista: "ver", nombre: n ? nomLista(n) : "" };
    }
    return null;
  }
  function listaTexto(l) { return (l.items || []).filter((x) => !x.hecho).map((x) => "- " + x.t).join("\n"); }

  // ======================================================================== MEDICAMENTOS Y HÁBITOS
  const MEDS = "pastilla|pastillas|medicamento|medicamentos|medicina|medicinas|remedio|pildora|tableta|capsula|jarabe|inyeccion|insulina|vitamina|vitaminas|gotas|anticonceptiva|acetaminofen|ibuprofeno|losartan|omeprazol|metformina|levotiroxina|antibiotico";
  function horaDe(s) {
    const m = s.match(/(\d{1,2})(?:[: ](\d{2})| y (media|cuarto))?(?:\s*(de la manana|de la tarde|de la noche|am|pm|a m|p m))?/);
    if (!m) return null;
    let h = +m[1], mi = m[2] ? +m[2] : m[3] === "media" ? 30 : m[3] === "cuarto" ? 15 : 0;
    if (/tarde|noche|pm|p m/.test(m[4] || "") && h < 12) h += 12;
    if (/manana|am|a m/.test(m[4] || "") && h === 12) h = 0;
    return h <= 23 && mi <= 59 ? { h, m: mi } : null;
  }
  /** «recuérdame tomar la pastilla de la presión a las 8 y a las 8 de la noche» → {med, nombre, horas} */
  function medIntent(text) {
    const t = lead(norm(text));
    const m = t.match(new RegExp(`^(?:recuerdame|avisame|acuerdame)\\s+(?:que\\s+)?(?:(?:me\\s+)?tomar(?:me)?|tome|ponerme|aplicarme)?\\s*(?:la |el |las |los |mi |mis )?((?:${MEDS})\\b.*?)\\s+((?:a las|a la)\\s+.+)$`));
    if (!m) return null;
    const horas = [];
    m[2].split(/\s+y\s+(?=a las|a la)/).forEach((p) => { const h = horaDe(p.replace(/^a las?\s+/, "")); if (h) horas.push(h); });
    if (!horas.length) return null;
    const nombre = m[1].replace(/\s+(?:todos los dias|cada dia|diario|a diario)$/, "").trim();
    return { med: true, nombre, horas: horas.slice(0, 6) };
  }
  const INF = { hice: "hacer", tome: "tomar", lei: "leer", medite: "meditar", camine: "caminar", corri: "correr", estudie: "estudiar", practique: "practicar", nade: "nadar", escribi: "escribir", ore: "orar", dormi: "dormir", fui: "ir" };
  /** «ya hice ejercicio», «registra que tomé agua», «leí 20 minutos hoy» → {habito:"marcar", nombre} · «mis rachas» */
  function habitoIntent(text) {
    const t = lead(norm(text));
    if (/^(?:mis rachas|como voy con mis habitos|mis habitos|como van mis habitos)$/.test(t)) return { habito: "ver" };
    let m;
    if ((m = t.match(/^(?:pausas activas|recuerdame (?:hacer )?pausas activas|activa (?:las )?pausas activas)(?:\s+cada\s+(hora|\d+\s+minutos|media hora))?(?:\s+de\s+(\d{1,2})\s+a\s+(\d{1,2}))?$/))) {
      let ini = m[2] ? +m[2] : 8, fin = m[3] ? +m[3] : 17; if (fin <= 12 && fin < ini) fin += 12;
      return { habito: "pausas", on: true, ini, fin, cada: m[1] === "media hora" ? 30 : m[1] && /\d+/.test(m[1]) ? Math.max(30, +m[1].match(/\d+/)[0]) : 60 };
    }
    if (/^(?:quita|desactiva|apaga|para)\s+(?:las\s+)?pausas activas$/.test(t)) return { habito: "pausas", on: false };
    if ((m = t.match(/^(?:ya\s+(?:me\s+)?(hice|tome|lei|medite|camine|corri|estudie|practique|nade|escribi|ore)|registra(?:\s+que)?\s+(?:ya\s+)?(?:me\s+)?(hice|tome|lei|medite|camine|corri|estudie|practique|nade|escribi|ore)|(hice|tome|lei|medite|camine|corri|estudie|practique|nade|escribi|ore))\s+(.+?)(?:\s+hoy)?$/))) {
      const v = m[1] || m[2] || m[3];
      if (m[3] && !/\bhoy$/.test(t)) return null;                     // «tomé una foto» no es un hábito: hace falta «ya …», «registra …» o «… hoy»
      let obj = m[4].replace(/^(?:un|una|el|la|mi)\s+/, "").replace(/\s+(?:\d+\s+(?:minutos|horas|vasos|paginas|km|kilometros)|de\s+\d+.*)$/, "").trim();
      if (new RegExp(`^(?:${MEDS})`).test(obj)) return { habito: "med_tomada", nombre: obj };
      if (/^(?:vaso|vasos)\s+de\s+agua$/.test(obj)) obj = "agua";
      return { habito: "marcar", nombre: (INF[v] + " " + obj.split(" ").slice(0, 3).join(" ")).trim() };
    }
    return null;
  }
  const dia = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  /** Días seguidos (hasta hoy o ayer) en que se marcó el hábito. */
  function racha(marcas, now) {
    const set = new Set((marcas || []).map(dia));
    let d = dia(now); if (!set.has(d)) d -= 864e5;
    let n = 0; while (set.has(d)) { n++; d = dia(d - 864e5 + 3600e3 * 3); }
    return n;
  }

  // ======================================================================== CUMPLEAÑOS
  const MES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
  /** «el cumpleaños de Ana es el 5 de marzo» · «¿quién cumple años esta semana?» */
  function cumpleIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(?:el\s+)?(?:cumpleanos|cumple)\s+de\s+(.+?)\s+es\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)$/)) || (m = t.match(/^(.+?)\s+cumple(?:\s+anos)?\s+(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)$/))) {
      const mes = MES[m[3]], d = +m[2]; if (!mes || d < 1 || d > 31) return null;
      return { cumple: "add", nombre: m[1].replace(/^(?:mi\s+)/, "").trim(), mes, dia: d };
    }
    if ((m = t.match(/^(?:quien|quienes)\s+cumple(?:n)?(?:\s+anos)?\s*(hoy|manana|esta semana|este mes|pronto)?$/)) || (m = t.match(/^(?:proximos\s+)?cumpleanos(?:\s+de)?\s*(hoy|esta semana|este mes)?$/)) || (m = t.match(/^(?:mis\s+cumpleanos|cumpleanos que vienen)()$/))) {
      const p = m[1] || "pronto";
      return { cumple: "ver", dias: p === "hoy" ? 0 : p === "manana" ? 1 : p === "esta semana" ? 7 : p === "este mes" ? 31 : 30 };
    }
    return null;
  }
  /** «--03-05», «1990-03-05», «05/03» → {mes, dia} */
  function fechaCumple(f) {
    let m = String(f || "").match(/(?:^|-)(\d{2})-(\d{2})$/);
    if (m) return { mes: +m[1], dia: +m[2] };
    m = String(f || "").match(/^(\d{1,2})\/(\d{1,2})/);
    return m ? { mes: +m[2], dia: +m[1] } : null;
  }
  /** Los que cumplen en los próximos «dias» días: [{nombre, en, mes, dia}] */
  function proximos(lista, now, dias) {
    const hoy = dia(now), out = [];
    (lista || []).forEach((c) => {
      const y = new Date(now).getFullYear();
      let f = new Date(y, c.mes - 1, c.dia).getTime();
      if (f < hoy) f = new Date(y + 1, c.mes - 1, c.dia).getTime();
      const en = Math.round((f - hoy) / 864e5);
      if (en <= dias) out.push(Object.assign({}, c, { en }));
    });
    return out.sort((a, b) => a.en - b.en);
  }
  const FELIZ = ["¡Feliz cumpleaños, {n}! 🎉 Que tengas un día muy bonito y un año lleno de cosas buenas.", "¡Feliz cumpleaños, {n}! 🎂 Te deseo mucha salud, alegría y éxitos. ¡Un abrazo!", "¡{n}, feliz cumple! 🥳 Que la pases increíble hoy. ¡Un abrazo grande!"];
  const feliz = (nombre, k) => FELIZ[(k || 0) % FELIZ.length].replace("{n}", String(nombre).split(" ")[0]);

  // ======================================================================== DISPARADORES AUTOMÁTICOS
  /** «cuando conecte el carro, modo conducción» · «al poner a cargar el celular, activa el modo ahorro» · «cuando llegue a la casa, silencia el celular» */
  function dispIntent(text) {
    const raw = lead(String(text || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!«»"]/g, " ").replace(/\s+/g, " ").trim());
    const m = raw.match(/^(?:cuando|al|apenas|cada vez que)\s+(conecte|conectar|me conecte a|desconecte|desconectar|ponga a cargar|poner a cargar|conecte el cargador|desconecte el cargador|quite el cargador|llegue a|llegar a|salga de|salir de)\s*(.*?)\s*(?:,|:|\bentonces\b|\bhaz\b|\bactiva\b(?=.)|\bpon\b(?=.))\s*(.+)$/);
    if (!m) return null;
    const v = m[1], obj = m[2].replace(/^(?:el|la|los|las|mi|mis)\s+/, "").trim();
    let accion = m[3].trim();
    const pre = raw.slice(raw.lastIndexOf(accion) - 8, raw.lastIndexOf(accion));
    if (/\bactiva\s*$/.test(pre)) accion = "activa " + accion; else if (/\bpon\s*$/.test(pre)) accion = "pon " + accion;
    accion = accion.replace(/^(?:que\s+)?(?:tu\s+)?/, "").replace(/[.\s]+$/, "");
    if (accion.length < 3) return null;
    let tipo, disp = "";
    if (/cargar|cargador/.test(v) || /^(?:a cargar|el cargador|cargar)/.test(obj)) tipo = /desconect|quite/.test(v) ? "carga_off" : "carga_on";
    else if (/^(?:conect|me conecte)/.test(v)) { tipo = "bt_on"; disp = obj; }
    else if (/^desconect/.test(v)) { tipo = "bt_off"; disp = obj; }
    else if (/^lleg/.test(v)) { tipo = "lugar_in"; disp = obj; }
    else { tipo = "lugar_out"; disp = obj; }
    if (tipo.startsWith("carga") && /celular|telefono|cargar|cargador/.test(obj + v)) disp = "";
    disp = disp.replace(/^(?:al?\s+)?(?:bluetooth|el bluetooth)\s*(?:del?\s+)?/, "").replace(/^(?:del?\s+)/, "").trim();
    return { disp: tipo, dispositivo: disp, accion };
  }
  const DISP_TXT = { bt_on: "al conectar", bt_off: "al desconectar", carga_on: "al poner a cargar el celular", carga_off: "al quitar el cargador", lugar_in: "al llegar a", lugar_out: "al salir de" };
  const dispTexto = (r) => DISP_TXT[r.tipo] + (r.tipo.startsWith("carga") ? "" : " " + (r.dispositivo || (r.tipo.startsWith("bt") ? "cualquier Bluetooth" : "")));

  // ======================================================================== MODO CONDUCCIÓN, «¿QUÉ ME PERDÍ?», EMERGENCIA, INTÉRPRETE, NOTICIAS
  function variosIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:modo (?:conduccion|carro|manejo)|activa (?:el )?modo (?:conduccion|carro)|voy a (?:manejar|conducir)|estoy (?:manejando|conduciendo))$/.test(t)) return { v: "conduccion", on: true };
    if (/^(?:(?:quita|desactiva|apaga|termina)\s+(?:el\s+)?modo (?:conduccion|carro|manejo)|ya (?:llegue|deje de manejar|estacione))$/.test(t)) return { v: "conduccion", on: false };
    if (/^(?:que me perdi|que notificaciones tengo|que hay de nuevo en el celular|resumen de (?:mis )?notificaciones|mis notificaciones|que paso mientras no estaba)$/.test(t)) return { v: "perdi" };
    if (/^(?:emergencia|es una emergencia|ayuda emergencia|auxilio|necesito ayuda urgente|modo emergencia|sos)$/.test(t)) return { v: "emergencia" };
    if ((m = t.match(/^(?:modo interprete|interprete|traduce (?:la|esta) conversacion|se mi interprete|traductor en vivo|modo traductor)(?:\s+(?:con|en|al|a|de)\s+(?:el\s+)?([a-z]+))?$/))) return { v: "interprete", idioma: m[1] || "ingles" };
    if ((m = t.match(/^(?:(?:dame|dime|leeme|lee|cuales son|que hay de|cuentame)\s+)?(?:las\s+)?(?:noticias|titulares|ultimas noticias)(?:\s+(?:de hoy|del dia))?(?:\s+(?:de|sobre|del|de la)\s+(.+?))?(?:\s+de hoy)?$/)) || (m = t.match(/^que (?:hay de nuevo|ha pasado|esta pasando) (?:con|sobre|en) (.+)$/))) return { v: "noticias", tema: m[1] || "" };
    if ((m = t.match(/^(?:leeme|lee(?: en voz alta)?|leer en voz alta)\s+(?:el\s+)?(?:ultimo\s+)?(?:documento|material|archivo|nota)(?:\s+(?:de|sobre|del|llamado)\s+(.+))?$/))) return { v: "leer_doc", q: m[1] || "" };
    const url = String(text || "").match(/https?:\/\/\S+/);
    if (url && /^(?:leeme|lee(?: en voz alta)?|resume(?:me)?)\b/.test(t)) return { v: "leer_url", url: url[0], resumir: /^resume/.test(t) };
    if ((m = t.match(/^(?:segun mis notas|busca en mis notas|en mis notas|que (?:decia|dice|dije|anote|escribi|apunte)\s+(?:en\s+)?(?:el|la|los|las|mi|mis)\s+(?:documento|documentos|nota|notas|acta|actas|apuntes|material|contrato|archivo))\s*,?\s*(.+)$/))) return { v: "notas", q: m[1] };
    if ((m = t.match(/^(?:planea|planeame|planifica|arma|organiza)(?:me)?\s+(?:mi|la)\s+semana(?:\s+de\s+clases?)?(?:\s+(?:de|para)\s+(\S+))?(?:\s+(?:sobre|con|de)\s+(.+))?$/)) || (m = t.match(/^planeador semanal(?:\s+(?:de|para)\s+(\S+))?(?:\s+(?:sobre|de)\s+(.+))?$/))) return { v: "semana", curso: m[1] || "", tema: m[2] || "" };
    return null;
  }
  const IDIOMAS = { ingles: "inglés", frances: "francés", portugues: "portugués", aleman: "alemán", italiano: "italiano", chino: "chino mandarín", japones: "japonés", coreano: "coreano", ruso: "ruso", arabe: "árabe", holandes: "neerlandés" };
  const idiomaNombre = (k) => IDIOMAS[norm(k)] || k;
  function interpretePrompt(idioma) {
    const i = idiomaNombre(idioma);
    return `Eres un intérprete en vivo entre español y ${i}. Cuando oigas español, repítelo en ${i}; cuando oigas ${i}, repítelo en español. ` +
      "Traduce fiel, natural y completo, sin agregar comentarios, saludos ni explicaciones, y sin responder tú a lo que dicen: solo traduces. Si no entiendes, pide en los dos idiomas que lo repitan.";
  }
  /** Agrupa las notificaciones por app: [{app, n, de:[…]}] */
  function perdi(lista) {
    const by = {};
    (lista || []).forEach((x) => { const a = by[x.app] = by[x.app] || { app: x.app, n: 0, de: [] }; a.n++; if (x.titulo && !a.de.includes(x.titulo) && a.de.length < 4) a.de.push(x.titulo); });
    return Object.values(by).sort((a, b) => b.n - a.n);
  }
  function perdiTexto(g) {
    const total = g.reduce((s, x) => s + x.n, 0);
    if (!total) return "No tienes notificaciones pendientes. 👍";
    return `Tienes ${total} notificaci${total === 1 ? "ón" : "ones"}: ` + g.slice(0, 6).map((x) => `${x.app} ${x.n}${x.de.length ? " (" + x.de.slice(0, 3).join(", ") + ")" : ""}`).join("; ") + ".";
  }
  function emergenciaMsg(nombre, lat, lng, prec) {
    return `🚨 ${nombre || "Tu contacto"} necesita ayuda. Ubicación: https://maps.google.com/?q=${(+lat).toFixed(6)},${(+lng).toFixed(6)}` + (prec ? ` (±${Math.round(prec)} m)` : "") + ". Mensaje enviado con Jarvis.";
  }
  /** «Mamá: 3001234567» por línea → [{nombre, numero}] */
  function confianza(txt) {
    return String(txt || "").split(/\n/).map((l) => { const m = l.match(/^\s*(.+?)\s*[:\-–]\s*(\+?[\d\s]{7,})\s*$/) || l.match(/^\s*(\+?[\d\s]{7,})\s*$/); return m ? (m[2] ? { nombre: m[1], numero: m[2].replace(/\s/g, "") } : { nombre: "", numero: m[1].replace(/\s/g, "") }) : null; }).filter(Boolean).slice(0, 5);
  }
  const newsUrl = (tema) => tema ? `https://news.google.com/rss/search?q=${encodeURIComponent(tema + " when:2d")}&hl=es-419&gl=CO&ceid=CO:es-419` : "https://news.google.com/rss?hl=es-419&gl=CO&ceid=CO:es-419";
  /** RSS → [{titulo, fuente, link, t}] (sin DOM, para que también corra en node) */
  function rss(xml, max) {
    const out = [];
    const dec = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/<[^>]+>/g, "").trim();
    String(xml || "").replace(/<item>([\s\S]*?)<\/item>/g, (_, it) => {
      const g = (tag) => { const m = it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)); return m ? dec(m[1]) : ""; };
      let titulo = g("title"), fuente = g("source");
      if (fuente && titulo.endsWith(" - " + fuente)) titulo = titulo.slice(0, -(fuente.length + 3));
      if (titulo) out.push({ titulo, fuente, link: g("link"), t: Date.parse(g("pubDate")) || 0 });
      return "";
    });
    return out.slice(0, max || 8);
  }

  // ======================================================================== LEER EN VOZ ALTA Y PREGUNTARLE A TUS NOTAS
  /** Texto legible de una página (HTML): el artículo o los párrafos más largos. */
  function legible(html) {
    let h = String(html || "").replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, " ");
    const tm = h.match(/<title[^>]*>([\s\S]*?)<\/title>/i), titulo = tm ? tm[1].replace(/\s+/g, " ").trim() : "";
    const art = h.match(/<article[\s\S]*?<\/article>/i); if (art) h = art[0];
    const ps = [];
    h.replace(/<(p|h1|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi, (_, tag, x) => { const s = x.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim(); if (s.length > (tag === "p" ? 40 : 5)) ps.push(s); return ""; });
    return { titulo: titulo.replace(/&amp;/g, "&"), texto: ps.join("\n\n").slice(0, 40000) };
  }
  /** Parte un texto largo en trozos para leerlo en voz alta (por párrafos y frases, de ~300 caracteres). */
  function trozos(texto, max) {
    max = max || 320;
    const out = [];
    String(texto || "").replace(/[#*_>`|]/g, " ").split(/\n{2,}|\n(?=[-•\d])/).forEach((p) => {
      p = p.replace(/\s+/g, " ").trim(); if (!p) return;
      let cur = "";
      p.split(/(?<=[.!?;:])\s+/).forEach((f) => { if ((cur + " " + f).length > max && cur) { out.push(cur.trim()); cur = f; } else cur += " " + f; });
      if (cur.trim()) out.push(cur.trim());
    });
    return out;
  }
  const STOP = new Set("el la los las un una unos unas de del al a en y o que se lo le les mi mis tu tus su sus por para con sin sobre es son fue era como mas pero si no ya hay muy me te nos este esta estos estas ese esa eso".split(" "));
  /** Los trozos de tus notas que más tienen que ver con la pregunta: [{fuente, texto, s}] */
  function rank(fuentes, q, max) {
    const qs = norm(q).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
    if (!qs.length) return [];
    const out = [];
    (fuentes || []).forEach((f) => {
      trozos(f.texto, 700).forEach((tz) => {
        const t = norm(tz); let s = 0;
        qs.forEach((w) => { const k = w.length > 5 ? w.slice(0, w.length - 2) : w; if (t.includes(k)) s += 1 + Math.min(2, t.split(k).length - 2) * 0.3; });
        if (norm(f.titulo || "").split(" ").some((w) => qs.includes(w))) s += 0.8;
        if (s > 0) out.push({ fuente: f.titulo || f.tipo || "nota", texto: tz, s: s + (f.t ? Math.max(0, 0.3 - (Date.now() - f.t) / 864e5 / 365) : 0) });
      });
    });
    return out.sort((a, b) => b.s - a.s).slice(0, max || 6);
  }

  // ======================================================================== TEMPORIZADORES CON NOMBRE
  /** «pon 10 minutos para el arroz», «temporizador de 25 minutos para el horno», «¿cuánto le falta al arroz?», «cancela el del arroz» */
  function timerIntent(text) {
    const t = lead(norm(text));
    let m;
    const n = (s) => /^\d+$/.test(s) ? +s : palabras(s);
    if ((m = t.match(new RegExp(`^(?:pon|ponme|programa|inicia|activa|cuenta)(?:\\s+un)?(?:\\s+temporizador(?:\\s+de)?)?\\s+(\\d+|(?:(?:${NUMW})\\s?)+?)\\s*(horas?|minutos?|segundos?|min)(?:\\s+y\\s+(\\d+|media|(?:(?:${NUMW})\\s?)+?)\\s*(minutos?|segundos?)?)?\\s+(?:para|del|de la|de los|al|a la)\\s+(?:el |la |los |las )?(.+)$`)))) {
      const a = n(m[1].trim()); if (!a) return null;
      let ms = a * (/^h/.test(m[2]) ? 3600e3 : /^s/.test(m[2]) ? 1000 : 60e3);
      if (m[3]) ms += m[3] === "media" ? (/^h/.test(m[2]) ? 1800e3 : 30e3) : (n(m[3].trim()) || 0) * (/^s/.test(m[4] || "") ? 1000 : 60e3);
      return { tn: "add", ms, nombre: m[5].replace(/\s+por favor$/, "").slice(0, 30) };
    }
    if ((m = t.match(/^cuanto (?:le\s+)?falta\s+(?:al|a la|a los|para el|para la|para|del|de la)\s+(.+)$/))) return { tn: "ver", nombre: m[1] };
    if ((m = t.match(/^(?:cancela|quita|para|deten|apaga)\s+(?:el\s+)?(?:temporizador\s+)?(?:del|de la|de los|para el|para la|de)\s+(.+)$/))) return { tn: "quitar", nombre: m[1] };
    if (/^(?:mis temporizadores|que temporizadores tengo|temporizadores)$/.test(t)) return { tn: "lista" };
    return null;
  }
  function falta(ms) {
    const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60;
    return h ? `${h} h ${mi} min` : mi ? `${mi} min${se && mi < 5 ? " " + se + " s" : ""}` : `${se} s`;
  }

  // ======================================================================== PLANEADOR SEMANAL
  const NOMDIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  /** Las clases de la semana (de un curso o todas), en orden. horario: lo de L3.parseSchedule. */
  function semana(horario, curso) {
    const c = norm(curso || "").replace(/\s/g, "");
    return (horario || []).filter((x) => x.dia >= 1 && x.dia <= 6 && (!c || norm(x.que).replace(/\s/g, "").includes(c))).sort((a, b) => a.dia - b.dia || a.ini - b.ini)
      .map((x) => ({ dia: NOMDIA[x.dia], que: x.que, ini: x.ini, fin: x.fin, min: x.fin - x.ini }));
  }
  function semanaPrompt(clases, tema, asignatura) {
    return `Haz la planeación de mi semana de clases${asignatura ? " de " + asignatura : ""}${tema ? ", sobre «" + tema + "»" : ""}. Estas son mis clases de la semana:\n` +
      clases.map((x) => `- ${x.dia}: ${x.que} (${x.min} minutos)`).join("\n") +
      "\n\nPara cada clase, en orden: una tabla markdown con columnas Día | Curso | Tema | Objetivo | Actividad principal | Evaluación / cierre. Que los temas avancen con lógica a lo largo de la semana en cada curso. " +
      "Después de la tabla, una lista corta de materiales que debo preparar. Sé concreto y realista para el tiempo de cada clase. No uses nombres de estudiantes.";
  }

  const API = { norm, palabras, monto, cop, categoria, catDe, gastoIntent, rango, resumen, alertaPresupuesto, banco, items, listaIntent, listaTexto, medIntent, horaDe, habitoIntent, racha,
    cumpleIntent, fechaCumple, proximos, feliz, dispIntent, dispTexto, variosIntent, idiomaNombre, interpretePrompt, perdi, perdiTexto, emergenciaMsg, confianza, newsUrl, rss,
    legible, trozos, rank, timerIntent, falta, semana, semanaPrompt };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL8 = API;
})(typeof window !== "undefined" ? window : globalThis);
