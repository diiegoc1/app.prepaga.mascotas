import { supabase } from "./compartido/supabaseClient.js";
import { protegerRuta, cerrarSesion, reaplicarPermisos } from "./compartido/sesion.js";

let clientes = [];

// ==========================================
// SUPABASE: SELECT
// ==========================================
async function cargarClientesDesdeSupabase() {
  if (!supabase) {
    console.warn("Supabase no cargado");
    return;
  }
  const { data, error } = await supabase.from("clientes").select("*");
  if (error) {
    console.error("Error Supabase select clientes:", error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log("Supabase: tabla clientes vacía");
    clientes = [];
    renderClientes([]);
    return;
  }
  clientes = data.map((r) => [
    String(r.dni ?? ""),
    r.nombre ?? "",
    r.apellido ?? "",
    r.direccion ?? "",
    String(r.telefono ?? ""),
    r.mail_cliente ?? r.email ?? r.mail ?? "",
    r.estado_cliente ?? r.estado ?? "Activo",
    r.fecha_alta ??
      (r.created_at
        ? new Date(r.created_at).toLocaleDateString("es-AR")
        : "") ??
      "",
  ]);
  console.log(`Supabase: ${clientes.length} clientes cargados`);
  aplicarFiltros();
}

// ==========================================
// RENDER
// ==========================================
const tbody = document.getElementById("clientes-body");

function renderClientes(lista) {
  tbody.innerHTML = "";
  lista.forEach((c) => {
    const [dni, nombre, apellido, direccion, telefono, mail, estado, fecha] = c;
    const badgeClass = estado === "Activo" ? "activo" : "inactivo";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="dni-cell">
          <span class="dni-text">${dni}</span>
          <button class="btn-copy-dni" data-dni="${dni}" title="Copiar DNI">
            <i data-lucide="copy" class="copy-icon"></i>
          </button>
        </span>
      </td>
      <td>${nombre}</td>
      <td>${apellido}</td>
      <td>${direccion}</td>
      <td>${telefono}</td>
      <td>${mail}</td>
      <td><span class="badge ${badgeClass}">${estado}</span></td>
      <td>${fecha}</td>
      <td class="actions-cell">
        <div class="actions">
          <button class="icon-btn more" title="Más opciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
          </button>
          <div class="dropdown-menu">
            <button class="dropdown-item edit" data-rol="Administrador,Recepcionista" data-dni="${dni}" data-nombre="${nombre}" data-apellido="${apellido}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Editar
            </button>
            <button class="dropdown-item danger" data-rol="Administrador,Recepcionista" data-dni="${dni}" data-nombre="${nombre}" data-apellido="${apellido}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Eliminar
            </button>
            <button class="dropdown-item show" data-dni="${dni}" data-nombre="${nombre}" data-apellido="${apellido}">
              <i data-lucide="eye"></i>  
              Ver mascotas
            </button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  if (typeof lucide !== "undefined") lucide.createIcons();
  reaplicarPermisos();
}

// ==========================================
// UTILIDADES
// ==========================================
function limpiarTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// Convierte "15/03/2025" o "2025-03-15" a Date
function parsearFecha(fecha) {
  if (!fecha) return null;
  // Formato es-AR: DD/MM/YYYY
  if (typeof fecha === "string" && fecha.includes("/")) {
    const [d, m, y] = fecha.split("/");
    if (d && m && y) {
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      return isNaN(dt) ? null : dt;
    }
  }
  // Formato ISO: YYYY-MM-DD
  const dt = new Date(fecha);
  return isNaN(dt) ? null : dt;
}

// ==========================================
// FILTROS
// ==========================================
const inputBuscador = document.getElementById("inputBuscador");
const filtroEstado = document.getElementById("filtroEstado");
const filtroFechaDesde = document.getElementById("filtroFechaDesde");
const filtroFechaHasta = document.getElementById("filtroFechaHasta");
const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");
const contadorResultados = document.getElementById("contadorResultados");

/**
 * Devuelve los clientes que cumplen TODOS los filtros activos.
 */
function obtenerClientesFiltrados() {
  const texto = (inputBuscador?.value || "").trim();
  const busqueda = limpiarTexto(texto);
  const estadoFiltro = filtroEstado?.value || "";
  const fechaDesde = filtroFechaDesde?.value ? new Date(filtroFechaDesde.value) : null;
  const fechaHasta = filtroFechaHasta?.value ? new Date(filtroFechaHasta.value) : null;

  // Normalizamos fechaHasta al final del día
  if (fechaHasta) {
    fechaHasta.setHours(23, 59, 59, 999);
  }

  return clientes.filter((c) => {
    const [dni, nombre, apellido, direccion, telefono, mail, estado, fecha] = c;

    // Filtro texto: DNI, nombre, apellido, dirección, mail
    if (busqueda) {
      const coincideTexto =
        String(dni).toLowerCase().includes(busqueda) ||
        limpiarTexto(nombre).includes(busqueda) ||
        limpiarTexto(apellido).includes(busqueda) ||
        limpiarTexto(direccion).includes(busqueda) ||
        limpiarTexto(mail).includes(busqueda);
      if (!coincideTexto) return false;
    }

    // Filtro estado
    if (estadoFiltro && estado !== estadoFiltro) return false;

    // Filtro fecha desde
    if (fechaDesde) {
      const fechaCliente = parsearFecha(fecha);
      if (!fechaCliente || fechaCliente < fechaDesde) return false;
    }

    // Filtro fecha hasta
    if (fechaHasta) {
      const fechaCliente = parsearFecha(fecha);
      if (!fechaCliente || fechaCliente > fechaHasta) return false;
    }

    return true;
  });
}

/**
 * Aplica los filtros y renderiza. También actualiza el contador.
 */
function aplicarFiltros() {
  const filtrados = obtenerClientesFiltrados();
  renderClientes(filtrados);
  actualizarContador(filtrados.length, clientes.length);
}

/**
 * Actualiza el contador de resultados.
 */
function actualizarContador(mostrando, total) {
  if (!contadorResultados) return;
  if (total === 0) {
    contadorResultados.innerHTML = "";
    return;
  }
  if (mostrando === total) {
    contadorResultados.innerHTML = `Mostrando <strong>${total}</strong> ${total === 1 ? "cliente" : "clientes"}`;
  } else {
    contadorResultados.innerHTML = `Mostrando <strong>${mostrando}</strong> de <strong>${total}</strong> ${total === 1 ? "cliente" : "clientes"}`;
  }
}

/**
 * Limpia todos los filtros y el buscador.
 */
function limpiarFiltros() {
  if (inputBuscador) inputBuscador.value = "";
  if (filtroEstado) filtroEstado.value = "";
  if (filtroFechaDesde) filtroFechaDesde.value = "";
  if (filtroFechaHasta) filtroFechaHasta.value = "";
  aplicarFiltros();
}

/**
 * Alias público que se sigue usando en otros lugares.
 */
async function filtrarCliente(texto) {
  if (typeof texto === "string" && inputBuscador) {
    inputBuscador.value = texto;
  }
  aplicarFiltros();
}

// ==========================================
// EVENTOS DE FILTROS
// ==========================================
if (inputBuscador) {
  inputBuscador.addEventListener("input", aplicarFiltros);
}
if (filtroEstado) {
  filtroEstado.addEventListener("change", aplicarFiltros);
}
if (filtroFechaDesde) {
  filtroFechaDesde.addEventListener("change", aplicarFiltros);
}
if (filtroFechaHasta) {
  filtroFechaHasta.addEventListener("change", aplicarFiltros);
}
if (btnLimpiarFiltros) {
  btnLimpiarFiltros.addEventListener("click", limpiarFiltros);
}

// ==========================================
// COPIAR DNI + DROPDOWN
// ==========================================
document.addEventListener("click", async (e) => {
  const copyBtn = e.target.closest(".btn-copy-dni");
  if (copyBtn) {
    e.stopPropagation();
    const dni = copyBtn.getAttribute("data-dni");
    try {
      await navigator.clipboard.writeText(dni);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = dni;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    copyBtn.classList.add("copied");
    copyBtn.innerHTML = '<i data-lucide="check" class="copy-icon"></i>';
    if (typeof lucide !== "undefined") lucide.createIcons();
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyBtn.innerHTML = '<i data-lucide="copy" class="copy-icon"></i>';
      if (typeof lucide !== "undefined") lucide.createIcons();
    }, 1200);
    document
      .querySelectorAll(".dropdown-menu.open")
      .forEach((m) => m.classList.remove("open"));
    return;
  }

  const moreBtn = e.target.closest(".icon-btn.more");
  if (!moreBtn) {
    document
      .querySelectorAll(".dropdown-menu.open")
      .forEach((m) => m.classList.remove("open"));
    return;
  }
  e.stopPropagation();
  const menu = moreBtn.closest(".actions").querySelector(".dropdown-menu");
  const rect = moreBtn.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 180) {
    menu.classList.add("dropup");
  } else {
    menu.classList.remove("dropup");
  }
  const isOpen = menu.classList.contains("open");
  document
    .querySelectorAll(".dropdown-menu.open")
    .forEach((m) => m.classList.remove("open"));
  if (!isOpen) menu.classList.add("open");
});

// ==========================================
// VALIDACIONES DE FORMULARIO
// ==========================================
let dniOriginal = null;

function limpiarErrores(sufijo = null) {
  if (sufijo === null) {
    document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
    return;
  }
  if (sufijo === "") {
    document.querySelectorAll(".field-error").forEach((el) => {
      if (!el.id.endsWith("-alta")) el.textContent = "";
    });
    return;
  }
  document.querySelectorAll(`.field-error[id$="${sufijo}"]`).forEach((el) => (el.textContent = ""));
}

function mostrarError(campoConSufijo, msg) {
  const el = document.getElementById(`error-${campoConSufijo}`);
  if (el) el.textContent = msg || "";
}

function validarFormulario(datos, sufijo = "") {
  limpiarErrores(sufijo);
  let ok = true;
  const set = (campoBase, msg) => {
    if (msg) {
      mostrarError(campoBase + sufijo, msg);
      ok = false;
    }
  };
  const mail = datos.mail_cliente ?? datos.email ?? datos.mail ?? "";

  if (!/^\d{8}$/.test(datos.dni)) set("dni", "DNI 8 dígitos");

  if (!/^\d{10,20}$/.test(datos.telefono)) set("telefono", "Solo números(min10) - (max 20)");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) set("email", "Email inválido");
  return ok;
}

