const inventarioService = require('../services/inventario.service');
const pool = require('../config/database');
const LoggerService = require('../services/logger.service');
const fs = require('fs');
const os = require('os');
const path = require('path');

function buildMessage(req) {
  return {
    error: req.query.error || '',
    success: req.query.success || ''
  };
}

async function buildInventoryViewData(req, { messages, editProduct } = {}) {
  // Permitir acceso con cualquiera de los permisos de visualización de inventario
  const permissions = (req.user && req.user.permissions) || {};
  const canAccessInventory = Boolean(permissions.verInventarios || permissions.consultarStocks);
  if (!canAccessInventory) {
    return { forbidden: true };
  }

  const filters = {
    search: req.query.search || '',
    category: req.query.category || 'Todos',
    status: req.query.status || 'Todos',
    sortBy: req.query.sortBy || 'Última actualización',
    page: req.query.page || 1,
    pageSize: req.query.pageSize || 20
  };

  const movementFilters = {
    from: req.query.mov_from || '',
    to: req.query.mov_to || '',
    type: req.query.mov_type || 'Todos'
  };

  const reportFilters = {
    from: req.query.rep_from || '',
    to: req.query.rep_to || ''
  };

  const productsResult = await inventarioService.listProducts(filters);
  const categories = await inventarioService.listCategories();
  const satUnits = await inventarioService.listSatUnits();
  const metrics = await inventarioService.getMetrics();
  const alerts = await inventarioService.getAlerts();

  // Validar permiso para ver movimientos
  let movements = [];
  let movementReport = [];
  if (permissions.consultarMovimientosStock) {
    movements = await inventarioService.listMovements(movementFilters);
    movementReport = await inventarioService.listMovementReport(reportFilters);
  }

  const salesChart = await inventarioService.listSalesByMonthProduct(reportFilters);
  const clients = await inventarioService.listClients();
  const sales = await inventarioService.listSales();

  let resolvedEditProduct = editProduct;
  if (typeof resolvedEditProduct === 'undefined') {
    resolvedEditProduct = null;
    if (req.query.editId && !req.query.new) {
      resolvedEditProduct = await inventarioService.getProductById(req.query.editId);
    }
  }

  const canModifyWarehouses = Boolean(permissions.crearAlmacenes);
  const isAdmin = Number(req.user?.role_id) === 1;
  const canCreateWarehouses = canModifyWarehouses && isAdmin;
  const canManageAllMovements = isAdmin || Boolean(permissions.registrarMovimientos);

  return {
    filters,
    movementFilters,
    reportFilters,
    metrics,
    alerts,
    categories,
    satUnits,
    products: productsResult.rows,
    pagination: {
      total: productsResult.total,
      page: productsResult.page,
      pageSize: productsResult.pageSize
    },
    movements,
    movementReport,
    salesChart,
    clients,
    sales,
    editProduct: resolvedEditProduct,
    messages: messages || buildMessage(req),
    canEdit: canModifyWarehouses,
    canCreateWarehouses,
    canModifyWarehouses,
    canViewStocks: Boolean(permissions.consultarStocks),
    canDeleteInventory: Boolean(permissions.eliminarInventario),
    canRegisterMovements: Boolean(permissions.registrarMovimientos),
    canManageAllMovements,
    user: req.user,
    movementTypes: {
      entry: inventarioService.ENTRY_TYPES,
      exit: inventarioService.EXIT_TYPES
    },
    layout: 'layouts/header-menu'
  };
}

async function index(req, res) {
  const viewData = await buildInventoryViewData(req);
  if (viewData.forbidden) {
    return res.status(403).render('403', {
      message: 'No tienes permiso para acceder al inventario'
    });
  }
  return res.render('inventario/index', viewData);
}

