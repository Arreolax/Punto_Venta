const pool = require('../config/database.js'); // o la ruta donde tienes tu conexión

const ENTRY_TYPES = ['Compra', 'Devolución'];
const EXIT_TYPES = ['Venta', 'Eliminación', 'Devolución proveedor'];

const MOVEMENT_MAP = new Map([
  ['Compra', { category: 'entrada', reason: 'compra' }],
  ['Devolución', { category: 'entrada', reason: 'devolución' }],
  ['Venta', { category: 'salida', reason: 'venta' }],
  ['Eliminación', { category: 'salida', reason: 'eliminación' }],
  ['Devolución proveedor', { category: 'salida', reason: 'devolución_proveedor' }]
]);

const REASON_LABELS = {
  compra: 'Compra',
  'devolución': 'Devolución',
  venta: 'Venta',
  'eliminación': 'Eliminación',
  'devolución_proveedor': 'Devolución proveedor'
};

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeNullableNumber(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text ? text : null;
}

function buildSort(sortBy) {
  switch (sortBy) {
    case 'Nombre (A-Z)':
      return 'p.etiqueta ASC';
    case 'Stock (mayor a menor)':
      return 'p.stock_fisico DESC';
    case 'Precio (mayor a menor)':
      return 'p.precio_venta DESC';
    default:
      return 'p.updated_at DESC';
  }
}

