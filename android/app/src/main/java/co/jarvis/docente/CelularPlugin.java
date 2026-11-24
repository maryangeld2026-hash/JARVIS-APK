package co.jarvis.docente;

import android.app.AlarmManager;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.provider.ContactsContract;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.30 · cuidar el celular (como la «Asistencia del dispositivo» de Gemini):
 *   espacio() → {total, libre, jarvis:[{que, carpeta, bytes}], cache} · borrarCache() · liberar() (abre «Liberar espacio» de Android)
 *   permisos({p}) → {lista:[{nombre, paquete, fondo}]}: qué apps tienen ese permiso (Jarvis no los cambia: abre el ajuste de la app)
 *   abrirApp({paquete}) · abrirAjuste({accion})
 *   silencio({quien: favoritos|contactos|nadie, min, repetidas}) → No molestar dejando pasar solo esas llamadas · favoritos() → {n}
 */
@CapacitorPlugin(name = "Celular")
public class CelularPlugin extends Plugin {
    private final ExecutorService hilo = Executors.newSingleThreadExecutor();

    private static long tam(File f) {
        if (f == null || !f.exists()) return 0;
        if (f.isFile()) return f.length();
        long s = 0; File[] fs = f.listFiles(); if (fs != null) for (File x : fs) s += tam(x);
        return s;
    }

    @PluginMethod
    public void espacio(PluginCall call) {
        hilo.execute(() -> {
            JSObject r = new JSObject();
            try {
                StatFs st = new StatFs(Environment.getDataDirectory().getPath());
                r.put("total", st.getTotalBytes()); r.put("libre", st.getAvailableBytes());
                JSArray j = new JSArray();
                String[][] cs = { { "ia-local", "IA del celular (modelos)" }, { "whisper", "Dictado sin internet" }, { "supertonic", "Voz neural" }, { "buscador", "Búsqueda por significado" }, { "fotos", "Memoria de tus fotos" } };
                File base = getContext().getFilesDir();
                for (String[] c : cs) { long b = tam(new File(base, c[0])); if (b > 0) { JSObject o = new JSObject(); o.put("carpeta", c[0]); o.put("que", c[1]); o.put("bytes", b); j.put(o); } }
                r.put("jarvis", j);
                r.put("cache", tam(getContext().getCacheDir()));
                call.resolve(r);
            } catch (Exception e) { call.reject("No pude ver el espacio: " + e.getMessage()); }
        });
    }

    @PluginMethod
    public void borrarCache(PluginCall call) {
        hilo.execute(() -> {
            long antes = tam(getContext().getCacheDir());
            borrarDentro(getContext().getCacheDir());
            JSObject r = new JSObject(); r.put("liberado", antes - tam(getContext().getCacheDir())); call.resolve(r);
        });
    }
    private static void borrarDentro(File d) { File[] fs = d.listFiles(); if (fs != null) for (File f : fs) { if (f.isDirectory()) borrarDentro(f); f.delete(); } }

    @PluginMethod
    public void liberar(PluginCall call) {
        Intent i = new Intent(Build.VERSION.SDK_INT >= 25 ? android.os.storage.StorageManager.ACTION_MANAGE_STORAGE : Settings.ACTION_INTERNAL_STORAGE_SETTINGS);
        if (!abrir(i)) abrir(new Intent(Settings.ACTION_INTERNAL_STORAGE_SETTINGS));
        call.resolve();
    }

    private boolean abrir(Intent i) {
        try { i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(i); return true; } catch (Exception e) { return false; }
    }

