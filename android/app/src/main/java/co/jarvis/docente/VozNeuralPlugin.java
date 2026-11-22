package co.jarvis.docente;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import co.jarvis.docente.supertonic.VozSupertonic;

import java.io.File;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Jarvis 3.29 · voz neural sin internet (Supertonic 3, 31 idiomas con español), como PocketPal AI.
 *   estado() → {listo, voz, mb} · descargar() (evento «progreso») · borrar()
 *   preparar({texto, voz, velocidad, idioma, pasos}) → {id, ms}: convierte una frase en audio (mientras suena la anterior)
 *   reproducir({id}) → cuando termina de sonar · parar()
 * Suena como «asistente» (volumen propio en Android 17).
 */
@CapacitorPlugin(name = "VozNeural")
public class VozNeuralPlugin extends Plugin {
    static final String HF = "https://huggingface.co/supertone-oss-archive/supertonic-3/resolve/aafc6e32416a594460b32413efc49d7fe4ce6d46/";
    static final String HF2 = "https://huggingface.co/Supertone/supertonic-3/resolve/main/";

    private final ExecutorService sintesis = Executors.newSingleThreadExecutor();
    private final ExecutorService sonido = Executors.newSingleThreadExecutor();
    private final ExecutorService bajada = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<Integer, float[]> listos = new ConcurrentHashMap<>();
    private final AtomicInteger ids = new AtomicInteger(1);
    private volatile AudioTrack actual;
    private volatile int generacion = 0;
    private VozSupertonic voz;
    private final Runnable soltar = () -> sintesis.execute(() -> { if (voz != null) { voz.close(); voz = null; } });

    private File carpeta() { File d = new File(getContext().getFilesDir(), "supertonic"); d.mkdirs(); return d; }
    private boolean descargada() {
        for (String a : VozSupertonic.ARCHIVOS) if (!new File(carpeta(), a).exists()) return false;
        return new File(carpeta(), "voice_styles/M1.json").exists();
    }

    @PluginMethod
    public void estado(PluginCall call) {
        long mb = 0;
        for (String a : VozSupertonic.ARCHIVOS) mb += new File(carpeta(), a).length();
        JSObject r = new JSObject(); r.put("listo", descargada()); r.put("mb", mb / (1024 * 1024)); r.put("cargada", voz != null);
        com.getcapacitor.JSArray vs = new com.getcapacitor.JSArray(); for (String v : VozSupertonic.VOCES) vs.put(v); r.put("voces", vs);
        call.resolve(r);
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        Descargas.cancelar = false;
        bajada.execute(() -> {
            try {
                java.util.List<String> todos = new java.util.ArrayList<>(java.util.Arrays.asList(VozSupertonic.ARCHIVOS));
                for (String v : VozSupertonic.VOCES) todos.add("voice_styles/" + v + ".json");
                for (int i = 0; i < todos.size(); i++) {
                    String a = todos.get(i);
                    final int k = i;
                    final long[] base = { 0 };
                    File destino = new File(carpeta(), a);
                    try {
                        Descargas.bajar(HF + a, destino, (n, total) -> { JSObject e = new JSObject(); e.put("archivo", a); e.put("p", (int) ((k * 100L + (total > 0 ? n * 100 / total : 0)) / todos.size())); e.put("mb", n / (1024 * 1024)); notifyListeners("progreso", e); });
                    } catch (Exception e1) {
                        Descargas.bajar(HF2 + a, destino, null);                       // el nombre de antes del archivo
                    }
                }
                JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        });
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        sintesis.execute(() -> {
            if (voz != null) { voz.close(); voz = null; }
            borrarTodo(carpeta());
            call.resolve();
        });
    }
    private static void borrarTodo(File d) { File[] fs = d.listFiles(); if (fs != null) for (File f : fs) { if (f.isDirectory()) borrarTodo(f); f.delete(); } }

    @PluginMethod
    public void preparar(PluginCall call) {
        final String texto = call.getString("texto", "");
        final String nombreVoz = call.getString("voz", "M1");
        final float vel = (float) (double) call.getDouble("velocidad", 1.0);
        final String idioma = call.getString("idioma", "es");
        final int pasos = call.getInt("pasos", 6);
        if (texto == null || texto.trim().isEmpty()) { call.reject("sin texto"); return; }
        if (!descargada()) { call.reject("La voz neural no está descargada.", "sin_modelo"); return; }
        final int gen = generacion;
        main.removeCallbacks(soltar);
        sintesis.execute(() -> {
            try {
                if (gen != generacion) { call.reject("parado", "parado"); return; }
                long t0 = System.currentTimeMillis();
                if (voz == null) voz = VozSupertonic.cargar(carpeta().getAbsolutePath(), nombreVoz);
                voz.usarVoz(nombreVoz);
                float[] wav = voz.sintetizar(texto, idioma.length() >= 2 ? idioma.substring(0, 2) : "es", 1.05f * Math.max(0.6f, Math.min(1.6f, vel)), pasos);
                if (gen != generacion) { call.reject("parado", "parado"); return; }
                int id = ids.getAndIncrement();
                listos.put(id, wav);
                JSObject r = new JSObject(); r.put("id", id); r.put("ms", System.currentTimeMillis() - t0); r.put("seg", wav.length / (double) voz.frecuencia());
                call.resolve(r);
            } catch (Throwable e) {
                call.reject("La voz neural falló: " + e.getMessage());
            } finally {
                main.postDelayed(soltar, 3 * 60_000);                                   // 3 minutos sin hablar: se suelta la memoria
            }
        });
    }

    @PluginMethod
    public void reproducir(PluginCall call) {
        final int id = call.getInt("id", -1);
        final float[] wav = listos.remove(id);
        if (wav == null) { call.resolve(); return; }
        final int sr = voz != null ? voz.frecuencia() : 44100;
        final int gen = generacion;
        sonido.execute(() -> {
            AudioTrack t = null;
            try {
                if (gen != generacion) { call.resolve(); return; }
                short[] pcm = new short[wav.length];
                for (int i = 0; i < wav.length; i++) pcm[i] = (short) Math.max(-32768, Math.min(32767, wav[i] * 32767f));
                AudioAttributes aa = new AudioAttributes.Builder()
                    .setUsage(Build.VERSION.SDK_INT >= 26 ? AudioAttributes.USAGE_ASSISTANT : AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
                AudioFormat af = new AudioFormat.Builder().setSampleRate(sr).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build();
                t = new AudioTrack(aa, af, pcm.length * 2, AudioTrack.MODE_STATIC, android.media.AudioManager.AUDIO_SESSION_ID_GENERATE);
                t.write(pcm, 0, pcm.length);
                actual = t;
                t.play();
                long fin = System.currentTimeMillis() + (long) (pcm.length * 1000.0 / sr) + 300;
                while (System.currentTimeMillis() < fin && gen == generacion && t.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) {
                    if (t.getPlaybackHeadPosition() >= pcm.length) break;
                    Thread.sleep(30);
                }
            } catch (Throwable ignored) {
            } finally {
                if (t != null) { try { t.stop(); } catch (Throwable ignored) { } t.release(); }
                if (actual == t) actual = null;
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void parar(PluginCall call) {
        generacion++;
        listos.clear();
        AudioTrack t = actual;
        if (t != null) { try { t.pause(); t.flush(); } catch (Throwable ignored) { } }
        call.resolve();
    }

    @PluginMethod public void cancelarDescarga(PluginCall call) { Descargas.cancelar = true; call.resolve(); }

    @Override
    protected void handleOnDestroy() { generacion++; if (voz != null) voz.close(); }
}
