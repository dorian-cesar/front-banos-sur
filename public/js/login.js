document.addEventListener('DOMContentLoaded', () => {
  const api_url = 'https://backend-banios.dev-wit.com/api';
  //const api_url = 'http://localhost:3000/api';

  // Cargar SweetAlert desde CDN
  const sweetAlertScript = document.createElement('script');
  sweetAlertScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
  document.head.appendChild(sweetAlertScript);

  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');

  // Manejo del formulario de login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      try {
        const response = await fetch(`${api_url}/auth/loginUser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const result = await response.json();

        if (response.ok) {
          sessionStorage.setItem('authToken', result.token);
          sessionStorage.setItem('usuario', JSON.stringify(result.user));
          window.location.href = 'home.html';
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: result.error || 'Error al iniciar sesión'
          });
        }

      } catch (err) {
        console.error('Error al iniciar sesión:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error en el servidor'
        });
      }
    });
  }

  // Manejo del botón de logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function (e) {
      e.preventDefault();
      cerrarSesion();
    });
  }

  // Enlace "Olvidé mi contraseña"
  const olvidoContrasena = document.getElementById('olvidoContrasena');
  if (olvidoContrasena) {
    olvidoContrasena.addEventListener('click', function(e) {
      e.preventDefault();
      const modal = document.getElementById('modalRecuperar');
      if (modal) {
        modal.style.display = 'flex';
        modal.style.zIndex = '1000';
        const tecladoContainer = document.getElementById('tecladoContainer');
        if (tecladoContainer && tecladoContainer.style.display !== 'none') {
          tecladoContainer.style.zIndex = '1001';
        }
      }
    });
  }

  // Formulario de recuperación de contraseña
  const formRecuperar = document.getElementById('formRecuperar');
  if (formRecuperar) {
    formRecuperar.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = document.getElementById('emailRecuperar').value;

      try {
        const response = await fetch(`${api_url}/auth/forgot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const result = await response.json();

        if (response.ok) {
          Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: result.message || 'Se ha enviado un correo para restablecer tu contraseña'
          });
          const modal = document.getElementById('modalRecuperar');
          if (modal) modal.style.display = 'none';
          formRecuperar.reset();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: result.error || 'Error al procesar la solicitud'
          });
        }
      } catch (err) {
        console.error('Error al recuperar contraseña:', err);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error en el servidor'
        });
      }
    });
  }

  // Cerrar modal al hacer clic en la X
  const closeModal = document.querySelector('.close');
  if (closeModal) {
    closeModal.addEventListener('click', function() {
      const modal = document.getElementById('modalRecuperar');
      if (modal) modal.style.display = 'none';
    });
  }

  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', function(event) {
    const modal = document.getElementById('modalRecuperar');
    const tecladoContainer = document.getElementById('tecladoContainer');
    if (event.target === modal && modal && 
        (!tecladoContainer || !tecladoContainer.contains(event.target))) {
      modal.style.display = 'none';
    }
  });
});

// Función para cerrar sesión
function cerrarSesion() {
  try {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Ocurrió un problema al cerrar sesión.'
    });
  }
}