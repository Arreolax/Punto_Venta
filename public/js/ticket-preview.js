// Funcionalidades del preview de tickets

document.addEventListener('DOMContentLoaded', () => {
  // Boton Regresar
  const btnRegresar = document.getElementById('btnRegresar');

  if (btnRegresar) {
    btnRegresar.addEventListener('click', () => {
      if (document.referrer) {
        // Regresa a la pagina anterior y la recarga
        window.location.href = document.referrer;
      } else {
        // fallback si no hay historial
        window.history.back();
        setTimeout(() => location.reload(), 100);
      }
    });
  }

  // Boton Imprimir Ticket
  const btnImprimirTicket = document.getElementById('btnImprimirTicket');
  if (btnImprimirTicket) {
    btnImprimirTicket.addEventListener('click', () => {
      const folio = btnImprimirTicket.dataset.folio;
      imprimirTicketTermico(folio);
    });
  }

  // Boton Descargar PDF
  const btnGenerarPDF = document.getElementById('btnGenerarPDF');
  if (btnGenerarPDF) {
    btnGenerarPDF.addEventListener('click', () => {
      const folio = btnGenerarPDF.dataset.folio;
      generarTicketPDF(folio);
    });
  }
});
