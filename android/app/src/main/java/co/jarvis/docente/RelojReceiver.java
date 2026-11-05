package co.jarvis.docente;

import android.app.RemoteInput;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;

/** Jarvis 3.18: llega una pregunta desde el reloj (la respuesta del aviso). Si Jarvis está abierto (aunque en segundo plano), la contesta. */
public class RelojReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) {
        Bundle b = RemoteInput.getResultsFromIntent(i);
        CharSequence t = b == null ? null : b.getCharSequence(RelojPlugin.CLAVE);
        if (t == null || t.toString().trim().isEmpty()) return;
        String q = t.toString().trim();
        if (Apagado.es(c)) { RelojPlugin.aviso(c, "Jarvis está apagado", "Abre Jarvis en el celular para encenderlo."); return; }
        RelojPlugin p = RelojPlugin.instancia;
        if (p != null) { RelojPlugin.aviso(c, "«" + q + "»", "Pensando…"); p.pregunta(q); return; }
        c.getSharedPreferences("jarvis_reloj", 0).edit().putString("pendiente", q).apply();
        RelojPlugin.aviso(c, "«" + q + "»", "Abre Jarvis en el celular una vez y te respondo aquí.");
    }
}
