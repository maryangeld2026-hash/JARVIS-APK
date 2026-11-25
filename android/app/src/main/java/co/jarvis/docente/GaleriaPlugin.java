package co.jarvis.docente;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

/**
 * Jarvis 3.38 · guarda una imagen (la que creó Jarvis) en la Galería, en Imágenes › Jarvis.
 * En Android 10 o más nuevo no pide ningún permiso (MediaStore); en los más viejos responde «SIN_GALERIA» y Jarvis ofrece compartirla.
 *   guardar({base64, mime, nombre}) → {uri}
 */
@CapacitorPlugin(name = "Galeria")
public class GaleriaPlugin extends Plugin {
    @PluginMethod
    public void guardar(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) { call.reject("SIN_GALERIA"); return; }
        String b64 = call.getString("base64", ""), mime = call.getString("mime", "image/png"), nombre = call.getString("nombre", "jarvis-" + System.currentTimeMillis());
        if (b64 == null || b64.isEmpty()) { call.reject("No hay imagen."); return; }
        new Thread(() -> {
            Uri uri = null;
            ContentResolver cr = getContext().getContentResolver();
            try {
                byte[] datos = Base64.decode(b64, Base64.DEFAULT);
                String ext = mime.contains("jpeg") || mime.contains("jpg") ? ".jpg" : mime.contains("webp") ? ".webp" : ".png";
                ContentValues v = new ContentValues();
                v.put(MediaStore.Images.Media.DISPLAY_NAME, nombre.replaceAll("[^\\w\\- ]", "_") + ext);
                v.put(MediaStore.Images.Media.MIME_TYPE, mime);
                v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Jarvis");
                v.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                if (uri == null) throw new Exception("Android no dejó crear la imagen.");
                try (OutputStream o = cr.openOutputStream(uri)) { if (o == null) throw new Exception("No pude escribir la imagen."); o.write(datos); }
                ContentValues fin = new ContentValues(); fin.put(MediaStore.Images.Media.IS_PENDING, 0); cr.update(uri, fin, null, null);
                JSObject r = new JSObject(); r.put("uri", uri.toString()); call.resolve(r);
            } catch (Exception e) {
                try { if (uri != null) cr.delete(uri, null, null); } catch (Exception ignored) { }
                call.reject("No pude guardarla: " + e.getMessage());
            }
        }).start();
    }
}
