import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion, reaplicarPermisos } from "./compartido/sesion.js";

// ============================================
// ESTADO
// ============================================
let contratos = [];
let planesDisponibles = [];
let mascotasCache = null;
let contratoEditandoId = null;
let mascotaSeleccionada = null;
let searchDebounce = null;
let filtroQueryParam = null;

// Elementos DOM
const tbody = document.getElementById('contratos-body');
const vistaLista = document.getElementById('vistaLista');
const vistaEditar = document.getElementById('vistaEditar');
const inputBuscador = document.getElementById('inputBuscador');
const filtroEstado = document.getElementById('filtroEstado');
const filtroPlan = document.getElementById('filtroPlan');
const filtroFechaDesde = document.getElementById('filtroFechaDesde');
const filtroFechaHasta = document.getElementById('filtroFechaHasta');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
const contadorResultados = document.getElementById('contadorResultados');
const btnNuevoContrato = document.getElementById('btnNuevoContrato');
const btnVolver = document.getElementById('btnVolver');
const formContrato = document.getElementById('formContrato');
const tituloFormulario = document.getElementById('tituloFormulario');
const subtituloFormulario = document.getElementById('subtituloFormulario');
const btnConfirmarTexto = document.getElementById('btnConfirmarTexto');
const buscarMascotaInput = document.getElementById('buscarMascota');
const mascotaResults = document.getElementById('mascotaResults');
const mascotaSeleccionadaDiv = document.getElementById('mascotaSeleccionada');
const selectPlan = document.getElementById('selectPlan');
const selectDuracion = document.getElementById('selectDuracion');
const fechaInicio = document.getElementById('fechaInicio');
const fechaFin = document.getElementById('fechaFin');
const selectEstado = document.getElementById('selectEstado');
const contratoIdInput = document.getElementById('contratoId');
const mascotaIdInput = document.getElementById('mascotaIdSeleccionada');
const dniInput = document.getElementById('dniSeleccionado');

// Modales
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmText = document.getElementById('confirm-text');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDelete = document.getElementById('confirm-delete');

// ============================================
// UTILIDADES
// ============================================
function limpiarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escaparHTML(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-AR');
}

function sumarDias(fechaISO, dias) {
  const d = new Date(fechaISO + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

function calcularDiasRestantes(fechaFin, estado) {
  if (!fechaFin || estado !== 'Activo') return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin + 'T00:00:00');
  const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
  return diff;
}

function claseColorPlan(nombre) {
  let hash = 0;
  const s = String(nombre || '');
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) % 6;
  }
  return `plan-${hash}`;
}

// ============================================
// AUTO-VENCIDOS
// ============================================
async function marcarVencidos() {
  const hoy = hoyISO();
  const { error } = await supabase
    .from('contratos')
    .update({ estado_contrato: 'Vencido' })
    .eq('estado_contrato', 'Activo')
    .lt('fecha_fin', hoy);
  if (error) {
    console.warn('No se pudieron marcar vencidos:', error.message);
  }
}

// ============================================
// CARGA DE DATOS
// ============================================
async function cargarContratos() {
  if (!supabase) return;

  // Primero, marcar vencidos automáticamente
  await marcarVencidos();

  const { data, error } = await supabase
    .from('contratos')
    .select(`
      id_contrato,
      dni,
      id_mascota,
      nombre_plan,
      fecha_inicio,
      fecha_fin,
      estado_contrato,
      clientes ( nombre, apellido ),
      mascotas ( nombre_mascota, especie )
    `)
    .order('id_contrato', { ascending: false });

  if (error) {
    console.error('Error cargando contratos:', error);
    return;
  }

  contratos = (data || []).map((c) => ({
    id_contrato: c.id_contrato,
    dni: c.dni,
    id_mascota: c.id_mascota,
    nombre_plan: c.nombre_plan,
    fecha_inicio: c.fecha_inicio,
    fecha_fin: c.fecha_fin,
    estado_contrato: c.estado_contrato,
    cliente_nombre: c.clientes?.nombre || '',
    cliente_apellido: c.clientes?.apellido || '',
    mascota_nombre: c.mascotas?.nombre_mascota || '',
    mascota_especie: c.mascotas?.especie || '',
  }));

  console.log(`Contratos: ${contratos.length} cargados`);
  aplicarFiltros();
}

