document.addEventListener("DOMContentLoaded", () => {
    const progreso = document.getElementById("progresoModal");
    let catalogoRegimen = {};

    const raw = document.getElementById("clientsData").dataset.clients;
    let clients = raw ? JSON.parse(raw) : [];

    const searchInput = document.getElementById("clientSearch");
    const regimeFilter = document.getElementById("regimeFilter");
    const tableBody = document.getElementById("clientsTable");

    renderClients(clients);

    cargarCatalogos();

    // Cargar Catalogos 
    async function cargarCatalogos() {
        try {
            const res = await fetch("facturas/catalogos");
            const data = await res.json();
            catalogoRegimen = data.regimenFiscal;

            const selectRegimen = document.getElementById("regimen_fiscal");
            selectRegimen.innerHTML = `<option disabled selected value="">Selecciona un régimen...</option>`;

            regimeFilter.innerHTML = `<option value="">Todos los Regímenes</option>`;

            const fragmentSelect = document.createDocumentFragment();
            const fragmentFilter = document.createDocumentFragment();

            Object.entries(data.regimenFiscal).forEach(([clave, nombre]) => {
                const optSelect = document.createElement("option");
                optSelect.value = clave;
                optSelect.textContent = nombre;
                fragmentSelect.appendChild(optSelect);

                const optFilter = document.createElement("option");
                optFilter.value = clave;
                optFilter.textContent = nombre;
                fragmentFilter.appendChild(optFilter);
            });

            selectRegimen.appendChild(fragmentSelect);
            regimeFilter.appendChild(fragmentFilter);
        } catch (error) {
            console.error("Error cargando catálogos:", error);
        }
    }

    function renderClients(list) {
        if (!list || list.length === 0) {
            tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center p-6 text-gray-500">
                    <div class="flex justify-center mb-4">
                            <div class="bg-white p-5 rounded-full">
                                <i class="fa-solid fa-user-group text-3xl text-gray-400"></i>
                            </div>
                        </div>
                        <h2 class="text-lg font-semibold text-gray-800">Sin Resultados</h2>
                        <p class="text-gray-500 mt-2">No Se Encontraron Clientes Registrados.</p>
                </td>
            </tr>`;
            return;
        }

        const htmlRows = list.map(c => `
        <tr class="hover:bg-gray-50 transition divide-x divide-gray-300/40">
            <td class="p-3 break-words lg:p-4">${c.name}</td>
            <td class="p-3 break-words lg:p-4">${c.email}</td>
            <td class="p-3 break-words lg:p-4 ${c.phone ? '' : 'text-red-500 italic'}">
                ${c.phone ? c.phone.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3') : 'Sin telefono'}
            </td>
            <td class="p-3 break-words lg:p-4 ${c.address ? '' : 'text-red-500 italic'}">
                ${c.address ? c.address : 'Dirección no Registrada'}
            </td>
            <td class="p-3 break-words lg:p-4 ${c.postal_code ? '' : 'text-red-500 italic'}">
                #${c.postal_code ? c.postal_code : 'Sin Codigo Postal'}
            </td>
            <td class="p-3 break-words max-w-[180px] lg:p-4 ${c.tax_regime_text ? '' : 'text-red-500 italic'}">
                ${c.tax_regime_text ? c.tax_regime_text : 'Regimen Fiscal sin Registrar'}
            </td>
            <td class="p-3 break-words lg:p-4 ${c.rfc ? '' : 'text-red-500 italic'}">
                ${c.rfc ? c.rfc : 'RFC sin Registrar'}
            </td>
            <td class="p-3 lg:p-4 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-2 whitespace-nowrap">
                    <button title="Editar Datos del Cliente" data-cliente='${JSON.stringify(c)}' class="btnEditar inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-blue-600 bg-white text-blue-600 hover:bg-blue-50 transition text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                    </button>
                    <button title="Eliminar Cliente" data-id-cliente='${c.id}' class="btnEliminar inline-flex items-center justify-center px-2.5 py-1.5 rounded border border-red-600 bg-white text-red-600 hover:bg-red-50 transition text-xs font-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                    </button>
                </div>
            </td>
        </tr>`).join("");
        tableBody.innerHTML = htmlRows;
    }

    tableBody.addEventListener("click", (e) => {
        const btnEditar = e.target.closest(".btnEditar");
        const btnEliminar = e.target.closest(".btnEliminar");

        if (btnEditar) {
            const cliente = JSON.parse(btnEditar.dataset.cliente);
            editarCliente(cliente);
        } else if (btnEliminar) {
            clienteAEliminar = btnEliminar.dataset.idCliente;
            btnEliminarActivo = btnEliminar;
            modalDelete.classList.remove("hidden");
            modalDelete.classList.add("flex");
        }
    });

    function applyFilters() {
        const text = searchInput.value.toLowerCase();
        const regime = regimeFilter.value;

        const filtered = clients.filter(c => {

            const matchText =
                c.name?.toLowerCase().includes(text) ||
                c.email?.toLowerCase().includes(text) ||
                c.rfc?.toLowerCase().includes(text);

            const matchRegime = !regime || String(c.tax_regime) == regime;

            return matchText && matchRegime;
        });

        renderClients(filtered);
    }

    searchInput.addEventListener("input", applyFilters);

    regimeFilter.addEventListener("change", applyFilters);

    // Validaciones de RFC valido
    const rfcInput = document.getElementById("rfc");
    const rfcError = document.getElementById("rfc-error");

    function validarRFC(rfc) {
        rfc = rfc.toUpperCase().replace(/\s/g, "");

        const regex = /^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/;
        const match = rfc.match(regex);

        if (!match) return false;

        const fecha = match[2];
        const yy = parseInt(fecha.substring(0, 2));
        const mm = parseInt(fecha.substring(2, 4)) - 1;
        const dd = parseInt(fecha.substring(4, 6));

        const year = yy + (yy < 30 ? 2000 : 1900);
        const date = new Date(year, mm, dd);

        return (
            date.getFullYear() === year &&
            date.getMonth() === mm &&
            date.getDate() === dd
        );
    }

    if (rfcInput) {
        rfcInput.addEventListener("input", () => {
            const valor = rfcInput.value;

            if (!rfcError) return;

            if (valor.length === 0) {
                rfcError.classList.add("hidden");
                rfcInput.classList.remove("border-red-500", "border-green-500");
                return;
            }

            if (validarRFC(valor)) {
                rfcError.classList.add("hidden");
                rfcInput.classList.remove("border-red-500");
                rfcInput.classList.add("border-green-500");
            } else {
                rfcError.classList.remove("hidden");
                rfcInput.classList.add("border-red-500");
                rfcInput.classList.remove("border-green-500");
            }
        });
    }

    //Validar Codigo Postal
    function validarCodigoP(codigo) {
        const limpio = codigo.replace(/\D/g, "");
        return limpio.length === 5;
    }

    const CodigoPInput = document.getElementById('codigo_postal');

    CodigoPInput.addEventListener('input', (e) => {
        let value = e.target.value;

        value = value.replace(/\D/g, '');

        value = value.slice(0, 5);

        e.target.value = value;
    });

    //Validar Numero de Telefono
    function validarTelefono(phone) {
        const limpio = phone.replace(/\D/g, ""); // quitar espacios y todo lo que no sea número
        return limpio.length === 10;
    }

    // Aplicar Formato de 10 Digitos
    const telefonoInput = document.getElementById('telefono');

    telefonoInput.addEventListener('input', (e) => {
        let value = e.target.value;

        value = value.replace(/\D/g, '');

        value = value.slice(0, 10);

        // Aplicar Formato de 10 Digitos
        let formatted = '';
        if (value.length > 0) {
            formatted = value.substring(0, 3);
        }
        if (value.length > 3) {
            formatted += ' ' + value.substring(3, 6);
        }
        if (value.length > 6) {
            formatted += ' ' + value.substring(6, 10);
        }

        e.target.value = formatted;
    });

    //Modal Crear/Editar
    const modal = document.getElementById("modalCliente");
    const btnNuevo = document.getElementById("btnNuevoCliente");
    const cerrar = document.getElementById("cerrarModal");
    const cancelar = document.getElementById("cancelar");
    const form = document.getElementById("formCliente");

    const titulo = document.getElementById("tituloModal");
    const btnGuardar = document.getElementById("btnGuardar");

    let modo = "crear";
    const cerrarModalCliente = () => {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    };

    btnNuevo.addEventListener("click", () => {
        modo = "crear";
        progreso.classList.remove("hidden");
        form.reset();
        document.getElementById("clienteId").value = "";

        titulo.textContent = "Nuevo Cliente";
        btnGuardar.textContent = "Guardar";

        modal.classList.remove("hidden");
        modal.classList.add("flex");
    });

    [cerrar, cancelar].forEach((btn) => {
        btn.addEventListener("click", cerrarModalCliente);
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) cerrarModalCliente();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.classList.contains("hidden")) {
            cerrarModalCliente();
        }
    });

    // Modo Editar
    function editarCliente(cliente) {
        progreso.classList.add("hidden");

        modo = "editar";

        document.getElementById("clienteId").value = cliente.id;
        document.getElementById("nombre").value = cliente.name || "";
        document.getElementById("email").value = cliente.email || "";
        document.getElementById("telefono").value = cliente.phone || "";
        document.getElementById("direccion").value = cliente.address || "";
        document.getElementById("codigo_postal").value = cliente.postal_code || "";
        document.getElementById("regimen_fiscal").value = String(
            cliente.tax_regime || "",
        );
        document.getElementById("rfc").value = cliente.rfc || "";

        titulo.textContent = "Editar Cliente";
        btnGuardar.textContent = "Actualizar";

        modal.classList.remove("hidden");
        modal.classList.add("flex");
    }

    document.querySelectorAll(".btnEditar").forEach((btn) => {
        btn.addEventListener("click", () => {
            const cliente = JSON.parse(btn.dataset.cliente);
            editarCliente(cliente);
        });
    });

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombre").value.trim();
        const email = document.getElementById("email").value.trim();
        const telefono = document.getElementById("telefono").value.trim();
        const direccion = document.getElementById("direccion").value.trim();
        const codigoPostal = document.getElementById("codigo_postal").value.trim();
        const taxRegime = document.getElementById("regimen_fiscal").value;
        const rfc = document.getElementById("rfc").value;

        // Validar correo: que termine con dominio válido
        const emailLower = email.toLowerCase();
        const dominiosValidos = ['.com', '.net', '.org', '.mx', '.edu', '.gov', '.info', '.io', '.co'];
        const tieneDominioValido = dominiosValidos.some(d => emailLower.endsWith(d));

        if (!tieneDominioValido) {
            mostrarAlerta("warning", "El correo debe terminar en un dominio válido como: .com, .net, .org, .mx, etc.");
            document.getElementById("email").focus();
            return;
        }

        const data = {
            name: document.getElementById("nombre").value,
            email: document.getElementById("email").value,
            phone: document.getElementById("telefono").value,
            address: document.getElementById("direccion").value.trim() || null,
            postalCode: document.getElementById("codigo_postal").value,
            taxRegime: document.getElementById("regimen_fiscal").value,
            rfc: document.getElementById("rfc").value,
        };

        const id = document.getElementById("clienteId").value;

        if (!validarRFC(rfc)) {
            mostrarAlerta("warning", "RFC inválido");
            document.getElementById("rfc").focus();
            return;
        }

        if (!validarTelefono(telefono)) {
            mostrarAlerta("warning", "El teléfono debe tener 10 dígitos");
            document.getElementById("telefono").focus();
            return;
        }

        if (!validarCodigoP(codigoPostal)) {
            mostrarAlerta("warning", "El Código Postal debe tener 5 dígitos");
            document.getElementById("codigo_postal").focus();
            return;
        }

        try {
            let res;

            if (modo === "crear") {
                res = await fetch("/clientes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            } else {
                res = await fetch(`/clientes/${id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                });
            }

            const result = await res.json();

            if (!res.ok) {
                mostrarAlerta("warning", result.message || "Error al guardar");
                return;
            }

            const claveRegimen = result.tax_regime;
            result.tax_regime_text = catalogoRegimen?.[claveRegimen] || "Regimen Fiscal sin Registrar";

            const alertmesaje =
                modo === "crear" ? "Cliente Creado" : "Cliente Actualizado";

            mostrarAlerta("success", alertmesaje);

            if (modo === "crear") {
                clients.unshift(result);
            } else {
                const index = clients.findIndex(c => c.id == id);
                if (index !== -1) {
                    clients[index] = {
                        ...clients[index],
                        ...result
                    };
                }
            }

            applyFilters();

            cerrarModalCliente();

            form.reset();
            document.getElementById("clienteId").value = "";
        } catch (err) {
            console.error(err);
            mostrarAlerta("error", "Error de conexión con el servidor");
        }
    });

    // Eliminar
    const modalDelete = document.getElementById("modalConfirmDelete");
    const btnCancelarDelete = document.getElementById("btnCancelarDelete");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");

    let clienteAEliminar = null;
    let btnEliminarActivo = null;

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btnEliminar");
        if (!btn) return;

        clienteAEliminar = btn.dataset.idCliente;
        btnEliminarActivo = btn;

        modalDelete.classList.remove("hidden");
        modalDelete.classList.add("flex");
    });

    btnCancelarDelete.addEventListener("click", () => {
        modalDelete.classList.add("hidden");
        modalDelete.classList.remove("flex");

        clienteAEliminar = null;
        btnEliminarActivo = null;
    });

    btnConfirmDelete.addEventListener("click", async () => {
        if (!clienteAEliminar) return;

        try {
            btnConfirmDelete.disabled = true;
            btnConfirmDelete.textContent = "Eliminando...";

            const res = await fetch(`/clientes/${clienteAEliminar}`, {
                method: "DELETE",
            });

            const result = await res.json().catch(() => ({}));

            if (!res.ok) {
                mostrarAlerta("error", result.message || "Error al eliminar cliente");
                return;
            }

            mostrarAlerta("success", "Cliente Eliminado");

            // quitar fila sin reload
            const row = btnEliminarActivo?.closest("tr");
            if (row) row.remove();

            modalDelete.classList.add("hidden");
            modalDelete.classList.remove("flex");

            clienteAEliminar = null;
            btnEliminarActivo = null;
        } catch (err) {
            console.error(err);
            mostrarAlerta("error", "Error de conexión con el servidor");
        } finally {
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.textContent = "Eliminar";
        }
    });

    // Progreso del modal
    const camposBasicos = ['nombre'];
    const camposContacto = ['email', 'telefono', 'codigo_postal'];
    const camposFiscales = ['rfc', 'regimen_fiscal'];

    function actualizarProgresoModal() {
        const basicos = camposBasicos.every(id => document.getElementById(id)?.value?.trim());
        const contacto = camposContacto.every(id => document.getElementById(id)?.value?.trim());

        const fiscal = camposFiscales.every(id => {
            const el = document.getElementById(id);
            if (!el) return false;

            const value = el.value?.trim();
            if (!value) return false;

            if (id === 'rfc') {
                return validarRFC(value);
            }

            return true;
        });

        const pct = (basicos ? 34 : 0) + (contacto ? 33 : 0) + (fiscal ? 33 : 0);
        document.getElementById('modalBarra').style.width = pct + '%';
        document.getElementById('modalPorcentaje').textContent = pct + '%';

        setModalCheck('modal-check-basicos', basicos);
        setModalCheck('modal-check-contacto', contacto);
        setModalCheck('modal-check-fiscal', fiscal);
    }

    function setModalCheck(id, done) {
        const el = document.getElementById(id);
        if (!el) return;
        const icon = el.querySelector('i');
        const span = el.querySelector('span');

        if (done) {
            icon.className = 'fa-solid fa-circle-check text-sm';
            icon.style.color = '#FF5100';
            span.className = 'text-xs';
            span.style.color = '#1f2937';
        } else {
            icon.className = 'fa-regular fa-circle-check text-sm';
            icon.style.color = '#d1d5db';
            span.className = 'text-xs';
            span.style.color = '#9ca3af';
        }
    }

    form.querySelectorAll('input').forEach(el => el.addEventListener('input', actualizarProgresoModal));
    form.querySelectorAll('select').forEach(el => el.addEventListener('change', actualizarProgresoModal));

});
