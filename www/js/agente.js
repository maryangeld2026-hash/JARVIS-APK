/* Jarvis para Android 3.11 · nivel agente.
   Jarvis maneja tus apps (paso a paso, y te deja a ti pagar o confirmar) · actuar sobre lo que ves · visión en vivo ·
   sugerencias que aprende · estafas · respuestas automáticas · filtro de llamadas · memoria fotográfica ·
   «¿qué hice el…?» · dictado pulido · widget a la carta · presentaciones por voz.
   Batería: el agente solo trabaja mientras le pediste algo; fotos solo cargando; estafas, respuestas y llamadas las avisa Android.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L10 = window.JL10, L9 = window.JL9, L8 = window.JL8, L7 = window.JL7, V = window.JV, IA = window.JIA, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const plug = (n) => (V.native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const pick = (t, ops, sp) => X._vida.pick(t, ops, sp);
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const docente = () => D.ajustes.docente === true;
  const sinNombres = (t) => { if (!docente()) return t; const ns = [].concat(...D.cursos.map((c) => c.estudiantes || [])).filter((n) => n.length > 3).map((n) => L10.norm(n)); return String(t).split("\n").filter((l) => !ns.some((n) => L10.norm(l).includes(n))).join("\n"); };
  const hayIA = () => D.ajustes.proveedor === "local" || !!((D.ajustes.claves || {})[D.ajustes.proveedor] || "").trim();

  // ======================================================================== AGENTE QUE MANEJA TUS APPS
  let ag = null;                                               // {app, meta, hechos, paso, preguntando}
  async function avisoAgente(t) { const LN = plug("LocalNotifications"); if (LN) { try { await LN.schedule({ notifications: [{ id: 781000, title: "🤖 Jarvis trabajando", body: t, schedule: { at: new Date(Date.now() + 200) } }] }); } catch (e) { /* nada */ } } }
  async function abrirApp(nombre) {
    const T = plug("Telefono"); if (!T) throw new Error("Esto funciona en el celular.");
    const l = ((await T.apps()) || {}).lista || [];
    const a = window.JL5.appMatch(nombre, l);
    if (!a) throw new Error(`No encontré ${nombre} instalada en tu celular.`);
    await T.abrirApp({ paquete: a.paquete });
    return a;
  }
  async function agente(app, meta, seguir) {
    const T = plug("Telefono");
    if (!T || !T.agenteUi) return R("El agente funciona en el celular.", "err");
    if (!hayIA()) return R("Para manejar apps necesito la IA: pon tu clave en Ajustes.", "err");
    try { await T.agenteUi(); } catch (e) {
      return pick("Para manejar tus apps necesito el control por voz de Jarvis (Accesibilidad). Si ya lo tenías, apágalo y vuelve a prenderlo: en esta versión puede tocar botones.", [["Abrir el ajuste", () => T.abrirAccesibilidad && T.abrirAccesibilidad()]]);
    }
    if (!seguir) {
      ag = { app, meta, hechos: [], paso: 0 };
      R(`🤖 Voy a hacerlo en **${app}**: «${meta}». Me verás trabajar; si vuelves a Jarvis, me detengo. Nunca pago, confirmo ni envío por ti: eso lo tocas tú.`, "tool", `Listo, lo hago en ${app}. Si vuelves a Jarvis, me detengo.`);
      await V.idle();
    }
    try { await abrirApp(app); } catch (e) { ag = null; return R(e.message, "err"); }
    ag.corriendo = true;
    let ultimo = "", repes = 0, fin = null;
    try {
      while (ag && ag.corriendo && ag.paso < 20) {
        await espera(ag.paso === 0 ? 2500 : 1600);
        if (!ag || !ag.corriendo) return;
        let ui; try { ui = await T.agenteUi(); } catch (e) { fin = "Perdí el control de la pantalla."; break; }
        const nodos = (ui && ui.nodos) || [];
        if (ui && ui.pkg === "co.jarvis.docente") { fin = "Me detuve porque volviste a Jarvis."; break; }
        ag.paso++;
        avisoAgente(`Paso ${ag.paso} en ${app}…`);
        let a;
        try { a = await IA.json({ system: "Eres un agente cuidadoso que maneja apps de Android por la persona. Respondes solo JSON.", messages: [{ role: "user", content: L10.agentePrompt(ag.meta, app, sinNombres(L10.uiTexto(nodos)), ag.hechos.slice(-8)) }], maxTokens: 300, temperature: 0.2 }); }
        catch (e) { fin = "La IA no respondió: " + (e.message || e); break; }
        const ok = L10.accionOk(a, nodos);
        if (ok.error) { ag.hechos.push("(error: " + ok.error + ")"); if (++repes >= 3) { fin = "No pude seguir: " + ok.error; break; } continue; }
        if (ok.alto) { fin = `✋ Llegué hasta «${ok.n.t}». Revisa y tócalo tú si todo está bien.`; ag.alto = true; break; }
        if (ok.accion === "listo") { fin = ok.resumen || "Listo."; break; }
        if (ok.accion === "preguntar") { ag.preguntando = ok.pregunta; ag.corriendo = false; await T.volverAJarvis(); await espera(600); R("🤖 " + ok.pregunta); V.idle().then(() => A.listen(true)); return; }
        const firma = ok.accion + ":" + (ok.i != null ? ok.i : "") + ":" + (ok.texto || "");
        repes = firma === ultimo ? repes + 1 : 0; ultimo = firma;
        if (repes >= 2) { fin = "Me quedé dando vueltas en la misma pantalla. Mejor sigue tú desde aquí."; break; }
        let r = { ok: false };
        if (ok.accion === "esperar") { await espera(2000); r.ok = true; }
        else r = await T.agenteAccion({ accion: ok.accion, i: ok.i, texto: ok.texto });
        ag.hechos.push(`${ok.accion}${ok.n ? " «" + ok.n.t.slice(0, 40) + "»" : ""}${ok.texto ? " → «" + ok.texto + "»" : ""}${r.ok ? "" : " (no funcionó)"}`);
      }
      if (!fin) fin = "Hice 20 pasos y paré para no gastar de más. Sigue tú desde aquí.";
    } finally {
      const pasos = ag ? ag.hechos.length : 0, alto = ag && ag.alto;
      ag = null;
      const LN = plug("LocalNotifications"); if (LN) { try { await LN.schedule({ notifications: [{ id: 781000, title: "🤖 Jarvis", body: (fin || "Terminé.").replace(/[✋*]/g, ""), schedule: { at: new Date(Date.now() + 200) } }] }); } catch (e) { /* nada */ } }
      if (fin) { A.add("assistant", `🤖 ${fin}${pasos ? ` (${pasos} pasos)` : ""}`, "tool"); V.say(fin.replace(/[✋«»*]/g, "")); }
      void alto;
    }
  }

  // ======================================================================== ACTUAR SOBRE LO QUE VES
  async function pantallaTexto() {
    const T = plug("Telefono"); if (!T || !T.pantalla) throw new Error("Eso funciona en el celular.");
    const r = await T.pantalla({});
    if (!r.activo) throw new Error("Necesito el control por voz de Jarvis (Accesibilidad) para ver la pantalla.");
    if (!r.texto || Date.now() - r.t > 5 * 60000) throw new Error("Llámame desde la app que estás viendo (burbuja, botón de asistente, botón de la cortina o «Jarvis») y ahí me dices qué hago.");
    return { app: r.app, texto: sinNombres(L9.limpiarPantalla(r.texto)) };
  }
  async function verAccion(k) {
    let p; try { p = await pantallaTexto(); } catch (e) { return R(e.message, "err"); }
    if (k === "estafa") {
      const e = L10.estafa(p.texto);
      const msg = e.nivel === "alto" ? `⚠️ **Muy probablemente es una estafa.** ${e.por.join("; ")}. No abras el link, no des códigos ni consignes. Si dice ser de tu banco, llama tú al número oficial.`
        : e.nivel === "medio" ? `⚠️ **Tiene señales de estafa:** ${e.por.join("; ")}. Desconfía y verifica por otro medio.`
        : e.nivel === "bajo" ? `No veo señales claras de estafa (solo: ${e.por.join("; ")}). Igual, nunca des claves ni códigos.` : "✅ No veo señales de estafa en lo que tienes en pantalla.";
      return R(msg);
    }
    if (k === "llamar") {
      const ns = L10.telefonos(p.texto);
      if (!ns.length) return R("No veo ningún número de teléfono en la pantalla.", "err");
      return pick("📞 ¿A cuál llamo?", ns.map((n) => [n, () => { const T = plug("Telefono"); if (T) T.llamar({ numero: n }).catch((e) => R(e.message, "err")); }]));
    }
    if (k === "contacto") {
      if (!hayIA()) return R("Para eso necesito la IA.", "err");
      try {
        const j = await IA.json({ system: "Respondes solo JSON.", messages: [{ role: "user", content: 'De esta pantalla saca el contacto: {"nombre":"","telefono":"","email":"","empresa":""}. Si no hay, {"error":"por qué"}.\n\n' + p.texto }], maxTokens: 300 });
        if (!j || j.error || !(j.nombre || j.telefono)) return R((j && j.error) || "No encontré un contacto en la pantalla.", "err");
        return pick(`🪪 ${[j.nombre, j.empresa, j.telefono, j.email].filter(Boolean).join(" · ")}`, [["Guardar en contactos", () => plug("Telefono").nuevoContacto(j).catch(() => {})], ["Cancelar", () => {}]]);
      } catch (e) { return R(e.message, "err"); }
    }
    if (!hayIA()) return R("Para eso necesito la IA: pon tu clave en Ajustes.", "err");
    A.setState("thinking");
    let j; try { j = await IA.json({ system: "Conviertes lo que hay en una pantalla en órdenes para el asistente Jarvis. Respondes solo JSON.", messages: [{ role: "user", content: L10.verPrompt(k, p.texto) }], maxTokens: 400 }); }
    catch (e) { A.setState("idle"); return R(e.message, "err"); }
    A.setState("idle");
    const os = ((j && j.ordenes) || []).filter((o) => L7.ordenSegura(o)).slice(0, 3);
    if (!os.length) return R((j && j.explica) || "No encontré qué hacer con esa pantalla.");
    if (j.explica) A.add("assistant", "👀 " + j.explica, "tool");
    for (const o of os) { A.add("assistant", "▶ " + o, "tool orden"); await A.dispatch(o); }
  }

  // ======================================================================== VISIÓN EN VIVO
  async function vision() {
    if (!X._live) return R("La visión en vivo usa la conversación en vivo de Gemini.", "err");
    if (!(D.ajustes.claves.gemini || "").trim()) return R("La visión en vivo usa Gemini: pon tu clave de Gemini en Ajustes.", "err");
    const sys = (A.systemPrompt ? A.systemPrompt(true) : "Eres Jarvis.") + " Ahora también VES por la cámara del celular (te llega una imagen por segundo). Cuando te pregunten, describe lo que ves, identifica cosas, lee textos, traduce letreros o menús y guía paso a paso (por ejemplo para armar o arreglar algo). Responde corto y natural. Si no se ve bien, pide acercar o más luz.";
    return X._live.start({ sys, video: true, titulo: "Te veo" });
  }

  // ======================================================================== SUGERENCIAS QUE APRENDE
  function anotarUso(text) {
    const t = String(text || "").trim();
    if (!t || t.length > 80 || /^[▶⏰✨]/.test(t)) return;
    const k = L10.clave(t); if (k.split(" ").length < 2 && k.length < 6) return;
    D.usoLog = (D.usoLog || []).concat([{ k, texto: t, t: Date.now() }]).filter((x) => Date.now() - x.t < 30 * 864e5).slice(-400);
  }
  function sugerencias() { if (D.ajustes.sugerencias === false) return []; return L10.patrones(D.usoLog, Date.now()); }

  // ======================================================================== ESTAFAS, RESPUESTAS AUTOMÁTICAS, LLAMADAS
  async function mensajesConfig(o) { const M = plug("Mensajes"); if (M && M.config) { try { await M.config(o); } catch (e) { /* nada */ } } }
  async function auto(it) {
    if (it.auto === "off") { D.ajustes.autoResp = null; save(); await mensajesConfig({ autoResp: false }); return R("Listo, ya no respondo por ti."); }
    D.ajustes.autoResp = { texto: it.texto, hasta: it.hasta }; save();
    await mensajesConfig({ autoResp: true, autoTexto: it.texto, autoHasta: it.hasta || 0 });
    const M = plug("Mensajes"); let falta = ""; if (M && M.activo) { try { if (!(await M.activo()).activo) { falta = " Para responder necesito el «Acceso a notificaciones»: te abro el ajuste."; setTimeout(() => M.permiso(), 1500); } } catch (e) { /* nada */ } }
    return R(`💬 Listo: a quien te escriba por WhatsApp o mensajes le respondo «${it.texto}»${it.hasta ? ` hasta las ${new Date(it.hasta).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}` : " hasta que me digas «quita las respuestas automáticas»"}. Una vez por persona cada media hora, y nunca a grupos.${falta}`);
  }
  async function llamadas(it) {
    const T = plug("Telefono"); if (!T || !T.filtroLlamadas) return R("El filtro de llamadas funciona en el celular.", "err");
    const c = D.ajustes.llamadas = D.ajustes.llamadas || { modo: "off", negra: "" };
    if (it.llamadas === "ver") {
      const l = (((await T.llamadasFiltradas()) || {}).lista || []).slice(0, 10);
      return R(l.length ? "📵 **Llamadas filtradas:**\n" + l.map((x) => `- ${x.que === "bloquear" ? "⛔" : "🔕"} ${x.numero || "oculto"} · ${new Date(x.t).toLocaleString("es-CO", { weekday: "short", hour: "numeric", minute: "2-digit" })}`).join("\n") : "No he filtrado ninguna llamada.");
    }
    if (it.llamadas === "negra") c.negra = [c.negra, it.numero].filter(Boolean).join(",");
    else c.modo = it.llamadas;
    save();
    const r = await T.filtroLlamadas({ modo: c.modo === "off" && c.negra ? "negra" : c.modo, negra: c.negra });
    const txt = it.llamadas === "negra" ? `⛔ Bloqueé el ${it.numero}.` : it.llamadas === "off" ? "Quité el filtro: entran todas las llamadas." :
      `📵 Listo: las llamadas de números que no están en tus contactos ${it.llamadas === "bloquear" ? "se bloquean" : "entran en silencio"}. Tus contactos siempre suenan.`;
    return R(txt + (r && r.pedido ? " Android te va a pedir que Jarvis sea tu «app de filtro de llamadas»: acéptalo." : ""));
  }

  // ======================================================================== MEMORIA FOTOGRÁFICA
  async function fotos(it) {
    const F = plug("Fotos"); if (!F) return R("Buscar en tus fotos funciona en el celular.", "err");
    if (it.fotos === "activar") {
      const r = await F.activar();
      if (!r.ok) return R("Sin el permiso de fotos no puedo buscarlas.", "err");
      D.ajustes.fotosOn = true; save();
      return R("📸 Listo. Voy a leer tus fotos **solo mientras el celular esté cargando** (así no gasto batería), de a poco y sin que salgan del celular. Después me preguntas: «busca la foto de la cédula».");
    }
    let r; try { r = await F.buscar({ terminos: L10.terminos(it.q) }); } catch (e) { return R(e.message || String(e), "err"); }
    if (!r.leidas) { pick("Todavía no he leído tus fotos. ¿Empiezo? Lo hago solo mientras el celular carga.", [["Sí, léelas", () => fotos({ fotos: "activar" })]]); return; }
    if (!r.lista.length) return R(`No encontré fotos de «${it.q}» (he leído ${r.leidas}). Si son nuevas, las leo en la próxima carga.`);
    const { e } = A.add("assistant", `📸 Encontré ${r.lista.length} foto${r.lista.length > 1 ? "s" : ""} de «${it.q}»:`, "tool");
    const g = mk("div", "foto-res");
    r.lista.forEach((f) => { if (!f.mini) return; const im = mk("img"); im.src = "data:image/jpeg;base64," + f.mini; im.alt = (f.txt || "").slice(0, 60); im.addEventListener("click", () => F.abrir({ uri: f.uri })); g.append(im); });
    e.append(g); A.say(`Encontré ${r.lista.length} fotos. Toca la que quieras para abrirla.`);
  }

  // ======================================================================== «¿QUÉ HICE EL…?»
  async function tiempo(it) {
    const ev = L10.linea(D, it.desde, it.hasta);
    const C = plug("Calendario");
    if (C) { try { const r = await C.eventos({ desde: it.desde, hasta: it.hasta }); (r.lista || []).forEach((x) => ev.push({ t: x.inicio, ic: "📅", txt: x.titulo })); } catch (e) { /* sin permiso */ } }
    ev.sort((a, b) => a.t - b.t);
    const dia = it.hasta - it.desde <= 864e5;
    if (!ev.length) return R(`No tengo nada anotado de ${it.etiqueta}. Lo que me cuentas, tus gastos, el diario y tu calendario se van guardando aquí.`);
    const f = (t) => dia ? new Date(t).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" }) : new Date(t).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" });
    const txt = `🗓️ **${it.etiqueta[0].toUpperCase() + it.etiqueta.slice(1)}:**\n` + ev.slice(-30).map((x) => `- ${f(x.t)} ${x.ic} ${x.txt}`).join("\n");
    const ops = hayIA() ? [["Resúmelo", () => A.dispatch("Haz un resumen cálido y corto (3 a 5 frases) de lo que hice, con base en esta lista:\n" + sinNombres(ev.map((x) => `${f(x.t)} ${x.txt}`).join("\n")))]] : [];
    if (ops.length) pick(txt, ops, `Tengo ${ev.length} cosas de ${it.etiqueta}. Están en la pantalla.`); else R(txt, "tool", `Tengo ${ev.length} cosas de ${it.etiqueta}.`);
  }

  // ======================================================================== DICTADO PULIDO
  async function pulir(it) {
    let crudo = it.texto || "";
    if (it.pulir === "dictar") {
      R(`🎙️ Dime el ${it.tipo}${it.para ? " para " + it.para : ""} como te salga; yo lo dejo bien escrito.`);
      await V.idle();
      try { crudo = await V.listen((p) => ($("#live").textContent = p), { espera: 20000, silencio: 2600 }); } catch (e) { return R(e.message, "err"); }
      $("#live").textContent = "";
      if (!crudo) return R("No te oí. Vuelve a intentarlo.");
    }
    let limpio = L10.sinMuletillas(crudo);
    if (hayIA()) { A.setState("thinking"); try { limpio = (await IA.chat({ system: "Eres un corrector de estilo. Devuelves solo el texto final.", messages: [{ role: "user", content: L10.pulirPrompt(sinNombres(crudo) === crudo ? crudo : crudo, it.para, it.tipo) }], maxTokens: 800, stream: false })).trim().replace(/^["«]|["»]$/g, ""); } catch (e) { /* queda la versión sin muletillas */ } A.setState("idle"); }
    const ops = [["📋 Copiar", () => { try { navigator.clipboard.writeText(limpio); A.toast("Copiado: pégalo donde quieras."); } catch (e) { A.toast("No pude copiar."); } }],
      ["📤 Compartir", () => N.share({ title: "Mensaje", text: limpio }).catch(() => {})]];
    if (it.para) ops.unshift([`WhatsApp a ${it.para}`, () => A.dispatch(`mándale un whatsapp a ${it.para} que ${limpio}`)]);
    pick("✍️ " + limpio, ops, false);
  }

  // ======================================================================== WIDGET A LA CARTA
  const NOMBRES = { pagos: "Pagos del mes", lista: "Lista del mercado", gastos: "Gastos del mes", recordatorios: "Recordatorios", habitos: "Mis rachas", temporizadores: "Temporizadores", cumple: "Cumpleaños", meds: "Medicamentos" };
  const CMD = { pagos: "mis pagos", lista: "qué me falta comprar", gastos: "mis gastos", recordatorios: "mis recordatorios", habitos: "mis rachas", temporizadores: "mis temporizadores", cumple: "quién cumple años este mes", meds: "mis rachas" };
  function widgetTexto(f) {
    const now = Date.now();
    if (f === "pagos") { const e = L9.pagosEstado(D.pagos, now); return e.length ? e.map((p) => `${p.pagado ? "✅" : p.en < 0 ? "⚠️" : p.en <= 3 ? "⏰" : "▫️"} ${p.nombre} · el ${p.dia}${p.monto ? " · " + L8.cop(p.monto) : ""}`).join("\n") : "Sin pagos anotados."; }
    if (f === "lista") { const l = (D.listas || {}).mercado || Object.values(D.listas || {})[0]; return l && l.items.length ? l.items.slice(0, 9).map((x) => "▫️ " + x.t).join("\n") : "La lista está vacía."; }
    if (f === "gastos") { const r = L8.resumen(D.gastos, "mes", now), lim = (D.presupuesto || {}).total; return `Llevas ${L8.cop(r.total)}${lim ? ` de ${L8.cop(lim)} (${Math.round(r.total / lim * 100)} %)` : ""}\n` + r.cats.slice(0, 6).map(([c, v]) => `· ${c}: ${L8.cop(v)}`).join("\n"); }
    if (f === "recordatorios") { const l = (D.recordatorios || []).filter((r) => !r.avisado && r.cuando > now).sort((a, b) => a.cuando - b.cuando).slice(0, 7); return l.length ? l.map((r) => `⏰ ${new Date(r.cuando).toLocaleString("es-CO", { weekday: "short", hour: "numeric", minute: "2-digit" })} · ${r.texto}`).join("\n") : "Sin recordatorios."; }
    if (f === "habitos") { const h = Object.entries(D.habitos || {}); return h.length ? h.slice(0, 8).map(([k, v]) => `🔥 ${k}: ${L8.racha(v, now)} días`).join("\n") : "Sin hábitos todavía."; }
    if (f === "temporizadores") { const t = (D.timers || []).filter((x) => x.fin > now); return t.length ? t.map((x) => `⏲ ${x.nombre}: termina ${new Date(x.fin).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`).join("\n") : "Sin temporizadores."; }
    if (f === "cumple") { const p = L8.proximos(D.cumples || [], now, 31); return p.length ? p.slice(0, 8).map((c) => `🎂 ${c.nombre} · ${c.en === 0 ? "hoy" : "en " + c.en + " días"}`).join("\n") : "Sin cumpleaños cerca."; }
    if (f === "meds") { return (D.meds || []).map((m) => `💊 ${m.nombre} · ${m.horas.map((h) => (h.h % 12 || 12) + ":" + String(h.m).padStart(2, "0")).join(", ")}`).join("\n") || "Sin medicamentos."; }
    return "";
  }
  async function widgetActualizar(fijar) {
    const f = D.ajustes.widgetFuente; if (!f) return null;
    const P = plug("Disparadores"); if (!P || !P.widgetDatos) return null;
    try { return await P.widgetDatos({ titulo: NOMBRES[f], texto: widgetTexto(f), cmd: CMD[f], fijar: !!fijar }); } catch (e) { return null; }
  }
  async function widget(it) {
    if (it.widget === "off") { D.ajustes.widgetFuente = ""; save(); const P = plug("Disparadores"); if (P && P.widgetDatos) P.widgetDatos({ titulo: "Jarvis", texto: "Pídele a Jarvis: «crea un widget con mis pagos del mes».", cmd: "" }).catch(() => {}); return R("Listo, el widget a la carta queda vacío. Para quitarlo de la pantalla, manténlo presionado y arrástralo a «Quitar»."); }
    if (it.widget === "desconocido") return R(`Puedo hacer widgets con: ${Object.values(NOMBRES).join(", ").toLowerCase()}. Dime, por ejemplo, «crea un widget con mis pagos del mes».`);
    D.ajustes.widgetFuente = it.widget; save();
    const r = await widgetActualizar(true);
    return R(`🧩 Listo el widget «${NOMBRES[it.widget]}». ${r && r.fijado ? "Android te pregunta dónde ponerlo." : "Para ponerlo: mantén presionada la pantalla de inicio › Widgets › Jarvis › «Jarvis a la carta»."} Se actualiza solo cada vez que sales de Jarvis.`);
  }

  // ======================================================================== PRESENTACIONES
  function cargar(src) { return new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No pude cargar " + src)); document.head.appendChild(s); }); }
  async function presentacion(it) {
    if (!hayIA()) return R("Para hacer presentaciones necesito la IA: pon tu clave en Ajustes.", "err");
    A.setState("thinking"); A.toast("Armando la presentación…", 4000);
    let p;
    try { p = L10.cleanPpt(await IA.json({ system: "Eres un experto en presentaciones claras. Respondes solo JSON.", messages: [{ role: "user", content: L10.pptPrompt(it.tema, it.n, it.para) }], maxTokens: 4000 }), it.n); }
    catch (e) { A.setState("idle"); return R(e.message, "err"); }
    if (p.error) { A.setState("idle"); return R(p.error, "err"); }
    try {
      if (!window.PptxGenJS) await cargar("vendor/pptxgen.bundle.js");
      const x = new window.PptxGenJS(); x.layout = "LAYOUT_WIDE"; x.title = p.titulo;
      const FONDO = "0B1220", ACENTO = "2EE6FF", TEXTO = "E8F1FA";
      const s0 = x.addSlide(); s0.background = { color: FONDO };
      s0.addShape(x.ShapeType.rect, { x: 0.6, y: 3.55, w: 1.6, h: 0.08, fill: { color: ACENTO }, line: { color: ACENTO } });
      s0.addText(p.titulo, { x: 0.6, y: 1.6, w: 12, h: 1.8, fontSize: 40, bold: true, color: TEXTO, fontFace: "Calibri" });
      if (p.subtitulo) s0.addText(p.subtitulo, { x: 0.6, y: 3.8, w: 12, h: 0.8, fontSize: 20, color: "A9BED3", fontFace: "Calibri" });
      s0.addText(D.ajustes.nombre || "", { x: 0.6, y: 6.5, w: 12, h: 0.5, fontSize: 14, color: "7F93A8" });
      p.diapositivas.forEach((d, k) => {
        const s = x.addSlide(); s.background = { color: "FFFFFF" };
        s.addShape(x.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: ACENTO }, line: { color: ACENTO } });
        s.addText(d.titulo, { x: 0.6, y: 0.4, w: 12, h: 1, fontSize: 30, bold: true, color: FONDO, fontFace: "Calibri" });
        if (d.puntos.length) s.addText(d.puntos.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { x: 0.8, y: 1.6, w: 11.6, h: 5.2, fontSize: 22, color: "26323F", fontFace: "Calibri", valign: "top", paraSpaceAfter: 10 });
        s.addText(String(k + 2), { x: 12.3, y: 6.9, w: 0.8, h: 0.4, fontSize: 12, color: "9AA7B4", align: "right" });
        if (d.notas) s.addNotes(d.notas);
      });
      const b64 = await x.write({ outputType: "base64" });
      const nombre = p.titulo.replace(/[^\wáéíóúñÁÉÍÓÚÑ -]/g, "").slice(0, 50).trim() + ".pptx";
      const md = `### ${p.titulo}\n\n` + p.diapositivas.map((d, k) => `**${k + 2}. ${d.titulo}**\n` + d.puntos.map((t) => "- " + t).join("\n")).join("\n\n");
      D.docs = D.docs || []; D.docs.unshift({ id: window.JD.uid(), titulo: "Presentación: " + p.titulo, md, fecha: Date.now(), tipo: "ppt" }); save();
      A.setState("idle");
      pick(`🖥️ **Lista la presentación «${p.titulo}»** (${p.diapositivas.length + 1} diapositivas, con notas para ti).\n\n` + p.diapositivas.map((d, k) => `${k + 2}. ${d.titulo}`).join("\n"),
        [["📤 Abrir o compartir el PowerPoint", () => N.share({ title: p.titulo, fileName: nombre, mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", base64: b64 }).catch((e) => R(e.message, "err"))]],
        `Lista la presentación de ${p.diapositivas.length + 1} diapositivas. Toca para abrirla o compartirla.`);
    } catch (e) { A.setState("idle"); R("No pude armar el PowerPoint: " + (e.message || e), "err"); }
  }

  // ======================================================================== AJUSTES
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-311")) return;
    const sec = mk("div"); sec.id = "aj-311";
    sec.append(mk("h3", "sub", "Protección y agente"));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); sec.append(l); };
    chk("Avisarme si un mensaje que llega parece estafa (se revisa en el celular)", D.ajustes.estafas !== false, (v) => { D.ajustes.estafas = v; save(); mensajesConfig({ estafas: v }); });
    chk("Responder solo «Estoy manejando…» mientras está el modo conducción", D.ajustes.autoConduccion, (v) => { D.ajustes.autoConduccion = v; save(); });
    chk("Sugerirme lo que suelo pedir a esta hora (aprende en el celular)", D.ajustes.sugerencias !== false, (v) => { D.ajustes.sugerencias = v; save(); });
    const ll = mk("select", "inp"); [["off", "Filtro de llamadas: apagado"], ["silenciar", "Silenciar números desconocidos"], ["bloquear", "Bloquear números desconocidos"]].forEach(([k, t]) => ll.append(new Option(t, k)));
    ll.value = (D.ajustes.llamadas || {}).modo || "off"; ll.addEventListener("change", () => llamadas({ llamadas: ll.value })); sec.append(ll);
    sec.append(mk("p", "hint", "El agente («pídeme un Uber a la casa», «busca en Mercado Libre…») usa el control por voz de Jarvis (Accesibilidad). Trabaja solo mientras se lo pides, nunca paga, confirma ni envía por ti, y no usa apps de bancos."));
    const v = $("#aj-310"); if (v) v.after(sec); else box.prepend(sec);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, hoyExtra: X.hoyExtra };
  X.intent = function (text) {
    anotarUso(text);
    if (ag && ag.preguntando) { const t = L10.norm(text); if (/^(?:cancela|para|olvidalo|deja asi|no)$/.test(t)) return { ag: "cancelar" }; return { ag: "responder", texto: text }; }
    const ai = L10.agenteIntent(text); if (ai) return { ag: "agente", it: ai };
    const va = L10.verAccionIntent(text); if (va) return { ag: "ver", k: va.ver };
    if (L10.visionIntent(text)) return { ag: "vision" };
    const au = L10.autoIntent(text, Date.now()); if (au) return { ag: "auto", it: au };
    const ll = L10.llamadasIntent(text); if (ll) return { ag: "llamadas", it: ll };
    const fo = L10.fotosIntent(text); if (fo) return { ag: "fotos", it: fo };
    const ti = L10.tiempoIntent(text, Date.now()); if (ti) return { ag: "tiempo", it: ti };
    const di = L10.dictadoIntent(text); if (di) return { ag: "pulir", it: di };
    const wi = L10.widgetIntent(text); if (wi) return { ag: "widget", it: wi };
    const pp = L10.presentacionIntent(text); if (pp) return { ag: "ppt", it: pp };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.ag) return base.run(it, text);
    switch (it.ag) {
      case "agente":
        if (it.it.agente === "banco") return R("Por seguridad no manejo apps de bancos ni de pagos. Eso hazlo tú directamente en la app de tu banco.");
        if (it.it.agente === "sinapp") return R("¿En qué app lo hago? Dime, por ejemplo: «hazlo tú en Rappi: pide una pizza».");
        return agente(it.it.app, it.it.meta);
      case "responder": { const a = ag; a.meta += ` (respuesta de la persona: ${it.texto})`; a.hechos.push(`pregunté «${a.preguntando}» y respondió «${it.texto}»`); a.preguntando = null; R(`🤖 Sigo en ${a.app}…`); await V.idle(); return agente(a.app, a.meta, true); }
      case "cancelar": ag = null; return R("Listo, dejé la tarea.");
      case "ver": return verAccion(it.k);
      case "vision": return vision();
      case "auto": return auto(it.it);
      case "llamadas": return llamadas(it.it);
      case "fotos": return fotos(it.it);
      case "tiempo": return tiempo(it.it);
      case "pulir": return pulir(it.it);
      case "widget": return widget(it.it);
      case "ppt": return presentacion(it.it);
    }
  };
  X.hoyExtra = function () {
    const items = base.hoyExtra ? base.hoyExtra() : [];
    sugerencias().forEach((s) => items.push({ txt: "💡 " + s.texto.slice(0, 32), cls: "", cmd: s.texto }));
    if (D.ajustes.autoResp) items.push({ txt: "💬 Respondiendo por ti", cls: "run", cmd: "quita las respuestas automáticas" });
    return items;
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    setTimeout(() => {
      mensajesConfig({ estafas: D.ajustes.estafas !== false });
      if (D.ajustes.autoResp && D.ajustes.autoResp.hasta && D.ajustes.autoResp.hasta < Date.now()) { D.ajustes.autoResp = null; save(); }
      widgetActualizar(false);
    }, 4500);
    // el widget se pone al día al salir de Jarvis (una sola vez, sin despertar nada después)
    document.addEventListener("visibilitychange", () => { if (document.hidden) widgetActualizar(false); else if (ag && ag.corriendo && !ag.preguntando) { ag.corriendo = false; } });
    // modo conducción → respuesta automática «Estoy manejando» (si lo escogiste)
    let antes = document.body.classList.contains("conduciendo");
    new MutationObserver(() => {
      const on = document.body.classList.contains("conduciendo"); if (on === antes) return; antes = on;
      if (!D.ajustes.autoConduccion) return;
      if (on) { mensajesConfig({ autoResp: true, autoTexto: "Estoy manejando. Te escribo apenas llegue. (Respuesta automática de Jarvis)", autoHasta: Date.now() + 4 * 3600e3 }); D.ajustes.autoResp = { texto: "Estoy manejando", hasta: Date.now() + 4 * 3600e3 }; }
      else { mensajesConfig({ autoResp: false }); D.ajustes.autoResp = null; }
      save();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  };
  X._agente = { agente, verAccion, vision, sugerencias, anotarUso, auto, llamadas, fotos, tiempo, pulir, widget, widgetTexto, presentacion, estado: () => ag };
})();
