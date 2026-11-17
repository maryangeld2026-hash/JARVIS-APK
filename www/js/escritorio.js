/* Jarvis para Android 3.24 · Nexo Escritorio (el celular como computador en un monitor), en las dos direcciones.
   · Jarvis → Nexo: la pestaña «Escritorio» y las órdenes de voz («abre el escritorio», «abre Chrome a la izquierda en el monitor»,
     «pon el escritorio de trabajo», «busca … en el monitor», «abre el touchpad»…). La IA también puede escribir esas órdenes.
   · Nexo → Jarvis: lo que preguntas en el menú de inicio de Nexo (o el botón de Jarvis en su barra) llega aquí, Jarvis responde
     y le devuelve la respuesta a Nexo, que la muestra en una tarjeta del monitor.
   Nexo solo abre cosas: no paga, no envía, no desinstala. Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L15 = window.JL15;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const P = () => plug("Nexo");
  const cfg = () => (D.nexo = D.nexo || { escenas: "Trabajo: Chrome izquierda, Docs derecha\nCine: YouTube pantalla completa", respuestas: true });
  const escenas = () => L15.escenasDe(cfg().escenas);
  const abrirUrl = (url) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url }).catch(() => {}); window.open(url, "_blank"); };

  // ======================================================================== ESTADO Y RESPUESTAS DE NEXO
  let est = { instalado: false, monitor: "", abierto: false };
  const esperando = new Map();                                                  // id → resolve
  async function refrescar() {
    const p = P(); if (!p) return est;
    try { Object.assign(est, (await p.estado()) || {}); } catch (e) { /* sin Nexo */ }
    pintarTab();
    return est;
  }
  function alResultado(r) {
    Object.assign(est, { monitor: r.monitor != null ? r.monitor : est.monitor, monitorTam: r.monitorTam || est.monitorTam, abierto: !!r.abierto, dondeAbierto: r.dondeAbierto || "", ventanas: r.ventanas || 0, version: r.version || est.version, instalado: true });
    const f = esperando.get(r.id);
    if (f) { esperando.delete(r.id); f(r); }
    pintarTab();
  }
  /** Le manda una orden a Nexo y espera cómo le fue (hasta 6 s; si no contesta, se asume que lo hizo). */
  function orden(accion, extra) {
    const p = P();
    if (!p) return Promise.reject(new Error("El escritorio funciona en la app instalada (el APK), con Nexo Escritorio instalado."));
    const id = "j" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return new Promise((res, rej) => {
      const t = setTimeout(() => { esperando.delete(id); res({ ok: true, mensaje: "", sinRespuesta: true }); }, 6000);
      esperando.set(id, (r) => { clearTimeout(t); res(r); });
      p.orden(Object.assign({ accion, id }, extra || {})).catch((e) => { clearTimeout(t); esperando.delete(id); rej(e); });
    });
  }

  function faltaNexo() {
    const txt = "Para eso necesito **Nexo Escritorio** (convierte el celular en un computador en el monitor o la TV). No está instalado en este celular.";
    const { e } = A.add("assistant", txt, "tool");
    e.innerHTML = A.md(txt);
    const box = mk("div", "doc-acts"), b = mk("button", "chip on", "⬇️ Descargar Nexo Escritorio"); b.type = "button";
    b.addEventListener("click", () => abrirUrl(L15.DESCARGA)); box.append(b); e.append(box);
    A.say("Para eso necesito Nexo Escritorio. Te dejo el enlace para instalarlo.");
  }

  /** Hace una orden para el escritorio (de la voz, de la IA, de la pestaña o de una escena). */
  async function hacer(it, callado) {
    if (!native()) return R("El escritorio funciona en la app instalada (el APK), con Nexo Escritorio instalado.", "err");
    await refrescar();
    if (!est.instalado) return faltaNexo();
    if (it.nx === "apps" || it.nx === "escena") {
      const lista = it.lista || (it.escena && it.escena.apps) || [];
      if (!callado) R(it.escena ? `Pongo el escritorio de ${it.escena.nombre}: ${lista.map((x) => x.app + (x.modo ? " " + L15.NOMBRE_MODO[x.modo] : "")).join(", ")}.` : L15.describir(it));
      const fallas = [];
      for (let k = 0; k < lista.length; k++) {
        let r; try { r = await orden("app", { app: lista[k].app, modo: lista[k].modo || "" }); } catch (e) { return R(e.message, "err"); }
        if (!r.ok) { if (r.codigo === "sin_monitor") return R(r.mensaje, "err"); fallas.push(r.mensaje); }
        if (k < lista.length - 1) await new Promise((ok) => setTimeout(ok, 900));
      }
      if (fallas.length) R(fallas.join(" "), "err");
      return;
    }
    if (it.nx === "estado") {
      let r; try { r = await orden("estado"); } catch (e) { return R(e.message, "err"); }
      const m = r.monitor || est.monitor;
      return R((m ? `🖥️ Monitor conectado: **${m}**${r.monitorTam ? " (" + r.monitorTam + ")" : ""}.` : "🖥️ No hay monitor ni TV conectado.") + " " +
        (r.abierto ? `El escritorio está abierto${r.dondeAbierto === "celular" ? " en el celular" : " en el monitor"}${r.ventanas ? ` con ${r.ventanas} app${r.ventanas > 1 ? "s" : ""} abierta${r.ventanas > 1 ? "s" : ""}` : ""}.` : "El escritorio está cerrado."));
    }
    if (!callado) R(L15.describir(it));
    let r;
    try { r = await orden(it.nx, it.nx === "app" ? { app: it.app, modo: it.modo || "" } : it.nx === "buscar" ? { q: it.q } : null); }
    catch (e) { return R(e.code === "SIN_NEXO" || /no está instalado/.test(e.message || "") ? "Nexo Escritorio no contesta: actualízalo a la versión 1.1 o más nueva (la que trae la conexión con Jarvis)." : (e.message || String(e)), "err"); }
    if (!r.ok) R(r.mensaje || "Nexo no pudo hacerlo.", "err");
  }

  // ======================================================================== NEXO → JARVIS
  let aNexo = null;                                                             // la respuesta que hay que devolverle a Nexo
  async function desdeNexo(e) {
    A.tab("hablar");
    aNexo = { pregunta: (e.texto || "").trim(), hasta: Date.now() + 3 * 60000 };
    if (e.texto && e.texto.trim()) return A.handle(e.texto.trim(), false);
    setTimeout(() => (A.wake ? A.wake() : A.listen(false)), 350);
  }
  const baseReply = X.onReply;
  X.onReply = function (text) {
    try { if (baseReply) baseReply.apply(this, arguments); } finally {
      const x = aNexo;
      if (x && Date.now() < x.hasta && text && cfg().respuestas !== false) {
        aNexo = null;
        const us = document.querySelectorAll("#chat .msg.user"), ult = us.length ? us[us.length - 1].textContent : "";
        const p = P(); if (p) p.responder({ pregunta: x.pregunta || ult.replace(/^🎙️\s*/, ""), texto: String(text) }).catch(() => {});
      }
    }
  };

  // ======================================================================== LA PESTAÑA
  function pintarTab() {
    const v = $("#v-escritorio"); if (!v || v.hidden) return;
    render();
  }
  function render() {
    const v = $("#v-escritorio"); if (!v) return;
    v.innerHTML = "";
    const w = mk("div", "esc");
    // cabecera con el estado
    const h = mk("div", "esc-h");
    const ic = mk("div", "esc-ic", "🖥️");
    const tx = mk("div", "esc-tx");
    tx.append(mk("b", "", "Nexo Escritorio"));
    const sub = !native() ? "Funciona en la app instalada." : !est.instalado ? "No está instalado en este celular." :
      (est.monitor ? `Monitor: ${est.monitor}${est.monitorTam ? " · " + est.monitorTam : ""}` : "Sin monitor conectado") + (est.abierto ? " · escritorio abierto" : "");
    tx.append(mk("span", "", sub));
    const pt = mk("span", "esc-pt" + (est.instalado && est.monitor ? " on" : ""));
    h.append(ic, tx, pt);
    w.append(h);
    if (native() && !est.instalado) {
      w.append(mk("p", "hint", "Nexo convierte el celular en un computador: conectas un monitor o una TV (cable USB-C a HDMI o inalámbrica) y tienes ventanas, barra de tareas, menú de inicio y touchpad. Jarvis lo maneja con la voz y tú le preguntas a Jarvis desde el escritorio."));
      const b = mk("button", "btn", "⬇️ Descargar Nexo Escritorio"); b.type = "button"; b.addEventListener("click", () => abrirUrl(L15.DESCARGA)); w.append(b);
      w.append(mk("p", "hint", "Al abrir el archivo, Android te pide permitir instalar apps de esa fuente. Después vuelve aquí."));
      v.append(w); return;
    }
    // botones grandes
    const g = mk("div", "esc-grid");
    const boton = (ico, t, it) => { const b = mk("button", "esc-b"); b.type = "button"; b.append(mk("span", "esc-bi", ico), mk("span", "", t)); b.addEventListener("click", () => { A.tab("hablar"); A.add("user", "🖥️ " + t); hacer(it); }); g.append(b); };
    boton("🖥️", "Abrir en el monitor", { nx: "abrir" });
    boton("📱", "Escritorio en el celular", { nx: "aqui" });
    boton("🖱️", "Touchpad", { nx: "touchpad" });
    boton("🏠", "Mostrar escritorio", { nx: "mostrar" });
    boton("⊞", "Menú de inicio", { nx: "inicio" });
    boton("🎛️", "Centro de control", { nx: "panel" });
    boton("ℹ️", "¿Cómo está?", { nx: "estado" });
    boton("⏻", "Cerrar escritorio", { nx: "cerrar" });
    w.append(g);
    // abrir una app en el monitor
    w.append(mk("h3", "sub", "Abrir una app en el monitor"));
    const f = mk("form", "esc-app"); f.autocomplete = "off";
    const inp = mk("input", "inp"); inp.placeholder = "Chrome, YouTube, Word…"; inp.id = "esc-app";
    const sel = mk("select", "inp"); [["", "Normal"], ["ventana", "En ventana"], ["maximizada", "Maximizada"], ["izquierda", "A la izquierda"], ["derecha", "A la derecha"], ["completa", "Pantalla completa"]].forEach(([k, t]) => sel.append(new Option(t, k)));
    const go = mk("button", "btn small", "Abrir"); go.type = "submit";
    f.append(inp, sel, go);
    f.addEventListener("submit", (ev) => { ev.preventDefault(); const a = inp.value.trim(); if (!a) return; A.tab("hablar"); A.add("user", `🖥️ Abrir ${a}`); hacer({ nx: "app", app: a, modo: sel.value }); });
    w.append(f);
    // escenas
    w.append(mk("h3", "sub", "Escenas"));
    w.append(mk("p", "hint", "Varias apps acomodadas de una vez. Di «pon el escritorio de trabajo» o toca una."));
    const ce = mk("div", "doc-acts");
    escenas().forEach((s) => { const b = mk("button", "chip", "▶ " + s.nombre); b.type = "button"; b.addEventListener("click", () => { A.tab("hablar"); A.add("user", "🖥️ Escena " + s.nombre); hacer({ nx: "escena", escena: s }); }); ce.append(b); });
    w.append(ce);
    const ta = mk("textarea", "inp esc-esc"); ta.rows = 3; ta.value = cfg().escenas || ""; ta.placeholder = "Trabajo: Chrome izquierda, Docs derecha";
    ta.addEventListener("change", () => { cfg().escenas = ta.value; save(); render(); });
    w.append(ta);
    w.append(mk("p", "hint", "Una escena por línea: «Nombre: app modo, app modo». Modos: izquierda, derecha, maximizada, ventana, pantalla completa."));
    // la IA en las dos direcciones
    w.append(mk("h3", "sub", "Jarvis y el escritorio"));
    const ul = mk("ul", "esc-l");
    ["Dile a Jarvis «organiza el escritorio para estudiar» y la IA acomoda las apps.", "En el menú de inicio de Nexo escribe una pregunta (o empieza con «Jarvis,»): Jarvis responde en una ventana y la respuesta queda en una tarjeta del monitor.", "El botón ✦ de la barra de Nexo abre a Jarvis escuchando."].forEach((t) => ul.append(mk("li", "", t)));
    w.append(ul);
    const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = cfg().respuestas !== false;
    i.addEventListener("change", () => { cfg().respuestas = i.checked; save(); });
    l.append(i, document.createTextNode(" Mostrar en el monitor las respuestas a lo que pregunto desde Nexo")); w.append(l);
    v.append(w);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, promptExtra: X.promptExtra };
  X.intent = function (text) {
    const es = L15.escenaIntent(text, escenas()); if (es) return { t324: 1, nx: "escena", escena: es };
    const it = L15.nexoIntent(text); if (it) return Object.assign({ t324: 1 }, it);
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.t324) return base.run(it, text);
    return hacer(it);
  };
  X.promptExtra = function (q) {
    const p = base.promptExtra ? base.promptExtra(q) : "";
    return est.instalado ? p + L15.prompt(est, escenas()) : p;
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try {
      const box = $("#aj2"); if (!box || $("#aj-324")) return;
      const s = mk("div"); s.id = "aj-324";
      s.append(mk("h3", "sub", "Nexo Escritorio"));
      s.append(mk("p", "hint", "La pestaña «Escritorio» maneja Nexo (el celular como computador en un monitor). " + (est.instalado ? `Nexo ${est.version || ""} instalado.` : "Nexo no está instalado.")));
      const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = D.ajustes.nexoTab !== false;
      i.addEventListener("change", () => { D.ajustes.nexoTab = i.checked; save(); aplicarTab(); });
      l.append(i, document.createTextNode(" Mostrar la pestaña Escritorio")); s.append(l);
      if (!est.instalado) { const b = mk("button", "btn small", "⬇️ Descargar Nexo Escritorio"); b.type = "button"; b.addEventListener("click", () => abrirUrl(L15.DESCARGA)); s.append(b); }
      box.append(s);
      if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes();
    } catch (e) { console.error(e); }
  };
  function aplicarTab() {
    const on = D.ajustes.nexoTab !== false;
    document.body.classList.toggle("sin-escritorio", !on);
    const b = $('.tabs button[data-tab="escritorio"]'); if (b) b.hidden = !on;
    if (!on && document.body.dataset.tab === "escritorio") A.tab("hablar");
  }
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    aplicarTab();
    const b = $('.tabs button[data-tab="escritorio"]');
    if (b) b.addEventListener("click", () => { render(); refrescar(); });
    const p = P();
    if (p && p.addListener) { try { p.addListener("resultado", alResultado); } catch (e) { /* nada */ } }
    refrescar();
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refrescar(); });
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Escritorio/.test(x[0]))) C.push(["🖥️ Escritorio (Nexo)", ["Abre el escritorio", "Abre Chrome a la izquierda en el monitor", "Pon el escritorio de trabajo", "Busca recetas en el monitor", "Abre el touchpad", "¿Está conectado el monitor?"]]);
  };
  X._nexo = { hacer, desdeNexo, refrescar, estado: () => est, render, orden };
})();
