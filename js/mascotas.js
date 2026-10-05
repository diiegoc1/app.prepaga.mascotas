// ============================================
// VARIABLES GLOBALES
// ============================================
let mascotas = [];
let idMascotaEditando = null;

// Elementos DOM
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

// ============================================
// FUNCIONES DE UTILIDAD
// ============================================
function limpiarTexto(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
  const d = new Date(fecha);
  return d.toLocaleDateString('es-AR');
}

function calcularEdad(fechaNac) {
  if (!fechaNac) return '';
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const mes = hoy.getMonth() - nac.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < nac.getDate())) {
    edad--;
  }
  return edad;
}

// ============================================
// SUPABASE: CRUD
// ============================================
async function cargarMascotasDesdeSupabase() {
  if (!window.supabaseClient) {
    console.warn('Supabase no cargado');
    return;
  }

  const { data, error } = await window.supabaseClient
    .from('mascotas')
    .select('*');

  if (error) {
    console.error('Error Supabase select mascotas:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('Supabase: tabla mascotas vacía');
    mascotas = [];
    renderMascotas([]);
    return;
  }

  mascotas = data.map((m) => ({
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

  console.log(`Supabase: ${mascotas.length} mascotas cargadas`);
  filtrarMascota(inputBuscador ? inputBuscador.value : '');
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
    const { error } = await window.supabaseClient
      .from('mascotas')
      .update(payload)
      .eq('id_mascota', datos.id_mascota);

    if (error) {
      console.error('Error update mascota:', error.message);
      alert('No se pudo actualizar: ' + error.message);
      return false;
    }
  } else {
    payload.fecha_registro = new Date().toISOString();
    const { error } = await window.supabaseClient
      .from('mascotas')
      .insert([payload]);

    if (error) {
      console.error('Error insert mascota:', error.message);
      alert('No se pudo crear la mascota: ' + error.message);
      return false;
    }
  }

  await cargarMascotasDesdeSupabase();
  return true;
}

async function eliminarMascotaEnSupabase(id) {
  const { error } = await window.supabaseClient
    .from('mascotas')
    .delete()
    .eq('id_mascota', id);

  if (error) {
    console.error('Error delete mascota:', error.message);
    alert('No se pudo eliminar: ' + error.message);
    return false;
  }

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
    tbody.innerHTML = `
      <tr>
        <td colspan="12" style="padding: 40px; text-align: center; color: var(--gray-500);">
          No hay mascotas registradas
        </td>
      </tr>
    `;
    return;
  }

  lista.forEach((m) => {
    const badgeClass = m.estado_mascota === 'Activo' ? 'activo' : 'inactivo';
    const edad = calcularEdad(m.fecha_nacimiento);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${m.id_mascota || ''}</td>
      <td>${m.nombre_mascota || ''}</td>
      <td>${m.especie || ''}</td>
      <td>${m.raza || ''}</td>
      <td>${m.sexo || ''}</td>
      <td>${formatearFecha(m.fecha_nacimiento)}</td>
      <td>${m.color || ''}</td>
      <td>${m.peso ? m.peso + ' kg' : ''}</td>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${m.observaciones || ''}
      </td>
      <td>${m.dni || ''}</td>
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
            <button class="dropdown-item edit" data-rol="admin,recepcionista" data-id="${m.id_mascota}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Editar
            </button>
            <button class="dropdown-item danger" data-rol="admin,recepcionista" data-id="${m.id_mascota}" data-nombre="${m.nombre_mascota}">
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
  reaplicarPermisos();
}

// ============================================
// FILTRAR
// ============================================
async function filtrarMascota(texto) {
  if (!texto || texto.trim() === '') {
    renderMascotas(mascotas);
    return;
  }

  const busqueda = limpiarTexto(texto.trim());
  const filtradas = mascotas.filter((m) => {
    const nombre = limpiarTexto(m.nombre_mascota || '');
    const especie = limpiarTexto(m.especie || '');
   
    return (
      nombre.includes(busqueda) ||
      especie.includes(busqueda) 
    );
  });

  renderMascotas(filtradas);
}

// ============================================
// MOSTRAR/OCULTAR VISTAS
// ============================================
function mostrarLista() {
  if (vistaEditar) vistaEditar.style.display = 'none';
  if (vistaLista) vistaLista.style.display = 'block';
  
  const toolbar = document.querySelector('.toolbar');
  const pageHeader = document.querySelector('.page-header');
  
  if (toolbar) toolbar.style.display = 'flex';
  if (pageHeader) pageHeader.style.display = 'flex';
  
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function mostrarEditar(mascota = null) {
  if (vistaLista) vistaLista.style.display = 'none';
  
  const toolbar = document.querySelector('.toolbar');
  const pageHeader = document.querySelector('.page-header');
  
  if (toolbar) toolbar.style.display = 'none';
  if (pageHeader) pageHeader.style.display = 'none';
  if (vistaEditar) vistaEditar.style.display = 'block';

  if (formMascota) formMascota.reset();
  const mascotaIdInput = document.getElementById('mascotaId');
  if (mascotaIdInput) mascotaIdInput.value = '';
  idMascotaEditando = null;

  if (mascota) {
    if (tituloFormulario) tituloFormulario.textContent = 'Modificación de Mascota';
    if (subtituloFormulario) subtituloFormulario.textContent = 'Actualizar datos de la mascota';
    if (btnConfirmarTexto) btnConfirmarTexto.textContent = 'Actualizar';

    const idInput = document.getElementById('mascotaId');
    if (idInput) idInput.value = mascota.id_mascota;
    
    const nombreInput = document.getElementById('nombre');
    if (nombreInput) nombreInput.value = mascota.nombre_mascota || '';
    
    const especieSelect = document.getElementById('especie');
    if (especieSelect) especieSelect.value = mascota.especie || '';
    
    const razaInput = document.getElementById('raza');
    if (razaInput) razaInput.value = mascota.raza || '';
    
    // ✅ CORREGIDO - Línea 290
    const sexoRadio = document.querySelector(`input[name="sexo"][value="${mascota.sexo}"]`);
    if (sexoRadio) {
      sexoRadio.checked = true;
    }
    
    const fechaInput = document.getElementById('fechaNacimiento');
    if (fechaInput) fechaInput.value = mascota.fecha_nacimiento || '';
    
    const pesoInput = document.getElementById('peso');
    if (pesoInput) pesoInput.value = mascota.peso || '';
    
    const colorInput = document.getElementById('color');
    if (colorInput) colorInput.value = mascota.color || '';
    
    const dniInput = document.getElementById('dniCliente');
    if (dniInput) dniInput.value = mascota.dni || '';
    
    const obsInput = document.getElementById('observaciones');
    if (obsInput) obsInput.value = mascota.observaciones || '';

    idMascotaEditando = mascota.id_mascota;
  } else {
    if (tituloFormulario) tituloFormulario.textContent = 'Alta Mascota';
    if (subtituloFormulario) subtituloFormulario.textContent = 'Registrar una nueva mascota';
    if (btnConfirmarTexto) btnConfirmarTexto.textContent = 'Confirmar';
  }

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// ============================================
// VALIDACIONES DEL FORMULARIO
// ============================================
function validarFormulario(datos) {
  if (!datos.nombre_mascota.trim()) {
    alert('El nombre de la mascota es obligatorio');
    return false;
  }
  if (!datos.especie) {
    alert('La especie es obligatoria');
    return false;
  }
  if (!datos.sexo) {
    alert('El sexo es obligatorio');
    return false;
  }
  if (!datos.fecha_nacimiento) {
    alert('La fecha de nacimiento es obligatoria');
    return false;
  }
  if (!datos.dni.trim()) {
    alert('El DNI del dueño es obligatorio');
    return false;
  }

  if (!validarFechaNacimiento(datos.fecha_nacimiento)) {
    alert('La fecha de nacimiento no puede ser futura');
    return false;
  }

  if (!validarDni(datos.dni.trim())) {
    alert('El DNI debe tener 7 u 8 dígitos numéricos');
    return false;
  }

  if (datos.peso && parseFloat(datos.peso) < 0) {
    alert('El peso debe ser un número positivo');
    return false;
  }

  return true;
}

// ============================================
// EVENTOS
// ============================================

if (inputBuscador) {
  inputBuscador.addEventListener('input', (e) => {
    filtrarMascota(e.target.value);
  });
}

if (btnAltaMascota) {
  btnAltaMascota.addEventListener('click', () => {
    mostrarEditar(null);
  });
}

if (btnVolver) {
  btnVolver.addEventListener('click', mostrarLista);
}

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

  if (spaceBelow < needed + 8) {
    menu.classList.add('dropup');
  } else {
    menu.classList.remove('dropup');
  }

  const isOpen = menu.classList.contains('open');
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  if (!isOpen) menu.classList.add('open');
});

document.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.dropdown-item.edit');
  if (!editBtn) return;

  e.stopPropagation();
  document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));

  const id = parseInt(editBtn.getAttribute('data-id'));
  const mascota = mascotas.find((m) => m.id_mascota === id);
  if (mascota) {
    mostrarEditar(mascota);
  }
});

