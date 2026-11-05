package co.jarvis.docente;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Jarvis 3.18: quién tiene el micrófono por largo rato (grabar una reunión, subtítulos en vivo). Mientras tanto la escucha de «Jarvis» espera. */
public final class Microfono {
    private Microfono() {}
    static volatile String ocupadoPor = "";
    static boolean ocupado() { return ocupadoPor != null && !ocupadoPor.isEmpty(); }
    static void tomar(String quien) { ocupadoPor = quien; }
    /** Suelta el micrófono y, si «Jarvis en segundo plano» estaba activo, lo vuelve a poner a escuchar. */
    static void soltar(Context c, String quien) {
        if (!quien.equals(ocupadoPor)) return;
        ocupadoPor = "";
        if (EscuchaService.activo && !Apagado.es(c)) {
            try { Intent i = new Intent(c, EscuchaService.class).setAction(EscuchaService.ACCION_REANUDAR); if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i); } catch (Exception ignored) { }
        }
    }
}
