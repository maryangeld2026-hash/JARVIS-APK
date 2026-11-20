package co.jarvis.docente;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

/**
 * Jarvis 3.28 · «Avisos en vivo» (Live Updates de Android 16+): el temporizador, la grabación, las descargas y las
 * investigaciones en segundo plano aparecen arriba en la barra de estado (como un chip) y en la pantalla bloqueada.
 * Colores con sentido: verde = va bien, naranja = cuidado, rojo = urgente, azul = informativo.
 * Todo por reflexión: en Android viejos no hace nada y la notificación sigue siendo la normal.
 */
final class EnVivo {
    static final int VERDE = 0xFF22C55E, NARANJA = 0xFFF59E0B, ROJO = 0xFFEF4444, AZUL = 0xFF3B82F6;

    private EnVivo() { }

    /** Pide que la notificación (en curso, con título, sin colorear) suba como aviso en vivo. chip: texto corto (≤ 7 letras). */
    static void promover(Notification.Builder b, String chip, int color) {
        try { b.setColor(color); } catch (Throwable ignored) { }
        if (Build.VERSION.SDK_INT < 36) return;
        try { Notification.Builder.class.getMethod("setRequestPromotedOngoing", boolean.class).invoke(b, true); } catch (Throwable ignored) { }
        if (chip != null && !chip.isEmpty()) {
            try { Notification.Builder.class.getMethod("setShortCriticalText", String.class).invoke(b, chip); } catch (Throwable ignored) { }
        }
    }

    /** Barra de progreso (ProgressStyle en Android 16+, la clásica antes). p: 0–100, o -1 si no se sabe. */
    static void progreso(Notification.Builder b, int p, int color) {
        if (Build.VERSION.SDK_INT >= 36) {
            try {
                Class<?> ps = Class.forName("android.app.Notification$ProgressStyle");
                Object st = ps.getConstructor().newInstance();
                if (p < 0) ps.getMethod("setProgressIndeterminate", boolean.class).invoke(st, true);
                else {
                    Class<?> seg = Class.forName("android.app.Notification$ProgressStyle$Segment");
                    Object s = seg.getConstructor(int.class).newInstance(100);
                    seg.getMethod("setColor", int.class).invoke(s, color);
                    ps.getMethod("setProgressSegments", java.util.List.class).invoke(st, java.util.Collections.singletonList(s));
                    ps.getMethod("setProgress", int.class).invoke(st, Math.max(0, Math.min(100, p)));
                }
                b.setStyle((Notification.Style) st);
                return;
            } catch (Throwable ignored) { }
        }
        b.setProgress(100, Math.max(0, p), p < 0);
    }

    /** ¿El usuario permite los avisos en vivo de Jarvis? (Android 16+; antes, siempre «sí»). */
    static boolean permitidos(Context c) {
        if (Build.VERSION.SDK_INT < 36) return true;
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            return (boolean) NotificationManager.class.getMethod("canPostPromotedNotifications").invoke(nm);
        } catch (Throwable e) { return true; }
    }
}