async function cargarPlanes() {
  const { data, error } = await supabase
    .from('planes')
    .select('nombre_plan, costo')
    .order('nombre_plan');
  if (error) {
    console.error('Error cargando planes:', error);
    return;
  }
  planesDisponibles = data || [];
  llenarSelectPlanes();
  llenarFiltroPlanes();
}

function llenarSelectPlanes() {
  if (!selectPlan) return;
  selectPlan.innerHTML = '<option value="">Seleccionar plan</option>' +
    planesDisponibles.map((p) => `
      <option value="${escaparHTML(p.nombre_plan)}">${escaparHTML(p.nombre_plan)} — $${p.costo}</option>
    `).join('');
}

function llenarFiltroPlanes() {
  if (!filtroPlan) return;
  filtroPlan.innerHTML = '<option value="">Todos</option>' +
    planesDisponibles.map((p) => `
      <option value="${escaparHTML(p.nombre_plan)}">${escaparHTML(p.nombre_plan)}</option>
    `).join('');
}

async function cargarMascotasCache() {
  if (mascotasCache) return mascotasCache;

  const { data, error } = await supabase
    .from('mascotas')
    .select(`
      id_mascota,
      nombre_mascota,
      especie,
      raza,
      dni,
      clientes ( nombre, apellido )
    `);

  if (error) {
    console.error('Error cargando mascotas:', error);
    mascotasCache = [];
    return mascotasCache;
  }

  mascotasCache = (data || []).map((m) => ({
    id_mascota: m.id_mascota,
    nombre_mascota: m.nombre_mascota,
    especie: m.especie,
    raza: m.raza,
    dni: m.dni,
    cliente_nombre: m.clientes?.nombre || '',
    cliente_apellido: m.clientes?.apellido || '',
  }));

  return mascotasCache;
}

