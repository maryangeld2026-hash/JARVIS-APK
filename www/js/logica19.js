/* Jarvis para Android 3.30 · lógica pura (se prueba con node). Lo nuevo de los asistentes de 2026, a la manera de Jarvis:
   1. Conversación en vivo con Gemini 3.8 Live (y sigue hablando mientras hace lo que le pediste).
   2. Dictado ordenado (como Rambler): sin muletillas, sin «perdón, quise decir», con párrafos y listas.
   3. Widget a tu medida (como «Create My Widget»): lo describes y Jarvis lo arma (sin ejecutar nada de la IA).
   4. Cuidar el celular: espacio, qué apps ven tu ubicación, silencio con excepciones.
   5. Sugerencias desde tus notificaciones (citas, direcciones, listas), siempre preguntando.
   6. Búsqueda en tus cosas hablando normal (por palabras y por significado, dentro del celular).
   Y: pedidos con el agente (hasta antes de pagar), contestador de llamadas por mensaje, Gemini Nano. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|hola jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // ======================================================================== 1. CONVERSACIÓN EN VIVO
  /** «gemini-3.8-live» → 3.8; «gemini-2.5-flash-native-audio-…» → 2.5 */
  function versionLive(id) { const m = String(id || "").match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }
  /**
   * El mejor modelo en vivo de tu cuenta: el más nuevo; sin «exp/preview» si hay otro igual de nuevo;
   * «pensar» (Extended Thinking) solo si lo pediste (es más lento). Los de solo transcribir no sirven para conversar.
   */
  function rankLive(ids, pref) {
    const pensar = pref === "pensar";
    const l = (ids || []).filter((x) => x && !/transcribe|tts\b|-tts|embedding/.test(x));
    const puntos = (x) => {
      let p = versionLive(x) * 100;
      if (/native-audio/.test(x)) p += 5;                       // (en 2.5 el de audio nativo es el que conversa mejor)
      if (/flash/.test(x)) p += 2;
      if (/exp|preview/.test(x)) p -= 3;
      if (/extended-thinking|thinking/.test(x)) p += pensar ? 20 : -20;
      if (/lite/.test(x)) p -= 1;
      return p;
    };
    return l.slice().sort((a, b) => puntos(b) - puntos(a) || b.localeCompare(a));
  }
  /** ¿Puede seguir hablando mientras hace la orden (llamado de funciones asíncrono)? 2.5 con audio nativo y los 3.x. */
  const liveAsincrono = (id) => versionLive(id) >= 3 || (versionLive(id) >= 2.5 && /native-audio/.test(id));
  /** La herramienta jarvis_orden (y si el modelo puede, «sin bloquear»: sigue la charla mientras Jarvis la hace). */
  function herramientaLive(asinc) {
    const f = { name: "jarvis_orden", description: "Hace una orden de la app Jarvis del celular (recordatorios, alarmas, temporizador, clima, abrir una app, llamar o escribir a un contacto, linterna, volumen; y de clase: escoger estudiante, grupos, pasar lista, quiz…). Devuelve lo que respondió la app.",
      parameters: { type: "OBJECT", properties: { orden: { type: "STRING", description: "La orden en español, como la diría la persona. Ej.: «pon 5 minutos», «escoge un estudiante de 7A»." } }, required: ["orden"] } };
    if (asinc) f.behavior = "NON_BLOCKING";
    return f;
  }
  /** La respuesta de la herramienta (en asíncrono: que la cuente cuando haya una pausa, sin cortar lo que está diciendo). */
  function respuestaLive(fc, res, asinc) {
    const response = { resultado: res };
    if (asinc) response.scheduling = "WHEN_IDLE";
    return { id: fc.id, name: fc.name, response };
  }

  // ======================================================================== 2. DICTADO ORDENADO
  /** «voy a dictar», «modo dictado», «dictado largo», «toma dictado de un acta», «dicta mis observaciones» → {dl, tipo} */
  function dictadoLargoIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:modo dictado|dictado largo|dictado ordenado|voy a dictar(?: algo)?|quiero dictar(?: algo)?|toma(?:me)? dictado|empieza (?:el )?dictado)$/.test(t)) return { dl: true, tipo: "texto" };
    if ((m = t.match(/^(?:toma(?:me)? dictado|voy a dictar|quiero dictar|dicta(?:r)?|dictado largo|modo dictado)\s+(?:de\s+|para\s+)?(?:un|una|el|la|mis|mi|las|los)?\s*(acta|observaciones?|notas?(?: de clase)?|informe|correo|carta|resumen|lista|reporte|planeacion|texto|mensaje)\b/))) return { dl: true, tipo: m[1] };
    return null;
  }
  /** «punto y aparte», «nuevo párrafo», «nueva línea», «punto y seguido», «punto final» dichos en voz alta. */
  function comandosVoz(t) {
    return String(t || "")
      .replace(/\s*,?\s*\b(?:punto y aparte|nuevo p[aá]rrafo)\b[.,]?\s*/gi, ".\n\n")
      .replace(/\s*,?\s*\b(?:nueva l[ií]nea|nuevo rengl[oó]n|siguiente rengl[oó]n)\b[.,]?\s*/gi, "\n")
      .replace(/\s*,?\s*\bpunto y seguido\b[.,]?\s*/gi, ". ")
      .replace(/\s*,?\s*\bpunto final\b[.,]?\s*$/gi, ".")
      .replace(/\.(\s*\.)+/g, ".").replace(/^\.\s*/, "").replace(/\n\.\n/g, "\n\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  /** «el martes, perdón, el miércoles» → «el miércoles»; «a las 3, digo, a las 4» → «a las 4». */
  function autocorrecciones(t) {
    let s = String(t || "");
    const re = /((?:[^\s,.;:]+\s+){0,5}?[^\s,.;:]+)\s*,?\s+(?:perd[oó]n|digo|mejor dicho|quise decir|no,? mejor|o sea no|corrijo)\s*,?\s+((?:[^\s,.;:]+\s*){1,6})/i;
    for (let k = 0; k < 6; k++) {
      const m = s.match(re); if (!m) break;
      const nuevo = m[2].trim().split(/\s+/), viejo = m[1].trim().split(/\s+/);
      // lo que se corrige empieza donde empieza la corrección («el martes» ↔ «el miércoles»); si no se parecen, solo la última palabra
      const n0 = norm(nuevo[0]);
      let i = -1; for (let k2 = viejo.length - 1; k2 >= 0; k2--) if (norm(viejo[k2]) === n0) { i = k2; break; }
      const quedan = viejo.slice(0, i >= 0 ? i : viejo.length - 1);
      s = s.slice(0, m.index) + (quedan.length ? quedan.join(" ") + " " : "") + m[2].trim() + (/\s$/.test(m[2]) ? " " : "") + s.slice(m.index + m[0].length);
    }
    return s.replace(/\s+([,.])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  }
  const MULETILLAS = /\b(?:eh+|em+|mmm+|este+|o sea|pues nada|como que|tipo que|digamos que|bueno pues|osea|ajá|aja|eeh)\b[,]?\s*/gi;
  /** La versión ordenada sin IA (sin internet y sin modelo): muletillas, correcciones, comandos y mayúsculas. */
  function ordenadoLocal(t) {
    let s = autocorrecciones(String(t || "").replace(MULETILLAS, " ").replace(/\b((?:[\wáéíóúñ]+\s+){0,2}[\wáéíóúñ]+)(?:\s+\1\b)+/gi, "$1").replace(/[ \t]{2,}/g, " "));
    s = comandosVoz(s);
    s = s.replace(/(^|[.!?]\s+|\n)([a-záéíóúñ])/g, (x, a, b) => a + b.toUpperCase());
    if (s && !/[.!?:]$/.test(s)) s += ".";
    return s;
  }
  /** Para la IA: dejarlo bien escrito sin inventar. */
  function promptOrdenado(texto, tipo) {
    return `Esto lo dije en voz alta (puede tener muletillas, repeticiones y correcciones como «perdón, quise decir…»). Déjalo como ${tipo && tipo !== "texto" ? "un/una " + tipo : "un texto"} bien escrito en español:\n` +
      "- quita muletillas, repeticiones y lo que corregí (deja solo la versión corregida);\n- respeta mis ideas y mis palabras: no inventes nada ni agregues saludos;\n" +
      "- separa en párrafos; si enumero cosas, ponlas en una lista con guiones; si dije «punto y aparte» o «nueva línea», respétalo;\n- devuelve SOLO el texto final.\n\n" + texto;
  }
  /** Para transcribir el audio con Gemini (el de transcribir si la cuenta lo tiene; si no, el que haya). */
  function modeloTranscribir(ids) {
    const l = (ids || []).filter((x) => /gemini/.test(x) && !/live|tts|embedding|image/.test(x));
    return l.find((x) => /transcribe/.test(x)) || l.find((x) => /flash-lite/.test(x)) || l.find((x) => /flash/.test(x)) || l[0] || "gemini-flash-latest";
  }
  /** Un WAV (16 bits) en base64 a partir de muestras en [-1, 1]. Para las pruebas y por si el celular manda PCM. */
  function promptTranscribir(tipo) {
    return "Transcribe este audio en español, palabra por palabra pero ya limpio: sin muletillas («eh», «este», «o sea»), sin repeticiones, y si me corrijo («perdón», «quise decir») deja solo lo corregido. " +
      `Ponle puntuación y párrafos; si enumero cosas, haz una lista con guiones. Es ${tipo && tipo !== "texto" ? "un/una " + tipo : "un dictado"}. Devuelve SOLO el texto, sin comentarios.`;
  }

  // ======================================================================== 3. WIDGET A TU MEDIDA
  const FUENTES = {
    pagos: [/\bpagos?\b|\bfacturas?\b|\bcuentas por pagar\b/, "Pagos del mes"], lista: [/\blista\b|\bmercado\b|\bcompras?\b/, "Lista del mercado"],
    gastos: [/\bgastos?\b|\bpresupuesto\b/, "Gastos del mes"], recordatorios: [/\brecordatorios?\b|\bpendientes\b/, "Recordatorios"],
    habitos: [/\bhabitos?\b|\brachas?\b/, "Mis rachas"], temporizadores: [/\btemporizador(?:es)?\b/, "Temporizadores"],
    cumple: [/\bcumpleanos\b|\bcumples?\b/, "Cumpleaños"], meds: [/\bmedicamentos?\b|\bremedios?\b|\bpastillas?\b/, "Medicamentos"],
    clase: [/\b(?:proxima |siguiente |mis )?clases?\b|\bhorario\b/, "Próxima clase"], tareas: [/\binvestigaciones?\b|\btareas largas\b/, "Investigaciones"],
    agenda: [/\bagenda\b|\bcalendario\b|\beventos?\b|\bcitas?\b/, "Agenda de hoy"],
  };
  /** «el 15 de diciembre», «15/12», «el viernes», «mañana», «2026-12-15» → "AAAA-MM-DD" (la próxima vez que llegue). */
  function fecha(s, now) {
    const t = norm(s), h = new Date(now || Date.now()); h.setHours(0, 0, 0, 0);
    let m;
    if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) return `${m[1]}-${m[2]}-${m[3]}`;
    if (/\bpasado manana\b/.test(t)) { h.setDate(h.getDate() + 2); return iso(h); }
    if (/\bmanana\b/.test(t)) { h.setDate(h.getDate() + 1); return iso(h); }
    if (/\bhoy\b/.test(t)) return iso(h);
    if ((m = t.match(new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${MESES.join("|")})(?:\\s+(?:de|del)\\s+(\\d{4}))?`)))) {
      const d = new Date(m[3] ? +m[3] : h.getFullYear(), MESES.indexOf(m[2]), +m[1]);
      if (!m[3] && d < h) d.setFullYear(d.getFullYear() + 1);
      return d.getDate() === +m[1] ? iso(d) : null;
    }
    if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : h.getFullYear();
      const d = new Date(y, +m[2] - 1, +m[1]);
      if (!m[3] && d < h) d.setFullYear(d.getFullYear() + 1);
      return d.getDate() === +m[1] ? iso(d) : null;
    }
    if ((m = t.match(new RegExp(`\\b(?:el |este |el proximo |proximo )?(${DIAS.join("|")})\\b`)))) {
      const k = DIAS.indexOf(m[1]); let n = (k - h.getDay() + 7) % 7; if (n === 0) n = 7;
      h.setDate(h.getDate() + n); return iso(h);
    }
    return null;
  }
  /** «Faltan 23 días para Navidad» */
  function cuentaTexto(etiqueta, f, now) {
    const h = new Date(now || Date.now()); h.setHours(0, 0, 0, 0);
    const [y, mo, d] = String(f || "").split("-").map(Number); if (!y) return etiqueta || "";
    const n = Math.round((new Date(y, mo - 1, d) - h) / 864e5);
    const e = etiqueta || "la fecha";
    return n > 1 ? `⏳ Faltan ${n} días para ${e}` : n === 1 ? `⏳ Mañana es ${e}` : n === 0 ? `🎉 ¡Hoy es ${e}!` : `✔️ ${e[0].toUpperCase() + e.slice(1)} fue hace ${-n} día${n === -1 ? "" : "s"}`;
  }
  /** «crea un widget con mis pagos y la cuenta regresiva para el cierre del periodo el 28 de noviembre» → {desc} (lo que no es de los de siempre). */
  function widgetLibreIntent(text) {
    const t = lead(norm(text));
    const m = t.match(/^(?:crea(?:me)?|haz(?:me)?|pon(?:me)?|arma(?:me)?|disena(?:me)?)\s+(?:un|otro|mi)\s+widget\s+(?:con|de|para|que (?:muestre|diga|tenga)|donde (?:vea|salga))\s+(.+)$/);
    if (!m) return null;
    return { wl: m[1] };
  }
  /** Sin IA: lo que se entiende de la descripción. → spec o null. */
  function widgetLocal(desc, now) {
    const t = norm(desc), bloques = [];
    let m;
    if ((m = t.match(/\b(?:cuenta regresiva|cuantos dias faltan|dias que faltan|cuanto falta)\s+(?:para|a|hasta)\s+(?:el |la |los |las |mi |mis )?(.+?)(?:\s+(?:que es |es )?(?:el|en|del?)\s+((?:\d{1,2}\s+de\s+\w+(?:\s+de\s+\d{4})?)|(?:\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)|(?:proximo\s+)?(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)))?(?:\s+y\s+.*)?$/))) {
      const f = m[2] ? fecha(m[2], now) : fecha(m[1], now);
      if (f) bloques.push({ cuenta: { etiqueta: m[1].replace(/\s+(?:el|en)\s+\d.*$/, "").trim(), fecha: f } });
    }
    for (const [k, [re]] of Object.entries(FUENTES)) if (re.test(t) && !(k === "clase" && /\bcuenta regresiva|faltan\b/.test(t) && !/\bproxima clase|mis clases|horario\b/.test(t))) bloques.push({ fuente: k });
    if (!bloques.length) return null;
    const titulo = bloques.length === 1 ? (bloques[0].cuenta ? "Cuenta regresiva" : FUENTES[bloques[0].fuente][1]) : "Mi resumen";
    return specValida({ titulo, bloques });
  }
  function widgetPrompt(desc, hoy) {
    return `Diseña un widget de pantalla de inicio para el asistente Jarvis con esta descripción: «${desc}». Hoy es ${hoy}.\n` +
      "Responde SOLO JSON: {\"titulo\":\"máx. 28 letras\",\"bloques\":[…],\"orden\":\"lo que Jarvis hace al tocarlo, en palabras (opcional)\"}.\n" +
      `Cada bloque es UNO de: {"fuente":"${Object.keys(FUENTES).join("|")}"} (datos que Jarvis ya tiene) · {"cuenta":{"etiqueta":"para qué","fecha":"AAAA-MM-DD"}} (días que faltan) · {"texto":"una frase fija, máx. 80 letras"}.\n` +
      "Máximo 4 bloques. Si piden algo que Jarvis no tiene (clima en vivo, noticias, acciones de la bolsa), usa un texto que lo diga o {\"error\":\"por qué\"}.";
  }
  /** Lo que diga la IA se revisa: solo fuentes conocidas, fechas reales, textos cortos. Nunca código. */
  function specValida(j) {
    if (!j || typeof j !== "object" || j.error) return null;
    const bloques = (Array.isArray(j.bloques) ? j.bloques : []).map((b) => {
      if (!b || typeof b !== "object") return null;
      if (typeof b.fuente === "string" && FUENTES[b.fuente]) return { fuente: b.fuente };
      if (b.cuenta && /^\d{4}-\d{2}-\d{2}$/.test(String(b.cuenta.fecha || "")) && !isNaN(new Date(b.cuenta.fecha))) return { cuenta: { etiqueta: String(b.cuenta.etiqueta || "la fecha").replace(/[<>{}]/g, "").slice(0, 40), fecha: b.cuenta.fecha } };
      if (typeof b.texto === "string" && b.texto.trim()) return { texto: b.texto.replace(/[<>{}]/g, "").trim().slice(0, 80) };
      return null;
    }).filter(Boolean).slice(0, 4);
    if (!bloques.length) return null;
    const orden = typeof j.orden === "string" ? j.orden.replace(/[<>{}]/g, "").trim().slice(0, 60) : "";
    return { titulo: String(j.titulo || "Mi widget").replace(/[<>{}]/g, "").trim().slice(0, 28) || "Mi widget", bloques, orden };
  }
  /** El texto del widget: textoFuente(k) da el de cada fuente (lo pone la app). */
  function widgetRender(spec, textoFuente, now) {
    const partes = spec.bloques.map((b) => b.cuenta ? cuentaTexto(b.cuenta.etiqueta, b.cuenta.fecha, now) : b.texto ? b.texto : (spec.bloques.length > 1 ? `${FUENTES[b.fuente][1]}:\n` : "") + (textoFuente(b.fuente) || "—"));
    return partes.join("\n\n").split("\n").slice(0, 14).join("\n");
  }
  const nombreFuente = (k) => (FUENTES[k] || [0, k])[1];

  // ======================================================================== 4. CUIDAR EL CELULAR
  const PERMISOS = { ubicacion: [/ubicacion|gps|donde estoy/, "tu ubicación"], microfono: [/microfono|escuchar|me escuchan|me oyen/, "el micrófono"], camara: [/camara/, "la cámara"], contactos: [/contactos|agenda/, "tus contactos"], fotos: [/fotos|imagenes|galeria/, "tus fotos"], sms: [/mensajes de texto|sms/, "tus mensajes de texto"] };
  /** «libera espacio», «¿qué apps ven mi ubicación?», «silencia todo menos las llamadas de mi familia» */
  function celularIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:libera(?:r|me)? (?:espacio|memoria|almacenamiento)|limpia(?:r)? (?:el celular|el telefono|espacio|la memoria)|(?:tengo|esta) (?:el celular |la memoria |el telefono )?(?:lleno|llena|sin espacio)|cuanto espacio (?:me queda|tengo|hay|libre)|como (?:esta|va) (?:el|mi) (?:espacio|almacenamiento)|(?:revisa|mira) (?:el|mi) (?:espacio|almacenamiento))(?: del? (?:celular|telefono))?$/.test(t)) return { cel: "espacio" };
    if ((m = t.match(/^(?:que|cuales) apps? (?:ven|usan|tienen(?: acceso a| permiso (?:de|para|a))?|pueden (?:ver|usar)|acceden a|saben) (?:mi |la |el |a mi |mis )?(.+?)$/)) || (m = t.match(/^(?:quien|quienes) (?:ve|ven|usa|usan|tiene acceso a) (?:mi |la |el |mis )?(.+?)$/))) {
      for (const [k, [re]] of Object.entries(PERMISOS)) if (re.test(m[1])) return { cel: "permisos", p: k };
      return null;
    }
    if ((m = t.match(/^(?:revisa|cuida|mira)\s+(?:mis |los )?permisos(?:\s+de\s+(.+))?$/))) { if (m[1]) for (const [k, [re]] of Object.entries(PERMISOS)) if (re.test(m[1])) return { cel: "permisos", p: k }; return { cel: "permisos", p: "ubicacion" }; }
    if ((m = t.match(/^(?:silencia(?:me)?(?: el celular)?|no molestar|pon(?:me)? (?:el )?no molestar|que no me molesten?|modo silencio)\s+(?:todo\s+)?(?:menos|excepto|salvo|pero (?:deja|que entren))\s+(?:las llamadas de\s+|a\s+|las de\s+)?(?:mi |mis |los |las )?(.+?)(?:\s+(?:por|durante|hasta)\s+(.+))?$/))) {
      const q = m[1];
      const quien = /favorit|familia|importantes|esposo|esposa|mama|papa|hij|pareja|destacad|estrella/.test(q) ? "favoritos" : /contactos|conocidos|agenda/.test(q) ? "contactos" : /nadie|ninguno/.test(q) ? "nadie" : null;
      if (!quien) return null;
      let min = 0; if (m[2]) { const h = m[2].match(/(\d+|una|un|dos|tres)\s*(hora|horas|minutos?)/); if (h) { const n = { una: 1, un: 1, dos: 2, tres: 3 }[h[1]] || +h[1]; min = /hora/.test(h[2]) ? n * 60 : n; } }
      return { cel: "silencio", quien, min, repetidas: /repit|insist|dos veces/.test(q) };
    }
    return null;
  }
  const gb = (b) => (b / 1073741824).toFixed(b >= 10 * 1073741824 ? 0 : 1).replace(".", ",") + " GB";
  /** r: {total, libre, jarvis:[{nombre, bytes, que}], cache} → texto */
  function espacioTexto(r) {
    if (!r || !r.total) return "No pude ver el espacio del celular.";
    const usado = r.total - r.libre, pct = Math.round(usado / r.total * 100);
    const nivel = pct >= 95 ? "🔴 Está casi lleno" : pct >= 85 ? "🟠 Se está llenando" : "🟢 Hay espacio";
    let t = `💾 **${nivel}:** usas ${gb(usado)} de ${gb(r.total)} (${pct} %), quedan **${gb(r.libre)}** libres.`;
    const j = (r.jarvis || []).filter((x) => x.bytes > 20 * 1048576).sort((a, b) => b.bytes - a.bytes);
    if (j.length) t += `\n\n**Lo que ocupa Jarvis:**\n` + j.map((x) => `- ${x.que}: ${gb(x.bytes)}`).join("\n");
    if (r.cache > 30 * 1048576) t += `\n- Archivos temporales de Jarvis: ${gb(r.cache)}`;
    t += pct >= 85 ? "\n\nToca «Liberar espacio de Android»: te muestra fotos ya respaldadas, descargas viejas y apps que no usas para que escojas qué borrar." : "";
    return t;
  }
  function permisosTexto(lista, p) {
    const que = (PERMISOS[p] || [0, p])[1];
    const l = (lista || []).filter((x) => x && x.nombre);
    if (!l.length) return `🔒 Ninguna app (aparte de las del sistema) tiene permiso para ${que}.`;
    const siempre = l.filter((x) => x.fondo), uso = l.filter((x) => !x.fondo);
    let t = `🔒 **${l.length} app${l.length > 1 ? "s" : ""} pueden usar ${que}:**`;
    if (siempre.length) t += `\n\n**Siempre (también en segundo plano):** ${siempre.map((x) => x.nombre).join(", ")}.`;
    if (uso.length) t += `\n\n**Solo mientras las usas:** ${uso.map((x) => x.nombre).join(", ")}.`;
    t += "\n\nToca una para quitarle el permiso (Jarvis no cambia permisos por ti).";
    return t;
  }

  // ======================================================================== 5. SUGERENCIAS DESDE TUS NOTIFICACIONES
  const NO_SUGERIR = /\b(?:codigo|clave|contrasena|otp|verificacion|pin|transferencia|consignacion|saldo|cvv|token)\b/;
  const RE_DIR = /\b((?:calle|cll|cl|carrera|cra|kr|cr|avenida|av|diagonal|dg|transversal|tv|autopista)\.?\s*\d+[a-z]?(?:\s*bis)?\s*(?:#|no\.?|n°|numero)\s*\d+[a-z]?\s*-\s*\d+(?:\s*(?:sur|este|norte))?)/i;
  const RE_HORA = /\b(?:(hoy|manana|pasado manana|el (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|el \d{1,2}(?: de (?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))?)\s+)?(?:a las|a la)\s+(\d{1,2}(?::\d{2})?)\s*(am|pm|a m|p m|de la manana|de la tarde|de la noche)?/;
  const RE_EVENTO = /\b(reunion|cita|consulta|clase|entrevista|cumpleanos|fiesta|almuerzo|comida|cena|partido|ensayo|examen|evaluacion|izada|entrega|nos vemos|nos encontramos|te espero|quedamos|recogemos|recoger)\b/;
  /** Lo que se le puede ofrecer a la persona a partir de una notificación. n: {app, titulo, texto} → [{tipo, etiqueta, orden}] */
  function sugerir(n) {
    const crudo = `${(n && n.texto) || ""}`, t = norm(crudo), quien = String((n && n.titulo) || "").replace(/[<>]/g, "").slice(0, 40);
    if (!t || NO_SUGERIR.test(t) || /banco|nequi|daviplata|bancolombia|pay|wallet/.test(norm((n && n.app) || ""))) return [];
    const out = [];
    let m;
    if ((m = t.match(RE_HORA)) && (RE_EVENTO.test(t) || m[1])) {
      const ev = (t.match(RE_EVENTO) || [])[1];
      const que = ev && !/nos vemos|nos encontramos|te espero|quedamos|recogemos/.test(ev) ? ev.replace("reunion", "reunión").replace("cumpleanos", "cumpleaños").replace("evaluacion", "evaluación") : "encuentro";
      const cuando = `${m[1] || ""} a las ${m[2]}${m[3] ? " " + m[3].replace("manana", "mañana") : ""}`.replace("manana", "mañana").trim();
      const con = quien ? ` con ${quien}` : "";
      out.push({ tipo: "agenda", etiqueta: `📅 Agendar «${que}${con}» ${cuando}`, orden: `recuérdame ${que}${con} ${cuando}` });
    }
    if ((m = crudo.match(RE_DIR))) {
      const dir = m[1].replace(/\s+/g, " ").trim();
      out.push({ tipo: "lugar", etiqueta: `📍 Cómo llegar a ${dir}`, orden: `cómo llego a ${dir}, Colombia` });
    }
    if ((m = t.match(/\b(?:compra(?:r|s|me|nos)?|trae(?:r|s|me)?|pasa por|hace falta|se acabo|se acabaron|falta(?:n)?|necesito(?: que compres)?)\s+(?:un |una |unos |unas |el |la |los |las |de )?([a-z0-9 ,]+?(?:\s+y\s+[a-z0-9 ]+?))(?:\s+(?:por favor|porfa|plis|cuando|que|para)\b|$)/))) {
      const items = m[1].split(/\s*,\s*|\s+y\s+/).map((x) => x.replace(/^(?:un|una|unos|unas|el|la|los|las|de)\s+/, "").replace(/\s+(?:por favor|porfa|plis)$/, "").trim()).filter((x) => x && x.split(" ").length <= 4).slice(0, 8);
      if (items.length >= 2) out.push({ tipo: "lista", etiqueta: `🛒 Agregar a la lista: ${items.join(", ")}`, orden: `agrega ${items.slice(0, -1).join(", ")} y ${items[items.length - 1]} a la lista` });
    }
    return out.slice(0, 3);
  }
  /** «sugerencias de mis mensajes», «¿qué me sugieres de mis notificaciones?» */
  function sugerenciasIntent(text) {
    const t = lead(norm(text));
    if (/^(?:sugerencias (?:de|desde) (?:mis )?(?:mensajes|notificaciones)|que me sugieres (?:de|con) (?:mis )?(?:mensajes|notificaciones)|revisa (?:mis )?notificaciones y sugiere(?:me)?(?: algo)?)$/.test(t)) return { sg: "ver" };
    if (/^(?:activa|prende|enciende) (?:las )?sugerencias (?:de|desde) (?:mis )?(?:mensajes|notificaciones)$/.test(t)) return { sg: "on" };
    if (/^(?:desactiva|apaga|quita) (?:las )?sugerencias (?:de|desde) (?:mis )?(?:mensajes|notificaciones)$/.test(t)) return { sg: "off" };
    return null;
  }

  // ======================================================================== 6. BUSCAR EN TUS COSAS
  /** «busca en mi celular la circular de noviembre», «¿dónde guardé la clave del wifi?», «encuentra en mis cosas…» */
  function buscarIntent(text) {
    const t = lead(norm(text));
    let m;
    if ((m = t.match(/^(?:busca(?:me)?|buscar|encuentra(?:me)?)\s+en\s+(?:mi celular|mi telefono|el celular|el telefono)\s+(?:sobre\s+|de\s+|lo de\s+)?(.{2,})$/))) return { bq: m[1] };
    // («busca en todo/mis cosas», «¿dónde anoté/guardé…?» los atiende la memoria de largo plazo, que ahora también busca por significado)
    if ((m = t.match(/^(?:busca(?:me)?|encuentra(?:me)?)\s+(?:la nota|el documento|el archivo|lo que (?:anote|dije|escribi|guarde))\s+(?:de|sobre|del|que)\s+(.{2,})$/))) return { bq: m[1] };
    if (/^(?:activa|prende) la busqueda por significado$/.test(t)) return { bq: "", activar: true };
    return null;
  }
  /** FNV-1a de 32 bits en base 36: un id estable para cada trozo. */
  function hash(s) { let h = 0x811c9dc5; const x = String(s); for (let i = 0; i < x.length; i++) { h ^= x.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36); }
  /** Partir las fuentes en trozos (por párrafos, ~600 letras) con un id que no cambia si el texto no cambia. */
  function trozos(fuentes, max) {
    const out = [];
    (fuentes || []).forEach((f) => {
      const txt = String(f.texto || "").trim(); if (!txt) return;
      const ps = txt.split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/);
      let cur = "";
      const sacar = () => { if (cur.trim()) out.push({ id: hash(f.titulo + "|" + cur), titulo: f.titulo, texto: cur.trim(), tipo: f.tipo || "", t: f.t || 0, abrir: f.abrir || "" }); cur = ""; };
      ps.forEach((p) => { if ((cur + " " + p).length > 600 && cur) sacar(); cur += (cur ? " " : "") + p; if (cur.length > 900) { const c = cur; cur = c.slice(0, 900); sacar(); cur = c.slice(900); } });
      sacar();
    });
    return out.slice(0, max || 3000);
  }
  /** Lo que reúne la memoria de largo plazo ({fuente, de, texto, t}) → trozos con id para el índice (los más nuevos primero). */
  function deMemoria(E, max) {
    return (E || []).filter((x) => x && x.texto && String(x.texto).trim().length > 12).slice().sort((a, b) => (b.t || 0) - (a.t || 0)).slice(0, max || 2500)
      .map((x) => ({ id: hash(x.fuente + "|" + (x.de || "") + "|" + x.texto), titulo: x.fuente + (x.de ? " · " + x.de : ""), texto: String(x.texto), item: x }));
  }
  /** EmbeddingGemma pide estos prefijos. */
  const consultaEmb = (q) => "task: search result | query: " + String(q || "").trim();
  const docEmb = (titulo, t) => `title: ${String(titulo || "none").replace(/\|/g, "/").slice(0, 80)} | text: ${String(t || "").slice(0, 1500)}`;
  /** Junta dos listas de ids ordenadas (por palabras y por significado). Reciprocal rank fusion. */
  function fusionar(a, b, k) {
    const s = new Map();
    [a || [], b || []].forEach((l) => l.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (60 + i))));
    return [...s.entries()].sort((x, y) => y[1] - x[1]).map((x) => x[0]).slice(0, k || 8);
  }
  /** Puntaje por palabras (sin tildes, con raíces simples). */
  function porPalabras(lista, q, k) {
    const raiz = (w) => w.replace(/(?:es|s)$/, "").slice(0, 6);
    const ws = norm(q).split(" ").filter((w) => w.length > 2 && !/^(?:que|del|las|los|una|uno|por|para|con|donde|esta|esa|ese|mis|como|cual)$/.test(w)).map(raiz);
    if (!ws.length) return [];
    return (lista || []).map((x) => { const tx = norm(x.titulo + " " + x.texto); let p = 0; ws.forEach((w) => { if (tx.includes(w)) p += 1 + (norm(x.titulo).includes(w) ? 1 : 0); }); return [x.id, p / ws.length]; })
      .filter((x) => x[1] >= 0.34).sort((a, b) => b[1] - a[1]).map((x) => x[0]).slice(0, k || 20);
  }
  /** Ajustes del sistema que se pueden abrir: [palabras, título, acción de Android] */
  const AJUSTES_SIS = [
    [/\bwifi\b|\bwi fi\b|\binternet\b|\bred\b/, "Wi-Fi", "android.settings.WIFI_SETTINGS"], [/\bbluetooth\b|\baudifonos\b/, "Bluetooth", "android.settings.BLUETOOTH_SETTINGS"],
    [/\bbrillo\b|\bpantalla\b|\bfondo\b|\bletra\b/, "Pantalla", "android.settings.DISPLAY_SETTINGS"], [/\bsonido\b|\btono\b|\bvibracion\b/, "Sonido", "android.settings.SOUND_SETTINGS"],
    [/\bbateria\b|\bahorro\b/, "Batería", "android.intent.action.POWER_USAGE_SUMMARY"], [/\balmacenamiento\b|\bespacio\b|\bmemoria\b/, "Almacenamiento", "android.settings.INTERNAL_STORAGE_SETTINGS"],
    [/\bubicacion\b|\bgps\b/, "Ubicación", "android.settings.LOCATION_SOURCE_SETTINGS"], [/\bdatos moviles\b|\bdatos\b|\bplan\b/, "Datos móviles", "android.settings.DATA_ROAMING_SETTINGS"],
    [/\bnotificaciones\b/, "Notificaciones", "android.settings.NOTIFICATION_SETTINGS"], [/\bidioma\b|\bteclado\b/, "Idioma y teclado", "android.settings.LOCALE_SETTINGS"],
    [/\bhora\b|\bfecha\b/, "Fecha y hora", "android.settings.DATE_SETTINGS"], [/\bseguridad\b|\bhuella\b|\bbloqueo\b/, "Seguridad", "android.settings.SECURITY_SETTINGS"],
    [/\baccesibilidad\b/, "Accesibilidad", "android.settings.ACCESSIBILITY_SETTINGS"], [/\bapps?\b|\baplicaciones\b/, "Aplicaciones", "android.settings.APPLICATION_SETTINGS"],
  ];
  function ajustesSis(q) { const t = norm(q); return AJUSTES_SIS.filter(([re]) => re.test(t)).slice(0, 2).map(([, titulo, accion]) => ({ titulo, accion })); }

  // ======================================================================== PEDIDOS CON EL AGENTE (hasta antes de pagar)
  /** «pídeme un domicilio de hamburguesa», «pide almuerzo», «pídeme una pizza» (sin app: Rappi), «haz el mercado en Rappi» */
  function pedidoIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/\b(?:nequi|daviplata|bancolombia|banco|transfier|consign)/.test(t)) return null;
    if ((m = t.match(/^(?:pide(?:me|nos)?|pedir|ordena(?:me)?)\s+(?:un |una |el |la )?(domicilio|comida|almuerzo|desayuno|cena|pizza|hamburguesa|sushi|pollo|empanadas|helado|un mercado|mercado|drogueria|medicamentos?)\b(.*)$/)) && !/\b(?:en|por|con)\s+(?:rappi|didi|ifood|uber|exito|merqueo)\b/.test(t)) return { agente: "app", app: "Rappi", meta: t };
    if ((m = t.match(/^(?:haz(?:me)?|hacer)\s+el\s+mercado\s+(?:en|por)\s+(rappi|exito|merqueo|jumbo|carulla|d1|ara)\b/))) return { agente: "app", app: { rappi: "Rappi", exito: "Éxito", merqueo: "Merqueo", jumbo: "Jumbo", carulla: "Carulla", d1: "D1", ara: "Ara" }[m[1]], meta: t };
    return null;
  }
  /** Botones que también son «el último paso» en apps de viajes y domicilios. */
  function riesgoExtra(label) {
    return /\b(?:buscar conductor|encontrar (?:un )?conductor|confirmar recogida|confirmar viaje|pedir (?:uber\w*|viaje|taxi|didi\w*|ahora|domicilio)|solicitar viaje|solicitar (?:un )?(?:taxi|carro|moto)|elegir y pagar|hacer el pedido|enviar pedido|confirmar pedido|ofrecer tarifa|proponer tarifa|aceptar oferta|reservar y pagar|desliza para (?:pagar|pedir|confirmar)|deslizar para (?:pagar|pedir|confirmar))\b/.test(norm(label));
  }

  // ======================================================================== CONTESTADOR DE LLAMADAS POR MENSAJE
  /** «activa el contestador de llamadas», «…que diga: estoy en clase», «quita el contestador» */
  function contestadorIntent(text) {
    const t = lead(norm(text));
    if (/^(?:quita|desactiva|apaga)\s+(?:el\s+)?contestador(?: de llamadas)?$/.test(t)) return { cont: "off" };
    const m = String(text).match(/^\s*(?:jarvis[,\s]+)?(?:activa|prende|pon(?:me)?|enciende)\s+(?:el\s+)?contestador(?:\s+de\s+llamadas)?(?:\s+(?:que diga|con el mensaje|diciendo)\s*:?\s*(.+))?\s*$/i);
    if (m) return { cont: "on", texto: m[1] ? m[1].trim().replace(/^[«"]|[»"]$/g, "").slice(0, 300) : "" };
    return null;
  }
  const contestadorTexto = (nombre) => `Hola, soy el asistente de ${nombre || "la persona que llamaste"}. Ahora no puede contestar. Si es importante, escríbele por aquí el motivo de tu llamada.`;

  // ======================================================================== GEMINI NANO (la IA que ya viene en el celular)
  function nanoIntent(text) {
    const t = lead(norm(text));
    if (/^(?:usa|activa|pon|prepara)\s+(?:a\s+)?gemini nano$/.test(t)) return { nano: "usar" };
    if (/^(?:tengo|mi celular tiene|este celular tiene|sirve)\s+gemini nano$/.test(t)) return { nano: "ver" };
    return null;
  }
  const NANO_ESTADO = {
    disponible: "✅ Tu celular tiene Gemini Nano listo: es la IA que pone Google dentro del celular (no ocupa espacio de Jarvis y funciona sin internet).",
    descargable: "📥 Tu celular puede usar Gemini Nano, pero Google todavía no lo ha bajado. Lo pido ahora (lo baja Android, por wifi).",
    descargando: "⏳ Android está bajando Gemini Nano. Cuando termine queda listo.",
    no: "❌ Este celular no tiene Gemini Nano (por ahora solo lo traen algunos de gama alta, como Pixel 9 y 10 o Galaxy S25 y S26). Sigue usando los modelos GGUF o Gemma.",
  };
  /** Gemini Nano tiene poca memoria (unos 4000 tokens): se arma una sola instrucción corta. */
  function promptNano(sistema, mensajes, max) {
    const lim = max || 9000;
    const ms = (mensajes || []).filter((m) => m && m.content).slice(-6).map((m) => `${m.role === "user" ? "Persona" : "Asistente"}: ${String(m.content).slice(0, 1200)}`);
    let s = (sistema ? String(sistema).slice(0, 2500) + "\n\n" : "") + ms.join("\n") + "\nAsistente:";
    while (s.length > lim && ms.length > 1) { ms.shift(); s = (sistema ? String(sistema).slice(0, 2500) + "\n\n" : "") + ms.join("\n") + "\nAsistente:"; }
    return s.slice(-lim);
  }

  const API = { norm, versionLive, rankLive, liveAsincrono, herramientaLive, respuestaLive, dictadoLargoIntent, comandosVoz, autocorrecciones, ordenadoLocal, promptOrdenado, modeloTranscribir, promptTranscribir,
    FUENTES, fecha, cuentaTexto, widgetLibreIntent, widgetLocal, widgetPrompt, specValida, widgetRender, nombreFuente, PERMISOS, celularIntent, espacioTexto, permisosTexto, gb,
    sugerir, sugerenciasIntent, buscarIntent, hash, trozos, deMemoria, consultaEmb, docEmb, fusionar, porPalabras, ajustesSis, AJUSTES_SIS, pedidoIntent, riesgoExtra,
    contestadorIntent, contestadorTexto, nanoIntent, NANO_ESTADO, promptNano };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL19 = API;
})(typeof window !== "undefined" ? window : globalThis);
