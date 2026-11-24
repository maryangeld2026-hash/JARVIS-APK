/* Jarvis para Android 3.34 · lógica pura (se prueba con node). Once habilidades de asistente general:
   organizar el día · choques en la agenda · hora de salir · temas que sigo · ¿qué cocino con esto? · modo viaje ·
   alertas de precio · hojas de cálculo por voz (Excel y Google Sheets) · Google Docs y Notion · no perder el contacto ·
   rutina de sueño con tus datos. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|hola jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dia0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
  const hhmm = (t) => { const d = new Date(t); const h = d.getHours(); return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? "a. m." : "p. m."}`; };
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const NUMS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, treinta: 30, media: 0.5 };
  const num = (s) => { const x = String(s || "").trim().replace(",", "."); return /^\d+(?:\.\d+)?$/.test(x) ? +x : NUMS[x] != null ? NUMS[x] : null; };
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function diaDe(t, now) {
    t = String(t || "").replace(/\b(?:de|en|por|a) la manana\b/g, " ");          // «a las 6 de la mañana» no es «mañana»
    const h = dia0(now || Date.now()); let m;
    if (/\bpasado manana\b/.test(t)) { h.setDate(h.getDate() + 2); return h; }
    if (/\bmanana\b/.test(t)) { h.setDate(h.getDate() + 1); return h; }
    if (/\bhoy\b/.test(t)) return h;
    if ((m = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join("|")})(?:\\s+(?:de|del)\\s+(\\d{4}))?`)))) {
      const d = new Date(m[3] ? +m[3] : h.getFullYear(), MESES.indexOf(m[2]), +m[1]); if (!m[3] && d < h) d.setFullYear(d.getFullYear() + 1); return d.getDate() === +m[1] ? d : null;
    }
    if ((m = t.match(new RegExp(`\\b(?:el |este |el proximo |proximo )?(${DIAS.join("|")})\\b`)))) { const k = DIAS.indexOf(m[1]); let n = (k - h.getDay() + 7) % 7; if (n === 0) n = 7; h.setDate(h.getDate() + n); return h; }
    return null;
  }
  /** «a las 6 de la mañana», «6:30 pm», «a las 18:15» → [h, m] o null */
  function horaDe(t) {
    const m = t.match(/\b(?:a las?|alas|las)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m|de la manana|de la tarde|de la noche)?\b/g);
    const r = String(t).match(/\b(?:a las?\s+)(\d{1,2})(?::(\d{2}))?\s*(am|pm|a m|p m|de la manana|de la tarde|de la noche)?/) || String(t).match(/\b(\d{1,2}):(\d{2})\s*(am|pm|a m|p m)?\b/) || String(t).match(/\b(\d{1,2})\s*(am|pm|a m|p m)\b/);
    void m;
    if (!r) return null;
    let h = +r[1], mi = r[2] && /^\d{2}$/.test(r[2]) ? +r[2] : 0; const per = (r[3] || (r[2] && !/^\d{2}$/.test(r[2]) ? r[2] : "")) || "";
    if (/pm|p m|tarde|noche/.test(per) && h < 12) h += 12;
    if (/am|a m|manana/.test(per) && h === 12) h = 0;
    return h <= 23 && mi <= 59 ? [h, mi] : null;
  }
  /** «300 mil», «1,2 millones», «$1.200.000», «15 mil pesos», «15000» → número */
  function pesos(s) {
    const t = norm(s).replace(/\$/g, " ");
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(millones|millon|mil|k)\b/);
    if (m) { const n = parseFloat(m[1].replace(",", ".")); return Math.round(n * (/mill/.test(m[2]) ? 1e6 : 1e3)); }
    m = String(s).match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/);
    return m ? +m[1].replace(/[.,]/g, "") : null;
  }
  const cop = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");

  // ======================================================================== 1. ORGANIZAR EL DÍA
  /** «llamar al banco, hacer mercado 1 hora y estudiar 2 horas» → [{t, min}] (sin tiempo: 30 min) */
  function tareasDe(text) {
    return String(text || "").split(/\s*(?:,|;|\by\b|\btambien\b|\bluego\b|\bdespues\b)\s*/i).map((x) => x.trim()).filter((x) => x.length > 2).slice(0, 12).map((x) => {
      const n = norm(x); let min = 30;
      const m = n.match(/\b(?:por |durante |unos |unas )?(\d+(?:[.,]\d+)?|una|un|media|dos|tres|cuatro)\s*(horas?|h|minutos?|min)\b/) || n.match(/\b(media hora|hora y media)\b/);
      if (m) { if (m[1] === "media hora") min = 30; else if (m[1] === "hora y media") min = 90; else { const v = num(m[1]); min = Math.round((v == null ? 1 : v) * (/^h/.test(m[2]) ? 60 : 1)); } }
      const t = x.replace(/\s*(?:por |durante |unos |unas )?(?:\d+(?:[.,]\d+)?|una|un|media|dos|tres|cuatro)\s*(?:horas?|h|minutos?|min)\b/i, "").replace(/\s*(?:media hora|hora y media)\b/i, "").trim();
      return { t: t.charAt(0).toUpperCase() + t.slice(1), min: Math.max(10, Math.min(240, min)) };
    }).filter((x) => x.t);
  }
  const PARTES = { dia: [7, 21], manana: [7, 12], tarde: [13, 19], noche: [19, 22] };
  /** «organiza mi tarde: …», «planea mi día», «reorganiza mi día» */
  function organizarIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    if (/^(?:reorganiza|reacomoda|replanea|vuelve a organizar)\s+(?:mi|el)\s+(?:dia|tarde|plan)$/.test(t)) return { od: "replan" };
    if ((m = t.match(/^(?:organiza(?:me)?|planea(?:me)?|ordena(?:me)?|arma(?:me)?)\s+(?:mi|el)\s+(dia|tarde|manana|noche)(?:\s+de hoy)?(?:\s+(?:con\s+)?(.+))?$/))) {
      const resto = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : raw.replace(/^[\s\S]*?\b(?:d[ií]a|tarde|mañana|manana|noche)\b(?:\s+de hoy)?\s*(?:con\s+)?/i, "").trim();
      return { od: "plan", parte: m[1], tareas: m[2] ? tareasDe(resto || m[2]) : [] };
    }
    return null;
  }
  /**
   * Bloques para las tareas en los huecos libres del calendario (con 10 min entre una cosa y otra).
   * eventos: [{inicio, fin, titulo}] · tareas: [{t, min}] · → {bloques:[{t, ini, fin}], sobran:[...]}
   */
  function planDia(eventos, tareas, now, parte) {
    const [hi, hf] = PARTES[parte || "dia"] || PARTES.dia;
    const base = dia0(now || Date.now());
    let ini = Math.max(new Date(base).setHours(hi, 0, 0, 0), Math.ceil(((now || Date.now()) + 5 * 60000) / (15 * 60000)) * 15 * 60000);
    const fin = new Date(base).setHours(hf, 0, 0, 0);
    const ocup = (eventos || []).filter((e) => !e.todoElDia && e.fin > ini && e.inicio < fin).map((e) => [e.inicio - 10 * 60000, e.fin + 10 * 60000]).sort((a, b) => a[0] - b[0]);
    const huecos = []; let c = ini;
    ocup.forEach(([a, b]) => { if (a > c) huecos.push([c, a]); c = Math.max(c, b); });
    if (fin > c) huecos.push([c, fin]);
    const bloques = [], sobran = [];
    (tareas || []).forEach((tk) => {
      const d = tk.min * 60000;
      const h = huecos.find(([a, b]) => b - a >= d);
      if (!h) { sobran.push(tk); return; }
      bloques.push({ t: tk.t, ini: h[0], fin: h[0] + d });
      h[0] += d + 10 * 60000;
    });
    return { bloques: bloques.sort((a, b) => a.ini - b.ini), sobran };
  }
  function planTexto(p, eventos) {
    const l = p.bloques.map((b) => ({ ini: b.ini, txt: `- **${hhmm(b.ini)}–${hhmm(b.fin)}** ${b.t}` })).concat((eventos || []).filter((e) => !e.todoElDia).map((e) => ({ ini: e.inicio, txt: `- ${hhmm(e.inicio)}–${hhmm(e.fin)} 📅 ${e.titulo}` }))).sort((a, b) => a.ini - b.ini);
    let t = l.length ? "🗓️ **Así te propongo el día:**\n" + l.map((x) => x.txt).join("\n") : "🗓️ No hay nada que organizar.";
    if (p.sobran.length) t += `\n\n⚠️ No alcanzó el tiempo para: ${p.sobran.map((x) => x.t).join(", ")}. ¿Lo pasamos para mañana?`;
    return t;
  }

  // ======================================================================== 2. CHOQUES EN LA AGENDA
  /** Dos citas que se cruzan, o con muy poco tiempo para ir de un lugar a otro. */
  function conflictos(eventos, minTraslado) {
    const l = (eventos || []).filter((e) => !e.todoElDia).slice().sort((a, b) => a.inicio - b.inicio), out = [];
    for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) {
      const a = l[i], b = l[j];
      if (b.inicio < a.fin) out.push({ a, b, tipo: "cruce" });
      else if (j === i + 1 && a.lugar && b.lugar && norm(a.lugar) !== norm(b.lugar) && b.inicio - a.fin < (minTraslado || 30) * 60000) out.push({ a, b, tipo: "apretado", min: Math.round((b.inicio - a.fin) / 60000) });
    }
    return out;
  }
  const conflictosTexto = (c) => !c.length ? "✅ No veo choques en tu agenda." : "⚠️ **Ojo con tu agenda:**\n" + c.map((x) => x.tipo === "cruce" ? `- «${x.a.titulo}» (${hhmm(x.a.inicio)}) se cruza con «${x.b.titulo}» (${hhmm(x.b.inicio)}).` : `- Entre «${x.a.titulo}» y «${x.b.titulo}» solo hay ${x.min} min para ir de ${x.a.lugar} a ${x.b.lugar}.`).join("\n");
  function agendaIntent(text, now) {
    const t = lead(norm(text));
    if (/^(?:tengo|hay)\s+(?:choques|cruces|algo que se cruce|citas que se crucen)(?:\s+en (?:mi|la) agenda)?(?:\s+(?:hoy|manana|esta semana))?$|^revisa (?:mi|la) agenda(?: de (?:hoy|manana))?$|^se me cruza algo(?: hoy| manana)?$/.test(t)) {
      const d = diaDe(t, now) || dia0(now || Date.now()); return { ag: "choques", fecha: iso(d) };
    }
    return null;
  }

  // ======================================================================== 3. HORA DE SALIR
  function salirIntent(text) {
    const t = lead(norm(text)); let m;
    if (/^(?:avisame|dime|recuerdame)\s+(?:cuando|a que hora)\s+(?:salir|debo salir|tengo que salir|salgo)(?:\s+para mis citas)?$|^activa (?:el aviso de )?(?:la )?hora de salir$/.test(t)) return { hs: "on" };
    if (/^(?:quita|desactiva|apaga)\s+(?:el aviso de )?(?:la )?hora de salir$/.test(t)) return { hs: "off" };
    if ((m = t.match(/^(?:a que hora|cuando)\s+(?:salgo|debo salir|tengo que salir|me voy)\s+(?:para|a)\s+(?:la |el |mi )?(.+)$/))) return { hs: "cuando", q: m[1] };
    return null;
  }
  const PROMPT_TRAYECTO = (desde, hacia, modo, hora) => `¿Cuántos minutos se demora ir en ${modo || "carro"} desde las coordenadas ${desde} hasta «${hacia}» (Colombia), saliendo hoy cerca de las ${hora}? Ten en cuenta el tráfico típico de esa hora. Responde SOLO con una línea: MINUTOS: <número>.`;
  function minutosDe(txt) { const m = String(txt || "").match(/MINUTOS:\s*(\d{1,3})/i) || String(txt || "").match(/(\d{1,3})\s*(?:minutos|min)\b/i); const n = m ? +m[1] : null; return n && n > 0 && n < 300 ? n : null; }
  /** Cuándo avisar: inicio - trayecto - 10 min de colchón. */
  const horaSalida = (inicio, min) => inicio - (min + 10) * 60000;

  // ======================================================================== 4. TEMAS QUE SIGO
  function temasIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:sigueme|seguime|sigue|monitorea|vigila)\s+(?:el tema (?:de|del)|las noticias (?:de|del|sobre)|lo (?:de|del)|todo lo (?:de|del))\s+(.{2,60})$/))) { const q = raw.replace(/^[\s\S]*?\b(?:tema|noticias|lo)\s+(?:de|del|sobre)\s+/i, "").trim().replace(/[?.!]+$/, ""); return { te: "seguir", q: q || m[1] }; }
    if ((m = t.match(/^(?:deja de seguir|ya no sigas)\s+(?:el tema (?:de|del)\s+)?(.{2,60})$|^quita el tema (?:de|del)\s+(.{2,60})$/))) return { te: "quitar", q: m[1] || m[2] };
    if (/^(?:mis temas|que temas sigo|temas que sigo)$/.test(t)) return { te: "ver" };
    if (/^(?:resumen|novedades|que hay de nuevo)\s+(?:de|en)\s+mis temas$|^como van mis temas$/.test(t)) return { te: "resumen" };
    return null;
  }
  const PROMPT_TEMAS = (temas, hoy) => `Hoy es ${hoy}. Para cada tema, busca en internet lo más importante de las últimas 24 horas y escribe 2 o 3 frases claras en español de Colombia, con la fuente entre paréntesis. Si es un tema político, sé neutral y muestra las distintas posturas. Si no hay nada nuevo, dilo en una frase.\nTemas: ${temas.join("; ")}\nFormato: un título con emoji por tema y debajo el resumen.`;

  // ======================================================================== 5. ¿QUÉ COCINO CON ESTO?
  function cocinaIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if (/^que (?:cocino|puedo cocinar|preparo|hago de comer|hago de almuerzo|hago de cena)\s+con\s+(?:esto|lo que tengo|lo que hay(?: en la nevera)?|lo de la nevera)$|^mira (?:mi|la) nevera(?: y dime que cocino)?$/.test(t)) return { co: "foto" };
    if ((m = t.match(/^que (?:cocino|puedo cocinar|preparo|hago)\s+con\s+(.{3,})$/))) return { co: "texto", ingredientes: raw.replace(/^[\s\S]*?\bcon\s+/i, "").replace(/[?]+$/, "").trim() };
    return null;
  }
  const PROMPT_COCINA = (ing) => `${ing ? "Tengo esto: " + ing + "." : "Mira la foto (nevera o alacena) y di qué ingredientes ves."} Propón 3 recetas caseras colombianas o sencillas que se puedan hacer con eso (puedo tener sal, aceite, ajo y cebolla). Responde SOLO JSON: {"veo":["…"],"recetas":[{"nombre":"…","minutos":30,"usa":["…"],"falta":["… (opcional)"]}]}`;
  function recetasValidas(j) {
    if (!j || !Array.isArray(j.recetas)) return null;
    const r = j.recetas.filter((x) => x && x.nombre).slice(0, 4).map((x) => ({ nombre: String(x.nombre).slice(0, 60), minutos: Math.max(5, Math.min(240, +x.minutos || 30)), usa: (x.usa || []).map(String).slice(0, 8), falta: (x.falta || []).map(String).slice(0, 5) }));
    return r.length ? { veo: (j.veo || []).map(String).slice(0, 15), recetas: r } : null;
  }

  // ======================================================================== 6. MODO VIAJE
  function viajeIntent(text, now) {
    const t = lead(norm(text)); let m;
    if ((m = t.match(/^(?:mi vuelo|tengo (?:un )?vuelo|el vuelo)\s+(?:es\s+)?(?:el\s+)?([a-z]{2})\s?(\d{2,4})\b(.*)$/))) {
      const resto = m[3] || ""; const d = diaDe(resto, now); const h = horaDe(resto);
      const dest = (resto.match(/\b(?:a|para|hacia)\s+([a-z ]{3,30}?)(?:\s+(?:el|a las|manana|hoy|pasado)\b|$)/) || [])[1];
      return { vu: "agregar", vuelo: (m[1] + m[2]).toUpperCase(), fecha: d ? iso(d) : null, hora: h, destino: dest ? dest.trim() : "" };
    }
    if (/^(?:como va|como esta|esta a tiempo|se retraso)\s+(?:mi|el)\s+vuelo$|^estado de mi vuelo$/.test(t)) return { vu: "estado" };
    if ((m = t.match(/^(?:hazme |arma(?:me)? |dame )?(?:la |una )?lista (?:para empacar|de (?:la )?maleta|de viaje)\s+(?:para|a)\s+([a-z ]{3,30}?)(?:\s+(?:por\s+)?(\d+|\w+)\s+dias?)?$|^que (?:empaco|llevo|meto en la maleta)\s+para\s+([a-z ]{3,30}?)(?:\s+(?:por\s+)?(\d+|\w+)\s+dias?)?$/))) return { vu: "maleta", destino: (m[1] || m[3]).trim(), dias: num(m[2] || m[4]) || 3 };
    if (/^mis (?:viajes|vuelos)$/.test(t)) return { vu: "ver" };
    return null;
  }
  /** Avisos del vuelo: check-in (24 h antes) y salir al aeropuerto (2 h 30 antes). Sin hora: el día anterior a las 9 a. m. */
  function avisosVuelo(v, now) {
    if (!v.fecha) return [];
    const [h, m] = v.hora || [9, 0];
    const sale = new Date(v.fecha + "T00:00:00"); sale.setHours(h, m, 0, 0);
    const out = [];
    if (v.hora) {
      out.push({ at: sale.getTime() - 24 * 3600e3, texto: `✈️ Ya puedes hacer el check-in del vuelo ${v.vuelo} (sale mañana a las ${hhmm(sale)}).` });
      out.push({ at: sale.getTime() - 150 * 60000, texto: `🧳 Sal para el aeropuerto: tu vuelo ${v.vuelo} sale a las ${hhmm(sale)} (llega 2 horas antes si es nacional, 3 si es internacional).` });
    } else { const d = new Date(sale); d.setDate(d.getDate() - 1); d.setHours(9, 0, 0, 0); out.push({ at: d.getTime(), texto: `✈️ Mañana viajas en el vuelo ${v.vuelo}: haz el check-in y revisa la hora de salida.` }); }
    return out.filter((x) => x.at > (now || Date.now()));
  }
  const PROMPT_MALETA = (dest, dias, clima) => `Voy a ${dest} por ${dias} días.${clima ? " El pronóstico allá: " + clima + "." : ""} Haz una lista para empacar, corta y práctica (máximo 25 cosas), incluyendo documentos (cédula o pasaporte, tiquetes) y cargadores. Responde SOLO JSON: {"items":["…"]}`;

  // ======================================================================== 7. ALERTAS DE PRECIO
  function precioIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:avisame|alertame)\s+(?:cuando|si)\s+(?:el |la |los |las |unos |unas )?(.+?)\s+(?:baje|bajen|este|esten|cueste|cuesten|llegue|lleguen)\s+(?:a |de |por debajo de |a menos de |menos de )?(.+)$/))) {
      const max = pesos(m[2]); if (!max) return null;
      const q = raw.replace(/^[\s\S]*?\b(?:cuando|si)\s+(?:el |la |los |las |unos |unas )?/i, "").split(/\s+(?:baje|bajen|esté|este|estén|esten|cueste|cuesten|llegue|lleguen)\b/i)[0].trim();
      return { pr: "agregar", q, max };
    }
    if (/^(?:mis alertas de precio|como van (?:mis alertas de precio|los precios que sigo)|que precios sigo)$/.test(t)) return { pr: "ver" };
    if ((m = t.match(/^(?:quita|borra|elimina)\s+la alerta (?:de precio )?(?:de|del)\s+(.+)$/))) return { pr: "quitar", q: m[1] };
    if ((m = t.match(/^(?:revisa|busca|mira)\s+(?:ya\s+)?el precio (?:de|del)\s+(.+?)(?:\s+ahora)?$/))) return { pr: "ahora", q: m[1] };
    return null;
  }
  const PROMPT_PRECIO = (q) => `Busca en internet el precio más bajo HOY en Colombia (pesos colombianos) de: ${q}. Solo tiendas reconocidas y producto nuevo. Responde en dos líneas: PRECIO: <número sin puntos> y TIENDA: <nombre>. Si no encuentras, PRECIO: 0.`;
  function precioDe(txt) { const p = String(txt || "").match(/PRECIO:\s*\$?\s*([\d.,]+)/i), s = String(txt || "").match(/TIENDA:\s*(.+)/i); const n = p ? +p[1].replace(/[.,](?=\d{3}\b)/g, "").replace(",", ".") : 0; return { precio: n > 0 ? Math.round(n) : 0, tienda: s ? s[1].trim().slice(0, 60) : "" }; }

  // ======================================================================== 8. HOJAS DE CÁLCULO POR VOZ
  const COLS = ["Fecha", "Cantidad", "Descripción", "Valor"];
  /** «3 arepas, 15 mil» → {cantidad: 3, desc: "arepas", valor: 15000} */
  function filaDe(text) {
    let s = String(text || "").trim(), valor = 0;
    const mv = s.match(/(?:^|[,\s])(?:por|a|de|en|valor)?\s*(\$\s*)?(\d+(?:[.,]\d+)*)\s*(mil|millones|millón|millon|k)?\s*(?:pesos)?\s*$/i);
    if (mv && (mv[1] || mv[3] || /[.,]\d{3}\b/.test(mv[2]) || /,\s*(?:\$\s*)?[\d.,]+\s*(?:mil|millones|millón|millon|k)?\s*(?:pesos)?\s*$/i.test(s) || +mv[2].replace(/[.,]/g, "") >= 1000)) {
      valor = pesos((mv[1] || "") + mv[2] + (mv[3] ? " " + mv[3] : "")) || 0; s = s.slice(0, mv.index).replace(/[,\s]+$/, "");
    }
    let cantidad = 1; const m = s.match(/^(\d+|una?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.+)$/i);
    if (m) { cantidad = num(norm(m[1])) || 1; s = m[2]; }
    return { cantidad, desc: s.replace(/^[,:\s]+|[,:\s]+$/g, "") || "—", valor };
  }
  function hojaIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    const nombre = (s) => norm(s).replace(/^(?:mi |la |las )/, "").replace(/^hoja (?:de |del )?/, "").trim();
    if ((m = raw.match(/^\s*(?:jarvis[,\s]+)?(?:anota|apunta|agrega|registra|pon)\s+en\s+(?:mi\s+|la\s+)?hoja\s+(?:de\s+|del\s+)?([\wáéíóúñ ]{2,30}?)\s*[:,]\s*(.+)$/i))) return { hj: "anotar", hoja: nombre(m[1]), fila: filaDe(m[2]) };
    if ((m = t.match(/^(?:cuanto llevo|cuanto va|cual es el total|total)\s+(?:en|de)\s+(?:mi |la )?hoja\s+(?:de |del )?(.+?)(?:\s+(?:hoy|este mes))?$/))) return { hj: "total", hoja: nombre(m[1]), hoy: /\bhoy\b/.test(t) };
    if ((m = t.match(/^(?:muestrame|abre|ver|ensename)\s+(?:mi |la )?hoja\s+(?:de |del )?(.+)$/))) return { hj: "ver", hoja: nombre(m[1]) };
    if ((m = t.match(/^(?:exporta|pasa|descarga|comparte)\s+(?:mi |la )?hoja\s+(?:de |del )?(.+?)\s+(?:a|en|como)\s+(excel|google(?: sheets| drive)?|sheets|drive)$/))) return { hj: /excel/.test(m[2]) ? "excel" : "google", hoja: nombre(m[1]) };
    if ((m = t.match(/^(?:borra|quita|deshaz)\s+(?:la ultima fila|lo ultimo)\s+(?:de|en)\s+(?:mi |la )?hoja\s+(?:de |del )?(.+)$/))) return { hj: "deshacer", hoja: nombre(m[1]) };
    if (/^(?:mis hojas|que hojas tengo)$/.test(t)) return { hj: "lista" };
    return null;
  }
  function totales(hoja, now) {
    const h = iso(dia0(now || Date.now())), mes = h.slice(0, 7);
    const f = (hoja && hoja.filas) || [];
    const sum = (l) => l.reduce((s, r) => s + (+r[3] || 0), 0);
    return { total: sum(f), hoy: sum(f.filter((r) => r[0] === h)), mes: sum(f.filter((r) => String(r[0]).startsWith(mes))), filas: f.length };
  }
  const csvCelda = (v) => { const s = String(v == null ? "" : v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = (hoja) => [COLS].concat((hoja && hoja.filas) || []).map((r) => r.map(csvCelda).join(",")).join("\n");
  const hojaTabla = (nombre, hoja) => { const f = (hoja.filas || []).slice(-15); return `📊 **Hoja de ${nombre}** (${(hoja.filas || []).length} filas)\n\n| ${COLS.join(" | ")} |\n|${COLS.map(() => "---").join("|")}|\n` + f.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${cop(r[3])} |`).join("\n"); };
  /** El cuerpo multipart para subir a Google Drive convirtiendo (CSV → Hoja de cálculo; HTML → Documento). */
  function multipart(meta, mime, contenido, borde) {
    const b = borde || "jarvis" + Date.now();
    return { borde: b, cuerpo: `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: ${mime}; charset=UTF-8\r\n\r\n${contenido}\r\n--${b}--` };
  }

  // ======================================================================== 9. GOOGLE DOCS Y NOTION
  function documentoIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:guarda|pasa|sube|manda)\s+(?:el documento|la nota|el resumen|esto|eso|lo anterior)(?:\s+(?:de |del |llamado |que se llama )?(.+?))?\s+(?:a|en)\s+(google docs|google drive|drive|docs|notion)$/))) {
      const q = m[1] || ""; return { dc: /notion/.test(m[2]) ? "notion" : "docs", q: /^(?:esto|eso|lo anterior)$/.test(q) ? "" : q, ultimo: /\b(?:esto|eso|lo anterior)\b/.test(t) && !m[1] };
    }
    void raw;
    return null;
  }
  /** El id de una página de Notion a partir de su enlace (los 32 caracteres del final). */
  function notionId(url) { const m = String(url || "").replace(/-/g, "").match(/([0-9a-f]{32})(?:\?|$|#)/i) || String(url || "").replace(/-/g, "").match(/([0-9a-f]{32})/i); if (!m) return null; const x = m[1].toLowerCase(); return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`; }
  /** Bloques de párrafo para Notion (máx. 2000 letras cada uno, 100 bloques). */
  function notionBloques(texto) {
    const out = [];
    String(texto || "").split(/\n{2,}/).forEach((p) => { for (let i = 0; i < p.length && out.length < 100; i += 1900) out.push({ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: p.slice(i, i + 1900) } }] } }); });
    return out;
  }
  const notionPagina = (padre, titulo, texto) => ({ parent: { page_id: padre }, properties: { title: { title: [{ type: "text", text: { content: String(titulo || "Nota de Jarvis").slice(0, 200) } }] } }, children: notionBloques(texto) });
  /** Markdown sencillo → HTML (para que Google Docs lo convierta con títulos, negritas y listas). */
  function mdHtml(md) {
    const lin = String(md || "").split("\n"); const out = []; let lista = false;
    lin.forEach((l) => {
      const inl = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
      if (/^\s*[-*]\s+/.test(l)) { if (!lista) { out.push("<ul>"); lista = true; } out.push(`<li>${inl(l.replace(/^\s*[-*]\s+/, ""))}</li>`); return; }
      if (lista) { out.push("</ul>"); lista = false; }
      const h = l.match(/^(#{1,3})\s+(.*)$/); if (h) { out.push(`<h${h[1].length}>${inl(h[2])}</h${h[1].length}>`); return; }
      if (l.trim()) out.push(`<p>${inl(l)}</p>`);
    });
    if (lista) out.push("</ul>");
    return `<html><body>${out.join("")}</body></html>`;
  }

  // ======================================================================== 10. NO PERDER EL CONTACTO
  function contactoIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    if ((m = t.match(/^(?:recuerdame|avisame)\s+(?:hablar|llamar|escribir(?:le)?|visitar)\s+(?:con\s+|a\s+)?(.+?)\s+cada\s+(\d+|una?|dos|tres|cuatro|seis)?\s*(dias?|semanas?|mes(?:es)?|quincena)$/))) {
      const n = num(m[2] || "1") || 1, dias = /sem/.test(m[3]) ? n * 7 : /mes/.test(m[3]) ? n * 30 : /quincena/.test(m[3]) ? 15 : n;
      const nombre = raw.replace(/^[\s\S]*?\b(?:hablar|llamar|escribirle|escribir|visitar)\s+(?:con\s+|a\s+)?/i, "").split(/\s+cada\s+/i)[0].trim();
      return { ct: "agregar", nombre, dias };
    }
    if ((m = t.match(/^ya (?:hable|llame|le escribi|visite)\s+(?:con\s+|a\s+)?(.+)$/))) return { ct: "hecho", nombre: m[1] };
    if (/^con quien no he hablado(?: hace rato)?$|^a quien (?:debo|tengo que) llamar$|^mis contactos pendientes$/.test(t)) return { ct: "ver" };
    if ((m = t.match(/^(?:ya no me recuerdes|deja de recordarme)\s+(?:hablar con\s+|llamar a\s+)?(.+)$/))) return { ct: "quitar", nombre: m[1] };
    return null;
  }
  const contactoPendiente = (c, now) => Math.floor(((now || Date.now()) - (c.ultimo || c.desde || 0)) / 864e5) >= c.dias;

  // ======================================================================== 11. RUTINA DE SUEÑO
  function suenoIntent(text) {
    const t = lead(norm(text)); let m;
    if ((m = t.match(/^(?:activa|pon|programa)\s+(?:la\s+)?rutina de sueno(?:\s+(?:a las|para las)\s+(.+))?$|^(?:quiero )?(?:acostarme|dormirme)\s+(?:a las|tipo)\s+(.+)$/))) { const h = horaDe("a las " + (m[1] || m[2] || "10 de la noche")); const dicho = m[1] || m[2] || ""; return { su: "on", hora: h ? `${pad(h[0] >= 5 && h[0] < 12 && !/manana|am\b|a m\b/.test(dicho) ? h[0] + 12 : h[0])}:${pad(h[1])}` : "22:00" }; }
    if (/^(?:quita|desactiva|apaga)\s+(?:la\s+)?rutina de sueno$/.test(t)) return { su: "off" };
    return null;
  }

  const API = { norm, diaDe, horaDe, pesos, cop, hhmm, tareasDe, organizarIntent, planDia, planTexto, conflictos, conflictosTexto, agendaIntent,
    salirIntent, PROMPT_TRAYECTO, minutosDe, horaSalida, temasIntent, PROMPT_TEMAS, cocinaIntent, PROMPT_COCINA, recetasValidas,
    viajeIntent, avisosVuelo, PROMPT_MALETA, precioIntent, PROMPT_PRECIO, precioDe, COLS, filaDe, hojaIntent, totales, csv, hojaTabla, multipart,
    documentoIntent, notionId, notionBloques, notionPagina, mdHtml, contactoIntent, contactoPendiente, suenoIntent, iso };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL22 = API;
})(typeof window !== "undefined" ? window : globalThis);
