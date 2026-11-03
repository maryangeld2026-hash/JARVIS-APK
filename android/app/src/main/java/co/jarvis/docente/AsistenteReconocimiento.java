package co.jarvis.docente;

import android.content.Intent;
import android.speech.RecognitionService;
import android.speech.SpeechRecognizer;

/**
 * Android exige que un asistente traiga su propio servicio de reconocimiento. Jarvis no lo usa: su oído (OidoPlugin)
 * siempre pide el reconocimiento de Google o el del celular por su nombre. Si otra app lo llama, responde «no disponible».
 */
public class AsistenteReconocimiento extends RecognitionService {
    @Override protected void onStartListening(Intent intent, Callback cb) { try { cb.error(SpeechRecognizer.ERROR_CLIENT); } catch (Exception ignored) { } }
    @Override protected void onCancel(Callback cb) { }
    @Override protected void onStopListening(Callback cb) { }
}
