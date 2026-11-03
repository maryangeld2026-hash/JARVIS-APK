# Jarvis para Android 3.4: Jarvis aprovecha el celular

## 📱 Jarvis en todo el celular
1. **Jarvis como asistente del celular.** *Ajustes › Jarvis en el celular › Poner a Jarvis como asistente*. Después, mantener presionado el botón de inicio (o el de encendido, según el celular) abre Jarvis escuchando.
2. **Compartir › Jarvis.** Desde WhatsApp, la galería o Archivos, comparte una foto, un PDF, un Word o un texto con Jarvis. Te pregunta qué hacer: resumir, hacer un quiz, explicar, calificar, leer el texto, responder o guardarlo en Material.
3. **El calendario del celular, sin configurar Google Cloud.** «¿Qué tengo mañana?» y «agenda reunión de padres el jueves a las 3» usan el calendario que ya tienes sincronizado con tu cuenta. El evento queda con un aviso 15 minutos antes.
4. **Avisos con botones.** Los recordatorios llegan con «Posponer 10 min» y «Listo». El temporizador se ve corriendo en la notificación y en la pantalla bloqueada, con botón «Parar».
5. **Widget y atajos.** Un widget para la pantalla de inicio con tu clase de ahora o la próxima y un botón para hablar. Al mantener presionado el ícono de Jarvis salen atajos: Hablar, 5 minutos, Calificar y Pasar lista.

## 👩‍🏫 Para la clase
6. **Calificar hojas de burbujas con la cámara, sin internet y sin IA.** En cada quiz toca «🫧 Hojas de burbujas» (o di «prepara las hojas de respuesta del quiz para 7A»). Sale un PDF con una hoja por estudiante, con su nombre, y 3 en blanco. Después, «📷 Calificar hojas»: le tomas foto a cada hoja y Jarvis la endereza, lee las burbujas y te dice la nota al instante. Detecta las preguntas en blanco y la doble marca. Lee la hoja aunque la foto esté torcida, al revés o con sombra. Al final tienes:
   - el **análisis**: el promedio, quiénes van bajo 3,0, las preguntas más difíciles y la opción errada más marcada;
   - las **notas al seguimiento** con un toque;
   - una **guía de refuerzo por estudiante**, con solo las preguntas que falló.

   Si la clave tenía un error, la corriges y Jarvis vuelve a calificar todas las hojas. Los nombres no salen del celular.
7. **Escanear documentos y leer texto sin internet.** En el botón del clip: «Escanear documento» recorta y endereza la hoja sola, y la vuelve un PDF que puedes resumir o convertir en quiz. «Leer texto de una hoja» saca el texto sin internet.
8. **Pasar lista.** «Pasa lista de 7A» abre la lista: tocas un nombre una vez si faltó y otra vez si llegó tarde. También por voz: «faltaron Pablo y Ana en 7A», «llegó tarde Tomás», «¿cuántas fallas tiene Pablo?», «fallas de 7A».
9. **«No molestar» en clase.** Con tu horario, el celular se silencia solo mientras das clase y vuelve a sonar al terminar. Las alarmas sí suenan. Si tú ya habías puesto «No molestar», Jarvis no lo toca.
10. **WhatsApp a los padres.** Cada respuesta trae el botón 💬 WhatsApp, que abre WhatsApp con el texto listo para escoger el contacto. También: «mándalo por WhatsApp».

