/* Jarvis para Android 3.14 · lógica pura (se prueba con node).
   Preguntar cuando hay dos sentidos · deshacer · modo «pensar» · catálogo de lo que hace Jarvis · bienvenida. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");

  // ======================================================================== ¿QUÉ QUISISTE DECIR?
  /** Frases que pueden ser dos cosas distintas. ctx: {docente, casa (Home Assistant), timer (principal corriendo), timers (con nombre)}.
   *  → {pregunta, opciones:[[etiqueta, orden]]} o null. */
  function ambigua(text, ctx) {
    const t = lead(norm(text));
    ctx = ctx || {};
    if (ctx.docente && /^(?:(?:muestrame|abre|ver|leeme|dime)\s+)?(?:la|mi)\s+lista$/.test(t))
      return { pregunta: "¿Cuál lista?", opciones: [["🛒 La del mercado", "qué me falta comprar"], ["📋 Pasar lista en clase", "pasa lista"]] };
    if (ctx.docente && /^(?:(?:muestrame|abre|ver|dime|leeme)\s+)?(?:las|mis)\s+notas$/.test(t))
      return { pregunta: "¿Qué notas?", opciones: [["🎓 Las notas de los estudiantes", "#tab:clase"], ["📝 Mis notas y documentos", "#tab:quices"]] };
    if (ctx.casa && /^(?:prende|enciende|apaga)\s+(?:la\s+)?luz$/.test(t)) {
      const on = !/^apaga/.test(t);
      return { pregunta: "¿Qué luz?", opciones: [["🔦 La linterna", on ? "prende la linterna" : "apaga la linterna"], ["💡 La de la casa", on ? "prende la luz de la sala" : "apaga la luz de la sala"]] };
    }
    if (ctx.timer && (ctx.timers || []).length && /^(?:cuanto falta|cuanto queda|para el temporizador|cancela el temporizador|detén el temporizador|deten el temporizador)$/.test(t)) {
      const ops = [["⏱ El temporizador principal", /cuanto/.test(t) ? "¿cuánto falta?" : "para el temporizador"]];
      ctx.timers.slice(0, 3).forEach((n) => ops.push(["⏲ " + n, /cuanto/.test(t) ? `¿cuánto le falta al ${n}?` : `cancela el del ${n}`]));
      return { pregunta: "¿Cuál temporizador?", opciones: ops };
    }
    if (/^(?:borra|elimina)\s+(?:todo|todos)$/.test(t)) return { pregunta: "¿Qué quieres borrar? (no borro todo de una)", opciones: [["La conversación", "borra la conversación"], ["La lista del mercado", "borra toda la lista"], ["Nada", "nada"]] };
    return null;
  }

  // ======================================================================== DESHACER
  const DESHACER = /^(?:deshaz(?:lo)?|deshacer|deshaz eso|deshaz lo ultimo|no,? eso no|eso no era|cancela eso|revierte(?: eso)?|vuelve como estaba|me equivoque,? deshazlo)$/;
  const esDeshacer = (text) => DESHACER.test(lead(norm(text)));
  /** Lo que Jarvis guarda y se puede deshacer. */
  const CLAVES = ["recordatorios", "gastos", "listas", "misHab", "programadas", "pagos", "meds", "timers", "cumples", "disparadores", "memoria", "bitacora", "compromisos", "habitos", "presupuesto", "observador", "diario", "docs", "convs", "carro", "recLugar"];
  const AJUSTES = ["docente", "estilo", "ahorro", "fondoCuando", "fondoPantalla", "conduccion", "autoResp", "llamadas", "widgetFuente", "manosLibres", "interrumpir", "vozIA", "trato", "nombre"];
  function foto(D) {
    const o = {}; CLAVES.forEach((k) => { if (D[k] !== undefined) o[k] = JSON.stringify(D[k]); });
    if (D.cursos) o.cursos = JSON.stringify(D.cursos);
    o.ajustes = {}; AJUSTES.forEach((k) => { o.ajustes[k] = JSON.stringify(D.ajustes ? D.ajustes[k] : undefined); });
    return o;
  }
  /** ¿Qué cambió entre la foto y ahora? → [claves] */
  function cambios(f, D) {
    const out = [];
    Object.keys(f).forEach((k) => { if (k === "ajustes") return; if (JSON.stringify(D[k]) !== f[k]) out.push(k); });
    CLAVES.forEach((k) => { if (!(k in f) && D[k] !== undefined && JSON.stringify(D[k]) !== "[]" && JSON.stringify(D[k]) !== "{}") out.push(k); });
    AJUSTES.forEach((k) => { if (JSON.stringify(D.ajustes[k]) !== f.ajustes[k]) out.push("ajustes." + k); });
    return [...new Set(out)];
  }
  function restaurar(f, D, ks) {
    ks.forEach((k) => {
      if (k.startsWith("ajustes.")) { const a = k.slice(8), v = f.ajustes[a]; if (v === undefined) delete D.ajustes[a]; else D.ajustes[a] = JSON.parse(v); return; }
      if (f[k] === undefined) delete D[k]; else D[k] = JSON.parse(f[k]);
    });
  }
  const NOMBRES = { recordatorios: "recordatorios", gastos: "gastos", listas: "listas", misHab: "habilidades", programadas: "órdenes programadas", pagos: "pagos", meds: "medicamentos", timers: "temporizadores",
    cumples: "cumpleaños", disparadores: "disparadores", memoria: "lo que recuerdo de ti", bitacora: "tu diario", compromisos: "compromisos", habitos: "hábitos", presupuesto: "presupuesto", observador: "observador",
    diario: "diario de clase", docs: "documentos", convs: "conversaciones", carro: "dónde quedó el carro", recLugar: "recordatorios por lugar", cursos: "cursos y notas" };
  const nombreCambio = (k) => k.startsWith("ajustes.") ? "un ajuste" : NOMBRES[k] || k;

  // ======================================================================== MODO «PENSAR»
  function pensarIntent(text) {
    const raw = String(text || "").trim().replace(/^jarvis[\s,]+/i, "");
    const m = raw.match(/^(?:piensa(?:lo)? bien|piensa con calma|razona(?:lo)?(?: paso a paso)?|analiza(?:lo)? a fondo|modo pensar|piensalo)\s*[:,]?\s*([\s\S]{3,})$/i);
    return m ? { pensar: true, q: m[1].trim() } : null;
  }
  const PENSAR = "Antes de responder, razona con cuidado y paso a paso. Escribe primero «### Razonamiento» con tu análisis (revisa cálculos y supuestos), y al final «### Respuesta» con la respuesta clara y corta.";
  function separarPensar(t) {
    const s = String(t || ""); const k = s.search(/#{2,3}\s*Respuesta/i);
    if (k < 0) return { razon: "", respuesta: s };
    return { razon: s.slice(0, k).replace(/#{2,3}\s*Razonamiento\s*/i, "").trim(), respuesta: s.slice(k).replace(/#{2,3}\s*Respuesta\s*/i, "").trim() };
  }

  // ======================================================================== ¿QUÉ PUEDES HACER?
  const CATALOGO = [
    ["🗣️ Conversar y saber", ["¿Cómo funciona una vacuna?", "Piensa bien: si ahorro 200 mil al mes, ¿cuánto tengo en 3 años?", "Conversación en vivo", "Mira esto", "Practiquemos inglés", "Modo intérprete con inglés"]],
    ["⏰ Organizarte", ["Recuérdame a las 5 llamar a mamá", "Pon 10 minutos para el arroz", "¿Qué tengo hoy?", "Cada lunes a las 6 dime el clima", "Buenas noches, despiértame a las 6", "¿Qué hice ayer?"]],
    ["📱 Tu celular", ["Llama a Carolina", "Mándale un WhatsApp a Ana que ya voy", "Abre YouTube", "Prende la linterna", "¿Qué me perdí?", "¿Qué dice esta pantalla?", "Pídeme un Uber a la casa"]],
    ["💸 Plata", ["Gasté 25 mil en almuerzo", "¿Cuánto llevo este mes?", "La luz se paga el 15", "¿Cuánto son 50 dólares?", "Anota este recibo"]],
    ["🛒 Casa y vida", ["Agrega leche y huevos a la lista", "Cocinemos arroz con pollo", "Recuérdame la pastilla a las 8", "Ya hice ejercicio", "¿Dónde dejé el carro?", "Prende la luz de la sala"]],
    ["✍️ Escribir y crear", ["Díctame un mensaje para Carolina", "Hazme una presentación de fracciones", "Resume este documento", "Crea un widget con mis pagos del mes"]],
    ["🛡️ Protección", ["¿Esto es estafa?", "Silencia las llamadas de desconocidos", "Responde que estoy en clase hasta las 11", "Jarvis, emergencia", "Activa encontrar mi celular con la clave girasol"]],
    ["⚡ Automático", ["Cuando conecte el carro, modo conducción", "Cuando diga modo gimnasio, pon música y cuenta 45 minutos", "Modo ahorro", "Diagnóstico de batería"]],
    ["🎓 Modo docente", ["Escoge un estudiante de 7A", "Haz 4 grupos", "Pasa lista", "Hazme un quiz de fracciones de 5 preguntas", "Planea mi semana de clases", "Modo proyector"]],
  ];
  function ayudaIntent(text) { return /^(?:que (?:puedes|sabes) hacer|que haces|ayuda|que mas puedes hacer|para que sirves|como te uso|que funciones tienes|catalogo)$/.test(lead(norm(text))) ? { ayuda: true } : null; }

  // ======================================================================== BIENVENIDA
  function bienvenidaPendiente(D) {
    if (D.ajustes.bienvenida) return false;
    const usado = (D.chat || []).length > 2 || (D.cursos || []).length || (D.recordatorios || []).length || Object.values(D.ajustes.claves || {}).some((x) => x);
    return !usado;
  }

  const API = { norm, ambigua, esDeshacer, CLAVES, foto, cambios, restaurar, nombreCambio, pensarIntent, PENSAR, separarPensar, CATALOGO, ayudaIntent, bienvenidaPendiente };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL11 = API;
})(typeof window !== "undefined" ? window : globalThis);
