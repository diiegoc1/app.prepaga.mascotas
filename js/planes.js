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

function formatearCosto(costo) {
    return '$' + Number(costo || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
                <div class="plan-card-icono"><i data-lucide="${iconoDePlan(plan)}"></i></div>
                <div>
                    <strong>${plan.nombre_plan}</strong>
                    <div class="plan-card-costo">${formatearCosto(plan.costo)}</div>
                </div>
            </div>
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
            <td>
                <div class="celda-beneficio">
                    <input class="nombre-editable input-nombre-beneficio" value="${nombreValor}" placeholder="Nombre del beneficio">
                    <select class="selector-icono-inline selector-icono-beneficio">
                        ${ICONOS_DISPONIBLES.map(i => `<option value="${i}" ${iconoDeBeneficio(nombreValor) === i ? 'selected' : ''}>${etiquetaIcono(i)}</option>`).join('')}
                    </select>
                    <button type="button" class="btn-borrar-beneficio" data-rol="admin,recepcionista" title="Borrar beneficio"><i data-lucide="trash-2"></i></button>
                </div>
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
            <div class="plan-editar">
                <div class="plan-editar-fila">
                    <input class="nombre-editable input-nombre-plan" data-original="${p.nombre_plan}" value="${p.nombre_plan}" placeholder="Nombre del plan">
                    <button type="button" class="btn-borrar-plan" data-rol="admin,recepcionista" data-plan="${p.nombre_plan}" title="Borrar plan"><i data-lucide="trash-2"></i></button>
                </div>
                <select class="selector-icono-inline selector-icono-plan" data-original="${p.nombre_plan}">
                    ${ICONOS_DISPONIBLES.map(i => `<option value="${i}" ${iconoDePlan(p) === i ? 'selected' : ''}>${etiquetaIcono(i)}</option>`).join('')}
                </select>
                <div class="costo-editable-wrap">
                    <span>$</span>
                    <input type="number" min="0" step="0.01" class="nombre-editable input-costo-plan" data-original="${p.nombre_plan}" value="${p.costo ?? 0}" placeholder="Costo">
                </div>
            </div>
        </th>
    `).join('');

    body.innerHTML = beneficios.map(b => filaBeneficioHTML(b, b)).join('');
    lucide.createIcons();
    reaplicarPermisos();
}

function agregarFilaBeneficio() {
    const body = document.getElementById('tabla-editar-body');
    body.insertAdjacentHTML('beforeend', filaBeneficioHTML('', ''));
    const inputs = body.querySelectorAll('.input-nombre-beneficio');
    inputs[inputs.length - 1].focus();
    lucide.createIcons();
    reaplicarPermisos();
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
    // (también se guarda el costo de cada plan)
    for (const input of document.querySelectorAll('.input-nombre-plan')) {
        const original = input.dataset.original;
        const nuevo = input.value.trim();
        const inputCosto = document.querySelector(`.input-costo-plan[data-original="${original}"]`);
        const costo = Math.max(0, parseFloat(inputCosto.value) || 0);

        const inputIcono = document.querySelector(`.selector-icono-plan[data-original="${original}"]`);
        const cambios = { costo, icono: inputIcono.value };
        if (nuevo && nuevo !== original) cambios.nombre_plan = nuevo;

        const { error } = await window.supabaseClient.from('planes').update(cambios).eq('nombre_plan', original);
        if (error) {
            console.error(error);
            alert(`No se pudo guardar el plan "${original}"`);
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
        <label class="beneficio-check-fila">
            <span class="beneficio-nombre"><input type="checkbox" class="check-nuevo-beneficio" data-beneficio="${b}"><i data-lucide="${iconoDeBeneficio(b)}" class="beneficio-icono"></i>${b}</span>
        </label>
    `).join('');
    lucide.createIcons();
}

async function crearPlan() {
    const nombre = document.getElementById('input-nombre-plan').value.trim();
    const descripcion = document.getElementById('input-descripcion-plan').value.trim();
    const costo = Math.max(0, parseFloat(document.getElementById('input-costo-plan').value) || 0);

    if (!nombre) {
        alert('Poné un nombre para el plan');
        return;
    }

    const { error: errorPlan } = await window.supabaseClient.from('planes').insert({
        nombre_plan: nombre,
        costo,
        descripcion,
        icono: iconoPlanSeleccionado
    });
    if (errorPlan) {
        console.error(errorPlan);
        alert('No se pudo crear el plan (¿ya existe ese nombre?)');
        return;
    }

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
    document.getElementById('input-costo-plan').value = '';
    renderSelectorIconosPlan();
    renderListaBeneficiosCrear();
    mostrarVista(vistaCrear);
});

document.getElementById('btn-volver-crear').addEventListener('click', () => {
    mostrarVista(vistaPlanes);
});

document.getElementById('btn-agregar-plan').addEventListener('click', crearPlan);

(async () => {
    if (!(await protegerRuta())) return;
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
            cerrarSesion();
        });
    }
}
configurarLogout();