/* Jarvis para Android 3.6 · lógica pura (se prueba con node): órdenes para controlar el celular, dictado,
   notas de voz, banco de preguntas, versiones A–D, la página de la práctica con QR y los recordatorios por lugar. */
(function (root) {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:]+/g, " ").replace(/\s+/g, " ").trim();
  const lead = /^(?:jarvis|oye jarvis|hola jarvis)[,\s]+/i;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ======================================================================== CONTROLAR EL CELULAR
  /** Apps conocidas por su nombre hablado (si la búsqueda por el nombre de la app no basta). */
  const ALIAS = { whatsapp: ["whatsapp", "wasap", "guasap", "whats"], youtube: ["youtube", "yutub"], camara: ["camara", "camera"], calculadora: ["calculadora", "calculator"],
    galeria: ["galeria", "fotos", "gallery", "photos"], chrome: ["chrome", "navegador", "internet"], gmail: ["gmail", "correo"], mapas: ["maps", "mapas"], reloj: ["reloj", "clock", "alarma"],
    calendario: ["calendario", "calendar"], ajustes: ["configuracion", "ajustes del celular", "settings"], teams: ["teams"], classroom: ["classroom"], drive: ["drive"], spotify: ["spotify"], telefono: ["telefono", "phone", "marcador"] };
  function phoneIntent(text) {
    const raw = String(text || "").trim().replace(lead, "").replace(/^[¿¡]+/, ""), t = norm(raw);
    let m;
    if (/^en el (?:computador|pc|portatil)\b/.test(t)) return null;                  // eso va al Jarvis del computador
    if ((m = raw.match(/^(?:ll[aá]ma(?:le|me)?|marca(?:le)?|haz una llamada)\s+(?:a\s+|al\s+)?(.+?)\s*\.?$/i)) && !/^(?:la\s+)?(?:lista|asistencia)$/i.test(m[1])) return { kind: "llamar", quien: m[1].replace(/^(?:mi|la|el)\s+/i, "").trim() };
    if ((m = raw.match(/^(?:m[aá]nda(?:le)?|env[ií]a(?:le)?|escr[ií]be(?:le)?)\s+(?:un\s+)?(?:whats?app|wasap|guasap|wpp)\s+(?:a|al|para)\s+(.+?)(?:\s*[,:]\s*|\s+(?:diciendo(?:le)?|que dice|que diga|con el mensaje|dici[eé]ndole)\s+|\s+que\s+)(.+)$/i))) return { kind: "wa", quien: m[1].trim(), texto: m[2].trim().replace(/^que\s+/i, "") };
    if ((m = raw.match(/^(?:m[aá]nda(?:le)?|env[ií]a(?:le)?)\s+(?:un\s+)?(?:mensaje(?:\s+de\s+texto)?|sms)\s+(?:a|al|para)\s+(.+?)(?:\s*[,:]\s*|\s+(?:diciendo(?:le)?|que dice|que diga|con el mensaje)\s+|\s+que\s+)(.+)$/i))) return { kind: "sms", quien: m[1].trim(), texto: m[2].trim().replace(/^que\s+/i, "") };
    if ((m = t.match(/^(?:abre|abrir|abreme|inicia|lanza|entra a|ve a)\s+(?:la\s+app\s+(?:de\s+)?|la\s+aplicacion\s+(?:de\s+)?|el\s+|la\s+)?(.+)$/))) {
      if (/^(?:los\s+)?(?:ajustes|configuracion|opciones)$|^(?:el\s+)?(?:proyector|material|chat|modo|tutor)\b|^(?:las\s+)?notificaciones$|^(?:el\s+)?inicio$/.test(m[1])) return m[1].includes("notificaciones") ? { kind: "global", accion: "notificaciones" } : m[1] === "inicio" ? { kind: "global", accion: "inicio" } : null;
      return { kind: "abrir_app", app: m[1].trim() };
    }
    if ((m = t.match(/^(?:cierra|cerrar|cierrame|mata)\s+(?:la\s+app\s+(?:de\s+)?|la\s+aplicacion\s+(?:de\s+)?|el\s+|la\s+)?(.+)$/)) && !/^(?:jarvis|la app|sesion|te|el dictado|el proyector)$/.test(m[1])) return { kind: "cerrar_app", app: m[1].trim() };
    if (/\b(?:prende|enciende|activa|pon)\s+(?:la\s+)?linterna\b/.test(t)) return { kind: "linterna", on: true };
    if (/\b(?:apaga|desactiva|quita)\s+(?:la\s+)?linterna\b/.test(t)) return { kind: "linterna", on: false };
    if (/\b(?:sube|subele|aumenta)\s+(?:el\s+)?volumen\b/.test(t)) return { kind: "volumen", accion: "subir" };
    if (/\b(?:baja|bajale|disminuye)\s+(?:el\s+)?volumen\b/.test(t)) return { kind: "volumen", accion: "bajar" };
    if (/\bvolumen\s+(?:al\s+)?(?:maximo|a tope)\b/.test(t)) return { kind: "volumen", accion: "max" };
    if (/^(?:silencia|pon en silencio)\s+(?:el\s+)?(?:celular|telefono|sonido)$/.test(t)) return { kind: "volumen", accion: "silencio" };
    if ((m = t.match(/^(?:pon(?:me)?|programa|crea)\s+(?:una\s+)?alarma\s+(?:a\s+las|para\s+las)\s+(\d{1,2})(?::|\s+y\s+)?(\d{1,2})?(?:\s+(?:de la|en la)\s+(manana|tarde|noche))?(?:\s+(?:para|de)\s+(.+))?$/)) || (m = t.match(/^despiertame\s+a\s+las\s+(\d{1,2})(?::|\s+y\s+)?(\d{1,2})?(?:\s+(?:de la|en la)\s+(manana|tarde|noche))?()$/))) {
      let h = +m[1]; const min = +(m[2] || 0);
      if ((m[3] === "tarde" || m[3] === "noche") && h < 12) h += 12;
      if (h > 23 || min > 59) return null;
      return { kind: "alarma", hora: h, minuto: min, texto: m[4] ? cap(m[4]) : "Jarvis" };
    }
    if (/^(?:ve|vete|ir|llevame)\s+al?\s+(?:inicio|pantalla de inicio|escritorio)$|^(?:pantalla de )?inicio$/.test(t)) return { kind: "global", accion: "inicio" };
    if (/^(?:atras|regresa|vuelve atras|devuelvete|ve atras)$/.test(t)) return { kind: "global", accion: "atras" };
    if (/^(?:muestrame|abre|baja)\s+(?:las\s+)?notificaciones$/.test(t)) return { kind: "global", accion: "notificaciones" };
    if (/^(?:apps|aplicaciones)\s+recientes$|^(?:muestrame|abre)\s+(?:las\s+)?(?:apps|aplicaciones)\s+recientes$/.test(t)) return { kind: "global", accion: "recientes" };
    if (/^bloquea\s+(?:el\s+)?(?:celular|telefono|la pantalla|pantalla)$/.test(t)) return { kind: "global", accion: "bloquear" };
    if (/^(?:toma|haz|saca)(?:me)?\s+(?:una\s+)?(?:captura|pantallazo)(?:\s+de\s+pantalla)?$/.test(t)) return { kind: "global", accion: "captura" };
    if ((m = raw.match(/^(?:c[oó]mo\s+llego\s+a|ll[eé]vame\s+a|navega\s+a|ruta\s+a)\s+(.+?)\s*\??$/i))) return { kind: "mapa", lugar: m[1].trim() };
    if ((m = raw.match(/^(?:busca|pon(?:me)?)\s+en\s+youtube\s+(.+)$/i))) return { kind: "youtube", q: m[1].trim() };
    if (/^(?:modo\s+)?dictado$|^(?:empieza|inicia|comienza|haz(?:me)?)\s+(?:un\s+)?dictado$|^voy a dictar(?:te)?$/.test(t)) return { kind: "dictado" };
    if ((m = raw.match(/^(?:nota de voz|toma nota|apunta(?:me)?|anota(?:me)?)\s*[:,]?\s*(.*)$/i)) && !/^en el observador|^que\s/i.test(m[1] || "")) return { kind: "nota_voz", texto: (m[1] || "").trim() };
    if (/^modo bolsillo$|^(?:activa|pon)\s+(?:el\s+)?modo bolsillo$/.test(t)) return { kind: "bolsillo", on: true };
    if (/^(?:quita|apaga|desactiva|sal del)\s+(?:el\s+)?modo bolsillo$/.test(t)) return { kind: "bolsillo", on: false };
    if (/\b(?:resumen de la manana|como (?:empieza|arranca) mi dia|mi rutina de la manana|buenos dias jarvis)\b/.test(t)) return { kind: "rutina" };
    return null;
  }
  /** Mejor coincidencia de un nombre entre contactos o apps. lista: [{nombre}] */
  function bestMatch(q, lista, key = "nombre") {
    const k = norm(q);
    if (!k) return null;
    let best = null, bs = 0;
    (lista || []).forEach((x) => {
      const n = norm(x[key]);
      let s = 0;
      if (n === k) s = 100;
      else if (n.startsWith(k + " ") || n.startsWith(k)) s = 80;
      else if (n.split(" ").some((w) => w === k)) s = 70;
      else if (k.split(" ").every((w) => n.includes(w))) s = 60;
      else if (n.includes(k)) s = 50;
      if (s > bs || (s === bs && s && n.length < norm(best[key]).length)) { bs = s; best = x; }
    });
    return bs ? best : null;
  }
  function appMatch(q, apps) {
    const k = norm(q);
    const direct = bestMatch(k, apps);
    if (direct) return direct;
    for (const [, al] of Object.entries(ALIAS)) {
      if (!al.some((a) => k === a || k.includes(a))) continue;
      const hit = apps.find((x) => al.some((a) => norm(x.nombre).includes(a) || norm(x.paquete).includes(a)));
      if (hit) return hit;
    }
    return null;
  }
  /** Número para WhatsApp: solo dígitos, con el 57 de Colombia si es un celular de 10 dígitos. */
  function waNumber(num) {
    let d = String(num || "").replace(/[^\d+]/g, "");
    if (d.startsWith("+")) return d.slice(1);
    if (d.startsWith("00")) return d.slice(2);
    if (/^3\d{9}$/.test(d)) return "57" + d;
    return d;
  }
  const isYes = (t) => /^(?:si|sí|dale|hazlo|claro|ok|okey|listo|correcto|confirmo|de una|por favor|llamalo|llamala|envialo|mandalo)\b/.test(norm(t));
  const isNo = (t) => /^(?:no|cancela|cancelar|olvidalo|deja asi|para|espera)\b/.test(norm(t));

  // ======================================================================== DICTADO
  /** «hola coma qué tal punto nueva línea» → «Hola, qué tal.\n» */
  function dictPunct(text) {
    let s = " " + String(text || "").trim() + " ";
    const rules = [
      [/[ ]+(?:punto y aparte|punto aparte|nuevo parrafo|nuevo párrafo)[ ]+/gi, ".\n\n"],
      [/[ ]+punto y coma[ ]+/gi, "; "], [/[ ]+(?:punto seguido|punto)[ ]+/gi, ". "], [/[ ]+coma[ ]+/gi, ", "], [/[ ]+dos puntos[ ]+/gi, ": "],
      [/[ ]+(?:puntos suspensivos)[ ]+/gi, "… "],
      [/[ ]+(?:abre (?:la )?interrogacion|abre (?:la )?interrogación|abre pregunta)[ ]+/gi, " ¿"], [/[ ]+(?:cierra (?:la )?interrogacion|cierra (?:la )?interrogación|cierra pregunta|signo de interrogacion|signo de interrogación)[ ]+/gi, "? "],
      [/[ ]+(?:abre (?:la )?exclamacion|abre (?:la )?exclamación)[ ]+/gi, " ¡"], [/[ ]+(?:cierra (?:la )?exclamacion|cierra (?:la )?exclamación|signo de exclamacion|signo de exclamación)[ ]+/gi, "! "],
      [/[ ]+(?:abre comillas)[ ]+/gi, " «"], [/[ ]+(?:cierra comillas)[ ]+/gi, "» "], [/[ ]+(?:abre parentesis|abre paréntesis)[ ]+/gi, " ("], [/[ ]+(?:cierra parentesis|cierra paréntesis)[ ]+/gi, ") "],
      [/[ ]+guion[ ]+/gi, " – "],
      [/[ ]+(?:nueva linea|nueva línea|salto de linea|salto de línea|siguiente linea|siguiente línea|renglon|renglón)[ ]+/gi, "\n"],
    ];
    for (let k = 0; k < 2; k++) rules.forEach(([re, r]) => { s = s.replace(re, r + " "); });
    s = s.replace(/[ \t]+/g, " ").replace(/ ([.,;:!?…»)])/g, "$1").replace(/([¿¡«(]) /g, "$1").replace(/\n /g, "\n").replace(/ \n/g, "\n").replace(/^[ \t]+|\s+$/g, "");
    // mayúscula al empezar y después de punto, ? o !
    s = s.replace(/(^|[.!?…]\s+|\n\s*|[¿¡]\s*)([a-zñáéíóú])/g, (_, a, b) => a + b.toUpperCase());
    return s;
  }
  const dictStop = (t) => /^(?:fin del dictado|termina(?:r)? (?:el )?dictado|para (?:el )?dictado|deten (?:el )?dictado|listo jarvis|terminamos)$/.test(norm(t));
  const dictUndo = (t) => /^(?:borra (?:la )?ultima (?:frase|parte|linea)|borra eso|deshaz)$/.test(norm(t));

  // ======================================================================== NOTAS DE VOZ
  /** ¿A dónde va una nota? nombres: estudiantes de los cursos. → {destino: observador|diario|compromiso|nota, quien?, curso?} */
  function noteRoute(text, nombres) {
    const t = norm(text);
    if (/^(?:hoy\s+)?(?:en|con)\s+(\d{1,2}\s*[a-z]?\d?)\s+(?:vimos|trabajamos|explique|hicimos)\s+/.test(t)) { const m = t.match(/^(?:hoy\s+)?(?:en|con)\s+(\d{1,2}\s*[a-z]?\d?)/); return { destino: "diario", curso: m[1].replace(/\s+/g, "").toUpperCase() }; }
    if (/^(?:tengo que|debo|quede en|me toca|no olvidar|no olvides|recuerda que tengo que)\b/.test(t)) return { destino: "compromiso" };
    const words = t.split(" ");
    let best = null;
    (nombres || []).forEach((n) => {
      const parts = norm(n).split(" ").filter((p) => p.length > 2);
      const hits = parts.filter((p) => words.includes(p)).length;
      if (hits && (!best || hits > best.hits)) best = { n, hits, full: hits >= Math.min(2, parts.length) };
    });
    if (best && best.full) return { destino: "observador", quien: best.n };
    return { destino: "nota" };
  }

  // ======================================================================== BANCO DE PREGUNTAS Y VERSIONES
  function bank(quices) {
    const seen = new Set(), out = [];
    (quices || []).forEach((it) => (it.quiz && it.quiz.preguntas || []).forEach((p) => {
      const k = norm(p.enunciado);
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push({ p, tema: it.tema || it.quiz.titulo || "", grado: it.grado || "", desde: it.id });
    }));
    return out;
  }
  /** Temas del banco con cuántas preguntas hay de cada uno. */
  function bankTopics(b) {
    const c = {};
    b.forEach((x) => { const k = String(x.tema || "Sin tema").trim(); c[k] = (c[k] || 0) + 1; });
    return Object.entries(c).sort((a, b2) => b2[1] - a[1]).map(([tema, n]) => ({ tema, n }));
  }
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function bankPick(b, tema, n, seed = Date.now()) {
    const k = norm(tema);
    const pool = b.filter((x) => !k || norm(x.tema + " " + x.p.enunciado).includes(k));
    const r = rng(seed), arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr.slice(0, n).map((x) => x.p);
  }
  function bankIntent(text) {
    const t = norm(text).replace(/^jarvis\s+/, "");
    let m;
    if ((m = t.match(/^(?:arma(?:me)?|haz(?:me)?|crea(?:me)?|saca(?:me)?)\s+(?:un\s+)?(?:quiz|examen|evaluacion)\s+(?:de\s+(\d{1,2})\s+preguntas\s+)?(?:del|desde el|con el)\s+banco(?:\s+de\s+(?:preguntas\s+)?(?:de\s+)?(.+?))?(?:\s+de\s+(\d{1,2})\s+preguntas)?$/))) return { kind: "banco_quiz", n: +(m[1] || m[3] || 10), tema: (m[2] || "").replace(/\s+de\s+\d+\s+preguntas$/, "").trim() };
    if (/^(?:que hay en el|muestrame el|abre el|mi)\s+banco(?:\s+de preguntas)?$|^banco de preguntas$/.test(t)) return { kind: "banco_ver" };
    if ((m = t.match(/^(?:haz(?:me)?|saca(?:me)?|crea(?:me)?|prepara(?:me)?)\s+(?:las\s+)?(?:versiones|(\d)\s+versiones)(?:\s+a\s*,?\s*b(?:\s*,?\s*c)?(?:\s*(?:,|y)?\s*d)?)?(?:\s+del\s+(?:quiz|examen))?(?:\s+para\s+(.+))?$/))) return { kind: "versiones", n: +(m[1] || 4), curso: (m[2] || "").trim() };
    return null;
  }
  /** Versiones A, B, C, D: las mismas preguntas en otro orden y con las opciones mezcladas. */
  function versions(quiz, n = 4, seed = 7) {
    const out = [];
    for (let v = 0; v < n; v++) {
      const r = rng(seed * 31 + v * 977 + 1);
      if (v === 0) { out.push(Object.assign({}, quiz, { titulo: quiz.titulo + " · versión A", version: "A" })); continue; }
      const order = quiz.preguntas.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      const preguntas = order.map((i) => {
        const q = quiz.preguntas[i], o = q.opciones.map((_, k) => k);
        for (let k = o.length - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1)); [o[k], o[j]] = [o[j], o[k]]; }
        return Object.assign({}, q, { opciones: o.map((k) => q.opciones[k]), correcta: o.indexOf(q.correcta) });
      });
      out.push(Object.assign({}, quiz, { titulo: quiz.titulo + " · versión " + "ABCDEF"[v], version: "ABCDEF"[v], preguntas }));
    }
    return out;
  }

  // ======================================================================== PRÁCTICA CON QR (la página de los estudiantes)
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  /** Página para los celulares de los estudiantes. NO lleva la clave: la califica el celular de la profe. plain: función que pasa LaTeX a texto. */
  function practicePage(quiz, plain = (x) => x) {
    const qs = quiz.preguntas.map((p, i) => `<fieldset><legend>${i + 1}. ${esc(plain(p.enunciado))}</legend>` +
      p.opciones.map((o, k) => `<label><input type="radio" name="q${i}" value="${k}"> <b>${"ABCDE"[k]}</b> ${esc(plain(o))}</label>`).join("") + "</fieldset>").join("");
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(quiz.titulo)}</title>
<style>body{font:17px/1.45 system-ui,sans-serif;margin:0;background:#06101c;color:#e8f4ff}main{max-width:640px;margin:auto;padding:16px}h1{font-size:21px;color:#2ee6ff}
input[type=text]{width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:1px solid #2a4560;background:#0b1726;color:#fff}
fieldset{border:1px solid #1d3550;border-radius:14px;margin:14px 0;padding:10px 12px}legend{font-weight:700;padding:0 4px}label{display:block;padding:9px 6px;border-radius:10px}
label:has(input:checked){background:#12324a}button{width:100%;font-size:18px;font-weight:700;padding:14px;border:0;border-radius:14px;background:#2ee6ff;color:#002233;margin:10px 0 30px}
#fin{display:none;text-align:center;font-size:22px;padding:30px 10px}#fin b{font-size:54px;color:#3dff9a;display:block}</style></head>
<body><main><h1>${esc(quiz.titulo)}</h1><div id="f"><input id="n" type="text" placeholder="Tu nombre y apellido" autocomplete="name">${qs}<button id="b">Enviar respuestas</button></div><div id="fin"></div></main>
<script>
var N=${quiz.preguntas.length};
document.getElementById('b').onclick=function(){var n=document.getElementById('n').value.trim();if(n.length<3){alert('Escribe tu nombre.');return;}
var r=[];for(var i=0;i<N;i++){var x=document.querySelector('input[name=q'+i+']:checked');r.push(x?+x.value:-1);}
if(r.indexOf(-1)>=0&&!confirm('Te faltan preguntas. ¿Enviar así?'))return;
var body=JSON.stringify({nombre:n,resp:r}).replace(/[\\u007f-\\uffff]/g,function(c){return '\\\\u'+('000'+c.charCodeAt(0).toString(16)).slice(-4);});
this.disabled=true;this.textContent='Enviando…';
fetch('/r',{method:'POST',headers:{'content-type':'application/json'},body:body}).then(function(x){return x.json();}).then(function(j){
document.getElementById('f').style.display='none';var f=document.getElementById('fin');f.style.display='block';f.innerHTML='¡Listo, '+n.split(' ')[0]+'!<b>'+j.aciertos+' / '+j.total+'</b>Tu profe ya tiene tus respuestas.';
}).catch(function(){var b=document.getElementById('b');b.disabled=false;b.textContent='No se pudo enviar. Intenta de nuevo';});};
</script></body></html>`;
  }

  // ======================================================================== RECORDATORIOS POR LUGAR
  function placeIntent(text) {
    const raw = String(text || "").trim().replace(lead, ""), t = norm(raw);
    let m;
    if ((m = t.match(/^(?:guarda|recuerda|marca)\s+(?:este\s+lugar|donde estoy|aqui)\s+como\s+(?:el\s+|la\s+|mi\s+)?(.+)$/)) || (m = t.match(/^(?:estoy en|ya estoy en)\s+(?:el\s+|la\s+|mi\s+)?(.+?)\s*(?:,|\s)\s*guarda(?:lo)?\s+(?:el\s+lugar|este\s+lugar)$/))) return { kind: "lugar_guardar", lugar: m[1].trim() };
    if ((m = raw.match(/^(?:cuando|apenas)\s+(llegue|salga)\s+(?:al|a la|a mi|a|del|de la|de mi|de)\s+(.+?)[,\s]+(?:recu[eé]rdame|av[ií]same(?: que)?|dime(?: que)?)\s+(.+)$/i)) || (m = raw.match(/^(?:recu[eé]rdame|av[ií]same)\s+(.+?)\s+cuando\s+(llegue|salga)\s+(?:al|a la|a mi|a|del|de la|de mi|de)\s+(.+?)\s*\.?$/i))) {
      const byWhen = /^(?:cuando|apenas)/i.test(raw);
      return { kind: "lugar_rec", salir: norm(byWhen ? m[1] : m[2]) === "salga", lugar: norm(byWhen ? m[2] : m[3]).replace(/^(?:el|la|mi)\s+/, ""), texto: (byWhen ? m[3] : m[1]).trim() };
    }
    if (/^(?:mis\s+)?recordatorios\s+(?:por|de)\s+lugar$|^(?:que\s+)?lugares\s+(?:tengo|guardaste)$/.test(t)) return { kind: "lugar_ver" };
    return null;
  }

  const API = { norm, phoneIntent, bestMatch, appMatch, waNumber, isYes, isNo, dictPunct, dictStop, dictUndo, noteRoute, bank, bankTopics, bankPick, bankIntent, versions, practicePage, placeIntent, rng };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else root.JL5 = API;
})(typeof window !== "undefined" ? window : this);
