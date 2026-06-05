const db = require("../config/database.js");

const getTicketsFilteredService = async (filters) => {
    try {
        const { search, fechaInicio, fechaFin, metodo } = filters;

        let where = [];
        let values = [];

        if (search && search.trim() !== "") {
            where.push(`(t.ticket_number LIKE ? OR c.name LIKE ?)`);
            values.push(`%${search}%`, `%${search}%`);
        }

        if (fechaInicio && fechaFin) {
            where.push(`t.created_at BETWEEN ? AND ?`);
            values.push(`${fechaInicio} 00:00:00`, `${fechaFin} 23:59:59`);
        }

        if (metodo && metodo !== "Todos") {
            where.push(`s.payment_method = ?`);
            values.push(metodo);
        }

        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const query = `
        SELECT 
        t.created_at,
        DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i:%s') AS created_at_ticket_formatted,
        t.id AS id,
        t.ticket_number AS folio,
        
        c.name AS nombre_cliente,
        COALESCE(
        NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''),
        u.username
        ) AS nombre_empleado,

        s.payment_method AS metodo_pago, 
        s.total AS total_pago,

        p.etiqueta AS producto_nombre,
        ti.quantity AS cantidad,
        ti.subtotal AS subtotal_producto,

        NULLIF(i.id, 0) AS id_factura

        FROM tickets t
        JOIN sales s ON t.sale_id = s.id
        JOIN clients c ON s.client_id = c.id
        JOIN ticket_items ti ON ti.ticket_id = t.id
        JOIN products p ON ti.product_id = p.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN invoices i ON i.sale_id = s.id

        ${whereClause}

        ORDER BY t.created_at DESC
    `;

        const [rows] = await db.query(query, values);

        const allTickets = {};

        rows.forEach((row) => {
            if (!allTickets[row.id]) {
                allTickets[row.id] = {
                    id: row.id,
                    created_at: row.created_at_ticket_formatted,
                    created_at_raw: row.created_at,
                    folio: row.folio,
                    metodo_pago: row.metodo_pago,
                    total_pago: row.total_pago,
                    nombre_cliente: row.nombre_cliente,
                    nombre_empleado: row.nombre_empleado,
                    id_factura: row.id_factura,
                    productos: [],
                };
            }

            allTickets[row.id].productos.push({
                producto_nombre: row.producto_nombre,
                cantidad: row.cantidad,
                subtotal: row.subtotal_producto,
            });
        });

        return Object.values(allTickets).sort(
            (a, b) => new Date(b.created_at_raw) - new Date(a.created_at_raw),
        );
    } catch (error) {
        throw new Error("Error al filtrar tickets: " + error.message);
    }
};

//Preview
const getTicketByFolioService = async (folio) => {
    try {
        const query = `
        SELECT 
        DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i:%s') AS fecha_con_formato,
        t.ticket_number AS folio,
        t.company_name AS compania,
        t.company_phone AS compania_telefono,
        t.company_logo_path AS compania_logo,
        t.commercial_message AS mensaje_comercial,
        
        c.name AS nombre_cliente,
        
        u.username AS username_empleado,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''),
          u.username
        ) AS nombre_empleado,
        u.phone AS telefono_empleado,
        
        s.payment_method AS metodo_pago,
        s.total AS total_pago,
        s.cash_received AS total_recibido,
        s.change_given AS cambio,
        s.id AS sale_id,
        
        p.ref_producto AS codigo,

        ti.product_name AS producto_nombre,
        IFNULL(ti.description, 'Sin Descripcion') AS producto_descripcion,
        ti.quantity AS producto_cantidad,
        ti.unit_price AS precio_unidad,
        ti.subtotal AS subtotal
            
        FROM tickets t
        JOIN sales s ON t.sale_id = s.id
        JOIN clients c ON s.client_id = c.id
        JOIN users u ON t.user_id = u.id
        JOIN ticket_items ti ON ti.ticket_id = t.id
        JOIN products p ON ti.product_id = p.id
        WHERE t.ticket_number = ?;
        `;

        const [rows] = await db.query(query, [folio]);

        if (rows.length === 0) return null;

        const ticket = {
            folio: rows[0].folio,
            fecha: rows[0].fecha_con_formato,
            nombre_compania: rows[0].compania,
            telefono_compania: rows[0].compania_telefono,
            compania_logo: rows[0].compania_logo,
            mensaje_comercial: rows[0].mensaje_comercial,
            username_empleado: rows[0].username_empleado,
            nombre_empleado: rows[0].nombre_empleado,
            telefono_empleado: rows[0].telefono_empleado,
            nombre_cliente: rows[0].nombre_cliente,
            metodo_pago: rows[0].metodo_pago,
            total_pago: rows[0].total_pago,
            total_recibido: rows[0].total_recibido,
            cambio: rows[0].cambio,
            productos: [],
        };

        rows.forEach((row) => {
            ticket.productos.push({
                //  nombre a usar: nombre en la consulta
                nombre: row.producto_nombre,
                codigo: row.codigo,
                descripcion: row.producto_descripcion,
                cantidad: row.producto_cantidad,
                precio_unidad: row.precio_unidad,
                subtotal: row.subtotal,
            });
        });

        return ticket;
    } catch (error) {
        throw new Error(
            "Error en el servicio al obtener ticket por folio: " + error.message,
        );
    }
};

const generateTicketService = async (saleId) => {
    try {
        const ahora = new Date();
        const fechaFormato = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, "0")}${String(ahora.getDate()).padStart(2, "0")}`;
        const folio = `${fechaFormato}-${String(saleId).padStart(6, "0")}`;

        const [saleRows] = await db.query(
            `
      SELECT s.*, u.id AS user_id
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `,
            [saleId],
        );

        if (!saleRows.length) {
            throw new Error("Venta no encontrada");
        }

        const sale = saleRows[0];

        const [ticketResult] = await db.query(
            `
      INSERT INTO tickets
      (ticket_number, sale_id, user_id)
      VALUES (?, ?, ?)
    `,
            [folio, saleId, sale.user_id],
        );

        const ticketId = ticketResult.insertId;

        const [items] = await db.query(
            `
      SELECT 
        si.product_id,
        p.etiqueta,
        si.quantity,
        si.unit_price,
        si.subtotal
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `,
            [saleId],
        );

        for (const item of items) {
            await db.query(
                `
        INSERT INTO ticket_items
        (ticket_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
                [
                    ticketId,
                    item.product_id,
                    item.etiqueta,
                    item.quantity,
                    item.unit_price,
                    item.subtotal,
                ],
            );
        }

        return folio;
    } catch (error) {
        throw new Error("Error en el servicio al generar ticket: " + error.message);
    }
};

module.exports = {
    getTicketsFilteredService,
    getTicketByFolioService,
    generateTicketService,
};