function bloquearSoloNumeros(input) {
  if (!input) return;
  input.addEventListener("keydown", (e) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      [
        "Backspace",
        "Delete",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    if (e.key === " " || (e.key.length === 1 && !/[0-9]/.test(e.key)))
      e.preventDefault();
  });
  input.addEventListener("input", () => {
    const pos = input.selectionStart;
    const limpio = input.value.replace(/[^0-9]/g, "");
    if (input.value !== limpio) {
      input.value = limpio;
      try {
        input.setSelectionRange(pos - 1, pos - 1);
      } catch {}
    }
  });
  input.addEventListener("paste", (e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "");
    const start = input.selectionStart,
      end = input.selectionEnd;
    const val = input.value;
    input.value = val.slice(0, start) + text + val.slice(end);
    const newPos = start + text.length;
    try {
      input.setSelectionRange(newPos, newPos);
    } catch {}
  });
}

bloquearSoloNumeros(document.getElementById("dni"));
bloquearSoloNumeros(document.getElementById("telefono"));
bloquearSoloNumeros(document.getElementById("dni-alta"));
bloquearSoloNumeros(document.getElementById("telefono-alta"));

[["dni",""], ["telefono",""], ["nombre",""], ["apellido",""], ["direccion",""], ["email",""]].forEach(([id, suf]) => {
  document.getElementById(id)?.addEventListener("input", () => mostrarError(id + suf, ""));
});
[["dni-alta","dni-alta"], ["telefono-alta","telefono-alta"], ["nombre-alta","nombre-alta"], ["apellido-alta","apellido-alta"], ["direccion-alta","direccion-alta"], ["email-alta","email-alta"]].forEach(([id, campo]) => {
  document.getElementById(id)?.addEventListener("input", () => mostrarError(campo, ""));
});

