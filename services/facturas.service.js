const db = require('../config/database.js');

const getTicketInfo = async (folio) => {
    try {
        const query = ` 
        SELECT 
        DATE_FORMAT(t.created_at, '%d/%m/%Y %H:%i:%s') AS fecha_con_formato,
        t.ticket_number AS folio,
        
        c.name AS nombre_cliente,
        c.address AS domicilio_cliente,
        c.postal_code AS codigo_postal_cliente,
        c.phone AS telefono_cliente,
        c.email AS correo_cliente,
        c.rfc AS rfc_cliente,
        c.tax_regime AS regimen_fiscal_cliente,
        
        u.username AS username_empleado,
        COALESCE(
          NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''),
          u.username
        ) AS nombre_empleado,
        
        s.payment_method AS metodo_pago,
        s.total AS total_pago,
        s.cash_received AS total_recibido,
        s.change_given AS cambio,
        s.id AS sale_id,
        s.client_id AS client_id,

        p.id AS producto_id,
        p.ref_producto AS codigo,
        p.clave_sat AS sat_clave,

        ti.product_name AS producto_nombre,
        IFNULL(ti.description, 'Sin Descripcion') AS producto_descripcion,
        ti.quantity AS producto_cantidad,
        ti.unit_price AS precio_unidad,
        ti.subtotal AS subtotal,

        i.currency AS moneda,
        i.receipt_type AS tipo_recibo,
        i.receipt_method AS metodo_recibo,
        i.cfdi_use AS uso_cfdi,

        su.clave AS sat_unidad_clave,
        su.descripcion AS sat_unidad_descripcion
        
        FROM tickets t
        JOIN sales s ON t.sale_id = s.id
        JOIN clients c ON s.client_id = c.id
        JOIN users u ON t.user_id = u.id
        JOIN ticket_items ti ON ti.ticket_id = t.id
        JOIN products p ON ti.product_id = p.id
        LEFT JOIN sat_unidades su ON p.sat_unidad_id = su.id
        LEFT JOIN invoices i ON i.sale_id = s.id
        WHERE t.ticket_number = ?;
        `;

        const [rows] = await db.query(query, [folio]);

        if (rows.length === 0) return null;

        const ticket = {
            folio: rows[0].folio,
            fecha: rows[0].fecha_con_formato,
            username_empleado: rows[0].username_empleado,
            nombre_empleado: rows[0].nombre_empleado,
            nombre_cliente: rows[0].nombre_cliente,
            client_id: rows[0].client_id,
            domicilio_cliente: rows[0].domicilio_cliente,
            codigo_postal_cliente: rows[0].codigo_postal_cliente,
            telefono_cliente: rows[0].telefono_cliente,
            correo_cliente: rows[0].correo_cliente,
            rfc_cliente: rows[0].rfc_cliente,
            regimen_fiscal_cliente: rows[0].regimen_fiscal_cliente,
            metodo_pago: rows[0].metodo_pago,
            total_pago: rows[0].total_pago,
            total_recibido: rows[0].total_recibido,
            cambio: rows[0].cambio,
            moneda: rows[0].moneda,
            tipo_recibo: rows[0].tipo_recibo,
            metodo_recibo: rows[0].metodo_recibo,
            uso_cfdi: rows[0].uso_cfdi,
            productos: []
        };

        rows.forEach(row => {
            ticket.productos.push({
                //  nombre a usar: nombre en la consulta
                id: row.producto_id,
                nombre: row.producto_nombre,
                codigo: row.codigo,
                descripcion: row.producto_descripcion,
                cantidad: row.producto_cantidad,
                precio_unidad: row.precio_unidad,
                subtotal: row.subtotal,
                sat_unidad_clave: row.sat_unidad_clave,
                sat_unidad_descripcion: row.sat_unidad_descripcion,
                sat_clave: row.sat_clave
            });
        });

        return ticket;

    } catch (error) {
        throw new Error('Error en el servicio al obtener ticket por folio: ' + error.message);
    }
};

