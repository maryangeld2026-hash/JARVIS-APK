package co.jarvis.docente;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.provider.CalendarContract;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.Locale;

/**
 * Jarvis 3.34 · rutinas que hace Android aunque Jarvis esté cerrado (sin dejarlo despierto):
 *   · 5:30 a. m.: «temas que sigo» (Gemini busca en internet y deja el resumen) y alertas de precio.
 *   · 8:00 p. m.: choques en la agenda de mañana (lee el calendario del celular, nada sale del celular).
 *   · A tu hora de dormir: rutina de sueño (si dormiste poco anoche te lo dice y baja el volumen, si lo pediste).
 *   config({temas, precios, key, modelo, choques, sueno:{on, hora, ajustar}}) · brief() · precios() · ahora({que})
 * La clave de Gemini se guarda solo en este celular (como en las tareas largas) y se borra si no hay temas ni precios.
 */
@CapacitorPlugin(name = "Rutina")
public class RutinaPlugin extends Plugin {
    static final String PREFS = "jarvis_rutina";
    static final String MANANA = "co.jarvis.docente.RUTINA_MANANA", NOCHE = "co.jarvis.docente.RUTINA_NOCHE", SUENO = "co.jarvis.docente.RUTINA_SUENO";
    static final int JOB = 7334;

    static SharedPreferences p(Context c) { return c.getSharedPreferences(PREFS, 0); }

    @PluginMethod
    public void config(PluginCall call) {
        SharedPreferences.Editor e = p(getContext()).edit();
        try {
            if (call.hasOption("temas")) e.putString("temas", call.getArray("temas", new JSArray()).toString());
            if (call.hasOption("precios")) e.putString("precios", mezclarPrecios(p(getContext()).getString("precios", "[]"), call.getArray("precios", new JSArray())).toString());
            if (call.hasOption("choques")) e.putBoolean("choques", Boolean.TRUE.equals(call.getBoolean("choques", false)));
            if (call.hasOption("modelo")) e.putString("modelo", call.getString("modelo", ""));
            if (call.hasOption("sueno")) { JSObject s = call.getObject("sueno"); e.putBoolean("sueno", s.optBoolean("on", false)).putString("suenoHora", s.optString("hora", "22:00")).putBoolean("suenoAjustar", s.optBoolean("ajustar", true)); }
            String key = call.getString("key", null);
            if (key != null) e.putString("key", key);
            e.apply();
            SharedPreferences q = p(getContext());
            if (new JSONArray(q.getString("temas", "[]")).length() == 0 && new JSONArray(q.getString("precios", "[]")).length() == 0) q.edit().remove("key").apply();
        } catch (Exception ex) { call.reject(ex.getMessage()); return; }
        programar(getContext());
        call.resolve();
    }
    /** Lo que ya se sabía de cada precio (último precio y si ya se avisó) se conserva. */
    private static JSONArray mezclarPrecios(String viejo, JSArray nuevos) throws Exception {
        JSONArray v = new JSONArray(viejo), out = new JSONArray();
        for (int i = 0; i < nuevos.length(); i++) {
            JSONObject n = nuevos.getJSONObject(i);
            for (int k = 0; k < v.length(); k++) { JSONObject o = v.getJSONObject(k); if (o.optString("q").equalsIgnoreCase(n.optString("q"))) { n.put("precio", o.optLong("precio", 0)); n.put("tienda", o.optString("tienda", "")); n.put("t", o.optLong("t", 0)); n.put("avisado", o.optLong("avisado", 0)); } }
            out.put(n);
        }
        return out;
    }

    @PluginMethod
    public void brief(PluginCall call) { JSObject r = new JSObject(); r.put("texto", p(getContext()).getString("brief", "")); r.put("t", p(getContext()).getLong("briefT", 0)); call.resolve(r); }

    @PluginMethod
    public void precios(PluginCall call) { JSObject r = new JSObject(); try { r.put("lista", new JSArray(p(getContext()).getString("precios", "[]"))); } catch (Exception e) { r.put("lista", new JSArray()); } call.resolve(r); }

    /** Para probar sin esperar: que = manana | noche | sueno. */
    @PluginMethod
    public void ahora(PluginCall call) {
        final String que = call.getString("que", "manana");
        new Thread(() -> {
            JSObject r = new JSObject();
            try {
                if ("noche".equals(que)) r.put("texto", choquesManana(getContext(), true));
                else if ("sueno".equals(que)) r.put("texto", sueno(getContext()));
                else { manana(getContext()); r.put("texto", p(getContext()).getString("brief", "")); }
                call.resolve(r);
            } catch (Exception e) { call.reject(e.getMessage()); }
        }).start();
    }

