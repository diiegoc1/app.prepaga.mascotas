let PLANES = [];
let BENEFICIOS = [];
let iconoPlanSeleccionado = 'paw-print';

const vistaPlanes = document.getElementById('vista-planes');
const vistaEditar = document.getElementById('vista-editar');
const vistaCrear = document.getElementById('vista-crear');

function mostrarVista(vista) {
    [vistaPlanes, vistaEditar, vistaCrear].forEach(v => v.classList.add('oculto'));
    vista.classList.remove('oculto');
}

async function cargarDatos() {
    const [{ data: planes, error: e1 }, { data: beneficios, error: e2 }] = await Promise.all([
        window.supabaseClient.from('planes').select('*'),
        window.supabaseClient.from('beneficios_plan').select('*')
    ]);
    if (e1 || e2) {
        console.error(e1 || e2);
        return;
    }
    PLANES = planes;
    BENEFICIOS = beneficios;
}

function nombresDeBeneficios() {
    return [...new Set(BENEFICIOS.map(b => b.nombre_beneficio))];
}

function tienePlanBeneficio(nombrePlan, nombreBeneficio) {
    return BENEFICIOS.some(b => b.nombre_plan === nombrePlan && b.nombre_beneficio === nombreBeneficio);
}

function renderPlanes() {
    const cont = document.getElementById('planes-grid');
    const beneficios = nombresDeBeneficios();

    cont.innerHTML = PLANES.map(plan => `
        <div class="plan-card">
            <div class="plan-card-header">
                <div class="plan-card-icono"><i data-lucide="${iconoDePlan(plan.nombre_plan)}"></i></div>
                <strong>${plan.nombre_plan}</strong>
            </div>
            <div class="plan-precio">$ ${Number(plan.costo ?? 0).toLocaleString('es-AR')}</div>
            ${beneficios.map(b => `
                <div class="beneficio-fila">
                    <span class="beneficio-nombre"><i data-lucide="${iconoDeBeneficio(b)}" class="beneficio-icono"></i>${b}</span>
                    ${tienePlanBeneficio(plan.nombre_plan, b)
                        ? '<i data-lucide="check" class="check-si"></i>'
                        : '<i data-lucide="x" class="check-no"></i>'}
                </div>
            `).join('')}
        </div>
    `).join('');

    lucide.createIcons();
}

function filaBeneficioHTML(nombreOriginal, nombreValor) {
    return `
        <tr class="fila-beneficio" data-original="${nombreOriginal}">
            <td style="display:flex; align-items:center;">
                <input class="nombre-editable input-nombre-beneficio" value="${nombreValor}" placeholder="Nombre del beneficio">
                <select class="selector-icono-inline selector-icono-beneficio">
                    ${ICONOS_DISPONIBLES.map(i => `<option value="${i}" ${iconoDeBeneficio(nombreValor) === i ? 'selected' : ''}>${etiquetaIcono(i)}</option>`).join('')}
                </select>
                <button type="button" class="btn-borrar-beneficio" title="Borrar beneficio"><i data-lucide="trash-2"></i></button>
            </td>
            ${PLANES.map(p => `
                <td>
                    <input type="checkbox" class="check-beneficio" data-plan="${p.nombre_plan}"
                        ${nombreOriginal && tienePlanBeneficio(p.nombre_plan, nombreOriginal) ? 'checked' : ''}>
                </td>
            `).join('')}
        </tr>
    `;
}

function renderEditar() {
    const beneficios = nombresDeBeneficios();
    const head = document.getElementById('tabla-editar-head');
    const body = document.getElementById('tabla-editar-body');

    head.innerHTML = '<th>Beneficios</th>' + PLANES.map(p => `
        <th>
            <div style="display:flex; align-items:center; gap:4px;">
                <input class="nombre-editable input-nombre-plan" data-original="${p.nombre_plan}" value="${p.nombre_plan}">
                <button type="button" class="btn-borrar-plan" data-plan="${p.nombre_plan}" title="Borrar plan"><i data-lucide="trash-2"></i></button>
            </div>
        </th>
    `).join('');

    body.innerHTML = beneficios.map(b => filaBeneficioHTML(b, b)).join('');
    lucide.createIcons();
}