    @PluginMethod
    public void abrirApp(PluginCall call) {
        String p = call.getString("paquete", "");
        abrir(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", p, null)));
        call.resolve();
    }

    @PluginMethod
    public void abrirAjuste(PluginCall call) {
        String a = call.getString("accion", Settings.ACTION_SETTINGS);
        if (a == null || !a.startsWith("android.")) a = Settings.ACTION_SETTINGS;      // solo ajustes de Android
        if (!abrir(new Intent(a))) abrir(new Intent(Settings.ACTION_SETTINGS));
        call.resolve();
    }

    @PluginMethod
    public void permisos(PluginCall call) {
        final String p = call.getString("p", "ubicacion");
        hilo.execute(() -> {
            String[] busca; String fondo = null;
            switch (p) {
                case "microfono": busca = new String[] { "android.permission.RECORD_AUDIO" }; break;
                case "camara": busca = new String[] { "android.permission.CAMERA" }; break;
                case "contactos": busca = new String[] { "android.permission.READ_CONTACTS" }; break;
                case "fotos": busca = new String[] { "android.permission.READ_MEDIA_IMAGES", "android.permission.READ_EXTERNAL_STORAGE" }; break;
                case "sms": busca = new String[] { "android.permission.READ_SMS" }; break;
                default: busca = new String[] { "android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION" }; fondo = "android.permission.ACCESS_BACKGROUND_LOCATION";
            }
            PackageManager pm = getContext().getPackageManager();
            Intent lanz = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
            Set<String> vistos = new HashSet<>();
            List<JSObject> out = new ArrayList<>();
            for (ResolveInfo ri : pm.queryIntentActivities(lanz, 0)) {
                String pkg = ri.activityInfo.packageName;
                if (!vistos.add(pkg) || pkg.equals(getContext().getPackageName())) continue;
                try {
                    PackageInfo pi = pm.getPackageInfo(pkg, PackageManager.GET_PERMISSIONS);
                    if (pi.requestedPermissions == null) continue;
                    boolean tiene = false, siempre = false;
                    for (int k = 0; k < pi.requestedPermissions.length; k++) {
                        boolean dado = pi.requestedPermissionsFlags != null && (pi.requestedPermissionsFlags[k] & PackageInfo.REQUESTED_PERMISSION_GRANTED) != 0;
                        if (!dado) continue;
                        for (String b : busca) if (b.equals(pi.requestedPermissions[k])) tiene = true;
                        if (fondo != null && fondo.equals(pi.requestedPermissions[k])) siempre = true;
                    }
                    if (!tiene) continue;
                    JSObject o = new JSObject();
                    o.put("nombre", String.valueOf(ri.loadLabel(pm))); o.put("paquete", pkg); o.put("fondo", siempre);
                    o.put("sistema", (pi.applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0);
                    out.add(o);
                } catch (Exception ignored) { }
            }
            out.sort((a, b) -> a.getString("nombre", "").compareToIgnoreCase(b.getString("nombre", "")));
            JSArray l = new JSArray(); for (JSObject o : out) l.put(o);
            JSObject r = new JSObject(); r.put("lista", l); call.resolve(r);
        });
    }

    @PluginMethod
    public void favoritos(PluginCall call) {
        int n = -1;
        try (Cursor c = getContext().getContentResolver().query(ContactsContract.Contacts.CONTENT_URI, new String[] { ContactsContract.Contacts._ID }, ContactsContract.Contacts.STARRED + "=1", null, null)) {
            if (c != null) n = c.getCount();
        } catch (Exception ignored) { }
        JSObject r = new JSObject(); r.put("n", n); call.resolve(r);
    }

    /** No molestar con excepciones: solo suenan las llamadas de tus favoritos (o de tus contactos); las alarmas siempre. */
    @PluginMethod
    public void silencio(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || Build.VERSION.SDK_INT < 24) { call.reject("Este celular no deja hacerlo."); return; }
        if (!nm.isNotificationPolicyAccessGranted()) {
            abrir(new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS));
            JSObject r = new JSObject(); r.put("permiso", false); call.resolve(r); return;
        }
        String quien = call.getString("quien", "favoritos");
        int min = call.getInt("min", 0);
        boolean repetidas = Boolean.TRUE.equals(call.getBoolean("repetidas", false));
        try {
            SharedPreferences sp = getContext().getSharedPreferences("jarvis_celular", 0);
            NotificationManager.Policy antes = nm.getNotificationPolicy();
            if (!sp.getBoolean("activo", false)) {
                sp.edit().putBoolean("activo", true).putInt("filtro", nm.getCurrentInterruptionFilter())
                    .putInt("cat", antes.priorityCategories).putInt("llam", antes.priorityCallSenders).putInt("msj", antes.priorityMessageSenders).apply();
            }
            int cat = NotificationManager.Policy.PRIORITY_CATEGORY_ALARMS;
            int senders = NotificationManager.Policy.PRIORITY_SENDERS_STARRED;
            if (!"nadie".equals(quien)) { cat |= NotificationManager.Policy.PRIORITY_CATEGORY_CALLS; senders = "contactos".equals(quien) ? NotificationManager.Policy.PRIORITY_SENDERS_CONTACTS : NotificationManager.Policy.PRIORITY_SENDERS_STARRED; }
            if (repetidas) cat |= NotificationManager.Policy.PRIORITY_CATEGORY_REPEAT_CALLERS;
            nm.setNotificationPolicy(new NotificationManager.Policy(cat, senders, senders));
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = PendingIntent.getBroadcast(getContext(), 7301, new Intent(getContext(), Fin.class).setAction(Fin.ACCION), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            if (am != null) { am.cancel(pi); if (min > 0) am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + min * 60_000L, pi); }
            JSObject r = new JSObject(); r.put("permiso", true); r.put("ok", true); call.resolve(r);
        } catch (Exception e) { call.reject("No pude ponerlo: " + e.getMessage()); }
    }

    @PluginMethod
    public void quitarSilencio(PluginCall call) { Fin.restaurar(getContext()); call.resolve(); }

    /** Al terminar el tiempo (o si lo pides): vuelve como estaba. */
    public static class Fin extends BroadcastReceiver {
        static final String ACCION = "co.jarvis.docente.SILENCIO_FIN";
        @Override public void onReceive(Context c, Intent i) { if (ACCION.equals(i.getAction())) restaurar(c); }
        static void restaurar(Context c) {
            SharedPreferences sp = c.getSharedPreferences("jarvis_celular", 0);
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null || !sp.getBoolean("activo", false)) return;
            try {
                if (Build.VERSION.SDK_INT >= 24 && nm.isNotificationPolicyAccessGranted()) {
                    nm.setNotificationPolicy(new NotificationManager.Policy(sp.getInt("cat", 0), sp.getInt("llam", 0), sp.getInt("msj", 0)));
                    nm.setInterruptionFilter(sp.getInt("filtro", NotificationManager.INTERRUPTION_FILTER_ALL));
                }
            } catch (Exception ignored) { }
            sp.edit().putBoolean("activo", false).apply();
        }
    }
}