const getTicketsPerUser = async (id) => {
    try {
        const query = `SELECT 
        t.ticket_number AS folio, 

        ti.product_name AS producto_nombre,
        IFNULL(ti.description, 'Sin Descripcion') AS producto_descripcion,
        ti.quantity AS producto_cantidad,
        ti.unit_price AS precio_unidad,
        ti.subtotal AS subtotal

        FROM tickets t
        JOIN sales s ON t.sale_id = s.id
        JOIN ticket_items ti ON ti.ticket_id = t.id
        WHERE s.client_id = ?;`;
        const [rows] = await db.query(query, [id]);

        if (rows.length === 0) return null;

        const tickets = {};

        rows.forEach((row) => {
            if (!tickets[row.folio]) {
                tickets[row.folio] = {
                    folio: row.folio,
                    productos: []
                };
            }
            tickets[row.folio].productos.push({
                nombre: row.producto_nombre,
                descripcion: row.producto_descripcion,
                cantidad: row.producto_cantidad,
                precio_unidad: row.precio_unidad,
                subtotal: row.subtotal
            });
        });

        return Object.values(tickets);
    } catch (error) {
        throw new Error('Error en el servicio al obtener tickets por usuario: ' + error.message);
    }
};

const getAllTickets = async () => {
    try {
        const query = `
        SELECT 
            t.ticket_number AS folio
        FROM tickets t
        JOIN sales s ON s.id = t.sale_id
        LEFT JOIN invoices i 
            ON i.sale_id = s.id 
        WHERE i.sale_id IS NULL
        ORDER BY t.created_at DESC
        LIMIT 50;
        `;

        const [rows] = await db.query(query);

        return rows;
    } catch (error) {
        throw new Error('Error obteniendo tickets: ' + error.message);
    }
};