async function listProducts(filters = {}) {
  const hasPaging = typeof filters.page !== 'undefined' || typeof filters.pageSize !== 'undefined';
  const page = Math.max(1, normalizeNumber(filters.page, 1));
  const pageSize = Math.min(100, Math.max(10, normalizeNumber(filters.pageSize, 20)));
  const offset = (page - 1) * pageSize;

  let query = `
    SELECT 
      p.id,
      p.ref_producto AS sku,
      p.etiqueta AS name,
      p.descripcion_breve AS description,
      c.name AS category,
      p.stock_fisico AS stock,
      p.stock_deseado AS minStock,
      p.mejor_precio_compra AS cost,
      p.precio_venta AS price,
      COALESCE(NULLIF(p.estado_venta, ''), 'En venta') AS status,
      p.updated_at
    FROM products p
    LEFT JOIN categories c ON p.categoria_id = c.id
    WHERE 1=1
  `;

  const params = [];

  if (filters.search) {
    query += ` AND (p.ref_producto LIKE ? OR p.etiqueta LIKE ?)`;
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }

  if (filters.category && filters.category !== 'Todos') {
    query += ` AND c.name = ?`;
    params.push(filters.category);
  }

  if (filters.status && filters.status !== 'Todos') {
    if (filters.status === 'Bajo stock') {
      query += ` AND p.stock_fisico <= p.stock_deseado AND p.stock_fisico > 0`;
    } else if (filters.status === 'Sin stock') {
      query += ` AND p.stock_fisico = 0`;
    } else {
      query += ` AND p.estado_venta = ?`;
      params.push(filters.status);
    }
  }

  const orderBy = buildSort(filters.sortBy);
  if (hasPaging) {
    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);
  } else {
    query += ` ORDER BY ${orderBy}`;
  }

  const [rows] = await pool.query(query, params);
  if (!hasPaging) {
    return rows;
  }

  const [[countRow]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products p
    LEFT JOIN categories c ON p.categoria_id = c.id
    WHERE 1=1
  ` + buildProductWhere(filters), buildProductParams(filters));

  return {
    rows,
    total: countRow.total || 0,
    page,
    pageSize
  };
}

function buildProductWhere(filters) {
  let where = '';
  if (filters.search) {
    where += ` AND (p.ref_producto LIKE ? OR p.etiqueta LIKE ?)`;
  }
  if (filters.category && filters.category !== 'Todos') {
    where += ` AND c.name = ?`;
  }
  if (filters.status && filters.status !== 'Todos') {
    if (filters.status === 'Bajo stock') {
      where += ` AND p.stock_fisico <= p.stock_deseado`;
    } else if (filters.status === 'Sin stock') {
      where += ` AND p.stock_fisico = 0`;
    } else {
      where += ` AND p.estado_venta = ?`;
    }
  }
  return where;
}

function buildProductParams(filters) {
  const params = [];
  if (filters.search) {
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.category && filters.category !== 'Todos') {
    params.push(filters.category);
  }
  if (filters.status && filters.status !== 'Todos') {
    if (filters.status !== 'Bajo stock' && filters.status !== 'Sin stock') {
      params.push(filters.status);
    }
  }
  return params;
}

async function listCategories() {
  const [rows] = await pool.query(`SELECT id, name FROM categories ORDER BY name ASC`);
  return rows;
}

async function listSatUnits() {
  const [rows] = await pool.query(`
    SELECT id, clave, descripcion
    FROM sat_unidades
    ORDER BY clave ASC, descripcion ASC
  `);
  return rows;
}

async function getCategoryId(categoryValue) {
  if (!categoryValue) return null;
  if (Number.isFinite(Number(categoryValue))) return Number(categoryValue);
  const [rows] = await pool.query('SELECT id FROM categories WHERE name = ?', [categoryValue]);
  return rows.length ? rows[0].id : null;
}

async function ensureUniqueSku(sku, excludeId = null) {
  const params = [sku];
  let query = 'SELECT id FROM products WHERE ref_producto = ?';
  if (excludeId) {
    query += ' AND id <> ?';
    params.push(excludeId);
  }
  const [rows] = await pool.query(query, params);
  return rows.length === 0;
}

async function getProductById(id) {
  const [rows] = await pool.query(`
    SELECT 
      p.id,
      p.ref_producto AS sku,
      p.etiqueta AS name,
      p.descripcion_breve AS description,
      p.categoria_id AS categoryId,
      c.name AS category,
      p.sat_unidad_id AS satUnidadId,
      p.clave_sat AS satClaveProd,
      su.clave AS satUnidadClave,
      su.descripcion AS satUnidadDescripcion,
      p.stock_fisico AS stock,
      p.stock_deseado AS minStock,
      p.mejor_precio_compra AS cost,
      p.precio_venta AS price,
      COALESCE(NULLIF(p.estado_venta, ''), 'En venta') AS status
    FROM products p
    LEFT JOIN categories c ON p.categoria_id = c.id
    LEFT JOIN sat_unidades su ON p.sat_unidad_id = su.id
    WHERE p.id = ?
  `, [id]);
  return rows[0] || null;
}

async function getMetrics() {
  const [[active]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE estado_venta = 'En venta'
  `);

  const [[lowStock]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE stock_fisico <= stock_deseado AND stock_fisico > 0
  `);

  const [[zeroStock]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE stock_fisico = 0
  `);

  const [[twoStock]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products
    WHERE stock_fisico = 2
  `);

  const [[value]] = await pool.query(`
    SELECT SUM(precio_venta * stock_fisico) AS total
    FROM products
  `);

  const [[movements]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM inventory_movements
    WHERE DATE(created_at) = CURDATE()
  `);

  const [[totalProducts]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM products
  `);

  return {
    activeCount: active.total || 0,
    lowStock: lowStock.total || 0,
    zeroStock: zeroStock.total || 0,
    twoStock: twoStock.total || 0,
    totalValue: value.total || 0,
    todayMovements: movements.total || 0,
    totalProducts: totalProducts.total || 0
  };
}

async function getAlerts() {
  const [zero] = await pool.query(`
    SELECT id, ref_producto AS sku, etiqueta AS name, stock_fisico AS stock
    FROM products
    WHERE stock_fisico = 0
    ORDER BY etiqueta ASC
  `);
  const [two] = await pool.query(`
    SELECT id, ref_producto AS sku, etiqueta AS name, stock_fisico AS stock
    FROM products
    WHERE stock_fisico = 2
    ORDER BY etiqueta ASC
  `);
  const [low] = await pool.query(`
    SELECT id, ref_producto AS sku, etiqueta AS name, stock_fisico AS stock, stock_deseado AS minStock
    FROM products
    WHERE stock_fisico <= stock_deseado AND stock_fisico > 0
    ORDER BY etiqueta ASC
  `);
  return { zero, two, low };
}

async function listMovements(filters = {}) {
  let query = `
    SELECT 
      m.id,
      m.created_at AS date,
      m.movement_type AS category,
      m.reason AS reason,
      p.etiqueta AS product,
      m.quantity AS qty,
      COALESCE(
        NULLIF(TRIM(u.name), ''),
        NULLIF(TRIM(u.username), ''),
        CASE WHEN m.user_id IS NULL THEN 'Sistema' ELSE 'Usuario desconocido' END
      ) AS owner,
      m.support_document AS ref
    FROM inventory_movements m
    LEFT JOIN products p ON m.product_id = p.id
    LEFT JOIN users u ON m.user_id = u.id
    WHERE 1=1
  `;
  const params = [];
  if (filters.from) {
    query += ' AND DATE(m.created_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    query += ' AND DATE(m.created_at) <= ?';
    params.push(filters.to);
  }
  if (filters.type && filters.type !== 'Todos') {
    const mapped = MOVEMENT_MAP.get(filters.type);
    if (mapped) {
      query += ' AND m.reason = ?';
      params.push(mapped.reason);
    }
  }
  query += ' ORDER BY m.created_at DESC';
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(Number(filters.limit));
  }
  const [rows] = await pool.query(query, params);
  return rows.map((row) => ({
    ...row,
    type: REASON_LABELS[row.reason] || row.reason || '-'
  }));
}

async function listClients() {
  const [rows] = await pool.query(`
    SELECT 
      c.id,
      c.name,
      MAX(s.created_at) AS lastPurchase,
      SUM(s.total) AS total
    FROM clients c
    LEFT JOIN sales s ON c.id = s.client_id
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT 5
  `);
  return rows;
}

async function listSales() {
  const [rows] = await pool.query(`
    SELECT 
      s.id,
      CONCAT('F-', s.id) AS invoice,
      CONCAT(p.etiqueta, ' (x', si.quantity, ')') AS detail,
      s.total AS amount,
      s.created_at AS time
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    ORDER BY s.created_at DESC
    LIMIT 5
  `);
  return rows;
}

async function createProduct(data) {
  const sku = normalizeText(data.sku);
  const name = normalizeText(data.name);
  const description = normalizeText(data.description);
  const status = normalizeText(data.status || 'En venta');
  const satClaveProd = normalizeNullableText(data.satClaveProd);
  const cost = normalizeNumber(data.cost);
  const price = normalizeNumber(data.price);
  const minStock = normalizeNumber(data.minStock);
  const stock = normalizeNumber(data.stock);
  const categoryId = await getCategoryId(data.category);
  const satUnidadId = normalizeNullableNumber(data.satUnidadId);

  if (!sku || !name || !categoryId) {
    throw new Error('Completa SKU, nombre y categoría.');
  }

  const unique = await ensureUniqueSku(sku);
  if (!unique) {
    throw new Error(`La clave ${sku} ya existe.`);
  }

  await pool.query(`
    INSERT INTO products
    (ref_producto, etiqueta, descripcion_breve, categoria_id, sat_unidad_id, clave_sat, precio_venta, mejor_precio_compra, stock_deseado, stock_fisico, estado_venta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    sku,
    name,
    description,
    categoryId,
    satUnidadId,
    satClaveProd,
    price,
    cost,
    minStock,
    stock,
    status
  ]);
}

