/* Jarvis para Android 3.28 · lo nuevo de 2026:
   · Google Maps en las respuestas de lugares (con la ubicación aproximada).
   · Tareas largas en segundo plano («investiga a fondo…»): siguen en la nube aunque cierres Jarvis; aviso en vivo y notificación.
   · Volumen propio de Jarvis (Android 17): «sube el volumen de Jarvis».
   · Agenda privada: escoges el contacto cada vez (Jarvis no ve toda tu agenda).
   · «Mi día»: agenda, recordatorios, clima, correos importantes y tareas, con los próximos pasos.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L17 = window.JL17, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const aj = () => D.ajustes;

  // ======================================================================== UBICACIÓN APROXIMADA (para Google Maps)
  X.posAprox = async function () {
    const p = aj().climaPos;
    if (p && Date.now() - p.t < 6 * 3600e3 && isFinite(+p.lat)) return { lat: +p.lat, lng: +p.lng };
    const S = plug("Lugares"); if (!S || !S.aqui) return null;
    try {
      const r = await Promise.race([S.aqui({ aprox: true }), new Promise((ok) => setTimeout(() => ok(null), 3000))]);
      if (r && isFinite(+r.lat) && isFinite(+r.lng)) { aj().climaPos = { lat: +r.lat, lng: +r.lng, t: Date.now(), nombre: "" }; save(); return { lat: +r.lat, lng: +r.lng }; }
    } catch (e) { /* sin ubicación */ }
    return null;
  };

  // ======================================================================== TAREAS LARGAS
  const API = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const REV = "2026-05-20";
  function conNombres(t) {
    if (aj().docente !== true) return false;
    const n = L17.norm(t);
    return [].concat(...(D.cursos || []).map((c) => c.estudiantes || [])).some((x) => { const p = L17.norm(x).split(" ").filter((w) => w.length > 2); return p.length >= 2 && p.filter((w) => n.includes(w)).length >= 2; });
  }
  async function crearTarea(q) {
    const key = ((aj().claves || {}).gemini || "").trim();
    if (!key) return R("Las tareas largas usan Gemini: pon tu clave de Gemini en Ajustes.", "err");
    if (!navigator.onLine) return R("Sin internet no puedo empezar la investigación.", "err");
    if (conNombres(q)) return R("Eso tiene nombres de tus estudiantes y por privacidad no lo mando a la nube.", "err");
    const titulo = q.length > 70 ? q.slice(0, 67) + "…" : q;
    R(`🔎 Empiezo a investigar «${titulo}» en segundo plano. Puedes cerrar Jarvis: te aviso cuando esté.`);
    let ultimoError = null;
    for (const quien of L17.intentosTarea(IA.rotacion ? IA.rotacion("gemini") : [])) {
      try {
        const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key, "Api-Revision": REV },
          body: JSON.stringify(Object.assign({ input: L17.promptTarea(q), background: true }, quien)) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { ultimoError = (j.error && j.error.message) || "HTTP " + res.status; if (res.status === 401 || res.status === 403 && /key/i.test(ultimoError)) break; continue; }
        const id = j.id || (j.name ? String(j.name).split("/").pop() : "");
        if (!id) { ultimoError = "Google no devolvió la tarea."; continue; }
        (D.tareas = D.tareas || []).unshift({ id, titulo, t: Date.now(), estado: j.status || "in_progress", con: quien.agent || quien.model });
        D.tareas = D.tareas.slice(0, 30); save();
        if (j.status === "completed") return mostrar(Object.assign({}, D.tareas[0], { estado: "completed", texto: L17.textoInteraccion(j) }));
        const T = plug("Tareas");
        if (T) { try { await T.vigilar({ id, key, titulo }); } catch (e) { /* se vigila desde aquí */ } }
        vigilarAqui();
        if (window.JDIAG) window.JDIAG.log("tarea", `${id} · ${quien.agent || quien.model}`);
        return;
      } catch (e) { ultimoError = e.message || String(e); }
    }
    // la cuenta no tiene las tareas en segundo plano: se hace ya, con la Búsqueda de Google
    if (window.JDIAG) window.JDIAG.log("tarea-falla", String(ultimoError).slice(0, 80));
    R("Tu cuenta de Gemini no tiene las tareas en segundo plano todavía" + (ultimoError ? ` (${String(ultimoError).slice(0, 90)})` : "") + ". La hago ahora mismo con la Búsqueda de Google:", "tool", "Tu cuenta no tiene las tareas en segundo plano; la hago ahora mismo.");
    return A.dispatch(`Investiga con la Búsqueda de Google y explícame con fuentes: ${q}`);
  }
  async function revisarDesdeAqui() {
    const key = ((aj().claves || {}).gemini || "").trim();
    const T = plug("Tareas");
    if (T) {
      try { await T.revisar(); const l = ((await T.lista()) || {}).lista || []; l.forEach(actualizar); } catch (e) { /* nada */ }
      return;
    }
    if (!key) return;
    for (const t of (D.tareas || []).filter((x) => x.estado === "in_progress")) {
      try {
        const r = await fetch(`${API}/${t.id}`, { headers: { "x-goog-api-key": key, "Api-Revision": REV } });
        const j = await r.json();
        if (["completed", "failed", "cancelled"].includes(j.status)) actualizar({ id: t.id, estado: j.status, texto: j.status === "completed" ? L17.textoInteraccion(j) : "La tarea no se pudo terminar." });
      } catch (e) { /* luego */ }
    }
  }
  function actualizar(n) {
    const t = (D.tareas || []).find((x) => x.id === n.id); if (!t) return;
    if (t.estado !== "in_progress" || n.estado === "in_progress") return;
    t.estado = n.estado; t.texto = n.texto || ""; t.fin = n.fin || Date.now(); save();
    if (!document.hidden) mostrar(t);
  }
  let reloj = null;
  function vigilarAqui() {
    if (reloj) return;
    reloj = setInterval(() => {
      if (!(D.tareas || []).some((x) => x.estado === "in_progress")) { clearInterval(reloj); reloj = null; return; }
      if (!document.hidden) revisarDesdeAqui();
    }, 20000);
  }
  /** Muestra el resultado de una tarea en la conversación (una sola vez, salvo que la pidas). */
  function mostrar(t, otraVez) {
    if (!t || (t.visto && !otraVez)) return;
    t.visto = true; save();
    A.tab && A.tab("hablar");
    const ok = t.estado === "completed";
    const md = ok ? `✅ **Lista tu investigación: ${t.titulo}**\n\n${t.texto || "(sin texto)"}` : `⚠️ **No se pudo terminar: ${t.titulo}**\n\n${t.texto || ""}`;
    const { e } = A.add("assistant", md, "tool");
    e.innerHTML = A.md(md);
    if (ok) {
      const box = mk("div", "doc-acts");
      const bt = (txt, fn) => { const b = mk("button", "chip", txt); b.type = "button"; b.addEventListener("click", fn); box.append(b); };
      bt("🔊 Léela", () => (X._vida && X._vida.leerCompartido ? X._vida.leerCompartido(t.texto) : A.say(t.texto)));
      bt("📋 Copiar", () => (navigator.clipboard ? navigator.clipboard.writeText(t.texto) : Promise.reject()).then(() => A.toast("Copiado.")).catch(() => {}));
      bt("💾 Guardar en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: t.titulo, md: t.texto, fecha: Date.now(), tipo: "nota" }); save(); A.toast("Guardada en Material."); });
      e.append(box);
    }
    $("#chat").scrollTop = $("#chat").scrollHeight;
    A.say(ok ? `Lista tu investigación sobre ${t.titulo}.` : `No se pudo terminar la investigación sobre ${t.titulo}.`);
  }
  function verTareas() {
    const l = D.tareas || [];
    if (!l.length) return R("No tienes tareas largas. Dime «investiga a fondo …» y la hago en segundo plano.");
    const fila = (t) => `- ${t.estado === "in_progress" ? "⏳" : t.estado === "completed" ? "✅" : "⚠️"} **${t.titulo}** · ${new Date(t.t).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`;
    const { e } = A.add("assistant", "", "tool");
    e.innerHTML = A.md("🔎 **Tus tareas largas**\n" + l.slice(0, 10).map(fila).join("\n"));
    const box = mk("div", "doc-acts");
    l.filter((t) => t.estado !== "in_progress").slice(0, 5).forEach((t) => { const b = mk("button", "chip", "Ver: " + t.titulo.slice(0, 28)); b.type = "button"; b.addEventListener("click", () => mostrar(t, true)); box.append(b); });
    if (box.childElementCount) e.append(box);
    A.say(`Tienes ${l.filter((t) => t.estado === "in_progress").length} en curso y ${l.filter((t) => t.estado === "completed").length} listas.`);
  }

  // ======================================================================== VOLUMEN DE JARVIS
  async function volumen(it) {
    const T = plug("Telefono");
    if (!T || !T.volumenJarvis) return R("Eso funciona en la app instalada (el APK).", "err");
    try {
      const r = await T.volumenJarvis({ accion: it.vj });
      const pct = r.max ? Math.round((r.nivel / r.max) * 100) : null;
      return R(`🔊 ${it.vj === "bajar" ? "Bajé" : "Subí"} mi volumen${pct != null ? ` (${pct} %)` : ""}.` + (r.propio ? " Es mi propio volumen: la música no cambia." : " En este Android mi voz va con el volumen de la música (desde Android 17 tengo el mío aparte)."));
    } catch (e) { return R(e.message || String(e), "err"); }
  }

  // ======================================================================== MI DÍA
  async function miDia() {
    const C = X._c36;
    let base = "";
    try { base = C && C.summary ? await C.summary() : ""; } catch (e) { /* nada */ }
    const datos = [base];
    if ((aj().google || {}).gmail && aj().miDiaCorreo !== false && X._ && X._.gfetch) {
      try {
        const GM = "https://gmail.googleapis.com/gmail/v1/users/me";
        const l = await Promise.race([X._.gfetch(`${GM}/messages?maxResults=6&q=${encodeURIComponent("is:unread is:important newer_than:2d")}`, {}, true), new Promise((_, no) => setTimeout(() => no(new Error("lento")), 8000))]);
        const ids = (l.messages || []).map((m) => m.id).slice(0, 6);
        const ms = await Promise.all(ids.map((id) => X._.gfetch(`${GM}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`, {}, true)));
        const cab = (m, k) => (((m.payload || {}).headers || []).find((h) => h.name === k) || {}).value || "";
        if (ms.length) datos.push("Correos importantes sin leer: " + ms.map((m) => `${cab(m, "From").replace(/<.*>/, "").trim()} — ${cab(m, "Subject")}`).join("; ") + ".");
        else datos.push("No hay correos importantes sin leer.");
      } catch (e) { /* sin Gmail: sigue sin correos */ }
    }
    if (X._a334 && X._a334.temasDia) { const td = await X._a334.temasDia(); if (td) datos.push(td); }       // 3.34: mis temas de hoy
    if (X._a331 && X._a331.saludDia) { const sd = await X._a331.saludDia(); if (sd) datos.push(sd); }      // 3.31: cómo dormí (si lo activaste)
    const enCurso = (D.tareas || []).filter((t) => t.estado === "in_progress");
    if (enCurso.length) datos.push(`Investigaciones en curso: ${enCurso.map((t) => t.titulo).join("; ")}.`);
    const listas = (D.tareas || []).filter((t) => t.estado === "completed" && !t.visto);
    if (listas.length) datos.push(`Investigaciones listas sin ver: ${listas.map((t) => t.titulo).join("; ")}.`);
    const hayIA = navigator.onLine && (aj().proveedor === "local" || ((aj().claves || {})[aj().proveedor] || "").trim());
    if (!hayIA) return R("☀️ " + datos.join(" "), "tool", datos.join(" "));
    // 3.28: directo a la IA (sin pasar por las órdenes: el texto del resumen podría parecer una orden)
    return A.askAI ? A.askAI(L17.promptMiDia(datos.join("\n"))) : A.dispatch(L17.promptMiDia(datos.join("\n")));
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-328")) return;
    const s = mk("div"); s.id = "aj-328";
    const chk = (cont, label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); cont.append(l); return i; };
    s.append(mk("h3", "sub", "Lugares con Google Maps"));
    chk(s, "Responder las preguntas de lugares con Google Maps (restaurantes, farmacias, qué tan lejos queda…)", aj().mapasAuto !== false, (v) => { aj().mapasAuto = v; save(); });
    s.append(mk("p", "hint", "Solo con Gemini. Usa tu ubicación aproximada para buscar cerca de ti, y muestra los lugares como fuentes (tócalos para abrirlos en Maps)."));
    s.append(mk("h3", "sub", "Mi día y tareas largas"));
    chk(s, "Incluir mis correos importantes sin leer en «Mi día» (si conectaste Gmail)", aj().miDiaCorreo !== false, (v) => { aj().miDiaCorreo = v; save(); });
    s.append(mk("p", "hint", "Di «mi día» para tu resumen con los próximos pasos. Di «investiga a fondo …» y Jarvis lo investiga en la nube aunque cierres la app; te avisa cuando esté («mis tareas» para verlas)."));
    s.append(mk("h3", "sub", "Agenda privada"));
    chk(s, "Escoger el contacto cada vez que llamo o escribo (Jarvis no ve toda mi agenda)", !!aj().agendaPrivada, (v) => { aj().agendaPrivada = v; save(); });
    s.append(mk("p", "hint", "Se abre tu agenda para que toques la persona; Jarvis solo recibe ese contacto. Si quitas el permiso de Contactos, Jarvis usa esto solo."));
    s.append(mk("h3", "sub", "Avisos en vivo"));
    const av = mk("p", "hint", "El temporizador, la grabación, las descargas y las tareas largas aparecen arriba en la barra de estado y en la pantalla bloqueada (Android 16 o más nuevo)."); s.append(av);
    const T = plug("Tareas");
    if (T && T.avisos) {
      T.avisos().then((r) => {
        if (!r || !r.soporta) { av.textContent += " Tu celular todavía no los tiene: se ven como notificaciones normales."; return; }
        if (!r.permitidos) av.textContent += " Están desactivados para Jarvis.";
        const b = mk("button", "btn small", r.permitidos ? "Ajustes de los avisos en vivo" : "Activar los avisos en vivo"); b.type = "button";
        b.addEventListener("click", () => T.ajustesAvisos().catch(() => {})); s.append(b);
      }).catch(() => {});
    }
    s.append(mk("h3", "sub", "Volumen de Jarvis"));
    s.append(mk("p", "hint", "En Android 17 la voz de Jarvis tiene su propio volumen, aparte de la música: di «sube el volumen de Jarvis» o «habla más duro». En Android anteriores va con el volumen de la música."));
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const t = L17.tareaIntent(text); if (t) return Object.assign({ t328: "tarea" }, t);
    const v = L17.volumenJarvisIntent(text); if (v) return Object.assign({ t328: "vol" }, v);
    if (L17.miDiaIntent(text)) return { t328: "dia" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.t328) return base.run(it, text);
    if (it.t328 === "tarea") return it.ver ? verTareas() : crearTarea(it.tarea);
    if (it.t328 === "vol") return volumen(it);
    if (it.t328 === "dia") return miDia();
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    if ((D.tareas || []).some((x) => x.estado === "in_progress")) { revisarDesdeAqui(); vigilarAqui(); }
    // las que terminaron con Jarvis cerrado
    (D.tareas || []).filter((t) => t.estado === "completed" && !t.visto).slice(0, 2).forEach((t) => setTimeout(() => mostrar(t), 1500));
    document.addEventListener("visibilitychange", () => { if (!document.hidden && (D.tareas || []).some((x) => x.estado === "in_progress")) revisarDesdeAqui(); });
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Mi día/.test(x[0]))) C.push(["☀️ Mi día, lugares y tareas largas", ["Mi día", "¿Qué restaurantes buenos hay cerca abiertos ahora?", "Investiga a fondo los carros eléctricos en Colombia", "Mis tareas", "Sube el volumen de Jarvis"]]);
  };
  /** Desde una notificación: «tarea:<id>» o «tareas». */
  X._tareas = {
    abrir: async (id) => { await revisarDesdeAqui(); const t = (D.tareas || []).find((x) => x.id === id); if (t && t.estado !== "in_progress") mostrar(t, true); else verTareas(); },
    ver: verTareas, crear: crearTarea, revisar: revisarDesdeAqui,
  };
  X._nov = { miDia, volumen };
})();
