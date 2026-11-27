/* Jarvis para Android 3.40 · lógica pura (se prueba con node):
   imágenes 2.0 (texto exacto encima, plantillas, mejor descripción para la IA) · videos 2.0 (con tus fotos, música, duración, transiciones)
   · más humano: aprende de tus correcciones («muy largo», «no me digas señor», «habla más despacio») y «¿de qué hablamos ayer?». */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"“”]/g, " ").replace(/\s+/g, " ").trim();

  // ======================================================================== IMÁGENES 2.0
  /** El texto que debe ir escrito tal cual («que diga Feliz cumpleaños Ana», «con el texto "Se vende"»): las IA de imágenes
      lo escriben mal, así que Jarvis lo pone encima él mismo. → {desc (sin el texto), texto, pos: "arriba"|"abajo"} */
  function textoExacto(desc) {
    const s = String(desc || "");
    let m = s.match(/[,.]?\s*(?:que diga|que diga:|con el (?:texto|letrero|mensaje|titulo|título)|con (?:la frase|las palabras)|que ponga|y que diga)\s*:?\s*[«"“']([^»"”']{1,80})[»"”']/i)
      || s.match(/[,.]?\s*(?:que diga|con el (?:texto|letrero|mensaje|titulo|título)|que ponga)\s*:?\s+(.{2,60}?)\s*$/i)
      || s.match(/\s*[«"“]([^»"”]{2,80})[»"”]/);
    if (!m) return { desc: s.trim(), texto: "", pos: "abajo" };
    const resto = (s.slice(0, m.index) + " " + s.slice(m.index + m[0].length)).replace(/\s+/g, " ").replace(/\s+([,.])/g, "$1").replace(/[,\s]+$/, "").trim();
    return { desc: resto || s.trim(), texto: m[1].trim(), pos: /\b(?:afiche|poster|póster|portada|titulo|título|invitaci|tarjeta)\b/i.test(s) ? "arriba" : "abajo" };
  }
  /** Para que la IA deje espacio limpio donde va el texto. */
  const SIN_TEXTO = (pos) => ` Sin letras ni texto escrito en la imagen; deja espacio despejado en la parte de ${pos === "arriba" ? "arriba" : "abajo"} para un título.`;
  /** Plantillas de un toque en «🎨 Crear imagen». [clave, nombre, estilo, formato, qué escribir de ejemplo] */
  const PLANTILLAS = [
    ["invitacion", "🎉 Invitación", "caricatura", "vertical", "Invitación de cumpleaños con globos y confeti, que diga «¡Te espero el sábado!»"],
    ["felicitacion", "💐 Felicitación", "acuarela", "cuadrada", "Tarjeta de felicitación con flores, que diga «¡Feliz día, mamá!»"],
    ["aviso", "📢 Aviso o afiche", "minimalista", "vertical", "Afiche para mi negocio de empanadas, que diga «Empanadas a $2.500»"],
    ["sticker", "😄 Sticker", "sticker", "cuadrada", "Un aguacate feliz levantando el pulgar"],
    ["fondo", "📱 Fondo de pantalla", "realista", "vertical", "Montañas de Colombia al amanecer con niebla"],
    ["logo", "🔷 Logo", "logo", "cuadrada", "Logo para una panadería llamada La Espiga"],
  ];
  /** Estilos que se suman a los de la 3.38. */
  const ESTILOS_MAS = [
    ["cine", "🎬 Cine", "fotograma de película, iluminación cinematográfica, colores intensos, profundidad de campo"],
    ["oleo", "🖼️ Óleo", "pintura al óleo, pinceladas visibles, estilo clásico"],
    ["pixel", "👾 Pixel art", "pixel art de 16 bits, colores planos"],
    ["comic", "💥 Cómic", "ilustración de cómic, tinta negra marcada y colores planos"],
    ["minimalista", "◻️ Minimalista", "diseño minimalista y moderno, formas simples, pocos colores, mucho espacio"],
    ["sticker", "😄 Sticker", "sticker con borde blanco grueso, fondo liso de un solo color, estilo caricatura simple"],
    ["producto", "🛍️ Producto", "fotografía de producto profesional, fondo de estudio limpio, luz suave"],
  ];
  /** Para la IA de texto: convertir lo que pidió la persona en una descripción visual rica, en inglés (las IA de imágenes entienden mejor). */
  const PROMPT_MEJORAR = (desc, estilo) => `Convert this request into ONE detailed English prompt for an AI image generator (subject, setting, composition, lighting, colors, mood${estilo ? ", style: " + estilo : ""}). Keep any names. Do not add text or letters to the image unless asked. Answer ONLY with the prompt, max 70 words.\n\nRequest (Spanish): ${desc}`;
  const promptLimpio = (t) => String(t || "").replace(/^["'«\s]+|["'»\s]+$/g, "").replace(/^(?:prompt|here is.*?):\s*/i, "").replace(/\s+/g, " ").slice(0, 900);

  // ======================================================================== VIDEOS 2.0
  /** «haz un video con mis fotos …» → {vf: true, desc} */
  function fotosIntent(text) {
    const t = norm(text);
    const m = t.match(/^(?:haz|hazme|crea|creame|arma|armame|quiero|monta|montame)\s+(?:un|el)?\s*(?:video|videito|reel)\s+(?:con|de)\s+(?:mis|estas|unas|las)\s+fotos(?:\s+(?:de|del|para|sobre)\s+(.+))?$/);
    if (!m) return null;
    const raw = String(text || ""), k = raw.search(/\bfotos\b/i);
    const desc = k >= 0 ? raw.slice(k + 5).replace(/^\s*(?:de|del|para|sobre)\s+/i, "").trim() : "";
    return { vf: true, desc };
  }
  /** «de 30 segundos», «de un minuto» → segundos (entre 10 y 60) o 0 */
  function duracionDe(text) {
    const t = norm(text);
    let m = t.match(/\bde\s+(\d{1,2})\s*(?:s|seg|segundos)\b/); if (m) return Math.max(10, Math.min(60, +m[1]));
    if (/\bde (?:un|1) minuto\b/.test(t)) return 60;
    if (/\bde medio minuto\b/.test(t)) return 30;
    return 0;
  }
  /** Cuántas escenas según la duración (unos 5 s cada una). */
  const escenasPara = (seg, max) => Math.max(3, Math.min(max || 8, Math.round((seg || 20) / 5)));
  /** Ánimo de la música según de qué es el video. */
  function animoDe(text) {
    const t = norm(text);
    if (/\b(?:cumpleanos|fiesta|celebra|navidad|boda|grado|feliz|alegr|viaje|vacaciones|playa|anuncio|promocion|oferta|negocio)/.test(t)) return "alegre";
    if (/\b(?:memorial|recuerdo|despedida|homenaje|en memoria|triste|condolencia)/.test(t)) return "suave";
    if (/\b(?:deporte|futbol|aventura|carrera|accion|epic|motivaci)/.test(t)) return "energico";
    return "tranquilo";
  }
  /** La música de fondo, hecha en el celular: acordes (frecuencias en Hz) y pulso por ánimo. Sin derechos de autor. */
  const MUSICA = {
    alegre: { bpm: 104, acordes: [[261.6, 329.6, 392.0], [392.0, 493.9, 587.3], [440.0, 523.3, 659.3], [349.2, 440.0, 523.3]], arpegio: true },
    tranquilo: { bpm: 72, acordes: [[220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [261.6, 329.6, 392.0], [196.0, 246.9, 293.7]], arpegio: false },
    suave: { bpm: 60, acordes: [[220.0, 261.6, 329.6], [196.0, 246.9, 293.7], [174.6, 220.0, 261.6], [164.8, 196.0, 246.9]], arpegio: false },
    energico: { bpm: 120, acordes: [[293.7, 370.0, 440.0], [246.9, 293.7, 370.0], [196.0, 246.9, 293.7], [220.0, 277.2, 329.6]], arpegio: true },
  };
  /** Las transiciones van cambiando: fundido, deslizar, acercar. */
  const TRANS = ["fundido", "deslizar", "acercar"];
  const transicion = (i) => TRANS[i % TRANS.length];

  // ======================================================================== MÁS HUMANO: APRENDE DE TUS CORRECCIONES
  /** «eso fue muy largo», «no me digas señor», «habla más despacio»… → {aj: {...cambios}, dice: "…"} o null */
  function correccionIntent(text) {
    const t = norm(text).replace(/^(?:jarvis |oye )/, "");
    if (t.length > 90) return null;
    if (/^(?:(?:eso )?(?:fue |es |estuvo )?(?:muy|demasiado) largo|(?:respondeme|contestame|habla|se) (?:mas )?(?:corto|breve)|(?:mas|muy) corto(?: por favor)?|hablas mucho|no te extiendas)$/.test(t)) return { largo: "corto", dice: "Entendido: de ahora en adelante te respondo más corto." };
    if (/^(?:(?:dame |quiero )?mas detalles?|explicame mejor|(?:eso )?(?:fue |es )?(?:muy|demasiado) corto|(?:respondeme|contestame|habla) (?:mas )?(?:largo|completo|detallado))$/.test(t)) return { largo: "detallado", dice: "Listo: cuando me preguntes algo, te doy más detalles y ejemplos." };
    if (/^(?:habla(?:me)?|ve|lee) (?:mas )?(?:despacio|lento|pausado)$|^(?:hablas|vas) muy rapido$/.test(t)) return { velocidad: -0.15, dice: "Listo, hablo más despacio." };
    if (/^(?:habla(?:me)?|ve|lee) (?:mas )?(?:rapido|ligero)$|^(?:hablas|vas) muy (?:lento|despacio)$/.test(t)) return { velocidad: 0.15, dice: "Listo, hablo más rápido." };
    if (/^(?:no me (?:digas|llames|trates de) (?:senor|senora|profe|profesor|profesora|usted)|tuteame|hablame de tu|tratame de tu)$/.test(t)) return { trato: "nombre", tu: true, dice: "Dale, te hablo de tú y por tu nombre." };
    if (/^(?:no uses|sin|quita los) (?:emojis|emoticones|caritas)$/.test(t)) return { emojis: false, dice: "Listo, sin emojis." };
    if (/^(?:se mas (?:serio|formal)|no hagas chistes|sin chistes)$/.test(t)) return { humor: false, dice: "Entendido, sin chistes." };
    if (/^(?:se mas (?:divertido|chistoso|gracioso)|hazme reir mas|usa (?:mas )?humor)$/.test(t)) return { humor: true, dice: "¡Hecho! Le pongo más humor." };
    return null;
  }

  // ======================================================================== «¿DE QUÉ HABLAMOS AYER?»
  /** → {dia: "ayer"|"hoy"|"anteayer"|"semana"} */
  function recuerdoIntent(text) {
    const t = norm(text);
    const m = t.match(/^(?:de que|que) (?:hablamos|conversamos|estuvimos hablando|me dijiste|te pregunte)\s+(ayer|hoy|anteayer|antier|esta semana|la semana pasada)$/) || t.match(/^(?:resumeme|resume|recuerdame) (?:lo que hablamos|nuestra conversacion|la conversacion)\s+(?:de\s+)?(ayer|hoy|anteayer|antier|esta semana)$/);
    if (!m) return null;
    return { dia: m[1] === "antier" ? "anteayer" : /semana/.test(m[1]) ? "semana" : m[1] };
  }
  /** Los mensajes de ese día (de todas las conversaciones). → [{role, content, t}] */
  function mensajesDel(convs, dia, now) {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const ini = dia === "hoy" ? d.getTime() : dia === "ayer" ? d.getTime() - 864e5 : dia === "anteayer" ? d.getTime() - 2 * 864e5 : d.getTime() - 7 * 864e5;
    const fin = dia === "hoy" || dia === "semana" ? now + 1 : dia === "ayer" ? d.getTime() : d.getTime() - 864e5;
    return [].concat(...(convs || []).map((c) => c.chat || [])).filter((m) => m.t >= ini && m.t < fin && (!m.cls || m.cls === "") && String(m.content || "").trim()).sort((a, b) => a.t - b.t);
  }
  const PROMPT_RECUERDO = (dia, l) => `Resume en español, en 3 a 6 puntos cortos y cálidos, de qué hablamos ${dia === "semana" ? "esta semana" : dia} (temas, decisiones, cosas pendientes). Habla en primera persona («hablamos de…», «me pediste…»).\n\n` + l.map((m) => `${m.role === "user" ? "Tú" : "Jarvis"}: ${String(m.content).slice(0, 300)}`).join("\n").slice(0, 8000);

  const API = { norm, textoExacto, SIN_TEXTO, PLANTILLAS, ESTILOS_MAS, PROMPT_MEJORAR, promptLimpio, fotosIntent, duracionDe, escenasPara, animoDe, MUSICA, TRANS, transicion,
    correccionIntent, recuerdoIntent, mensajesDel, PROMPT_RECUERDO };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL27 = API;
})(typeof window !== "undefined" ? window : globalThis);
