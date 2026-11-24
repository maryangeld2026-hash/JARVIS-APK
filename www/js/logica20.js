/* Jarvis para Android 3.31 · lógica pura (se prueba con node). Doce habilidades nuevas:
   imágenes con Gemini (Nano Banana) · resumir videos de YouTube · notas de voz compartidas · pico y placa y festivos ·
   alertas de lluvia fuerte · mapas mentales · resumen en audio a dos voces · tutor por pasos con la cámara ·
   Health Connect (pasos, sueño, pulso) · modo concentración · rastrear paquetes · garantías y vencimientos. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|hola jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dia0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const DIAS_TXT = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const NUMS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, noventa: 90, cero: 0 };
  const num = (s) => { const x = String(s || "").trim(); return /^\d+$/.test(x) ? +x : NUMS[x] != null ? NUMS[x] : null; };

  /** Día que se menciona: hoy, mañana, pasado mañana, el viernes, el 15 de diciembre, 15/12 → Date (00:00) o null. */
  function diaDe(t, now) {
    t = String(t || "").replace(/\b(?:de|en|por|a) la manana\b/g, " ");          // «a las 6 de la mañana» no es «mañana»
    const h = dia0(now || Date.now()); let m;
    if (/\bpasado manana\b/.test(t)) { h.setDate(h.getDate() + 2); return h; }
    if (/\bmanana\b/.test(t)) { h.setDate(h.getDate() + 1); return h; }
    if (/\bhoy\b/.test(t)) return h;
    if ((m = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join("|")})(?:\\s+(?:de|del)\\s+(\\d{4}))?`)))) {
      const d = new Date(m[3] ? +m[3] : h.getFullYear(), MESES.indexOf(m[2]), +m[1]);
      if (!m[3] && d < h) d.setFullYear(d.getFullYear() + 1);
      return d.getDate() === +m[1] ? d : null;
    }
    if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : h.getFullYear();
      const d = new Date(y, +m[2] - 1, +m[1]);
      if (!m[3] && d < h) d.setFullYear(d.getFullYear() + 1);
      return d.getDate() === +m[1] ? d : null;
    }
    if ((m = t.match(new RegExp(`\\b(?:el |este |el proximo |proximo )?(${DIAS.join("|")})\\b`)))) {
      const k = DIAS.indexOf(m[1]); let n = (k - h.getDay() + 7) % 7; if (n === 0 && !/\bhoy\b/.test(t)) n = /\beste\b/.test(t) ? 0 : 7;
      h.setDate(h.getDate() + n); return h;
    }
    return null;
  }
  const fechaTxt = (d, now) => {
    const n = Math.round((dia0(d) - dia0(now || Date.now())) / 864e5);
    return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : `el ${DIAS_TXT[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  };

  // ======================================================================== FESTIVOS DE COLOMBIA (Ley 51 de 1983, «Ley Emiliani»)
  function pascua(y) {                                   // algoritmo de Meeus/Jones/Butcher
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mes - 1, dia);
  }
  const lunesSig = (d) => { const x = new Date(d); const n = (8 - x.getDay()) % 7; x.setDate(x.getDate() + n); return x; };
  const mas = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  /** Los festivos del año: [{fecha: "AAAA-MM-DD", nombre}] en orden. */
  function festivos(y) {
    const P = pascua(y), F = (m, d) => new Date(y, m - 1, d);
    const l = [
      [F(1, 1), "Año Nuevo"], [lunesSig(F(1, 6)), "Día de los Reyes Magos"], [lunesSig(F(3, 19)), "Día de San José"],
      [mas(P, -3), "Jueves Santo"], [mas(P, -2), "Viernes Santo"], [F(5, 1), "Día del Trabajo"],
      [mas(P, 43), "Ascensión del Señor"], [mas(P, 64), "Corpus Christi"], [mas(P, 71), "Sagrado Corazón"],
      [lunesSig(F(6, 29)), "San Pedro y San Pablo"], [F(7, 20), "Día de la Independencia"], [F(8, 7), "Batalla de Boyacá"],
      [lunesSig(F(8, 15)), "La Asunción de la Virgen"], [lunesSig(F(10, 12)), "Día de la Raza"], [lunesSig(F(11, 1)), "Todos los Santos"],
      [lunesSig(F(11, 11)), "Independencia de Cartagena"], [F(12, 8), "Inmaculada Concepción"], [F(12, 25), "Navidad"],
    ];
    return l.map(([d, nombre]) => ({ fecha: iso(d), nombre })).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  function festivo(d) { const f = iso(new Date(d)); return festivos(new Date(d).getFullYear()).find((x) => x.fecha === f) || null; }
  const laborable = (d) => { const x = new Date(d); return x.getDay() !== 0 && x.getDay() !== 6 && !festivo(x); };
  /** Los próximos festivos desde hoy (incluye hoy). */
  function proximosFestivos(now, n) {
    const h = iso(dia0(now || Date.now())), y = new Date(now || Date.now()).getFullYear();
    return festivos(y).concat(festivos(y + 1)).filter((x) => x.fecha >= h).slice(0, n || 3);
  }
  /** Un festivo en lunes o viernes hace puente (sábado, domingo y el festivo). */
  const esPuente = (f) => { const d = new Date(f + "T12:00:00"); return d.getDay() === 1 || d.getDay() === 5; };

  // ======================================================================== PICO Y PLACA (carros particulares)
  /**
   * Reglas que publicaron las alcaldías (noviembre de 2026; las ciudades las cambian cada semestre o cada año):
   * Bogotá: lunes a viernes de 6 a. m. a 9 p. m.; los días impares NO circulan las placas 6-7-8-9-0 y los pares las 1-2-3-4-5; no aplica los festivos.
   * Medellín (y el valle de Aburrá): lunes a viernes de 5 a. m. a 8 p. m.; lunes 5 y 8, martes 1 y 4, miércoles 0 y 2, jueves 3 y 6, viernes 7 y 9.
   */
  const CIUDADES = {
    bogota: { nombre: "Bogotá", horario: "de 6:00 a. m. a 9:00 p. m.", vigente: "2026-12-31", fuente: "bogota.gov.co",
      restringe: (d, g) => (d.getDate() % 2 === 1 ? [6, 7, 8, 9, 0] : [1, 2, 3, 4, 5]).includes(g) },
    medellin: { nombre: "Medellín", horario: "de 5:00 a. m. a 8:00 p. m.", vigente: "2027-01-31", fuente: "medellin.gov.co",
      restringe: (d, g) => ({ 1: [5, 8], 2: [1, 4], 3: [0, 2], 4: [3, 6], 5: [7, 9] }[d.getDay()] || []).includes(g) },
  };
  const ALIAS_CIUDAD = { bogota: "bogota", "bogota dc": "bogota", medellin: "medellin", envigado: "medellin", itagui: "medellin", bello: "medellin", sabaneta: "medellin", "la estrella": "medellin", caldas: "medellin", copacabana: "medellin", girardota: "medellin", barbosa: "medellin" };
  function ciudadDe(t) { const x = norm(t); for (const [k, v] of Object.entries(ALIAS_CIUDAD)) if (new RegExp(`\\b${k}\\b`).test(x)) return v; const m = x.match(/\b(?:en|de)\s+([a-z ]{3,25})$/); return m ? m[1].trim() : null; }
  /** → {aplica, ciudad, horario, motivo, conocida} */
  function picoPlaca(ciudad, digito, d) {
    const c = CIUDADES[ciudad];
    if (!c) return { conocida: false, ciudad };
    const x = new Date(d), out = { conocida: true, ciudad: c.nombre, horario: c.horario };
    if (iso(x) > c.vigente) out.vencida = true;
    if (x.getDay() === 0 || x.getDay() === 6) return Object.assign(out, { aplica: false, motivo: "es fin de semana" });
    const f = festivo(x); if (f) return Object.assign(out, { aplica: false, motivo: `es festivo (${f.nombre})` });
    return Object.assign(out, { aplica: c.restringe(x, digito) });
  }
  function picoTexto(r, digito, d, now) {
    const cuando = fechaTxt(d, now);
    if (!r.conocida) return null;
    const placa = `placa terminada en ${digito}`;
    let t = r.aplica ? `🚗⛔ **Sí, ${cuando} tienes pico y placa** en ${r.ciudad} (${placa}), ${r.horario}.` : `🚗✅ **${cuando[0].toUpperCase() + cuando.slice(1)} no tienes pico y placa** en ${r.ciudad} (${placa})${r.motivo ? ": " + r.motivo : ""}.`;
    if (r.vencida) t += "\n\n_Ojo: la rotación que conozco puede haber cambiado (las ciudades la cambian cada semestre). Confírmala en la página de la alcaldía._";
    return t;
  }
  /** «¿tengo pico y placa mañana?», «mi placa termina en 5», «vivo en Medellín», «avísame el pico y placa», «¿mañana es festivo?», «próximo festivo» */
  function picoIntent(text, now) {
    const t = lead(norm(text)); let m;
    if ((m = t.match(/^(?:mi|la)\s+placa\s+(?:de mi carro\s+)?(?:termina|acaba)\s+en\s+(\d|\w+)(?:\s+y\s+(?:es|soy|vivo)\s+(?:de|en)\s+(.+))?$/))) { const g = num(m[1]); if (g != null && g <= 9) return { pp: "placa", digito: g, ciudad: m[2] ? ciudadDe("en " + m[2]) : null }; }
    if ((m = t.match(/^(?:mi carro (?:es|esta) (?:de|en)|vivo en|manejo en|mi ciudad es)\s+(.+)$/)) && /pico|placa|carro|manejo|vivo/.test(t)) return { pp: "ciudad", ciudad: ciudadDe("en " + m[1]) };
    if (/^(?:avisame|recuerdame|notificame)\s+(?:(?:cuando|si|el dia que)\s+(?:tenga|hay)\s+)?(?:el\s+)?pico y placa$|^activa (?:el aviso|los avisos) (?:de|del) pico y placa$/.test(t)) return { pp: "avisar", on: true };
    if (/^(?:ya no me avises|quita|desactiva|apaga)\s+(?:el aviso de |los avisos de |el )?pico y placa$/.test(t)) return { pp: "avisar", on: false };
    if (/\bpico y placa\b/.test(t) && /^(?:tengo|hay|como (?:esta|va|es)|cual es|que placas|me toca|tiene|cuando|dime)|^(?:manana|hoy|el \w+)\s+(?:tengo|hay)\s+pico/.test(t)) {
      const d = diaDe(t, now) || dia0(now || Date.now());
      const g = (t.match(/\b(?:placa|terminad[ao]s?|termina)\s+(?:terminada\s+)?en\s+(\d)\b/) || [])[1];
      return { pp: "consulta", fecha: iso(d), digito: g != null ? +g : null, ciudad: /\ben\s+(?:bogota|medellin|envigado|itagui|bello|sabaneta|cali|barranquilla|bucaramanga|cartagena|pereira|manizales|ibague|villavicencio|cucuta|pasto|armenia|neiva|tunja|santa marta)\b/.test(t) ? ciudadDe(t) : null };
    }
    if (/\b(?:es|sera|hay)\s+festivo\b|\bfestivo\b.*\?*$/.test(t) && /^(?:manana|hoy|el|es|sera|hay|pasado)/.test(t)) { const d = diaDe(t, now); if (d) return { fe: "dia", fecha: iso(d) }; }
    if (/^(?:cual es el |cuando es el )?(?:proximo|siguiente) (?:festivo|puente)$|^cuando (?:es|hay) (?:el proximo|otro) (?:festivo|puente)$|^cuanto falta para el (?:proximo )?(?:festivo|puente)$/.test(t)) return { fe: "proximo", puente: /puente/.test(t) };
    if ((m = t.match(new RegExp(`^(?:que |cuales )?festivos (?:hay )?(?:en|de|del mes de)\\s+(${MESES.join("|")})$|^festivos (?:del|de este) (ano|mes)$`)))) return { fe: "lista", mes: m[1] ? MESES.indexOf(m[1]) : m[2] === "mes" ? new Date(now || Date.now()).getMonth() : -1 };
    return null;
  }
  /** Los días con pico y placa de los próximos n días (para avisar la noche anterior). */
  function diasConPico(ciudad, digito, now, n) {
    const out = []; const h = dia0(now || Date.now());
    for (let k = 1; k <= (n || 21); k++) { const d = mas(h, k); const r = picoPlaca(ciudad, digito, d); if (r.conocida && r.aplica) out.push(iso(d)); }
    return out;
  }

  // ======================================================================== YOUTUBE
  function ytId(u) { const m = String(u || "").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/); return m ? m[1] : null; }
  const ytUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
  /** «resume este video https://youtu.be/…», solo el link, «en el video, ¿qué dijo de…?» */
  function ytIntent(text, ultimo) {
    const raw = String(text || ""), id = ytId(raw);
    if (id) {
      const resto = norm(raw.replace(/https?:\/\/\S+/g, " "));
      if (!resto || /^(?:resum\w*|de que (?:trata|habla)|que dice|explica\w*|puntos? clave|mira(?:lo)?|ve(?:lo)?|este video|el video|video|haz(?:me)? un resumen)/.test(resto)) return { yt: "resumen", url: ytUrl(id) };
      return { yt: "pregunta", url: ytUrl(id), q: raw.replace(/https?:\/\/\S+/g, "").trim() };
    }
    const t = lead(norm(raw)); let m;
    if (ultimo && (m = t.match(/^(?:en el video|del video|sobre el video|preguntale al video)\s*,?\s*(.{4,})$/))) return { yt: "pregunta", url: ultimo, q: m[1] };
    if (ultimo && /^(?:puntos clave|minutos importantes|hazme un quiz) del video$/.test(t)) return { yt: /quiz/.test(t) ? "quiz" : "clave", url: ultimo };
    return null;
  }
  const PROMPT_YT = "Resume este video de YouTube en español: 1) de qué trata en 2 frases; 2) 5 a 8 puntos clave, cada uno con el minuto (mm:ss) donde aparece; 3) una conclusión de una línea. Si el video está en otro idioma, igual responde en español.";

  // ======================================================================== IMÁGENES CON GEMINI (Nano Banana)
  function imagenIntent(text) {
    const t = lead(norm(text)); const raw = String(text || "").trim(); let m;
    const cuerpo = (re) => { const r = raw.replace(/^\s*(?:jarvis[,\s]+)?/i, "").match(re); return r ? r[r.length - 1].trim() : ""; };
    if (/^(?:crea(?:me)?|haz(?:me)?|genera(?:me)?|dibuja(?:me)?|disena(?:me)?|pinta(?:me)?)\s+(?:una|un|la|el)?\s*(?:imagen|dibujo|ilustracion|foto|afiche|poster|logo|tarjeta|invitacion|caricatura|portada|sticker)\b/.test(t)) {
      return { img: "crear", prompt: cuerpo(/^(?:crea(?:me)?|haz(?:me)?|genera(?:me)?|dibuja(?:me)?|diseña(?:me)?|disena(?:me)?|pinta(?:me)?)\s+([\s\S]+)$/i) || raw };
    }
    if ((m = t.match(/^(?:quitale|borrale|eliminale)\s+el\s+fondo(?:\s+a\s+(?:esta|la|mi)\s+(?:foto|imagen))?$/))) return { img: "editar", prompt: "Quita el fondo de esta imagen y déjalo blanco liso, sin cambiar a la persona u objeto principal." };
    if (/^(?:edita|cambia|arregla|mejora|retoca|modifica)\s+(?:esta|la|mi|esa)\s+(?:foto|imagen)\b|^(?:pon(?:la|le)?|convierte(?:la)?|haz(?:la)?)\s+(?:esta foto|esta imagen|la foto|la imagen)?\s*(?:en|como|al)\s+(?:estilo|caricatura|dibujo|acuarela|anime|blanco y negro|pixel)|^(?:ponle|agregale|quitale)\s+.+\s+a\s+(?:esta|la|mi)\s+(?:foto|imagen)$/.test(t)) return { img: "editar", prompt: raw };
    return null;
  }
  /** El modelo de imágenes de la cuenta: Nano Banana 2, si no el Lite, si no el que haya. */
  function modeloImagen(ids) {
    const l = (ids || []).filter((x) => /gemini.*image/.test(x) && !/^imagen|tts|live/.test(x));
    return l.find((x) => /3\.\d+-flash-image$|flash-image$/.test(x) && !/lite|2\.5/.test(x)) || l.find((x) => /flash-lite-image/.test(x)) || l.find((x) => /flash-image/.test(x)) || l.find((x) => /pro-image/.test(x)) || l[0] || "gemini-3.1-flash-image";
  }

  // ======================================================================== NOTAS DE VOZ COMPARTIDAS
  const esAudio = (mime, nombre) => /^audio\//.test(mime || "") || /\.(?:opus|ogg|oga|m4a|mp3|aac|amr|wav|3gp)$/i.test(nombre || "");
  const mimeAudio = (mime, nombre) => { if (/^audio\/(?:ogg|opus|mpeg|mp4|aac|wav|x-wav|amr|3gpp|webm|flac)/.test(mime || "")) return mime.replace("audio/opus", "audio/ogg"); const n = String(nombre || "").toLowerCase(); return /\.m4a$/.test(n) ? "audio/mp4" : /\.mp3$/.test(n) ? "audio/mpeg" : /\.wav$/.test(n) ? "audio/wav" : /\.aac$/.test(n) ? "audio/aac" : "audio/ogg"; };
  const PROMPT_NOTA = "Transcribe esta nota de voz en español, palabra por palabra pero con puntuación. Si dura más de un minuto, después de la transcripción agrega «Resumen:» con 1 a 3 puntos. Devuelve solo eso.";

  // ======================================================================== ALERTAS DE LLUVIA FUERTE
  /** h: respuesta de Open-Meteo (hourly: time, precipitation_probability, precipitation, weather_code). → {hora, prob, mm, tormenta} o null */
  function lluviaFuerte(h, now, horas) {
    const H = (h && h.hourly) || {}; const ts = H.time || [];
    const ini = new Date(now || Date.now()).getTime(), fin = ini + (horas || 6) * 3600e3;
    for (let i = 0; i < ts.length; i++) {
      const t = new Date(ts[i]).getTime(); if (t < ini - 3600e3 || t > fin) continue;
      const p = (H.precipitation_probability || [])[i] || 0, mm = (H.precipitation || [])[i] || 0, wc = (H.weather_code || [])[i] || 0;
      const tormenta = wc >= 95;
      if ((p >= 70 && mm >= 2) || (tormenta && p >= 50) || mm >= 5) return { hora: ts[i], prob: p, mm, tormenta };
    }
    return null;
  }
  const horaTxt = (s) => { const d = new Date(s); const h = d.getHours(); return `${h % 12 || 12}${d.getMinutes() ? ":" + pad(d.getMinutes()) : ""} ${h < 12 ? "a. m." : "p. m."}`; };
  const lluviaTexto = (r) => r ? `${r.tormenta ? "⛈️ Tormenta" : "🌧️ Lluvia fuerte"} hacia las ${horaTxt(r.hora)} (${r.prob} %, ${String(r.mm).replace(".", ",")} mm). Lleva paraguas.` : "☀️ No veo lluvia fuerte en las próximas horas.";
  function alertasIntent(text) {
    const t = lead(norm(text));
    if (/^(?:avisame|alertame)\s+(?:si|cuando)\s+(?:va a llover|vaya a llover|llueva)(?:\s+fuerte)?$|^activa (?:las )?alertas (?:de lluvia|del clima)$/.test(t)) return { al: true };
    if (/^(?:quita|desactiva|apaga)\s+(?:las )?alertas (?:de lluvia|del clima)$|^ya no me avises (?:si|cuando) (?:llueva|va a llover)$/.test(t)) return { al: false };
    return null;
  }

  // ======================================================================== MAPAS MENTALES
  function mapaIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:haz(?:me)?|crea(?:me)?|arma(?:me)?|genera(?:me)?|dibuja(?:me)?)\s+un\s+(mapa mental|mapa conceptual|esquema|cuadro sinoptico)\s+(?:de|sobre|del|con)\s+(.{2,})$/))) {
      const tema = raw.replace(/^[\s\S]*?\b(?:de|sobre|del|con)\s+/i, "").trim();
      const doc = (m[2].match(/^(?:el |este |mi )?documento\s+(.+)$/) || [])[1];
      return { mm: m[1], tema: doc ? "" : tema, doc: doc || (/^(?:esto|eso|lo anterior|la respuesta)$/.test(m[2]) ? "__ultimo" : "") };
    }
    return null;
  }
  const PROMPT_MAPA = (tema, tipo) => `Haz un ${tipo || "mapa mental"} claro en español sobre: ${tema}\nResponde SOLO JSON: {"tema":"título corto","ramas":[{"t":"idea principal (máx. 5 palabras)","hijos":[{"t":"detalle (máx. 6 palabras)"}]}]}\n4 a 6 ramas, 2 a 4 hijos cada una. Nada de texto largo.`;
  function mapaValido(j) {
    if (!j || typeof j !== "object" || !Array.isArray(j.ramas)) return null;
    const corto = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
    const ramas = j.ramas.filter((r) => r && r.t).slice(0, 7).map((r) => ({ t: corto(r.t, 40), hijos: (Array.isArray(r.hijos) ? r.hijos : []).filter((h) => h && (h.t || typeof h === "string")).slice(0, 5).map((h) => ({ t: corto(h.t || h, 48) })) }));
    return ramas.length ? { tema: corto(j.tema || "Mapa mental", 40), ramas } : null;
  }
  /** Parte una frase en renglones de ~n letras. */
  function renglones(s, n) { const out = []; let cur = ""; String(s).split(" ").forEach((w) => { if ((cur + " " + w).trim().length > n && cur) { out.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }); if (cur) out.push(cur); return out.slice(0, 3); }
  /** El mapa en SVG: el tema al centro, las ramas a los dos lados, cada una con sus hijos. Colores por rama. */
  function svgMapa(m) {
    const COL = ["#2563eb", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0891b2", "#dc2626"];
    const izq = m.ramas.filter((_, i) => i % 2 === 1), der = m.ramas.filter((_, i) => i % 2 === 0);
    const altoRama = (r) => Math.max(1, r.hijos.length) * 46 + 16;
    const altoLado = (l) => l.reduce((s, r) => s + altoRama(r), 0);
    const H = Math.max(360, altoLado(izq), altoLado(der)) + 40, W = 1200, cx = W / 2, cy = H / 2;
    const partes = [], col = (r) => COL[m.ramas.indexOf(r) % COL.length];
    const caja = (x, y, w, h, fill, stroke, texto, tam, peso, color) => {
      const ls = renglones(texto, Math.max(8, Math.floor(w / (tam * 0.58))));
      partes.push(`<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
      ls.forEach((l, i) => partes.push(`<text x="${x}" y="${y + (i - (ls.length - 1) / 2) * tam * 1.15 + tam * 0.35}" font-size="${tam}" font-weight="${peso}" text-anchor="middle" fill="${color}" font-family="sans-serif">${esc(l)}</text>`));
    };
    const lado = (lista, sx) => {
      let y = cy - altoLado(lista) / 2;
      lista.forEach((r) => {
        const h = altoRama(r), ry = y + h / 2, rx = cx + sx * 300, c = col(r);
        partes.push(`<path d="M${cx + sx * 110},${cy} C${cx + sx * 200},${cy} ${rx - sx * 120},${ry} ${rx - sx * 90},${ry}" stroke="${c}" stroke-width="4" fill="none"/>`);
        r.hijos.forEach((hj, k) => {
          const hy = y + 8 + k * 46 + 23, hx = cx + sx * 480;
          partes.push(`<path d="M${rx + sx * 90},${ry} C${rx + sx * 130},${ry} ${hx - sx * 140},${hy} ${hx - sx * 100},${hy}" stroke="${c}" stroke-width="2" fill="none" opacity="0.7"/>`);
          caja(hx, hy, 200, 38, "#ffffff", c, hj.t, 14, 400, "#1f2937");
        });
        caja(rx, ry, 180, 52, c, c, r.t, 16, 700, "#ffffff");
        y += h;
      });
    };
    lado(der, 1); lado(izq, -1);
    caja(cx, cy, 210, 72, "#111827", "#111827", m.tema, 20, 800, "#ffffff");
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#f8fafc"/>${partes.join("")}</svg>`;
  }
  /** El mapa como lista (para leerlo en voz alta o copiarlo). */
  const mapaTexto = (m) => `🧠 **${m.tema}**\n` + m.ramas.map((r) => `- **${r.t}**${r.hijos.length ? "\n" + r.hijos.map((h) => `  - ${h.t}`).join("\n") : ""}`).join("\n");

  // ======================================================================== RESUMEN EN AUDIO A DOS VOCES
  function audioResumenIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:haz(?:me)?|crea(?:me)?|arma(?:me)?|genera(?:me)?)\s+un\s+(?:podcast|resumen en audio|audio resumen|resumen hablado)\s+(?:de|sobre|del|con)\s+(.{2,})$/))) {
      const doc = (m[1].match(/^(?:el |este |mi )?documento\s+(.+)$/) || [])[1];
      return { pod: true, tema: doc ? "" : raw.replace(/^[\s\S]*?\b(?:de|sobre|del|con)\s+/i, "").trim(), doc: doc || (/^(?:esto|eso|lo anterior|la respuesta)$/.test(m[1]) ? "__ultimo" : "") };
    }
    return null;
  }
  const PROMPT_GUION = (tema, fuente) => `Escribe el guion de un resumen en audio de unos 3 minutos, en español de Colombia, entre dos presentadores: Ana (explica) y Luis (pregunta y pone ejemplos). Tono cercano y claro, sin saludos largos.${fuente ? " Básate SOLO en este material:\n" + fuente + "\n" : " Tema: " + tema + "\n"}Responde SOLO JSON: {"titulo":"…","lineas":[{"quien":"Ana","t":"…"},{"quien":"Luis","t":"…"}]} con 14 a 22 líneas cortas.`;
  function guionValido(j) {
    if (!j || !Array.isArray(j.lineas)) return null;
    const l = j.lineas.filter((x) => x && x.t && /^(?:ana|luis)$/i.test(String(x.quien || ""))).slice(0, 30).map((x) => ({ quien: /^ana$/i.test(x.quien) ? "Ana" : "Luis", t: String(x.t).replace(/[*_#]/g, "").trim().slice(0, 400) }));
    return l.length >= 2 ? { titulo: String(j.titulo || "Resumen en audio").slice(0, 60), lineas: l } : null;
  }
  const guionTexto = (g) => g.lineas.map((x) => `${x.quien}: ${x.t}`).join("\n");
  function modeloTTS(ids) { const l = (ids || []).filter((x) => /tts/.test(x)); return l.find((x) => /flash-tts$/.test(x) && !/lite/.test(x)) || l.find((x) => /flash-lite-tts$/.test(x)) || l.find((x) => /flash.*tts/.test(x)) || l[0] || "gemini-3.8-flash-tts"; }
  /** El pedido a Gemini TTS con las dos voces. */
  function pedidoTTS(g) {
    return { contents: [{ role: "user", parts: [{ text: "Lee esta conversación en español de Colombia, con naturalidad:\n" + guionTexto(g) }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [{ speaker: "Ana", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } }, { speaker: "Luis", voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } }] } } } };
  }
  /** PCM de 16 bits (base64) → WAV (base64). Si ya es WAV, lo deja igual. */
  function wavDePCM(b64, sr) {
    const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    if (bin.slice(0, 4) === "RIFF") return b64;
    const n = bin.length, h = new Uint8Array(44), v = new DataView(h.buffer), s = sr || 24000;
    const w = (o, t) => { for (let i = 0; i < 4; i++) h[o + i] = t.charCodeAt(i); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, s, true); v.setUint32(28, s * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n, true);
    let cab = ""; for (let i = 0; i < 44; i++) cab += String.fromCharCode(h[i]);
    return typeof btoa === "function" ? btoa(cab + bin) : Buffer.from(cab + bin, "binary").toString("base64");
  }
  const tasaDe = (mime) => { const m = String(mime || "").match(/rate=(\d+)/); return m ? +m[1] : 24000; };

  // ======================================================================== TUTOR POR PASOS CON LA CÁMARA
  function tutorIntent(text) {
    const t = lead(norm(text));
    if (/^(?:ayudame|explicame|guiame)\s+(?:con\s+)?(?:este|un|el)\s+(?:ejercicio|problema|tarea)(?:\s+paso a paso)?$|^(?:modo tutor|tutor paso a paso|se mi tutor|activa el tutor)$|^(?:resolvamos|hagamos)\s+(?:este|un)\s+ejercicio(?:\s+juntos)?$/.test(t)) return { tu: "empezar" };
    return null;
  }
  function tutorFin(text) {
    const t = lead(norm(text));
    if (/^(?:ya entendi|listo gracias|gracias ya|salir del tutor|termina el tutor|sal del tutor|ya lo resolvi|chao tutor|fin del tutor)$/.test(t)) return "salir";
    if (/^(?:dame la respuesta|cual es la respuesta|dime la respuesta|me rindo|no se|no entiendo nada)$/.test(t)) return "respuesta";
    return null;
  }
  const SISTEMA_TUTOR = "Eres un tutor paciente para un estudiante colombiano. Trabajas con el ejercicio de la foto. Reglas: NUNCA des la respuesta final de una vez; " +
    "di en una frase qué pide el ejercicio y da SOLO la primera pista o pregunta guía; espera a que el estudiante responda; si se equivoca, explica el error con cariño y da otra pista; " +
    "si acierta, felicítalo y pasa al siguiente paso. Usa ejemplos sencillos y frases cortas (se escucha en voz alta). Si el estudiante dice que se rinde, muestra la solución completa paso a paso.";

  // ======================================================================== SALUD (Health Connect)
  function saludIntent(text) {
    const t = lead(norm(text));
    if (/^(?:conecta|activa|enlaza)\s+(?:health connect|mi salud|conexion salud|google fit|mi reloj de salud)$/.test(t)) return { sa: "conectar" };
    if (/\bcomo dormi\b|\bcuanto dormi\b|\bmi sueno\b|\bhoras de sueno\b/.test(t)) return { sa: "sueno", rango: /semana|ultimos dias|esta semana/.test(t) ? "semana" : "anoche" };
    if (/\bpasos\b/.test(t) && /^(?:cuantos|mis|cuanto|como voy|como van|llevo)/.test(t)) return { sa: "pasos", rango: /semana/.test(t) ? "semana" : "hoy" };
    if (/\b(?:ritmo cardiaco|frecuencia cardiaca|pulso|pulsaciones)\b/.test(t) && /^(?:como esta|cual es|mi|como va|cuanto)/.test(t)) return { sa: "corazon" };
    if (/^(?:como (?:esta|va) mi salud|resumen de (?:mi )?salud|mi salud (?:de|esta) (?:la )?semana)$/.test(t)) return { sa: "todo", rango: "semana" };
    return null;
  }
  const hm = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); return h ? `${h} h${m ? " " + m + " min" : ""}` : `${m} min`; };
  /** r: {pasos:[{dia, n}], sueno:[{ini, fin}], pulso:{prom, min, max}} → texto */
  function saludTexto(r, it, now) {
    if (!r) return "No pude leer tus datos de salud.";
    const out = [];
    const hoy = iso(dia0(now || Date.now()));
    if (it.sa === "pasos" || it.sa === "todo") {
      const l = r.pasos || [];
      if (!l.length) out.push("👟 No hay pasos registrados (¿tu celular o tu reloj guardan los pasos en Health Connect?).");
      else if (it.rango === "hoy") { const x = l.find((p) => p.dia === hoy); out.push(`👟 Hoy llevas **${((x && x.n) || 0).toLocaleString("es-CO")} pasos**.`); }
      else { const tot = l.reduce((s, p) => s + p.n, 0), prom = Math.round(tot / l.length), mejor = l.slice().sort((a, b) => b.n - a.n)[0]; out.push(`👟 Esta semana: **${prom.toLocaleString("es-CO")} pasos al día** en promedio. Tu mejor día fue el ${DIAS_TXT[new Date(mejor.dia + "T12:00:00").getDay()]} (${mejor.n.toLocaleString("es-CO")}).`); }
    }
    if (it.sa === "sueno" || it.sa === "todo") {
      const l = (r.sueno || []).map((s) => ({ fin: s.fin, min: (s.fin - s.ini) / 60000 })).filter((s) => s.min > 60);
      if (!l.length) out.push("😴 No hay sueño registrado (lo guardan algunos relojes y apps como Fitbit, Samsung Health o Sleep as Android).");
      else if (it.rango === "anoche") { const s = l.sort((a, b) => b.fin - a.fin)[0]; out.push(`😴 Anoche dormiste **${hm(s.min)}**${s.min < 360 ? " (menos de 6 horas: trata de acostarte más temprano hoy)" : s.min >= 420 ? " (¡bien!)" : ""}.`); }
      else { const prom = l.reduce((s, x) => s + x.min, 0) / l.length; out.push(`😴 Esta semana dormiste **${hm(prom)} por noche** en promedio (${l.length} noches registradas).${prom < 420 ? " Lo recomendado para un adulto es 7 horas o más." : ""}`); }
    }
    if (it.sa === "corazon" || it.sa === "todo") {
      const p = r.pulso;
      out.push(p && p.prom ? `❤️ Tu pulso en las últimas 24 horas: promedio **${Math.round(p.prom)} lpm** (entre ${Math.round(p.min)} y ${Math.round(p.max)}).` : "❤️ No hay pulso registrado (lo mide un reloj o una banda).");
    }
    return out.join("\n\n") + "\n\n_Leído de Health Connect, dentro del celular. No es un diagnóstico médico._";
  }

  // ======================================================================== MODO CONCENTRACIÓN
  function enfoqueIntent(text) {
    const t = lead(norm(text)); let m;
    if ((m = t.match(/^(?:necesito|quiero|voy a)\s+concentrarme(?:\s+(?:por|durante|unos|unas)?\s*(\d+|\w+)\s*(minutos?|horas?|min|h))?$|^(?:modo|activa el modo)\s+(?:concentracion|enfoque|estudio)(?:\s+(?:por|durante)?\s*(\d+|\w+)\s*(minutos?|horas?|min|h))?$|^(?:pomodoro|haz un pomodoro)$/))) {
      const n = num(m[1] || m[3]), u = m[2] || m[4] || "";
      return { en: "iniciar", min: n ? (/^h/.test(u) ? n * 60 : n) : /pomodoro/.test(t) ? 25 : 50 };
    }
    if (/^(?:termina|para|deten|cancela|quita|sal(?:ir)? del?)\s+(?:la |el )?(?:modo )?(?:concentracion|enfoque|pomodoro)$|^ya (?:termine|me concentre)$/.test(t)) return { en: "parar" };
    if (/^cuanto (?:me he concentrado|me concentre|tiempo me concentre)(?:\s+esta semana|\s+hoy)?$|^mis sesiones de concentracion$/.test(t)) return { en: "ver" };
    return null;
  }
  function enfoqueResumen(ses, now) {
    const desde = dia0(now || Date.now()); desde.setDate(desde.getDate() - 6);
    const l = (ses || []).filter((s) => s.ini >= desde.getTime());
    if (!l.length) return "🎯 Esta semana no has hecho sesiones de concentración. Di «necesito concentrarme 50 minutos».";
    const min = l.reduce((s, x) => s + x.min, 0), hoy = l.filter((s) => s.ini >= dia0(now || Date.now()).getTime()).reduce((s, x) => s + x.min, 0);
    return `🎯 Esta semana: **${hm(min)}** de concentración en ${l.length} sesiones${hoy ? ` (hoy ${hm(hoy)})` : ""}.`;
  }

  // ======================================================================== PAQUETES
  /** Páginas oficiales de rastreo (se escribe la guía ahí; Jarvis la copia para pegarla). */
  const EMPRESAS = {
    servientrega: ["Servientrega", "https://www.servientrega.com/wps/portal/rastreo-envio"], interrapidisimo: ["Interrapidísimo", "https://www.interrapidisimo.com/sigue-tu-envio/"],
    coordinadora: ["Coordinadora", "https://coordinadora.com/rastreo/"], envia: ["Envía", "https://envia.co/"], tcc: ["TCC", "https://tcc.com.co/"],
    deprisa: ["Deprisa", "https://www.deprisa.com/"], "4-72": ["4-72", "https://www.4-72.com.co/"], dhl: ["DHL", "https://www.dhl.com/co-es/home/rastreo.html"],
    fedex: ["FedEx", "https://www.fedex.com/es-co/tracking.html"], mercadolibre: ["Mercado Libre", "https://www.mercadolibre.com.co/compras"], amazon: ["Amazon", "https://www.amazon.com/progress-tracker/package"],
  };
  const ALIAS_EMP = [[/servientrega/, "servientrega"], [/inter ?rapidisimo|interrapidisimo|inter\b/, "interrapidisimo"], [/coordinadora/, "coordinadora"], [/\benvia\b/, "envia"], [/\btcc\b/, "tcc"], [/deprisa/, "deprisa"], [/4 ?-? ?72|cuatro setenta y dos/, "4-72"], [/\bdhl\b/, "dhl"], [/fedex/, "fedex"], [/mercado ?libre/, "mercadolibre"], [/amazon/, "amazon"]];
  const empresaDe = (t) => { for (const [re, k] of ALIAS_EMP) if (re.test(t)) return k; return null; };
  function paqueteIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:rastrea|sigue|guarda|anota|registra)\s+(?:mi\s+|el\s+|la\s+)?(?:paquete|envio|pedido|guia)(?:\s+(?:numero|no))?\s+(?:de\s+[a-z0-9 -]+?\s+)?([a-z0-9-]{6,25})(?:\s+(?:de|en|por)\s+(.+))?$/))) {
      const guia = (raw.match(/\b([A-Za-z0-9-]{6,25})\b(?=[^A-Za-z0-9-]*(?:$|\s+(?:de|en|por)\s))/g) || []).filter((x) => /\d/.test(x)).pop() || m[1];
      return { pq: "agregar", guia: guia.toUpperCase(), empresa: empresaDe(t) };
    }
    if ((m = t.match(/^(?:rastrea|sigue)\s+(?:la\s+)?guia\s+([a-z0-9-]{6,25})$/))) return { pq: "agregar", guia: m[1].toUpperCase(), empresa: null };
    if (/^(?:como va|donde va|donde esta|que paso con)\s+(?:mi|el)\s+(?:paquete|envio|pedido)$|^mis (?:paquetes|envios)$/.test(t)) return { pq: "ver" };
    if ((m = t.match(/^(?:ya llego|ya me llego|borra|quita)\s+(?:el|mi)\s+(?:paquete|envio|pedido)(?:\s+(?:de\s+)?(.+))?$/))) return { pq: "borrar", q: m[1] || "" };
    return null;
  }

  // ======================================================================== GARANTÍAS Y VENCIMIENTOS
  const DOCS = [[/\bsoat\b/, "SOAT"], [/\btecno ?mecanica|revision tecnico ?mecanica|tecnicomecanica\b/, "Revisión técnico-mecánica"], [/\blicencia de conduccion|\bpase\b/, "Licencia de conducción"],
    [/\bpasaporte\b/, "Pasaporte"], [/\bvisa\b/, "Visa"], [/\bimpuesto (?:del carro|vehicular|de la moto)|\bimpuesto vehicular\b/, "Impuesto vehicular"], [/\bpredial\b/, "Impuesto predial"],
    [/\bseguro\b/, "Seguro"], [/\bextintor\b/, "Extintor"], [/\btarjeta de credito\b/, "Tarjeta de crédito"], [/\bcontrato\b/, "Contrato"], [/\bcedula\b/, "Cédula"]];
  /** «mi SOAT vence el 15 de marzo», «la garantía de la nevera es de 12 meses, la compré hoy», «¿qué se me vence?» */
  function vencIntent(text, now) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if (/^(?:que se me vence|que vencimientos tengo|mis vencimientos|mis garantias|que garantias tengo)(?: este mes| pronto)?$/.test(t)) return { ve: "ver" };
    if (/^(?:guarda|registra|anota)\s+la\s+garantia\s+de\s+(?:esta|la)\s+factura$|^(?:guarda|registra)\s+esta\s+factura\s+(?:para|con)\s+la\s+garantia$/.test(t)) return { ve: "foto" };
    if ((m = t.match(/^(?:la\s+)?garantia\s+de\s+(?:la |el |mi |los |las )?(.+?)\s+(?:es|dura)\s+(?:de\s+)?(\d+|\w+)\s+(meses?|anos?)(?:,?\s*(?:la|lo|los|las)\s+compre\s+(.+))?$/)) ||
        (m = t.match(/^(?:registra|guarda|anota)\s+la\s+garantia\s+de\s+(?:la |el |mi |los |las )?(.+?)(?:,?\s+(?:de|por)\s+(\d+|\w+)\s+(meses?|anos?))(?:,?\s*(?:la|lo|los|las)\s+compre\s+(.+))?$/))) {
      const n = num(m[2]); if (n == null) return null;
      const desde = m[4] ? diaDe(m[4], now) || dia0(now || Date.now()) : dia0(now || Date.now());
      const f = new Date(desde); f.setMonth(f.getMonth() + (/an/.test(m[3]) ? n * 12 : n));
      return { ve: "agregar", que: "Garantía de " + m[1].trim(), fecha: iso(f), garantia: true };
    }
    if (t.split(" ").length <= 14 && (m = t.match(/^(?:mi |la |el |los |las )?((?:\S+\s+){0,5}?\S+)\s+(?:vence|se vence|caduca|expira|hay que renovarl[oa]|toca renovarl[oa])\s+(?:el\s+)?(.+)$/))) {
      const d = diaDe(m[2], now); if (!d) return null;
      const doc = DOCS.find(([re]) => re.test(m[1]));
      const que = doc ? doc[1] : raw.replace(/^\s*(?:jarvis[,\s]+)?(?:mi |la |el |los |las )?/i, "").split(/\s+(?:vence|se vence|caduca|expira|hay que|toca)\b/i)[0].trim();
      return { ve: "agregar", que: que.charAt(0).toUpperCase() + que.slice(1), fecha: iso(d) };
    }
    if ((m = t.match(/^(?:borra|quita|ya renove|ya pague)\s+(?:el |la |mi )?(?:vencimiento\s+(?:de\s+|del\s+)?)?(.+)$/)) && DOCS.some(([re]) => re.test(m[1]))) return { ve: "borrar", q: m[1] };
    return null;
  }
  /** Cuándo avisar: 30, 7 y 1 días antes, a las 9 a. m. (solo los que no han pasado). */
  function avisosVenc(item, now) {
    const f = new Date(item.fecha + "T09:00:00"), out = [];
    [[30, "en un mes"], [7, "en una semana"], [1, "mañana"], [0, "hoy"]].forEach(([d, txt]) => { const at = new Date(f); at.setDate(at.getDate() - d); if (at.getTime() > (now || Date.now())) out.push({ at: at.getTime(), texto: `${item.que} vence ${txt} (${f.getDate()} de ${MESES[f.getMonth()]}).` }); });
    return out;
  }
  function vencLista(l, now) {
    const h = dia0(now || Date.now()).getTime();
    const v = (l || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (!v.length) return "📅 No tienes vencimientos ni garantías anotados. Di, por ejemplo, «mi SOAT vence el 15 de marzo».";
    return "📅 **Tus vencimientos y garantías:**\n" + v.map((x) => { const d = Math.round((new Date(x.fecha + "T00:00:00") - h) / 864e5); return `- ${d < 0 ? "❌" : d <= 7 ? "⚠️" : d <= 30 ? "⏳" : "✅"} **${x.que}** · ${x.fecha.split("-").reverse().join("/")} (${d < 0 ? `venció hace ${-d} días` : d === 0 ? "vence hoy" : `faltan ${d} días`})`; }).join("\n");
  }
  const PROMPT_FACTURA = 'Es la foto de una factura de compra en Colombia. Devuelve SOLO JSON {"producto":"qué se compró (corto)","tienda":"","fecha":"AAAA-MM-DD","garantia_meses":número (si la factura no lo dice, 12 para electrodomésticos y celulares, 6 para lo demás)}. Si no es una factura, {"error":"por qué"}.';

  const API = { norm, diaDe, fechaTxt, pascua, festivos, festivo, laborable, proximosFestivos, esPuente, CIUDADES, ciudadDe, picoPlaca, picoTexto, picoIntent, diasConPico,
    ytId, ytUrl, ytIntent, PROMPT_YT, imagenIntent, modeloImagen, esAudio, mimeAudio, PROMPT_NOTA, lluviaFuerte, lluviaTexto, alertasIntent, horaTxt,
    mapaIntent, PROMPT_MAPA, mapaValido, svgMapa, mapaTexto, renglones, audioResumenIntent, PROMPT_GUION, guionValido, guionTexto, modeloTTS, pedidoTTS, wavDePCM, tasaDe,
    tutorIntent, tutorFin, SISTEMA_TUTOR, saludIntent, saludTexto, enfoqueIntent, enfoqueResumen, EMPRESAS, empresaDe, paqueteIntent,
    vencIntent, avisosVenc, vencLista, PROMPT_FACTURA, MESES };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL20 = API;
})(typeof window !== "undefined" ? window : globalThis);
