import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion, reaplicarPermisos } from "./compartido/sesion.js";

// ============================================
// VARIABLES GLOBALES
// ============================================
let mascotas = [];
let contratosActivos = {}; // { id_mascota: { nombre_plan, ... } }
let idMascotaEditando = null;

const tbody = document.getElementById('mascotas-body');
const vistaLista = document.getElementById('vistaLista');
const vistaEditar = document.getElementById('vistaEditar');
const inputBuscador = document.getElementById('inputBuscador');
const formMascota = document.getElementById('formMascota');
const btnAltaMascota = document.getElementById('btnAltaMascota');
const btnVolver = document.getElementById('btnVolver');
const btnConfirmarTexto = document.getElementById('btnConfirmarTexto');
const tituloFormulario = document.getElementById('tituloFormulario');
const subtituloFormulario = document.getElementById('subtituloFormulario');
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmText = document.getElementById('confirm-text');
const confirmCancel = document.getElementById('confirm-cancel');
const confirmDelete = document.getElementById('confirm-delete');

const filtroEstado = document.getElementById('filtroEstado');
const filtroPesoDesde = document.getElementById('filtroPesoDesde');
const filtroPesoHasta = document.getElementById('filtroPesoHasta');
const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');
const contadorResultados = document.getElementById('contadorResultados');

