package co.jarvis.docente;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Jarvis 3.18: subtítulos en vivo. iniciar({de: "en-US", a: "es", tam}) · detener() · estado() → {activo} */
@CapacitorPlugin(name = "Subtitulos")
public class SubtitulosPlugin extends Plugin {
    @PluginMethod
    public void iniciar(PluginCall call) {
        if (getContext().checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != android.content.pm.PackageManager.PERMISSION_GRANTED) { call.reject("Falta el permiso del micrófono.", "permiso"); return; }
        if (Build.VERSION.SDK_INT >= 23 && !android.provider.Settings.canDrawOverlays(getContext())) { call.reject("Falta el permiso «Mostrar sobre otras apps».", "overlay"); return; }
        Intent i = new Intent(getContext(), SubtitulosService.class).putExtra("de", call.getString("de", "en-US")).putExtra("a", call.getString("a", "es"))
            .putExtra("tam", call.getFloat("tam", 22f));
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
        call.resolve();
    }
    @PluginMethod
    public void detener(PluginCall call) {
        if (SubtitulosService.activo) { Intent i = new Intent(getContext(), SubtitulosService.class).setAction(SubtitulosService.PARAR); if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i); }
        call.resolve();
    }
    @PluginMethod
    public void estado(PluginCall call) { JSObject r = new JSObject(); r.put("activo", SubtitulosService.activo); call.resolve(r); }
}
