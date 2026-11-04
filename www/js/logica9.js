/* Jarvis para Android 3.10 · lógica pura (se prueba con node).
   ¿Dónde dejé el carro? · encontrar el celular · pagos y suscripciones · rutina de la noche · modo cocina ·
   «¿qué dice esta pantalla?» · Gmail · diario y ánimo · practicar idiomas · conversor (unidades, moneda, hora) ·
   casa inteligente (Home Assistant) · reportar un problema. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const NUM = { un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cien: 100, mil: 1000, medio: 0.5, media: 0.5 };
  const num = (s) => { s = String(s).trim(); if (/^\d+(?:[.,]\d+)?$/.test(s)) return +s.replace(",", "."); return NUM[norm(s)] != null ? NUM[norm(s)] : null; };

  // ======================================================================== CARRO Y CELULAR
  function carroIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:donde (?:deje|parquee|estacione|esta|quedo) (?:el|mi) (?:carro|auto|coche|moto|vehiculo)|donde parquee|donde estacione|llevame (?:a|al|hasta) (?:el|mi) (?:carro|auto|moto))$/.test(t)) return { carro: "ver" };
    if (/^(?:guarda|recuerda|anota)\s+(?:donde\s+)?(?:parquee|estacione|deje el carro|deje la moto)(?:\s+aqui)?$|^(?:parquee|estacione|deje el carro|deje la moto)\s+aqui$/.test(t)) return { carro: "guardar" };
    if ((m = t.match(/^(?:mi\s+(?:carro|auto|moto)\s+es\s+(?:el\s+)?(?:bluetooth\s+)?|el bluetooth de mi (?:carro|auto|moto) es\s+(?:el\s+)?)(.+)$/))) return { carro: "bt", nombre: m[1] };
    if (/^(?:activa|configura)\s+(?:encontrar|buscar)\s+(?:mi\s+)?celular|^encontrar (?:mi )?celular$/.test(t)) { const c = t.match(/\bclave\s+(\S+)/); return { buscar: "on", clave: c ? c[1] : "" }; }
    if (/^(?:desactiva|apaga)\s+(?:encontrar|buscar)\s+(?:mi\s+)?celular$/.test(t)) return { buscar: "off" };
    if (/^(?:prueba|probar)\s+(?:el\s+)?sonido\s+de\s+(?:encontrar|buscar)/.test(t)) return { buscar: "probar" };
    return null;
  }
  const caminar = (lat, lng) => `https://www.google.com/maps/dir/?api=1&destination=${(+lat).toFixed(6)},${(+lng).toFixed(6)}&travelmode=walking`;
  function haceCuanto(t, now) {
    const m = Math.round(((now || Date.now()) - t) / 60000);
    return m < 2 ? "hace un momento" : m < 60 ? `hace ${m} minutos` : m < 1440 ? `hace ${Math.round(m / 60)} hora${Math.round(m / 60) > 1 ? "s" : ""}` : `hace ${Math.round(m / 1440)} día${Math.round(m / 1440) > 1 ? "s" : ""}`;
  }
  function distancia(a, b) {
    const R = 6371e3, r = Math.PI / 180, dφ = (b.lat - a.lat) * r, dλ = (b.lng - a.lng) * r;
    const x = Math.sin(dφ / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dλ / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const metros = (d) => d < 1000 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1).replace(".", ",")} km`;

  // ======================================================================== PAGOS Y SUSCRIPCIONES
  function montoDe(s) { const L8 = root.JL8 || (typeof require !== "undefined" ? require("./logica8.js") : null); return L8 ? L8.monto(s) : null; }
  /** «la luz se paga el 15», «Netflix cada mes el 3 por 45 mil», «el arriendo se paga el 1 y cuesta 1 millón», «ya pagué la luz», «mis pagos» */
  function pagoIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(?:el |la |los |las |mi |el pago de(?:l| la)? |pago de(?:l| la)? )?(.+?)\s+(?:se paga|se vence|vence|llega|se cobra|cobran|lo pago|la pago|pago)\s+(?:el\s+|los\s+)?(\d{1,2})(?:\s+de\s+cada\s+mes|\s+de\s+cada mes|\s+cada\s+mes)?(?:.*?(?:por|cuesta|de|vale|son)\s+(.+))?$/)) ||
        (m = t.match(/^(.+?)\s+cada\s+mes\s+(?:el\s+)?(\d{1,2})(?:\s+(?:por|de|cuesta|vale)\s+(.+))?$/)) ||
        (m = t.match(/^(?:anota|agrega|guarda)\s+(?:un\s+)?pago\s+(?:de\s+|del\s+|de la\s+)?(.+?)\s+(?:el|los)\s+(\d{1,2})(?:\s+de cada mes)?(?:\s+(?:por|de)\s+(.+))?$/))) {
      const dia = +m[2]; if (dia < 1 || dia > 31) return null;
      const nombre = m[1].replace(/^(?:el|la|los|las|mi)\s+/, "").replace(/\s+(?:se|lo|la)$/, "").trim();
      if (!nombre || nombre.length > 40 || /^(?:cumpleanos|cumple)/.test(nombre)) return null;
      return { pago: "add", nombre, dia, monto: m[3] ? montoDe(m[3]) : null };
    }
    if ((m = t.match(/^ya\s+(?:pague|cancele|consigne)\s+(?:el |la |los |las |mi )?(.+)$/))) return { pago: "pagado", nombre: m[1] };
    if (/^(?:mis pagos|que pagos tengo|que tengo que pagar|pagos del mes|que me falta pagar|mis suscripciones|cuanto pago (?:al mes|cada mes|en suscripciones)(?: en suscripciones)?|cuanto pago de suscripciones)(?:\s+este mes)?$/.test(t)) return { pago: "ver" };
    if ((m = t.match(/^(?:borra|elimina|quita|cancela)\s+(?:el\s+)?pago\s+(?:de\s+|del\s+|de la\s+)?(.+)$/)) || (m = t.match(/^(?:cancele|ya no pago)\s+(?:la suscripcion de\s+)?(.+)$/))) return { pago: "borrar", nombre: m[1] };
    return null;
  }
  const ymd = (d) => d.getFullYear() * 100 + d.getMonth();
  /** El estado de cada pago este mes: [{…pago, vence (ms), pagado, en (días)}] ordenado por fecha. */
  function pagosEstado(pagos, now) {
    const hoy = new Date(now); hoy.setHours(0, 0, 0, 0);
    return (pagos || []).map((p) => {
      const ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      let v = new Date(hoy.getFullYear(), hoy.getMonth(), Math.min(p.dia, ult));
      const pagado = (p.pagos || []).some((t) => ymd(new Date(t)) === ymd(hoy));
      if (pagado && v < hoy) { const u2 = new Date(hoy.getFullYear(), hoy.getMonth() + 2, 0).getDate(); v = new Date(hoy.getFullYear(), hoy.getMonth() + 1, Math.min(p.dia, u2)); }
      return Object.assign({}, p, { vence: v.getTime(), pagado, en: Math.round((v - hoy) / 864e5) });
    }).sort((a, b) => a.vence - b.vence);
  }
  /** Los avisos programados: 2 días antes y el día (a las 8 a. m.), cada mes. → [{dia, nombre, antes}] */
  function pagosAvisos(pagos) {
    const out = [];
    (pagos || []).forEach((p) => { out.push({ dia: p.dia, nombre: p.nombre, antes: false }); if (p.dia > 2) out.push({ dia: p.dia - 2, nombre: p.nombre, antes: true }); });
    return out;
  }

  // ======================================================================== RUTINA DE LA NOCHE
  function nocheIntent(text) {
    const t = lead(norm(text));
    const m = t.match(/^(?:buenas noches|rutina de la noche|me voy a dormir|ya me voy a dormir|hora de dormir|modo noche|modo dormir)(?:\s*,?\s*(?:y\s+)?(?:despiertame|levantame|pon la alarma|ponme la alarma)\s+(?:a las|para las)\s+(\d{1,2})(?:[: ](\d{2})| y (media|cuarto))?(?:\s*(de la manana|am))?)?$/);
    if (!m) return null;
    let alarma = null;
    if (m[1]) { let h = +m[1], mi = m[2] ? +m[2] : m[3] === "media" ? 30 : m[3] === "cuarto" ? 15 : 0; if (h > 23 || mi > 59) return null; alarma = { h, m: mi }; }
    return { noche: true, alarma };
  }

  // ======================================================================== MODO COCINA
  function cocinaIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(?:modo cocina|cocinemos|vamos a cocinar|ayudame a (?:cocinar|preparar|hacer)|quiero (?:cocinar|preparar|hacer)|ensename a (?:cocinar|preparar|hacer)|dame la receta (?:de|del|de la)|receta (?:de|del|de la))\s*(?:un |una |el |la |unos |unas )?(.*?)(?:\s+paso a paso)?(?:\s+para\s+(\d+|dos|tres|cuatro|cinco|seis|ocho|diez)\s+personas?)?$/))) {
      if (/^(?:receta|dame la receta)/.test(t) && !/paso a paso|cocina/.test(t)) return null;          // «receta de…» sola la contesta la IA normal
      return { cocina: true, plato: m[1].trim(), porciones: m[2] ? num(m[2]) : null };
    }
    return null;
  }
  /** Mientras cocinas: «siguiente», «anterior», «repite», «ingredientes», «terminar», «¿cuánto falta?» */
  function cocinaCmd(text) {
    const t = lead(norm(text));
    if (/^(?:siguiente|sigue|siguiente paso|listo|ya|ya esta|hecho|continua|y ahora|que sigue|despues)$/.test(t)) return "siguiente";
    if (/^(?:anterior|atras|paso anterior|vuelve|devuelvete)$/.test(t)) return "anterior";
    if (/^(?:repite|otra vez|repitelo|que dijiste|como|no entendi)$/.test(t)) return "repite";
    if (/^(?:ingredientes|que necesito|los ingredientes|que lleva)$/.test(t)) return "ingredientes";
    if (/^(?:termina|terminar|salir|sal|termine|ya termine|cancela|acabe|fin)(?:\s+(?:de cocinar|el modo cocina|la receta))?$/.test(t)) return "terminar";
    if (/^(?:cuanto falta|cuanto le falta|cuanto tiempo falta)$/.test(t)) return "falta";
    return null;
  }
  function minutosDe(s) {
    const t = norm(s);
    const m = t.match(/(\d+(?:[.,]\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|quince|veinte|treinta|media)\s*(?:a\s+\d+\s*)?(hora|horas|minuto|minutos|min)\b/);
    if (!m) return null;
    const n = m[1] === "media" ? 0.5 : num(m[1]) || +m[1].replace(",", ".");
    return n ? Math.round(n * (/^h/.test(m[2]) ? 60 : 1)) : null;
  }
  function recetaClean(j) {
    if (!j || j.error) return { error: (j && j.error) || "No pude armar la receta." };
    const ing = (Array.isArray(j.ingredientes) ? j.ingredientes : []).map((x) => typeof x === "string" ? x : [x.cantidad, x.nombre].filter(Boolean).join(" ")).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);
    const pasos = (Array.isArray(j.pasos) ? j.pasos : []).map((p) => { const t = String(typeof p === "string" ? p : p.texto || p.paso || "").trim(); const mn = typeof p === "object" && +p.minutos > 0 ? Math.round(+p.minutos) : minutosDe(t); return { t, min: mn && mn <= 600 ? mn : null }; }).filter((p) => p.t).slice(0, 25);
    if (!pasos.length) return { error: "La receta no trajo pasos." };
    return { titulo: String(j.titulo || "Receta").slice(0, 80), porciones: +j.porciones || null, ingredientes: ing, pasos };
  }
  const recetaPrompt = (plato, porc) => `Dame una receta casera y realista de «${plato || "algo rico y fácil con lo que suele haber en casa"}»${porc ? ` para ${porc} personas` : ""}, en español de Colombia. ` +
    'Devuelve JSON: {"titulo":"","porciones":4,"ingredientes":["2 tazas de arroz", …],"pasos":[{"texto":"un paso corto y claro, de una o dos frases","minutos":número o null}]}. ' +
    "Cada paso es una sola acción que se pueda decir en voz alta; pon «minutos» solo si el paso es esperar o cocinar un tiempo. Máximo 14 pasos.";

  // ======================================================================== «¿QUÉ DICE ESTA PANTALLA?»
  function pantallaIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:que dice (?:esta|la) pantalla|resume(?:me)? (?:esto|esta pantalla|lo que estoy viendo|lo de la pantalla)|que estoy viendo|lee(?:me)? (?:la|esta) pantalla)$/.test(t)) return { pantalla: /^lee/.test(t) ? "leer" : "resumen" };
    if (/^(?:explicame (?:esto|esta pantalla|lo que estoy viendo)|que significa esto|no entiendo esto)$/.test(t)) return { pantalla: "explicar" };
    if ((m = t.match(/^(?:en|sobre) (?:esta|la) pantalla,?\s+(.+)$/))) return { pantalla: "pregunta", q: m[1] };
    if (/^(?:ayudame a responder (?:esto|este mensaje)|que le respondo)$/.test(t)) return { pantalla: "responder" };
    return null;
  }
  const PANT = { resumen: "Resume en pocas frases lo importante de esta pantalla.", explicar: "Explícame con palabras sencillas qué es esto y qué significa; si hay algo que deba hacer o tener en cuenta, dímelo.", responder: "Esto es un mensaje o conversación que estoy viendo. Propón 2 respuestas cortas y amables que yo pueda enviar.", leer: "" };
  /** Limpia el texto que copió Android (repetidos, botones sueltos) para no gastar de más. */
  function limpiarPantalla(t) {
    const vistos = new Set();
    return String(t || "").split("\n").map((x) => x.trim()).filter((x) => { const k = x.toLowerCase(); if (x.length < 2 || vistos.has(k)) return false; vistos.add(k); return !/^(?:\d{1,2}:\d{2}|atr[aá]s|men[uú]|buscar|m[aá]s opciones|navegar hacia arriba)$/i.test(x); }).join("\n").slice(0, 12000);
  }

  // ======================================================================== GMAIL
  function gmailIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:tengo (?:correos|emails|mails)(?: nuevos| importantes| sin leer)?|revisa (?:mi|el) (?:correo|gmail|email)|(?:que|cuales) correos tengo|hay correos nuevos|mis correos)$/.test(t)) return { gmail: "ver" };
    if ((m = t.match(/^resume(?:me)?\s+(?:mis|los)\s+(?:correos|emails|mails)(?:\s+(de hoy|de ayer|de la semana|sin leer|importantes))?$/))) return { gmail: "resumen", cuando: m[1] || "" };
    if ((m = t.match(/^(?:leeme|lee|abre)\s+(?:el\s+)?(?:ultimo\s+)?(?:correo|email|mail)(?:\s+(?:de|del)\s+(.+))?$/))) return { gmail: "leer", de: m[1] || "" };
    if ((m = String(text).match(/^\s*(?:jarvis[\s,]+)?resp[oó]nde(?:le)?\s+(?:al\s+)?(?:correo|email|mail)(?:\s+(?:de|del)\s+(.+?))?\s+(?:que|diciendo(?:le)? que)\s+(.+)$/i))) return { gmail: "responder", de: m[1] ? norm(m[1]) : "", texto: m[2].trim() };
    return null;
  }
  function gmailQuery(cuando) {
    return cuando === "de ayer" ? "in:inbox newer_than:2d older_than:1d" : cuando === "de la semana" ? "in:inbox newer_than:7d" : cuando === "importantes" ? "in:inbox is:important newer_than:3d" : cuando === "de hoy" ? "in:inbox newer_than:1d" : "in:inbox is:unread newer_than:7d";
  }
  function cabecera(msg, k) { const h = ((msg && msg.payload && msg.payload.headers) || []).find((x) => x.name.toLowerCase() === k.toLowerCase()); return h ? h.value : ""; }
  const quien = (from) => { const m = String(from || "").match(/^\s*"?([^"<]+?)"?\s*<([^>]+)>/); return m ? m[1].trim() : String(from || "").replace(/<.*>/, "").trim(); };
  function b64url(s) {
    const bytes = new TextEncoder().encode(s); let bin = ""; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return (typeof btoa !== "undefined" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function deB64url(s) {
    const bin = typeof atob !== "undefined" ? atob(String(s || "").replace(/-/g, "+").replace(/_/g, "/")) : Buffer.from(String(s || ""), "base64").toString("binary");
    const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(u);
  }
  /** El texto del correo (parte text/plain, o el HTML sin etiquetas). */
  function cuerpo(msg) {
    let plain = "", html = "";
    const walk = (p) => { if (!p) return; if (p.mimeType === "text/plain" && p.body && p.body.data && !plain) plain = deB64url(p.body.data); else if (p.mimeType === "text/html" && p.body && p.body.data && !html) html = deB64url(p.body.data); (p.parts || []).forEach(walk); };
    walk(msg && msg.payload);
    const t = plain || html.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/p>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    return t.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, 8000) || (msg && msg.snippet) || "";
  }
  /** El correo de respuesta (RFC 822 en base64url) para la API de Gmail. */
  function respuesta(msg, texto, yo) {
    const to = cabecera(msg, "Reply-To") || cabecera(msg, "From"), sub = cabecera(msg, "Subject"), id = cabecera(msg, "Message-ID");
    const enc = (s) => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + b64url(s).replace(/-/g, "+").replace(/_/g, "/") + "?=";
    const lines = [`To: ${to}`, yo ? `From: ${yo}` : "", `Subject: ${enc(/^re:/i.test(sub) ? sub : "Re: " + sub)}`, id ? `In-Reply-To: ${id}` : "", id ? `References: ${(cabecera(msg, "References") + " " + id).trim()}` : "",
      "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: 8bit", "", texto].filter((x, i) => x !== "" || i >= 7);
    return { raw: b64url(lines.join("\r\n")), threadId: msg.threadId };
  }

  // ======================================================================== DIARIO Y ÁNIMO
  function diarioIntent(text) {
    const raw = String(text || "").trim().replace(/^jarvis[\s,]+/i, "");
    const t = lead(norm(text));
    let m;
    if ((m = raw.match(/^(?:querido diario|diario personal|en mi diario|anota en mi diario(?: que)?|escribe en mi diario(?: que)?|mi diario)\s*[,:]?\s*(.{4,})$/i))) return { diario: "add", texto: m[1].trim() };
    if ((m = raw.match(/^(?:hoy|mi d[ií]a)\s+(?:fue|estuvo|ha sido|me fue)\s+(.{3,})$/i)) && !/\?$/.test(raw)) return { diario: "add", texto: raw };
    if ((m = t.match(/^como (?:he estado|me he sentido|ha estado mi animo|voy de animo)(?:\s+(esta semana|este mes|ultimamente))?$/))) return { diario: "ver", dias: m[1] === "este mes" ? 31 : 7 };
    if (/^(?:mi diario|leeme mi diario|que escribi en mi diario)$/.test(t)) return { diario: "ver", dias: 7 };
    if (/^(?:analiza|resume)\s+mi\s+(?:diario|semana|animo)$/.test(t)) return { diario: "analizar" };
    return null;
  }
  const POS = /\b(?:bien|bueno|buena|genial|excelente|feliz|contento|contenta|tranquil[oa]|alegre|chevere|bacano|increible|maravillos[oa]|logre|disfrute|agradecid[oa]|emocionad[oa]|relajad[oa]|orgullos[oa]|motivad[oa]|productivo|productiva)\b/g;
  const NEG = /\b(?:mal|malo|mala|triste|cansad[oa]|agotad[oa]|estresad[oa]|estres|ansios[oa]|ansiedad|preocupad[oa]|frustrad[oa]|enojad[oa]|bravo|brava|aburrid[oa]|horrible|terrible|pesimo|pesima|sol[oa]|enferm[oa]|dolor|llore|peleamos|discuti)\b/g;
  /** Ánimo de 1 a 5 a partir de lo que escribiste (en el celular, sin IA). */
  function animo(texto) {
    const t = norm(texto).replace(/\bno (?:estuvo |me fue |fue )?(?:tan )?(bien|bueno|buena)\b/g, "mal").replace(/\bno (?:estuvo |fue )?(?:tan )?(mal|malo|mala)\b/g, "bien");
    const p = (t.match(POS) || []).length, n = (t.match(NEG) || []).length;
    if (p === n) return 3;
    return Math.max(1, Math.min(5, 3 + (p > n ? Math.min(2, p - n) : -Math.min(2, n - p))));
  }
  const CARA = ["", "😞", "🙁", "😐", "🙂", "😄"];
  function animoResumen(entradas, now, dias) {
    const l = (entradas || []).filter((e) => (now || Date.now()) - e.t < dias * 864e5);
    if (!l.length) return null;
    const prom = l.reduce((s, e) => s + e.animo, 0) / l.length;
    const feos = l.filter((e) => e.animo <= 2).length, buenos = l.filter((e) => e.animo >= 4).length;
    return { n: l.length, prom: Math.round(prom * 10) / 10, cara: CARA[Math.round(prom)], buenos, feos };
  }

  // ======================================================================== PRACTICAR IDIOMAS
  const IDI = { ingles: "inglés", frances: "francés", portugues: "portugués", aleman: "alemán", italiano: "italiano", chino: "chino mandarín", japones: "japonés", coreano: "coreano" };
  function idiomaIntent(text) {
    const t = lead(norm(text));
    const m = t.match(/^(?:practiquemos|practicar|quiero practicar|vamos a practicar|clase de|ensename|hablemos en|ayudame a practicar|conversemos en)\s+(ingles|frances|portugues|aleman|italiano|chino|japones|coreano)(?:\s+(?:nivel\s+)?(basico|intermedio|avanzado|principiante))?$/);
    return m ? { idioma: m[1], nombre: IDI[m[1]], nivel: m[2] || "" } : null;
  }
  function tutorPrompt(nombre, nivel) {
    return `Eres un profesor de ${nombre} paciente y alegre, en una conversación de voz en vivo con un estudiante hispanohablante de Colombia${nivel ? " de nivel " + nivel : ""}. ` +
      `Conversa en ${nombre} con frases cortas y naturales, de un tema cotidiano a la vez, y haz una pregunta al final de cada turno para que el estudiante hable. ` +
      `Si el estudiante comete un error, corrígelo con amabilidad: di la forma correcta y explícalo en una frase en español. Si no entiende, repite más despacio y más sencillo, y si hace falta tradúcelo. ` +
      "Cada tanto propón un mini ejercicio (repetir una frase, decir una palabra, armar una oración). Celebra los avances.";
  }

  // ======================================================================== CONVERSOR
  const U = {
    m: ["longitud", 1], metro: ["longitud", 1], metros: ["longitud", 1], km: ["longitud", 1000], kilometro: ["longitud", 1000], kilometros: ["longitud", 1000], cm: ["longitud", 0.01], centimetro: ["longitud", 0.01], centimetros: ["longitud", 0.01],
    mm: ["longitud", 0.001], milimetros: ["longitud", 0.001], milla: ["longitud", 1609.344], millas: ["longitud", 1609.344], pie: ["longitud", 0.3048], pies: ["longitud", 0.3048], pulgada: ["longitud", 0.0254], pulgadas: ["longitud", 0.0254], yarda: ["longitud", 0.9144], yardas: ["longitud", 0.9144],
    kg: ["masa", 1], kilo: ["masa", 1], kilos: ["masa", 1], kilogramo: ["masa", 1], kilogramos: ["masa", 1], g: ["masa", 0.001], gramo: ["masa", 0.001], gramos: ["masa", 0.001], libra: ["masa", 0.5], libras: ["masa", 0.5], lb: ["masa", 0.45359237],
    onza: ["masa", 0.028349523], onzas: ["masa", 0.028349523], arroba: ["masa", 12.5], arrobas: ["masa", 12.5], tonelada: ["masa", 1000], toneladas: ["masa", 1000],
    l: ["volumen", 1], litro: ["volumen", 1], litros: ["volumen", 1], ml: ["volumen", 0.001], mililitros: ["volumen", 0.001], galon: ["volumen", 3.785411784], galones: ["volumen", 3.785411784], taza: ["volumen", 0.24], tazas: ["volumen", 0.24], cucharada: ["volumen", 0.015], cucharadas: ["volumen", 0.015], cucharadita: ["volumen", 0.005], cucharaditas: ["volumen", 0.005],
    "km/h": ["velocidad", 1 / 3.6], "kilometros por hora": ["velocidad", 1 / 3.6], "millas por hora": ["velocidad", 0.44704], mph: ["velocidad", 0.44704], "m/s": ["velocidad", 1], nudos: ["velocidad", 0.514444],
    m2: ["area", 1], "metros cuadrados": ["area", 1], hectarea: ["area", 1e4], hectareas: ["area", 1e4], fanegada: ["area", 6400], fanegadas: ["area", 6400], acre: ["area", 4046.856], acres: ["area", 4046.856],
    celsius: ["temp", "c"], centigrados: ["temp", "c"], grados: ["temp", "c"], fahrenheit: ["temp", "f"], kelvin: ["temp", "k"],
  };
  // Colombia: la libra es de 500 g (así se compra); «lb» es la libra inglesa.
  const MONEDAS = { dolar: "USD", dolares: "USD", usd: "USD", euro: "EUR", euros: "EUR", eur: "EUR", peso: "COP", pesos: "COP", cop: "COP", "pesos colombianos": "COP", "pesos mexicanos": "MXN", "pesos chilenos": "CLP", "pesos argentinos": "ARS",
    libra: "GBP", "libras esterlinas": "GBP", yen: "JPY", yenes: "JPY", real: "BRL", reales: "BRL", sol: "PEN", soles: "PEN", bolivar: "VES", bolivares: "VES", "dolares canadienses": "CAD", yuan: "CNY", yuanes: "CNY", franco: "CHF", francos: "CHF" };
  const UNID_RE = Object.keys(U).sort((a, b) => b.length - a.length).map((k) => k.replace(/\//g, "\\/")).join("|");
  const MON_RE = Object.keys(MONEDAS).sort((a, b) => b.length - a.length).join("|");
  function conversorIntent(text) {
    const t = lead(norm(text)).replace(/^(?:cuanto|cuantos|cuantas)\s+(?:son|es|serian|equivalen|hay en)\s+/, "").replace(/^(?:convierte|convierteme|pasa|pasame|cuanto es)\s+/, "");
    let m;
    const n = `(\\d+(?:[.,]\\d+)?|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|veinte|cien|mil|medio|media)`;
    if ((m = t.match(new RegExp(`^${n}\\s*(?:mil\\s+)?(${MON_RE})(?:\\s+(?:a|en)\\s+(${MON_RE}))?$`)))) {
      let a = num(m[1]); if (a == null) return null; if (/\bmil\s/.test(t.slice(m[1].length, m[1].length + 6))) a *= 1000;
      const de = MONEDAS[m[2]], a2 = m[3] ? MONEDAS[m[3]] : de === "COP" ? "USD" : "COP";
      return de === a2 ? null : { conv: "moneda", n: a, de, a: a2 };
    }
    if ((m = t.match(new RegExp(`^${n}\\s*(${UNID_RE})\\s+(?:a|en)\\s+(${UNID_RE})$`)))) {
      const a = num(m[1]), u1 = U[m[2]], u2 = U[m[3]];
      if (a == null || !u1 || !u2 || u1[0] !== u2[0]) return null;
      return { conv: "unidad", n: a, de: m[2], a: m[3] };
    }
    if ((m = lead(norm(text)).match(/^(?:que hora es|que horas son|la hora)\s+en\s+(.+)$/))) return { conv: "hora", lugar: m[1] };
    if ((m = lead(norm(text)).match(/^(?:cual es la )?diferencia (?:de|horaria) (?:de hora )?con\s+(.+)$/))) return { conv: "hora", lugar: m[1] };
    return null;
  }
  function convertir(n, de, a) {
    const u1 = U[de], u2 = U[a];
    if (u1[0] === "temp") {
      const c = u1[1] === "c" ? n : u1[1] === "f" ? (n - 32) * 5 / 9 : n - 273.15;
      return u2[1] === "c" ? c : u2[1] === "f" ? c * 9 / 5 + 32 : c + 273.15;
    }
    return n * u1[1] / u2[1];
  }
  const redondo = (x) => { const a = Math.abs(x); const d = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3; return (+x.toFixed(d)).toLocaleString("es-CO", { maximumFractionDigits: d }); };
  const ZONAS = { madrid: "Europe/Madrid", espana: "Europe/Madrid", barcelona: "Europe/Madrid", londres: "Europe/London", paris: "Europe/Paris", francia: "Europe/Paris", roma: "Europe/Rome", italia: "Europe/Rome", berlin: "Europe/Berlin", alemania: "Europe/Berlin",
    "nueva york": "America/New_York", miami: "America/New_York", washington: "America/New_York", "los angeles": "America/Los_Angeles", "san francisco": "America/Los_Angeles", chicago: "America/Chicago", "ciudad de mexico": "America/Mexico_City", mexico: "America/Mexico_City",
    bogota: "America/Bogota", colombia: "America/Bogota", lima: "America/Lima", peru: "America/Lima", quito: "America/Guayaquil", ecuador: "America/Guayaquil", caracas: "America/Caracas", venezuela: "America/Caracas", santiago: "America/Santiago", chile: "America/Santiago",
    "buenos aires": "America/Argentina/Buenos_Aires", argentina: "America/Argentina/Buenos_Aires", "sao paulo": "America/Sao_Paulo", brasil: "America/Sao_Paulo", panama: "America/Panama", "santo domingo": "America/Santo_Domingo", "la habana": "America/Havana", cuba: "America/Havana",
    tokio: "Asia/Tokyo", japon: "Asia/Tokyo", pekin: "Asia/Shanghai", china: "Asia/Shanghai", shanghai: "Asia/Shanghai", "hong kong": "Asia/Hong_Kong", seul: "Asia/Seoul", corea: "Asia/Seoul", dubai: "Asia/Dubai", india: "Asia/Kolkata", "nueva delhi": "Asia/Kolkata",
    sidney: "Australia/Sydney", sydney: "Australia/Sydney", australia: "Australia/Sydney", moscu: "Europe/Moscow", rusia: "Europe/Moscow", toronto: "America/Toronto", canada: "America/Toronto", lisboa: "Europe/Lisbon", portugal: "Europe/Lisbon", amsterdam: "Europe/Amsterdam" };
  function zona(lugar) { const k = norm(lugar).replace(/^(?:el|la|los)\s+/, ""); return ZONAS[k] || Object.entries(ZONAS).find(([c]) => k.includes(c))?.[1] || null; }
  function horaEn(tz, now) {
    const d = new Date(now || Date.now());
    const f = new Intl.DateTimeFormat("es-CO", { timeZone: tz, hour: "numeric", minute: "2-digit", weekday: "long" }).format(d);
    const off = (z) => { const p = new Intl.DateTimeFormat("en-US", { timeZone: z, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {}); return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - d.getTime()) / 3600e3; };
    const dif = Math.round((off(tz) - off("America/Bogota")) * 2) / 2;
    return { texto: f, dif };
  }

  // ======================================================================== CASA INTELIGENTE (Home Assistant)
  function casaIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(prende|prendeme|enciende|enciendeme|activa|abre|apaga|apagame|desactiva|cierra)\s+(?:el |la |los |las |mi |mis )?(.+)$/))) {
      const on = /^(?:prende|enciende|activa|abre)/.test(m[1]);
      const obj = m[2].replace(/\s+(?:por favor|ya)$/, "");
      if (/^(?:linterna|flash|modo |wifi|bluetooth|datos|alarma|temporizador|burbuja|microfono|camara|pantalla|celular|telefono|musica|radio)/.test(obj)) return null;
      return { casa: on ? "on" : "off", obj, verbo: m[1] };
    }
    if ((m = t.match(/^(?:esta|estan)\s+(?:prendida|prendido|encendida|encendido|apagada|apagado|abierta|abierto|cerrada|cerrado)s?\s+(?:el |la |los |las )?(.+)$/))) return { casa: "estado", obj: m[1] };
    if ((m = t.match(/^(?:pon|sube|baja)\s+(?:el |la )?(?:aire|termostato|calefaccion)(?:\s+(?:a|en))?\s+(\d{2})\s*(?:grados)?$/))) return { casa: "temp", obj: "aire", grados: +m[1] };
    return null;
  }
  /** Busca la entidad de Home Assistant que más se parece a lo que dijiste («la luz de la sala» → light.sala). */
  function entidad(estados, obj) {
    const q = norm(obj).replace(/^(?:luz|luces|lampara|bombillo|foco)\s+(?:de\s+(?:la\s+|el\s+)?|del\s+)?/, (x) => x.startsWith("lu") || x.startsWith("la") || x.startsWith("bo") || x.startsWith("fo") ? "luz " : "");
    const ws = q.split(" ").filter((w) => w.length > 2 && !["del", "las", "los", "luz", "luces"].includes(w));
    const esLuz = /\b(?:luz|luces|lampara|bombillo|foco)\b/.test(norm(obj));
    let best = null, bs = 0;
    (estados || []).forEach((e) => {
      const dom = e.entity_id.split(".")[0];
      if (!/^(?:light|switch|fan|cover|climate|media_player|lock|scene|script|input_boolean|vacuum|humidifier)$/.test(dom)) return;
      const n = norm((e.attributes && e.attributes.friendly_name) || e.entity_id.split(".")[1].replace(/_/g, " "));
      let s = ws.filter((w) => n.includes(w) || n.includes(w.slice(0, -1))).length / Math.max(1, ws.length);
      if (norm(obj) === n) s = 2;
      if (esLuz && dom === "light") s += 0.3;
      if (s > bs) { bs = s; best = e; }
    });
    return bs >= 0.5 ? best : null;
  }
  function servicio(e, accion) {
    const dom = e.entity_id.split(".")[0];
    if (dom === "cover") return [dom, accion === "on" ? "open_cover" : "close_cover"];
    if (dom === "lock") return [dom, accion === "on" ? "unlock" : "lock"];
    if (dom === "scene" || dom === "script") return [dom, "turn_on"];
    if (dom === "vacuum") return [dom, accion === "on" ? "start" : "return_to_base"];
    return [dom, accion === "on" ? "turn_on" : "turn_off"];
  }

  // ======================================================================== REPORTAR UN PROBLEMA
  /** Quita datos personales de un texto de error: correos, teléfonos, números largos, claves y nombres conocidos. */
  function limpiar(s, nombres) {
    let t = String(s || "").replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "‹correo›").replace(/AIza[\w-]{10,}|sk-[\w-]{10,}|gsk_[\w-]{10,}|Bearer\s+[\w.-]+/g, "‹clave›")
      .replace(/\+?\d[\d\s-]{8,}\d/g, "‹número›").replace(/key=[^&\s]+/g, "key=‹clave›");
    (nombres || []).filter((n) => n && n.length > 3).forEach((n) => { t = t.split(n).join("‹nombre›"); });
    return t.slice(0, 600);
  }
  function reporte(info) {
    const l = [];
    l.push(`Jarvis ${info.version} · ${info.fecha}`);
    l.push(`Celular: ${info.ua}`);
    l.push(`IA: ${info.proveedor}${info.respaldo ? " (respaldo: " + info.respaldo + ")" : ""} · velocidad media ${info.ms ? (info.ms / 1000).toFixed(1) + " s" : "—"}`);
    l.push(`Prendido: ${(info.prendido || []).join(", ") || "—"}`);
    l.push(`Batería: ${info.bateria || "—"} · conexión: ${info.red || "—"}`);
    if (info.nota) l.push("", "Lo que pasó (según tú): " + info.nota);
    l.push("", `Errores recientes (${(info.errores || []).length}):`);
    (info.errores || []).slice(-40).forEach((e) => l.push(`- ${new Date(e.t).toISOString().slice(5, 19).replace("T", " ")} ${e.m}`));
    return l.join("\n");
  }

  const API = { norm, num, carroIntent, caminar, haceCuanto, distancia, metros, pagoIntent, pagosEstado, pagosAvisos, nocheIntent, cocinaIntent, cocinaCmd, minutosDe, recetaClean, recetaPrompt,
    pantallaIntent, PANT, limpiarPantalla, gmailIntent, gmailQuery, cabecera, quien, b64url, deB64url, cuerpo, respuesta, diarioIntent, animo, animoResumen, CARA, idiomaIntent, tutorPrompt,
    conversorIntent, convertir, redondo, MONEDAS, zona, horaEn, casaIntent, entidad, servicio, limpiar, reporte };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL9 = API;
})(typeof window !== "undefined" ? window : globalThis);
