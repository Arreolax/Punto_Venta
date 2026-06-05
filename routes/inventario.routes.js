const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventario.controller');
const { requirePermission } = require('../middleware/roles');
const { validateSession, logActivity } = require('../middleware/auth.middleware');

router.get('/', validateSession, controller.index);
router.post('/productos', validateSession, requirePermission('crearAlmacenes'), controller.create);
router.post('/productos/:id', validateSession, requirePermission('crearAlmacenes'), controller.update);
router.post('/productos/:id/delete', validateSession, requirePermission('eliminarInventario'), controller.remove);
router.post('/movimientos', validateSession, controller.createMovement);
router.post('/movimientos/:id/delete', validateSession, requirePermission('eliminarMovimientos'), controller.deleteMovement);
router.get('/productos/export', validateSession, requirePermission('exportarReportes'), controller.exportProducts);
router.get('/reportes/export', validateSession, requirePermission('exportarReportes'), controller.exportReport);
router.get('/importar', validateSession, requirePermission('importarDatos'), controller.importView);
router.post('/importar', validateSession, requirePermission('importarDatos'), controller.importCsv);

module.exports = router;
