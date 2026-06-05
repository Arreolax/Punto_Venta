if (window.__pageScriptsInitialized) {
  console.warn('page-scripts.js ya inicializado, se omite doble registro de eventos');
} else {
  window.__pageScriptsInitialized = true;

document.addEventListener('DOMContentLoaded', () => {
  // Resalta el item de sidebar activo (solo cuando existe una sidebar real)
  document.querySelectorAll('.sidebar-link').forEach(link => {
    if (link.getAttribute('href') === window.location.pathname) {
      link.classList.add('text-orange-500', 'font-bold');
    }
  });

  // Función de userMenu para todas las vistas que usan ids #userMenuToggle / #userMenu
  const initUserMenu = () => {
    const toggle = document.getElementById('userMenuToggle');
    const userMenu = document.getElementById('userMenu');

    if (!toggle || !userMenu) return;

    // Asegurar estado inicial cerrado
    userMenu.classList.add('opacity-0', 'scale-95', '-translate-y-2', 'pointer-events-none');
    userMenu.classList.remove('opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');

    const openMenu = () => {
      userMenu.classList.remove('opacity-0', 'scale-95', '-translate-y-2', 'pointer-events-none');
      userMenu.classList.add('opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');
    };

    const closeMenu = () => {
      userMenu.classList.add('opacity-0', 'scale-95', '-translate-y-2', 'pointer-events-none');
      userMenu.classList.remove('opacity-100', 'scale-100', 'translate-y-0', 'pointer-events-auto');
    };

    toggle.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const isOpen = userMenu.classList.contains('opacity-100');
      if (isOpen) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    document.addEventListener('click', (ev) => {
      if (!toggle.contains(ev.target) && !userMenu.contains(ev.target)) {
        closeMenu();
      }
    });
  };

  initUserMenu();

  // Mensajes de advertencia globales (desde servidor, por ejemplo warning=forbidden)
  const warning = document.body.dataset.warning;
  if (warning === 'forbidden' && typeof mostrarAlerta === 'function') {
    mostrarAlerta('warning', 'Precaución. No tienes los permisos necesarios para entrar, contacta a un administrador. De seguir persistiendo se te suspenderá la cuenta por tiempo indefinido y se informará a los administradores.');
  }

  // Página: gestión de usuarios (filtros y paginado)
  const userTableRows = Array.from(document.querySelectorAll('tbody tr'));
  const summary = document.getElementById('userSummary');
  const topSummary = document.getElementById('usersTopSummary');
  const searchInput = document.getElementById('userSearch');
  const roleFilter = document.getElementById('roleFilter');
  const statusFilter = document.getElementById('statusFilter');
  const pageSizeFilter = document.getElementById('pageSizeFilter');
const paginationControls = document.getElementById('serverPaginationControls') || document.getElementById('paginationControls');
  const serverPaging = document.body.dataset.usersServerPaging === 'true';
  const clientPaging = !serverPaging;

  if (summary && searchInput && roleFilter && statusFilter && paginationControls) {
    let currentPage = 1;
    let pageSizeValue = parseInt(pageSizeFilter?.value || '10', 10);
    if (Number.isNaN(pageSizeValue) || pageSizeValue < 1) pageSizeValue = 10;

    if (serverPaging) {
      let serverSearchTimer = null;

      const applyServerFilters = () => {
        const params = new URLSearchParams(window.location.search);
        const searchValue = searchInput.value.trim();
        const roleValue = roleFilter.value.trim();
        const statusValue = statusFilter.value.trim();
        const selectedPageSize = parseInt(pageSizeFilter?.value || '10', 10) || 10;

        params.set('page', '1');
        params.set('pageSize', String(selectedPageSize));

        if (searchValue) params.set('search', searchValue);
        else params.delete('search');

        if (roleValue) params.set('role', roleValue);
        else params.delete('role');

        if (statusValue) params.set('status', statusValue);
        else params.delete('status');

        window.location.href = `/usuarios?${params.toString()}`;
      };

      searchInput.addEventListener('input', () => {
        clearTimeout(serverSearchTimer);
        serverSearchTimer = setTimeout(applyServerFilters, 300);
      });

      roleFilter.addEventListener('change', applyServerFilters);
      statusFilter.addEventListener('change', applyServerFilters);
      pageSizeFilter?.addEventListener('change', applyServerFilters);
    } else if (userTableRows.length) {

    const getCellText = (row, indx) => row.children[indx]?.textContent.trim().toLowerCase() || '';
    const getRowRole = row => getCellText(row, 3);
    const getRowStatus = row => getCellText(row, 4);

    const applyFilters = () => {
      const q = searchInput.value.trim().toLowerCase();
      const roleValue = roleFilter.value.toLowerCase();
      const statusValue = statusFilter.value.toLowerCase();

      return userTableRows.filter(row => {
        const name = getCellText(row, 1);
        const email = getCellText(row, 2);
        const role = getRowRole(row);
        const status = getRowStatus(row);

        const matchesSearch = !q || name.includes(q) || email.includes(q) || role.includes(q);
        const matchesRole = !roleValue || role === roleValue;
        const matchesStatus = !statusValue || status === statusValue;

        return matchesSearch && matchesRole && matchesStatus;
      });
    };

    const updateTable = () => {
      const filtered = applyFilters();
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSizeValue));
      if (currentPage > totalPages) currentPage = totalPages;

      if (clientPaging) {
        userTableRows.forEach(row => row.classList.add('hidden'));
        filtered.slice((currentPage - 1) * pageSizeValue, currentPage * pageSizeValue).forEach(row => row.classList.remove('hidden'));
      } else {
        userTableRows.forEach(row => {
          const match = filtered.includes(row);
          row.classList.toggle('hidden', !match);
        });
      }

      if (clientPaging) {
        const showingFrom = filtered.length ? ((currentPage - 1) * pageSizeValue) + 1 : 0;
        const showingTo = Math.min(filtered.length, currentPage * pageSizeValue);
        const summaryText = `Mostrando del ${showingFrom} al ${showingTo} de ${filtered.length} usuarios`;
        summary.textContent = summaryText;
        if (topSummary) topSummary.textContent = summaryText;

        paginationControls.innerHTML = '';
        const createButton = (text, page, disabled = false, active = false) => {
          const btn = document.createElement('button');
          btn.textContent = text;
          btn.className = `px-3 py-1 rounded border border-gray-300 ${active ? 'border-orange-400 bg-orange-100 text-orange-700' : 'text-gray-600'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'}`;
          if (disabled) {
            btn.disabled = true;
          } else {
            btn.addEventListener('click', () => {
              currentPage = page;
              updateTable();
            });
          }
          paginationControls.appendChild(btn);
        };

        createButton('Anterior', Math.max(1, currentPage - 1), currentPage === 1);
        for (let page = 1; page <= totalPages; page++) {
          createButton(page.toString(), page, false, page === currentPage);
        }
        createButton('Siguiente', Math.min(totalPages, currentPage + 1), currentPage === totalPages);
      } else {
        summary.textContent = `Mostrando ${filtered.length} de ${userTableRows.length} usuarios`; 
      }
    };

    searchInput.addEventListener('input', () => { currentPage = 1; updateTable(); });
    roleFilter.addEventListener('change', () => { currentPage = 1; updateTable(); });
    statusFilter.addEventListener('change', () => { currentPage = 1; updateTable(); });
    pageSizeFilter?.addEventListener('change', () => {
      pageSizeValue = parseInt(pageSizeFilter.value || '10', 10);
      if (Number.isNaN(pageSizeValue) || pageSizeValue < 1) pageSizeValue = 10;
      currentPage = 1;
      updateTable();
    });

    updateTable();
    }
  }

  // Página: creación de usuario
  const createUserForm = document.getElementById('createUserForm');
  const createUserCancel = document.getElementById('createUserCancel');

  if (createUserCancel) {
    createUserCancel.addEventListener('click', () => {
      window.location.href = '/usuarios';
    });
  }

  if (createUserForm) {
    let isCreatingUser = false;
    createUserForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      if (isCreatingUser) {
        return;
      }

      const firstName = document.getElementById('firstName')?.value?.trim() || null;
      const lastName = document.getElementById('lastName')?.value?.trim() || null;
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      const roleId = parseInt(document.getElementById('roleId').value, 10);
      const phoneValue = document.getElementById('phone')?.value?.trim() || '';
      const phoneDigits = phoneValue.replace(/\D/g, '');
      const phone = phoneDigits ? `+52${phoneDigits.replace(/^52/, '')}` : null;
      const createUserSubmit = document.getElementById('createUserSubmit');
      const profileImageFile = document.getElementById('profileImage')?.files?.[0] || null;
      
      // Campos de perfil (opcionales)
      const jobPosition = document.getElementById('jobPosition')?.value?.trim() || null;
      const birthDate = document.getElementById('birthDate')?.value || null;

      if (!firstName || firstName.length < 1) {
        return mostrarAlerta('warning', 'El nombre es requerido');
      }

      if (!lastName || lastName.length < 1) {
        return mostrarAlerta('warning', 'El apellido es requerido');
      }

      if (!username || username.length < 3) {
        return mostrarAlerta('warning', 'El nombre de usuario debe tener al menos 3 caracteres');
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        return mostrarAlerta('warning', 'Email inválido');
      }

      if (!roleId || isNaN(roleId)) {
        return mostrarAlerta('warning', 'Selecciona un rol válido');
      }

      if (birthDate) {
        if (birthDate < '1930-01-01') {
          return mostrarAlerta('warning', 'Tu no deberias estar vivo');
        }

        if (birthDate >= '2010-01-01') {
          return mostrarAlerta('warning', 'tu no deberias estar aqui, eres viajero del tiempo acaso?');
        }
      }

      if (!password || password.length < 8) {
        return mostrarAlerta('warning', 'La contraseña debe tener al menos 8 caracteres');
      }

      if (password !== confirmPassword) {
        return mostrarAlerta('warning', 'Las contraseñas no coinciden');
      }

      try {
        isCreatingUser = true;
        if (createUserSubmit) {
          createUserSubmit.disabled = true;
          createUserSubmit.classList.add('opacity-60', 'cursor-not-allowed');
        }

        mostrarLoader();
        const formData = new FormData();
        formData.append('name', firstName);
        formData.append('last_name', lastName);
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('roleId', String(roleId));
        if (phone) formData.append('phone', phone);
        if (jobPosition) formData.append('jobPosition', jobPosition);
        if (birthDate) formData.append('birthDate', birthDate);
        if (profileImageFile) formData.append('profileImage', profileImageFile);

        const response = await fetch('/api/admin/users', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await response.json();
        if (!response.ok) {
          ocultarLoader();
          return mostrarAlerta('error', data.message || 'Error al crear usuario');
        }

        mostrarAlerta('success', data.message || 'Usuario creado correctamente');
        setTimeout(() => window.location.href = '/usuarios', 1500);
      } catch (err) {
        console.error('Error creando usuario', err);
        ocultarLoader();
        mostrarAlerta('error', 'Error de red al crear usuario');
      } finally {
        isCreatingUser = false;
        if (createUserSubmit) {
          createUserSubmit.disabled = false;
          createUserSubmit.classList.remove('opacity-60', 'cursor-not-allowed');
        }
      }
    });
  }

  // Página: permisos de usuario (states, restricciones y toggles)
  const container = document.querySelector('[data-is-editable]') || document.body;

  const isVendor = container.dataset.isVendor === 'true';
  const targetUserId = Number(container.dataset.targetUserId || 0);
  const currentUserId = Number(container.dataset.currentUserId || 0);
  const isAdmin = container.dataset.isAdmin === 'true';
  const isSelfView = container.dataset.isSelf === 'true';
  const isEditable = container.dataset.isEditable === 'true';
  const canToggleStatus = container.dataset.canToggleStatus === 'true';
  const targetUserIsActive = container.dataset.targetUserActive === 'true';

  if (isVendor && targetUserId && targetUserId === currentUserId && typeof mostrarAlerta === 'function') {
    mostrarAlerta('warning', 'No puedes editar tus propios permisos como vendedor');
  }

  const toggleActiveBtn = document.getElementById('toggleActiveBtn');
  if (toggleActiveBtn && targetUserId) {
    if (!canToggleStatus) {
      toggleActiveBtn.disabled = true;
      toggleActiveBtn.classList.add('opacity-40', 'cursor-not-allowed');
    } else {
      toggleActiveBtn.addEventListener('click', async () => {
        const setActive = !targetUserIsActive;
        try {
          const resp = await fetch(`/api/admin/users/${targetUserId}/status`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: setActive })
          });
          const data = await resp.json();
          if (resp.ok) {
            mostrarAlerta('success', data.message || 'Estado actualizado');
            setTimeout(() => { window.location.href = '/usuarios'; }, 1000);
          } else {
            mostrarAlerta('error', data.message || 'No se pudo actualizar el estado');
          }
        } catch (error) {
          console.error('Error updating status', error);
          mostrarAlerta('error', 'Error al conectar al servidor');
        }
      });
    }
  }

  const permCheckboxes = Array.from(document.querySelectorAll('.perm-checkbox'));
  if (permCheckboxes.length > 0 && !isEditable) {
    permCheckboxes.forEach(checkbox => {
      checkbox.disabled = true;
      checkbox.addEventListener('click', (event) => {
        event.preventDefault();
        mostrarAlerta('warning', 'No puedes modificar permisos aquí. Pide apoyo a un administrador.');
      });
    });
  }



  const saveChangesBtn = document.getElementById('saveChangesBtn');
  const cancelChangesBtn = document.getElementById('cancelChangesBtn');
  if (saveChangesBtn && targetUserId) {
    saveChangesBtn.addEventListener('click', async () => {
      const permissions = {};
      permCheckboxes.forEach(checkbox => {
        const key = checkbox.dataset.perm;
        if (key) permissions[key] = checkbox.checked;
      });

      try {
        const resp = await fetch(`/api/admin/users/${targetUserId}/permissions`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permissions })
        });
        const data = await resp.json();
        if (resp.ok) {
          mostrarAlerta('success', data.message || 'Permisos actualizados');
          setTimeout(() => { window.location.reload(); }, 700);
        } else {
          mostrarAlerta('error', data.message || 'No se pudieron guardar los permisos');
        }
      } catch (err) {
        console.error('Error saving permissions', err);
        mostrarAlerta('error', 'Error de red al guardar permisos');
      }
    });
  }

  if (cancelChangesBtn) {
    cancelChangesBtn.addEventListener('click', () => {
      window.location.href = '/usuarios';
    });
  }

  // ========== PERMISOS PAGE: Cambiar foto de perfil ==========
  const changePhotoModal = document.getElementById('changePhotoModal');
  const changeProfileImageBtn = document.getElementById('changeProfileImageBtn');
  const cancelChangePhoto = document.getElementById('cancelChangePhoto');
  const changePhotoInput = document.getElementById('changePhotoInput');
  const changePhotoPreview = document.getElementById('changePhotoPreview');
  const changePhotoError = document.getElementById('changePhotoError');
  const changePhotoForm = document.getElementById('changePhotoForm');
  const submitChangePhoto = document.getElementById('submitChangePhoto');
  const profileImage = document.getElementById('profileImage');
  const closeChangePhotoModal = document.getElementById('closeChangePhotoModal');
  const closeEditUserModal = document.getElementById('closeEditUserModal');
  const hideModal = (modal) => modal?.classList.add('hidden');

  if (changePhotoModal && changeProfileImageBtn && targetUserId) {
    // Abrir modal
    changeProfileImageBtn.addEventListener('click', () => {
      changePhotoModal.classList.remove('hidden');
      changePhotoInput.value = '';
      document.getElementById('fileNameDisplay').textContent = 'Ningún archivo seleccionado';
      changePhotoPreview.src = profileImage.src || '/images/user.jpg';
      changePhotoError.style.display = 'none';
      submitChangePhoto.disabled = true;
    });

    // Cerrar modal
    cancelChangePhoto.addEventListener('click', () => {
      hideModal(changePhotoModal);
    });
    closeChangePhotoModal?.addEventListener('click', () => hideModal(changePhotoModal));

    if (closeChangePhotoModalPermisos) {
      closeChangePhotoModalPermisos.addEventListener('click', () => {
        changePhotoModal.classList.add('hidden');
      });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
    const dropZone = document.getElementById('dropZone');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    // Validar archivo
    const validateFile = (file) => {
      changePhotoError.style.display = 'none';
      changePhotoError.textContent = '';
      submitChangePhoto.disabled = true;

      if (!file) return false;

      if (!ALLOWED_TYPES.includes(file.type)) {
        changePhotoError.textContent = 'Error: Solo JPG, JPEG y PNG están permitidos';
        changePhotoError.style.display = 'block';
        return false;
      }

      if (file.size > MAX_SIZE) {
        changePhotoError.textContent = `Error: El archivo excede 5 MB (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
        changePhotoError.style.display = 'block';
        return false;
      }

      return true;
    };

    // Mostrar preview
    const showPreview = (file) => {
      const reader = new FileReader();
      reader.onload = function(event) {
        changePhotoPreview.src = event.target.result;
        submitChangePhoto.disabled = false;
      };
      reader.readAsDataURL(file);
    };

    // Click en botón "Seleccionar archivo"
    selectFileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      changePhotoInput.click();
    });

    // Click en zona de drop
    dropZone.addEventListener('click', () => {
      changePhotoInput.click();
    });

    // Cambio de archivo
    changePhotoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        fileNameDisplay.textContent = file.name;
        if (validateFile(file)) {
          showPreview(file);
        } else {
          changePhotoInput.value = '';
          fileNameDisplay.textContent = 'Ningún archivo seleccionado';
        }
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-orange-400', 'bg-orange-50');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-orange-400', 'bg-orange-50');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-orange-400', 'bg-orange-50');
      
      const file = e.dataTransfer.files[0];
      if (file) {
        fileNameDisplay.textContent = file.name;
        changePhotoInput.files = e.dataTransfer.files;
        if (validateFile(file)) {
          showPreview(file);
        } else {
          changePhotoInput.value = '';
          fileNameDisplay.textContent = 'Ningún archivo seleccionado';
        }
      }
    });

    // Enviar cambio de foto
    changePhotoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = new FormData(changePhotoForm);
      formData.append('userId', targetUserId);
      
      // Log para debugging
      console.log('FormData entries:');
      for (let [key, value] of formData.entries()) {
        console.log(`  ${key}:`, value instanceof File ? `File(${value.name})` : value);
      }
      console.log('targetUserId:', targetUserId);
      
      try {
        const response = await fetch('/api/usuarios/cambiar-foto', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
          // Actualizar imagen en la página
          profileImage.src = data.imagePath || data.data?.profile_image_path || '/images/user.jpg';
          hideModal(changePhotoModal);
          if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('success', data.message || 'Foto de perfil actualizada correctamente');
          }
        } else {
          console.error('Error response:', data);
          // Cerrar modal ANTES de mostrar el alert de error
          hideModal(changePhotoModal);
          if (typeof mostrarAlerta === 'function') {
            mostrarAlerta('error', data.message || 'Error al actualizar la foto');
          }
        }
      } catch (error) {
        console.error('Error:', error);
        if (typeof mostrarAlerta === 'function') {
          mostrarAlerta('error', 'Error al actualizar la foto');
        }
      }
    });
  }


  // ========== PERMISOS PAGE: Modal Editar Información de Usuario ==========
  const editUserBtn = document.getElementById('editUserBtn');
  const editUserModal = document.getElementById('editUserModal');
  const editUserForm = document.getElementById('editUserForm');
  const editUserCancel = document.getElementById('editUserCancel');
  const editUserSave = document.getElementById('editUserSave');
  const editUserModalClose = document.getElementById('editUserModalClose');

  if (editUserBtn && editUserModal && window.targetUserId !== null && window.targetUserId !== undefined) {
    editUserBtn.addEventListener('click', async () => {
      // Obtener datos del usuario desde el HTML
      const username = document.querySelector('h2')?.textContent.trim() || '';
      const email = document.querySelector('[data-target-user-id]').dataset.targetUserEmail || '';
      const phone = document.querySelector('[data-target-user-id]').dataset.targetUserPhone || '';
      const role_id = document.querySelector('[data-target-user-id]').dataset.targetUserRole || '2';
      
      // Llenar formulario
      document.getElementById('editUsername').value = username || '';
      document.getElementById('editEmail').value = email || '';
      
      // Formatear el phone con +52 y espacios (máximo 10 dígitos)
      let cleanPhone = phone ? phone.replace(/\D/g, '') : '';
      if (cleanPhone.startsWith('52')) {
        cleanPhone = cleanPhone.slice(2); // Remover el 52
      }
      cleanPhone = cleanPhone.slice(0, 10); // Máximo 10 dígitos
      const PHONE_PREFIX = '+52 ';
      const part1 = cleanPhone.slice(0, 3);
      const part2 = cleanPhone.slice(3, 6);
      const part3 = cleanPhone.slice(6, 8);
      const part4 = cleanPhone.slice(8, 10);
      const phoneFormatted = `${PHONE_PREFIX}${[part1, part2, part3, part4].filter(Boolean).join(' ')}`.trimEnd();
      document.getElementById('editPhone').value = phoneFormatted;
      document.getElementById('editRole').value = role_id || '2';
      
      // Mostrar modal
      editUserModal.classList.remove('hidden');
    });
  }

  // Cancelar edición
  if (editUserCancel) {
    editUserCancel.addEventListener('click', () => {
      hideModal(editUserModal);
    });
  }
  closeEditUserModal?.addEventListener('click', () => hideModal(editUserModal));

  if (editUserModalClose) {
    editUserModalClose.addEventListener('click', () => {
      editUserModal.classList.add('hidden');
    });
  }

  // Guardar cambios de información
  if (editUserSave) {
    editUserSave.addEventListener('click', async () => {
      if (!editUserForm.checkValidity()) {
        mostrarAlerta('warning', 'Por favor completa todos los campos requeridos');
        return;
      }

      const userId = window.targetUserId;
      const username = document.getElementById('editUsername').value.trim();
      const email = document.getElementById('editEmail').value.trim();
      let phone = document.getElementById('editPhone').value.trim();
      
      // Agregar +52 al phone si tiene contenido
      if (phone && !phone.startsWith('+52')) {
        phone = '+52' + phone.replace(/\D/g, '');
      }
      
      const role_id = parseInt(document.getElementById('editRole').value);

      try {
        editUserSave.disabled = true;
        editUserSave.classList.add('opacity-50', 'cursor-not-allowed');

        const response = await fetch('/api/usuarios/editar-informacion', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            username,
            email,
            phone,
            role_id
          })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          mostrarAlerta('success', 'Información actualizada correctamente');
          hideModal(editUserModal);
          setTimeout(() => window.location.reload(), 1500);
        } else {
          mostrarAlerta('error', data.message || 'No se pudo actualizar');
        }
      } catch (error) {
        console.error('Error:', error);
        mostrarAlerta('error', 'Error de conexión');
      } finally {
        editUserSave.disabled = false;
        editUserSave.classList.remove('opacity-50', 'cursor-not-allowed');
      }
    });
  }

  // Cerrar modal de foto al hacer click fuera
  if (changePhotoModal) {
    changePhotoModal.addEventListener('click', (e) => {
      if (e.target === changePhotoModal) {
        hideModal(changePhotoModal);
      }
    });
  }

  // Cerrar modal al hacer click fuera
  if (editUserModal) {
    editUserModal.addEventListener('click', (e) => {
      if (e.target === editUserModal) {
        hideModal(editUserModal);
      }
    });
  }

  // Cerrar modales con ESC
  if (editUserModal || changePhotoModal) {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (editUserModal && !editUserModal.classList.contains('hidden')) hideModal(editUserModal);
      if (changePhotoModal && !changePhotoModal.classList.contains('hidden')) hideModal(changePhotoModal);
    });
  }

  // Reset password page (cambiar password)
  const resetForm = document.getElementById('resetForm');
  if (resetForm && document.getElementById('newPassword')) {
    const errorDiv = document.getElementById('errorMessage');
    const successDiv = document.getElementById('successMessage');
    const errorText = document.getElementById('errorText');
    const successText = document.getElementById('successText');

    function getTokenFromURL() {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    }

    function calculatePasswordStrength(password) {
      let strength = 0;
      const strengthDiv = document.getElementById('passwordStrength');
      const strengthText = document.getElementById('strengthText');

      if (!strengthDiv || !strengthText) return strength;

      if (password.length >= 8) strength++;
      if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
      if (password.match(/[0-9]/)) strength++;
      if (password.match(/[^a-zA-Z0-9]/)) strength++;

      const colored = strengthDiv.querySelectorAll('div');
      colored.forEach((div, index) => {
        if (index < strength) {
          if (strength === 1) div.style.backgroundColor = '#ff5100';
          else if (strength === 2) div.style.backgroundColor = '#ffa500';
          else if (strength === 3) div.style.backgroundColor = '#90ee90';
          else if (strength === 4) div.style.backgroundColor = '#28a745';
        } else {
          div.style.backgroundColor = '#e0e0e0';
        }
      });

      const texts = ['Muy débil', 'Débil', 'Media', 'Fuerte', 'Muy fuerte'];
      strengthText.textContent = texts[strength] || 'Mínimo 8 caracteres';
      return strength;
    }

    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const passwordStrengthBar = document.getElementById('passwordStrength');

    if (newPasswordInput && passwordStrengthBar) {
      newPasswordInput.addEventListener('input', () => {
        calculatePasswordStrength(newPasswordInput.value);
      });
    }

    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = getTokenFromURL();
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (!token) {
        errorDiv.classList.remove('hidden');
        errorText.textContent = 'No se encontró el token de seguridad.';
        return;
      }
      if (newPassword.length < 8) {
        errorDiv.classList.remove('hidden');
        errorText.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        return;
      }
      if (newPassword !== confirmPassword) {
        errorDiv.classList.remove('hidden');
        errorText.textContent = 'Las contraseñas no coinciden.';
        return;
      }

      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password: newPassword })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Error al restablecer contraseña.');

        if (errorDiv) errorDiv.classList.add('hidden');
        successDiv.classList.remove('hidden');
        successText.textContent = data.message || 'Contraseña restablecida con éxito.';
      } catch (err) {
        if (successDiv) successDiv.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        errorText.textContent = err.message || 'Error de servidor.';
      }
    });
  }

  // Recuperar contraseña via email form
  const emailRecoveryForm = document.getElementById('resetForm');
  const emailRecoverInput = document.getElementById('emailRecover');
  const messageParagraph = document.getElementById('mensaje');

  if (emailRecoveryForm && emailRecoverInput) {
    // Auto-llenar email desde localStorage (guardado del login anterior)
    const savedEmail = localStorage.getItem('lastEmail');
    if (savedEmail) {
      emailRecoverInput.value = savedEmail;
      emailRecoverInput.select();
    }

    // Manejar submit del formulario
    emailRecoveryForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = emailRecoverInput.value.trim();
      
      if (!email) {
        showMessage('Por favor ingresa tu email', 'error');
        return;
      }
      
      if (!email.includes('@')) {
        showMessage('Email inválido', 'error');
        return;
      }

      showMessage('Enviando solicitud...', 'info');
      
      try {
        const response = await fetch('/api/auth/request-password-reset', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email: email })
        });
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.message || 'Error al solicitar restablecimiento');

        if (data.warning) {
          showMessage(data.message || 'Para cambiar tu contraseña, contacta a un administrador.', 'error');
          return;
        }

        showMessage(data.message || 'Se ha enviado un email con instrucciones de recuperación', 'success');

        setTimeout(() => {
          window.location.href = '/';
        }, 3000);
      } catch (error) {
        console.error('❌ Error en recuperación:', error);
        showMessage(`Error: ${error.message}`, 'error');
      }
    });

    // Función auxiliar para mostrar mensajes
    function showMessage(text, type) {
      messageParagraph.textContent = text;
      messageParagraph.classList.remove('hidden', 'bg-red-100', 'text-red-600', 'bg-yellow-100', 'text-yellow-600', 'bg-green-100', 'text-green-600', 'bg-blue-100', 'text-blue-600');
      
      if (type === 'error') {
        messageParagraph.classList.add('bg-red-100', 'text-red-600');
      } else if (type === 'warning') {
        messageParagraph.classList.add('bg-yellow-100', 'text-yellow-600');
      } else if (type === 'success') {
        messageParagraph.classList.add('bg-green-100', 'text-green-600');
      } else {
        messageParagraph.classList.add('bg-blue-100', 'text-blue-600');
      }
    }

    // Permitir Enter para submit
    emailRecoverInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        emailRecoveryForm.dispatchEvent(new Event('submit'));
      }
    });
  }});

  // ============================================
  // GLOBAL EVENT DELEGATION (FUERA de DOMContentLoaded)
  // Estos listeners se ejecutan cada vez que se carga el script
  // ============================================

  // Exportar usuarios a CSV
  document.addEventListener('click', (e) => {
    const exportBtn = e.target.closest('#exportUsersBtn');
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Descargando...';
      
      fetch('/api/users/export')
        .then(response => {
          if (!response.ok) throw new Error('Error en la exportación');
          return response.blob();
        })
        .then(blob => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'usuarios_' + new Date().toLocaleString('es-MX').replace(/[:\\/]/g, '-') + '.csv';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i class="fa-solid fa-download"></i> Exportar CSV';
        })
        .catch(error => {
          console.error('Error:', error);
          exportBtn.disabled = false;
          exportBtn.innerHTML = '<i class="fa-solid fa-download"></i> Exportar Usuarios';
          mostrarAlerta('error', 'Error al descargar el archivo');
        });
    }
  });

  // Admin: acciones de usuario (reset password) - GLOBAL
  document.addEventListener('click', (e) => {
    const resetPasswordBtn = e.target.closest('.resetPasswordBtn');
    if (resetPasswordBtn) {
      const userId = resetPasswordBtn.dataset.userId;
      const username = resetPasswordBtn.dataset.username || 'usuario';
      if (!userId) return;

      const performReset = async (newPassword) => {
        try {
          const resp = await fetch(`/api/admin/users/${userId}/reset-password`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword })
          });
          const data = await resp.json();
          if (resp.ok) {
            mostrarAlerta('success', data.message || 'Contraseña actualizada correctamente');
            setTimeout(() => location.reload(), 500);
          } else {
            mostrarAlerta('error', data.message || 'No se pudo actualizar la contraseña');
          }
        } catch (err) {
          console.error('Error reset password', err);
          mostrarAlerta('error', 'Error de red al resetear contraseña');
        }
      };

      if (typeof mostrarModalPassword === 'function') {
        mostrarModalPassword(username, (newPassword) => {
          if (newPassword) performReset(newPassword);
        });
      } else {
        const newPassword = prompt(`Nueva contraseña para ${username}`);
        if (newPassword) performReset(newPassword);
      }
    }
  });

  // Admin: eliminar usuario - GLOBAL
  document.addEventListener('click', (e) => {
    const deleteUserBtn = e.target.closest('.deleteUserBtn');
    if (deleteUserBtn) {
      const userId = deleteUserBtn.dataset.userId;
      const username = deleteUserBtn.dataset.username || 'usuario';
      if (!userId) return;

      const proceed = async () => {
        try {
          const resp = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          const data = await resp.json();
          if (resp.ok) {
            mostrarAlerta('success', data.message || 'Usuario eliminado correctamente');
            setTimeout(() => window.location.reload(), 900);
          } else {
            mostrarAlerta('error', data.message || 'No se pudo eliminar el usuario');
          }
        } catch (err) {
          console.error('Error deleting user', err);
          mostrarAlerta('error', 'Error de red al eliminar usuario');
        }
      };

      if (typeof mostrarConfirmacion === 'function') {
        mostrarConfirmacion(
          'Eliminar usuario',
          `¿Deseas eliminar el usuario "${username}"? Esta acción no se puede deshacer.`,
          proceed
        );
      } else if (confirm(`¿Eliminar usuario "${username}"?`)) {
        proceed();
      }
    }
  });
}

