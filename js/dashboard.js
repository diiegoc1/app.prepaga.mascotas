import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion } from "./compartido/sesion.js";

// ==========================================
// REGISTRAR PLUGIN DE DATALABELS
// ==========================================
if (typeof ChartDataLabels !== 'undefined') {
  Chart.register(ChartDataLabels);
}

// ==========================================
// ESTADO
// ==========================================
let mixedChartInstance = null;
let donutChartInstance = null;
let searchDebounceTimer = null;
let cacheClientes = null;
let rangoActual = 'semanal';
let cacheMascotasParaDonut = null;
let cacheClientesParaGraficos = null;
let cacheMascotasParaGraficos = null;

// DOM
const userNameDisplay = document.getElementById('userNameDisplay');
const currentDateText = document.getElementById('currentDateText');
const currentTimeText = document.getElementById('currentTimeText');
const searchClientInput = document.getElementById('searchClientInput');
const searchResults = document.getElementById('searchResults');
const searchBoxWrapper = document.getElementById('searchBoxWrapper');
const totalAfiliadosCount = document.getElementById('totalAfiliadosCount');
const totalMascotasCount = document.getElementById('totalMascotasCount');
const logoutBtn = document.getElementById('logoutBtn');
const vencimientosList = document.getElementById('vencimientosList');
const vencimientosResumen = document.getElementById('vencimientosResumen');
const cardVencimientos = document.getElementById('cardVencimientos');
const analyticsTabs = document.getElementById('analyticsTabs');

// ==========================================
// FECHA / HORA
// ==========================================
function obtenerNombre() {
  const cache = JSON.parse(sessionStorage.getItem("perfil") || "null");
  if (cache && cache.nombre && userNameDisplay) {
    userNameDisplay.textContent = cache.nombre;
  } else if (userNameDisplay) {
    userNameDisplay.textContent = 'Usuario';
  }
}

function actualizarRelojYFecha() {
  const ahora = new Date();
  const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
  let fechaFormateada = ahora.toLocaleDateString('es-ES', opcionesFecha);
  fechaFormateada = fechaFormateada.charAt(0).toUpperCase() + fechaFormateada.slice(1);
  const opcionesHora = { hour: '2-digit', minute: '2-digit', hour12: true };
  const horaFormateada = ahora.toLocaleTimeString('es-ES', opcionesHora).toUpperCase();
  if (currentDateText) currentDateText.textContent = fechaFormateada;
  if (currentTimeText) currentTimeText.textContent = horaFormateada;
}

// ==========================================
// MÉTRICAS
// ==========================================
async function cargarMétricas() {
  try {
    const [
      { count: countClientes, error: errClientes },
      { count: countMascotas, error: errMascotas }
    ] = await Promise.all([
      supabase.from('clientes').select('*', { count: 'exact', head: true }),
      supabase.from('mascotas').select('*', { count: 'exact', head: true })
    ]);

    if (!errClientes && countClientes !== null && totalAfiliadosCount) {
      totalAfiliadosCount.textContent = countClientes;
    }
    if (!errMascotas && countMascotas !== null && totalMascotasCount) {
      totalMascotasCount.textContent = countMascotas;
    }
  } catch (err) {
    console.error('Error al cargar métricas:', err);
  }
}

// ==========================================
// PRÓXIMOS VENCIMIENTOS
// ==========================================
function formatearFecha(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  return d.toLocaleDateString('es-AR');
}

