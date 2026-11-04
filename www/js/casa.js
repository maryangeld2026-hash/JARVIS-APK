/* Jarvis para Android 3.10.
   ¿Dónde dejé el carro? · encontrar el celular por SMS · pagos y suscripciones · rutina de la noche · modo cocina ·
   «¿qué dice esta pantalla?» · Gmail · diario y ánimo · practicar idiomas · conversor (unidades, moneda, hora) ·
   casa inteligente (Home Assistant y enlaces) · botón en los Ajustes rápidos · reportar un problema.
   Batería: lo programado lo avisa Android; el carro y el SMS los avisa Android; nada queda corriendo con Jarvis minimizado.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L9 = window.JL9, L8 = window.JL8, V = window.JV, IA = window.JIA, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const plug = (n) => (V.native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const uid = () => window.JD.uid();
  const VD = () => X._vida;
  const pick = (t, ops, sp) => VD().pick(t, ops, sp);
  const abrirUrl = (u) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url: u }).catch(() => window.open(u, "_blank")); window.open(u, "_blank"); };
  const docente = () => D.ajustes.docente !== false;
  const sinNombres = (t) => { if (!docente()) return t; const ns = [].concat(...D.cursos.map((c) => c.estudiantes || [])).filter((n) => n.length > 3); return String(t).split("\n").filter((l) => !ns.some((n) => L9.norm(l).includes(L9.norm(n)))).join("\n"); };

  // ======================================================================== ¿DÓNDE DEJÉ EL CARRO?
  async function carroVer() {
    let pos = null;
    const P = plug("Disparadores");
    if (P && P.carro) { try { const r = await P.carro(); if (r && r.lat) pos = r; } catch (e) { /* nada */ } }
    if (D.carro && (!pos || D.carro.t > pos.t)) pos = D.carro;
    if (!pos) return R(D.ajustes.carroBt ? "Todavía no tengo dónde quedó: lo guardo cuando se desconecta el Bluetooth de tu carro. También puedes decirme «guarda dónde parqueé»." :
      "No sé dónde quedó. Al parquear dime «guarda dónde parqueé», o dime «mi carro es el Bluetooth …» y lo guardo solo cada vez que lo apagues.");
    let lejos = "";
    const S = plug("Lugares");
    if (S) { try { const aq = await S.aqui({ aprox: true }); lejos = ", a unos " + L9.metros(L9.distancia(aq, pos)) + " de aquí"; } catch (e) { /* sin ubicación */ } }
    pick(`🚗 Tu carro quedó ${L9.haceCuanto(pos.t)}${lejos}.`, [["🚶 Llévame caminando", () => abrirUrl(L9.caminar(pos.lat, pos.lng))], ["Ver en el mapa", () => abrirUrl(`https://maps.google.com/?q=${pos.lat},${pos.lng}`)]]);
  }
  async function carroGuardar() {
    const S = plug("Lugares"); if (!S) return R("Eso funciona en el celular.", "err");
    try { const p = await S.aqui({}); D.carro = { lat: p.lat, lng: p.lng, t: Date.now() }; save(); return R("🅿️ Listo, guardé dónde parqueaste. Cuando vuelvas, dime «¿dónde dejé el carro?»."); }
    catch (e) { return R(e.message || String(e), "err"); }
  }
  async function carroBt(nombre) {
    const P = plug("Disparadores");
    let l = []; if (P) { try { await P.permisoBluetooth(); l = ((await P.bluetooth()) || {}).lista || []; } catch (e) { /* nada */ } }
    const hit = l.find((n) => L9.norm(n).includes(L9.norm(nombre))) || nombre;
    D.ajustes.carroBt = hit; save(); if (VD().syncDisparadores) await VD().syncDisparadores();
    if (!l.length || l.includes(hit)) return R(`Listo: cada vez que se desconecte «${hit}», guardo dónde quedó el carro. Necesita la ubicación «Permitir todo el tiempo».`);
    pick(`¿Cuál de tus Bluetooth es el carro?`, l.slice(0, 8).map((n) => [n, async () => { D.ajustes.carroBt = n; save(); await VD().syncDisparadores(); R(`Listo: al desconectarse «${n}» guardo dónde quedó el carro.`); }]));
  }

  // ======================================================================== ENCONTRAR EL CELULAR
  async function buscarCel(on, clave) {
    const P = plug("Disparadores");
    if (on) {
      clave = (clave || (D.ajustes.buscar || {}).clave || "").trim();
      if (clave.length < 4) return R("Escoge una clave de al menos 4 letras, solo tuya: «activa encontrar mi celular con la clave girasol». También en *Ajustes › Más*.", "err");
      D.ajustes.buscar = { on: true, clave }; save();
      if (P && P.buscarCelular) { try { const r = await P.buscarCelular({ on: true, clave, responder: true }); if (r && r.ok === false) return R("Sin el permiso de recibir SMS no puedo hacerlo.", "err"); } catch (e) { return R(e.message || String(e), "err"); } }
      return R(`📍 Listo. Si pierdes el celular, desde otro mándale un SMS que diga exactamente: **Jarvis ${clave}**. Sonará fuerte (aunque esté en silencio) y te responderé con la ubicación. No le cuentes la clave a nadie.`);
    }
    D.ajustes.buscar = { on: false, clave: (D.ajustes.buscar || {}).clave || "" }; save();
    if (P && P.buscarCelular) { try { await P.buscarCelular({ on: false, clave: "" }); } catch (e) { /* nada */ } }
    return R("Apagué «encontrar mi celular».");
  }

  // ======================================================================== PAGOS Y SUSCRIPCIONES
  const PGID = 780000;
  async function programarPagos() {
    await VD().cancelar(PGID, 60);
    const list = L9.pagosAvisos(D.pagos).slice(0, 60).map((a, k) => ({ id: PGID + k, title: a.antes ? `💳 En 2 días: ${a.nombre}` : `💳 Hoy se paga: ${a.nombre}`, body: a.antes ? "Te lo recuerdo para que no se te pase." : "Cuando lo pagues dime «ya pagué " + a.nombre + "».",
      schedule: { on: { day: a.dia, hour: 8, minute: 0 }, allowWhileIdle: true } }));
    await VD().programar(list);
  }
  function buscarPago(n) { const q = L9.norm(n); return (D.pagos || []).find((p) => L9.norm(p.nombre) === q) || (D.pagos || []).find((p) => L9.norm(p.nombre).includes(q) || q.includes(L9.norm(p.nombre))); }
  async function runPago(it) {
    D.pagos = D.pagos || [];
    if (it.pago === "add") {
      const ex = buscarPago(it.nombre);
      const p = ex || { id: uid(), nombre: it.nombre, pagos: [] };
      p.dia = it.dia; if (it.monto) p.monto = it.monto;
      if (!ex) D.pagos.push(p);
      save(); await programarPagos();
      return R(`💳 Anotado: **${p.nombre}** se paga el ${p.dia} de cada mes${p.monto ? ` (${L8.cop(p.monto)})` : ""}. Te aviso 2 días antes y ese día a las 8.`);
    }
    if (it.pago === "pagado") {
      const p = buscarPago(it.nombre); if (!p) return null;
      (p.pagos = p.pagos || []).push(Date.now()); p.pagos = p.pagos.slice(-24); save();
      if (p.monto && VD().anotar) VD().anotar({ monto: p.monto, desc: p.nombre, cat: L8.categoria(p.nombre) === "otros" ? "servicios" : L8.categoria(p.nombre) }, true);
      return R(`✅ Listo: ${p.nombre} pagado este mes${p.monto ? ` (lo anoté en tus gastos: ${L8.cop(p.monto)})` : ""}.`);
    }
    if (it.pago === "borrar") { const p = buscarPago(it.nombre); if (!p) return null; D.pagos = D.pagos.filter((x) => x !== p); save(); await programarPagos(); return R(`Quité el pago de ${p.nombre}.`); }
    if (!D.pagos.length) return R("No tienes pagos anotados. Dime, por ejemplo: «la luz se paga el 15» o «Netflix cada mes el 3 por 45 mil».");
    const e = L9.pagosEstado(D.pagos, Date.now()), tot = D.pagos.reduce((s, p) => s + (p.monto || 0), 0);
    const pend = e.filter((p) => !p.pagado);
    const s = e.map((p) => `- ${p.pagado ? "✅" : p.en < 0 ? "⚠️" : p.en <= 3 ? "⏰" : "▫️"} **${p.nombre}**, el ${p.dia}${p.monto ? ` · ${L8.cop(p.monto)}` : ""}${p.pagado ? " · pagado" : p.en < 0 ? ` · ¡se venció hace ${-p.en} día${p.en === -1 ? "" : "s"}!` : p.en === 0 ? " · **hoy**" : ` · en ${p.en} días`}`).join("\n");
    return R(`💳 **Tus pagos del mes**${tot ? ` (en total ${L8.cop(tot)} al mes)` : ""}:\n${s}`, "tool", pend.length ? `Te faltan ${pend.length} pagos. El próximo: ${pend[0].nombre}, ${pend[0].en === 0 ? "hoy" : pend[0].en < 0 ? "ya vencido" : "en " + pend[0].en + " días"}.` : "Ya pagaste todo este mes.");
  }

  // ======================================================================== RUTINA DE LA NOCHE
  async function noche(it) {
    const p = [`🌙 Buenas noches${D.ajustes.nombre ? ", " + D.ajustes.nombre.split(" ")[0] : ""}.`];
    const man = new Date(); man.setDate(man.getDate() + 1); man.setHours(0, 0, 0, 0); const fin = new Date(man); fin.setDate(fin.getDate() + 1);
    const C = plug("Calendario");
    if (C) { try { const r = await C.eventos({ desde: man.getTime(), hasta: fin.getTime() }); const ev = (r.lista || []).filter((e) => !e.todoElDia); if (ev.length) p.push(`Mañana tienes: ${ev.slice(0, 4).map((e) => `${e.titulo} a las ${new Date(e.inicio).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}`).join("; ")}.`); } catch (e) { /* sin permiso */ } }
    const rec = (D.recordatorios || []).filter((r) => !r.avisado && r.cuando >= man.getTime() && r.cuando < fin.getTime());
    if (rec.length) p.push(`Recordatorios de mañana: ${rec.map((r) => r.texto).slice(0, 4).join("; ")}.`);
    if (docente() && window.JL3 && D.ajustes.horario) { const cl = window.JL3.parseSchedule(D.ajustes.horario).filter((c) => c.dia === man.getDay()); if (cl.length) p.push(`Clases: ${cl.map((c) => c.que + " a las " + window.JL3.hhmm(c.ini)).join(", ")}.`); }
    const pg = L9.pagosEstado(D.pagos, Date.now()).filter((x) => !x.pagado && x.en === 1); if (pg.length) p.push(`Mañana se paga: ${pg.map((x) => x.nombre).join(", ")}.`);
    const cu = L8.proximos((D.cumples || []), Date.now(), 1).filter((c) => c.en === 1); if (cu.length) p.push(`Mañana cumple años ${cu.map((c) => c.nombre).join(" y ")}.`);
    const T = plug("Telefono");
    const al = it.alarma || D.ajustes.alarmaNoche;
    if (al && T && T.alarma) { try { await T.alarma({ hora: al.h, minuto: al.m, texto: "Jarvis: buenos días" }); p.push(`Puse la alarma a las ${al.h % 12 || 12}:${String(al.m).padStart(2, "0")} ${al.h < 12 ? "a. m." : "p. m."}`); if (it.alarma) { D.ajustes.alarmaNoche = it.alarma; save(); } } catch (e) { /* sin reloj */ } }
    if (T && T.noMolestar && D.ajustes.nocheDnd !== false) { try { const r = await T.noMolestar({ on: true }); if (r && r.ok) p.push("Activé «No molestar» (las alarmas y las llamadas favoritas sí entran)."); else p.push("Para activar «No molestar» dame el permiso en el ajuste que te abrí."); } catch (e) { /* nada */ } }
    if (T && T.brillo && D.ajustes.nocheBrillo !== false) { try { const r = await T.brillo({ nivel: 15 }); if (r && r.ok) p.push("Bajé el brillo."); } catch (e) { /* nada */ } }
    if (!p.some((x) => /alarma/.test(x))) p.push("Si quieres alarma, dime «buenas noches, despiértame a las 6».");
    R(p.join(" "));
    if (X._gen && X._gen.clima && navigator.onLine) { await V.idle(); X._gen.clima({ clima: true, dia: 1, ciudad: "" }); }
  }
  async function buenosDias() { const T = plug("Telefono"); if (T && T.noMolestar) { try { await T.noMolestar({ on: false }); } catch (e) { /* nada */ } } }

  // ======================================================================== MODO COCINA
  let cocina = null;                                           // {r, i, en}
  function decirPaso() {
    const r = cocina.r, p = r.pasos[cocina.i];
    const t = `Paso ${cocina.i + 1} de ${r.pasos.length}: ${p.t}`;
    const { e } = A.add("assistant", "👩‍🍳 " + t + (p.min ? `\n\n⏲ Puse ${p.min} minutos.` : ""), "tool");
    e.innerHTML = A.md("👩‍🍳 " + t + (p.min ? `\n\n⏲ Puse ${p.min} minutos.` : ""));
    if (p.min) A.dispatch(`pon ${p.min} minutos para el paso ${cocina.i + 1}`).catch(() => {});
    V.say(t + (p.min ? `. Puse ${p.min} minutos.` : "") + (cocina.i === r.pasos.length - 1 ? " Es el último paso." : ""));
    V.idle().then(() => { if (cocina) setTimeout(() => A.listen(true), 300); });
  }
  async function empezarCocina(it) {
    A.setState("thinking");
    let r;
    try { r = L9.recetaClean(await IA.json({ system: "Eres un cocinero colombiano práctico. Respondes solo JSON.", messages: [{ role: "user", content: L9.recetaPrompt(it.plato, it.porciones) }], maxTokens: 2500 })); }
    catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    if (r.error) return R(r.error, "err");
    cocina = { r, i: -1 };
    N.keepAwake(true);                                         // mientras cocinas la pantalla queda prendida (se apaga al terminar)
    document.body.classList.add("cocinando");
    R(`👩‍🍳 **${r.titulo}**${r.porciones ? ` (para ${r.porciones})` : ""}\n\n**Ingredientes:**\n${r.ingredientes.map((x) => "- " + x).join("\n")}\n\nDime «siguiente» para empezar; también «anterior», «repite», «ingredientes» o «terminar».`, "tool",
      `${r.titulo}. Necesitas: ${r.ingredientes.slice(0, 10).join(", ")}. Cuando tengas todo, dime siguiente.`);
    V.idle().then(() => { if (cocina) setTimeout(() => A.listen(true), 300); });
  }
  function terminarCocina(msg) { cocina = null; N.keepAwake(false); document.body.classList.remove("cocinando"); if (msg) R(msg); }
  function runCocina(cmd) {
    const r = cocina.r;
    if (cmd === "terminar") return terminarCocina("¡Buen provecho! 🍽️ Terminé el modo cocina.");
    if (cmd === "ingredientes") { R("**Ingredientes:**\n" + r.ingredientes.map((x) => "- " + x).join("\n"), "tool", r.ingredientes.join(", ")); return V.idle().then(() => cocina && A.listen(true)); }
    if (cmd === "falta") return A.dispatch("mis temporizadores");
    if (cmd === "siguiente") { if (cocina.i >= r.pasos.length - 1) return terminarCocina("¡Listo, terminaste la receta! ¡Buen provecho! 🍽️"); cocina.i++; }
    else if (cmd === "anterior") cocina.i = Math.max(0, cocina.i - 1);
    else if (cmd === "repite" && cocina.i < 0) cocina.i = 0;
    return decirPaso();
  }

  // ======================================================================== ¿QUÉ DICE ESTA PANTALLA?
  async function pantalla(it) {
    const T = plug("Telefono");
    if (!T || !T.pantalla) return R("Eso funciona en el celular.", "err");
    const r = await T.pantalla({});
    if (!r.activo) { pick("Para leer la pantalla necesito el control por voz de Jarvis (Accesibilidad). Solo copia la pantalla cuando me llamas desde otra app, y nunca lee contraseñas.", [["Abrir el ajuste", () => T.abrirAccesibilidad && T.abrirAccesibilidad()]]); return; }
    if (!r.texto || Date.now() - r.t > 5 * 60000) return R("Llámame desde la app que estás viendo: con la burbuja, el botón de asistente, el botón «Jarvis» de la cortina o diciendo «Jarvis». Ahí copio lo que hay en la pantalla y me preguntas.");
    const txt = sinNombres(L9.limpiarPantalla(r.texto));
    if (it.pantalla === "leer") return VD().leer(txt, r.app);
    const q = it.pantalla === "pregunta" ? it.q : L9.PANT[it.pantalla];
    return A.dispatch(`${q}\n\n--- Lo que se ve en la pantalla de ${r.app} ---\n${txt}`);
  }

  // ======================================================================== GMAIL
  let ultimos = [], ultimo = null;
  const GM = "https://gmail.googleapis.com/gmail/v1/users/me";
  async function gm(url, opt) {
    const G = X._ || {}; if (!G.gfetch) throw new Error("Google no está disponible.");
    if (!(D.ajustes.google || {}).clienteWeb) throw new Error("Para el correo, primero conecta Google en Ajustes › Google.");
    if (!D.ajustes.google.gmail) { D.ajustes.google.gmail = true; save(); }
    try { return await G.gfetch(url, opt || {}, true); }
    catch (e) { if (/has not been used|disabled|not enabled/i.test(e.message)) throw new Error("Falta activar la «Gmail API» en el proyecto de Google Cloud donde creaste el ID de cliente (APIs y servicios › Biblioteca › Gmail API › Habilitar)."); throw e; }
  }
  async function listar(q, n) {
    const l = await gm(`${GM}/messages?maxResults=${n || 10}&q=${encodeURIComponent(q)}`);
    const ids = (l.messages || []).map((m) => m.id);
    ultimos = await Promise.all(ids.map((id) => gm(`${GM}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)));
    return ultimos;
  }
  async function completo(id) { return gm(`${GM}/messages/${id}?format=full`); }
  async function runGmail(it) {
    try {
      if (it.gmail === "ver") {
        const l = await listar(L9.gmailQuery(""), 10);
        if (!l.length) return R("📭 No tienes correos sin leer de esta semana.");
        return R(`📧 **${l.length} correo${l.length > 1 ? "s" : ""} sin leer:**\n` + l.map((m) => `- **${L9.quien(L9.cabecera(m, "From"))}**: ${L9.cabecera(m, "Subject") || "(sin asunto)"}`).join("\n") + "\n\nDime «léeme el correo de …» o «resume mis correos».", "tool",
          `Tienes ${l.length} correos sin leer. De ${[...new Set(l.slice(0, 3).map((m) => L9.quien(L9.cabecera(m, "From"))))].join(", ")}.`);
      }
      if (it.gmail === "resumen") {
        const l = await listar(L9.gmailQuery(it.cuando), 8);
        if (!l.length) return R("No hay correos para resumir.");
        const full = await Promise.all(l.map((m) => completo(m.id)));
        const ctx = full.map((m, i) => `[${i + 1}] De: ${L9.quien(L9.cabecera(m, "From"))} · Asunto: ${L9.cabecera(m, "Subject")}\n${sinNombres(L9.cuerpo(m)).slice(0, 1500)}`).join("\n\n");
        return A.dispatch(`Resume mis correos en una lista corta: quién escribe, qué quiere y si tengo que hacer algo (y para cuándo). Marca con ⚠️ lo urgente.\n\n${ctx}`);
      }
      if (it.gmail === "leer") {
        const l = await listar(it.de ? `in:inbox from:(${it.de})` : "in:inbox", 1);
        if (!l.length) return R(it.de ? `No encontré correos de ${it.de}.` : "No encontré correos.");
        ultimo = await completo(l[0].id);
        const de = L9.quien(L9.cabecera(ultimo, "From")), as = L9.cabecera(ultimo, "Subject");
        A.add("assistant", `📧 **${de}** — ${as}\n\n${L9.cuerpo(ultimo).slice(0, 3000)}`, "tool");
        return VD().leer(`Correo de ${de}. Asunto: ${as}.\n\n${L9.cuerpo(ultimo)}`, as);
      }
      if (it.gmail === "responder") {
        let m = ultimo;
        if (it.de || !m) { const l = await listar(it.de ? `in:inbox from:(${it.de})` : "in:inbox", 1); if (!l.length) return R("No encontré ese correo.", "err"); m = await completo(l[0].id); }
        const de = L9.quien(L9.cabecera(m, "From"));
        pick(`📧 ¿Le respondo a **${de}** («${L9.cabecera(m, "Subject")}»)?\n\n> ${it.texto}`, [["Sí, enviar", async () => { try { await gm(`${GM}/messages/send`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(L9.respuesta(m, it.texto, D.ajustes.google.cuenta)) }); R(`✅ Le respondí a ${de}.`); } catch (e) { R(e.message || String(e), "err"); } }], ["Cancelar", () => R("No lo envié.")]],
          `¿Le respondo a ${de}: ${it.texto}?`);
      }
    } catch (e) { return R(e.message || String(e), "err"); }
  }

  // ======================================================================== DIARIO Y ÁNIMO
  async function programarDiario() {
    await VD().cancelar(780100, 1);
    const h = D.ajustes.diarioHora; if (!h) return;
    const [hh, mm] = h.split(":").map(Number);
    await VD().programar([{ id: 780100, title: "📔 ¿Cómo te fue hoy?", body: "Toca y cuéntamelo en una frase.", schedule: { on: { hour: hh, minute: mm || 0 }, allowWhileIdle: true }, extra: { diario: true } }]);
  }
  function runDiario(it) {
    D.bitacora = D.bitacora || [];
    if (it.diario === "add") {
      const a = L9.animo(it.texto);
      D.bitacora.push({ t: Date.now(), texto: it.texto.slice(0, 2000), animo: a }); D.bitacora = D.bitacora.slice(-730); save();
      return R(`📔 Guardado en tu diario ${L9.CARA[a]}${a <= 2 ? "\n\nSiento que no fue un buen día. Si quieres contarme más, aquí estoy." : a >= 4 ? "\n\n¡Qué bueno!" : ""}`);
    }
    if (it.diario === "analizar") {
      const l = D.bitacora.filter((e) => Date.now() - e.t < 14 * 864e5);
      if (!l.length) return R("Todavía no tienes entradas recientes en tu diario. Dime «querido diario, …».");
      return A.dispatch("Lee mis entradas del diario de estas dos semanas y dime con cariño y en pocas frases: cómo he estado, qué se repite (lo que me hace bien y lo que me pesa) y una sugerencia pequeña para esta semana. No hagas diagnósticos.\n\n" +
        l.map((e) => `- ${new Date(e.t).toLocaleDateString("es-CO", { weekday: "long", day: "numeric" })}: ${sinNombres(e.texto)}`).join("\n"));
    }
    const s = L9.animoResumen(D.bitacora, Date.now(), it.dias);
    if (!s) return R("No tengo entradas en tu diario en esos días. Dime «querido diario, …» o activa la pregunta de cada noche en *Ajustes › Más*.");
    const ult = D.bitacora.filter((e) => Date.now() - e.t < it.dias * 864e5).slice(-5).reverse();
    return R(`📔 **${it.dias === 7 ? "Esta semana" : "Este mes"}:** ${s.n} entrada${s.n > 1 ? "s" : ""}, ánimo promedio ${s.cara} (${String(s.prom).replace(".", ",")} de 5)${s.buenos ? ` · ${s.buenos} día${s.buenos > 1 ? "s" : ""} buenos` : ""}${s.feos ? ` · ${s.feos} difícil${s.feos > 1 ? "es" : ""}` : ""}.\n\n` +
      ult.map((e) => `- ${L9.CARA[e.animo]} ${new Date(e.t).toLocaleDateString("es-CO", { weekday: "short", day: "numeric" })}: ${e.texto.slice(0, 140)}`).join("\n") + "\n\nSi quieres, dime «analiza mi diario».", "tool", `${it.dias === 7 ? "Esta semana" : "Este mes"} tu ánimo promedio fue de ${String(s.prom).replace(".", ",")} de 5.`);
  }

  // ======================================================================== CONVERSOR
  async function tasas(base) {
    D.tasas = D.tasas || {};
    const c = D.tasas[base];
    if (c && Date.now() - c.t < 12 * 3600e3) return c.r;
    const j = JSON.parse(await VD().http(`https://open.er-api.com/v6/latest/${base}`));
    if (j.result !== "success" || !j.rates) throw new Error("No pude consultar las tasas de cambio.");
    D.tasas[base] = { t: Date.now(), r: j.rates }; save();
    return j.rates;
  }
  async function runConv(it) {
    if (it.conv === "unidad") { const r = L9.convertir(it.n, it.de, it.a); return R(`📏 ${L9.redondo(it.n)} ${it.de} = **${L9.redondo(r)} ${it.a}**${/libra/.test(it.de + it.a) ? " (libra colombiana de 500 g; la inglesa es «lb»)" : ""}`); }
    if (it.conv === "hora") {
      const z = L9.zona(it.lugar); if (!z) return R(`No sé la zona horaria de ${it.lugar}. Prueba con la ciudad principal (Madrid, Miami, Tokio…).`, "err");
      const h = L9.horaEn(z); const dif = h.dif === 0 ? "la misma hora que en Colombia" : `${Math.abs(h.dif)} hora${Math.abs(h.dif) === 1 ? "" : "s"} ${h.dif > 0 ? "más" : "menos"} que en Colombia`;
      return R(`🕐 En ${it.lugar.replace(/\b\w/g, (c) => c.toUpperCase())} es ${h.texto} (${dif}).`);
    }
    if (!navigator.onLine) return R("Para la moneda necesito internet.", "err");
    try {
      const r = await tasas(it.de), k = r[it.a]; if (!k) throw new Error("No tengo esa moneda.");
      const v = it.n * k, f = (x, m) => m === "COP" ? L8.cop(x) : x.toLocaleString("es-CO", { maximumFractionDigits: x < 10 ? 2 : 0 }) + " " + m;
      return R(`💱 ${f(it.n, it.de)} = **${f(v, it.a)}** (tasa de hoy; los bancos y casas de cambio cobran un poco más).`, "tool", `${it.n} ${it.de} son unos ${Math.round(v)} ${it.a === "COP" ? "pesos" : it.a}.`);
    } catch (e) { return R(e.message || String(e), "err"); }
  }

  // ======================================================================== CASA INTELIGENTE
  let estados = [], estT = 0;
  const ha = () => { const h = D.ajustes.ha || {}; return h.url && h.token ? { url: h.url.replace(/\/+$/, ""), token: h.token } : null; };
  async function haReq(method, path, body) {
    const h = ha(); if (!h) throw new Error("Falta configurar Home Assistant en Ajustes › Casa.");
    const H = plug("CapacitorHttp");
    const headers = { Authorization: "Bearer " + h.token, "Content-Type": "application/json" };
    if (H) { const r = await H.request({ method, url: h.url + path, headers, data: body || undefined }); if (r.status >= 400) throw new Error("Home Assistant respondió " + r.status + "."); return typeof r.data === "string" ? JSON.parse(r.data || "null") : r.data; }
    const r = await fetch(h.url + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw new Error("Home Assistant respondió " + r.status + "."); return r.json();
  }
  async function cargarEstados(forzar) {
    if (!ha() || (!forzar && Date.now() - estT < 10 * 60000)) return estados;
    try { estados = (await haReq("GET", "/api/states")) || []; estT = Date.now(); } catch (e) { /* sin conexión con la casa */ }
    return estados;
  }
  const webhooks = () => String(D.ajustes.webhooks || "").split("\n").map((l) => { const m = l.match(/^\s*(.+?)\s*[:=]\s*(https?:\/\/\S+)\s*$/); return m ? { nombre: m[1], url: m[2] } : null; }).filter(Boolean);
  const DISP = /\b(?:luz|luces|lampara|bombillo|foco|ventilador|aire|televisor|tele|tv|enchufe|toma|cortina|persiana|puerta|garaje|porton|calentador|cafetera|aspiradora|parlante|equipo|riego|alarma de la casa)\b/;
  function casaMatch(it) {
    const w = webhooks().find((x) => L9.norm(it.obj).includes(L9.norm(x.nombre)) || L9.norm(x.nombre).includes(L9.norm(it.obj)));
    if (w) return { w };
    if (!ha()) return null;
    const e = L9.entidad(estados, it.obj);
    if (e) return { e };
    return DISP.test(L9.norm(it.obj)) && !estados.length ? { buscar: true } : null;
  }
  async function runCasa(it, m) {
    try {
      if (m.w) { await VD().http(m.w.url); return R(`🏠 Listo: «${m.w.nombre}».`); }
      let e = m.e;
      if (!e) { await cargarEstados(true); e = L9.entidad(estados, it.obj); if (!e) return R(`No encontré «${it.obj}» en tu Home Assistant.`, "err"); }
      const nombre = (e.attributes && e.attributes.friendly_name) || e.entity_id;
      if (it.casa === "estado") { await cargarEstados(true); const x = estados.find((s) => s.entity_id === e.entity_id) || e; return R(`🏠 ${nombre}: ${x.state === "on" ? "prendido" : x.state === "off" ? "apagado" : x.state === "open" ? "abierto" : x.state === "closed" ? "cerrado" : x.state}.`); }
      if (it.casa === "temp") { await haReq("POST", "/api/services/climate/set_temperature", { entity_id: e.entity_id, temperature: it.grados }); return R(`🏠 ${nombre} en ${it.grados} °C.`); }
      const [dom, srv] = L9.servicio(e, it.casa);
      await haReq("POST", `/api/services/${dom}/${srv}`, { entity_id: e.entity_id });
      estT = 0;
      return R(`🏠 ${it.casa === "on" ? (dom === "cover" ? "Abrí" : "Prendí") : (dom === "cover" ? "Cerré" : "Apagué")} ${nombre}.`);
    } catch (er) { return R(er.message || String(er), "err"); }
  }

  // ======================================================================== REPORTAR UN PROBLEMA
  async function reportar(nota) {
    const nombres = [].concat(...D.cursos.map((c) => c.estudiantes || [])).concat(D.ajustes.nombre ? [D.ajustes.nombre] : []);
    const errs = ((window.__jerr && window.__jerr.lista()) || []).map((e) => ({ t: e.t, m: L9.limpiar(e.m, nombres) }));
    const a = D.ajustes, lt = IA.last ? IA.last() : null;
    const prendido = [a.fondo && "escucha de fondo" + (a.fondoCuando ? " (" + a.fondoCuando + ")" : ""), a.manosLibres && "manos libres", a.burbuja && "burbuja", a.vozIA && "voz IA", a.conduccion && "conducción", a.ahorroActivo && "modo ahorro", a.docente !== false && "modo docente", a.gastosAuto && "gastos del banco", (a.buscar || {}).on && "encontrar celular", ha() && "Home Assistant"].filter(Boolean);
    let bat = ""; const E = plug("Escucha"); if (E && E.bateriaEstado) { try { const b = await E.bateriaEstado(); bat = `${b.nivel} %${b.ahorro ? " (ahorro)" : ""}${b.sinRestriccion ? " · sin restricción" : ""}`; } catch (e) { /* nada */ } }
    const txt = L9.reporte({ version: A.VERSION, fecha: new Date().toISOString().slice(0, 16), ua: navigator.userAgent.replace(/\s*\(KHTML.*$/, "").slice(0, 160), proveedor: a.proveedor, respaldo: a.respaldo, ms: lt && lt.ms, prendido, bateria: bat, red: navigator.onLine ? (navigator.connection && navigator.connection.effectiveType) || "sí" : "sin internet", errores: errs, nota: nota ? L9.limpiar(nota, nombres) : "" });
    pick("🛠️ **Informe listo** (sin tus datos: ni nombres, ni claves, ni números).\n\n```\n" + txt.slice(0, 1500) + (txt.length > 1500 ? "\n…" : "") + "\n```", [
      ["Compartir el informe", () => N.share({ title: "Informe de Jarvis", text: txt, fileName: "informe-jarvis.txt", mime: "text/plain", base64: btoa(unescape(encodeURIComponent(txt))) }).catch(() => {})],
      ["Copiar", () => { try { navigator.clipboard.writeText(txt); A.toast("Copiado."); } catch (e) { A.toast("No pude copiar."); } }],
      ["Borrar los errores", () => { if (window.__jerr) window.__jerr.borrar(); A.toast("Borrados."); }]], `Listo el informe, con ${errs.length} errores recientes. Compártelo con quien te ayuda con la app.`);
  }

  // ======================================================================== AJUSTES › MÁS
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-310")) return;
    const sec = mk("div"); sec.id = "aj-310";
    sec.append(mk("h3", "sub", "Más"));
    const lbl = (t) => sec.append(mk("label", "lbl", t));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); sec.append(l); };
    const btn = (t, fn) => { const b = mk("button", "btn", t); b.type = "button"; b.addEventListener("click", fn); return b; };
    const row = mk("div", "row wrap");
    row.append(btn("➕ Botón «Jarvis» en la cortina", async () => { const P = plug("Disparadores"); let ok = false; if (P && P.agregarBoton) { try { ok = (await P.agregarBoton()).pedido; } catch (e) { /* nada */ } } if (!ok) A.toast("Baja la cortina, toca el lápiz (editar) y arrastra «Jarvis» a tus botones.", 7000); }),
      btn("🛠️ Reportar un problema", () => { $("#btn-ajustes-cerrar") && $("#btn-ajustes-cerrar").click(); reportar(""); }));
    sec.append(row);
    lbl("Encontrar el celular: tu clave (al menos 4 letras). Desde otro celular mandas un SMS «Jarvis <clave>»");
    const bc = mk("input", "inp"); bc.placeholder = "Ej.: girasol"; bc.value = (D.ajustes.buscar || {}).clave || ""; sec.append(bc);
    chk("Activar «encontrar mi celular»", (D.ajustes.buscar || {}).on, async (v) => { await buscarCel(v, bc.value); });
    sec.append(btn("🔔 Probar el sonido", () => { const P = plug("Disparadores"); if (P && P.probarSonido) P.probarSonido(); }));
    lbl("La pregunta de cada noche para tu diario (hora, o vacío para no preguntar)");
    const dh = mk("input", "inp tiny"); dh.type = "time"; dh.value = D.ajustes.diarioHora || ""; dh.addEventListener("change", () => { D.ajustes.diarioHora = dh.value; save(); programarDiario(); }); sec.append(dh);
    chk("Rutina de la noche: activar «No molestar»", D.ajustes.nocheDnd !== false, (v) => { D.ajustes.nocheDnd = v; save(); });
    chk("Rutina de la noche: bajar el brillo", D.ajustes.nocheBrillo !== false, (v) => { D.ajustes.nocheBrillo = v; save(); });
    sec.append(mk("h3", "sub", "Casa"));
    sec.append(mk("p", "hint", "Con Home Assistant: «prende la luz de la sala», «apaga el ventilador», «¿está abierta la puerta del garaje?». El token se guarda solo en este celular."));
    const hu = mk("input", "inp"); hu.placeholder = "http://192.168.1.50:8123"; hu.value = (D.ajustes.ha || {}).url || "";
    const ht = mk("input", "inp"); ht.type = "password"; ht.placeholder = "Token de acceso de larga duración"; ht.value = (D.ajustes.ha || {}).token || "";
    const hs = () => { D.ajustes.ha = { url: hu.value.trim(), token: ht.value.trim() }; save(); estT = 0; cargarEstados(true).then((l) => A.toast(l.length ? `Conectado: ${l.length} aparatos.` : "No pude conectar con Home Assistant.")); };
    hu.addEventListener("change", hs); ht.addEventListener("change", hs); sec.append(hu, ht);
    lbl("Otros aparatos con un enlace (IFTTT, Tuya, Alexa…): uno por línea, «Nombre: enlace»");
    const wh = mk("textarea", "inp"); wh.rows = 2; wh.placeholder = "Calentador: https://maker.ifttt.com/trigger/…"; wh.value = D.ajustes.webhooks || ""; wh.addEventListener("change", () => { D.ajustes.webhooks = wh.value; save(); }); sec.append(wh);
    const v = $("#aj-vida"); if (v) v.after(sec); else box.prepend(sec);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, hoyExtra: X.hoyExtra };
  X.intent = function (text) {
    if (cocina) { const c = L9.cocinaCmd(text); if (c) return { cs: "cocina_cmd", c }; }
    const t = L9.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:reporta(?:r)?|reportar|informa)\s+(?:un\s+)?(?:problema|error|falla)/.test(t)) return { cs: "reporte", nota: String(text).replace(/^.*?(?:problema|error|falla)\s*(?:de que|que|:)?\s*/i, "") };
    const ca = L9.carroIntent(text); if (ca) return { cs: "carro", it: ca };
    const pg = L9.pagoIntent(text); if (pg && (pg.pago === "add" || pg.pago === "ver" || buscarPago(pg.nombre))) return { cs: "pago", it: pg };
    const no = L9.nocheIntent(text); if (no && !(D.misHab || []).some((h) => L9.norm(h.frase) === t)) return { cs: "noche", it: no };
    if (/^(?:buenos dias|ya me desperte)$/.test(t) && D.ajustes.nocheDnd !== false) buenosDias();
    const co = L9.cocinaIntent(text); if (co) return { cs: "cocina", it: co };
    const pa = L9.pantallaIntent(text); if (pa) return { cs: "pantalla", it: pa };
    const gm1 = L9.gmailIntent(text); if (gm1) return { cs: "gmail", it: gm1 };
    const di = L9.diarioIntent(text); if (di) return { cs: "diario", it: di };
    const id = L9.idiomaIntent(text); if (id) return { cs: "idioma", it: id };
    const cv = L9.conversorIntent(text); if (cv) return { cs: "conv", it: cv };
    const cs = L9.casaIntent(text); if (cs) { const m = casaMatch(cs); if (m) return { cs: "casa", it: cs, m }; }
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.cs) return base.run(it, text);
    switch (it.cs) {
      case "cocina_cmd": return runCocina(it.c);
      case "reporte": return reportar(it.nota);
      case "carro": {
        const c = it.it;
        if (c.carro === "ver") return carroVer();
        if (c.carro === "guardar") return carroGuardar();
        if (c.carro === "bt") return carroBt(c.nombre);
        if (c.buscar === "on") return buscarCel(true, c.clave);
        if (c.buscar === "off") return buscarCel(false);
        if (c.buscar === "probar") { const P = plug("Disparadores"); if (P && P.probarSonido) P.probarSonido(); return R("🔔 Así suena (tócalo en la notificación para apagarlo)."); }
        break;
      }
      case "pago": { const r = await runPago(it.it); if (r === null) return R("No tengo ese pago anotado. Di «mis pagos».", "err"); return r; }
      case "noche": return noche(it.it);
      case "cocina": return empezarCocina(it.it);
      case "pantalla": return pantalla(it.it);
      case "gmail": return runGmail(it.it);
      case "diario": return runDiario(it.it);
      case "idioma":
        if (!X._live) return R("Para practicar idiomas uso la conversación en vivo de Gemini.", "err");
        R(`🗣️ Practiquemos ${it.it.nombre}. Te hablo en ${it.it.nombre}, te corrijo con cariño y te explico en español cuando haga falta. Para terminar, toca «Colgar».`);
        await V.idle();
        return X._live.start({ sys: L9.tutorPrompt(it.it.nombre, it.it.nivel), titulo: "Clase de " + it.it.nombre });
      case "conv": return runConv(it.it);
      case "casa": return runCasa(it.it, it.m);
    }
  };
  X.hoyExtra = function () {
    const items = base.hoyExtra ? base.hoyExtra() : [];
    if (cocina) items.push({ txt: `👩‍🍳 Paso ${cocina.i + 1}/${cocina.r.pasos.length}`, cls: "run", cmd: "repite" });
    const pend = L9.pagosEstado(D.pagos, Date.now()).filter((p) => !p.pagado && p.en <= 2);
    if (pend.length) items.push({ txt: `💳 ${pend[0].nombre}${pend[0].en < 0 ? " (vencido)" : pend[0].en === 0 ? " hoy" : " en " + pend[0].en + " d"}`, cls: pend[0].en <= 0 ? "warn" : "", cmd: "mis pagos" });
    return items;
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    D.pagos = D.pagos || [];
    try { base.init(api); } catch (e) { console.error("init", e); }
    const l = plug("LocalNotifications");
    if (l) window.JON(l, "localNotificationActionPerformed", (ev) => {
      const ex = (ev && ev.notification && ev.notification.extra) || {};
      if (ex.diario) setTimeout(() => { A.tab("hablar"); R("📔 ¿Cómo te fue hoy? Cuéntame en una frase (empieza con «querido diario» o «hoy fue…»)."); V.idle().then(() => A.listen(true)); }, 600);
    });
    setTimeout(() => { programarPagos(); programarDiario(); if (ha()) cargarEstados(); }, 4000);
    document.addEventListener("visibilitychange", () => { if (document.hidden && cocina) N.keepAwake(false); else if (!document.hidden && cocina) N.keepAwake(true); });
  };
  X._casa = { carroVer, carroGuardar, runPago, noche, empezarCocina, runCocina, pantalla, runGmail, runDiario, runConv, reportar, cargarEstados, estado: () => ({ cocina }) };
})();