async function create(req, res) {
  try {
    const permissions = (req.user && req.user.permissions) || {};
    const canModifyWarehouses = Boolean(permissions.crearAlmacenes);
    const isAdmin = Number(req.user?.role_id) === 1;

    // Regla de negocio: el permiso crear/modificar permite crear solo a Admin.
    if (!canModifyWarehouses || !isAdmin) {
      return res.redirect('/inventario?error=' + encodeURIComponent('No tienes permiso para crear almacenes.'));
    }

    await inventarioService.createProduct(req.body);
    const viewData = await buildInventoryViewData(req, {
      messages: {
        error: '',
        success: 'Producto creado'
      }
    });
    if (viewData.forbidden) {
      return res.status(403).render('403', {
        message: 'No tienes permiso para acceder al inventario'
      });
    }
    return res.render('inventario/index', viewData);
  } catch (error) {
    res.redirect('/inventario?error=' + encodeURIComponent(error.message));
  }
}

async function update(req, res) {
  try {
    const permissions = (req.user && req.user.permissions) || {};
    if (!permissions.crearAlmacenes) {
      return res.redirect('/inventario?error=' + encodeURIComponent('No tienes permiso para modificar almacenes.'));
    }

    if (req.body.onlyStatus === '1') {
      await inventarioService.updateProductStatus(req.params.id, req.body.status);
      return res.redirect('/inventario?editId=' + req.params.id + '&success=Estado%20actualizado');
    }
    await inventarioService.updateProduct(req.params.id, req.body);
    res.redirect('/inventario?editId=' + req.params.id + '&success=Producto%20actualizado');
  } catch (error) {
    res.redirect('/inventario?editId=' + req.params.id + '&error=' + encodeURIComponent(error.message));
  }
}

async function remove(req, res) {
  try {
    await inventarioService.deleteProduct(req.params.id);
    res.redirect('/inventario?success=Producto%20eliminado');
  } catch (error) {
    res.redirect('/inventario?error=' + encodeURIComponent(error.message));
  }
}

async function createMovement(req, res) {
  try {
    const permissions = (req.user && req.user.permissions) || {};
    const isAdmin = Number(req.user?.role_id) === 1;
    const canRegisterMovements = Boolean(permissions.registrarMovimientos);
    const canDeleteInventory = Boolean(permissions.eliminarInventario);
    const canManageAllMovements = isAdmin || canRegisterMovements;

    const movementType = String(req.body.movementType || '').trim();
    if (!movementType) {
      return res.redirect('/inventario?error=' + encodeURIComponent('Selecciona el tipo de movimiento.'));
    }

    const normalizedType = movementType
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const isDeletionMovement = normalizedType === 'eliminacion';

    if (!canManageAllMovements && !(isDeletionMovement && canDeleteInventory)) {
      return res.status(403).render('403', {
        message: 'No tienes permiso para registrar este movimiento de inventario'
      });
    }

    const resolvedUserId =
      (req.user && req.user.id) ||
      (req.session && req.session.user && req.session.user.id) ||
      req.body.userId;
    await inventarioService.recordMovement({
      productId: req.body.productId,
      quantity: req.body.quantity,
      movementType,
      supportDocument: req.body.supportDocument,
      userId: resolvedUserId
    });

    const movementDetails = {
      productId: Number(req.body.productId) || null,
      quantity: Number(req.body.quantity) || null,
      movementType,
      supportDocument: req.body.supportDocument || null,
      path: req.path,
      method: req.method,
      ip: req.ip
    };

    LoggerService.activity(
      'inventory_movement_create',
      resolvedUserId || null,
      (req.user && (req.user.username || req.user.name)) || 'usuario_sin_nombre',
      'inventory',
      movementDetails
    );

    try {
      await pool.query(
        'INSERT INTO activity_logs (user_id, action, module, details) VALUES (?, ?, ?, ?)',
        [resolvedUserId || null, 'inventory_movement_create', 'inventory', JSON.stringify(movementDetails)]
      );
    } catch (logError) {
      LoggerService.warn('No se pudo guardar activity_log de movimiento de inventario', 'activity', {
        error: logError.message,
        userId: resolvedUserId || null
      });
    }

    res.redirect('/inventario?success=Movimiento%20registrado');
  } catch (error) {
    res.redirect('/inventario?error=' + encodeURIComponent(error.message));
  }
}

