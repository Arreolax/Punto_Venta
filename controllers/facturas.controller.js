const facturaService = require('../services/facturas.service');
const { usoCFDI, regimenFiscal } = require("../config/catalogos");

const getDataF = async (req, res) => {
  try {
    const { folio } = req.params;

    const data_emisor = {
      nombre: process.env.EMI_NAME,
      rfc: process.env.EMI_RFC,
      regimen: process.env.EMI_REGIMEN,
      direccion: process.env.EMI_DIRECCION,
      cp: process.env.EMI_CP,
      telefono: process.env.EMI_TELEFONO,
      correo: process.env.EMI_CORREO,
      cp_local: process.env.EMI_CP_LOCAL
    };

    let data_receptor = {};
    let tickets = [];

    if (folio) {
      data_receptor = await facturaService.getTicketInfo(folio);

      tickets = [data_receptor];

    } else {
      tickets = [];
    }

    res.render('facturas/newinvoice', {
      data_emisor,
      data_receptor,
      folio,
      tickets
    });

  } catch (error) {
    console.error(error);
    res.render('facturas/newinvoice', {
      error: 'Error al cargar los datos de la factura'
    });
  }
};

const getTicketByFolio = async (req, res) => {
  try {
    const { folio } = req.params;

    const ticket = await facturaService.getTicketInfo(folio);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    res.json(ticket);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const tickets = await facturaService.getAllTickets();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo tickets' });
  }
};

const getTicketsByCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const tickets = await facturaService.getTicketsPerUser(id);
    res.json(tickets || []);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo tickets del cliente' });
  }
};
//
const InvoiceInfo = async (req, res) => {
  try {

    const {
      userId,
      clienteId,
      ticketFolio,
      moneda,
      tipoComprobante,
      metodoPago,
      formaPago,
      usoCfdi,
      productos
    } = req.body;

    if (!userId || !clienteId || !ticketFolio || !productos || productos.length === 0) {
      return res.status(400).json({
        error: 'Faltan Datos: UserId, clienteId, ticketFolio o productos son Requeridos.'
      });
    }

    const resultadoFactura = await facturaService.procesarFactura({
      userId,
      clienteId,
      ticketFolio,
      moneda,
      tipoComprobante,
      metodoPago,
      formaPago,
      usoCfdi,
      productos
    });

    return res.status(200).json({
      mensaje: 'Factura Timbrada Correctamente',
      data: resultadoFactura
    });

  } catch (error) {
    console.error('Error en el controlador InvoiceInfo:', error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Error interno al procesar la factura.'
    });
  }
};

const Invoices = async (req, res) => {
  try {
    const filters = req.query || {};

    const invoices = await facturaService.getInvoices(filters);

    const empleados = await facturaService.getUsers();

    res.render('facturas/index', {
      invoices,
      filters,
      empleados
    });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo facturas' });
  }
};

const getResumen = async (req, res) => {
  try {
    const { id } = req.params;

    const factura = await facturaService.getInvoiceResumen(id);

    res.render('facturas/resumen', {
      factura
    });

  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo resumen' });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const idFactura = parseInt(req.query.id_factura, 10);
    const formato = req.query.formato ? req.query.formato.toLowerCase().trim() : '';

    if (isNaN(idFactura) || idFactura <= 0 || !['pdf', 'xml'].includes(formato)) {
      return res.status(400).send('Parámetros inválidos. Se requiere id_factura y formato (pdf o xml).');
    }

    const { archivo, folio } = await facturaService.downloadInvoice(idFactura, formato);

    const nombreArchivo = `Factura_${folio}.${formato}`;

    if (formato === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);
    } else {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
    }

    res.setHeader('Content-Length', archivo.length);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    return res.send(archivo);

  } catch (error) {
    console.error('Error al descargar factura:', error);

    if (error.message === 'NOT_FOUND') {
      return res.status(404).send('Factura no encontrada o aún no ha sido timbrada.');
    }

    if (error.message.startsWith('API_ERROR')) {
      return res.status(502).send('Error de comunicación con Facturama.');
    }

    return res.status(500).send('Error interno al procesar la descarga.');
  }
};

const DraftInvoiceInfo = async (req, res) => {
  try {
    const {
      userId,
      clienteId,
      ticketFolio,
      moneda,
      tipoComprobante,
      metodoPago,
      formaPago,
      usoCfdi,
      productos
    } = req.body;

    if (!userId || !clienteId || !ticketFolio || !productos || productos.length === 0) {
      return res.status(400).json({
        error: 'Faltan Datos: UserId, clienteId, ticketFolio o productos son requeridos.'
      });
    }

    const resultadoFactura = await facturaService.procesarBorrador({
      userId,
      clienteId,
      ticketFolio,
      moneda,
      tipoComprobante,
      metodoPago,
      formaPago,
      usoCfdi,
      productos
    });

    return res.status(201).json({
      mensaje: 'Borrador de factura guardado correctamente',
      data: resultadoFactura
    });

  } catch (error) {
    console.error('Error en el controlador DraftInvoiceInfo:', error.message);

    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'Error interno al procesar el borrador de la factura.'
    });
  }
};

const deleteDraft = async (req, res) => {
  try {
    const { id } = req.params;

    await facturaService.deleteDraftService(id);

    return res.status(200).json({
      message: "Borrador Eliminado",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno",
    });
  }
};

//
const getCatalogos = (req, res) => {
  res.json({
    usoCFDI,
    regimenFiscal
  });
};

const getSummary = async (req, res) => {
  try {
    const resumen = await facturaService.getSummaryTotals();
    return res.json(resumen);
  } catch (error) {
    console.error('Error obteniendo resumen:', error.message);
    return res.status(500).json({ error: 'Error obteniendo resumen de facturas' });
  }
};

const cancelInvoice = async (req, res) => {
    try {
        const invoiceId = req.params.id || req.body.invoiceId;
        
        const { motivo, uuidSustitucion } = req.body;

        if (!invoiceId) {
            return res.status(400).json({
                success: false,
                message: "El ID de la factura es obligatorio para la cancelación."
            });
        }

        if (motivo === "01" && !uuidSustitucion) {
            return res.status(400).json({
                success: false,
                message: "Si el motivo de cancelación es '01' (Comprobantes emitidos con errores con relación), el UUID de sustitución es obligatorio."
            });
        }

        const resultado = await facturaService.cancelarFactura({
            invoiceId,
            motivo,
            uuidSustitucion
        });

        return res.status(200).json(resultado);

    } catch (error) {
        console.error("Error en cancelarFacturaController:", error.message);

        const statusCode = error.statusCode || 500;
        
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Ocurrió un error inesperado al intentar cancelar la factura."
        });
    }
};

module.exports = {
  getDataF,
  getCatalogos,
  getTicketByFolio,
  getAllTickets,
  getTicketsByCliente,
  InvoiceInfo,
  Invoices,
  getResumen,
  downloadInvoice,
  DraftInvoiceInfo,
  getSummary,
  deleteDraft,
  cancelInvoice
};