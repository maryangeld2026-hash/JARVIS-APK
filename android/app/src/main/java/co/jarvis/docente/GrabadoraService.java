package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Jarvis 3.18: graba una reunión o una clase con la pantalla apagada (servicio con aviso fijo). Graba en AAC liviano
 * (32 kbps, ~14 MB por hora) en partes de 10 minutos, para transcribirlas una por una. Pausa, sigue y termina desde
 * Jarvis o desde el aviso. Los archivos quedan solo en el celular hasta que pidas el resumen.
 */
public class GrabadoraService extends Service {
    static final String CANAL = "jarvis_grabadora", PARAR = "parar", PAUSAR = "pausar", SEGUIR = "seguir";
    static volatile boolean grabando = false, pausado = false;
    static volatile String id = "";
    static volatile long inicio = 0, pausadoMs = 0, pausaDesde = 0;
    static final List<String> partes = new ArrayList<>();
    private MediaRecorder rec;
    private final Handler main = new Handler(Looper.getMainLooper());
    private static final long PARTE_MS = 10 * 60 * 1000;
    private final Runnable cortar = this::siguienteParte;

    static File carpeta(android.content.Context c, String id) { File d = new File(new File(c.getFilesDir(), "reuniones"), id); if (!d.exists()) d.mkdirs(); return d; }
    static long segundos() { if (inicio == 0) return 0; long fin = pausado ? pausaDesde : System.currentTimeMillis(); return Math.max(0, (fin - inicio - pausadoMs) / 1000); }

    @Override public IBinder onBind(Intent i) { return null; }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String a = intent != null ? intent.getAction() : null;
        aviso();
        if (intent == null && !grabando) { stopSelf(); return START_NOT_STICKY; }
        if (PARAR.equals(a)) { terminar(); return START_NOT_STICKY; }
        if (PAUSAR.equals(a)) { pausar(); aviso(); return START_STICKY; }
        if (SEGUIR.equals(a)) { seguir(); aviso(); return START_STICKY; }
        if (!grabando) {
            id = intent.getStringExtra("id"); if (id == null || id.isEmpty()) id = "r" + System.currentTimeMillis();
            synchronized (partes) { partes.clear(); }
            Microfono.tomar("la grabadora");
            new Thread(() -> {
                EscuchaService.soltarMicrofono(this, 2500);
                main.post(() -> { inicio = System.currentTimeMillis(); pausadoMs = 0; pausado = false; grabando = true; if (!nuevaParte()) terminar(); aviso(); });
            }).start();
        }
        return START_STICKY;
    }

    private boolean nuevaParte() {
        try {
            File f; synchronized (partes) { f = new File(carpeta(this, id), "parte_" + (partes.size() + 1) + ".aac"); }
            rec = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(this) : new MediaRecorder();
            rec.setAudioSource(MediaRecorder.AudioSource.MIC);
            rec.setOutputFormat(MediaRecorder.OutputFormat.AAC_ADTS);
            rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            rec.setAudioChannels(1); rec.setAudioSamplingRate(16000); rec.setAudioEncodingBitRate(32000);
            rec.setOutputFile(f.getAbsolutePath());
            rec.prepare(); rec.start();
            synchronized (partes) { partes.add(f.getAbsolutePath()); }
            main.removeCallbacks(cortar); main.postDelayed(cortar, PARTE_MS);
            return true;
        } catch (Exception e) { soltarRec(); return false; }
    }
    private void soltarRec() { if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } try { rec.release(); } catch (Exception ignored) { } rec = null; } }
    private void siguienteParte() { if (!grabando) return; if (pausado) { main.postDelayed(cortar, 30000); return; } soltarRec(); if (!nuevaParte()) terminar(); }
    private void pausar() { if (!grabando || pausado || rec == null) return; try { if (Build.VERSION.SDK_INT >= 24) rec.pause(); pausado = true; pausaDesde = System.currentTimeMillis(); } catch (Exception ignored) { } }
    private void seguir() { if (!grabando || !pausado || rec == null) return; try { if (Build.VERSION.SDK_INT >= 24) rec.resume(); pausadoMs += System.currentTimeMillis() - pausaDesde; pausado = false; } catch (Exception ignored) { } }

    private void terminar() {
        main.removeCallbacks(cortar);
        if (pausado) { pausadoMs += System.currentTimeMillis() - pausaDesde; pausado = false; }
        long seg = segundos();
        soltarRec();
        if (grabando) getSharedPreferences("jarvis_grabadora", 0).edit().putString("pendiente", id).putLong("seg_" + id, seg).apply();   // para resumirla al abrir Jarvis
        grabando = false; inicio = 0;
        Microfono.soltar(this, "la grabadora");
        stopForeground(true); stopSelf();
    }

    @Override public void onDestroy() { if (grabando) terminar(); super.onDestroy(); }

    private void aviso() {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) { NotificationChannel ch = new NotificationChannel(CANAL, "Jarvis grabando", NotificationManager.IMPORTANCE_LOW); ch.setShowBadge(false); nm.createNotificationChannel(ch); }
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent abrir = PendingIntent.getActivity(this, 41, new Intent(this, MainActivity.class).putExtra("atajo", "reunion").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), fl);
        PendingIntent parar = PendingIntent.getService(this, 42, new Intent(this, GrabadoraService.class).setAction(PARAR), fl);
        PendingIntent ps = PendingIntent.getService(this, 43, new Intent(this, GrabadoraService.class).setAction(pausado ? SEGUIR : PAUSAR), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle(pausado ? "⏸ Grabación en pausa" : "🔴 Jarvis está grabando")
            .setContentText("Avísales a los presentes que estás grabando").setContentIntent(abrir).setOngoing(true)
            .addAction(0, pausado ? "Seguir" : "Pausa", ps).addAction(0, "Terminar", parar);
        if (grabando && !pausado) { b.setUsesChronometer(true).setWhen(System.currentTimeMillis() - segundos() * 1000); }
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 30) startForeground(74, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE); else startForeground(74, n);
    }
}