## ✨ Comodidad
11. **Botones bajo cada respuesta:** Proyectar (en letra grande, con las fórmulas dibujadas), Word, Más corto, Oír, Graficar (si la respuesta trae una función, por ejemplo y = 2x + 1), WhatsApp y Copiar.
12. **Tarjeta «Ahora»:** según tu horario, muestra la clase que estás dando con una barra del tiempo que falta y botones útiles («Escoge un estudiante», «Pasar lista», «5 minutos», «Ticket de salida»). Antes de clase muestra la próxima y «Prepárame la clase». En la noche muestra las clases de mañana. La cabecera dice «EN CLASE · 7A · 12 MIN».
13. **Escoge la voz de Jarvis** entre las voces en español del celular, incluidas las que funcionan sin internet.
14. **Huella, rostro o PIN** para abrir Jarvis (*Ajustes › Seguridad*). Lo vuelve a pedir si la app estuvo cerrada más de minuto y medio.
15. **Tamaño de letra:** normal, grande o muy grande (para proyectar). También por voz: «letra más grande».

*Se instala encima de la 3.3.1, sin perder tus datos.*

---

# Jarvis para Android 3.3.1: ahora sí, el micrófono

- **Encontrado gracias a tu captura:** el error «addListener(...).catch is not a function». En el celular, los avisos de los plugins («te estoy oyendo», «esto es lo que entendí») responden distinto que en las pruebas. La app se caía justo antes de abrir el micrófono, y por eso Jarvis nunca te escuchaba. Ya está corregido en todas partes.
- **Ese mismo error tenía más efectos:** no dejaba arrancar bien «Jarvis en segundo plano» al abrir la app, ni la burbuja flotante. También explica que en versiones anteriores a veces no apareciera el botón de la cámara. Todo queda arreglado.
- Ahora las pruebas automáticas imitan exactamente cómo responde el celular, para que esto no vuelva a pasar.

*Se instala encima de la 3.3, sin perder tus datos.*

---

# Jarvis para Android 3.3: el micrófono, arreglado de raíz

- **La causa:** con «Jarvis en segundo plano» activo, ese servicio seguía usando el micrófono cuando tocabas el orbe. La app esperaba solo un cuarto de segundo a que lo soltara, pero tarda hasta un segundo y medio. Mientras tanto, Android le daba silencio al reconocedor de voz, y por eso Jarvis no te oía. Ahora la conversación espera a que el micrófono quede libre de verdad antes de escuchar.
- **Tres caminos para oírte:** si el reconocimiento de Google falla en tu celular, Jarvis prueba solo el reconocimiento integrado del celular (Android 12 o más nuevo). Si ese tampoco sirve, usa la voz sin internet (Vosk, la misma de «Jarvis en segundo plano», si ya la descargaste). Recuerda el que funcionó.
- **Ves lo que pasa:** al tocar el orbe, se pone verde de una vez y dice «Abriendo el micrófono…» y luego **«🎙️ Habla ahora…»**. Si no te oyó, te dice por qué en vez de quedarse callado.
- **Nuevo: Ajustes › Voz › 🎙️ Probar el micrófono.** Revisa el permiso, qué reconocedores tiene tu celular y si «Jarvis en segundo plano» tiene el micrófono, y hace una escucha de prueba con cada camino. Si algo falla, una captura de esa pantalla dice exactamente qué es.

*Se instala encima de la 3.2, sin perder tus datos.*

---

# Jarvis para Android 3.2: IA sin internet, documentos, cámara y más

## 🎙️ El orbe del micrófono
- Tocar el orbe siempre hace algo. Si Jarvis ya estaba escuchando y no habías dicho nada, vuelve a escuchar desde cero (antes parecía no responder). Si ya dijiste algo, tocarlo lo envía.
- Vibra un poco al tocarlo, y responde al toque en todo el círculo.
- Si el oído nuevo de la 3.1 no arranca en tu celular, Jarvis vuelve solo al reconocimiento de antes.

## 💾 Botón «Guardar ajustes»
- Abajo en Ajustes, siempre visible. Guarda todo de una vez y cierra. Además, Jarvis guarda solo cuando minimizas o sales.

