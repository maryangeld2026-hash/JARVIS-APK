/* Jarvis para Android 3.7.1 · ahorro de batería.
   · Modo ahorro: con el ahorro de batería del celular o con poca batería, Jarvis apaga lo que más gasta
     (animaciones, la voz con IA, la vigilancia para interrumpirlo y la conexión anticipada con la IA).
   · «Jarvis» en segundo plano: siempre, solo en tu jornada o solo en tus clases; solo con la pantalla encendida;
     y se pausa solo con la batería baja.
   · Ajustes › Batería: qué está prendido, cuánto gasta y un botón para apagarlo.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L3 = window.JL3, L4 = window.JL4, V = window.JV;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const plug = (n) => (V.native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  let bat = { nivel: -1, ahorro: false, sinRestriccion: false };

  // ======================================================================== CUÁNDO ESCUCHAR «JARVIS»
  function ventanas() {
    const m = D.ajustes.fondoCuando || "siempre";
    if (m === "jornada") { const v = []; for (let d = 1; d <= 5; d++) v.push({ dia: d, ini: 6 * 60, fin: 18 * 60 }); return v; }
    if (m === "clases") return L3.parseSchedule(D.ajustes.horario || "").map((c) => ({ dia: c.dia, ini: Math.max(0, c.ini - 15), fin: Math.min(24 * 60, c.fin + 15) }));
    return [];
  }
  function configEscucha() {
    const S = plug("Escucha"); if (!S || !S.config) return;
    const m = D.ajustes.fondoCuando || "siempre";
    S.config({ cuidarBateria: D.ajustes.fondoBateria !== false, bateriaMin: 15, soloPantalla: !!D.ajustes.fondoPantalla, soloHorario: m !== "siempre" && ventanas().length > 0, ventanas: ventanas() }).catch(() => {});
  }

  // ======================================================================== MODO AHORRO
  async function refresh() {
    const S = plug("Escucha");
    if (S && S.bateriaEstado) { try { bat = Object.assign(bat, await S.bateriaEstado()); } catch (e) { /* nada */ } }
    apply();
  }
  function apply() {
    const m = D.ajustes.ahorro || "auto";
    const on = m === "siempre" || (m === "auto" && (bat.ahorro || (bat.nivel >= 0 && bat.nivel <= 20)));
    if (on !== !!D.ajustes.ahorroActivo) { D.ajustes.ahorroActivo = on; save(); }
    document.body.classList.toggle("ahorro", on);
  }
  function gastos() {
    const a = D.ajustes, out = [];
    if (a.fondo) out.push({ k: "fondo", t: "Escuchar «Jarvis» en segundo plano", nivel: a.fondoCuando && a.fondoCuando !== "siempre" ? "medio" : "alto", info: "Tiene el micrófono abierto. Desde la 3.7.1 el reconocedor duerme mientras hay silencio." });
    if (a.manosLibres) out.push({ k: "manos", t: "Manos libres", nivel: "alto", info: "Deja la pantalla encendida y el micrófono escuchando todo el tiempo." });
    if (a.voz && a.vozIA) out.push({ k: "vozia", t: "Voz natural con IA", nivel: "medio", info: "Usa internet en cada frase que dice Jarvis." });
    if (a.interrumpir) out.push({ k: "interrumpir", t: "Interrumpir a Jarvis hablándole", nivel: "bajo", info: "Escucha solo mientras Jarvis habla." });
    if (a.burbuja) out.push({ k: "burbuja", t: "Burbuja flotante", nivel: "bajo", info: "Un servicio pequeño que mantiene la burbuja en pantalla." });
    if (bat.sinRestriccion && !a.fondo) out.push({ k: "exento", t: "«Que Android no lo apague»", nivel: "medio", info: "Android no limita a Jarvis cuando está en segundo plano. Solo hace falta para la escucha de fondo, que tienes apagada: quítalo en la lista de Android (busca Jarvis › Optimizar)." });
    if ((D.recLugar || []).length) out.push({ k: "lugar", t: "Recordatorios por lugar", nivel: "bajo", info: "Android avisa al llegar, con muy poco consumo." });
    return out;
  }
  function apagar(k) {
    const a = D.ajustes;
    if (k === "fondo") { const c = $("#fondo-chk"); if (c) { c.checked = false; c.dispatchEvent(new Event("change")); } else a.fondo = false; }
    if (k === "manos") A.handle && A.handle("desactiva manos libres", false);
    if (k === "vozia") a.vozIA = "";
    if (k === "interrumpir") a.interrumpir = false;
    if (k === "burbuja") { const S = plug("Burbuja"); if (S) S.ocultar().catch(() => {}); a.burbuja = false; }
    if (k === "exento") { const S = plug("Escucha"); if (S && S.bateria) S.bateria({ lista: true }).catch(() => {}); }
    save();
  }
  function report() {
    const g = gastos(), niv = bat.nivel >= 0 ? `Batería: ${bat.nivel} %${bat.ahorro ? " · ahorro del celular encendido" : ""}. ` : "";
    if (!g.length) return A.reply(niv + "No tengo nada prendido que gaste batería en segundo plano. Lo que más gasta es tener la pantalla encendida mucho tiempo y las conversaciones largas con la IA.");
    A.reply(`${niv}**Lo que gasta batería ahora:**\n` + g.map((x) => `- ${x.t} (consumo ${x.nivel}): ${x.info}`).join("\n") + "\n\nPuedes apagarlo en *Ajustes › Batería*, o decir «modo ahorro».", "tool",
      `${niv}Lo que más gasta ahora: ${g.filter((x) => x.nivel === "alto").map((x) => x.t).join(" y ") || g[0].t}. Lo puedes apagar en Ajustes, en Batería.`);
  }

  // ======================================================================== AJUSTES › BATERÍA
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-bat")) return;
    const sec = mk("div"); sec.id = "aj-bat";
    sec.append(mk("h3", "sub", "Batería"));
    const st = mk("p", "hint bat-st"); sec.append(st);
    const lbl = (t) => { const l = mk("label", "lbl", t); sec.append(l); return l; };
    lbl("Modo ahorro de Jarvis");
    const ms = mk("select", "inp"); [["auto", "Automático: con el ahorro del celular o batería de 20 % o menos"], ["siempre", "Siempre"], ["nunca", "Nunca"]].forEach(([k, t]) => ms.append(new Option(t, k)));
    ms.value = D.ajustes.ahorro || "auto"; ms.addEventListener("change", () => { D.ajustes.ahorro = ms.value; save(); apply(); paint(); }); sec.append(ms);
    sec.append(mk("p", "hint", "En modo ahorro, Jarvis quita las animaciones, usa la voz del celular, no vigila si lo interrumpes y no se conecta con la IA por adelantado. Todo lo demás funciona igual."));
    lbl("«Jarvis» en segundo plano: ¿cuándo escuchar?");
    const fc = mk("select", "inp"); [["siempre", "Siempre"], ["jornada", "Solo en mi jornada (lunes a viernes, 6:00 a 18:00)"], ["clases", "Solo en mis horas de clase (según el horario)"]].forEach(([k, t]) => fc.append(new Option(t, k)));
    fc.value = D.ajustes.fondoCuando || "siempre"; fc.addEventListener("change", () => { D.ajustes.fondoCuando = fc.value; save(); configEscucha(); if (fc.value === "clases" && !ventanas().length) A.toast("Escribe tu horario en Ajustes para que funcione.", 5000); paint(); }); sec.append(fc);
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); sec.append(l); };
    chk("Solo con la pantalla encendida", D.ajustes.fondoPantalla, (v) => { D.ajustes.fondoPantalla = v; save(); configEscucha(); });
    chk("Pausarla sola con batería de 15 % o menos, o con el ahorro del celular", D.ajustes.fondoBateria !== false, (v) => { D.ajustes.fondoBateria = v; save(); configEscucha(); });
    const ul = mk("ul", "bat-list"); sec.append(mk("h3", "sub", "Lo que gasta batería ahora")); sec.append(ul);
    sec.append(mk("p", "hint", "Consejos: lo que más gasta en cualquier celular es la pantalla encendida y el micrófono abierto. Si no usas «Jarvis» en segundo plano, apágalo: el micrófono del orbe y el widget siguen funcionando. Para la clase, el temporizador mantiene la pantalla encendida solo si es de 15 minutos o menos."));
    function paint() {
      st.textContent = (bat.nivel >= 0 ? `Batería ${bat.nivel} %` : "Batería: —") + (bat.ahorro ? " · ahorro del celular encendido" : "") + (D.ajustes.ahorroActivo ? " · 🍃 modo ahorro de Jarvis activo" : "");
      ul.textContent = "";
      const g = gastos();
      if (!g.length) ul.append(mk("li", "hint", "Nada prendido en segundo plano. 👍"));
      g.forEach((x) => {
        const li = mk("li"), d = mk("div", "grow"); d.append(mk("b", "", x.t), mk("small", "", ` · consumo ${x.nivel}. ${x.info}`));
        const b = mk("button", "btn", x.k === "exento" ? "Revisar" : x.k === "lugar" ? "Ver" : "Apagar"); b.type = "button";
        b.addEventListener("click", () => { if (x.k === "lugar") return A.handle("mis recordatorios por lugar", false); apagar(x.k); setTimeout(paint, 300); });
        li.append(d, b); ul.append(li);
      });
    }
    const dg = mk("div", "hint bat-diag"); sec.append(mk("h3", "sub", "Diagnóstico")); sec.append(dg);
    const rowd = mk("div", "row wrap"), bd = mk("button", "btn", "Reiniciar la medición"); bd.type = "button"; bd.addEventListener("click", async () => { await eReiniciar(); diagnostico().then((d) => (dg.innerHTML = A.md(diagTexto(d)))); }); rowd.append(bd); sec.append(rowd);
    diagnostico().then((d) => (dg.innerHTML = A.md(diagTexto(d)))).catch(() => {});
    paint(); refresh().then(paint);
    box.prepend(sec);
  }

  // ======================================================================== 3.11.1: DIAGNÓSTICO DE BATERÍA
  // Lo que mide la app (en pantalla, pantalla mantenida, en vivo, nivel de batería) + lo que mide la escucha de fondo (micrófono).
  const EK = "jarvis.energia";
  let E = null;
  function eLeer() { if (E) return E; try { E = JSON.parse(localStorage.getItem(EK) || "null"); } catch (e) { E = null; } if (!E || !E.desde) E = { desde: Date.now(), fg: 0, pant: 0, live: 0, m: [] }; return E; }
  let eT = null;
  function eGuardar() { clearTimeout(eT); eT = setTimeout(() => { try { localStorage.setItem(EK, JSON.stringify(E)); } catch (e) { /* nada */ } }, 1500); }
  let fgDesde = document.hidden ? 0 : Date.now(), pantDesde = 0, liveDesde = 0;
  function eCerrar() { const n = Date.now(), e = eLeer(); if (fgDesde) { e.fg += n - fgDesde; fgDesde = document.hidden ? 0 : n; } if (pantDesde) { e.pant += n - pantDesde; pantDesde = n; } if (liveDesde) { e.live += n - liveDesde; liveDesde = n; } eGuardar(); }
  async function eMuestra() {
    const S = plug("Escucha"); if (!S || !S.bateriaEstado) return;
    try { const b = await S.bateriaEstado(); if (b.nivel >= 0) { const e = eLeer(); e.m.push({ t: Date.now(), n: b.nivel, c: b.cargando ? 1 : 0 }); e.m = e.m.filter((x) => Date.now() - x.t < 3 * 864e5).slice(-120); eGuardar(); } } catch (e) { /* nada */ }
  }
  function eEnganchar() {
    document.addEventListener("visibilitychange", () => { eCerrar(); if (!document.hidden) fgDesde = Date.now(); else fgDesde = 0; eMuestra(); });
    const ka = window.JN && window.JN.keepAwake;
    if (ka && !window.JN.__medido) { window.JN.__medido = true; window.JN.keepAwake = function (on) { eCerrar(); pantDesde = on ? (pantDesde || Date.now()) : 0; return ka.apply(this, arguments); }; }
    const L = X._live;
    if (L && !L.__medido) { L.__medido = true; const st = L.start, sp = L.stop; L.start = function () { liveDesde = Date.now(); return st.apply(this, arguments); }; L.stop = function () { eCerrar(); liveDesde = 0; return sp.apply(this, arguments); }; }
    eMuestra();
  }
  const hh = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim(); };
  /** Cuánto baja la batería por hora sin cargar (con las muestras de la app y de la escucha de fondo). */
  function ritmo(ms) {
    const l = ms.slice().sort((a, b) => a.t - b.t); let caida = 0, tiempo = 0;
    for (let k = 1; k < l.length; k++) { const a = l[k - 1], b = l[k], dt = b.t - a.t; if (a.c || b.c || dt > 6 * 3600e3 || dt < 10 * 60000 || b.n > a.n) continue; caida += a.n - b.n; tiempo += dt; }
    return tiempo > 45 * 60000 ? { porHora: caida / (tiempo / 3600e3), horas: tiempo / 3600e3 } : null;
  }
  async function diagnostico() {
    eCerrar();
    const e = eLeer(); let nat = null;
    const S = plug("Escucha"); if (S && S.energia) { try { nat = await S.energia({}); } catch (er) { /* nada */ } }
    const desde = Math.min(e.desde, nat && nat.desde ? nat.desde : e.desde), total = Date.now() - desde;
    const muestras = e.m.concat(nat && nat.muestras ? nat.muestras.split(";").filter(Boolean).map((x) => { const [t, n, c] = x.split(":").map(Number); return { t, n, c }; }) : []);
    const r = ritmo(muestras), mic = nat ? nat.micMs : 0, vosk = nat ? nat.voskMs : 0;
    const filas = [
      ["🎙️ Micrófono abierto por «Jarvis» en segundo plano", mic, mic > 0.3 * total ? "alto" : mic > 0.1 * total ? "medio" : "bajo"],
      ["🧠 Reconocedor de voz trabajando (cuando oye voces)", vosk, vosk > 3600e3 ? "medio" : "bajo"],
      ["💡 Pantalla mantenida encendida por Jarvis", e.pant, e.pant > 3600e3 ? "alto" : e.pant > 20 * 60000 ? "medio" : "bajo"],
      ["📱 Jarvis abierto en pantalla", e.fg, e.fg > 2 * 3600e3 ? "alto" : e.fg > 3600e3 ? "medio" : "bajo"],
      ["📡 Conversación en vivo / cámara", e.live, e.live > 30 * 60000 ? "alto" : e.live > 10 * 60000 ? "medio" : "bajo"],
    ];
    const top = filas.slice().sort((a, b) => b[1] - a[1])[0];
    const consejo = top[1] < 10 * 60000 ? "Jarvis casi no ha trabajado en este tiempo: si el celular se descarga rápido, mira en *Ajustes del celular › Batería › Uso de la batería* qué app gasta más (y mándame una captura)."
      : top === filas[0] ? "Lo que más gasta es escuchar «Jarvis» con el micrófono abierto. Déjalo «Solo con la pantalla encendida» o «Solo en mis horas de clase» (abajo), o apágalo: el orbe, la burbuja, el widget y el botón de la cortina siguen funcionando."
      : top === filas[2] ? "Lo que más gasta es la pantalla encendida (temporizadores, manos libres, proyector o modo cocina). Manos libres ahora se apaga solo a los 20 minutos sin órdenes."
      : top === filas[3] ? "Jarvis pasó mucho tiempo abierto en pantalla: la pantalla es lo que más gasta en cualquier celular. Baja el brillo o minimízalo cuando no lo uses."
      : top === filas[4] ? "La conversación en vivo y la cámara gastan bastante: úsalas por ratos y cuelga al terminar." : "";
    return { total, filas, r, consejo, escuchando: nat && nat.escuchando };
  }
  function diagTexto(d) {
    return `🔋 **Diagnóstico de batería** (últimas ${hh(d.total)}):\n` + d.filas.map(([t, ms, n]) => `- ${t}: **${hh(ms)}**${ms ? ` · ${n}` : ""}`).join("\n") +
      (d.r ? `\n\nSin cargar, la batería bajó en promedio **${d.r.porHora.toFixed(1).replace(".", ",")} % por hora** (medido en ${d.r.horas.toFixed(1).replace(".", ",")} h).` : "\n\nTodavía no tengo suficientes medidas del nivel de batería; vuelve a preguntarme mañana.") +
      (d.consejo ? `\n\n👉 ${d.consejo}` : "");
  }
  async function eReiniciar() { const S = plug("Escucha"); if (S && S.energia) { try { await S.energia({ reiniciar: true }); } catch (e) { /* nada */ } } E = { desde: Date.now(), fg: 0, pant: 0, live: 0, m: [] }; fgDesde = document.hidden ? 0 : Date.now(); eGuardar(); }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const t = L4.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:modo ahorro|ahorra bateria|activa el modo ahorro|ahorro de bateria)$/.test(t)) return { bat: true, kind: "on" };
    if (/^(?:quita|desactiva|apaga)\s+el\s+modo ahorro$/.test(t)) return { bat: true, kind: "off" };
    if (/^(?:que (?:me )?(?:esta )?gasta(?:ndo)? (?:la )?bateria|por que gastas tanta bateria|consumo de bateria|cuanta bateria (?:tengo|queda))$/.test(t)) return { bat: true, kind: "ver" };
    if (/^(?:diagnostico de (?:la )?bateria|revisa (?:la|mi) bateria|por que se (?:me )?descarga (?:tan rapido )?(?:el celular|la bateria)|mide (?:el consumo|la bateria))$/.test(t)) return { bat: true, kind: "diag" };
    if (/^(?:reinicia|borra) el diagnostico(?: de (?:la )?bateria)?$/.test(t)) return { bat: true, kind: "reset" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.bat) return base.run(it, text);
    if (it.kind === "on") { D.ajustes.ahorro = "siempre"; save(); apply(); return A.reply("🍃 Modo ahorro activado: sin animaciones, con la voz del celular, sin vigilar si me interrumpes y sin conectarme por adelantado con la IA."); }
    if (it.kind === "off") { D.ajustes.ahorro = "auto"; save(); apply(); return A.reply("Modo ahorro en automático: se activa solo con el ahorro del celular o con poca batería."); }
    if (it.kind === "reset") { await eReiniciar(); return A.reply("Listo: empiezo a medir desde cero. Pregúntame mañana «diagnóstico de batería»."); }
    if (it.kind === "diag") { const d = await diagnostico(); return A.reply(diagTexto(d), "tool", d.consejo ? d.consejo.replace(/[*👉]/g, "") : "Ahí tienes el diagnóstico."); }
    await refresh(); report();
    const d = await diagnostico(); if (d.total > 2 * 3600e3) A.reply(diagTexto(d), "tool", d.consejo ? d.consejo.replace(/[*👉]/g, "") : "");
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    if (D.ajustes.fondoPantalla == null) { D.ajustes.fondoPantalla = true; save(); }      // 3.11.1: lo más ahorrador por defecto
    configEscucha(); refresh(); eEnganchar();
    window.JEVERY(5 * 60000, refresh);                      // cada 5 minutos (solo con Jarvis en pantalla)
  };
  X._bat = { refresh, apply, gastos, configEscucha, ventanas, diagnostico, diagTexto, eReiniciar, ritmo };
})();
