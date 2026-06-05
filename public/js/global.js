// Guard contra doble carga de global.js
if (window.__globalJsLoaded) {
  console.warn('[global.js] Ya fue cargado, se omite');
} else {
  window.__globalJsLoaded = true;

  // Ilegalisimo el enter
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
    }
  });

  //
  const modalDevs = document.getElementById("modalDevs");
  const btnAbrirModalDevs = document.getElementById("btnDevs");
  const btnCerrarModalDevs = document.getElementById("btnCerrarModalDevs");

  if(btnAbrirModalDevs){
    btnAbrirModalDevs.addEventListener("click", () => {
      modalDevs.classList.remove("hidden");
    });
  }

  if(btnCerrarModalDevs){
    btnCerrarModalDevs.addEventListener("click", () => {
      modalDevs.classList.add("hidden");
    });
  }

  // Pantalla Carga
  const loader = document.getElementById("loader");
  const contenido = document.getElementById("contenido");

  function ocultarLoader() {
    if (loader) loader.classList.add("hidden");
    if (contenido) contenido.classList.remove("hidden");
  }

  function mostrarLoader() {
    if (loader) loader.classList.remove("hidden");
    if (contenido) contenido.classList.add("hidden");
  }

  // Opciones Click Perfil Header
  function toggleUserMenu() {
    const menu = document.getElementById("userMenu");
    if (!menu) return;

    menu.classList.toggle("opacity-0");
    menu.classList.toggle("scale-95");
    menu.classList.toggle("-translate-y-2");
    menu.classList.toggle("pointer-events-none");
  }

  // cerrar si hace click fuera
  document.addEventListener("click", function (event) {
    const menu = document.getElementById("userMenu");
    if (!menu) return;

    const user = event.target.closest(".relative");

    if (!user) {
      menu.classList.add("opacity-0", "scale-95", "-translate-y-2", "pointer-events-none");
    }
  });

  // Dia Y Fecha Actual MX
  function actualizarHora() {
    const now = new Date();

    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const anio = now.getFullYear();

    const fechas = document.querySelectorAll('.fecha');
    const horas = document.querySelectorAll('.hora');

    fechas.forEach(el => {
      el.textContent = `${dia}/${mes}/${anio}`;
    });

    horas.forEach(el => {
      el.textContent = now.toLocaleTimeString('es-MX');
    });
  }

  setInterval(actualizarHora, 1000);
  actualizarHora();

  // Modal Alerta
  const alertModal = document.getElementById("alertModal");
  const alertBackdrop = document.getElementById("alertBackdrop");
  const alertTitle = document.getElementById("alertTitle");
  const alertMessage = document.getElementById("alertMessage");
  const alertIcon = document.getElementById("alertIcon");
  const alertClose = document.getElementById("alertClose");

  function mostrarAlerta(tipo, mensaje) {

    if (!alertModal) return;

    alertMessage.textContent = mensaje;

    if (tipo === "error") {
      alertTitle.textContent = "Error";
      alertIcon.innerHTML = "❌";
      alertTitle.className = "text-lg font-bold text-red-600";
    }

    if (tipo === "success") {
      alertTitle.textContent = "Éxito";
      alertIcon.innerHTML = "✅";
      alertTitle.className = "text-lg font-bold text-green-600";
    }

    if (tipo === "warning") {
      alertTitle.textContent = "Advertencia";
      alertIcon.innerHTML = "⚠️";
      alertTitle.className = "text-lg font-bold text-yellow-600";
    }

    alertModal.classList.remove("hidden");
    alertModal.classList.add("flex");
    alertBackdrop.classList.remove("hidden");
  }

  function cerrarAlerta() {
    alertModal.classList.add("hidden");
    alertModal.classList.remove("flex");
    alertBackdrop.classList.add("hidden");
  }

  if (alertClose) {
    alertClose.addEventListener("click", cerrarAlerta);
    alertBackdrop.addEventListener("click", cerrarAlerta);
  }

  // Modal de cambio de contraseña
  const passwordModal = document.getElementById('passwordModal');
  const passwordModalInput = document.getElementById('passwordModalInput');
  const passwordModalError = document.getElementById('passwordModalError');
  const passwordModalConfirm = document.getElementById('passwordModalConfirm');
  const passwordModalCancel = document.getElementById('passwordModalCancel');
  const passwordModalClose = document.getElementById('passwordModalClose');

  // Modal editar perfil
  const profileModal = document.getElementById('profileModal');
  const profileModalError = document.getElementById('profileModalError');
  const profileModalUsername = document.getElementById('profileUsername');
  const profileModalEmail = document.getElementById('profileEmail');
  const profileModalPhone = document.getElementById('profilePhone');
  const profileModalSave = document.getElementById('profileModalSave');
  const profileModalCancel = document.getElementById('profileModalCancel');
  const profileModalClose = document.getElementById('profileModalClose');

  let passwordModalCallback = null;
  let profileModalCallback = null;

  function mostrarModalPassword(username, callback) {
    if (!passwordModal) return;

    passwordModalCallback = callback;
    passwordModalError.classList.add('hidden');
    passwordModalInput.value = '';
    passwordModal.querySelector('#passwordModalTitle').textContent = `Cambiar contraseña de ${username}`;
    passwordModal.classList.remove('hidden');
    passwordModal.classList.add('flex');
    passwordModalInput.focus();
  }

  function cerrarModalPassword() {
    if (!passwordModal) return;

    passwordModal.classList.add('hidden');
    passwordModal.classList.remove('flex');
    passwordModalError.classList.add('hidden');
    passwordModalInput.value = '';
    passwordModalCallback = null;
  }

  function mostrarModalPerfil(currentData, callback) {
    if (!profileModal) return;

    profileModalCallback = callback;
    profileModalError.classList.add('hidden');
    profileModalUsername.value = currentData.username || '';
    profileModalEmail.value = currentData.email || '';

    // Normalizar teléfono con +52 fijo
    const PHONE_PREFIX = '+52 ';
    const formatMxPhone = (digits) => {
      const cleaned = digits.slice(0, 10);
      const part1 = cleaned.slice(0, 3);
      const part2 = cleaned.slice(3, 6);
      const part3 = cleaned.slice(6, 8);
      const part4 = cleaned.slice(8, 10);
      return [part1, part2, part3, part4].filter(Boolean).join(' ');
    };

    const onlyDigits = (currentData.phone || '').replace(/\D/g, '');
    const nationalDigits = onlyDigits.startsWith('52') ? onlyDigits.slice(2) : onlyDigits;
    profileModalPhone.value = nationalDigits ? `${PHONE_PREFIX}${formatMxPhone(nationalDigits)}` : PHONE_PREFIX;

    profileModal.classList.remove('hidden');
    profileModal.classList.add('flex');
    profileModalUsername.focus();
  }

  if (profileModalPhone) {
    const PHONE_PREFIX = '+52 ';
    const formatMxPhone = (digits) => {
      const cleaned = digits.slice(0, 10);
      const part1 = cleaned.slice(0, 3);
      const part2 = cleaned.slice(3, 6);
      const part3 = cleaned.slice(6, 8);
      const part4 = cleaned.slice(8, 10);
      return [part1, part2, part3, part4].filter(Boolean).join(' ');
    };

    const enforcePhoneFormat = () => {
      let value = profileModalPhone.value;

      // Si no contiene el prefijo, añádelo
      if (!value.startsWith(PHONE_PREFIX)) {
        value = PHONE_PREFIX;
      }

      // Extrae solo dígitos
      const onlyDigits = value.replace(/\D/g, '');

      // Si los dígitos empiezan con 52, quita ese prefijo
      const nationalDigits = onlyDigits.startsWith('52') ? onlyDigits.slice(2) : onlyDigits;

      // Formatea los dígitos nacionales
      const formatted = nationalDigits ? `${PHONE_PREFIX}${formatMxPhone(nationalDigits)}` : PHONE_PREFIX;

      profileModalPhone.value = formatted;
    };

    profileModalPhone.addEventListener('input', enforcePhoneFormat);

    profileModalPhone.addEventListener('keydown', (e) => {
      // Prevenir borrar el +52
      if (profileModalPhone.value.length === PHONE_PREFIX.length &&
        (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
      }
    });

    profileModalPhone.addEventListener('focus', () => {
      if (!profileModalPhone.value || profileModalPhone.value.length === 0) {
        profileModalPhone.value = PHONE_PREFIX;
      }
    });
  }

  function cerrarModalPerfil() {
    if (!profileModal) return;

    profileModal.classList.add('hidden');
    profileModal.classList.remove('flex');
    profileModalError.classList.add('hidden');
    profileModalCallback = null;
  }

  if (profileModalCancel) {
    profileModalCancel.addEventListener('click', cerrarModalPerfil);
  }
  if (profileModalClose) {
    profileModalClose.addEventListener('click', cerrarModalPerfil);
  }

  if (profileModalClose) {
    profileModalClose.addEventListener('click', cerrarModalPerfil);
  }

  if (profileModalSave) {
    profileModalSave.addEventListener('click', async () => {
      const inputUsername = profileModalUsername.value.trim();
      const inputEmail = profileModalEmail.value.trim();
      const inputPhone = profileModalPhone.value.replace(/\D/g, '');

      if (!inputUsername || inputUsername.length < 3) {
        profileModalError.textContent = 'El usuario debe tener al menos 3 caracteres';
        profileModalError.classList.remove('hidden');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!inputEmail || !emailRegex.test(inputEmail)) {
        profileModalError.textContent = 'Email inválido';
        profileModalError.classList.remove('hidden');
        return;
      }

      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            username: inputUsername,
            email: inputEmail,
            phone: inputPhone
          })
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Error al actualizar perfil');
        }

        if (profileModalCallback) {
          profileModalCallback({ username: inputUsername, email: inputEmail, phone: inputPhone });
        }

        cerrarModalPerfil();
        mostrarAlerta('success', 'Perfil actualizado correctamente');
      } catch (err) {
        profileModalError.textContent = err.message || 'No se pudo actualizar el perfil';
        profileModalError.classList.remove('hidden');
        console.error('profile update error', err);
      }
    });
  }

  if (passwordModalCancel) {
    passwordModalCancel.addEventListener('click', cerrarModalPassword);
  }
  if (passwordModalClose) {
    passwordModalClose.addEventListener('click', cerrarModalPassword);
  }

  if (passwordModalClose) {
    passwordModalClose.addEventListener('click', cerrarModalPassword);
  }

  if (passwordModalConfirm) {
    // Función para validar requisitos de contraseña
    function validatePasswordRequirements(password) {
      const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /\d/.test(password)
      };

      return {
        ...requirements,
        allMet: Object.values(requirements).every(v => v === true)
      };
    }

    // Función para actualizar visuaización de requisitos
    function updatePasswordRequirementsUI(password) {
      const reqs = validatePasswordRequirements(password);

      // Actualizar iconos de requisitos
      const elements = {
        'pwdReqLength': reqs.length,
        'pwdReqUppercase': reqs.uppercase,
        'pwdReqLowercase': reqs.lowercase,
        'pwdReqNumber': reqs.number
      };

      for (const [id, met] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) {
          if (met) {
            el.classList.remove('text-gray-300');
            el.classList.add('text-green-500');
          } else {
            el.classList.remove('text-green-500');
            el.classList.add('text-gray-300');
          }
        }
      }

      // Actualizar seguridad
      updatePasswordStrength(password);

      // Habilitar/deshabilitar botón
      const btn = document.getElementById('passwordModalConfirm');
      if (btn) {
        btn.disabled = !reqs.allMet;
      }
    }

    // Función para actualizar barra de seguridad
    function updatePasswordStrength(password) {
      const bars = document.querySelectorAll('#passwordModalStrength .h-1');
      const text = document.getElementById('passwordModalStrengthText');
      let strength = 0;

      if (password.length >= 8) strength++;
      if (password.length >= 12) strength++;
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
      if (/\d/.test(password)) strength++;

      bars.forEach((bar, i) => {
        if (i < strength) {
          bar.classList.remove('bg-gray-300');
          if (strength <= 2) bar.classList.add('bg-red-500');
          else if (strength === 3) bar.classList.add('bg-yellow-500');
          else bar.classList.add('bg-green-500');
        } else {
          bar.classList.add('bg-gray-300');
          bar.classList.remove('bg-red-500', 'bg-yellow-500', 'bg-green-500');
        }
      });

      const labels = ['Muy débil', 'Débil', 'Media', 'Fuerte'];
      if (text) {
        text.textContent = strength > 0 ? labels[strength - 1] : 'Escribe la contraseña para ver su seguridad';
      }
    }

    // Event listener para input
    passwordModalInput.addEventListener('input', (e) => {
      updatePasswordRequirementsUI(e.target.value);
    });

    // Validación al confirmar
    passwordModalConfirm.addEventListener('click', () => {
      const newPassword = passwordModalInput.value.trim();
      const reqs = validatePasswordRequirements(newPassword);

      if (!newPassword) {
        passwordModalError.textContent = 'Debe ingresar una contraseña';
        passwordModalError.classList.remove('hidden');
        return;
      }

      if (!reqs.allMet) {
        passwordModalError.textContent = 'La contraseña no cumple con todos los requisitos';
        passwordModalError.classList.remove('hidden');
        return;
      }

      if (passwordModalCallback) {
        passwordModalCallback(newPassword);
      }
      cerrarModalPassword();
    });

    // Toggle show/hide password
    const passwordModalToggle = document.getElementById('passwordModalToggle');
    const passwordModalToggleIcon = document.getElementById('passwordModalToggleIcon');
    const passwordModalCapsWarning = document.getElementById('passwordModalCapsWarning');

    if (passwordModalToggle) {
      passwordModalToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const type = passwordModalInput.type === 'password' ? 'text' : 'password';
        passwordModalInput.type = type;
        passwordModalToggleIcon.classList.toggle('fa-eye');
        passwordModalToggleIcon.classList.toggle('fa-eye-slash');
      });
    }

    // Caps Lock indicator
    if (passwordModalInput) {
      passwordModalInput.addEventListener('keydown', (e) => {
        const isCapsLock = e.getModifierState('CapsLock');
        if (isCapsLock) {
          passwordModalCapsWarning.classList.remove('hidden');
        } else {
          passwordModalCapsWarning.classList.add('hidden');
        }
      });

      passwordModalInput.addEventListener('keyup', (e) => {
        const isCapsLock = e.getModifierState('CapsLock');
        if (isCapsLock) {
          passwordModalCapsWarning.classList.remove('hidden');
        } else {
          passwordModalCapsWarning.classList.add('hidden');
        }
      });
    }
  }

  // Modal de confirmación global
  const confirmModal = document.getElementById('confirmModal');
  const confirmModalTitle = document.getElementById('confirmModalTitle');
  const confirmModalMessage = document.getElementById('confirmModalMessage');
  const confirmModalCancel = document.getElementById('confirmModalCancel');
  const confirmModalAccept = document.getElementById('confirmModalAccept');
  const confirmModalClose = document.getElementById('confirmModalClose');

  let confirmModalCallback = null;

  function mostrarConfirmacion(title, message, callback) {
    if (!confirmModal) return;

    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModalCallback = callback;

    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
  }

  function cerrarConfirmacion() {
    if (!confirmModal) return;

    confirmModal.classList.add('hidden');
    confirmModal.classList.remove('flex');
    confirmModalCallback = null;
  }

  if (confirmModalCancel) {
    confirmModalCancel.addEventListener('click', cerrarConfirmacion);
  }
  if (confirmModalClose) {
    confirmModalClose.addEventListener('click', cerrarConfirmacion);
  }

  if (confirmModalClose) {
    confirmModalClose.addEventListener('click', cerrarConfirmacion);
  }

  if (confirmModalAccept) {
    confirmModalAccept.addEventListener('click', () => {
      if (confirmModalCallback) {
        confirmModalCallback();
      }
      cerrarConfirmacion();
    });
  }

  if (passwordModal) {
    passwordModal.addEventListener('click', (event) => {
      if (event.target === passwordModal) cerrarModalPassword();
    });
  }

  if (profileModal) {
    profileModal.addEventListener('click', (event) => {
      if (event.target === profileModal) cerrarModalPerfil();
    });
  }

  if (confirmModal) {
    confirmModal.addEventListener('click', (event) => {
      if (event.target === confirmModal) cerrarConfirmacion();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (passwordModal && !passwordModal.classList.contains('hidden')) cerrarModalPassword();
    if (profileModal && !profileModal.classList.contains('hidden')) cerrarModalPerfil();
    if (confirmModal && !confirmModal.classList.contains('hidden')) cerrarConfirmacion();
  });

  // Logout funcional (usa modal de alerta para resultado)
  const logoutButtons = document.querySelectorAll('.logoutBtn');
  logoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.json();

        if (response.ok) {
          mostrarAlerta('success', data.message || 'Sesión cerrada correctamente');
          setTimeout(() => {
            window.location.href = '/';
          }, 900);
        } else {
          mostrarAlerta('error', data.message || 'Error al cerrar sesión');
        }
      } catch (error) {
        mostrarAlerta('error', 'Error de red al cerrar sesión');
        console.error('Logout error', error);
      }
    });
  });

  function initSidebarSearch() {
    const sidebarSearch = document.getElementById('sidebarSearch');
    const suggestionsContainer = document.getElementById('sidebarSuggestions');
    if (!sidebarSearch || !suggestionsContainer) return;

    const routeMap = {
      inicio: '/perfil',
      movimiento: '/movimiento',
      ventas: '/ventas',
      dashboard: '/dashboard',
      permisos: '/permisos',
      usuarios: '/usuarios',
      inventario: '/inventario',
      facturación: '/facturacion',
      facturacion: '/facturacion',
      tickets: '/tickets'
    };

    const options = Object.keys(routeMap);

    const normalized = (value) => value.trim().toLowerCase();

    const showSuggestions = (items) => {
      if (!items || items.length === 0) {
        suggestionsContainer.classList.add('hidden');
        suggestionsContainer.innerHTML = '';
        return;
      }

      suggestionsContainer.classList.remove('hidden');
      suggestionsContainer.innerHTML = items
        .map(item => `<div class="px-2 py-1 cursor-pointer hover:bg-orange-100" data-value="${item}">${item}</div>`)
        .join('');

      suggestionsContainer.querySelectorAll('div').forEach(item => {
        item.addEventListener('click', () => {
          sidebarSearch.value = item.dataset.value;
          suggestionsContainer.classList.add('hidden');
          window.location.href = routeMap[item.dataset.value];
        });
      });
    };

    const navigateToOption = () => {
      const value = normalized(sidebarSearch.value);
      if (!value) return;

      if (routeMap[value]) {
        window.location.href = routeMap[value];
        return;
      }

      const bestKey = options.find(opt => opt.startsWith(value));
      if (bestKey) {
        window.location.href = routeMap[bestKey];
        return;
      }

      mostrarAlerta('warning', 'Opción no encontrada en el menú');
    };

    sidebarSearch.addEventListener('input', () => {
      const query = normalized(sidebarSearch.value);
      if (!query) {
        showSuggestions([]);
        return;
      }

      const suggestions = options.filter(opt => opt.includes(query)).slice(0, 5);
      showSuggestions(suggestions);
    });

    sidebarSearch.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        showSuggestions([]);
        navigateToOption();
      }
    });

    document.addEventListener('click', (event) => {
      if (!sidebarSearch.contains(event.target) && !suggestionsContainer.contains(event.target)) {
        suggestionsContainer.classList.add('hidden');
      }
    });
  }

  function initProfileEditor() {
    const editProfileButton = document.getElementById('editProfileButton');
    if (!editProfileButton) return;

    editProfileButton.addEventListener('click', () => {
      const currentData = {
        username: document.getElementById('profileUsernameDisplay')?.textContent.trim() || '',
        email: document.getElementById('profileEmailDisplay')?.textContent.trim() || '',
        phone: document.getElementById('profilePhoneDisplay')?.textContent.trim() || ''
      };

      mostrarModalPerfil(currentData, (updated) => {
        if (document.getElementById('profileUsernameDisplay')) {
          document.getElementById('profileUsernameDisplay').textContent = updated.username;
        }
        if (document.getElementById('profileEmailDisplay')) {
          document.getElementById('profileEmailDisplay').textContent = updated.email;
        }
        if (document.getElementById('profilePhoneDisplay')) {
          document.getElementById('profilePhoneDisplay').textContent = updated.phone || 'No registrado';
        }
      });
    });
  }

  if (window.jspdf && typeof window.jspdf.jsPDF === 'function') {
    window.jsPDF = window.jspdf.jsPDF;
  }

  function initUserMenuToggle() {
    const toggle = document.getElementById('userMenuToggle');
    if (!toggle) return;

    toggle.addEventListener('click', toggleUserMenu);
    toggle.addEventListener('keypress', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        toggleUserMenu();
      }
    });
  }

  initSidebarSearch();
  initUserMenuToggle();
  initProfileEditor();

  window.addEventListener('DOMContentLoaded', () => {
    ocultarLoader();

    const Wifi = document.getElementById("wifiIcon");
    const WifiOff = document.getElementById("noWifiIcon");

    function actualizarEstado() {
      if (!Wifi || !WifiOff) return;

      if (navigator.onLine) {
        Wifi.classList.remove("hidden");
        WifiOff.classList.add("hidden");
      } else {
        Wifi.classList.add("hidden");
        WifiOff.classList.remove("hidden");
      }
    }

    actualizarEstado();

    window.addEventListener("offline", () => {
      alert("❌ Sin Conexión a Internet");
      actualizarEstado();
    });

    window.addEventListener("online", () => {
      alert("✅ Conexión Restablecida");
      actualizarEstado();
    });

    //Boton Ir Arriba
    const btnTop = document.getElementById("btnTop");
    const scrollContainer = document.getElementById("scrollContainer");

    if (!btnTop || !scrollContainer) return;

    if (btnTop && scrollContainer) {
      scrollContainer.addEventListener("scroll", () => {
        if (scrollContainer.scrollTop > 500) {
          btnTop.classList.remove(
            "opacity-0",
            "translate-y-5",
            "scale-90",
            "pointer-events-none"
          );
        } else {
          btnTop.classList.add(
            "opacity-0",
            "translate-y-5",
            "scale-90",
            "pointer-events-none"
          );
        }
      });

      btnTop.addEventListener("click", () => {
        scrollContainer.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      });
    }

  });

  window.mostrarAlerta = mostrarAlerta;

} // Cierre del guard __globalJsLoaded
