/* Jarvis para Android 3.8 · asistente general (lo de la clase queda como «Modo docente»).
   · Modo docente: se prende o se apaga; apagado, se esconden las pestañas de clase y quices.
   · La IA hace las órdenes de la app (app.js) · corrige lo que oyó el micrófono con tus palabras · memoria automática.
   · Estilo de Jarvis (formal, cercano, amigo; corto o detallado; humor).
   · Órdenes programadas («cada lunes a las 6 dime el clima»): Android avisa a la hora, sin que Jarvis quede despierto.
   · Habilidades propias («cuando diga modo gimnasio, …»).
   · Clima (Open-Meteo, sin clave; ubicación aproximada, sin GPS).
   · Varias conversaciones y buscar en el chat · cuánto has usado la IA · copia semanal en tu Google Drive.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L7 = window.JL7, V = window.JV, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const plug = (n) => (V.native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);

  // ======================================================================== MODO DOCENTE
  function docente() { return D.ajustes.docente !== false; }
  function applyDocente() {
    document.body.classList.toggle("sin-docente", !docente());
    if (!docente() && /^(?:clase|quices)$/.test(document.body.dataset.tab || "")) A.tab("hablar");
  }
  function setDocente(on) { D.ajustes.docente = !!on; save(); applyDocente(); if (window.JX.renderHoy) window.JX.renderHoy(); }

  // ======================================================================== CORRECCIÓN DE LO QUE SE OYÓ
  let contactos = null, pidiendo = false;
  async function cargarContactos() {
    if (contactos || pidiendo || D.ajustes.vozContactos === false) return;
    const T = plug("Telefono"); if (!T) return;
    pidiendo = true;
    try {
      const p = T.checkPermissions ? await T.checkPermissions() : null;          // solo si ya diste el permiso: nunca lo pide por esto
      if (p && p.contactos === "granted") contactos = (((await T.contactos({ q: "" })) || {}).lista || []).map((c) => c.nombre).filter((n) => n && n.split(" ").length >= 2).slice(0, 3000);
    } catch (e) { /* sin contactos */ }
    pidiendo = false;
  }
  function vocab() {
    const v = String(D.ajustes.vocab || "").split(/\n|,/).map((x) => x.trim()).filter(Boolean);
    if (docente()) D.cursos.forEach((c) => (c.estudiantes || []).forEach((n) => v.push(n)));
    (D.misHab || []).forEach((h) => v.push(h.frase));
    (D.convs || []).forEach((c) => v.push(c.nombre));
    if (contactos) v.push(...contactos);
    return v;
  }
  function corregir(text) {
    if (D.ajustes.corregirVoz === false) return text;
    cargarContactos();
    return L7.corregir(text, vocab(), docente() ? D.cursos.map((c) => c.nombre) : []);
  }

  // ======================================================================== USO DE LA IA
  const texto = (m) => typeof m === "string" ? m : Array.isArray(m) ? m.map((p) => (p && (p.text || (typeof p === "string" ? p : ""))) || "").join(" ") : "";
  function contar(opts, out) {
    try {
      const inp = (opts.system || "") + (opts.messages || []).map((m) => texto(m.content)).join(" ");
      const lt = IA.last ? IA.last() : null;
      D.uso = L7.usoAdd(D.uso, (lt && lt.prov) || D.ajustes.proveedor || "ia", inp, typeof out === "string" ? out : JSON.stringify(out || ""));
      save();
    } catch (e) { /* no importa */ }
  }
  function envolverIA() {
    if (IA.__contado) return; IA.__contado = true;
    const ch = IA.chat, js = IA.json;
    IA.chat = async function (opts) { const r = await ch.call(IA, opts); contar(opts || {}, r); return r; };
    IA.json = async function (opts) { const r = await js.call(IA, opts); contar(opts || {}, r); return r; };
  }
  function usoTexto() {
    const u = D.uso; if (!u || !u.prov || !Object.keys(u.prov).length) return "Este mes todavía no has usado la IA.";
    const nom = (k) => (window.JL.PROVIDERS[k] || {}).nombre || (k === "local" ? "IA del celular" : k);
    const rows = Object.entries(u.prov).map(([k, p]) => `- **${nom(k)}**: ${p.n} pregunta${p.n === 1 ? "" : "s"}, unos ${L7.fmtK(p.tin)} tokens enviados y ${L7.fmtK(p.tout)} recibidos`);
    return `**Uso de la IA este mes** (aproximado):\n${rows.join("\n")}\n\nCon los planes gratis de Gemini o Groq esto no cuesta nada mientras no pases sus límites diarios. Si tu clave es de pago, el costo exacto lo ves en la página de tu proveedor.`;
  }

  // ======================================================================== CLIMA
  const climaCache = new Map();
  async function fetchJ(url, ms) {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms || 8000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); }
  }
  async function lugar(ciudad, pedirGPS) {
    const q = ciudad || D.ajustes.ciudad || "";
    if (q) {
      const g = D.ajustes.climaGeo;
      if (g && L7.norm(g.q) === L7.norm(q)) return g;
      const j = await fetchJ(L7.geoUrl(q + (/colombia/i.test(q) ? "" : "")), 8000);
      const r = (j.results || []).sort((a, b) => (b.country_code === "CO") - (a.country_code === "CO"))[0];
      if (!r) throw new Error(`No encontré «${q}».`);
      const out = { q, lat: r.latitude, lng: r.longitude, nombre: r.name };
      if (!ciudad || L7.norm(ciudad) === L7.norm(D.ajustes.ciudad || "")) { D.ajustes.climaGeo = out; save(); }
      return out;
    }
    const p = D.ajustes.climaPos;
    if (p && Date.now() - p.t < 6 * 3600e3) return p;
    if (!pedirGPS) return null;
    const S = plug("Lugares");
    if (!S) throw new Error("Dime de qué ciudad: «el clima en Bogotá», o escribe tu ciudad en Ajustes › Asistente.");
    const r = await S.aqui({ aprox: true });                                     // ubicación aproximada: casi no gasta batería
    D.ajustes.climaPos = { lat: r.lat, lng: r.lng, t: Date.now(), nombre: "" }; save();
    return D.ajustes.climaPos;
  }
  async function pronostico(pos) {
    const k = pos.lat.toFixed(2) + "," + pos.lng.toFixed(2), c = climaCache.get(k), vida = D.ajustes.ahorroActivo ? 2 * 3600e3 : 30 * 60e3;
    if (c && Date.now() - c.t < vida) return c.j;
    const j = await fetchJ(L7.climaUrl(pos.lat, pos.lng), 9000);
    climaCache.set(k, { t: Date.now(), j });
    return j;
  }
  async function clima(it) {
    if (!navigator.onLine) return R("Para el clima necesito internet.", "err");
    try {
      const pos = await lugar(it.ciudad, true);
      const j = await pronostico(pos);
      const txt = L7.climaTexto(j, it.dia, it.ciudad ? pos.nombre : (pos.nombre || ""), Date.now());
      return R("🌦️ " + txt, "tool", txt);
    } catch (e) { return R(e.message || "No pude consultar el clima.", "err"); }
  }
  /** Para el resumen de la mañana: solo si ya sé dónde estás (no pide permisos). */
  async function climaHoy() {
    if (!navigator.onLine) return "";
    const pos = await lugar("", false); if (!pos) return "";
    return "El clima: " + L7.climaTexto(await pronostico(pos), 0, "", Date.now()).replace(/^Ahora hay/, "ahora hay");
  }

  // ======================================================================== ÓRDENES PROGRAMADAS
  const NID = 778000;
  async function programarAvisos() {
    const LN = plug("LocalNotifications"); if (!LN) return;
    try { const ids = []; for (let k = 0; k < 15 * 7; k++) ids.push({ id: NID + k }); await LN.cancel({ notifications: ids }); } catch (e) { /* nada */ }
    const list = [];
    (D.programadas || []).slice(0, 15).forEach((p, i) => p.activa !== false && p.dias.forEach((d) => list.push({ id: NID + i * 7 + d, title: "⏰ Jarvis", body: `${p.orden} · toca para hacerlo`,
      schedule: { on: { weekday: d + 1, hour: p.h, minute: p.m }, allowWhileIdle: true }, extra: { prog: p.id } })));
    if (list.length) { try { await LN.schedule({ notifications: list }); } catch (e) { /* sin permiso */ } }
  }
  let corriendo = false;
  async function correr(p) {
    if (corriendo) return; corriendo = true;
    try {
      p.ultima = Date.now(); save();
      A.tab("hablar");
      A.add("assistant", `⏰ Orden programada (${L7.diasTxt(p.dias)}, ${L7.hhmm(p.h, p.m)}): ${p.orden}`, "tool orden");
      await A.dispatch(p.orden);
    } finally { corriendo = false; }
  }
  /** Con Jarvis en pantalla (cada minuto): hace las que ya tocaban y no se hicieron (de las últimas 6 horas). */
  async function revisar() {
    const now = Date.now();
    for (const p of D.programadas || []) {
      if (p.activa === false) continue;
      const due = L7.lastDue(p, now);
      if (due && due > (p.ultima || p.creada || 0) && now - due < 6 * 3600e3) { await correr(p); break; }
    }
  }
  function listaProg() {
    const l = D.programadas || [];
    if (!l.length) return R("No tienes órdenes programadas. Dime, por ejemplo: «cada lunes a las 6 de la mañana dime el clima».");
    R("**Tus órdenes programadas:**\n" + l.map((p, i) => `${i + 1}. ${L7.diasTxt(p.dias)}, a las ${L7.hhmm(p.h, p.m)}: ${p.orden}`).join("\n") + "\n\nPara quitar una: «borra la orden programada 1».", "tool", `Tienes ${l.length} órdenes programadas. Están en la pantalla.`);
  }

  // ======================================================================== HABILIDADES PROPIAS
  async function correrHab(h) {
    A.add("assistant", `✨ ${h.frase}: ${h.pasos.length} paso${h.pasos.length > 1 ? "s" : ""}`, "tool orden");
    for (const s of h.pasos) {
      if (D.ajustes.voz) await V.idle();
      A.add("assistant", "▶ " + s, "tool orden");
      await A.dispatch(s);
    }
  }

  // ======================================================================== CONVERSACIONES
  function convAct() { if (!D.convAct) D.convAct = { id: window.JD.uid(), nombre: "General" }; return D.convAct; }
  function todas() { return [{ id: convAct().id, nombre: convAct().nombre, chat: D.chat, actual: true }].concat(D.convs || []); }
  function cambiar(destino) {
    D.convs = D.convs || [];
    const cur = convAct();
    D.convs = D.convs.filter((c) => c.id !== destino.id && c.id !== cur.id);
    if (D.chat.length || cur.nombre !== "General") D.convs.unshift({ id: cur.id, nombre: cur.nombre, chat: D.chat, t: Date.now() });
    D.chat = destino.chat || [];
    D.convAct = { id: destino.id, nombre: destino.nombre };
    if (D.convs.length > 15) D.convs = D.convs.slice(0, 15);
    save(); A.renderChat(); pintarBarra();
  }
  function nueva(nombre) { cambiar({ id: window.JD.uid(), nombre: nombre ? nombre[0].toUpperCase() + nombre.slice(1) : "Conversación " + ((D.convs || []).length + 2), chat: [] }); }
  function pintarBarra() {
    let b = $("#convbar");
    if (!b) {
      b = mk("div", "convbar"); b.id = "convbar";
      const n = mk("button", "conv-n"); n.type = "button"; n.addEventListener("click", hoja);
      const s = mk("button", "conv-b", "🔍"); s.type = "button"; s.setAttribute("aria-label", "Buscar en el chat"); s.addEventListener("click", () => hoja(true));
      const p = mk("button", "conv-b", "＋"); p.type = "button"; p.setAttribute("aria-label", "Nueva conversación"); p.addEventListener("click", () => { nueva(""); A.toast("Conversación nueva. La anterior quedó guardada."); });
      b.append(n, s, p);
      const ch = $("#chat"); ch.parentNode.insertBefore(b, ch);
    }
    $(".conv-n", b).textContent = "💬 " + convAct().nombre + ((D.convs || []).length ? " ▾" : "");
  }
  function hoja(buscando) {
    let sh = $("#conv-sh");
    if (sh) sh.remove();
    sh = mk("div", "sheet"); sh.id = "conv-sh";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h"), sc = mk("div", "scroll");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.addEventListener("click", () => sh.remove());
    hd.append(mk("h2", "", "Conversaciones"), x);
    const q = mk("input", "inp"); q.type = "search"; q.placeholder = "Buscar en todas las conversaciones…";
    const res = mk("ul", "conv-list");
    const pintar = () => {
      res.textContent = "";
      const t = q.value.trim();
      if (t.length >= 3) {
        const r = L7.buscar(todas(), t, 30);
        if (!r.length) res.append(mk("li", "hint", "No encontré nada."));
        r.forEach((h) => { const li = mk("li"); li.append(mk("b", "", h.nombre + " · " + (h.role === "user" ? "tú" : "Jarvis")), mk("small", "", " " + h.frag)); li.addEventListener("click", () => { sh.remove(); if (h.conv !== convAct().id) cambiar(todas().find((c) => c.id === h.conv)); }); res.append(li); });
        return;
      }
      todas().forEach((c) => {
        const li = mk("li" + "", c.actual ? "on" : ""), d = mk("div", "grow");
        d.append(mk("b", "", c.nombre), mk("small", "", ` · ${(c.chat || []).length} mensajes`));
        li.append(d);
        if (!c.actual) {
          const del = mk("button", "btn danger", "Borrar"); del.type = "button";
          del.addEventListener("click", (ev) => { ev.stopPropagation(); if (!confirm(`¿Borrar la conversación «${c.nombre}»?`)) return; D.convs = D.convs.filter((y) => y.id !== c.id); save(); pintar(); pintarBarra(); });
          li.append(del);
          li.addEventListener("click", () => { sh.remove(); cambiar(c); });
        } else {
          const rn = mk("button", "btn", "Renombrar"); rn.type = "button";
          rn.addEventListener("click", (ev) => { ev.stopPropagation(); const v = prompt("Nombre de esta conversación", c.nombre); if (v && v.trim()) { D.convAct.nombre = v.trim().slice(0, 40); save(); pintar(); pintarBarra(); } });
          li.append(rn);
        }
        res.append(li);
      });
    };
    q.addEventListener("input", pintar);
    const nv = mk("button", "btn primary", "＋ Nueva conversación"); nv.type = "button"; nv.addEventListener("click", () => { sh.remove(); nueva(""); });
    sc.append(q, res, nv);
    inn.append(hd, sc); sh.append(inn); document.body.append(sh);
    sh.hidden = false; pintar();
    if (buscando) setTimeout(() => q.focus(), 50);
  }

  // ======================================================================== COPIA EN LA NUBE
  function copiaNube() {
    const g = D.ajustes.google || {};
    if (!g.cuenta || D.ajustes.copiaNube === false || D.ajustes.ahorroActivo || !navigator.onLine) return;
    if (Date.now() - (g.copia || 0) < 7 * 864e5) return;
    const f = window.JX._ && window.JX._.driveSave; if (f) f(false);
  }

  // ======================================================================== AJUSTES › ASISTENTE
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-gen")) return;
    const sec = mk("div"); sec.id = "aj-gen";
    sec.append(mk("h3", "sub", "Asistente"));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked, i)); l.append(i, document.createTextNode(" " + label)); sec.append(l); return i; };
    chk("Modo docente (cursos, notas, asistencia, quices y herramientas de la clase)", docente(), (v) => setDocente(v));
    sec.append(mk("p", "hint", "Apagado, Jarvis es solo tu asistente personal: se esconden las pestañas Clase y Quices. Tus cursos y notas no se borran."));
    const st = D.ajustes.estilo = D.ajustes.estilo || {};
    sec.append(mk("label", "lbl", "Cómo te habla Jarvis"));
    const row = mk("div", "row wrap");
    const s1 = mk("select", "inp half"); [["cercano", "Cálido y cercano"], ["formal", "Formal (de usted)"], ["amigo", "Como un amigo"]].forEach(([k, t]) => s1.append(new Option(t, k))); s1.value = st.estilo || "cercano";
    const s2 = mk("select", "inp half"); [["normal", "Respuestas normales"], ["corto", "Muy cortas"], ["detallado", "Con detalles"]].forEach(([k, t]) => s2.append(new Option(t, k))); s2.value = st.largo || "normal";
    s1.addEventListener("change", () => { st.estilo = s1.value; save(); }); s2.addEventListener("change", () => { st.largo = s2.value; save(); });
    row.append(s1, s2); sec.append(row);
    chk("Con un toque de humor", st.humor, (v) => { st.humor = v; save(); });
    const ex = mk("textarea", "inp"); ex.rows = 2; ex.placeholder = "Algo más sobre cómo quieres que te hable (opcional)"; ex.value = st.extra || ""; ex.addEventListener("change", () => { st.extra = ex.value.trim(); save(); }); sec.append(ex);
    chk("Memoria automática: Jarvis recuerda lo importante que le cuentas (nunca claves ni datos de estudiantes)", D.ajustes.memoriaAuto !== false, (v) => { D.ajustes.memoriaAuto = v; save(); });
    chk("Corregir lo que oye el micrófono con tus nombres y palabras", D.ajustes.corregirVoz !== false, (v) => { D.ajustes.corregirVoz = v; save(); });
    chk("Usar también los nombres de mis contactos (no salen del celular)", D.ajustes.vozContactos !== false, (v) => { D.ajustes.vozContactos = v; contactos = null; save(); });
    sec.append(mk("label", "lbl", "Palabras que Jarvis debe reconocer bien (nombres, lugares, marcas; una por línea)"));
    const vo = mk("textarea", "inp"); vo.rows = 3; vo.placeholder = "Carolina Ruiz\nBancolombia\nZipaquirá"; vo.value = D.ajustes.vocab || ""; vo.addEventListener("change", () => { D.ajustes.vocab = vo.value; save(); }); sec.append(vo);
    sec.append(mk("label", "lbl", "Tu ciudad (para el clima)"));
    const ci = mk("input", "inp"); ci.placeholder = "Si la dejas vacía, uso tu ubicación aproximada"; ci.value = D.ajustes.ciudad || ""; ci.addEventListener("change", () => { D.ajustes.ciudad = ci.value.trim(); save(); }); sec.append(ci);

    sec.append(mk("h3", "sub", "Habilidades propias"));
    sec.append(mk("p", "hint", "Una frase tuya que hace varias cosas. Dile a Jarvis: «cuando diga modo gimnasio, pon mi música, silencia el celular y cuenta 45 minutos»."));
    const hl = mk("ul", "conv-list"); sec.append(hl);
    sec.append(mk("h3", "sub", "Órdenes programadas"));
    sec.append(mk("p", "hint", "Dile: «cada lunes a las 6 de la mañana dime el clima» o «de lunes a viernes a las 9 de la noche activa el modo ahorro». A la hora te llega un aviso (Android lo da sin que Jarvis quede despierto: no gasta batería); lo tocas y Jarvis lo hace."));
    const pl = mk("ul", "conv-list"); sec.append(pl);
    sec.append(mk("h3", "sub", "Uso de la IA"));
    const us = mk("div", "hint"); sec.append(us);
    if ((D.ajustes.google || {}).cuenta) chk("Copia automática semanal en mi Google Drive (sin claves)", D.ajustes.copiaNube !== false, (v) => { D.ajustes.copiaNube = v; save(); });
    const pinta = () => {
      hl.textContent = ""; pl.textContent = "";
      (D.misHab || []).forEach((h) => { const li = mk("li"), d = mk("div", "grow"); d.append(mk("b", "", "«" + h.frase + "»"), mk("small", "", " → " + h.pasos.join(" · "))); const b = mk("button", "btn danger", "Borrar"); b.type = "button"; b.addEventListener("click", () => { D.misHab = D.misHab.filter((y) => y !== h); save(); pinta(); }); li.append(d, b); hl.append(li); });
      if (!(D.misHab || []).length) hl.append(mk("li", "hint", "Todavía no tienes."));
      (D.programadas || []).forEach((p) => { const li = mk("li"), d = mk("div", "grow"); d.append(mk("b", "", `${L7.diasTxt(p.dias)}, ${L7.hhmm(p.h, p.m)}`), mk("small", "", " · " + p.orden)); const b = mk("button", "btn danger", "Borrar"); b.type = "button"; b.addEventListener("click", () => { D.programadas = D.programadas.filter((y) => y !== p); save(); programarAvisos(); pinta(); }); li.append(d, b); pl.append(li); });
      if (!(D.programadas || []).length) pl.append(mk("li", "hint", "Todavía no tienes."));
      us.innerHTML = A.md(usoTexto());
    };
    pinta();
    box.prepend(sec);
  }

  // ======================================================================== ÓRDENES DE VOZ
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const t = L7.norm(text).replace(/^jarvis\s+/, "");
    const h = L7.habMatch(text, D.misHab); if (h) return { g: "hab_run", h };
    let m;
    if (/^(?:activa|prende|enciende|pon)\s+(?:el\s+)?modo docente$/.test(t)) return { g: "docente", on: true };
    if (/^(?:desactiva|apaga|quita)\s+(?:el\s+)?modo docente$/.test(t)) return { g: "docente", on: false };
    const hb = L7.habIntent(text); if (hb) return { g: "hab_new", h: hb };
    if (/^(?:mis habilidades(?: propias)?|que habilidades (?:me )?(?:has aprendido|te ensene))$/.test(t)) return { g: "hab_list" };
    if ((m = t.match(/^(?:borra|elimina|quita|olvida)\s+(?:la\s+)?habilidad\s+(?:de\s+)?(.+)$/))) return { g: "hab_del", frase: m[1] };
    const pr = L7.progIntent(text); if (pr) return { g: "prog_new", p: pr };
    if (/^(?:mis ordenes programadas|que tengo programado|ordenes programadas|lista de ordenes programadas)$/.test(t)) return { g: "prog_list" };
    if ((m = t.match(/^(?:borra|elimina|quita|cancela)\s+(?:la\s+)?orden programada\s+(?:numero\s+)?(\d+|.+)$/))) return { g: "prog_del", q: m[1] };
    const cl = L7.climaIntent(text); if (cl) return { g: "clima", it: cl };
    const cv = L7.convIntent(text); if (cv) return { g: "conv", it: cv };
    if (/\b(?:cuanto (?:he )?(?:gastado|usado)|uso) de la ia\b|\bcuantos tokens\b|\bcuanto llevo (?:gastado|usado)\b/.test(t)) return { g: "uso" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.g) return base.run(it, text);
    switch (it.g) {
      case "docente": setDocente(it.on); return R(it.on ? "Modo docente activado: volvieron las pestañas Clase y Quices." : "Modo docente apagado: soy solo tu asistente personal. Tus cursos y notas siguen guardados.");
      case "hab_run": return correrHab(it.h);
      case "hab_new": {
        D.misHab = (D.misHab || []).filter((x) => L7.norm(x.frase) !== it.h.frase);
        D.misHab.push({ id: window.JD.uid(), frase: it.h.frase, pasos: it.h.pasos }); save();
        return R(`✨ Aprendí la habilidad **«${it.h.frase}»**. Cuando me la digas haré:\n` + it.h.pasos.map((p, i) => `${i + 1}. ${p}`).join("\n"), "tool", `Listo. Cuando me digas ${it.h.frase}, haré ${it.h.pasos.length} cosas.`);
      }
      case "hab_list": return (D.misHab || []).length ? R("**Tus habilidades:**\n" + D.misHab.map((h) => `- «${h.frase}» → ${h.pasos.join(" · ")}`).join("\n"), "tool", `Tienes ${D.misHab.length} habilidades propias. Están en la pantalla.`)
        : R("Todavía no me has enseñado habilidades. Dime, por ejemplo: «cuando diga modo enfoque, silencia el celular y pon 25 minutos».");
      case "hab_del": { const h = L7.habMatch(it.frase, D.misHab) || (D.misHab || []).find((x) => L7.sim(L7.norm(x.frase), L7.norm(it.frase)) > 0.7); if (!h) return R("No tengo esa habilidad.", "err"); D.misHab = D.misHab.filter((x) => x !== h); save(); return R(`Borré la habilidad «${h.frase}».`); }
      case "prog_new": {
        D.programadas = D.programadas || [];
        if (D.programadas.length >= 15) return R("Ya tienes 15 órdenes programadas; borra alguna primero.", "err");
        const p = { id: window.JD.uid(), dias: it.p.dias, h: it.p.h, m: it.p.m, orden: it.p.orden, creada: Date.now() };
        D.programadas.push(p); save(); await programarAvisos();
        return R(`⏰ Listo: ${L7.diasTxt(p.dias)}, a las ${L7.hhmm(p.h, p.m)}, «${p.orden}». A esa hora te llega un aviso; lo tocas y lo hago (si tengo la app abierta, lo hago de una).`);
      }
      case "prog_list": return listaProg();
      case "prog_del": {
        const l = D.programadas || [], n = +it.q;
        const p = n ? l[n - 1] : l.find((x) => L7.norm(x.orden).includes(L7.norm(it.q)));
        if (!p) return R("No encontré esa orden programada. Di «mis órdenes programadas» para ver la lista.", "err");
        D.programadas = l.filter((x) => x !== p); save(); await programarAvisos();
        return R(`Quité la orden programada «${p.orden}».`);
      }
      case "clima": return clima(it.it);
      case "uso": return R(usoTexto(), "tool", "Ahí tienes el uso de la IA de este mes.");
      case "conv": {
        const c = it.it;
        if (c.conv === "nueva") { nueva(c.nombre); return R(`Empezamos una conversación nueva${c.nombre ? " sobre " + c.nombre : ""}. La anterior quedó guardada: «mis conversaciones».`); }
        if (c.conv === "lista") { hoja(); return; }
        if (c.conv === "cambiar") { const d = L7.convFind(todas(), c.nombre); if (!d) return R(`No tengo una conversación «${c.nombre}». Di «mis conversaciones».`, "err"); if (d.actual) return R("Ya estamos en esa."); cambiar(d); return R(`Volvimos a «${d.nombre}».`); }
        if (c.conv === "buscar") {
          const r = L7.buscar(todas(), c.q, 8);
          if (!r.length) return R(`No encontré «${c.q}» en las conversaciones.`);
          return R(`**Encontré ${r.length}:**\n` + r.map((h) => `- *${h.nombre}*, ${new Date(h.t).toLocaleDateString("es-CO", { day: "numeric", month: "short" })}: ${h.frag}`).join("\n"), "tool", `Encontré ${r.length} mensajes. Están en la pantalla.`);
        }
      }
    }
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    if (D.ajustes.docente == null) { D.ajustes.docente = D.cursos.length > 0 || !!(D.quices && D.quices.length); save(); }
    D.misHab = D.misHab || []; D.programadas = D.programadas || []; D.convs = D.convs || []; convAct();
    try { base.init(api); } catch (e) { console.error("init", e); }
    envolverIA();
    applyDocente(); pintarBarra();
    const LN = plug("LocalNotifications");
    if (LN) window.JON(LN, "localNotificationActionPerformed", (ev) => {
      const id = ev && ev.notification && ev.notification.extra && ev.notification.extra.prog;
      const p = id && (D.programadas || []).find((x) => x.id === id);
      if (p) setTimeout(() => correr(p), 600);
    });
    programarAvisos();
    window.JEVERY(60000, revisar);                       // solo con Jarvis en pantalla
    setTimeout(copiaNube, 20000);
  };
  X.corregir = corregir;
  X.climaHoy = climaHoy;
  X._gen = { corregir, vocab, revisar, programarAvisos, cambiar, nueva, todas, clima, usoTexto };
})();
