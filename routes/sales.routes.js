const express = require('express');
const { validateSession } = require('../middleware/auth.middleware');
const router = express.Router(); 
const salesController = require('../controllers/sales.controller');

// Rutas principales de ventas
router.get('/', validateSession, salesController.getAllSales);
router.get('/vista-previa/:id', validateSession, salesController.getSalePreview);
router.get("/nueva", validateSession, salesController.mostrarNuevaVenta);

// API: Búsqueda
router.get("/buscar-cliente", salesController.buscarCliente);
router.get("/buscar-producto", salesController.buscarProducto);

// API: Guardar venta
router.post("/guardar", salesController.guardarVenta);

// Compatibilidad con búsqueda antigua
router.get("/api/productos/buscar", salesController.buscarProductos);

module.exports = router;