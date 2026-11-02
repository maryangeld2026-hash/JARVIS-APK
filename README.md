# Jarvis para Android (JARVIS-APK)

**Descargar la app:** en [Releases](https://github.com/maryangeld2026-hash/JARVIS-APK/releases/latest), el archivo `Jarvis-android-X.Y.apk`. Cómo instalarla, en [NOTAS.md](NOTAS.md).

La app de [Jarvis](https://github.com/zaiddia/Jarvis) para el celular, independiente del computador: conversación por voz con IA (Gemini, ChatGPT o Claude),
herramientas de la clase (cursos, estudiante al azar, grupos, temporizador, recordatorios, calificar la foto de un trabajo)
y quices en PDF o por WhatsApp. Lo que hace está en [NOTAS.md](NOTAS.md).

## Cómo está hecha
- **Una sola app web** en `www/` (HTML, CSS y JavaScript, sin compilar). Funciona igual en Chrome del celular y dentro del APK.
- **Capacitor** la empaqueta como app de Android (`android/`) y le da lo nativo:
  - reconocimiento de voz: `@capacitor-community/speech-recognition`;
  - voz del teléfono: `@capacitor-community/text-to-speech`;
  - avisos programados: `@capacitor/local-notifications`;
  - compartir archivos: `@capacitor/share` y `@capacitor/filesystem`;
  - pantalla encendida mientras corre el temporizador: `@capacitor-community/keep-awake`.

  En el navegador usa lo equivalente de Chrome.
- **La IA** se llama directo desde el celular con la clave que pone la profe (se guarda solo en el celular). Las peticiones se arman en `www/js/logica.js`.
- **Seguridad:** nunca se ejecuta código que escriba la IA. Los quices y las revisiones de fotos llegan como JSON y se validan antes de mostrarse. Todo el texto se escapa; solo se inserta el HTML de KaTeX.
- **Privacidad:** a la IA nunca se mandan nombres de estudiantes. Para calificar va solo la foto; para un quiz, el tema y el grado.

| Archivo | Qué hace |
|---|---|
| `www/js/logica.js` | Lógica pura (órdenes por voz, azar, grupos, tiempos, recordatorios, quices, notas, peticiones a la IA). Se prueba con node. |
| `www/js/ia.js` | Habla con la IA en streaming y escoge el modelo rápido de la cuenta. |
| `www/js/voz.js` | Escuchar y hablar (nativo o web), avisos, compartir y pantalla encendida. |
| `www/js/datos.js` | Datos en el celular, copia y restauración. |
| `www/js/pdf.js` | PDF de los quices (jsPDF, con letra DejaVu para tildes y símbolos). |
| `www/js/app.js` | La pantalla. |

## Pruebas
```
npm ci
node --test pruebas/logica.test.js        # lógica
python3 pruebas/e2e.py capturas           # de punta a punta en un celular simulado (Playwright), con la IA simulada
```

## Compilar el APK
**Con GitHub (recomendado).** El flujo `.github/workflows/android.yml` compila el APK en cada cambio. Queda en la pestaña *Actions* del repositorio, como artefacto «Jarvis-android-X.Y». La primera vez, y cada vez que subas la versión en `package.json`, además publica la Release `vX.Y` con el APK listo para descargar en el celular.

**En tu computador**, con Android Studio (o el SDK de Android y Java 21):
```
npm ci
npx cap sync android
cd android && ./gradlew assembleDebug      # → app/build/outputs/apk/debug/app-debug.apk
```
También puedes abrir la carpeta `android` en Android Studio y pulsar ▶ con el celular conectado por USB.

El APK de depuración sirve para instalarlo directo en el celular. Para la Play Store hace falta firmar una versión `release` con una llave propia, que se guarda como secreto del repositorio, y una cuenta de desarrollador de Google (pago único de 25 USD).

## Versión web (opcional)
La carpeta `www/` funciona como página instalable desde Chrome. Para publicarla en GitHub Pages:
1. Crea la variable del repositorio `JARVIS_PAGINA` con el valor `1` (*Settings › Secrets and variables › Actions › Variables*).
2. En *Settings › Pages*, escoge «GitHub Actions» como fuente.

Después, en el celular, abre la página y toca *menú › Agregar a la pantalla principal*. En la versión web, los recordatorios solo avisan con la página abierta; en el APK avisan siempre.
