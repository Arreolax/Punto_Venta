const btnTimbrar = document.getElementById("btnTimbrar");
const btnTextT = document.getElementById("btnTextT");

const btnBorrador = document.getElementById("btnBorrador");

const btnEditarCliente = document.getElementById("editUser");

const modalGenerando = document.getElementById("modalGenerando");

const btnConfirmInvoice = document.getElementById("btnConfirmInvoice");

let clienteSeleccionado = null;

let metodo_pago = null;

let conceptos = [];

let datos_factura = []

let dataInvoice = {};

//
function iniciarMensajesCarga() {

    const mensajes = [
        "Validando datos fiscales...",
        "Conectando con Facturama..."
    ];

    let index = 0;

    const textoCarga = document.getElementById("textoCarga");

    if (!textoCarga) return;

    textoCarga.textContent = mensajes[index];

    const intervalo = setInterval(() => {

        index++;

        if (index >= mensajes.length) {
            clearInterval(intervalo);
            return;
        }

        textoCarga.textContent = mensajes[index];

    }, 600);

}

//Cargar Productos con ticket seleccionado
const selectTickets = document.getElementById("conceptos");

selectTickets.addEventListener("change", async (e) => {
    const folio = e.target.value;
    if (!folio) return;

    try {
        const res = await fetch(`/facturas/ticket/${folio}`);
        const ticket = await res.json();

        // Productos
        conceptos = ticket.productos.map(p => ({
            id: p.id,
            cantidad: p.cantidad,
            claveSat: p.sat_clave || '',
            descripcion: p.nombre,
            precio: p.precio_unidad,
            unidad_clave: p.sat_unidad_clave,
            unidad_descripcion: p.sat_unidad_descripcion
        }));

        datos_factura = {
            moneda: ticket.moneda || '',
            tipo_recibo: ticket.tipo_recibo || '',
            metodo_recibo: ticket.metodo_recibo || '',
            uso_cfdi: ticket.uso_cfdi || ''
        }

        metodo_pago = ticket.metodo_pago;

        renderConceptos();
        renderDatosFactura();

        // Cliente
        if (ticket.client_id && ticket.client_id !== 1) {
            llenarClienteDesdeTicket(ticket);

            clienteSeleccionado = {
                id: ticket.client_id,
                name: ticket.nombre_cliente,
                rfc: ticket.rfc_cliente,
                tax_regime: ticket.regimen_fiscal_cliente,
                address: ticket.domicilio_cliente,
                postal_code: ticket.codigo_postal_cliente,
                phone: ticket.telefono_cliente,
                email: ticket.correo_cliente
            };

            btnEditarCliente.classList.remove('hidden');
            document.getElementById("avisoPublico")?.classList.add("hidden");
        } else {
            limpiarCliente();

            clienteSeleccionado = null;

            mostrarAvisoPublico();

            btnBorrador.disabled = true;
            btnTimbrar.disabled = true;

            btnBorrador.classList.add("opacity-50", "cursor-not-allowed");
            btnTimbrar.classList.add("opacity-50", "cursor-not-allowed");
        }

        validarFormularioTimbrado();
    } catch (error) {
        console.error("Error cargando ticket:", error);
    }
});

function llenarClienteDesdeTicket(ticket) {
    document.getElementById("buscarCliente").value = ticket.nombre_cliente || '';
    document.getElementById("clienteId").value = ticket.client_id || '';
    document.getElementById("clienteRfc").value = ticket.rfc_cliente || '';
    document.getElementById("regimen_fiscal").value = ticket.regimen_fiscal_cliente || '';
    document.getElementById("clienteDireccion").value = ticket.domicilio_cliente || 'Dirección no Registrada';
    document.getElementById("clienteCp").value = ticket.codigo_postal_cliente || '';
    document.getElementById("clienteTelefono").value = ticket.telefono_cliente || '';
    document.getElementById("clienteCorreo").value = ticket.correo_cliente || '';
}

function limpiarCliente() {
    document.getElementById("clienteId").value = '';
    document.getElementById("buscarCliente").value = '';
    document.getElementById("clienteRfc").value = '';
    document.getElementById("clienteDireccion").value = '';
    document.getElementById("clienteTelefono").value = '';
    document.getElementById("clienteCorreo").value = '';
}

function mostrarAvisoPublico() {
    const aviso = document.getElementById("avisoPublico");
    if (aviso) aviso.classList.remove("hidden");
}

