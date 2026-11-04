package co.jarvis.docente;

import android.Manifest;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Size;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.text.Normalizer;

/**
 * 3.11: buscar en tus fotos por lo que contienen.
 *   activar() → pide el permiso de fotos y programa la lectura (solo cargando) · estado() → {leidas}
 *   buscar({terminos:[…]}) → {lista:[{uri, t, txt, et, mini (jpg base64)}]} · abrir({uri})
 */
@CapacitorPlugin(name = "Fotos", permissions = {
    @Permission(strings = { Manifest.permission.READ_MEDIA_IMAGES }, alias = "fotos"),
    @Permission(strings = { Manifest.permission.READ_EXTERNAL_STORAGE }, alias = "fotosViejo") })
public class FotosPlugin extends Plugin {
    private String alias() { return Build.VERSION.SDK_INT >= 33 ? "fotos" : "fotosViejo"; }

    @PluginMethod
    public void activar(PluginCall call) {
        if (getPermissionState(alias()) != PermissionState.GRANTED) { requestPermissionForAlias(alias(), call, "activarListo"); return; }
        FotosJob.programar(getContext());
        JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
    }
    @PermissionCallback
    private void activarListo(PluginCall call) {
        boolean ok = getPermissionState(alias()) == PermissionState.GRANTED;
        if (ok) FotosJob.programar(getContext());
        JSObject r = new JSObject(); r.put("ok", ok); call.resolve(r);
    }

    @PluginMethod
    public void estado(PluginCall call) {
        JSObject r = new JSObject(); r.put("leidas", FotosJob.leer(getContext()).length()); r.put("permiso", getPermissionState(alias()) == PermissionState.GRANTED); call.resolve(r);
    }

    static String norm(String s) { return Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "").toLowerCase(); }

    @PluginMethod
    public void buscar(PluginCall call) {
        JSArray ts = call.getArray("terminos", new JSArray());
        java.util.List<String> q = new java.util.ArrayList<>();
        try { for (int k = 0; k < ts.length(); k++) { String x = norm(ts.getString(k)).trim(); if (x.length() > 1) q.add(x); } } catch (Exception ignored) { }
        JSONArray idx = FotosJob.leer(getContext());
        java.util.List<JSONObject> hits = new java.util.ArrayList<>();
        for (int k = 0; k < idx.length(); k++) {
            JSONObject o = idx.optJSONObject(k); if (o == null) continue;
            String txt = norm(o.optString("txt")), et = norm(o.optJSONArray("et") == null ? "" : o.optJSONArray("et").toString());
            int s = 0; for (String w : q) { if (txt.contains(w)) s += 2; if (et.contains(w)) s += 3; }
            if (s > 0) { try { o.put("s", s); } catch (Exception ignored) { } hits.add(o); }
        }
        hits.sort((a, b) -> b.optInt("s") != a.optInt("s") ? b.optInt("s") - a.optInt("s") : Long.compare(b.optLong("t"), a.optLong("t")));
        JSArray out = new JSArray();
        for (int k = 0; k < hits.size() && k < 12; k++) {
            JSONObject o = hits.get(k);
            try {
                JSObject x = new JSObject(); x.put("uri", o.optString("uri")); x.put("t", o.optLong("t")); x.put("txt", o.optString("txt")); x.put("et", o.optJSONArray("et"));
                if (Build.VERSION.SDK_INT >= 29) {
                    Bitmap b = getContext().getContentResolver().loadThumbnail(Uri.parse(o.optString("uri")), new Size(240, 240), null);
                    ByteArrayOutputStream bo = new ByteArrayOutputStream(); b.compress(Bitmap.CompressFormat.JPEG, 70, bo);
                    x.put("mini", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                }
                out.put(x);
            } catch (Exception ignored) { }
        }
        JSObject r = new JSObject(); r.put("lista", out); r.put("leidas", idx.length()); call.resolve(r);
    }

    @PluginMethod
    public void abrir(PluginCall call) {
        try { getContext().startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(Uri.parse(call.getString("uri", "")), "image/*").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION)); call.resolve(); }
        catch (Exception e) { call.reject("No pude abrir la foto."); }
    }
}