// ==========================================
// VISTAS
// ==========================================
const vistaLista = document.querySelector(".vistaLista");
const vistaEditar = document.getElementById("vistaEditar");
const vistaMascotas = document.getElementById("vistaVerMascotas");
const toolbarFiltros = document.querySelector(".toolbar-filtros");
const pageHeader = document.querySelector(".page-header");

function ocultarElementos() {
  vistaLista.style.display = "none";
  if (toolbarFiltros) toolbarFiltros.style.display = "none";
  if (pageHeader) pageHeader.style.display = "none";
}

function mostrarEditar(dato) {
  limpiarErrores("");
  ocultarElementos();
  vistaEditar.style.display = "block";

  const dataDni = dato.getAttribute("data-dni");
  const dataNombre = dato.getAttribute("data-nombre");
  const dataApellido = dato.getAttribute("data-apellido");
  dniOriginal = dataDni;

  const userEditar = document.getElementById("user-editar");
  userEditar.innerHTML = `${dataNombre} ${dataApellido}`;

  const cliente = clientes.find((c) => String(c[0]) === String(dataDni));
  if (cliente) {
    const [, nombre, apellido, direccion, telefono, mail, estado] = cliente;
    document.getElementById("dni").value = cliente[0] ?? "";
    document.getElementById("nombre").value = nombre ?? "";
    document.getElementById("apellido").value = apellido ?? "";
    document.getElementById("direccion").value = direccion ?? "";
    document.getElementById("telefono").value = telefono ?? "";
    document.getElementById("email").value = mail ?? "";
    const radioEstado = document.querySelector(
      `input[name="estado"][value="${estado}"]`,
    );
    if (radioEstado) radioEstado.checked = true;
  }
}

