const express = require('express');
const router = express.Router();
const controller = require('../controllers/facturas.controller');
const { validateSession } = require('../middleware/auth.middleware');

router.get('/', validateSession, controller.Invoices);
router.get('/nueva', validateSession, controller.getDataF);
router.get('/nueva/:folio', validateSession, controller.getDataF);

router.get('/tickets', validateSession, controller.getAllTickets);
router.get('/ticket/:folio', validateSession, controller.getTicketByFolio);
router.get('/tickets/cliente/:id', validateSession, controller.getTicketsByCliente);

router.post('/timbrar', validateSession, controller.InvoiceInfo);
router.post('/borrador', validateSession, controller.DraftInvoiceInfo);
router.delete('/cancelar/:id', controller.cancelInvoice);

router.get('/catalogos', validateSession, controller.getCatalogos);

router.get('/summary', validateSession, controller.getSummary);

router.get('/resumen/:id', validateSession, controller.getResumen);
router.get('/descargar', validateSession, controller.downloadInvoice);

router.delete("/:id", validateSession, controller.deleteDraft);

module.exports = router;