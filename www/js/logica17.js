/* Jarvis para Android 3.28 · lógica pura (se prueba con node).
   Google Maps en las respuestas · tareas largas en segundo plano (Interactions API) · volumen de Jarvis · «Mi día». */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!;«»"“”.,]/g, " ").replace(/\s+/g, " ").trim();

  // ======================================================================== GOOGLE MAPS
  /** ¿La pregunta es sobre lugares de verdad (cerca, abiertos, cuánto me demoro…)? → true: la IA consulta Google Maps. */
  function necesitaMapas(text) {
    const t = norm(text);
    if (t.split(" ").length < 3) return false;
    if (/^(?:llevame|como llego|navega|abre (?:el )?(?:mapa|maps|waze)|pon (?:la )?ruta)/.test(t)) return false;   // eso abre Maps (ya existía)
    const lugar = /\b(?:restaurantes?|comida|almorzar|cenar|desayunar|cafe(?:teria)?s?|panaderias?|farmacias?|droguerias?|cajeros?|bancos?|gasolineras?|estaciones? de servicio|hospital(?:es)?|clinicas?|urgencias|supermercados?|tiendas?|centros? comerciales?|hoteles?|hostales?|parques?|museos?|gimnasios?|veterinarias?|ferreterias?|talleres?|parqueaderos?|bares?|discotecas?|cines?|iglesias?|colegios?|universidades?|papelerias?|peluquerias?|barberias?|lugares?|sitios?|sitio|planes?)\b/;
    const cerca = /\b(?:cerca|cercan[oa]s?|por aqui|por aca|alrededor|en mi barrio|en el barrio|a pie|caminando|abiert[oa]s?(?: ahora)?|que abra|a domicilio|mejor(?:es)? calificad[oa]s?|recomiendame|recomiendas|donde (?:queda|hay|puedo|venden|consigo|como)|a cuanto (?:queda|esta)|cuanto (?:me demoro|tardo|se demora|hay) (?:a|de|hasta|en llegar)|que tan lejos|horario de)\b/;
    if (lugar.test(t) && cerca.test(t)) return true;
    if (/\b(?:a cuanto queda|cuanto me demoro (?:a|hasta|en llegar)|que tan lejos (?:queda|esta)|donde queda)\b/.test(t)) return true;
    if (/\b(?:que (?:hago|hay para hacer|puedo hacer|visito) (?:en|por) (?:[a-z]+ ?){1,3}|planes? para (?:hoy|el fin de semana) en)\b/.test(t)) return true;
    return false;
  }

  // ======================================================================== TAREAS LARGAS
  /** «investiga a fondo X», «haz una investigación sobre X», «averigua a fondo X y avísame» → {tarea: "X"} */
  function tareaIntent(text) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[\s,]+/i, "");
    const t = norm(raw);
    if (/^(?:mis tareas(?: largas| en segundo plano)?|como va(?:n)? (?:la|mi|las|mis) investigaci(?:on|ones)|que (?:investigaciones|tareas) tengo)$/.test(t)) return { tarea: "", ver: true };
    const m = raw.match(/^(?:investiga(?:me)?\s+a\s+fondo|haz(?:me)?\s+una\s+investigaci[oó]n\s+(?:profunda\s+|a\s+fondo\s+|completa\s+)?(?:sobre|de|acerca\s+de)|investigaci[oó]n\s+(?:profunda|a\s+fondo)\s+(?:sobre|de)|averigua\s+a\s+fondo|investiga\s+en\s+segundo\s+plano)\s*[:,]?\s*(.+?)(?:\s*[,y]+\s*(?:av[ií]same|me\s+avisas)(?:\s+cuando\s+(?:est[eé]|termines))?.*)?$/i);
    if (m && m[1] && m[1].trim().length >= 3) return { tarea: m[1].trim().replace(/[.?¡!]+$/, "") };
    return null;
  }
  /** Lo que se le pide a la IA en la tarea larga. */
  function promptTarea(q) {
    return `Investiga a fondo y responde en español de Colombia: ${q}\n\nEntrega un informe claro y ordenado: un resumen de 3 líneas al comienzo, luego secciones con títulos cortos, datos concretos (cifras, fechas, nombres) y al final las fuentes con sus enlaces. Si algo no está claro o las fuentes no coinciden, dilo.`;
  }
  /** Los intentos para crear la tarea: el agente de investigación profunda y, si la cuenta no lo tiene, un modelo normal en segundo plano. */
  function intentosTarea(rotacion) {
    const r = (rotacion || []).filter((x) => /^gemini-(?:4|3\.8)/.test(x));
    const modelos = [...new Set(r.concat(["gemini-3.8-flash", "gemini-4-argon"]))];
    return [{ agent: "deep-research-preview-04-2026" }].concat(modelos.map((m) => ({ model: m })));
  }
  /** El texto final de una interacción (output_text, o los textos de outputs). */
  function textoInteraccion(j) {
    if (!j) return "";
    if (typeof j.output_text === "string" && j.output_text) return j.output_text;
    const out = [];
    (j.outputs || []).forEach((x) => {
      if (!x || x.type === "thought") return;
      if (typeof x.text === "string") out.push(x.text);
      (x.content || []).forEach((p) => { if (p && typeof p.text === "string") out.push(p.text); });
    });
    return out.join("\n").trim();
  }

  // ======================================================================== VOLUMEN DE JARVIS
  /** «sube el volumen de Jarvis», «baja tu volumen», «tu voz más fuerte» → {vj: subir|bajar|max} */
  function volumenJarvisIntent(text) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis)\s+/, "");
    const de = /(?:de jarvis|de tu voz|de la voz|tuyo|tu volumen|del asistente)/;
    if (/^(?:sube(?:le)?|aumenta|subeme)\s+(?:el\s+|tu\s+)?volumen/.test(t) && de.test(t)) return { vj: /maximo|a tope/.test(t) ? "max" : "subir" };
    if (/^(?:baja(?:le)?|disminuye|bajame)\s+(?:el\s+|tu\s+)?volumen/.test(t) && de.test(t)) return { vj: "bajar" };
    if (/^(?:habla|hablame)\s+(?:mas\s+)?(?:duro|fuerte|alto)$/.test(t)) return { vj: "subir" };
    if (/^(?:habla|hablame)\s+(?:mas\s+)?(?:bajo|bajito|suave|pasito)$/.test(t)) return { vj: "bajar" };
    if (/^volumen de jarvis al? (?:maximo|tope)$/.test(t)) return { vj: "max" };
    return null;
  }

  // ======================================================================== MI DÍA
  /** «mi día», «cómo viene mi día», «dame mi resumen del día», «daily brief» → true */
  function miDiaIntent(text) {
    const t = norm(text).replace(/^(?:jarvis|oye jarvis)\s+/, "");
    return /^(?:mi dia|(?:dame |hazme )?(?:el |mi )?resumen (?:de mi dia|del dia)|como (?:viene|va|pinta|se ve) mi dia|que me espera hoy|daily brief|mi resumen de hoy|prioridades de hoy|que es lo mas importante hoy)$/.test(t);
  }
  /** Lo que se le pide a la IA con los datos del día (sin nombres de estudiantes: el resumen ya no los trae). */
  function promptMiDia(datos) {
    return "Arma mi «Mi día» con estos datos. Máximo 6 viñetas cortas, lo más importante primero (lo urgente con ⚠️). " +
      "Al final, «Próximos pasos»: 2 o 3 acciones concretas que puedo hacer ya. No inventes nada que no esté en los datos.\n\n" + datos;
  }

  const API = { norm, necesitaMapas, tareaIntent, promptTarea, intentosTarea, textoInteraccion, volumenJarvisIntent, miDiaIntent, promptMiDia };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL17 = API;
})(typeof window !== "undefined" ? window : globalThis);