async function cargarTicketsPorCliente(clienteId) {
    try {
        const res = await fetch(`/facturas/tickets/cliente/${clienteId}`);
        const tickets = await res.json();

        selectTickets.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            selectTickets.innerHTML = '<option value="">El Cliente no Tiene Ventas Registradas </option>';
            selectTickets.disabled = true;
            return;
        }

        selectTickets.disabled = false;

        const optionDefault = document.createElement("option");
        optionDefault.value = '';
        optionDefault.textContent = 'Selecciona la Venta a Facturar';
        optionDefault.disabled = true;
        optionDefault.selected = true;
        selectTickets.appendChild(optionDefault);

        tickets.forEach(ticket => {
            const option = document.createElement("option");
            option.value = ticket.folio;
            option.textContent = `Venta #${ticket.folio}`;
            selectTickets.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando tickets por cliente:", error);
    }
}

async function cargarTicketsIniciales() {
    try {
        const res = await fetch('/facturas/tickets');
        const tickets = await res.json();

        if (!Array.isArray(tickets) || tickets.length === 0) {
            selectTickets.innerHTML = '<option value="">No hay ventas disponibles</option>';
            return;
        }

        selectTickets.innerHTML = '<option value="" disabled selected>Selecciona la Venta a Facturar</option>';

        tickets.forEach(ticket => {
            const option = document.createElement("option");
            option.value = ticket.folio;
            option.textContent = `Venta #${ticket.folio}`;
            selectTickets.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando tickets:", error);
    }
}

//Desactivar campos sin conexión
function actualizarEstadoConexion() {
    if (!navigator.onLine) {
        btnTextT.textContent = "Sin Conexión a Internet";

        if(btnConfirmInvoice){
            btnConfirmInvoice.disabled = true;
            btnConfirmInvoice.classList.add("opacity-50", "cursor-not-allowed");
            btnConfirmInvoice.textContent = "Sin Conexión a Internet";
        }
    } else {
        btnTextT.textContent = "Generar y Timbrar CFDI";

        if(btnConfirmInvoice){
            btnConfirmInvoice.disabled = false;
            btnConfirmInvoice.classList.remove("opacity-50", "cursor-not-allowed");
            btnConfirmInvoice.textContent = "Confirmar";
        }
    } 
    validarFormularioTimbrado();
}

window.addEventListener("offline", actualizarEstadoConexion);
window.addEventListener("online", actualizarEstadoConexion);

actualizarEstadoConexion();

//Cargar Productos
function renderConceptos() {
    const tbody = document.getElementById('tablaConceptos');
    const sinConceptos = document.getElementById('sinConceptos');
    tbody.innerHTML = '';

    if (conceptos.length === 0) {
        sinConceptos.classList.remove('hidden');
        actualizarTotales();
        return;
    }
    sinConceptos.classList.add('hidden');

    conceptos.forEach((c, i) => {
        const importe = (parseFloat(c.cantidad) || 0) * (parseFloat(c.precio) || 0);
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50';
        tr.innerHTML = `
        <td class="hidden">
            <input type="text" value="${c.id}" class="concepto-id hidden">
        </td>

        <td class="px-3 py-2">
            <input type="text" value="${c.claveSat}" placeholder="81111500" required id="clave-sat"
                class="clave-sat w-24 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                data-index="${i}" />
        </td>

        <td class="px-3 py-2 text-gray-700">
            ${c.descripcion}
        </td>

        <td class="px-3 py-2">
            <div class="flex items-center gap-1 text-gray-700">
                <span class="text-gray-500 text-xs">$</span>
                <span>
                    ${(Number(c.precio) / 1.16).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </td>

        <td class="px-3 py-2">
            <div class="flex items-center gap-1 text-gray-700">
                <span class="text-gray-500 text-xs">$</span>
                <span>
                    ${(Number(c.precio) - (Number(c.precio) / 1.16)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </td>

        <td class="px-3 py-2">
            <div class="flex items-center gap-1 text-gray-700">
                <span class="text-gray-500 text-xs">$</span>
                <span>
                    ${Number(c.precio).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
            </div>
        </td>
        
        <td class="px-3 py-2 text-center text-gray-700">
            ${c.cantidad}
        </td>

        <td class="px-3 py-2 text-center text-gray-700">
            ${c.unidad_descripcion}
        </td>

        <td class="px-3 py-2 font-semibold text-gray-800">
            $${importe.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
      `;
        tbody.appendChild(tr);
    });

    const forma_pago = document.getElementById('forma_pago');
    if (metodo_pago === 'efectivo') {
        forma_pago.value = '01';
    } else if (metodo_pago === 'transferencia') {
        forma_pago.value = '03';
    }

    tbody.querySelectorAll(".clave-sat").forEach(input => {
        input.addEventListener("input", (e) => {
            let value = e.target.value;

            value = value.replace(/\D/g, '');

            value = value.slice(0, 8);

            e.target.value = value;

            const index = parseInt(e.target.dataset.index);

            actualizarConcepto(index, "claveSat", value);
        });
    });


    actualizarTotales();
}

function actualizarConcepto(index, campo, valor) {
    conceptos[index][campo] = valor;

    actualizarTotales();
    validarFormularioTimbrado();
}

function actualizarTotales() {
    const subtotal = conceptos.reduce((acc, c) => {
        return acc + (parseFloat(c.cantidad) || 0) * ((parseFloat(c.precio) || 0) / 1.16);
    }, 0);

    const iva = conceptos.reduce((acc, c) => {
        return acc + (parseFloat(c.cantidad) || 0) * ((parseFloat(c.precio) || 0) - ((parseFloat(c.precio) || 0) / 1.16));
    }, 0);

    const total = subtotal + iva;

    const fmt = (n) => '$' + n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('resumenSubtotal').textContent = fmt(subtotal);
    document.getElementById('resumenIva').textContent = fmt(iva);
    document.getElementById('resumenDescuentos').textContent = '-$0.00';
    document.getElementById('resumenTotal').textContent = fmt(total);
}

//
function renderDatosFactura() {
    const moneda = document.getElementById("moneda");
    const tipo_comprobante = document.getElementById("tipo_comprobante");
    const metodo_pago = document.getElementById("metodo_pago");
    const uso_cfdi = document.getElementById("cfdi");

    moneda.value = datos_factura.moneda;
    tipo_comprobante.value = datos_factura.tipo_recibo;
    metodo_pago.value = datos_factura.metodo_recibo;
    uso_cfdi.value = datos_factura.uso_cfdi;

}

// Validar Datos de Timbrado
function validarFormularioTimbrado() {
    const hayConceptos = Array.isArray(conceptos) && conceptos.length > 0;

    const clavesSatValidas = conceptos.every(c =>
        /^[0-9]{8}$/.test(c.claveSat)
    );

    const clienteId = document.getElementById("clienteId")?.value;
    const rfc = document.getElementById("clienteRfc")?.value;

    const clienteValido = clienteId && clienteId !== "0" && rfc;

    const online = navigator.onLine;

    const moneda = document.getElementById("moneda")?.value;
    const tipoComprobante = document.getElementById("tipo_comprobante")?.value;
    const metodoPago = document.getElementById("metodo_pago")?.value;
    const formaPago = document.getElementById("forma_pago")?.value;
    const cfdi = document.getElementById("cfdi")?.value;

    const selectsValidos =
        moneda !== "" &&
        tipoComprobante !== "" &&
        metodoPago !== "" &&
        cfdi !== "";

    const habilitar = hayConceptos && clienteValido && online && selectsValidos && clavesSatValidas;

    const Sinhabilitar = hayConceptos && clienteValido && selectsValidos && clavesSatValidas;

    btnBorrador.disabled = !Sinhabilitar;

    if(Sinhabilitar){
        btnBorrador.classList.remove("opacity-50", "cursor-not-allowed");
    } else{
        btnBorrador.classList.add("opacity-50", "cursor-not-allowed");
    }

    btnTimbrar.disabled = !habilitar;

    if (habilitar) {
        btnTimbrar.classList.remove("opacity-50", "cursor-not-allowed");
    } else {
        btnTimbrar.classList.add("opacity-50", "cursor-not-allowed");
    }
}

//
document.addEventListener("DOMContentLoaded", async () => {

    let catalogoRegimen = {};

    // Cargar Catalogos
    try {
        const res = await fetch("/facturas/catalogos");
        const data = await res.json();

        catalogoRegimen = data.regimenFiscal;

        // Modal
        const selectClienteRegimen = document.getElementById("cliente_regimen_fiscal");
        selectClienteRegimen.innerHTML = `<option disabled selected value="">Selecciona un Régimen...</option>`;

        Object.entries(data.regimenFiscal).forEach(([clave, nombre]) => {
            const option = document.createElement("option");
            option.value = clave;
            option.textContent = nombre;
            selectClienteRegimen.appendChild(option);
        });

        //Emisor
        const selectEmisorRegimen = document.getElementById("emisor_regimen");

        const selectedValue = selectEmisorRegimen.dataset.selected;

        Object.entries(data.regimenFiscal).forEach(([clave, nombre]) => {
            const option = document.createElement("option");
            option.value = clave;
            option.textContent = ` ${nombre}`;

            if (clave === selectedValue) {
                option.selected = true;
            }

            selectEmisorRegimen.appendChild(option);
        });

        //
        const selectCFDI = document.getElementById("cfdi");
        selectCFDI.innerHTML = `<option disabled selected value="">Selecciona un Uso de CFDI...</option>`;

        Object.entries(data.usoCFDI).forEach(([clave, nombre]) => {
            const option = document.createElement("option");
            option.value = clave;
            option.textContent = nombre;
            selectCFDI.appendChild(option);
        });

        // Cliente
        const selectRegimen = document.getElementById("regimen_fiscal");
        selectRegimen.innerHTML = `<option disabled selected value="">Regimen Fiscal del Cliente</option>`;

        Object.entries(data.regimenFiscal).forEach(([clave, nombre]) => {
            const option = document.createElement("option");
            option.value = clave;
            option.textContent = nombre;
            selectRegimen.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando catálogos:", error);
    }

    // Buscar Cliente
    const buscarCliente = document.getElementById("buscarCliente");
    const resultadosClientes = document.getElementById("resultadosClientes");
    const clienteId = document.getElementById("clienteId");
    const clienteName = document.getElementById("buscarCliente");
    const clienteRfc = document.getElementById("clienteRfc");
    const clienteCodigoPostal = document.getElementById("clienteCp");
    const clienteDireccion = document.getElementById("clienteDireccion") || 'Dirección no Registrada';
    const clienteRegimen = document.getElementById("regimen_fiscal");
    const clienteTelefono = document.getElementById("clienteTelefono");
    const clienteCorreo = document.getElementById("clienteCorreo");


    btnEditarCliente.addEventListener("click", () => {
        if (!clienteSeleccionado) {
            mostrarAlerta("warning", "Selecciona un cliente primero");
            return;
        }

        editarCliente(clienteSeleccionado);
    });

    let tiempoDebounceCliente = null;

    if (buscarCliente) {
        buscarCliente.addEventListener("input", () => {
            clearTimeout(tiempoDebounceCliente);

            const termino = buscarCliente.value.trim();

            clienteSeleccionado = null;
            btnEditarCliente.classList.add("hidden");

            if (!termino) {
                resultadosClientes.classList.add("hidden");
                resultadosClientes.innerHTML = "";
                clienteSeleccionado = null;
                btnEditarCliente.classList.add("hidden");

                limpiarCliente();
                
                document.getElementById("clienteCp").value = '';
                document.getElementById("regimen_fiscal").value = '';

                validarFormularioTimbrado();

                return;
            } else if (termino === "Público en General") {
                resultadosClientes.classList.add("hidden");
                resultadosClientes.innerHTML = "";
                clienteSeleccionado = null;
                btnEditarCliente.classList.add("hidden");

                limpiarCliente();
                
                document.getElementById("clienteCp").value = '';
                document.getElementById("regimen_fiscal").value = '';

                mostrarAvisoPublico();

                validarFormularioTimbrado();

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
                            clienteSeleccionado = cliente;
                            buscarCliente.value = cliente.name;
                            clienteRfc.value = cliente.rfc;
                            clienteDireccion.value = cliente.address || 'Dirección no Registrada';
                            clienteCodigoPostal.value = cliente.postal_code;
                            clienteRegimen.value = cliente.tax_regime;
                            clienteTelefono.value = cliente.phone;
                            clienteCorreo.value = cliente.email;

                            clienteId.value = cliente.id;

                            const ticketSeleccionado = selectTickets.value;

                            if (!ticketSeleccionado) {
                                cargarTicketsPorCliente(cliente.id);
                            }
                            document.getElementById("avisoPublico")?.classList.add("hidden");

                            resultadosClientes.classList.add("hidden");
                            resultadosClientes.innerHTML = "";

                            btnEditarCliente.classList.remove('hidden');

                            validarFormularioTimbrado();
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

    const folioInicial = selectTickets.dataset.folio;

    if (folioInicial) {
        selectTickets.innerHTML = ''; 
        
        const option = document.createElement("option");
        option.value = folioInicial;
        option.textContent = `Venta #${folioInicial}`;
        option.selected = true;
        selectTickets.appendChild(option);

        selectTickets.disabled = true;

        selectTickets.dispatchEvent(new Event("change"));
        
    } else {
        await cargarTicketsIniciales();
    }

    // Modal Agregar/Editar Cliente

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

    // Validar RFC
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

        document.getElementById("progresoModal").classList.remove("hidden");

        form.reset();
        document.getElementById("clienteId").value = "";

        titulo.textContent = "Nuevo Cliente";
        btnGuardar.textContent = "Guardar";

        modal.classList.remove("hidden");
        modal.classList.add("flex");
    });

    [cerrar, cancelar].forEach((btn) => {
        btn?.addEventListener("click", cerrarModalCliente);
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) cerrarModalCliente();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.classList.contains("hidden")) {
            cerrarModalCliente();
        }
    });

    // Editar
    window.editarCliente = function (cliente) {
        modo = "editar";

        document.getElementById("progresoModal").classList.add("hidden");

        document.getElementById("clienteId").value = cliente.id;
        document.getElementById("nombre").value = cliente.name || "";
        document.getElementById("email").value = cliente.email || "";
        document.getElementById("telefono").value = cliente.phone || "";
        document.getElementById("direccion").value = cliente.address || "";
        document.getElementById("codigo_postal").value = cliente.postal_code || "";
        document.getElementById("cliente_regimen_fiscal").value = String(cliente.tax_regime || "");
        document.getElementById("rfc").value = cliente.rfc || "";

        titulo.textContent = "Editar Cliente";
        btnGuardar.textContent = "Actualizar";

        modal.classList.remove("hidden");
        modal.classList.add("flex");
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Validar correo: que termine con dominio válido
        const emailLower = document.getElementById("email").value.trim().toLowerCase();
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
            taxRegime: document.getElementById("cliente_regimen_fiscal").value,
            rfc: document.getElementById("rfc").value,
        };

        const id = document.getElementById("clienteId").value;

        if (!validarRFC(data.rfc)) {
            mostrarAlerta("warning", "RFC inválido");
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

            mostrarAlerta(
                "success",
                modo === "crear" ? "Cliente creado" : "Cliente actualizado"
            );

            if (modo === "editar") {
                clienteSeleccionado = result;

                document.getElementById("buscarCliente").value = result.name || "";
                document.getElementById("clienteRfc").value = result.rfc || "";
                document.getElementById("clienteDireccion").value = result.address || "";
                document.getElementById("clienteTelefono").value = result.phone || "";
                document.getElementById("clienteCorreo").value = result.email || "";
                document.getElementById("clienteCp").value = result.postal_code || "";
                document.getElementById("regimen_fiscal").value = result.tax_regime || "";
            }

            cerrarModalCliente();

            form.reset();
            document.getElementById("clienteId").value = "";

        } catch (err) {
            console.error(err);
            mostrarAlerta("error", "Error de conexión");
        }
    });

    // Progreso del modal
    const camposBasicos = ['nombre'];
    const camposContacto = ['email', 'telefono', 'codigo_postal'];
    const camposFiscales = ['rfc', 'cliente_regimen_fiscal'];

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


    // Confirmar Factura
    const modalConfirm = document.getElementById("modalConfirmInvoice");
    const btnCancelarInvoice = document.getElementById("btnCancelarInvoice");

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btnTimbrar");
        if (!btn) return;

        e.preventDefault();

        generarVistaConfirmacion();

        modalConfirm.classList.remove("hidden");
        modalConfirm.classList.add("flex");
    });

    btnCancelarInvoice.addEventListener("click", () => {
        modalConfirm.classList.add("hidden");
        modalConfirm.classList.remove("flex");

    });

    function generarVistaConfirmacion() {
        const dataContainer = document.getElementById("dataInvoice");

        // Emisor
        const emisorNombre = document.querySelector('[name="emisor_nombre"]').value;
        const emisorDireccion = document.querySelector('[name="emisor_direccion"]').value;
        const emisorCp = document.querySelector('[name="emisor_cp"]').value;
        const emisorTelefono = document.querySelector('[name="emisor_telefono"]').value;
        const emisorCorreo = document.querySelector('[name="emisor_correo"]').value;
        const emisorRfc = document.querySelector('[name="emisor_rfc"]').value;
        const emisorRegimenFiscal = document.querySelector('[name="emisor_regimen"]').selectedOptions[0].text;

        // Cliente
        const clienteNombre = document.getElementById("buscarCliente").value;
        const clienteDireccion = document.getElementById("clienteDireccion").value || 'Dirección no Registrada';
        const clienteTelefono = document.getElementById("clienteTelefono").value;
        const clienteCorreo = document.getElementById("clienteCorreo").value;
        const clienteCp = document.getElementById("clienteCp").value;
        const clienteRfc = document.getElementById("clienteRfc").value;
        const clienteRegimenFiscal = document.getElementById("regimen_fiscal").selectedOptions[0].text;

        // Conceptos
        let conceptosHTML = "";

        // Totales
        const subtotal = document.getElementById("resumenSubtotal").textContent;
        const iva = document.getElementById("resumenIva").textContent;
        const total = document.getElementById("resumenTotal").textContent;

        // Datos Factura
        const moneda = document.getElementById("moneda").selectedOptions[0].text;
        const tipoComprobante = document.getElementById("tipo_comprobante").selectedOptions[0].text;
        const metodoPago = document.getElementById("metodo_pago").selectedOptions[0].text;
        const formaPago = document.getElementById("forma_pago").selectedOptions[0].text;
        const usoCFDI = document.getElementById("cfdi").selectedOptions[0].text;


        if (conceptos.length === 0) {
            conceptosHTML = `<p class="text-sm text-gray-400">Sin conceptos</p>`;
        } else {
            conceptosHTML = `
            <div class="max-h-40 overflow-y-auto border-0 rounded ">
                ${conceptos.map(c => `
                    <div class="flex justify-between text-sm px-2 py-2">
                        <div class="flex gap-6">

                            <div class="flex flex-col">
                                <span class="text-xs text-gray-500">Clave SAT</span>
                                <span>${c.claveSat}</span>
                            </div>

                            <div class="flex flex-col">
                                <span class="text-xs text-gray-500">Descripción</span>
                                <span>${c.descripcion}</span>
                            </div>

                            <div class="flex flex-col">
                                <span class="text-xs text-gray-500">Cantidad</span>
                                <span>${c.cantidad}</span>
                            </div>

                            <div class="flex flex-col">
                                <span class="text-xs text-gray-500">Unidad</span>
                                <span>${c.unidad_descripcion}</span>
                            </div>
                        </div>

                        <div class="flex flex-col text-right">
                            <span class="text-xs text-gray-500">Total</span>
                            <span class="font-semibold italic">$${(c.cantidad * c.precio).toFixed(2)}</span>
                        </div>

                    </div>
                `).join("")}
            </div>
        `;
        }

        dataContainer.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Emisor -->
            <div class="bg-white border border-gray-200 rounded-lg p-5">
            <p class="text-gray-700 pb-1 uppercase font-bold">Datos del Emisor</p>

            <div class="border-b border-gray-500 pt-1"></div>

                <div class="grid grid-cols-1 gap-3 pt-1">
                    <div>
                        <span class=" text-black">Nombre: <span class="italic font-semibold text-gray-600"> ${emisorNombre} </span> </span>
                    </div>
                    <div>
                        <span class=" text-black">Direccion Fiscal: <span class="italic font-semibold text-gray-600"> ${emisorDireccion} </span> </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <span class=" text-black">Codigo Postal: <span class="italic font-semibold text-gray-600"> ${emisorCp} </span> </span>
                        </div>
                        <div>
                            <span class=" text-black">Telefono: <span class="italic font-semibold text-gray-600"> ${emisorTelefono} </span> </span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <span class=" text-black">RFC: <span class="italic font-semibold text-gray-600"> ${emisorRfc} </span> </span>
                        </div>
                        <div>
                            <span class=" text-black">Regimen Fiscal: <span class="italic font-semibold text-gray-600"> ${emisorRegimenFiscal} </span> </span>
                        </div>
                    </div>
                    
                    <div>
                        <span class=" text-black">Correo Electronico: <span class="italic font-semibold text-gray-600"> ${emisorCorreo} </span> </span>
                    </div>
                </div>
            </div>

            <!-- Cliente -->
            <div class="bg-white border border-gray-200 rounded-lg p-5">
            <p class="text-gray-700 pb-1 uppercase font-bold">Datos del Cliente</p>

            <div class="border-b border-gray-500 pt-1"></div>

                <div class="grid grid-cols-1 gap-3 pt-1">
                    <div>
                        <span class=" text-black">Nombre: <span class="font-semibold text-gray-600"> ${clienteNombre} </span> </span>
                    </div>
                    <div>
                        <span class=" text-black">Direccion Fiscal: <span class="font-semibold text-gray-600"> ${clienteDireccion || 'Dirección no Registrada'} </span> </span>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <span class=" text-black">Codigo Postal: <span class="font-semibold text-gray-600"> ${clienteCp} </span> </span>
                        </div>
                        <div>
                            <span class=" text-black">Telefono: <span class="font-semibold text-gray-600"> ${clienteTelefono} </span> </span>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <span class=" text-black">RFC: <span class="font-semibold text-gray-600"> ${clienteRfc} </span> </span>
                        </div>
                        <div>
                            <span class=" text-black">Regimen Fiscal: <span class="font-semibold text-gray-600"> ${clienteRegimenFiscal} </span> </span>
                        </div>
                    </div>
                    
                    <div>
                        <span class=" text-black">Correo Electronico: <span class="font-semibold text-gray-600"> ${clienteCorreo} </span> </span>
                    </div>
                </div>
            </div>

            <!-- CONCEPTOS -->
            <div class="bg-white border border-gray-200 rounded-lg p-5">
                <p class="text-gray-700 pb-1 uppercase font-bold">Detalle de Productos</p>
                <div class="border-b border-gray-500 pt-1"></div>
                ${conceptosHTML}
            </div>

            <!-- TOTALES -->
            <div class="bg-white border border-gray-200 rounded-lg p-5">
                <p class="text-gray-700 pb-1 uppercase font-bold">Resumen de Totales</p>
                <div class="border-b border-gray-500 pt-1"></div>
                <div class="flex justify-between pt-1">
                    <span>Subtotal</span>
                    <span class="italic font-semibold">${subtotal}</span>
                </div>
                <div class="flex justify-between">
                    <span>IVA</span>
                    <span class="italic font-semibold">${iva}</span>
                </div>
                <div class="flex justify-between font-bold text-[#FF5100]">
                    <span>Total</span>
                    <span class="italic font-semibold">${total}</span>
                </div>
            </div>

        </div>
        <!-- DATOS FACTURA -->
        <div class="bg-white border border-gray-200 rounded-lg p-5">
            <p class="text-gray-700 pb-1 uppercase font-bold">Datos de la Factura</p>
            <div class="border-b border-gray-500 pt-1"></div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
                <div>
                    <span class=" text-black">Tipo de Moneda: <span class="font-semibold text-gray-600"> ${moneda} </span> </span>
                </div>
                <div>
                    <span class=" text-black">Tipo de Comprobante: <span class="font-semibold text-gray-600"> ${tipoComprobante} </span> </span>
                </div>
                <div>
                    <span class=" text-black">Metodo de Pago: <span class="font-semibold text-gray-600"> ${metodoPago} </span> </span>
                </div>
                <div>
                    <span class=" text-black">Forma de Pago: <span class="font-semibold text-gray-600"> ${formaPago} </span> </span>
                </div>
                <div>
                    <span class=" text-black">Uso de CFDI: <span class="font-semibold text-gray-600"> ${usoCFDI} </span> </span>
                </div>
            </div>
        </div>
    `;
    }

    btnConfirmInvoice.addEventListener("click", async () => {

        const userId = document.getElementById('userId')?.textContent.trim();
        const clientId = document.getElementById("clienteId")?.value;
        const ticketFolio = document.getElementById("conceptos")?.value;

        //
        const moneda = document.getElementById("moneda")?.value;
        const tipoComprobante = document.getElementById("tipo_comprobante")?.value;
        const metodoPago = document.getElementById("metodo_pago")?.value;
        const formaPago = document.getElementById("forma_pago")?.value;
        const cfdi = document.getElementById("cfdi")?.value;

        const ids = document.getElementsByClassName("concepto-id");
        const claves = document.getElementsByClassName("clave-sat");

        const productos = [];

        for (let i = 0; i < ids.length; i++) {
            productos.push({
                id: ids[i].value,
                claveSat: claves[i].value
            });
        }

        const datosFactura = {
            userId: userId,
            clienteId: clientId,
            ticketFolio: ticketFolio,
            moneda: moneda,
            tipoComprobante: tipoComprobante,
            metodoPago: metodoPago,
            formaPago: formaPago,
            usoCfdi: cfdi,
            productos: productos
        };

        //console.log(datosFactura);

        try {
            btnConfirmInvoice.disabled = true;
            btnConfirmInvoice.innerText = "Procesando...";

            modalGenerando.classList.remove("hidden");
            modalGenerando.classList.add("flex");

            iniciarMensajesCarga();

            const respuesta = await fetch('/facturas/timbrar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(datosFactura)
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || 'Error desconocido al timbrar');

                modalGenerando.classList.remove("hidden");
                modalGenerando.classList.add("flex");
            }

            mostrarAlerta("success", 'La Factura se Generó Correctamente.');

            modalGenerando.classList.add("hidden");
            modalGenerando.classList.remove("flex");

            modalConfirm.classList.add("hidden");
            modalConfirm.classList.remove("flex");

            setTimeout(() => {
                window.location.href = '/facturas/resumen/' + resultado.data.invoice_id;
            }, 1000);

        } catch (error) {
            console.error('Error en la petición:', error);
            mostrarAlerta("error", 'Ocurrió un Error al Generar la Factura: \n' + error.message);
            modalGenerando.classList.add("hidden");
            modalGenerando.classList.remove("flex");

            modalConfirm.classList.add("hidden");
            modalConfirm.classList.remove("flex");
        } finally {
            btnConfirmInvoice.disabled = false;
            btnConfirmInvoice.innerText = "Generar y Timbrar CFDI";

            modalGenerando.classList.add("hidden");
            modalGenerando.classList.remove("flex");

        }

    });

    ["moneda", "tipo_comprobante", "metodo_pago", "forma_pago", "cfdi"]
        .forEach(id => {
            document.getElementById(id)?.addEventListener("change", validarFormularioTimbrado);
        });

    document.addEventListener("click", async (e) => {
        const btn = e.target.closest(".btnBorrador");
        if (!btn) return;

        e.preventDefault();

        const userId = document.getElementById('userId')?.textContent.trim();
        const clientId = document.getElementById("clienteId")?.value;
        const ticketFolio = document.getElementById("conceptos")?.value;

        const moneda = document.getElementById("moneda")?.value;
        const tipoComprobante = document.getElementById("tipo_comprobante")?.value;
        const metodoPago = document.getElementById("metodo_pago")?.value;
        const formaPago = document.getElementById("forma_pago")?.value;
        const cfdi = document.getElementById("cfdi")?.value;

        const ids = document.getElementsByClassName("concepto-id");
        const claves = document.getElementsByClassName("clave-sat");

        const productos = [];

        for (let i = 0; i < ids.length; i++) {
            productos.push({
                id: ids[i].value,
                claveSat: claves[i].value
            });
        }

        const datosBorrador = {
            userId: userId,
            clienteId: clientId,
            ticketFolio: ticketFolio,
            moneda: moneda,
            tipoComprobante: tipoComprobante,
            metodoPago: metodoPago,
            formaPago: formaPago,
            usoCfdi: cfdi,
            productos: productos
        };

        try {
            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Guardando...";

            const respuesta = await fetch('/facturas/borrador', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(datosBorrador)
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(resultado.error || 'Error desconocido al guardar el borrador');
            }

            mostrarAlerta("success", 'El Borrador se Guardó Correctamente.');

            setTimeout(() => {
                window.location.href = '/facturas/resumen/' + resultado.data.invoice_id;
            }, 1000);

        } catch (error) {
            console.error('Error en la petición del borrador:', error);
            mostrarAlerta("error", 'Ocurrió un Error al Guardar el Borrador: \n' + error.message);

        } finally {
            btn.disabled = false;
            btn.innerText = "Guardar Borrador";

            if (typeof modalGenerando !== 'undefined') {
                modalGenerando.classList.add("hidden");
                modalGenerando.classList.remove("flex");
            }
        }
    });
});