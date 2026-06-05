const { getDashboardDataService } = require('../services/dashboard.service');
const inventarioService = require('../services/inventario.service');

const dashboardView = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const {
      sales,
      salesT,
      salesD,
      stock_cat,
      recentSales,
      metrics,
      lowStockProducts,
      zeroStockProducts,
      currentPage,
      totalPages,
      salesChart: []
    } = await getDashboardDataService(page);

    // Gráfica de Barras
    const labels = sales.map(s => s.producto); 
    const labelsT = salesT.map(s => s.producto); 

    const dataCantidad = sales.map(s => Number(s.cantidad_vendida));
    const dataTotal = salesT.map(s => Number(s.total));

    //Grafica de Dona 
    //Recortar categorias muy largas cada 15 letras
    const stockLabels = stock_cat.map(s => {
      return s.categoria.length > 15
        ? s.categoria.match(/.{1,20}/g)
        : s.categoria;
    });

    const stockData = stock_cat.map(s => Number(s.total));

    res.render('dashboard', {
      sales,
      salesT,
      salesD,
      labels,
      labelsT,
      dataCantidad,
      dataTotal,
      stockLabels,
      stockData,
      recentSales,
      metrics,
      lowStockProducts,
      zeroStockProducts,
      currentPage,
      totalPages,
      salesChart: []
    });

  } catch (error) {
    console.error(error);
    res.render('dashboard', {
      sales: [],
      salesD: [],
      labels: [],
      labelsT: [],
      data: [],
      stockLabels: [],
      stockData: [],
      recentSales: [],
      metrics: [],
      lowStockProducts: [],
      zeroStockProducts: [],
      currentPage: page = 1,
      totalPages: 1,
      salesChart: []
    });
  }
};

async function dashboard(req, res) {
  try {
    const metrics = await inventarioService.getMetrics();
    const alerts = await inventarioService.getAlerts();
    const sales = await inventarioService.listSales();
    const salesChart = await inventarioService.listSalesByMonthProduct({});

    res.render('dashboard', {
      metrics,
      alerts,
      sales,
      salesChart
    });

  } catch (error) {
    console.error(error);
    res.send('Error en dashboard');
  }
}

module.exports = { dashboardView };