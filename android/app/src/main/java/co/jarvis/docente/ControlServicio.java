package co.jarvis.docente;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/**
 * Jarvis 3.6: el control del celular por voz («ve al inicio», «atrás», «abre las notificaciones», «bloquea el celular»,
 * «toma una captura»). 3.10: y, solo cuando tú lo pides (al llamar a Jarvis con la burbuja, el botón de asistente, el botón de
 * la cortina o «Jarvis»), copia el texto de la pantalla que estabas viendo para «¿qué dice esta pantalla?». Nunca lee
 * contraseñas, no vigila la pantalla en segundo plano y el texto se queda en el celular hasta que tú preguntes.
 * Se activa en Ajustes del celular › Accesibilidad › Jarvis.
 */
public class ControlServicio extends AccessibilityService {
    static volatile ControlServicio instancia;

    @Override protected void onServiceConnected() { super.onServiceConnected(); instancia = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() { instancia = null; super.onDestroy(); }
    @Override public boolean onUnbind(android.content.Intent i) { instancia = null; return super.onUnbind(i); }

    // ======================================================================== 3.10: «¿qué dice esta pantalla?»
    static volatile String capApp = "", capTexto = "";
    static volatile long capT = 0;
    /** Copia el texto de la ventana que se ve ahora (si no es Jarvis). Se llama solo justo antes de abrir Jarvis. */
    static void capturar() {
        ControlServicio s = instancia; if (s == null) return;
        try {
            AccessibilityNodeInfo r = s.getRootInActiveWindow(); if (r == null) return;
            CharSequence pkg = r.getPackageName();
            if (pkg == null || pkg.toString().equals(s.getPackageName())) return;
            StringBuilder b = new StringBuilder();
            recorrer(r, b, 0);
            if (b.length() < 3) return;
            capTexto = b.length() > 15000 ? b.substring(0, 15000) : b.toString();
            String app = pkg.toString();
            try { android.content.pm.PackageManager pm = s.getPackageManager(); app = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg.toString(), 0))); } catch (Exception ignored) { }
            capApp = app; capT = System.currentTimeMillis();
        } catch (Exception ignored) { }
    }
    private static void recorrer(AccessibilityNodeInfo n, StringBuilder b, int d) {
        if (n == null || d > 45 || b.length() > 15000) return;
        if (!n.isPassword()) {
            CharSequence t = n.getText(); if (t == null || t.length() == 0) t = n.getContentDescription();
            if (t != null) { String x = t.toString().trim(); if (!x.isEmpty() && b.indexOf(x) < 0) b.append(x).append('\n'); }
        }
        for (int i = 0; i < n.getChildCount(); i++) recorrer(n.getChild(i), b, d + 1);
    }

    boolean accion(String a) {
        switch (a) {
            case "inicio": return performGlobalAction(GLOBAL_ACTION_HOME);
            case "atras": return performGlobalAction(GLOBAL_ACTION_BACK);
            case "recientes": return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notificaciones": return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "ajustesRapidos": return performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            case "bloquear": return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
            case "captura": return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT);
            default: return false;
        }
    }
}