    // ======================================================================== PROGRAMAR
    static void programar(Context c) {
        SharedPreferences q = p(c);
        boolean hayTemas = false, hayPrecios = false;
        try { hayTemas = new JSONArray(q.getString("temas", "[]")).length() > 0; hayPrecios = new JSONArray(q.getString("precios", "[]")).length() > 0; } catch (Exception ignored) { }
        alarma(c, MANANA, 7341, (hayTemas || hayPrecios) && q.contains("key") ? siguiente(5, 30) : 0);
        alarma(c, NOCHE, 7342, q.getBoolean("choques", false) ? siguiente(20, 0) : 0);
        int[] hs = horaMin(q.getString("suenoHora", "22:00"));
        Calendar s = Calendar.getInstance(); s.set(Calendar.HOUR_OF_DAY, hs[0]); s.set(Calendar.MINUTE, hs[1]); s.add(Calendar.MINUTE, -30);
        alarma(c, SUENO, 7343, q.getBoolean("sueno", false) ? siguiente(s.get(Calendar.HOUR_OF_DAY), s.get(Calendar.MINUTE)) : 0);
    }
    static int[] horaMin(String s) { try { String[] x = s.split(":"); return new int[] { Integer.parseInt(x[0]), Integer.parseInt(x[1]) }; } catch (Exception e) { return new int[] { 22, 0 }; } }
    static long siguiente(int h, int m) {
        Calendar k = Calendar.getInstance(); k.set(Calendar.HOUR_OF_DAY, h); k.set(Calendar.MINUTE, m); k.set(Calendar.SECOND, 0);
        if (k.getTimeInMillis() <= System.currentTimeMillis() + 60_000) k.add(Calendar.DAY_OF_MONTH, 1);
        return k.getTimeInMillis();
    }
    static void alarma(Context c, String accion, int codigo, long cuando) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE); if (am == null) return;
        PendingIntent pi = PendingIntent.getBroadcast(c, codigo, new Intent(c, Alarma.class).setAction(accion), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        am.cancel(pi);
        if (cuando > 0) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, pi);
    }

    /** Cuando suena cada alarma (y al prender el celular, para volver a programarlas). */
    public static class Alarma extends BroadcastReceiver {
        @Override public void onReceive(Context c, Intent i) {
            String a = i.getAction();
            if (Apagado.es(c)) { programar(c); return; }
            if (MANANA.equals(a)) {
                JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
                if (js != null) try { js.schedule(new JobInfo.Builder(JOB, new ComponentName(c, Trabajo.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setOverrideDeadline(3 * 3600_000L).build()); } catch (Exception ignored) { }
            } else if (NOCHE.equals(a) || SUENO.equals(a)) {
                PendingResult pr = goAsync();
                new Thread(() -> { try { if (NOCHE.equals(a)) choquesManana(c, false); else sueno(c); } catch (Exception ignored) { } finally { pr.finish(); } }).start();
            }
            programar(c);
        }
    }
    /** El trabajo de la mañana (con internet). */
    public static class Trabajo extends JobService {
        @Override public boolean onStartJob(JobParameters jp) { new Thread(() -> { try { manana(this); } catch (Exception ignored) { } jobFinished(jp, false); }).start(); return true; }
        @Override public boolean onStopJob(JobParameters jp) { return true; }
    }

    // ======================================================================== MAÑANA: TEMAS Y PRECIOS
    static void manana(Context c) throws Exception {
        SharedPreferences q = p(c);
        String key = q.getString("key", ""); if (key.isEmpty()) return;
        String modelo = q.getString("modelo", ""); if (modelo.isEmpty()) modelo = "gemini-flash-latest";
        JSONArray temas = new JSONArray(q.getString("temas", "[]"));
        if (temas.length() > 0) {
            List<String> l = new ArrayList<>(); for (int i = 0; i < temas.length(); i++) l.add(temas.getString(i));
            String hoy = new SimpleDateFormat("EEEE d 'de' MMMM 'de' yyyy", new Locale("es", "CO")).format(new java.util.Date());
            String prompt = "Hoy es " + hoy + ". Para cada tema, busca en internet lo más importante de las últimas 24 horas y escribe 2 o 3 frases claras en español de Colombia, con la fuente entre paréntesis. Si es un tema político, sé neutral y muestra las distintas posturas. Si no hay nada nuevo, dilo en una frase.\nTemas: " + String.join("; ", l) + "\nFormato: un título con emoji por tema y debajo el resumen.";
            String t = gemini(key, modelo, prompt);
            if (!t.isEmpty()) { q.edit().putString("brief", t).putLong("briefT", System.currentTimeMillis()).apply(); notificar(c, 7344, "📰 Tus temas de hoy están listos", "Toca para leerlos (" + String.join(", ", l) + ").", "orden:resumen de mis temas"); }
        }
        JSONArray pr = new JSONArray(q.getString("precios", "[]"));
        boolean cambio = false;
        for (int i = 0; i < pr.length(); i++) {
            JSONObject o = pr.getJSONObject(i);
            String t = gemini(key, modelo, "Busca en internet el precio más bajo HOY en Colombia (pesos colombianos) de: " + o.optString("q") + ". Solo tiendas reconocidas y producto nuevo. Responde en dos líneas: PRECIO: <número sin puntos> y TIENDA: <nombre>. Si no encuentras, PRECIO: 0.");
            java.util.regex.Matcher mp = java.util.regex.Pattern.compile("(?i)PRECIO:\\s*\\$?\\s*([\\d.,]+)").matcher(t), mt = java.util.regex.Pattern.compile("(?i)TIENDA:\\s*(.+)").matcher(t);
            long precio = 0; try { if (mp.find()) precio = Long.parseLong(mp.group(1).replaceAll("[.,](?=\\d{3}\\b)", "").replaceAll("[.,]\\d+$", "")); } catch (Exception ignored) { }
            if (precio <= 0) continue;
            o.put("precio", precio); o.put("tienda", mt.find() ? mt.group(1).trim() : ""); o.put("t", System.currentTimeMillis()); cambio = true;
            long max = o.optLong("max", 0);
            if (max > 0 && precio <= max && System.currentTimeMillis() - o.optLong("avisado", 0) > 3 * 86400_000L) {
                o.put("avisado", System.currentTimeMillis());
                notificar(c, 7345 + i, "🔔 ¡Bajó de precio!", o.optString("q") + ": $" + String.format(new Locale("es", "CO"), "%,d", precio) + (o.optString("tienda").isEmpty() ? "" : " en " + o.optString("tienda")) + " (tu límite: $" + String.format(new Locale("es", "CO"), "%,d", max) + "). Revísalo antes de comprar.", "orden:mis alertas de precio");
            }
        }
        if (cambio) q.edit().putString("precios", pr.toString()).apply();
    }

    /** Una pregunta a Gemini con la Búsqueda de Google. */
    static String gemini(String key, String modelo, String prompt) {
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL("https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent").openConnection();
            con.setRequestMethod("POST"); con.setDoOutput(true); con.setConnectTimeout(20000); con.setReadTimeout(90000);
            con.setRequestProperty("content-type", "application/json"); con.setRequestProperty("x-goog-api-key", key);
            JSONObject body = new JSONObject()
                .put("contents", new JSONArray().put(new JSONObject().put("role", "user").put("parts", new JSONArray().put(new JSONObject().put("text", prompt)))))
                .put("tools", new JSONArray().put(new JSONObject().put("google_search", new JSONObject())));
            try (OutputStream o = con.getOutputStream()) { o.write(body.toString().getBytes("UTF-8")); }
            if (con.getResponseCode() != 200) return "";
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            try (InputStream in = con.getInputStream()) { byte[] buf = new byte[8192]; int n; while ((n = in.read(buf)) > 0) b.write(buf, 0, n); }
            JSONArray parts = new JSONObject(b.toString("UTF-8")).getJSONArray("candidates").getJSONObject(0).getJSONObject("content").getJSONArray("parts");
            StringBuilder s = new StringBuilder(); for (int i = 0; i < parts.length(); i++) s.append(parts.getJSONObject(i).optString("text", ""));
            return s.toString().trim();
        } catch (Exception e) { return ""; } finally { if (con != null) con.disconnect(); }
    }

    // ======================================================================== NOCHE: CHOQUES DE MAÑANA
    static String choquesManana(Context c, boolean siempre) {
        if (c.checkSelfPermission(android.Manifest.permission.READ_CALENDAR) != PackageManager.PERMISSION_GRANTED) return "Sin permiso del calendario.";
        Calendar k = Calendar.getInstance(); k.add(Calendar.DAY_OF_MONTH, 1); k.set(Calendar.HOUR_OF_DAY, 0); k.set(Calendar.MINUTE, 0); k.set(Calendar.SECOND, 0);
        long desde = k.getTimeInMillis(), hasta = desde + 86400_000L;
        Uri.Builder b = CalendarContract.Instances.CONTENT_URI.buildUpon(); ContentUris.appendId(b, desde); ContentUris.appendId(b, hasta);
        List<long[]> ev = new ArrayList<>(); List<String[]> info = new ArrayList<>();
        try (Cursor cu = c.getContentResolver().query(b.build(), new String[] { CalendarContract.Instances.TITLE, CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.ALL_DAY, CalendarContract.Instances.EVENT_LOCATION }, null, null, CalendarContract.Instances.BEGIN + " ASC")) {
            while (cu != null && cu.moveToNext()) { if (cu.getInt(3) == 1) continue; ev.add(new long[] { cu.getLong(1), cu.getLong(2) }); info.add(new String[] { cu.getString(0) == null ? "Evento" : cu.getString(0), cu.getString(4) == null ? "" : cu.getString(4).trim() }); }
        } catch (Exception e) { return "No pude leer el calendario."; }
        // las mismas reglas que logica22.conflictos: se cruzan, o hay menos de 30 min entre dos lugares distintos
        StringBuilder s = new StringBuilder(); int n = 0;
        SimpleDateFormat f = new SimpleDateFormat("h:mm a", new Locale("es", "CO"));
        for (int i = 0; i < ev.size(); i++) for (int j = i + 1; j < ev.size(); j++) {
            if (ev.get(j)[0] < ev.get(i)[1]) { n++; s.append("«").append(info.get(i)[0]).append("» (").append(f.format(ev.get(i)[0])).append(") se cruza con «").append(info.get(j)[0]).append("» (").append(f.format(ev.get(j)[0])).append("). "); }
            else if (j == i + 1 && !info.get(i)[1].isEmpty() && !info.get(j)[1].isEmpty() && !info.get(i)[1].equalsIgnoreCase(info.get(j)[1]) && ev.get(j)[0] - ev.get(i)[1] < 30 * 60_000L) { n++; s.append("Entre «").append(info.get(i)[0]).append("» y «").append(info.get(j)[0]).append("» hay muy poco tiempo para ir de un lugar al otro. "); }
        }
        if (n > 0) notificar(c, 7346, "⚠️ Ojo con tu agenda de mañana", s.toString().trim(), "orden:¿tengo choques en mi agenda mañana?");
        return n > 0 ? s.toString().trim() : "Mañana no hay choques en tu agenda.";
    }

    // ======================================================================== RUTINA DE SUEÑO
    static String sueno(Context c) {
        SharedPreferences q = p(c);
        String hora = q.getString("suenoHora", "22:00");
        String txt = "🌙 En media hora es tu hora de dormir (" + hora + "). Ve bajando el ritmo: menos pantalla y luz más baja.";
        try {
            JSONObject r = new JSONObject(SaludMotor.resumen(c, 2));
            JSONArray l = r.optJSONArray("sueno");
            long mejor = 0, fin = 0;
            if (l != null) for (int i = 0; i < l.length(); i++) { JSONObject x = l.getJSONObject(i); if (x.optLong("fin") > fin) { fin = x.optLong("fin"); mejor = x.optLong("fin") - x.optLong("ini"); } }
            if (mejor > 3600_000L && System.currentTimeMillis() - fin < 30 * 3600_000L) {
                long min = mejor / 60_000L;
                txt = min < 360 ? "😴 Anoche dormiste " + (min / 60) + " h " + (min % 60) + " min. Hoy trata de acostarte ya, a las " + hora + " o antes." : "🌙 Anoche dormiste " + (min / 60) + " h " + (min % 60) + " min. En media hora es tu hora de dormir (" + hora + ").";
            }
        } catch (Throwable ignored) { /* sin Health Connect: el aviso normal */ }
        if (q.getBoolean("suenoAjustar", true)) {
            try {
                AudioManager am = (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
                int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), v = am.getStreamVolume(AudioManager.STREAM_MUSIC), baja = Math.max(1, max * 3 / 10);
                if (v > baja) { am.setStreamVolume(AudioManager.STREAM_MUSIC, baja, 0); txt += " Te bajé el volumen."; }
            } catch (Exception ignored) { }
        }
        notificar(c, 7347, "Jarvis · hora de dormir", txt, "orden:rutina de la noche");
        return txt;
    }

    static void notificar(Context c, int id, String titulo, String texto, String atajo) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_rutina", "Rutinas de Jarvis", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent pi = PendingIntent.getActivity(c, id, new Intent(c, MainActivity.class).putExtra("atajo", atajo).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_rutina") : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle(titulo).setContentText(texto).setStyle(new Notification.BigTextStyle().bigText(texto)).setContentIntent(pi).setAutoCancel(true);
        try { nm.notify(id, b.build()); } catch (Exception ignored) { }
    }
}
