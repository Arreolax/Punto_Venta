document.addEventListener("DOMContentLoaded", () => {
  tablaSeleccionada("cantidad");

  // ===== Gráfica de Barras =====
  const ctx = document.getElementById("salesChart");

  if (ctx) {
    const labelsCantidad = JSON.parse(ctx.dataset.labelsCantidad);
    const dataCantidad = JSON.parse(ctx.dataset.dataCantidad);

    const labelsTotal = JSON.parse(ctx.dataset.labelsTotal);
    const dataTotal = JSON.parse(ctx.dataset.dataTotal);

    let modo = "cantidad";

    const chart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labelsCantidad,
        datasets: [
          {
            label: "Cantidad Vendida",
            data: dataCantidad,
            backgroundColor: ["#f97316"],
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });

    // Botón Grafica de Barras
    const btn = document.getElementById("toggleModo");

    btn.addEventListener("click", () => {
      if (modo === "cantidad") {
        modo = "total";

        chart.data.labels = labelsTotal;
        chart.data.datasets[0].data = dataTotal;
        chart.data.datasets[0].label = "Total Vendido ($)";
        btn.textContent = "Ver por Cantidad";

      } else {
        modo = "cantidad";

        chart.data.labels = labelsCantidad;
        chart.data.datasets[0].data = dataCantidad;
        chart.data.datasets[0].label = "Cantidad Vendida";
        btn.textContent = "Ver por Total $";
      }

      chart.update();

      tablaSeleccionada(modo);
      ordenarTabla(modo);
    });
  }

  function ordenarTabla(modo) {
    const tbody = document.getElementById("tablaProductos");
    const filas = Array.from(tbody.querySelectorAll("tr"));

    filas.sort((a, b) => {
      let valA, valB;

      if (modo === "cantidad") {
        valA = Number(a.children[2].dataset.cantidad);
        valB = Number(b.children[2].dataset.cantidad);
      } else {
        valA = Number(a.children[3].dataset.total);
        valB = Number(b.children[3].dataset.total);
      }

      return valB - valA;
    });

    tbody.innerHTML = "";
    filas.forEach((fila) => tbody.appendChild(fila));
  }

  function tablaSeleccionada(modo) {
    const tdCantidad = document.querySelectorAll(".tdCantidad");
    const tdTotal = document.querySelectorAll(".tdTotal");

    const thCantidad = document.getElementById("thCantidad");
    const thTotal = document.getElementById("thTotal");

    if (!thCantidad || !thTotal) return;

    thCantidad.classList.remove("bg-gray-100", "text-black");
    thTotal.classList.remove("bg-gray-100", "text-black");

    tdCantidad.forEach(td =>
      td.classList.remove("text-green-700", "font-semibold")
    );

    tdTotal.forEach(td =>
      td.classList.remove("text-green-700", "font-semibold")
    );

    if (modo === "cantidad") {
      thCantidad.classList.add("bg-gray-100", "text-black");
      tdCantidad.forEach(td =>
        td.classList.add("text-green-700", "font-semibold")
      );
    } else {
      thTotal.classList.add("bg-gray-100", "text-black");
      tdTotal.forEach(td =>
        td.classList.add("text-green-700", "font-semibold")
      );
    }
  }

  // ===== Gráfica de Dona =====
  const ctx2 = document.getElementById("stockChart");

  if (ctx2) {
    const stockLabels = JSON.parse(ctx2.dataset.stockLabels);
    const stockData = JSON.parse(ctx2.dataset.stockData);

    new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: stockLabels,
        datasets: [
          {
            data: stockData,
            backgroundColor: [
              "#f97316",
              "#fb8230",
              "#fc8f42",
              "#fd9d55",
              "#fdab68",
              "#feb97c",
              "#fec790",
              "#fed5a5",
              "#fee3bb",
            ],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        cutout: "70%",
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const value = context.raw;
                const porcentaje = ((value / total) * 100).toFixed(2);
                return `${context.label}: ${porcentaje}%`;
              },
            },
          },
          legend: {
            position: "right",
            labels: {
              boxWidth: 12,
              padding: 15,
              font: {
                size: 12,
              },
            },
          },
        },
      },
    });
  }

  // ===== Alertas de Stock =====

  const toggleBtn = document.getElementById("toggleStock");
  const lowStockList = document.getElementById("lowStockList");
  const zeroStockList = document.getElementById("zeroStockList");
  const stockTitle = document.getElementById("stockTitle");

  let showingLowStock = true;

  toggleBtn.addEventListener("click", () => {
    showingLowStock = !showingLowStock;

    if (showingLowStock) {
      lowStockList.classList.remove("hidden");
      zeroStockList.classList.add("hidden");

      stockTitle.innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i>
        Productos con Stock Bajo
      `;

      toggleBtn.textContent = "Ver Productos sin Stock";
    } else {
      lowStockList.classList.add("hidden");
      zeroStockList.classList.remove("hidden");

      stockTitle.innerHTML = `
        <i class="fa-solid fa-circle-xmark"></i>
        Productos sin Stock
      `;

      toggleBtn.textContent = "Ver Productos con Stock Bajo";
    }
  });

});
