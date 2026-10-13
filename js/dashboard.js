// ==========================================
// ESTADO Y REFERENCIAS
// ==========================================
let mixedChartInstance = null;
let donutChartInstance = null;

// Elementos del DOM
const userNameDisplay = document.getElementById('userNameDisplay');
const currentDateText = document.getElementById('currentDateText');
const currentTimeText = document.getElementById('currentTimeText');
const searchClientInput = document.getElementById('searchClientInput');
const totalAfiliadosCount = document.getElementById('totalAfiliadosCount');
const totalMascotasCount = document.getElementById('totalMascotasCount');
const logoutBtn = document.getElementById('logoutBtn');

// ==========================================
// REVOLVER FECHA Y HORA EN TIEMPO REAL
// ==========================================
function obtenerNombre(){
    const cache = JSON.parse(sessionStorage.getItem("perfil") || "null");
    userNameDisplay.textContent = cache.nombre;
}


/**
 * Actualiza los elementos de fecha y hora en el topbar.
 */
function actualizarRelojYFecha() {
    const ahora = new Date();

    // Formatear Fecha (Ej: "Martes, 20 de Mayo")
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let fechaFormateada = ahora.toLocaleDateString('es-ES', opcionesFecha);
    fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);

    // Formatear Hora (Ej: "10:30 AM")
    const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };
    const horaFormateada = ahora.toLocaleTimeString('es-ES', opcionesHora).toUpperCase();

    if (currentDateText) currentDateText.textContent = fechaFormateada;
    if (currentTimeText) currentTimeText.textContent = horaFormateada;
}

// ==========================================
// MUESTRA DE DATOS Y ESTADÍSTICAS (SUPABASE)
// ==========================================

/**
 * Obtiene métricas en tiempo real desde Supabase para actualizar los contadores.
 */
async function cargarMétricas() {
    try {
        // Promesas en paralelo para clientes (afiliados) y mascotas
        const [
            { count: countClientes, error: errClientes },
            { count: countMascotas, error: errMascotas }
        ] = await Promise.all([
            window.supabaseClient.from('clientes').select('*', { count: 'exact', head: true }),
            window.supabaseClient.from('mascotas').select('*', { count: 'exact', head: true })
        ]);

        if (!errClientes && countClientes !== null && totalAfiliadosCount) {
            totalAfiliadosCount.textContent = countClientes;
        }

        if (!errMascotas && countMascotas !== null && totalMascotasCount) {
            totalMascotasCount.textContent = countMascotas;
        }
    } catch (err) {
        console.error('Error al cargar métricas del dashboard:', err);
    }
}

// ==========================================
// INICIALIZACIÓN DE GRÁFICOS (CHART.JS)
// ==========================================

/**
 * Renderiza los gráficos de métricas con Chart.js respetando los colores corporativos.
 */
function inicializarGraficos() {
    const ctxMixed = document.getElementById('mixedChart');
    const ctxDonut = document.getElementById('donutChart');

    if (ctxMixed) {
        if (mixedChartInstance) mixedChartInstance.destroy();

        mixedChartInstance = new Chart(ctxMixed, {
            type: 'bar',
            data: {
                labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                datasets: [
                    {
                        label: 'Afiliados',
                        data: [12, 19, 15, 22, 28, 35],
                        backgroundColor: '#5b3fd6',
                        borderRadius: 6
                    },
                    {
                        label: 'Mascotas',
                        data: [18, 25, 22, 30, 42, 50],
                        backgroundColor: '#f1edfd',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { grid: { color: '#e4e1ee' }, ticks: { precision: 0 } }
                }
            }
        });
    }

    if (ctxDonut) {
        if (donutChartInstance) donutChartInstance.destroy();

        donutChartInstance = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Perros', 'Gatos', 'Otros'],
                datasets: [{
                    data: [65, 30, 5],
                    backgroundColor: ['#3d2a7d', '#6c4ee3', '#e4e1ee'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 10, font: { size: 10 } }
                    }
                },
                cutout: '70%'
            }
        });
    }
}

// ==========================================
// BUSCADOR RÁPIDO & ACCIONES EN CARDS
// ==========================================

/**
 * Permite la búsqueda de un cliente por DNI al presionar Enter.
 */
function configurarBuscadorDNI() {
    if (!searchClientInput) return;

    searchClientInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const dni = searchClientInput.value.trim();
            if (dni) {
                // Redirecciona a clientes.html pasando el DNI por query param
                window.location.href = `cliente.html?dni=${encodeURIComponent(dni)}`;
            }
        }
    });
}

/**
 * Vincula las tarjetas de acción rápida con sus respectivas pantallas.
 */
function configurarTarjetasAccion() {
    const cards = document.querySelectorAll('.action-card, .hero-card');

    cards.forEach(card => {
        const titulo = card.querySelector('h4, h3')?.textContent.trim();
        card.style.cursor = 'pointer';

        card.addEventListener('click', () => {
            switch (titulo) {
                case 'Alta Afiliado':
                    window.location.href = 'cliente.html';
                    break;
                case 'Resumen de cuentas':
                    window.location.href = 'historial.html';
                    break;
                case 'Registrar Pagos':
                    window.location.href = '';
                    break;
                case 'Alta mascota':
                    window.location.href = 'mascotas.html';
                    break;
                case 'Próximos Vencimientos':
                    window.location.href = 'planes.html';
                    break;
            }
        });
    });
}

// ==========================================
// LOGOUT Y SESIÓN
// ==========================================

function configurarLogout() {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
}

// ==========================================
// INICIALIZACIÓN GENERAL
// ==========================================

(async () => {
    if (!(await protegerRuta())) return;
    actualizarRelojYFecha();
    setInterval(actualizarRelojYFecha, 1000 * 60); // Actualizar reloj cada minuto

    configurarBuscadorDNI();
    configurarTarjetasAccion();
    configurarLogout();

    await cargarMétricas();
    inicializarGraficos();

    obtenerNombre();
    if (window.lucide) {
        lucide.createIcons();
    }
})();