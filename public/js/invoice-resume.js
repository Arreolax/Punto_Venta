document.addEventListener("DOMContentLoaded", () => {
    cargarCatalogos();
    configurarBotonesDescarga();

    const btnTimbrar = document.getElementById("btnTimbrar");
    const btnTextT = document.getElementById("btnTextT");

    const btnCancelar = document.getElementById("btnCancelar");
    const btnTextC = document.getElementById("btnTextC");

    const btnEditar = document.getElementById("btnEditar");

    const selectsFiltros = document.querySelectorAll(".auto-submit");
    if (selectsFiltros.length > 0) {
        selectsFiltros.forEach(select => {
            select.addEventListener("change", function () {
                this.form.submit();
            });
        });
    }

    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput) {
        let temporizador;

        searchInput.addEventListener("input", function () {
            clearTimeout(temporizador);

            temporizador = setTimeout(() => {
                this.form.submit();
            }, 500);
        });

        if (searchInput.value) {
            searchInput.focus();
            const valorActual = searchInput.value;
            searchInput.value = '';
            searchInput.value = valorActual;
        }
    }

    // Desactivar botones sin conexion
    function actualizarEstadoConexion() {
        if (btnTextT) {
            if (!navigator.onLine) {
                btnTextT.textContent = "Sin Conexión a Internet";
            } else {
                btnTextT.textContent = "Timbrar";
            }
            validarInformacionTimbrado();

        }

        if (btnTextC) {
            if (!navigator.onLine) {
                btnTextC.textContent = "Sin Conexión a Internet";
                btnCancelar.classList.add("opacity-50", "cursor-not-allowed");
                btnCancelar.disabled = true;
            } else {
                btnTextC.textContent = "Cancelar";
                btnCancelar.classList.remove("opacity-50", "cursor-not-allowed");
                btnCancelar.disabled = false;
            }
        }
    }

    window.addEventListener("offline", actualizarEstadoConexion);
    window.addEventListener("online", actualizarEstadoConexion);

    actualizarEstadoConexion();

    // Validar Datos de Timbrado
    function validarInformacionTimbrado() {
        const claves = document.querySelectorAll(".clave-sat");
        const online = navigator.onLine;

        let existeClaveSinRegistrar = false;

        claves.forEach(clave => {
            const texto = clave.textContent.trim();

            if (texto === "Clave sin Registrar" || texto === "") {
                existeClaveSinRegistrar = true;
            }
        });

        if (existeClaveSinRegistrar) {
            mostrarAlerta("warning", "Hay Productos que no Tienen una Clave SAT Registrada. \n- Por favor, Edite la Información de la Factura.");
            btnEditar.classList.add("bg-[#FF5100]");
            btnEditar.classList.remove("text-gray-700");
            btnEditar.classList.add("text-white");
            btnEditar.classList.remove("hover:bg-gray-50");
            btnEditar.classList.add("hover:bg-[#d94400]");
        }

        const habilitar = online && !existeClaveSinRegistrar;

        if (habilitar) {
            btnTimbrar.classList.remove("opacity-50", "cursor-not-allowed");
        } else {
            btnTimbrar.classList.remove("bg-[#FF5100]", "text-white", "hover:bg-[#d94400]");
            btnTimbrar.classList.add("opacity-50", "cursor-not-allowed", "text-gray-700", "border", "border-red-600");
        }

        btnTimbrar.disabled = !habilitar;
    }

    // Eliminar 
    const modalDelete = document.getElementById("modalConfirmDelete");
    const btnCancelarDelete = document.getElementById("btnCancelarDelete");
    const btnConfirmDelete = document.getElementById("btnConfirmDelete");

    if (!modalDelete || !btnCancelarDelete || !btnConfirmDelete) return;

    let borradorAEliminar = null;

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btnEliminar");

        if (!btn) return;

        borradorAEliminar = btn.dataset.idFactura;

        modalDelete.classList.remove("hidden");
        modalDelete.classList.add("flex");
    });

    // Cancelar
    btnCancelarDelete.addEventListener("click", () => {

        modalDelete.classList.add("hidden");
        modalDelete.classList.remove("flex");

        borradorAEliminar = null;
    });

    // Confirmar eliminación
    btnConfirmDelete.addEventListener("click", async () => {
        if (!borradorAEliminar) return;

        try {
            btnConfirmDelete.disabled = true;
            btnConfirmDelete.textContent = "Eliminando...";

            const res = await fetch(`/facturas/${borradorAEliminar}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const result = await res.json();

            if (!res.ok) {
                mostrarAlerta("error", result.message || "Error al eliminar borrador");
                return;
            }

            mostrarAlerta("success", result.message || "Borrador Eliminado");

            modalDelete.classList.add("hidden");
            modalDelete.classList.remove("flex");

            setTimeout(() => {
                window.location.href = "/facturas";
            }, 1000);

        } catch (error) {
            console.error(error);
            mostrarAlerta("error", "Error de conexión con el servidor");
        } finally {
            btnConfirmDelete.disabled = false;
            btnConfirmDelete.textContent = "Eliminar";
        }
    });

    // Confirmar Factura
    const modalConfirm = document.getElementById("modalConfirmTimbrado");
    const btnCancelarTimbrado = document.getElementById("btnCancelarTimbrado");
    const btnConfirmTimbrado = document.getElementById("btnConfirmTimbrado");

    const modalConfirmCancel = document.getElementById("modalConfirmCancel");
    const btnCancelarCancel = document.getElementById("btnCancelarCancel");
    const btnConfirmCancel = document.getElementById("btnConfirmCancel");

    if (!modalConfirm || !btnCancelarTimbrado || !btnConfirmTimbrado) return;

    if (!modalConfirmCancel || !btnCancelarCancel || !btnConfirmCancel) return;

    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".btnTimbrar");
        if (!btn) return;

        e.preventDefault();

        modalConfirm.classList.remove("hidden");
        modalConfirm.classList.add("flex");
    });

    btnCancelarTimbrado.addEventListener("click", () => {
        modalConfirm.classList.add("hidden");
        modalConfirm.classList.remove("flex");

    });

    btnConfirmTimbrado.addEventListener("click", async () => {

        const userId = document.getElementById('userId')?.textContent.trim();
        const clientId = document.getElementById("clienteId")?.textContent.trim();
        const ticketFolio = document.getElementById("ticketFolio")?.textContent.trim();

        //
        const moneda = document.getElementById("moneda")?.textContent.trim();
        const tipoComprobante = document.getElementById("tipo_comprobante")?.textContent.trim();
        const metodoPago = document.getElementById("metodo_pago")?.textContent.trim();
        const formaPago = document.getElementById("forma_pago")?.textContent.trim();
        const cfdi = document.getElementById("RCFDI")?.textContent.trim();

        const ids = document.querySelectorAll(".concepto-id");
        const claves = document.querySelectorAll(".clave-sat");

        const productos = Array.from(ids).map((idEl, i) => ({
            id: idEl.textContent.trim(),
            claveSat: claves[i].textContent.trim()
        }));

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

        console.log('Datos Factura:', datosFactura);

        try {
            btnConfirmTimbrado.disabled = true;
            btnConfirmTimbrado.innerText = "Procesando...";

            modalConfirm.classList.add("hidden");
            modalConfirm.classList.remove("flex");

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
            btnConfirmTimbrado.disabled = false;
            btnConfirmTimbrado.innerText = "Generar y Timbrar CFDI";

            modalGenerando.classList.add("hidden");
            modalGenerando.classList.remove("flex");

        }

    });

    document.addEventListener("click", async (e) => {
        const btnCancelar = e.target.closest(".btnCancelar");
        if (!btnCancelar) return;

        e.preventDefault();

        modalConfirmCancel.classList.remove("hidden");
        modalConfirmCancel.classList.add("flex");
    });

    btnCancelarCancel.addEventListener("click", () => {
        modalConfirmCancel.classList.add("hidden");
        modalConfirmCancel.classList.remove("flex");

    });

    btnConfirmCancel.addEventListener("click", async () => {

        const idFactura = btnCancelar.dataset.idFactura;

        const contenidoOriginal = btnCancelar.innerHTML;

        try {
            btnConfirmCancel.disabled = true;
            btnConfirmCancel.classList.add("opacity-50", "cursor-not-allowed");
            btnConfirmCancel.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> Cancelando...';

            const res = await fetch(`/facturas/cancelar/${idFactura}`, {
                method: "DELETE",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    motivo: "02"
                })
            });

            const result = await res.json();

            if (!res.ok) {
                mostrarAlerta("error", result.message || "Error al cancelar la factura en el SAT");
                restaurarBoton(btnCancelar, contenidoOriginal);
                return;
            }

            modalConfirmCancel.classList.add("hidden");

            mostrarAlerta("success", result.message || "Factura Cancelada");

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error("Error al cancelar factura:", error);
            mostrarAlerta("error", "Error de red al conectar con el servidor");
            restaurarBoton(btnCancelar, contenidoOriginal);
        }

    });

    // Función auxiliar para el botón de cancelar
    function restaurarBoton(boton, contenido) {
        boton.disabled = false;
        boton.classList.remove("opacity-50", "cursor-not-allowed");
        boton.innerHTML = contenido;
    }
});

async function cargarCatalogos() {
    try {
        const CFDI = document.getElementById("cfdi");
        const RCFDI = document.getElementById("RCFDI");
        const Regimen = document.getElementById("regimen");
        const RRegimen = document.getElementById("RRegimen");

        if (!RCFDI || !CFDI || !Regimen || !RRegimen) return;

        const res = await fetch("/facturas/catalogos");
        const data = await res.json();

        const claveCFDI = RCFDI.textContent.trim();
        if (data.usoCFDI[claveCFDI]) {
            CFDI.textContent = data.usoCFDI[claveCFDI];
        } else {
            CFDI.textContent = "Uso CFDI no Encontrado";
        }

        const claveRegimen = RRegimen.textContent.trim();
        if (data.regimenFiscal[claveRegimen]) {
            Regimen.textContent = data.regimenFiscal[claveRegimen];
        } else {
            Regimen.textContent = "Régimen Fiscal no Encontrado";
        }

    } catch (error) {
        console.error("Error cargando catálogos:", error);
    }
}

function configurarBotonesDescarga() {
    const botonesDescarga = document.querySelectorAll('.btn-descargar');

    if (botonesDescarga.length === 0) return;

    botonesDescarga.forEach(boton => {
        boton.addEventListener('click', async (evento) => {
            const botonPresionado = evento.currentTarget;
            const idFactura = botonPresionado.getAttribute('data-id');
            const formato = botonPresionado.getAttribute('data-formato');
            const uuid = botonPresionado.getAttribute('data-uuid');

            const iconoOriginal = botonPresionado.innerHTML;
            botonPresionado.disabled = true;
            botonPresionado.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-sm"></i>`;

            await descargarArchivo(idFactura, uuid, formato);

            botonPresionado.innerHTML = iconoOriginal;
            botonPresionado.disabled = false;
        });
    });
}

async function descargarArchivo(idFactura, uuid, formato) {
    try {
        const url = `/facturas/descargar?id_factura=${idFactura}&formato=${formato}`;

        const response = await fetch(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const errorMensaje = await response.text();
            throw new Error(errorMensaje || 'Error desconocido al descargar el archivo');
        }

        const blob = await response.blob();
        const urlTemporal = window.URL.createObjectURL(blob);

        const enlace = document.createElement('a');
        enlace.style.display = 'none';
        enlace.href = urlTemporal;

        let nombreArchivo = `Factura_${uuid}.${formato}`;

        enlace.download = nombreArchivo;

        document.body.appendChild(enlace);

        if (formato === 'pdf') {
            window.open(urlTemporal, '_blank');
        } else {
            enlace.click();
        }

        document.body.removeChild(enlace);
        setTimeout(() => window.URL.revokeObjectURL(urlTemporal), 100);

    } catch (error) {
        console.error('Fallo la descarga:', error);
        alert(`No se pudo descargar: ${error.message}`);
    }
}

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