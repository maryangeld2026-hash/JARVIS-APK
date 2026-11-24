package co.jarvis.docente;

import android.app.AppOpsManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Jarvis 3.35 · tiempo de pantalla. Lee cuánto se usó cada app (UsageStatsManager) y avisa cuando una app pasa
 * del límite diario que la persona pidió. Necesita el permiso especial «Acceso al uso», que se da a mano en Ajustes:
 * Jarvis solo abre esa pantalla. Los datos no salen del celular.
 *   permiso() → {ok} · abrirPermiso() · apps() → [{nombre, pkg}] · uso({semana}) → [{nombre, pkg, min}]
 *   limites({lista:[{pkg, nombre, min}]}) → programa la revisión cada 15 min (o la quita si la lista está vacía)
 */
@CapacitorPlugin(name = "Uso")
public class UsoPlugin extends Plugin {
    static final int JOB = 7335;

    static boolean tienePermiso(Context c) {
        try {
            AppOpsManager ao = (AppOpsManager) c.getSystemService(Context.APP_OPS_SERVICE);
            int m = Build.VERSION.SDK_INT >= 29 ? ao.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName())
                : ao.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.getPackageName());
            return m == AppOpsManager.MODE_ALLOWED;
        } catch (Exception e) { return false; }
    }

    @PluginMethod
    public void permiso(PluginCall call) { JSObject r = new JSObject(); r.put("ok", tienePermiso(getContext())); call.resolve(r); }

    @PluginMethod
    public void abrirPermiso(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            if (Build.VERSION.SDK_INT >= 29) i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { getContext().startActivity(i); }
            catch (Exception e) { getContext().startActivity(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
            call.resolve();
        } catch (Exception e) { call.reject("No pude abrir los ajustes: " + e.getMessage()); }
    }

    /** Las apps que se pueden abrir (para encontrar «TikTok» por su nombre). */
    @PluginMethod
    public void apps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        JSArray out = new JSArray();
        try {
            Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            for (ResolveInfo ri : pm.queryIntentActivities(i, 0)) {
                JSObject o = new JSObject(); o.put("nombre", String.valueOf(ri.loadLabel(pm))); o.put("pkg", ri.activityInfo.packageName); out.put(o);
            }
        } catch (Exception ignored) { }
        JSObject r = new JSObject(); r.put("apps", out); call.resolve(r);
    }

    static long inicioDia() { Calendar c = Calendar.getInstance(); c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0); c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0); return c.getTimeInMillis(); }

    /** Minutos en primer plano por paquete desde «desde» hasta ahora. */
    static Map<String, Long> minutos(Context c, long desde) {
        Map<String, Long> m = new HashMap<>();
        UsageStatsManager um = (UsageStatsManager) c.getSystemService(Context.USAGE_STATS_SERVICE);
        if (um == null) return m;
        Map<String, UsageStats> st = um.queryAndAggregateUsageStats(desde, System.currentTimeMillis());
        if (st == null) return m;
        for (Map.Entry<String, UsageStats> e : st.entrySet()) {
            long ms = e.getValue().getTotalTimeInForeground();
            if (ms >= 60_000) m.put(e.getKey(), ms / 60_000);
        }
        return m;
    }

    static String nombre(PackageManager pm, String pkg) {
        try { ApplicationInfo ai = pm.getApplicationInfo(pkg, 0); return String.valueOf(pm.getApplicationLabel(ai)); } catch (Exception e) { return pkg; }
    }

    @PluginMethod
    public void uso(PluginCall call) {
        if (!tienePermiso(getContext())) { call.reject("SIN_PERMISO"); return; }
        boolean semana = Boolean.TRUE.equals(call.getBoolean("semana", false));
        long desde = inicioDia(); if (semana) desde -= 6 * 86_400_000L;
        Map<String, Long> m = minutos(getContext(), desde);
        PackageManager pm = getContext().getPackageManager();
        String yo = getContext().getPackageName();
        // solo apps con ícono en el lanzador (no el teclado, la pantalla de inicio ni servicios del sistema)
        java.util.HashSet<String> lanzables = new java.util.HashSet<>();
        try { for (ResolveInfo ri : pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)) lanzables.add(ri.activityInfo.packageName); } catch (Exception ignored) { }
        String casa = null;
        try { ResolveInfo h = pm.resolveActivity(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0); if (h != null) casa = h.activityInfo.packageName; } catch (Exception ignored) { }
        List<Map.Entry<String, Long>> l = new ArrayList<>(m.entrySet());
        Collections.sort(l, (a, b) -> Long.compare(b.getValue(), a.getValue()));
        JSArray out = new JSArray();
        for (Map.Entry<String, Long> e : l) {
            String pkg = e.getKey();
            if (pkg.equals(casa) || (!lanzables.isEmpty() && !lanzables.contains(pkg) && !pkg.equals(yo))) continue;
            JSObject o = new JSObject(); o.put("pkg", pkg); o.put("nombre", nombre(pm, pkg)); o.put("min", e.getValue()); out.put(o);
        }
        JSObject r = new JSObject(); r.put("lista", out); call.resolve(r);
    }

    @PluginMethod
    public void limites(PluginCall call) {
        JSArray l = call.getArray("lista", new JSArray());
        getContext().getSharedPreferences("jarvis_uso", 0).edit().putString("limites", l.toString()).apply();
        programar(getContext(), l.length() > 0);
        call.resolve();
    }

    static void programar(Context c, boolean on) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (js == null) return;
        if (!on) { js.cancel(JOB); return; }
        try { js.schedule(new JobInfo.Builder(JOB, new ComponentName(c, Revision.class)).setPeriodic(15 * 60_000L, 5 * 60_000L).setPersisted(true).build()); } catch (Exception ignored) { }
    }

    /** Revisa los límites: avisa una vez al día por app cuando se pasa. */
    static void revisar(Context c) {
        if (!tienePermiso(c)) return;
        SharedPreferences p = c.getSharedPreferences("jarvis_uso", 0);
        org.json.JSONArray l;
        try { l = new org.json.JSONArray(p.getString("limites", "[]")); } catch (Exception e) { return; }
        if (l.length() == 0) return;
        Map<String, Long> m = minutos(c, inicioDia());
        String hoy = String.valueOf(inicioDia());
        SharedPreferences.Editor ed = p.edit();
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i); if (o == null) continue;
            String pkg = o.optString("pkg"); int lim = o.optInt("min", 60);
            Long usado = m.get(pkg);
            if (usado == null || usado < lim) continue;
            String clave = "avisado_" + pkg;
            if (hoy.equals(p.getString(clave, ""))) continue;
            ed.putString(clave, hoy);
            notificar(c, i, "⏳ Ya llevas " + horas(usado) + " en " + o.optString("nombre", pkg) + " hoy (tu límite: " + horas(lim) + "). ¿Una pausa?");
        }
        ed.apply();
    }

    static String horas(long min) { long h = min / 60, m = min % 60; return h > 0 ? h + " h" + (m > 0 ? " " + m + " min" : "") : m + " min"; }

    static void notificar(Context c, int i, String txt) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(new NotificationChannel("jarvis_uso", "Límites de tiempo de pantalla", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent pi = PendingIntent.getActivity(c, JOB + i, new Intent(c, MainActivity.class).putExtra("atajo", "orden:¿cuánto usé el celular hoy?").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, "jarvis_uso") : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground).setContentTitle("Jarvis · tiempo de pantalla").setContentText(txt).setStyle(new Notification.BigTextStyle().bigText(txt)).setContentIntent(pi).setAutoCancel(true);
        try { nm.notify(JOB + 10 + i, b.build()); } catch (Exception ignored) { }
    }

    /** El trabajo que Android corre cada 15 minutos mientras haya límites. */
    public static class Revision extends JobService {
        @Override public boolean onStartJob(JobParameters jp) {
            if (Apagado.es(this)) return false;
            new Thread(() -> { try { revisar(this); } catch (Exception ignored) { } jobFinished(jp, false); }).start();
            return true;
        }
        @Override public boolean onStopJob(JobParameters jp) { return false; }
    }
}
