package co.jarvis.docente;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Handler;
import android.os.Looper;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.29 · dictado sin internet con Whisper (whisper.cpp), como PocketPal AI.
 *   estado() → {listo, nombre, mb} · descargar({tamano: base|small}) (evento «progreso») · borrar()
 *   escuchar({idioma, espera, silencio, maximo, pista}) → {texto, ms, nivel} (eventos «estado»: listo, habla, pensando)
 *   detener() (termina y transcribe lo que oyó) · cancelar()
 * Graba a 16 kHz y detecta solo cuándo empiezas y terminas de hablar (por el volumen).
 */
@CapacitorPlugin(name = "Dictado")
public class DictadoPlugin extends Plugin {
    static final String BASE = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/";
    static final String[][] MODELOS = { { "base", "ggml-base-q8_0.bin" }, { "small", "ggml-small-q8_0.bin" } };

    private final ExecutorService hilo = Executors.newSingleThreadExecutor();
    private final ExecutorService bajada = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile boolean terminar = false, cancelado = false, grabando = false;
    private String cargado = "";
    private final Runnable soltar = () -> hilo.execute(() -> { if (!grabando) { try { co.jarvis.motores.Whisper.liberar(); } catch (Throwable ignored) { } cargado = ""; } });

    private File carpeta() { File d = new File(getContext().getFilesDir(), "whisper"); d.mkdirs(); return d; }
    private File modelo() {
        String pref = getContext().getSharedPreferences("jarvis_dictado", 0).getString("modelo", "");
        File[] fs = carpeta().listFiles();
        if (fs == null) return null;
        File mejor = null;
        for (File f : fs) {
            if (!f.getName().endsWith(".bin") || f.length() < 10L * 1024 * 1024) continue;
            if (f.getName().equals(pref)) return f;
            if (mejor == null || f.length() > mejor.length()) mejor = f;
        }
        return mejor;
    }

