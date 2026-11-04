/* Jarvis para Android 3.11 · lógica pura (se prueba con node).
   Agente que maneja tus apps · actuar sobre lo que ves · visión en vivo · sugerencias que aprende · estafas ·
   respuestas automáticas · filtro de llamadas · fotos · «¿qué hice el…?» · dictado pulido · widgets · presentaciones. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");

  // ======================================================================== AGENTE QUE MANEJA TUS APPS
  const APPS = { uber: "Uber", didi: "DiDi", cabify: "Cabify", indrive: "inDrive", rappi: "Rappi", ifood: "iFood", "mercado libre": "Mercado Libre", mercadolibre: "Mercado Libre", amazon: "Amazon", temu: "Temu", shein: "Shein", falabella: "Falabella",
    exito: "Éxito", spotify: "Spotify", youtube: "YouTube", "youtube music": "YouTube Music", netflix: "Netflix", "google maps": "Maps", maps: "Maps", waze: "Waze", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", x: "X", twitter: "X",
    "play store": "Play Store", chrome: "Chrome", gmail: "Gmail", calendario: "Calendario", "google calendar": "Calendario", keep: "Keep", "google keep": "Keep", drive: "Drive", fotos: "Fotos", "google fotos": "Fotos", telegram: "Telegram", whatsapp: "WhatsApp",
    duolingo: "Duolingo", booking: "Booking", airbnb: "Airbnb", despegar: "Despegar", avianca: "Avianca", picap: "Picap", linkedin: "LinkedIn", pinterest: "Pinterest" };
  const BANCOS = /\b(?:nequi|daviplata|bancolombia|davivienda|bbva|banco|bogota|occidente|av villas|scotiabank|colpatria|itau|nu |nubank|lulo|movii|dale|pse|paypal|binance|coinbase|tarjeta)\b/;
  const APP_RE = Object.keys(APPS).sort((a, b) => b.length - a.length).map((k) => k.replace(/ /g, "\\s")).join("|");
  /** «pídeme un Uber a la casa», «busca en Mercado Libre audífonos baratos», «pon en Spotify música para estudiar», «hazlo tú en Rappi: pide lo de siempre» */
  function agenteIntent(text) {
    const t = lead(norm(text));
    if (BANCOS.test(t + " ") && /\b(?:en|abre|usa|desde)\b/.test(t) && /\b(?:transfier|pag|consign|envia|manda|compra)/.test(t)) return { agente: "banco" };
    let m;
    const app = (s) => { const x = s.match(new RegExp(`\\b(${APP_RE})\\b`)); return x ? APPS[x[1].replace(/\s+/g, " ")] : null; };
    if ((m = t.match(/^(?:modo agente|hazlo tu|haz tu|encargate|tu manejas)\s*(?:en\s+)?[,:]?\s*(.+)$/))) { const a = app(m[1]); return a ? { agente: "app", app: a, meta: m[1] } : { agente: "sinapp", meta: m[1] }; }
    if ((m = t.match(new RegExp(`^(?:pide(?:me)?|pedir|ordena(?:me)?|reserva(?:me)?|busca(?:me)?|compra(?:me)?|agrega(?:me)?|pon(?:me)?|reproduce|programa(?:me)?|consigue(?:me)?|cotiza(?:me)?|mira|revisa)\\b.*\\b(?:en|por|desde|con)\\s+(?:el |la )?(${APP_RE})\\b`)))) return { agente: "app", app: APPS[m[1].replace(/\s+/g, " ")], meta: t };
    if ((m = t.match(/^(?:pide(?:me)?|pedir)\s+(?:un|una)\s+(uber|didi|cabify|indrive|taxi|picap)\b(.*)$/))) return { agente: "app", app: m[1] === "taxi" ? "DiDi" : APPS[m[1]], meta: t };
    if ((m = t.match(new RegExp(`^(?:abre|entra a|ve a)\\s+(${APP_RE})\\s+y\\s+(.+)$`)))) return { agente: "app", app: APPS[m[1].replace(/\s+/g, " ")], meta: t };
    return null;
  }
  /** ¿Este botón ya es pagar, confirmar o enviar? → el agente se detiene y te deja a ti el último toque. */
  function riesgo(label) {
    return /\b(?:pagar|paga|pago|comprar|compra ahora|confirmar|confirma|realizar pedido|hacer pedido|pedir ahora|ordenar|finalizar|checkout|place order|pay|buy now|transferir|enviar dinero|solicitar|request|book|reservar ahora|reserva ahora|suscribir|suscribete|subscribe|aceptar y pagar|continuar al pago|ir a pagar|enviar|send|publicar|post|eliminar|borrar|delete)\b/.test(norm(label));
  }
  function uiTexto(nodos) {
    return (nodos || []).slice(0, 150).map((n) => `[${n.i}] ${n.t || "(sin texto)"}${n.c ? " ·toca" : ""}${n.e ? " ·escribe" : ""}${n.s ? " ·desliza" : ""}${n.p ? " ·CONTRASEÑA" : ""}`).join("\n");
  }
  function agentePrompt(meta, app, ui, hechos) {
    return `Eres Jarvis manejando la app «${app}» del celular para cumplir esta tarea: «${meta}».\n` +
      "Ves la pantalla como una lista numerada de elementos. Responde SOLO un JSON con UNA acción:\n" +
      '{"accion":"tocar","i":N,"porque":"…"} · {"accion":"escribir","i":N,"texto":"…"} · {"accion":"bajar"} · {"accion":"subir"} · {"accion":"atras"} · {"accion":"esperar"} · ' +
      '{"accion":"listo","resumen":"lo que lograste o encontraste, en una o dos frases para decírselo a la persona"} · {"accion":"preguntar","pregunta":"…"}\n' +
      "Reglas: nunca escribas en campos de contraseña ni datos de tarjetas; no inicies sesión; si para seguir hay que PAGAR, CONFIRMAR un pedido o viaje, ENVIAR o BORRAR algo, responde «listo» explicando que dejaste todo listo para que la persona lo confirme. " +
      "Si la app pide algo que no sabes (una dirección, cuál opción), usa «preguntar». Si algo no funciona dos veces, prueba otra forma o di «listo» con lo que pasó.\n" +
      (hechos.length ? `Lo que ya hiciste:\n${hechos.map((h, k) => `${k + 1}. ${h}`).join("\n")}\n` : "") +
      `\nPantalla actual:\n${ui}`;
  }
  function accionOk(a, nodos) {
    if (!a || typeof a !== "object") return { error: "La IA no dio una acción." };
    const ac = String(a.accion || "").toLowerCase();
    if (!/^(?:tocar|escribir|bajar|subir|atras|esperar|listo|preguntar)$/.test(ac)) return { error: "Acción desconocida: " + ac };
    if (ac === "tocar" || ac === "escribir") {
      const n = (nodos || []).find((x) => x.i === +a.i);
      if (!n) return { error: "Ese elemento no está en la pantalla." };
      if (ac === "escribir" && (n.p || !n.e)) return { error: "No escribo ahí (es una contraseña o no se puede escribir)." };
      if (ac === "tocar" && riesgo(n.t)) return { alto: true, n };
      return { accion: ac, i: +a.i, texto: ac === "escribir" ? String(a.texto || "").slice(0, 300) : "", n };
    }
    return { accion: ac, resumen: String(a.resumen || ""), pregunta: String(a.pregunta || "") };
  }

  // ======================================================================== ACTUAR SOBRE LO QUE VES
  function verAccionIntent(text) {
    const t = lead(norm(text));
    if (/^(?:agendalo|agenda(?:me)? esto|ponlo en (?:el|mi) calendario|guarda (?:esto|esa cita) en (?:el|mi) calendario)$/.test(t)) return { ver: "agenda" };
    if (/^(?:recuerdamelo|recuerdame esto|ponme un recordatorio de esto)$/.test(t)) return { ver: "recordar" };
    if (/^(?:agregalo|agrega esto|pon esto|anade esto)\s+a\s+(?:la|mi)\s+lista(?:\s+del?\s+.+)?$/.test(t)) return { ver: "lista" };
    if (/^(?:llama (?:a este numero|aqui|a ese numero|al numero de la pantalla)|marca ese numero)$/.test(t)) return { ver: "llamar" };
    if (/^(?:anota (?:este|ese) gasto|registra (?:este|ese) pago)$/.test(t)) return { ver: "gasto" };
    if (/^(?:guardalo como nota|guarda esto(?: como nota)?|toma nota de esto)$/.test(t)) return { ver: "nota" };
    if (/^(?:esto es (?:una )?estafa|es (?:esto|este mensaje) (?:una )?estafa|sera estafa|esto es confiable|es confiable este mensaje)$/.test(t)) return { ver: "estafa" };
    if (/^(?:guarda (?:este|ese) contacto|guarda este numero)$/.test(t)) return { ver: "contacto" };
    return null;
  }
  const VER_PROMPT = {
    agenda: "Saca de esta pantalla la cita o evento (qué, día, hora, lugar) y escribe UNA orden de Jarvis para crearla, como «agenda reunión con Carolina el martes 5 a las 3 de la tarde en la sala 2».",
    recordar: "Saca de esta pantalla lo que la persona debe recordar y escribe UNA orden «recuérdame … el … a las …» (si no hay hora, ponla para mañana a las 9 de la mañana).",
    lista: "Saca de esta pantalla los productos o cosas por comprar y escribe UNA orden «agrega A, B y C a la lista».",
    gasto: "Saca de esta pantalla el pago o gasto (valor y en qué) y escribe UNA orden «gasté 25 mil en almuerzo».",
    nota: "Escribe UNA orden «nota de voz …» con un resumen corto de lo importante de esta pantalla.",
  };
  const verPrompt = (k, txt) => `${VER_PROMPT[k]} Responde SOLO JSON: {"ordenes":["…"],"explica":"en una frase qué entendiste"}. Si no hay nada que sirva, {"ordenes":[],"explica":"por qué"}.\n\n--- Pantalla ---\n${txt}`;
  const telefonos = (t) => [...new Set((String(t).match(/(?:\+?57\s?)?(?:3\d{2}[\s-]?\d{3}[\s-]?\d{4}|60\d[\s-]?\d{3}[\s-]?\d{4}|\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4})/g) || []).map((x) => x.replace(/[^\d+]/g, "")))].slice(0, 5);

  // ======================================================================== VISIÓN EN VIVO
  function visionIntent(text) {
    const t = lead(norm(text));
    return /^(?:mira esto|que ves|que estas viendo|abre la camara y (?:dime|mira|ayudame)|vision en vivo|camara en vivo|ayudame con lo que te muestro|te muestro algo|mira lo que te muestro|que es lo que te muestro)$/.test(t) ? { vision: true } : null;
  }

  // ======================================================================== SUGERENCIAS QUE APRENDE
  const clave = (t) => norm(t).replace(/\b\d+\b/g, "#").split(" ").slice(0, 6).join(" ");
  const mins = (ms) => { const d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); };
  /** Lo que sueles pedir a esta hora y hoy no has pedido: [{k, texto, hora, dias}] (máx. 2). */
  function patrones(log, now) {
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const reciente = (log || []).filter((x) => now - x.t < 21 * 864e5);
    const by = {};
    reciente.forEach((x) => { (by[x.k] = by[x.k] || []).push(x); });
    const out = [];
    Object.entries(by).forEach(([k, l]) => {
      const dias = new Set(l.map((x) => new Date(x.t).toDateString()));
      if (dias.size < 3) return;
      if (l.some((x) => x.t >= d0.getTime())) return;                 // ya lo pediste hoy
      const ms = l.map((x) => mins(x.t)).sort((a, b) => a - b), med = ms[Math.floor(ms.length / 2)];
      const cerca = ms.filter((m) => Math.abs(m - med) <= 45).length;
      if (cerca < 3) return;
      const ahora = mins(now);
      if (ahora < med - 30 || ahora > med + 75) return;
      const lab = l.map((x) => new Date(x.t).getDay()), fin = lab.every((x) => x === 0 || x === 6), semana = lab.every((x) => x >= 1 && x <= 5);
      const hoy = d0.getDay();
      if (semana && (hoy === 0 || hoy === 6)) return;
      if (fin && hoy >= 1 && hoy <= 5) return;
      out.push({ k, texto: l[l.length - 1].texto, hora: med, dias: dias.size, semana });
    });
    return out.sort((a, b) => b.dias - a.dias).slice(0, 2);
  }

  // ======================================================================== ESTAFAS (las mismas reglas que el celular usa al llegar el mensaje)
  function estafa(texto) {
    const t = norm(texto).replace(/\s+/g, " ");
    let s = 0; const por = [];
    const r = (re, n, por1) => { if (re.test(t)) { s += n; por.push(por1); } };
    r(/(?:cuenta|tarjeta|usuario|clave).{0,40}(?:bloquead|suspendid|inactivad|desactivad|cancelad|vencid)/, 2, "dice que tu cuenta será bloqueada");
    r(/(?:ganaste|has ganado|ha ganado|ganador|premio|sorteo|bono de|subsidio aprobado|reclama tu|reclamar su)/, 2, "promete un premio o un bono");
    r(/(?:verifi(?:ca|que)|actualiz(?:a|e)|confirm(?:a|e)|valid(?:a|e)).{0,30}(?:datos|cuenta|informacion|identidad|clave)/, 2, "pide verificar tus datos");
    r(/(?:codigo de verificacion|codigo que te llego|clave dinamica|token|pin|contrasena).{0,60}(?:envia|enviame|dime|pasame|comparte|reenvia)|(?:envia|enviame|dime|pasame|comparte|reenvia).{0,40}(?:codigo|clave dinamica|pin|contrasena)/, 3, "pide un código o una clave");
    r(/(?:premio|bono|ganaste|ganador|sorteo).{0,80}(?:https?|link|enlace|aqui|ingresa)/, 1, "y te manda a un link");
    r(/(?:urgente|inmediatamente|en las proximas 24 horas|hoy mismo|ultimo aviso|evite el bloqueo)/, 1, "mete prisa");
    r(/(?:soy tu hij[oa]|cambie de numero|nuevo numero|me robaron el celular).{0,80}(?:consign|transfier|nequi|daviplata|plata|prestame|presta)/, 4, "alguien «conocido» con número nuevo pide plata");
    r(/(?:consigna|transfiere|envia|deposita).{0,30}(?:\$|\d{2,3} \d{3}|\d{2,3}\.\d{3}|mil|nequi|daviplata)/, 1, "pide consignar");
    r(/(?:https?\/\/|https? \/\/|www |bit ly|tinyurl|cutt ly|t co\/|is gd|ow ly|rb gy)/, 1, "trae un link");
    r(/(?:bit ly|tinyurl|cutt ly|is gd|ow ly|rb gy|shorturl)/, 2, "el link está acortado (esconde a dónde va)");
    r(/(?:dian|policia|fiscalia|juzgado|embargo|comparendo|multa).{0,60}(?:pague|link|ingrese|consulte aqui)/, 2, "se hace pasar por una entidad y pide pagar o entrar a un link");
    return { puntaje: s, por, nivel: s >= 4 ? "alto" : s >= 3 ? "medio" : s >= 1 ? "bajo" : "ninguno" };
  }

  // ======================================================================== RESPUESTAS AUTOMÁTICAS Y FILTRO DE LLAMADAS
  function autoIntent(text, now) {
    const t = lead(norm(text));
    if (/^(?:quita|desactiva|apaga|para)\s+(?:las\s+)?respuestas? automaticas?$|^ya puedo contestar$/.test(t)) return { auto: "off" };
    const m = t.match(/^(?:responde|contesta)(?:les)?\s+(?:automaticamente\s+)?(?:a todos\s+)?que\s+(.+?)(?:\s+(?:por|durante)\s+(una|media|\d+)\s+(hora|horas|minutos))?(?:\s+hasta las\s+(\d{1,2})(?:[: ](\d{2}))?)?$/);
    if (!m || /^(?:si|no)\b/.test(m[1]) && m[1].split(" ").length < 3) return null;
    let hasta = 0;
    if (m[2]) { const n = m[2] === "una" ? 1 : m[2] === "media" ? 0.5 : +m[2]; hasta = now + n * (/^h/.test(m[3]) ? 3600e3 : 60e3); }
    if (m[4]) { const d = new Date(now); let h = +m[4]; if (h < 8 && d.getHours() >= 8) h += 12; d.setHours(h, m[5] ? +m[5] : 0, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1); hasta = d.getTime(); }
    const raw = String(text).replace(/^.*?\bque\s+/i, "").replace(/\s+(?:por|durante)\s+(?:una|media|\d+)\s+(?:hora|horas|minutos)\s*$/i, "").replace(/\s+hasta las\s+\d{1,2}(?:[: ]\d{2})?\s*$/i, "").trim();
    const frase = raw.charAt(0).toUpperCase() + raw.slice(1);
    return { auto: "on", texto: `${frase.replace(/[.\s]+$/, "")}. Te escribo apenas pueda. (Respuesta automática de Jarvis)`, hasta };
  }
  function llamadasIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:bloquea|bloquear)\s+(?:las\s+)?llamadas\s+(?:de\s+)?(?:numeros\s+)?desconocid[oa]s$/.test(t)) return { llamadas: "bloquear" };
    if (/^(?:silencia|silenciar)\s+(?:las\s+)?llamadas\s+(?:de\s+)?(?:numeros\s+)?desconocid[oa]s$|^(?:activa\s+)?(?:el\s+)?filtro de llamadas$/.test(t)) return { llamadas: "silenciar" };
    if (/^(?:quita|desactiva|apaga)\s+(?:el\s+)?filtro de llamadas$|^deja entrar todas las llamadas$/.test(t)) return { llamadas: "off" };
    if ((m = String(text).match(/bloquea(?:r)?\s+(?:el\s+)?(?:n[uú]mero\s+)?((?:\+?\d[\d\s-]{6,}\d))/i))) return { llamadas: "negra", numero: m[1].replace(/[^\d+]/g, "") };
    if (/^(?:que llamadas (?:silenciaste|bloqueaste|filtraste)|quien me llamo|llamadas filtradas|que llamadas me perdi)$/.test(t)) return { llamadas: "ver" };
    return null;
  }

  // ======================================================================== FOTOS
  const ES_EN = { perro: "dog", perros: "dog", gato: "cat", gatos: "cat", comida: "food", playa: "beach", mar: "sea", montana: "mountain", carro: "car", auto: "car", moto: "motorcycle", bicicleta: "bicycle", flor: "flower", flores: "flower", planta: "plant",
    arbol: "tree", cielo: "sky", atardecer: "sunset", bebe: "baby", nino: "child", ninos: "child", persona: "person", selfie: "selfie", fiesta: "party", torta: "cake", pastel: "cake", ropa: "clothing", zapatos: "shoe", libro: "book", documento: "paper",
    papel: "paper", recibo: "receipt", factura: "receipt", pantalla: "screenshot", captura: "screenshot", casa: "house", edificio: "building", ciudad: "city", iglesia: "church", piscina: "swimming pool", nieve: "snow", lluvia: "rain", mascota: "pet", caballo: "horse",
    vaca: "cattle", pajaro: "bird", pez: "fish", tablero: "whiteboard", pizarra: "whiteboard", computador: "computer", celular: "mobile phone", fruta: "fruit", bebida: "drink", cafe: "coffee", cerveza: "beer", vino: "wine", juguete: "toy", mesa: "table", silla: "chair" };
  const STOP = new Set("la el los las de del una un unos unas mi mis con que en foto fotos donde esta estan busca buscame imagen imagenes".split(" "));
  function fotosIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:activa la busqueda de fotos|lee mis fotos|busca en mis fotos|memoria fotografica|indexa mis fotos)$/.test(t)) return { fotos: "activar" };
    if ((m = t.match(/^(?:busca(?:me)?|encuentra(?:me)?|muestrame|donde esta|donde estan|tienes)\s+(?:la |las |una |unas |mis |mi )?(?:foto|fotos|imagen|imagenes|captura|capturas)\s+(?:de la |de los |de las |del |de |con |donde (?:sale|salen|aparece|esta) )?(.+)$/))) return { fotos: "buscar", q: m[1] };
    return null;
  }
  function terminos(q) {
    const ws = norm(q).split(" ").filter((w) => w.length > 2 && !STOP.has(w));
    const out = new Set(ws); ws.forEach((w) => { if (ES_EN[w]) out.add(ES_EN[w]); if (w.endsWith("s") && ES_EN[w.slice(0, -1)]) out.add(ES_EN[w.slice(0, -1)]); });
    if (/cedula|documento|pasaporte|licencia/.test(norm(q))) { out.add("republica"); out.add("identificacion"); }
    return [...out];
  }

  // ======================================================================== «¿QUÉ HICE EL …?»
  const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  const MES = { enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11 };
  function tiempoIntent(text, now) {
    const t = lead(norm(text));
    const m = t.match(/^(?:que hice|que paso|que tal fue|resumen de|como fue|que hubo)\s+(?:el\s+|la\s+|este\s+|esta\s+)?(hoy|ayer|anteayer|antier|lunes|martes|miercoles|jueves|viernes|sabado|domingo|semana pasada|semana|fin de semana|\d{1,2}\s+de\s+[a-z]+)(\s+pasad[oa])?$/);
    if (!m) return null;
    const r = rango(m[1], now, !!m[2]);
    return r ? Object.assign({ tiempo: true, etiqueta: m[1] + (m[2] || "") }, r) : null;
  }
  function rango(e, now, pasado) {
    const d = new Date(now); d.setHours(0, 0, 0, 0);
    const dia = (x) => ({ desde: x.getTime(), hasta: x.getTime() + 864e5 });
    if (e === "hoy") return dia(d);
    if (e === "ayer") { d.setDate(d.getDate() - 1); return dia(d); }
    if (e === "anteayer" || e === "antier") { d.setDate(d.getDate() - 2); return dia(d); }
    if (DIAS[e] != null) { const k = (d.getDay() - DIAS[e] + 7) % 7 || 7; d.setDate(d.getDate() - k); return dia(d); }   // «el martes» = el martes más reciente antes de hoy
    if (e === "semana pasada") { const a = new Date(d); a.setDate(a.getDate() - ((a.getDay() + 6) % 7) - 7); return { desde: a.getTime(), hasta: a.getTime() + 7 * 864e5 }; }
    if (e === "semana") { const a = new Date(d); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); return { desde: a.getTime(), hasta: now + 1 }; }
    if (e === "fin de semana") { const a = new Date(d); a.setDate(a.getDate() - ((a.getDay() + 1) % 7)); if (a.getTime() > now) a.setDate(a.getDate() - 7); return { desde: a.getTime(), hasta: a.getTime() + 2 * 864e5 }; }
    const m = e.match(/^(\d{1,2}) de ([a-z]+)$/);
    if (m && MES[m[2]] != null) { const x = new Date(d.getFullYear(), MES[m[2]], +m[1]); if (x.getTime() > now) x.setFullYear(x.getFullYear() - 1); return dia(x); }
    return null;
  }
  /** La línea de tiempo con lo que Jarvis sabe de esos días: [{t, ic, txt}] */
  function linea(D, desde, hasta) {
    const ev = [], en = (t) => t >= desde && t < hasta;
    (D.gastos || []).forEach((g) => en(g.t) && ev.push({ t: g.t, ic: g.tipo === "ingreso" ? "💰" : "💸", txt: `${g.tipo === "ingreso" ? "Ingreso" : "Gasto"}: ${g.desc} ($${Math.round(g.monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")})` }));
    (D.bitacora || []).forEach((e) => en(e.t) && ev.push({ t: e.t, ic: "📔", txt: "Diario: " + e.texto.slice(0, 120) }));
    (D.recordatorios || []).forEach((r) => en(r.cuando) && ev.push({ t: r.cuando, ic: "⏰", txt: "Recordatorio: " + r.texto }));
    (D.docs || []).forEach((d) => en(d.fecha) && ev.push({ t: d.fecha, ic: "📄", txt: d.titulo }));
    Object.entries(D.habitos || {}).forEach(([k, l]) => (l || []).forEach((t) => en(t) && ev.push({ t, ic: "✅", txt: k })));
    (D.meds || []).forEach((m) => (m.tomas || []).forEach((t) => en(t) && ev.push({ t, ic: "💊", txt: m.nombre })));
    (D.pagos || []).forEach((p) => (p.pagos || []).forEach((t) => en(t) && ev.push({ t, ic: "💳", txt: "Pagaste " + p.nombre })));
    if (D.carro && en(D.carro.t)) ev.push({ t: D.carro.t, ic: "🅿️", txt: "Parqueaste el carro" });
    const convs = [{ nombre: (D.convAct || {}).nombre || "General", chat: D.chat || [] }].concat(D.convs || []);
    convs.forEach((c) => (c.chat || []).forEach((m) => { if (m.role === "user" && en(m.t || 0) && m.content.length > 6) ev.push({ t: m.t, ic: "💬", txt: "Le dijiste a Jarvis: " + m.content.slice(0, 90) }); }));
    return ev.sort((a, b) => a.t - b.t).slice(-60);
  }

  // ======================================================================== DICTADO PULIDO
  function dictadoIntent(text) {
    const raw = String(text || "").trim().replace(/^jarvis[\s,]+/i, "");
    const t = lead(norm(text));
    let m;
    if ((m = raw.match(/^(?:pule|mejora|arregla|corrige|pasa en limpio|organiza)\s+(?:este|el|mi)\s+(?:texto|mensaje|correo)(?:\s+(?:para|a)\s+([^:]+?))?\s*[:,]\s*([\s\S]{6,})$/i))) return { pulir: "texto", texto: m[2].trim(), para: m[1] || "" };
    if ((m = t.match(/^(?:dictame|dicta(?:me)?|escribe(?:me)?|redacta(?:me)?)\s+un\s+(mensaje|correo|texto|whatsapp)(?:\s+(?:para|a)\s+(.+?))?(?:\s+pulido|\s+bien escrito|\s+en limpio)?$/))) return { pulir: "dictar", tipo: m[1], para: m[2] || "" };
    return null;
  }
  const MULETILLAS = /\b(?:eh+|em+|mm+|este|o sea|osea|pues|como que|digamos|tipo|bueno|entonces|vale|ok|ajá|aja|sabes|me entiendes|cierto)\b[,\s]*/gi;
  function sinMuletillas(t) {
    let s = String(t || "").replace(MULETILLAS, " ").replace(/\b(\w+)(\s+\1\b)+/gi, "$1").replace(/\s+([,.;:!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
    if (s) s = s[0].toUpperCase() + s.slice(1);
    if (s && !/[.!?]$/.test(s)) s += ".";
    return s;
  }
  const pulirPrompt = (t, para, tipo) => `Convierte esto que dije en voz alta en un ${tipo || "mensaje"} bien escrito${para ? " para " + para : ""}: quita muletillas y repeticiones, ordena las ideas, ` +
    "corrige ortografía y puntuación, conserva mi tono y lo que quiero decir, en español de Colombia (si mezclé idiomas, deja cada parte como la dije). Devuelve SOLO el texto final, sin comillas ni explicaciones.\n\n" + t;

  // ======================================================================== WIDGETS Y PRESENTACIONES
  const FUENTES = { pagos: /pagos?|suscripciones?|cuentas por pagar/, lista: /lista|mercado|compras/, gastos: /gastos?|presupuesto|plata/, recordatorios: /recordatorios?|pendientes?/, habitos: /habitos?|rachas?/, temporizadores: /temporizador(?:es)?/, cumple: /cumpleanos/, meds: /medicamentos?|pastillas?/ };
  function widgetIntent(text) {
    const t = lead(norm(text));
    let m;
    if (/^(?:quita|borra|elimina)\s+el\s+widget/.test(t)) return { widget: "off" };
    if ((m = t.match(/^(?:crea(?:me)?|haz(?:me)?|pon(?:me)?|arma(?:me)?)\s+un\s+widget\s+(?:con|de|para|que muestre)\s+(?:mis |mi |los |las |el |la )?(.+)$/))) {
      const f = Object.entries(FUENTES).find(([, re]) => re.test(m[1]));
      return { widget: f ? f[0] : "desconocido", que: m[1] };
    }
    return null;
  }
  function presentacionIntent(text) {
    const t = lead(norm(text));
    const m = t.match(/^(?:hazme|haz|crea(?:me)?|arma(?:me)?|preparame|genera(?:me)?)\s+(?:una\s+)?(?:presentacion|diapositivas|un powerpoint|unas diapositivas|un ppt)\s+(?:de|sobre|del|de la|acerca de)\s+(.+?)(?:\s+(?:de|con)\s+(\d{1,2})\s+diapositivas)?(?:\s+para\s+(.+))?$/);
    if (!m) return null;
    return { ppt: true, tema: m[1], n: m[2] ? Math.min(20, Math.max(3, +m[2])) : 8, para: m[3] || "" };
  }
  const pptPrompt = (tema, n, para) => `Haz el contenido de una presentación de ${n} diapositivas sobre «${tema}»${para ? " para " + para : ""}, en español de Colombia. ` +
    'Devuelve JSON: {"titulo":"","subtitulo":"","diapositivas":[{"titulo":"","puntos":["frases cortas, máximo 5 por diapositiva"],"notas":"lo que digo al presentarla, 2 o 3 frases"}]}. ' +
    "La primera diapositiva de contenido presenta el tema y la última cierra con una conclusión o pregunta. Fórmulas en texto plano (sin LaTeX).";
  function cleanPpt(j, n) {
    if (!j || !Array.isArray(j.diapositivas) || !j.diapositivas.length) return { error: "No pude armar la presentación." };
    const ds = j.diapositivas.slice(0, Math.max(n || 8, 3) + 2).map((d) => ({ titulo: String(d.titulo || "").slice(0, 90), puntos: (Array.isArray(d.puntos) ? d.puntos : []).map((p) => String(p).slice(0, 160)).filter(Boolean).slice(0, 6), notas: String(d.notas || "").slice(0, 600) })).filter((d) => d.titulo || d.puntos.length);
    return { titulo: String(j.titulo || "Presentación").slice(0, 90), subtitulo: String(j.subtitulo || "").slice(0, 120), diapositivas: ds };
  }

  const API = { norm, APPS, agenteIntent, riesgo, uiTexto, agentePrompt, accionOk, verAccionIntent, verPrompt, telefonos, visionIntent, clave, patrones, estafa, autoIntent, llamadasIntent,
    fotosIntent, terminos, tiempoIntent, rango, linea, dictadoIntent, sinMuletillas, pulirPrompt, widgetIntent, presentacionIntent, pptPrompt, cleanPpt };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL10 = API;
})(typeof window !== "undefined" ? window : globalThis);
