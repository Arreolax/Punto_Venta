const salesService = require('../services/sales.service');
const productsService = require("../services/products.servicie");
const db = require('../config/database.js');

const getAllSales = async (req, res) => {
  try {
    const { search, fechaInicio, fechaFin, metodo } = req.query;

    const sales = await salesService.getSalesFilteredService({
      search,
      fechaInicio,
      fechaFin,
      metodo
    });

    if (req.headers["x-requested-with"] === "XMLHttpRequest") {
      return res.json(sales);
    }

    res.render('ventas/sales', {
      layout: 'layouts/header-menu',
      user: req.user,
      sales,
      search,
      fechaInicio,
      fechaFin,
      metodo
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error" });
  }
};

const getSalePreview = async (req, res) => {
  try {
    const { id } = req.params;

    const sale = await salesService.getSaleByIDService(id);

    if (!sale) {
      return res.render('ventas/preview', {
        layout: 'layouts/header-menu',
        user: req.user,
        sale: null,
        errorMessage: "Venta no encontrada."
      });
    }

    res.render('ventas/preview', {
      layout: 'layouts/header-menu',
      user: req.user,
      sale,
      errorMessage: null
    });

  } catch (error) {
    console.error(error);

    res.render('ventas/preview', {
      layout: 'layouts/header-menu',
      user: req.user,
      sale: null,
      errorMessage: "Ocurrió un error al cargar la venta."
    });
  }
};

const mostrarNuevaVenta = async (req, res) => {
    try {
        let vendedorNombre = "Administrador General";

        try { 
          const activeSessionUser = await salesService.getActiveSessionUserService();
          vendedorNombre = activeSessionUser?.nombre_vendedor || vendedorNombre;
        } catch (error) {
          console.error("Error al obtener usuario activo de sessions:", error);
        }

        res.render("ventas/newsale", {
          layout: 'layouts/header-menu',
          user: req.user,
          vendedorNombre
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar la vista");
    }
};

/**
 * Buscar productos por nombre o referencia
 * GET /ventas/buscar-producto?q=termino
 */
const buscarProducto = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const query = `
      SELECT id, ref_producto, etiqueta, precio_venta, stock_fisico
      FROM products
      WHERE (etiqueta LIKE ? OR ref_producto LIKE ?)
        AND estado_venta = 'En venta'
        AND stock_fisico > 0
      LIMIT 10
    `;

    const [productos] = await db.query(query, [`%${q}%`, `%${q}%`]);
    res.json(productos);

  } catch (error) {
    console.error("Error al buscar productos:", error);
    res.status(500).json({ message: "Error al buscar productos" });
  }
};

/**
 * Buscar clientes por nombre
 * GET /ventas/buscar-cliente?q=nombre
 */
const buscarCliente = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === "") {
      return res.json([]);
    }

    const query = `
      SELECT id, name, email, phone, address, postal_code, tax_regime, rfc
      FROM clients
      WHERE name LIKE ?
        AND id != 1
      LIMIT 10
    `;

    const [clientes] = await db.query(query, [`%${q}%`]);
    res.json(clientes);

  } catch (error) {
    console.error("Error al buscar clientes:", error);
    res.status(500).json({ message: "Error al buscar clientes" });
  }
};

/**
 * Guardar nueva venta
 * POST /ventas/guardar
 */
const guardarVenta = async (req, res) => {
  try {
    const datos = req.body;

    const resultado = await salesService.crearVenta(datos);

    return res.json({
      success: true,
      sale_id: resultado.sale_id,
      ticket_number: resultado.ticket_number,
      ticket_id: resultado.ticket_id,
      message: "Venta registrada exitosamente"
    });

  } catch (error) {
    const debug = {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      sql: error.sql
    };
    console.error("Error al guardar venta:", debug, error);
    
    return res.status(400).json({
      success: false,
      message: error.message || "Error al guardar la venta",
      debug
    });
  }
};

// Mantener para compatibilidad con búsqueda antigua
const buscarProductos = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.json([]);
        }

        const productos = await productsService.buscarPorNombre(q);
        res.json(productos);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error al buscar productos" });
    }
};


module.exports = {
  getAllSales,
  getSalePreview,
  mostrarNuevaVenta,
  buscarProducto,
  buscarCliente,
  guardarVenta,
  buscarProductos  
};
