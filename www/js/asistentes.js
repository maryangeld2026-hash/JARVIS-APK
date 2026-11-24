/* Jarvis para Android 3.30 · lo nuevo de los asistentes de 2026, a la manera de Jarvis:
   · Conversación en vivo con Gemini 3.8 Live (y sigue hablando mientras hace la orden) → live.js
   · Dictado ordenado (como Rambler): dictas largo y sale limpio, con párrafos y listas.
   · Widget a tu medida (como «Create My Widget»): lo describes y Jarvis lo arma.
   · Cuidar el celular: espacio, qué apps ven tu ubicación, «silencia todo menos mi familia».
   · Sugerencias desde tus mensajes (citas, direcciones, listas), siempre preguntando.
   · Buscar en tus cosas hablando normal (por palabras y por significado, dentro del celular).
   · Pedidos con el agente hasta antes de pagar · contestador de llamadas por mensaje · Gemini Nano.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L19 = window.JL19, L18 = window.JL18, V = window.JV, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const aj = () => D.ajustes;
  const pick = (t, ops, sp) => X._vida ? X._vida.pick(t, ops, sp) : R(t);
  const docente = () => aj().docente === true;
  const hayIA = () => aj().proveedor === "local" || !!(((aj().claves || {})[aj().proveedor]) || "").trim();
  const claveGemini = () => (((aj().claves || {}).gemini) || "").trim();
  const nombresEst = () => [].concat(...(D.cursos || []).map((c) => c.estudiantes || [])).filter((n) => n && n.length > 3).map((n) => L19.norm(n));
  /** ¿El texto tiene nombres de tus estudiantes? (eso no va a la nube) */
  const conNombres = (t) => { if (!docente()) return false; const x = L19.norm(t); return nombresEst().some((n) => x.includes(n) || (n.split(" ").filter((w) => w.length > 2).length >= 2 && n.split(" ").filter((w) => w.length > 2).every((w) => x.includes(w)))); };
  const sinNombres = (t) => { if (!docente()) return t; const ns = nombresEst(); return String(t).split("\n").filter((l) => !ns.some((n) => L19.norm(l).includes(n))).join("\n"); };
  const copiar = (t) => { try { navigator.clipboard.writeText(t); A.toast("Copiado: pégalo donde quieras."); } catch (e) { A.toast("No pude copiar."); } };

  // ======================================================================== 2. DICTADO ORDENADO
  let dictando = null;
  /** La caja «Te escucho… · Listo» mientras dictas. */
  function cajaDictado(titulo) {
    const { e } = A.add("assistant", titulo, "tool");
    const est = mk("p", "hint", "🎙️ Te escucho… habla con calma: las pausas no cortan. Toca «Listo» cuando termines.");
    const b = mk("button", "btn small", "⏹ Listo"); b.type = "button";
    const c = mk("button", "btn small ghost", "Cancelar"); c.type = "button";
    const fila = mk("div", "row wrap"); fila.append(b, c); e.append(est, fila);
    return { e, est, b, c, fin() { fila.remove(); } };
  }
  async function transcribirGemini(wav, tipo) {
    const key = claveGemini();
    const lista = (IA && IA.rotacion ? IA.rotacion("gemini") : []).slice();
    const primero = L19.modeloTranscribir(lista);
    const orden = [primero].concat(lista.filter((x) => x !== primero)).slice(0, 4);
    let err = null;
    for (const m of orden) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "audio/wav", data: wav } }, { text: L19.promptTranscribir(tipo) }] }], generationConfig: { temperature: 0.2 } }) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { err = new Error((j.error && j.error.message) || "HTTP " + res.status); if (res.status === 400 && /key/i.test(err.message)) break; continue; }
        const t = (((j.candidates || [])[0] || {}).content || {}).parts || [];
        const texto = t.map((p) => p.text || "").join("").trim();
        if (texto) return { texto, modelo: m };
      } catch (e) { err = e; }
    }
    throw err || new Error("Gemini no devolvió el texto.");
  }
  async function dictadoLargo(it) {
    if (dictando) return R("Ya estoy tomando dictado: toca «Listo» cuando termines.");
    const P = plug("Dictado");
    const nube = navigator.onLine && claveGemini() && !docente() && aj().dictadoModo !== "celular" && P && P.grabarAudio;
    const tipo = it.tipo || "texto";
    const caja = cajaDictado(`📝 **Dictado ${tipo === "texto" ? "ordenado" : "de " + tipo}**`);
    dictando = caja;
    let crudo = "", limpio = "", como = "";
    try {
      if (nube) {
        const h = await window.JON(P, "estado", (d) => { if (d && d.s === "habla") caja.est.textContent = "🎙️ Te oigo… sigue; toca «Listo» cuando termines."; });
        caja.b.onclick = () => { P.detener().catch(() => {}); caja.est.textContent = "✍️ Ordenando lo que dijiste…"; };
        caja.c.onclick = () => { P.cancelar().catch(() => {}); };
        let r;
        try { r = await P.grabarAudio({ espera: 15000, silencio: aj().dictadoPausa || 5000, maximo: 240000 }); } finally { if (h && h.remove) h.remove(); }
        if (!r || !r.wav) { caja.fin(); dictando = null; return R("No te oí. Vuelve a intentarlo (habla un poco más cerca)."); }
        caja.est.textContent = `✍️ Ordenando ${Math.round(r.seg)} segundos de dictado…`;
        A.setState("thinking");
        try { const g = await transcribirGemini(r.wav, tipo); limpio = g.texto; como = "Gemini (" + g.modelo + ")"; }
        catch (e) { A.setState("idle"); caja.fin(); dictando = null; return R("Gemini no pudo con el audio: " + (e.message || e) + ". Prueba en Ajustes › Dictado ordenado › «Siempre en el celular».", "err"); }
        A.setState("idle");
      } else {
        // dentro del celular: Whisper si está descargado (sin internet), si no, el reconocimiento de siempre
        const W = window.__whisperVoz;
        if (P && P.escuchar && W && (await P.estado().catch(() => ({}))).listo) {
          caja.b.onclick = () => { P.detener().catch(() => {}); caja.est.textContent = "✍️ Pasando tu voz a texto (dentro del celular)…"; };
          caja.c.onclick = () => { P.cancelar().catch(() => {}); };
          const r = await P.escuchar({ idioma: "es-CO", espera: 15000, silencio: aj().dictadoPausa || 5000, maximo: 180000, pista: "Jarvis" });
          crudo = (r && r.texto) || ""; como = "Whisper (en el celular)";
        } else {
          caja.b.onclick = () => { (V.stopListening || V.cancelListening || (() => {}))(); };
          caja.c.onclick = () => { (V.cancelListening || V.stopListening || (() => {}))(); crudo = ""; };
          caja.est.textContent = "🎙️ Te escucho… (sin el dictado de Whisper, las pausas largas cortan: descárgalo en Ajustes › Voz para dictar largo sin internet).";
          crudo = await V.listen((p) => ($("#live") && ($("#live").textContent = p)), { espera: 20000, silencio: 3500 }).catch(() => "");
          if ($("#live")) $("#live").textContent = "";
          como = "reconocimiento del celular";
        }
        if (!crudo) { caja.fin(); dictando = null; return R("No te oí. Vuelve a intentarlo."); }
        limpio = L19.ordenadoLocal(crudo);
        // la IA lo deja mejor; con nombres de estudiantes, solo la IA del celular
        const local = aj().proveedor === "local";
        if (hayIA() && (navigator.onLine || local) && (!conNombres(crudo) || local)) {
          caja.est.textContent = "✍️ Ordenándolo…"; A.setState("thinking");
          try { const t = await IA.chat({ system: "Eres un corrector de estilo. Devuelves solo el texto final.", messages: [{ role: "user", content: L19.promptOrdenado(crudo, tipo) }], maxTokens: 1500, stream: false }); if (t && t.trim()) { limpio = t.trim().replace(/^["«]|["»]$/g, ""); como += " + IA"; } } catch (e) { /* queda la versión ordenada por reglas */ }
          A.setState("idle");
        }
      }
    } catch (e) { A.setState("idle"); caja.fin(); dictando = null; return R(e.message || String(e), "err"); }
    caja.fin(); dictando = null;
    caja.est.textContent = `✅ Listo (${como}).`;
    (D.dictados = D.dictados || []).unshift({ t: Date.now(), tipo, texto: limpio }); D.dictados = D.dictados.slice(0, 20); save();
    pick("✍️ " + limpio, [["📋 Copiar", () => copiar(limpio)], ["📤 Compartir", () => window.JN.share({ title: "Dictado", text: limpio }).catch(() => {})],
      ["📄 Guardar en Material", () => { (D.docs = D.docs || []).unshift({ id: window.JD.uid(), titulo: (tipo === "texto" ? "Dictado" : tipo[0].toUpperCase() + tipo.slice(1)) + " · " + new Date().toLocaleDateString("es-CO"), md: limpio, fecha: Date.now() }); save(); A.toast("Guardado en Material."); }]], false);
  }

  // ======================================================================== 3. WIDGET A TU MEDIDA
  async function textoFuente(k) {
    try {
      if (k === "clase") { const J3 = window.JL3; return J3 && aj().horario ? J3.classNowSpoken(J3.parseSchedule(aj().horario)) : "Sin horario (escríbelo en Ajustes › Horario)."; }
      if (k === "tareas") { const l = (D.tareas || []).slice(0, 4); return l.length ? l.map((t) => `${t.estado === "in_progress" ? "⏳" : t.estado === "completed" ? "✅" : "⚠️"} ${t.titulo}`).join("\n") : "Sin investigaciones."; }
      if (k === "agenda") {
        const C = plug("Calendario"); if (!C) return "Sin calendario.";
        const h0 = new Date(); h0.setHours(0, 0, 0, 0);
        const r = await C.eventos({ desde: h0.getTime(), hasta: h0.getTime() + 864e5 }).catch(() => null);
        const l = ((r && r.lista) || []).filter((e) => e.inicio >= Date.now() - 3600e3).slice(0, 5);
        return l.length ? l.map((e) => `📅 ${new Date(e.inicio).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })} ${e.titulo}`).join("\n") : "Nada más en tu agenda hoy.";
      }
      return X._agente && X._agente.widgetTexto ? X._agente.widgetTexto(k) : "";
    } catch (e) { return ""; }
  }
  async function widgetPintar(fijar) {
    const s = aj().widgetSpec; if (!s || aj().widgetFuente) return null;
    const P = plug("Disparadores"); if (!P || !P.widgetDatos) return null;
    const textos = {};
    for (const b of s.bloques) if (b.fuente) textos[b.fuente] = await textoFuente(b.fuente);
    const texto = L19.widgetRender(s, (k) => textos[k], Date.now());
    const orden = s.orden && (!window.JL7 || !window.JL7.ordenSegura || window.JL7.ordenSegura(s.orden)) ? s.orden : "";
    try { return await P.widgetDatos({ titulo: s.titulo, texto, cmd: orden, fijar: !!fijar }); } catch (e) { return null; }
  }
  async function widgetLibre(desc) {
    let s = L19.widgetLocal(desc, Date.now());
    const necesitaIA = !s || /\b(?:y|con|que|donde)\b.*\b(?:frase|mensaje|motiva|texto)\b/.test(L19.norm(desc));
    if (necesitaIA && hayIA()) {
      A.setState("thinking");
      try { const j = await IA.json({ system: "Diseñas widgets simples. Respondes solo JSON.", messages: [{ role: "user", content: L19.widgetPrompt(sinNombres(desc), new Date().toISOString().slice(0, 10)) }], maxTokens: 400, temperature: 0.3 }); const v = L19.specValida(j); if (v) s = v; else if (j && j.error && !s) { A.setState("idle"); return R("🧩 " + j.error); } }
      catch (e) { /* queda lo que se entendió sin IA */ }
      A.setState("idle");
    }
    if (!s) return R(`🧩 No entendí qué poner en el widget. Puedo mostrar: ${Object.keys(L19.FUENTES).map(L19.nombreFuente).join(", ").toLowerCase()}, una cuenta regresiva («cuenta regresiva para vacaciones el 12 de diciembre») o una frase fija.`);
    aj().widgetSpec = s; aj().widgetFuente = ""; save();
    const r = await widgetPintar(true);
    const vista = L19.widgetRender(s, () => "…", Date.now());
    return R(`🧩 **Listo tu widget «${s.titulo}»:**\n\n${vista}\n\n${r && r.fijado ? "Android te pregunta dónde ponerlo." : "Para ponerlo: mantén presionada la pantalla de inicio › Widgets › Jarvis › «Jarvis a la carta»."} Se actualiza cada vez que sales de Jarvis.`);
  }

  // ======================================================================== 4. CUIDAR EL CELULAR
  async function celular(it) {
    const C = plug("Celular"); if (!C) return R("Eso funciona en el celular (la app instalada).", "err");
    if (it.cel === "espacio") {
      let r; try { r = await C.espacio(); } catch (e) { return R(e.message, "err"); }
      const ops = [["🧹 Liberar espacio de Android", () => C.liberar().catch(() => {})]];
      if (r.cache > 30 * 1048576) ops.push(["Borrar temporales de Jarvis", async () => { const x = await C.borrarCache().catch(() => ({})); A.toast(`Liberé ${L19.gb(x.liberado || 0)}.`); }]);
      if ((r.jarvis || []).some((x) => x.bytes > 100 * 1048576)) ops.push(["Ver modelos de Jarvis", () => A.dispatch("abre ajustes")]);
      return pick(L19.espacioTexto(r), ops, false);
    }
    if (it.cel === "permisos") {
      let r; try { r = await C.permisos({ p: it.p }); } catch (e) { return R(e.message, "err"); }
      const l = (r.lista || []);
      return pick(L19.permisosTexto(l, it.p), l.slice(0, 10).map((x) => [`${x.fondo ? "⚠️ " : ""}${x.nombre}`, () => C.abrirApp({ paquete: x.paquete }).catch(() => {})]), `${l.length} apps pueden usar ${(L19.PERMISOS[it.p] || [0, ""])[1]}. Están en la pantalla.`);
    }
    if (it.cel === "silencio") {
      if (it.quien === "favoritos") { const f = await C.favoritos().catch(() => ({ n: -1 })); if (f.n === 0) R("⭐ Ojo: no tienes contactos marcados como favoritos. En tu app de Contactos, toca la estrella ⭐ de tu familia para que sus llamadas entren."); }
      let r; try { r = await C.silencio({ quien: it.quien, min: it.min || 0, repetidas: !!it.repetidas }); } catch (e) { return R(e.message, "err"); }
      if (!r.permiso) return R("🔕 Para ponerlo necesito el permiso de «No molestar»: te abrí el ajuste. Activa a Jarvis y repíteme la orden.", "err");
      aj().silencioJarvis = Date.now() + (it.min ? it.min * 60000 : 12 * 3600e3); save();
      const quien = it.quien === "favoritos" ? "tus favoritos ⭐" : it.quien === "contactos" ? "tus contactos" : "nadie (solo las alarmas)";
      return R(`🔕 Listo: el celular queda en silencio y solo entran las llamadas de ${quien}${it.repetidas ? ", y quien insista llamando dos veces" : ""}. Las alarmas siempre suenan.${it.min ? ` Vuelve a la normalidad en ${it.min >= 60 ? (it.min / 60).toString().replace(".", ",") + " h" : it.min + " min"}.` : " Di «quita el silencio» para volver a la normalidad."}`);
    }
    if (it.cel === "fin") { await C.quitarSilencio().catch(() => {}); aj().silencioJarvis = 0; save(); return R("🔔 Listo, el celular vuelve a sonar como antes."); }
  }

  // ======================================================================== 5. SUGERENCIAS DESDE TUS MENSAJES
  async function sugerencias(it) {
    const M = plug("Mensajes"); if (!M) return R("Eso funciona en el celular.", "err");
    if (it.sg === "on" || it.sg === "off") {
      aj().sugerenciasNoti = it.sg === "on"; save();
      await M.config({ sugerencias: it.sg === "on" }).catch(() => {});
      let falta = ""; if (it.sg === "on") { try { if (!(await M.activo()).activo) { falta = " Para leer tus mensajes necesito el «Acceso a notificaciones»: te abro el ajuste."; setTimeout(() => M.permiso(), 1500); } } catch (e) { /* nada */ } }
      return R(it.sg === "on" ? `💡 Listo: si te llega un mensaje con una cita y su hora, una dirección o una lista de compras, te aviso en silencio y, al tocarlo, te ofrezco agendarlo, cómo llegar o agregarlo a la lista. Nunca lo hago solo, y todo se revisa dentro del celular.${falta}` : "Listo, ya no te sugiero nada desde tus mensajes.");
    }
    let r; try { r = await M.recientes({ desde: Date.now() - 24 * 3600e3 }); } catch (e) { return R("Para eso necesito el «Acceso a notificaciones».", "err"); }
    const vistas = new Set(), ops = [];
    ((r && r.lista) || []).slice().reverse().forEach((m) => L19.sugerir({ app: m.app, titulo: m.de, texto: m.texto }).forEach((s) => { if (!vistas.has(s.orden) && ops.length < 6) { vistas.add(s.orden); ops.push([s.etiqueta, () => A.dispatch(s.orden)]); } }));
    if (!ops.length) return R("💡 No veo citas, direcciones ni listas de compras en tus mensajes de hoy.");
    return pick(`💡 **De tus mensajes de hoy puedo:** (toca lo que quieras; nada se hace sin que lo toques)`, ops.concat([["Nada, gracias", () => {}]]), `Tengo ${ops.length} sugerencias de tus mensajes. Están en la pantalla.`);
  }

  // ======================================================================== 6. BUSCAR EN TUS COSAS
  function fuentes() {
    const f = [];
    (D.docs || []).forEach((d) => f.push({ titulo: d.titulo, texto: d.md || "", t: d.fecha, tipo: "📄 Material" }));
    (D.memoria || []).forEach((m) => f.push({ titulo: "Lo que sé de ti", texto: m.texto, tipo: "🧠 Memoria" }));
    (D.compromisos || []).forEach((c) => f.push({ titulo: "Compromiso", texto: c.texto, t: c.t, tipo: "🤝 Compromiso" }));
    (D.recordatorios || []).forEach((r) => f.push({ titulo: "Recordatorio", texto: `${r.texto} (${new Date(r.cuando).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })})`, t: r.cuando, tipo: "⏰ Recordatorio" }));
    Object.entries(D.listas || {}).forEach(([k, l]) => f.push({ titulo: "Lista " + k, texto: (l.items || []).map((x) => x.t).join(", "), tipo: "🛒 Lista" }));
    (D.dictados || []).forEach((d) => f.push({ titulo: "Dictado " + new Date(d.t).toLocaleDateString("es-CO"), texto: d.texto, t: d.t, tipo: "📝 Dictado" }));
    (D.tareas || []).filter((t) => t.texto).forEach((t) => f.push({ titulo: "Investigación: " + t.titulo, texto: t.texto, t: t.t, tipo: "🔎 Investigación" }));
    if (docente()) (D.diario || []).forEach((x) => f.push({ titulo: "Diario de " + x.curso, texto: x.texto, t: x.t, tipo: "🏫 Diario" }));
    const convs = [{ nombre: (D.convAct || {}).nombre || "General", chat: D.chat }].concat(D.convs || []);
    convs.forEach((c) => (c.chat || []).forEach((m) => { if (m.role === "user" && String(m.content || "").length > 25 && !/^(?:busca|donde|según mis notas)/i.test(m.content)) f.push({ titulo: "Conversación «" + c.nombre + "»", texto: m.content, t: m.t, tipo: "💬 Conversación" }); }));
    return f;
  }
  async function buscar(it) {
    const B = plug("Buscador");
    if (it.activar) return activarBusqueda();
    const q = it.bq;
    const tr = L19.trozos(fuentes(), 3000);
    const porId = {}; tr.forEach((x) => (porId[x.id] = x));
    let palabras = L19.porPalabras(tr, q, 20), sig = [], nota = "";
    if (B) {
      const st = await B.estado().catch(() => ({}));
      if (st.listo && st.motor !== false) {
        A.setState("thinking");
        const h = await window.JON(B, "indexando", (d) => { if (d && d.total > 20) A.toast(`Leyendo tus cosas para buscar por significado… ${Math.round(d.hechos / d.total * 100)} %`, 1500); });
        try {
          await B.indexar({ items: tr.map((x) => ({ id: x.id, texto: L19.docEmb(x.titulo, x.texto) })) });
          const r = await B.buscar({ q: L19.consultaEmb(q), n: 20 });
          const l = (r && r.lista) || []; const mejor = l.length ? l[0].p : 0;
          sig = l.filter((x) => x.p >= 0.3 && x.p >= mejor - 0.12).map((x) => x.id);
        } catch (e) { nota = " (la búsqueda por significado falló: " + (e.message || e) + ")"; }
        finally { if (h && h.remove) h.remove(); A.setState("idle"); }
      } else if (!aj().busquedaAviso) { aj().busquedaAviso = true; save(); nota = "\n\n_Para encontrar cosas aunque uses otras palabras, activa la búsqueda por significado: di «activa la búsqueda por significado» (unos 280 MB, funciona sin internet)._"; }
    }
    const ids = L19.fusionar(palabras, sig, 6).filter((id) => porId[id]);
    const ops = [];
    // apps y ajustes del celular que se llamen así
    L19.ajustesSis(q).forEach((x) => { const C = plug("Celular"); if (C) ops.push([`⚙️ Abrir ${x.titulo}`, () => C.abrirAjuste({ accion: x.accion }).catch(() => {})]); });
    const T = plug("Telefono");
    if (T && T.apps && q.trim().split(/\s+/).length <= 3) { try { const l = ((await T.apps()) || {}).lista || []; const a = window.JL5 && window.JL5.appMatch(q, l); if (a) ops.push([`📱 Abrir ${a.nombre || a.etiqueta || "la app"}`, () => T.abrirApp({ paquete: a.paquete }).catch(() => {})]); } catch (e) { /* nada */ } }
    if (aj().fotosOn) ops.push([`📸 Buscar «${q}» en mis fotos`, () => A.dispatch(`busca la foto de ${q}`)]);
    if (!ids.length) return ops.length ? pick(`🔎 No encontré «${q}» en tus notas, documentos ni conversaciones.${nota}`, ops) : R(`🔎 No encontré «${q}» en tus notas, documentos, recordatorios ni conversaciones.${nota}`);
    const res = ids.map((id) => porId[id]);
    const txt = `🔎 **Encontré esto sobre «${q}»:**\n` + res.map((x) => `- **${x.tipo}** · ${x.titulo}${x.t ? " · " + new Date(x.t).toLocaleDateString("es-CO") : ""}\n  ${x.texto.slice(0, 200).replace(/\n+/g, " ")}${x.texto.length > 200 ? "…" : ""}`).join("\n") + nota;
    const conIA = hayIA() && (navigator.onLine || aj().proveedor === "local");
    if (conIA) ops.unshift(["💬 Respóndeme con esto", () => {
      const ctx = res.map((x, i) => `[${i + 1}] (${x.tipo} · ${x.titulo}) ${sinNombres(x.texto).slice(0, 1200)}`).filter((l) => l.length > 30).join("\n\n");
      const p = `Responde mi pregunta SOLO con base en estos fragmentos de mis cosas; si no está ahí, dímelo. Di de dónde sale (entre paréntesis).\n\nPregunta: ${q}\n\nFragmentos:\n${ctx}`;
      return A.askAI ? A.askAI(p) : A.dispatch(p);
    }]);
    return pick(txt, ops, `Encontré ${res.length} cosas sobre ${q}. Están en la pantalla.`);
  }
  /** Para la memoria de largo plazo (pro.js): suma lo que se parece por significado a lo que encontró por palabras. */
  async function semantico(E, q, r, max, ventana) {
    const B = plug("Buscador"); if (!B) return r;
    const st = await B.estado().catch(() => ({})); if (!st.listo || st.motor === false) return r;
    let items = L19.deMemoria(E, 2500);
    if (ventana) items = items.filter((x) => !x.item.t || (x.item.t >= ventana.desde && x.item.t < ventana.hasta));
    const porId = {}; items.forEach((x) => (porId[x.id] = x));
    const h = await window.JON(B, "indexando", (d) => { if (d && d.total > 20) A.toast(`Leyendo tu memoria para buscar por significado… ${Math.round(d.hechos / d.total * 100)} %`, 1500); });
    let sig = [];
    try {
      await B.indexar({ items: L19.deMemoria(E, 2500).map((x) => ({ id: x.id, texto: L19.docEmb(x.titulo, x.texto) })) });
      const l = ((await B.buscar({ q: L19.consultaEmb(q), n: 20 })) || {}).lista || [];
      const mejor = l.length ? l[0].p : 0;
      sig = l.filter((x) => porId[x.id] && x.p >= 0.3 && x.p >= mejor - 0.12).map((x) => x.id);
    } finally { if (h && h.remove) h.remove(); }
    if (!sig.length) return r;
    const idDe = (x) => L19.hash(x.fuente + "|" + (x.de || "") + "|" + x.texto);
    const deR = {}; (r || []).forEach((x) => (deR[idDe(x)] = x));
    return L19.fusionar((r || []).map(idDe), sig, max || 10).map((id) => deR[id] || (porId[id] && porId[id].item)).filter(Boolean);
  }
  const EMB_REPOS = ["ggml-org/embeddinggemma-300M-qat-q4_0-GGUF", "ggml-org/embeddinggemma-300M-GGUF", "unsloth/embeddinggemma-300m-GGUF"];
  async function urlModeloBusqueda() {
    for (const repo of EMB_REPOS) {
      try {
        const r = await fetch(L18.urlArbol(repo)); if (!r.ok) continue;
        const a = L18.archivosGguf(await r.json()).filter((x) => x.mb > 50 && x.mb < 700);
        const f = a.find((x) => x.cuant === "Q4_0") || a.find((x) => x.cuant === "Q8_0") || L18.recomendado(a);
        if (f) return { url: L18.urlArchivo(repo, f.archivo), nombre: f.archivo.split("/").pop(), mb: f.mb };
      } catch (e) { /* el siguiente */ }
    }
    throw new Error("No encontré el modelo de búsqueda en Hugging Face (¿sin internet?).");
  }
  async function activarBusqueda(barra) {
    const B = plug("Buscador"); if (!B) return R("Eso funciona en el celular (la app instalada).", "err");
    const st = await B.estado().catch(() => ({}));
    if (st.listo) return R(`🔎 La búsqueda por significado ya está lista (${st.mb} MB, ${st.n} trozos leídos). Di «busca en mi celular …» o «¿dónde guardé …?».`);
    if (!navigator.onLine) return R("Para bajar el modelo de búsqueda necesito internet (una sola vez).", "err");
    let m; try { m = await urlModeloBusqueda(); } catch (e) { return R(e.message, "err"); }
    R(`🔎 Bajo el modelo de búsqueda (EmbeddingGemma, ${m.mb} MB). Después todo funciona sin internet y nada sale del celular.`);
    const h = await window.JON(B, "progreso", (d) => { if (!d) return; if (barra) barra.textContent = `Bajando… ${d.p >= 0 ? d.p + " %" : d.mb + " MB"}`; else if (d.p % 10 === 0) A.toast(`Modelo de búsqueda: ${d.p} %`, 1200); });
    try { await B.descargar({ url: m.url, nombre: m.nombre }); } catch (e) { return R("No pude bajarlo: " + (e.message || e), "err"); } finally { if (h && h.remove) h.remove(); }
    if (barra) barra.textContent = "✅ Lista";
    return R("✅ Lista la búsqueda por significado. Prueba: «¿dónde guardé lo de la salida al museo?».");
  }

  // ======================================================================== CONTESTADOR Y GEMINI NANO
  async function contestador(it) {
    const T = plug("Telefono"); if (!T || !T.contestador) return R("Eso funciona en el celular.", "err");
    if (it.cont === "off") { await T.contestador({ on: false }).catch(() => {}); aj().contestador = false; save(); return R("Listo, quité el contestador: ya no respondo las llamadas silenciadas."); }
    const texto = it.texto || L19.contestadorTexto((aj().nombre || "").split(" ")[0]);
    const r = await T.contestador({ on: true, texto }).catch((e) => ({ error: e.message }));
    if (!r || !r.sms) return R("📵 Sin el permiso de mensajes de texto (SMS) no puedo contestar. Si cambias de idea, repite la orden y acepta el permiso.", "err");
    aj().contestador = true; aj().contestadorTexto = texto; save();
    const ll = aj().llamadas || {};
    if (!ll.modo || ll.modo === "off") { if (X._agente && X._agente.llamadas) await X._agente.llamadas({ llamadas: "silenciar" }); }
    return R(`📵 **Contestador activo.** Cuando te llame un número que no está en tus contactos, su llamada entra en silencio y le mando este mensaje (una vez cada 12 horas por número):\n\n«${texto}»\n\nTus contactos suenan normal. Di «quita el contestador» para apagarlo.\n\n_Android no deja que una app conteste la llamada hablando (eso solo lo hace la app de Teléfono del fabricante, como el filtro de llamadas de Pixel): por eso Jarvis responde por mensaje._`);
  }
  async function nano(it) {
    const P = plug("IALocal"); if (!P || !P.nanoEstado) return R("Eso funciona en el celular.", "err");
    const st = await P.nanoEstado().catch(() => ({ estado: "no" }));
    if (it.nano === "ver" || st.estado === "no") return R(L19.NANO_ESTADO[st.estado] || L19.NANO_ESTADO.no);
    R(L19.NANO_ESTADO[st.estado]);
    const h = await window.JON(P, "progreso", (d) => { if (d && d.mb) A.toast(`Android baja Gemini Nano… ${d.mb} MB`, 1200); });
    try { await P.nanoPreparar(); } catch (e) { return R(e.message || String(e), "err"); } finally { if (h && h.remove) h.remove(); }
    return R("✅ Gemini Nano queda como la IA del celular (sin internet). Para usarla siempre, escoge «IA del celular» en Ajustes › Inteligencia artificial; si no, entra cuando no hay internet. Ojo: Android limita cuántas preguntas por minuto le hace cada app.");
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-330")) return;
    const s = mk("div"); s.id = "aj-330";
    const chk = (cont, label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); cont.append(l); return i; };
    const boton = (cont, t, fn, cls) => { const b = mk("button", "btn small" + (cls ? " " + cls : ""), t); b.type = "button"; b.addEventListener("click", fn); cont.append(b); return b; };

    s.append(mk("h3", "sub", "Gemini en vivo"));
    const sel = mk("select", "inp"); sel.append(new Option("Automático: el más nuevo de tu cuenta (Gemini 3.8 Live)", ""));
    const ponModelos = (l) => l.forEach((m) => { if (![...sel.options].some((o) => o.value === m)) sel.append(new Option(m, m)); });
    ponModelos([aj().liveModelo].filter(Boolean).concat(X._live && X._live.modelos ? X._live.modelos() : []));
    sel.value = aj().liveModelo || ""; sel.addEventListener("change", () => { aj().liveModelo = sel.value; save(); });
    s.append(sel);
    if (X._live && X._live.liveModel && claveGemini()) { const k = claveGemini(); const viejo = aj().liveModelo; aj().liveModelo = ""; X._live.liveModel(k).then(() => ponModelos(X._live.modelos())).catch(() => {}).finally(() => { aj().liveModelo = viejo; }); }
    chk(s, "Pensar más antes de responder (Extended Thinking: más lento, para preguntas difíciles)", !!aj().livePensar, (v) => { aj().livePensar = v; save(); });
    chk(s, "Seguir conversando mientras Jarvis hace lo que le pides", aj().liveAsinc !== false, (v) => { aj().liveAsinc = v; aj().liveSinAsinc = ""; save(); });
    s.append(mk("p", "hint", "Toca el orbe y habla. Con Gemini 3.8 Live puedes interrumpirlo y pedirle cosas («pon 10 minutos», «recuérdame…») sin que se quede callado esperando."));

    s.append(mk("h3", "sub", "Dictado ordenado"));
    const sd = mk("select", "inp");
    [["auto", "Con Gemini si hay internet (mejor); si no, en el celular"], ["celular", "Siempre dentro del celular (Whisper + IA del celular)"]].forEach(([v, t]) => sd.append(new Option(t, v)));
    sd.value = aj().dictadoModo || "auto"; sd.addEventListener("change", () => { aj().dictadoModo = sd.value; save(); }); s.append(sd);
    const sp = mk("select", "inp");
    [[3000, "Termina tras 3 s de silencio"], [5000, "Termina tras 5 s de silencio"], [8000, "Termina tras 8 s de silencio (pensando en voz alta)"]].forEach(([v, t]) => sp.append(new Option(t, v)));
    sp.value = String(aj().dictadoPausa || 5000); sp.addEventListener("change", () => { aj().dictadoPausa = +sp.value; save(); }); s.append(sp);
    s.append(mk("p", "hint", "Di «dictado ordenado» o «toma dictado de un acta» y habla como te salga: Jarvis quita las muletillas («eh», «este»), lo que corriges («el martes, perdón, el miércoles») y lo deja en párrafos y listas. También entiende «punto y aparte» y «nueva línea». En modo docente el audio nunca va a la nube (puede tener nombres de estudiantes)."));

    s.append(mk("h3", "sub", "Búsqueda por significado"));
    const eb = mk("p", "hint", "Busca en tus notas, documentos, dictados, recordatorios y conversaciones aunque uses otras palabras («¿dónde guardé lo del paseo?» encuentra «salida pedagógica»). Usa un modelo pequeño dentro del celular (EmbeddingGemma, unos 280 MB): nada sale del celular."); s.append(eb);
    const fb = mk("div", "row wrap"); s.append(fb);
    const B = plug("Buscador");
    if (B) B.estado().then((st) => {
      const barra = mk("span", "hint", st.listo ? `✅ Lista · ${st.mb} MB · ${st.n} trozos leídos` : "No descargada.");
      if (!st.listo) boton(fb, "Descargar (≈280 MB)", () => activarBusqueda(barra));
      else boton(fb, "Borrar", async () => { await B.borrar().catch(() => {}); barra.textContent = "Borrada."; }, "ghost");
      fb.append(barra);
    }).catch(() => {});

    s.append(mk("h3", "sub", "Gemini Nano"));
    const gn = mk("p", "hint", "Algunos celulares de gama alta traen Gemini Nano, la IA de Google dentro del celular: no ocupa espacio de Jarvis y responde sin internet."); s.append(gn);
    const P = plug("IALocal");
    if (P && P.nanoEstado) P.nanoEstado().then((r) => {
      gn.textContent += " " + (L19.NANO_ESTADO[r.estado] || "").replace(/^\S+\s/, "") + (r.activo ? " (es la IA del celular ahora)." : "");
      if (r.estado !== "no" && !r.activo) { const f = mk("div", "row wrap"); boton(f, "Usar Gemini Nano", () => nano({ nano: "usar" })); gn.after(f); }
    }).catch(() => {});

    s.append(mk("h3", "sub", "Cuidar el celular"));
    s.append(mk("p", "hint", "Di «libera espacio», «¿qué apps ven mi ubicación?» (o el micrófono, la cámara, tus contactos), «silencia todo menos las llamadas de mi familia por 2 horas» o «quita el silencio». Jarvis te muestra y abre el ajuste; no cambia permisos ni borra nada por ti."));

    s.append(mk("h3", "sub", "Sugerencias de tus mensajes"));
    chk(s, "Avisarme cuando un mensaje traiga una cita, una dirección o una lista de compras", !!aj().sugerenciasNoti, (v) => sugerencias({ sg: v ? "on" : "off" }));
    s.append(mk("p", "hint", "Se revisa dentro del celular (nada va a la nube). El aviso no suena; al tocarlo te ofrece agendar, cómo llegar o agregar a la lista. Nunca lo hace solo. No mira códigos, claves ni mensajes de bancos."));

    s.append(mk("h3", "sub", "Contestador de llamadas"));
    const ct = mk("textarea", "inp"); ct.rows = 2; ct.value = aj().contestadorTexto || L19.contestadorTexto((aj().nombre || "").split(" ")[0]);
    ct.addEventListener("change", () => { aj().contestadorTexto = ct.value.trim(); save(); if (aj().contestador) { const T = plug("Telefono"); if (T && T.contestador) T.contestador({ on: true, texto: aj().contestadorTexto }).catch(() => {}); } });
    chk(s, "Responder por mensaje a los números desconocidos que silencio", !!aj().contestador, (v) => contestador(v ? { cont: "on", texto: ct.value.trim() } : { cont: "off" }));
    s.append(ct);
    s.append(mk("p", "hint", "Android no deja que una app conteste la llamada hablando (solo la app de Teléfono del fabricante). Jarvis silencia la llamada de quien no está en tus contactos y le manda este SMS, una vez cada 12 horas por número."));

    s.append(mk("h3", "sub", "Widget a tu medida"));
    s.append(mk("p", "hint", "Di «crea un widget con mi próxima clase y la cuenta regresiva para vacaciones el 12 de diciembre» o «…con mis pagos y mis recordatorios». Jarvis lo arma con tus datos (la IA solo propone qué mostrar; nunca se ejecuta nada de la IA)."));
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    if (dictando && /^(?:listo|termine|ya termine|fin del dictado)$/.test(L19.norm(text))) return { a330: "dl_fin" };
    const dl = L19.dictadoLargoIntent(text); if (dl) return { a330: "dl", it: dl };
    const pe = L19.pedidoIntent(text); if (pe) return { a330: "pedido", it: pe };
    const wl = L19.widgetLibreIntent(text);
    if (wl) { const w0 = window.JL10 && window.JL10.widgetIntent(text); if (!(w0 && w0.widget && w0.widget !== "desconocido" && w0.widget !== "off" && !/\by\b|cuenta|faltan|frase/.test(L19.norm(wl.wl)))) return { a330: "widget", it: wl }; }
    const ce = L19.celularIntent(text); if (ce) return { a330: "cel", it: ce };
    if (aj().silencioJarvis > Date.now() && /^(?:quita|desactiva|apaga)\s+(?:el\s+)?(?:silencio|no molestar|modo silencio)$/.test(L19.norm(text))) return { a330: "cel", it: { cel: "fin" } };
    const sg = L19.sugerenciasIntent(text); if (sg) return { a330: "sug", it: sg };
    const bq = L19.buscarIntent(text); if (bq) return { a330: "buscar", it: bq };
    const co = L19.contestadorIntent(text); if (co) return { a330: "cont", it: co };
    const na = L19.nanoIntent(text); if (na) return { a330: "nano", it: na };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.a330) return base.run(it, text);
    switch (it.a330) {
      case "dl": return dictadoLargo(it.it);
      case "dl_fin": { const P = plug("Dictado"); if (P) P.detener().catch(() => {}); return; }
      case "pedido": return X._agente ? X._agente.agente(it.it.app, it.it.meta) : R("El agente funciona en el celular.", "err");
      case "widget": return widgetLibre(it.it.wl);
      case "cel": return celular(it.it);
      case "sug": return sugerencias(it.it);
      case "buscar": return buscar(it.it);
      case "cont": return contestador(it.it);
      case "nano": return nano(it.it);
    }
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    document.addEventListener("visibilitychange", () => { if (document.hidden && aj().widgetSpec && !aj().widgetFuente) widgetPintar(false); });
    if (aj().silencioJarvis && aj().silencioJarvis < Date.now()) { aj().silencioJarvis = 0; save(); }
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Dictado ordenado/.test(x[0]))) C.push(["📝 Dictado ordenado, widgets y cuidar el celular", ["Dictado ordenado", "Toma dictado de un acta", "Crea un widget con la cuenta regresiva para vacaciones el 12 de diciembre", "Libera espacio", "¿Qué apps ven mi ubicación?", "Silencia todo menos las llamadas de mi familia", "¿Dónde guardé lo de la salida al museo?", "Sugerencias de mis mensajes", "Pídeme un domicilio de hamburguesa", "Activa el contestador de llamadas", "¿Tengo Gemini Nano?"]]);
  };
  X._a330 = { semantico, dictadoLargo, widgetLibre, widgetPintar, celular, sugerencias, buscar, activarBusqueda, contestador, nano, fuentes };
})();
