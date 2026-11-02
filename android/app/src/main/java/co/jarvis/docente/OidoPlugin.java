package co.jarvis.docente;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

/**
 * Jarvis 3.1: reconocimiento de voz propio, para que la conversación no se trabe.
 *   escuchar({idioma}) → siempre se cumple con {texto, error}: nunca se queda esperando para siempre.
 *   eventos «parcial» {texto} mientras hablas y «estado» {s: listo|habla|fin}.
 *   detener() → deja de oír y entrega lo que alcanzó a oír.   cancelar() → corta sin esperar.
 * Si el reconocedor de Android está ocupado (pasa justo después de hablar), lo reintenta solo.
 */
@CapacitorPlugin(name = "Oido", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microfono") })
public class OidoPlugin extends Plugin {
    private final Handler h = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr;
    private PluginCall actual;
    private String ultimo = "";
    private int turno = 0;

    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponible", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(r);
    }

    @PluginMethod
    public void permiso(PluginCall call) {
        if (getPermissionState("microfono") == PermissionState.GRANTED) { ok(call, true); return; }
        requestPermissionForAlias("microfono", call, "permisoListo");
    }

    @PermissionCallback
    private void permisoListo(PluginCall call) { ok(call, getPermissionState("microfono") == PermissionState.GRANTED); }

    private void ok(PluginCall call, boolean v) { JSObject r = new JSObject(); r.put("ok", v); call.resolve(r); }

    @PluginMethod
    public void escuchar(PluginCall call) {
        final String idioma = call.getString("idioma", "es-CO");
        final int silencio = call.getInt("silencio", 1100);
        final int maximo = call.getInt("maximo", 15000);
        h.post(() -> {
            if (actual != null) terminar("", "otra");
            actual = call;
            ultimo = "";
            final int mio = ++turno;
            iniciar(idioma, silencio, 0, mio);
            // red de seguridad: si Android no avisa nada, se corta igual
            h.postDelayed(() -> { if (mio == turno && actual != null && sr != null) { try { sr.stopListening(); } catch (Exception e) { } } }, maximo);
            h.postDelayed(() -> { if (mio == turno && actual != null) terminar(ultimo, ultimo.isEmpty() ? "sin_respuesta" : null); }, maximo + 2500);
        });
    }

    private void iniciar(String idioma, int silencio, int intento, int mio) {
        if (mio != turno || actual == null) return;
        destruir();
        try {
            sr = SpeechRecognizer.createSpeechRecognizer(getContext());
        } catch (Exception e) { terminar("", "sin_servicio"); return; }
        sr.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { estado("listo"); }
            @Override public void onBeginningOfSpeech() { estado("habla"); }
            @Override public void onRmsChanged(float v) { }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { estado("fin"); }
            @Override public void onEvent(int t, Bundle b) { }
            @Override public void onPartialResults(Bundle b) {
                if (mio != turno) return;
                String t = primero(b);
                if (t != null && !t.isEmpty()) {
                    ultimo = t;
                    JSObject r = new JSObject(); r.put("texto", t); notifyListeners("parcial", r);
                }
            }
            @Override public void onResults(Bundle b) {
                if (mio != turno) return;
                String t = primero(b);
                terminar(t != null && !t.isEmpty() ? t : ultimo, null);
            }
            @Override public void onError(int e) {
                if (mio != turno || actual == null) return;
                boolean ocupado = e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == SpeechRecognizer.ERROR_CLIENT
                        || e == SpeechRecognizer.ERROR_AUDIO || e == 11 /* ERROR_SERVER_DISCONNECTED */;
                if (ocupado && ultimo.isEmpty() && intento < 2) {
                    destruir();
                    h.postDelayed(() -> iniciar(idioma, silencio, intento + 1, mio), 450);
                    return;
                }
                if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { terminar(ultimo, null); return; }
                terminar(ultimo, nombre(e));
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, silencio);
        i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, silencio);
        try { sr.startListening(i); } catch (Exception e) { terminar("", "no_inicia"); }
    }

    @PluginMethod
    public void detener(PluginCall call) {
        h.post(() -> {
            if (sr != null && actual != null) {
                try { sr.stopListening(); } catch (Exception e) { }
                final int mio = turno;
                h.postDelayed(() -> { if (mio == turno && actual != null) terminar(ultimo, null); }, 1500);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void cancelar(PluginCall call) {
        h.post(() -> { if (actual != null) terminar(ultimo, "cancelado"); else destruir(); call.resolve(); });
    }

    private void terminar(String texto, String error) {
        PluginCall c = actual;
        actual = null;
        turno++;
        if (c != null) {
            JSObject r = new JSObject();
            r.put("texto", texto == null ? "" : texto.trim());
            if (error != null) r.put("error", error);
            c.resolve(r);
        }
        destruir();
    }

    /** Suelta el reconocedor actual. Se destruye en el siguiente ciclo: nunca dentro de su propio aviso. */
    private void destruir() {
        final SpeechRecognizer v = sr;
        sr = null;
        if (v != null) h.post(() -> { try { v.cancel(); } catch (Exception e) { } try { v.destroy(); } catch (Exception e) { } });
    }

    private void estado(String s) { JSObject r = new JSObject(); r.put("s", s); notifyListeners("estado", r); }

    private static String primero(Bundle b) {
        if (b == null) return null;
        ArrayList<String> m = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return m != null && !m.isEmpty() ? m.get(0) : null;
    }

    private static String nombre(int e) {
        switch (e) {
            case SpeechRecognizer.ERROR_NETWORK: case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: return "red";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "permiso";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: return "ocupado";
            case SpeechRecognizer.ERROR_AUDIO: return "audio";
            case 12: case 13: return "idioma";   // ERROR_LANGUAGE_NOT_SUPPORTED / UNAVAILABLE
            default: return "error_" + e;
        }
    }

    @Override
    protected void handleOnDestroy() { h.removeCallbacksAndMessages(null); if (sr != null) { try { sr.destroy(); } catch (Exception e) { } sr = null; } }
}
