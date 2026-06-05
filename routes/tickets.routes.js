const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/tickets.controller');
const { validateSession } = require('../middleware/auth.middleware');

const facturaService = require('../services/facturas.service');

router.get('/', validateSession, ticketsController.getAllTickets);

router.get('/vista-previa/:folio', validateSession, ticketsController.getTicketPreview);

router.get("/generate/:saleId", validateSession, ticketsController.generateTicket);

// Tickets por usuario (Facturas)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tickets = await facturaService.getTicketsPerUser(id);

    res.json(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
});

module.exports = router;