    @PluginMethod
    public void estado(PluginCall call) {
        File f = modelo();
        JSObject r = new JSObject();
        r.put("listo", f != null); r.put("nombre", f != null ? f.getName() : ""); r.put("mb", f != null ? f.length() / (1024 * 1024) : 0);
        r.put("motor", co.jarvis.motores.Whisper.iniciar());
        call.resolve(r);
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        String t = call.getString("tamano", "base");
        String archivo = "small".equals(t) ? MODELOS[1][1] : MODELOS[0][1];
        Descargas.cancelar = false;
        bajada.execute(() -> {
            try {
                File f = Descargas.bajar(BASE + archivo, new File(carpeta(), archivo), (n, total) -> {
                    JSObject e = new JSObject(); e.put("p", total > 0 ? (int) (n * 100 / total) : -1); e.put("mb", n / (1024 * 1024)); notifyListeners("progreso", e);
                });
                getContext().getSharedPreferences("jarvis_dictado", 0).edit().putString("modelo", f.getName()).apply();
                JSObject r = new JSObject(); r.put("ok", true); r.put("mb", f.length() / (1024 * 1024)); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        });
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        hilo.execute(() -> {
            try { co.jarvis.motores.Whisper.liberar(); } catch (Throwable ignored) { }
            cargado = "";
            File[] fs = carpeta().listFiles(); if (fs != null) for (File f : fs) f.delete();
            call.resolve();
        });
    }

    @PluginMethod public void detener(PluginCall call) { terminar = true; call.resolve(); }
    @PluginMethod public void cancelar(PluginCall call) { cancelado = true; terminar = true; Descargas.cancelar = true; call.resolve(); }

    private void estadoEv(String s) { JSObject e = new JSObject(); e.put("s", s); notifyListeners("estado", e); }

    @PluginMethod
    public void escuchar(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { call.reject("permiso", "permiso"); return; }
        File f = modelo();
        if (f == null) { call.reject("El dictado sin internet no está descargado.", "sin_modelo"); return; }
        if (!co.jarvis.motores.Whisper.iniciar()) { call.reject("Este celular no puede usar el dictado sin internet (" + co.jarvis.motores.Whisper.falla() + ")."); return; }
        final String idioma = call.getString("idioma", "es-CO");
        final int espera = call.getInt("espera", 9000), silencio = call.getInt("silencio", 1200), maximo = call.getInt("maximo", 15000);
        final String pista = call.getString("pista", "Jarvis");
        terminar = false; cancelado = false;
        main.removeCallbacks(soltar);
        hilo.execute(() -> {
            long t0 = System.currentTimeMillis();
            try {
                if (!cargado.equals(f.getAbsolutePath())) {
                    if (co.jarvis.motores.Whisper.cargar(f.getAbsolutePath()) != 0) { call.reject("No pude abrir el modelo de dictado."); return; }
                    cargado = f.getAbsolutePath();
                }
                float[] maxDb = { -120 };
                float[] pcm = grabar(espera, silencio, maximo, maxDb);
                if (cancelado || pcm == null || pcm.length < 16000 / 3) {
                    JSObject r = new JSObject(); r.put("texto", ""); r.put("nivel", Math.round(maxDb[0])); r.put("motor", "whisper"); call.resolve(r); return;
                }
                estadoEv("pensando");
                String lang = idioma.length() >= 2 ? idioma.substring(0, 2).toLowerCase() : "es";
                String t = co.jarvis.motores.Whisper.transcribir(pcm, lang, 0, pista);
                t = t.replaceAll("\\[[^\\]]*\\]|\\([^)]*(?:música|music|aplausos|risas)[^)]*\\)", "").trim();   // [Música], (aplausos)…
                JSObject r = new JSObject(); r.put("texto", t); r.put("ms", System.currentTimeMillis() - t0); r.put("nivel", Math.round(maxDb[0])); r.put("motor", "whisper");
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("El dictado sin internet falló: " + e.getMessage());
            } finally {
                main.postDelayed(soltar, 5 * 60_000);                                   // el modelo se suelta tras 5 minutos sin usarlo
            }
        });
    }

    /** Graba hasta que dejas de hablar. → audio 16 kHz en [-1, 1], o null si no hablaste. */
    private float[] grabar(int espera, int silencio, int maximo, float[] maxDb) {
        final int SR = 16000;
        int min = AudioRecord.getMinBufferSize(SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        AudioRecord rec = null;
        try {
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SR, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, SR));
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) return null;
            rec.startRecording();
            grabando = true;
            estadoEv("listo");
            short[] buf = new short[480];                                               // 30 ms
            float[] todo = new float[SR * (maximo / 1000 + 2)];
            int n = 0, calma = 0;
            float piso = -60f;
            boolean habla = false;
            long ini = System.currentTimeMillis(), ultimaVoz = 0;
            while (!terminar) {
                int r = rec.read(buf, 0, buf.length);
                if (r <= 0) continue;
                double s = 0;
                for (int i = 0; i < r; i++) { float v = buf[i] / 32768f; s += v * v; if (n < todo.length) todo[n++] = v; }
                float db = (float) (10 * Math.log10(s / r + 1e-12));
                if (db > maxDb[0]) maxDb[0] = db;
                long ahora = System.currentTimeMillis();
                if (!habla && ahora - ini < 300) { piso = calma++ == 0 ? db : piso * 0.8f + db * 0.2f; continue; }   // el ruido de fondo
                boolean voz = db > Math.max(piso + 10f, -48f);
                if (voz) {
                    ultimaVoz = ahora;
                    if (!habla) { habla = true; estadoEv("habla"); }
                } else if (!habla) piso = piso * 0.95f + db * 0.05f;
                if (!habla && ahora - ini > espera) break;                              // no empezó a hablar
                if (habla && ahora - ultimaVoz > silencio) break;                       // terminó la frase
                if (ahora - ini > maximo || n >= todo.length) break;
            }
            if (!habla && !terminar) return null;
            float[] out = new float[n];
            System.arraycopy(todo, 0, out, 0, n);
            return out;
        } catch (Throwable e) {
            return null;
        } finally {
            grabando = false;
            if (rec != null) { try { rec.stop(); } catch (Throwable ignored) { } rec.release(); }
        }
    }

    @Override
    protected void handleOnDestroy() { terminar = true; try { co.jarvis.motores.Whisper.liberar(); } catch (Throwable ignored) { } }
}
