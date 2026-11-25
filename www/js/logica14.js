/* Jarvis para Android 3.23 · lógica pura (se prueba con node).
   ¿La pregunta necesita buscar en internet? · los Ajustes por temas · las formas de llamar a Jarvis (y cuánta batería gastan). */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!;«»"“”.,:]/g, " ").replace(/\s+/g, " ").trim();

  // ======================================================================== ¿BUSCAR EN INTERNET?
  /** Preguntas sobre hechos actuales: noticias, resultados, precios, cargos, fechas de eventos, estrenos… → true */
  function necesitaBuscar(text, hoy) {
    const t = norm(text);
    if (t.split(" ").length < 3) return false;
    const y = (hoy ? new Date(hoy) : new Date()).getFullYear();
    if (/\b(?:noticias?|ultima hora|ultimas? noticias|que paso (?:hoy|ayer|con)|que esta pasando|tendencias?)\b/.test(t)) return true;
    if (/\b(?:quien gano|como quedo|resultado|marcador|cuando juega|a que hora juega|tabla de posiciones|clasificacion|partido de (?:hoy|anoche|manana)|el partido)\b/.test(t)) return true;
    if (/\b(?:precio|cuanto (?:cuesta|vale|esta)|cotizacion|valor (?:del|de la)|trm|tasa de cambio|bitcoin|accion(?:es)? de)\b/.test(t) && !/\b(?:receta|formula|area|perimetro)\b/.test(t)) return true;
    if (/\b(?:quien es (?:el|la) (?:actual|nuevo|nueva)|actual (?:presidente|presidenta|alcalde|alcaldesa|ministro|ministra|gobernador|director|ceo)|presidente de|alcalde de|gobernador de)\b/.test(t)) return true;
    if (/\b(?:estreno|estrena|lanzamiento|salio|sale|nueva (?:version|temporada)|ultimo (?:album|disco|modelo|capitulo)|ultima (?:version|temporada|cancion))\b/.test(t)) return true;
    if (/\b(?:hoy|ayer|esta semana|este mes|este ano|ahora mismo|actualmente|en este momento|recientemente|ultimamente)\b/.test(t) && !/\b(?:recuerdame|pon|alarma|temporizador|tengo|mi agenda|me toca)\b/.test(t)) return true;
    if (new RegExp(`\\b(?:${y}|${y + 1})\\b`).test(t)) return true;
    if (/\b(?:elecciones|encuesta|horario de atencion|esta abierto|abre (?:hoy|los domingos)|pico y placa|dia sin carro|festivo)\b/.test(t)) return true;
    return false;
  }

  // ======================================================================== AJUSTES POR TEMAS
  /** [clave, ícono, título, explicación, palabras de los grupos que entran ahí] (el orden es el de la pantalla) */
  const TEMAS = [
    ["ia", "🧠", "Inteligencia artificial", "La IA en la nube, la del celular y cuánto usas", /^(?:inteligencia artificial|ia de respaldo|uso de la ia|modelos y probador|segunda ia en la nube|lugares con google maps|modelos gguf|busqueda por significado|gemini nano|respaldo gratis|si la ia principal falla)/],
    ["voz", "🎙️", "Voz y conversación", "Cómo suena y cómo te escucha Jarvis", /^(?:voz|la voz de jarvis|voz natural|mientras jarvis habla|manos libres|conversacion|formas de llamar|«?jarvis»? en segundo plano|jarvis en segundo plano|volumen de jarvis|dictado sin internet|dictado ordenado|gemini en vivo|notas de voz compartidas|mas humano)/],
    ["tu", "👤", "Tú y tu asistente", "Tu nombre, personalidad, memoria y datos", /^(?:tu$|asistente|como te llama|memoria|mis datos|habilidades propias|modos expertos)/],
    ["rutinas", "🗓️", "Rutinas y día a día", "Órdenes programadas, disparadores, salud y casa", /^(?:ordenes programadas|vida diaria|disparadores|medicamentos|resumen de la manana|casa|mi dia y tareas largas|salud \(health connect\)|pico y placa|tu agenda y tus salidas|rutina de sueno|informe del mes|vehiculo y repaso)/],
    ["celular", "📱", "Celular y apps", "Controlar el celular, mensajes, pantalla, reloj", /^(?:controlar el celular|mensajes|proteccion y agente|jarvis ve tu pantalla|reloj y audifonos|subtitulos|jarvis en el celular|traductor|canciones|avisos en vivo|cuidar el celular|sugerencias de tus mensajes|contestador de llamadas|widget a tu medida|tiempo de pantalla|wifi para compartir|encontrar el celular)/],
    ["aspecto", "✨", "Diseño", "Cristal, letra y pantalla", /^(?:diseno|pantalla$)/],
    ["bateria", "🔋", "Batería", "Qué gasta batería y cómo ahorrar", /^(?:bateria|lo que gasta|diagnostico)/],
    ["datos", "🔒", "Privacidad y copias", "Seguridad, copias y el computador", /^(?:seguridad|copia de seguridad|tus datos|sincronizar|el jarvis del computador|google|agenda privada)/],
    ["docente", "🎓", "Modo docente", "Clase, horario y colegio", /^(?:en clase|horario y colegio)/],
    ["mas", "🛠️", "Más", "Todo lo demás", /./],
  ];
  /** El tema de un grupo de Ajustes por su título. */
  function temaDe(titulo) {
    const t = norm(titulo).replace(/^«|»/g, "");
    for (const [k, , , , re] of TEMAS) if (k !== "mas" && re.test(t)) return k;
    return "mas";
  }

  // ======================================================================== FORMAS DE LLAMAR A JARVIS
  /** [clave, título, cómo, batería] · batería: "nada" | "muy poca" | "media" */
  const FORMAS = [
    ["orbe", "Tocar el orbe", "Abre la conversación (en vivo si tienes Gemini).", "nada"],
    ["asistente", "Botón de asistente", "Mantén presionado el botón de inicio o de encendido (escoge Jarvis como app de asistente).", "nada"],
    ["volumen", "Mantener «bajar volumen»", "Con la pantalla encendida, mantén presionado bajar volumen 1 segundo (usa el control por voz de Jarvis). Toques cortos siguen bajando el volumen.", "nada"],
    ["espalda", "Dos toques en la espalda", "Pixel: Ajustes › Sistema › Gestos › Quick Tap › Abrir app › Jarvis. Samsung: Good Lock › RegiStar › Back-Tap.", "nada"],
    ["audifonos", "Botón de los audífonos", "Mantén presionado el botón de tus audífonos (con Jarvis como app de asistente).", "nada"],
    ["mosaico", "Botón en Ajustes rápidos", "Baja la cortina, toca el lápiz y arrastra «Jarvis».", "nada"],
    ["widget", "Widget en la pantalla de inicio", "Mantén presionada la pantalla de inicio › Widgets › Jarvis.", "nada"],
    ["reloj", "Desde el reloj", "Activa «Jarvis en el reloj»: toca Preguntar en el aviso.", "nada"],
    ["burbuja", "Burbuja flotante", "Una burbuja encima de las apps: tócala.", "muy poca"],
    ["palabra", "Decir «Jarvis»", "Escucha todo el tiempo (sin internet). Es la única que gasta batería de verdad.", "media"],
  ];

  const API = { norm, necesitaBuscar, TEMAS, temaDe, FORMAS };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL14 = API;
})(typeof window !== "undefined" ? window : globalThis);
