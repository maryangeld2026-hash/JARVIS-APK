package co.jarvis.docente;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

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
import java.util.ArrayList;
import java.util.List;

/**
 * Jarvis 3.4: lo del teléfono que no es voz.
 *   minimizar() / salir()      textZoom({p})      abrir({url}) (WhatsApp, enlaces)
 *   pendientes() → lo que llegó de afuera: el botón de asistente, un atajo, el widget o algo compartido hacia Jarvis (evento «entrada»)
 *   temporizador({fin, texto}) / quitarTemporizador() → cuenta regresiva en la notificación y en la pantalla bloqueada
 *   widget({titulo, sub}) → lo que muestra el widget de la pantalla de inicio
 *   silencioPermiso() / silencioPedir() / silencio({bloques:[{ini, fin}]}) → «No molestar» solo en horario de clase
 *   verificar({titulo}) → huella, rostro o PIN del celular
 */
@CapacitorPlugin(name = "Ventana")
public class VentanaPlugin extends Plugin {
    static final String CANAL_TIEMPO = "jarvis_tiempo";
    static final int ID_TIEMPO = 81;
    private static final List<JSObject> cola = new ArrayList<>();
    private static VentanaPlugin instancia;

    @Override
    public void load() { instancia = this; }

    // ======================================================================== lo que llega de afuera
    /** MainActivity la llama con cada Intent: atajos, widget, botón de asistente y «Compartir › Jarvis». */
    static void recibir(Context c, Intent i) {
        if (i == null) return;
        String a = i.getAction(), atajo = i.getStringExtra("atajo");
        JSObject e = null;
        if (atajo != null) { e = new JSObject(); e.put("tipo", "atajo"); e.put("atajo", atajo); i.removeExtra("atajo"); }
        else if (Intent.ACTION_ASSIST.equals(a) || "android.intent.action.VOICE_COMMAND".equals(a) || "android.intent.action.SEARCH_LONG_PRESS".equals(a)) {
            e = new JSObject(); e.put("tipo", "atajo"); e.put("atajo", "hablar");
        } else if (Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a)) {
            e = compartido(c, i);
        }
        if (e == null) return;
        if (Intent.ACTION_SEND.equals(a) || Intent.ACTION_SEND_MULTIPLE.equals(a) || Intent.ACTION_ASSIST.equals(a)) i.setAction(Intent.ACTION_MAIN);
        synchronized (cola) { cola.add(e); }
        if (instancia != null) instancia.notifyListeners("entrada", new JSObject());
    }

    private static JSObject compartido(Context c, Intent i) {
        JSObject e = new JSObject();
        e.put("tipo", "compartir");
        String texto = i.getStringExtra(Intent.EXTRA_TEXT), asunto = i.getStringExtra(Intent.EXTRA_SUBJECT);
        if (texto != null) e.put("texto", (asunto != null ? asunto + "\n" : "") + texto);
        Uri u = null;
        try {
            if (Intent.ACTION_SEND_MULTIPLE.equals(i.getAction())) {
                ArrayList<Uri> l = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (l != null && !l.isEmpty()) u = l.get(0);
            } else u = i.getParcelableExtra(Intent.EXTRA_STREAM);
        } catch (Exception ignored) { }
        if (u != null) {
            try {
                String nombre = "archivo", mime = c.getContentResolver().getType(u);
                try (Cursor k = c.getContentResolver().query(u, new String[] { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE }, null, null, null)) {
                    if (k != null && k.moveToFirst()) {
                        nombre = k.getString(0);
                        long tam = k.isNull(1) ? 0 : k.getLong(1);
                        if (tam > 20L * 1024 * 1024) { e.put("error", "El archivo es muy grande (más de 20 MB)."); return e; }
                    }
                }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                try (InputStream in = c.getContentResolver().openInputStream(u)) {
                    byte[] b = new byte[1 << 16]; int n; long total = 0;
                    while ((n = in.read(b)) > 0) { out.write(b, 0, n); total += n; if (total > 20L * 1024 * 1024) { e.put("error", "El archivo es muy grande (más de 20 MB)."); return e; } }
                }
                e.put("nombre", nombre);
                e.put("mime", mime == null ? "application/octet-stream" : mime);
                e.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            } catch (Exception ex) { e.put("error", "No pude abrir lo que compartiste: " + ex.getMessage()); }
        }
        return e;
    }

    @PluginMethod
    public void pendientes(PluginCall call) {
        JSArray l = new JSArray();
        synchronized (cola) { for (JSObject e : cola) l.put(e); cola.clear(); }
        JSObject r = new JSObject(); r.put("lista", l);
        call.resolve(r);
    }

    // ======================================================================== ventana
    @PluginMethod
    public void minimizar(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }

    @PluginMethod
    public void salir(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().finishAndRemoveTask());
    }

    @PluginMethod
    public void textZoom(PluginCall call) {
        final int p = Math.max(80, Math.min(160, call.getInt("p", 100)));
        getActivity().runOnUiThread(() -> { try { getBridge().getWebView().getSettings().setTextZoom(p); } catch (Exception ignored) { } call.resolve(); });
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        String url = call.getString("url", "");
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject("No encontré una app para abrir eso."); }
    }

    /** Abre una pantalla de Ajustes del celular (p. ej. la del asistente: android.settings.VOICE_INPUT_SETTINGS). */
    @PluginMethod
    public void ajustesSistema(PluginCall call) {
        String accion = call.getString("accion", Settings.ACTION_SETTINGS);
        try { getContext().startActivity(new Intent(accion).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); call.resolve(); }
        catch (Exception e) {
            try { getContext().startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); call.resolve(); }
            catch (Exception e2) { call.reject("No pude abrir los Ajustes del celular."); }
        }
    }

    // ======================================================================== temporizador en la notificación
    @PluginMethod
    public void temporizador(PluginCall call) {
        long fin = (long) (double) call.getDouble("fin", 0d);
        String texto = call.getString("texto", "Temporizador");
        Context c = getContext();
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || fin <= System.currentTimeMillis()) { call.resolve(); return; }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CANAL_TIEMPO, "Temporizador", NotificationManager.IMPORTANCE_LOW);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent abrir = PendingIntent.getActivity(c, 30, new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), fl);
        PendingIntent parar = PendingIntent.getActivity(c, 31, new Intent(c, MainActivity.class).putExtra("atajo", "parar_tiempo").addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), fl);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(c, CANAL_TIEMPO) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle("⏱ " + texto)
            .setContentText("Jarvis te avisa al terminar")
            .setWhen(fin)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(abrir)
            .addAction(new Notification.Action.Builder(null, "Parar", parar).build());
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) b.setChronometerCountDown(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) b.setTimeoutAfter(Math.max(1000, fin - System.currentTimeMillis() + 1500));
        try { nm.notify(ID_TIEMPO, b.build()); } catch (Exception ignored) { }
        call.resolve();
    }

    @PluginMethod
    public void quitarTemporizador(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(ID_TIEMPO);
        call.resolve();
    }

    // ======================================================================== widget
    @PluginMethod
    public void widget(PluginCall call) {
        Context c = getContext();
        c.getSharedPreferences("jarvis_widget", Context.MODE_PRIVATE).edit()
            .putString("titulo", call.getString("titulo", "Jarvis"))
            .putString("sub", call.getString("sub", "Toca para hablarme"))
            .apply();
        JarvisWidget.actualizarTodos(c);
        call.resolve();
    }

    // ======================================================================== «No molestar» en clase
    @PluginMethod
    public void silencioPermiso(PluginCall call) {
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        JSObject r = new JSObject();
        r.put("permitido", Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && nm != null && nm.isNotificationPolicyAccessGranted());
        call.resolve(r);
    }

    @PluginMethod
    public void silencioPedir(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception ignored) { }
        call.resolve();
    }

    /** bloques: [{ini, fin}] en milisegundos (las clases de los próximos días). Vacío = apagar. */
    @PluginMethod
    public void silencio(PluginCall call) {
        try {
            JSONArray b = call.getArray("bloques", new JSArray());
            SharedPreferences sp = getContext().getSharedPreferences("jarvis_silencio", Context.MODE_PRIVATE);
            sp.edit().putString("bloques", b.toString()).apply();
            SilencioReceiver.programar(getContext());
            call.resolve();
        } catch (Exception e) { call.reject(e.getMessage()); }
    }

    // ======================================================================== huella o PIN
    @PluginMethod
    public void verificar(PluginCall call) {
        final String titulo = call.getString("titulo", "Abrir Jarvis");
        final FragmentActivity act = getActivity();
        act.runOnUiThread(() -> {
            int tipos = BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
            int puede = BiometricManager.from(act).canAuthenticate(tipos);
            if (puede != BiometricManager.BIOMETRIC_SUCCESS) {
                JSObject r = new JSObject(); r.put("ok", true); r.put("sinBloqueo", true);   // el celular no tiene huella ni PIN: no se puede pedir
                call.resolve(r); return;
            }
            BiometricPrompt bp = new BiometricPrompt(act, ContextCompat.getMainExecutor(act), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult res) { JSObject r = new JSObject(); r.put("ok", true); call.resolve(r); }
                @Override public void onAuthenticationError(int code, CharSequence msg) { JSObject r = new JSObject(); r.put("ok", false); r.put("error", String.valueOf(msg)); call.resolve(r); }
            });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle(titulo)
                .setSubtitle("Tus datos de estudiantes están protegidos")
                .setAllowedAuthenticators(tipos)
                .build();
            try { bp.authenticate(info); } catch (Exception e) { JSObject r = new JSObject(); r.put("ok", true); r.put("sinBloqueo", true); call.resolve(r); }
        });
    }
}
