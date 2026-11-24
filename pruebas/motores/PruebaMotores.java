import co.jarvis.motores.Llama;
import co.jarvis.motores.Whisper;
import co.jarvis.docente.supertonic.VozSupertonic;

import java.text.Normalizer;

/**
 * Jarvis 3.29 · prueba de los tres motores en el computador (GitHub Actions), con los mismos archivos del celular:
 *   1) GGUF (llama.cpp): una pregunta en español con un modelo pequeño.
 *   2) Voz neural (Supertonic 3): «Hola, soy Jarvis…» en español.
 *   3) Dictado (whisper.cpp): transcribe ese mismo audio → debe entender lo que dijo la voz.
 *   4) 3.30: búsqueda por significado (EmbeddingGemma): lo del paseo encuentra la salida al museo.
 * Uso: java PruebaMotores <libjarvis_llama.so> <modelo.gguf> <libjarvis_whisper.so> <ggml-base.bin> <carpeta supertonic> [busqueda.gguf]
 */
public class PruebaMotores {
    static int fallas = 0;
    static void check(boolean ok, String que) { System.out.println((ok ? "✓ " : "✗ ") + que); if (!ok) fallas++; }
    static String norm(String s) { return Normalizer.normalize(s.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", ""); }

    public static void main(String[] a) throws Exception {
        // ---------------- 1) GGUF
        Llama.iniciarDesde(a[0], "");
        long t0 = System.currentTimeMillis();
        int c = Llama.cargar(a[1], 2048, 4);
        check(c == 0, "carga el modelo GGUF (" + (System.currentTimeMillis() - t0) + " ms)");
        final int[] parciales = {0};
        String r = Llama.generar(new String[] {"system", "user"},
            new String[] {"Eres Jarvis, un asistente. Responde en español, en una frase.", "¿Cuál es la capital de Francia?"},
            48, 0.2f, false, (txt) -> { parciales[0]++; return true; });
        System.out.println("   respuesta: " + r.replace('\n', ' ') + "  " + Llama.error());
        check(r.trim().length() > 0, "responde algo");
        check(norm(r).contains("paris") || norm(r).contains("francia"), "responde sobre la pregunta (el modelo de prueba es diminuto: 0,6B)");
        check(parciales[0] > 0, "va mostrando la respuesta mientras escribe (" + parciales[0] + " avisos)");
        // la segunda pregunta reutiliza el comienzo de la conversación
        t0 = System.currentTimeMillis();
        String r2 = Llama.generar(new String[] {"system", "user", "assistant", "user"},
            new String[] {"Eres Jarvis, un asistente. Responde en español, en una frase.", "¿Cuál es la capital de Francia?", r, "¿Y la de Italia?"},
            48, 0.2f, false, null);
        System.out.println("   segunda: " + r2.replace('\n', ' ') + " (" + (System.currentTimeMillis() - t0) + " ms)");
        check(norm(r2).contains("roma"), "sigue la conversación (Roma)");
        final int[] n = {0};
        Llama.generar(new String[] {"user"}, new String[] {"Cuenta del 1 al 100."}, 400, 0.2f, false, (txt) -> ++n[0] < 3);
        check(n[0] == 3, "se puede detener a mitad de la respuesta");
        String b = Llama.prueba(64, 16);
        System.out.println("   velocidad: " + b);
        check(b.contains("escribir"), "mide la velocidad (palabras por segundo)");
        Llama.liberar();

        // ---------------- 2) voz neural
        t0 = System.currentTimeMillis();
        VozSupertonic voz = VozSupertonic.cargar(a[4], "M1");
        check(voz.frecuencia() > 16000, "carga la voz neural (" + (System.currentTimeMillis() - t0) + " ms, " + voz.frecuencia() + " Hz)");
        t0 = System.currentTimeMillis();
        float[] wav = voz.sintetizar("Hola, soy Jarvis. Hoy va a llover en Bogotá.", "es", 1.0f, 8);
        double seg = wav.length / (double) voz.frecuencia();
        System.out.printf("   %.1f s de audio en %d ms%n", seg, System.currentTimeMillis() - t0);
        check(seg > 1.5 && seg < 12, "habla en español (duración razonable)");
        float pico = 0; for (float x : wav) pico = Math.max(pico, Math.abs(x));
        check(pico > 0.05f, "el audio no es silencio");
        voz.usarVoz("F1");
        check("F1".equals(voz.voz()), "cambia de voz");
        voz.usarVoz("M1");

        // ---------------- 3) dictado: lo que dijo la voz, ¿lo entiende Whisper?
        Whisper.iniciarDesde(a[2]);
        check(Whisper.cargar(a[3]) == 0, "carga Whisper");
        float[] pcm = remuestrear(wav, voz.frecuencia(), 16000);
        t0 = System.currentTimeMillis();
        String txt = Whisper.transcribir(pcm, "es", 4, "Jarvis");
        System.out.println("   Whisper oyó: «" + txt + "» (" + (System.currentTimeMillis() - t0) + " ms)");
        String nt = norm(txt);
        check(nt.contains("jarvis") || nt.contains("hola"), "entiende el saludo");
        check(nt.contains("llover") || nt.contains("bogota"), "entiende el resto de la frase");
        Whisper.liberar();
        voz.close();

        // ---------------- 4) 3.30: búsqueda por significado (EmbeddingGemma por el mismo motor GGUF)
        if (a.length > 5) {
            t0 = System.currentTimeMillis();
            int e = Llama.cargarEmb(a[5], 4);
            check(e == 0, "carga el modelo de búsqueda (" + (System.currentTimeMillis() - t0) + " ms)");
            String[] docs = {
                "title: Circular | text: La salida pedagógica al museo de ciencias es el viernes; traer el permiso firmado.",
                "title: Recibo | text: La factura de la luz llega el 15 y se paga en el banco.",
                "title: Receta | text: Arepas: harina de maíz, agua, sal y queso; se asan en el budare.",
            };
            float[][] v = new float[docs.length][];
            t0 = System.currentTimeMillis();
            for (int k = 0; k < docs.length; k++) v[k] = Llama.embeber(docs[k]);
            System.out.println("   " + docs.length + " vectores de " + (v[0] == null ? 0 : v[0].length) + " números en " + (System.currentTimeMillis() - t0) + " ms");
            check(v[0] != null && v[0].length >= 256, "convierte un texto en vector");
            double largo = 0; for (float x : v[0]) largo += x * x;
            check(Math.abs(Math.sqrt(largo) - 1) < 0.01, "el vector viene normalizado (largo 1)");
            String[][] qs = { { "task: search result | query: ¿cuándo es el paseo del colegio?", "0" }, { "task: search result | query: cuánto debo de energía eléctrica", "1" }, { "task: search result | query: qué cocino con maíz", "2" } };
            for (String[] q : qs) {
                float[] w = Llama.embeber(q[0]);
                int mejor = -1; double mp = -2; StringBuilder ps = new StringBuilder();
                for (int k = 0; k < docs.length; k++) { double p = 0; for (int j = 0; j < w.length; j++) p += w[j] * v[k][j]; ps.append(String.format(" %.2f", p)); if (p > mp) { mp = p; mejor = k; } }
                System.out.println("   «" + q[0].substring(29) + "» →" + ps);
                check(mejor == Integer.parseInt(q[1]), "encuentra por significado: «" + q[0].substring(29) + "»");
            }
            // los dos modelos a la vez (conversación y búsqueda), como en el celular
            check(Llama.cargar(a[1], 1024, 4) == 0 && Llama.embeber("hola") != null, "funciona junto al modelo de conversación");
            Llama.liberar();
            Llama.liberarEmb();
        }

        System.out.println(fallas == 0 ? "\nTodo bien (motores 3.30)." : "\nFALLARON " + fallas);
        System.exit(fallas == 0 ? 0 : 1);
    }

    /** De la frecuencia de la voz (44,1 kHz) a la de Whisper (16 kHz), con interpolación lineal. */
    static float[] remuestrear(float[] x, int de, int a) {
        int n = (int) ((long) x.length * a / de);
        float[] y = new float[n];
        double k = de / (double) a;
        for (int i = 0; i < n; i++) {
            double p = i * k; int j = (int) p; double f = p - j;
            float u = x[Math.min(j, x.length - 1)], v = x[Math.min(j + 1, x.length - 1)];
            y[i] = (float) (u + (v - u) * f);
        }
        return y;
    }
}
