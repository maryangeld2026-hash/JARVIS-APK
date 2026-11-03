package co.jarvis.docente;

import android.Manifest;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionService;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;

import java.util.ArrayList;
import java.util.List;

/**
 * Jarvis 3.3: el oído de la conversación, con tres caminos.
 *   1. «google»: el reconocimiento de voz de Android (el de siempre).
 *   2. «celular»: el reconocimiento dentro del celular (Android 12 o más nuevo), si el primero falla.
 *   3. «vosk»: el modelo de voz sin internet de «Jarvis en segundo plano», si los otros dos no sirven en este celular.
 * Antes de oír, espera a que «Jarvis en segundo plano» suelte el micrófono (si no, Android le da silencio al reconocedor).
 *   escuchar({idioma}) → siempre se cumple con {texto, motor, error}.  eventos «parcial» {texto} y «estado» {s, motor, error}.
 *   detener() → entrega lo que alcanzó a oír.  cancelar() → corta.  diagnostico() → qué tiene este celular.
 */
@CapacitorPlugin(name = "Oido", permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microfono") })
public class OidoPlugin extends Plugin {
    private static final String TAG = "JarvisOido";
    private final Handler h = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr;
    private PluginCall actual;
    private String ultimo = "", motor = "", idioma = "es-CO";
    private int turno = 0, silencio = 1100, espera = 9000;
    private long inicio = 0;                       // 3.5: cuándo empezó a esperar tu voz
    private boolean yoPause = false, oyoAlgo = false;
    private float nivel = -100f;                     // el volumen más alto que llegó del micrófono (dB del reconocedor)
    private static String preferido = "";          // el camino que funcionó la última vez
    private static String ultimoError = "";
    private static Model voskModelo;
    private volatile boolean voskCorre = false, voskParar = false;

    // ======================================================================== permisos y diagnóstico
    @PluginMethod
    public void disponible(PluginCall call) {
        JSObject r = new JSObject();
        r.put("disponible", SpeechRecognizer.isRecognitionAvailable(getContext()) || enCelularDisponible() || EscuchaPlugin.rutaModelo(getContext()) != null);
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
    public void diagnostico(PluginCall call) {
        JSObject r = new JSObject();
        r.put("permiso", getPermissionState("microfono") == PermissionState.GRANTED);
        r.put("google", hayGoogle());
        r.put("celular", enCelularDisponible());
        r.put("vosk", EscuchaPlugin.rutaModelo(getContext()) != null);
        r.put("fondoActivo", EscuchaService.activo);
        r.put("fondoGrabando", EscuchaService.grabando);
        r.put("preferido", preferido);
        r.put("ultimoError", ultimoError);
        r.put("android", Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
        r.put("equipo", Build.MANUFACTURER + " " + Build.MODEL);
        String srv = "";
        try { srv = Settings.Secure.getString(getContext().getContentResolver(), "voice_recognition_service"); } catch (Exception ignored) { }
        r.put("servicio", srv == null ? "" : srv);
        JSArray lista = new JSArray();
        try {
            List<ResolveInfo> l = getContext().getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
            for (ResolveInfo ri : l) lista.put(ri.serviceInfo.packageName);
        } catch (Exception ignored) { }
        r.put("servicios", lista);
        call.resolve(r);
    }

    private boolean enCelularDisponible() {
        if (Build.VERSION.SDK_INT < 31) return false;
        try { return SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()); } catch (Throwable e) { return false; }
    }

    // ======================================================================== escuchar
    @PluginMethod
    public void escuchar(PluginCall call) {
        final String lang = call.getString("idioma", "es-CO");
        final int sil = call.getInt("silencio", 1100);
        final int esp = Math.max(3000, Math.min(30000, call.getInt("espera", 9000)));
        final int maximo = Math.max(call.getInt("maximo", 15000), esp + 15000);
        final String forzar = call.getString("motor", "");
        h.post(() -> {
            if (actual != null) terminar("", "otra");
            actual = call;
            ultimo = ""; oyoAlgo = false; nivel = -100f; idioma = lang; silencio = sil; espera = esp; inicio = System.currentTimeMillis();
            final int mio = ++turno;
            // primero: que «Jarvis en segundo plano» suelte el micrófono (en otro hilo, para no trabar la pantalla)
            new Thread(() -> {
                if (EscuchaService.grabando) { yoPause = EscuchaService.soltarMicrofono(getContext(), 2500) || yoPause; }
                h.post(() -> {
                    if (mio != turno || actual == null) return;
                    String m = !forzar.isEmpty() ? forzar : primerMotor();
                    if (m.isEmpty()) { terminar("", "sin_servicio"); return; }
                    iniciar(m, 0, mio);
                });
            }, "jarvis-oido").start();
            // red de seguridad: si Android no avisa nada, se corta igual
            h.postDelayed(() -> { if (mio == turno && actual != null) { if (sr != null) { try { sr.stopListening(); } catch (Exception e) { } } voskParar = true; } }, maximo);
            h.postDelayed(() -> { if (mio == turno && actual != null) terminar(ultimo, ultimo.isEmpty() ? "sin_respuesta" : null); }, maximo + 2500);
        });
    }

    /** 3.4: el servicio de reconocimiento a usar, por su nombre: el del sistema si no es Jarvis; si no, el de Google. */
    private android.content.ComponentName servicioGoogle() {
        String pk = getContext().getPackageName();
        try {
            String srv = Settings.Secure.getString(getContext().getContentResolver(), "voice_recognition_service");
            if (srv != null && !srv.isEmpty() && !srv.startsWith(pk + "/")) return null;            // el del sistema sirve tal cual
        } catch (Exception ignored) { }
        android.content.ComponentName mejor = null;
        try {
            List<ResolveInfo> l = getContext().getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0);
            for (ResolveInfo ri : l) {
                String p = ri.serviceInfo.packageName;
                if (p.equals(pk)) continue;
                android.content.ComponentName c = new android.content.ComponentName(p, ri.serviceInfo.name);
                if (p.equals("com.google.android.tts") || p.equals("com.google.android.googlequicksearchbox")) return c;
                if (mejor == null) mejor = c;
            }
        } catch (Exception ignored) { }
        return mejor;
    }

    private String primerMotor() {
        boolean g = hayGoogle(), c = enCelularDisponible(), v = EscuchaPlugin.rutaModelo(getContext()) != null;
        if (preferido.equals("celular") && c) return "celular";
        if (preferido.equals("vosk") && v) return "vosk";
        if (g) return "google";
        if (c) return "celular";
        if (v) return "vosk";
        return "";
    }

    private boolean hayGoogle() {
        try {
            String pk = getContext().getPackageName();
            for (ResolveInfo ri : getContext().getPackageManager().queryIntentServices(new Intent(RecognitionService.SERVICE_INTERFACE), 0))
                if (!ri.serviceInfo.packageName.equals(pk)) return true;
        } catch (Exception ignored) { }
        return false;
    }

    private String siguiente(String m) {
        if (m.equals("google") && enCelularDisponible()) return "celular";
        if ((m.equals("google") || m.equals("celular")) && EscuchaPlugin.rutaModelo(getContext()) != null) return "vosk";
        if (m.equals("vosk") && hayGoogle()) return "google";
        return "";
    }

    private void iniciar(String m, int intento, int mio) {
        if (mio != turno || actual == null) return;
        destruir();
        motor = m;
        if (m.equals("vosk")) { vosk(mio); return; }
        try {
            android.content.ComponentName cn = m.equals("google") ? servicioGoogle() : null;
            sr = m.equals("celular") && Build.VERSION.SDK_INT >= 31
                ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext())
                : cn != null ? SpeechRecognizer.createSpeechRecognizer(getContext(), cn) : SpeechRecognizer.createSpeechRecognizer(getContext());
        } catch (Throwable e) { fallo(m, "sin_servicio", mio); return; }
        sr.setRecognitionListener(new RecognitionListener() {
            @Override public void onReadyForSpeech(Bundle b) { if (mio == turno) estado("listo", null); }
            @Override public void onBeginningOfSpeech() { if (mio == turno) { oyoAlgo = true; estado("habla", null); } }
            @Override public void onRmsChanged(float v) { if (v > nivel) nivel = v; }
            @Override public void onBufferReceived(byte[] b) { }
            @Override public void onEndOfSpeech() { if (mio == turno) estado("fin", null); }
            @Override public void onEvent(int t, Bundle b) { }
            @Override public void onPartialResults(Bundle b) {
                if (mio != turno) return;
                String t = primero(b);
                if (t != null && !t.isEmpty()) { ultimo = t; JSObject r = new JSObject(); r.put("texto", t); notifyListeners("parcial", r); }
            }
            @Override public void onResults(Bundle b) {
                if (mio != turno) return;
                String t = primero(b);
                String fin = t != null && !t.isEmpty() ? t : ultimo;
                if (!fin.isEmpty()) preferido = motor.equals("google") ? "" : motor;
                terminar(fin, null);
            }
            @Override public void onError(int e) {
                if (mio != turno || actual == null) return;
                Log.w(TAG, motor + " error " + e);
                ultimoError = motor + ":" + nombre(e);
                if (!ultimo.isEmpty()) { terminar(ultimo, null); return; }
                if (e == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { terminar("", "permiso"); return; }
                // no dijiste nada: no es una falla del micrófono
                if ((e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && oyoAlgo) {
                    // oyó ruido pero no palabras: si queda tiempo, sigue escuchando
                    if (System.currentTimeMillis() - inicio < espera - 1200) { oyoAlgo = false; destruir(); h.postDelayed(() -> iniciar(motor, 0, mio), 120); return; }
                    terminar("", null); return;
                }
                if (e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT && intento > 0 && System.currentTimeMillis() - inicio >= espera - 1200) { terminar("", null); return; }
                boolean ocupado = e == SpeechRecognizer.ERROR_RECOGNIZER_BUSY || e == SpeechRecognizer.ERROR_CLIENT || e == 11;
                if (ocupado && intento < 2) { destruir(); h.postDelayed(() -> iniciar(motor, intento + 1, mio), 500); return; }
                // 3.5: todavía no has dicho nada y no ha pasado el tiempo de espera: sigue escuchando (Android se rinde a los ~5 s)
                if ((e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) && !oyoAlgo && ultimo.isEmpty()
                        && System.currentTimeMillis() - inicio < espera - 1200) {
                    destruir(); h.postDelayed(() -> iniciar(motor, 0, mio), 120); return;
                }
                if (e == SpeechRecognizer.ERROR_NO_MATCH || e == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) { terminar("", null); return; }
                fallo(motor, nombre(e), mio);
            }
        });
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, idioma);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        i.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        if (intento == 0) {   // algunos reconocedores fallan con estos ajustes: el reintento va sin ellos
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, silencio);
            i.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, silencio);
        }
        try { sr.startListening(i); } catch (Throwable e) { fallo(m, "no_inicia", mio); }
    }

    /** Este camino no sirvió: se prueba el siguiente (y se avisa a la app para que lo muestre). */
    private void fallo(String m, String error, int mio) {
        ultimoError = m + ":" + error;
        String sig = siguiente(m);
        if (sig.isEmpty() || mio != turno) { terminar(ultimo, error); return; }
        estado("cambio", m + ":" + error);
        destruir();
        h.postDelayed(() -> iniciar(sig, 0, mio), 300);
    }

    // ======================================================================== Vosk (sin internet)
    private void vosk(int mio) {
        voskParar = false;
        new Thread(() -> {
            AudioRecord rec = null; Recognizer r = null;
            String fin = "", error = null;
            try {
                if (voskModelo == null) {
                    String ruta = EscuchaPlugin.rutaModelo(getContext());
                    if (ruta == null) throw new IllegalStateException("sin_modelo");
                    voskModelo = new Model(ruta);
                }
                r = new Recognizer(voskModelo, 16000.0f);
                int min = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
                rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192));
                if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("audio");
                rec.startRecording();
                voskCorre = true;
                h.post(() -> { if (mio == turno) estado("listo", null); });
                byte[] buf = new byte[4096];
                long t0 = System.currentTimeMillis(), ultimaVoz = 0;
                String parcial = "";
                while (!voskParar && mio == turno) {
                    int n = rec.read(buf, 0, buf.length);
                    if (n <= 0) continue;
                    if (r.acceptWaveForm(buf, n)) {
                        String t = new JSONObject(r.getResult()).optString("text", "").trim();
                        if (!t.isEmpty()) { fin = t; break; }
                    } else {
                        String p = new JSONObject(r.getPartialResult()).optString("partial", "").trim();
                        if (!p.isEmpty() && !p.equals(parcial)) {
                            parcial = p; ultimaVoz = System.currentTimeMillis();
                            final String pp = p;
                            h.post(() -> { if (mio == turno) { ultimo = pp; oyoAlgo = true; JSObject ev = new JSObject(); ev.put("texto", pp); notifyListeners("parcial", ev); } });
                        }
                    }
                    long ahora = System.currentTimeMillis();
                    if (parcial.isEmpty() && ahora - t0 > espera) break;               // no dijiste nada
                    if (!parcial.isEmpty() && ahora - ultimaVoz > 1800) break;         // terminaste de hablar
                }
                if (fin.isEmpty()) fin = new JSONObject(r.getFinalResult()).optString("text", parcial).trim();
            } catch (Throwable e) {
                Log.e(TAG, "vosk", e);
                error = e.getMessage() != null && e.getMessage().equals("audio") ? "audio" : "vosk";
            } finally {
                if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } rec.release(); }
                if (r != null) r.close();
                voskCorre = false;
            }
            final String f = fin, er = error;
            h.post(() -> {
                if (mio != turno || actual == null) return;
                if (er != null && f.isEmpty()) { fallo("vosk", er, mio); return; }
                if (!f.isEmpty()) preferido = "vosk".equals(preferido) || !SpeechRecognizer.isRecognitionAvailable(getContext()) ? "vosk" : preferido;
                terminar(f, null);
            });
        }, "jarvis-vosk").start();
    }

    // ======================================================================== parar
    @PluginMethod
    public void detener(PluginCall call) {
        h.post(() -> {
            if (actual != null) {
                voskParar = true;
                if (sr != null) { try { sr.stopListening(); } catch (Exception e) { } }
                final int mio = turno;
                h.postDelayed(() -> { if (mio == turno && actual != null) terminar(ultimo, null); }, 1500);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void cancelar(PluginCall call) {
        h.post(() -> { voskParar = true; if (actual != null) terminar(ultimo, "cancelado"); else destruir(); call.resolve(); });
    }

    private void terminar(String texto, String error) {
        PluginCall c = actual;
        actual = null;
        turno++;
        voskParar = true;
        if (c != null) {
            JSObject r = new JSObject();
            r.put("texto", texto == null ? "" : texto.trim());
            r.put("motor", motor);
            r.put("nivel", Math.round(nivel));
            if (error != null) r.put("error", error);
            c.resolve(r);
        }
        destruir();
        // si fui yo quien pausó «Jarvis en segundo plano», lo reanudo cuando la conversación termina
        if (yoPause) {
            final int mio = turno;
            h.postDelayed(() -> {
                if (mio != turno || actual != null || !yoPause || !EscuchaService.activo) return;
                yoPause = false;
                Intent i = new Intent(getContext(), EscuchaService.class).setAction(EscuchaService.ACCION_REANUDAR);
                try { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(i); else getContext().startService(i); } catch (Exception ignored) { }
            }, 6000);
        }
    }

    /** Suelta el reconocedor actual. Se destruye en el siguiente ciclo: nunca dentro de su propio aviso. */
    private void destruir() {
        final SpeechRecognizer v = sr;
        sr = null;
        if (v != null) h.post(() -> { try { v.cancel(); } catch (Exception e) { } try { v.destroy(); } catch (Exception e) { } });
    }

    private void estado(String s, String error) {
        JSObject r = new JSObject(); r.put("s", s); r.put("motor", motor);
        if (error != null) r.put("error", error);
        notifyListeners("estado", r);
    }

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
            case SpeechRecognizer.ERROR_CLIENT: return "cliente";
            case SpeechRecognizer.ERROR_SERVER: return "servidor";
            case SpeechRecognizer.ERROR_NO_MATCH: return "sin_coincidencia";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT: return "silencio";
            case 12: case 13: return "idioma";   // ERROR_LANGUAGE_NOT_SUPPORTED / UNAVAILABLE
            default: return "error_" + e;
        }
    }

    @Override
    protected void handleOnDestroy() { h.removeCallbacksAndMessages(null); voskParar = true; if (sr != null) { try { sr.destroy(); } catch (Exception e) { } sr = null; } }
}
