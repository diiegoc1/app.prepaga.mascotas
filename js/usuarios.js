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
        window.supabaseClient
            .from('empleados')
            .select('id_empleado, nombre_empleado, estado, id_rol')
            .order('id_empleado', { ascending: true }),
        window.supabaseClient
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
    const select = roleSelect.value.trim();
    
    

    const nuevoUsuario = {
        nombre_empleado: username,
        contraseña: password, 
        email: email,
        id_rol: select,
        estado: 'activo'
    };
   
    const { error } = await window.supabaseClient
        .from('empleados')
        .insert([nuevoUsuario]);

    if (error) {
        console.error('Error al crear usuario:', error);
        alert('Ocurrió un error al crear el usuario.');
        return;
    }


    createAdminForm.reset();
    


    await cargarUsuarios();
}


async function borrarUsuario(id) {

    const confirmado = confirm(`¿Estás seguro de que deseas eliminar?`);
    if (!confirmado) return;

    const { error } = await window.supabaseClient
        .from('empleados')
        .delete()
        .eq('id_empleado', id);

    if (error) {
        console.error('Error al eliminar usuario:', error);
        alert('No se pudo eliminar el usuario.');
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