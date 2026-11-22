
window.__log = []; window.__cola = []; const lst = {}; const log = (x) => window.__log.push(x);
const on = (n, f) => { (lst[n] = lst[n] || []).push(f); return { remove() {} }; };
window.__emit = (n, d) => (lst[n] || []).forEach((f) => f(d));
const anyP = (o) => new Proxy(o, { get: (t, n) => (n in t ? t[n] : n === 'then' ? undefined : async () => ({})) });
const generic = { addListener: on, modelo: async () => ({}), estado: async () => ({}), checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => ({}), schedule: async () => {}, cancel: async () => {}, registerActionTypes: async () => {},
  keepAwake: async () => {}, allowSleep: async () => {}, config: async () => {}, bateriaEstado: async () => ({ nivel: 80 }), stop: async () => {}, speak: async (o) => { window.__said.push(o.text); }, getSupportedVoices: async () => ({ voices: [] }) };
const generic2 = anyP(generic); const P = {
  IALocal: anyP({ addListener: on, estado: async () => ({ listo: true, gemma: false, nombre: 'Qwen3.5-4B-Q4_K_M.gguf', mb: 2575, familia: 'gguf', ve: false, oye: false, libreMb: 9000 }),
    modelos: async () => ({ lista: [{ nombre: 'Qwen3.5-4B-Q4_K_M.gguf', mb: 2575, activo: true, familia: 'gguf' }] }),
    memoria: async () => ({ totalMb: 8000, discoMb: 20000 }), precargar: async () => ({ listo: true }),
    descargar: async (o) => { log('bajar ' + o.nombre + ' ' + o.url); return { ok: true }; },
    velocidad: async () => ({ leer: 95.5, escribir: 11.2, gb: 2.4 }),
    generar: async (o) => { window.__gen = o; log('generar'); return { texto: 'Respondo con el modelo GGUF, señor.', motor: 'Qwen3.5-4B · GGUF' }; } }),
  Dictado: anyP({ addListener: on, estado: async () => ({ listo: true, nombre: 'ggml-base-q8_0.bin', mb: 82, motor: true }),
    escuchar: async (o) => { log('dictado ' + o.idioma); return { texto: 'qué es la fotosíntesis', motor: 'whisper' }; }, detener: async () => {} }),
  VozNeural: anyP({ addListener: on, estado: async () => ({ listo: true, mb: 398, voces: ['M1', 'F1'] }),
    preparar: async (o) => { log('preparar ' + o.voz + ' ' + o.texto.slice(0, 20)); return { id: 7 }; }, reproducir: async (o) => { log('reproducir ' + o.id); }, parar: async () => {} }),
  Llavero: { obtener: async () => ({ llave: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=' }) },
  Telefono: anyP({ addListener: on, checkPermissions: async () => ({}), contactos: async () => { throw new Error('Sin permiso para ver tus contactos.'); },
    elegirContacto: async () => { log('elegir'); return { nombre: 'Ana Pérez', numero: '3001234567' }; },
    volumenJarvis: async (o) => { log('volj ' + o.accion); return { nivel: 9, max: 15, propio: true }; }, wa: async (o) => { log('wa ' + o.numero); return {}; }, llamar: async (o) => { log('llamar ' + o.numero); return {}; } }),
  Lugares: anyP({ aqui: async () => ({ lat: 4.65, lng: -74.05 }) }),
  Tareas: anyP({ vigilar: async (o) => log('vigilar ' + o.id), revisar: async () => {}, lista: async () => ({ lista: window.__tareas || [] }), avisos: async () => ({ permitidos: true, soporta: true }) }),
  Ventana: anyP({ addListener: on, pendientes: async () => ({ lista: window.__cola.splice(0) }), abrir: async (o) => log('url ' + o.url) }),
};
window.Capacitor = { isNativePlatform: () => true, Plugins: new Proxy({}, { get: (t, n) => P[n] || (n === 'SpeechRecognition' || n === 'Escaner' || n === 'Calendario' || n === 'Oido' || n === 'IALocal' ? undefined : generic2) }) };
