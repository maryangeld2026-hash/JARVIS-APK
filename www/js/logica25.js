/* Jarvis para Android 3.38 · lógica pura (se prueba con node): crear imágenes de la forma más fácil.
   Se entiende como lo dirías («dibújame un gato astronauta», «imagen de un atardecer en Cartagena, vertical para estados»),
   con estilos y formatos, y con respaldo gratis cuando Gemini no deja (su plan gratis no crea imágenes). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"“”]/g, " ").replace(/\s+/g, " ").trim();

  /** [clave, nombre, cómo se le pide a la IA] */
  const ESTILOS = [
    ["realista", "📷 Realista", "fotografía realista, luz natural, alta calidad, detalles nítidos"],
    ["caricatura", "😄 Caricatura", "ilustración tipo caricatura, colores vivos, líneas limpias, divertida"],
    ["acuarela", "🖌️ Acuarela", "pintura en acuarela, trazos suaves y colores delicados"],
    ["anime", "🌸 Anime", "ilustración estilo anime, colores brillantes"],
    ["3d", "🧸 3D", "render 3D estilo película animada, iluminación suave"],
    ["logo", "🔷 Logo", "logo plano, simple y moderno, fondo blanco, estilo vectorial"],
  ];
  /** [clave, nombre, ancho, alto, relación] (Pollinations: área hasta 768×768) */
  const FORMATOS = [["cuadrada", "⬛ Cuadrada", 768, 768, "1:1"], ["vertical", "📱 Vertical (estados)", 576, 1024, "9:16"], ["horizontal", "🖥️ Horizontal", 1024, 576, "16:9"]];
  const estiloDe = (t) => { const n = norm(t); return /\bsticker\b/.test(n) ? "sticker" : /\b(?:estilo (?:de )?(?:cine|pelicula)|cinematografic)/.test(n) ? "cine" : /\b(?:oleo|al oleo)\b/.test(n) ? "oleo" : /\bpixel(?: art)?\b/.test(n) ? "pixel" : /\bminimalista\b/.test(n) ? "minimalista" : /\b(?:foto de producto|fotografia de producto)\b/.test(n) ? "producto" : /\b(?:realista|foto ?realista|fotografia)\b/.test(n) ? "realista" : /\b(?:caricatura|caricaturesc|cartoon|dibujo animado|comic)/.test(n) ? "caricatura" : /\bacuarela\b/.test(n) ? "acuarela" : /\b(?:anime|manga)\b/.test(n) ? "anime" : /\b(?:3d|tres de|pixar)\b/.test(n) ? "3d" : /\b(?:logo|logotipo|isotipo)\b/.test(n) ? "logo" : ""; };
  const formatoDe = (t) => { const n = norm(t); return /\b(?:vertical|para (?:estados|historias|instagram stories|tiktok)|fondo de pantalla del celular)\b/.test(n) ? "vertical" : /\b(?:horizontal|panoramica|portada|banner|para (?:youtube|el computador|la presentacion))\b/.test(n) ? "horizontal" : /\b(?:cuadrada|para (?:el perfil|whatsapp))\b/.test(n) ? "cuadrada" : ""; };
  const NO_ES = /\b(?:grafica|funcion|recta|parabola|ecuacion|plano cartesiano|mapa mental|mapa conceptual|tabla)\b/;

  /** → {ci: "crear", desc, estilo, formato} · {ci: "abrir"} (sin decir qué) · null */
  function crearIntent(text) {
    const raw = String(text || "").trim().replace(/^\s*(?:jarvis|oye jarvis)[,\s]+/i, "");
    const t = norm(raw);
    if (t.length > 400 || NO_ES.test(t)) return null;
    // las figuras exactas con medidas («dibuja un triángulo rectángulo con catetos 3 y 4») las hace Jarvis en el celular, exactas
    if (/\b(?:triangulo|cuadrado|rectangulo|circulo|circunferencia|poligono|hexagono|pentagono|angulo|equilatero|catetos?|radio|puntos?)\b/.test(t) && /\d/.test(t)) return null;
    if (/^(?:quiero |vamos a |voy a )?crear (?:una )?imagen(?:es)?$|^(?:crea|haz|genera)(?:me)? una imagen$|^(?:abre )?(?:el )?creador de imagenes$/.test(t)) return { ci: "abrir" };
    const tipos = "imagen|imagenes|dibujo|ilustracion|foto|afiche|poster|logo|logotipo|tarjeta|invitacion|caricatura|portada|sticker|fondo de pantalla|meme|banner|retrato|paisaje";
    let m = t.match(new RegExp(`^(?:dibuja|dibujame|pinta|pintame|ilustra|ilustrame)\\s+(.{3,})$`));
    if (!m) m = t.match(new RegExp(`^(?:crea|creame|haz|hazme|genera|generame|disena|disename|quiero|necesito|me haces|puedes hacer(?:me)?|podrias hacer(?:me)?|regalame)\\s+(?:una?|el|la|unos|unas)?\\s*((?:${tipos})\\b.*)$`));
    if (!m) m = t.match(new RegExp(`^((?:${tipos})\\s+(?:de|con|sobre|para)\\s+.{3,})$`));
    if (!m) return null;
    // lo que hay que dibujar, tal como lo dijo la persona (con tildes), sin el verbo
    const desc = raw.replace(/^(?:dib[uú]ja(?:me)?|p[ií]nta(?:me)?|il[uú]stra(?:me)?|cr[eé]a(?:me)?|haz(?:me)?|g[eé]nera(?:me)?|dis[eé][ñn]a(?:me)?|quiero|necesito|me haces|puedes hacer(?:me)?|podr[ií]as hacer(?:me)?|r[eé]galame)\s+/i, "").trim();
    return { ci: "crear", desc: desc || raw, estilo: estiloDe(raw), formato: formatoDe(raw) };
  }
  /** La instrucción final para la IA de imágenes. */
  function promptFinal(desc, estilo) {
    const e = ESTILOS.find((x) => x[0] === estilo);
    return String(desc || "").trim() + (e ? `. Estilo: ${e[2]}.` : "") + " Si la imagen lleva texto, que esté en español y bien escrito.";
  }
  const formato = (k) => FORMATOS.find((x) => x[0] === k) || FORMATOS[0];
  /** Pollinations: gratis y sin clave (una imagen a la vez, con un logo pequeño en la esquina). */
  function urlPollinations(prompt, fmt, seed) {
    const f = formato(fmt);
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(String(prompt).slice(0, 900))}?width=${f[2]}&height=${f[3]}&seed=${seed == null ? 1 : seed}&safe=true`;
  }
  /** SenseNova U1.5 (gratis en fase beta, con la clave de SenseNova). */
  function pedidoSense(prompt, fmt) {
    const f = formato(fmt);
    return { model: "sensenova-u1.5-fast", prompt: String(prompt).slice(0, 1500), n: 1, size: f[0] === "vertical" ? "768x1344" : f[0] === "horizontal" ? "1344x768" : "1024x1024" };
  }
  /** → {b64, mime} | {url} | null */
  function imagenDeRespuesta(j) {
    const d = j && Array.isArray(j.data) ? j.data[0] : null;
    if (!d) return null;
    if (d.b64_json) return { b64: d.b64_json, mime: /^\/9j/.test(d.b64_json) ? "image/jpeg" : "image/png" };
    if (d.url) return { url: d.url };
    return null;
  }
  /** ¿Es «no tienes cupo para imágenes» (el plan gratis de Gemini no crea imágenes)? */
  const sinCupo = (status, msg) => status === 429 || status === 403 || /limit:\s*0|quota|RESOURCE_EXHAUSTED|billing|free tier|paid/i.test(String(msg || ""));

  const API = { norm, ESTILOS, FORMATOS, estiloDe, formatoDe, crearIntent, promptFinal, formato, urlPollinations, pedidoSense, imagenDeRespuesta, sinCupo };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL25 = API;
})(typeof window !== "undefined" ? window : globalThis);