document.querySelector(".btn-altaCliente")?.addEventListener("click", () => {
  altaCliente();
});

function altaCliente() {
  limpiarErrores("-alta");
  ocultarElementos();
  document.querySelector(".vistaAltaCliente").style.display = "block";
}

async function actualizarClienteEnSupabase(datos) {
  const { error } = await supabase
    .from("clientes")
    .update({
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      direccion: datos.direccion,
      telefono: datos.telefono,
      mail_cliente: datos.mail_cliente,
      estado_cliente: datos.estado,
    })
    .eq("dni", dniOriginal);

  if (error) {
    console.error("Error update:", error.message);
    alert("No se pudo actualizar: " + error.message);
    return false;
  }
  await cargarClientesDesdeSupabase();
  return true;
}

async function eliminarClienteEnSupabase(dni) {
  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("dni", dni);
  if (error) {
    console.error("Error delete:", error.message);
    alert("No se pudo eliminar: " + error.message);
    return false;
  }
  await cargarClientesDesdeSupabase();
  return true;
}

async function altaClienteEnSupabase(datos) {
  const { error } = await supabase
    .from("clientes")
    .insert({
      dni: datos.dni,
      nombre: datos.nombre,
      apellido: datos.apellido,
      direccion: datos.direccion,
      telefono: datos.telefono,
      mail_cliente: datos.mail_cliente,
      estado_cliente: datos.estado_cliente,
      fecha_alta: datos.fecha_alta,
    });
  if (error) {
    console.error("Error insert:", error.message);
    alert("No se pudo crear el cliente: " + error.message);
    return false;
  }
  await cargarClientesDesdeSupabase();
  return true;
}