## 🧠 Otras IA e IA sin internet
- **Más proveedores:** Groq (muy rápida, con nivel gratuito), OpenRouter, DeepSeek, Mistral y **tu propio servidor** (Ollama o LM Studio en el PC, por el wifi y sin costo). Están en *Ajustes › Otra IA*.
- **IA de respaldo:** si no hay internet, o la principal tarda o está saturada, Jarvis responde con la de respaldo. Debajo de la respuesta dice cuál contestó.
- **IA del celular (sin internet):** un modelo abierto (Qwen 2.5) que corre dentro del celular. Se descarga una vez: la liviana pesa 550 MB y la mejor 1,6 GB (para celulares con 6 GB de RAM o más). Es más lenta y sencilla que las de internet, y no ve fotos. Está en *Ajustes › IA de respaldo › IA del celular*.

## 📎 Adjuntar en el chat
- El botón junto al campo de escribir ahora abre un menú: **Tomar foto** (abre la cámara), **Foto de la galería** o **Documento**.
- Documentos: PDF, Word (.docx), Excel (.xlsx, .xls, .ods, .csv), PowerPoint (.pptx), OpenDocument (.odt) y texto. Escribe tu pregunta antes de escogerlo («hazme un quiz con esto»). Si no escribes nada, te lo resume.
- **La cámara ya abre de verdad.** Faltaba un permiso de Android 11 y más nuevos, y por eso abría la galería en vez de la cámara. También se arregla «Tomar foto» en la pestaña Clase.

## ⏻ Minimizar o salir
- Nuevo botón arriba a la derecha: **Minimizar** (Jarvis sigue detrás y, si lo activaste, escuchando «Jarvis») o **Salir de Jarvis**. También por voz: «minimízate» o «sal de Jarvis».

*Se instala encima de la 3.1, sin perder tus datos. El APK pesa más porque trae el motor de la IA del celular. El modelo se descarga aparte, solo si lo pides.*

---

# Jarvis para Android 3.1: la conversación ya no se traba

## 👂 Escucha de verdad
- **Oído nuevo, hecho para Jarvis.** La pieza de voz que usaba la app perdía los avisos de Android: si no te oía, Jarvis se quedaba hasta 20 segundos esperando sin hacer nada, y a veces cortaba antes de que llegara tu frase completa. Ahora la app usa su propio reconocimiento: siempre termina, con lo que dijiste o en «En espera» si no oyó nada.
- Si Android tiene el micrófono ocupado justo después de que Jarvis habla, lo reintenta solo.
- Corta más rápido cuando dejas de hablar (poco más de un segundo de silencio).
- Si falta algo del celular (permiso del micrófono, internet para la voz, el español), te dice qué es.

## ⚡ La IA ya no se queda «pensando»
- **Vigilante de tiempo:** si la IA no empieza a contestar en 15 segundos, o se queda quieta a mitad de la respuesta, Jarvis corta y **reintenta solo**.
- **Modelo saturado:** cuando Gemini responde «saturado» (pasa seguido en horas pico), Jarvis prueba con otro modelo rápido de tu cuenta, sin que hagas nada. Mientras tanto verás «reintento…».
- La búsqueda del modelo de tu cuenta ya no puede colgar la primera pregunta.

## 📱 Se ve y se redibuja mejor
- **El botón de la cámara** (junto al campo de escribir) ahora aparece siempre: antes, si otra parte de la app fallaba al arrancar, ese botón no alcanzaba a ponerse.
- Si una parte de Jarvis falla al abrir, el resto sigue funcionando y sale un aviso con el error.
- En reposo el reactor queda quieto (gira cuando escucha, piensa o habla), la conversación se dibuja aparte y las luces solo se redibujan cuando cambian: menos trabajo para el celular y sin rastros en la pantalla.

*Se instala encima de la 3.0.2, sin perder tus datos.*

---

# Jarvis para Android 3.0.2: Ajustes siempre a mano

