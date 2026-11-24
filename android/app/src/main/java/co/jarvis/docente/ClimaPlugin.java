package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.Locale;

/**
 * Jarvis 3.31 · alertas de lluvia fuerte: Android revisa el pronóstico (Open-Meteo, gratis y sin clave) cada 2 horas
 * y, si viene lluvia fuerte o tormenta en las próximas 4 horas, avisa una vez («lleva paraguas»). De noche no molesta.
 * Jarvis no queda despierto: lo hace Android con un trabajo programado, solo con internet.
 *   config({on, lat, lng}) · probar() → {hay, texto}
 */
@CapacitorPlugin(name = "Clima")
public class ClimaPlugin extends Plugin {
    static final int JOB = 7331;

    @PluginMethod
    public void config(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        SharedPreferences.Editor e = getContext().getSharedPreferences("jarvis_clima", 0).edit().putBoolean("on", on);
        if (call.hasOption("lat")) e.putFloat("lat", (float) (double) call.getDouble("lat", 4.65)).putFloat("lng", (float) (double) call.getDouble("lng", -74.08));
        e.apply();
        programar(getContext(), on);
        call.resolve();
    }

    static void programar(Context c, boolean on) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (!on) { js.cancel(JOB); return; }
        JobInfo.Builder b = new JobInfo.Builder(JOB, new ComponentName(c, Revision.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setPeriodic(2 * 3600_000L, 30 * 60_000L).setPersisted(true);
        try { js.schedule(b.build()); } catch (Exception ignored) { }
    }

    @PluginMethod
    public void probar(PluginCall call) {
        new Thread(() -> {
            JSObject r = new JSObject();
            try { String t = revisar(getContext(), false); r.put("hay", t != null); r.put("texto", t == null ? "" : t); call.resolve(r); }
            catch (Exception e) { call.reject("No pude ver el pronóstico: " + e.getMessage()); }
        }).start();
    }

    /** → el texto del aviso (y lo muestra si avisar=true y no se había avisado), o null si no viene lluvia fuerte. */
    static String revisar(Context c, boolean avisar) throws Exception {
        SharedPreferences p = c.getSharedPreferences("jarvis_clima", 0);
        if (!p.contains("lat")) return null;
        String url = String.format(Locale.US, "https://api.open-meteo.com/v1/forecast?latitude=%.3f&longitude=%.3f&hourly=precipitation_probability,precipitation,weather_code&forecast_hours=5&timezone=auto", p.getFloat("lat", 0), p.getFloat("lng", 0));
        HttpURLConnection con = (HttpURLConnection) new URL(url).openConnection();
        con.setConnectTimeout(15000); con.setReadTimeout(20000);
        JSONObject j;
        try (InputStream in = con.getInputStream()) { j = new JSONObject(new String(leer(in), "UTF-8")); } finally { con.disconnect(); }
        JSONObject h = j.getJSONObject("hourly");
        JSONArray ts = h.getJSONArray("time"), pr = h.getJSONArray("precipitation_probability"), mm = h.getJSONArray("precipitation"), wc = h.getJSONArray("weather_code");
        // las mismas reglas que logica20.lluviaFuerte: ≥70 % y ≥2 mm, o tormenta con ≥50 %, o ≥5 mm
        for (int i = 0; i < ts.length(); i++) {
            int prob = pr.optInt(i, 0), code = wc.optInt(i, 0); double lluvia = mm.optDouble(i, 0);
            boolean tormenta = code >= 95;
            if ((prob >= 70 && lluvia >= 2) || (tormenta && prob >= 50) || lluvia >= 5) {
                String hora = ts.getString(i);                                    // «2026-11-23T15:00»
                int hh = Integer.parseInt(hora.substring(11, 13));
                String txt = (tormenta ? "⛈️ Tormenta" : "🌧️ Lluvia fuerte") + " hacia las " + ((hh % 12) == 0 ? 12 : hh % 12) + (hh < 12 ? " a. m." : " p. m.") + " (" + prob + " %). Lleva paraguas.";
                if (avisar) {
                    String clave = hora.substring(0, 13);
                    if (clave.equals(p.getString("ultimo", ""))) return txt;
                    Calendar ahora = Calendar.getInstance(); int hAhora = ahora.get(Calendar.HOUR_OF_DAY);
                    if (hAhora < 6 || hAhora >= 21) return txt;                      // de noche no molesta
                    p.edit().putString("ultimo", clave).apply();
                    notificar(c, txt);
                }
                return txt;
            }
        }
        return null;
    }

    private static byte[] leer(InputStream in) throws Exception { java.io.ByteArrayOutputStream o = new java.io.ByteArrayOutputStream(); byte[] b = new byte[8192]; int n; while ((n = in.read(b)) > 0) o.write(b, 0, n); return o.toByteArray(); }

    static void notificar(Context c, String txt) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_clima", "Alertas de lluvia", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent pi = PendingIntent.getActivity(c, 7331, new Intent(c, MainActivity.class).putExtra("atajo", "orden:¿cómo va a estar el clima hoy?").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_clima") : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("Jarvis · clima").setContentText(txt).setContentIntent(pi).setAutoCancel(true);
        try { nm.notify(7331, b.build()); } catch (Exception ignored) { }
    }

    /** El trabajo que Android corre cada 2 horas. */
    public static class Revision extends JobService {
        @Override public boolean onStartJob(JobParameters jp) {
            if (Apagado.es(this) || !getSharedPreferences("jarvis_clima", 0).getBoolean("on", false)) return false;
            new Thread(() -> { try { revisar(this, true); } catch (Exception ignored) { } jobFinished(jp, false); }).start();
            return true;
        }
        @Override public boolean onStopJob(JobParameters jp) { return false; }
    }
}
