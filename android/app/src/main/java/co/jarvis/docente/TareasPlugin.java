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
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Jarvis 3.28 · tareas largas en segundo plano (Interactions API de Gemini, background=true).
 * Jarvis crea la tarea en la nube («investiga a fondo…») y aquí se vigila: aunque cierres Jarvis o bloquees el celular,
 * cada minuto se pregunta a Google si ya terminó. Mientras tanto hay un aviso en vivo; al terminar, una notificación.
 *   vigilar({id, key, titulo}) · lista() → {lista:[{id, titulo, estado, texto, creado, fin}]} · borrar({id}) · revisar()
 * La clave se guarda solo en este celular (datos privados de la app) y se borra cuando la tarea termina.
 */
@CapacitorPlugin(name = "Tareas")
public class TareasPlugin extends Plugin {
    static final String PREFS = "jarvis_tareas", CANAL = "jarvis_tareas", REVISION = "2026-05-20";
    static final int JOB = 7301, AVISO = 7302;

    @PluginMethod
    public void vigilar(PluginCall call) {
        String id = call.getString("id", ""), key = call.getString("key", "");
        if (id.isEmpty() || key.isEmpty()) { call.reject("Falta la tarea."); return; }
        try {
            JSONArray l = leer(getContext());
            JSONObject t = new JSONObject();
            t.put("id", id); t.put("key", key); t.put("titulo", call.getString("titulo", "Investigación"));
            t.put("estado", "in_progress"); t.put("creado", System.currentTimeMillis());
            l.put(t);
            guardar(getContext(), l);
            programar(getContext(), 30_000);
            avisoEnCurso(getContext(), l);
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    @PluginMethod
    public void lista(PluginCall call) {
        JSArray out = new JSArray();
        JSONArray l = leer(getContext());
        for (int i = 0; i < l.length(); i++) {
            JSONObject t = l.optJSONObject(i); if (t == null) continue;
            JSObject o = new JSObject();
            o.put("id", t.optString("id")); o.put("titulo", t.optString("titulo")); o.put("estado", t.optString("estado"));
            o.put("texto", t.optString("texto")); o.put("creado", t.optLong("creado")); o.put("fin", t.optLong("fin"));
            out.put(o);
        }
        JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        String id = call.getString("id", "");
        JSONArray l = leer(getContext()), n = new JSONArray();
        for (int i = 0; i < l.length(); i++) { JSONObject t = l.optJSONObject(i); if (t != null && !t.optString("id").equals(id)) n.put(t); }
        guardar(getContext(), n);
        avisoEnCurso(getContext(), n);
        call.resolve();
    }

    /** Revisa ya (al abrir Jarvis), sin esperar al minuto. */
    @PluginMethod
    public void revisar(PluginCall call) {
        final Context c = getContext();
        new Thread(() -> { revisarTodas(c); call.resolve(); }, "jarvis-tareas").start();
    }

    /** ¿Están permitidos los avisos en vivo? (Android 16+) */
    @PluginMethod
    public void avisos(PluginCall call) {
        JSObject r = new JSObject(); r.put("permitidos", EnVivo.permitidos(getContext())); r.put("soporta", Build.VERSION.SDK_INT >= 36); call.resolve(r);
    }
    /** Abre el ajuste de los avisos en vivo de Jarvis (o el de sus notificaciones). */
    @PluginMethod
    public void ajustesAvisos(PluginCall call) {
        Context c = getContext();
        Intent[] l = {
            new Intent("android.settings.MANAGE_APP_PROMOTED_NOTIFICATIONS").putExtra("android.provider.extra.APP_PACKAGE", c.getPackageName()),
            new Intent("android.settings.APP_NOTIFICATION_SETTINGS").putExtra("android.provider.extra.APP_PACKAGE", c.getPackageName()),
        };
        for (Intent i : l) { try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); c.startActivity(i); call.resolve(); return; } catch (Exception ignored) { } }
        call.reject("No pude abrir el ajuste.");
    }