- **Ya puedes entrar a Ajustes.** Con «Manos libres» o el modo tutor activos, sus avisos empujaban el botón de Ajustes (el engranaje) fuera de la pantalla. Ahora esos avisos bajan a su propia fila y el engranaje siempre se ve.
- **Letra grande del celular:** si tienes la letra del sistema muy grande, la app la limita un poco para que la barra de arriba quepa.
- **Más formas de abrir Ajustes:** toca la palabra **JARVIS** arriba a la izquierda, o di «abre los ajustes».
- **Ajustes abre aunque algo falle:** si una sección no carga, el resto se muestra igual y sale un aviso con el error.

*Se instala encima de la 3.0.1, sin perder tus datos.*

---

# Jarvis para Android 3.0.1: se ve bien y va más fluido en el celular

- **Ya no queda debajo de las barras de Android.** En Android 15 y más nuevos, la app quedaba detrás de la barra de estado (arriba) y de los botones de Android (abajo). Ahora respeta esos márgenes en todos los celulares.
- **Barra superior que cabe** en celulares angostos: en pantallas chicas se oculta el texto del estado, pero quedan las luces de colores.
- **Más fluido:** las animaciones del reactor son más livianas, y las respuestas largas (documentos, investigaciones) se dibujan menos veces mientras llegan, así que el celular no se traba.
- **Menos interrupciones:** cuando la conversación continua no te oye, ya no sale el aviso «No te oí» encima de los botones. Solo dice «En espera». Los avisos ahora salen arriba.

*Se instala encima de la 3.0, sin perder tus datos.*

---

# Jarvis para Android 3.0: las habilidades del Jarvis del computador

Revisé una por una las 102 habilidades del Jarvis de Windows. Con esta versión, la app hace la gran mayoría.

## 📄 Material con IA (se guarda en la pestaña **Material**, para Word, PDF, compartir o escuchar)
- «Planéame la clase de fracciones», «hazme una guía de funciones», «rúbrica para la exposición», «hazme el solucionario del taller de…».
- «Redacta un correo a los padres de 7A sobre…», «escribe una circular para…», «agenda de la reunión de área», «haz el acta de la reunión: …».
- «Planea mi periodo de geometría», «actividades de refuerzo de…», «adapta la clase de fracciones para un estudiante con TDAH», «explícale a los padres…».
- «Retroalimenta este texto de Ana: …», «nivela este texto para grado 5: …».
- «Podcast de repaso de porcentajes»: guion que Jarvis te lee en voz alta.
- «Informe para la familia de Pablo Mora» y «plan de recuperación de 8B». A la IA solo van las notas, sin el nombre: el nombre lo pone el celular.

## 👩‍🏫 Seguimiento y clase
- **Observador:** «anota en el observador de Pablo que…», «¿qué hay en el observador de Pablo?».
- **Diario de clase:** «hoy en 7A vimos fracciones», «¿qué vimos en 7A?».
- **Compromisos:** «quedé en mandar la guía…», «¿qué compromisos tengo?», «ya le mandé la guía».
- **Horario** (en Ajustes): «¿qué clase tengo ahora?». La clase actual y la siguiente salen en el panel Hoy.
- **Periodo:** «el periodo termina el 28 de noviembre», «¿cuánto falta para cerrar el periodo?».
- «¿Cuánto necesita Tomás para pasar?», «¿quiénes pueden perder el año?», «¿quién viene bajando?», «¿a quién debo felicitar?», «ficha de Pablo».
- «¿Cómo viene mi día?», «¿qué hiciste hoy?», «resumen semanal», «haz mi retrospectiva».
- **Mapa de errores:** los errores más comunes de los trabajos calificados con foto, con actividades de refuerzo.

