const clientsService = require('../services/clients.service');
const { usoCFDI, regimenFiscal } = require("../config/catalogos");

const getAllClients = async (req, res) => {
  try {

    const clients = await clientsService.getClientsService();

    const clientsFormateados = clients.map(c => ({
      ...c,
      tax_regime_text: regimenFiscal[String(c.tax_regime)] || c.tax_regime
    }));

    res.render('clientes/clients', {
      layout: 'layouts/header-menu',
      clients: clientsFormateados,
      errorMessage: null,
    });

  } catch (error) {
    console.error(error);

    res.render('clientes/clients', {
      layout: 'layouts/header-menu',
      clients: [],
      errorMessage: "Error al cargar clientes"
    });
  }
};

const createClient = async (req, res) => {
  try {

    const data = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      postal_code: req.body.postalCode,       
      rfc: req.body.rfc,
      tax_regime: req.body.taxRegime,
    };

    const newClient = await clientsService.createClientService(data);

    res.status(201).json(newClient);

  } catch (error) {
    console.error("ERROR CREATE:", error);

    res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const updateClient = async (req, res) => {
  try {

    const { id } = req.params;

    const data = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      postal_code: req.body.postalCode,    
      tax_regime: req.body.taxRegime,       
      rfc: req.body.rfc,
    };

    const updated = await clientsService.updateClientService(id, data);

    res.json(updated);

  } catch (error) {
    console.error("ERROR CREATE:", error);

    res.status(error.status || 500).json({
      message: error.message || "Error interno del servidor"
    });
  }
};

const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    await clientsService.deleteClientService(id);

    return res.status(200).json({
      message: "Cliente Eliminado",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || "Error interno",
    });
  }
};

module.exports = {
  getAllClients,
  createClient,
  updateClient,
  deleteClient
};