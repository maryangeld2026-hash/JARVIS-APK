package co.jarvis.docente.supertonic;

import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;

import java.util.Collections;

/**
 * Jarvis 3.29 · la voz neural sin internet (Supertonic 3). Carga los 4 modelos ONNX y un estilo de voz, y convierte
 * texto en audio (44,1 kHz, float). No depende de Android: se prueba igual en el computador.
 */
public final class VozSupertonic implements AutoCloseable {
    /** Los archivos que hay que tener en la carpeta (los mismos de Hugging Face: onnx/… y voice_styles/…). */
    public static final String[] ARCHIVOS = {
        "onnx/duration_predictor.onnx", "onnx/text_encoder.onnx", "onnx/vector_estimator.onnx", "onnx/vocoder.onnx",
        "onnx/tts.json", "onnx/unicode_indexer.json",
    };
    public static final String[] VOCES = { "M1", "M2", "M3", "M4", "M5", "F1", "F2", "F3", "F4", "F5" };

    private final OrtEnvironment env;
    private final TextToSpeech tts;
    private Style estilo;
    private String voz;
    private final String dir;

    private VozSupertonic(String dir, OrtEnvironment env, TextToSpeech tts) { this.dir = dir; this.env = env; this.tts = tts; }

    /** dir: la carpeta con onnx/ y voice_styles/. voz: M1…M5, F1…F5. */
    public static VozSupertonic cargar(String dir, String voz) throws Exception {
        OrtEnvironment env = OrtEnvironment.getEnvironment();
        TextToSpeech t = Helper.loadTextToSpeech(dir + "/onnx", false, env);
        VozSupertonic v = new VozSupertonic(dir, env, t);
        v.usarVoz(voz);
        return v;
    }

    public synchronized void usarVoz(String voz) throws Exception {
        if (voz == null || voz.isEmpty()) voz = "M1";
        if (voz.equals(this.voz) && estilo != null) return;
        Style nuevo = Helper.loadVoiceStyle(Collections.singletonList(dir + "/voice_styles/" + voz + ".json"), false, env);
        if (estilo != null) try { estilo.close(); } catch (OrtException ignored) { }
        estilo = nuevo;
        this.voz = voz;
    }

    public String voz() { return voz; }
    public int frecuencia() { return tts.sampleRate; }

    /** texto → audio. idioma: "es", "en"… (o "na" si no se sabe). velocidad ~1,05. pasos: 4 rápido, 8 mejor calidad. */
    public synchronized float[] sintetizar(String texto, String idioma, float velocidad, int pasos) throws OrtException {
        String l = idioma == null || idioma.isEmpty() ? "es" : idioma;
        if (!Languages.isValid(l)) l = "na";
        TTSResult r = tts.call(texto, l, estilo, Math.max(2, Math.min(16, pasos)), velocidad <= 0 ? 1.05f : velocidad, 0.25f, env);
        return r.wav;
    }

    @Override
    public synchronized void close() {
        try { if (estilo != null) estilo.close(); } catch (OrtException ignored) { }
        try { tts.close(); } catch (OrtException ignored) { }
    }
}