async function cargarProximosVencimientos() {
  if (!vencimientosList || !vencimientosResumen) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const en7Dias = new Date(hoy);
  en7Dias.setDate(en7Dias.getDate() + 7);

  const hoyStr = hoy.toISOString().split('T')[0];
  const en7DiasStr = en7Dias.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('contratos')
    .select(`
      id_contrato, fecha_fin, nombre_plan,
      mascotas ( nombre_mascota ),
      clientes ( nombre, apellido )
    `)
    .eq('estado_contrato', 'Activo')
    .gte('fecha_fin', hoyStr)
    .lte('fecha_fin', en7DiasStr)
    .order('fecha_fin', { ascending: true });

  if (error) {
    console.error('Error cargando próximos vencimientos:', error);
    return;
  }

  const lista = (data || []).map((c) => ({
    id_contrato: c.id_contrato,
    fecha_fin: c.fecha_fin,
    nombre_plan: c.nombre_plan,
    mascota: c.mascotas?.nombre_mascota || '',
    cliente: `${c.clientes?.nombre || ''} ${c.clientes?.apellido || ''}`.trim(),
  }));

  if (lista.length === 0) {
    vencimientosResumen.textContent = 'Sin vencimientos en los próximos 7 días';
    vencimientosList.innerHTML = `<div class="vencimiento-empty">No hay vencimientos próximos</div>`;
    vencimientosList.classList.remove('hidden');
    return;
  }

  vencimientosResumen.textContent = `${lista.length} ${lista.length === 1 ? 'contrato vence' : 'contratos vencen'} en los próximos 7 días`;

  const visibles = lista.slice(0, 3);
  vencimientosList.innerHTML = visibles.map((v) => {
    const dias = Math.ceil((new Date(v.fecha_fin + 'T00:00:00') - hoy) / (1000 * 60 * 60 * 24));
    const urgente = dias <= 2 ? 'urgente' : '';
    return `
      <div class="vencimiento-item">
        <div class="vencimiento-item-info">
          <strong>${v.mascota} · ${v.nombre_plan}</strong>
          <small>${v.cliente} · ${formatearFecha(v.fecha_fin)}</small>
        </div>
        <span class="vencimiento-dias ${urgente}">${dias} d.</span>
      </div>
    `;
  }).join('');

  if (lista.length > 3) {
    vencimientosList.innerHTML += `<div class="vencimiento-empty">+ ${lista.length - 3} más...</div>`;
  }

  vencimientosList.classList.remove('hidden');
}

// ==========================================
// GRÁFICOS - CÁLCULO DE DATOS
// ==========================================
function restarDias(fecha, dias) {
  const d = new Date(fecha);
  d.setDate(d.getDate() - dias);
  return d;
}

function diaISO(fecha) {
  const d = new Date(fecha);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

function contarEnRango(items, campo, desde, hasta) {
  const desdeStr = diaISO(desde);
  const hastaStr = diaISO(hasta);
  return items.filter((it) => {
    const f = it[campo];
    if (!f) return false;
    const fStr = String(f).substring(0, 10);
    return fStr >= desdeStr && fStr <= hastaStr;
  }).length;
}

function calcularSemanal(clientes, mascotas) {
  const labels = [];
  const clientesData = [];
  const mascotasData = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const dia = restarDias(hoy, i);
    const diaFin = new Date(dia);
    diaFin.setHours(23, 59, 59, 999);
    labels.push(diasSemana[dia.getDay()]);
    clientesData.push(contarEnRango(clientes, 'fecha_alta', dia, diaFin));
    mascotasData.push(contarEnRango(mascotas, 'fecha_registro', dia, diaFin));
  }
  return { labels, clientes: clientesData, mascotas: mascotasData };
}

function calcularMensual(clientes, mascotas) {
  const labels = [];
  const clientesData = [];
  const mascotasData = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  for (let i = 3; i >= 0; i--) {
    const fin = restarDias(hoy, i * 7);
    const inicio = restarDias(fin, 6);
    const inicioAjustado = new Date(inicio);
    inicioAjustado.setHours(0, 0, 0, 0);
    const finAjustado = new Date(fin);
    finAjustado.setHours(23, 59, 59, 999);
    const etiqueta = i === 0 ? 'Actual' : `Sem -${i}`;
    labels.push(etiqueta);
    clientesData.push(contarEnRango(clientes, 'fecha_alta', inicioAjustado, finAjustado));
    mascotasData.push(contarEnRango(mascotas, 'fecha_registro', inicioAjustado, finAjustado));
  }
  return { labels, clientes: clientesData, mascotas: mascotasData };
}

function calcularAnual(clientes, mascotas) {
  const labels = [];
  const clientesData = [];
  const mascotasData = [];
  const mesesNombre = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoy = new Date();

  for (let i = 11; i >= 0; i--) {
    const mesInicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1, 0, 0, 0, 0);
    const mesFin = new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0, 23, 59, 59, 999);
    labels.push(mesesNombre[mesInicio.getMonth()]);
    clientesData.push(contarEnRango(clientes, 'fecha_alta', mesInicio, mesFin));
    mascotasData.push(contarEnRango(mascotas, 'fecha_registro', mesInicio, mesFin));
  }
  return { labels, clientes: clientesData, mascotas: mascotasData };
}

async function cargarDatosParaGraficos() {
  if (!cacheClientesParaGraficos) {
    const { data: clientes } = await supabase.from('clientes').select('fecha_alta');
    cacheClientesParaGraficos = clientes || [];
  }
  if (!cacheMascotasParaGraficos) {
    const { data: mascotas } = await supabase.from('mascotas').select('fecha_registro');
    cacheMascotasParaGraficos = mascotas || [];
  }
  return {
    clientes: cacheClientesParaGraficos,
    mascotas: cacheMascotasParaGraficos,
  };
}

