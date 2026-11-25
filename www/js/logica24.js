/* Jarvis para Android 3.37 · lógica pura (se prueba con node): un Jarvis más humano y más inteligente.
   personalidad natural · respuestas con variedad · memoria que pregunta («¿cómo te fue en…?») · preguntas difíciles → pensar más. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"“”()]/g, " ").replace(/\s+/g, " ").trim();
  const pick = (l, rnd) => l[Math.floor((rnd || Math.random)() * l.length) % l.length];

  // ======================================================================== PERSONALIDAD NATURAL
  const NATURAL = "Tu forma de ser: hablas como una persona real de Colombia, cálida, tranquila y con chispa; de «tú», con naturalidad y sin acartonarte. " +
    "Varías cómo dices las cosas (no repitas siempre las mismas frases), usas expresiones cotidianas con medida («dale», «listo», «claro», «uy», «qué bien») y reaccionas a lo que te cuentan antes de responder, como lo haría alguien que escucha de verdad. " +
    "Nada de fórmulas de robot ni de mayordomo («A su servicio», «Como usted diga»), ni de presentarte como modelo de IA. " +
    "Responde a lo que la persona dijo en concreto, no con algo genérico; si es una charla, contesta corto, como en una conversación, y si viene al caso devuelve una pregunta sencilla (no siempre).";
  /** Para todas las personalidades: leer el ánimo y ajustarse (sin hacer de psicólogo). */
  const ANIMO = "Fíjate en cómo está la persona por la forma en que escribe o habla: si se nota cansada, triste, estresada o con afán, responde más corto, más cálido y al grano, sin decirle «noto que estás triste» salvo que sea evidente; si está contenta, acompáñala. ";

  // ======================================================================== RESPUESTAS CON VARIEDAD
  const LISTO = ["Listo", "Hecho", "Ya está", "Perfecto", "Dale", "Listo"];
  /** «Listo, …» al principio de una respuesta fija → otra forma de decirlo (solo con la personalidad natural). */
  function variar(text, rnd) {
    const s = String(text || "");
    const m = s.match(/^((?:[\p{Extended_Pictographic}️‍]+\s*)?)Listo([,.:!])(\s+)/u);
    if (!m) return s;
    const w = pick(LISTO, rnd);
    return m[1] + w + m[2] + m[3] + s.slice(m[0].length);
  }
  /** Quita lo que suena raro al decirlo: «, .» (cuando no hay a quién nombrar) y espacios dobles. */
  const pulir = (s) => String(s || "").replace(/,\s*([.?!»])/g, "$1").replace(/¿Sí,\s*\?/g, "¿Sí?").replace(/ {2,}/g, " ");
  /** Frases para cuando Jarvis abre el micrófono o se despide, según la personalidad. */
  const ESCUCHO = { natural: ["¿Sí?", "Dime.", "¿Qué necesitas?", "Te escucho.", "¿Qué hubo?"], jarvis: null };
  const ADIOS = ["Listo, me apago. ¡Hablamos!", "Chao, aquí estaré cuando me necesites.", "Me desconecto. ¡Que te vaya bien!"];
  const PIENSO = ["Déjame pensarlo bien…", "Uy, buena pregunta. Dame un segundo…", "Esta tiene su ciencia, déjame pensarla…", "A ver, pensémoslo con calma…"];
  const ACK_NATURAL = { pregunta: ["A ver…", "Déjame ver…", "Mmm…"], pedido: ["Dale…", "Va, ya mismo…", "Ya te ayudo…"], otro: ["Mmm…", "A ver…"] };

  // ======================================================================== MEMORIA QUE PREGUNTA
  const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
  const EVENTOS = "cita(?: medica| con el (?:medico|doctor|odontologo|dentista)| del (?:medico|odontologo))?|entrevista(?: de trabajo)?|examen(?: de [a-z]+)?|parcial(?: de [a-z]+)?|cirugia|operacion|audiencia|presentacion|exposicion|sustentacion|viaje(?: a [a-z]+)?|vuelo|partido|concierto|reunion con (?:el|la|mi) [a-z]+|prueba de [a-z]+|clase de manejo|consulta(?: medica)?|control medico|matricula|grado|boda|primer dia de trabajo";
  const RE_EV = new RegExp(`\\b(?:tengo|tendre|voy a tener|me toca|hay|es (?:mi|la|el))\\s+(?:una |un |el |la |mi |la gran )?(${EVENTOS})\\b`);
  /** «mañana tengo cita médica», «el viernes tengo entrevista de trabajo», «tengo examen de inglés pasado mañana» → {tema, dia (ms, 00:00)} */
  function seguimientoDe(text, now) {
    const t = norm(text);
    if (t.length > 220) return null;
    const m = t.match(RE_EV); if (!m) return null;
    const d = new Date(now || Date.now()); d.setHours(0, 0, 0, 0);
    let dia = null;
    if (/\bpasado manana\b/.test(t)) dia = 2;
    else if (/\bmanana\b/.test(t.replace(/\b(?:por|en|de|a) la manana\b/g, ""))) dia = 1;   // «por la mañana» no es «mañana»
    else if (/\bhoy\b|\besta (?:tarde|noche)\b/.test(t)) dia = 0;
    else { const w = t.match(/\b(?:el |este |el proximo )?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/); if (w) { const k = DIAS.indexOf(w[1]); dia = (k - d.getDay() + 7) % 7 || 7; } }
    if (dia == null) return null;
    d.setDate(d.getDate() + dia);
    const art = /^(?:cita|entrevista|cirugia|operacion|audiencia|presentacion|exposicion|sustentacion|reunion|prueba|clase|consulta|matricula|boda)/.test(m[1]) ? "la " : "el ";
    return { tema: art + m[1].replace(/\bmedica\b/, "médica").replace(/\bmedico\b/, "médico").replace(/\bodontologo\b/, "odontólogo").replace(/\bcirugia\b/, "cirugía").replace(/\boperacion\b/, "operación").replace(/\bpresentacion\b/, "presentación").replace(/\bexposicion\b/, "exposición").replace(/\bsustentacion\b/, "sustentación").replace(/\breunion\b/, "reunión").replace(/\bmatricula\b/, "matrícula").replace(/\bprimer dia\b/, "primer día"), dia: d.getTime() };
  }
  /** ¿Ya toca preguntar? Desde las 6 p. m. del día del evento y hasta 3 días después. */
  const tocaPreguntar = (s, now) => !s.preguntado && now >= s.dia + 18 * 3600e3 && now < s.dia + 4 * 864e5;
  const PREGUNTAS = [(t) => `Oye, ¿cómo te fue en ${t}?`, (t) => `¿Y qué tal ${t}? ¿Cómo salió todo?`, (t) => `Me quedé pensando: ¿cómo te fue en ${t}?`];
  const pregunta = (s, rnd) => pick(PREGUNTAS, rnd)(s.tema);

  // ======================================================================== PREGUNTAS DIFÍCILES → PENSAR MÁS
  const DIFICIL = /\b(?:por que|compar[ae]|diferencias? entre|ventajas|desventajas|pros y contras|analiza|que me conviene|cual me conviene|conviene mas|deberia|estrategia|plan para|planifica|calcula|cuanto (?:me|seria|tendria|daria)|resuelve|demuestra|paso a paso|como (?:puedo|hago para) (?:ahorrar|invertir|mejorar|resolver|aprender|negociar)|que harias|que pasaria si|explicame a fondo|evalua)\b/;
  /** ¿Merece pensar con calma? Preguntas largas de razonamiento, comparación, plan o cálculo (no charlas ni órdenes). */
  function dificil(text) {
    const raw = String(text || ""), t = norm(raw);
    if (t.length < 45 || t.length > 1500) return false;
    if (/^(?:hola|gracias|jaja|ok|dale|listo)\b/.test(t)) return false;
    const mates = /\d\s*[-+*/x^]\s*\d|\b(?:interes|porcentaje|ecuacion|probabilidad|cuota|credito)\b/.test(t);
    return DIFICIL.test(t) || (mates && t.length >= 60);
  }

  const API = { norm, NATURAL, ANIMO, variar, pulir, LISTO, ESCUCHO, ADIOS, PIENSO, ACK_NATURAL, seguimientoDe, tocaPreguntar, pregunta, dificil };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL24 = API;
})(typeof window !== "undefined" ? window : globalThis);