    // ======================================================================== lo que corre aunque Jarvis esté cerrado
    static JSONArray leer(Context c) {
        try { return new JSONArray(c.getSharedPreferences(PREFS, 0).getString("lista", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    static void guardar(Context c, JSONArray l) { c.getSharedPreferences(PREFS, 0).edit().putString("lista", l.toString()).apply(); }

    static void programar(Context c, long ms) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        JobInfo.Builder b = new JobInfo.Builder(JOB, new ComponentName(c, Revision.class))
            .setMinimumLatency(ms).setOverrideDeadline(ms + 5 * 60_000)
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY);
        try { js.schedule(b.build()); } catch (Exception ignored) { }
    }

    /** Pregunta por cada tarea en curso. → true si queda alguna en curso. */
    static synchronized boolean revisarTodas(Context c) {
        JSONArray l = leer(c);
        boolean quedan = false, cambio = false;
        for (int i = 0; i < l.length(); i++) {
            JSONObject t = l.optJSONObject(i);
            if (t == null || !"in_progress".equals(t.optString("estado"))) continue;
            // 4 horas sin terminar: se da por perdida
            if (System.currentTimeMillis() - t.optLong("creado") > 4 * 3600_000L) {
                try { t.put("estado", "failed"); t.put("texto", "La tarea tardó demasiado y se canceló."); t.remove("key"); } catch (Exception ignored) { }
                cambio = true; continue;
            }
            try {
                JSONObject j = get(t.optString("id"), t.optString("key"));
                String st = j.optString("status", "in_progress");
                if ("completed".equals(st) || "failed".equals(st) || "cancelled".equals(st)) {
                    t.put("estado", st);
                    t.put("texto", "completed".equals(st) ? texto(j) : "La tarea no se pudo terminar (" + st + ").");
                    t.put("fin", System.currentTimeMillis());
                    t.remove("key");
                    cambio = true;
                    avisoListo(c, t);
                } else quedan = true;
            } catch (Exception e) { quedan = true; }
        }
        if (cambio) guardar(c, l);
        avisoEnCurso(c, l);
        return quedan;
    }

    static JSONObject get(String id, String key) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL("https://generativelanguage.googleapis.com/v1beta/interactions/" + id).openConnection();
        con.setConnectTimeout(15000); con.setReadTimeout(30000);
        con.setRequestProperty("x-goog-api-key", key);
        con.setRequestProperty("Api-Revision", REVISION);
        int code = con.getResponseCode();
        InputStream in = code >= 400 ? con.getErrorStream() : con.getInputStream();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] b = new byte[8192]; int r;
        if (in != null) while ((r = in.read(b)) > 0) out.write(b, 0, r);
        con.disconnect();
        if (code == 404) { JSONObject j = new JSONObject(); j.put("status", "failed"); return j; }
        if (code >= 400) throw new Exception("HTTP " + code);
        return new JSONObject(out.toString("UTF-8"));
    }

    /** El texto final de una interacción (output_text, o los textos de outputs). */
    static String texto(JSONObject j) {
        String s = j.optString("output_text", "");
        if (!s.isEmpty()) return s;
        StringBuilder sb = new StringBuilder();
        JSONArray o = j.optJSONArray("outputs");
        if (o != null) for (int i = 0; i < o.length(); i++) {
            JSONObject x = o.optJSONObject(i); if (x == null) continue;
            if (!"thought".equals(x.optString("type")) && x.has("text")) sb.append(x.optString("text")).append("\n");
            JSONArray parts = x.optJSONArray("content");
            if (parts != null) for (int k = 0; k < parts.length(); k++) { JSONObject p = parts.optJSONObject(k); if (p != null && p.has("text")) sb.append(p.optString("text")).append("\n"); }
        }
        return sb.toString().trim();
    }

    private static NotificationManager nm(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel(CANAL, "Tareas largas de Jarvis", NotificationManager.IMPORTANCE_DEFAULT));
        return nm;
    }
    private static PendingIntent abrir(Context c, String atajo, int rq) {
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (atajo != null) i.putExtra("atajo", atajo);
        return PendingIntent.getActivity(c, rq, i, fl);
    }

    /** Aviso en vivo mientras haya tareas en curso. */
    static void avisoEnCurso(Context c, JSONArray l) {
        NotificationManager nm = nm(c); if (nm == null) return;
        int n = 0; String titulo = "";
        for (int i = 0; i < l.length(); i++) { JSONObject t = l.optJSONObject(i); if (t != null && "in_progress".equals(t.optString("estado"))) { n++; titulo = t.optString("titulo"); } }
        if (n == 0) { nm.cancel(AVISO); return; }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(n == 1 ? "🔎 Jarvis está investigando" : "🔎 Jarvis tiene " + n + " tareas en curso")
            .setContentText(n == 1 ? titulo : "Te aviso cuando terminen")
            .setOngoing(true).setOnlyAlertOnce(true)
            .setContentIntent(abrir(c, "tareas", 7310));
        EnVivo.progreso(b, -1, EnVivo.AZUL);
        EnVivo.promover(b, "IA", EnVivo.AZUL);
        try { nm.notify(AVISO, b.build()); } catch (Exception ignored) { }
    }

    static void avisoListo(Context c, JSONObject t) {
        NotificationManager nm = nm(c); if (nm == null) return;
        boolean ok = "completed".equals(t.optString("estado"));
        String txt = t.optString("texto");
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, CANAL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(ok ? "✅ Lista: " + t.optString("titulo") : "⚠️ No se pudo: " + t.optString("titulo"))
            .setContentText(txt.length() > 120 ? txt.substring(0, 120) + "…" : txt)
            .setStyle(new Notification.BigTextStyle().bigText(txt.length() > 600 ? txt.substring(0, 600) + "…" : txt))
            .setColor(ok ? EnVivo.VERDE : EnVivo.ROJO)
            .setAutoCancel(true)
            .setContentIntent(abrir(c, "tarea:" + t.optString("id"), 7320 + (t.optString("id").hashCode() & 0xff)));
        try { nm.notify(7400 + (t.optString("id").hashCode() & 0xff), b.build()); } catch (Exception ignored) { }
    }

    /** El trabajo que revisa cada minuto (también con Jarvis cerrado). */
    public static class Revision extends JobService {
        @Override public boolean onStartJob(JobParameters p) {
            final Context c = getApplicationContext();
            new Thread(() -> {
                boolean quedan = revisarTodas(c);
                if (quedan) programar(c, 60_000);
                jobFinished(p, false);
            }, "jarvis-tareas-job").start();
            return true;
        }
        @Override public boolean onStopJob(JobParameters p) { return true; }
    }
}
