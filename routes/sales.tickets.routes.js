const express = require('express');
const router = express.Router();
const ticketsController = require('../controllers/sales.tickets.controller');

// Historial de tickets
router.get('/', ticketsController.historialTickets);

// Detalle de un ticket específico
router.get('/:id', ticketsController.verTicket);

module.exports = router;
