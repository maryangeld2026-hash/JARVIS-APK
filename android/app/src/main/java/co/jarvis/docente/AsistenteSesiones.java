package co.jarvis.docente;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;
import android.service.voice.VoiceInteractionSessionService;

/** Cuando llamas al asistente, abre Jarvis escuchando y se quita del medio. */
public class AsistenteSesiones extends VoiceInteractionSessionService {
    @Override
    public VoiceInteractionSession onNewSession(Bundle args) { return new Sesion(this); }

    static class Sesion extends VoiceInteractionSession {
        Sesion(Context c) { super(c); }

        @Override
        public void onShow(Bundle args, int flags) {
            super.onShow(args, flags);
            final Intent i = new Intent(getContext(), MainActivity.class).putExtra("atajo", "hablar")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            // 3.10/3.18: lo que estabas viendo (texto y foto), para «¿qué dice esta pantalla?» y «mira mi pantalla»
            ControlServicio.capturarY(() -> {
                try { startAssistantActivity(i); } catch (Exception e) { try { getContext().startActivity(i); } catch (Exception ignored) { } }
                hide();
            });
        }
    }
}
