package co.jarvis.docente;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;

/**
 * Jarvis 3.6: el control del celular por voz («ve al inicio», «atrás», «abre las notificaciones», «bloquea el celular»,
 * «toma una captura»). Solo hace esos botones del sistema: no lee la pantalla ni lo que escribes.
 * Se activa en Ajustes del celular › Accesibilidad › Jarvis.
 */
public class ControlServicio extends AccessibilityService {
    static volatile ControlServicio instancia;

    @Override protected void onServiceConnected() { super.onServiceConnected(); instancia = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() { instancia = null; super.onDestroy(); }
    @Override public boolean onUnbind(android.content.Intent i) { instancia = null; return super.onUnbind(i); }

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
