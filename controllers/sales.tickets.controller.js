const ticketsService = require('../services/sales.tickets.service');

/**
 * Obtener historial paginado de todos los tickets
 * GET /ventas/tickets
 */
const historialTickets = async (req, res) => {
  try {
    const { pagina = 1 } = req.query;
    const porPagina = 20;

    const tickets = await ticketsService.obtenerHistorialTickets(pagina, porPagina);

    res.render('ventas/tickets', {
      layout: 'layouts/header-menu',
      user: req.user,
      tickets: tickets.datos,
      paginaActual: pagina,
      totalPaginas: tickets.totalPaginas,
      errorMessage: null
    });

  } catch (error) {
    console.error("Error al obtener historial:", error);
    res.render('ventas/tickets', {
      layout: 'layouts/header-menu',
      user: req.user,
      tickets: [],
      paginaActual: 1,
      totalPaginas: 0,
      errorMessage: "Error al cargar el historial de tickets"
    });
  }
};

/**
 * Obtener detalle de un ticket específico
 * GET /ventas/tickets/:id
 */
const verTicket = async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await ticketsService.obtenerDetalleTicket(id);

    if (!ticket) {
      return res.render('ventas/ticket-detail', {
        layout: 'layouts/header-menu',
        user: req.user,
        ticket: null,
        errorMessage: "Ticket no encontrado"
      });
    }

    res.render('ventas/ticket-detail', {
      layout: 'layouts/header-menu',
      user: req.user,
      ticket,
      errorMessage: null
    });

  } catch (error) {
    console.error("Error al obtener ticket:", error);
    res.render('ventas/ticket-detail', {
      layout: 'layouts/header-menu',
      user: req.user,
      ticket: null,
      errorMessage: "Error al cargar el ticket"
    });
  }
};

module.exports = {
  historialTickets,
  verTicket
};