// ============================================
// RENDER
// ============================================
function renderContratos(lista) {
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="padding: 40px; text-align: center; color: var(--gray-500);">
          No hay contratos que coincidan con los filtros
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach((c) => {
    const estadoClass = c.estado_contrato === 'Activo'
      ? 'activo'
      : c.estado_contrato === 'Vencido'
        ? 'vencido'
        : 'cancelado';

    const dias = calcularDiasRestantes(c.fecha_fin, c.estado_contrato);
    let diasHTML = '<span class="dias-restantes none">—</span>';
    if (dias !== null) {
      if (dias < 0) {
        diasHTML = `<span class="dias-restantes vencido">Vencido hace ${Math.abs(dias)} d.</span>`;
      } else if (dias <= 7) {
        diasHTML = `<span class="dias-restantes proximo">${dias} d.</span>`;
      } else {
        diasHTML = `<span class="dias-restantes ok">${dias} d.</span>`;
      }
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id_contrato}</td>
      <td>
        <div class="dueno-cell">
          <span class="dueno-nombre">${escaparHTML(c.cliente_nombre)} ${escaparHTML(c.cliente_apellido)}</span>
          <span class="dueno-dni">
            DNI ${escaparHTML(c.dni)}
            <button class="btn-copy-dni" data-dni="${escaparHTML(c.dni)}" title="Copiar DNI">
              <i data-lucide="copy"></i>
            </button>
          </span>
        </div>
      </td>
      <td>${escaparHTML(c.mascota_nombre)}</td>
      <td><span class="badge-plan ${claseColorPlan(c.nombre_plan)}">${escaparHTML(c.nombre_plan)}</span></td>
      <td>${formatearFecha(c.fecha_inicio)}</td>
      <td>${c.fecha_fin ? formatearFecha(c.fecha_fin) : '—'}</td>
      <td>${diasHTML}</td>
      <td><span class="badge-estado ${estadoClass}">${escaparHTML(c.estado_contrato)}</span></td>
      <td class="actions-cell">
        <div class="actions">
          <button class="icon-btn more" title="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="1"/>
              <circle cx="12" cy="12" r="1"/>
              <circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item show" data-dni="${escaparHTML(c.dni)}">
              <i data-lucide="eye"></i>
              Ver mascota
            </button>
            <button class="dropdown-item renew" data-rol="Administrador,Recepcionista" data-id="${c.id_contrato}">
              <i data-lucide="refresh-cw"></i>
              Renovar
            </button>
            <button class="dropdown-item edit" data-rol="Administrador,Recepcionista" data-id="${c.id_contrato}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            <button class="dropdown-item danger" data-rol="Administrador" data-id="${c.id_contrato}" data-info="${escaparHTML(c.mascota_nombre)} · ${escaparHTML(c.nombre_plan)}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6"/>
                <path d="M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
              Eliminar
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();
  reaplicarPermisos();
}

// ============================================
// FILTROS
// ============================================
function obtenerContratosFiltrados() {
  const texto = (inputBuscador?.value || '').trim();
  const busqueda = limpiarTexto(texto);
  const estadoFiltro = filtroEstado?.value || '';
  const planFiltro = filtroPlan?.value || '';
  const fechaDesde = filtroFechaDesde?.value ? new Date(filtroFechaDesde.value + 'T00:00:00') : null;
  const fechaHasta = filtroFechaHasta?.value ? new Date(filtroFechaHasta.value + 'T23:59:59') : null;

  return contratos.filter((c) => {
    // Filtro especial: próximos 7 días
    if (filtroQueryParam === 'proximos') {
      if (c.estado_contrato !== 'Activo') return false;
      const dias = calcularDiasRestantes(c.fecha_fin, c.estado_contrato);
      if (dias === null || dias < 0 || dias > 7) return false;
    }

    if (busqueda) {
      const nombreMascota = limpiarTexto(c.mascota_nombre);
      const nombreCliente = limpiarTexto(`${c.cliente_nombre} ${c.cliente_apellido}`);
      const dni = String(c.dni || '').toLowerCase();
      const plan = limpiarTexto(c.nombre_plan);
      const coincide =
        nombreMascota.includes(busqueda) ||
        nombreCliente.includes(busqueda) ||
        dni.includes(busqueda) ||
        plan.includes(busqueda);
      if (!coincide) return false;
    }

    if (estadoFiltro && c.estado_contrato !== estadoFiltro) return false;
    if (planFiltro && c.nombre_plan !== planFiltro) return false;

    if (fechaDesde) {
      const fi = new Date(c.fecha_inicio + 'T00:00:00');
      if (fi < fechaDesde) return false;
    }
    if (fechaHasta) {
      const fi = new Date(c.fecha_inicio + 'T00:00:00');
      if (fi > fechaHasta) return false;
    }

    return true;
  });
}

function aplicarFiltros() {
  const filtrados = obtenerContratosFiltrados();
  renderContratos(filtrados);
  actualizarContador(filtrados.length, contratos.length);
}

function actualizarContador(mostrando, total) {
  if (!contadorResultados) return;
  if (total === 0) {
    contadorResultados.innerHTML = '';
    return;
  }
  const palabra = total === 1 ? 'contrato' : 'contratos';
  const filtroExtra = filtroQueryParam === 'proximos' ? ' (próximos 7 días)' : '';
  if (mostrando === total) {
    contadorResultados.innerHTML = `Mostrando <strong>${total}</strong> ${palabra}${filtroExtra}`;
  } else {
    contadorResultados.innerHTML = `Mostrando <strong>${mostrando}</strong> de <strong>${total}</strong> ${palabra}${filtroExtra}`;
  }
}

function limpiarFiltros() {
  if (inputBuscador) inputBuscador.value = '';
  if (filtroEstado) filtroEstado.value = '';
  if (filtroPlan) filtroPlan.value = '';
  if (filtroFechaDesde) filtroFechaDesde.value = '';
  if (filtroFechaHasta) filtroFechaHasta.value = '';
  filtroQueryParam = null;
  // Limpiar el query param de la URL sin recargar
  if (window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  aplicarFiltros();
}

// ============================================
// BUSCADOR DE MASCOTA
// ============================================
function ocultarResultadosMascota() {
  if (!mascotaResults) return;
  mascotaResults.classList.add('hidden');
  mascotaResults.innerHTML = '';
}

async function buscarMascotas(query) {
  const q = query.trim();
  if (q.length < 2) {
    ocultarResultadosMascota();
    return;
  }

  const mascotas = await cargarMascotasCache();
  const busqueda = limpiarTexto(q);

  const resultados = mascotas.filter((m) => {
    const nombre = limpiarTexto(m.nombre_mascota);
    const dni = String(m.dni || '').toLowerCase();
    const cliente = limpiarTexto(`${m.cliente_nombre} ${m.cliente_apellido}`);
    return nombre.includes(busqueda) || dni.includes(busqueda) || cliente.includes(busqueda);
  }).slice(0, 8);

  if (resultados.length === 0) {
    mascotaResults.classList.remove('hidden');
    mascotaResults.innerHTML = `<div class="mascota-results-empty">No se encontraron mascotas</div>`;
    return;
  }

  mascotaResults.classList.remove('hidden');
  mascotaResults.innerHTML = resultados.map((m) => `
    <div class="mascota-result-item"
         data-id="${m.id_mascota}"
         data-dni="${escaparHTML(m.dni)}"
         data-nombre="${escaparHTML(m.nombre_mascota)}"
         data-especie="${escaparHTML(m.especie)}"
         data-raza="${escaparHTML(m.raza || '')}"
         data-cliente="${escaparHTML(m.cliente_nombre + ' ' + m.cliente_apellido)}">
      <div class="mascota-result-icon"><i data-lucide="paw-print"></i></div>
      <div class="mascota-result-info">
        <strong>${escaparHTML(m.nombre_mascota)} · ${escaparHTML(m.especie)}</strong>
        <small>${escaparHTML(m.cliente_nombre + ' ' + m.cliente_apellido)} · DNI ${escaparHTML(m.dni)}</small>
      </div>
    </div>
  `).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function seleccionarMascota(item) {
  mascotaSeleccionada = {
    id_mascota: parseInt(item.dataset.id),
    dni: item.dataset.dni,
    nombre: item.dataset.nombre,
    especie: item.dataset.especie,
    raza: item.dataset.raza,
    cliente: item.dataset.cliente,
  };

  if (mascotaIdInput) mascotaIdInput.value = mascotaSeleccionada.id_mascota;
  if (dniInput) dniInput.value = mascotaSeleccionada.dni;
  if (buscarMascotaInput) buscarMascotaInput.value = '';
  ocultarResultadosMascota();
  renderMascotaSeleccionada();
}

function renderMascotaSeleccionada() {
  if (!mascotaSeleccionadaDiv || !mascotaSeleccionada) return;

  const contratoActivo = contratos.find(
    (c) => c.id_mascota === mascotaSeleccionada.id_mascota &&
           c.estado_contrato === 'Activo' &&
           c.id_contrato !== contratoEditandoId
  );

  const warning = contratoActivo
    ? `<div class="mascota-sel-warning">⚠️ Esta mascota ya tiene un contrato activo con el plan "${escaparHTML(contratoActivo.nombre_plan)}". Al guardar, se cancelará y se creará uno nuevo.</div>`
    : '';

  mascotaSeleccionadaDiv.classList.remove('hidden');
  mascotaSeleccionadaDiv.innerHTML = `
    <div class="mascota-sel-icon"><i data-lucide="paw-print"></i></div>
    <div class="mascota-sel-info">
      <strong>${escaparHTML(mascotaSeleccionada.nombre)} · ${escaparHTML(mascotaSeleccionada.especie)}</strong>
      <small>Dueño: ${escaparHTML(mascotaSeleccionada.cliente)} · DNI ${escaparHTML(mascotaSeleccionada.dni)}</small>
      ${warning}
    </div>
    <button type="button" class="mascota-sel-remove" id="btnQuitarMascota" title="Quitar">
      <i data-lucide="x"></i>
    </button>
  `;
  if (typeof lucide !== 'undefined') lucide.createIcons();

  document.getElementById('btnQuitarMascota')?.addEventListener('click', () => {
    mascotaSeleccionada = null;
    if (mascotaIdInput) mascotaIdInput.value = '';
    if (dniInput) dniInput.value = '';
    mascotaSeleccionadaDiv.classList.add('hidden');
    mascotaSeleccionadaDiv.innerHTML = '';
  });
}

// ============================================
// FECHAS AUTO
// ============================================
function recalcularFechaFin() {
  if (!fechaInicio?.value || !selectDuracion?.value || !fechaFin) return;
  const dias = parseInt(selectDuracion.value, 10) || 30;
  fechaFin.value = sumarDias(fechaInicio.value, dias);
}

// ============================================
// VISTAS
// ============================================
function mostrarLista() {
  if (vistaEditar) vistaEditar.style.display = 'none';
  if (vistaLista) vistaLista.style.display = 'block';
  const toolbar = document.querySelector('.toolbar-filtros');
  const pageHeader = document.querySelector('.page-header');
  if (toolbar) toolbar.style.display = 'flex';
  if (pageHeader) pageHeader.style.display = 'flex';
  aplicarFiltros();
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function mostrarFormulario(contrato = null, datosRenovar = null) {
  if (vistaLista) vistaLista.style.display = 'none';
  const toolbar = document.querySelector('.toolbar-filtros');
  const pageHeader = document.querySelector('.page-header');
  if (toolbar) toolbar.style.display = 'none';
  if (pageHeader) pageHeader.style.display = 'none';
  if (vistaEditar) vistaEditar.style.display = 'block';

  formContrato.reset();
  mascotaSeleccionada = null;
  contratoEditandoId = null;
  if (mascotaSeleccionadaDiv) {
    mascotaSeleccionadaDiv.classList.add('hidden');
    mascotaSeleccionadaDiv.innerHTML = '';
  }
  if (mascotaIdInput) mascotaIdInput.value = '';
  if (dniInput) dniInput.value = '';
  if (contratoIdInput) contratoIdInput.value = '';
  ocultarResultadosMascota();

  if (contrato && !datosRenovar) {
    // Editar
    tituloFormulario.textContent = 'Editar contrato';
    subtituloFormulario.textContent = 'Modificar datos del contrato';
    btnConfirmarTexto.textContent = 'Actualizar';
    contratoEditandoId = contrato.id_contrato;
    contratoIdInput.value = contrato.id_contrato;

    mascotaSeleccionada = {
      id_mascota: contrato.id_mascota,
      dni: String(contrato.dni),
      nombre: contrato.mascota_nombre,
      especie: contrato.mascota_especie,
      raza: '',
      cliente: `${contrato.cliente_nombre} ${contrato.cliente_apellido}`,
    };
    mascotaIdInput.value = contrato.id_mascota;
    dniInput.value = contrato.dni;
    renderMascotaSeleccionada();

    if (selectPlan) selectPlan.value = contrato.nombre_plan;
    if (fechaInicio) fechaInicio.value = contrato.fecha_inicio;
    if (fechaFin) fechaFin.value = contrato.fecha_fin || '';
    if (selectEstado) selectEstado.value = contrato.estado_contrato;
  } else if (datosRenovar) {
    // Renovar
    tituloFormulario.textContent = 'Renovar contrato';
    subtituloFormulario.textContent = 'Crear un nuevo contrato para esta mascota';
    btnConfirmarTexto.textContent = 'Renovar';

    mascotaSeleccionada = {
      id_mascota: datosRenovar.id_mascota,
      dni: String(datosRenovar.dni),
      nombre: datosRenovar.mascota_nombre,
      especie: datosRenovar.mascota_especie,
      raza: '',
      cliente: `${datosRenovar.cliente_nombre} ${datosRenovar.cliente_apellido}`,
    };
    mascotaIdInput.value = datosRenovar.id_mascota;
    dniInput.value = datosRenovar.dni;
    renderMascotaSeleccionada();

    if (selectPlan) selectPlan.value = datosRenovar.nombre_plan;
    if (fechaInicio) fechaInicio.value = datosRenovar.nuevaFechaInicio;
    if (selectDuracion) selectDuracion.value = '30';
    if (selectEstado) selectEstado.value = 'Activo';
    recalcularFechaFin();
  } else {
    // Nuevo
    tituloFormulario.textContent = 'Nuevo contrato';
    subtituloFormulario.textContent = 'Asignar un plan a una mascota';
    btnConfirmarTexto.textContent = 'Confirmar';

    const hoy = hoyISO();
    if (fechaInicio) fechaInicio.value = hoy;
    if (selectDuracion) selectDuracion.value = '30';
    if (selectEstado) selectEstado.value = 'Activo';
    recalcularFechaFin();
  }

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// CRUD
// ============================================
async function existeContratoActivo(idMascota, excluirId = null) {
  return contratos.find(
    (c) => c.id_mascota === idMascota &&
           c.estado_contrato === 'Activo' &&
           c.id_contrato !== excluirId
  );
}

async function cancelarContratoActivo(idContrato) {
  const { error } = await supabase
    .from('contratos')
    .update({ estado_contrato: 'Cancelado' })
    .eq('id_contrato', idContrato);
  return !error;
}

async function guardarContrato(datos) {
  const activo = await existeContratoActivo(datos.id_mascota, contratoEditandoId);
  if (activo) {
    const ok = await cancelarContratoActivo(activo.id_contrato);
    if (!ok) {
      alert('No se pudo cancelar el contrato anterior');
      return false;
    }
  }

  const payload = {
    dni: parseInt(datos.dni, 10),
    id_mascota: parseInt(datos.id_mascota, 10),
    nombre_plan: datos.nombre_plan,
    fecha_inicio: datos.fecha_inicio,
    fecha_fin: datos.fecha_fin || null,
    estado_contrato: datos.estado_contrato,
  };

  if (contratoEditandoId) {
    const { error } = await supabase
      .from('contratos')
      .update(payload)
      .eq('id_contrato', contratoEditandoId);
    if (error) {
      console.error('Error update contrato:', error);
      alert('No se pudo actualizar: ' + error.message);
      return false;
    }
  } else {
    const { error } = await supabase.from('contratos').insert([payload]);
    if (error) {
      console.error('Error insert contrato:', error);
      alert('No se pudo crear: ' + error.message);
      return false;
    }
  }

  await cargarContratos();
  return true;
}

async function eliminarContrato(id) {
  const { error } = await supabase.from('contratos').delete().eq('id_contrato', id);
  if (error) {
    console.error('Error delete contrato:', error);
    alert('No se pudo eliminar: ' + error.message);
    return false;
  }
  await cargarContratos();
  return true;
}

// ============================================
// EVENTOS
// ============================================
if (inputBuscador) inputBuscador.addEventListener('input', aplicarFiltros);
if (filtroEstado) filtroEstado.addEventListener('change', aplicarFiltros);
if (filtroPlan) filtroPlan.addEventListener('change', aplicarFiltros);
if (filtroFechaDesde) filtroFechaDesde.addEventListener('change', aplicarFiltros);
if (filtroFechaHasta) filtroFechaHasta.addEventListener('change', aplicarFiltros);
if (btnLimpiarFiltros) btnLimpiarFiltros.addEventListener('click', limpiarFiltros);

if (btnNuevoContrato) btnNuevoContrato.addEventListener('click', () => mostrarFormulario(null));
if (btnVolver) btnVolver.addEventListener('click', mostrarLista);

if (buscarMascotaInput) {
  buscarMascotaInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounce);
    const valor = e.target.value;
    searchDebounce = setTimeout(() => buscarMascotas(valor), 250);
  });
}
if (mascotaResults) {
  mascotaResults.addEventListener('click', (e) => {
    const item = e.target.closest('.mascota-result-item');
    if (item) seleccionarMascota(item);
  });
}
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.mascota-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    ocultarResultadosMascota();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ocultarResultadosMascota();
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  }
});

