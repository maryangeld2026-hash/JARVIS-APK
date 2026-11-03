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
    paint(); refresh().then(paint);
    box.prepend(sec);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const t = L4.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:modo ahorro|ahorra bateria|activa el modo ahorro|ahorro de bateria)$/.test(t)) return { bat: true, kind: "on" };
    if (/^(?:quita|desactiva|apaga)\s+el\s+modo ahorro$/.test(t)) return { bat: true, kind: "off" };
    if (/^(?:que (?:me )?(?:esta )?gasta(?:ndo)? (?:la )?bateria|por que gastas tanta bateria|consumo de bateria|cuanta bateria (?:tengo|queda))$/.test(t)) return { bat: true, kind: "ver" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.bat) return base.run(it, text);
    if (it.kind === "on") { D.ajustes.ahorro = "siempre"; save(); apply(); return A.reply("🍃 Modo ahorro activado: sin animaciones, con la voz del celular, sin vigilar si me interrumpes y sin conectarme por adelantado con la IA."); }
    if (it.kind === "off") { D.ajustes.ahorro = "auto"; save(); apply(); return A.reply("Modo ahorro en automático: se activa solo con el ahorro del celular o con poca batería."); }
    await refresh(); return report();
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    configEscucha(); refresh();
    window.JEVERY(5 * 60000, refresh);                      // cada 5 minutos (solo con Jarvis en pantalla)
  };
  X._bat = { refresh, apply, gastos, configEscucha, ventanas };
})();
