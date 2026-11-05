package co.jarvis.docente;

import android.accessibilityservice.AccessibilityService;
import android.os.Build;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

/**
 * Jarvis 3.6: el control del celular por voz («ve al inicio», «atrás», «abre las notificaciones», «bloquea el celular»,
 * «toma una captura»). 3.10: y, solo cuando tú lo pides (al llamar a Jarvis con la burbuja, el botón de asistente, el botón de
 * la cortina o «Jarvis»), copia el texto de la pantalla que estabas viendo para «¿qué dice esta pantalla?». Nunca lee
 * contraseñas, no vigila la pantalla en segundo plano y el texto se queda en el celular hasta que tú preguntes.
 * Se activa en Ajustes del celular › Accesibilidad › Jarvis.
 */
public class ControlServicio extends AccessibilityService {
    static volatile ControlServicio instancia;

    @Override protected void onServiceConnected() { super.onServiceConnected(); instancia = this; }
    @Override public void onAccessibilityEvent(AccessibilityEvent e) { }
    @Override public void onInterrupt() { }
    @Override public void onDestroy() { instancia = null; super.onDestroy(); }
    @Override public boolean onUnbind(android.content.Intent i) { instancia = null; return super.onUnbind(i); }

    // ======================================================================== 3.10: «¿qué dice esta pantalla?»
    static volatile String capApp = "", capTexto = "";
    static volatile long capT = 0;
    /** Copia el texto de la ventana que se ve ahora (si no es Jarvis). Se llama solo justo antes de abrir Jarvis. */
    static void capturar() {
        ControlServicio s = instancia; if (s == null) return;
        try {
            AccessibilityNodeInfo r = s.getRootInActiveWindow(); if (r == null) return;
            CharSequence pkg = r.getPackageName();
            if (pkg == null || pkg.toString().equals(s.getPackageName())) return;
            StringBuilder b = new StringBuilder();
            recorrer(r, b, 0);
            if (b.length() < 3) return;
            capTexto = b.length() > 15000 ? b.substring(0, 15000) : b.toString();
            String app = pkg.toString();
            try { android.content.pm.PackageManager pm = s.getPackageManager(); app = String.valueOf(pm.getApplicationLabel(pm.getApplicationInfo(pkg.toString(), 0))); } catch (Exception ignored) { }
            capApp = app; capT = System.currentTimeMillis();
        } catch (Exception ignored) { }
    }
    // ======================================================================== 3.18: Jarvis ve tu pantalla
    static volatile String capImg = "";
    static volatile long capImgT = 0;
    private static final java.util.regex.Pattern PRIVADAS = java.util.regex.Pattern.compile("(?i)(bancolombia|davivienda|bbva|nequi|daviplata|bancodebogota|bancodeoccidente|avvillas|scotiabank|colpatria|itau|nubank|lulo|movii|paypal|binance|coinbase|wallet|bank|banco|1password|bitwarden|lastpass|keepass|authenticator|authy)");
    /** Copia el texto y, desde Android 11, una foto de la pantalla que estabas viendo; luego abre Jarvis (luego.run). Nunca de apps de bancos o claves. */
    static void capturarY(Runnable luego) {
        capturar();
        final android.os.Handler h = new android.os.Handler(android.os.Looper.getMainLooper());
        ControlServicio s = instancia;
        String pkg = "";
        try { AccessibilityNodeInfo r = s == null ? null : s.getRootInActiveWindow(); if (r != null && r.getPackageName() != null) pkg = r.getPackageName().toString(); } catch (Exception ignored) { }
        if (s == null || Build.VERSION.SDK_INT < 30 || pkg.isEmpty() || pkg.equals(s.getPackageName()) || PRIVADAS.matcher(pkg).find()
            || s.getSharedPreferences("jarvis_pantalla", 0).getBoolean("noFoto", false)) { h.post(luego); return; }
        final java.util.concurrent.atomic.AtomicBoolean hecho = new java.util.concurrent.atomic.AtomicBoolean(false);
        final Runnable una = () -> { if (hecho.compareAndSet(false, true)) luego.run(); };
        h.postDelayed(una, 600);
        foto30(s, una);
    }
    @android.annotation.TargetApi(30)
    private static void foto30(ControlServicio s, Runnable una) {
        try {
            s.takeScreenshot(android.view.Display.DEFAULT_DISPLAY, s.getMainExecutor(), new TakeScreenshotCallback() {
                @Override public void onSuccess(ScreenshotResult r) {
                    android.graphics.Bitmap sw = null;
                    try {
                        android.hardware.HardwareBuffer hb = r.getHardwareBuffer();
                        android.graphics.Bitmap hw = android.graphics.Bitmap.wrapHardwareBuffer(hb, r.getColorSpace());
                        if (hw != null) { sw = hw.copy(android.graphics.Bitmap.Config.ARGB_8888, false); hw.recycle(); }
                        hb.close();
                    } catch (Exception ignored) { }
                    una.run();
                    final android.graphics.Bitmap bm = sw;
                    if (bm != null) new Thread(() -> {
                        try {
                            float k = Math.min(1f, 1280f / Math.max(bm.getWidth(), bm.getHeight()));
                            android.graphics.Bitmap sc = k < 1f ? android.graphics.Bitmap.createScaledBitmap(bm, Math.round(bm.getWidth() * k), Math.round(bm.getHeight() * k), true) : bm;
                            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                            sc.compress(android.graphics.Bitmap.CompressFormat.JPEG, 80, out);
                            capImg = android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP); capImgT = System.currentTimeMillis();
                            if (sc != bm) sc.recycle(); bm.recycle();
                        } catch (Exception ignored) { }
                    }).start();
                }
                @Override public void onFailure(int code) { una.run(); }
            });
        } catch (Exception e) { una.run(); }
    }
    private static void recorrer(AccessibilityNodeInfo n, StringBuilder b, int d) {
        if (n == null || d > 45 || b.length() > 15000) return;
        if (!n.isPassword()) {
            CharSequence t = n.getText(); if (t == null || t.length() == 0) t = n.getContentDescription();
            if (t != null) { String x = t.toString().trim(); if (!x.isEmpty() && b.indexOf(x) < 0) b.append(x).append('\n'); }
        }
        for (int i = 0; i < n.getChildCount(); i++) recorrer(n.getChild(i), b, d + 1);
    }

    // ======================================================================== 3.11: el agente que maneja tus apps
    static final java.util.List<AccessibilityNodeInfo> nodos = new java.util.ArrayList<>();
    /** Lo que se ve ahora, como lista numerada para la IA: [{i, t, c (tocable), e (escribible), s (desplazable)}] (sin contraseñas). */
    static org.json.JSONObject ui() {
        org.json.JSONObject o = new org.json.JSONObject();
        ControlServicio s = instancia; if (s == null) return o;
        synchronized (nodos) {
            nodos.clear();
            org.json.JSONArray l = new org.json.JSONArray();
            try {
                AccessibilityNodeInfo r = s.getRootInActiveWindow();
                if (r != null) {
                    o.put("pkg", r.getPackageName() == null ? "" : r.getPackageName().toString());
                    juntar(r, l, 0);
                }
                o.put("nodos", l);
            } catch (Exception ignored) { }
        }
        return o;
    }
    private static void juntar(AccessibilityNodeInfo n, org.json.JSONArray l, int d) throws org.json.JSONException {
        if (n == null || d > 40 || nodos.size() >= 160) return;
        if (n.isVisibleToUser()) {
            boolean c = n.isClickable() || n.isLongClickable(), e = n.isEditable(), sc = n.isScrollable();
            CharSequence t = n.getText(), ds = n.getContentDescription();
            String tx = n.isPassword() ? "(contraseña)" : t != null ? t.toString() : "";
            String de = ds != null ? ds.toString() : "";
            if (e && tx.isEmpty() && n.getHintText() != null) tx = "[" + n.getHintText() + "]";
            if (c && tx.isEmpty() && de.isEmpty()) tx = hijos(n, 0);
            if (!tx.isEmpty() || !de.isEmpty() || e || sc) {
                org.json.JSONObject x = new org.json.JSONObject();
                x.put("i", nodos.size());
                String lab = (tx + (de.isEmpty() || de.equals(tx) ? "" : " · " + de)).trim();
                x.put("t", lab.length() > 90 ? lab.substring(0, 90) : lab);
                if (c) x.put("c", 1); if (e) x.put("e", 1); if (sc) x.put("s", 1);
                if (n.isPassword()) x.put("p", 1);
                nodos.add(n); l.put(x);
            }
        }
        for (int k = 0; k < n.getChildCount(); k++) juntar(n.getChild(k), l, d + 1);
    }
    private static String hijos(AccessibilityNodeInfo n, int d) {
        if (n == null || d > 3) return "";
        StringBuilder b = new StringBuilder();
        for (int k = 0; k < n.getChildCount() && b.length() < 80; k++) {
            AccessibilityNodeInfo h = n.getChild(k); if (h == null) continue;
            CharSequence t = h.getText() != null ? h.getText() : h.getContentDescription();
            if (t != null && t.length() > 0) b.append(t).append(' '); else b.append(hijos(h, d + 1));
        }
        return b.toString().trim();
    }
    static boolean tocar(int i) {
        ControlServicio s = instancia; if (s == null) return false;
        AccessibilityNodeInfo n; synchronized (nodos) { if (i < 0 || i >= nodos.size()) return false; n = nodos.get(i); }
        AccessibilityNodeInfo p = n;
        for (int k = 0; k < 6 && p != null; k++) { if (p.isClickable() && p.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true; p = p.getParent(); }
        android.graphics.Rect r = new android.graphics.Rect(); n.getBoundsInScreen(r);
        if (r.isEmpty() || Build.VERSION.SDK_INT < 24) return false;
        android.graphics.Path path = new android.graphics.Path(); path.moveTo(r.exactCenterX(), r.exactCenterY());
        return s.dispatchGesture(new android.accessibilityservice.GestureDescription.Builder().addStroke(new android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 60)).build(), null, null);
    }
    static boolean escribir(int i, String texto) {
        AccessibilityNodeInfo n; synchronized (nodos) { if (i < 0 || i >= nodos.size()) return false; n = nodos.get(i); }
        if (n.isPassword() || !n.isEditable()) return false;                 // nunca escribe contraseñas
        android.os.Bundle b = new android.os.Bundle(); b.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, texto);
        n.performAction(AccessibilityNodeInfo.ACTION_FOCUS);
        return n.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, b);
    }
    static boolean desplazar(boolean abajo) {
        ControlServicio s = instancia; if (s == null) return false;
        synchronized (nodos) { for (AccessibilityNodeInfo n : nodos) if (n.isScrollable() && n.performAction(abajo ? AccessibilityNodeInfo.ACTION_SCROLL_FORWARD : AccessibilityNodeInfo.ACTION_SCROLL_BACKWARD)) return true; }
        if (Build.VERSION.SDK_INT < 24) return false;
        android.util.DisplayMetrics dm = s.getResources().getDisplayMetrics();
        android.graphics.Path path = new android.graphics.Path(); float x = dm.widthPixels / 2f;
        path.moveTo(x, dm.heightPixels * (abajo ? 0.75f : 0.3f)); path.lineTo(x, dm.heightPixels * (abajo ? 0.3f : 0.75f));
        return s.dispatchGesture(new android.accessibilityservice.GestureDescription.Builder().addStroke(new android.accessibilityservice.GestureDescription.StrokeDescription(path, 0, 350)).build(), null, null);
    }

    boolean accion(String a) {
        switch (a) {
            case "inicio": return performGlobalAction(GLOBAL_ACTION_HOME);
            case "atras": return performGlobalAction(GLOBAL_ACTION_BACK);
            case "recientes": return performGlobalAction(GLOBAL_ACTION_RECENTS);
            case "notificaciones": return performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS);
            case "ajustesRapidos": return performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS);
            case "bloquear": return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
            case "captura": return Build.VERSION.SDK_INT >= 28 && performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT);
            default: return false;
        }
    }
}
