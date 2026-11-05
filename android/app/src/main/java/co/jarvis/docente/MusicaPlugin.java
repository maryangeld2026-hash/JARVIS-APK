package co.jarvis.docente;

import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.17: «¿qué canción es esta?». Graba unos segundos de la música (sin filtro de voz, para que suene como es),
 * y la reconoce con AudD (con o sin clave) o le pasa el audio a Gemini. El audio se borra al terminar.
 *   grabar({seg}) → {ruta, segundos, nivel} (eventos «nivel» {v} para la barrita)    parar()
 *   audd({ruta, token}) → {json}      base64({ruta}) → {data}      borrarAudio({ruta})
 *   apps() → {shazam, google}         abrir({app}) → abre Shazam o la búsqueda de canciones de Google
 */
@CapacitorPlugin(name = "Musica")
public class MusicaPlugin extends Plugin {
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private volatile boolean grabando = false;
    private static final int HZ = 16000;

    @PluginMethod
    public void grabar(PluginCall call) {
        if (getContext().checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) { call.reject("Falta el permiso del micrófono.", "permiso"); return; }
        final int seg = Math.max(4, Math.min(20, call.getInt("seg", 10)));
        hilo.execute(() -> {
            EscuchaService.soltarMicrofono(getContext(), 2500);
            AudioRecord rec = null;
            File wav = new File(getContext().getCacheDir(), "jarvis_cancion.wav");
            try {
                int min = AudioRecord.getMinBufferSize(HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
                int fuente = android.os.Build.VERSION.SDK_INT >= 24 ? MediaRecorder.AudioSource.UNPROCESSED : MediaRecorder.AudioSource.MIC;
                try { rec = new AudioRecord(fuente, HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192)); } catch (Exception e) { rec = null; }
                if (rec == null || rec.getState() != AudioRecord.STATE_INITIALIZED) {   // algunos celulares no tienen la fuente «sin procesar»
                    if (rec != null) rec.release();
                    rec = new AudioRecord(MediaRecorder.AudioSource.MIC, HZ, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192));
                }
                if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new Exception("El micrófono está ocupado.");
                ByteArrayOutputStream pcm = new ByteArrayOutputStream();
                byte[] buf = new byte[3200];
                rec.startRecording(); grabando = true;
                long t0 = System.currentTimeMillis(); double maxRms = 0;
                while (grabando && System.currentTimeMillis() - t0 < seg * 1000L) {
                    int n = rec.read(buf, 0, buf.length); if (n <= 0) continue;
                    pcm.write(buf, 0, n);
                    long s = 0; for (int i = 0; i + 1 < n; i += 2) { int v = (short) ((buf[i] & 0xff) | (buf[i + 1] << 8)); s += (long) v * v; }
                    double rms = Math.sqrt((double) s / Math.max(1, n / 2)); maxRms = Math.max(maxRms, rms);
                    JSObject ev = new JSObject(); ev.put("v", Math.min(1.0, rms / 3000.0)); ev.put("t", (System.currentTimeMillis() - t0) / 1000.0); notifyListeners("nivel", ev);
                }
                byte[] d = pcm.toByteArray();
                try (FileOutputStream out = new FileOutputStream(wav)) {
                    java.nio.ByteBuffer h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN);
                    h.put("RIFF".getBytes()).putInt(36 + d.length).put("WAVE".getBytes()).put("fmt ".getBytes()).putInt(16).putShort((short) 1).putShort((short) 1)
                        .putInt(HZ).putInt(HZ * 2).putShort((short) 2).putShort((short) 16).put("data".getBytes()).putInt(d.length);
                    out.write(h.array()); out.write(d);
                }
                JSObject r = new JSObject(); r.put("ruta", wav.getAbsolutePath()); r.put("segundos", d.length / (double) (HZ * 2)); r.put("nivel", Math.min(1.0, maxRms / 3000.0));
                call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage() != null ? e.getMessage() : "No pude grabar."); }
            finally { grabando = false; if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } rec.release(); } }
        });
    }

    @PluginMethod
    public void parar(PluginCall call) { grabando = false; call.resolve(); }

    private static byte[] leer(File f) throws Exception {
        try (InputStream in = new FileInputStream(f); ByteArrayOutputStream o = new ByteArrayOutputStream()) {
            byte[] b = new byte[16384]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); return o.toByteArray();
        }
    }

    private File archivo(PluginCall call) {
        String ruta = call.getString("ruta", "");
        File f = new File(ruta == null ? "" : ruta);
        // solo el audio que grabó este mismo plugin, dentro de la caché de Jarvis
        try { if (!f.getCanonicalPath().startsWith(getContext().getCacheDir().getCanonicalPath()) || !f.exists()) return null; } catch (Exception e) { return null; }
        return f;
    }

    @PluginMethod
    public void audd(PluginCall call) {
        File f = archivo(call);
        if (f == null) { call.reject("No encontré la grabación."); return; }
        final String token = call.getString("token", "");
        hilo.execute(() -> {
            HttpURLConnection c = null;
            try {
                byte[] audio = leer(f);
                String b = "----jarvis" + System.currentTimeMillis();
                c = (HttpURLConnection) new URL("https://api.audd.io/").openConnection();
                c.setConnectTimeout(10000); c.setReadTimeout(25000); c.setDoOutput(true); c.setRequestMethod("POST");
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + b);
                try (DataOutputStream o = new DataOutputStream(c.getOutputStream())) {
                    if (token != null && !token.isEmpty()) campo(o, b, "api_token", token);
                    campo(o, b, "return", "spotify,apple_music");
                    o.writeBytes("--" + b + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"cancion.wav\"\r\nContent-Type: audio/wav\r\n\r\n");
                    o.write(audio); o.writeBytes("\r\n--" + b + "--\r\n");
                }
                int code = c.getResponseCode();
                InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
                ByteArrayOutputStream res = new ByteArrayOutputStream();
                if (in != null) { byte[] x = new byte[8192]; int n; while ((n = in.read(x)) > 0) res.write(x, 0, n); in.close(); }
                JSObject r = new JSObject(); r.put("json", res.toString("UTF-8")); r.put("status", code);
                call.resolve(r);
            } catch (Exception e) { call.reject("No pude conectarme con el reconocedor de canciones.", "red"); }
            finally { if (c != null) c.disconnect(); }
        });
    }

    private static void campo(DataOutputStream o, String b, String k, String v) throws Exception {
        o.writeBytes("--" + b + "\r\nContent-Disposition: form-data; name=\"" + k + "\"\r\n\r\n");
        o.write(v.getBytes("UTF-8")); o.writeBytes("\r\n");
    }

    @PluginMethod
    public void base64(PluginCall call) {
        File f = archivo(call);
        if (f == null) { call.reject("No encontré la grabación."); return; }
        hilo.execute(() -> {
            try { JSObject r = new JSObject(); r.put("data", android.util.Base64.encodeToString(leer(f), android.util.Base64.NO_WRAP)); call.resolve(r); }
            catch (Exception e) { call.reject("No pude leer la grabación."); }
        });
    }

    @PluginMethod
    public void borrarAudio(PluginCall call) {
        File f = archivo(call);
        if (f != null) { try { f.delete(); } catch (Exception ignored) { } }
        call.resolve();
    }

    private boolean instalada(String p) {
        try { getContext().getPackageManager().getPackageInfo(p, 0); return true; } catch (Exception e) { return false; }
    }

    @PluginMethod
    public void apps(PluginCall call) {
        JSObject r = new JSObject(); r.put("shazam", instalada("com.shazam.android")); r.put("google", instalada("com.google.android.googlequicksearchbox"));
        call.resolve(r);
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        String app = call.getString("app", "google");
        try {
            Intent i;
            if ("shazam".equals(app)) {
                i = new Intent("com.shazam.android.intent.actions.START_TAGGING").setPackage("com.shazam.android");
                if (i.resolveActivity(getContext().getPackageManager()) == null) i = getContext().getPackageManager().getLaunchIntentForPackage("com.shazam.android");
            } else {
                i = new Intent("com.google.android.googlequicksearchbox.MUSIC_SEARCH");
                if (i.resolveActivity(getContext().getPackageManager()) == null) i = getContext().getPackageManager().getLaunchIntentForPackage("com.google.android.googlequicksearchbox");
            }
            if (i == null) { call.reject("No tienes esa app."); return; }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("No pude abrirla."); }
    }
}