function agregarFilaBeneficio() {
    const body = document.getElementById('tabla-editar-body');
    body.insertAdjacentHTML('beforeend', filaBeneficioHTML('', ''));
    const inputs = body.querySelectorAll('.input-nombre-beneficio');
    inputs[inputs.length - 1].focus();
    lucide.createIcons();
}

function confirmarModal(mensaje) {
    const overlay = document.getElementById('modal-confirmar-overlay');
    const texto = document.getElementById('modal-confirmar-texto');
    const btnCancelar = document.getElementById('modal-confirmar-cancelar');
    const btnAceptar = document.getElementById('modal-confirmar-aceptar');

    texto.textContent = mensaje;
    overlay.classList.remove('oculto');
    lucide.createIcons();

    return new Promise((resolve) => {
        function limpiar(resultado) {
            overlay.classList.add('oculto');
            btnCancelar.removeEventListener('click', onCancelar);
            btnAceptar.removeEventListener('click', onAceptar);
            resolve(resultado);
        }
        function onCancelar() { limpiar(false); }
        function onAceptar() { limpiar(true); }

        btnCancelar.addEventListener('click', onCancelar);
        btnAceptar.addEventListener('click', onAceptar);
    });
}

async function borrarPlan(nombrePlan) {
    const confirmado = await confirmarModal(`¿Borrar el plan "${nombrePlan}"? Esto también borra sus beneficios asociados.`);
    if (!confirmado) return;
    await window.supabaseClient.from('beneficios_plan').delete().eq('nombre_plan', nombrePlan);
    await window.supabaseClient.from('planes').delete().eq('nombre_plan', nombrePlan);
    await cargarDatos();
    renderEditar();
}

async function borrarBeneficio(nombreBeneficio) {
    const confirmado = await confirmarModal(`¿Borrar el beneficio "${nombreBeneficio}" de todos los planes?`);
    if (!confirmado) return;
    await window.supabaseClient.from('beneficios_plan').delete().eq('nombre_beneficio', nombreBeneficio);
    await cargarDatos();
    renderEditar();
}

async function guardarEdicion() {
    // 1. Renombrar planes que hayan cambiado
    for (const input of document.querySelectorAll('.input-nombre-plan')) {
        const original = input.dataset.original;
        const nuevo = input.value.trim();
        if (nuevo && nuevo !== original) {
            await window.supabaseClient.from('planes').update({ nombre_plan: nuevo }).eq('nombre_plan', original);
        }
    }

    for (const fila of document.querySelectorAll('.fila-beneficio')) {
        const original = fila.dataset.original; // '' si es un beneficio nuevo
        const nombreActual = fila.querySelector('.input-nombre-beneficio').value.trim();
        if (!nombreActual) continue; // fila nueva sin nombre cargado: se ignora

        if (original && nombreActual !== original) {
            await window.supabaseClient.from('beneficios_plan')
                .update({ nombre_beneficio: nombreActual })
                .eq('nombre_beneficio', original);
        }

        guardarIconoBeneficio(nombreActual, fila.querySelector('.selector-icono-beneficio').value);

        for (const chk of fila.querySelectorAll('.check-beneficio')) {
            const nombrePlan = chk.dataset.plan;
            const existiaAntes = original ? tienePlanBeneficio(nombrePlan, original) : false;

            if (chk.checked && !existiaAntes) {
                await window.supabaseClient.from('beneficios_plan').insert({
                    nombre_plan: nombrePlan, nombre_beneficio: nombreActual, cantidad: 1, periodo: 'mensual'
                });
            } else if (!chk.checked && existiaAntes) {
                await window.supabaseClient.from('beneficios_plan')
                    .delete().eq('nombre_plan', nombrePlan).eq('nombre_beneficio', original);
            }
        }
    }

    await cargarDatos();
    renderPlanes();
    mostrarVista(vistaPlanes);
}

