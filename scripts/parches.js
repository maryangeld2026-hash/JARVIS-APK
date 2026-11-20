/* Jarvis 3.28 · pequeños cambios a los plugins después de `npm install` (se aplican solos; si ya están, no hace nada).
   · text-to-speech: la voz de Jarvis sale como «asistente» (USAGE_ASSISTANT). En Android 17 tiene su propio volumen,
     aparte de la música; en Android anteriores suena igual que antes (por el volumen de la música). */
const fs = require("fs");
const path = require("path");
const f = path.join(__dirname, "..", "node_modules", "@capacitor-community", "text-to-speech", "android", "src", "main", "java", "com", "getcapacitor", "community", "tts", "TextToSpeech.java");
const MARCA = "/* jarvis: voz de asistente */";
try {
  let s = fs.readFileSync(f, "utf8");
  if (s.includes(MARCA)) { console.log("parches: la voz de asistente ya estaba"); process.exit(0); }
  const ancla = "tts.speak(text, queueStrategy, ttsParams, callbackId);";
  if (!s.includes(ancla)) { console.warn("parches: no encontré dónde poner la voz de asistente (¿cambió el plugin?)"); process.exit(0); }
  s = s.replace(ancla, `${MARCA} if (android.os.Build.VERSION.SDK_INT >= 26) { try { tts.setAudioAttributes(new android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ASSISTANT).setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH).build()); } catch (Exception ignored) { } }\n        ${ancla}`);
  fs.writeFileSync(f, s);
  console.log("parches: voz de Jarvis como asistente (volumen propio en Android 17)");
} catch (e) {
  console.warn("parches: " + e.message);
}