function mostrarLista() {
  limpiarErrores(null);
  vistaEditar.style.display = "none";
  document.querySelector(".vistaAltaCliente").style.display = "none";
  vistaMascotas.style.display = "none";
  vistaLista.style.display = "block";
  if (toolbarFiltros) toolbarFiltros.style.display = "flex";
  if (pageHeader) pageHeader.style.display = "flex";
  // Reaplicamos los filtros por si cambiaron los datos
  aplicarFiltros();
}

// ==========================================
// EVENTOS DE VISTAS
// ==========================================
document.addEventListener("click", (e) => {
  const editBtn = e.target.closest(".dropdown-item.edit");
  if (editBtn) {
    mostrarEditar(e.target.closest(".dropdown-item.edit"));
  }
});

document.getElementById("btnVolver")?.addEventListener("click", mostrarLista);
document.getElementById("btnVolverMascotas")?.addEventListener("click", mostrarLista);
document.getElementById("btnVolverAlta")?.addEventListener("click", () => {
  limpiarErrores("-alta");
  mostrarLista();
});

// ==========================================
// CONFIRM MODAL ELIMINAR
// ==========================================
let dniPendienteEliminar = null;
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmText = document.getElementById("confirm-text");
const confirmCancel = document.getElementById("confirm-cancel");
const confirmDelete = document.getElementById("confirm-delete");

function abrirConfirmEliminar(dni, nombre, apellido) {
  dniPendienteEliminar = dni;
  confirmText.textContent = `¿Seguro que querés eliminar a ${nombre} ${apellido} (DNI ${dni})? Esta acción no se puede deshacer.`;
  confirmOverlay.classList.remove("hidden");
}

function cerrarConfirmEliminar() {
  confirmOverlay.classList.add("hidden");
  dniPendienteEliminar = null;
}

document.addEventListener("click", (e) => {
  const deleteBtn = e.target.closest(".dropdown-item.danger");
  if (deleteBtn) {
    e.stopPropagation();
    document
      .querySelectorAll(".dropdown-menu.open")
      .forEach((m) => m.classList.remove("open"));
    abrirConfirmEliminar(
      deleteBtn.getAttribute("data-dni"),
      deleteBtn.getAttribute("data-nombre"),
      deleteBtn.getAttribute("data-apellido"),
    );
  }
});

confirmCancel?.addEventListener("click", cerrarConfirmEliminar);
confirmOverlay?.addEventListener("click", (e) => {
  if (e.target === confirmOverlay) cerrarConfirmEliminar();
});
confirmDelete?.addEventListener("click", async () => {
  if (!dniPendienteEliminar) return;
  confirmDelete.disabled = true;
  confirmDelete.textContent = "Eliminando...";
  const ok = await eliminarClienteEnSupabase(dniPendienteEliminar);
  confirmDelete.disabled = false;
  confirmDelete.textContent = "Eliminar";
  if (ok) cerrarConfirmEliminar();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !confirmOverlay.classList.contains("hidden"))
    cerrarConfirmEliminar();
});

// ==========================================
// SUBMIT: EDITAR
// ==========================================
document
  .getElementById("formAfiliado")
  ?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const estadoSeleccionado = document.querySelector(
      'input[name="estado"]:checked',
    );
    const datos = {
      dni: document.getElementById("dni").value.trim(),
      nombre: document.getElementById("nombre").value.trim(),
      apellido: document.getElementById("apellido").value.trim(),
      direccion: document.getElementById("direccion").value.trim(),
      telefono: document.getElementById("telefono").value.trim(),
      mail_cliente: document.getElementById("email").value.trim(),
      estado: estadoSeleccionado ? estadoSeleccionado.value : "Activo",
    };
    if (!validarFormulario(datos, "")) return;
    const btn = e.target.querySelector(".btn-confirmar");

    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Guardando...";
    const ok = await actualizarClienteEnSupabase(datos);
    btn.disabled = false;
    btn.innerHTML = textoOriginal;
    lucide.createIcons();
    if (ok) mostrarLista();
  });