// ============================================
// CONFIRM MODAL ELIMINAR
// ============================================
let idPendienteEliminar = null;

function abrirConfirmEliminar(id, nombre) {
  idPendienteEliminar = id;
  if (confirmText) confirmText.textContent = `¿Seguro que querés eliminar a "${nombre}"? Esta acción no se puede deshacer.`;
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

if (confirmCancel) {
  confirmCancel.addEventListener('click', cerrarConfirmEliminar);
}

if (confirmOverlay) {
  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) cerrarConfirmEliminar();
  });
}

if (confirmDelete) {
  confirmDelete.addEventListener('click', async () => {
    if (!idPendienteEliminar) return;

    confirmDelete.disabled = true;
    confirmDelete.textContent = 'Eliminando...';

    const ok = await eliminarMascotaEnSupabase(idPendienteEliminar);

    confirmDelete.disabled = false;
    confirmDelete.textContent = 'Eliminar';

    if (ok) cerrarConfirmEliminar();
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmOverlay && !confirmOverlay.classList.contains('hidden')) {
    cerrarConfirmEliminar();
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.dropdown-menu.open').forEach((m) => m.classList.remove('open'));
  }
});

// ============================================
// SUBMIT FORMULARIO
// ============================================
if (formMascota) {
  formMascota.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = {
      id_mascota: idMascotaEditando || null,
      nombre_mascota: document.getElementById('nombre') ? document.getElementById('nombre').value.trim() : '',
      especie: document.getElementById('especie') ? document.getElementById('especie').value : '',
      raza: document.getElementById('raza') ? document.getElementById('raza').value.trim() : '',
      sexo: document.querySelector('input[name="sexo"]:checked')?.value || '',
      fecha_nacimiento: document.getElementById('fechaNacimiento') ? document.getElementById('fechaNacimiento').value : '',
      color: document.getElementById('color') ? document.getElementById('color').value.trim() : '',
      peso: document.getElementById('peso') ? document.getElementById('peso').value.trim() : '',
      observaciones: document.getElementById('observaciones') ? document.getElementById('observaciones').value.trim() : '',
      dni: document.getElementById('dniCliente') ? document.getElementById('dniCliente').value.trim() : '',
      estado_mascota: 'Activo'
    };

    if (!validarFormulario(datos)) return;

    // Verificar que el DNI del dueño exista en la tabla clientes
    try {
      const { data: clienteExiste, error: clienteError } = await window.supabaseClient
        .from('clientes')
        .select('dni')
        .eq('dni', datos.dni)
        .single();

      if (clienteError || !clienteExiste) {
        alert('El DNI del dueño no existe en el sistema. Por favor, registre primero al cliente.');
        return;
      }
    } catch (err) {
      alert('Error al verificar el DNI del dueño: ' + err.message);
      return;
    }

    const btn = formMascota.querySelector('.btn-confirmar');
    const textoOriginal = btn ? btn.innerHTML : 'Guardando...';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'Guardando...';
    }

    const ok = await guardarMascotaEnSupabase(datos);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
    
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    if (ok) {
      mostrarLista();
      idMascotaEditando = null;
    }
  });
}

// ============================================
// INICIALIZAR
// ============================================
protegerRuta();
cargarMascotasDesdeSupabase();

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