async function updateProduct(id, data) {
  const sku = normalizeText(data.sku);
  const name = normalizeText(data.name);
  const description = normalizeText(data.description);
  const status = normalizeText(data.status || 'En venta');
  const satClaveProd = normalizeNullableText(data.satClaveProd);
  const cost = normalizeNumber(data.cost);
  const price = normalizeNumber(data.price);
  const minStock = normalizeNumber(data.minStock);
  const stock = normalizeNumber(data.stock);
  const categoryId = await getCategoryId(data.category);
  const satUnidadId = normalizeNullableNumber(data.satUnidadId);

  if (!categoryId || !id || !status) {
    throw new Error('Completa la Categoría o Estado');
  }

  const unique = await ensureUniqueSku(sku, id);
  if (!unique) {
    throw new Error(`La clave ${sku} ya existe.`);
  }

  await pool.query(`
    UPDATE products
    SET
      categoria_id = ?,
      sat_unidad_id = ?,
      clave_sat = ?,
      estado_venta = ?
    WHERE id = ?
  `, [
    categoryId,
    satUnidadId,
    satClaveProd,
    status,
    id
  ]);
}

async function updateProductStatus(id, status) {
  const nextStatus = normalizeText(status || 'En venta');
  await pool.query(`
    UPDATE products
    SET estado_venta = ?, updated_at = NOW()
    WHERE id = ?
  `, [nextStatus, id]);
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}

