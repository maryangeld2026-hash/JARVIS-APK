/* Jarvis para Android 3.26 · los modelos de la cuenta y el probador.
   · Ajustes › Inteligencia artificial › «Modelos y probador»: la lista de TODOS los modelos de tu cuenta (Gemini y los demás),
     escoger uno o «Automático», probar uno o todos (cuánto tarda cada uno, cuáles no tienen cupo).
   · Jarvis rota entre todos los modelos de la cuenta: si uno se queda sin cupo, sigue con el siguiente.
   · DeepSeek V4.1 Flash como segunda IA en la nube (respaldo), con su clave y su prueba.
   · Por voz: «prueba los modelos», «¿qué modelos tengo?». */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L16 = window.JL16, IA = window.JIA, L = window.JL;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const aj = () => D.ajustes;
  const nombreProv = (p) => (L.PROVIDERS[p] || {}).nombre || p;
  const conClave = () => Object.keys(L.PROVIDERS).filter((k) => !["local", "propio"].includes(k) && ((aj().claves || {})[k] || "").trim());

  /** Prueba varios modelos, de a 3 a la vez. cada(i, r) se llama al terminar cada uno. */
  async function probarVarios(prov, ids, cada) {
    const res = new Array(ids.length);
    let i = 0;
    const trabajador = async () => {
      while (i < ids.length) {
        const k = i++;
        const r = await IA.probarModelo(prov, ids[k]);
        res[k] = { id: ids[k], r };
        if (cada) cada(k, r);
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador()]);
    return res;
  }

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-326")) return;
    const s = mk("div"); s.id = "aj-326";
    s.append(mk("h3", "sub", "Modelos y probador"));
    s.append(mk("p", "hint", "Todos los modelos de tu cuenta. Si uno se queda sin cupo, Jarvis sigue solo con el siguiente de la lista."));
    const fila = mk("div", "pm-fila");
    const sel = mk("select", "inp"); sel.id = "pm-prov";
    const llenar = () => {
      sel.textContent = "";
      const ps = [...new Set([aj().proveedor].concat(conClave()))].filter((p) => p && L.PROVIDERS[p] && !["local", "propio"].includes(p));
      ps.forEach((p) => sel.append(new Option(nombreProv(p) + (p === aj().proveedor ? " (principal)" : p === aj().respaldo ? " (respaldo)" : ""), p)));
    };
    llenar();
    const bVer = mk("button", "btn small", "📋 Ver mis modelos"); bVer.type = "button";
    const bTodos = mk("button", "btn small", "🧪 Probar todos"); bTodos.type = "button";
    fila.append(sel, bVer, bTodos);
    s.append(fila);
    const l2 = mk("label", "lbl check"), ck = mk("input"); ck.type = "checkbox"; ck.checked = aj().rotarModelos !== false;
    ck.addEventListener("change", () => { aj().rotarModelos = ck.checked; save(); });
    l2.append(ck, document.createTextNode(" Rotar entre todos los modelos cuando uno se queda sin cupo")); s.append(l2);
    const res = mk("p", "hint pm-res"); res.id = "pm-res"; s.append(res);
    const lista = mk("div", "pm-lista"); lista.id = "pm-lista"; s.append(lista);
    bVer.addEventListener("click", () => verLista(sel.value, lista, res));
    bTodos.addEventListener("click", async () => { if (!lista.childElementCount || lista.dataset.prov !== sel.value) await verLista(sel.value, lista, res); probarTodos(sel.value, lista, res); });
    sel.addEventListener("change", () => { lista.textContent = ""; res.textContent = ""; });

    // DeepSeek V4.1 Flash, la segunda en la nube
    s.append(mk("h3", "sub", "Segunda IA en la nube: DeepSeek"));
    const ds = mk("div", "pm-ds"); s.append(ds);
    const pintarDs = () => {
      ds.textContent = "";
      const es = aj().respaldo === "deepseek", prin = aj().proveedor === "deepseek";
      ds.append(mk("p", "hint", prin ? "DeepSeek V4.1 Flash es tu IA principal." : es ? "✓ DeepSeek V4.1 Flash es tu respaldo: si la principal falla, se queda sin cupo o no tiene la clave, responde DeepSeek."
        : "DeepSeek V4.1 Flash como respaldo: si la principal falla o se queda sin cupo, responde DeepSeek (barata y rápida; no ve fotos ni PDF)."));
      const k = mk("input", "inp"); k.type = "password"; k.autocomplete = "off"; k.placeholder = "Clave de DeepSeek (sk-…)"; k.value = (aj().claves || {}).deepseek || "";
      k.addEventListener("change", () => { aj().claves = aj().claves || {}; aj().claves.deepseek = k.value.trim(); if (aj().modeloAuto) delete aj().modeloAuto.deepseek; save(); llenar(); });
      ds.append(k);
      const f = mk("div", "doc-acts");
      const bt = (t, fn, on) => { const b = mk("button", "chip" + (on ? " on" : ""), t); b.type = "button"; b.addEventListener("click", fn); f.append(b); };
      if (!es && !prin) bt("🛟 Usar DeepSeek de respaldo", () => { aj().respaldo = "deepseek"; save(); const r = $("#a-respaldo"); if (r) { r.value = "deepseek"; r.dispatchEvent(new Event("change")); } pintarDs(); llenar(); }, true);
      bt("🧪 Probar DeepSeek", async (ev) => {
        const b = ev.target; b.disabled = true; const t = b.textContent; b.textContent = "Probando…";
        const r = await IA.probarModelo("deepseek", (L.PROVIDERS.deepseek || {}).modelo || "deepseek-flash");
        b.disabled = false; b.textContent = t;
        A.toast(r.ok ? `DeepSeek responde (${(r.ms / 1000).toFixed(1).replace(".", ",")} s).` : "DeepSeek: " + L16.clasificar(r).texto.replace(/^✗ /, "") + (r.error && r.error.message ? " · " + r.error.message.slice(0, 80) : ""), 6000);
      });
      const a = mk("a", "chip", "🔑 Conseguir una clave"); a.href = (L.PROVIDERS.deepseek || {}).clave || "#"; a.target = "_blank"; a.rel = "noopener"; f.append(a);
      ds.append(f);
    };
    pintarDs();
    box.append(s);
  }

  async function verLista(prov, lista, res) {
    lista.textContent = ""; lista.dataset.prov = prov;
    res.textContent = "Buscando los modelos de tu cuenta…";
    let ms;
    try { ms = await IA.modelosCuenta(prov); } catch (e) { res.textContent = e.message || String(e); return []; }
    const principal = prov === aj().proveedor;
    const elegido = principal ? (aj().modelo || "") : null;
    const sc = IA.sinCupo();
    res.textContent = `${ms.length} modelo${ms.length === 1 ? "" : "s"} para conversar en tu cuenta de ${nombreProv(prov)}${principal ? " · toca uno para usarlo siempre, o «Automático»" : ""}.`;
    const fila = (id, nombre, auto) => {
      const r = mk("div", "pm-m" + (auto ? " pm-auto" : "")); r.dataset.id = id;
      if (principal) {
        const rb = mk("input"); rb.type = "radio"; rb.name = "pm-usar"; rb.checked = auto ? !elegido : elegido === id;
        rb.addEventListener("change", () => { aj().modelo = auto ? "" : id; save(); const i = $("#a-modelo"); if (i) i.value = aj().modelo; A.toast(auto ? "Modelo automático (el rápido de tu cuenta, con rotación)." : `Jarvis usará ${id}.`); });
        r.append(rb);
      }
      const t = mk("div", "pm-t"); t.append(mk("b", "", auto ? "Automático (recomendado)" : id));
      if (nombre && !auto) t.append(mk("small", "", nombre));
      if (auto) t.append(mk("small", "", "El rápido de tu cuenta; si se queda sin cupo, el siguiente"));
      r.append(t);
      if (!auto) {
        const est = mk("span", "pm-est"); if (sc[id] > Date.now()) { est.textContent = "sin cupo"; est.dataset.e = "cupo"; } r.append(est);
        const b = mk("button", "chip", "Probar"); b.type = "button";
        b.addEventListener("click", async () => { b.disabled = true; est.textContent = "…"; const x = await IA.probarModelo(prov, id); pintar(est, x); b.disabled = false; });
        r.append(b);
      }
      lista.append(r);
    };
    fila("", "", true);
    ms.forEach((m) => fila(m.id, m.nombre, false));
    return ms;
  }
  function pintar(est, r) { const c = L16.clasificar(r); est.textContent = c.texto; est.dataset.e = c.estado; est.title = r.error ? r.error.message : r.texto || ""; }

  async function probarTodos(prov, lista, res) {
    const ids = [...lista.querySelectorAll(".pm-m:not(.pm-auto)")].map((x) => x.dataset.id);
    if (!ids.length) return;
    let n = 0;
    res.textContent = `Probando ${ids.length} modelos…`;
    const out = await probarVarios(prov, ids, (k, r) => {
      n++; res.textContent = `Probando… ${n} de ${ids.length}`;
      const est = lista.querySelector(`.pm-m[data-id="${CSS.escape(ids[k])}"] .pm-est`); if (est) pintar(est, r);
    });
    res.innerHTML = A.md(L16.resumen(out, nombreProv(prov)));
    return out;
  }

  // ======================================================================== POR VOZ
  async function enChat(it) {
    const prov = it.prov || aj().proveedor;
    if (!L.PROVIDERS[prov] || ["local", "propio"].includes(prov)) return R("El probador es para las IA de la nube (Gemini, DeepSeek, ChatGPT…). La del celular la pruebas en Ajustes › IA de respaldo.");
    let ms;
    try { ms = await IA.modelosCuenta(prov); } catch (e) { return R(e.message || String(e), "err"); }
    if (it.pm === "lista") {
      const cab = `🧠 **${ms.length} modelos para conversar** en tu cuenta de ${nombreProv(prov)} (en el orden en que Jarvis los rota):\n`;
      return R(cab + ms.map((m, i) => `${i + 1}. \`${m.id}\`${m.nombre ? " — " + m.nombre : ""}`).join("\n"), "tool", `Tienes ${ms.length} modelos para conversar en ${nombreProv(prov)}.`);
    }
    const { e } = A.add("assistant", `🧪 Probando ${ms.length} modelos de ${nombreProv(prov)}…`, "tool");
    let n = 0;
    const out = await probarVarios(prov, ms.map((m) => m.id), () => { n++; e.textContent = `🧪 Probando ${ms.length} modelos de ${nombreProv(prov)}… ${n} de ${ms.length}`; });
    const tabla = "\n\n| Modelo | Resultado |\n|---|---|\n" + out.map((x) => `| \`${x.id}\` | ${L16.clasificar(x.r).texto} |`).join("\n");
    const extra = [];
    if (aj().respaldo && !["local", "propio"].includes(aj().respaldo) && aj().respaldo !== prov) {
      const rp = await IA.probarModelo(aj().respaldo, await IA.model(IA.cfgFor(aj().respaldo, false)));
      extra.push(`Respaldo (${nombreProv(aj().respaldo)}): ${L16.clasificar(rp).texto}.`);
    }
    e.remove();
    const res = L16.resumen(out, nombreProv(prov));
    return R(res + (extra.length ? " " + extra.join(" ") : "") + tabla, "tool", res.replace(/\*\*|`/g, "") + " " + extra.join(" "));
  }

  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const it = L16.probadorIntent(text); if (it) return Object.assign({ t326: 1 }, it);
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.t326) return base.run(it, text);
    return enChat(it);
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Modelos/.test(x[0]))) C.push(["🧪 Modelos de la IA", ["Prueba los modelos", "¿Qué modelos tengo?", "Prueba los modelos de DeepSeek"]]);
  };
  X._modelos = { enChat, probarVarios };
})();
