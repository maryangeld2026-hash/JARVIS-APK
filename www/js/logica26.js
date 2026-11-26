/* Jarvis para Android 3.39 · lógica pura (se prueba con node): videos.
   «hazme un video de…» → con Veo (si tu clave de Gemini lo permite) o, gratis, un video de 15 a 30 s hecho en el celular
   con imágenes de IA, movimiento suave, textos y la voz de Jarvis. Y el atajo a Infinall para anuncios. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const NO_ES = /\b(?:youtube|resume|resumen|subtitul|llamada|videollamada|camara|grabame|graba)\b/;

  /** → {vi: "crear", desc, formato} · {vi: "infinall", desc} · null */
  function videoIntent(text) {
    const raw = String(text || "").trim().replace(/^\s*(?:jarvis|oye jarvis)[,\s]+/i, "");
    const t = norm(raw);
    if (t.length > 400) return null;
    let m;
    if ((m = t.match(/^(?:abre|abrir|usa|ve a)\s+infinall\b\s*(?:para|con)?\s*(.*)$/)) || (m = t.match(/^(?:haz(?:me)?|crea(?:me)?|genera(?:me)?)\s+(.+?)\s+(?:en|con)\s+infinall$/))) {
      const desc = raw.replace(/^(?:abre|abrir|usa|ve a)\s+infinall\s*(?:para|con)?\s*/i, "").replace(/^(?:haz(?:me)?|cr[eé]a(?:me)?|g[eé]nera(?:me)?)\s+/i, "").replace(/\s+(?:en|con)\s+infinall\s*$/i, "").trim();
      return { vi: "infinall", desc: m[1] ? desc : "" };
    }
    if (NO_ES.test(t)) return null;
    if (!(m = t.match(/^(?:haz|hazme|crea|creame|genera|generame|arma|armame|anima|animame|quiero|necesito|me haces|puedes hacer(?:me)?)\s+(?:un|una|el)?\s*(?:video|videito|clip|animacion|reel)\b\s*(.*)$/))) return null;
    const desc = raw.replace(/^[^\s]+\s+(?:(?:un|una|el)\s+)?(?:v[ií]deo|videito|clip|animaci[oó]n|reel)\s*(?:de|sobre|con|para|corto de|cortico de)?\s*/i, "").trim();
    if (desc.length < 3) return { vi: "crear", desc: "", formato: "" };
    const n = norm(desc);
    const formato = /\b(?:horizontal|para (?:youtube|el computador|la presentacion|el tablero))\b/.test(n) ? "horizontal" : /\bcuadrad/.test(n) ? "cuadrada" : "vertical";   // en el celular, por defecto vertical (estados, reels)
    return { vi: "crear", desc, formato };
  }

  /** El guion para la IA: escenas con qué se ve, qué dice el texto y qué narra la voz. */
  const PROMPT_GUION = (desc, n) => `Vas a armar un video corto (de ${n} escenas) sobre: «${desc}». Para cada escena da: "imagen" (descripción visual concreta y detallada para crear la imagen, sin texto escrito dentro), "texto" (lo que sale escrito en pantalla, máximo 7 palabras, en español) y "voz" (lo que narra la voz, una frase natural de máximo 18 palabras, en español de Colombia). Que cuenten una pequeña historia con principio y final. Responde SOLO JSON: {"titulo":"…","escenas":[{"imagen":"…","texto":"…","voz":"…"}]}`;
  const corta = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
  function escenasValidas(j, n) {
    const l = (j && Array.isArray(j.escenas) ? j.escenas : []).filter((e) => e && e.imagen).slice(0, n).map((e) => ({ imagen: corta(e.imagen, 400), texto: corta(e.texto, 60), voz: corta(e.voz, 160) }));
    return l.length >= 2 ? { titulo: corta(j.titulo, 60), escenas: l } : null;
  }
  /** Sin IA de texto: las escenas salen de la misma descripción, desde distintos planos. */
  const PLANOS = ["plano general", "plano medio, desde otro ángulo", "detalle de cerca", "vista amplia al final, luz cálida", "desde arriba"];
  function escenasSimples(desc, n) {
    return { titulo: corta(desc, 60), escenas: Array.from({ length: n }, (_, i) => ({ imagen: `${desc}, ${PLANOS[i % PLANOS.length]}`, texto: i === 0 ? corta(desc, 50) : "", voz: "" })) };
  }

  /** Cuánto dura cada escena (s): con voz, según lo que se narra; sin voz, 3,5 s. total: duración del audio, si hay. */
  function tiempos(escenas, total) {
    if (!total) return escenas.map(() => 3.5);
    const pesos = escenas.map((e) => Math.max(8, (e.voz || "").length));
    const suma = pesos.reduce((a, b) => a + b, 0);
    return pesos.map((p) => Math.max(2.5, (total + 0.8) * p / suma));
  }
  /** Movimiento suave de cámara («Ken Burns») para la escena i en el instante t (0 a 1): acercar, alejar o desplazar. */
  function camara(i, t) {
    const k = i % 4, e = t * t * (3 - 2 * t);           // suave al empezar y al terminar
    if (k === 0) return { s: 1.0 + 0.12 * e, x: 0, y: 0 };
    if (k === 1) return { s: 1.12 - 0.12 * e, x: 0, y: 0 };
    if (k === 2) return { s: 1.1, x: -0.04 + 0.08 * e, y: 0 };
    return { s: 1.1, x: 0, y: 0.04 - 0.08 * e };
  }
  /** Tamaño del video por formato. */
  const TAM = { vertical: [720, 1280], horizontal: [1280, 720], cuadrada: [720, 720] };
  /** El formato de grabación que el celular sepa hacer: primero MP4 (lo abre WhatsApp), si no WebM. */
  function mimeVideo(soporta) {
    return ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => soporta(m)) || "";
  }
  /** Veo de la cuenta: el más nuevo, primero el rápido o el liviano (gastan menos). */
  function veoModelo(ids) {
    const l = (ids || []).filter((x) => /^veo-/.test(x));
    const ver = (x) => parseFloat((x.match(/veo-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    return l.sort((a, b) => ver(b) - ver(a) || (/fast|lite/.test(b) - /fast|lite/.test(a)) || (/preview/.test(a) - /preview/.test(b)))[0] || "";
  }
  /** ¿El plan no deja hacer videos? (Veo no está en el plan gratis) */
  const sinCupo = (status, msg) => status === 429 || status === 403 || /limit:\s*0|quota|RESOURCE_EXHAUSTED|billing|free tier|paid|not available/i.test(String(msg || ""));
  /** Partir un texto en renglones que quepan en ancho (con una función que mide). */
  function renglones(texto, ancho, medir) {
    const out = []; let linea = "";
    String(texto || "").split(/\s+/).filter(Boolean).forEach((w) => { const p = linea ? linea + " " + w : w; if (medir(p) <= ancho || !linea) linea = p; else { out.push(linea); linea = w; } });
    if (linea) out.push(linea);
    return out.slice(0, 3);
  }

  const API = { norm, videoIntent, PROMPT_GUION, escenasValidas, escenasSimples, tiempos, camara, TAM, mimeVideo, veoModelo, sinCupo, renglones };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL26 = API;
})(typeof window !== "undefined" ? window : globalThis);