async function recordMovement(data) {
  const productId = normalizeNumber(data.productId);
  const quantity = normalizeNumber(data.quantity);
  const movementType = normalizeText(data.movementType);
  const supportDocument = normalizeText(data.supportDocument);
  const userId = normalizeNumber(data.userId);

  if (!productId || !quantity || !movementType || !userId) {
    throw new Error('Completa producto, cantidad, tipo de movimiento y usuario.');
  }
  if (quantity <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }

  const mapped = MOVEMENT_MAP.get(movementType);
  if (!mapped) {
    throw new Error('Tipo de movimiento no válido.');
  }

  const delta = mapped.category === 'entrada' ? quantity : -quantity;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[product]] = await conn.query(`
      SELECT stock_fisico AS stock
      FROM products
      WHERE id = ?
      FOR UPDATE
    `, [productId]);

    if (!product) {
      throw new Error('Producto no encontrado.');
    }

    const nextStock = normalizeNumber(product.stock) + delta;
    if (nextStock < 0) {
      throw new Error('No hay stock suficiente para esta salida.');
    }

    await conn.query(`
      INSERT INTO inventory_movements
      (product_id, quantity, movement_type, reason, support_document, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [productId, delta, mapped.category, mapped.reason, supportDocument || null, userId]);

    await conn.query(`
      UPDATE products
      SET stock_fisico = ?, updated_at = NOW()
      WHERE id = ?
    `, [nextStock, productId]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function deleteMovement(id) {
  const movementId = normalizeNumber(id);
  if (!movementId) {
    throw new Error('Movimiento inválido.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[movement]] = await conn.query(`
      SELECT id, product_id, quantity
      FROM inventory_movements
      WHERE id = ?
      FOR UPDATE
    `, [movementId]);

    if (!movement) {
      throw new Error('Movimiento no encontrado.');
    }

    const [[product]] = await conn.query(`
      SELECT stock_fisico AS stock
      FROM products
      WHERE id = ?
      FOR UPDATE
    `, [movement.product_id]);

    if (!product) {
      throw new Error('Producto no encontrado.');
    }

    const nextStock = normalizeNumber(product.stock) - normalizeNumber(movement.quantity);
    if (nextStock < 0) {
      throw new Error('No se puede eliminar: el stock quedaría negativo.');
    }

    await conn.query(`
      UPDATE products
      SET stock_fisico = ?, updated_at = NOW()
      WHERE id = ?
    `, [nextStock, movement.product_id]);

    await conn.query('DELETE FROM inventory_movements WHERE id = ?', [movementId]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function listMovementReport(filters = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (filters.from) {
    where += ' AND DATE(m.created_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    where += ' AND DATE(m.created_at) <= ?';
    params.push(filters.to);
  }
  const [rows] = await pool.query(`
    SELECT 
      DATE(m.created_at) AS day,
      m.reason AS type,
      SUM(m.quantity) AS totalQty
    FROM inventory_movements m
    ${where}
    GROUP BY day, type
    ORDER BY day DESC
  `, params);
  return rows.map((row) => ({
    ...row,
    type: REASON_LABELS[row.type] || row.type || '-'
  }));
}

async function listSalesByMonthProduct(filters = {}) {
  const params = [];
  let where = 'WHERE 1=1';
  if (filters.from) {
    where += ' AND DATE(s.created_at) >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    where += ' AND DATE(s.created_at) <= ?';
    params.push(filters.to);
  }
  const [rows] = await pool.query(`
    SELECT 
      DATE_FORMAT(s.created_at, '%Y-%m') AS month,
      p.etiqueta AS product,
      SUM(si.quantity) AS qty
    FROM sales s
    LEFT JOIN sale_items si ON s.id = si.sale_id
    LEFT JOIN products p ON si.product_id = p.id
    ${where}
    GROUP BY month, product
    ORDER BY month ASC
  `, params);
  return rows;
}

module.exports = {
  listProducts,
  listCategories,
  listSatUnits,
  getProductById,
  createProduct,
  updateProduct,
  updateProductStatus,
  deleteProduct,
  getMetrics,
  getAlerts,
  listMovements,
  recordMovement,
  deleteMovement,
  listMovementReport,
  listSalesByMonthProduct,
  listClients,
  listSales,
  ENTRY_TYPES,
  EXIT_TYPES
};
