package co.jarvis.docente;

import android.app.Activity;
import android.content.Intent;
import android.content.IntentSender;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning;
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.List;

/**
 * Jarvis 3.4: escanear documentos (recorta y endereza la hoja sola) y leer texto sin internet, con ML Kit de Google.
 *   escanear({paginas, texto}) → {paginas: [base64 JPEG], texto}     leerTexto({base64}) → {texto}
 */
@CapacitorPlugin(name = "Escaner")
public class EscanerPlugin extends Plugin {
    static final int REQ = 7301;
    private static EscanerPlugin instancia;
    private PluginCall pendiente;
    private boolean conTexto = false;

    @Override
    public void load() { instancia = this; }

    @PluginMethod
    public void escanear(PluginCall call) {
        int paginas = Math.max(1, Math.min(10, call.getInt("paginas", 5)));
        conTexto = call.getBoolean("texto", false);
        GmsDocumentScannerOptions op = new GmsDocumentScannerOptions.Builder()
            .setGalleryImportAllowed(true)
            .setPageLimit(paginas)
            .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
            .setScannerMode(GmsDocumentScannerOptions.SCANNER_MODE_FULL)
            .build();
        final Activity act = getActivity();
        pendiente = call;
        GmsDocumentScanning.getClient(op).getStartScanIntent(act)
            .addOnSuccessListener((IntentSender s) -> {
                try { act.startIntentSenderForResult(s, REQ, null, 0, 0, 0); }
                catch (Exception e) { fallar("No pude abrir el escáner: " + e.getMessage()); }
            })
            .addOnFailureListener((Exception e) -> fallar("El escáner de documentos necesita los servicios de Google Play actualizados: " + e.getMessage()));
    }

    private void fallar(String m) { if (pendiente != null) { pendiente.reject(m); pendiente = null; } }

    /** MainActivity le pasa el resultado del escáner. */
    static void resultado(int code, Intent data) {
        if (instancia == null || instancia.pendiente == null) return;
        final PluginCall call = instancia.pendiente;
        instancia.pendiente = null;
        if (code != Activity.RESULT_OK || data == null) { JSObject r = new JSObject(); r.put("cancelado", true); r.put("paginas", new JSArray()); call.resolve(r); return; }
        GmsDocumentScanningResult res = GmsDocumentScanningResult.fromActivityResultIntent(data);
        if (res == null || res.getPages() == null) { JSObject r = new JSObject(); r.put("cancelado", true); r.put("paginas", new JSArray()); call.resolve(r); return; }
        final List<GmsDocumentScanningResult.Page> pags = res.getPages();
        final boolean texto = instancia.conTexto;
        new Thread(() -> {
            JSArray out = new JSArray();
            StringBuilder sb = new StringBuilder();
            TextRecognizer tr = texto ? TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) : null;
            try {
                for (GmsDocumentScanningResult.Page p : pags) {
                    Bitmap bm = instancia.abrir(p.getImageUri(), 1800);
                    if (bm == null) continue;
                    out.put(jpeg(bm));
                    if (tr != null) {
                        try {
                            String t = com.google.android.gms.tasks.Tasks.await(tr.process(InputImage.fromBitmap(bm, 0))).getText();
                            if (sb.length() > 0) sb.append("\n\n");
                            sb.append(t);
                        } catch (Exception ignored) { }
                    }
                }
            } finally { if (tr != null) tr.close(); }
            JSObject r = new JSObject(); r.put("paginas", out); r.put("texto", sb.toString());
            call.resolve(r);
        }, "jarvis-escaner").start();
    }

    @PluginMethod
    public void leerTexto(PluginCall call) {
        final String b64 = call.getString("base64", "");
        new Thread(() -> {
            TextRecognizer tr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            try {
                byte[] b = Base64.decode(b64.replaceFirst("^data:[^,]*,", ""), Base64.DEFAULT);
                Bitmap bm = BitmapFactory.decodeByteArray(b, 0, b.length);
                if (bm == null) { call.reject("No pude abrir la imagen."); return; }
                String t = com.google.android.gms.tasks.Tasks.await(tr.process(InputImage.fromBitmap(bm, 0))).getText();
                JSObject r = new JSObject(); r.put("texto", t); call.resolve(r);
            } catch (Exception e) { call.reject("No pude leer el texto: " + e.getMessage()); }
            finally { tr.close(); }
        }, "jarvis-ocr").start();
    }

    private Bitmap abrir(Uri u, int max) {
        try {
            BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true;
            try (InputStream in = getContext().getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
            int s = 1; while (Math.max(o.outWidth, o.outHeight) / (s * 2) >= max) s *= 2;
            BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = s;
            try (InputStream in = getContext().getContentResolver().openInputStream(u)) { return BitmapFactory.decodeStream(in, null, o2); }
        } catch (Exception e) { return null; }
    }

    private static String jpeg(Bitmap bm) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bm.compress(Bitmap.CompressFormat.JPEG, 85, out);
        return Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
    }
}
