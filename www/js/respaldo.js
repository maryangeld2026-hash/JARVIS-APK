/* Jarvis para Android 3.32 · respaldo gratis en la nube.
   Si Gemini no responde (caída, sin cupo, lenta), contesta Groq (gratis, sin tarjeta); si tampoco, OpenRouter (modelos gratis);
   y sin internet, la IA del celular. Ajustes › Inteligencia artificial › «Respaldo gratis en la nube». */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L21 = window.JL21, IA = window.JIA, L = window.JL;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const aj = () => D.ajustes;
  const pick = (t, ops, sp) => X._vida ? X._vida.pick(t, ops, sp) : R(t);
  const cap = () => window.Capacitor;
  const plug = (n) => (cap() && cap().isNativePlatform && cap().isNativePlatform() && cap().Plugins && cap().Plugins[n]) || null;
  const nombres = () => { const o = {}; Object.entries(L.PROVIDERS).forEach(([k, p]) => (o[k] = k === "local" ? "IA del celular" : p.nombre)); return o; };
  const abrirUrl = (u) => { const W = plug("Ventana"); if (W && W.abrir) return W.abrir({ url: u }).catch(() => window.open(u, "_blank")); window.open(u, "_blank"); };
  async function localListo() { const P = plug("IALocal"); if (!P) return false; try { return !!(await P.estado()).listo; } catch (e) { return false; } }

  /** Prueba cada IA de la cadena (una pregunta corta a cada una). → {prov: ok|sin_clave|falla|no} */
  async function probarCadena(onParcial) {
    const a = aj(), est = {}, hayLocal = await localListo();
    for (const x of L21.cadena(a, nombres(), hayLocal)) {
      if (x.prov === "local") { est.local = hayLocal ? "ok" : "no"; continue; }
      if (!L.PROVIDERS[x.prov].sinClave && !((a.claves || {})[x.prov] || "").trim()) { est[x.prov] = "sin_clave"; continue; }
      est[x.prov] = "probando"; if (onParcial) onParcial(est);
      try { const r = await IA.test(x.prov); est[x.prov] = r && r.ok ? "ok" : "falla"; } catch (e) { est[x.prov] = "falla"; }
      if (onParcial) onParcial(est);
    }
    return { est, hayLocal };
  }

  async function poner(prov, pos) {
    const g = L21.GRATIS.find((x) => x.prov === prov), p = L.PROVIDERS[prov];
    if (!p) return R("No conozco esa IA.", "err");
    if (prov === aj().proveedor) return R(`${p.nombre} ya es tu IA principal.`);
    const clave = ((aj().claves || {})[prov] || "").trim();
    if (!clave) {
      return pick(`🛟 Para usar **${p.nombre}** de respaldo necesito su clave (API key)${g ? ` — es gratis: ${g.limite}` : ""}.\n\n1. Abre la página, entra con tu correo de Google y crea una clave.\n2. Cópiala y pégala en Ajustes › Inteligencia artificial › «Respaldo gratis en la nube».\n\n_Por seguridad no la escribas aquí en la conversación._`,
        [["🔑 Abrir la página de la clave", () => abrirUrl(p.clave)], ["Abrir Ajustes", () => abrirAjustes()]]);
    }
    Object.assign(aj(), L21.ponerRespaldo(aj(), prov, pos)); save();
    A.toast(`Probando ${p.nombre}…`, 2500);
    let ok = false; try { ok = !!(await IA.test(prov)).ok; } catch (e) { /* abajo */ }
    const hayLocal = await localListo();
    return R(`${ok ? "✅" : "⚠️"} **${p.nombre}** queda de ${pos === 2 ? "segundo" : "primer"} respaldo${ok ? " y respondió bien" : ", pero no respondió ahora (revisa la clave)"}.\n\n` + L21.cadenaTexto(aj(), nombres(), { [prov]: ok ? "ok" : "falla" }, hayLocal));
  }
  function abrirAjustes() {
    const b = $("#btn-ajustes"); if (b) b.click();
    setTimeout(() => { const d = $("#aj-332") && $("#aj-332").closest("details") ; const g = [...document.querySelectorAll("details.aj-grupo")].find((x) => /Respaldo gratis/.test((x.querySelector("summary") || {}).textContent || "")); const t = g || d; if (t) { t.hidden = false; t.open = true; t.scrollIntoView({ block: "start" }); } }, 500);
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-332")) return;
    const s = mk("div"); s.id = "aj-332";
    s.append(mk("h3", "sub", "Respaldo gratis en la nube"));
    s.append(mk("p", "hint", "Si Gemini se cae, se queda sin cupo o va muy lenta, Jarvis pasa solo a la siguiente: primero una IA gratis en la nube y, sin internet, la IA del celular. Sus claves quedan solo en tu celular."));
    const cad = mk("div", "hint"); s.append(cad);
    const pintar = async (est) => { const h = await localListo(); cad.innerHTML = A.md(L21.cadenaTexto(aj(), nombres(), est || {}, h)); };
    pintar();
    L21.GRATIS.forEach((g) => {
      const p = L.PROVIDERS[g.prov];
      const f = mk("div", "resp-gratis");
      f.append(mk("b", "", g.nombre), mk("p", "hint", `Gratis: ${g.limite}. Modelos: ${g.modelos}.`));
      const fila = mk("div", "row wrap");
      const inp = mk("input", "inp"); inp.type = "password"; inp.placeholder = "Clave " + g.pista; inp.autocomplete = "off"; inp.value = (aj().claves || {})[g.prov] || "";
      inp.addEventListener("change", () => { aj().claves = aj().claves || {}; aj().claves[g.prov] = inp.value.trim(); if (aj().modeloAuto) delete aj().modeloAuto[g.prov]; save(); });
      const link = mk("button", "btn small ghost", "🔑 Crear clave gratis"); link.type = "button"; link.addEventListener("click", () => abrirUrl(p.clave));
      const usar = mk("button", "btn small", L21.respaldos(aj()).includes(g.prov) ? "✓ En la cadena · probar" : "Probar y usar de respaldo"); usar.type = "button";
      usar.addEventListener("click", async () => {
        aj().claves = aj().claves || {}; aj().claves[g.prov] = inp.value.trim(); if (aj().modeloAuto) delete aj().modeloAuto[g.prov]; save();
        if (!inp.value.trim()) { A.toast("Primero pega la clave."); return; }
        usar.disabled = true; usar.textContent = "Probando…";
        let ok = false, err = ""; try { ok = !!(await IA.test(g.prov)).ok; } catch (e) { err = e.message || String(e); }
        if (ok && !L21.respaldos(aj()).includes(g.prov)) { Object.assign(aj(), L21.ponerRespaldo(aj(), g.prov, L21.respaldos(aj()).filter((x) => x !== "local").length ? 2 : 1)); save(); }
        usar.disabled = false; usar.textContent = ok ? "✓ En la cadena · probar" : "Probar y usar de respaldo";
        A.toast(ok ? `✅ ${p.nombre} respondió: queda en la cadena.` : `⚠️ ${p.nombre} no respondió: ${err.slice(0, 120)}`, 5000);
        pintar({ [g.prov]: ok ? "ok" : "falla" });
      });
      fila.append(inp, link, usar); f.append(fila); s.append(f);
    });
    const probar = mk("button", "btn small", "🧪 Probar toda la cadena"); probar.type = "button";
    probar.addEventListener("click", async () => { probar.disabled = true; await probarCadena((e) => pintar(e)).then((r) => pintar(r.est)).catch(() => {}); probar.disabled = false; });
    const quitar = mk("button", "btn small ghost", "Quitar los respaldos de la nube"); quitar.type = "button";
    quitar.addEventListener("click", () => { const l = L21.respaldos(aj()); aj().respaldo = l.includes("local") ? "local" : ""; aj().respaldo2 = ""; save(); pintar(); });
    const f2 = mk("div", "row wrap"); f2.append(probar, quitar); s.append(f2);
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) { const r = L21.respaldoIntent(text); if (r) return Object.assign({ a332: true }, r); return base.intent(text); };
  X.run = async function (it, text) {
    if (!it.a332) return base.run(it, text);
    if (it.rs === "poner") return poner(it.prov, it.pos);
    const hay = await localListo();
    if (it.rs === "ver") {
      const falta = !L21.respaldos(aj()).some((p) => p !== "local");
      const t = L21.cadenaTexto(aj(), nombres(), {}, hay);
      return falta ? pick(t + "\n\n**Recomendada gratis: Groq** (sin tarjeta, unas 1.000 preguntas al día, muy rápida). De segunda, OpenRouter con sus modelos gratis.", [["Usar Groq de respaldo", () => poner("groq", 1)], ["Abrir Ajustes", abrirAjustes]]) : R(t);
    }
    A.toast("Probando cada IA de la cadena…", 3000);
    const r = await probarCadena();
    return R(L21.cadenaTexto(aj(), nombres(), r.est, r.hayLocal));
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    // 3.32: quien usaba Groq con un modelo viejo (Llama 3.1 8B) pasa al que Jarvis escoja ahora
    if (aj().modeloAuto && aj().modeloAuto.groq && /llama-3\.1-8b/.test(aj().modeloAuto.groq.m || "")) { delete aj().modeloAuto.groq; save(); }
  };
  X._a332 = { poner, probarCadena };
})();
