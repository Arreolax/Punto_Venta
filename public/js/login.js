const loginForm = document.getElementById('loginForm');
const errorDiv = document.getElementById('errorMessage');
const togglePasswordButton = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const togglePasswordIcon = document.getElementById('togglePasswordIcon');

const btnLogin = document.getElementById("btnLogin");

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.querySelector("form");

    if (!formulario || !btnLogin) return;

    formulario.addEventListener("submit", () => {

        btnLogin.disabled = true;
        btnLogin.classList.add("opacity-70", "cursor-not-allowed");

        btnLogin.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-spinner fa-spin"></i>
                <span>Iniciando...</span>
            </div>
        `;
    });
});

if (togglePasswordButton && passwordInput && togglePasswordIcon) {
  togglePasswordButton.addEventListener('click', () => {
    const isHidden = passwordInput.type === 'password';
    passwordInput.type = isHidden ? 'text' : 'password';
    togglePasswordIcon.classList.toggle('fa-eye');
    togglePasswordIcon.classList.toggle('fa-eye-slash');
  });

  // Caps Lock indicator
  const loginCapsWarning = document.getElementById('loginCapsWarning');
  if (loginCapsWarning) {
    passwordInput.addEventListener('keydown', (e) => {
      const isCapsLock = e.getModifierState?.('CapsLock'); 
      
      if (isCapsLock) {
        loginCapsWarning.classList.remove('hidden');
      } else {
        loginCapsWarning.classList.add('hidden');
      }
    });

    passwordInput.addEventListener('keyup', (e) => {
      const isCapsLock = e.getModifierState?.('CapsLock');
      
      if (isCapsLock) {
        loginCapsWarning.classList.remove('hidden');
      } else {
        loginCapsWarning.classList.add('hidden');
      }
    });
  }
}

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      if (errorDiv) {
        errorDiv.textContent = 'Por favor completa todos los campos';
        errorDiv.classList.remove('hidden');

        btnLogin.disabled = false;
        btnLogin.classList.remove("opacity-70", "cursor-not-allowed");

      }
      return;
    }

    // Guardar email para recuperación posterior
    localStorage.setItem('lastEmail', email);

    try {
      if (errorDiv) errorDiv.classList.add('hidden');

      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        if (errorDiv) {
          errorDiv.textContent = data.message || 'Error en el inicio de sesión';
          errorDiv.classList.remove('hidden');

          mostrarAlerta('warning', data.message || 'Error en el inicio de sesión');

          btnLogin.innerHTML = `  
            <div class="flex items-center gap-2">
                <span>INICIO DE SESIÓN</span>
            </div>
        `;

          btnLogin.disabled = false;
          btnLogin.classList.remove("opacity-70", "cursor-not-allowed");
        }
        return;
      }
      
      // TRIGGER: Cargar automáticamente datos de perfil (incluyendo campos personalizados)
      try {
        const profileResponse = await fetch(`/api/auth/profile`, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.data?.user) {
            // Guardar datos de perfil completos en localStorage
            localStorage.setItem('userProfile', JSON.stringify(profileData.data.user));
            
            btnLogin.disabled = false;
            btnLogin.classList.remove("opacity-70", "cursor-not-allowed");
          }
        }
      } catch (profileError) {
        console.warn('⚠️ No se pudieron cargar datos de perfil:', profileError);
        btnLogin.disabled = false;
        btnLogin.classList.remove("opacity-70", "cursor-not-allowed");
      }

      btnLogin.disabled = false;
      btnLogin.classList.remove("opacity-70", "cursor-not-allowed");

      btnLogin.innerHTML = `  
            <div class="flex items-center gap-2">
                <span>INICIO DE SESIÓN</span>
            </div>
        `;
      
      mostrarAlerta('success', 'Inicio de Sesión Exitoso');

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 300);
      
    } catch (error) {
      console.error('❌ Error:', error);
      mostrarAlerta('warning', error);
      if (errorDiv) {
        errorDiv.textContent = 'Error de conexión. Intenta de nuevo.';
        errorDiv.classList.remove('hidden');

        mostrarAlerta('warning', 'Error de conexión. Intenta de nuevo.');

        btnLogin.innerHTML = `  
            <div class="flex items-center gap-2">
                <span>INICIO DE SESIÓN</span>
            </div>
        `;

        btnLogin.disabled = false;
        btnLogin.classList.remove("opacity-70", "cursor-not-allowed");
      }
    }
  });
}