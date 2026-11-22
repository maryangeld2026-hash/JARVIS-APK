package co.jarvis.docente;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Jarvis 3.29 · bajar un archivo grande (modelos de voz y de dictado): sigue donde iba si se corta, avisa el progreso. */
final class Descargas {
    interface Progreso { void en(long bytes, long total); }
    static volatile boolean cancelar = false;

    private Descargas() { }

    /** → el archivo final (se escribe en «destino.part» y al terminar se renombra). */
    static File bajar(String url, File destino, Progreso p) throws Exception {
        File parte = new File(destino.getPath() + ".part");
        if (destino.exists() && destino.length() > 0) return destino;
        destino.getParentFile().mkdirs();
        HttpURLConnection con = null;
        try {
            con = (HttpURLConnection) new URL(url).openConnection();
            con.setInstanceFollowRedirects(true);
            con.setConnectTimeout(20000);
            con.setReadTimeout(60000);
            con.setRequestProperty("User-Agent", "Jarvis/3.29");
            long ya = parte.exists() ? parte.length() : 0;
            if (ya > 0) con.setRequestProperty("Range", "bytes=" + ya + "-");
            int code = con.getResponseCode();
            if (code != 200 && code != 206) throw new Exception("El servidor respondió " + code + " (" + destino.getName() + ")");
            if (code == 200) ya = 0;
            long total = con.getContentLengthLong();
            if (total > 0) total += ya;
            try (InputStream in = new BufferedInputStream(con.getInputStream()); FileOutputStream out = new FileOutputStream(parte, ya > 0)) {
                byte[] buf = new byte[1 << 16];
                long n = ya; int r; long ult = 0;
                while ((r = in.read(buf)) > 0) {
                    if (cancelar) throw new Exception("Descarga cancelada.");
                    out.write(buf, 0, r);
                    n += r;
                    long ahora = System.currentTimeMillis();
                    if (p != null && ahora - ult > 400) { ult = ahora; p.en(n, total); }
                }
            }
            if (destino.exists()) destino.delete();
            if (!parte.renameTo(destino)) throw new Exception("No pude guardar " + destino.getName());
            return destino;
        } finally { if (con != null) con.disconnect(); }
    }
}
