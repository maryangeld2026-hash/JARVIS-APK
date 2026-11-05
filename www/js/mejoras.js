/* Jarvis para Android 3.14 · que todo funcione mejor.
   Preguntar cuando una frase puede ser dos cosas · «deshaz eso» · modo «pensar» · «¿qué puedes hacer?» (catálogo) ·
   Ajustes ordenados por temas con buscador · bienvenida de 1 minuto.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L11 = window.JL11, V = window.JV, IA = window.JIA, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const pick = (t, ops, sp) => X._vida.pick(t, ops, sp);

  // ======================================================================== DESHACER
  let foto = null;
  /** app.js lo llama justo antes de cada orden tuya: se guarda cómo estaba todo, para «deshaz eso». */
  function antes(text) {
    if (L11.esDeshacer(text)) return;
    try { foto = { f: L11.foto(D), texto: text, t: Date.now(), timer: A.timer && A.timer.end }; } catch (e) { foto = null; }
  }
  async function deshacer() {
    if (!foto) return R("No tengo nada para deshacer.");
    const ks = L11.cambios(foto.f, D);
    const timerNuevo = A.timer && A.timer.end && A.timer.end !== foto.timer;
    if (!ks.length && !timerNuevo) { const t = foto.texto; foto = null; return R(`«${t}» no cambió nada que yo pueda deshacer. Las llamadas, los mensajes enviados y las alarmas del reloj no se pueden deshacer desde aquí.`); }
    const antesRec = JSON.parse(foto.f.recordatorios || "[]"), ahoraRec = D.recordatorios || [];
    L11.restaurar(foto.f, D, ks);
    // los avisos de Android, al día con lo restaurado
    if (ks.includes("recordatorios") && N) {
      ahoraRec.filter((r) => !antesRec.some((x) => x.id === r.id)).forEach((r) => { try { N.cancelNotify(r.id); } catch (e) { /* nada */ } });
      antesRec.filter((r) => !ahoraRec.some((x) => x.id === r.id) && !r.avisado && r.cuando > Date.now()).forEach((r) => { try { N.notifyAt(r.id, "Jarvis te recuerda", r.texto, r.cuando, { acciones: true }); } catch (e) { /* nada */ } });
    }
    if (ks.includes("programadas") && X._gen && X._gen.programarAvisos) X._gen.programarAvisos();
    if (ks.includes("disparadores") && X._vida && X._vida.syncDisparadores) X._vida.syncDisparadores();
    if (ks.includes("ajustes.docente")) document.body.classList.toggle("sin-docente", D.ajustes.docente === false);
    if (ks.includes("convs") && A.renderChat) A.renderChat();
    if (timerNuevo) { const b = $("#btn-tiempo-parar"); if (b) b.click(); }
    save();
    const que = [...new Set(ks.map(L11.nombreCambio))].concat(timerNuevo ? ["el temporizador"] : []);
    const t = foto.texto; foto = null;
    return R(`↩️ Deshice «${t}»: volví a como estaban ${que.join(", ")}.`, "tool", `Listo, deshice ${t}.`);
  }

  // ======================================================================== MODO «PENSAR»
  async function pensar(q) {
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    let last = 0;
    try {
      const full = await IA.chat({ system: (A.systemPrompt ? A.systemPrompt(true) : "") + " " + L11.PENSAR, messages: [{ role: "user", content: q }], maxTokens: 3500, temperature: 0.3,
        onDelta: (_, all) => { const now = performance.now(); if (now - last > 300) { last = now; e.innerHTML = A.md("🧠 *Pensando…*\n\n" + all.slice(-600)); } } });
      const s = L11.separarPensar(full);
      m.content = s.respuesta + (s.razon ? "\n\n<details><summary>Ver cómo lo pensé</summary>\n\n" + s.razon + "\n\n</details>" : "");
      e.classList.remove("typing"); e.innerHTML = A.md(s.respuesta);
      if (s.razon) { const d = mk("details", "pensar"), su = mk("summary", "", "🧠 Ver cómo lo pensé"), c = mk("div"); c.innerHTML = A.md(s.razon); d.append(su, c); e.append(d); }
      A.say(s.respuesta);
    } catch (er) { e.classList.remove("typing"); m.content = er.message; m.cls = "err"; e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }

  // ======================================================================== ¿QUÉ PUEDES HACER?
  function catalogo() {
    let sh = $("#cat-sh"); if (sh) sh.remove();
    sh = mk("div", "sheet"); sh.id = "cat-sh";
    const inn = mk("div", "sheet-in"), hd = mk("div", "sheet-h"), sc = mk("div", "scroll");
    const x = mk("button", "icon-btn", "✕"); x.type = "button"; x.addEventListener("click", () => sh.remove());
    hd.append(mk("h2", "", "Lo que puedo hacer"), x);
    sc.append(mk("p", "hint", "Toca un ejemplo para probarlo. También puedes decirlo con tus palabras."));
    L11.CATALOGO.forEach(([titulo, ej]) => {
      if (/docente/i.test(titulo) && D.ajustes.docente === false) return;
      sc.append(mk("h3", "sub", titulo));
      const box = mk("div", "sug cat-sug");
      ej.forEach((t) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => { sh.remove(); A.handle(t, false); }); box.append(b); });
      sc.append(box);
    });
    inn.append(hd, sc); sh.append(inn); document.body.append(sh); sh.hidden = false;
    A.say("Aquí tienes lo que puedo hacer. Toca un ejemplo para probarlo.");
  }

  // ======================================================================== AJUSTES ORDENADOS
  function ordenarAjustes() {
    const sc = $("#ajustes .scroll"); if (!sc) return;
    if (!$("#aj-buscar", sc)) {
      const b = mk("input", "inp aj-buscar"); b.id = "aj-buscar"; b.type = "search"; b.placeholder = "🔍 Buscar en los ajustes (voz, batería, clave…)";
      b.addEventListener("input", () => {
        const q = L11.norm(b.value);
        $$("details.aj-grupo", sc).forEach((d) => { const hit = !q || L11.norm(d.textContent).includes(q); d.hidden = !hit; d.open = !!q && hit; });
      });
      sc.prepend(b);
    }
    // cada título (h3) y lo que le sigue, en un grupo plegable
    $$("h3.sub", sc).forEach((h) => {
      if (h.closest("details.aj-grupo")) return;
      const d = mk("details", "aj-grupo"), s = mk("summary"); s.textContent = h.textContent;
      const grupo = []; let n = h.nextSibling;
      while (n && !(n.nodeType === 1 && (n.matches("h3.sub") || n.querySelector && n.querySelector("h3.sub")))) { grupo.push(n); n = n.nextSibling; }
      h.parentNode.insertBefore(d, h);
      d.append(s); grupo.forEach((g) => d.append(g)); h.remove();
    });
  }

  // ======================================================================== BIENVENIDA
  function bienvenida() {
    const em = $("#chat .empty"); if (!em || $(".bienv", em) || !L11.bienvenidaPendiente(D)) return;
    const c = mk("div", "bienv");
    c.append(mk("b", "", "Configuremos a Jarvis en 1 minuto"));
    const fila = (t) => { const r = mk("div", "bienv-fila"); r.append(mk("span", "", t)); c.append(r); return r; };
    const r1 = fila("1. ¿Cómo te llamo?"); const nm = mk("input", "inp"); nm.placeholder = "Tu nombre"; nm.value = D.ajustes.nombre || ""; nm.addEventListener("change", () => { D.ajustes.nombre = nm.value.trim(); save(); }); r1.append(nm);
    const btn = (t, fn) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => { b.parentNode.querySelectorAll("button").forEach((x) => x.classList.remove("on")); b.classList.add("on"); fn(); }); return b; };
    const r2 = fila("2. ¿Eres docente? (cursos, notas, quices)");
    const elegido = {};
    const docente = (on) => { D.ajustes.docente = on; save(); document.body.classList.toggle("sin-docente", !on); };
    r2.append(btn("Sí", () => docente(true)), btn("No", () => docente(false)));
    const r3 = fila("3. ¿Qué IA uso?");
    r3.append(btn("Gemini (gratis, con internet)", () => { window.open("https://aistudio.google.com/apikey", "_blank"); A.toast("Copia la clave y pégala en Ajustes › Inteligencia artificial.", 6000); }),
      btn("Gemma en el celular (sin internet)", () => { const a = $("#btn-ajustes"); if (a) a.click(); setTimeout(() => { const s = $("#a-respaldo"); if (s) { s.value = "local"; s.dispatchEvent(new Event("change")); s.scrollIntoView({ block: "center" }); const d = s.closest("details"); if (d) d.open = true; } }, 400); }),
      btn("Después", () => {}));
    const r4 = fila("4. ¿Que te escuche cuando digas «Jarvis»? (gasta algo de batería)");
    r4.append(btn("Sí", () => { elegido.fondo = true; }), btn("No, toco el micrófono", () => { elegido.fondo = false; }));
    const fin = mk("button", "btn primary", "Listo"); fin.type = "button";
    fin.addEventListener("click", () => {
      D.ajustes.bienvenida = true; save(); c.remove();
      if (elegido.fondo) A.dispatch("activa jarvis en segundo plano");
      A.toast("¡Listo! Pregúntame «¿qué puedes hacer?» para ver todo.", 5000);
    });
    c.append(fin);
    em.append(c);
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.antes = antes;
  X.intent = function (text) {
    const raw = String(text || "").trim();
    if (/^#tab:/.test(raw)) return { mj: "tab", tab: raw.slice(5) };
    if (L11.esDeshacer(text)) return { mj: "deshacer" };
    if (L11.ayudaIntent(text)) return { mj: "ayuda" };
    const pe = L11.pensarIntent(text); if (pe) return { mj: "pensar", q: pe.q };
    const am = L11.ambigua(text, { docente: D.ajustes.docente !== false, casa: !!((D.ajustes.ha || {}).url), timer: !!(A.timer && A.timer.end), timers: (D.timers || []).filter((t) => t.fin > Date.now()).map((t) => t.nombre) });
    if (am) return { mj: "ambigua", am };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.mj) return base.run(it, text);
    if (it.mj === "tab") return A.tab(it.tab);
    if (it.mj === "deshacer") return deshacer();
    if (it.mj === "ayuda") return catalogo();
    if (it.mj === "pensar") return pensar(it.q);
    if (it.mj === "ambigua") return pick("🤔 " + it.am.pregunta, it.am.opciones.map(([t, o]) => [t, () => (o === "nada" ? R("Listo, no borro nada.") : A.dispatch(o))]));
  };
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { ordenarAjustes(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    if (!L11.bienvenidaPendiente(D) && !D.ajustes.bienvenida) { D.ajustes.bienvenida = true; save(); }
    setTimeout(bienvenida, 300);
    new MutationObserver(() => { if ($("#chat .empty") && !$("#chat .empty .bienv")) bienvenida(); }).observe($("#chat"), { childList: true });
  };
  X._mejoras = { deshacer, catalogo, pensar, ordenarAjustes, foto: () => foto };
})();
