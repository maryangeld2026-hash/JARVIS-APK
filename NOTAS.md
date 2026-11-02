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