//
const procesarFactura = async (data) => {

    const {
        userId,
        clienteId,
        ticketFolio,
        moneda,
        tipoComprobante,
        metodoPago,
        formaPago,
        usoCfdi,
        productos
    } = data;

    //console.log(data);

    const [clientRows] = await db.query(`SELECT name, postal_code, tax_regime, rfc FROM clients WHERE id = ? LIMIT 1`, [clienteId]);

    if (clientRows.length === 0) {
        throw new Error("Cliente no Encontrado.");
    }

    const clientInfo = clientRows[0];

    const [ticketRows] = await db.query(`SELECT t.id, t.sale_id, s.client_id FROM tickets t JOIN sales s ON t.sale_id = s.id  WHERE t.ticket_number = ?  LIMIT 1`, [ticketFolio]);

    if (ticketRows.length === 0) {
        const error = new Error(`No se Encontró Ticket con el Folio: ${ticketFolio}`);
        error.statusCode = 404;
        throw error;
    }

    const ticketId = ticketRows[0].id;
    const saleId = ticketRows[0].sale_id;
    const clientIdC = ticketRows[0].client_id;

    const [facturaExistente] = await db.query(`SELECT id, uuid, status FROM invoices WHERE sale_id = ? AND status = 'timbrada' LIMIT 1`, [saleId]);

    if (facturaExistente.length > 0) {
        const error = new Error(
            `La Venta con Folio ${ticketFolio} ya se Encuentra Facturada.`
        );
        error.statusCode = 400;
        throw error;
    }

    const ivaRate = 0.16;

    const itemsFacturama = [];

    let subtotalGlobal = 0;
    let ivaGlobal = 0;
    let totalGlobal = 0;

    const itemsFactura = [];

    for (const prodFront of productos) {

        const [productRows] = await db.query(`SELECT ti.product_name, ti.unit_price, ti.quantity, su.clave, su.descripcion, p.clave_sat FROM ticket_items ti JOIN products p ON p.id = ti.product_id JOIN sat_unidades su ON su.id = p.sat_unidad_id WHERE ti.product_id = ? AND ti.ticket_id = ?;`, [prodFront.id, ticketId]);

        if (productRows.length === 0) {
            throw new Error(`El Producto con ID: ${prodFront.id} no se Encontró.`);
        }

        const productoInfo = productRows[0];

        const claveSatFinal = productoInfo.clave_sat || prodFront.claveSat || "01010101";

        const precioSinIva = productoInfo.unit_price / (1 + ivaRate);

        const subtotal = precioSinIva * productoInfo.quantity;
        const ivaTotal = subtotal * ivaRate;
        const totalLinea = subtotal + ivaTotal;

        subtotalGlobal += subtotal;
        ivaGlobal += ivaTotal;
        totalGlobal += totalLinea;

        itemsFacturama.push({
            ProductCode: claveSatFinal,    //
            Description: productoInfo.product_name,
            Unit: productoInfo.descripcion,              //
            UnitCode: productoInfo.clave,            //
            UnitPrice: precioSinIva.toFixed(4),
            Quantity: productoInfo.quantity,
            Subtotal: subtotal.toFixed(2),
            TaxObject: "02",
            Taxes: [
                {
                    Total: ivaTotal.toFixed(2),
                    Name: "IVA",
                    Base: subtotal.toFixed(2),
                    Rate: ivaRate.toFixed(6),
                    IsRetention: false,
                    IsQuota: false
                }
            ],
            Total: totalLinea.toFixed(2)
        });

        itemsFactura.push({
            product_id: prodFront.id,
            product_name: productoInfo.product_name,
            quantity: productoInfo.quantity,
            unit_price: precioSinIva,
            subtotal: subtotal
        });
    }

    const payloadFacturama = {
        CfdiType: tipoComprobante,
        ExpeditionPlace: "26015",   //
        PaymentForm: formaPago,
        PaymentMethod: metodoPago,
        Currency: moneda || "MXN",

        Receiver: {
            Rfc: clientInfo.rfc,
            Name: clientInfo.name,
            CfdiUse: usoCfdi,
            FiscalRegime: clientInfo.tax_regime,
            TaxZipCode: clientInfo.postal_code
        },

        Items: itemsFacturama
    };

    try {

        const credentials = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASS}`).toString('base64');

        const apiUrl = process.env.FACTURAMA_URL;

        const respuesta = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payloadFacturama)
        });

        const dataFacturama = await respuesta.json();

        if (!respuesta.ok) {

            let mensajeError = 'Error desconocido en Facturama';

            if (dataFacturama.ModelState) {

                const nombresCampos = {
                    Rfc: 'RFC',
                    CfdiUse: 'Uso CFDI',
                    FiscalRegime: 'Régimen Fiscal'
                };

                mensajeError = Object.entries(dataFacturama.ModelState)
                    .map(([campo, errores]) => {

                        const campoLimpio = nombresCampos[
                            campo
                                .replace('cfdiToCreate.Receiver.', '')
                                .replace('cfdiToCreate.', '')
                        ] || campo;

                        return `• ${errores.join(', ')}`;
                    })
                    .join('\n');

            } else if (dataFacturama.Message) {
                const mensajeOriginal = dataFacturama.Message;

                if (mensajeOriginal.includes('c_ClaveProdServ')) {
                    mensajeError = 'Uno o más Productos no Tienen un Codigo SAT Valido.';
                }
                else if (mensajeOriginal.includes('c_ClaveUnidad')) {
                    mensajeError = 'Uno o más productos no tienen una Unidad de Medida del SAT válida.';
                }
                else {
                    mensajeError = mensajeOriginal;
                }
            }
            throw new Error(
                `${mensajeError} \n\n → Verifique la Información.`
            );
        }

        if (clienteId != clientIdC) {
            await db.query(`UPDATE sales SET client_id = ? WHERE id = ?`, [clienteId, saleId]);
        }

        for (const prodFront of productos) {

            const [rows] = await db.query(
                `SELECT clave_sat FROM products WHERE id = ? LIMIT 1`,
                [prodFront.id]
            );

            if (rows.length === 0) continue;

            const claveActual = rows[0].clave_sat;
            const nuevaClave = prodFront.claveSat;

            if (nuevaClave && claveActual !== nuevaClave) {

                await db.query(
                    `UPDATE products SET clave_sat = ? WHERE id = ?`,
                    [nuevaClave, prodFront.id]
                );
            }
        }

        const facturamaId = dataFacturama.Id || 'N/A';

        const facturamaFolio = dataFacturama.Folio || 'S/F';

        const uuidFactura = dataFacturama.Complement?.TaxStamp?.Uuid || dataFacturama.Uuid || dataFacturama.Id;

        const paymentMethodDB =
            metodoPago === 'PUE' ? 'contado' : 'plazo';

        await db.query(`DELETE FROM invoices WHERE sale_id = ? AND status = 'borrador'`, [saleId]);

        // INSERT ACTUALIZADO
        const [resultInvoice] = await db.query(
            `INSERT INTO invoices ( sale_id, client_id, user_id, facturama_id, facturama_folio, cfdi_use, payment_method, subtotal, tax_amount, total, status, uuid, currency, receipt_type, receipt_method, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                saleId,
                clienteId,
                userId,
                facturamaId,
                facturamaFolio,
                usoCfdi,
                paymentMethodDB,
                subtotalGlobal,
                ivaGlobal,
                totalGlobal,
                'timbrada',
                uuidFactura,
                moneda || 'MXN',
                tipoComprobante,
                metodoPago
            ]
        );

        const idNuevaFactura = resultInvoice.insertId;

        for (const item of itemsFactura) {

            await db.query(
                `INSERT INTO invoice_items ( invoice_id, product_id, product_name, quantity, unit_price, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idNuevaFactura,
                    item.product_id,
                    item.product_name,
                    item.quantity,
                    item.unit_price,
                    item.subtotal
                ]
            );
        }

        return {
            success: true,
            dataFacturama,
            invoice_id: idNuevaFactura
        };

    } catch (error) {
        throw error;
    }
};

const procesarBorrador = async (data) => {

    const {
        userId,
        clienteId,
        ticketFolio,
        moneda,
        tipoComprobante,
        metodoPago,
        formaPago,
        usoCfdi,
        productos
    } = data;

    const [clientRows] = await db.query(`SELECT name, postal_code, tax_regime, rfc FROM clients WHERE id = ? LIMIT 1`, [clienteId]);

    if (clientRows.length === 0) {
        throw new Error("Cliente no Encontrado.");
    }

    const clientInfo = clientRows[0];

    const [ticketRows] = await db.query(`SELECT t.id, t.sale_id, s.client_id FROM tickets t JOIN sales s ON t.sale_id = s.id  WHERE t.ticket_number = ?  LIMIT 1`, [ticketFolio]);

    if (ticketRows.length === 0) {
        const error = new Error(
            `No se Encontró Ticket con el Folio: ${ticketFolio}`
        );

        error.statusCode = 404;

        throw error;
    }

    const ticketId = ticketRows[0].id;
    const saleId = ticketRows[0].sale_id;
    const clientIdC = ticketRows[0].client_id;

    const [facturaExistente] = await db.query(`SELECT id, uuid, status FROM invoices WHERE sale_id = ? AND status = 'timbrada' LIMIT 1`, [saleId]);

    if (facturaExistente.length > 0) {

        const error = new Error(
            `La Venta con Folio ${ticketFolio} ya se Encuentra Facturada.`
        );

        error.statusCode = 400;

        throw error;
    }

    const ivaRate = 0.16;

    let subtotalGlobal = 0;
    let ivaGlobal = 0;
    let totalGlobal = 0;

    const itemsFactura = [];

    for (const prodFront of productos) {

        const [productRows] = await db.query(`SELECT product_name, unit_price, quantity FROM ticket_items WHERE product_id = ? AND ticket_id = ?`, [prodFront.id, ticketId]);

        if (productRows.length === 0) {
            throw new Error(
                `El Producto con ID: ${prodFront.id} no se Encontró.`
            );
        }

        const productoInfo = productRows[0];

        const precioSinIva = productoInfo.unit_price / (1 + ivaRate);

        const subtotal = precioSinIva * productoInfo.quantity;

        const ivaTotal = subtotal * ivaRate;

        const totalLinea = subtotal + ivaTotal;

        subtotalGlobal += subtotal;
        ivaGlobal += ivaTotal;
        totalGlobal += totalLinea;

        itemsFactura.push({
            product_id: prodFront.id,
            product_name: productoInfo.product_name,
            quantity: productoInfo.quantity,

            unit_price: precioSinIva,

            subtotal: subtotal
        });
    }

    try {

        if (clienteId != clientIdC) {
            await db.query(`UPDATE sales SET client_id = ? WHERE id = ?`, [clienteId, saleId]);
        }

        const paymentMethodDB =
            metodoPago === 'PUE' ? 'contado' : 'plazo';

        const facturamaIdDefault = 'N/A';
        const facturamaFolioDefault = 'S/F';

        await db.query(`DELETE FROM invoices WHERE sale_id = ? AND status = 'borrador'`, [saleId]);

        const [resultInvoice] = await db.query(
            `INSERT INTO invoices ( sale_id, client_id, user_id, facturama_id, facturama_folio, cfdi_use, payment_method, subtotal, tax_amount, total, status, uuid, currency, receipt_type, receipt_method, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                saleId,
                clienteId,
                userId,
                facturamaIdDefault,
                facturamaFolioDefault,
                usoCfdi,
                paymentMethodDB,
                subtotalGlobal,
                ivaGlobal,
                totalGlobal,
                'borrador',
                null,
                moneda || 'MXN',
                tipoComprobante,
                metodoPago
            ]
        );

        const idNuevaFactura = resultInvoice.insertId;

        for (const item of itemsFactura) {

            await db.query(
                `INSERT INTO invoice_items ( invoice_id, product_id, product_name, quantity, unit_price, subtotal
                ) VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    idNuevaFactura,
                    item.product_id,
                    item.product_name,
                    item.quantity,
                    item.unit_price,
                    item.subtotal
                ]
            );
        }

        return {
            success: true,
            message: "Borrador de Factura Guardada.",
            invoice_id: idNuevaFactura
        };

    } catch (error) {
        throw new Error(error.message);
    }
}

const cancelarFactura = async (data) => {
    const {
        invoiceId,
        motivo = "02",
        uuidSustitucion = null
    } = data;

    const [invoiceRows] = await db.query(
        `SELECT id, facturama_id, uuid, status FROM invoices WHERE id = ? LIMIT 1`,
        [invoiceId]
    );

    if (!invoiceRows || invoiceRows.length === 0 || !invoiceRows[0]) {
        const error = new Error("No se encontró la factura especificada en la base de datos.");
        error.statusCode = 404;
        throw error;
    }

    const factura = invoiceRows[0];

    if (factura.status === 'cancelada') {
        const error = new Error("La factura ya se encuentra cancelada.");
        error.statusCode = 400;
        throw error;
    }

    if (factura.status === 'borrador') {
        const error = new Error("No puedes cancelar ante el SAT un borrador. Debes eliminarlo directamente.");
        error.statusCode = 400;
        throw error;
    }

    const facturamaId = factura.facturama_id;

    const credentials = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASS}`).toString('base64');

    const urlDesdeEnv = process.env.FACTURAMA_URL;

    const baseUrl = new URL(urlDesdeEnv).origin;

    let cancelUrl = `${baseUrl}/cfdi/${facturamaId}?type=issued&motive=${motivo}`;

    if (motivo === "01" && uuidSustitucion) {
        cancelUrl += `&uuidReplacement=${uuidSustitucion}`;
    }

    try {
        const respuesta = await fetch(cancelUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        if (!respuesta.ok) {    
            const rawText = await respuesta.text();

            let mensajeError = 'Error desconocido en Facturama';

            try {
                const dataFacturama = JSON.parse(rawText);

                if (dataFacturama.ModelState) {
                    mensajeError = JSON.stringify(dataFacturama.ModelState);
                } else {
                    mensajeError = dataFacturama.Message || dataFacturama.message || rawText;
                }
            } catch (e) {
                mensajeError = rawText;
            }

            const error = new Error(`Error de Facturama: ${mensajeError}`);
            error.statusCode = 400;
            throw error;
        }

        const dataResponse = await respuesta.json().catch(() => ({ mensaje: "Cancelación en proceso/exitosa" }));

        await db.query(
            `UPDATE invoices SET status = 'cancelada', updated_at = NOW() WHERE id = ?`,
            [invoiceId]
        );

        return {
            success: true,
            message: "Factura Cancelada.",
            facturama_response: dataResponse
        };

    } catch (error) {
        throw error;
    }
};

//
const getInvoices = async (filters = {}) => {
    try {
        const where = [];
        const params = [];

        if (filters.search) {
            where.push(`(t.ticket_number LIKE ? OR c.name LIKE ?)`);
            const like = `%${filters.search}%`;
            params.push(like, like);
        }

        if (filters.estado && filters.estado !== 'todos') {
            // mapear estados de la UI a los de la base de datos
            const map = {
                'Pagada': 'timbrada',
                'Cancelada': 'cancelada'
            };
            const estadoDB = map[filters.estado] || filters.estado;
            where.push(`i.status = ?`);
            params.push(estadoDB);
        }

        if (filters.fecha && filters.fecha !== 'todos') {
            if (filters.fecha === 'hoy') {
                where.push(`DATE(i.created_at) = CURDATE()`);
            } else if (filters.fecha === 'mes') {
                where.push(`YEAR(i.created_at) = ? AND MONTH(i.created_at) = ?`);
                const now = new Date();
                params.push(now.getFullYear(), now.getMonth() + 1);
            } else if (filters.fecha === 'semana') {
                where.push(`i.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`);
            }
        }

        if (filters.empleado && filters.empleado !== 'todos') {
            // filtrado por nombre o username del empleado
            where.push(`(u.id = ? OR u.username = ?)`);
            params.push(filters.empleado, filters.empleado);
        }

        const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const sql = `
            SELECT 
            t.ticket_number, 
            c.name, 
            DATE_FORMAT(i.created_at, '%d/%m/%Y %H:%i:%s') AS created_at, 
            CONCAT(u.name, ' ', u.last_name) AS empleado, 
            i.id, 
            i.total, 
            i.status, 
            i.facturama_id AS facturama_id,
            i.facturama_folio AS facturama_folio, 
            i.uuid AS uuid_facturama

            FROM invoices i 
            JOIN clients c ON c.id = i.client_id 
            JOIN sales s ON s.id = i.sale_id
            JOIN tickets t ON t.sale_id = s.id
            JOIN users u ON u.id = i.user_id

            ${whereSQL}
            ORDER BY i.created_at DESC;
        `;

        const [rows] = await db.query(sql, params);
        return rows;
    } catch (error) {
        throw new Error(error.message);
    }
}

const getInvoiceResumen = async (id) => {
    try {
        const query = `
            SELECT 
            t.ticket_number AS folio,

            i.id AS factura_id,
            DATE_FORMAT(i.created_at, '%d/%m/%Y %H:%i:%s') AS fecha,
            i.subtotal AS subtotal_factura,
            i.tax_amount AS iva_factura,
            i.total AS total_factura,
            i.cfdi_use AS uso_cfdi,
            i.facturama_id AS facturama_id,
            i.facturama_folio AS facturama_folio,
            i.uuid AS uuid_facturama,
            i.status AS status_factura,
            i.currency AS moneda,
            i.receipt_type AS tipo_recibo,
            i.receipt_method AS metodo_recibo,

            c.id AS cliente_id,
            c.name AS cliente_nombre,
            c.rfc AS cliente_rfc,
            c.tax_regime AS cliente_regimen,
            c.postal_code AS cliente_codigoPostal,

            ii.product_id AS producto_id,
            ii.product_name AS nombre_producto,
            ii.quantity AS cantidad_producto,
            ii.unit_price AS precio_unitario,
            ii.subtotal AS subtotal,

            s.payment_method AS metodo_pago,

            su.clave AS sat_unidad_clave,
            su.descripcion AS sat_unidad_descripcion,

            p.clave_sat AS sat_clave_producto
            
            FROM invoices i
            JOIN invoice_items ii ON ii.invoice_id = i.id
            JOIN products p ON p.id = ii.product_id
            JOIN sales s ON s.id = i.sale_id
            JOIN tickets t ON t.sale_id = s.id
            JOIN clients c ON c.id = i.client_id
            LEFT JOIN sat_unidades su ON p.sat_unidad_id = su.id

            WHERE i.id = ?
            `;

        const [rows] = await db.query(query, [id]);

        if (rows.length === 0) return null;

        const factura = {
            id_factura: rows[0].factura_id,
            folio_venta: rows[0].folio,
            fecha_factura: rows[0].fecha,
            cliente_id: rows[0].cliente_id,
            cliente_nombre: rows[0].cliente_nombre,
            cliente_rfc: rows[0].cliente_rfc,
            cliente_regimen: rows[0].cliente_regimen,
            cliente_codigoPostal: rows[0].cliente_codigoPostal,
            subtotal_factura: rows[0].subtotal_factura,
            iva_factura: rows[0].iva_factura,
            total_factura: rows[0].total_factura,
            uso_cfdi: rows[0].uso_cfdi,
            facturama_id: rows[0].facturama_id,
            facturama_folio: rows[0].facturama_folio,
            uuid_facturama: rows[0].uuid_facturama,
            status_factura: rows[0].status_factura,
            metodo_pago: rows[0].metodo_pago,
            moneda: rows[0].moneda,
            tipo_recibo: rows[0].tipo_recibo,
            metodo_recibo: rows[0].metodo_recibo,

            conceptos: [],
        };

        rows.forEach((row) => {
            factura.conceptos.push({
                id_producto: row.producto_id,
                nombre_producto: row.nombre_producto,
                cantidad_producto: row.cantidad_producto,
                precio_unitario: row.precio_unitario,
                importe: row.subtotal,
                sat_unidad_clave: row.sat_unidad_clave,
                sat_unidad_descripcion: row.sat_unidad_descripcion,
                sat_clave_producto: row.sat_clave_producto
            });
        });

        //console.log(factura);
        return factura;
    }
    catch (error) {
        throw new Error(error.message);
    }

}

const downloadInvoice = async (idFactura, formato) => {
    const [rows] = await db.execute(
        'SELECT facturama_id, facturama_folio FROM invoices WHERE id = ? LIMIT 1',
        [idFactura]
    );

    const factura = rows[0];

    if (!factura || !factura.facturama_id) {
        throw new Error('NOT_FOUND');
    }

    const { facturama_id, facturama_folio } = factura;

    const urlFacturama = `https://apisandbox.facturama.mx/api/Cfdi/${formato}/issued/${facturama_id}`;
    const credenciales = Buffer.from(`${process.env.FACTURAMA_USER}:${process.env.FACTURAMA_PASS}`).toString('base64');

    const response = await fetch(urlFacturama, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${credenciales}`
        }
    });

    if (!response.ok) {
        throw new Error(`API_ERROR: HTTP ${response.status} - ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const rawBuffer = Buffer.from(arrayBuffer);

    const responseText = rawBuffer.toString('utf-8');
    let data;

    try {
        data = JSON.parse(responseText);
    } catch (e) {
        data = responseText;
    }

    let archivoFinal;

    if (typeof data === 'object' && data.Content) {
        archivoFinal = Buffer.from(data.Content, 'base64');
    } else {
        const cuerpoLimpio = String(data).trim();
        const base64Regex = /^[a-zA-Z0-9/+]*={0,2}$/;

        if (base64Regex.test(cuerpoLimpio)) {
            archivoFinal = Buffer.from(cuerpoLimpio, 'base64');
        } else {
            archivoFinal = rawBuffer;
        }
    }

    return {
        archivo: archivoFinal,
        folio: facturama_folio
    };
};

const deleteDraft = async (id) => {
    try {
        const query = `DELETE FROM invoices WHERE id = ? AND status = 'borrador'`;

        const [result] = await db.query(query, [id]);

        if (result.affectedRows === 0) {
            throw {
                status: 404,
                message: "Borrador no Encontrado"
            };
        }

    } catch (error) {
        throw {
            status: error.status || 500,
            message: error.message || "Error al Eliminar Borrador"
        };
    }
};

async function getSummaryTotals() {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // 1-12

        const [rowsMonth] = await db.query(
            `SELECT IFNULL(SUM(total),0) AS total FROM invoices WHERE status = 'timbrada' AND YEAR(created_at) = ? AND MONTH(created_at) = ?`,
            [year, month]
        );

        const [rowsPending] = await db.query(
            `SELECT IFNULL(SUM(total),0) AS total FROM invoices WHERE status = 'borrador'`
        );

        const [rowsToday] = await db.query(
            `SELECT IFNULL(SUM(total),0) AS total FROM invoices WHERE status = 'timbrada' AND DATE(created_at) = CURDATE()`
        );

        return {
            totalPagadoMes: Number(rowsMonth[0].total) || 0,
            totalPendiente: Number(rowsPending[0].total) || 0,
            totalEmitidasHoy: Number(rowsToday[0].total) || 0
        };
    } catch (error) {
        throw new Error('Error obteniendo resumen de totales: ' + error.message);
    }
}

const getUsers = async () => {
    try {
        const query = ` SELECT * FROM users;`;

        const [rows] = await db.query(query);

        return rows;

    } catch (error) {
        throw new Error(error.message);
    }
}

module.exports = {
    getTicketInfo,
    getTicketsPerUser,
    getAllTickets,
    procesarFactura,
    getInvoices,
    getInvoiceResumen,
    downloadInvoice,
    procesarBorrador,
    getSummaryTotals,
    procesarBorrador,
    deleteDraft,
    getUsers,
    cancelarFactura
};