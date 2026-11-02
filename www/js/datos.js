/* Jarvis para Android · los datos viven en el celular (almacenamiento local de la app). Copia y restauración en un archivo JSON. */
(function () {
  "use strict";
  const KEY = "jarvis.android.v1";
  const DEF = () => ({
    ajustes: { proveedor: "gemini", claves: { gemini: "", openai: "", claude: "" }, modelo: "", modeloAuto: {}, velocidad: 1.0, tono: 1.0,
      voz: true, seguir: false, nombre: "", escala: { basico: 3.0, alto: 4.0, superior: 4.6 } },
    cursos: [], cursoActual: "", recordatorios: [], quices: [], fotos: [], chat: [], ultimoTiempo: 300,
  });
  let mem = null;
  function load() {
    if (mem) return mem;
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { raw = null; }
    mem = merge(DEF(), raw || {});
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
    const w = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { console.warn("No se pudo guardar", e); } };
    if (now) w(); else timer = setTimeout(w, 150);
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function backup() {
    const d = JSON.parse(JSON.stringify(load()));
    d.ajustes.claves = { gemini: "", openai: "", claude: "" };          // la copia nunca lleva las claves
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
  window.JD = { load, save, uid, backup, restore, KEY };
})();