// ============================================
// UTILIDADES
// ============================================
function limpiarTexto(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function validarDni(dni) {
  return /^\d{7,8}$/.test(dni);
}

function validarFechaNacimiento(fecha) {
  const hoy = new Date();
  const fechaNac = new Date(fecha);
  return fechaNac < hoy;
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-AR');
}

function claseColorPlan(nombre) {
  let hash = 0;
  const s = String(nombre || '');
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 6;
  return `plan-${hash}`;
}

// ============================================
// SUPABASE
// ============================================
async function cargarContratosActivos() {
  const { data, error } = await supabase
    .from('contratos')
    .select('id_mascota, nombre_plan, fecha_fin')
    .eq('estado_contrato', 'Activo');
  if (error) {
    console.warn('No se pudieron cargar contratos activos:', error.message);
    contratosActivos = {};
    return;
  }
  contratosActivos = {};
  (data || []).forEach((c) => {
    contratosActivos[c.id_mascota] = {
      nombre_plan: c.nombre_plan,
      fecha_fin: c.fecha_fin,
    };
  });
}

async function cargarMascotasDesdeSupabase() {
  if (!supabase) return;

  const [_, __] = await Promise.all([
    cargarContratosActivos(),
    (async () => {
      const { data, error } = await supabase.from('mascotas').select('*');
      if (error) {
        console.error('Error Supabase select mascotas:', error.message);
        return;
      }
      mascotas = (data || []).map((m) => ({
        id_mascota: m.id_mascota,
        nombre_mascota: m.nombre_mascota || '',
        especie: m.especie || '',
        raza: m.raza || '',
        sexo: m.sexo || '',
        fecha_nacimiento: m.fecha_nacimiento || '',
        color: m.color || '',
        peso: m.peso || '',
        observaciones: m.observaciones || '',
        dni: m.dni || '',
        estado_mascota: m.estado_mascota || 'Activo',
        fecha_registro: m.fecha_registro || ''
      }));
    })(),
  ]);

  console.log(`Supabase: ${mascotas.length} mascotas cargadas`);
  aplicarFiltros();
}

async function guardarMascotaEnSupabase(datos) {
  const payload = {
    nombre_mascota: datos.nombre_mascota,
    especie: datos.especie,
    raza: datos.raza || null,
    sexo: datos.sexo,
    fecha_nacimiento: datos.fecha_nacimiento,
    color: datos.color || null,
    peso: datos.peso ? parseFloat(datos.peso) : null,
    observaciones: datos.observaciones || null,
    dni: datos.dni,
    estado_mascota: datos.estado_mascota || 'Activo'
  };

  if (datos.id_mascota) {
    const { error } = await supabase.from('mascotas').update(payload).eq('id_mascota', datos.id_mascota);
    if (error) { alert('No se pudo actualizar: ' + error.message); return false; }
  } else {
    payload.fecha_registro = new Date().toISOString();
    const { error } = await supabase.from('mascotas').insert([payload]);
    if (error) { alert('No se pudo crear la mascota: ' + error.message); return false; }
  }

  await cargarMascotasDesdeSupabase();
  return true;
}

async function eliminarMascotaEnSupabase(id) {
  const { error } = await supabase.from('mascotas').delete().eq('id_mascota', id);
  if (error) { alert('No se pudo eliminar: ' + error.message); return false; }
  await cargarMascotasDesdeSupabase();
  return true;
}

// ============================================
// RENDER
// ============================================
function renderMascotas(lista) {
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!lista || lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="padding: 40px; text-align: center; color: var(--gray-500);">No hay mascotas que coincidan con los filtros</td></tr>`;
    return;
  }

  lista.forEach((m) => {
    const badgeClass = m.estado_mascota === 'Activo' ? 'activo' : 'inactivo';
    const plan = contratosActivos[m.id_mascota];
    const planHTML = plan
      ? `<span class="badge-plan ${claseColorPlan(plan.nombre_plan)}">${plan.nombre_plan}</span>`
      : `<span class="badge-plan sin-plan">Sin plan</span>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.id_mascota}</td>
      <td>${m.nombre_mascota || ''}</td>
      <td>${m.especie || ''}</td>
      <td>${m.raza || ''}</td>
      <td>${m.sexo || ''}</td>
      <td>${formatearFecha(m.fecha_nacimiento)}</td>
      <td>${m.color || ''}</td>
      <td>${m.peso ? m.peso + ' kg' : ''}</td>
      <td>${planHTML}</td>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.observaciones || ''}</td>
      <td>
        <span class="dni-cell">
          <span class="dni-text">${m.dni || ''}</span>
          ${m.dni ? `<button class="btn-copy-dni" data-dni="${m.dni}" title="Copiar DNI"><i data-lucide="copy" class="copy-icon"></i></button>` : ''}
        </span>
      </td>
      <td><span class="badge ${badgeClass}">${m.estado_mascota || 'Activo'}</span></td>
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
            <button class="dropdown-item edit" data-rol="Administrador,Recepcionista" data-id="${m.id_mascota}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            <button class="dropdown-item danger" data-rol="Administrador,Recepcionista" data-id="${m.id_mascota}" data-nombre="${m.nombre_mascota}">
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
function obtenerMascotasFiltradas() {
  const texto = (inputBuscador?.value || '').trim();
  const busqueda = limpiarTexto(texto);
  const estadoFiltro = filtroEstado?.value || '';
  const pesoDesdeRaw = filtroPesoDesde?.value;
  const pesoHastaRaw = filtroPesoHasta?.value;
  const pesoDesde = pesoDesdeRaw !== '' && pesoDesdeRaw !== null ? parseFloat(pesoDesdeRaw) : null;
  const pesoHasta = pesoHastaRaw !== '' && pesoHastaRaw !== null ? parseFloat(pesoHastaRaw) : null;

  return mascotas.filter((m) => {
    if (busqueda) {
      const nombre = limpiarTexto(m.nombre_mascota);
      const especie = limpiarTexto(m.especie);
      const raza = limpiarTexto(m.raza);
      const observaciones = limpiarTexto(m.observaciones);
      const dni = String(m.dni || '').toLowerCase();
      const coincide = nombre.includes(busqueda) || especie.includes(busqueda) || raza.includes(busqueda) || observaciones.includes(busqueda) || dni.includes(busqueda);
      if (!coincide) return false;
    }
    if (estadoFiltro && m.estado_mascota !== estadoFiltro) return false;
    const pesoM = parseFloat(m.peso);
    if (pesoDesde !== null && !isNaN(pesoDesde)) { if (isNaN(pesoM) || pesoM < pesoDesde) return false; }
    if (pesoHasta !== null && !isNaN(pesoHasta)) { if (isNaN(pesoM) || pesoM > pesoHasta) return false; }
    return true;
  });
}

function aplicarFiltros() {
  const filtradas = obtenerMascotasFiltradas();
  renderMascotas(filtradas);
  actualizarContador(filtradas.length, mascotas.length);
}

