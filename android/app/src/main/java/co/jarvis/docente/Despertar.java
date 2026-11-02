package co.jarvis.docente;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.List;

/**
 * Jarvis: ¿la frase va dirigida a Jarvis? La misma idea del Jarvis del computador: el reconocimiento sin internet
 * (Vosk en español) no conoce la palabra «Jarvis» y la escribe parecido («yarvis», «harvis», «jar vis»…), así que se
 * compara por parecido. Devuelve el resto de la frase ("" si solo dijo Jarvis) o null si no era para Jarvis.
 */
public final class Despertar {
    private Despertar() {}

    static final List<String> VARIANTES = Arrays.asList("jarvis", "yarvis", "harvis", "charvis", "yarbis", "jarbis", "jervis", "yervis", "garvis", "llarvis");
    static final List<String> MULETILLAS = Arrays.asList("oye", "hola", "ey", "ei", "ya", "bueno", "este", "eh", "a", "y", "pues");

    static String norm(String s) {
        String t = Normalizer.normalize(s == null ? "" : s.toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return t.replaceAll("[^a-zñ0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    static double parecido(String a, String b) {
        int n = a.length(), m = b.length();
        if (n == 0 || m == 0) return 0;
        int[] prev = new int[m + 1], cur = new int[m + 1];
        for (int j = 0; j <= m; j++) prev[j] = j;
        for (int i = 1; i <= n; i++) {
            cur[0] = i;
            for (int j = 1; j <= m; j++) {
                int c = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                cur[j] = Math.min(Math.min(cur[j - 1] + 1, prev[j] + 1), prev[j - 1] + c);
            }
            int[] t = prev; prev = cur; cur = t;
        }
        return 1.0 - (double) prev[m] / Math.max(n, m);
    }

    static boolean esJarvis(String w) {
        if (w.length() < 4) return false;
        for (String v : VARIANTES) {
            if (w.equals(v) || (w.length() >= 5 && parecido(w, v) >= 0.8)) return true;
        }
        return false;
    }

    /** → resto de la frase, "" si solo fue «Jarvis», o null. */
    static String resto(String texto) {
        String[] w = norm(texto).split(" ");
        if (w.length == 0 || w[0].isEmpty()) return null;
        for (int i = 0; i < Math.min(3, w.length); i++) {
            boolean antes = true;
            for (int k = 0; k < i; k++) if (!MULETILLAS.contains(w[k])) { antes = false; break; }
            if (!antes) break;
            int usadas = 0;
            if (esJarvis(w[i])) usadas = 1;
            else if (i + 1 < w.length && esJarvis(w[i] + w[i + 1])) usadas = 2;      // «jar vis», «ya vis»
            if (usadas > 0) {
                StringBuilder sb = new StringBuilder();
                for (int k = i + usadas; k < w.length; k++) sb.append(k > i + usadas ? " " : "").append(w[k]);
                return sb.toString().trim();
            }
        }
        return null;
    }
}
