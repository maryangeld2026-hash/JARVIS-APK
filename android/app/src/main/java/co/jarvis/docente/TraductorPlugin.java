package co.jarvis.docente;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.common.model.RemoteModelManager;
import com.google.mlkit.nl.languageid.LanguageIdentification;
import com.google.mlkit.nl.languageid.LanguageIdentificationOptions;
import com.google.mlkit.nl.languageid.LanguageIdentifier;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.TranslateRemoteModel;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Jarvis 3.17: traductor dentro del celular (ML Kit). Funciona SIN internet cuando el paquete del idioma ya está bajado
 * (unos 30 MB por idioma, una sola vez). Nada de lo que traduces sale del celular.
 *   detectar({texto}) → {idioma, confianza}          traducir({texto, de?, a, descargar}) → {texto, de, a}
 *   modelos() → {lista:[códigos]}   descargar({idioma, wifi}) → {}   borrar({idioma}) → {}   idiomas() → {lista}
 * Los traductores abiertos se cierran solos a los 2 minutos sin uso (devuelven la memoria).
 */
@CapacitorPlugin(name = "Traductor")
public class TraductorPlugin extends Plugin {
    private final Map<String, Translator> abiertos = new LinkedHashMap<>();
    private LanguageIdentifier detector;
    private final android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable cerrar = this::cerrarTodo;

    private synchronized void cerrarTodo() {
        for (Translator t : abiertos.values()) { try { t.close(); } catch (Exception ignored) { } }
        abiertos.clear();
        if (detector != null) { try { detector.close(); } catch (Exception ignored) { } detector = null; }
    }
    private void usado() { main.removeCallbacks(cerrar); main.postDelayed(cerrar, 2 * 60 * 1000); }

    private static String codigo(String c) {
        if (c == null) return null;
        String k = c.trim().toLowerCase();
        int i = k.indexOf('-'); if (i > 0) k = k.substring(0, i);
        i = k.indexOf('_'); if (i > 0) k = k.substring(0, i);
        if (k.equals("iw")) k = "he";
        return TranslateLanguage.fromLanguageTag(k);
    }

    private synchronized LanguageIdentifier det() {
        if (detector == null) detector = LanguageIdentification.getClient(new LanguageIdentificationOptions.Builder().setConfidenceThreshold(0.35f).build());
        return detector;
    }

    private synchronized Translator traductor(String de, String a) {
        String k = de + ">" + a;
        Translator t = abiertos.remove(k);
        if (t == null) t = Translation.getClient(new TranslatorOptions.Builder().setSourceLanguage(de).setTargetLanguage(a).build());
        abiertos.put(k, t);
        while (abiertos.size() > 3) {                                          // solo los últimos tres pares quedan abiertos
            String viejo = abiertos.keySet().iterator().next();
            Translator x = abiertos.remove(viejo); if (x != null) { try { x.close(); } catch (Exception ignored) { } }
        }
        return t;
    }

    @PluginMethod
    public void detectar(PluginCall call) {
        String texto = call.getString("texto", "");
        usado();
        det().identifyLanguage(texto).addOnSuccessListener(code -> {
            JSObject r = new JSObject(); r.put("idioma", "und".equals(code) ? "" : code); call.resolve(r);
        }).addOnFailureListener(e -> call.reject("No pude detectar el idioma."));
    }

    @PluginMethod
    public void traducir(PluginCall call) {
        final String texto = call.getString("texto", "");
        final String a = codigo(call.getString("a", "es"));
        final boolean bajar = Boolean.TRUE.equals(call.getBoolean("descargar", false));
        if (a == null) { call.reject("Ese idioma no lo traduzco sin internet.", "idioma"); return; }
        if (texto.trim().isEmpty()) { call.reject("No hay texto para traducir."); return; }
        usado();
        String deCall = call.getString("de", "");
        if (deCall == null || deCall.isEmpty()) {
            det().identifyLanguage(texto).addOnSuccessListener(code -> seguir(call, texto, "und".equals(code) ? null : codigo(code), a, bajar))
                .addOnFailureListener(e -> seguir(call, texto, null, a, bajar));
        } else seguir(call, texto, codigo(deCall), a, bajar);
    }