if (selectDuracion) selectDuracion.addEventListener('change', recalcularFechaFin);
if (fechaInicio) fechaInicio.addEventListener('change', recalcularFechaFin);

// Copy DNI
document.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('.btn-copy-dni');
  if (copyBtn) {
    e.stopPropagation();
    const dni = copyBtn.getAttribute('data-dni');
    try {
      await navigator.clipboard.writeText(dni);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = dni;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = '<i data-lucide="check"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = '<i data-lucide="copy"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 1200);
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
    return;
  }
});

// Dropdown
document.addEventListener('click', (e) => {
  const moreBtn = e.target.closest('.icon-btn.more');
  if (!moreBtn) {
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
    return;
  }
  e.stopPropagation();
  const menu = moreBtn.closest('.actions').querySelector('.dropdown-menu');
  if (!menu) return;
  const rect = moreBtn.getBoundingClientRect();
  const card = document.querySelector('.table-card');
  const cardRect = card ? card.getBoundingClientRect() : null;
  const spaceBelowViewport = window.innerHeight - rect.bottom;
  const spaceBelowCard = cardRect ? cardRect.bottom - rect.bottom : spaceBelowViewport;
  const needed = menu.offsetHeight || 90;
  const spaceBelow = Math.min(spaceBelowViewport, spaceBelowCard);
  if (spaceBelow < needed + 8) menu.classList.add('dropup');
  else menu.classList.remove('dropup');
  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
});

