const db = require("../config/database.js");

const getActiveSessionUserService = async () => {
  try {
    const query = `
      SELECT
        u.id,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''),
          u.username
        ) AS nombre_vendedor
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.is_active = 1
      ORDER BY COALESCE(s.last_activity, s.created_at) DESC, s.id DESC
      LIMIT 1
    `;

    const [rows] = await db.query(query);

    return rows[0] || null;
  } catch (error) {
    throw new Error(
      "Error en el servicio al obtener el usuario activo: " + error.message,
    );
  }
};

const getSalesFilteredService = async (filters) => {
  try {
    const { search, fechaInicio, fechaFin, metodo } = filters;

    let where = [];
    let values = [];

    if (search && search.trim() !== "") {
      where.push(`(
        c.name LIKE ? OR 
        CONCAT(DATE_FORMAT(s.created_at, '%Y%m%d'), '-', LPAD(s.id, 6, '0')) LIKE ?
      )`);
      values.push(`%${search}%`, `%${search}%`);
    }

    if (fechaInicio && !fechaFin) {
      where.push(`s.created_at >= ?`);
      values.push(`${fechaInicio} 00:00:00`);
    }

    if (!fechaInicio && fechaFin) {
      where.push(`s.created_at <= ?`);
      values.push(`${fechaFin} 23:59:59`);
    }

    if (fechaInicio && fechaFin) {
      where.push(`s.created_at BETWEEN ? AND ?`);
      values.push(`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`);
    }

    if (metodo && metodo !== "Todos") {
      where.push(`s.payment_method = ?`);
      values.push(metodo);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const query = `
      SELECT 
        s.created_at,
        DATE_FORMAT(s.created_at, '%d/%m/%Y %H:%i:%s') AS created_at_sale_formatted,
        s.id AS id,

        CONCAT(
          DATE_FORMAT(s.created_at, '%Y%m%d'),
          '-',
          LPAD(s.id, 6, '0')
        ) AS folio_venta,

        s.payment_method AS metodo_pago,
        s.total AS total_pago,

        c.name AS nombre_cliente,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''), 
          u.username
        ) AS nombre_empleado,

        IFNULL(t.ticket_number, 'SIN TICKET') AS folio_ticket,

        p.etiqueta AS producto_nombre,
        si.quantity AS cantidad,
        si.subtotal AS subtotal_producto,

        NULLIF(i.id, 0) AS id_factura

      FROM sales s
      JOIN clients c ON s.client_id = c.id
      JOIN users u ON s.user_id = u.id
      JOIN sale_items si ON si.sale_id = s.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN tickets t ON s.id = t.sale_id
      LEFT JOIN invoices i ON i.sale_id = s.id

      ${whereClause}

      ORDER BY s.created_at DESC
    `;

    const [rows] = await db.query(query, values);

    const allSales = {};

    rows.forEach((row) => {
      if (!allSales[row.id]) {
        allSales[row.id] = {
          id: row.id,
          folio_venta: row.folio_venta,
          created_at: row.created_at_sale_formatted,
          created_at_raw: row.created_at,
          metodo_pago: row.metodo_pago,
          total_pago: row.total_pago,
          folio_ticket: row.folio_ticket,
          nombre_cliente: row.nombre_cliente,
          nombre_empleado: row.nombre_empleado,
          id_factura: row.id_factura,
          productos: [],
        };
      }

      allSales[row.id].productos.push({
        producto_nombre: row.producto_nombre,
        cantidad: row.cantidad,
        subtotal: row.subtotal_producto,
      });
    });

    return Object.values(allSales).sort(
      (a, b) => new Date(b.created_at_raw) - new Date(a.created_at_raw)
    );

  } catch (error) {
    throw new Error("Error al filtrar ventas: " + error.message);
  }
};

//Preview
const getSaleByIDService = async (id) => {
  try {
    const query = `SELECT 
    DATE_FORMAT(s.created_at, '%d/%m/%Y %H:%i:%s') AS created_at_sale_formatted,
    s.id AS id,
    s.payment_method AS metodo_pago,
    s.payment_reference AS referencia_pago,
    s.total AS total_pago,
    s.cash_received AS total_recibido,
    s.change_given AS cambio,

    c.name AS nombre_cliente,
    COALESCE(
      NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''),
      u.username
    ) AS nombre_empleado,

    si.quantity AS producto_cantidad,
    si.unit_price AS precio_unidad,
    si.subtotal AS subtotal,

    p.ref_producto AS codigo,
    p.etiqueta AS producto_nombre,

    IFNULL(t.ticket_number, 'SIN TICKET') AS folio,
    
    IFNULL(ca.name, 'Sin categoría') AS categoria

FROM sales s
LEFT JOIN clients c ON s.client_id = c.id
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN sale_items si ON si.sale_id = s.id
LEFT JOIN products p ON si.product_id = p.id
LEFT JOIN tickets t ON s.id = t.sale_id
LEFT JOIN categories ca ON ca.id = p.categoria_id

WHERE s.id = ?`;

    const [rows] = await db.query(query, [id]);

    if (rows.length === 0) return null;

    const sale = {
      id: rows[0].id,
      fecha: rows[0].created_at_sale_formatted,
      nombre_empleado: rows[0].nombre_empleado,
      nombre_cliente: rows[0].nombre_cliente,
      metodo_pago: rows[0].metodo_pago,
      referencia_pago: rows[0].referencia_pago,
      total_pago: rows[0].total_pago,
      total_recibido: rows[0].total_recibido,
      cambio: rows[0].cambio,
      folio_ticket: rows[0].folio,
      productos: [],
    };

    rows.forEach((row) => {
      sale.productos.push({
        //  nombre a usar: nombre en la consulta
        codigo: row.codigo,
        nombre: row.producto_nombre,
        categoria: row.categoria,
        precio_unidad: row.precio_unidad,
        cantidad: row.producto_cantidad,
        subtotal: row.subtotal,
      });
    });

    return sale;
  } catch (error) {
    throw new Error(
      "Error en el servicio al obtener la venta por id: " + error.message,
    );
  }
};

const crearVenta = async (datos) => {
  const connection = await db.getConnection();

  try {
    const activeSessionUser = await getActiveSessionUserService();

    if (!activeSessionUser) {
      throw new Error("No se encontró un usuario activo en la tabla sessions");
    }

    // ============ VALIDACIONES PREVIAS ============

    if (
      !datos.productos ||
      !Array.isArray(datos.productos) ||
      datos.productos.length === 0
    ) {
      throw new Error("Debe agregar al menos un producto");
    }

    const metodosValidos = ["efectivo", "transferencia", "tarjeta"];
    if (!metodosValidos.includes(datos.payment_method)) {
      throw new Error("Método de pago inválido");
    }

    if (datos.payment_method === "efectivo") {
      if (
        !datos.cash_received ||
        isNaN(datos.cash_received) ||
        datos.cash_received <= 0
      ) {
        throw new Error("Monto recibido debe ser mayor a $0");
      }
    }

    // Validar cliente — FIX: buscar con acento correcto "Público en General"
    let clientId = parseInt(datos.client_id) || null;

    if (clientId) {
      const [clienteExiste] = await connection.query(
        "SELECT id FROM clients WHERE id = ?",
        [clientId],
      );
      if (clienteExiste.length === 0) clientId = null;
    }

    // Si no hay cliente válido, buscar el genérico por RFC
    if (!clientId || clientId === 1) {
  const [clientePublico] = await connection.query(
    "SELECT id FROM clients WHERE rfc = ? LIMIT 1",
    ["XAXX010101000"]
  );

  clientId = clientePublico[0].id;
}

    // ============ INICIAR TRANSACCIÓN ============
    await connection.beginTransaction();

    // ============ PASO 1: VERIFICAR STOCK CON BLOQUEO FOR UPDATE ============
    const productosVerificados = [];

    for (const producto of datos.productos) {
      const [rows] = await connection.query(
        `SELECT id, etiqueta, precio_venta, stock_fisico 
         FROM products 
         WHERE id = ? AND estado_venta = 'En venta' 
         FOR UPDATE`,
        [producto.product_id],
      );

      if (rows.length === 0) {
        await connection.rollback();
        throw new Error(
          `Producto ID ${producto.product_id} no existe o no está disponible`,
        );
      }

      const prod = rows[0];

      if (prod.stock_fisico < producto.quantity) {
        await connection.rollback();
        throw new Error(
          `Stock insuficiente de "${prod.etiqueta}". Disponibles: ${prod.stock_fisico}`,
        );
      }

      productosVerificados.push({
        product_id: producto.product_id,
        product_name: prod.etiqueta,
        quantity: producto.quantity,
        unit_price: parseFloat(producto.unit_price),
      });
    }

    // ============ PASO 2: CALCULAR TOTALES EN BACKEND ============
    let total = 0;
    let changeGiven = null;

    for (const prod of productosVerificados) {
      total += prod.unit_price * prod.quantity;
    }
    total = Math.round(total * 100) / 100;

    if (datos.payment_method === "efectivo") {
      const cashReceived = Math.round(datos.cash_received * 100) / 100;
      changeGiven = Math.round((cashReceived - total) * 100) / 100;

      if (changeGiven < 0) {
        await connection.rollback();
        throw new Error(
          `Monto insuficiente. Total requerido: $${total.toFixed(2)}`,
        );
      }
    }

    // ============ PASO 3: INSERTAR EN sales ============
    console.log(
      "=== DEBUG DATOS ===",
      JSON.stringify(
        {
          clientId,
          total,
          payment_method: datos.payment_method,
          cash_received: datos.cash_received,
          changeGiven,
          payment_reference: datos.payment_reference,
        },
        null,
        2,
      ),
    );

    const [resultSales] = await connection.query(
      `INSERT INTO sales 
        (user_id, client_id, total, payment_method, cash_received, change_given, sale_type, status, payment_reference) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activeSessionUser.id,
        clientId,
        total,
        datos.payment_method,
        datos.payment_method === "efectivo"
          ? Math.round(datos.cash_received * 100) / 100
          : null,
        changeGiven,
        "Público en General",
        "completada",
        datos.payment_reference || null,
      ],
    );

    const saleId = resultSales.insertId;

    // ============ PASO 4: INSERTAR EN sale_items Y DESCONTAR STOCK ============
    for (const prod of productosVerificados) {
      const subtotal = Math.round(prod.unit_price * prod.quantity * 100) / 100;

      await connection.query(
        `INSERT INTO sale_items 
      (sale_id, product_id, product_name, description, quantity, unit_price, subtotal) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          saleId,
          prod.product_id,
          prod.product_name,
          null,
          prod.quantity,
          prod.unit_price,
          subtotal,
        ],
      );

      // Descontar stock
      await connection.query(
        `UPDATE products 
     SET stock_fisico = stock_fisico - ? 
     WHERE id = ?`,
        [prod.quantity, prod.product_id],
      );

      await connection.query(
        `INSERT INTO inventory_movements
      (product_id, user_id, movement_type, reason, quantity, support_document, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          prod.product_id,
          activeSessionUser.id,
          "salida",
          "venta",
          -prod.quantity,
          null,
        ],
      );
    }

    // ============ PASO 5: GENERAR NÚMERO DE TICKET ============
    const ahora = new Date();
    const fechaFormato = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, "0")}${String(ahora.getDate()).padStart(2, "0")}`;
    const ticketNumber = `${fechaFormato}-${String(saleId).padStart(6, "0")}`;

    // ============ PASO 6: INSERTAR EN tickets ============
    const [resultTicket] = await connection.query(
      `INSERT INTO tickets 
        (ticket_number, sale_id, user_id, commercial_message) 
       VALUES (?, ?, ?, ?)`,
      [
        ticketNumber,
        saleId,
        activeSessionUser.id,
        "Gracias por su preferencia",
      ],
    );

    const ticketId = resultTicket.insertId;

    // ============ PASO 7: INSERTAR EN ticket_items ============
    for (const prod of productosVerificados) {
      const subtotal = Math.round(prod.unit_price * prod.quantity * 100) / 100;

      await connection.query(
        `INSERT INTO ticket_items 
          (ticket_id, product_id, product_name, description, quantity, unit_price, subtotal) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          prod.product_id,
          prod.product_name,
          null,
          prod.quantity,
          prod.unit_price,
          subtotal,
        ],
      );
    }

    // ============ PASO 8: INSERTAR EN folio ============
    const [resultFolio] = await connection.query(
      `INSERT INTO folio (sale_id, ticket_id) VALUES (?, ?)`,
      [saleId, ticketId],
    );

    const folioId = resultFolio.insertId;

    // ============ PASO 9: INSERTAR EN historial_permanente ============
    await connection.query(
      `INSERT INTO historial_permanente 
        (folio, sale_id, ticket_id, user_id, total, payment_method) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        folioId,
        saleId,
        ticketId,
        activeSessionUser.id,
        total,
        datos.payment_method,
      ],
    );

    // ============ PASO 10: COMMIT ============
    await connection.commit();

    return {
      sale_id: saleId,
      ticket_id: ticketId,
      ticket_number: ticketNumber,
      total,
      change_given: changeGiven,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch (e) {
      console.error("Error en rollback:", e);
    }
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getActiveSessionUserService,
  getSalesFilteredService,
  getSaleByIDService,
  crearVenta,
};
