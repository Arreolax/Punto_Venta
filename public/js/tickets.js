// Extender Card (Tickets)
window.toggleCard = function (element) {
  const content = element?.nextElementSibling;
  const icon = element?.querySelector("svg");

  if (!content) return;

  content.classList.toggle("hidden");
  icon?.classList.toggle("rotate-180");
};

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll(".ticket-card-header").forEach((header) => {
    header.addEventListener("click", () => window.toggleCard(header));
  });

  // Filtros de busqueda
  const formFiltro = document.querySelector("form");
  const inputFechaInicio = document.querySelector("input[name='fechaInicio']");
  const inputFechaFin = document.querySelector("input[name='fechaFin']");
  const inputSearch = document.getElementById("ticketSearch");
  const selectMetodo = document.querySelector("select[name='metodo']");

  // Fechas
  if (formFiltro && inputFechaInicio && inputFechaFin) {
    formFiltro.addEventListener("submit", function (e) {

      let fechainicio = inputFechaInicio.value;
      let fechafin = inputFechaFin.value;

      const hoy = new Date().toLocaleDateString('en-CA');

      if (fechainicio && !fechafin) {
        inputFechaFin.value = hoy;
        fechafin = hoy;
      }

      if (!fechainicio && fechafin) {
        inputFechaInicio.value = fechafin;
        fechainicio = fechafin;
      }

      if (fechainicio && fechafin) {
        if (fechafin < fechainicio) {
          e.preventDefault();
          mostrarAlerta("warning", "La Fecha Final No Puede Ser Menor Que La Inicial.");
          return;
        }
      }

    });
  }

  // Busqueda
  let timeout = null;

  inputSearch.addEventListener("input", () => {
    clearTimeout(timeout);

    timeout = setTimeout(async () => {

      const search = inputSearch.value.trim();
      const fechaInicio = inputFechaInicio?.value || "";
      const fechaFin = inputFechaFin?.value || "";
      const metodo = selectMetodo?.value || "Todos";

      try {
        const params = new URLSearchParams({
          search,
          fechaInicio,
          fechaFin,
          metodo
        });

        const res = await fetch(`/tickets?${params}`, {
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        });

        const tickets = await res.json();

        renderTickets(tickets);

      } catch (error) {
        console.error(error);
      }

    }, 300);
  });

  function renderTickets(tickets) {
    const container = document.getElementById("ticketsContainer");

    if (!tickets.length) {
      container.innerHTML = `
      <div class="text-center text-gray-500 py-5">
        Sin resultados
      </div>
    `;
      return;
    }

    container.innerHTML = tickets.map(ticket => `
    <div class="mb-5 bg-white shadow-xl rounded-xl border border-gray-800 overflow-hidden">

      <div class="p-5 flex justify-between items-center hover:bg-gray-50 transition">

        <div class="grid grid-cols-6 gap-6 w-full text-sm">

          <div>
            <p class="text-gray-500 text-xs">Fecha de Creacion</p>
            <p class="font-semibold text-gray-800">${ticket.created_at}</p>
          </div>

          <div>
            <p class="text-gray-500 text-xs">Folio de Ticket</p>
            <p class="font-semibold text-gray-800">${ticket.folio}</p>
          </div>

          <div>
            <p class="text-gray-500 text-xs">Nombre del Vendedor</p>
            <p class="font-semibold text-gray-800">${ticket.nombre_empleado}</p>
          </div>

          <div>
            <p class="text-gray-500 text-xs">Nombre del Cliente</p>
            <p class="font-semibold text-gray-800">${ticket.nombre_cliente}</p>
          </div>

          <div>
            <p class="text-gray-500 text-xs">Método de Pago</p>
            <span class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 font-medium">
              ${ticket.metodo_pago.charAt(0).toUpperCase() + ticket.metodo_pago.slice(1)}
            </span>
          </div>

          <div class="text-right">
            <p class="text-gray-500 text-xs">Total de Compra</p>
            <p class="italic font-bold text-lg text-gray-900">
              $${ticket.total_pago}
            </p>
          </div>

        </div>

      </div>

    </div>
  `).join("");
  }
});
