/* Jarvis para Android 3.18 · lógica pura (se prueba con node).
   Jarvis ve tu pantalla · reuniones (grabar, transcribir, acta y tareas) · memoria de largo plazo · compras y trámites ·
   llenar formularios con tus datos · subtítulos en vivo · reloj y audífonos. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const sinFin = (s) => String(s || "").trim().replace(/[?.!]+$/, "").trim();

  // ======================================================================== JARVIS VE TU PANTALLA
  const PANT_DEF = "Explícame lo que se ve en esta pantalla y qué puedo hacer aquí.";
  /** → {q} o null. reciente: hay una foto de la pantalla de hace un momento (entonces «¿qué es esto?» también cuenta). */
  function pantallaIntent(text, reciente) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[\s,]+/i, "");
    const t = lead(norm(raw));
    if (/^(?:mira|ve|revisa|analiza|lee)(?:me)?\s+(?:mi|la|esta)\s+pantalla$|^que (?:ves|hay) en (?:mi|la|esta) pantalla$|^(?:explicame|explica|describeme|describe) (?:mi|la|esta) pantalla$|^(?:ayudame|ayuda(?:me)?) con (?:esta pantalla|lo que (?:estoy viendo|veo))$|^que es (?:esto|lo) que estoy viendo$/.test(t)) return { q: PANT_DEF };
    let m = raw.match(/^(?:en|seg[uú]n|mirando)\s+(?:esta|la|mi)\s+pantalla[\s,:]+(.{3,})$/i) || raw.match(/^(?:mira|ve)\s+(?:mi|la|esta)\s+pantalla\s+y\s+(.{3,})$/i);
    if (m) return { q: sinFin(m[1]) + "?" };
    if (reciente && /\b(?:esto|esta app|este boton|esta opcion|aqui|aca|esta pantalla|lo que veo|que hago|donde (?:toco|le doy)|este mensaje|este error|esta pagina)\b/.test(t) && t.split(" ").length <= 25) return { q: raw };
    return null;
  }
  const pantallaPrompt = (q, app) => `Te comparto una foto de la pantalla de mi celular${app ? ` (estoy en la app «${app}»)` : ""}. ${q} ` +
    "Responde en español, corto y práctico: qué es, qué significa y qué puedo tocar (di el nombre del botón tal como se ve). Si ves datos delicados (claves, códigos, números de tarjeta), no los repitas.";

  // ======================================================================== REUNIONES
  /** → {re: "grabar"|"parar"|"pausa"|"seguir"|"lista"|"ultima"} o null */
  function reuIntent(text) {
    const t = lead(norm(text));
    if (/^(?:graba(?:me)?|grabar|empieza a grabar|comienza a grabar|inicia (?:la )?grabacion(?: de)?)(?:\s+(?:la|esta|mi|una|el|este))?\s*(?:reunion|clase|conferencia|charla|junta|consulta|entrevista|llamada|audio|todo)?(?: de hoy)?$|^modo reunion$|^(?:transcribe|resume) (?:esta|la) reunion mientras hablamos$/.test(t) && /grab|reunion|transcribe/.test(t)) return { re: "grabar" };
    if (/^(?:para|deten|termina|finaliza|acaba|corta)(?:r)?\s+(?:de grabar|la grabacion|la reunion|la grabadora)$|^(?:termino|se acabo) la reunion$|^ya termino la reunion$/.test(t)) return { re: "parar" };
    if (/^(?:pausa|pon en pausa)\s+(?:la grabacion|la grabadora|la reunion)$/.test(t)) return { re: "pausa" };
    if (/^(?:sigue|continua|reanuda)\s+(?:grabando|la grabacion|la reunion)$/.test(t)) return { re: "seguir" };
    if (/^(?:mis reuniones|(?:las )?actas(?: de reuniones)?|reuniones grabadas)$/.test(t)) return { re: "lista" };
    if (/^(?:resume(?:me)?|resumen de|que se dijo en|que quedo de|que acordamos en)\s+(?:la ultima|la) reunion$/.test(t)) return { re: "ultima" };
    return null;
  }
  const transcribePrompt = (i, n) => `Transcribe este audio en español (parte ${i} de ${n} de una reunión). Escribe lo que se dice, limpio y fiel, ` +
    "con marcas de tiempo [mm:ss] cada cambio de tema y el cambio de quien habla como «Persona 1:», «Persona 2:»… (o el nombre si se presentan). No resumas ni inventes; si algo no se entiende, escribe [inaudible].";
  function actaPrompt(transcripcion, hoy) {
    return `Hoy es ${hoy}. Esta es la transcripción de una reunión. Haz el acta. Devuelve SOLO JSON: {"titulo": "tema principal en pocas palabras", "resumen": "3 a 5 frases", ` +
      '"temas": ["…"], "acuerdos": ["…"], "tareas": [{"tarea": "qué hay que hacer", "responsable": "quién o \\"\\"", "fecha": "AAAA-MM-DD o \\"\\"", "hora": "HH:MM o \\"\\""}], "pendientes": ["dudas o temas sin cerrar"]}. ' +
      "Las fechas relativas («el viernes», «mañana») conviértelas a fecha real contando desde hoy. No inventes tareas.\n\nTranscripción:\n" + String(transcripcion).slice(0, 120000);
  }
  function actaLimpia(j) {
    j = j || {};
    const arr = (x) => (Array.isArray(x) ? x : []).map((y) => (typeof y === "string" ? y.trim() : y)).filter(Boolean);
    return { titulo: String(j.titulo || "Reunión").slice(0, 80), resumen: String(j.resumen || "").trim(), temas: arr(j.temas), acuerdos: arr(j.acuerdos),
      tareas: arr(j.tareas).filter((t) => t && t.tarea).map((t) => ({ tarea: String(t.tarea).trim(), responsable: String(t.responsable || "").trim(), fecha: /^\d{4}-\d{2}-\d{2}$/.test(t.fecha || "") ? t.fecha : "", hora: /^\d{1,2}:\d{2}$/.test(t.hora || "") ? t.hora : "" })),
      pendientes: arr(j.pendientes) };
  }
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const fechaLarga = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MESES[m - 1]}`; };
  function actaMd(a, fecha, duracion) {
    const L = (t, xs) => (xs.length ? `\n### ${t}\n` + xs.map((x) => "- " + x).join("\n") + "\n" : "");
    return `# ${a.titulo}\n_${fecha}${duracion ? " · " + duracion : ""}_\n\n${a.resumen}\n` + L("Temas", a.temas) + L("Acuerdos", a.acuerdos) +
      L("Tareas", a.tareas.map((t) => `${t.tarea}${t.responsable ? " — " + t.responsable : ""}${t.fecha ? " (" + fechaLarga(t.fecha) + (t.hora ? " " + t.hora : "") + ")" : ""}`)) + L("Pendientes", a.pendientes);
  }
  /** Una tarea con fecha futura → orden de recordatorio para Jarvis («recuérdame el 12 de noviembre a las 9:00 …»). */
  function tareaOrden(t, ahora) {
    if (!t.fecha) return null;
    const [h, mi] = (t.hora || "08:00").split(":").map(Number);
    const [y, m, d] = t.fecha.split("-").map(Number);
    const cuando = new Date(y, m - 1, d, h, mi);
    if (!(cuando.getTime() > (ahora || Date.now()))) return null;
    const hh = `${h % 12 || 12}${mi ? ":" + String(mi).padStart(2, "0") : ""} ${h < 12 ? "de la mañana" : h < 19 ? "de la tarde" : "de la noche"}`;
    return `recuérdame el ${d} de ${MESES[m - 1]} a las ${hh} ${t.tarea.charAt(0).toLowerCase() + t.tarea.slice(1)}`.replace(/[.]$/, "");
  }
  const durTexto = (s) => { s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`; };

  // ======================================================================== MEMORIA DE LARGO PLAZO
  /** → {q, persona?, ventana?} o null */
  function memIntent(text, ahora) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[\s,]+/i, "");
    const t = lead(norm(raw));
    const ok = /^(?:busca en (?:mi memoria|todo|mis cosas|mis mensajes|mis conversaciones)|recuerdas|te acuerdas|que me (?:dijo|escribio|conto|mando|pidio)|que (?:hablamos|hable|dijimos|quedamos)|que le (?:dije|escribi|prometi)|en que quedamos|cuando (?:hablamos|me dijo|me escribio|fue que)|de que hablamos|donde (?:anote|guarde|apunte)|que te conte|que sabes (?:de|sobre) (?:lo de|mi|el|la))\b/.test(t);
    if (!ok) return null;
    const q = sinFin(raw.replace(/^(?:busca en (?:mi memoria|todo|mis cosas|mis mensajes|mis conversaciones)[\s,:]*)/i, ""));
    return { q: q || raw, persona: personaDe(raw), ventana: ventana(t, ahora || Date.now()) };
  }
  /** El nombre de la persona: «¿qué me dijo Carlos…?», «qué hablé con Ana María…» (con mayúscula). */
  function personaDe(raw) {
    const m = String(raw).match(/(?:me (?:dijo|escribi[oó]|cont[oó]|mand[oó]|pidi[oó])|habl(?:é|e|amos) con|quedamos con|le (?:dije|escrib[ií]|promet[ií]) a)\s+(?:la |el |mi )?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
    return m ? m[1] : "";
  }
  /** «ayer», «la semana pasada», «hace dos semanas», «el mes pasado», «el lunes» → {desde, hasta} (ms) o null. */
  const NUM = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  function ventana(t, ahora) {
    const D = 864e5, d0 = new Date(ahora); d0.setHours(0, 0, 0, 0); const hoy = d0.getTime();
    let m;
    if (/\banteayer\b/.test(t)) return { desde: hoy - 2 * D, hasta: hoy - D };
    if (/\bayer\b/.test(t)) return { desde: hoy - D, hasta: hoy };
    if (/\bhoy\b/.test(t)) return { desde: hoy, hasta: ahora };
    if (/\bla semana pasada\b/.test(t)) return { desde: hoy - 14 * D, hasta: hoy - 5 * D };
    if (/\besta semana\b/.test(t)) return { desde: hoy - 7 * D, hasta: ahora };
    if (/\bel mes pasado\b/.test(t)) return { desde: hoy - 62 * D, hasta: hoy - 25 * D };
    if (/\beste mes\b/.test(t)) return { desde: hoy - 31 * D, hasta: ahora };
    if ((m = t.match(/\bhace (\d+|un|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez) (dias?|semanas?|mes(?:es)?)\b/))) {
      const n = NUM[m[1]] || +m[1], u = /^d/.test(m[2]) ? 1 : /^s/.test(m[2]) ? 7 : 30, c = hoy - n * u * D, r = Math.max(1, Math.round(n * u * 0.35)) * D;
      return { desde: c - r, hasta: Math.min(ahora, c + r + D) };
    }
    const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
    if ((m = t.match(/\bel (domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/))) {
      let k = (d0.getDay() - DIAS.indexOf(m[1]) + 7) % 7 || 7; const d = hoy - k * D; return { desde: d, hasta: d + D };
    }
    return null;
  }
  const VACIAS = new Set("el la los las un una unos unas de del al a en y o que me mi mis tu te se lo le les con por para sobre como cuando donde quien cual es fue era hay su sus ya no si mas muy pero este esta esto ese esa eso dijo dije hablamos recuerdas acuerdas busca memoria todo cosas escribio conto quedamos".split(" "));
  const raiz = (w) => w.length > 5 ? w.replace(/(?:mente|ciones|cion|es|s)$/, "") : w.replace(/s$/, "");
  const tokens = (s) => norm(s).replace(/[^a-z0-9ñ ]/g, " ").split(" ").filter((w) => w.length > 2 && !VACIAS.has(w)).map(raiz);
  /** BM25 sencillo + persona + fecha. entradas: [{fuente, titulo, texto, t, de?}] → las mejores (con .sc). extra: palabras parecidas (de la IA). */
  function buscarMem(entradas, q, opts) {
    opts = opts || {};
    const qs = [...new Set(tokens(q).concat((opts.extra || []).flatMap(tokens)))];
    const per = opts.persona ? tokens(opts.persona) : [];
    if (!qs.length && !per.length) return [];
    const docs = entradas.map((e) => ({ e, w: tokens((e.de || "") + " " + (e.titulo || "") + " " + e.texto) }));
    const N = docs.length || 1, avg = docs.reduce((s, d) => s + d.w.length, 0) / N || 1;
    const df = {}; qs.forEach((q1) => { df[q1] = docs.filter((d) => d.w.includes(q1)).length; });
    const out = [];
    docs.forEach((d) => {
      let sc = 0;
      qs.forEach((q1) => { const f = d.w.filter((w) => w === q1).length; if (!f) return; const idf = Math.log(1 + (N - df[q1] + 0.5) / (df[q1] + 0.5)); sc += idf * (f * 2.2) / (f + 1.2 * (0.25 + 0.75 * d.w.length / avg)); });
      if (per.length) { const quien = tokens((d.e.de || "") + " " + d.e.texto); if (per.every((p) => quien.includes(p))) sc = sc * 1.8 + 1.5; else if (opts.soloPersona) return; }
      if (opts.ventana && d.e.t) { if (d.e.t >= opts.ventana.desde && d.e.t <= opts.ventana.hasta) sc *= 1.7; else sc *= 0.55; }
      if (sc > 0.3) out.push(Object.assign({ sc }, d.e));
    });
    return out.sort((a, b) => b.sc - a.sc || (b.t || 0) - (a.t || 0)).slice(0, opts.max || 12);
  }
  const expandirPrompt = (q) => `Para buscar en mis notas y mensajes, dame palabras clave parecidas a esta pregunta (sinónimos, formas de decirlo en Colombia). Pregunta: «${q}». Devuelve SOLO JSON: {"palabras": ["…"]} (máximo 10).`;
  const dia = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  function memPrompt(q, items, hoy) {
    return `Hoy es ${hoy}. Respóndeme usando SOLO estos recuerdos (mensajes, notas y conversaciones mías). Pregunta: «${q}».\n\n` +
      items.map((x, i) => `[${i + 1}] (${x.fuente}${x.de ? " · " + x.de : ""}${x.t ? " · " + dia(x.t) : ""}) ${String(x.texto).slice(0, 600)}`).join("\n") +
      "\n\nResponde corto, en español, citando entre corchetes el número del recuerdo que usas ([1], [2]) y diciendo la fecha. Si no está en los recuerdos, dilo con honestidad.";
  }

  // ======================================================================== COMPRAS Y TRÁMITES
  function compraIntent(text) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[\s,]+/i, "").replace(/^[¿¡]\s*/, "");
    const t = lead(norm(raw));
    let m;
    if ((m = raw.match(/^(?:compara(?:me)?\s+(?:los\s+)?precios?\s+(?:de|del|para)|d[oó]nde\s+(?:est[aá]|venden|consigo|compro)\s+(?:m[aá]s\s+barato|barato)|busca(?:me)?\s+(?:el\s+)?(?:mejor|m[aá]s\s+bajo)\s+precio\s+(?:de|del|para)|cu[aá]nto\s+(?:cuesta|vale)n?|en\s+cu[aá]nto\s+est[aá]n?|precio\s+de)\s+(.{2,80})$/i)) && !/\b(?:dolar|euro|gasolina|acpm)\b/.test(t))
      return { co: "precios", producto: sinFin(m[1]).replace(/\s+en colombia$/i, "") };
    if ((m = raw.match(/^(?:c[oó]mo\s+(?:hago|saco|renuevo|tramito|pido|solicito|obtengo|consigo)\s+(?:el|la|los|las|mi|un|una)?\s*|qu[eé]\s+(?:necesito|piden|me piden)\s+para\s+(?:sacar|renovar|tramitar|pedir|solicitar|hacer)\s+(?:el|la|los|las|mi|un|una)?\s*|requisitos\s+(?:para|de)\s+(?:sacar|renovar|tramitar)?\s*(?:el|la|los|las|mi|un|una)?\s*|tr[aá]mite\s+(?:de|del|para)\s+(?:el|la)?\s*)(.{3,80})$/i))) {
      const q = sinFin(m[1]);
      if (/\b(?:pasaporte|cedula|licencia|visa|certificado|antecedentes|rut|registro|libreta|permiso|pase|soat|tecnomecanica|impuesto|predial|eps|pension|cesantias|subsidio|tarjeta profesional|apostilla|pensum|matricula|diploma|acta|partida|sisben|mipres|cita)\b/.test(norm(q))) return { co: "tramite", q };
    }
    if (/^(?:llena(?:me)?|completa(?:me)?|rellena)\s+(?:este|el|esta|la)\s+(?:formulario|registro|planilla|pagina|solicitud)(?:\s+con mis datos)?$|^pon mis datos (?:aqui|en (?:el|este) formulario)$/.test(t)) return { co: "form" };
    return null;
  }
  const preciosPrompt = (p) => `Busca en tiendas de Colombia (Mercado Libre, Éxito, Falabella, Alkosto, Ktronix, Homecenter, Olímpica, Jumbo, Amazon con envío a Colombia y similares) el precio actual de: «${p}». ` +
    "Responde en español con una tabla markdown de 3 a 6 filas, de la más barata a la más cara: | Tienda | Producto exacto | Precio (COP) |. Debajo, en una frase, cuál conviene y por qué (garantía, envío). No inventes precios: usa solo lo que encuentres.";
  const tramitePrompt = (q) => `Explícame el trámite en Colombia: «${q}». Busca la información oficial y actual. En español, corto: 1) dónde se hace (entidad y página oficial), 2) requisitos, 3) costo actual, 4) pasos, 5) cuánto tarda. Si hay que pedir cita, dilo. No inventes datos.`;
  /** Los precios de la tabla → [{tienda, producto, precio}] de menor a mayor. */
  function preciosTabla(md) {
    const out = [];
    String(md || "").split("\n").forEach((l) => {
      const c = l.split("|").map((x) => x.trim()).filter((x, i, a) => !(i === 0 && x === "") && !(i === a.length - 1 && x === ""));
      if (c.length < 3 || /^-+$/.test(c[0].replace(/[:\s]/g, "")) || /tienda/i.test(c[0])) return;
      const m = c[2].replace(/\s/g, "").match(/\$?([\d.,]{4,})/); if (!m) return;
      const n = +m[1].replace(/[.,](?=\d{3}(?:\D|$))/g, "").replace(",", ".");
      if (n > 0) out.push({ tienda: c[0].replace(/\*\*/g, ""), producto: c[1].replace(/\*\*/g, ""), precio: Math.round(n) });
    });
    return out.sort((a, b) => a.precio - b.precio);
  }

  // ======================================================================== FORMULARIOS (tus datos, sin la IA)
  const CAMPOS = [
    ["email", /\b(?:e-?mail|correo)\b/], ["telefono", /\b(?:telefono|celular|movil|whatsapp|numero de contacto)\b/],
    ["documento", /\b(?:cedula|documento|identificacion|c\.?c\b|numero de id|dni|nit)\b/], ["fechaNac", /\b(?:fecha de nacimiento|nacimiento|cumpleanos)\b/],
    ["apellido", /\bapellidos?\b/], ["nombre", /\b(?:nombres?|primer nombre)\b/], ["direccion", /\b(?:direccion|domicilio|calle)\b/],
    ["ciudad", /\b(?:ciudad|municipio)\b/], ["barrio", /\bbarrio\b/], ["empresa", /\b(?:empresa|compania|institucion|colegio)\b/], ["cargo", /\b(?:cargo|ocupacion|profesion)\b/],
  ];
  const PELIGRO = /\b(?:contrasena|clave|password|pin|cvv|cvc|codigo de seguridad|codigo de verificacion|otp|token|tarjeta|numero de cuenta|vencimiento)\b/;
  function campoDe(label) {
    const t = norm(label);
    if (!t || PELIGRO.test(t)) return null;
    if (/\bnombre completo\b/.test(t)) return "nombreCompleto";
    for (const [k, re] of CAMPOS) if (re.test(t)) return k;
    return null;
  }
  /** nodos del agente ({i, t, e, p}) + tu perfil → [{i, k, v}] (solo campos escribibles, nunca contraseñas ni datos de pago). */
  function mapearCampos(nodos, perfil) {
    perfil = perfil || {};
    const val = (k) => (k === "nombreCompleto" ? [perfil.nombre, perfil.apellido].filter(Boolean).join(" ") : perfil[k] || "");
    const usados = new Set(), out = [];
    (nodos || []).forEach((n, idx) => {
      if (!n.e || n.p) return;
      let k = campoDe(n.t);
      if (!k) { const prev = (nodos[idx - 1] || {}); if (!prev.e) k = campoDe(prev.t); }          // la etiqueta suele estar justo antes del campo
      if (!k || usados.has(k)) return;
      const v = val(k); if (!v) return;
      usados.add(k); out.push({ i: n.i, k, v });
    });
    return out;
  }
  const PERFIL = [["nombre", "Nombres"], ["apellido", "Apellidos"], ["documento", "Número de documento"], ["fechaNac", "Fecha de nacimiento (DD/MM/AAAA)"], ["email", "Correo"],
    ["telefono", "Celular"], ["direccion", "Dirección"], ["barrio", "Barrio"], ["ciudad", "Ciudad"], ["empresa", "Empresa o institución"], ["cargo", "Cargo u ocupación"]];

  // ======================================================================== SUBTÍTULOS
  const IDI = { ingles: "en-US", frances: "fr-FR", portugues: "pt-BR", aleman: "de-DE", italiano: "it-IT", japones: "ja-JP", coreano: "ko-KR", chino: "zh-CN", ruso: "ru-RU", espanol: "es-CO" };
  function subIntent(text) {
    const t = lead(norm(text));
    if (/^(?:quita|apaga|cierra|desactiva|para)(?:r)?\s+(?:los\s+)?subtitulos$/.test(t)) return { su: "off" };
    const m = t.match(/^(?:pon(?:me)?|activa|prende|abre|muestra(?:me)?)?\s*(?:los\s+)?subtitulos(?:\s+en vivo)?(?:\s+(?:del|de|en)\s+(ingles|frances|portugues|aleman|italiano|japones|coreano|chino|ruso|espanol))?(?:\s+(?:al|a)\s+(espanol|ingles))?$|^(?:subtitula|traduce)\s+(?:el video|esto|lo que suena|la pelicula|la serie|la clase|la conferencia)(?:\s+(?:del|de|en)\s+(ingles|frances|portugues|aleman|italiano|japones|coreano|chino|ruso))?$/);
    if (!m || !/subtitul|video|suena|pelicula|serie|clase|conferencia|esto/.test(t)) return null;
    const de = m[1] || m[3];
    return { su: "on", de: de ? IDI[de] : "", a: m[2] ? IDI[m[2]].slice(0, 2) : "" };
  }

  // ======================================================================== RELOJ Y AUDÍFONOS
  function accIntent(text) {
    const t = lead(norm(text));
    if (/^(?:activa|conecta|pon|prende)(?:r)?\s+(?:a\s+)?(?:jarvis en\s+)?(?:el|mi)\s+reloj$|^modo reloj$|^jarvis en el reloj$/.test(t)) return { acc: "reloj", on: true };
    if (/^(?:desactiva|desconecta|quita|apaga)(?:r)?\s+(?:a\s+)?(?:jarvis (?:en|del)\s+)?(?:el|mi)\s+reloj$/.test(t)) return { acc: "reloj", on: false };
    if (/^(?:activa|pon|prende)(?:r)?\s+(?:el\s+)?modo audifonos$|^modo audifonos$/.test(t)) return { acc: "audifonos", on: true };
    if (/^(?:desactiva|quita|apaga)(?:r)?\s+(?:el\s+)?modo audifonos$/.test(t)) return { acc: "audifonos", on: false };
    return null;
  }
  const AUDIFONOS = " La persona te escucha por audífonos y quizá no ve la pantalla: responde en 1 o 2 frases claras, sin listas, tablas ni enlaces, y di los números en palabras.";
  /** Lo que se dice en el reloj: corto y sin formato. */
  const paraReloj = (t) => String(t || "").replace(/```[\s\S]*?```/g, "").replace(/<[^>]+>/g, "").replace(/[*_#>`|]/g, "").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim().slice(0, 600);

  const API = { norm, pantallaIntent, pantallaPrompt, PANT_DEF, reuIntent, transcribePrompt, actaPrompt, actaLimpia, actaMd, tareaOrden, durTexto, fechaLarga,
    memIntent, personaDe, ventana, tokens, buscarMem, expandirPrompt, memPrompt, compraIntent, preciosPrompt, tramitePrompt, preciosTabla,
    campoDe, mapearCampos, PERFIL, subIntent, accIntent, AUDIFONOS, paraReloj };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL13 = API;
})(typeof window !== "undefined" ? window : globalThis);
