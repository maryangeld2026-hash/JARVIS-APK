package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import org.json.JSONObject;
import org.vosk.Model;
import org.vosk.Recognizer;

/**
 * Jarvis: escucha «Jarvis» en segundo plano, sin internet (Vosk en español, en el celular). Con la palabra, abre
 * Jarvis (aunque estés en otra app o con la pantalla apagada) y le pasa lo que dijiste después de «Jarvis».
 * Mientras Jarvis conversa, este servicio suelta el micrófono (pausar) y lo vuelve a tomar al terminar (reanudar).
 */
public class EscuchaService extends Service {
    static final String TAG = "JarvisEscucha";
    static final String CANAL = "jarvis_escucha";
    static final String ACCION_PAUSAR = "pausar", ACCION_REANUDAR = "reanudar";
    static volatile boolean activo = false, pausado = false;
    /** 3.3: true mientras este servicio tiene el micrófono abierto (para que la conversación espere a que lo suelte). */
    static volatile boolean grabando = false;

    private Thread hilo;
    private volatile boolean correr = false;
    private Model modelo;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        aviso(ACCION_PAUSAR.equals(a) ? "En pausa mientras conversamos" : "Di «Jarvis» cuando me necesites");
        if (ACCION_PAUSAR.equals(a)) { pausado = true; parar(); return START_STICKY; }
        pausado = false;
        activo = true;
        arrancar();
        return START_STICKY;
    }

    /** 3.3: pide al servicio que suelte el micrófono y espera (hasta ms) a que de verdad lo suelte. No llamar desde el hilo principal. */
    static boolean soltarMicrofono(android.content.Context c, long ms) {
        if (!grabando) return true;
        Intent i = new Intent(c, EscuchaService.class).setAction(ACCION_PAUSAR);
        try { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) c.startForegroundService(i); else c.startService(i); } catch (Exception e) { return false; }
        long fin = System.currentTimeMillis() + ms;
        while (grabando && System.currentTimeMillis() < fin) { try { Thread.sleep(40); } catch (InterruptedException e) { break; } }
        try { Thread.sleep(120); } catch (InterruptedException ignored) { }      // que Android termine de liberar el audio
        return !grabando;
    }

    private Intent abrir(String resto) {
        Intent i = new Intent(this, MainActivity.class);
        i.putExtra(EscuchaPlugin.EXTRA_DESPERTAR, true);
        i.putExtra(EscuchaPlugin.EXTRA_RESTO, resto == null ? "" : resto);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        return i;
    }

    private void aviso(String texto) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CANAL, "Jarvis escuchando", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getActivity(this, 11, abrir(""), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        Notification n = b.setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("Jarvis")
            .setContentText(texto)
            .setContentIntent(pi)
            .setOngoing(true)
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) startForeground(72, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        else startForeground(72, n);
    }

    private synchronized void arrancar() {
        if (correr) return;
        correr = true;
        hilo = new Thread(this::bucle, "jarvis-escucha");
        hilo.start();
    }

    private synchronized void parar() {
        correr = false;
        if (hilo != null) { try { hilo.join(1500); } catch (InterruptedException ignored) { } hilo = null; }
    }

    private void bucle() {
        AudioRecord rec = null;
        Recognizer r = null;
        try {
            if (modelo == null) {
                String ruta = EscuchaPlugin.rutaModelo(this);
                if (ruta == null) { EscuchaPlugin.emitir("error", "Falta descargar el modelo de voz."); stopSelf(); return; }
                modelo = new Model(ruta);
            }
            r = new Recognizer(modelo, 16000.0f);
            int min = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192));
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("El micrófono está ocupado.");
            rec.startRecording();
            grabando = true;
            EscuchaPlugin.emitir("estado", "escuchando");
            byte[] buf = new byte[4096];
            boolean oyo = false;
            long desde = 0;
            while (correr) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                if (r.acceptWaveForm(buf, n)) {
                    String t = new JSONObject(r.getResult()).optString("text", "");
                    String resto = Despertar.resto(t);
                    if (resto != null) { despertar(resto); break; }
                    oyo = false;
                } else {
                    String p = new JSONObject(r.getPartialResult()).optString("partial", "");
                    if (!oyo && Despertar.resto(p) != null) { oyo = true; desde = System.currentTimeMillis(); }
                    // dijo «Jarvis» y siguió hablando: se espera el final de la frase (máx. 6 s) para pasar la orden completa
                    if (oyo && System.currentTimeMillis() - desde > 6000) {
                        String resto = Despertar.resto(new JSONObject(r.getFinalResult()).optString("text", p));
                        despertar(resto == null ? "" : resto);
                        break;
                    }
                }
            }
        } catch (Throwable e) {
            Log.e(TAG, "Escucha", e);
            EscuchaPlugin.emitir("error", String.valueOf(e.getMessage()));
        } finally {
            if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } rec.release(); }
            grabando = false;
            if (r != null) r.close();
            correr = false;
        }
    }

    private void despertar(String resto) {
        pausado = true;
        main.post(() -> {
            aviso("En pausa mientras conversamos");
            boolean puede = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this);
            if (puede) {
                try { startActivity(abrir(resto)); } catch (Exception e) { Log.e(TAG, "abrir", e); }
            }
            EscuchaPlugin.despertar(resto);
        });
    }

    @Override
    public void onDestroy() {
        activo = false;
        parar();
        if (modelo != null) { modelo.close(); modelo = null; }
        super.onDestroy();
    }
}
