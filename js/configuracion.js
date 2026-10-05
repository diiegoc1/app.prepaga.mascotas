// ==========================================
// CONFIGURACIÓN Y ESTADO GENERAL
// ==========================================
let usuarios = [];

// Referencias al DOM
const createAdminForm = document.getElementById('createAdminForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const isAdminCheck = document.getElementById('isAdminCheck');
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
    if (usersTableBody) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray-500); padding: 1rem;">
                    Cargando usuarios...
                </td>
            </tr>
        `;
    }

    const { data, error } = await window.supabaseClient
        .from('usuarios')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error al cargar usuarios:', error);
        if (usersTableBody) {
            usersTableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--danger-color, red); padding: 1rem;">
                        Error al cargar los usuarios.
                    </td>
                </tr>
            `;
        }
        return;
    }

    usuarios = data || [];
    renderTablaUsuarios();
}

/**
 * Renderiza dinámicamente las filas de la tabla de usuarios.
 */
function renderTablaUsuarios() {
    if (!usersTableBody) return;

    if (usuarios.length === 0) {
        usersTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--gray-500); padding: 1rem;">
                    No hay usuarios registrados.
                </td>
            </tr>
        `;
        return;
    }

    usersTableBody.innerHTML = usuarios.map(u => {
        const esActivo = u.estado === 'Activo' || u.activo === true;
        const rolTexto = u.rol || (u.es_admin ? 'Administrador' : 'Usuario');

        return `
            <tr data-id="${u.id}">
                <td>${u.id}</td>
                <td>${u.username || u.usuario}</td>
                <td>${rolTexto}</td>
                <td>
                    <span class="badge ${esActivo ? 'active' : 'inactive'}">
                        ${esActivo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td>
                    <button class="btn-delete" title="Eliminar usuario" data-id="${u.id}" data-rol="admin">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    // Reinstanciar íconos de Lucide tras la inyección HTML
    if (window.lucide) {
        lucide.createIcons();
    }
    reaplicarPermisos();
}

// ==========================================
// CREACIÓN Y ELIMINACIÓN DE USUARIOS
// ==========================================

/**
 * Crea un nuevo usuario administrador / operador.
 */
async function crearUsuario(event) {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const esAdmin = isAdminCheck ? isAdminCheck.checked : false;

    if (!username || !password) {
        alert('Por favor complete todos los campos.');
        return;
    }

    const submitBtn = createAdminForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        const nuevoUsuario = {
            username: username,
            password: password,
            rol: esAdmin ? 'Administrador' : 'Usuario',
            es_admin: esAdmin,
            estado: 'Activo'
        };

        const { error } = await window.supabaseClient
            .from('usuarios')
            .insert([nuevoUsuario]);

        if (error) {
            console.error('Error al crear usuario:', error);
            alert('Ocurrió un error al crear el usuario. ¿Quizás el nombre ya existe?');
            return;
        }

        // Limpiar campos del formulario
        createAdminForm.reset();
        if (isAdminCheck) isAdminCheck.checked = true;

        // Recargar la tabla
        await cargarUsuarios();
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

/**
 * Elimina un usuario especificando su ID.
 */
async function borrarUsuario(id) {
    const usuarioAEliminar = usuarios.find(u => String(u.id) === String(id));
    const nombre = usuarioAEliminar ? (usuarioAEliminar.username || usuarioAEliminar.usuario) : 'este usuario';

    const confirmado = confirm(`¿Estás seguro de que deseas eliminar a "${nombre}"?`);
    if (!confirmado) return;

    const { error } = await window.supabaseClient
        .from('usuarios')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error al eliminar usuario:', error);
        alert('No se pudo eliminar el usuario.');
        return;
    }

    await cargarUsuarios();
}

// ==========================================
// MODO CLARO / OSCURO & UTILIDADES
// ==========================================

/**
 * Alterna el estado de visibilidad de la contraseña en el input.
 */
function toggleMostrarPassword() {
    const icon = togglePasswordBtn.querySelector('i');
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passwordInput.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
    }
    if (window.lucide) lucide.createIcons();
}

/**
 * Maneja el switch de modo claro/oscuro con almacenamiento en localStorage.
 */
function inicializarTema() {
    const temaGuardado = localStorage.getItem('theme');
    if (temaGuardado === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeSwitch) themeSwitch.checked = true;
    }

    if (themeSwitch) {
        themeSwitch.addEventListener('change', () => {
            if (themeSwitch.checked) {
                document.body.classList.add('dark-mode');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                localStorage.setItem('theme', 'light');
            }
        });
    }
}

// ==========================================
// EVENT LISTENERS & INICIALIZACIÓN
// ==========================================

if (createAdminForm) {
    createAdminForm.addEventListener('submit', crearUsuario);
}

if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', toggleMostrarPassword);
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

// Inicializar ejecución al cargar la página
document.addEventListener('DOMContentLoaded', async () => {
    inicializarTema();
    if (!(await protegerRuta({ soloAdminRecep: true }))) return;
    await cargarUsuarios();
});