// ==========================================
// GRÁFICOS - RENDER
// ==========================================
async function renderBarChart(rango) {
  const ctxMixed = document.getElementById('mixedChart');
  if (!ctxMixed) return;

  const { clientes, mascotas } = await cargarDatosParaGraficos();
  let datos;
  if (rango === 'semanal') datos = calcularSemanal(clientes, mascotas);
  else if (rango === 'mensual') datos = calcularMensual(clientes, mascotas);
  else datos = calcularAnual(clientes, mascotas);

  if (mixedChartInstance) mixedChartInstance.destroy();

  mixedChartInstance = new Chart(ctxMixed, {
    type: 'bar',
    data: {
      labels: datos.labels,
      datasets: [
        {
          label: 'Clientes',
          data: datos.clientes,
          backgroundColor: '#5b3fd6',
          borderRadius: 6,
        },
        {
          label: 'Mascotas',
          data: datos.mascotas,
          backgroundColor: '#bb73eb',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            boxWidth: 10,
            font: { size: 10 },
            usePointStyle: true,
            padding: 12,
          },
        },
        tooltip: {
          backgroundColor: '#241b45',
          padding: 10,
          titleFont: { size: 12 },
          bodyFont: { size: 12 },
        },
        // Sin datalabels en el bar chart
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          grid: { color: '#e4e1ee' },
          ticks: { precision: 0, font: { size: 10 } },
        },
      },
    },
  });
}

async function renderDonutChart() {
  const ctxDonut = document.getElementById('donutChart');
  if (!ctxDonut) return;

  if (!cacheMascotasParaDonut) {
    const { data } = await supabase.from('mascotas').select('especie');
    cacheMascotasParaDonut = data || [];
  }

  const conteo = {};
  cacheMascotasParaDonut.forEach((m) => {
    const esp = m.especie || 'Otro';
    conteo[esp] = (conteo[esp] || 0) + 1;
  });

  const entries = Object.entries(conteo).sort((a, b) => b[1] - a[1]);
  let labels = [];
  let data = [];

  if (entries.length === 0) {
    labels = ['Sin datos'];
    data = [0];
  } else if (entries.length <= 5) {
    labels = entries.map((e) => e[0]);
    data = entries.map((e) => e[1]);
  } else {
    const top = entries.slice(0, 4);
    const otros = entries.slice(4).reduce((sum, e) => sum + e[1], 0);
    labels = [...top.map((e) => e[0]), 'Otros'];
    data = [...top.map((e) => e[1]), otros];
  }

  const coloresBase = ['#3d2a7d', '#6c4ee3', '#bb73eb', '#d9b8f5', '#e4e1ee'];

  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(ctxDonut, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: coloresBase.slice(0, labels.length),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            font: { size: 10 },
            usePointStyle: true,
            padding: 8,
          },
        },
        tooltip: {
          backgroundColor: '#241b45',
          padding: 10,
        },
        // ✅ Números planos dentro del donut
        datalabels: {
          color: '#ffffff',
          font: {
            size: 12,
            weight: 'bold',
          },
          // Ocultar si el valor es 0
          display: (context) => context.dataset.data[context.dataIndex] > 0,
          anchor: 'center',
          align: 'center',
          formatter: (value) => value,
        },
      },
      cutout: '65%',
    },
  });
}

// ==========================================
// TABS
// ==========================================
function configurarTabs() {
  if (!analyticsTabs) return;
  analyticsTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    const rango = btn.dataset.rango;
    if (!rango || rango === rangoActual) return;

    analyticsTabs.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    rangoActual = rango;
    renderBarChart(rango);
  });
}

