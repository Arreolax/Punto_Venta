async function generarTicketPDF(folio) {
  const input = document.getElementById('ticket-pdf');

  const canvas = await html2canvas(input, {
    scale: 3,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');

  // 🔹 Ancho fijo real del ticket (80mm)
  const pdfWidth = 80; 

  // 🔹 Calcular alto proporcionalmente
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pdfWidth, pdfHeight],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`ticket_${folio}.pdf`);
}
