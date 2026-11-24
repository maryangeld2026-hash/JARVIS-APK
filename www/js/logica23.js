/* Jarvis para Android 3.35 · lógica pura (se prueba con node). Diez habilidades más:
   dividir la cuenta · tiempo de pantalla · resumir grupos · traducir mensajes · compartir el wifi · informe del mes ·
   mantenimiento del vehículo · «¿dónde dejé…?» · tarjetas de repaso (repetición espaciada) · modos expertos. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/(?<!\d)[.:]|[.:](?!\d)/g, " ").replace(/[¿?¡!;«»"“”]/g, " ").replace(/\s+/g, " ").trim();
  const lead = (t) => t.replace(/^(?:jarvis|oye jarvis|hola jarvis|por favor)[\s,]+/, "").replace(/\s+por favor$/, "").replace(/^,\s*/, "");
  const NUMS = { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, media: 0.5 };
  const num = (s) => { const x = String(s || "").trim().replace(",", "."); return /^\d+(?:\.\d+)?$/.test(x) ? +x : NUMS[x] != null ? NUMS[x] : null; };
  function pesos(s) {
    const t = norm(s).replace(/\$/g, " ");
    let m = t.match(/(\d+(?:[.,]\d+)?)\s*(millones|millon|mil|k)\b/);
    if (m) return Math.round(parseFloat(m[1].replace(",", ".")) * (/mill/.test(m[2]) ? 1e6 : 1e3));
    m = String(s).match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/);
    return m ? +m[1].replace(/[.,]/g, "") : null;
  }
  const cop = (n) => "$" + Math.round(n || 0).toLocaleString("es-CO");
  /** Redondea hacia arriba a los 100 pesos (nadie paga $37.433). */
  const redondo = (n) => Math.ceil(Math.round(n) / 100) * 100;

  // ======================================================================== 1. DIVIDIR LA CUENTA
  function cuentaIntent(text) {
    const t = lead(norm(text)); let m;
    if (/^(?:divide|dividir|reparte|repartir)\s+(?:esta|la)\s+cuenta(?:\s+(?:de la foto|con foto))?$|^(?:cuanto paga cada uno|cuanto le toca a cada uno)\s+de\s+(?:esta|la)\s+cuenta$/.test(t)) return { cu: "foto" };
    if ((m = t.match(/^(?:divide|dividir|reparte|repartir|parte)\s+(.+?)\s+entre\s+(\d+|\w+)(?:\s+personas?)?(?:\s+(?:con|y)\s+(?:el\s+|un\s+)?(\d+)\s*(?:%|por ciento)\s*(?:de\s+)?(?:propina|servicio)?)?(?:\s+(?:sin|y sin)\s+propina)?$/))) {
      const total = pesos(m[1]), n = num(m[2]); if (!total || !n || n < 1) return null;
      return { cu: "dividir", total, n, propina: m[3] ? +m[3] : /sin propina/.test(t) ? 0 : null };
    }
    if ((m = t.match(/^(?:cuanto es|calcula)\s+(?:la\s+|el\s+)?(?:propina|servicio)\s+(?:del?\s+)?(\d+)?\s*(?:%|por ciento)?\s*(?:de|sobre)\s+(.+)$/))) { const total = pesos(m[2]); if (total) return { cu: "propina", total, propina: m[1] ? +m[1] : 10 }; }
    return null;
  }
  /** → {base, propina, total, cada} */
  function dividir(total, n, propinaPct) {
    const p = propinaPct == null ? 10 : propinaPct, prop = Math.round(total * p / 100), tot = total + prop;
    return { base: total, propinaPct: p, propina: prop, total: tot, cada: redondo(tot / n), n };
  }
  const divisionTexto = (d) => `🧾 Cuenta: ${cop(d.base)}${d.propinaPct ? ` + propina del ${d.propinaPct} % (${cop(d.propina)})` : " (sin propina)"} = **${cop(d.total)}**.\n\nEntre ${d.n}: **${cop(d.cada)} cada uno**${d.cada * d.n !== d.total ? ` (redondeado; sobran ${cop(d.cada * d.n - d.total)})` : ""}.`;
  const PROMPT_CUENTA = 'Es la foto de una cuenta de restaurante o tienda en Colombia. Devuelve SOLO JSON {"items":[{"nombre":"…","precio":número en pesos (total de ese renglón)}],"subtotal":número,"total":número,"propina_incluida":true/false}. Si no es una cuenta, {"error":"por qué"}.';
  /** Lo que cada uno pidió: {persona: [índices de items]} → {persona: valor con su parte de la propina} */
  function porPersona(items, asignacion, propinaPct) {
    const p = propinaPct == null ? 10 : propinaPct, out = {};
    Object.entries(asignacion || {}).forEach(([quien, idx]) => { const s = (idx || []).reduce((a, i) => a + ((items[i] || {}).precio || 0), 0); out[quien] = redondo(s * (1 + p / 100)); });
    return out;
  }
  const PROMPT_ASIGNAR = (items, dicho) => `Estos son los renglones de una cuenta (índice: nombre):\n${items.map((x, i) => `${i}: ${x.nombre}`).join("\n")}\nLa persona dijo quién pidió qué: «${dicho}». Responde SOLO JSON {"asignacion":{"Nombre":[índices]}}. Si algo lo compartieron, repártelo poniéndolo en ambos.`;
  /** Si un renglón está en dos personas, se divide entre ellas. */
  function porPersonaCompartido(items, asignacion, propinaPct) {
    const p = propinaPct == null ? 10 : propinaPct, cuenta = {}, out = {};
    Object.values(asignacion || {}).forEach((l) => (l || []).forEach((i) => (cuenta[i] = (cuenta[i] || 0) + 1)));
    Object.entries(asignacion || {}).forEach(([q, l]) => { out[q] = redondo((l || []).reduce((a, i) => a + ((items[i] || {}).precio || 0) / (cuenta[i] || 1), 0) * (1 + p / 100)); });
    return out;
  }

  // ======================================================================== 2. TIEMPO DE PANTALLA
  function pantallaIntent(text) {
    const t = lead(norm(text)); let m;
    if (/^(?:cuanto (?:use|he usado|uso|llevo usando) el (?:celular|telefono)|tiempo de pantalla|mi tiempo de pantalla|cuanto tiempo (?:llevo|pase|he pasado) en el (?:celular|telefono))(?:\s+(?:hoy|esta semana))?$/.test(t)) return { pa: "ver", semana: /semana/.test(t) };
    if (/^(?:que|cual) app (?:me quita|me roba|uso) mas (?:tiempo)?(?:\s+(?:hoy|esta semana))?$/.test(t)) return { pa: "ver", semana: /semana/.test(t) };
    if ((m = t.match(/^(?:avisame|alertame)\s+si\s+(?:paso|estoy|llevo)\s+mas de\s+(\d+(?:[.,]\d+)?|una|media|dos|tres)\s*(horas?|minutos?|min|h)\s+en\s+(.+?)(?:\s+al dia)?$/))) {
      const n = num(m[1]) || 1; return { pa: "limite", app: m[3].trim(), min: Math.round(n * (/^h/.test(m[2]) ? 60 : 1)) };
    }
    if ((m = t.match(/^(?:quita|borra)\s+el limite\s+de\s+(.+)$/))) return { pa: "quitar", app: m[1] };
    return null;
  }
  const hm = (min) => { min = Math.round(min); const h = Math.floor(min / 60), m = min % 60; return h ? `${h} h${m ? " " + m + " min" : ""}` : `${m} min`; };
  function pantallaTexto(lista, semana) {
    const l = (lista || []).filter((x) => x.min >= 1).sort((a, b) => b.min - a.min);
    if (!l.length) return "📱 Todavía no hay uso registrado.";
    const tot = l.reduce((s, x) => s + x.min, 0);
    return `📱 **${semana ? "Esta semana" : "Hoy"} llevas ${hm(tot)} en el celular.**\n` + l.slice(0, 6).map((x, i) => `${i + 1}. ${x.nombre}: ${hm(x.min)}`).join("\n") + (tot > (semana ? 7 * 300 : 300) ? "\n\nEs bastante: si quieres, ponle un límite a la que más usas («avísame si paso más de una hora en TikTok»)." : "");
  }
  /** «tiktok» → el paquete de la lista de apps (por nombre). */
  function appDe(q, apps) { const n = norm(q); return (apps || []).find((a) => norm(a.nombre) === n) || (apps || []).find((a) => norm(a.nombre).includes(n) || n.includes(norm(a.nombre))) || null; }

  // ======================================================================== 3. RESUMIR GRUPOS
  function grupoIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:que (?:dijeron|han dicho|hablaron|paso) en el grupo|resume(?:me)? el grupo|resumen del grupo|que hay en el grupo)\s+(?:de los |de las |de la |del |de )?(.+?)(?:\s+(?:hoy|de whatsapp|en whatsapp))?$/))) return { gr: m[1].replace(/\s+(?:hoy|de whatsapp)$/, ""), raw };
    return null;
  }
  /** Los mensajes de ese grupo (por el título de la notificación: «Grupo: Persona» o «Grupo»). */
  function delGrupo(msgs, q) {
    const n = norm(q);
    return (msgs || []).filter((m) => { const de = norm(m.de || m.d || ""), grupo = de.split(":")[0].replace(/\s*\(\d+ mensajes?\)\s*/, "").trim(); return grupo && (grupo.includes(n) || n.includes(grupo)); })
      .map((m) => ({ de: String(m.de || m.d || "").split(":").slice(1).join(":").trim() || String(m.de || m.d || ""), texto: m.texto || m.x || "", t: m.t || 0 }));
  }
  const PROMPT_GRUPO = (grupo, l) => `Resume en español lo que se habló en el grupo «${grupo}» (de lo más importante a lo menos): decisiones, fechas, tareas y lo que me piden a mí. Máximo 6 puntos cortos. Mensajes:\n${l.map((m) => `- ${m.de}: ${m.texto}`).join("\n")}`;

  // ======================================================================== 4. TRADUCIR MENSAJES
  function traducirIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:traduce(?:me)?|que dice)\s+(?:el (?:ultimo )?mensaje|lo que me escribio|los mensajes)\s+(?:de\s+)?(.+?)$/)) && !/pantalla|foto/.test(t)) return { tr: "leer", de: m[1] };
    if (/^(?:traduce(?:me)?)\s+(?:mis mensajes|el ultimo mensaje)$/.test(t)) return { tr: "leer", de: "" };
    if ((m = raw.match(/^\s*(?:jarvis[,\s]+)?resp[oó]nde(?:le)?\s+(?:a\s+(.+?)\s+)?en\s+(ingl[eé]s|franc[eé]s|portugu[eé]s|alem[aá]n|italiano|su idioma)\s+(?:que\s+)?(.+)$/i))) return { tr: "responder", de: m[1] || "", idioma: m[2], texto: m[3].trim() };
    return null;
  }
  const PROMPT_DETECTAR = (txt) => `¿En qué idioma está este mensaje? Si no está en español, tradúcelo al español. Responde SOLO JSON {"idioma":"inglés|francés|…|español","traduccion":"…"}.\n\nMensaje: ${txt}`;

  // ======================================================================== 5. COMPARTIR EL WIFI
  function wifiIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    if ((m = raw.match(/^\s*(?:jarvis[,\s]+)?(?:mi wi-?fi|la red(?: de la casa)?|el wi-?fi)\s+(?:se llama|es)\s+[«"]?(.+?)[»"]?\s+y\s+(?:la\s+)?(?:clave|contraseña|password)\s+(?:es\s+)?[«"]?(\S.*?)[»"]?\s*$/i))) return { wf: "guardar", red: m[1].trim(), clave: m[2].trim() };
    if (/^(?:comparte|compartir|muestra|pasame|dame)\s+(?:el|mi|la clave del)\s+wi ?-?fi(?:\s+(?:de la casa|con un qr|en qr))?$|^qr del wi ?-?fi$/.test(t)) return { wf: "qr" };
    if (/^(?:borra|olvida)\s+(?:la clave del|el)\s+wi ?-?fi$/.test(t)) return { wf: "borrar" };
    return null;
  }
  /** El texto del QR estándar de wifi (lo leen las cámaras de Android y iPhone). */
  function wifiQR(red, clave, tipo) {
    const e = (s) => String(s).replace(/([\\;,:"])/g, "\\$1");
    return clave ? `WIFI:T:${tipo || "WPA"};S:${e(red)};P:${e(clave)};;` : `WIFI:T:nopass;S:${e(red)};;`;
  }

  // ======================================================================== 6. INFORME DEL MES
  function informeIntent(text) { const t = lead(norm(text)); return /^(?:informe|resumen|balance|reporte)\s+(?:del|de mi|de este)\s+mes(?:\s+pasado)?$|^como me fue (?:con la plata|con los gastos) (?:este|el) mes(?: pasado)?$/.test(t) ? { inf: /pasado/.test(t) ? "pasado" : "actual" } : null; }
  /** a y b: {total, cats:[[cat, v]]} de este mes y el anterior → líneas con la comparación por categoría. */
  function comparar(a, b) {
    const pb = {}; (b.cats || []).forEach(([c, v]) => (pb[c] = v));
    const lineas = (a.cats || []).slice(0, 7).map(([c, v]) => { const ant = pb[c] || 0; const d = ant ? Math.round((v - ant) / ant * 100) : null; return { cat: c, v, ant, d }; });
    const dt = b.total ? Math.round((a.total - b.total) / b.total * 100) : null;
    return { lineas, dt };
  }
  function informeTexto(nombreMes, a, b, pagos) {
    const c = comparar(a, b);
    let t = `📊 **Informe de ${nombreMes}:** gastaste **${cop(a.total)}**${c.dt != null ? ` (${c.dt > 0 ? "▲ " + c.dt + " % más" : c.dt < 0 ? "▼ " + -c.dt + " % menos" : "igual"} que el mes anterior)` : ""}${a.ingresos ? ` y entraron ${cop(a.ingresos)}` : ""}.`;
    if (c.lineas.length) t += "\n\n" + c.lineas.map((x) => `- ${x.cat}: ${cop(x.v)}${x.d != null ? ` (${x.d > 0 ? "▲" : x.d < 0 ? "▼" : "="} ${Math.abs(x.d)} %)` : " (nuevo)"}`).join("\n");
    const sube = c.lineas.filter((x) => x.d != null && x.d >= 25 && x.v >= 50000).sort((x, y) => y.v - x.v)[0];
    if (sube) t += `\n\n💡 Donde más subió: **${sube.cat}** (+${sube.d} %). Ahí está la primera oportunidad de ahorrar.`;
    if ((pagos || []).length) t += `\n\n📅 Pagos que vienen: ${pagos.slice(0, 5).map((p) => `${p.nombre} el ${p.dia}`).join(", ")}.`;
    return t;
  }

  // ======================================================================== 7. MANTENIMIENTO DEL VEHÍCULO
  const SERVICIOS = {
    aceite: { nombre: "Cambio de aceite", carro: [5000, 6], moto: [3000, 3], re: /aceite/ },
    llantas: { nombre: "Rotación de llantas", carro: [10000, 6], moto: [6000, 6], re: /rotacion|rote|llantas/ },
    frenos: { nombre: "Revisión de frenos", carro: [20000, 12], moto: [8000, 6], re: /frenos|pastillas/ },
    filtro: { nombre: "Filtro de aire", carro: [15000, 12], moto: [6000, 6], re: /filtro/ },
    alineacion: { nombre: "Alineación y balanceo", carro: [10000, 6], moto: [10000, 12], re: /alineacion|balanceo/ },
    cadena: { nombre: "Ajuste y lubricación de la cadena", carro: null, moto: [1000, 1], re: /cadena|kit de arrastre/ },
  };
  const kmDe = (s) => { const m = norm(s).match(/(\d{1,3}(?:[.,]\d{3})+|\d+)\s*(?:mil\s*)?(?:km|kilometros)?/); if (!m) return null; let n = +m[1].replace(/[.,]/g, ""); if (/\d\s*mil\b/.test(norm(s))) n *= 1000; return n; };
  function vehiculoIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    const tipo = /\bmoto\b/.test(t) ? "moto" : /\bcarro|auto|camioneta|vehiculo\b/.test(t) ? "carro" : null;
    if ((m = t.match(/^(?:le\s+)?(?:cambie|hice|le hice|rote|revise|cambiaron|hicieron|le cambiaron|le hicieron)\s+(?:el |la |las |los )?(.+?)(?:\s+(?:al|a la|del|de la)\s+(?:carro|moto|auto|camioneta))?(?:\s+(?:hoy|ayer))?(?:\s+(?:a los|en los|con)\s+(.+?)\s*(?:km|kilometros)?)?$/))) {
      const s = Object.keys(SERVICIOS).find((k) => SERVICIOS[k].re.test(m[1]));
      if (s) return { ve: "servicio", servicio: s, km: m[2] ? kmDe(m[2] + (/mil/.test(m[2]) ? "" : "")) : null, tipo };
    }
    if ((m = t.match(/^(?:el carro|la moto|mi carro|mi moto|el vehiculo)\s+(?:va en|tiene|marca|lleva)\s+(.+?)\s*(?:km|kilometros)?$/))) { const km = kmDe(m[1]); if (km) return { ve: "km", km, tipo }; }
    if (/^(?:que le toca|que mantenimiento le toca|cuando le toca(?: el)? (?:aceite|mantenimiento|cambio de aceite))(?:\s+(?:al|a la)\s+(?:carro|moto))?$|^mantenimiento del (?:carro|moto|vehiculo)$/.test(t)) return { ve: "ver", tipo };
    if ((m = t.match(/^mi\s+(carro|moto)\s+es\s+(?:un|una)\s+(.+)$/))) return { ve: "modelo", tipo: m[1], modelo: raw.replace(/^[\s\S]*?\bes\s+(?:un|una)\s+/i, "").trim() };
    return null;
  }
  /** Lo que toca: por kilómetros (si se saben) o por tiempo. v: {tipo, km, kmT, servicios:{k:{km, t}}} */
  function proximos(v, now) {
    const tipo = v.tipo || "carro", out = [];
    Object.entries(SERVICIOS).forEach(([k, s]) => {
      const r = s[tipo]; if (!r) return; const hecho = (v.servicios || {})[k]; if (!hecho) return;
      const kmTope = hecho.km != null ? hecho.km + r[0] : null, fecha = new Date(hecho.t); fecha.setMonth(fecha.getMonth() + r[1]);
      const faltaKm = kmTope != null && v.km != null ? kmTope - v.km : null, faltaDias = Math.round((fecha - (now || Date.now())) / 864e5);
      out.push({ k, nombre: s.nombre, kmTope, faltaKm, fecha: fecha.getTime(), faltaDias, ya: (faltaKm != null && faltaKm <= 0) || faltaDias <= 0, pronto: (faltaKm != null && faltaKm <= 500) || faltaDias <= 15 });
    });
    return out.sort((a, b) => (b.ya - a.ya) || (b.pronto - a.pronto) || a.faltaDias - b.faltaDias);
  }
  const fmtKm = (n) => Math.round(n).toLocaleString("es-CO") + " km";
  function vehiculoTexto(v, now) {
    const l = proximos(v, now);
    if (!l.length) return `🔧 No tengo mantenimientos anotados de tu ${v.tipo || "carro"}. Dime, por ejemplo, «le cambié el aceite al carro hoy a los 45.000 km».`;
    return `🔧 **Tu ${v.tipo || "carro"}${v.modelo ? " (" + v.modelo + ")" : ""}${v.km ? ` · ${fmtKm(v.km)}` : ""}:**\n` + l.map((x) => `- ${x.ya ? "❌ Ya toca" : x.pronto ? "⚠️ Pronto" : "✅"} **${x.nombre}**: ${x.kmTope != null ? `a los ${fmtKm(x.kmTope)}${x.faltaKm != null ? ` (faltan ${fmtKm(Math.max(0, x.faltaKm))})` : ""} o ` : ""}${x.faltaDias > 0 ? `en ${x.faltaDias} días` : "ya se cumplió el tiempo"}`).join("\n") + "\n\n_Son intervalos de referencia: revisa el manual de tu vehículo._";
  }

  // ======================================================================== 8. ¿DÓNDE DEJÉ…?
  const NO_COSAS = /^(?:carro|moto|vehiculo|alarma|temporizador|recordatorio|cita|clase|musica|cancion)\b/;
  function cosasIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    if ((m = raw.match(/^\s*(?:jarvis[,\s]+)?(?:dej[eé]|puse|guard[eé]|met[ií]|escond[ií])\s+(?:el |la |los |las |mi |mis |un |una )?(.+?)\s+(en|dentro del?|debajo del?|encima del?|detr[aá]s del?|al lado del?|junto a|sobre)\s+(.+?)\s*\.?$/i)) && !NO_COSAS.test(norm(m[1]))) return { cs: "guardar", cosa: m[1].trim(), lugar: (m[2] + " " + m[3]).trim() };
    if ((m = t.match(/^(?:donde|en donde|en que parte)\s+(?:deje|puse|guarde|meti|escondi|estan?|quedaron?|quedo)\s+(?:el |la |los |las |mi |mis )?(.+)$/)) && !NO_COSAS.test(m[1])) return { cs: "buscar", cosa: m[1] };
    if (/^(?:que cosas tengo guardadas|donde estan mis cosas|lista de mis cosas)$/.test(t)) return { cs: "ver" };
    return null;
  }
  /** La cosa que más se parece (por palabras, sin tildes, singular/plural). */
  function buscarCosa(lista, q) {
    const raiz = (w) => w.replace(/(?:es|s)$/, "");
    const ws = norm(q).split(" ").filter((w) => w.length > 2 && !/^(?:del|las|los|mis|una)$/.test(w)).map(raiz);
    let mejor = null, pm = 0;
    (lista || []).forEach((c) => { const cw = norm(c.cosa).split(" ").map(raiz); const p = ws.filter((w) => cw.some((x) => x === w || x.startsWith(w) || w.startsWith(x))).length / Math.max(1, ws.length); if (p > pm || (p === pm && p > 0 && c.t > (mejor || {}).t)) { pm = p; mejor = c; } });
    return pm >= 0.5 ? mejor : null;
  }

  // ======================================================================== 9. TARJETAS DE REPASO
  function tarjetasIntent(text) {
    const t = lead(norm(text)); const raw = String(text || ""); let m;
    if ((m = t.match(/^(?:hazme|crea(?:me)?|arma(?:me)?|genera(?:me)?)\s+(?:unas\s+|\d+\s+)?(?:tarjetas|flashcards|fichas)(?:\s+de repaso)?\s+(?:de|sobre|del|con)\s+(.{2,})$/))) {
      const n = (t.match(/\b(\d{1,2})\s+(?:tarjetas|flashcards|fichas)/) || [])[1];
      return { ta: "crear", tema: raw.replace(/^[\s\S]*?\b(?:tarjetas|flashcards|fichas)(?:\s+de repaso)?\s+(?:de|sobre|del|con)\s+/i, "").trim(), n: n ? Math.min(30, +n) : 10 };
    }
    if (/^(?:repasemos|vamos a repasar|repaso|mis tarjetas(?: de hoy)?|que me toca repasar(?: hoy)?)$/.test(t)) return { ta: "repasar" };
    if (/^(?:mis mazos|que tarjetas tengo)$/.test(t)) return { ta: "ver" };
    return null;
  }
  const PROMPT_TARJETAS = (tema, n) => `Haz ${n} tarjetas de repaso en español sobre: ${tema}. Pregunta corta por delante y respuesta corta y exacta por detrás (máximo 25 palabras). Responde SOLO JSON {"tarjetas":[{"p":"…","r":"…"}]}`;
  /**
   * Repetición espaciada (estilo Leitner/SM-2 sencillo): calificación 0 = otra vez (mañana), 1 = bien, 2 = fácil.
   * c: {caja, prox} → nueva tarjeta con su próxima fecha. Intervalos: 1, 3, 7, 16, 35, 75 días.
   */
  const INTERVALOS = [1, 3, 7, 16, 35, 75];
  function calificar(c, nota, now) {
    const caja = nota === 0 ? 0 : Math.min(INTERVALOS.length - 1, (c.caja || 0) + (nota === 2 ? 2 : 1));
    const d = new Date(now || Date.now()); d.setHours(4, 0, 0, 0); d.setDate(d.getDate() + INTERVALOS[caja]);
    return Object.assign({}, c, { caja, prox: d.getTime(), vistas: (c.vistas || 0) + 1 });
  }
  const pendientes = (mazos, now) => [].concat(...(mazos || []).map((m) => (m.tarjetas || []).map((c, i) => ({ mazo: m.id, i, c })))).filter((x) => !x.c.prox || x.c.prox <= (now || Date.now()));

  // ======================================================================== 10. MODOS EXPERTOS
  const MODOS = {
    abogado: ["⚖️ Abogado", "Responde como un abogado colombiano: explica la norma aplicable en Colombia (leyes, códigos, sentencias) con palabras sencillas, los pasos a seguir y los plazos. Termina siempre recordando que es orientación general y que para un caso concreto consulte un abogado o un consultorio jurídico gratuito."],
    nutricionista: ["🥗 Nutricionista", "Responde como un nutricionista: orientación de alimentación balanceada con comida colombiana y porciones prácticas. No des dietas extremas ni cifras para bajar de peso rápido. Recuerda que no reemplaza la consulta con un profesional de la salud, sobre todo si hay enfermedades."],
    ingles: ["🇬🇧 Profe de inglés", "Eres un profe de inglés paciente: responde en inglés sencillo y luego la traducción al español; corrige con cariño los errores de la persona y explica la regla en una frase; propone una pregunta para seguir practicando."],
    contador: ["🧮 Contador", "Responde como un contador colombiano: impuestos (DIAN, renta, IVA), facturación electrónica y finanzas personales, con ejemplos en pesos. Recuerda que las normas cambian y que confirme con la DIAN o un contador para su caso."],
    chef: ["👨‍🍳 Chef", "Responde como un chef casero colombiano: recetas con ingredientes fáciles de conseguir en Colombia, pasos claros, tiempos y trucos."],
    entrenador: ["🏋️ Entrenador", "Responde como un entrenador físico: rutinas seguras con calentamiento y progresión, adaptadas al nivel de la persona. Si menciona dolor, lesión o enfermedad, recomienda consultar a un médico antes de entrenar."],
    programador: ["💻 Programador", "Responde como un programador experto: código claro y comentado, explica el porqué, y señala riesgos de seguridad."],
    profe: ["👩‍🏫 Profe paciente", "Explica como un profe paciente: paso a paso, con ejemplos de la vida diaria y una pregunta al final para comprobar que se entendió. Nunca des solo la respuesta de una tarea: guía."],
    psicologo: ["🫶 Escucha empática", "Responde con empatía y calma, como alguien que escucha sin juzgar; valida lo que siente la persona y sugiere estrategias sencillas de bienestar. No diagnostiques. Si hay señales de crisis o de querer hacerse daño, recomienda con claridad buscar ayuda profesional o una línea de atención (en Colombia, la Línea 106 o la 192 opción 4)."],
  };
  const ALIAS_MODO = { abogada: "abogado", legal: "abogado", nutricionista: "nutricionista", nutricion: "nutricionista", "profe de ingles": "ingles", "profesor de ingles": "ingles", ingles: "ingles", contadora: "contador", contador: "contador", cocinero: "chef", chef: "chef", entrenadora: "entrenador", entrenador: "entrenador", "entrenador personal": "entrenador", programador: "programador", programadora: "programador", profe: "profe", profesor: "profe", maestra: "profe", psicologo: "psicologo", psicologa: "psicologo", "escucha": "psicologo" };
  function modoIntent(text) {
    const raw = String(text || ""); const t = lead(norm(raw)); let m;
    if (/^(?:modo normal|sal del modo(?: \w+)*|vuelve a ser (?:normal|jarvis)|quita el modo(?: \w+)*)$/.test(t)) return { mo: "salir" };
    if ((m = raw.match(/^\s*(?:jarvis[,\s]+)?crea\s+(?:un\s+)?modo\s+(?:llamado\s+)?[«"]?([\wáéíóúñ ]{2,30}?)[»"]?\s+(?:que|para que|donde)\s+(.{10,})$/i))) return { mo: "crear", nombre: m[1].trim(), instr: m[2].trim() };
    if ((m = t.match(/^(?:modo|activa el modo|pon el modo|habla como (?:un |una )?|se mi |actua como (?:un |una )?)\s*([a-z ]{3,30})$/))) {
      const k = ALIAS_MODO[m[1].trim()] || (MODOS[m[1].trim()] ? m[1].trim() : null);
      if (k) return { mo: "activar", k };
      return { mo: "propio", nombre: m[1].trim() };
    }
    if (/^(?:mis modos|que modos (?:hay|tienes))$/.test(t)) return { mo: "ver" };
    return null;
  }

  const API = { norm, pesos, cop, redondo, cuentaIntent, dividir, divisionTexto, PROMPT_CUENTA, porPersona, porPersonaCompartido, PROMPT_ASIGNAR,
    pantallaIntent, pantallaTexto, appDe, hm, grupoIntent, delGrupo, PROMPT_GRUPO, traducirIntent, PROMPT_DETECTAR, wifiIntent, wifiQR,
    informeIntent, comparar, informeTexto, SERVICIOS, kmDe, vehiculoIntent, proximos, vehiculoTexto, cosasIntent, buscarCosa,
    tarjetasIntent, PROMPT_TARJETAS, INTERVALOS, calificar, pendientes, MODOS, modoIntent };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.JL23 = API;
})(typeof window !== "undefined" ? window : globalThis);
