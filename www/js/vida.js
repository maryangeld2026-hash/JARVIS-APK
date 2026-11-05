/* Jarvis para Android 3.9 · la vida diaria.
   Gastos y presupuesto (también los avisos del banco) · listas · medicamentos, hábitos y pausas activas · cumpleaños ·
   disparadores automáticos (Bluetooth, cargador, lugares) · modo conducción · «¿qué me perdí?» · cámara inteligente
   (recibos, tarjetas, «¿qué es esto?») · leer en voz alta · preguntarle a tus notas · intérprete en vivo · noticias ·
   emergencia · temporizadores con nombre · planeador semanal de clases.
   Todo lo que puede, lo avisa Android (notificaciones programadas, disparadores): Jarvis no queda despierto esperando.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L8 = window.JL8, L7 = window.JL7, V = window.JV, IA = window.JIA, N = window.JN;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const plug = (n) => (V.native() && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[n]) || null;
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const uid = () => window.JD.uid();
  const hhmm = (h, m) => `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
  const docente = () => D.ajustes.docente !== false;
  const hayIA = () => D.ajustes.proveedor === "local" || !!(((D.ajustes.claves || {})[D.ajustes.proveedor]) || "").trim();
  const estudiantes = () => [].concat(...D.cursos.map((c) => c.estudiantes || []));
  /** Pregunta con botones dentro de la conversación. */
  function pick(text, ops, spoken) {
    const { e } = A.add("assistant", text, "tool");
    e.innerHTML = A.md(text);
    const box = mk("div", "doc-acts");
    ops.forEach(([t, fn]) => { const b = mk("button", "chip", t); b.type = "button"; b.addEventListener("click", () => { box.querySelectorAll("button").forEach((x) => (x.disabled = true)); b.classList.add("on"); fn(); }); box.append(b); });
    e.append(box);
    $("#chat").scrollTop = $("#chat").scrollHeight;
    if (spoken !== false) A.say(spoken || text.split("\n")[0]);
    return e;
  }
  async function http(url) {
    const H = plug("CapacitorHttp");
    if (H) { const r = await H.request({ method: "GET", url, headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36", Accept: "text/html,application/xml,*/*" }, responseType: "text" }); if (r.status >= 400) throw new Error("HTTP " + r.status); return typeof r.data === "string" ? r.data : JSON.stringify(r.data); }
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 12000);
    try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.text(); } finally { clearTimeout(to); }
  }
  const LN = () => plug("LocalNotifications");
  async function cancelar(base, n) { const l = LN(); if (!l) return; const ids = []; for (let k = 0; k < n; k++) ids.push({ id: base + k }); try { await l.cancel({ notifications: ids }); } catch (e) { /* nada */ } }
  async function programar(list) { const l = LN(); if (!l || !list.length) return; try { await l.schedule({ notifications: list }); } catch (e) { /* sin permiso */ } }

  // ======================================================================== GASTOS
  function anotar(g, silencio) {
    D.gastos = D.gastos || [];
    const x = Object.assign({ id: uid(), t: Date.now(), tipo: "gasto" }, g);
    D.gastos.push(x); if (D.gastos.length > 3000) D.gastos.splice(0, D.gastos.length - 3000);
    save();
    const al = x.tipo === "gasto" ? L8.alertaPresupuesto(D.gastos, D.presupuesto, x.cat, Date.now()) : "";
    if (!silencio) R((x.tipo === "ingreso" ? `💰 Anoté un ingreso de **${L8.cop(x.monto)}** (${x.desc}).` : `💸 Anoté **${L8.cop(x.monto)}** en ${x.desc} (${x.cat}).`) + (al ? "\n\n" + al : ""), "tool",
      (x.tipo === "ingreso" ? `Anoté un ingreso de ${x.monto} pesos.` : `Anoté ${x.monto} pesos en ${x.desc}.`) + (al ? " " + al.replace(/[⚠️*]/g, "") : ""));
    return x;
  }
  function verGastos(it) {
    const r = L8.resumen(D.gastos, it.per, Date.now(), it.cat);
    const per = { hoy: "hoy", semana: "esta semana", mes: "este mes", mespasado: "el mes pasado" }[it.per];
    if (!r.n && !r.ingresos) return R(`No tengo gastos anotados ${per}${it.cat ? " en " + it.cat : ""}. Dime, por ejemplo: «gasté 25 mil en almuerzo».`);
    const p = D.presupuesto || {}, lim = it.cat ? (p.cats || {})[it.cat] : p.total;
    let s = `**${it.cat ? "En " + it.cat + ", " : ""}${per} llevas ${L8.cop(r.total)}** (${r.n} gasto${r.n === 1 ? "" : "s"}).`;
    if (lim && it.per === "mes") s += ` Presupuesto: ${L8.cop(lim)} (${Math.round(r.total / lim * 100)} %; te quedan ${L8.cop(Math.max(0, lim - r.total))}).`;
    if (!it.cat && r.cats.length > 1) s += "\n\n" + r.cats.slice(0, 8).map(([c, v]) => `- ${c}: ${L8.cop(v)}`).join("\n");
    if (r.ingresos && !it.cat) s += `\n\nIngresos: ${L8.cop(r.ingresos)}.`;
    return R(s, "tool", `${per} llevas ${r.total} pesos${it.cat ? " en " + it.cat : ""}.${r.cats[0] && !it.cat ? " Lo que más: " + r.cats[0][0] + "." : ""}`);
  }
  async function revisarBanco(hablar) {
    if (!D.ajustes.gastosAuto) return 0;
    const M = plug("Mensajes"); if (!M || !M.banco) return 0;
    let r; try { r = await M.banco({ desde: D.bancoDesde || 0 }); } catch (e) { return 0; }
    const vistos = new Set(D.bancoVistos || []); let n = 0;
    ((r && r.lista) || []).forEach((x) => {
      if (vistos.has(x.clave)) return;
      vistos.add(x.clave);
      const g = L8.banco(x.texto); if (!g) return;
      anotar(Object.assign(g, { t: x.t, auto: true, desc: g.desc.slice(0, 40) }), true); n++;
    });
    D.bancoVistos = [...vistos].slice(-200); D.bancoDesde = Date.now() - 6 * 3600e3; save();
    if (n && hablar !== false) A.toast(`💸 Anoté ${n} movimiento${n > 1 ? "s" : ""} del banco. Di «mis gastos» para verlos.`, 5000);
    return n;
  }

  // ======================================================================== LISTAS
  function lista(nombre, crear) {
    D.listas = D.listas || {};
    const k = nombre || "mercado";
    if (!D.listas[k] && crear) D.listas[k] = { nombre: k, items: [] };
    return D.listas[k];
  }
  function runLista(it) {
    D.listas = D.listas || {};
    if (it.lista === "add") {
      const l = lista(it.nombre, true), nuevos = [];
      it.items.forEach((x) => { if (!l.items.some((y) => !y.hecho && L8.norm(y.t) === L8.norm(x))) { l.items.push({ t: x, hecho: false }); nuevos.push(x); } });
      save();
      return R(nuevos.length ? `🛒 Agregué a la lista de ${l.nombre}: ${nuevos.join(", ")}.` : "Eso ya estaba en la lista.");
    }
    if (it.lista === "quitar") {
      let hits = [];
      Object.values(D.listas).filter((l) => !it.nombre || l.nombre === it.nombre).forEach((l) => l.items.forEach((y) => { if (!y.hecho && it.items.some((x) => L8.norm(y.t).includes(L8.norm(x)) || L8.norm(x).includes(L8.norm(y.t)))) { y.hecho = true; hits.push(y.t); } }));
      Object.values(D.listas).forEach((l) => { l.items = l.items.filter((y) => !y.hecho); });
      save();
      return R(hits.length ? `✅ Tachado: ${hits.join(", ")}.` : "Eso no estaba en tus listas.");
    }
    if (it.lista === "vaciar") { const l = lista(it.nombre); if (!l) return R("Esa lista no existe."); l.items = []; save(); return R(`Vacié la lista de ${l.nombre}.`); }
    if (it.lista === "todas") {
      const ls = Object.values(D.listas).filter((l) => l.items.length);
      return R(ls.length ? ls.map((l) => `**${l.nombre}** (${l.items.length}):\n${L8.listaTexto(l)}`).join("\n\n") : "No tienes listas. Dime «agrega leche a la lista».", "tool", ls.length ? `Tienes ${ls.length} listas. Están en la pantalla.` : null);
    }
    if (it.lista === "ver") {
      const l = it.nombre ? lista(it.nombre) : lista("mercado") || Object.values(D.listas).find((x) => x.items.length);
      if (!l || !l.items.length) return R(`La lista${it.nombre ? " de " + it.nombre : ""} está vacía.`);
      return R(`🛒 **Lista de ${l.nombre}:**\n${L8.listaTexto(l)}`, "tool", `En la lista de ${l.nombre}: ${l.items.map((x) => x.t).join(", ")}.`);
    }
    if (it.lista === "enviar") {
      const l = it.nombre ? lista(it.nombre) : lista("mercado") || Object.values(D.listas).find((x) => x.items.length);
      if (!l || !l.items.length) return R("La lista está vacía.");
      return A.dispatch(`mándale un whatsapp a ${it.a} que Lista de ${l.nombre}: ${l.items.map((x) => x.t).join(", ")}`);
    }
  }

  // ======================================================================== MEDICAMENTOS, HÁBITOS Y PAUSAS ACTIVAS
  const MID = 779000, PID = 779300, CID = 779800, TID = 779500;
  async function programarMeds() {
    await cancelar(MID, 120);
    const list = [];
    (D.meds || []).slice(0, 20).forEach((md, i) => md.horas.forEach((h, k) => list.push({ id: MID + i * 6 + k, title: "💊 Jarvis: " + md.nombre, body: `Es hora de ${md.nombre}. ¿Ya la tomaste?`,
      schedule: { on: { hour: h.h, minute: h.m }, allowWhileIdle: true }, actionTypeId: "jarvis_med", extra: { med: md.id } })));
    await programar(list);
    const l = LN(); if (l && l.registerActionTypes) { try { await l.registerActionTypes({ types: [{ id: "recordatorio", actions: [{ id: "posponer", title: "Posponer 10 min" }, { id: "listo", title: "Listo" }] }, { id: "jarvis_med", actions: [{ id: "tomada", title: "✅ Ya la tomé" }, { id: "luego", title: "⏰ En 10 minutos" }] }] }); } catch (e) { /* nada */ } }
  }
  function tomada(id) { const md = (D.meds || []).find((x) => x.id === id) || (D.meds || [])[0]; if (!md) return; (md.tomas = md.tomas || []).push(Date.now()); md.tomas = md.tomas.slice(-120); save(); return md; }
  const PAUSAS = ["Estira el cuello y los hombros por un minuto.", "Párate, camina un poco y toma agua.", "Mira algo lejano 20 segundos para descansar la vista.", "Estira brazos y espalda, respira hondo tres veces.", "Mueve las muñecas y los dedos, y relaja la mandíbula."];
  async function programarPausas() {
    await cancelar(PID, 100);
    const p = D.ajustes.pausas; if (!p || !p.on) return;
    const list = [];
    for (let d = 2; d <= 6 && list.length < 100; d++) for (let m = p.ini * 60; m < p.fin * 60 && list.length < 100; m += p.cada)
      list.push({ id: PID + list.length, title: "🧘 Pausa activa", body: PAUSAS[list.length % PAUSAS.length], schedule: { on: { weekday: d, hour: Math.floor(m / 60), minute: m % 60 }, allowWhileIdle: true } });
    await programar(list);
  }
  function runHabito(it) {
    if (it.habito === "med_tomada") { const md = tomada(null); return R(md ? `✅ Anotado: tomaste ${md.nombre}.` : "✅ Anotado."); }
    if (it.habito === "pausas") {
      D.ajustes.pausas = it.on ? { on: true, ini: it.ini, fin: it.fin, cada: it.cada } : { on: false }; save(); programarPausas();
      return R(it.on ? `🧘 Pausas activas de lunes a viernes, cada ${it.cada === 60 ? "hora" : it.cada + " minutos"}, de ${hhmm(it.ini, 0)} a ${hhmm(it.fin, 0)}. Te llega un aviso con un ejercicio corto.` : "Quité las pausas activas.");
    }
    D.habitos = D.habitos || {};
    if (it.habito === "ver") {
      const hs = Object.entries(D.habitos); const ms = (D.meds || []);
      if (!hs.length && !ms.length) return R("Todavía no registras hábitos. Dime, por ejemplo, «ya hice ejercicio» o «registra que tomé agua».");
      const s = hs.map(([k, v]) => `- **${k}**: ${L8.racha(v, Date.now())} día(s) seguidos · ${v.filter((t) => Date.now() - t < 7 * 864e5).length} esta semana`)
        .concat(ms.map((md) => `- 💊 ${md.nombre}: ${(md.tomas || []).filter((t) => Date.now() - t < 7 * 864e5).length} tomas en 7 días`));
      return R("**Tus hábitos:**\n" + s.join("\n"), "tool", "Ahí tienes tus rachas.");
    }
    const k = it.nombre, l = D.habitos[k] = D.habitos[k] || [];
    if (l.length && L8.racha([l[l.length - 1]], Date.now()) && new Date(l[l.length - 1]).toDateString() === new Date().toDateString()) { l.push(Date.now()); save(); return R(`👍 Otra vez hoy: ${k}.`); }
    l.push(Date.now()); D.habitos[k] = l.slice(-400); save();
    const r = L8.racha(l, Date.now());
    return R(`✅ ${k[0].toUpperCase() + k.slice(1)}: ${r > 1 ? `¡llevas ${r} días seguidos! 🔥` : "anotado. ¡Empieza la racha!"}`);
  }

  // ======================================================================== CUMPLEAÑOS
  let cumpleContactos = null;
  async function cargarCumples(pedir) {
    if (cumpleContactos && !pedir) return;
    const T = plug("Telefono"); if (!T || !T.cumpleanos) return;
    try {
      const p = T.checkPermissions ? await T.checkPermissions() : null;
      if (!pedir && (!p || p.contactos !== "granted")) return;
      const r = await T.cumpleanos();
      cumpleContactos = ((r && r.lista) || []).map((c) => Object.assign({ nombre: c.nombre }, L8.fechaCumple(c.fecha) || {})).filter((c) => c.mes);
    } catch (e) { /* sin permiso */ }
  }
  function cumples() { const m = new Map(); (cumpleContactos || []).concat(D.cumples || []).forEach((c) => m.set(L8.norm(c.nombre), c)); return [...m.values()]; }
  async function programarCumples() {
    await cancelar(CID, 40);
    const list = [];
    L8.proximos(cumples(), Date.now(), 30).slice(0, 40).forEach((c, k) => {
      const at = new Date(); at.setHours(8, 0, 0, 0); at.setDate(at.getDate() + c.en);
      if (at.getTime() <= Date.now()) return;
      list.push({ id: CID + k, title: "🎂 Hoy cumple años " + c.nombre, body: "Toca para mandarle una felicitación.", schedule: { at, allowWhileIdle: true }, extra: { cumple: c.nombre } });
    });
    await programar(list);
  }
  function felicitar(nombre) {
    const ops = [0, 1, 2].map((k) => { const t = L8.feliz(nombre, k); return [t.length > 46 ? t.slice(0, 44) + "…" : t, () => A.dispatch(`mándale un whatsapp a ${nombre} que ${t}`)]; });
    pick(`🎂 Hoy cumple años **${nombre}**. ¿Le mando una de estas por WhatsApp?`, ops, `Hoy cumple años ${nombre}. ¿Le mando una felicitación?`);
  }
  async function runCumple(it) {
    if (it.cumple === "add") {
      D.cumples = (D.cumples || []).filter((c) => L8.norm(c.nombre) !== L8.norm(it.nombre));
      const nombre = it.nombre.replace(/\b\w/g, (c) => c.toUpperCase());
      D.cumples.push({ nombre, mes: it.mes, dia: it.dia }); save(); programarCumples();
      return R(`🎂 Anotado: ${nombre} cumple el ${it.dia} de ${["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"][it.mes]}. Ese día te aviso a las 8.`);
    }
    await cargarCumples(true);
    const p = L8.proximos(cumples(), Date.now(), it.dias);
    if (!p.length) return R(it.dias === 0 ? "Hoy no cumple años nadie de tus contactos." : "Nadie cumple años en esos días (de los que tengo: tus contactos con cumpleaños guardado y los que me dices).");
    const s = p.slice(0, 12).map((c) => `- ${c.nombre}: ${c.en === 0 ? "**hoy** 🎉" : c.en === 1 ? "mañana" : `el ${c.dia}/${c.mes} (en ${c.en} días)`}`).join("\n");
    R("🎂 **Cumpleaños:**\n" + s, "tool", p[0].en === 0 ? `Hoy cumple años ${p[0].nombre}.` : `El próximo es ${p[0].nombre}, en ${p[0].en} días.`);
    if (p[0].en === 0) felicitar(p[0].nombre);
  }

  // ======================================================================== DISPARADORES AUTOMÁTICOS
  async function syncDisparadores() {
    const P = plug("Disparadores");
    const rs = (D.disparadores || []).filter((r) => /^(?:bt|carga)/.test(r.tipo)).map((r) => ({ tipo: r.tipo, dispositivo: r.dispositivo || "", frase: r.frase }));
    if (P) { try { await P.guardar({ reglas: rs, abrir: D.ajustes.dispAbrir !== false, carro: D.ajustes.carroBt || ((D.disparadores || []).find((r) => r.tipo === "bt_on" && /conduccion/.test(r.frase) && r.dispositivo) || {}).dispositivo || "" }); } catch (e) { /* nada */ } }
  }
  async function runDisp(it) {
    const pasos = L7.pasos(it.accion);
    let frase = it.accion;
    const nueva = { id: uid(), tipo: it.disp, dispositivo: it.dispositivo, frase: "" };
    if (pasos.length > 1) {                                    // varias cosas: se vuelven una habilidad propia
      frase = "automatico " + L8.dispTexto(nueva).replace(/^al /, "") ; D.misHab = (D.misHab || []).filter((h) => h.frase !== L7.norm(frase));
      D.misHab.push({ id: uid(), frase: L7.norm(frase), pasos }); frase = L7.norm(frase);
    }
    nueva.frase = frase;
    if (/^lugar/.test(it.disp)) {
      const pl = (D.lugares || {})[L8.norm(it.dispositivo)] || Object.values(D.lugares || {}).find((p) => L8.norm(p.nombre).includes(L8.norm(it.dispositivo)));
      if (!pl) return R(`Primero guarda el lugar: cuando estés en ${it.dispositivo || "ese lugar"}, dime «guarda este lugar como ${it.dispositivo || "casa"}».`, "err");
      const S = plug("Lugares");
      if (S) { try { await S.programar({ id: "disp-" + nueva.id, lat: pl.lat, lng: pl.lng, radio: 150, texto: frase, salir: it.disp === "lugar_out" }); } catch (e) { return R(e.message || String(e), "err"); } }
      nueva.dispositivo = pl.nombre;
    }
    if (/^bt/.test(it.disp)) {
      const P = plug("Disparadores");
      if (P) {
        try { await P.permisoBluetooth(); } catch (e) { /* sigue */ }
        let l = []; try { l = ((await P.bluetooth()) || {}).lista || []; } catch (e) { /* nada */ }
        const hit = l.find((n) => L8.norm(n).includes(L8.norm(it.dispositivo)));
        if (hit) nueva.dispositivo = hit;
        else if (l.length && it.dispositivo) {
          nueva.dispositivo = "";
          D.disparadores = (D.disparadores || []).concat([nueva]); save(); await syncDisparadores();
          pick(`Listo. ¿Cuál de tus Bluetooth es «${it.dispositivo}»? (si no escoges, funciona con cualquiera)`, l.slice(0, 8).map((n) => [n, () => { nueva.dispositivo = n; save(); syncDisparadores(); R(`Hecho: al conectar «${n}», haré «${frase}».`); }]));
          return;
        }
      }
    }
    D.disparadores = (D.disparadores || []).concat([nueva]); save(); await syncDisparadores();
    const sinVentana = V.native() && !(D.ajustes.dispAbrir === false) ? " Si Android no deja abrirme solo, te llega un aviso para tocar." : "";
    return R(`⚡ Listo: **${L8.dispTexto(nueva)}**, haré «${frase}».${sinVentana}`, "tool", `Listo: ${L8.dispTexto(nueva)}, haré ${frase}.`);
  }
  async function borrarDisp(r) {
    D.disparadores = (D.disparadores || []).filter((x) => x !== r); save();
    if (/^lugar/.test(r.tipo)) { const S = plug("Lugares"); if (S) { try { await S.quitar({ id: "disp-" + r.id }); } catch (e) { /* nada */ } } }
    syncDisparadores();
  }

  // ======================================================================== MODO CONDUCCIÓN Y MENSAJES
  let resp = null;                                             // {m, paso, texto, t}
  async function conduccion(on) {
    D.ajustes.conduccion = !!on; save();
    const M = plug("Mensajes");
    if (M && M.config) { try { await M.config({ conduccion: !!on }); } catch (e) { /* nada */ } }
    document.body.classList.toggle("conduciendo", !!on);
    if (!on) { resp = null; return R("Modo conducción apagado. ¡Que bien que llegaste!"); }
    let falta = "";
    if (M && M.activo) { try { const a = await M.activo(); if (!a.activo) falta = " Para leerte los mensajes necesito el «Acceso a notificaciones»: te abro el ajuste."; if (!a.activo) setTimeout(() => M.permiso(), 1800); } catch (e) { /* nada */ } }
    return R("🚗 Modo conducción: te leo en voz alta los mensajes que lleguen, te digo quién te llama y puedes responder hablando. Para ir a un sitio: «llévame a…». Para terminar: «ya llegué»." + falta);
  }
  function llego(m) {
    if (!D.ajustes.conduccion || document.hidden) return;
    const t = `Mensaje de ${m.de} por ${m.app}: ${m.texto.slice(0, 220)}`;
    A.add("assistant", "📩 " + t, "tool");
    V.say(t + (m.puedeResponder ? ". ¿Le respondo?" : ""));
    if (!m.puedeResponder) return;
    resp = { m, paso: "q", t: Date.now() };
    V.idle().then(() => setTimeout(() => A.listen(true), 300));
  }
  function respIntent(text) {
    if (!resp || Date.now() - resp.t > 60000) { resp = null; return null; }
    const t = L8.norm(text);
    if (/^(?:no|ahora no|despues|luego|ignora(?:lo)?|nada|dejalo)\b/.test(t)) return { r: "no" };
    if (resp.paso === "q") { const m = t.match(/^(?:si\s+)?(?:respondele|dile|contestale|escribele)\s+(?:que\s+)?(.+)$/); if (m) return { r: "texto", texto: String(text).replace(/^\s*(?:s[ií],?\s+)?(?:resp[oó]ndele|dile|cont[eé]stale|escr[ií]bele)\s+(?:que\s+)?/i, "") }; if (/^(?:si|claro|dale|ok|bueno|respondele|contestale)$/.test(t)) return { r: "si" }; return null; }
    if (resp.paso === "texto") return { r: "texto", texto: text };
    if (resp.paso === "ok") return /^(?:si|envialo|enviar|dale|claro|correcto|listo|ok|mandalo)\b/.test(t) ? { r: "enviar" } : { r: "no" };
    return null;
  }
  async function runResp(it) {
    const r = resp; resp.t = Date.now();
    const escuchar = () => V.idle().then(() => setTimeout(() => A.listen(true), 300));
    if (it.r === "no") { resp = null; return R("Listo, no le respondo."); }
    if (it.r === "si") { r.paso = "texto"; R("¿Qué le digo?"); return escuchar(); }
    if (it.r === "texto") { r.texto = it.texto; r.paso = "ok"; R(`¿Le envío a ${r.m.de}: «${it.texto}»?`); return escuchar(); }
    if (it.r === "enviar") {
      resp = null;
      try { await plug("Mensajes").responder({ clave: r.m.clave, texto: r.texto }); return R(`✅ Le respondí a ${r.m.de}.`); } catch (e) { return R(e.message || String(e), "err"); }
    }
  }
  async function perdi() {
    const M = plug("Mensajes");
    if (!M || !M.activas) return R("Para ver tus notificaciones, abre Jarvis en el celular.", "err");
    const r = await M.activas();
    if (r.sinPermiso) { setTimeout(() => M.permiso(), 1500); return R("Para decirte qué te perdiste necesito el «Acceso a notificaciones» de Android: te abro el ajuste. Activa a Jarvis.", "err"); }
    const g = L8.perdi(r.lista);
    const txt = L8.perdiTexto(g);
    if (!g.length) return R(txt);
    pick("🔔 " + txt, [["Léeme los mensajes", () => A.dispatch("¿qué me escribieron?")], ["Listo", () => {}]], txt);
  }

  // ======================================================================== CÁMARA INTELIGENTE
  function shrink(file, max) {
    return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, (max || 1600) / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => no(new Error("No pude abrir la foto.")); img.src = URL.createObjectURL(file); });
  }
  async function fotoJSON(file, prompt, titulo) {
    const url = await shrink(file);
    const u = A.add("user", titulo); const im = mk("img", "msg-img"); im.src = url; u.e.prepend(im);
    A.setState("thinking");
    try { return await IA.json({ system: "Lees fotos con cuidado y respondes solo JSON válido.", messages: [{ role: "user", content: prompt, image: { mime: "image/jpeg", data: url.split(",")[1] } }], maxTokens: 800 }); }
    finally { if (A.getState() === "thinking") A.setState("idle"); }
  }
  async function recibo(file) {
    try {
      const j = await fotoJSON(file, 'Es la foto de un recibo, factura o comprobante de pago en Colombia. Devuelve {"total": número en pesos sin puntos ni comas, "comercio": nombre corto, "categoria": una de comida|mercado|transporte|servicios|vivienda|salud|educación|entretenimiento|ropa|hogar|otros, "fecha": "AAAA-MM-DD" o ""}. Si no es un recibo, {"error": "por qué"}.', "🧾 Anota este recibo");
      if (!j || j.error || !(+j.total > 0)) return R((j && j.error) || "No encontré el total en la foto. Prueba con una foto más cerca y con luz.", "err");
      const g = { monto: Math.round(+j.total), desc: String(j.comercio || "compra").slice(0, 40), cat: String(j.categoria || "") || L8.categoria(j.comercio || "") };
      if (j.fecha && /^\d{4}-\d{2}-\d{2}$/.test(j.fecha)) { const f = new Date(j.fecha + "T12:00:00").getTime(); if (f <= Date.now() && Date.now() - f < 60 * 864e5) g.t = f; }
      pick(`🧾 Leí **${L8.cop(g.monto)}** en **${g.desc}** (${g.cat}). ¿Lo anoto?`, [["✅ Anotar", () => anotar(g)], ["Cancelar", () => R("No lo anoté.")]], `Leí ${g.monto} pesos en ${g.desc}. ¿Lo anoto?`);
    } catch (e) { R(e.message || String(e), "err"); }
  }
  async function tarjeta(file) {
    try {
      const j = await fotoJSON(file, 'Es la foto de una tarjeta de presentación. Devuelve {"nombre":"","telefono":"","email":"","empresa":"","cargo":""} con lo que se lea (teléfono con indicativo si lo trae). Si no es una tarjeta, {"error": "por qué"}.', "🪪 Guarda esta tarjeta");
      if (!j || j.error || !j.nombre) return R((j && j.error) || "No pude leer el nombre en la tarjeta.", "err");
      const f = [j.nombre, j.cargo, j.empresa, j.telefono, j.email].filter(Boolean).join(" · ");
      pick(`🪪 **${f}**\n\n¿Lo guardo en tus contactos? (Android te muestra el contacto para revisarlo antes de guardar)`, [["Guardar en contactos", async () => { const T = plug("Telefono"); if (!T || !T.nuevoContacto) return R("Eso funciona en el celular.", "err"); try { await T.nuevoContacto(j); } catch (e) { R(e.message, "err"); } }], ["Cancelar", () => {}]], `Leí la tarjeta de ${j.nombre}. ¿La guardo en tus contactos?`);
    } catch (e) { R(e.message || String(e), "err"); }
  }
  function queEs(file) { $("#in-texto").value = "¿Qué es esto? Identifícalo (si es un producto, planta, animal, lugar, obra o aparato, dime qué es) y dame un dato útil o qué hacer con él. Sé breve."; return X._h.photoQuestion(file); }
  const camInputs = {};
  function camMenu() {
    const menu = $("#adj-menu"), f = $("#f-escribir");
    if (!menu || !f || $("#cam-recibo-in")) return;
    [["recibo", "🧾", "Recibo o factura → anotar el gasto", recibo], ["tarjeta", "🪪", "Tarjeta de presentación → contacto", tarjeta], ["quees", "🔎", "¿Qué es esto? (foto)", queEs]].forEach(([k, ic, t, fn]) => {
      const i = mk("input"); i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.hidden = true; i.id = "cam-" + k + "-in"; f.append(i); camInputs[k] = i;
      i.addEventListener("change", () => { const fl = i.files[0]; i.value = ""; if (fl) fn(fl); });
      const o = mk("button", "adj-op"); o.type = "button"; o.append(mk("span", "adj-ic", ic), mk("span", "", t));
      o.addEventListener("click", () => { menu.hidden = true; i.click(); });
      menu.append(o);
    });
  }
  function camPedir(k, t) { pick(t, [["📷 Tomar la foto", () => camInputs[k] && camInputs[k].click()], ["🖼️ De la galería", () => { const i = camInputs[k]; if (!i) return; i.removeAttribute("capture"); i.click(); setTimeout(() => i.setAttribute("capture", "environment"), 1500); }]]); }

  // ======================================================================== LEER EN VOZ ALTA
  let lectura = 0;
  async function leer(texto, titulo) {
    const tz = L8.trozos(texto, 300);
    if (!tz.length) return R("No hay texto para leer.", "err");
    const my = ++lectura;
    const { e } = A.add("assistant", `🔊 Leyendo${titulo ? " «" + titulo + "»" : ""} (${tz.length} partes)…`, "tool");
    const stop = mk("button", "chip", "⏹ Parar"); stop.type = "button"; stop.addEventListener("click", () => { lectura++; V.hush(); stop.disabled = true; });
    const box = mk("div", "doc-acts"); box.append(stop); e.append(box);
    V.hush();
    for (let k = 0; k < tz.length; k++) {
      if (my !== lectura) return;
      V.say(tz[k]);
      await V.idle();
      if (my !== lectura) return;
    }
    stop.disabled = true;
  }
  async function leerUrl(url, resumir) {
    A.setState("thinking");
    let p;
    try { p = L8.legible(await http(url)); } catch (e) { A.setState("idle"); return R("No pude abrir esa página: " + (e.message || e), "err"); }
    A.setState("idle");
    if (!p.texto || p.texto.length < 80) return R("No encontré texto para leer en esa página.", "err");
    if (resumir) return A.dispatch(`Resume en puntos clave este artículo «${p.titulo}»:\n\n${p.texto.slice(0, 20000)}`);
    return leer((p.titulo ? p.titulo + ".\n\n" : "") + p.texto, p.titulo);
  }
  function leerCompartido(t) { const u = String(t).match(/https?:\/\/\S+/); return u && t.trim().length < u[0].length + 80 ? leerUrl(u[0]) : leer(t); }
  function leerDoc(q) {
    const ds = D.docs || [];
    const d = q ? ds.find((x) => L8.norm(x.titulo).includes(L8.norm(q))) || ds.map((x) => ({ x, s: L7.sim(L8.norm(x.titulo), L8.norm(q)) })).sort((a, b) => b.s - a.s).map((y) => y.x)[0] : ds[0];
    if (!d) return R("No tengo documentos guardados en Material.", "err");
    return leer(d.md, d.titulo);
  }

  // ======================================================================== PREGÚNTALE A TUS NOTAS
  function fuentes() {
    const f = [];
    (D.docs || []).forEach((d) => f.push({ titulo: d.titulo, texto: d.md || "", t: d.fecha, tipo: "documento" }));
    if ((D.memoria || []).length) f.push({ titulo: "Lo que sé de ti", texto: D.memoria.map((m) => m.texto).join(".\n\n"), tipo: "memoria" });
    (D.compromisos || []).forEach((c) => f.push({ titulo: "Compromiso", texto: c.texto, t: c.t }));
    if (docente()) (D.diario || []).forEach((x) => f.push({ titulo: "Diario de " + x.curso, texto: x.texto, t: x.t }));
    const convs = [{ nombre: (D.convAct || {}).nombre || "General", chat: D.chat }].concat(D.convs || []);
    convs.forEach((c) => (c.chat || []).forEach((m) => { if (m.role === "user" && m.content.length > 25 && !/^(?:según mis notas|busca en mis notas)/i.test(m.content)) f.push({ titulo: "Conversación «" + c.nombre + "»", texto: m.content, t: m.t }); }));
    return f;
  }
  async function notas(q) {
    let r = L8.rank(fuentes(), q, 8);
    // 3.14: búsqueda por significado — si con tus palabras casi no aparece nada, la IA propone palabras parecidas y se busca otra vez
    if (r.length < 3 && hayIA()) {
      try {
        const j = await IA.json({ system: "Ayudas a buscar en notas personales. Respondes solo JSON.", messages: [{ role: "user", content: `Para buscar en mis notas lo que responde «${q}», dame 10 palabras o frases cortas en español que podrían aparecer en esas notas (sinónimos, temas relacionados, nombres de cosas). JSON: {"palabras":["…"]}` }], maxTokens: 200, temperature: 0.2 });
        const ps = ((j && j.palabras) || []).slice(0, 12).join(" ");
        if (ps) { const r2 = L8.rank(fuentes(), q + " " + ps, 8); const vistos = new Set(r.map((x) => x.texto)); r = r.concat(r2.filter((x) => !vistos.has(x.texto))).slice(0, 8); }
      } catch (e) { /* sigue con lo que hay */ }
    }
    if (docente()) { const ns = estudiantes().filter((n) => n.length > 3).map((n) => L8.norm(n)); r = r.filter((x) => !ns.some((n) => L8.norm(x.texto).includes(n))); }   // los nombres de estudiantes no van a la IA
    if (!r.length) return R(`No encontré nada sobre «${q}» en tus notas, documentos ni conversaciones.`);
    const clave = (D.ajustes.claves || {})[D.ajustes.proveedor];
    if (!clave && D.ajustes.proveedor !== "local") return R("**Encontré esto en tus notas:**\n" + r.slice(0, 5).map((x) => `- *${x.fuente}:* ${x.texto.slice(0, 220)}`).join("\n"));
    const ctx = r.slice(0, 6).map((x, i) => `[${i + 1}] (${x.fuente}) ${x.texto.slice(0, 1200)}`).join("\n\n");
    return A.dispatch(`Responde mi pregunta SOLO con base en estos fragmentos de mis notas y documentos; si no está ahí, dímelo. Al final di de qué nota sale (por su nombre entre paréntesis).\n\nPregunta: ${q}\n\nFragmentos:\n${ctx}`);
  }

  // ======================================================================== NOTICIAS
  const newsCache = new Map();
  async function titulares(tema, n) {
    const k = L8.norm(tema || ""), c = newsCache.get(k);
    if (c && Date.now() - c.t < 3600e3) return c.l.slice(0, n || 8);
    const l = L8.rss(await http(L8.newsUrl(tema)), 10);
    newsCache.set(k, { t: Date.now(), l });
    return l.slice(0, n || 8);
  }
  async function noticias(tema) {
    if (!navigator.onLine) return R("Para las noticias necesito internet.", "err");
    try {
      const l = await titulares(tema, 8);
      if (!l.length) return R(`No encontré noticias${tema ? " de " + tema : ""}.`);
      R(`📰 **Noticias${tema ? " de " + tema : ""}:**\n` + l.map((x) => `- [${x.titulo}](${x.link})${x.fuente ? " — " + x.fuente : ""}`).join("\n"), "tool",
        `Las noticias${tema ? " de " + tema : ""}: ` + l.slice(0, 3).map((x) => x.titulo).join(". ") + ".");
    } catch (e) { R("No pude traer las noticias: " + (e.message || e), "err"); }
  }

  // ======================================================================== EMERGENCIA
  let emerT = 0;
  function emergencia() {
    const cs = L8.confianza(D.ajustes.confianza);
    emerT = Date.now();
    const ops = [];
    if (cs.length) ops.push([`🚨 Enviar mi ubicación a ${cs.map((c) => c.nombre || c.numero).join(", ")}`, enviarEmergencia]);
    ops.push(["📞 Llamar al 123", () => { const T = plug("Telefono"); if (T) T.llamar({ numero: "123" }).catch(() => {}); else window.open("tel:123"); }]);
    ops.push(["Cancelar", () => { emerT = 0; R("Cancelado. Aquí estoy si me necesitas."); }]);
    pick(cs.length ? "🚨 **Emergencia.** ¿Envío tu ubicación por mensaje de texto a tus contactos de confianza? También puedes llamar al 123." : "🚨 **Emergencia.** Puedes llamar al 123 (línea de emergencias). Para que yo mande tu ubicación a alguien, escribe tus contactos de confianza en *Ajustes › Vida diaria*.",
      ops, cs.length ? "Emergencia. ¿Envío tu ubicación a tus contactos de confianza? Di sí o toca el botón." : "Emergencia. Toca para llamar al 1 2 3.");
    if (cs.length) V.idle().then(() => setTimeout(() => A.listen(true), 300));
  }
  async function enviarEmergencia() {
    emerT = 0;
    const cs = L8.confianza(D.ajustes.confianza), T = plug("Telefono"), S = plug("Lugares");
    let pos = null; if (S) { try { pos = await S.aqui({}); } catch (e) { /* sin ubicación */ } }
    const txt = pos ? L8.emergenciaMsg(D.ajustes.nombre, pos.lat, pos.lng, pos.precision) : `🚨 ${D.ajustes.nombre || "Tu contacto"} necesita ayuda (no pude obtener la ubicación). Mensaje enviado con Jarvis.`;
    if (!T) return R("Eso funciona en el celular. Mensaje: " + txt, "err");
    let ok = 0; for (const c of cs) { try { await T.sms({ numero: c.numero, texto: txt }); ok++; } catch (e) { /* sigue */ } }
    R(ok ? `✅ Envié tu ${pos ? "ubicación" : "aviso"} a ${ok} contacto${ok > 1 ? "s" : ""}. Si es grave, llama al 123.` : "No pude enviar los mensajes. Llama al 123.", ok ? "tool" : "err");
  }

  // ======================================================================== TEMPORIZADORES CON NOMBRE
  function timers() { D.timers = (D.timers || []).filter((x) => x.fin > Date.now() - 60000); return D.timers; }
  function buscarTimer(n) { const t = timers(); return t.find((x) => L8.norm(x.nombre) === L8.norm(n)) || t.find((x) => L8.norm(x.nombre).includes(L8.norm(n)) || L8.norm(n).includes(L8.norm(x.nombre))); }
  async function avisoTimer(x, k) { await programar([{ id: TID + k, title: "⏲ ¡Listo: " + x.nombre + "!", body: "Se acabó el tiempo de " + x.nombre + ".", schedule: { at: new Date(x.fin), allowWhileIdle: true } }]); }
  async function runTimer(it) {
    if (it.tn === "add") {
      const t = timers(); if (t.length >= 10) return R("Ya tienes 10 temporizadores; cancela alguno.", "err");
      const x = { id: uid(), nombre: it.nombre, fin: Date.now() + it.ms, k: (D.timerK = ((D.timerK || 0) + 1) % 20) };
      D.timers.push(x); save(); avisoTimer(x, x.k);
      return R(`⏲ ${L8.falta(it.ms)} para **${it.nombre}**. Te aviso.`, "tool", `Listo, ${L8.falta(it.ms).replace("min", "minutos").replace(" h ", " horas ").replace(" s", " segundos")} para ${it.nombre}.`);
    }
    if (it.tn === "lista") { const t = timers().filter((x) => x.fin > Date.now()); return R(t.length ? "⏲ " + t.map((x) => `${x.nombre}: faltan ${L8.falta(x.fin - Date.now())}`).join(" · ") : "No tienes temporizadores con nombre."); }
    const x = buscarTimer(it.nombre);
    if (!x) return null;
    if (it.tn === "ver") return R(`Al ${x.nombre} le faltan ${L8.falta(x.fin - Date.now())}.`);
    D.timers = D.timers.filter((y) => y !== x); save(); cancelar(TID + x.k, 1);
    return R(`Cancelé el temporizador de ${x.nombre}.`);
  }
  function tickTimers() {
    const now = Date.now(); let hubo = false;
    (D.timers || []).forEach((x) => {
      if (x.fin <= now && !x.sono) {
        x.sono = true; hubo = true;
        const t = `⏲ ¡Se acabó el tiempo de ${x.nombre}!`;
        A.add("assistant", t, "tool"); V.say(`¡Listo! Se acabó el tiempo de ${x.nombre}.`);
        if (navigator.vibrate) { try { navigator.vibrate([400, 200, 400, 200, 600]); } catch (e) { /* nada */ } }
        cancelar(TID + x.k, 1); if (N && N.showNow && !V.native()) N.showNow("Jarvis", t);
      }
    });
    if (hubo) { D.timers = D.timers.filter((x) => !x.sono); save(); }
  }

  // ======================================================================== PLANEADOR SEMANAL
  async function planSemana(it) {
    if (!docente()) return R("El planeador semanal es del modo docente. Actívalo diciendo «activa el modo docente».");
    const sch = window.JL3 && D.ajustes.horario ? window.JL3.parseSchedule(D.ajustes.horario) : [];
    const cl = L8.semana(sch, it.curso);
    if (!cl.length) return R(sch.length ? `No encontré clases${it.curso ? " de " + it.curso.toUpperCase() : ""} en tu horario.` : "Para planear la semana necesito tu horario: escríbelo en Ajustes (una clase por línea, por ejemplo «lunes 7:00-7:55 7A»).", "err");
    const titulo = `Planeación de la semana${it.curso ? " · " + it.curso.toUpperCase() : ""}${it.tema ? " · " + it.tema : ""}`;
    const { m, e } = A.add("assistant", "", ""); e.classList.add("typing"); A.setState("thinking");
    let last = 0;
    try {
      const full = await IA.chat({ system: "Eres un docente experto de un colegio en Colombia. Escribe en español, en markdown claro.", messages: [{ role: "user", content: L8.semanaPrompt(cl, it.tema, D.ajustes.asignatura) }], maxTokens: 3500, temperature: 0.5,
        onDelta: (_, all) => { m.content = all; const now = performance.now(); if (now - last > 250) { last = now; e.innerHTML = A.md(all); } } });
      m.content = `### ${titulo}\n\n` + full; e.classList.remove("typing"); e.innerHTML = A.md(m.content);
      const doc = { id: uid(), titulo, md: m.content, fecha: Date.now(), tipo: "semana" };
      D.docs = D.docs || []; D.docs.unshift(doc); D.docs = D.docs.slice(0, 120); save();
      if (X._h && X._h.docActions) e.append(X._h.docActions(doc));
      A.say(`Lista la planeación de la semana: ${cl.length} clases. La guardé en Material.`);
    } catch (er) { e.classList.remove("typing"); m.content = er.message; m.cls = "err"; e.classList.add("err"); e.textContent = er.message; }
    save();
    if (A.getState() === "thinking") A.setState(V.isSpeaking() ? "speaking" : "idle");
  }

  // ======================================================================== AJUSTES › VIDA DIARIA
  function settingsSection() {
    const box = $("#aj2"); if (!box || $("#aj-vida")) return;
    const sec = mk("div"); sec.id = "aj-vida";
    sec.append(mk("h3", "sub", "Vida diaria"));
    const lbl = (t) => sec.append(mk("label", "lbl", t));
    const chk = (label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = !!val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); sec.append(l); };
    lbl("Presupuesto del mes (opcional)");
    const pr = mk("input", "inp"); pr.inputMode = "numeric"; pr.placeholder = "Ej.: 2.000.000"; pr.value = D.presupuesto && D.presupuesto.total ? L8.cop(D.presupuesto.total) : "";
    pr.addEventListener("change", () => { D.presupuesto = D.presupuesto || { cats: {} }; D.presupuesto.total = L8.monto(pr.value) || 0; save(); }); sec.append(pr);
    chk("Anotar solos los gastos que avisa el banco (por SMS o su app; se leen en el celular, no salen de él)", D.ajustes.gastosAuto, async (v) => {
      D.ajustes.gastosAuto = v; save(); const M = plug("Mensajes"); if (M && M.config) { try { await M.config({ gastosAuto: v }); const a = await M.activo(); if (v && !a.activo) { A.toast("Activa a Jarvis en «Acceso a notificaciones».", 5000); M.permiso(); } } catch (e) { /* nada */ } }
    });
    lbl("Contactos de confianza para emergencias (uno por línea: «Nombre: número»)");
    const cf = mk("textarea", "inp"); cf.rows = 3; cf.placeholder = "Mamá: 3001234567\nPedro: 3109998877"; cf.value = D.ajustes.confianza || ""; cf.addEventListener("change", () => { D.ajustes.confianza = cf.value; save(); }); sec.append(cf);
    lbl("Temas de noticias para el resumen de la mañana (separados por coma)");
    const nt = mk("input", "inp"); nt.placeholder = "Colombia, tecnología, deportes"; nt.value = D.ajustes.noticias || ""; nt.addEventListener("change", () => { D.ajustes.noticias = nt.value.trim(); save(); }); sec.append(nt);
    chk("En el resumen de la mañana: cumpleaños, gastos del mes y noticias", D.ajustes.resumenVida !== false, (v) => { D.ajustes.resumenVida = v; save(); });
    sec.append(mk("h3", "sub", "Disparadores automáticos"));
    sec.append(mk("p", "hint", "Dile, por ejemplo: «cuando conecte el carro, modo conducción», «al poner a cargar el celular, activa el modo ahorro» o «cuando llegue a la casa, silencia el celular». Android avisa estos eventos: Jarvis no queda despierto esperando."));
    chk("Abrir Jarvis solo cuando pase (necesita «Mostrar sobre otras apps»; si no, te llega un aviso para tocar)", D.ajustes.dispAbrir !== false, (v) => { D.ajustes.dispAbrir = v; save(); syncDisparadores(); });
    const dl = mk("ul", "conv-list"); sec.append(dl);
    sec.append(mk("h3", "sub", "Medicamentos"));
    const ml = mk("ul", "conv-list"); sec.append(ml);
    const pinta = () => {
      dl.textContent = ""; ml.textContent = "";
      (D.disparadores || []).forEach((r) => { const li = mk("li"), d = mk("div", "grow"); d.append(mk("b", "", L8.dispTexto(r)), mk("small", "", " → " + r.frase)); const b = mk("button", "btn danger", "Borrar"); b.type = "button"; b.addEventListener("click", async () => { await borrarDisp(r); pinta(); }); li.append(d, b); dl.append(li); });
      if (!(D.disparadores || []).length) dl.append(mk("li", "hint", "Todavía no tienes."));
      (D.meds || []).forEach((md) => { const li = mk("li"), d = mk("div", "grow"); d.append(mk("b", "", "💊 " + md.nombre), mk("small", "", " · " + md.horas.map((h) => hhmm(h.h, h.m)).join(", "))); const b = mk("button", "btn danger", "Borrar"); b.type = "button"; b.addEventListener("click", () => { D.meds = D.meds.filter((y) => y !== md); save(); programarMeds(); pinta(); }); li.append(d, b); ml.append(li); });
      if (!(D.meds || []).length) ml.append(mk("li", "hint", "Dile: «recuérdame tomar la pastilla de la presión a las 8 y a las 8 de la noche»."));
    };
    pinta();
    const g = $("#aj-gen"); if (g) g.after(sec); else box.prepend(sec);
  }

  // ======================================================================== PARA EL RESUMEN DE LA MAÑANA
  async function extrasHoy() {
    if (D.ajustes.resumenVida === false) return [];
    const out = [];
    await cargarCumples(false);
    const c = L8.proximos(cumples(), Date.now(), 0);
    if (c.length) out.push(`Hoy cumple años ${c.map((x) => x.nombre).join(" y ")}. 🎂`);
    const md = (D.meds || []).filter((m) => m.horas.some((h) => h.h * 60 + h.m > new Date().getHours() * 60 + new Date().getMinutes()));
    if (md.length) out.push(`Hoy te toca: ${md.map((m) => m.nombre).join(", ")}.`);
    const r = L8.resumen(D.gastos, "mes", Date.now());
    if (r.n) { const lim = (D.presupuesto || {}).total; out.push(`Este mes llevas ${L8.cop(r.total)} en gastos${lim ? ` (${Math.round(r.total / lim * 100)} % del presupuesto)` : ""}.`); }
    if (navigator.onLine) { try { const tema = String(D.ajustes.noticias || "").split(",")[0].trim(); const l = await titulares(tema, 3); if (l.length) out.push("Noticias: " + l.map((x) => x.titulo).join(". ") + "."); } catch (e) { /* sin noticias */ } }
    return out;
  }

  // ======================================================================== ÓRDENES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, hoyExtra: X.hoyExtra };
  X.intent = function (text) {
    const t = L8.norm(text).replace(/^jarvis\s+/, "");
    const rp = respIntent(text); if (rp) return { vd: "resp", it: rp };
    if (emerT && Date.now() - emerT < 90000 && /^(?:si|envia(?:lo)?|enviar|dale|ayuda|si envia)\b/.test(t)) return { vd: "emer_enviar" };
    if (/^(?:para|deja|deten)\s+de\s+leer$|^(?:para|detente)\s+(?:la\s+)?lectura$/.test(t)) return { vd: "parar_lectura" };
    const tm = L8.timerIntent(text); if (tm && (tm.tn === "add" || tm.tn === "lista" || buscarTimer(tm.nombre))) return { vd: "timer", it: tm };
    const md = L8.medIntent(text); if (md) return { vd: "med", it: md };
    const dp = L8.dispIntent(text); if (dp) return { vd: "disp", it: dp };
    const g = L8.gastoIntent(text); if (g) return { vd: "gasto", it: g };
    const ls = L8.listaIntent(text, D.cursos.map((c) => c.nombre)); if (ls) return { vd: "lista", it: ls };
    const hb = L8.habitoIntent(text); if (hb) return { vd: "habito", it: hb };
    const cu = L8.cumpleIntent(text); if (cu) return { vd: "cumple", it: cu };
    const vr = L8.variosIntent(text); if (vr) return { vd: "varios", it: vr };
    if (/^(?:escanea|anota|lee)\s+(?:este|un|el)\s+recibo|^foto (?:al|del) recibo|^(?:anota|lee) (?:esta|la) factura/.test(t)) return { vd: "cam", k: "recibo" };
    if (/^(?:guarda|escanea|lee)\s+(?:esta|una|la)\s+tarjeta/.test(t)) return { vd: "cam", k: "tarjeta" };
    if (/^(?:que es esto|que es eso|identifica esto|mira esto)$/.test(t)) return { vd: "cam", k: "quees" };
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.vd) return base.run(it, text);
    switch (it.vd) {
      case "resp": return runResp(it.it);
      case "emer_enviar": return enviarEmergencia();
      case "parar_lectura": lectura++; V.hush(); return R("Listo, paré la lectura.");
      case "timer": { const r = await runTimer(it.it); if (r === null) return R("No tengo un temporizador con ese nombre. Di «mis temporizadores»."); return r; }
      case "med": {
        D.meds = D.meds || [];
        const md = { id: uid(), nombre: it.it.nombre, horas: it.it.horas, tomas: [] };
        D.meds = D.meds.filter((x) => L8.norm(x.nombre) !== L8.norm(md.nombre)).concat([md]); save(); await programarMeds();
        return R(`💊 Listo: todos los días a las ${md.horas.map((h) => hhmm(h.h, h.m)).join(" y ")} te recuerdo **${md.nombre}**. En el aviso tocas «Ya la tomé» o «En 10 minutos».`);
      }
      case "disp": return runDisp(it.it);
      case "gasto": {
        const g = it.it;
        if (g.gasto === "add") return anotar({ monto: g.monto, desc: g.desc, cat: g.cat, tipo: g.tipo });
        if (g.gasto === "ver") { await revisarBanco(false); return verGastos(g); }
        if (g.gasto === "presupuesto") { D.presupuesto = D.presupuesto || { total: 0, cats: {} }; D.presupuesto.cats = D.presupuesto.cats || {}; if (g.cat) D.presupuesto.cats[g.cat] = g.monto; else D.presupuesto.total = g.monto; save(); return R(`Listo: presupuesto ${g.cat ? "de " + g.cat : "del mes"} de ${L8.cop(g.monto)}. Te aviso cuando vayas en el 80 %.`); }
        if (g.gasto === "deshacer") { const x = (D.gastos || []).pop(); save(); return R(x ? `Borré el último: ${L8.cop(x.monto)} en ${x.desc}.` : "No hay gastos anotados."); }
        break;
      }
      case "lista": return runLista(it.it);
      case "habito": return runHabito(it.it);
      case "cumple": return runCumple(it.it);
      case "cam": return camPedir(it.k, it.k === "recibo" ? "🧾 Tómale una foto al recibo o factura y anoto el gasto." : it.k === "tarjeta" ? "🪪 Tómale una foto a la tarjeta de presentación." : "🔎 Tómale una foto y te digo qué es.");
      case "varios": {
        const v = it.it;
        if (v.v === "conduccion") return conduccion(v.on);
        if (v.v === "perdi") return perdi();
        if (v.v === "emergencia") return emergencia();
        if (v.v === "interprete") {
          if (!X._live) return R("El intérprete usa la conversación en vivo de Gemini.", "err");
          R(`🌐 Modo intérprete español ⇄ ${L8.idiomaNombre(v.idioma)}: habla tú y la otra persona por turnos; traduzco cada frase en voz alta. Para terminar, toca «Colgar».`);
          await V.idle();
          return X._live.start({ sys: L8.interpretePrompt(v.idioma), titulo: "Intérprete" });
        }
        if (v.v === "noticias") return noticias(v.tema);
        if (v.v === "leer_doc") return leerDoc(v.q);
        if (v.v === "leer_url") return leerUrl(v.url, v.resumir);
        if (v.v === "notas") return notas(v.q);
        if (v.v === "semana") return planSemana(v);
      }
    }
  };
  X.hoyExtra = function () {
    const items = base.hoyExtra ? base.hoyExtra() : [];
    timers().filter((x) => x.fin > Date.now()).forEach((x) => items.push({ txt: `⏲ ${x.nombre} · ${L8.falta(x.fin - Date.now())}`, cls: "run", cmd: `¿cuánto le falta al ${x.nombre}?` }));
    if (D.ajustes.conduccion) items.push({ txt: "🚗 Conduciendo", cls: "run", cmd: "ya llegué" });
    return items;
  };
  X.extrasHoy = extrasHoy;
  X.settings = function () { try { base.settings(); } catch (e) { console.error(e); } try { settingsSection(); } catch (e) { console.error(e); } };
  X.init = function (api) {
    A = api; D = api.D;
    D.gastos = D.gastos || []; D.listas = D.listas || {}; D.meds = D.meds || []; D.timers = D.timers || []; D.disparadores = D.disparadores || [];
    try { base.init(api); } catch (e) { console.error("init", e); }
    camMenu();
    document.body.classList.toggle("conduciendo", !!D.ajustes.conduccion);
    const M = plug("Mensajes");
    if (M) {
      window.JON(M, "llego", llego);
      if (M.config) M.config({ conduccion: !!D.ajustes.conduccion, gastosAuto: !!D.ajustes.gastosAuto }).catch(() => {});
    }
    const l = LN();
    if (l) window.JON(l, "localNotificationActionPerformed", (ev) => {
      const ex = (ev && ev.notification && ev.notification.extra) || {};
      if (ex.med) {
        if (ev.actionId === "luego") { const md = D.meds.find((x) => x.id === ex.med); if (md) programar([{ id: MID + 119, title: "💊 Jarvis: " + md.nombre, body: "Ahora sí: " + md.nombre + ".", schedule: { at: new Date(Date.now() + 10 * 60000), allowWhileIdle: true }, actionTypeId: "jarvis_med", extra: { med: md.id } }]); A.toast("Te lo recuerdo en 10 minutos."); }
        else { const md = tomada(ex.med); if (md && ev.actionId === "tomada") A.toast("✅ Anotado: " + md.nombre); else if (md) setTimeout(() => pick(`💊 ¿Ya tomaste ${md.nombre}?`, [["✅ Ya la tomé", () => R("Anotado.")], ["⏰ En 10 minutos", () => programar([{ id: MID + 119, title: "💊 Jarvis: " + md.nombre, body: md.nombre, schedule: { at: new Date(Date.now() + 10 * 60000) }, actionTypeId: "jarvis_med", extra: { med: md.id } }])]]), 600); }
      }
      if (ex.cumple) setTimeout(() => { A.tab("hablar"); felicitar(ex.cumple); }, 600);
    });
    // lo programado lo avisa Android: se rehace al abrir (es barato) y nada queda corriendo
    setTimeout(async () => { programarMeds(); programarPausas(); syncDisparadores(); await cargarCumples(false); programarCumples(); revisarBanco(); }, 3000);
    window.JEVERY(1000, () => { if ((D.timers || []).length) tickTimers(); });
    window.JEVERY(10 * 60000, () => revisarBanco());
    const callar = $("#btn-callar"); if (callar) callar.addEventListener("click", () => { lectura++; });
  };
  X._vida = { pick, http, cancelar, programar, timers, leer, leerUrl, leerCompartido, recibo, tarjeta, queEs, notas, noticias, titulares, emergencia, enviarEmergencia, anotar, revisarBanco, runLista, extrasHoy, syncDisparadores, tickTimers, conduccion, llego, perdi };
})();
