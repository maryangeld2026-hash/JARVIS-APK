package co.jarvis.docente;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.ContentUris;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * 3.11: «memoria fotográfica». Lee tus fotos DENTRO del celular (el texto que tienen y qué se ve en ellas) para que le
 * preguntes «¿dónde está la foto de la cédula?». Para no gastar batería, solo trabaja mientras el celular está cargando,
 * y de a 120 fotos por vez. Nada sale del celular.
 */
public class FotosJob extends JobService {
    static final int ID = 7401;
    private volatile boolean parar = false;

    static void programar(Context c) {
        JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE); if (js == null) return;
        js.schedule(new JobInfo.Builder(ID, new ComponentName(c, FotosJob.class)).setRequiresCharging(true).setRequiresBatteryNotLow(true).setPersisted(true).setMinimumLatency(5000).build());
    }
    static File archivo(Context c) { return new File(c.getFilesDir(), "fotos_indice.json"); }
    static JSONArray leer(Context c) {
        try {
            File f = archivo(c); if (!f.exists()) return new JSONArray();
            byte[] b = new byte[(int) f.length()];
            try (java.io.FileInputStream in = new java.io.FileInputStream(f)) { int o = 0, n; while (o < b.length && (n = in.read(b, o, b.length - o)) > 0) o += n; }
            return new JSONArray(new String(b, StandardCharsets.UTF_8));
        } catch (Exception e) { return new JSONArray(); }
    }

    @Override
    public boolean onStartJob(JobParameters p) {
        if (Apagado.es(this)) return false;
        parar = false;
        new Thread(() -> {
            boolean mas = false;
            try { mas = indexar(this, 120); } catch (Exception ignored) { }
            jobFinished(p, false);
            if (mas && !parar) programar(this);                    // quedan fotos: sigue en la próxima carga
        }, "jarvis-fotos").start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) { parar = true; return true; }

    /** → true si quedaron fotos por leer. */
    static boolean indexar(Context c, int max) throws Exception {
        JSONArray idx = leer(c);
        java.util.HashSet<Long> hechas = new java.util.HashSet<>();
        for (int k = 0; k < idx.length(); k++) hechas.add(idx.getJSONObject(k).optLong("id"));
        Uri base = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
        String[] cols = { MediaStore.Images.Media._ID, MediaStore.Images.Media.DATE_TAKEN, MediaStore.Images.Media.DATE_ADDED };
        TextRecognizer tr = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        ImageLabeler lb = ImageLabeling.getClient(new ImageLabelerOptions.Builder().setConfidenceThreshold(0.6f).build());
        int n = 0; boolean mas = false;
        try (Cursor k = c.getContentResolver().query(base, cols, null, null, MediaStore.Images.Media.DATE_ADDED + " DESC")) {
            while (k != null && k.moveToNext()) {
                long id = k.getLong(0);
                if (hechas.contains(id)) continue;
                if (n >= max) { mas = true; break; }
                Uri u = ContentUris.withAppendedId(base, id);
                JSONObject o = new JSONObject();
                o.put("id", id); o.put("uri", u.toString());
                long t = k.getLong(1); if (t == 0) t = k.getLong(2) * 1000L; o.put("t", t);
                try {
                    InputImage im = InputImage.fromFilePath(c, u);
                    Text tx = Tasks.await(tr.process(im));
                    String s = tx.getText().replace('\n', ' ').trim(); o.put("txt", s.length() > 400 ? s.substring(0, 400) : s);
                    JSONArray et = new JSONArray(); for (ImageLabel l : Tasks.await(lb.process(im))) et.put(l.getText().toLowerCase());
                    o.put("et", et);
                } catch (Exception e) { o.put("txt", ""); o.put("et", new JSONArray()); }
                idx.put(o); n++;
                if (n % 20 == 0) guardar(c, idx);
            }
        } finally { tr.close(); lb.close(); }
        guardar(c, idx);
        return mas;
    }

    static void guardar(Context c, JSONArray idx) {
        try (FileOutputStream f = new FileOutputStream(archivo(c))) { f.write(idx.toString().getBytes(StandardCharsets.UTF_8)); } catch (Exception ignored) { }
    }
}
