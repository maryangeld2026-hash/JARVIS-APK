/* Jarvis para Android 3.7 · más asistente:
   · solucionario verificado sin internet (motor de álgebra) y verificación de las respuestas de la IA;
   · figuras exactas (triángulos, polígonos, círculos, recta numérica, plano cartesiano, fracciones, ángulos);
   · mensajes personalizados a los acudientes, modo reunión (acta) y «prepara mi clase de mañana»;
   · leer y responder tus mensajes por voz; la voz natural con IA; sincronizar con el Jarvis del PC.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL, L2 = window.JL2, L3 = window.JL3, L4 = window.JL4, L5 = window.JL5, L6 = window.JL6, V = window.JV, N = window.JN, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const native = () => V.native();
  const plug = (n) => (native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const R = (t, cls, sp) => A.reply(t, cls, sp);
  const fmt = (x) => String(x).replace(".", ",");
  const loadScript = (src) => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No pude cargar " + src)); document.head.appendChild(s); });
  async function nerd() { if (!window.nerdamer) await loadScript("vendor/nerdamer.min.js"); return window.nerdamer; }
  const tex = (n, e) => { try { return n(L6.toNerd(e)).toTeX(); } catch (er) { return L6.toTex(e); } };
  function chips(e, list) {
    const box = mk("div", "doc-acts");
    list.forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", fn); box.append(b); });
    e.append(box);
  }

  // ======================================================================== SOLUCIONARIO VERIFICADO
  async function cas(it) {
    const n = await nerd();
    const v = it.v || "x";
    try {
      switch (it.kind) {
        case "cas_resolver": {
          const r = L6.solveEq(n, it.eq, it.v);
          if (!r.ok) return R(r.error, "err");
          const lin = L6.linearSteps(n, it.eq, r.x);
          let md = `**Resolver** $${tex(n, it.eq.split("=")[0])} = ${tex(n, it.eq.split("=")[1])}$\n\n`;
          if (lin) md += lin.pasos.map((p, i) => `${i + 1}. ${p.t}: $${p.m.replace(/⇒/g, "\\Rightarrow").replace(/✓/g, "\\checkmark")}$`).join("\n") + "\n\n";
          md += r.nada ? "No tiene solución real." : `**Solución:** ${r.sol.map((s) => `$${r.x} = ${tex(n, s)}$`).join(", ")}` + (r.dec.some((d) => isFinite(d) && String(d).length > 1 && !Number.isInteger(d)) ? ` (≈ ${r.dec.map((d) => fmt(Math.round(d * 1000) / 1000)).join(", ")})` : "");
          md += "\n\n✓ *Calculado y comprobado en el celular, sin internet.*";
          return R(md, "tool", r.nada ? "No tiene solución real." : `${r.x} igual a ${r.sol.map((s) => fmt(s)).join(" o ")}.`);
        }
        case "cas_sistema": {
          const sol = n.solveEquations(it.eqs.map(L6.toNerd));
          const pares = []; for (let i = 0; i < sol.length; i++) pares.push(sol[i]);
          if (!pares.length) return R("El sistema no tiene solución (o tiene infinitas).", "err");
          const txt = pares.map(([k, val]) => `$${k} = ${tex(n, String(val))}$`).join(", ");
          return R(`**Sistema:**\n${it.eqs.map((e) => `- $${tex(n, e.split("=")[0])} = ${tex(n, e.split("=")[1])}$`).join("\n")}\n\n**Solución:** ${txt}\n\n✓ *Calculado en el celular.*`, "tool", pares.map(([k, val]) => `${k} igual a ${fmt(val)}`).join(", ") + ".");
        }
        case "cas_derivar": { const d = n.diff(L6.toNerd(it.expr), v); return R(`$\\frac{d}{d${v}}\\left(${tex(n, it.expr)}\\right) = ${d.toTeX()}$\n\n✓ *Calculado en el celular.*`, "tool", "La derivada está en la pantalla."); }
        case "cas_integrar": { const d = n(`integrate(${L6.toNerd(it.expr)},${v})`); return R(`$\\int ${tex(n, it.expr)}\\,d${v} = ${d.toTeX()} + C$\n\n✓ *Calculado en el celular.*`, "tool", "La integral está en la pantalla."); }
        case "cas_factorizar": { const d = n(`factor(${L6.toNerd(it.expr)})`); return R(`$${tex(n, it.expr)} = ${d.toTeX()}$`, "tool", "Factorizado. Está en la pantalla."); }
        case "cas_expandir": { const d = n(`expand(${L6.toNerd(it.expr)})`); return R(`$${tex(n, it.expr)} = ${d.toTeX()}$`, "tool", "Listo, está en la pantalla."); }
        case "cas_simplificar": { const d = n(`simplify(${L6.toNerd(it.expr)})`); return R(`$${tex(n, it.expr)} = ${d.toTeX()}$`, "tool", "Simplificado. Está en la pantalla."); }
        case "cas_calcular": {
          const e = n(L6.toNerd(it.expr)).evaluate(), fr = e.text("fractions"), dec = +e.text("decimals");
          const md = `$${tex(n, it.expr)} = ${n(fr).toTeX()}$` + (/\//.test(fr) && isFinite(dec) ? ` $\\approx ${fmt(Math.round(dec * 10000) / 10000)}$` : "");
          return R(md, "tool", `Da ${fmt(fr)}${/\//.test(fr) && isFinite(dec) ? ", más o menos " + fmt(Math.round(dec * 100) / 100) : ""}.`);
        }
        case "cas_verificar": {
          const c = L6.checkEq(n, it.eq, it.v, it.valor);
          if (c.ok == null) return R("No pude revisar esa ecuación: escríbela de nuevo.", "err");
          return R(c.ok ? `✓ Sí: con $${it.v} = ${tex(n, it.valor)}$, los dos lados dan ${fmt(c.izq)}.` : `✗ No: con $${it.v} = ${tex(n, it.valor)}$, el lado izquierdo da ${fmt(c.izq)} y el derecho ${fmt(c.der)}.`, c.ok ? "tool" : "err");
        }
      }
    } catch (e) { return R("No pude con esa expresión: revisa cómo está escrita (usa ^ para potencias y * para multiplicar).", "err"); }
  }
  /** Después de una respuesta de la IA a «resuelve…» o «paso a paso…»: el motor de álgebra la revisa. */
  async function verifyAnswer(e, m) {
    try {
      const q = [...(D.chat || [])].reverse().find((x) => x.role === "user");
      const eq = q && L6.eqIn(q.content);
      if (!eq) return;
      const val = L6.answerValue(m.content);
      if (!val) return;
      const n = await nerd(), c = L6.checkEq(n, eq, "x", val);
      if (c.ok == null) return;
      const badge = mk("div", "verif " + (c.ok ? "ok" : "mal"));
      if (c.ok) badge.textContent = `✓ Verificado en el celular: x = ${fmt(n(val).text("fractions"))} cumple la ecuación.`;
      else { const r = L6.solveEq(n, eq, "x"); badge.textContent = `⚠ Ojo: el motor de álgebra no confirma esa respuesta.${r.ok && r.sol.length ? " La solución es x = " + r.sol.map(fmt).join(" o ") + "." : ""} Revísala antes de proyectarla.`; }
      e.append(badge);
      if (!c.ok) A.say("Ojo: el motor de álgebra no confirma esa respuesta.");
    } catch (er) { /* sin verificación */ }
  }

  // ======================================================================== FIGURAS
  function figure(spec) {
    const f = L6.figSVG(spec);
    if (f.error) return R(f.error, "err");
    const { m, e } = A.add("assistant", f.texto, "tool");
    e.innerHTML = "";
    const box = mk("div", "fig"); box.innerHTML = f.svg; e.append(box);
    const t = mk("div"); t.innerHTML = A.md(f.texto); e.append(t);
    chips(e, [["📽 Proyectar", () => { if (X._ && X._.projectText) { X._.projectText(f.texto); setTimeout(() => { const b = $("#proy-body .p-texto"); if (b) { const g = mk("div", "fig fig-proy"); g.innerHTML = f.svg; b.prepend(g); } }, 50); } }],
      ["🖼️ Compartir imagen", () => png(f.svg).then((b64) => N.share({ title: "Figura", fileName: "figura-jarvis.png", mime: "image/png", base64: b64 })).catch((er) => A.toast("No pude hacer la imagen: " + er.message, 5000))]]);
    A.say(L.forSpeech ? L.forSpeech(f.texto) : f.texto);
    void m;
  }
  function png(svgTxt, scale = 2.5) {
    return new Promise((ok, no) => {
      const img = new Image();
      img.onload = () => { const c = document.createElement("canvas"); c.width = img.width * scale; c.height = img.height * scale; const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/png").split(",")[1]); };
      img.onerror = () => no(new Error("imagen"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt);
    });
  }

  // ======================================================================== ACUDIENTES
  function guardians(c) { D.acudientes = D.acudientes || {}; return (D.acudientes[c.nombre] = D.acudientes[c.nombre] || {}); }
  function findCourse(q) { return (q && L.findCourse(D.cursos, L4.norm(q))) || A.courseFor(null); }
  function editGuardians(c) {
    c = c || A.courseFor(null);
    if (!c) return R("Primero crea un curso con su lista.", "err");
    let sh = $("#acud-sh"); if (!sh) { sh = mk("div", "sheet"); sh.id = "acud-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h"); hd.append(mk("h2", "", `Acudientes de ${c.nombre}`));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => (sh.hidden = true)); hd.append(x);
    const sc = mk("div", "scroll"), g = guardians(c);
    sc.append(mk("p", "hint", "Un estudiante por línea, con el WhatsApp de su acudiente: «Ana Rojas 300 123 4567». Puedes pegar la lista de la planilla. Los números se quedan en este celular."));
    const ta = mk("textarea", "inp"); ta.rows = 12; ta.value = c.estudiantes.map((nm) => `${nm} ${g[nm] || ""}`.trim()).join("\n");
    const st = mk("p", "hint");
    const ok = mk("button", "btn primary", "Guardar"); ok.type = "button";
    ok.addEventListener("click", () => { const r = L6.parseGuardians(ta.value, c.estudiantes); D.acudientes[c.nombre] = r.mapa; save(); sh.hidden = true; R(`Guardé ${Object.keys(r.mapa).length} de ${c.estudiantes.length} acudientes de ${c.nombre}.` + (r.sinEncontrar.length ? ` No encontré en la lista a: ${r.sinEncontrar.join(", ")}.` : "")); });
    sc.append(ta, st); const f = mk("div", "sheet-f"); f.append(ok); inn.append(hd, sc, f); sh.append(inn);
  }
  function sendGuardians(lista, titulo) {
    if (!lista.length) return R("No hay a quién escribirle.", "err");
    const falta = lista.filter((x) => !x.numero);
    let sh = $("#acudm-sh"); if (!sh) { sh = mk("div", "sheet"); sh.id = "acudm-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full"), hd = mk("div", "sheet-h"); hd.append(mk("h2", "", titulo));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => (sh.hidden = true)); hd.append(x);
    const sc = mk("div", "scroll");
    sc.append(mk("p", "hint", "Toca «Abrir WhatsApp» en cada uno: se abre el chat del acudiente con el mensaje listo; envíalo y vuelve aquí para el siguiente. Puedes corregir el texto antes."));
    lista.forEach((it, i) => {
      const card = mk("div", "acud-card" + (i === 0 ? " now" : "")); card.dataset.i = i;
      const h = mk("div", "acud-h"); h.append(mk("b", "", it.nombre), mk("span", "hint", it.numero ? " · " + it.numero : " · sin número"));
      const ta = mk("textarea", "inp"); ta.rows = 6; ta.value = it.mensaje;
      const b = mk("button", "btn " + (it.numero ? "primary" : ""), it.numero ? "💬 Abrir WhatsApp" : "Falta el número"); b.type = "button"; b.disabled = !it.numero;
      b.addEventListener("click", () => {
        const url = `https://wa.me/${L5.waNumber(it.numero)}?text=${encodeURIComponent(ta.value)}`;
        (plug("Ventana") ? plug("Ventana").abrir({ url }) : Promise.resolve(window.open(url))).catch(() => {});
        card.classList.add("hecho"); card.classList.remove("now"); b.textContent = "✓ Abierto";
        const sig = sc.querySelector(`.acud-card[data-i="${i + 1}"]`); if (sig) { sig.classList.add("now"); setTimeout(() => sig.scrollIntoView({ behavior: "smooth", block: "center" }), 600); }
      });
      card.append(h, ta, b); sc.append(card);
    });
    inn.append(hd, sc); sh.append(inn);
    R(`Listos ${lista.length} mensajes${falta.length ? ` (a ${falta.length} les falta el número: dime «acudientes de ${lista[0].curso}» para agregarlo)` : ""}. Toca «Abrir WhatsApp» en cada uno.`, "tool", `Listos ${lista.length} mensajes para los acudientes.`);
  }
  function guardianData(c, nm) {
    const prom = L2.average(c.notas || { actividades: [], valores: {} }, nm);
    const a = L4.countAbsences(D.asistencia || [], c.nombre)[nm];
    let need = null; try { const r = L3.neededToPass(c.notas, nm, D.ajustes.escala.basico || 3); if (r && !r.ya && r.posible) need = r.necesita; } catch (e) { /* nada */ }
    return { nombre: nm, curso: c.nombre, promedio: prom != null ? Math.round(prom * 10) / 10 : "—", faltas: a ? a.faltas : 0, necesita: need, docente: D.ajustes.nombre || "", asignatura: D.ajustes.asignatura || "matemáticas" };
  }
  function guardiansRun(it) {
    const c = findCourse(it.curso);
    if (!c) return R("¿De qué curso?", "err");
    const g = guardians(c);
    if (it.kind === "acud_ver") return editGuardians(c);
    if (!Object.keys(g).length) { R(`Todavía no tengo los números de los acudientes de ${c.nombre}. Pégalos aquí una vez.`); return editGuardians(c); }
    let lista = [];
    if (it.kind === "acud_riesgo") {
      const st = L2.courseStats(c, D.ajustes.escala);
      if (!st.riesgo.length) return R(`Nadie va en riesgo en ${c.nombre}. 🎉`);
      lista = st.riesgo.map((r) => ({ nombre: r.nombre, curso: c.nombre, numero: g[r.nombre], mensaje: L6.guardianMsg("riesgo", Object.assign(guardianData(c, r.nombre), { extra: it.extra })) }));
      return sendGuardians(lista, `Acudientes: en riesgo en ${c.nombre}`);
    }
    if (it.kind === "acud_notas") {
      const n = c.notas || { actividades: [], valores: {} };
      lista = c.estudiantes.map((nm) => { const v = (n.valores || {})[nm] || {}; const d = guardianData(c, nm); d.lineas = n.actividades.map((a) => `• ${a.nombre}: ${typeof v[a.id] === "number" ? fmt(v[a.id]) : "pendiente"}`); return { nombre: nm, curso: c.nombre, numero: g[nm], mensaje: L6.guardianMsg("notas", d) }; });
      return sendGuardians(lista, `Notas para los acudientes de ${c.nombre}`);
    }
    lista = c.estudiantes.map((nm) => ({ nombre: nm, curso: c.nombre, numero: g[nm], mensaje: L6.guardianMsg("libre", Object.assign(guardianData(c, nm), { texto: it.texto.charAt(0).toUpperCase() + it.texto.slice(1) })) }));
    return sendGuardians(lista, `Mensaje a los acudientes de ${c.nombre}`);
  }

  // ======================================================================== MODO REUNIÓN
  let reu = null;
  function meeting() {
    let sh = $("#reu-sh"); if (!sh) { sh = mk("div", "sheet"); sh.id = "reu-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full"), hd = mk("div", "sheet-h"); hd.append(mk("h2", "", "Reunión"));
    const x = mk("button", "icon-btn"); x.type = "button"; x.innerHTML = '<svg><use href="#i-x"/></svg>'; x.addEventListener("click", () => endMeeting(false)); hd.append(x);
    const sc = mk("div", "scroll");
    const st = mk("p", "hint", "Deja el celular en la mesa. Jarvis va escribiendo lo que oye; al final arma el acta con asistentes, temas, acuerdos y tareas. Para el acta, la transcripción se envía a la IA.");
    const tm = mk("p", "reu-t", "00:00"), live = mk("p", "dict-live"), ta = mk("textarea", "inp dict-ta"); ta.rows = 14;
    const row = mk("div", "row wrap");
    const b = (t, fn, cls = "") => { const y = mk("button", "btn " + cls, t); y.type = "button"; y.addEventListener("click", fn); row.append(y); return y; };
    const pb = b("⏸ Pausa", () => { reu.pausa = !reu.pausa; pb.textContent = reu.pausa ? "▶ Seguir" : "⏸ Pausa"; if (reu.pausa) V.cancelListening && V.cancelListening(); else loop(); });
    b("📝 Terminar y hacer el acta", () => endMeeting(true), "primary");
    sc.append(st, tm, live, ta, row); inn.append(hd, sc); sh.append(inn);
    reu = { ta, live, t0: Date.now(), pausa: false, iv: setInterval(() => { const s = Math.floor((Date.now() - reu.t0) / 1000); tm.textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; }, 1000) };
    if (N.keepAwake) N.keepAwake(true);
    loop();
    async function loop() {
      while (reu && !reu.pausa && !sh.hidden) {
        let t = "";
        try { t = await V.listen((p) => { if (reu) reu.live.textContent = "🎙️ " + p; }, { espera: 30000, silencio: 3000 }); } catch (e) { if (reu) reu.live.textContent = e.message; return; }
        if (!reu || reu.pausa) return;
        if (t) { const s = Math.floor((Date.now() - reu.t0) / 60000); reu.ta.value += (reu.ta.value ? "\n" : "") + `[${s} min] ${t}`; reu.ta.scrollTop = reu.ta.scrollHeight; reu.live.textContent = ""; }
      }
    }
  }
  async function endMeeting(acta) {
    const sh = $("#reu-sh"); if (!sh || !reu) return;
    const t = reu.ta.value.trim(); clearInterval(reu.iv); reu.pausa = true; reu = null; sh.hidden = true;
    V.cancelListening && V.cancelListening(); if (N.keepAwake) N.keepAwake(false);
    if (!t) return R("La reunión terminó sin nada transcrito.");
    D.docs = D.docs || []; D.docs.unshift({ id: window.JD.uid(), titulo: "Transcripción de reunión · " + new Date().toLocaleDateString("es-CO"), md: t, fecha: Date.now(), tipo: "reunion" }); save();
    if (!acta) return R("Guardé la transcripción en Material.");
    const { m, e } = A.add("assistant", "Haciendo el acta…", ""); e.classList.add("typing"); A.setState("thinking");
    try {
      const full = await IA.chat({ system: "Eres un secretario muy preciso de reuniones de docentes en Colombia.", messages: [{ role: "user", content: L6.meetingPrompt(t) }], maxTokens: 3000, stream: false });
      m.content = full; e.classList.remove("typing"); e.innerHTML = A.md(full);
      const doc = { id: window.JD.uid(), titulo: "Acta de reunión · " + new Date().toLocaleDateString("es-CO"), md: "# Acta de reunión\n\n" + full, fecha: Date.now(), tipo: "acta" };
      D.docs.unshift(doc); save();
      if (X._h && X._h.docActions) e.append(X._h.docActions(doc));
      A.say("Listo el acta de la reunión. La guardé en Material.");
    } catch (er) { e.classList.remove("typing"); e.classList.add("err"); m.content = er.message; e.textContent = er.message + " (La transcripción quedó guardada en Material.)"; }
    save(); if (A.getState() === "thinking") A.setState("idle");
  }

  // ======================================================================== PREPARA MI CLASE DE MAÑANA
  async function fullClass(it) {
    const c = findCourse(it.curso);
    const curso = c ? c.nombre : it.curso.toUpperCase();
    let tema = it.tema;
    if (!tema) {
      const ult = (D.diario || []).filter((x) => L4.norm(x.curso) === L4.norm(curso)).sort((a, b) => b.t - a.t)[0];
      if (!ult) { const i = $("#in-texto"); i.value = `prepárame la clase de ${it.cuando === "hoy" ? "hoy" : "mañana"} de ${curso} sobre `; i.focus(); return R(`¿De qué tema es la clase de ${curso}? Escríbelo y te preparo todo.`); }
      tema = `lo que sigue después de «${ult.texto}»`;
    }
    R(`Preparo la clase de ${it.cuando === "hoy" ? "hoy" : "mañana"} de ${curso}: plan, quiz corto y ticket de salida. Dame un momento.`);
    const pasos = [[`planéame la clase de ${tema} para ${curso}`, "plan"], [`hazme un quiz de 5 preguntas de ${tema} para ${curso}`, "quiz"], [`ticket de salida de ${tema}`, "ticket"]];
    const hecho = [];
    for (const [orden, k] of pasos) { try { await A.handle(orden, false); hecho.push(k); } catch (e) { /* sigue con el siguiente */ } }
    if (X._ && X._.closeProjector) X._.closeProjector();              // es para mañana: el ticket no se proyecta ahora
    R(`**Clase de ${curso} lista:**\n- 📄 Plan de clase (en Material)\n- 📝 Quiz de 5 preguntas (en Quices, con hojas de burbujas y práctica con QR)\n- 🎟️ Ticket de salida (para el proyector)\n\nSi quieres, di «modo proyector» en clase.`, "tool", `Listo: el plan, el quiz y el ticket de salida de ${curso}.`);
  }

  // ======================================================================== LEER Y RESPONDER MENSAJES
  let leidos = [], ultimoLeido = 0;
  function msgIntent(text) {
    const raw = String(text || "").trim().replace(/^(?:jarvis|oye jarvis)[,\s]+/i, ""), t = L4.norm(raw);
    let m;
    if (/^(?:que me escribieron|que me han escrito|leeme (?:los|mis) mensajes|lee (?:los|mis) mensajes|tengo mensajes(?: nuevos)?|(?:hay )?mensajes nuevos|que mensajes tengo|quien me escribio)$/.test(t) || /^(?:leeme|lee)\s+(?:los\s+)?(?:mensajes\s+de\s+)?whatsapp$/.test(t)) return { kind: "msg_leer", solo: /whatsapp/.test(t) ? "whatsapp" : "" };
    if ((m = raw.match(/^(?:resp[oó]nde(?:le)?|cont[eé]sta(?:le)?|resp[oó]ndele)\s+(?:a\s+(.+?)\s+)?(?:que\s+|diciendo(?:le)?\s+(?:que\s+)?|:\s*)(.+)$/i))) return { kind: "msg_responder", quien: (m[1] || "").trim(), texto: m[2].trim() };
    return null;
  }
  async function readMsgs(it) {
    const M = plug("Mensajes"); if (!M) return R("Leer tus mensajes funciona en la app instalada (el APK).", "err");
    const r = await M.recientes({ desde: Math.max(ultimoLeido, Date.now() - 12 * 3600e3) });
    if (r.sinPermiso) {
      const { e } = A.add("assistant", "Para leerte los mensajes, Android necesita que le des a Jarvis el «Acceso a notificaciones». Jarvis solo los lee en voz alta y te ayuda a responder; no los guarda ni los envía a ningún lado.", "tool");
      chips(e, [["Dar el permiso", () => M.permiso()]]); A.say("Necesito el permiso de acceso a notificaciones. Toca el botón.");
      return;
    }
    let l = (r.lista || []).sort((a, b) => a.t - b.t);
    if (it.solo) l = l.filter((x) => /whatsapp/i.test(x.app));
    if (!l.length) return R("No tienes mensajes nuevos.");
    leidos = l; ultimoLeido = Date.now();
    const md = l.map((x) => `- **${x.de}** (${x.app}, ${new Date(x.t).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}): ${x.texto}`).join("\n");
    const voz = l.slice(-6).map((x) => `${x.de}${/whatsapp/i.test(x.app) ? " por WhatsApp" : ""}: ${x.texto}`).join(". ");
    R(`**Mensajes nuevos (${l.length}):**\n${md}\n\nPara responder: «respóndele a ${l[l.length - 1].de.split(" ")[0]} que…»`, "tool", (l.length > 6 ? `Tienes ${l.length} mensajes. Los últimos: ` : "") + voz + ".");
  }
  async function replyMsg(it) {
    const M = plug("Mensajes"); if (!M) return R("Responder mensajes funciona en la app instalada.", "err");
    if (!leidos.length) { const r = await M.recientes({ desde: Date.now() - 12 * 3600e3 }); leidos = (r.lista || []).sort((a, b) => a.t - b.t); }
    const cands = leidos.filter((x) => x.puedeResponder);
    const m = it.quien ? L5.bestMatch(it.quien, cands.map((x) => Object.assign({ nombre: x.de }, x))) : cands[cands.length - 1];
    if (!m) return R(it.quien ? `No tengo un mensaje reciente de «${it.quien}» que se pueda responder desde aquí.` : "No tengo un mensaje reciente para responder.", "err");
    const C = X._c36;
    const send = async () => { await M.responder({ clave: m.clave, texto: it.texto }); R(`Respondido a ${m.de}: «${it.texto}».`); };
    if (C && C.answer) {
      // usa la confirmación de control.js («sí» / «no»)
      const { e } = A.add("assistant", `¿Le respondo a **${m.de}** (${m.app}): «${it.texto}»?`, "tool"); e.innerHTML = A.md(e.textContent);
      chips(e, [["Sí, enviar", async () => { try { await send(); } catch (er) { R(er.message, "err"); } }], ["No", () => R("Listo, no lo envío.")]]);
      A.say(`¿Le respondo a ${m.de}: ${it.texto}?`);
    } else await send();
  }

  // ======================================================================== VOZ NATURAL CON IA
  let actx = null, fuente = null;
  const ctx = () => (actx = actx || new (window.AudioContext || window.webkitAudioContext)());
  const cache = new Map();
  let ttsModel = {};
  function namesIn(text) {
    const t = L4.norm(text);
    return (D.cursos || []).some((c) => (c.estudiantes || []).some((n) => { const p = L4.norm(n).split(" ").filter((w) => w.length > 2); return p.length >= 2 ? p.filter((w) => t.includes(w)).length >= 2 : false; }));
  }
  async function geminiTTS(text, key) {
    if (!ttsModel.gemini) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
      const ids = ((await r.json()).models || []).map((m) => String(m.name).replace(/^models\//, "")).filter((x) => /tts/i.test(x));
      ttsModel.gemini = ids.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a))[0] || "gemini-2.5-flash-preview-tts";
    }
    const body = { contents: [{ role: "user", parts: [{ text: "Dilo en español de Colombia, con voz cálida y natural: " + text }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: D.ajustes.vozIAnombre || "Kore" } } } } };
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${ttsModel.gemini}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("tts " + r.status);
    const j = await r.json(), p = (((j.candidates || [])[0] || {}).content || {}).parts || [], a = p.find((x) => x.inlineData || x.inline_data);
    if (!a) throw new Error("sin audio");
    const d = a.inlineData || a.inline_data, rate = +((String(d.mimeType || d.mime_type).match(/rate=(\d+)/) || [])[1] || 24000);
    const bin = Uint8Array.from(atob(d.data), (c) => c.charCodeAt(0)), pcm = new Int16Array(bin.buffer, 0, bin.length >> 1);
    const buf = ctx().createBuffer(1, pcm.length, rate), ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    return buf;
  }
  async function openaiTTS(text, key) {
    const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: D.ajustes.vozIAnombre || "nova", input: text, response_format: "mp3", instructions: "Habla en español de Colombia, con calidez y naturalidad." }) });
    if (!r.ok) throw new Error("tts " + r.status);
    return ctx().decodeAudioData(await r.arrayBuffer());
  }
  const speaker = {
    prepare(text) {
      const p = D.ajustes.vozIA, key = p && (D.ajustes.claves[p] || "").trim();
      if (!p || !key || !navigator.onLine || text.length > 600 || namesIn(text)) return null;      // los nombres de estudiantes nunca van a la IA
      if (cache.has(p + text)) return Promise.resolve(cache.get(p + text));
      const pr = (p === "openai" ? openaiTTS(text, key) : geminiTTS(text, key)).then((b) => { cache.set(p + text, b); if (cache.size > 80) cache.delete(cache.keys().next().value); return b; });
      return pr.catch(() => null);
    },
    play(buf) {
      return new Promise((ok) => {
        const c = ctx(); if (c.state === "suspended") c.resume();
        const s = c.createBufferSource(); s.buffer = buf; s.playbackRate.value = Math.max(0.7, Math.min(1.5, +D.ajustes.velocidad || 1));
        s.connect(c.destination); s.onended = () => { if (fuente === s) fuente = null; ok(); }; fuente = s; s.start();
      });
    },
    stop() { if (fuente) { try { fuente.stop(); } catch (e) { /* ya paró */ } fuente = null; } },
  };

  // ======================================================================== SINCRONIZAR CON EL PC
  async function syncPC() {
    const link = L2.pcLink(D.ajustes.pc);
    if (!link) return R("Para sincronizar, en Ajustes › «El Jarvis del computador» pega la dirección del panel del celular de tu Jarvis de Windows (la del QR). Los dos deben estar en el mismo wifi.", "err");
    const H = plug("CapacitorHttp");
    const req = async (method, data) => {
      if (H) {
        const r = await H.request({ url: link.base + "/api/sync", method, headers: { "X-Jarvis-Token": link.token, "content-type": "application/json" }, data, connectTimeout: 8000, readTimeout: 60000 });
        if (r.status === 403) throw new Error("El computador no aceptó la clave: copia otra vez la dirección del panel del celular.");
        if (r.status === 404) throw new Error("Tu Jarvis del computador no sabe sincronizar todavía: actualízalo a la versión que trae «/api/sync».");
        if (r.status >= 400) throw new Error("El computador respondió con un error (" + r.status + ").");
        return typeof r.data === "string" ? JSON.parse(r.data) : r.data;
      }
      const r = await fetch(link.base + "/api/sync", { method, headers: { "X-Jarvis-Token": link.token, "content-type": "application/json" }, body: data ? JSON.stringify(data) : undefined });
      if (!r.ok) throw new Error(r.status === 404 ? "Tu Jarvis del computador no sabe sincronizar todavía: actualízalo." : "El computador respondió con un error (" + r.status + ").");
      return r.json();
    };
    try {
      A.toast("Sincronizando con el computador…");
      const pc = await req("GET");
      const aqui = L6.fromPC(D, pc, window.JD.uid);
      const res = await req("POST", L6.toPC(D));
      const alla = res.mezclado || {};
      save(); D.ajustes.sincro = Date.now();
      const txt = (r) => [r.cursos && `${r.cursos} curso${r.cursos > 1 ? "s" : ""}`, r.estudiantes && `${r.estudiantes} estudiante${r.estudiantes > 1 ? "s" : ""}`, r.notas && `${r.notas} nota${r.notas > 1 ? "s" : ""}`, r.fallas && `${r.fallas} falla${r.fallas > 1 ? "s" : ""}`, r.observador && `${r.observador} anotacion${r.observador > 1 ? "es" : ""}`].filter(Boolean).join(", ") || "nada nuevo";
      R(`🔄 Sincronizado con el computador.\n- Al celular llegó: ${txt(aqui)}.\n- Al computador llegó: ${txt(alla)}.\n\nNo se borró nada; si una nota estaba distinta en los dos, cada uno conservó la suya.`, "tool", "Listo, sincronizado con el computador.");
    } catch (e) {
      R(e.message && /clave|actualiz|error/.test(e.message) ? e.message : "No pude hablar con el computador: debe estar prendido, con Jarvis abierto y en el mismo wifi que el celular.", "err");
    }
  }

  // ======================================================================== AJUSTES
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-37")) return;
    const sec = mk("div"); sec.id = "aj-37";
    const h3 = (t) => sec.append(mk("h3", "sub", t));
    const button = (t, fn) => { const b = mk("button", "btn", t); b.type = "button"; b.addEventListener("click", fn); return b; };
    h3("Voz natural con IA");
    sec.append(mk("p", "hint", "Las respuestas de la IA con una voz mucho más natural que la del celular. Usa tu clave de Gemini o de ChatGPT y necesita internet; si no hay, habla la voz del celular. Lo que diga nombres de estudiantes siempre lo dice la voz del celular (los nombres no van a la IA)."));
    const vs = mk("select", "inp"); [["", "No: la voz del celular"], ["gemini", "Sí, con Gemini"], ["openai", "Sí, con ChatGPT"]].forEach(([k, t]) => vs.append(new Option(t, k)));
    vs.value = D.ajustes.vozIA || "";
    const vn = mk("select", "inp");
    const fillNames = () => { vn.textContent = ""; (vs.value === "openai" ? ["nova", "shimmer", "alloy", "coral", "sage", "echo", "onyx"] : ["Kore", "Aoede", "Leda", "Callirrhoe", "Puck", "Charon", "Fenrir", "Orus"]).forEach((k) => vn.append(new Option("Voz: " + k, k))); vn.value = D.ajustes.vozIAnombre && [...vn.options].some((o) => o.value === D.ajustes.vozIAnombre) ? D.ajustes.vozIAnombre : vn.options[0].value; vn.hidden = !vs.value; };
    fillNames();
    vs.addEventListener("change", () => { D.ajustes.vozIA = vs.value; fillNames(); D.ajustes.vozIAnombre = vn.value; save(); cache.clear(); if (vs.value && !(D.ajustes.claves[vs.value] || "").trim()) A.toast("Pon arriba la clave de " + (vs.value === "openai" ? "ChatGPT" : "Gemini") + ".", 5000); V.hush(); V.say("Hola, así sueno con la voz natural."); });
    vn.addEventListener("change", () => { D.ajustes.vozIAnombre = vn.value; save(); cache.clear(); V.hush(); V.say("Hola, así sueno ahora."); });
    sec.append(vs, vn);
    h3("Mensajes");
    const ms = mk("span", "hint");
    const r1 = mk("div", "row wrap"); r1.append(button("Dar el acceso a notificaciones", () => plug("Mensajes") ? plug("Mensajes").permiso() : A.toast("Funciona en la app instalada.")), ms); sec.append(r1);
    sec.append(mk("p", "hint", "Para «¿qué me escribieron?» y «respóndele que…» (WhatsApp, SMS, Telegram, correo). Jarvis solo los lee en voz alta; no los guarda ni los envía a ningún lado."));
    if (plug("Mensajes")) plug("Mensajes").activo().then((r) => { ms.textContent = r.activo ? "Activo ✓" : "Apagado"; }).catch(() => {});
    h3("Sincronizar con el computador");
    sec.append(mk("p", "hint", "Cursos, notas, fallas y observador, en los dos sentidos, por el wifi. No borra nada." + (D.ajustes.sincro ? ` Última vez: ${new Date(D.ajustes.sincro).toLocaleString("es-CO")}.` : "")));
    const r2 = mk("div", "row wrap"); r2.append(button("🔄 Sincronizar ahora", () => { $("#ajustes").hidden = true; syncPC(); })); sec.append(r2);
    h3("Seguridad de los datos");
    sec.append(mk("p", "hint", window.JD.cifrado && window.JD.cifrado() ? "🔒 Tus datos están cifrados en este celular (AES-256), con una llave que guarda Android y que no sale del celular. Las copias que tú guardas (Drive, Documentos) van sin cifrar, para poder abrirlas en otro celular: guárdalas en un lugar seguro." : "En la app instalada, los datos se guardan cifrados."));
    box.prepend(sec);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, afterAnswer: X.afterAnswer };
  X.intent = function (text) {
    const c = L6.casIntent(text); if (c) return Object.assign({ x37: true }, c);
    const f = L6.figIntent(text); if (f) return { x37: true, kind: "figura", spec: f };
    const g = L6.guardianIntent(text); if (g) return Object.assign({ x37: true }, g);
    const mt = L6.meetingIntent(text); if (mt) return Object.assign({ x37: true }, mt);
    const ms = msgIntent(text); if (ms) return Object.assign({ x37: true }, ms);
    if (/^(?:sincroniza(?:te)?|sincronizar)(?:\s+con\s+el\s+(?:computador|pc|portatil))?$/.test(L4.norm(text).replace(/^jarvis\s+/, ""))) return { x37: true, kind: "sync" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.x37) return base.run(it, text);
    try {
      if (/^cas_/.test(it.kind)) return await cas(it);
      if (it.kind === "figura") return figure(it.spec);
      if (/^acud_/.test(it.kind)) return guardiansRun(it);
      if (it.kind === "reunion") return meeting();
      if (it.kind === "clase_completa") return await fullClass(it);
      if (it.kind === "msg_leer") return await readMsgs(it);
      if (it.kind === "msg_responder") return await replyMsg(it);
      if (it.kind === "sync") return await syncPC();
    } catch (e) { R(e.message || String(e), "err"); }
  };
  X.afterAnswer = function (e, m) { if (base.afterAnswer) base.afterAnswer(e, m); verifyAnswer(e, m); };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D; D.acudientes = D.acudientes || {};
    try { base.init(api); } catch (e) { console.error("init", e); }
    if (V.setSpeaker) V.setSpeaker(speaker);
    const lr = $(".lista-row");
    if (lr && !$("#btn-acud")) { const b = mk("button", "btn", "📱 Acudientes"); b.type = "button"; b.id = "btn-acud"; b.addEventListener("click", () => editGuardians(null)); lr.append(b); }
    const menu = $("#adj-menu");
    if (menu && !menu.querySelector("[data-reu]")) { const o = mk("button", "adj-op"); o.type = "button"; o.dataset.reu = "1"; o.append(mk("span", "adj-ic", "👥"), mk("span", "", "Modo reunión (hace el acta)")); o.addEventListener("click", () => { menu.hidden = true; meeting(); }); menu.append(o); }
  };
  X._x37 = { cas, figure, png, guardiansRun, editGuardians, meeting, endMeeting, fullClass, readMsgs, replyMsg, syncPC, speaker, verifyAnswer };
})();