async function deleteMovement(req, res) {
  try {
    await inventarioService.deleteMovement(req.params.id);
    res.redirect('/inventario?success=Movimiento%20eliminado');
  } catch (error) {
    res.redirect('/inventario?error=' + encodeURIComponent(error.message));
  }
}

async function exportProducts(req, res) {
  const format = (req.query.format || 'excel').toLowerCase();
  if (format !== 'excel') {
    return res.status(400).send('Formato inválido. Use excel.');
  }

  let ExcelJS;
  try {
    ExcelJS = require('exceljs');
  } catch (error) {
    return res.status(500).send('Falta la dependencia exceljs.');
  }

  const productFilters = {
    search: req.query.search || '',
    category: req.query.category || 'Todos',
    status: req.query.status || 'Todos',
    sortBy: req.query.sortBy || 'Última actualización'
  };

  const products = await inventarioService.listProducts(productFilters);

  const workbook = new ExcelJS.Workbook();
  const productsSheet = workbook.addWorksheet('Productos');
  productsSheet.addRow([
    'SKU',
    'Nombre',
    'Descripción',
    'Categoría',
    'Stock',
    'Stock mínimo',
    'Costo',
    'Precio',
    'Estado',
    'Última actualización'
  ]);

  products.forEach((row) => {
    const updatedAt = row.updated_at ? new Date(row.updated_at).toLocaleString('es-MX') : '-';
    productsSheet.addRow([
      row.sku || '-',
      row.name || '-',
      row.description || '-',
      row.category || '-',
      row.stock,
      row.minStock,
      row.cost,
      row.price,
      row.status || '-',
      updatedAt
    ]);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="productos-inventario.xlsx"');
  return workbook.xlsx.write(res);
}

async function exportReport(req, res) {
  const format = (req.query.format || '').toLowerCase();
  const reportFilters = {
    from: req.query.from || '',
    to: req.query.to || ''
  };
  const movements = await inventarioService.listMovements({
    from: reportFilters.from,
    to: reportFilters.to
  });
  const movementReport = await inventarioService.listMovementReport(reportFilters);
  const salesChart = await inventarioService.listSalesByMonthProduct(reportFilters);

  if (format === 'excel') {
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
    } catch (error) {
      return res.status(500).send('Falta la dependencia exceljs.');
    }

    const workbook = new ExcelJS.Workbook();

    const movementsSheet = workbook.addWorksheet('Movimientos Generados');
    movementsSheet.addRow(['Fecha', 'Producto', 'Tipo', 'Cantidad', 'Responsable', 'Referencia']);
    movements.forEach((row) => {
      movementsSheet.addRow([
        row.date,
        row.product || '-',
        row.type || '-',
        row.qty,
        row.owner || '-',
        row.ref || '-'
      ]);
    });

    const summarySheet = workbook.addWorksheet('Resumen Movimientos');
    summarySheet.addRow(['Fecha', 'Tipo', 'Cantidad']);
    movementReport.forEach((row) => {
      summarySheet.addRow([row.day, row.type, row.totalQty]);
    });

    const salesSheet = workbook.addWorksheet('Ventas Mensuales');
    salesSheet.addRow(['Mes', 'Producto', 'Cantidad']);
    salesChart.forEach((row) => {
      salesSheet.addRow([row.month, row.product, row.qty]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=\"reporte-inventario.xlsx\"');
    return workbook.xlsx.write(res);
  }

  if (format === 'pdf') {
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (error) {
      return res.status(500).send('Falta la dependencia pdfkit.');
    }

    const doc = new PDFDocument({ margin: 30 });
    const preferredFontPath = process.platform === 'win32'
      ? path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'segoeui.ttf')
      : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';
    const fontPath = fs.existsSync(preferredFontPath) ? preferredFontPath : null;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventario-pdf-'));
    const tempFilePath = path.join(tempDir, 'reporte-inventario.pdf');
    const writeStream = fs.createWriteStream(tempFilePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=\"reporte-inventario.pdf\"');

    if (fontPath) {
      doc.font(fontPath);
    }

    try {
      await new Promise((resolve, reject) => {
        const settleReject = (error) => reject(error);

        doc.on('error', settleReject);
        writeStream.on('error', settleReject);
        writeStream.on('finish', resolve);

        doc.pipe(writeStream);

      doc.fontSize(16).text('Reporte de Inventario', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Rango: ${reportFilters.from || 'N/A'} - ${reportFilters.to || 'N/A'}`);
      doc.moveDown();

      doc.fontSize(13).text('Movimientos generados');
      doc.moveDown(0.5);
      movements.forEach((row) => {
        const dateText = row.date ? new Date(row.date).toLocaleString('es-MX') : 'N/A';
        doc.fontSize(10).text(`${dateText} | ${row.product || '-'} | ${row.type || '-'} | ${row.qty} | ${row.owner || '-'} | ${row.ref || '-'}`);
      });

      doc.moveDown();
      doc.fontSize(13).text('Resumen de movimientos');
      doc.moveDown(0.5);
      movementReport.forEach((row) => {
        doc.fontSize(10).text(`${row.day} | ${row.type} | ${row.totalQty}`);
      });

      doc.moveDown();
      doc.fontSize(13).text('Ventas mensuales por producto');
      doc.moveDown(0.5);
      salesChart.forEach((row) => {
        doc.fontSize(10).text(`${row.month} | ${row.product} | ${row.qty}`);
      });

        doc.end();
      });

      return res.download(tempFilePath, 'reporte-inventario.pdf', (downloadError) => {
        fs.rmSync(tempDir, { recursive: true, force: true });

        if (downloadError) {
          LoggerService.error('Error enviando PDF de inventario', 'inventory', {
            error: downloadError.message,
            stack: downloadError.stack
          });
        }
      });
    } catch (error) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      LoggerService.error('Error generando PDF de inventario', 'inventory', {
        error: error.message,
        stack: error.stack
      });

      return res.status(500).send('No se pudo generar el PDF de inventario.');
    }

    return;
  }

  res.status(400).send('Formato inválido. Use pdf o excel.');
}

function parseCsvRows(raw) {
  const text = String(raw || '').trim();
  if (!text) return { delimiter: ',', rows: [] };
  const sample = text.split(/\r?\n/)[0] || '';
  const delimiter = (sample.split(';').length > sample.split(',').length) ? ';' : ',';
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim()));
  return { delimiter, rows };
}

async function importView(req, res) {
  res.render('inventario/importar', { messages: buildMessage(req), layout: 'layouts/header-menu', user: req.user });
}

async function importCsv(req, res) {

  try {

    const rawData = req.body.csvHiddenInput;

    if (!rawData) {

      return res.redirect(
        '/inventario/importar?error=' +
        encodeURIComponent('No se recibió el archivo.')
      );

    }

    const productos = JSON.parse(rawData);

    let imported = 0;
    let failed = 0;

    for (const producto of productos) {

      try {

        const record = {
          sku: producto.SKU || producto.sku || '',
          name: producto.Nombre || producto.name || '',
          description: producto.Descripción || producto.description || '',
          category: producto.Categoría || producto.category || '',
          price: producto.Precio || producto.price || 0,
          cost: producto.Costo || producto.cost || 0,
          minStock: producto['Stock Mínimo'] || producto.minStock || 0,
          stock: producto.Stock || producto.stock || 0,
          status: producto.Estado || producto.status || 'En venta'
        };

        await inventarioService.createProduct(record);

        imported++;

      } catch (error) {

        console.error('ERROR EN PRODUCTO');
        console.error(producto);
        console.error(error);

        failed++;

      }

    }

    return res.redirect(
      '/inventario?success=' +
      encodeURIComponent(`Importados ${imported}, errores ${failed}`)
    );

  } catch (error) {

    console.error('ERROR IMPORTANDO ARCHIVO');
    console.error(error);

    return res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });

  }

}

module.exports = {
  index,
  create,
  update,
  remove,
  createMovement,
  deleteMovement,
  exportProducts,
  exportReport,
  importView,
  importCsv
};
