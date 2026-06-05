const db = require("../config/database.js");
const getDashboardDataService = async (page = 1) => {

  // Grafica de Barras
  // Cantidad
  const [sales] = await db.query(`
    SELECT 
    p.ref_producto AS referencia,
    p.etiqueta AS producto, 
    SUM(si.quantity) AS cantidad_vendida,
    SUM(si.quantity * si.unit_price) AS total
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    GROUP BY p.id, p.ref_producto, p.etiqueta
    ORDER BY cantidad_vendida DESC
    LIMIT 5;
  `);

  // Monto
  const [salesT] = await db.query(`
    SELECT 
    p.ref_producto AS referencia,
    p.etiqueta AS producto, 
    SUM(si.quantity) AS cantidad_vendida,
    SUM(si.quantity * si.unit_price) AS total
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    GROUP BY p.id, p.ref_producto, p.etiqueta
    ORDER BY total DESC
    LIMIT 5;
  `);

  const [salesD] = await db.query(`
    SELECT 
    p.ref_producto AS referencia,
    p.etiqueta AS producto, 
    SUM(si.quantity) AS cantidad_vendida,
    SUM(si.quantity * si.unit_price) AS total
    FROM sale_items si
    JOIN products p ON p.id = si.product_id
    GROUP BY p.id, p.ref_producto, p.etiqueta
    ORDER BY cantidad_vendida DESC
  `);

  // Grafica de Dona
  const [stock_cat] = await db.query(`
    SELECT 
      c.name AS categoria,
      SUM(p.stock_fisico) AS total
    FROM products p
    JOIN categories c ON c.id = p.categoria_id
    GROUP BY c.name
    ORDER BY total DESC
  `);

  // Ventas recientes
  const [recentSales] = await db.query(`
    SELECT 
    s.id,
    s.created_at,
    CONCAT(
        DATE_FORMAT(s.created_at, '%Y%m%d'),
        '-',
        LPAD(s.id, 4, '0')
    ) AS folio,
    DATE_FORMAT(s.created_at, '%d/%m/%Y %H:%i:%s') AS fecha,
    c.name AS nombre_cliente,
    CONCAT(u.name, ' ', u.last_name) AS nombre_empleado,
    s.payment_method AS metodo_pago,
    SUM(si.quantity) AS cantidad, 
    s.total AS total_pago

FROM sales s
JOIN clients c ON s.client_id = c.id
JOIN users u ON s.user_id = u.id
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON si.product_id = p.id
LEFT JOIN tickets t ON s.id = t.sale_id

GROUP BY 
    s.id,
    s.created_at,
    c.name,
    u.name,
    u.last_name,
    s.payment_method,
    s.total

ORDER BY s.created_at DESC;
  `);

  // Paginacion (bajo stock)
  //const page = parseInt(req.query.page) || 1;
  const limit = 3;
  const offset = (page - 1) * limit;

  // Productos con bajo stock
  const [lowStockProducts] = await db.query(`
    SELECT 
      etiqueta AS name,
      ref_producto AS sku,
      stock_fisico AS stock
      FROM products
      WHERE stock_fisico <= stock_deseado AND stock_fisico > 0
      AND is_active = 1
      ORDER BY stock_fisico ASC
    `);
  //, [limit, offset]);

  // Total de productos con bajo stock
  const [lowStockCountResult] = await db.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE stock_fisico <= stock_deseado AND stock_fisico > 0
    AND is_active = 1
  `);

  // Productos sin stock
  const [zeroStockProducts] = await db.query(`
    SELECT 
      etiqueta AS name,
      ref_producto AS sku,
      stock_fisico AS stock
      FROM products
      WHERE stock_fisico = 0 AND is_active = 1
      ORDER BY stock_fisico ASC
    `);
  //, [limit, offset]);

  // Total de productos sin stock
  const [zeroStockCountResult] = await db.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE stock_fisico = 0
  `);

  // Total de productos
  const [totalProductsResult] = await db.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE is_active = 1
  `);

  // Valor Inv
  const [totalValueResult] = await db.query(`
    SELECT SUM(precio_venta * stock_fisico) AS totalValue
    FROM products
  `);

  const totalLowStock = lowStockCountResult[0].total;
  const totalPages = Math.ceil(totalLowStock / limit);

  const totalZeroStock = zeroStockCountResult[0].total;

  // Métricas
  const metrics = {
    totalValue: totalValueResult[0].totalValue || 0,
    totalProducts: totalProductsResult[0].total,
    lowStock: totalLowStock,
    zeroStock: totalZeroStock
  };

  return {
    sales,  // ventas por cantidad
    salesT, // ventas por total
    salesD, //ventas para tabla inicial
    stock_cat,
    recentSales,
    metrics,
    lowStockProducts,
    zeroStockProducts,
    currentPage: page,
    totalPages,
    salesChart: []
  };
};

module.exports = { getDashboardDataService };