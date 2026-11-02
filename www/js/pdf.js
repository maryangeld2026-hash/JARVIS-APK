/* Jarvis para Android · el PDF de los quices (para imprimir o mandar por WhatsApp). jsPDF y la letra se cargan solo al usarlos. */
(function () {
  "use strict";
  const L = window.JL;
  let ready = null;
  function load(src) {
    return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No pude cargar " + src)); document.head.appendChild(s); });
  }
  function libs() {
    if (!ready) ready = Promise.all([window.jspdf ? 0 : load("vendor/jspdf.umd.min.js"), window.JARVIS_FUENTE ? 0 : load("vendor/fuente-pdf.js")]);
    return ready;
  }
  /** → base64 del PDF. opt: {curso, clave (agrega la hoja de respuestas), version ("A"/"B")} */
  async function quizPDF(quiz, opt = {}) {
    await libs();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "letter" });
    doc.addFileToVFS("dv.ttf", window.JARVIS_FUENTE.regular); doc.addFont("dv.ttf", "DV", "normal");
    doc.addFileToVFS("dvb.ttf", window.JARVIS_FUENTE.bold); doc.addFont("dvb.ttf", "DV", "bold");
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 18, CW = W - 2 * M;
    let y = M;
    const need = (h) => { if (y + h > H - 16) { foot(); doc.addPage(); y = M; } };
    let page = 1;
    function foot() {
      doc.setFont("DV", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
      doc.text(`${quiz.titulo}${opt.version ? " · versión " + opt.version : ""} · página ${page}`, W / 2, H - 9, { align: "center" });
      doc.setTextColor(0); page++;
    }
    const text = (s, size, bold, indent = 0, gap = 1.6) => {
      doc.setFont("DV", bold ? "bold" : "normal"); doc.setFontSize(size);
      const lines = doc.splitTextToSize(L.plainMath(s), CW - indent);
      const lh = size * 0.42;
      lines.forEach((ln) => { need(lh); doc.text(ln, M + indent, y + lh * 0.8); y += lh; });
      y += gap;
    };
    // encabezado
    text(quiz.titulo + (opt.version ? `  (versión ${opt.version})` : ""), 16, true, 0, 3);
    doc.setFont("DV", "normal"); doc.setFontSize(10.5);
    need(16);
    doc.text("Nombre: ______________________________________", M, y + 4);
    doc.text("Curso: " + (opt.curso || "________"), M + CW * 0.68, y + 4);
    doc.text("Fecha: ____________________", M, y + 11);
    doc.text("Nota: ______", M + CW * 0.68, y + 11);
    y += 17;
    if (quiz.instrucciones) text(quiz.instrucciones, 10.5, false, 0, 3);
    doc.setDrawColor(180); doc.line(M, y, W - M, y); y += 5;
    const LET = "abcdef";
    quiz.preguntas.forEach((q, i) => {
      need(18);
      text(`${i + 1}. ${q.enunciado}`, 11.5, true, 0, 1.2);
      q.opciones.forEach((o, k) => text(`${LET[k]})  ${o}`, 11, false, 6, 0.6));
      y += 3.5;
    });
    if (opt.clave) {
      foot(); doc.addPage(); y = M;
      text("Respuestas" + (opt.version ? ` (versión ${opt.version})` : ""), 15, true, 0, 3);
      quiz.preguntas.forEach((q, i) => {
        text(`${i + 1}. ${LET[q.correcta]})  ${q.opciones[q.correcta]}`, 11, true, 0, 0.6);
        if (q.explicacion) text(q.explicacion, 10, false, 6, 2.2);
      });
    }
    foot();
    return doc.output("datauristring").split(",")[1];
  }
  window.JPDF = { quizPDF, libs };
})();
