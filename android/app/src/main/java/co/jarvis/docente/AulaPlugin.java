package co.jarvis.docente;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Jarvis 3.6: la práctica con QR. El celular de la profe sirve una página en el wifi del salón (o en su punto de acceso);
 * los estudiantes escanean el QR, responden y el celular los califica al instante. Sin internet.
 *   iniciar({pagina, clave}) → {puerto}     detener()     evento «respuesta» {nombre, resp, aciertos, total, ip}
 * La clave se queda en el celular: la página de los estudiantes no la trae.
 */
@CapacitorPlugin(name = "Aula")
public class AulaPlugin extends Plugin {
    private ServerSocket server;
    private volatile String pagina = "";
    private volatile int[] clave = new int[0];
    private final ExecutorService pool = Executors.newFixedThreadPool(8);

    @PluginMethod
    public void iniciar(PluginCall call) {
        pagina = call.getString("pagina", "<h1>Jarvis</h1>");
        try {
            JSONArray c = call.getArray("clave", new JSArray());
            clave = new int[c.length()];
            for (int i = 0; i < c.length(); i++) clave[i] = c.getInt(i);
        } catch (Exception e) { clave = new int[0]; }
        if (server != null && !server.isClosed()) { JSObject r = new JSObject(); r.put("puerto", server.getLocalPort()); call.resolve(r); return; }
        int puerto = 0;
        for (int p = 8777; p < 8787 && server == null; p++) {
            try { ServerSocket s = new ServerSocket(); s.setReuseAddress(true); s.bind(new InetSocketAddress(p)); server = s; puerto = p; } catch (Exception ignored) { }
        }
        if (server == null) { call.reject("No pude abrir la práctica en el wifi."); return; }
        final ServerSocket s = server;
        new Thread(() -> {
            while (!s.isClosed()) {
                try { final Socket cl = s.accept(); pool.execute(() -> atender(cl)); } catch (Exception e) { break; }
            }
        }, "jarvis-aula").start();
        JSObject r = new JSObject(); r.put("puerto", puerto); call.resolve(r);
    }

    @PluginMethod
    public void detener(PluginCall call) {
        try { if (server != null) server.close(); } catch (Exception ignored) { }
        server = null;
        call.resolve();
    }

    private void atender(Socket cl) {
        try {
            cl.setSoTimeout(8000);
            BufferedReader in = new BufferedReader(new InputStreamReader(cl.getInputStream(), StandardCharsets.UTF_8));
            String linea = in.readLine();
            if (linea == null) { cl.close(); return; }
            String[] p = linea.split(" ");
            String metodo = p[0], ruta = p.length > 1 ? p[1] : "/";
            int largo = 0; String h;
            while ((h = in.readLine()) != null && !h.isEmpty()) if (h.toLowerCase().startsWith("content-length:")) largo = Integer.parseInt(h.substring(15).trim());
            if (metodo.equals("POST") && ruta.startsWith("/r")) {
                largo = Math.min(largo, 20000);
                char[] b = new char[largo]; int n = 0;
                while (n < largo) { int k = in.read(b, n, largo - n); if (k < 0) break; n += k; }
                JSONObject o = new JSONObject(new String(b, 0, n));
                String nombre = o.optString("nombre", "").trim();
                if (nombre.length() > 60) nombre = nombre.substring(0, 60);
                JSONArray resp = o.optJSONArray("resp");
                int ok = 0;
                JSArray rr = new JSArray();
                for (int i = 0; i < clave.length; i++) { int v = resp != null ? resp.optInt(i, -1) : -1; rr.put(v); if (v == clave[i]) ok++; }
                JSObject ev = new JSObject();
                ev.put("nombre", nombre); ev.put("resp", rr); ev.put("aciertos", ok); ev.put("total", clave.length);
                ev.put("ip", cl.getInetAddress().getHostAddress());
                notifyListeners("respuesta", ev);
                responder(cl, "200 OK", "application/json", "{\"ok\":true,\"aciertos\":" + ok + ",\"total\":" + clave.length + "}");
            } else if (metodo.equals("GET")) {
                responder(cl, "200 OK", "text/html; charset=utf-8", pagina);
            } else responder(cl, "404 Not Found", "text/plain", "no");
        } catch (Exception e) {
            try { cl.close(); } catch (Exception ignored) { }
        }
    }

    private void responder(Socket cl, String estado, String tipo, String cuerpo) throws Exception {
        byte[] b = cuerpo.getBytes(StandardCharsets.UTF_8);
        OutputStream out = cl.getOutputStream();
        out.write(("HTTP/1.1 " + estado + "\r\nContent-Type: " + tipo + "\r\nContent-Length: " + b.length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(b);
        out.flush();
        cl.close();
    }

    @Override
    protected void handleOnDestroy() { try { if (server != null) server.close(); } catch (Exception ignored) { } }
}
