const express = require('express');
const { validateSession } = require('../middleware/auth.middleware');
const router = express.Router(); 

const clientsController = require('../controllers/clients.controller');

router.get('/', validateSession, clientsController.getAllClients);
router.post('/', validateSession, clientsController.createClient);
router.put('/:id', validateSession, clientsController.updateClient);
router.delete("/:id", validateSession, clientsController.deleteClient);

module.exports = router;