// Ver mascota
document.addEventListener('click', (e) => {
  const btnVerMascota = e.target.closest('.dropdown-item.show');
  if (!btnVerMascota) return;
  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  const dni = btnVerMascota.getAttribute('data-dni');
  window.location.href = `mascotas.html?dni=${encodeURIComponent(dni)}`;
});

// Renovar
document.addEventListener('click', (e) => {
  const renewBtn = e.target.closest('.dropdown-item.renew');
  if (!renewBtn) return;
  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));

  const id = parseInt(renewBtn.getAttribute('data-id'));
  const contrato = contratos.find((c) => c.id_contrato === id);
  if (!contrato) return;

  // Calcular nueva fecha de inicio
  const hoy = hoyISO();
  let nuevaFechaInicio;
  if (contrato.fecha_fin && contrato.fecha_fin >= hoy) {
    // Aún vigente → arranca el día después de la fecha_fin
    nuevaFechaInicio = sumarDias(contrato.fecha_fin, 1);
  } else {
    // Ya venció → arranca hoy
    nuevaFechaInicio = hoy;
  }

  mostrarFormulario(null, {
    ...contrato,
    nuevaFechaInicio,
  });
});

// Editar
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.dropdown-item.edit');
  if (!editBtn) return;
  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  const id = parseInt(editBtn.getAttribute('data-id'));
  const contrato = contratos.find((c) => c.id_contrato === id);
  if (contrato) mostrarFormulario(contrato);
});

