package co.jarvis.docente;

import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.KeyStore;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Jarvis 3.7: la llave para cifrar los datos de estudiantes en el celular. Es aleatoria y vive cifrada con el
 * almacén de llaves de Android (Keystore): no sale del celular y no viaja en las copias de seguridad.
 *   obtener() → {llave: base64 de 32 bytes}
 */
@CapacitorPlugin(name = "Llavero")
public class LlaveroPlugin extends Plugin {
    private static final String ALIAS = "jarvis_datos";

    private SecretKey maestra() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build());
        return kg.generateKey();
    }

    @PluginMethod
    public void obtener(PluginCall call) {
        try {
            SharedPreferences sp = getContext().getSharedPreferences("jarvis_llavero", 0);
            SecretKey k = maestra();
            String guardada = sp.getString("llave", null);
            byte[] llave;
            if (guardada != null) {
                byte[] all = Base64.decode(guardada, Base64.NO_WRAP), iv = java.util.Arrays.copyOfRange(all, 0, 12), ct = java.util.Arrays.copyOfRange(all, 12, all.length);
                Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.DECRYPT_MODE, k, new GCMParameterSpec(128, iv));
                llave = c.doFinal(ct);
            } else {
                llave = new byte[32]; new SecureRandom().nextBytes(llave);
                Cipher c = Cipher.getInstance("AES/GCM/NoPadding"); c.init(Cipher.ENCRYPT_MODE, k);
                byte[] iv = c.getIV(), ct = c.doFinal(llave), all = new byte[iv.length + ct.length];
                System.arraycopy(iv, 0, all, 0, iv.length); System.arraycopy(ct, 0, all, iv.length, ct.length);
                sp.edit().putString("llave", Base64.encodeToString(all, Base64.NO_WRAP)).apply();
            }
            JSObject r = new JSObject(); r.put("llave", Base64.encodeToString(llave, Base64.NO_WRAP)); call.resolve(r);
        } catch (Exception e) { call.reject("No pude abrir la llave de los datos: " + e.getMessage()); }
    }
}
