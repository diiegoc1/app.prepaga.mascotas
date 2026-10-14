import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion, reaplicarPermisos } from "./compartido/sesion.js";

// ==========================================
// CONFIGURACIÓN Y ESTADO GENERAL
// ==========================================
let usuarios = [];

// Referencias al DOM
const createAdminForm = document.getElementById('createAdminForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const emailInput = document.getElementById('emailInput');
const selectInput = document.getElementById('roleSelect');

const togglePasswordBtn = document.getElementById('togglePasswordBtn');

const usersTableBody = document.getElementById('usersTableBody');
const themeSwitch = document.getElementById('themeSwitch');
const logoutBtn = document.getElementById('logoutBtn');

// ==========================================
// CARGA Y RENDERIZADO DE USUARIOS
// ==========================================

/**
 * Obtiene la lista de usuarios desde la base de datos en Supabase.
 */
async function cargarUsuarios() {
    const [{ data: empleados, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase
            .from('empleados')
            .select('id_empleado, nombre_empleado, estado, id_rol')
            .order('id_empleado', { ascending: true }),
        supabase
            .from('roles')
            .select('id_rol, nombre_rol')
    ]);

    if (e1 || e2) {
        console.error('Error al cargar usuarios:', e1 || e2);
        return;
    }

    const rolesMap = Object.fromEntries((roles || []).map(r => [r.id_rol, r.nombre_rol]));
    usuarios = (empleados || []).map(e => ({
        ...e,
        nombre_rol: rolesMap[e.id_rol] ?? `Rol ${e.id_rol}`
    }));
    renderTablaUsuarios();
}


function renderTablaUsuarios() {
    if (!usersTableBody) return;

    if (usuarios.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray-500);">
                    No hay usuarios registrados.
                </td>
            </tr>
        `;
        return;
    }

    usersTableBody.innerHTML = usuarios.map(u => {
        const esActivo = u.estado === 'Activo' || u.estado == 'activo';

        return `
            <tr data-id="${u.id_empleado}">
                <td>${u.id_empleado}</td>
                <td>${u.nombre_empleado}</td>
                <td>${u.nombre_rol}</td>
                <td>
                    <span class="badge ${esActivo ? 'active' : 'inactive'}">
                        ${u.estado}
                    </span>
                </td>
                <td>
                    <button class="btn-delete" title="Eliminar usuario" data-id="${u.id_empleado}" data-rol="Administrador">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

 
    if (window.lucide) {
        lucide.createIcons();
    }
    reaplicarPermisos();
}


async function crearUsuario(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const email = emailInput.value.trim();
    const idRol = Number(roleSelect.value);

    if (!username) {
        alert('Ingresá el nombre del empleado.');
        usernameInput.focus();
        return;
    }
    if (!email || !email.includes('@')) {
        alert('Ingresá un email válido.');
        emailInput.focus();
        return;
    }
    if (!password || password.length < 6) {
        alert('La clave debe tener 6 o más caracteres.');
        passwordInput.focus();
        return;
    }
    if (!Number.isInteger(idRol) || idRol <= 0) {
        alert('Seleccioná un rol válido.');
        return;
    }

    const btn = createAdminForm.querySelector('button[type="submit"]');
    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Creando...';
    }

    // Alta vía Edge Function: crea el usuario Auth + la fila en empleados.
    // Ya no se escribe `contraseña` (login 100% Auth).
    const { data, error } = await supabase.functions.invoke(
        'gestionar-empleado',
        {
            body: {
                action: 'crear',
                nombre_empleado: username,
                email,
                password,
                id_rol: idRol,
            },
        }
    );

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
    }

    const mensajeError = await mensajeErrorFuncion(data, error);
    if (mensajeError) {
        console.error('Error al crear usuario:', error || data);
        alert(mensajeError);
        return;
    }

    createAdminForm.reset();
    await cargarUsuarios();
}

// Extrae el mensaje legible que devuelve la Edge Function
// (viene en el JSON del body tanto en 200 como en 4xx/5xx).
async function mensajeErrorFuncion(data, error) {
    if (data && data.error) return data.error;
    if (!error) return null;
    try {
        const cuerpo = await error.context?.json?.();
        if (cuerpo && cuerpo.error) return cuerpo.error;
    } catch {}
    return 'No se pudo completar la operación.';
}


async function borrarUsuario(id) {
    const usuarioAEliminar = usuarios.find(
        (u) => String(u.id_empleado) === String(id)
    );
    const nombre = usuarioAEliminar
        ? usuarioAEliminar.nombre_empleado
        : 'este usuario';
    const confirmado = confirm(
        `¿Estás seguro de que deseas eliminar a "${nombre}"? Se eliminará su acceso y su ficha.`
    );
    if (!confirmado) return;

    // Baja total vía Edge Function: borra el usuario Auth + la fila en empleados.
    const { data, error } = await supabase.functions.invoke(
        'gestionar-empleado',
        { body: { action: 'eliminar', id_empleado: Number(id) } }
    );

    const mensajeError = await mensajeErrorFuncion(data, error);
    if (mensajeError) {
        console.error('Error al eliminar usuario:', error || data);
        alert(mensajeError);
        return;
    }

    await cargarUsuarios();
}


if (createAdminForm) {
    createAdminForm.addEventListener('submit', crearUsuario);
}

if (usersTableBody) {
    usersTableBody.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.btn-delete');
        
        if (btnDelete) {
            const id = btnDelete.dataset.id;
            borrarUsuario(id);
        }
    });
}

function configurarLogout() {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
}
configurarLogout();


(async () => {
    
    if (!(await protegerRuta({ soloAdminRecep: true }))) return;
    await cargarUsuarios();
})();