// Eliminar
let idPendienteEliminar = null;
function abrirConfirmEliminar(id, info) {
  idPendienteEliminar = id;
  if (confirmText) confirmText.textContent = `¿Seguro que querés eliminar el contrato "${info}"? Esta acción no se puede deshacer.`;
  if (confirmOverlay) confirmOverlay.classList.remove('hidden');
}
function cerrarConfirmEliminar() {
  if (confirmOverlay) confirmOverlay.classList.add('hidden');
  idPendienteEliminar = null;
}
document.addEventListener('click', (e) => {
  const deleteBtn = e.target.closest('.dropdown-item.danger');
  if (!deleteBtn) return;
  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  const id = parseInt(deleteBtn.getAttribute('data-id'));
  const info = deleteBtn.getAttribute('data-info') || 'este contrato';
  abrirConfirmEliminar(id, info);
});
if (confirmCancel) confirmCancel.addEventListener('click', cerrarConfirmEliminar);
if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) cerrarConfirmEliminar();
});
if (confirmDelete) confirmDelete.addEventListener('click', async () => {
  if (!idPendienteEliminar) return;
  confirmDelete.disabled = true;
  confirmDelete.textContent = 'Eliminando...';
  const ok = await eliminarContrato(idPendienteEliminar);
  confirmDelete.disabled = false;
  confirmDelete.textContent = 'Eliminar';
  if (ok) cerrarConfirmEliminar();
});