function actualizarContador(mostrando, total) {
  if (!contadorResultados) return;
  if (total === 0) { contadorResultados.innerHTML = ''; return; }
  const palabra = total === 1 ? 'mascota' : 'mascotas';
  if (mostrando === total) {
    contadorResultados.innerHTML = `Mostrando <strong>${total}</strong> ${palabra}`;
  } else {
    contadorResultados.innerHTML = `Mostrando <strong>${mostrando}</strong> de <strong>${total}</strong> ${palabra}`;
  }
}

function limpiarFiltros() {
  if (inputBuscador) inputBuscador.value = '';
  if (filtroEstado) filtroEstado.value = '';
  if (filtroPesoDesde) filtroPesoDesde.value = '';
  if (filtroPesoHasta) filtroPesoHasta.value = '';
  aplicarFiltros();
}

async function filtrarMascota(texto) {
  if (typeof texto === 'string' && inputBuscador) inputBuscador.value = texto;
  aplicarFiltros();
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

function mostrarEditar(mascota = null) {
  if (vistaLista) vistaLista.style.display = 'none';
  const toolbar = document.querySelector('.toolbar-filtros');
  const pageHeader = document.querySelector('.page-header');
  if (toolbar) toolbar.style.display = 'none';
  if (pageHeader) pageHeader.style.display = 'none';
  if (vistaEditar) vistaEditar.style.display = 'block';

  if (formMascota) formMascota.reset();
  const mascotaIdInput = document.getElementById('mascotaId');
  if (mascotaIdInput) mascotaIdInput.value = '';
  idMascotaEditando = null;

  if (mascota) {
    tituloFormulario.textContent = 'Modificación de Mascota';
    subtituloFormulario.textContent = 'Actualizar datos de la mascota';
    btnConfirmarTexto.textContent = 'Actualizar';
    document.getElementById('mascotaId').value = mascota.id_mascota;
    document.getElementById('nombre').value = mascota.nombre_mascota || '';
    document.getElementById('especie').value = mascota.especie || '';
    document.getElementById('raza').value = mascota.raza || '';
    const sexoRadio = document.querySelector(`input[name="sexo"][value="${mascota.sexo}"]`);
    if (sexoRadio) sexoRadio.checked = true;
    document.getElementById('fechaNacimiento').value = mascota.fecha_nacimiento || '';
    document.getElementById('peso').value = mascota.peso || '';
    document.getElementById('color').value = mascota.color || '';
    document.getElementById('dniCliente').value = mascota.dni || '';
    document.getElementById('observaciones').value = mascota.observaciones || '';
    idMascotaEditando = mascota.id_mascota;
  } else {
    tituloFormulario.textContent = 'Alta Mascota';
    subtituloFormulario.textContent = 'Registrar una nueva mascota';
    btnConfirmarTexto.textContent = 'Confirmar';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ============================================
// VALIDACIONES
// ============================================
function validarFormulario(datos) {
  if (!datos.nombre_mascota.trim()) { alert('El nombre es obligatorio'); return false; }
  if (!datos.especie) { alert('La especie es obligatoria'); return false; }
  if (!datos.sexo) { alert('El sexo es obligatorio'); return false; }
  if (!datos.fecha_nacimiento) { alert('La fecha de nacimiento es obligatoria'); return false; }
  if (!datos.dni.trim()) { alert('El DNI del dueño es obligatorio'); return false; }
  if (!validarFechaNacimiento(datos.fecha_nacimiento)) { alert('La fecha no puede ser futura'); return false; }
  if (!validarDni(datos.dni.trim())) { alert('El DNI debe tener 7 u 8 dígitos'); return false; }
  if (datos.peso && parseFloat(datos.peso) < 0) { alert('El peso debe ser positivo'); return false; }
  return true;
}

// ============================================
// EVENTOS
// ============================================
if (inputBuscador) inputBuscador.addEventListener('input', aplicarFiltros);
if (filtroEstado) filtroEstado.addEventListener('change', aplicarFiltros);
if (filtroPesoDesde) filtroPesoDesde.addEventListener('input', aplicarFiltros);
if (filtroPesoHasta) filtroPesoHasta.addEventListener('input', aplicarFiltros);
if (btnLimpiarFiltros) btnLimpiarFiltros.addEventListener('click', limpiarFiltros);

if (btnAltaMascota) btnAltaMascota.addEventListener('click', () => mostrarEditar(null));
if (btnVolver) btnVolver.addEventListener('click', mostrarLista);

// Copy DNI
document.addEventListener('click', async (e) => {
  const copyBtn = e.target.closest('.btn-copy-dni');
  if (copyBtn) {
    e.stopPropagation();
    const dni = copyBtn.getAttribute('data-dni');
    try { await navigator.clipboard.writeText(dni); } catch {
      const ta = document.createElement('textarea');
      ta.value = dni; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = '<i data-lucide="check" class="copy-icon"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = '<i data-lucide="copy" class="copy-icon"></i>';
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

// Editar
document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.dropdown-item.edit');
  if (!editBtn) return;
  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  const id = parseInt(editBtn.getAttribute('data-id'));
  const mascota = mascotas.find((m) => m.id_mascota === id);
  if (mascota) mostrarEditar(mascota);
});

// Confirm modal
let idPendienteEliminar = null;
function abrirConfirmEliminar(id, nombre) {
  idPendienteEliminar = id;
  if (confirmText) confirmText.textContent = `¿Seguro que querés eliminar a "${nombre}"?`;
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
  const nombre = deleteBtn.getAttribute('data-nombre') || 'esta mascota';
  abrirConfirmEliminar(id, nombre);
});
if (confirmCancel) confirmCancel.addEventListener('click', cerrarConfirmEliminar);
if (confirmOverlay) confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) cerrarConfirmEliminar(); });
if (confirmDelete) confirmDelete.addEventListener('click', async () => {
  if (!idPendienteEliminar) return;
  confirmDelete.disabled = true;
  confirmDelete.textContent = 'Eliminando...';
  const ok = await eliminarMascotaEnSupabase(idPendienteEliminar);
  confirmDelete.disabled = false;
  confirmDelete.textContent = 'Eliminar';
  if (ok) cerrarConfirmEliminar();
});

// Submit
if (formMascota) {
  formMascota.addEventListener('submit', async (e) => {
    e.preventDefault();
    const datos = {
      id_mascota: idMascotaEditando || null,
      nombre_mascota: document.getElementById('nombre').value.trim(),
      especie: document.getElementById('especie').value,
      raza: document.getElementById('raza').value.trim(),
      sexo: document.querySelector('input[name="sexo"]:checked')?.value || '',
      fecha_nacimiento: document.getElementById('fechaNacimiento').value,
      color: document.getElementById('color').value.trim(),
      peso: document.getElementById('peso').value.trim(),
      observaciones: document.getElementById('observaciones').value.trim(),
      dni: document.getElementById('dniCliente').value.trim(),
      estado_mascota: idMascotaEditando
        ? (mascotas.find(x => x.id_mascota == idMascotaEditando)?.estado_mascota || 'Activo')
        : 'Activo'
    };
    if (!validarFormulario(datos)) return;

    try {
      const { data: clienteExiste, error: clienteError } = await supabase
        .from('clientes').select('dni').eq('dni', datos.dni).single();
      if (clienteError || !clienteExiste) {
        alert('El DNI del dueño no existe. Registrá primero al cliente.');
        return;
      }
    } catch (err) { alert('Error al verificar DNI: ' + err.message); return; }

    const btn = formMascota.querySelector('.btn-confirmar');
    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = 'Guardando...'; }
    const ok = await guardarMascotaEnSupabase(datos);
    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    if (ok) { mostrarLista(); idMascotaEditando = null; }
  });
}

// Init
protegerRuta();
cargarMascotasDesdeSupabase();

// Query params
function aplicarQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const dniParam = params.get('dni');
  if (dniParam && inputBuscador) { inputBuscador.value = dniParam; aplicarFiltros(); }
  if (params.get('accion') === 'alta') setTimeout(() => mostrarEditar(null), 150);
}
setTimeout(aplicarQueryParams, 200);

// Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });