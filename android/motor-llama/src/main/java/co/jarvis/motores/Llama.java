package co.jarvis.motores;

/**
 * Jarvis 3.29 · el motor GGUF (llama.cpp) dentro del celular. Un solo modelo cargado a la vez.
 * Uso: Llama.iniciar(dirLibs) → cargar(ruta, ctx, hilos) → generar(roles, textos, max, temp, pensar, escucha) → liberar().
 */
public final class Llama {
    private Llama() { }

    /** Recibe el texto que va saliendo; devuelve false para parar. */
    public interface Escucha { boolean token(String textoHastaAhora); }

    private static boolean listo = false;
    private static String falla = "";

    /** Carga las bibliotecas nativas (y las variantes del procesador). → false si este celular no puede (32 bits, por ejemplo). */
    public static synchronized boolean iniciar(String dirLibs) {
        if (listo) return true;
        try {
            System.loadLibrary("jarvis_llama");
            init(dirLibs == null ? "" : dirLibs);
            listo = true;
        } catch (Throwable e) { falla = String.valueOf(e.getMessage()); }
        return listo;
    }
    /** Para las pruebas en el computador: la biblioteca por su ruta. */
    public static synchronized boolean iniciarDesde(String rutaSo, String dirLibs) {
        if (listo) return true;
        System.load(rutaSo);
        init(dirLibs == null ? "" : dirLibs);
        listo = true;
        return true;
    }
    public static String falla() { return falla; }

    static native void init(String dirLibs);
    public static native int cargar(String ruta, int nCtx, int hilos);
    public static native String generar(String[] roles, String[] textos, int maxTokens, float temperatura, boolean pensar, Escucha escucha);
    public static native void detener();
    public static native String prueba(int leer, int escribir);
    public static native String info();
    public static native String error();
    public static native void liberar();
}