// Submit formulario
if (formContrato) {
  formContrato.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!mascotaSeleccionada) {
      alert('Seleccioná una mascota');
      return;
    }
    if (!selectPlan?.value) {
      alert('Seleccioná un plan');
      return;
    }
    if (!fechaInicio?.value || !fechaFin?.value) {
      alert('Completá las fechas');
      return;
    }
    if (new Date(fechaFin.value) <= new Date(fechaInicio.value)) {
      alert('La fecha de fin debe ser posterior a la de inicio');
      return;
    }

    const datos = {
      dni: mascotaSeleccionada.dni,
      id_mascota: mascotaSeleccionada.id_mascota,
      nombre_plan: selectPlan.value,
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value,
      estado_contrato: selectEstado?.value || 'Activo',
    };

    const btn = formContrato.querySelector('.btn-confirmar');
    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }

    const ok = await guardarContrato(datos);

    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (ok) {
      mostrarLista();
      contratoEditandoId = null;
    }
  });
}

// ============================================
// LOGOUT
// ============================================
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesion();
  });
}

// ============================================
// QUERY PARAMS
// ============================================
function aplicarQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const filtro = params.get('filtro');
  if (filtro === 'proximos') {
    filtroQueryParam = 'proximos';
  }
}

// ============================================
// INICIALIZAR
// ============================================
(async () => {
  if (!(await protegerRuta())) return;
  aplicarQueryParams();
  await Promise.all([cargarPlanes(), cargarMascotasCache()]);
  await cargarContratos();
})();