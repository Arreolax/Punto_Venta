function imprimirTicketTermico(folio) {
    const printContent = document.getElementById('ticket-thermal-content');
    if (!printContent) return;

    const win = window.open('', '_blank', 'width=302,height=600');
    
    // Obtener todas las hojas de estilo externas
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(link => `<link rel="stylesheet" href="${link.href}">`)
        .join('\n');
    
    // Obtener todos los estilos inline del documento
    const inlineStyles = Array.from(document.querySelectorAll('style'))
        .map(style => `<style>${style.innerHTML}</style>`)
        .join('\n');

    // Clonar el contenedor para obtener los estilos computados
    const clonedContent = printContent.cloneNode(true);
    
    // Construir el documento HTML para impresión
    const printHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticket ${folio}</title>
            ${stylesheets}
            ${inlineStyles}
            <style>
                @page { 
                    margin: 0; 
                    size: 80mm auto;
                }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    width: 80mm;
                    margin: 0;
                    padding: 0;
                }
                #ticket-thermal-content {
                    width: 100%;
                }
                #ticket-pdf {
                    width: 100% !important;
                }
            </style>
        </head>
        <body>
            ${printContent.innerHTML}
        </body>
        </html>
    `;
    
    win.document.write(printHTML);
    win.document.close();
    
    // Esperar a que se carguen los estilos antes de imprimir
    setTimeout(() => {
        win.focus();
        win.print();
        win.close();
    }, 500);
}
