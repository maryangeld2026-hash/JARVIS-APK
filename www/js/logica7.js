/* Jarvis para Android 3.8 · lógica pura (se prueba con node): asistente general.
   · Órdenes y recuerdos que la IA escribe al final de su respuesta: <<orden: …>> y <<recordar: …>>
   · Corrección de lo que oyó el micrófono con tu vocabulario (contactos, cursos, estudiantes, tus palabras)
   · Órdenes programadas («cada lunes a las 6 dime…»), habilidades propias («cuando diga X, haz…»)
   · Clima (Open-Meteo, sin clave), conversaciones, uso de la IA, personalidad. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"“”]/g, " ").replace(/\s+/g, " ").trim();

  // ======================================================================== ETIQUETAS DE LA IA
  const TAG = /<<\s*(orden|recordar)\s*:\s*([^>]*?)\s*>>/gi;
  /** Lo que se muestra y se dice: sin etiquetas completas ni una etiqueta a medio llegar al final. */
  function visible(t) {
    let s = String(t || "").replace(TAG, "");
    const k = s.lastIndexOf("<<");
    if (k >= 0 && s.indexOf(">>", k) < 0) s = s.slice(0, k);
    else if (/<$/.test(s)) s = s.slice(0, -1);
    return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd();
  }
  function tags(t) {
    const out = { ordenes: [], recordar: [] };
    String(t || "").replace(TAG, (_, k, v) => { v = v.trim(); if (v) (k.toLowerCase() === "orden" ? out.ordenes : out.recordar).push(v); return ""; });
    out.ordenes = out.ordenes.slice(0, 5); out.recordar = out.recordar.slice(0, 3);
    return out;
  }
  /** ¿Esta orden la puede hacer la app sin volver a preguntarle a la IA? (lo decide quien la ejecuta) — aquí solo se filtra lo peligroso. */
  function ordenSegura(o) {
    const t = norm(o);
    if (t.length < 3 || t.length > 220) return false;
    if (/\b(?:borra|elimina|restaura|formatea|desinstala)\b/.test(t)) return false;      // nada que borre datos lo pide la IA por su cuenta
    return true;
  }
  /** Un recuerdo es útil si es sobre la persona y no lleva datos sensibles. */
  function recuerdoOk(r, nombres) {
    const t = norm(r);
    if (t.length < 6 || t.length > 200) return false;
    if (/\b(?:clave|contrasena|password|pin|tarjeta|cvv|cuenta bancaria)\b/.test(t)) return false;
    if (/\d{6,}/.test(t.replace(/\s/g, ""))) return false;
    return !(nombres || []).some((n) => n && norm(n).length > 3 && t.includes(norm(n)));
  }
  function memDup(lista, texto) {
    const t = norm(texto);
    return (lista || []).some((m) => { const u = norm(m.texto || m); return u === t || (u.length > 12 && (u.includes(t) || t.includes(u))); });
  }

  // ======================================================================== CORRECCIÓN DE LO QUE SE OYÓ
  function lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const sim = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
  /** Cómo suena (español): b/v, s/z/c, y/ll, sin h… para que «vancolombia» encuentre «Bancolombia». */
  const fon = (s) => String(s).replace(/h/g, "").replace(/v/g, "b").replace(/z/g, "s").replace(/c([ei])/g, "s$1").replace(/qu/g, "k").replace(/c/g, "k").replace(/ll/g, "y").replace(/(.)\1/g, "$1");
  const NUM = { uno: 1, un: 1, primero: 1, dos: 2, segundo: 2, tres: 3, tercero: 3, cuatro: 4, cuarto: 4, cinco: 5, quinto: 5, seis: 6, sexto: 6, siete: 7, septimo: 7, ocho: 8, octavo: 8,
    nueve: 9, noveno: 9, diez: 10, decimo: 10, once: 11, undecimo: 11, doce: 12 };
  /** «siete a», «séptimo b», «7 a» → el curso que exista («7A»). */
  function cursos(text, nombres) {
    const set = new Map((nombres || []).map((c) => [norm(c).replace(/[\s°º-]/g, ""), c]));
    if (!set.size) return text;
    return text.replace(/\b(\d{1,2}|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|primero|segundo|tercero|cuarto|quinto|sexto|s[eé]ptimo|octavo|noveno|d[eé]cimo|und[eé]cimo)\s*(?:°|º|grado\s+)?\s*([a-e]|\d{1,2})\b/gi, (all, n, l) => {
      const k = norm(n), num = /^\d+$/.test(k) ? +k : NUM[k];
      if (!num) return all;
      const key = String(num) + norm(l);
      return set.has(key) ? set.get(key) : all;
    });
  }
  /** Reemplaza lo que el reconocedor oyó parecido a una palabra de tu vocabulario (nombres de varias palabras o palabras propias). */
  function corregir(text, vocab, cursosLista) {
    let out = cursos(String(text || ""), cursosLista);
    const items = [...new Set((vocab || []).map((v) => String(v || "").trim()).filter((v) => v.length >= 4))]
      .map((v) => ({ v, n: norm(v), w: norm(v).split(" ").length }))
      .filter((x) => x.w >= 2 || x.n.length >= 5)
      .sort((a, b) => b.w - a.w || b.n.length - a.n.length);
    if (!items.length) return out;
    const words = out.split(/(\s+)/);                         // conserva los espacios
    const toks = []; words.forEach((w, i) => { if (!/^\s+$/.test(w) && w) toks.push(i); });
    const used = new Set();
    for (const it of items) {
      for (let s = 0; s + it.w <= toks.length; s++) {
        const idx = toks.slice(s, s + it.w);
        if (idx.some((i) => used.has(i))) continue;
        const raw = idx.map((i) => words[i]).join(" ");
        const m = raw.match(/^([^\wáéíóúñü]*)([\s\S]*?)([^\wáéíóúñü]*)$/i);
        const cand = norm(m[2]);
        if (!cand) continue;
        const fa = fon(cand), fb = fon(it.n), s1 = Math.max(sim(cand, it.n), sim(fa, fb));
        const ok = cand === it.n || (s1 >= (it.w >= 2 ? 0.8 : 0.84) && fa[0] === fb[0] && Math.abs(cand.length - it.n.length) <= 3);
        if (!ok) continue;
        words[idx[0]] = m[1] + it.v + m[3];
        for (let k = 1; k < idx.length; k++) { words[idx[k]] = ""; if (words[idx[k] - 1] && /^\s+$/.test(words[idx[k] - 1])) words[idx[k] - 1] = ""; }
        idx.forEach((i) => used.add(i));
      }
    }
    return words.join("").replace(/\s{2,}/g, " ").trim();
  }

  // ======================================================================== ÓRDENES PROGRAMADAS
  const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  function horaDe(t) {
    const m = t.match(/\ba las (\d{1,2})(?:[: ](\d{2})| y (media|cuarto))?(?:\s*(de la manana|de la tarde|de la noche|am|pm|a m|p m))?/);
    if (!m) return null;
    let h = +m[1], mi = m[2] ? +m[2] : m[3] === "media" ? 30 : m[3] === "cuarto" ? 15 : 0;
    const p = m[4] || "";
    if (/tarde|noche|pm|p m/.test(p) && h < 12) h += 12;
    if (!p && h >= 1 && h <= 5) h += 12;                     // «a las 4» sin más: de la tarde
    if (h > 23 || mi > 59) return null;
    return { h, m: mi, txt: m[0] };
  }
  /** «cada lunes a las 6 dime el clima», «todos los días a las 7 de la mañana lee mis recordatorios», «los viernes a las 4 haz el resumen» */
  function progIntent(text) {
    const t = norm(text).replace(/^jarvis\s+/, "");
    const m = t.match(/^(?:programa(?:me)?\s+(?:que\s+)?)?(cada dia|todos los dias|diario|a diario|entre semana|de lunes a viernes|los fines de semana|cada (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|todos los (?:lunes|martes|miercoles|jueves|viernes|sabados|domingos)|los (?:lunes|martes|miercoles|jueves|viernes|sabados|domingos)(?:\s*(?:,|y)\s*(?:lunes|martes|miercoles|jueves|viernes|sabados|domingos))*)\s+(.+)$/);
    if (!m) return null;
    const hr = horaDe(m[2]);
    if (!hr) return null;
    let resto = m[2].replace(hr.txt, " ").replace(/^\s*(?:,|que|me)\s+/, "").replace(/\s+/g, " ").trim();
    resto = resto.replace(/^(?:,\s*)/, "");
    if (resto.length < 3) return null;
    let dias;
    const d = m[1];
    if (/cada dia|todos los dias|diario/.test(d)) dias = [0, 1, 2, 3, 4, 5, 6];
    else if (/entre semana|lunes a viernes/.test(d)) dias = [1, 2, 3, 4, 5];
    else if (/fines de semana/.test(d)) dias = [0, 6];
    else dias = [...new Set((d.match(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/g) || []).map((x) => DIAS[x]))].sort();
    return { prog: true, dias, h: hr.h, m: hr.m, orden: resto };
  }
  /** La próxima vez que toca (ms), desde «ahora». */
  function nextFire(p, now) {
    const base = new Date(now);
    for (let k = 0; k <= 7; k++) {
      const d = new Date(base); d.setDate(d.getDate() + k); d.setHours(p.h, p.m, 0, 0);
      if (d.getTime() > base.getTime() && p.dias.includes(d.getDay())) return d.getTime();
    }
    return null;
  }
  /** ¿Cuál fue la última vez que debió correr (para no perderla si el celular estaba en otra cosa)? */
  function lastDue(p, now) {
    const base = new Date(now);
    for (let k = 0; k <= 7; k++) {
      const d = new Date(base); d.setDate(d.getDate() - k); d.setHours(p.h, p.m, 0, 0);
      if (d.getTime() <= base.getTime() && p.dias.includes(d.getDay())) return d.getTime();
    }
    return null;
  }
  const NOMDIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  function diasTxt(d) {
    const s = [...d].sort().join(",");
    if (s === "0,1,2,3,4,5,6") return "todos los días";
    if (s === "1,2,3,4,5") return "de lunes a viernes";
    if (s === "0,6") return "los fines de semana";
    return "los " + d.map((x) => NOMDIA[x]).join(", ").replace(/, ([^,]+)$/, " y $1");
  }
  const hhmm = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;

  // ======================================================================== HABILIDADES PROPIAS
  const VERBOS = "pon|abre|abrir|silencia|cuenta|activa|desactiva|llama|manda|envia|escribe|dime|lee|apaga|prende|enciende|sube|baja|recuerdame|haz|escoge|quita|cierra|reproduce|busca|toma|inicia|empieza|avisa|avisale|muestra|ponme|reproduceme|preparame|pasa";
  function pasos(t) {
    return String(t).split(new RegExp(`\\s*(?:,|;|\\by luego\\b|\\by despues\\b|\\by tambien\\b|\\bluego\\b|\\bdespues\\b)\\s*|\\s+y\\s+(?=(?:${VERBOS})\\b)`)).map((x) => x.replace(/^(?:y|que)\s+/, "").replace(/[.\s]+$/, "").trim()).filter((x) => x.length >= 3).slice(0, 8);
  }
  /** «cuando diga modo gimnasio, pon mi música, silencia el celular y cuenta 45 minutos» */
  function habIntent(text) {
    const t = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!«»"“”]/g, " ").replace(/\s+/g, " ").trim().replace(/^jarvis[\s,]+/, "");
    const m = t.match(/^(?:crea una habilidad|nueva habilidad|aprende que)?\s*(?:que\s+)?cuando (?:te )?(?:diga|digo)\s+(.+?)\s*(?:,|\bentonces\b|:)\s*(?:tu\s+)?(.+)$/) ||
      t.match(/^cuando (?:te )?(?:diga|digo)\s+(.{3,40}?)\s+(?:haz|tienes que|debes)\s+(.+)$/);
    if (!m) return null;
    const frase = norm(m[1]), ps = pasos(m[2].replace(/^(?:haz|tienes que|debes)\s+/, ""));
    if (frase.length < 3 || !ps.length) return null;
    return { hab: true, frase, pasos: ps };
  }
  function habMatch(text, lista) {
    const t = norm(text).replace(/^jarvis\s+/, "").replace(/^(?:activa (?:el |la )?|pon (?:el |la )?)/, "");
    return (lista || []).find((h) => { const f = norm(h.frase); return t === f || t === f.replace(/^(?:activa (?:el |la )?|pon (?:el |la )?)/, ""); }) || null;
  }

  // ======================================================================== CLIMA (Open-Meteo, sin clave)
  /** «¿cómo está el clima?», «va a llover mañana», «qué temperatura hace en Medellín» */
  function climaIntent(text) {
    const t = norm(text).replace(/^jarvis\s+/, "");
    if (!/\b(?:clima|pronostico|llover|lluvia|llueve|temperatura|calor|frio|sombrilla|paraguas)\b|\bque tiempo (?:hace|va a hacer)|\bcomo esta el tiempo|\bel tiempo (?:de|para|en|hoy|manana)/.test(t)) return null;
    if (/\b(?:temporizador|minutos|cronometro|recuerdame)\b/.test(t)) return null;
    const dia = /\bpasado manana\b/.test(t) ? 2 : /\bmanana\b/.test(t) && !/\bde la manana\b/.test(t) ? 1 : /\b(?:semana|proximos dias|fin de semana)\b/.test(t) ? "semana" : 0;
    const c = t.match(/\ben\s+([a-zñ ]{3,40}?)(?:\s+(?:hoy|manana|pasado manana|esta semana|el fin de semana|ahora))?$/);
    let ciudad = c ? c[1].replace(/^(?:la ciudad de|el municipio de)\s+/, "").trim() : "";
    if (/^(?:la (?:tarde|noche|manana)|este momento|la semana|casa|el colegio|el trabajo)$/.test(ciudad)) ciudad = "";
    return { clima: true, dia, ciudad };
  }
  const WMO = { 0: "despejado", 1: "mayormente despejado", 2: "parcialmente nublado", 3: "nublado", 45: "con niebla", 48: "con niebla", 51: "con llovizna débil", 53: "con llovizna", 55: "con llovizna fuerte",
    61: "con lluvia débil", 63: "con lluvia", 65: "con lluvia fuerte", 66: "con lluvia helada", 67: "con lluvia helada", 71: "con nieve", 73: "con nieve", 75: "con mucha nieve", 80: "con chubascos", 81: "con chubascos", 82: "con aguaceros fuertes",
    95: "con tormenta eléctrica", 96: "con tormenta y granizo", 99: "con tormenta y granizo" };
  const wmo = (c) => WMO[c] || "variable";
  function climaUrl(lat, lng) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${(+lat).toFixed(3)}&longitude=${(+lng).toFixed(3)}&current=temperature_2m,apparent_temperature,weather_code,precipitation&hourly=precipitation_probability,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`;
  }
  const geoUrl = (c) => `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(c)}&count=1&language=es&format=json`;
  const r0 = (x) => Math.round(x);
  /** El texto del clima, a partir de la respuesta de Open-Meteo. */
  function climaTexto(j, dia, lugar, nowMs) {
    const d = j && j.daily; if (!d || !d.time) return "No pude leer el pronóstico.";
    const en = lugar ? ` en ${lugar}` : "";
    if (dia === "semana") {
      const dd = d.time.slice(0, 7).map((t, i) => {
        const f = new Date(t + "T12:00:00"); return `${NOMDIA[f.getDay()]}: ${wmo(d.weather_code[i])}, ${r0(d.temperature_2m_min[i])} a ${r0(d.temperature_2m_max[i])} °C${d.precipitation_probability_max[i] >= 50 ? ` (lluvia ${d.precipitation_probability_max[i]} %)` : ""}`;
      });
      return `El pronóstico de la semana${en}:\n- ` + dd.join("\n- ");
    }
    const i = dia || 0, p = d.precipitation_probability_max[i];
    let s = "";
    if (i === 0 && j.current) s = `Ahora${en} hay ${r0(j.current.temperature_2m)} °C${Math.abs(j.current.apparent_temperature - j.current.temperature_2m) >= 2 ? ` (se sienten ${r0(j.current.apparent_temperature)})` : ""}, ${wmo(j.current.weather_code)}. Hoy, entre ${r0(d.temperature_2m_min[0])} y ${r0(d.temperature_2m_max[0])} °C.`;
    else s = `${i === 1 ? "Mañana" : "Pasado mañana"}${en}: ${wmo(d.weather_code[i])}, entre ${r0(d.temperature_2m_min[i])} y ${r0(d.temperature_2m_max[i])} °C.`;
    if (p >= 30 && j.hourly && j.hourly.time) {
      const dayStr = d.time[i], now = nowMs || Date.now();
      const hs = j.hourly.time.map((t, k) => ({ t, p: j.hourly.precipitation_probability[k] })).filter((x) => x.t.startsWith(dayStr) && x.p >= 50 && (i > 0 || new Date(x.t).getTime() >= now - 3600e3));
      if (hs.length) {
        const h0 = +hs[0].t.slice(11, 13);
        s += ` Probabilidad de lluvia de ${p} %, sobre todo desde ${h0 === 12 ? "el mediodía" : "las " + (h0 % 12 || 12) + (h0 < 12 ? " de la mañana" : h0 < 19 ? " de la tarde" : " de la noche")}. Lleva sombrilla. ☔`;
      } else s += ` Probabilidad de lluvia de ${p} %.`;
    } else if (p != null) s += p < 15 ? " No se espera lluvia." : ` Poca probabilidad de lluvia (${p} %).`;
    return s;
  }

  // ======================================================================== CONVERSACIONES
  /** «nueva conversación sobre el viaje», «cambia a la conversación del trabajo», «mis conversaciones», «busca en el chat …» */
  function convIntent(text) {
    const t = norm(text).replace(/^jarvis\s+/, "");
    let m;
    if ((m = t.match(/^(?:nueva conversacion|abre una conversacion nueva|empieza una conversacion nueva|otra conversacion)(?:\s+(?:sobre|de|del|de la|para|llamada)\s+(.+))?$/))) return { conv: "nueva", nombre: m[1] || "" };
    if ((m = t.match(/^(?:cambia(?:te)?|ve|vuelve|pasa(?:te)?|abre)\s+(?:a\s+)?(?:la\s+)?conversacion\s+(?:de\s+|del\s+|de la\s+|sobre\s+|llamada\s+)?(.+)$/))) return { conv: "cambiar", nombre: m[1] };
    if (/^(?:mis conversaciones|que conversaciones tengo|lista de conversaciones|conversaciones)$/.test(t)) return { conv: "lista" };
    if ((m = t.match(/^(?:busca|buscar|encuentra)\s+en\s+(?:el\s+|la\s+)?(?:chat|conversacion|conversaciones|historial)\s+(?:la palabra\s+|lo de\s+|sobre\s+)?(.+)$/))) return { conv: "buscar", q: m[1] };
    if ((m = t.match(/^(?:cuando|donde)\s+(?:te\s+)?(?:hablamos|dije|te dije|me dijiste)\s+(?:de|sobre)\s+(.+)$/))) return { conv: "buscar", q: m[1] };
    return null;
  }
  function convFind(lista, nombre) {
    const n = norm(nombre); if (!n) return null;
    return (lista || []).find((c) => norm(c.nombre) === n) || (lista || []).find((c) => norm(c.nombre).includes(n) || n.includes(norm(c.nombre))) ||
      (lista || []).map((c) => ({ c, s: sim(norm(c.nombre), n) })).filter((x) => x.s >= 0.7).sort((a, b) => b.s - a.s).map((x) => x.c)[0] || null;
  }
  /** Busca en los mensajes (de todas las conversaciones): [{conv, i, m, frag}] los más recientes primero. */
  function buscar(convs, q, max) {
    const words = norm(q).split(" ").filter((w) => w.length > 2);
    if (!words.length) return [];
    const out = [];
    (convs || []).forEach((c) => (c.chat || []).forEach((m, i) => {
      const t = norm(m.content); if (!words.every((w) => t.includes(w))) return;
      const raw = String(m.content), k = Math.max(0, norm(raw).indexOf(words[0]) - 40);
      out.push({ conv: c.id, nombre: c.nombre, i, t: m.t || 0, role: m.role, frag: (k > 0 ? "…" : "") + raw.slice(k, k + 140).replace(/\s+/g, " ") + (raw.length > k + 140 ? "…" : "") });
    }));
    return out.sort((a, b) => b.t - a.t).slice(0, max || 20);
  }
  /** El nombre de una conversación nueva a partir del primer mensaje. */
  function convNombre(primer) {
    const w = String(primer || "").replace(/[¿?¡!.,;:«»"]/g, "").split(/\s+/).filter(Boolean).slice(0, 5).join(" ");
    return w ? w[0].toUpperCase() + w.slice(1) : "Conversación";
  }

  // ======================================================================== USO DE LA IA
  const tok = (s) => Math.ceil(String(s || "").length / 4);
  function usoAdd(uso, prov, entrada, salida, now) {
    const mes = new Date(now || Date.now()).toISOString().slice(0, 7);
    uso = uso && uso.mes === mes ? uso : { mes, prov: {}, antes: uso && uso.mes ? { mes: uso.mes, prov: uso.prov } : (uso && uso.antes) || null };
    const p = uso.prov[prov] = uso.prov[prov] || { n: 0, tin: 0, tout: 0 };
    p.n++; p.tin += tok(entrada); p.tout += tok(salida);
    return uso;
  }
  const fmtK = (n) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1000 ? Math.round(n / 1000) + " mil" : String(n);

  // ======================================================================== PERSONALIDAD
  function personaPrompt(p) {
    p = p || {};
    const out = [];
    out.push(p.estilo === "formal" ? "Usa un tono formal y respetuoso, de «usted»." : p.estilo === "amigo" ? "Habla como un amigo de confianza: cercano, relajado, de «tú»." : "Usa un tono cálido y cercano.");
    out.push(p.largo === "corto" ? "Responde muy corto: 1 o 2 frases, salvo que te pidan más." : p.largo === "detallado" ? "Cuando expliques algo, da detalles y ejemplos." : "Responde breve (2 a 4 frases), salvo que te pidan un texto, una explicación detallada o una lista.");
    if (p.humor) out.push("Puedes usar un toque de humor ligero cuando venga al caso.");
    if (p.extra) out.push("Además: " + String(p.extra).slice(0, 400));
    return out.join(" ");
  }

  const API = { norm, visible, tags, ordenSegura, recuerdoOk, memDup, lev, sim, cursos, corregir, horaDe, progIntent, nextFire, lastDue, diasTxt, hhmm, pasos, habIntent, habMatch,
    climaIntent, wmo, climaUrl, geoUrl, climaTexto, convIntent, convFind, buscar, convNombre, tok, usoAdd, fmtK, personaPrompt };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL7 = API;
})(typeof window !== "undefined" ? window : globalThis);
