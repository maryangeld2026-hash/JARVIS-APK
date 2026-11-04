/* Jarvis para Android 3.7 · conversación en tiempo real (Gemini Live).
   Hablas y Jarvis contesta hablando casi al instante, como en una llamada; lo interrumpes cuando quieras.
   Por la misma conversación puede hacer las órdenes de la app (temporizador, escoger estudiante, grupos, recordatorios…).
   Usa tu clave de Gemini. Se engancha a window.JX como los demás módulos. */
(function () {
  "use strict";
  const X = window.JX;
  if (!X) return;
  const L4 = window.JL4, V = window.JV;
  let A = null, D = null;
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /** El modelo «en vivo» de la cuenta (los que aceptan bidiGenerateContent). */
  async function liveModel(key) {
    if (D.ajustes.liveModelo) return D.ajustes.liveModelo;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
    if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? "La clave de Gemini no sirve. Revísala en Ajustes." : "No pude ver los modelos de tu cuenta.");
    const ms = ((await r.json()).models || []).filter((m) => (m.supportedGenerationMethods || []).includes("bidiGenerateContent")).map((m) => String(m.name).replace(/^models\//, ""));
    if (!ms.length) throw new Error("Tu cuenta de Gemini no tiene un modelo de voz en vivo disponible.");
    const rank = (x) => (/native-audio/.test(x) ? 0 : 1) + (/flash/.test(x) ? 0 : 2) + (/exp/.test(x) ? 1 : 0);
    return ms.sort((a, b) => rank(a) - rank(b) || b.localeCompare(a))[0];
  }
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const WORKLET = `class P extends AudioWorkletProcessor{constructor(){super();this.b=[];this.n=0;}process(i){const c=i[0]&&i[0][0];if(c){this.b.push(new Float32Array(c));this.n+=c.length;if(this.n>=2048){const o=new Float32Array(this.n);let k=0;for(const x of this.b){o.set(x,k);k+=x.length;}this.b=[];this.n=0;this.port.postMessage(o,[o.buffer]);}}return true;}}registerProcessor('jarvis-mic',P);`;

  let S = null;              // la sesión en vivo
  /** opts.sys: otra instrucción (3.9: el intérprete), opts.titulo para la pantalla. */
  async function start(opts) {
    if (S) return;
    opts = opts || {};
    const key = (D.ajustes.claves.gemini || "").trim();
    if (!key) return A.reply("La conversación en vivo usa Gemini: pon tu clave de Gemini en Ajustes.", "err");
    if (!navigator.onLine) return A.reply("La conversación en vivo necesita internet.", "err");
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.AudioWorkletNode) return A.reply("Este celular no permite la conversación en vivo (le falta audio en tiempo real en la app).", "err");
    V.hush(); (V.cancelListening || V.stopListening)();
    if (X.beforeListen) { try { await X.beforeListen(); } catch (e) { /* sigue */ } }
    S = { key, cola: 0, fuentes: [], entrada: "", salida: "", opts };
    ui();
    try {
      const model = await liveModel(key);
      S.model = model;
      S.ctxIn = new AudioContext();
      S.ctxOut = new AudioContext({ sampleRate: 24000 });
      S.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
      const url = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await S.ctxIn.audioWorklet.addModule(url); URL.revokeObjectURL(url);
      const src = S.ctxIn.createMediaStreamSource(S.stream), node = new AudioWorkletNode(S.ctxIn, "jarvis-mic");
      src.connect(node); S.node = node; S.src = src;
      const rateIn = S.ctxIn.sampleRate;
      node.port.onmessage = (ev) => {
        if (!S || !S.listo || S.mudo) return;
        const f = ev.data, ratio = rateIn / 16000, n = Math.floor(f.length / ratio), pcm = new Int16Array(n);
        for (let i = 0; i < n; i++) { const v = f[Math.floor(i * ratio)]; pcm[i] = Math.max(-1, Math.min(1, v)) * 0x7fff; }
        let e = 0; for (let i = 0; i < f.length; i += 16) e += f[i] * f[i];
        setLevel(Math.min(1, Math.sqrt(e / (f.length / 16)) * 6));
        send({ realtimeInput: { audio: { data: b64(new Uint8Array(pcm.buffer)), mimeType: "audio/pcm;rate=16000" } } });
      };
      const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(key)}`);
      S.ws = ws;
      ws.onopen = () => {
        const sys = S.opts.sys ? S.opts.sys : (A.systemPrompt ? A.systemPrompt(true) : "Eres Jarvis, un asistente personal en Colombia.") + " Estás en una conversación de voz en vivo: responde corto, natural y cálido, en español de Colombia. Si te piden algo que hace la app (temporizador, escoger un estudiante, grupos, recordatorios, pasar lista, abrir una app, llamar), usa la herramienta jarvis_orden con la orden en palabras.";
        send({ setup: { model: "models/" + model,
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: D.ajustes.vozIAnombre && !/^[a-z]/.test(D.ajustes.vozIAnombre) ? D.ajustes.vozIAnombre : "Kore" } } } },
          systemInstruction: { parts: [{ text: sys }] },
          inputAudioTranscription: {}, outputAudioTranscription: {},
          tools: [{ functionDeclarations: [{ name: "jarvis_orden", description: "Hace una orden de la app Jarvis del celular (recordatorios, alarmas, temporizador, clima, abrir una app, llamar o escribir a un contacto, linterna, volumen; y de clase: escoger estudiante, grupos, pasar lista, quiz…). Devuelve lo que respondió la app.",
            parameters: { type: "OBJECT", properties: { orden: { type: "STRING", description: "La orden en español, como la diría la persona. Ej.: «pon 5 minutos», «escoge un estudiante de 7A»." } }, required: ["orden"] } }] }] } });
      };
      ws.onmessage = async (ev) => { let j; try { j = JSON.parse(typeof ev.data === "string" ? ev.data : await ev.data.text()); } catch (e) { return; } onMsg(j); };
      ws.onerror = () => estado("Se perdió la conexión.");
      ws.onclose = (ev) => { if (S && S.ws === ws) { const motivo = ev.reason ? ` (${ev.reason.slice(0, 120)})` : ""; stop(ev.code === 1000 ? "" : "La conversación en vivo se cerró" + motivo + "."); } };
    } catch (e) { stop(e.name === "NotAllowedError" ? "Jarvis necesita el permiso del micrófono para la conversación en vivo." : (e.message || String(e))); }
  }
  function send(o) { if (S && S.ws && S.ws.readyState === 1) S.ws.send(JSON.stringify(o)); }
  async function onMsg(j) {
    if (!S) return;
    if (j.setupComplete) { S.listo = true; estado("🎙️ Te escucho. Habla cuando quieras."); return; }
    const sc = j.serverContent;
    if (sc) {
      if (sc.interrupted) { cortar(); estado("Te escucho…"); }
      if (sc.inputTranscription && sc.inputTranscription.text) { S.entrada += sc.inputTranscription.text; linea("tu", S.entrada); }
      if (sc.outputTranscription && sc.outputTranscription.text) { S.salida += sc.outputTranscription.text; linea("jarvis", S.salida); }
      ((sc.modelTurn && sc.modelTurn.parts) || []).forEach((p) => { const d = p.inlineData || p.inline_data; if (d && /audio/.test(d.mimeType || d.mime_type || "")) play(d.data); });
      if (sc.turnComplete) {
        if (S.entrada.trim()) A.add("user", "🎙️ " + S.entrada.trim());
        if (S.salida.trim()) A.add("assistant", S.salida.trim(), "");
        S.entrada = ""; S.salida = ""; S.lineaTu = S.lineaJ = null;
      }
    }
    if (j.toolCall && j.toolCall.functionCalls) {
      const out = [];
      for (const fc of j.toolCall.functionCalls) {
        let res = "";
        try {
          const orden = String((fc.args || {}).orden || "");
          const antes = (D.chat || []).length, voz = D.ajustes.voz;
          D.ajustes.voz = false;                          // la app no habla: habla la voz en vivo
          try { await A.handle(orden, false); } finally { D.ajustes.voz = voz; }
          const nuevos = (D.chat || []).slice(antes).filter((m) => m.role === "assistant").map((m) => m.content);
          res = nuevos.join("\n").slice(0, 1500) || "Hecho.";
        } catch (e) { res = "No se pudo: " + (e.message || e); }
        out.push({ id: fc.id, name: fc.name, response: { resultado: res } });
      }
      send({ toolResponse: { functionResponses: out } });
    }
  }
  function play(data) {
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)), pcm = new Int16Array(bin.buffer, 0, bin.length >> 1);
    const c = S.ctxOut, buf = c.createBuffer(1, pcm.length, 24000), ch = buf.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
    const s = c.createBufferSource(); s.buffer = buf; s.connect(c.destination);
    const at = Math.max(c.currentTime + 0.02, S.cola); s.start(at); S.cola = at + buf.duration;
    S.fuentes.push(s); s.onended = () => { S && (S.fuentes = S.fuentes.filter((x) => x !== s)); if (S && !S.fuentes.length) { document.body.dataset.state = "listening"; } };
    document.body.dataset.state = "speaking";
  }
  function cortar() { if (!S) return; S.fuentes.forEach((s) => { try { s.stop(); } catch (e) { /* ya paró */ } }); S.fuentes = []; S.cola = 0; }
  function stop(msg) {
    const s = S; S = null;
    if (!s) return;
    try { if (s.ws) s.ws.close(1000); } catch (e) { /* nada */ }
    try { s.stream && s.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* nada */ }
    try { s.node && s.node.disconnect(); s.ctxIn && s.ctxIn.close(); s.ctxOut && s.ctxOut.close(); } catch (e) { /* nada */ }
    const sh = $("#live-sh"); if (sh) sh.hidden = true;
    if (s.entrada && s.entrada.trim()) A.add("user", "🎙️ " + s.entrada.trim());
    if (s.salida && s.salida.trim()) A.add("assistant", s.salida.trim(), "");
    A.setState("idle");
    if (msg) A.reply(msg, "err");
  }

  // ======================================================================== PANTALLA
  function ui() {
    let sh = $("#live-sh"); if (!sh) { sh = mk("div", "sheet live-sh"); sh.id = "live-sh"; document.body.append(sh); }
    sh.hidden = false; sh.innerHTML = "";
    const inn = mk("div", "sheet-in full"), hd = mk("div", "sheet-h"); hd.append(mk("h2", "", "En vivo con Jarvis"));
    const sc = mk("div", "live-body");
    const orb = mk("div", "live-orb"); orb.id = "live-orb"; orb.append(mk("i"));
    const st = mk("p", "live-st", "Conectando…"); st.id = "live-st";
    const tr = mk("div", "live-tr"); tr.id = "live-tr";
    const row = mk("div", "row live-row");
    const mute = mk("button", "btn", "🔇 Silenciar mi micrófono"); mute.type = "button"; mute.addEventListener("click", () => { if (!S) return; S.mudo = !S.mudo; mute.textContent = S.mudo ? "🎙️ Activar mi micrófono" : "🔇 Silenciar mi micrófono"; estado(S.mudo ? "Micrófono en silencio." : "Te escucho."); });
    const end = mk("button", "btn danger big", "Colgar"); end.type = "button"; end.addEventListener("click", () => stop(""));
    row.append(mute, end); sc.append(orb, st, tr, row); inn.append(hd, sc); sh.append(inn);
    document.body.dataset.state = "listening";
  }
  function estado(t) { const e = $("#live-st"); if (e) e.textContent = t; }
  function setLevel(v) { const o = $("#live-orb"); if (o) o.style.setProperty("--lv", v.toFixed(2)); }
  function linea(quien, t) {
    const box = $("#live-tr"); if (!box || !S) return;
    const k = quien === "tu" ? "lineaTu" : "lineaJ";
    if (!S[k]) { S[k] = mk("p", "lt " + quien); box.append(S[k]); while (box.children.length > 8) box.firstChild.remove(); }
    S[k].textContent = (quien === "tu" ? "Tú: " : "Jarvis: ") + t;
    box.scrollTop = box.scrollHeight;
  }

  // ======================================================================== ENGANCHES
  const base = { init: X.init, intent: X.intent, run: X.run, settings: X.settings };
  X.intent = function (text) {
    const t = L4.norm(text).replace(/^jarvis\s+/, "");
    if (/^(?:conversacion|modo|habla(?:me)?|hablemos)\s+(?:en vivo|en tiempo real)$|^(?:en vivo|llamada con jarvis|hablemos)$/.test(t)) return { lv: true };
    return base.intent(text);
  };
  X.run = async function (it, text) { if (!it.lv) return base.run(it, text); return start(); };
  X.init = function (api) {
    A = api; D = api.D;
    try { base.init(api); } catch (e) { console.error("init", e); }
    // el botón «En vivo», junto al de enviar
    const f = $("#f-escribir"), send = f && f.querySelector(".send");
    if (send && !$("#btn-live")) {
      const b = mk("button", "icon-btn live-btn"); b.type = "button"; b.id = "btn-live"; b.title = "Conversación en vivo (como una llamada)"; b.setAttribute("aria-label", "Conversación en vivo");
      b.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></svg>';
      b.addEventListener("click", () => start());
      send.before(b);
    }
  };
  X._live = { start, stop, onMsg, liveModel };
})();
