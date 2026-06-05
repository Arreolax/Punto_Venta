const ticketService = require('../services/tickets.service');

const getAllTickets = async (req, res) => {
  try {
    const { search, fechaInicio, fechaFin, metodo } = req.query;

    const tickets = await ticketService.getTicketsFilteredService({
      search,
      fechaInicio,
      fechaFin,
      metodo
    });

    if (req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.json(tickets);
    }

    res.render('tickets/tickets', {
      layout: 'layouts/header-menu',
      user: req.user,
      tickets,
      search,
      fechaInicio,
      fechaFin,
      metodo,
      errorMessage: null
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error" });
  }
};

const getTicketPreview = async (req, res) => {
  try {
    const { folio } = req.params;

    const ticket = await ticketService.getTicketByFolioService(folio);

    if (!ticket) {
      return res.render('tickets/preview', {
        layout: 'layouts/header-menu',
        user: req.user,
        ticket: null,
        errorMessage: "Ticket no encontrado."
      });
    }

    res.render('tickets/preview', {
      layout: 'layouts/header-menu',
      user: req.user,
      ticket,
      errorMessage: null
    });

  } catch (error) {
    console.error(error);

    res.render('tickets/preview', {
      layout: 'layouts/header-menu',
      user: req.user,
      ticket: null,
      errorMessage: "Ocurrió un error al cargar el ticket."
    });
  }
};

const generateTicket = async (req, res) => {
  try {

    const { saleId } = req.params;

    const folio = await ticketService.generateTicketService(saleId);

    res.redirect(`/tickets/preview/${folio}`);

  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar ticket");
  }
};

module.exports = {
  getAllTickets,
  getTicketPreview,
  generateTicket
};