import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion, getEmpleadoActual } from "./compartido/sesion.js";
import { getTemaActual, setTema } from "./compartido/tema.js";

// ============================================
// INICIALIZACIÓN
// ============================================
(async () => {
  if (!(await protegerRuta())) return;

  cargarPerfil();
  configurarTogglePassword();
  configurarFormPassword();
  configurarLogout();
  configurarToggleTema();

  if (typeof lucide !== 'undefined') lucide.createIcons();
})();

// ============================================
// CARGAR PERFIL
// ============================================
async function cargarPerfil() {
  const perfil = await getEmpleadoActual();
  if (!perfil) return;

  const nombre = perfil.nombre || 'Usuario';
  const rol = perfil.rol || '—';
  const estado = perfil.estado || '—';
  const idEmpleado = perfil.id_empleado || '—';

  // Nombre
  const elNombre = document.getElementById('perfilNombre');
  if (elNombre) elNombre.textContent = nombre;

  // Rol (con color según tipo)
  const elRol = document.getElementById('perfilRol');
  if (elRol) {
    elRol.textContent = rol;
    elRol.classList.remove('rol-admin', 'rol-vet', 'rol-recep');
    if (rol === 'Administrador') elRol.classList.add('rol-admin');
    else if (rol === 'Veterinario') elRol.classList.add('rol-vet');
    else if (rol === 'Recepcionista') elRol.classList.add('rol-recep');
  }

  // Estado
  const elEstado = document.getElementById('perfilEstado');
  if (elEstado) {
    elEstado.textContent = estado;
    elEstado.classList.remove('activo', 'inactivo');
    const estadoLower = String(estado).toLowerCase();
    if (estadoLower === 'activo') elEstado.classList.add('activo');
    else elEstado.classList.add('inactivo');
  }

  // ID Empleado
  const elId = document.getElementById('perfilId');
  if (elId) elId.textContent = `#${idEmpleado}`;

  // Avatar con iniciales
  const avatarCircle = document.getElementById('avatarCircle');
  if (avatarCircle) {
    const iniciales = generarIniciales(nombre);
    avatarCircle.textContent = iniciales;
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function generarIniciales(nombre) {
  const partes = String(nombre).trim().split(/\s+/);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

// ============================================
// TOGGLE PASSWORD (mostrar/ocultar)
// ============================================
function configurarTogglePassword() {
  document.querySelectorAll('.toggle-pass').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const esPassword = input.type === 'password';
      input.type = esPassword ? 'text' : 'password';

      // Cambiar el ícono
      const icon = btn.querySelector('svg');
      if (icon) {
        if (esPassword) {
          icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
        } else {
          icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    });
  });
}

// ============================================
// CAMBIAR CONTRASEÑA
// ============================================
function configurarFormPassword() {
  const form = document.getElementById('formCambiarPassword');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nueva = document.getElementById('nuevaPassword').value;
    const confirmar = document.getElementById('confirmarPassword').value;

    // Validaciones
    if (!nueva || !confirmar) {
      mostrarFeedback('Completá ambos campos.', 'error');
      return;
    }
    if (nueva.length < 6) {
      mostrarFeedback('La contraseña debe tener al menos 6 caracteres.', 'error');
      return;
    }
    if (nueva !== confirmar) {
      mostrarFeedback('Las contraseñas no coinciden.', 'error');
      return;
    }

    const btn = document.getElementById('btnCambiarPassword');
    const btnTexto = document.getElementById('btnCambiarTexto');
    const textoOriginal = btnTexto.textContent;

    btn.disabled = true;
    btnTexto.textContent = 'Cambiando...';

    try {
      const { error } = await supabase.auth.updateUser({ password: nueva });

      if (error) {
        console.error('Error al cambiar contraseña:', error);
        mostrarFeedback('Error: ' + traducirError(error.message), 'error');
      } else {
        mostrarFeedback('✅ Contraseña cambiada correctamente.', 'success');
        // Limpiar inputs
        document.getElementById('nuevaPassword').value = '';
        document.getElementById('confirmarPassword').value = '';

        // Ocultar mensaje después de 4s
        setTimeout(() => {
          const fb = document.getElementById('passwordFeedback');
          if (fb) fb.classList.add('hidden');
        }, 4000);
      }
    } catch (err) {
      console.error('Error inesperado:', err);
      mostrarFeedback('Error inesperado. Intentá de nuevo.', 'error');
    }

    btn.disabled = false;
    btnTexto.textContent = textoOriginal;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}

function mostrarFeedback(mensaje, tipo) {
  const fb = document.getElementById('passwordFeedback');
  if (!fb) return;
  fb.textContent = mensaje;
  fb.classList.remove('hidden', 'success', 'error');
  fb.classList.add(tipo);
}

function traducirError(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('password should be at least')) return 'La contraseña es muy corta (mínimo 6 caracteres).';
  if (m.includes('new password should be different')) return 'La nueva contraseña debe ser distinta a la actual.';
  if (m.includes('same password')) return 'La nueva contraseña no puede ser igual a la actual.';
  if (m.includes('weak')) return 'La contraseña es muy débil.';
  return msg;
}

// ============================================
// TOGGLE TEMA
// ============================================
function configurarToggleTema() {
  const toggle = document.getElementById('toggleTema');
  if (!toggle) return;

  // Estado inicial
  const temaActual = getTemaActual();
  toggle.checked = temaActual === 'dark';

  toggle.addEventListener('change', () => {
    setTema(toggle.checked ? 'dark' : 'light');
  });

  // Escuchar cambios externos (por si otra pestaña cambia el tema)
  window.addEventListener('tema-change', (e) => {
    toggle.checked = e.detail.tema === 'dark';
  });
}

// ============================================
// LOGOUT
// ============================================
function configurarLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }
}