// ==========================================
// SUBMIT: ALTA
// ==========================================
document.getElementById("formAltaCliente")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const datos = {
    dni: document.getElementById("dni-alta").value.trim(),
    nombre: document.getElementById("nombre-alta").value.trim(),
    apellido: document.getElementById("apellido-alta").value.trim(),
    direccion: document.getElementById("direccion-alta").value.trim(),
    telefono: document.getElementById("telefono-alta").value.trim(),
    mail_cliente: document.getElementById("email-alta").value.trim(),
    estado_cliente: "Activo",
    fecha_alta: new Date().toISOString().split("T")[0],
  };
  if (!validarFormulario({ ...datos, mail_cliente: datos.mail_cliente }, "-alta")) return;

  const btn = e.target.querySelector(".btn-confirmar-alta");
  const textoOriginal = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = "Guardando...";
  const ok = await altaClienteEnSupabase(datos);
  btn.disabled = false;
  btn.innerHTML = textoOriginal;
  lucide.createIcons();
  if (ok) mostrarLista();
});

// ==========================================
// VER MASCOTAS DE UN CLIENTE
// ==========================================
document.addEventListener("click", (e) => {
  const btnVerMascotas = e.target.closest(".dropdown-item.show");
  if (btnVerMascotas) {
    mostrarMascotas(btnVerMascotas);
  }
});

function mostrarMascotas(dato) {
  ocultarElementos();
  vistaMascotas.style.display = "block";

  const dataDni = dato.getAttribute("data-dni");
  const dataNombre = dato.getAttribute("data-nombre");
  const dataApellido = dato.getAttribute("data-apellido");
  dniOriginal = dataDni;

  const userEditar = document.getElementById("user-mascotas");
  userEditar.innerHTML = `${dataNombre} ${dataApellido}`;

  cargarMascotasDesdeSupabaseCliente(dniOriginal, dataNombre, dataApellido);
}

const mbody = document.getElementById("mascotas-body");

async function cargarMascotasDesdeSupabaseCliente(dniOriginal, nombre, apellido) {
  mbody.innerHTML = "";
  if (!supabase) {
    console.warn("Supabase no cargado");
    return;
  }
  const { data, error } = await supabase
    .from("mascotas")
    .select("nombre_mascota,especie,raza,observaciones")
    .eq("dni", dniOriginal);

  if (error) {
    console.error("Error Supabase select mascotas:", error.message);
    return;
  }
  if (!data || data.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4"> El cliente ${nombre} ${apellido} no tiene mascotas asociadas.</td>`;
    mbody.appendChild(tr);
    return;
  }
  const mascotas = data.map((r) => [
    r.nombre_mascota ?? "",
    r.especie ?? "",
    r.raza ?? "",
    r.observaciones ?? "",
  ]);
  renderMascotas(mascotas);
}

function renderMascotas(mascotas) {
  mbody.innerHTML = "";
  mascotas.forEach((m) => {
    const [nombre, especie, raza, observaciones] = m;
    const tr = document.createElement("tr");
    tr.innerHTML = `
    <td>${nombre}</td>
    <td>${especie}</td>
    <td>${raza}</td>
    <td>${observaciones}</td>
    `;
    mbody.appendChild(tr);
  });
}

// ==========================================
// QUERY PARAMS: dni / accion=alta
// ==========================================
function aplicarQueryParams() {
  const params = new URLSearchParams(window.location.search);

  const dniParam = params.get("dni");
  if (dniParam && inputBuscador) {
    inputBuscador.value = dniParam;
    aplicarFiltros();
  }

  if (params.get("accion") === "alta") {
    setTimeout(() => {
      if (typeof altaCliente === "function") {
        altaCliente();
      }
    }, 50);
  }
}

// ==========================================
// LOGOUT
// ==========================================
const logoutBtn = document.getElementById("logoutBtn");
function configurarLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      cerrarSesion();
    });
  }
}
configurarLogout();

// ==========================================
// INICIALIZAR
// ==========================================
(async () => {
  if (!(await protegerRuta())) return;
  await cargarClientesDesdeSupabase();
  aplicarQueryParams();
})();