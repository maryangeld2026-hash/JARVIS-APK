/* Jarvis para Android · los datos viven en el celular (almacenamiento local de la app). Copia y restauración en un archivo JSON. */
(function () {
  "use strict";
  const KEY = "jarvis.android.v1";
  const DEF = () => ({
    ajustes: { proveedor: "gemini", claves: { gemini: "", openai: "", claude: "", groq: "", openrouter: "", deepseek: "", mistral: "", propio: "" }, modelo: "", modeloAuto: {},
      respaldo: "", propioUrl: "", localModelo: "qwen05", velocidad: 1.0, tono: 1.0,
      voz: true, seguir: true, nombre: "", escala: { basico: 3.0, alto: 4.0, superior: 4.6 } },
    cursos: [], cursoActual: "", recordatorios: [], quices: [], fotos: [], chat: [], ultimoTiempo: 300,
  });
  let mem = null;
  // 3.7: en la app instalada, los datos se guardan cifrados (AES-GCM) con una llave que vive en el Keystore de Android
  const KEYC = KEY + ".c";
  let llave = null, cifrado = false;
  const b64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  async function cifrar(txt) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, llave, new TextEncoder().encode(txt)));
    return JSON.stringify({ v: 1, iv: b64(iv), ct: b64(ct) });
  }
  async function descifrar(json) {
    const o = JSON.parse(json);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(o.iv) }, llave, unb64(o.ct));
    return new TextDecoder().decode(pt);
  }
  /** Antes de arrancar la app: abre la llave y descifra los datos. En el navegador no hay llave y sigue como antes. */
  let readyP = null;
  function ready() {
    if (readyP) return readyP;
    readyP = (async () => {
      const cap = window.Capacitor, P = cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins && cap.Plugins.Llavero;
      if (!P || !window.crypto || !crypto.subtle) return;
      try {
        const r = await P.obtener();
        llave = await crypto.subtle.importKey("raw", unb64(r.llave), "AES-GCM", false, ["encrypt", "decrypt"]);
      } catch (e) { console.warn("Sin cifrado:", e); llave = null; return; }
      cifrado = true;
      const enc = localStorage.getItem(KEYC), plano = localStorage.getItem(KEY);
      if (enc && !plano) {
        try { mem = merge(DEF(), JSON.parse(await descifrar(enc))); }
        catch (e) {                                                    // nunca se pisa lo cifrado: se guarda aparte por si se puede recuperar
          console.error("No se pudieron descifrar los datos", e); window.__jarvisDescifrado = false;
          try { localStorage.setItem(KEYC + ".roto-" + Date.now(), enc); } catch (er) { /* sin espacio */ }
        }
      }
      if (!mem) { load(); }                                          // datos sin cifrar (de antes, o los más nuevos): se cargan y se cifran
      await escribir();
      try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
    })();
    return readyP;
  }
  async function escribir() {
    const txt = JSON.stringify(mem);
    if (llave) { try { localStorage.setItem(KEYC, await cifrar(txt)); return; } catch (e) { console.warn("No se pudo cifrar", e); } }
    try { localStorage.setItem(KEY, txt); } catch (e) { console.warn("No se pudo guardar", e); }
  }
  function load() {
    if (mem) return mem;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { raw = null; }
    mem = merge(DEF(), raw || {});
    if (!mem.v22) { mem.ajustes.seguir = true; mem.v22 = true; }          // 2.2: la conversación sigue sola (antes había que tocar «Seguir»)
    return mem;
  }
  function merge(base, over) {
    Object.keys(over || {}).forEach((k) => {
      const v = over[k];
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object" && !Array.isArray(base[k])) merge(base[k], v);
      else if (v !== undefined) base[k] = v;
    });
    return base;
  }
  let timer = null;
  function save(now) {
    clearTimeout(timer);
    const w = () => { if (llave) return escribir(); try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { console.warn("No se pudo guardar", e); } return Promise.resolve(); };
    if (now) return w();
    timer = setTimeout(w, 150);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function backup() {
    const d = JSON.parse(JSON.stringify(load()));
    Object.keys(d.ajustes.claves || {}).forEach((k) => { d.ajustes.claves[k] = ""; });   // la copia nunca lleva las claves
    return { app: "jarvis-android", version: 1, fecha: new Date().toISOString(), datos: d };
  }
  function restore(obj) {
    if (!obj || obj.app !== "jarvis-android" || !obj.datos) throw new Error("Ese archivo no es una copia de Jarvis.");
    const keys = load().ajustes.claves;
    mem = merge(DEF(), obj.datos);
    mem.ajustes.claves = keys;                                           // conserva las claves de este celular
    save(true);
    return mem;
  }
  // 3.2: al salir o minimizar se guarda de una vez (no se pierde lo último que cambiaste)
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => { if (document.hidden && mem) save(true); });
    window.addEventListener("pagehide", () => { if (mem) save(true); });
  }
  window.JD = { load, save, uid, backup, restore, KEY, ready, cifrado: () => cifrado };
})();
