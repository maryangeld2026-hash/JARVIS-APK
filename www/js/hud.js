/* Jarvis para Android 2.2 · el HUD del Jarvis del computador, en el celular, y «Jarvis» en segundo plano.
   · Reactor animado (los anillos giran, laten y cambian de color según lo que hace Jarvis), luces de estado
     (micrófono, IA, internet, escucha de fondo) y panel «Hoy» con sugerencias según el momento, como en el HUD.
   · La burbuja flotante muestra el estado con el color del aro y la última respuesta en un globo.
   · «Jarvis» en segundo plano: el servicio nativo Escucha (Vosk, sin internet) abre la app cuando te oye.
   Se engancha a window.JX (app2.js), que a su vez se engancha a app.js. */
(function () {
  "use strict";
  const L = window.JL, L2 = window.JL2, V = window.JV, N = window.JN, IA = window.JIA;
  const X = window.JX;
  if (!X) return;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const native = () => V.native();
  const plug = (n) => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;

  // ======================================================================== REACTOR Y LUCES (como el HUD)
  function reactor() {
    const mic = $("#btn-mic");
    if (!mic || mic.querySelector(".rx")) return;
    mic.classList.add("reactor");
    mic.insertAdjacentHTML("afterbegin",
      '<svg class="rx" viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="rx-ticks" cx="50" cy="50" r="46"/>' +
      '<g class="rx-a"><circle class="rx-arc-a" cx="50" cy="50" r="38"/></g>' +
      '<g class="rx-b"><circle class="rx-arc-b" cx="50" cy="50" r="30"/></g>' +
      '<circle class="rx-in" cx="50" cy="50" r="22"/><circle class="rx-core" cx="50" cy="50" r="17"/></svg>');
  }
  function leds() {
    if ($("#leds")) return;
    const box = mk("div", "leds"); box.id = "leds";
    [["mic", "Micrófono"], ["ia", "Inteligencia artificial"], ["red", "Internet"], ["fondo", "«Jarvis» en segundo plano"]].forEach(([k, t]) => {
      const i = mk("i"); i.id = "led-" + k; i.title = t; box.append(i);
    });
    $("#status").before(box);
    window.addEventListener("online", paintLeds); window.addEventListener("offline", paintLeds);
  }
  let iaOk = null, fondoOn = false;
  function paintLeds() {
    const set = (k, s) => { const e = $("#led-" + k); if (e) e.dataset.s = s; };
    const st = A ? A.getState() : "idle";
    set("mic", st === "listening" ? "on" : "idle");
    set("ia", !(D.ajustes.claves[D.ajustes.proveedor] || "").trim() ? "off" : iaOk === false ? "err" : st === "thinking" ? "warn" : "on");
    set("red", navigator.onLine ? "on" : "err");
    set("fondo", fondoOn ? (fondoPausa ? "warn" : "on") : "off");
  }

  // ======================================================================== PANEL «HOY» Y SUGERENCIAS
  function hoy() {
    let box = $("#hoy");
    if (!box) {
      box = mk("div", "hoy"); box.id = "hoy";
      $("#chat").before(box);
      box.addEventListener("click", (e) => { const c = e.target.closest("[data-cmd]"); if (c) { e.preventDefault(); A.handle(c.dataset.cmd, false); } });
    }
    const now = new Date(), h = now.getHours();
    box.textContent = "";
    const top = mk("div", "hoy-top");
    const hb = mk("b", "", now.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })); hb.id = "hoy-h";
    top.append(hb, mk("span", "", now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })));
    box.append(top);
    const items = mk("div", "hoy-items");
    const t = A.timer;
    if (t && t.end) { const tm = mk("span", "hi run", "⏱ " + L.fmtClock(Math.max(0, Math.ceil((t.end - Date.now()) / 1000)))); tm.id = "hoy-t"; tm.dataset.cmd = "¿cuánto falta?"; items.append(tm); }
    const next = D.recordatorios.filter((r) => !r.avisado && r.cuando > Date.now()).sort((a, b) => a.cuando - b.cuando)[0];
    if (next) items.append(mk("span", "hi", "⏰ " + next.texto.slice(0, 28) + " · " + new Date(next.cuando).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })));
    const c = A.courseFor(null);
    if (c && c.notas && c.notas.actividades && c.notas.actividades.length) {
      const st = L2.courseStats(c, D.ajustes.escala);
      if (st.riesgo.length) { const r = mk("span", "hi warn", `⚠ ${st.riesgo.length} en riesgo en ${c.nombre}`); r.dataset.cmd = `¿quiénes están en riesgo en ${c.nombre}?`; items.append(r); }
    }
    if (D.tutor && D.tutor.on) items.append(mk("span", "hi", "🎓 Tutor" + (D.tutor.tema ? " · " + D.tutor.tema : "")));
    if (window.JX.hoyExtra) window.JX.hoyExtra().forEach((x) => { const e = mk("span", "hi" + (x.cls ? " " + x.cls : ""), x.txt); if (x.cmd) e.dataset.cmd = x.cmd; items.append(e); });
    if (items.childElementCount) box.append(items);
    // sugerencias según el momento del día (como los botones del HUD)
    const sug = h < 7 ? ["¿Qué tengo hoy?", "Recuérdame llevar las guías a las 7"] : h < 13 ? [c ? `Escoge un estudiante de ${c.nombre}` : "Escoge un estudiante", "Pon 5 minutos", "Haz 4 grupos", "Modo proyector"]
      : h < 18 ? [c ? `¿Quiénes están en riesgo en ${c.nombre}?` : "¿Quiénes están en riesgo?", "Hazme un quiz de 5 preguntas de fracciones", "Ticket de salida de fracciones"] : ["¿Qué tengo mañana?", "Hazme un taller de ecuaciones", "¿Qué sabes de mí?"];
    const chips = mk("div", "hoy-chips");
    sug.forEach((x) => { const b = mk("button", "chip", x); b.type = "button"; b.dataset.cmd = x; chips.append(b); });
    box.append(chips);
  }

  let hadTimer = false;
  function tickHoy() {
    const hb = $("#hoy-h"); if (hb) hb.textContent = new Date().toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
    const t = A.timer, on = !!(t && t.end), tm = $("#hoy-t");
    if (on !== hadTimer) { hadTimer = on; hoy(); return; }
    if (on && tm) tm.textContent = "⏱ " + L.fmtClock(Math.max(0, Math.ceil((t.end - Date.now()) / 1000)));
  }

  // ======================================================================== BURBUJA CON ESTADO
  function bubbleState(modo, texto) {
    const B = native() && plug("Burbuja");
    if (!B || !D.ajustes.burbuja) return;
    B.estado({ modo, texto: texto || "" }).catch(() => {});
  }

  // ======================================================================== «JARVIS» EN SEGUNDO PLANO
  let fondoPausa = false, despierto = false, idleDesde = 0;
  const E = () => native() && plug("Escucha");
  async function fondo(on, talk) {
    const S = E();
    const say = (m, cls) => (talk ? A.reply(m, cls) : A.toast(m, 6000));
    if (!S) { if (on) say("«Jarvis» en segundo plano funciona en la app instalada (el APK). Aquí puedes usar «manos libres» con la app abierta."); return false; }
    if (!on) { await S.desactivar(); window.__jarvisFondo = false; fondoOn = false; D.ajustes.fondo = false; save(); paintLeds(); renderFondo(); if (talk) A.reply("Listo, ya no escucho en segundo plano."); return true; }
    try {
      let m = await S.modelo();
      if (!m.superponer) {
        say("Para abrirme cuando digas «Jarvis» estando en otra app, Android necesita «Mostrar sobre otras apps». Te abro esa opción: actívala para Jarvis y vuelve a pedírmelo.");
        const B = plug("Burbuja"); if (B) await B.pedirPermiso();
        return false;
      }
      if (!m.listo) {
        if (!navigator.onLine) { say("Para preparar la escucha sin internet necesito descargar una vez el modelo de voz (unos 40 MB). Conéctate a internet, mejor por wifi.", "err"); return false; }
        A.toast("Descargando el modelo de voz para escuchar sin internet (unos 40 MB, una sola vez)…", 8000);
        const h = await S.addListener("progreso", (d) => { const p = d && d.p; const el = $("#fondo-st"); if (el && p >= 0) el.textContent = `Descargando el modelo de voz… ${p}%`; });
        try { await S.descargar(); } finally { h && h.remove && h.remove(); }
      }
      await S.activar();
      fondoOn = true; fondoPausa = false; D.ajustes.fondo = true; save(); paintLeds(); renderFondo(); window.__jarvisFondo = true;
      m = await S.modelo();
      const extra = m.bateria ? "" : " Para que Android no me apague, en Ajustes › Segundo plano toca «Que Android no lo apague».";
      if (talk) A.reply("Listo: aunque estés en otra app o con la pantalla apagada, di «Jarvis» y te escucho. Verás un aviso fijo de Jarvis mientras escucho." + extra);
      return true;
    } catch (e) { say("No pude activar la escucha en segundo plano: " + (e.message || e), "err"); return false; }
  }
  async function beforeListen() {
    const S = E();
    if (S && fondoOn && !fondoPausa) { fondoPausa = true; paintLeds(); try { await S.pausar(); } catch (e) { /* nada */ } await new Promise((r) => setTimeout(r, 250)); }
  }
  function resumeLater() {
    const S = E();
    if (!S || !fondoOn || !fondoPausa) return;
    const st = A.getState();
    if (st !== "idle" || V.isSpeaking()) { idleDesde = 0; return; }
    if (!idleDesde) { idleDesde = Date.now(); return; }
    if (Date.now() - idleDesde > 3000) { idleDesde = 0; fondoPausa = false; despierto = false; paintLeds(); S.reanudar().catch(() => {}); }
  }
  function onWake(d) {
    fondoPausa = true; despierto = true; paintLeds();
    A.tab("hablar");
    const rest = String((d && d.resto) || "").trim();
    if (rest.split(/\s+/).length >= 2) { A.handle(rest, true); return; }
    V.say("¿Sí?");
    setTimeout(() => A.listen(false), 700);
  }
  function renderFondo() {
    const st = $("#fondo-st"), b = $("#fondo-chk");
    if (b) b.checked = !!D.ajustes.fondo;
    if (st) st.textContent = fondoOn ? (fondoPausa ? "En pausa mientras conversamos." : "Escuchando «Jarvis» en segundo plano.") : "Apagado.";
  }

  // ======================================================================== ENGANCHES
  const baseInit = X.init, baseSettings = X.settings;
  X.init = function (api) {
    baseInit(api);
    A = api; D = api.D;
    reactor(); leds(); hoy(); paintLeds();
    setInterval(() => { tickHoy(); resumeLater(); paintLeds(); }, 1000);
    setInterval(hoy, 30000);
    const S = E();
    if (S) {
      S.addListener("despertar", onWake).catch(() => {});
      S.addListener("error", (d) => A.toast("Escucha en segundo plano: " + ((d && d.valor) || "error"), 6000)).catch(() => {});
      if (D.ajustes.fondo) fondo(true, false);
    }
  };
  X.onState = function (s) {
    paintLeds();
    bubbleState(s, "");
    if (s === "thinking") iaOk = iaOk === false ? null : iaOk;
  };
  X.onReply = function (text) {
    iaOk = true;
    if (document.hidden) bubbleState("speaking", (window.JMD ? window.JMD.plain(text) : String(text)).replace(/[*#>`|]/g, "").replace(/\s+/g, " ").slice(0, 180));
    hoy();
  };
  X.beforeListen = beforeListen;
  X.settings = function () {
    try { baseSettings(); } catch (e) { console.error(e); }
    const box = $("#aj2");
    if (!box) return;
    const sec = mk("div"); sec.id = "aj-fondo";
    sec.append(mk("h3", "sub", "«Jarvis» en segundo plano"));
    sec.append(mk("p", "hint", "Jarvis escucha la palabra «Jarvis» aunque estés en otra app o con la pantalla apagada. Lo hace sin internet: el audio nunca sale del celular. La primera vez descarga el modelo de voz (unos 40 MB). Gasta algo más de batería."));
    const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.id = "fondo-chk"; i.checked = !!D.ajustes.fondo;
    i.addEventListener("change", async () => { const ok = await fondo(i.checked, false); if (!ok && i.checked) i.checked = false; });
    l.append(i, document.createTextNode(" Escuchar «Jarvis» siempre")); sec.append(l);
    const st = mk("p", "hint"); st.id = "fondo-st"; sec.append(st);
    const row = mk("div", "row wrap");
    const bb = mk("button", "btn small", "Que Android no lo apague"); bb.type = "button"; bb.addEventListener("click", () => { const S = E(); if (S) S.bateria(); else A.toast("Solo en la app instalada."); });
    row.append(bb); sec.append(row);
    box.prepend(sec);
    renderFondo();
  };
  // órdenes por voz: «escúchame siempre», «deja de escuchar en segundo plano»
  const baseIntent = X.intent, baseRun = X.run;
  X.intent = function (text) {
    const t = L.norm(text);
    if (/\b(?:segundo plano|siempre atento|escuchame siempre|escuchame todo el tiempo|activate con tu nombre)\b/.test(t)) return { kind: "fondo", on: !/\b(?:deja|apaga|quita|desactiva|no)\b/.test(t) };
    return baseIntent(text);
  };
  X.run = function (it, text) { if (it.kind === "fondo") return fondo(it.on, true); return baseRun(it, text); };
  X._hud = { hoy, fondo, onWake };
})();