function renderSelectorIconosPlan() {
    const cont = document.getElementById('selector-iconos-plan');
    cont.innerHTML = ICONOS_DISPONIBLES.map(i => `
        <button type="button" data-icono="${i}" class="${i === iconoPlanSeleccionado ? 'activo' : ''}">
            <i data-lucide="${i}"></i>
        </button>
    `).join('');
    lucide.createIcons();

    cont.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            iconoPlanSeleccionado = btn.dataset.icono;
            renderSelectorIconosPlan();
        });
    });
}

function renderListaBeneficiosCrear() {
    const cont = document.getElementById('lista-beneficios-crear');
    const beneficios = nombresDeBeneficios();
    cont.innerHTML = beneficios.map(b => `
        <div class="beneficio-check-fila">
            <span class="beneficio-nombre"><i data-lucide="${iconoDeBeneficio(b)}" class="beneficio-icono"></i>${b}</span>
            <input type="checkbox" class="check-nuevo-beneficio" data-beneficio="${b}">
        </div>
    `).join('');
    lucide.createIcons();
}

async function crearPlan() {
    const nombre = document.getElementById('input-nombre-plan').value.trim();
    const descripcion = document.getElementById('input-descripcion-plan').value.trim();
    const precioRaw = document.getElementById('input-precio-plan').value;
    const precio = parseFloat(precioRaw);

    if (!nombre) {
        alert('Poné un nombre para el plan');
        return;
    }

    if (precioRaw === '' || isNaN(precio) || precio < 0) {
        alert('Ingresá un precio válido para el plan');
        return;
    }

    const { error: errorPlan } = await window.supabaseClient.from('planes').insert({
        nombre_plan: nombre,
        costo: precio,
        descripcion
    });
    if (errorPlan) {
        console.error(errorPlan);
        alert('No se pudo crear el plan (¿ya existe ese nombre?)');
        return;
    }

    guardarIconoPlan(nombre, iconoPlanSeleccionado);

    const seleccionados = [...document.querySelectorAll('.check-nuevo-beneficio:checked')]
        .map(chk => ({ nombre_plan: nombre, nombre_beneficio: chk.dataset.beneficio, cantidad: 1, periodo: 'mensual' }));

    if (seleccionados.length > 0) {
        await window.supabaseClient.from('beneficios_plan').insert(seleccionados);
    }

    await cargarDatos();
    renderPlanes();
    mostrarVista(vistaPlanes);
}

document.getElementById('btn-editar-planes').addEventListener('click', () => {
    renderEditar();
    mostrarVista(vistaEditar);
});

document.getElementById('btn-agregar-beneficio').addEventListener('click', agregarFilaBeneficio);

document.getElementById('tabla-editar-head').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-borrar-plan');
    if (btn) borrarPlan(btn.dataset.plan);
});

document.getElementById('tabla-editar-body').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-borrar-beneficio');
    if (!btn) return;
    const fila = btn.closest('.fila-beneficio');
    const original = fila.dataset.original;
    if (!original) {
        fila.remove(); 
    } else {
        borrarBeneficio(original);
    }
});

document.getElementById('btn-cancelar-editar').addEventListener('click', () => {
    mostrarVista(vistaPlanes);
});

document.getElementById('btn-guardar-editar').addEventListener('click', guardarEdicion);

document.getElementById('btn-crear-plan').addEventListener('click', () => {
    iconoPlanSeleccionado = 'paw-print';
    document.getElementById('input-nombre-plan').value = '';
    document.getElementById('input-descripcion-plan').value = '';
    document.getElementById('input-precio-plan').value = '';
    renderSelectorIconosPlan();
    renderListaBeneficiosCrear();
    mostrarVista(vistaCrear);
});

document.getElementById('btn-volver-crear').addEventListener('click', () => {
    mostrarVista(vistaPlanes);
});

document.getElementById('btn-agregar-plan').addEventListener('click', crearPlan);

(async () => {
    await cargarDatos();
    renderPlanes();
})();

// ============================================
// LOGOUT Y SESIÓN
// ============================================
const logoutBtn = document.getElementById('logoutBtn');
function configurarLogout() {
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('supabase.auth.token');
            window.location.href = 'index.html';
        });
    }
}
configurarLogout();