## 🧮 Herramientas
- **Gráficas:** «grafica y = x^2 - 4», con pantalla completa para proyectar. Usa un evaluador propio: nunca ejecuta código.
- **Investigar en internet:** «investiga…», con las fuentes. Usa la Búsqueda de Google a través de Gemini.
- **Pregunta por una foto:** el botón 📷 junto al campo de escribir («¿qué dice el tablero?», «resuelve este ejercicio»).
- **Tarjetas de estudio:** «tarjetas de estudio sobre potencias». Se voltean y se exportan a Anki.
- **Simulacro Saber:** «hazme un simulacro Saber de geometría».
- **Kahoot:** botón en cada quiz, junto a Word, PDF, Forms y Proyectar.
- **Personalidad** («ponte relajado», «ponte serio») y **asignatura** («estamos en tecnología»).

## Lo que solo hace el computador
Controlar el computador (abrir programas, teclado y mouse), llenar Zeti en su navegador, el copiloto que mira la pantalla, el quiz en vivo con los celulares de los estudiantes, leer hojas de respuesta con la cámara y el turno de noche. Para eso, desde el celular di «en el computador…».

*Se instala encima de la 2.2, sin perder tus datos.*

---

# Jarvis para Android 2.2.1: conversación continua, «Jarvis» en segundo plano y el HUD

## 💬 La conversación sigue sola
- Después de responder, Jarvis vuelve a escucharte sin que toques el micrófono, como en el computador. Si no dices nada, se queda en espera.
- Si prefieres tocar cada vez, apaga **Seguir** (junto al micrófono).

## 👂 Di «Jarvis» aunque estés en otra app
- *Ajustes › «Jarvis» en segundo plano › Escuchar «Jarvis» siempre.*
- Jarvis escucha su nombre aunque estés en otra app o con la pantalla apagada, y se abre para atenderte. Si dices «Jarvis, pon 5 minutos» de corrido, hace la orden de una vez.
- **Sin internet:** el reconocimiento de la palabra corre en el celular (Vosk, el mismo motor del Jarvis del computador) y el audio no sale de ahí. La primera vez descarga el modelo de voz, unos 40 MB.
- Pide dos permisos: el micrófono y «Mostrar sobre otras apps». Mientras escucha, se ve un aviso fijo de Jarvis. Mientras conversan, la escucha de fondo se pausa sola.
- Para que Android no lo apague: *Ajustes › Que Android no lo apague*. Gasta algo más de batería.
- Por voz: «escúchame siempre» o «deja de escuchar en segundo plano».

## 🟦 El HUD del computador, en el celular
- **El reactor:** el botón del micrófono ahora es el reactor de Jarvis. Los anillos giran y cambian de color según lo que hace: verde cuando escucha, ámbar cuando piensa, y late cuando habla.
- **Las luces de estado**, arriba: micrófono, IA, internet y escucha de fondo.
- **El panel «Hoy»:** la hora, el temporizador que corre, el próximo recordatorio, cuántos van en riesgo en el curso y botones de sugerencia según el momento del día.
- **La burbuja flotante** cambia de color con el estado y muestra la última respuesta en un globo. Así sigues a Jarvis desde otra app, como con la vista previa del HUD.

*Se instala encima de la 2.1, sin perder tus datos. (2.2.1: el APK pesa menos.)*

---

# Jarvis para Android 2.1: respuestas más rápidas

## ⚡ La IA empieza a contestar antes
- **Sin «pensar» para conversar.** Los modelos rápidos de Gemini y ChatGPT razonaban por dentro antes de escribir la primera palabra, y eso tomaba varios segundos. Ahora Jarvis les pide responder de una vez, igual que el Jarvis del computador. Si un modelo no acepta ese ajuste, Jarvis lo quita solo y lo recuerda.
- **La conexión se abre mientras hablas.** Al tocar el micrófono (o el campo para escribir), Jarvis ya se conecta con la IA, así que cuando terminas de hablar la pregunta sale enseguida.
- **Cero silencio.** Si la IA tarda en arrancar, Jarvis dice algo corto de inmediato («A ver…», «Voy con eso…») y luego la respuesta.
- **Cuánto tardó.** Debajo de cada respuesta aparece el tiempo hasta la primera palabra (⚡ 0,9 s), para que veas la diferencia.

