package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import java.util.ArrayList;

/**
 * Jarvis 3.18: subtítulos en vivo, encima de cualquier app (un video, una clase, alguien que te habla en otro idioma).
 * Oye por el micrófono (lo que suena por el parlante o la persona que habla), lo pasa a texto y lo traduce dentro del
 * celular (ML Kit). No guarda nada: el texto solo se ve en la franja de abajo. Se cierra con ✕ o desde el aviso.
 * Con audífonos puestos no oye el video (el sonido no sale por el parlante).
 */
public class SubtitulosService extends Service {
    static final String CANAL = "jarvis_subtitulos", PARAR = "parar";
    static volatile boolean activo = false;
    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer sr;
    private Translator tr;
    private boolean traducir = true, vivo = false;
    private String de = "en-US", deMl = "en", aMl = "es";
    private WindowManager wm;
    private LinearLayout caja;
    private TextView tOrig, tTrad;
    private long ultParcial = 0;
    private String ultimoFinal = "";

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        aviso();
        if (intent == null || PARAR.equals(intent.getAction())) { terminar(); return START_NOT_STICKY; }
        de = intent.getStringExtra("de"); if (de == null || de.isEmpty()) de = "en-US";
        String a = intent.getStringExtra("a"); if (a == null || a.isEmpty()) a = "es";
        deMl = TranslateLanguage.fromLanguageTag(de.split("-")[0]); aMl = TranslateLanguage.fromLanguageTag(a.split("-")[0]);
        traducir = deMl != null && aMl != null && !deMl.equals(aMl);
        float tam = intent.getFloatExtra("tam", 22f);
        if (tr != null) { try { tr.close(); } catch (Exception ignored) { } tr = null; }
        if (traducir) {
            tr = Translation.getClient(new TranslatorOptions.Builder().setSourceLanguage(deMl).setTargetLanguage(aMl).build());
            tr.downloadModelIfNeeded(new DownloadConditions.Builder().build()).addOnFailureListener(e -> mostrar("", "No pude bajar el paquete del idioma (necesito internet una vez)."));
        }
        if (caja == null) crearFranja(tam);
        activo = true; vivo = true;
        Microfono.tomar("los subtítulos");
        new Thread(() -> { EscuchaService.soltarMicrofono(this, 2500); main.post(this::escuchar); }).start();
        return START_STICKY;
    }

    private void crearFranja(float tam) {
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(this)) return;
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        caja = new LinearLayout(this); caja.setOrientation(LinearLayout.VERTICAL);
        int p = dp(12); caja.setPadding(p, dp(8), p, dp(10));
        GradientDrawable fondo = new GradientDrawable(); fondo.setColor(0xD9000000); fondo.setCornerRadius(dp(14)); caja.setBackground(fondo);
        LinearLayout fila = new LinearLayout(this); fila.setOrientation(LinearLayout.HORIZONTAL);
        tOrig = new TextView(this); tOrig.setTextColor(0xFF9FB3C8); tOrig.setTextSize(TypedValue.COMPLEX_UNIT_SP, Math.max(12, tam * 0.6f)); tOrig.setMaxLines(2);
        tOrig.setText("🎧 Escuchando…");
        TextView x = new TextView(this); x.setText("✕"); x.setTextColor(0xFFFFFFFF); x.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20); x.setPadding(dp(12), 0, dp(4), 0);
        x.setOnClickListener(v -> terminar());
        fila.addView(tOrig, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)); fila.addView(x);
        tTrad = new TextView(this); tTrad.setTextColor(0xFFFFFFFF); tTrad.setTextSize(TypedValue.COMPLEX_UNIT_SP, tam); tTrad.setMaxLines(3);
        caja.addView(fila); caja.addView(tTrad);
        int tipo = Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
        final WindowManager.LayoutParams lp = new WindowManager.LayoutParams(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.WRAP_CONTENT, tipo,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS, PixelFormat.TRANSLUCENT);
        lp.gravity = Gravity.BOTTOM; lp.y = dp(90); lp.horizontalMargin = 0.03f;
        // se puede subir o bajar con el dedo (para no tapar los subtítulos del video)
        caja.setOnTouchListener(new View.OnTouchListener() {
            float y0; int lp0;
            @Override public boolean onTouch(View v, MotionEvent e) {
                if (e.getAction() == MotionEvent.ACTION_DOWN) { y0 = e.getRawY(); lp0 = lp.y; return true; }
                if (e.getAction() == MotionEvent.ACTION_MOVE) { lp.y = Math.max(0, lp0 - (int) (e.getRawY() - y0)); try { wm.updateViewLayout(caja, lp); } catch (Exception ignored) { } return true; }
                return false;
            }
        });
        try { wm.addView(caja, lp); } catch (Exception e) { caja = null; }
    }
    private int dp(int v) { return Math.round(v * getResources().getDisplayMetrics().density); }

    private void mostrar(String orig, String trad) {
        main.post(() -> { if (tOrig != null && orig != null && !orig.isEmpty()) tOrig.setText(orig); if (tTrad != null && trad != null) tTrad.setText(trad); });
    }

    private void escuchar() {
        if (!vivo) return;
        if (sr == null) {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) { mostrar("", "Este celular no tiene reconocimiento de voz (instala la app de Google)."); return; }
            sr = SpeechRecognizer.createSpeechRecognizer(this);
            sr.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { }
                @Override public void onBeginningOfSpeech() { }
                @Override public void onRmsChanged(float v) { }
                @Override public void onBufferReceived(byte[] b) { }
                @Override public void onEndOfSpeech() { }
                @Override public void onEvent(int t, Bundle b) { }
                @Override public void onError(int error) {
                    if (!vivo) return;
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) { mostrar("", "Falta el permiso del micrófono."); return; }
                    long espera = error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY ? 900 : error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ? 2500 : 250;
                    main.postDelayed(SubtitulosService.this::escuchar, espera);
                }
                @Override public void onPartialResults(Bundle b) {
                    String t = primero(b); if (t.isEmpty()) return;
                    long ahora = System.currentTimeMillis();
                    if (ahora - ultParcial < 700) { mostrar(t, null); return; }
                    ultParcial = ahora; pasar(t, false);
                }
                @Override public void onResults(Bundle b) {
                    String t = primero(b);
                    if (!t.isEmpty() && !t.equals(ultimoFinal)) { ultimoFinal = t; pasar(t, true); }
                    main.postDelayed(SubtitulosService.this::escuchar, 120);
                }
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, de)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            .putExtra("android.speech.extra.SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS", 900L)
            .putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getPackageName());
        try { sr.startListening(i); } catch (Exception e) { main.postDelayed(this::escuchar, 1000); }
    }
    private static String primero(Bundle b) {
        ArrayList<String> l = b == null ? null : b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return l == null || l.isEmpty() || l.get(0) == null ? "" : l.get(0).trim();
    }
    private void pasar(String t, boolean fin) {
        String corto = t.length() > 220 ? "…" + t.substring(t.length() - 220) : t;
        if (!traducir || tr == null) { mostrar(fin ? "" : "…", corto); return; }
        mostrar(corto, null);
        tr.translate(corto).addOnSuccessListener(x -> mostrar(null, x));
    }

    private void terminar() {
        vivo = false; activo = false;
        if (sr != null) { try { sr.destroy(); } catch (Exception ignored) { } sr = null; }
        if (tr != null) { try { tr.close(); } catch (Exception ignored) { } tr = null; }
        if (caja != null && wm != null) { try { wm.removeView(caja); } catch (Exception ignored) { } caja = null; }
        Microfono.soltar(this, "los subtítulos");
        stopForeground(true); stopSelf();
    }
    @Override public void onDestroy() { if (vivo) terminar(); super.onDestroy(); }

    private void aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) { NotificationChannel ch = new NotificationChannel(CANAL, "Jarvis subtítulos", NotificationManager.IMPORTANCE_LOW); ch.setShowBadge(false); nm.createNotificationChannel(ch); }
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent parar = PendingIntent.getService(this, 52, new Intent(this, SubtitulosService.class).setAction(PARAR), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("💬 Subtítulos en vivo").setContentText("Jarvis oye y traduce. Toca Terminar para cerrarlos.")
            .setOngoing(true).addAction(0, "Terminar", parar).build();
        if (Build.VERSION.SDK_INT >= 30) startForeground(75, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE); else startForeground(75, n);
    }
}
