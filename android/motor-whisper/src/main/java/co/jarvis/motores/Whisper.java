package co.jarvis.motores;

/** Jarvis 3.29 · dictado sin internet (whisper.cpp). Audio de 16 kHz mono en float → texto. */
public final class Whisper {
    private Whisper() { }
    private static boolean listo = false;
    private static String falla = "";

    public static synchronized boolean iniciar() {
        if (listo) return true;
        try { System.loadLibrary("jarvis_whisper"); listo = true; } catch (Throwable e) { falla = String.valueOf(e.getMessage()); }
        return listo;
    }
    public static synchronized boolean iniciarDesde(String rutaSo) { if (!listo) { System.load(rutaSo); listo = true; } return true; }
    public static String falla() { return falla; }

    public static native int cargar(String ruta);
    public static native String transcribir(float[] pcm16k, String idioma, int hilos, String pista);
    public static native void liberar();
}