*Se instala encima de la 2.0, sin perder tus datos.*

---

## Lo que trajo la 2.0

El asistente de la clase en el celular, sin el computador. Esta versión suma casi todo lo que hace el Jarvis de Windows.

> ⚠️ **Si tienes instalada la 1.0, desinstálala antes de instalar la 2.0.** La 2.0 viene con una firma nueva y fija: desde ahora las versiones se instalan una encima de la otra. Si tenías datos en la 1.0, primero toca *Ajustes › Guardar copia* y después restáuralos en la 2.0.

## 📊 Seguimiento de notas
- **Importa tu planilla de Excel.** Cada hoja se vuelve un curso, con sus estudiantes y actividades. Jarvis reconoce las columnas de nombres y de notas e ignora la definitiva, el número de lista y las observaciones.
- Promedio del curso, distribución por desempeño (bajo, básico, alto, superior) con la escala de tu colegio, y **quién está en riesgo**.
- Planilla para ver y editar: tocas una casilla y cambias la nota. Puedes agregar actividades con su peso.
- Por voz: «¿quién está en riesgo en 8B?», «¿cómo va Pablo Mora?», «ponle 4,5 a Pablo en el quiz 1».
- La nota de una foto calificada se guarda en el seguimiento con un toque.
- **Exportar a Excel** para pasarla a la plataforma.
- Las notas y los nombres **nunca** se mandan a la IA: todo esto se calcula en el celular.

## 🧠 Memoria y lecciones
- «Recuerda que los lunes tengo reunión de área», «de ahora en adelante los quices con 5 preguntas», «¿qué sabes de mí?», «olvida que…».
- Jarvis lo tiene en cuenta en cada respuesta. Lo ves y lo borras en Ajustes.

## 👩‍🏫 Para la clase
- **Modo proyector.** Una pantalla grande, de lado, para transmitir al televisor o al videobeam (Transmitir o Smart View): temporizador, estudiante escogido, grupos, el quiz pregunta por pregunta con «Mostrar respuesta», el paso a paso y el ticket de salida.
- **Modo tutor socrático.** «Modo tutor de fracciones»: guía a los estudiantes con preguntas y pistas, sin darles la respuesta.
- **Paso a paso.** «Explícame paso a paso cómo resolver 2x + 3 = 11», con los pasos uno a uno en el proyector.
- **Ticket de salida.** «Ticket de salida de fracciones»: tres preguntas en el proyector y un semáforo para contar quién entendió.

## 📝 Quices
- Además del PDF y WhatsApp: **Word (.docx)** y **Google Forms**, como cuestionario que se califica solo, con la clave y las explicaciones.

## 🔗 Google
- **Calendario:** «¿qué tengo hoy?», «agenda reunión de padres mañana a las 3 de la tarde».
- **Classroom:** «trae los estudiantes de Classroom» crea tus cursos con sus listas.
- **Drive:** copia de tus datos (automática una vez al día) y restauración en otro celular.
- *Requiere un trámite de una sola vez en Google Cloud: los pasos están en el README del repositorio.*

## 🙌 Manos libres
- **«Jarvis, …»:** con *Manos libres* activo y la app abierta, Jarvis escucha y solo atiende lo que empieza por «Jarvis».
- **Burbuja flotante:** un botón de Jarvis encima de las otras apps. Lo tocas y te escucha; lo arrastras a donde quieras. Pide el permiso «Mostrar sobre otras apps».

## 🖥️ El Jarvis del computador
- Pega en Ajustes la dirección del «panel del celular» de tu Jarvis de Windows. Después, «en el computador abre Word» manda la orden al computador, en el mismo wifi.

---
*Se instala directo (no está en la Play Store). Desde esta versión, las nuevas se instalan encima sin perder tus datos.*
