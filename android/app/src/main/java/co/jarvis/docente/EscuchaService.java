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

    // ======================================================================== 3.7.1: ahorro de batería
    /** ¿Se puede escuchar ahora? Respeta: horario (si lo escogiste), pantalla encendida (si lo escogiste) y batería. → null si sí, o el motivo */
    private String motivoPausa() {
        android.content.SharedPreferences sp = getSharedPreferences("jarvis_escucha", 0);
        try {
            if (sp.getBoolean("cuidarBateria", true)) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                Intent b = registerReceiver(null, new android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                int nivel = b != null ? b.getIntExtra(android.os.BatteryManager.EXTRA_LEVEL, 100) * 100 / Math.max(1, b.getIntExtra(android.os.BatteryManager.EXTRA_SCALE, 100)) : 100;
                int est = b != null ? b.getIntExtra(android.os.BatteryManager.EXTRA_STATUS, 0) : 0;
                boolean cargando = est == android.os.BatteryManager.BATTERY_STATUS_CHARGING || est == android.os.BatteryManager.BATTERY_STATUS_FULL;
                if (!cargando && pm != null && pm.isPowerSaveMode()) return "En pausa: el celular está en ahorro de batería";
                if (!cargando && nivel <= sp.getInt("bateriaMin", 15)) return "En pausa: batería baja (" + nivel + " %)";
            }
            if (sp.getBoolean("soloPantalla", false)) {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                if (pm != null && !pm.isInteractive()) return "En pausa: pantalla apagada";
            }
            if (sp.getBoolean("soloHorario", false)) {
                java.util.Calendar c = java.util.Calendar.getInstance();
                int dia = c.get(java.util.Calendar.DAY_OF_WEEK) - 1, min = c.get(java.util.Calendar.HOUR_OF_DAY) * 60 + c.get(java.util.Calendar.MINUTE);
                org.json.JSONArray v = new org.json.JSONArray(sp.getString("ventanas", "[]"));
                boolean dentro = v.length() == 0;
                for (int k = 0; k < v.length() && !dentro; k++) {
                    org.json.JSONObject o = v.getJSONObject(k);
                    if (o.optInt("dia", -1) == dia && min >= o.optInt("ini", 0) && min < o.optInt("fin", 0)) dentro = true;
                }
                if (!dentro) return "En pausa: fuera de tu horario";
            }
        } catch (Exception ignored) { }
        return null;
    }

    /** Volumen de un trozo de audio (16 bits). */
    private static double rms(byte[] b, int n) {
        long s = 0; int k = 0;
        for (int i = 0; i + 1 < n; i += 4) { int v = (short) ((b[i] & 0xff) | (b[i + 1] << 8)); s += (long) v * v; k++; }
        return k == 0 ? 0 : Math.sqrt((double) s / k);
    }

    private void bucle() {
        Recognizer r = null;
        String ultimoAviso = "";
        try {
            if (modelo == null) {
                String ruta = EscuchaPlugin.rutaModelo(this);
                if (ruta == null) { EscuchaPlugin.emitir("error", "Falta descargar el modelo de voz."); stopSelf(); return; }
                modelo = new Model(ruta);
            }
            r = new Recognizer(modelo, 16000.0f);
            while (correr) {
                // fuera de horario, pantalla apagada o batería baja: el micrófono queda cerrado y se revisa cada 30 s
                String motivo = motivoPausa();
                if (motivo != null) {
                    if (!motivo.equals(ultimoAviso)) { ultimoAviso = motivo; final String m = motivo; main.post(() -> aviso(m)); EscuchaPlugin.emitir("estado", "pausa"); }
                    for (int k = 0; k < 60 && correr; k++) { try { Thread.sleep(500); } catch (InterruptedException e) { break; } }
                    continue;
                }
                if (!ultimoAviso.isEmpty()) { ultimoAviso = ""; main.post(() -> aviso("Di «Jarvis» cuando me necesites")); }
                if (escuchar(r)) break;                                   // true: te oyó y abrió Jarvis
            }
        } catch (Throwable e) {
            Log.e(TAG, "Escucha", e);
            EscuchaPlugin.emitir("error", String.valueOf(e.getMessage()));
        } finally {
            if (r != null) r.close();
            correr = false;
        }
    }

    /** Escucha hasta que te oye, hasta que hay que pausar (vuelve a revisar cada 20 s) o hasta que lo paran. */
    private boolean escuchar(Recognizer r) throws Exception {
        AudioRecord rec = null;
        try {
            int min = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
            rec = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, Math.max(min, 8192));
            if (rec.getState() != AudioRecord.STATE_INITIALIZED) throw new IllegalStateException("El micrófono está ocupado.");
            rec.startRecording();
            grabando = true;
            EscuchaPlugin.emitir("estado", "escuchando");
            final int TROZO = 3200;                                       // 100 ms de audio
            byte[][] previo = new byte[4][];                              // los últimos 400 ms, para no perder el comienzo de «Jarvis»
            int[] previoN = new int[4]; int pi = 0;
            byte[] buf = new byte[TROZO];
            double piso = 200;                                            // el ruido de fondo (se ajusta solo)
            long ultimaVoz = 0, revisar = System.currentTimeMillis() + 20000;
            boolean abierto = false, oyo = false;
            long desde = 0;
            while (correr) {
                int n = rec.read(buf, 0, buf.length);
                if (n <= 0) continue;
                long ahora = System.currentTimeMillis();
                double v = rms(buf, n);
                boolean voz = v > Math.max(piso * 2.6, 260);
                if (!voz) piso = piso * 0.97 + v * 0.03;                     // el piso sigue al ruido del lugar
                if (voz) ultimaVoz = ahora;
                if (!abierto && voz) {
                    abierto = true;                                       // alguien habla: se despierta el reconocedor con lo que venía antes
                    for (int k = 0; k < previo.length; k++) { int idx = (pi + k) % previo.length; if (previo[idx] != null) r.acceptWaveForm(previo[idx], previoN[idx]); }
                }
                if (abierto) {
                    if (r.acceptWaveForm(buf, n)) {
                        String t = new JSONObject(r.getResult()).optString("text", "");
                        String resto = Despertar.resto(t);
                        if (resto != null) { despertar(resto); return true; }
                        oyo = false;
                    } else {
                        String p = new JSONObject(r.getPartialResult()).optString("partial", "");
                        if (!oyo && Despertar.resto(p) != null) { oyo = true; desde = ahora; }
                        if (oyo && ahora - desde > 6000) {
                            String resto = Despertar.resto(new JSONObject(r.getFinalResult()).optString("text", p));
                            despertar(resto == null ? "" : resto);
                            return true;
                        }
                    }
                    if (!oyo && ahora - ultimaVoz > 1500) {               // 1,5 s de silencio: el reconocedor vuelve a dormir
                        String t = new JSONObject(r.getFinalResult()).optString("text", "");
                        String resto = Despertar.resto(t);
                        if (resto != null) { despertar(resto); return true; }
                        abierto = false;
                    }
                } else {
                    byte[] copia = previo[pi] != null && previo[pi].length == n ? previo[pi] : new byte[n];
                    System.arraycopy(buf, 0, copia, 0, n); previo[pi] = copia; previoN[pi] = n; pi = (pi + 1) % previo.length;
                }
                if (!abierto && ahora > revisar) { revisar = ahora + 20000; if (motivoPausa() != null) return false; }
            }
            return false;
        } finally {
            if (rec != null) { try { rec.stop(); } catch (Exception ignored) { } rec.release(); }
            grabando = false;
        }
    }

    private void despertar(String resto) {
        pausado = true;
        ControlServicio.capturar();                                   // 3.10: lo que estabas viendo, por si preguntas «¿qué dice esta pantalla?»
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
