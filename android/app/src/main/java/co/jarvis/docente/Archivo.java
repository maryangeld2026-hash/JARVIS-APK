package co.jarvis.docente;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.List;

/**
 * Jarvis 3.18: la memoria de tus mensajes (solo si la activas). Guarda los mensajes que llegan a tus apps de chat en un archivo
 * privado de Jarvis, dentro del celular, por 30 días (máximo 5.000). Nunca se envía a ningún lado; Jarvis solo busca en él
 * cuando le preguntas («¿qué me dijo Carlos del contrato?»). Se borra con un toque en Ajustes.
 */
public final class Archivo {
    private Archivo() {}
    private static final long DIAS = 30L * 24 * 3600 * 1000;
    private static final int MAX = 5000;
    private static File f(Context c) { return new File(c.getFilesDir(), "mensajes.jsonl"); }
    private static String ultimo = "";

    static synchronized void guardar(Context c, String app, String de, String texto, long t) {
        String firma = de + "|" + texto;
        if (firma.equals(ultimo)) return; ultimo = firma;
        try (FileOutputStream o = new FileOutputStream(f(c), true)) {
            JSONObject j = new JSONObject(); j.put("a", app); j.put("d", de); j.put("x", texto.length() > 2000 ? texto.substring(0, 2000) : texto); j.put("t", t);
            o.write((j.toString() + "\n").getBytes("UTF-8"));
        } catch (Exception ignored) { }
        if (Math.random() < 0.02) podar(c);
    }

    static synchronized List<JSONObject> leer(Context c, long desde) {
        List<JSONObject> l = new ArrayList<>();
        File a = f(c); if (!a.exists()) return l;
        try (BufferedReader r = new BufferedReader(new FileReader(a))) {
            String s; while ((s = r.readLine()) != null) { try { JSONObject j = new JSONObject(s); if (j.optLong("t") >= desde) l.add(j); } catch (Exception ignored) { } }
        } catch (Exception ignored) { }
        return l;
    }

    static synchronized void podar(Context c) {
        List<JSONObject> l = leer(c, System.currentTimeMillis() - DIAS);
        int ini = Math.max(0, l.size() - MAX);
        try (FileWriter w = new FileWriter(f(c), false)) { for (int i = ini; i < l.size(); i++) w.write(l.get(i).toString() + "\n"); } catch (Exception ignored) { }
    }

    static synchronized void borrar(Context c) { f(c).delete(); }

    static JSONArray json(Context c, long desde) { JSONArray a = new JSONArray(); for (JSONObject j : leer(c, desde)) a.put(j); return a; }
}
