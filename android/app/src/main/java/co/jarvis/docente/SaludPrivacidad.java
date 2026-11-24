package co.jarvis.docente;

import android.app.Activity;
import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;

/** Jarvis 3.31 · lo que Android muestra cuando preguntas para qué usa Jarvis tus datos de salud (lo exige Health Connect). */
public class SaludPrivacidad extends Activity {
    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        TextView t = new TextView(this);
        int p = (int) (20 * getResources().getDisplayMetrics().density);
        t.setPadding(p, p, p, p);
        t.setTextSize(16);
        t.setText("Jarvis y tus datos de salud\n\n" +
            "Jarvis solo LEE tus pasos, tu sueño y tu pulso de Health Connect cuando tú se lo preguntas («¿cómo dormí esta semana?») " +
            "o, si lo activas, para contarte en «Mi día» cómo dormiste.\n\n" +
            "No escribe ni cambia nada, no guarda copias y no los envía a ningún lado. Solo si le haces una pregunta a la IA en la nube " +
            "sobre tu salud, se envía el resumen necesario para responderte.\n\n" +
            "Puedes quitar el permiso cuando quieras en Ajustes › Seguridad y privacidad › Health Connect.");
        ScrollView s = new ScrollView(this); s.addView(t);
        setContentView(s);
    }
}
