package co.jarvis.docente;

import android.content.Context;
import android.content.Intent;

/**
 * Jarvis 3.16: «Apagar Jarvis» de verdad. Se detienen la escucha de «Jarvis», la burbuja, la IA del celular y todo lo que
 * Jarvis hace por su cuenta (leer mensajes, respuestas automáticas, disparadores, fotos), y el proceso se cierra.
 * Siguen sonando tus recordatorios y alarmas, y «encontrar el celular» por SMS. Al abrir Jarvis otra vez, todo vuelve.
 */
public final class Apagado {
    private Apagado() {}
    private static final String PREFS = "jarvis_apagado";

    static boolean es(Context c) {
        try { return c.getSharedPreferences(PREFS, 0).getBoolean("si", false); } catch (Exception e) { return false; }
    }

    static void marcar(Context c, boolean si) {
        try { c.getSharedPreferences(PREFS, 0).edit().putBoolean("si", si).commit(); } catch (Exception ignored) { }
    }

    /** Detiene todo lo que corre en segundo plano (no cierra la pantalla: eso lo hace VentanaPlugin). */
    static void detenerTodo(Context c) {
        marcar(c, true);
        try { c.stopService(new Intent(c, EscuchaService.class)); } catch (Exception ignored) { }
        try { c.stopService(new Intent(c, BurbujaService.class)); } catch (Exception ignored) { }
        try { c.stopService(new Intent(c, SubtitulosService.class)); } catch (Exception ignored) { }
        try { c.stopService(new Intent(c, GrabadoraService.class)); } catch (Exception ignored) { }   // la grabación queda guardada para resumirla
        try { android.app.job.JobScheduler js = (android.app.job.JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE); if (js != null) js.cancel(FotosJob.ID); } catch (Exception ignored) { }
        try { android.app.NotificationManager nm = (android.app.NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE); if (nm != null) nm.cancel(72); } catch (Exception ignored) { }
    }
}
