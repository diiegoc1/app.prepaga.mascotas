const ICONOS_BENEFICIO_DEFAULT = {
    'Consulta general': 'stethoscope',
    'Vacunación': 'syringe',
    'Desparasitación': 'shield',
    'Control anual': 'calendar-check',
    'Análisis de laboratorio': 'flask-conical',
    'Cirugías': 'scissors',
    'Emergencias 24hs': 'siren',
    'Descuento en productos': 'percent',
    'Baño y peluquería': 'bath',
    'Alimentos premium': 'utensils',
    'Accesorios': 'package'
};

const ICONOS_PLAN_DEFAULT = {
    'Cachorro': 'dog',
    'Joven': 'cat',
    'Adulto': 'shield'
};

const ICONOS_DISPONIBLES = ['paw-print', 'dog', 'cat', 'heart', 'shield', 'stethoscope', 'syringe', 'bath'];

const ICONOS_LABELS = {
    'paw-print': 'Huella',
    'dog': 'Perro',
    'cat': 'Gato',
    'heart': 'Corazón',
    'shield': 'Escudo',
    'stethoscope': 'Estetoscopio',
    'syringe': 'Jeringa',
    'bath': 'Baño'
};

function etiquetaIcono(icono) {
    return ICONOS_LABELS[icono] || icono;
}

function _obtenerGuardados(clave) {
    try {
        return JSON.parse(localStorage.getItem(clave)) || {};
    } catch {
        return {};
    }
}

function guardarIconoBeneficio(nombre, icono) {
    const g = _obtenerGuardados('iconos_beneficios');
    g[nombre] = icono;
    localStorage.setItem('iconos_beneficios', JSON.stringify(g));
}

function iconoDeBeneficio(nombre) {
    const g = _obtenerGuardados('iconos_beneficios');
    return g[nombre] || ICONOS_BENEFICIO_DEFAULT[nombre] || 'circle';
}

// El ícono del plan viene de la columna `icono` de la tabla `planes` en Supabase
function iconoDePlan(plan) {
    return (plan && plan.icono) || ICONOS_PLAN_DEFAULT[plan && plan.nombre_plan] || 'paw-print';
}
