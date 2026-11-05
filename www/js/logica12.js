/* Jarvis para Android 3.17 · lógica pura (se prueba con node).
   Traductor (idiomas, órdenes, respuesta de la IA) · reconocer canciones (órdenes, AudD, Gemini, enlaces). */
(function (root) {
  "use strict";
  /** Quita tildes letra por letra (el texto queda del mismo largo: así se recorta la frase original, con sus mayúsculas y tildes). */
  const fold = (s) => [...String(s || "")].map((c) => (c.normalize("NFD")[0] || c).toLowerCase()).join("");
  const norm = (s) => fold(s).replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "");

  // ======================================================================== IDIOMAS
  /** código → [nombre, voz y oído (BCP-47), bandera, sin internet (ML Kit)] */
  const IDIOMAS = {
    es: ["español", "es-CO", "🇨🇴", true], en: ["inglés", "en-US", "🇺🇸", true], fr: ["francés", "fr-FR", "🇫🇷", true], pt: ["portugués", "pt-BR", "🇧🇷", true],
    de: ["alemán", "de-DE", "🇩🇪", true], it: ["italiano", "it-IT", "🇮🇹", true], zh: ["chino", "zh-CN", "🇨🇳", true], ja: ["japonés", "ja-JP", "🇯🇵", true],
    ko: ["coreano", "ko-KR", "🇰🇷", true], ru: ["ruso", "ru-RU", "🇷🇺", true], ar: ["árabe", "ar-SA", "🇸🇦", true], nl: ["neerlandés", "nl-NL", "🇳🇱", true],
    hi: ["hindi", "hi-IN", "🇮🇳", true], tr: ["turco", "tr-TR", "🇹🇷", true], pl: ["polaco", "pl-PL", "🇵🇱", true], sv: ["sueco", "sv-SE", "🇸🇪", true],
    el: ["griego", "el-GR", "🇬🇷", true], he: ["hebreo", "he-IL", "🇮🇱", true], uk: ["ucraniano", "uk-UA", "🇺🇦", true], vi: ["vietnamita", "vi-VN", "🇻🇳", true],
    th: ["tailandés", "th-TH", "🇹🇭", true], id: ["indonesio", "id-ID", "🇮🇩", true], ca: ["catalán", "ca-ES", "🏴", true], ro: ["rumano", "ro-RO", "🇷🇴", true],
    qu: ["quechua", "es-PE", "🇵🇪", false], gn: ["guaraní", "es-PY", "🇵🇾", false],
  };
  const ALIAS = { ingles: "en", english: "en", gringo: "en", frances: "fr", portugues: "pt", brasilero: "pt", brasileno: "pt", aleman: "de", italiano: "it", chino: "zh", mandarin: "zh",
    japones: "ja", coreano: "ko", ruso: "ru", arabe: "ar", holandes: "nl", neerlandes: "nl", hindi: "hi", turco: "tr", polaco: "pl", sueco: "sv", griego: "el", hebreo: "he",
    ucraniano: "uk", vietnamita: "vi", tailandes: "th", indonesio: "id", catalan: "ca", rumano: "ro", quechua: "qu", guarani: "gn", espanol: "es", castellano: "es" };
  const NOMBRES = Object.keys(ALIAS).join("|");
  const codigo = (x) => { const k = norm(x).replace(/^(?:el|al|a|en)\s+/, ""); return ALIAS[k] || (IDIOMAS[k] ? k : null); };
  const nombre = (c) => (IDIOMAS[c] || [c])[0];
  const locale = (c) => (IDIOMAS[c] || [, c])[1];
  const bandera = (c) => (IDIOMAS[c] || [, , "🌐"])[2];
  const offline = (c) => !!(IDIOMAS[c] || [])[3];

  // ======================================================================== ÓRDENES DEL TRADUCTOR
  const IDI = `(${NOMBRES})`;
  /** → {tr:"texto", texto, a, de?} · {tr:"ultimo", a} · {tr:"pantalla", a} · {tr:"foto", a} · {tr:"panel", otro} · {tr:"bajar", idioma} · null */
  function tradIntent(text) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[\s,]+/i, "");
    const f = fold(raw);
    const t = lead(norm(raw));
    let m;
    const cut = (mm, i) => raw.slice(mm.indices[i][0], mm.indices[i][1]).trim().replace(/^[«"“'‘:,\s]+|[»"”'’\s]+$/g, "").replace(/[.]$/, "");
    // panel de conversación
    if ((m = t.match(new RegExp(`^(?:abre(?:me)? el |abrir el |modo |activa el modo )?(?:traductor|traductor de (?:conversacion|voz)|conversacion traducida)(?:\\s+(?:de|en|al|a|con el|con)\\s+${IDI})?$`)))) return { tr: "panel", otro: m[1] ? ALIAS[m[1]] : "" };
    if ((m = t.match(new RegExp(`^(?:ayudame a (?:hablar|conversar) (?:con alguien )?(?:en|que habla)|quiero (?:hablar|conversar) con alguien (?:en|que habla)|modo conversacion (?:en|con))\\s+${IDI}$`)))) return { tr: "panel", otro: ALIAS[m[1]] };
    if ((m = t.match(new RegExp(`^traduce(?:me)? (?:lo que (?:dicen|escuches|me dicen|oigas|habla(?:n)?)|lo que esta diciendo)(?:\\s+(?:del|en)\\s+${IDI})?$`)))) return { tr: "panel", otro: m[1] ? ALIAS[m[1]] : "", escuchar: true };
    // bajar un idioma
    if ((m = t.match(new RegExp(`^(?:descarga(?:r|me)?|baja(?:r|me)?|instala(?:r)?)\\s+(?:el\\s+)?(?:idioma\\s+|paquete (?:de|del)\\s+)?${IDI}(?:\\s+(?:para (?:traducir|el traductor)|sin internet))+$`)))) return { tr: "bajar", idioma: ALIAS[m[1]] };
    // lo último, la pantalla, una foto
    const destino = (s) => (s ? ALIAS[s] : "");
    if ((m = t.match(new RegExp(`^traduce(?:me|lo)?\\s+(?:eso|esto|lo ultimo|lo que dijiste|tu respuesta|la respuesta|la ultima respuesta)(?:\\s+(?:al|a|en)\\s+${IDI})?$`)))) return { tr: "ultimo", a: destino(m[1]) };
    if ((m = t.match(new RegExp(`^(?:traducelo|traduceme eso|traducemelo)(?:\\s+(?:al|a|en)\\s+${IDI})?$`)))) return { tr: "ultimo", a: destino(m[1]) };
    if ((m = t.match(new RegExp(`^traduce(?:me)?\\s+(?:esta|la|lo que dice la|lo que hay en la)\\s+pantalla(?:\\s+(?:al|a|en)\\s+${IDI})?$`)))) return { tr: "pantalla", a: destino(m[1]) };
    if ((m = t.match(new RegExp(`^traduce(?:me)?\\s+(?:esta|una|la|este|el|lo que dice (?:esta|este|la|el))\\s+(?:foto|imagen|letrero|cartel|aviso|menu|carta|etiqueta|pagina|documento|hoja|texto de la foto)(?:\\s+(?:al|a|en)\\s+${IDI})?$`)))) return { tr: "foto", a: destino(m[1]) };
    // un texto: «traduce al inglés: …», «traduce … al inglés», «cómo se dice … en inglés», «qué significa "…"»
    const RE = [
      [new RegExp(`^(?:jarvis[\\s,]+)?(?:traduce(?:me)?|traducir|traduceme esto)\\s+(?:al|a|en)\\s+${IDI}\\s*[:,]?\\s+(.+)$`, "d"), 1, 2],
      [new RegExp(`^(?:jarvis[\\s,]+)?(?:traduce(?:me)?|traducir|como (?:se )?traduce(?:s)?)\\s+(.+?)\\s+(?:al|a|en)\\s+${IDI}\\s*[.?!]*$`, "d"), 2, 1],
      [new RegExp(`^(?:jarvis[\\s,]+)?[¿]?\\s*como (?:se dice|digo|se escribe|le digo|se pronuncia)\\s+(.+?)\\s+(?:en|al)\\s+${IDI}\\s*[?.!]*$`, "d"), 2, 1],
      [new RegExp(`^(?:jarvis[\\s,]+)?[¿]?\\s*(?:que significa|que quiere decir)\\s+[«"“'‘](.+?)[»"”'’]\\s*(?:en espanol)?\\s*[?.!]*$`, "d"), 0, 1],
      [new RegExp(`^(?:jarvis[\\s,]+)?[¿]?\\s*(?:que significa|que quiere decir)\\s+(.+?)\\s+en espanol\\s*[?.!]*$`, "d"), 0, 1],
    ];
    for (const [re, iA, iT] of RE) {
      m = re.exec(f);
      if (!m) continue;
      const texto = cut(m, iT);
      if (!texto || texto.length > 1500) continue;
      return { tr: "texto", texto, a: iA ? ALIAS[m[iA]] : "es" };
    }
    return null;
  }

  /** La IA traduce. → mensaje para IA.json */
  function tradPrompt(texto, a, de) {
    return `Traduce al ${nombre(a)}${de ? ` (el texto está en ${nombre(de)})` : ""} este texto, de forma natural, como lo diría una persona nativa, conservando el tono y el sentido (no palabra por palabra). ` +
      'Devuelve SOLO JSON: {"traduccion": "…", "de": "código ISO 639-1 del idioma original", "pronunciacion": "cómo se pronuncia para un hispanohablante, solo si el idioma de destino no es español (si no, \\"\\")", "nota": "una aclaración muy corta solo si hay algo importante (doble sentido, formal/informal), si no \\"\\""}.\n\nTexto:\n' + String(texto).slice(0, 4000);
  }
  function tradLimpia(j, texto) {
    j = j || {};
    const tr = String(j.traduccion || j.translation || "").trim();
    if (!tr) return null;
    const de = String(j.de || "").toLowerCase().slice(0, 2);
    return { texto: tr, de: IDIOMAS[de] ? de : "", pron: String(j.pronunciacion || "").trim().slice(0, 300), nota: String(j.nota || "").trim().slice(0, 300), original: texto };
  }
  /** En la conversación: si escribo yo (mi idioma) traduzco al otro, y al revés. */
  const destinoDe = (de, mio, otro) => (de === mio ? otro : de === otro ? mio : mio);

  // ======================================================================== CANCIONES
  /** → {mu:"reconocer", tararear?} · {mu:"lista"} · {mu:"ultima_poner"} · {mu:"ultima"} · null */
  function musicaIntent(text) {
    const t = lead(norm(text));
    if (/^(?:voy a tararear|te (?:voy a )?tarare(?:o|ar)|reconoce lo que tarareo|adivina (?:la cancion|que cancion) (?:que )?(?:tarareo|canto)|que cancion (?:estoy tarareando|tarareo|estoy cantando))\b/.test(t)) return { mu: "reconocer", tararear: true };
    if (/^(?:(?:que|cual) (?:es (?:esta|esa|la) )?cancion (?:es (?:esta|esa)|esta sonando|suena|suena ahora|es la que suena|estoy escuchando)|que cancion es|que (?:esta sonando|suena)(?: ahora)?|como se llama (?:esta|esa|la) cancion(?: que suena)?|de quien es (?:esta|esa) cancion|quien canta (?:esto|esta cancion|esa cancion)|(?:reconoce|identifica|escucha|adivina)(?: esta| la| esa)? cancion|shazam(?:ea(?:la)?)?|busca (?:esta|la) cancion que suena|que musica es esta|que tema es este)$/.test(t)) return { mu: "reconocer" };
    if (/^(?:mis canciones|(?:que )?canciones (?:he buscado|reconociste|encontraste)|historial de canciones|las canciones que (?:me )?(?:reconociste|encontraste))$/.test(t)) return { mu: "lista" };
    if (/^(?:pon(?:me|la)?|reproduce|ponla) (?:la ultima cancion|esa cancion|la cancion que (?:reconociste|encontraste))$|^ponla$/.test(t)) return { mu: "ultima_poner" };
    if (/^(?:cual (?:era|fue) la (?:ultima )?cancion|que cancion (?:era|fue) la (?:ultima|de hace rato))$/.test(t)) return { mu: "ultima" };
    return null;
  }
  /** La respuesta de AudD → {titulo, artista, album, fecha, spotify, apple, portada} · {error} · null (no la reconoció) */
  function auddParse(json) {
    let j; try { j = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return { error: "respuesta" }; }
    if (!j) return null;
    if (j.status === "error") { const c = j.error && j.error.error_code; return { error: c === 901 || c === 902 ? "limite" : c === 900 ? "clave" : "error", msg: (j.error && j.error.error_message) || "" }; }
    const r = j.result; if (!r || !r.title) return null;
    const sp = r.spotify || {}, am = r.apple_music || {};
    const portada = ((sp.album && sp.album.images && sp.album.images[0]) || {}).url || (am.artwork && am.artwork.url ? am.artwork.url.replace("{w}", "300").replace("{h}", "300") : "");
    return { titulo: r.title, artista: r.artist || "", album: r.album || "", fecha: r.release_date || "", spotify: (sp.external_urls || {}).spotify || "", apple: am.url || r.song_link || "", portada, fuente: "AudD" };
  }
  function geminiCancionPrompt(tararear) {
    return (tararear ? "En este audio una persona tararea o canta una melodía." : "En este audio suena música, quizá con ruido del lugar.") +
      " Identifica la canción. Devuelve SOLO JSON: {\"titulo\": \"\", \"artista\": \"\", \"seguro\": true|false, \"pista\": \"si la letra se entiende, a lo sumo 8 palabras seguidas de la letra para buscarla; si no, una descripción corta del género, idioma y ritmo\"}. " +
      "Si no la reconoces con seguridad, deja título y artista vacíos y \"seguro\": false. No inventes.";
  }
  function geminiCancionLimpia(j) {
    j = j || {};
    const titulo = String(j.titulo || "").trim(), artista = String(j.artista || "").trim();
    return { titulo, artista, seguro: !!j.seguro && !!titulo, pista: String(j.pista || "").trim().slice(0, 120) };
  }
  /** La búsqueda en Google devuelve «Título — Artista». */
  function busquedaCancion(texto) {
    const s = String(texto || "").replace(/\*\*/g, "").trim();
    if (!s || /^no s[eé]\b/i.test(s)) return null;
    const m = s.match(/[«"“]?([^«»"“”\n—–-]{2,80})[»"”]?\s*[—–-]\s*([^\n.]{2,60})/);
    return m ? { titulo: m[1].trim(), artista: m[2].trim(), fuente: "Gemini + Google" } : null;
  }
  const busquedaPrompt = (pista) => `¿Qué canción es la que tiene esta letra o se describe así: «${pista}»? Busca y responde SOLO en una línea: Título — Artista. Si no la encuentras con seguridad, responde: no sé.`;
  const ytQuery = (c) => `${c.titulo} ${c.artista}`.trim();
  const spotifyBuscar = (c) => "https://open.spotify.com/search/" + encodeURIComponent(ytQuery(c));
  const ytBuscar = (c) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(ytQuery(c));
  function cancionTexto(c) {
    const extra = [c.album, c.fecha ? String(c.fecha).slice(0, 4) : ""].filter(Boolean).join(" · ");
    return `🎵 **${c.titulo}**${c.artista ? " — " + c.artista : ""}${extra ? "\n" + extra : ""}`;
  }
  /** Dos canciones son la misma si coinciden título y artista (sin tildes ni mayúsculas). */
  const mismaCancion = (a, b) => norm(a.titulo) === norm(b.titulo) && norm(a.artista) === norm(b.artista);

  const API = { fold, norm, IDIOMAS, ALIAS, codigo, nombre, locale, bandera, offline, tradIntent, tradPrompt, tradLimpia, destinoDe,
    musicaIntent, auddParse, geminiCancionPrompt, geminiCancionLimpia, busquedaCancion, busquedaPrompt, ytQuery, spotifyBuscar, ytBuscar, cancionTexto, mismaCancion };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL12 = API;
})(typeof window !== "undefined" ? window : globalThis);