// ==========================================
// BUSCADOR DE CLIENTES
// ==========================================
function escaparHTML(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function cargarCacheClientes() {
  if (cacheClientes) return cacheClientes;
  const { data, error } = await supabase.from('clientes').select('dni, nombre, apellido, estado_cliente');
  if (error) { console.error('Error cargando clientes:', error); cacheClientes = []; return cacheClientes; }
  cacheClientes = data || [];
  return cacheClientes;
}

function mostrarLoading() {
  if (!searchResults) return;
  searchResults.classList.remove('hidden');
  searchResults.innerHTML = `<div class="search-loading"><div class="search-loading-spinner"></div><span>Buscando...</span></div>`;
}

function mostrarNoEncontrado(query) {
  if (!searchResults) return;
  searchResults.classList.remove('hidden');
  searchResults.innerHTML = `
    <div class="search-no-result">
      <div class="search-no-result-header">
        <div class="search-result-icon warning"><i data-lucide="alert-circle"></i></div>
        <div class="search-no-result-text">No se encontró ningún cliente<br>con <strong>"${escaparHTML(query)}"</strong></div>
      </div>
      <a href="cliente.html?accion=alta" class="search-no-result-link">
        <i data-lucide="user-plus"></i> Registrar nuevo cliente
      </a>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ocultarResultados() {
  if (!searchResults) return;
  searchResults.classList.add('hidden');
  searchResults.innerHTML = '';
}

async function buscarClientes(query) {
  const q = query.trim();
  if (q.length < 2) { ocultarResultados(); return; }
  mostrarLoading();
  try {
    const clientes = await cargarCacheClientes();
    const busqueda = normalizar(q);
    const resultados = clientes.filter((c) => {
      const nombre = normalizar(c.nombre);
      const apellido = normalizar(c.apellido);
      const dni = String(c.dni || '').toLowerCase();
      const nombreCompleto = `${nombre} ${apellido}`.trim();
      return nombre.includes(busqueda) || apellido.includes(busqueda) || nombreCompleto.includes(busqueda) || dni.includes(busqueda);
    });
    if (resultados.length === 0) { mostrarNoEncontrado(q); return; }
    const visibles = resultados.slice(0, 6);
    searchResults.classList.remove('hidden');
    searchResults.innerHTML = visibles.map((c, i) => `
      ${i > 0 ? '<div class="search-result-divider"></div>' : ''}
      <div class="search-result-item" data-dni="${escaparHTML(c.dni)}">
        <div class="search-result-icon success"><i data-lucide="${i === 0 ? 'check' : 'user'}"></i></div>
        <div class="search-result-info">
          <strong>${escaparHTML(c.nombre)} ${escaparHTML(c.apellido)}
            <span class="badge-mini ${c.estado_cliente === 'Activo' ? 'activo' : 'inactivo'}">${escaparHTML(c.estado_cliente || 'Activo')}</span>
          </strong>
          <small>DNI ${escaparHTML(c.dni)}</small>
        </div>
      </div>`).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch (err) {
    console.error('Error buscando clientes:', err);
    ocultarResultados();
  }
}

function configurarBuscadorClientes() {
  if (!searchClientInput) return;
  searchClientInput.addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    const valor = e.target.value;
    searchDebounceTimer = setTimeout(() => buscarClientes(valor), 300);
  });
  if (searchResults) {
    searchResults.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        const dni = item.getAttribute('data-dni');
        window.location.href = `cliente.html?dni=${encodeURIComponent(dni)}`;
      }
    });
  }
  document.addEventListener('click', (e) => {
    if (searchBoxWrapper && !searchBoxWrapper.contains(e.target)) ocultarResultados();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ocultarResultados(); if (searchClientInput) searchClientInput.blur(); }
  });
}

// ==========================================
// TARJETAS
// ==========================================
function configurarTarjetasAccion() {
  const cards = document.querySelectorAll('.action-card, .hero-card');
  cards.forEach(card => {
    if (card.id === 'cardVencimientos') return;
    const titulo = card.querySelector('h4, h3')?.textContent.trim();
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      switch (titulo) {
        case 'Alta Afiliado': window.location.href = 'cliente.html?accion=alta'; break;
        case 'Resumen de cuentas': window.location.href = 'historial.html'; break;
        case 'Registrar Pagos': break;
        case 'Alta mascota': window.location.href = 'mascotas.html?accion=alta'; break;
      }
    });
  });

  if (cardVencimientos) {
    cardVencimientos.style.cursor = 'pointer';
    cardVencimientos.addEventListener('click', () => {
      window.location.href = 'contratos.html?filtro=proximos';
    });
  }
}

// ==========================================
// LOGOUT
// ==========================================
function configurarLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => { e.preventDefault(); cerrarSesion(); });
  }
}

// ==========================================
// INIT
// ==========================================
(async () => {
  if (!(await protegerRuta())) return;

  actualizarRelojYFecha();
  setInterval(actualizarRelojYFecha, 1000 * 60);

  configurarBuscadorClientes();
  configurarTarjetasAccion();
  configurarLogout();
  configurarTabs();

  await cargarCacheClientes();
  await cargarMétricas();
  await cargarProximosVencimientos();

  await renderBarChart(rangoActual);
  await renderDonutChart();

  obtenerNombre();

  if (window.lucide) lucide.createIcons();
})();