    private void seguir(PluginCall call, String texto, String de, String a, boolean bajar) {
        if (de == null) { call.reject("No reconocí el idioma de ese texto.", "detectar"); return; }
        if (de.equals(a)) { JSObject r = new JSObject(); r.put("texto", texto); r.put("de", de); r.put("a", a); r.put("igual", true); call.resolve(r); return; }
        RemoteModelManager mm = RemoteModelManager.getInstance();
        mm.getDownloadedModels(TranslateRemoteModel.class).addOnSuccessListener(lista -> {
            boolean tieneDe = de.equals(TranslateLanguage.ENGLISH), tieneA = a.equals(TranslateLanguage.ENGLISH);
            for (TranslateRemoteModel m : lista) { if (m.getLanguage().equals(de)) tieneDe = true; if (m.getLanguage().equals(a)) tieneA = true; }
            if ((!tieneDe || !tieneA) && !bajar) {
                JSObject d = new JSObject(); d.put("falta", !tieneA ? a : de);
                call.reject("Falta el paquete del idioma para traducir sin internet.", "falta_modelo", d); return;
            }
            Translator t = traductor(de, a);
            t.downloadModelIfNeeded(new DownloadConditions.Builder().build()).addOnSuccessListener(v ->
                t.translate(texto).addOnSuccessListener(out -> {
                    usado();
                    JSObject r = new JSObject(); r.put("texto", out); r.put("de", de); r.put("a", a); call.resolve(r);
                }).addOnFailureListener(e -> call.reject("No pude traducir: " + e.getMessage()))
            ).addOnFailureListener(e -> call.reject("No pude bajar el paquete del idioma (revisa el internet).", "descarga"));
        }).addOnFailureListener(e -> call.reject("No pude revisar los paquetes de idiomas."));
    }

    @PluginMethod
    public void modelos(PluginCall call) {
        RemoteModelManager.getInstance().getDownloadedModels(TranslateRemoteModel.class).addOnSuccessListener(lista -> {
            JSArray a = new JSArray(); for (TranslateRemoteModel m : lista) a.put(m.getLanguage());
            JSObject r = new JSObject(); r.put("lista", a); call.resolve(r);
        }).addOnFailureListener(e -> { JSObject r = new JSObject(); r.put("lista", new JSArray()); call.resolve(r); });
    }

    @PluginMethod
    public void descargar(PluginCall call) {
        String c = codigo(call.getString("idioma", ""));
        if (c == null) { call.reject("Ese idioma no está disponible sin internet."); return; }
        DownloadConditions.Builder b = new DownloadConditions.Builder();
        if (Boolean.TRUE.equals(call.getBoolean("wifi", false))) b.requireWifi();
        RemoteModelManager.getInstance().download(new TranslateRemoteModel.Builder(c).build(), b.build())
            .addOnSuccessListener(v -> call.resolve()).addOnFailureListener(e -> call.reject("No pude bajar el paquete (revisa el internet)."));
    }

    @PluginMethod
    public void borrar(PluginCall call) {
        String c = codigo(call.getString("idioma", ""));
        if (c == null || c.equals(TranslateLanguage.ENGLISH)) { call.resolve(); return; }
        cerrarTodo();
        RemoteModelManager.getInstance().deleteDownloadedModel(new TranslateRemoteModel.Builder(c).build())
            .addOnSuccessListener(v -> call.resolve()).addOnFailureListener(e -> call.reject("No pude borrar el paquete."));
    }

    @PluginMethod
    public void idiomas(PluginCall call) {
        JSArray a = new JSArray(); for (String l : TranslateLanguage.getAllLanguages()) a.put(l);
        JSObject r = new JSObject(); r.put("lista", a); call.resolve(r);
    }

    @Override
    protected void handleOnDestroy() { cerrarTodo(); }
}
