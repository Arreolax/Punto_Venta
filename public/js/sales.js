document.addEventListener("DOMContentLoaded", () => {
  window.toggleCard = function (element) {
    const content = element?.nextElementSibling;
    const icon = element?.querySelector("svg");

    if (!content) return;
 
    content.classList.toggle("hidden");
    icon?.classList.toggle("rotate-180");
  };

  document.querySelectorAll(".sale-card-header").forEach((header) => {
    header.addEventListener("click", () => window.toggleCard(header));
  });

  const formFiltro = document.querySelector("form");
  const inputFechaInicio = document.querySelector("[name='fechaInicio']");
  const inputFechaFin = document.querySelector("[name='fechaFin']");
  const inputSearch = document.getElementById("saleSearch");
  const selectMetodo = document.querySelector("[name='metodo']");

  let timeout = null;

  // Fechas
  function normalizarFechas() {
    let fechainicio = inputFechaInicio?.value || "";
    let fechafin = inputFechaFin?.value || "";

    const hoy = new Date().toLocaleDateString('en-CA');

    if (fechainicio && !fechafin) {
      fechafin = hoy;
    }

    if (!fechainicio && fechafin) {
      fechainicio = fechafin;
    }

    if (fechainicio && fechafin && fechafin < fechainicio) {
      mostrarAlerta?.("warning", "La Fecha Final No Puede Ser Menor Que La Inicial.");
      return null;
    }

    return { fechainicio, fechafin };
  }

  if (formFiltro) {
    formFiltro.addEventListener("submit", function (e) {

      const fechas = normalizarFechas();

      if (!fechas) {
        e.preventDefault();
        return;
      }

      if (inputFechaInicio) {
        inputFechaInicio.value = fechas.fechainicio;
      }

      if (inputFechaFin) {
        inputFechaFin.value = fechas.fechafin;
      }
    });
  }

  // Buscador
  if (inputSearch) {
    inputSearch.addEventListener("input", () => {
      clearTimeout(timeout);

      timeout = setTimeout(async () => {

        const search = inputSearch.value.trim();

        if (!search) return;

        const fechas = normalizarFechas();
        if (!fechas) return;

        const metodo = selectMetodo?.value || "Todos";

        try {
          const params = new URLSearchParams({
            search,
            fechaInicio: fechas.fechainicio,
            fechaFin: fechas.fechafin,
            metodo
          });

          const res = await fetch(`/ventas?${params}`, {
            headers: { "X-Requested-With": "XMLHttpRequest" }
          });

          const sales = await res.json();

          renderSales(sales);

        } catch (error) {
          console.error(error);
        }

      }, 300);
    });
  }

  function renderSales(sales) {
    const container = document.getElementById("salesContainer");

    if (!sales.length) {
      container.innerHTML = ` 
      <div class="bg-white border-0 border-white rounded-xl  p-10 text-center max-w-md mx-auto">

                            <div class="flex justify-center mb-4">
                                <div class="bg-white p-5 rounded-full">
                                    <i class="fa-solid fa-cart-shopping text-3xl text-gray-800"></i>
                                </div>
                            </div>

                            <h2 class="text-lg font-semibold text-gray-800">
                                Sin Resultados
                            </h2>

                            <p class="text-gray-500 mt-2">
                                No Se Encontraron Ventas Registradas.
                            </p>

                        </div>
    `;
      return;
    }

    container.innerHTML = sales.map(sale => `
    <div class="mb-5 bg-white shadow-xl rounded-xl border border-gray-800 overflow-hidden">
      <div class="p-5 grid grid-cols-6 gap-6 text-sm">

        <div>
          <p class="text-gray-500 text-xs">Fecha de Creacion</p>
          <p class="font-semibold text-gray-800">${sale.created_at}</p>
        </div>

        <div>
          <p class="text-gray-500 text-xs">Folio de Compra</p>
          <p class="font-semibold text-gray-800">${sale.folio_venta}</p>
        </div>

        <div>
          <p class="text-gray-500 text-xs">Nombre del Cliente</p>
          <p class="font-semibold text-gray-800">${sale.nombre_cliente}</p>
        </div>

        <div>
          <p class="text-gray-500 text-xs">Nombre del Vendedor</p>
          <p class="font-semibold text-gray-800">${sale.nombre_empleado}</p>
        </div>

        <div>
          <p class="text-gray-500 text-xs">Metodo de Pago</p>
            <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
              ${sale.metodo_pago.charAt(0).toUpperCase() + sale.metodo_pago.slice(1)}
            </span>
        </div>

        <div class="text-right">
          <p class="text-gray-500 text-xs">Total de Compra</p>
          <p class="italic font-bold text-lg text-gray-900">$${sale.total_pago}</p>
        </div>

      </div>
    </div>
  `).join("");
  }

  // Regresar (Sale Preview)
  const btnRegresarPreview = document.getElementById("btnRegresarS");

  if (btnRegresarPreview) {
    btnRegresarPreview.addEventListener("click", () => {
      window.location.href = "/ventas";
    });
  }

  // Nueva Venta
  const formularioVenta = document.getElementById("formularioVenta");

  // Solo ejecutar lógica de nueva venta si el formulario existe
  if (!formularioVenta) {
    const contenido = document.getElementById("contenido");
    // loader ya está definido en global.js, no redeclarar
    if (contenido && loader) {
      contenido.classList.remove("hidden");
      loader.classList.add("hidden");
    }
    return;
  }

  // Elementos de nueva venta
  const metodoPago = document.getElementById("metodoPago");
  const seccionReferencia = document.getElementById("seccionReferencia");
  const seccionEfectivo = document.getElementById("seccionEfectivo");
  const referenciaPago = document.getElementById("referenciaPago");
  const montoRecibido = document.getElementById("montoRecibido");
  const cambioReferencia = document.getElementById("cambioReferencia");
  const buscarCliente = document.getElementById("buscarCliente");
  const resultadosClientes = document.getElementById("resultadosClientes");
  const clienteId = document.getElementById("clientId");
  const buscarProducto = document.getElementById("buscarProducto");
  const resultadosProductos = document.getElementById("resultadosProductos");
  const tablaProductos = document.getElementById("tablaProductos");
  const totalVentaSinIVA = document.getElementById("totalSinIVA");
  const totalVentaIVA = document.getElementById("totalIVA");
  const totalVenta = document.getElementById("totalVenta");

  // Array para almacenar productos en el carrito
  let productosEnVenta = [];
  let totalEstimado = 0;

  // Busqueda de clientes

  let tiempoDebounceCliente = null;

  if (buscarCliente) {
    buscarCliente.addEventListener("input", () => {
      clearTimeout(tiempoDebounceCliente);

      const termino = buscarCliente.value.trim();

      if (!termino || termino === "Público en General") {
        resultadosClientes.classList.add("hidden");
        resultadosClientes.innerHTML = "";
        clienteId.value = "1";
        return;
      }

      tiempoDebounceCliente = setTimeout(async () => {
        try {
          const response = await fetch(
            `/ventas/buscar-cliente?q=${encodeURIComponent(termino)}`,
          );

          if (!response.ok) throw new Error("Error en búsqueda");

          const clientes = await response.json();
          resultadosClientes.innerHTML = "";

          if (clientes.length === 0) {
            const div = document.createElement("div");
            div.className = "p-2 text-gray-500 text-sm";
            div.textContent = "No se encontraron clientes";
            resultadosClientes.appendChild(div);
            resultadosClientes.classList.remove("hidden");
            return;
          }

          clientes.forEach((cliente) => {
            const div = document.createElement("div");
            div.className =
              "p-2 hover:bg-blue-100 cursor-pointer border-b text-sm";
            div.innerHTML = `<strong>${cliente.name}</strong><br/><span class="text-xs text-gray-500">${cliente.email || "sin email"}</span>`;

            div.addEventListener("click", () => {
              buscarCliente.value = cliente.name;
              clienteId.value = cliente.id;
              resultadosClientes.classList.add("hidden");
              resultadosClientes.innerHTML = "";
            });

            resultadosClientes.appendChild(div);
          });

          resultadosClientes.classList.remove("hidden");
        } catch (error) {
          console.error("Error al buscar clientes:", error);
          mostrarAlerta("error", "Error al buscar clientes");
        }
      }, 300);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
      if (
        !buscarCliente.contains(e.target) &&
        !resultadosClientes.contains(e.target)
      ) {
        resultadosClientes.classList.add("hidden");
      }
    });
  }

  // Metodo de pago

  if (metodoPago) {
    metodoPago.addEventListener("change", () => {
      const valor = metodoPago.value;

      // Limpiar valores
      referenciaPago.value = "";
      montoRecibido.value = "";
      cambioReferencia.value = "$0.00";

      if (valor === "transferencia" || valor === "tarjeta") {
        seccionReferencia.classList.remove("hidden");
        seccionEfectivo.classList.add("hidden");
        referenciaPago.required = true;
      } else if (valor === "efectivo") {
        seccionReferencia.classList.add("hidden");
        seccionEfectivo.classList.remove("hidden");
        referenciaPago.required = false;
      } else {
        seccionReferencia.classList.add("hidden");
        seccionEfectivo.classList.add("hidden");
        referenciaPago.required = false;
      }
    });
  }

  // Calcular cambio en tiempo real (solo referencia visual)
  if (montoRecibido) {
    montoRecibido.addEventListener("input", () => {
      const monto = parseFloat(montoRecibido.value) || 0;
      const cambio = monto - totalEstimado;

      if (cambio < 0) {
        cambioReferencia.style.color = "#EF4444";
        cambioReferencia.value = "$" + cambio.toFixed(2);
      } else {
        cambioReferencia.style.color = "#000000";
        cambioReferencia.value = "$" + cambio.toFixed(2);
      }
    });
  }

  // Busqueda de productos

  let tiempoDebounceProducto = null;

  if (buscarProducto) {
    buscarProducto.addEventListener("input", () => {
      clearTimeout(tiempoDebounceProducto);

      const termino = buscarProducto.value.trim();

      if (!termino) {
        resultadosProductos.classList.add("hidden");
        resultadosProductos.innerHTML = "";
        return;
      }

      tiempoDebounceProducto = setTimeout(async () => {
        try {
          const response = await fetch(
            `/ventas/buscar-producto?q=${encodeURIComponent(termino)}`,
          );

          if (!response.ok) throw new Error("Error en búsqueda");

          const productos = await response.json();
          resultadosProductos.innerHTML = "";

          if (productos.length === 0) {
            const div = document.createElement("div");
            div.className = "p-2 text-gray-500 text-sm";
            div.textContent = "No se encontraron productos";
            resultadosProductos.appendChild(div);
            resultadosProductos.classList.remove("hidden");
            return;
          }

          productos.forEach((producto) => {
            const div = document.createElement("div");
            div.className =
              "p-3 hover:bg-blue-100 cursor-pointer border-b text-sm";
            div.innerHTML = `
              <div class="flex justify-between">
                <div>
                  <strong>${producto.etiqueta}</strong><br/>
                  <span class="text-xs text-gray-500">Ref: ${producto.ref_producto}</span>
                </div>
                <div class="text-right">
                  <div class="font-semibold">$${parseFloat(producto.precio_venta).toFixed(2)}</div>
                  <div class="text-xs text-gray-500">Stock: ${producto.stock_fisico}</div>
                </div>
              </div>
            `;

            div.addEventListener("click", () => {
              agregarProductoAlCarrito(producto);
              buscarProducto.value = "";
              resultadosProductos.classList.add("hidden");
              resultadosProductos.innerHTML = "";
            });

            resultadosProductos.appendChild(div);
          });

          resultadosProductos.classList.remove("hidden");
        } catch (error) {
          console.error("Error al buscar productos:", error);
          mostrarAlerta("error", "Error al buscar productos");
        }
      }, 300);
    });

    // Cerrar dropdown al hacer click fuera
    document.addEventListener("click", (e) => {
      if (
        !buscarProducto.contains(e.target) &&
        !resultadosProductos.contains(e.target)
      ) {
        resultadosProductos.classList.add("hidden");
      }
    });
  }

  // Carrito

  function agregarProductoAlCarrito(producto) {
    const existente = productosEnVenta.find(
      (p) => p.product_id === producto.id,
    );

    if (existente) {
      existente.quantity += 1;
    } else {
      productosEnVenta.push({
        product_id: producto.id,
        product_name: producto.etiqueta,
        description: null,
        quantity: 1,
        unit_price: parseFloat(producto.precio_venta),
      });
    }

    renderizarCarrito();
  }

  function renderizarCarrito() {
    tablaProductos.innerHTML = "";
    totalSinIVA = 0;
    totalIVA = 0;
    totalEstimado = 0;

    productosEnVenta.forEach((producto, indice) => {
      const IVA = 0.16;

      const subtotalIVA =
        (producto.unit_price - producto.unit_price / (1 + IVA)) *
        producto.quantity;
      totalIVA += subtotalIVA;

      const subtotalSinIVA =
        (producto.unit_price / (1 + IVA)) * producto.quantity;
      totalSinIVA += subtotalSinIVA;

      const subtotal = producto.unit_price * producto.quantity;
      totalEstimado += subtotal;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="border p-2">${producto.product_name}</td>
        <td class="border p-2">$${(producto.unit_price / 1.16).toFixed(2)}</td>
        <td class="border p-2">$${(producto.unit_price - producto.unit_price / 1.16).toFixed(2)}</td>
        <td class="border p-2">
          <input type="number" class="w-20 border rounded px-1 precio-input" 
            value="${producto.unit_price.toFixed(2)}" 
            step="0.01" min="0.01"
            data-indice="${indice}">
        </td>
        <td class="border p-2">
          <input type="number" class="w-16 border rounded px-1 cantidad-input" 
            value="${producto.quantity}" 
            min="1"
            data-indice="${indice}">
        </td>
        <td class="border p-2 text-right">$${subtotal.toFixed(2)}</td>
        <td class="border p-2 text-center">
          <button type="button" class="bg-red-500 text-white px-2 py-1 rounded text-xs eliminar-btn" 
            data-indice="${indice}">
            Eliminar
          </button>
        </td>
      `;

      tablaProductos.appendChild(tr);
    });

    document.querySelectorAll(".cantidad-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const indice = parseInt(e.target.dataset.indice);
        const nuevaCantidad = parseInt(e.target.value) || 1;
        if (nuevaCantidad > 0) {
          productosEnVenta[indice].quantity = nuevaCantidad;
          renderizarCarrito();
        }
      });
    });

    document.querySelectorAll(".precio-input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const indice = parseInt(e.target.dataset.indice);
        const nuevoPrecio =
          parseFloat(e.target.value) || productosEnVenta[indice].unit_price;
        if (nuevoPrecio > 0) {
          productosEnVenta[indice].unit_price = nuevoPrecio;
          renderizarCarrito();
        }
      });
    });

    document.querySelectorAll(".eliminar-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const indice = parseInt(btn.dataset.indice);
        productosEnVenta.splice(indice, 1);
        renderizarCarrito();
      });
    });

    totalVentaSinIVA.textContent = "$" + totalSinIVA.toFixed(2);
    totalVentaIVA.textContent = "$" + totalIVA.toFixed(2);
    totalVenta.textContent = "$" + totalEstimado.toFixed(2);

    if (metodoPago.value === "efectivo" && montoRecibido.value) {
      const monto = parseFloat(montoRecibido.value) || 0;
      const cambio = monto - totalEstimado;

      if (cambio < 0) {
        cambioReferencia.style.color = "#EF4444";
        cambioReferencia.value = "$" + cambio.toFixed(2);
      } else {
        cambioReferencia.style.color = "#000000";
        cambioReferencia.value = "$" + cambio.toFixed(2);
      }
    }
    //Oculta si no hay productos en el carrito
    const contenedorTabla = document.getElementById("contenedorTabla");
    const contenedorTotales = document.getElementById("contenedorTotales");
    const btnGuardarVenta = document.getElementById("btnGuardarVenta");

    if (productosEnVenta.length === 0) {
      contenedorTabla.classList.add("hidden");
      contenedorTotales.classList.add("hidden");

      btnGuardarVenta.disabled = true;
      btnGuardarVenta.classList.add("opacity-50", "cursor-not-allowed");
    } else {
      contenedorTabla.classList.remove("hidden");
      contenedorTotales.classList.remove("hidden");

      btnGuardarVenta.disabled = false;
      btnGuardarVenta.textContent = "Guardar Venta";
      btnGuardarVenta.classList.remove("opacity-50", "cursor-not-allowed");
    }
    // Mensaje de carrito vacio
    const mensajeVacio = document.getElementById("mensajeVacio");

    if (productosEnVenta.length === 0) {
      mensajeVacio.classList.remove("hidden");
    } else {
      mensajeVacio.classList.add("hidden");
    }
  }

  // Guardar venta

  if (formularioVenta) {
    formularioVenta.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (productosEnVenta.length === 0) {
        mostrarAlerta("warning", "Agrega al menos un producto a la venta");
        return;
      }

      if (!metodoPago.value) {
        mostrarAlerta("warning", "Selecciona un Método de Pago");
        return;
      }

      if (metodoPago.value === "efectivo" && !montoRecibido.value) {
        mostrarAlerta("warning", "Ingresa el Dinero Recibido");
        return;
      }

      if (
        (metodoPago.value === "transferencia" ||
          metodoPago.value === "tarjeta") &&
        !referenciaPago.value
      ) {
        mostrarAlerta("warning", "Debes ingresar la referencia de pago");
        return;
      }

      const datos = {
        client_id: parseInt(clienteId.value) || 1,
        payment_method: metodoPago.value,
        cash_received:
          metodoPago.value === "efectivo"
            ? parseFloat(montoRecibido.value)
            : null,
        payment_reference:
          metodoPago.value === "transferencia" || metodoPago.value === "tarjeta"
            ? referenciaPago.value
            : null,
        productos: productosEnVenta,
      };

      try {
        mostrarLoader();

        const response = await fetch("/ventas/guardar", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(datos),
        });

        const resultado = await response.json();
        ocultarLoader();

        if (response.ok && resultado.success) {
          mostrarAlerta(
            "success",
            `Venta registrada exitosamente.\nTicket: ${resultado.ticket_number}`,
          );

          setTimeout(() => {
            window.location.href = `/ventas`;
          }, 2000);
        } else {
          mostrarAlerta(
            "error",
            resultado.message || "Error al guardar la venta",
          );
        }
      } catch (error) {
        ocultarLoader();
        console.error("Error:", error);
        mostrarAlerta("error", "Error de conexión al guardar la venta");
      }
    });
  }
  renderizarCarrito();
});
