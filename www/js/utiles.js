/* Jarvis para Android 3.35 · diez habilidades más:
   🧾 dividir la cuenta · 📱 tiempo de pantalla · 👥 resumir grupos · 🌐 traducir mensajes · 📶 compartir el wifi ·
   📊 informe del mes · 🔧 mantenimiento del vehículo · 🔑 ¿dónde dejé…? · 🃏 tarjetas de repaso · 🎓 modos expertos.
   Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L = window.JL23, L8 = window.JL8, L9 = window.JL9, IA = window.JIA;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const save = () => window.JD.save();
  const R = (t, cls, spoken) => A.reply(t, cls || "tool", spoken);
  const cap = () => window.Capacitor;
  const native = () => !!(cap() && cap().isNativePlatform && cap().isNativePlatform());
  const plug = (n) => (native() && cap().Plugins && cap().Plugins[n]) || null;
  const aj = () => D.ajustes;
  const pick = (t, ops, sp) => X._vida ? X._vida.pick(t, ops, sp) : R(t);
  const hayIA = () => aj().proveedor === "local" || !!(((aj().claves || {})[aj().proveedor]) || "").trim();
  const docente = () => aj().docente === true;
  const programar = (l) => X._vida && X._vida.programar ? X._vida.programar(l) : null;
  const cancelar = (base, n) => X._vida && X._vida.cancelar ? X._vida.cancelar(base, n) : null;
  const sinIA = () => R("Para eso necesito la IA: pon tu clave en Ajustes.", "err");
  /** En modo docente, nada que nombre a un estudiante sale a la nube. */
  const sinNombres = (t) => { if (!docente()) return t; const ns = [].concat(...(D.cursos || []).map((c) => c.estudiantes || [])).filter((n) => n.length > 3).map((n) => L.norm(n)); return String(t).split("\n").filter((l) => !ns.some((n) => L.norm(l).includes(n))).join("\n"); };
  function foto() { return new Promise((ok) => { const i = mk("input"); i.type = "file"; i.accept = "image/*"; i.setAttribute("capture", "environment"); i.style.display = "none"; i.addEventListener("change", () => { ok(i.files && i.files[0]); i.remove(); }); document.body.append(i); i.click(); }); }
  function achicar(file) { return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(img.src); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => no(new Error("No pude abrir la foto.")); img.src = URL.createObjectURL(file); }); }
  const ID_INF = 798100, ID_REP = 798200, ID_VEH = 798300;

  // ======================================================================== 🧾 DIVIDIR LA CUENTA
  let cuenta = null;   // la última cuenta leída de una foto (30 minutos)
  async function dividirCuenta(it) {
    if (it.cu === "dividir") { const d = L.dividir(it.total, it.n, it.propina); return R(L.divisionTexto(d) + (it.propina == null ? "\n\n_Le sumé el 10 % de propina sugerida; si no la van a dar, di «… sin propina»._" : ""), "tool", `Cada uno paga ${L.cop(d.cada).replace("$", "")} pesos.`); }
    if (it.cu === "propina") { const p = Math.round(it.total * it.propina / 100); return R(`🧾 El ${it.propina} % de ${L.cop(it.total)} es **${L.cop(p)}**. Total: **${L.cop(it.total + p)}**.`); }
    if (it.cu === "pidieron") return asignar(it.dicho);
    if (!hayIA()) return sinIA();
    R("📷 Tómale una foto a la cuenta (derecha y con luz).");
    const f = await foto(); if (!f) return;
    const u = await achicar(f); const ue = A.add("user", "🧾 Divide esta cuenta"); const im = mk("img", "msg-img"); im.src = u; ue.e.prepend(im);
    A.setState("thinking");
    let j; try { j = await IA.json({ system: "Lees cuentas y facturas. Respondes solo JSON.", messages: [{ role: "user", content: L.PROMPT_CUENTA, image: { mime: "image/jpeg", data: u.split(",")[1] } }], maxTokens: 1200, temperature: 0.1 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    const items = ((j && j.items) || []).filter((x) => x && x.nombre && +x.precio > 0).map((x) => ({ nombre: String(x.nombre).slice(0, 60), precio: Math.round(+x.precio) }));
    if (!items.length) return R("No pude leer esa cuenta" + (j && j.error ? ": " + j.error : "") + ". Prueba con otra foto o dime el total: «divide 180 mil entre 4».", "err");
    const total = Math.round(+j.total || items.reduce((s, x) => s + x.precio, 0)), incl = !!j.propina_incluida;
    cuenta = { items, total, propina: incl ? 0 : 10, t: Date.now() };
    return opcionesCuenta(incl);
  }
  function opcionesCuenta(incl) {
    const { items, total } = cuenta;
    const n = (k) => () => { const d = L.dividir(total, k, cuenta.propina); R(L.divisionTexto(d)); };
    return pick(`🧾 **Leí la cuenta** (revisa que esté bien):\n${items.map((x, i) => `${i + 1}. ${x.nombre}: ${L.cop(x.precio)}`).join("\n")}\n\n**Total: ${L.cop(total)}**${incl ? " (ya trae la propina o el servicio)" : ""} · ${cuenta.propina ? "le sumo el 10 % de propina sugerida" : "sin propina"}.\n\n¿Cómo la dividimos?`,
      [["Entre 2", n(2)], ["Entre 3", n(3)], ["Entre 4", n(4)], ["Entre 5", n(5)], ["👥 Cada quien lo suyo", () => R("Dime quién pidió qué, empezando con «pidieron»: «pidieron: Ana la bandeja, Luis el ajiaco y la limonada; la gaseosa la compartimos Ana y yo».")],
        [cuenta.propina ? "Sin propina" : "Con 10 % de propina", () => { cuenta.propina = cuenta.propina ? 0 : 10; opcionesCuenta(incl); }]], "Leí la cuenta. ¿Cómo la dividimos?");
  }
  async function asignar(dicho) {
    if (!cuenta || Date.now() - cuenta.t > 30 * 60e3) return R("Primero dime «divide esta cuenta» y tómale la foto.");
    if (!hayIA()) return sinIA();
    A.setState("thinking");
    let j; try { j = await IA.json({ system: "Respondes solo JSON.", messages: [{ role: "user", content: L.PROMPT_ASIGNAR(cuenta.items, dicho) }], maxTokens: 500, temperature: 0.1 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    const asig = (j && j.asignacion) || {};
    const r = L.porPersonaCompartido(cuenta.items, asig, cuenta.propina);
    const sueltos = cuenta.items.map((x, i) => i).filter((i) => !Object.values(asig).some((l) => (l || []).includes(i)));
    return R(`🧾 **Cada quien lo suyo**${cuenta.propina ? " (con el 10 % de propina)" : ""}:\n` + Object.entries(r).map(([q, v]) => `- ${q}: **${L.cop(v)}** (${(asig[q] || []).map((i) => (cuenta.items[i] || {}).nombre).filter(Boolean).join(", ")})`).join("\n") + (sueltos.length ? `\n\n⚠️ Nadie pidió: ${sueltos.map((i) => cuenta.items[i].nombre).join(", ")}.` : ""));
  }

  // ======================================================================== 📱 TIEMPO DE PANTALLA
  async function pantalla(it) {
    const U = plug("Uso"); if (!U) return R("El tiempo de pantalla funciona en la app instalada (el APK).", "err");
    const ok = ((await U.permiso().catch(() => ({}))) || {}).ok;
    if (!ok) return pick("📱 Para ver cuánto usas cada app, Android pide un permiso especial: **Acceso al uso**. Te abro el ajuste: busca Jarvis y actívalo. Los datos no salen de tu celular.", [["Abrir el ajuste", () => U.abrirPermiso().catch(() => {})]]);
    if (it.pa === "ver") {
      let l; try { l = ((await U.uso({ semana: !!it.semana })) || {}).lista || []; } catch (e) { return R(e.message || String(e), "err"); }
      return R(L.pantallaTexto(l, it.semana));
    }
    aj().limitesUso = aj().limitesUso || [];
    if (it.pa === "quitar") {
      const n = L.norm(it.app), antes = aj().limitesUso.length;
      aj().limitesUso = aj().limitesUso.filter((x) => !L.norm(x.nombre).includes(n) && !n.includes(L.norm(x.nombre)));
      save(); await U.limites({ lista: aj().limitesUso }).catch(() => {});
      return R(antes === aj().limitesUso.length ? "No tenías un límite para esa app." : `Listo, quité el límite de ${it.app}.`);
    }
    const apps = ((await U.apps().catch(() => ({}))) || {}).apps || [];
    const a = L.appDe(it.app, apps); if (!a) return R(`No encuentro la app «${it.app}» en tu celular.`, "err");
    aj().limitesUso = aj().limitesUso.filter((x) => x.pkg !== a.pkg).concat([{ pkg: a.pkg, nombre: a.nombre, min: it.min }]);
    save(); await U.limites({ lista: aj().limitesUso }).catch(() => {});
    return R(`⏳ Listo: si un día pasas de **${L.hm(it.min)} en ${a.nombre}**, te aviso (una vez al día). Android lo revisa cada 15 minutos aunque Jarvis esté cerrado. No bloqueo la app: solo te aviso.`);
  }

  // ======================================================================== 👥 RESUMIR GRUPOS · 🌐 TRADUCIR
  async function mensajes(horas) {
    const M = plug("Mensajes"); if (!M) return { error: "Eso funciona en la app instalada (el APK)." };
    let l = [];
    if (M.archivo) { try { const r = await M.archivo({ dias: Math.max(1, Math.ceil(horas / 24)) }); if (r && r.activo) l = (r.lista || []).map((x) => ({ app: x.a, de: x.d, texto: x.x, t: x.t })); } catch (e) { /* nada */ } }
    try { const r = await M.recientes({ desde: Date.now() - horas * 3600e3 }); if (r && r.sinPermiso && !l.length) return { error: "permiso" }; ((r && r.lista) || []).forEach((m) => { if (!l.some((x) => x.t === m.t && x.texto === m.texto)) l.push(m); }); } catch (e) { if (!l.length) return { error: "permiso" }; }
    return { lista: l.filter((m) => m.t >= Date.now() - horas * 3600e3).sort((a, b) => a.t - b.t) };
  }
  const sinPermiso = () => { const M = plug("Mensajes"); return pick("Para leer tus mensajes necesito el «Acceso a notificaciones». Jarvis no los guarda ni los manda a ningún lado sin que se lo pidas.", M ? [["Dar el permiso", () => M.permiso()]] : []); };
  async function grupo(it) {
    const r = await mensajes(24); if (r.error) return r.error === "permiso" ? sinPermiso() : R(r.error, "err");
    const l = L.delGrupo(r.lista, it.gr);
    if (!l.length) return R(`👥 No veo mensajes del grupo «${it.gr}» en las últimas 24 horas. Ojo: solo veo lo que llega como notificación (si el grupo está silenciado o lo leíste en WhatsApp, no me llega). Activa «Recordar mis mensajes» en Ajustes › Mensajes para que guarde más.`);
    if (l.length <= 3 || !hayIA()) return R(`👥 **${it.gr}** (${l.length} mensajes):\n` + l.map((m) => `- **${m.de}**: ${m.texto}`).join("\n"));
    A.setState("thinking");
    try {
      const t = await IA.chat({ system: "Resumes conversaciones en español de Colombia, corto y claro.", messages: [{ role: "user", content: sinNombres(L.PROMPT_GRUPO(it.gr, l.slice(-150))) }], stream: false, maxTokens: 600 });
      A.setState("idle"); return R(`👥 **Lo que se habló en «${it.gr}»** (${l.length} mensajes en 24 h):\n\n${t}\n\n_Solo veo lo que llegó como notificación._`);
    } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
  }
  async function traducir(it) {
    const r = await mensajes(24); if (r.error) return r.error === "permiso" ? sinPermiso() : R(r.error, "err");
    const n = L.norm(it.de || "");
    const cands = r.lista.filter((m) => !n || L.norm(m.de).includes(n));
    const m = cands[cands.length - 1];
    if (it.tr === "leer") {
      if (!m) return R(it.de ? `No veo mensajes recientes de «${it.de}».` : "No veo mensajes recientes.");
      if (!hayIA()) return sinIA();
      A.setState("thinking");
      let j; try { j = await IA.json({ system: "Eres traductor. Respondes solo JSON.", messages: [{ role: "user", content: L.PROMPT_DETECTAR(sinNombres(m.texto) || m.texto) }], maxTokens: 600, temperature: 0.1 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
      A.setState("idle");
      if (!j || /espa/i.test(j.idioma || "")) return R(`💬 El mensaje de ${m.de} ya está en español: «${m.texto}».`);
      ultimoIdioma[L.norm(m.de)] = j.idioma;
      return R(`🌐 **${m.de}** te escribió en ${j.idioma}:\n> ${m.texto}\n\n**En español:** ${j.traduccion}\n\nPara contestarle en su idioma: «respóndele a ${m.de.split(/[ :]/)[0]} en su idioma que…».`, "tool", `${m.de} dice: ${j.traduccion}`);
    }
    // responder en otro idioma: se traduce, se muestra y se envía solo si dices que sí
    const M = plug("Mensajes");
    const dest = cands.filter((x) => x.puedeResponder).pop();
    if (!dest) return R(it.de ? `No tengo un mensaje reciente de «${it.de}» que se pueda responder desde aquí.` : "No tengo un mensaje reciente para responder.", "err");
    if (!hayIA()) return sinIA();
    let idioma = it.idioma; if (/su idioma/i.test(idioma)) idioma = ultimoIdioma[L.norm(dest.de)] || "el mismo idioma de este mensaje: «" + dest.texto.slice(0, 200) + "»";
    A.setState("thinking");
    let tr; try { tr = (await IA.chat({ system: "Eres traductor. Devuelves solo la traducción, natural y cordial, sin comillas.", messages: [{ role: "user", content: `Traduce al ${idioma}: ${it.texto}` }], stream: false, maxTokens: 400 })).trim().replace(/^["«]|["»]$/g, ""); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
    A.setState("idle");
    return pick(`🌐 ¿Le respondo a **${dest.de}** (${dest.app})?\n> ${tr}\n\n_(Tú dijiste: «${it.texto}»)_`, [["Sí, enviar", async () => { try { await M.responder({ clave: dest.clave, texto: tr }); R(`Enviado a ${dest.de}.`); } catch (e) { R(e.message || String(e), "err"); } }], ["No", () => R("Listo, no lo envío.")]], `¿Le respondo a ${dest.de}: ${tr}?`);
  }
  const ultimoIdioma = {};

  // ======================================================================== 📶 COMPARTIR EL WIFI
  function loadQR() { return window.qrcode ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement("script"); s.src = "vendor/qrcode.js"; s.onload = ok; s.onerror = () => no(new Error("No pude cargar el QR.")); document.head.append(s); }); }
  /** La clave no se queda en la conversación (que puede ir a la IA): se tapa. */
  function taparClave(clave) { (D.chat || []).slice(-6).forEach((m) => { if (m.role === "user" && String(m.content).includes(clave)) m.content = String(m.content).split(clave).join("••••••"); }); document.querySelectorAll(".msg.user").forEach((e) => { if (e.textContent.includes(clave)) e.childNodes.forEach((c) => { if (c.nodeType === 3 && c.textContent.includes(clave)) c.textContent = c.textContent.split(clave).join("••••••"); }); }); save(); }
  async function wifi(it) {
    if (it.wf === "guardar") { aj().wifiCasa = { red: it.red, clave: it.clave }; taparClave(it.clave); save(); return pick(`📶 Guardé el wifi **${it.red}** (solo en este celular; tapé la clave en la conversación). Cuando llegue visita, di «comparte el wifi».`, [["Mostrar el QR", () => wifi({ wf: "qr" })]]); }
    if (it.wf === "borrar") { delete aj().wifiCasa; save(); return R("Listo, olvidé el wifi."); }
    const w = aj().wifiCasa;
    if (!w || !w.red) return R("📶 Todavía no sé tu wifi. Android no deja que las apps lean las claves guardadas, así que dímelo una vez en Ajustes › Wifi para compartir (o di «mi wifi se llama … y la clave es …»).");
    try { await loadQR(); } catch (e) { return R(e.message, "err"); }
    const qr = window.qrcode(0, "M"); qr.addData(L.wifiQR(w.red, w.clave)); qr.make();
    const { e } = A.add("assistant", "", "tool");
    e.innerHTML = A.md(`📶 **${w.red}**\nQue escaneen el código con la cámara y se conectan solos (Android y iPhone).`);
    const q = mk("div", "prac-qr"); q.style.cssText = "background:#fff;padding:10px;border-radius:12px;max-width:260px;margin:8px 0"; q.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }); e.append(q);
    const row = mk("div", "chips"); const b = mk("button", "chip", "Mostrar la clave"); b.type = "button"; b.addEventListener("click", () => { b.textContent = "Clave: " + (w.clave || "(sin clave)"); }); row.append(b); e.append(row);
    A.say && A.say("Aquí está el código del wifi.");
  }

  // ======================================================================== 📊 INFORME DEL MES
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function informe(it) {
    const now = Date.now(), d = new Date(now);
    const g = D.gastos || [];
    if (!g.length) return R("📊 No tienes gastos anotados todavía. Dime «gasté 20 mil en almuerzo» y a fin de mes te hago el informe.");
    let a, b, nombre;
    if (it.inf === "pasado") { const enPasado = new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime(); a = L8.resumen(g, "mespasado", now); b = L8.resumen(g, "mespasado", enPasado); nombre = MESES[(d.getMonth() + 11) % 12]; }
    else { a = L8.resumen(g, "mes", now); b = L8.resumen(g, "mespasado", now); nombre = MESES[d.getMonth()] + " (hasta hoy)"; }
    const pagos = L9 ? L9.pagosEstado(D.pagos || [], now).filter((p) => !p.pagado && p.en >= 0) : [];
    const ops = [];
    if (hayIA() && a.total) ops.push(["💡 Consejos para ahorrar", async () => {
      A.setState("thinking");
      try { const t = await IA.chat({ system: "Eres un asesor de finanzas personales en Colombia: práctico, amable y concreto.", messages: [{ role: "user", content: `Mis gastos de ${nombre} por categoría: ${a.cats.map(([c, v]) => c + " " + L.cop(v)).join(", ")}. El mes anterior: ${b.cats.map(([c, v]) => c + " " + L.cop(v)).join(", ") || "sin datos"}. Dame 3 consejos cortos y realistas para ahorrar el próximo mes, empezando por donde más subió.` }], stream: false, maxTokens: 500 }); A.setState("idle"); R("💡 " + t); } catch (e) { A.setState("idle"); R(e.message || String(e), "err"); }
    }]);
    if (!aj().informeMes) ops.push(["🔔 Mándamelo cada 1.º de mes", () => { aj().informeMes = true; save(); programarInforme(); R("Listo: el 1.º de cada mes a las 9 a. m. te aviso con el informe del mes que terminó."); }]);
    return ops.length ? pick(L.informeTexto(nombre, a, b, pagos), ops) : R(L.informeTexto(nombre, a, b, pagos));
  }
  async function programarInforme() {
    await cancelar(ID_INF, 1);
    if (aj().informeMes) await programar([{ id: ID_INF, title: "📊 Tu informe del mes", body: "Ya terminó el mes: toca para ver en qué se fue la plata.", schedule: { on: { day: 1, hour: 9, minute: 0 }, allowWhileIdle: true }, extra: { j335: "informe" } }]);
  }

  // ======================================================================== 🔧 MANTENIMIENTO DEL VEHÍCULO
  function veh(tipo) { D.vehiculos = D.vehiculos || {}; const t = tipo || (D.vehiculos.moto && !D.vehiculos.carro ? "moto" : "carro"); return (D.vehiculos[t] = D.vehiculos[t] || { tipo: t, servicios: {} }); }
  async function avisosVehiculo() {
    await cancelar(ID_VEH, 24);
    const list = [];
    Object.values(D.vehiculos || {}).forEach((v, iv) => L.proximos(v, Date.now()).filter((x) => !x.ya).slice(0, 6).forEach((x, i) => {
      const at = new Date(x.fecha); at.setHours(9, 0, 0, 0); if (at.getTime() < Date.now() + 3600e3) return;
      list.push({ id: ID_VEH + iv * 8 + i, title: `🔧 ${x.nombre} (${v.tipo})`, body: `Ya toca: ${x.nombre.toLowerCase()} de tu ${v.tipo}${x.kmTope ? ` (o a los ${Math.round(x.kmTope).toLocaleString("es-CO")} km, lo que pase primero)` : ""}.`, schedule: { at, allowWhileIdle: true }, extra: { j335: "vehiculo" } });
    }));
    await programar(list);
  }
  async function vehiculo(it) {
    const v = veh(it.tipo);
    if (it.ve === "modelo") { v.modelo = it.modelo; save(); return R(`🔧 Anotado: tu ${v.tipo} es ${it.modelo}.`); }
    if (it.ve === "km") {
      if (v.km && it.km < v.km - 50) return R(`Ojo: antes me dijiste ${v.km.toLocaleString("es-CO")} km. ¿Seguro que son ${it.km.toLocaleString("es-CO")}? Si sí, repítemelo con «el ${v.tipo} va en …» después de corregir.`);
      v.km = it.km; v.kmT = Date.now(); save();
      const ya = L.proximos(v, Date.now()).filter((x) => x.ya || x.pronto);
      return R(`🔧 Anotado: ${it.km.toLocaleString("es-CO")} km.` + (ya.length ? "\n\n" + ya.map((x) => `${x.ya ? "❌ Ya toca" : "⚠️ Pronto"}: ${x.nombre}`).join("\n") : " Todo al día."));
    }
    if (it.ve === "servicio") {
      v.servicios[it.servicio] = { km: it.km != null ? it.km : v.km != null ? v.km : null, t: Date.now() };
      if (it.km && (!v.km || it.km > v.km)) { v.km = it.km; v.kmT = Date.now(); }
      save(); await avisosVehiculo();
      const s = L.SERVICIOS[it.servicio], r = s[v.tipo] || s.carro;
      return R(`🔧 Anotado: **${s.nombre}** de tu ${v.tipo}${it.km ? ` a los ${it.km.toLocaleString("es-CO")} km` : ""}. El próximo: ${r ? `en unos ${r[0].toLocaleString("es-CO")} km o ${r[1]} ${r[1] === 1 ? "mes" : "meses"}` : "cuando lo diga el manual"} (lo que pase primero). Te aviso.${it.km == null && v.km == null ? "\n\nSi me dices los kilómetros («el " + v.tipo + " va en 45.000 km») te aviso también por kilometraje." : ""}`);
    }
    return R(L.vehiculoTexto(v, Date.now()));
  }

  // ======================================================================== 🔑 ¿DÓNDE DEJÉ…?
  function cosas(it) {
    D.cosas = D.cosas || [];
    if (it.cs === "guardar") {
      const prev = L.buscarCosa(D.cosas, it.cosa);
      if (prev && L.norm(prev.cosa) === L.norm(it.cosa)) { prev.lugar = it.lugar; prev.t = Date.now(); } else D.cosas.push({ cosa: it.cosa, lugar: it.lugar, t: Date.now() });
      if (D.cosas.length > 200) D.cosas.splice(0, D.cosas.length - 200);
      save(); return R(`🔑 Anotado: ${it.cosa} → ${it.lugar}. Cuando no lo encuentres, pregúntame «¿dónde dejé ${/s$/.test(it.cosa) ? "las" : "el"} ${it.cosa}?».`);
    }
    if (it.cs === "buscar") { const c = L.buscarCosa(D.cosas, it.cosa); return R(`🔑 ${c.cosa.charAt(0).toUpperCase() + c.cosa.slice(1)}: **${c.lugar}** (me lo dijiste el ${new Date(c.t).toLocaleDateString("es-CO", { day: "numeric", month: "long" })}).`); }
    if (!D.cosas.length) return R("🔑 No tengo cosas anotadas. Cuando guardes algo, dime: «dejé el pasaporte en el cajón del clóset».");
    return pick("🔑 **Dónde están tus cosas:**\n" + D.cosas.slice().sort((a, b) => b.t - a.t).slice(0, 25).map((c) => `- ${c.cosa}: ${c.lugar}`).join("\n"), [["Borrar la lista", () => { D.cosas = []; save(); R("Listo, borré la lista."); }]]);
  }

  // ======================================================================== 🃏 TARJETAS DE REPASO
  async function avisoRepaso() {
    await cancelar(ID_REP, 1);
    const todas = [].concat(...(D.mazos || []).map((m) => m.tarjetas || []));
    if (!todas.length) return;
    const prox = Math.min(...todas.map((c) => c.prox || Date.now()));
    const at = new Date(Math.max(prox, Date.now())); at.setHours(19, 0, 0, 0);
    if (at.getTime() < Date.now() + 60e3) at.setDate(at.getDate() + 1);
    await programar([{ id: ID_REP, title: "🃏 Hora de repasar", body: "Tienes tarjetas listas para repasar (5 minutos).", schedule: { at, allowWhileIdle: true }, extra: { j335: "repaso" } }]);
  }
  async function tarjetas(it) {
    D.mazos = D.mazos || [];
    if (it.ta === "crear") {
      if (!hayIA()) return sinIA();
      A.setState("thinking");
      let j; try { j = await IA.json({ system: "Eres un profe que hace tarjetas de estudio exactas. Respondes solo JSON.", messages: [{ role: "user", content: L.PROMPT_TARJETAS(it.tema, it.n) }], maxTokens: 2500, temperature: 0.3 }); } catch (e) { A.setState("idle"); return R(e.message || String(e), "err"); }
      A.setState("idle");
      const ts = ((j && j.tarjetas) || []).filter((c) => c && c.p && c.r).slice(0, 30).map((c) => ({ p: String(c.p).slice(0, 300), r: String(c.r).slice(0, 400) }));
      if (!ts.length) return R("La IA no devolvió tarjetas. Intenta de nuevo.", "err");
      D.mazos.push({ id: "m" + Date.now().toString(36), tema: it.tema, t: Date.now(), tarjetas: ts }); save(); await avisoRepaso();
      return pick(`🃏 Hice **${ts.length} tarjetas** de ${it.tema}. Las repasas con repetición espaciada: las que te sabes vuelven en días o semanas; las que no, mañana.`, [["Repasar ya", () => repasar()]]);
    }
    if (it.ta === "ver") {
      if (!D.mazos.length) return R("🃏 No tienes tarjetas de repaso. Di «hazme tarjetas de repaso de los verbos en inglés».");
      const hoy = L.pendientes(D.mazos, Date.now());
      return pick("🃏 **Tus mazos:**\n" + D.mazos.map((m) => `- ${m.tema}: ${m.tarjetas.length} tarjetas (${hoy.filter((x) => x.mazo === m.id).length} para hoy)`).join("\n"), [["Repasar", () => repasar()]].concat(D.mazos.slice(-4).map((m) => [`Borrar «${m.tema.slice(0, 20)}»`, () => { D.mazos = D.mazos.filter((x) => x !== m); save(); avisoRepaso(); R("Borrado."); }])));
    }
    return repasar();
  }
  function repasar() {
    const pend = L.pendientes(D.mazos || [], Date.now());
    if (!(D.mazos || []).length) return R("🃏 No tienes tarjetas de repaso. Di «hazme tarjetas de repaso de …».");
    if (!pend.length) return R("🃏 ¡Al día! Hoy no te toca repasar nada. 💪");
    let k = 0, bien = 0;
    const lote = pend.slice(0, 20);
    const una = () => {
      if (k >= lote.length) { save(); avisoRepaso(); return R(`🃏 ¡Listo el repaso! ${bien} de ${lote.length} bien.${pend.length > lote.length ? ` Quedan ${pend.length - lote.length} para después.` : ""}`); }
      const x = lote[k], m = (D.mazos || []).find((z) => z.id === x.mazo); const c = m && m.tarjetas[x.i];
      if (!c) { k++; return una(); }
      const nota = (n) => () => { m.tarjetas[x.i] = L.calificar(c, n, Date.now()); if (n) bien++; k++; save(); una(); };
      pick(`🃏 **${k + 1}/${lote.length}** · ${m.tema}\n\n**${c.p}**`, [["Ver respuesta", () => pick(`**${c.p}**\n\n✅ ${c.r}\n\n¿Cómo te fue?`, [["🔁 Otra vez", nota(0)], ["👍 Bien", nota(1)], ["⚡ Fácil", nota(2)], ["Terminar", () => { save(); avisoRepaso(); R("Listo, seguimos después."); }]], c.r)]], c.p);
    };
    una();
  }

  // ======================================================================== 🎓 MODOS EXPERTOS
  function modoActual() {
    const k = aj().modoExperto; if (!k) return null;
    if (L.MODOS[k]) return { k, nombre: L.MODOS[k][0], instr: L.MODOS[k][1] };
    const p = (D.modosPropios || []).find((x) => "propio:" + x.nombre === k);
    return p ? { k, nombre: "✨ " + p.nombre, instr: p.instr } : null;
  }
  /** 3.36: el modo activo va en la barra de la conversación (antes flotaba encima del reloj). */
  function pintarModo() {
    const m = modoActual(); let b = $("#modo-exp");
    if (!m) { if (b) b.remove(); return; }
    if (!b) { b = mk("button", "chip modo-chip"); b.id = "modo-exp"; b.type = "button"; b.addEventListener("click", () => modo({ mo: "salir" })); }
    const bar = $("#convbar"), ref = bar && bar.querySelector(".conv-b");
    if (bar && b.parentNode !== bar) bar.insertBefore(b, ref || null); else if (!bar && !b.parentNode) { b.classList.add("flota"); document.body.append(b); }
    b.textContent = m.nombre + " ✕"; b.title = "Salir del modo " + m.nombre.replace(/^\S+\s/, ""); b.setAttribute("aria-label", b.title);
  }
  function modo(it) {
    D.modosPropios = D.modosPropios || [];
    if (it.mo === "salir") { const m = modoActual(); aj().modoExperto = ""; save(); pintarModo(); return R(m ? `Listo, salí del modo ${m.nombre.replace(/^\S+\s/, "")}. Vuelvo a ser Jarvis normal.` : "Ya estoy en modo normal."); }
    if (it.mo === "crear") {
      D.modosPropios = D.modosPropios.filter((x) => L.norm(x.nombre) !== L.norm(it.nombre)).concat([{ nombre: it.nombre, instr: it.instr }]);
      aj().modoExperto = "propio:" + it.nombre; save(); pintarModo();
      return R(`✨ Creé el modo **${it.nombre}** y ya está activo. Después lo activas con «modo ${it.nombre.toLowerCase()}» y sales con «modo normal».`);
    }
    if (it.mo === "activar" || it.mo === "propio") {
      aj().modoExperto = it.mo === "activar" ? it.k : "propio:" + it.nombre; save(); pintarModo();
      const m = modoActual();
      const aviso = /abogado|contador/.test(it.k || "") ? " Es orientación general: para tu caso concreto, consulta un profesional." : /nutricionista|entrenador|psicologo/.test(it.k || "") ? " No reemplaza a un profesional de la salud." : "";
      return R(`${m.nombre}: **activado**. Desde ahora te respondo así hasta que digas «modo normal».${aviso}`);
    }
    const act = modoActual();
    return pick("🎓 **Modos:** " + Object.values(L.MODOS).map((x) => x[0]).join(" · ") + (D.modosPropios.length ? "\n**Tuyos:** " + D.modosPropios.map((x) => "✨ " + x.nombre).join(" · ") : "") + `\n\n${act ? "Activo: " + act.nombre + "." : "Ahora: Jarvis normal."} Di «modo abogado» o crea uno: «crea un modo llamado Vendedor que me ayude a escribir ofertas cortas».`,
      Object.entries(L.MODOS).slice(0, 6).map(([k, v]) => [v[0], () => modo({ mo: "activar", k })]).concat(act ? [["Modo normal", () => modo({ mo: "salir" })]] : []));
  }
  const pidieronRe = /^\s*(?:jarvis[,\s]+)?pidieron\s*:?\s+(.{3,})$/i;

  // ======================================================================== AJUSTES
  function seccion() {
    const box = $("#aj2"); if (!box || $("#aj-335")) return;
    const s = mk("div"); s.id = "aj-335";
    const chk = (cont, label, val, fn) => { const l = mk("label", "lbl check"), i = mk("input"); i.type = "checkbox"; i.checked = val; i.addEventListener("change", () => fn(i.checked)); l.append(i, document.createTextNode(" " + label)); cont.append(l); return i; };
    const btn = (cont, t, fn) => { const b = mk("button", "btn", t); b.type = "button"; b.addEventListener("click", fn); cont.append(b); return b; };
    s.append(mk("h3", "sub", "Tiempo de pantalla"));
    s.append(mk("p", "hint", "Pregunta «¿cuánto usé el celular hoy?» o pon límites: «avísame si paso más de una hora en TikTok». Necesita el permiso «Acceso al uso» (lo das tú en Ajustes de Android). Los datos no salen del celular."));
    const lu = mk("p", "hint"); const pintaL = () => { lu.textContent = (aj().limitesUso || []).length ? "Límites: " + aj().limitesUso.map((x) => `${x.nombre} ${L.hm(x.min)}`).join(" · ") : "Sin límites."; }; pintaL(); s.append(lu);
    const r1 = mk("div", "row wrap"); btn(r1, "Dar el permiso", () => { const U = plug("Uso"); if (U) U.abrirPermiso().catch(() => {}); else A.toast("Funciona en la app instalada."); }); btn(r1, "Quitar todos los límites", () => { aj().limitesUso = []; save(); pintaL(); const U = plug("Uso"); if (U) U.limites({ lista: [] }).catch(() => {}); }); s.append(r1);
    s.append(mk("h3", "sub", "Wifi para compartir"));
    s.append(mk("p", "hint", "Android no deja que las apps lean las claves guardadas: escríbela una vez y di «comparte el wifi» para mostrar un código QR que la visita escanea con la cámara. Se queda solo en este celular."));
    const wn = mk("input", "inp"); wn.placeholder = "Nombre de la red"; wn.value = (aj().wifiCasa || {}).red || "";
    const wc = mk("input", "inp"); wc.type = "password"; wc.placeholder = "Clave del wifi"; wc.value = (aj().wifiCasa || {}).clave || "";
    const gw = () => { if (wn.value.trim()) aj().wifiCasa = { red: wn.value.trim(), clave: wc.value }; else delete aj().wifiCasa; save(); };
    wn.addEventListener("change", gw); wc.addEventListener("change", gw); s.append(wn, wc);
    s.append(mk("h3", "sub", "Informe del mes, vehículo y repaso"));
    chk(s, "Avisarme el 1.º de cada mes con el informe de gastos", !!aj().informeMes, (v) => { aj().informeMes = v; save(); programarInforme(); });
    s.append(mk("p", "hint", "Di «informe del mes», «le cambié el aceite al carro a los 45.000 km», «dejé las llaves en el cajón» o «hazme tarjetas de repaso de biología». Las tarjetas vuelven con repetición espaciada y te aviso a las 7 p. m. cuando toca repasar."));
    s.append(mk("h3", "sub", "Modos expertos"));
    const ms = mk("select", "inp"); ms.append(new Option("Jarvis normal", "")); Object.entries(L.MODOS).forEach(([k, v]) => ms.append(new Option(v[0], k))); (D.modosPropios || []).forEach((p) => ms.append(new Option("✨ " + p.nombre, "propio:" + p.nombre)));
    ms.value = aj().modoExperto || ""; ms.addEventListener("change", () => { aj().modoExperto = ms.value; save(); pintarModo(); }); s.append(ms);
    s.append(mk("p", "hint", "Cambian cómo responde Jarvis hasta que digas «modo normal». Abogado, contador y los de salud dan orientación general: no reemplazan a un profesional."));
    box.append(s);
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings, promptExtra: X.promptExtra };
  X.intent = function (text) {
    if (String(text).length > 220 || /\n/.test(text)) return base.intent(text);
    if (D) {
      const tr = L.traducirIntent(text); if (tr) return { a335: "tr", it: tr };
      const cu = L.cuentaIntent(text); if (cu) return { a335: "cu", it: cu };
      if (cuenta && pidieronRe.test(text)) return { a335: "cu", it: { cu: "pidieron", dicho: text.match(pidieronRe)[1] } };
      const pa = L.pantallaIntent(text); if (pa) return { a335: "pa", it: pa };
      const gr = L.grupoIntent(text); if (gr) return { a335: "gr", it: gr };
      const wf = L.wifiIntent(text); if (wf) return { a335: "wf", it: wf };
      const inf = L.informeIntent(text); if (inf) return { a335: "inf", it: inf };
      const ve = L.vehiculoIntent(text); if (ve) return { a335: "ve", it: ve };
      const cs = L.cosasIntent(text);
      if (cs && (cs.cs !== "buscar" || L.buscarCosa(D.cosas || [], cs.cosa))) return { a335: "cs", it: cs };   // si no la tengo anotada, sigue la memoria de siempre
      const ta = L.tarjetasIntent(text); if (ta && !(ta.ta === "crear" && docente() && !/repas/i.test(text))) return { a335: "ta", it: ta };
      const mo = L.modoIntent(text);
      if (mo) {
        const propio = mo.mo === "propio" && (D.modosPropios || []).some((x) => L.norm(x.nombre) === L.norm(mo.nombre));
        const act = modoActual();
        if (mo.mo === "salir" && act && !/proyector|tutor|conduccion|cocina|enfoque|concentracion|viaje|ahorro|dictado|docente/.test(L.norm(text))) return { a335: "mo", it: mo };
        if (mo.mo === "activar" || mo.mo === "crear" || mo.mo === "ver") return { a335: "mo", it: mo };
        if (propio) return { a335: "mo", it: { mo: "propio", nombre: D.modosPropios.find((x) => L.norm(x.nombre) === L.norm(mo.nombre)).nombre } };
      }
    }
    return base.intent(text);
  };
  X.run = async function (it, text) {
    if (!it.a335) return base.run(it, text);
    switch (it.a335) {
      case "cu": return dividirCuenta(it.it);
      case "pa": return pantalla(it.it);
      case "gr": return grupo(it.it);
      case "tr": return traducir(it.it);
      case "wf": return wifi(it.it);
      case "inf": return informe(it.it);
      case "ve": return vehiculo(it.it);
      case "cs": return cosas(it.it);
      case "ta": return tarjetas(it.it);
      case "mo": return modo(it.it);
    }
  };
  X.promptExtra = function (q) {
    const b = base.promptExtra ? base.promptExtra(q) : "";
    const m = D && modoActual();
    return m ? b + ` MODO ACTIVO (${m.nombre.replace(/^\S+\s/, "")}): ${m.instr}` : b;
  };
  X.settings = function () {
    try { base.settings(); } catch (e) { console.error(e); }
    try { seccion(); if (X._mejoras && X._mejoras.ordenarAjustes) X._mejoras.ordenarAjustes(); } catch (e) { console.error(e); }
  };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    setTimeout(() => { pintarModo(); programarInforme().catch(() => {}); avisoRepaso().catch(() => {}); const U = plug("Uso"); if (U && (aj().limitesUso || []).length) U.limites({ lista: aj().limitesUso }).catch(() => {}); }, 4000);
    const LN = plug("LocalNotifications");
    if (LN) window.JON(LN, "localNotificationActionPerformed", (ev) => {
      const ex = (ev && ev.notification && ev.notification.extra) || {};
      if (!ex.j335) return;
      setTimeout(() => { if (A.tab) A.tab("hablar"); if (ex.j335 === "informe") informe({ inf: "pasado" }); else if (ex.j335 === "repaso") repasar(); else if (ex.j335 === "vehiculo") vehiculo({ ve: "ver" }); }, 600);
    });
    const C = window.JL11 && window.JL11.CATALOGO;
    if (C && !C.some((x) => /Cuentas, pantalla/.test(x[0]))) C.push(["🧾 Cuentas, pantalla y repaso", ["Divide 180 mil entre 4 con el 10 % de propina", "Divide esta cuenta", "¿Cuánto usé el celular hoy?", "Avísame si paso más de una hora en TikTok", "¿Qué dijeron en el grupo de la familia?", "Tradúceme el mensaje de John", "Comparte el wifi", "Informe del mes", "Le cambié el aceite al carro a los 45.000 km", "Dejé las llaves en el cajón de la cocina", "Hazme tarjetas de repaso de la Revolución Francesa", "Modo abogado"]]);
  };
  X._a335 = { dividirCuenta, pantalla, grupo, traducir, wifi, informe, vehiculo, cosas, tarjetas, repasar, modo, modoActual };
})();
