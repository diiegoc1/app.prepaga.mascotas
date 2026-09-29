document.addEventListener("DOMContentLoaded", () => {
  if (typeof lucide !== "undefined") lucide.createIcons();

  // ---------- ESTADO ----------
  let registros = []; // todos los registros traídos de Supabase
  let registrosFiltrados = []; // resultado luego de aplicar los filtros
  let paginaActual = 1;
  let porPagina = 20;
  let idPendienteEliminar = null;

  // ---------- ELEMENTOS ----------
  const tbody = document.getElementById("historial-body");
  const inputFecha = document.getElementById("inputFecha");
  const btnAbrirCalendario = document.getElementById("btnAbrirCalendario");
  const inputFechaNativo = document.getElementById("inputFechaNativo");
  const inputDni = document.getElementById("inputDni");
  const inputPlanes = document.getElementById("inputPlanes");
  const btnLimpiarFiltros = document.getElementById("btnLimpiarFiltros");

  const infoPaginacion = document.getElementById("info-paginacion");
  const paginacionNumeros = document.getElementById("paginacion-numeros");
  const selectCantidad = document.getElementById("selectCantidad");
  const btnFirst = document.getElementById("btnFirst");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnLast = document.getElementById("btnLast");

  const confirmOverlay = document.getElementById("confirm-overlay");
  const confirmText = document.getElementById("confirm-text");
  const confirmCancel = document.getElementById("confirm-cancel");
  const confirmDelete = document.getElementById("confirm-delete");

  const detalleOverlay = document.getElementById("detalle-overlay");
  const detalleText = document.getElementById("detalle-text");
  const detalleCerrar = document.getElementById("detalle-cerrar");

  const editarOverlay = document.getElementById("editar-overlay");
  const editDni = document.getElementById("editDni");
  const editEstado = document.getElementById("editEstado");
  const editTipo = document.getElementById("editTipo");
  const editPlan = document.getElementById("editPlan");
  const editFecha = document.getElementById("editFecha");
  const editHora = document.getElementById("editHora");
  const editMetodo = document.getElementById("editMetodo");
  const editConcepto = document.getElementById("editConcepto");
  const editObservaciones = document.getElementById("editObservaciones");
  const editarCancelar = document.getElementById("editar-cancelar");
  const editarGuardar = document.getElementById("editar-guardar");

  // Si falta algún elemento clave, avisamos en consola en vez de romper todo en silencio.
  const elementosClave = {
    tbody, inputFecha, btnAbrirCalendario, inputFechaNativo, inputDni, inputPlanes, btnLimpiarFiltros,
    infoPaginacion, paginacionNumeros, selectCantidad,
    btnFirst, btnPrev, btnNext, btnLast,
    confirmOverlay, confirmText, confirmCancel, confirmDelete,
    detalleOverlay, detalleText, detalleCerrar,
    editarOverlay, editDni, editEstado, editTipo, editPlan, editFecha, editHora,
    editMetodo, editConcepto, editObservaciones, editarCancelar, editarGuardar,
  };
  for (const [nombre, el] of Object.entries(elementosClave)) {
    if (!el) console.warn(`historial.js: no se encontró el elemento "${nombre}" en el HTML`);
  }

  // ---------- SUPABASE: cargar registros ----------
  async function cargarHistorial() {
    tbody.innerHTML = `<tr><td colspan="10" class="estado-vacio">Cargando registros...</td></tr>`;

    if (!window.supabaseClient) {
      tbody.innerHTML = `<tr><td colspan="10" class="estado-error">No se pudo inicializar la conexión a Supabase.</td></tr>`;
      return;
    }


    const { data, error } = await window.supabaseClient
      .from("clientes")
      .select("*")
      .order("dni", { ascending: true });

    if (error) {
      console.error("Error al cargar el historial desde Supabase:", error.message);
      tbody.innerHTML = `<tr><td colspan="10" class="estado-error">Error al conectar con la base de datos: ${error.message}</td></tr>`;
      return;
    }


    registros = (data || []).map((c) => ({
      id: c.dni,
      dni: c.dni,
      cliente_id: c.dni,
      mascota_id: "-",
      tipo: c.tipo || c.estado || "-",
      plan: c.plan || "-",
      metodo: "-",
      fecha: c.fecha_alta || "-",
      hora: "-",
      concepto: c.concepto || c.direccion || "-",
      metodo_pago: c.metodo_pago || c.telefono || "-",
      estado: c.estado || "Pendiente",
      observaciones: c.mail_cliente || c.email || c.mail || "-",
      pieza_nro: "-",
      _modoPrueba: true,
    }));
    aplicarFiltros();
  }

  // ---------- FILTROS ----------
  function limpiarTexto(texto) {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function aplicarFiltros() {
    const fecha = inputFecha.value.trim(); // "aaaa", "aaaa-mm" o "aaaa-mm-dd"
    const dni = inputDni.value.trim(); // ya viene filtrado a solo dígitos
    const conceptoPlan = limpiarTexto(inputPlanes.value.trim());

    registrosFiltrados = registros.filter((r) => {
      // Al filtrar por "empieza con" alcanza con escribir el año, año+mes, o la fecha completa.
      const coincideFecha = fecha ? String(r.fecha ?? "").startsWith(fecha) : true;
      const coincideDni = dni ? String(r.dni ?? "").includes(dni) : true;
      // "Concepto/plan" busca tanto en el concepto (detalle del registro) como en el plan de la mascota.
      const coincideConceptoPlan = conceptoPlan
        ? limpiarTexto(r.concepto).includes(conceptoPlan) || limpiarTexto(r.plan).includes(conceptoPlan)
        : true;
      return coincideFecha && coincideDni && coincideConceptoPlan;
    });

    paginaActual = 1;
    renderPagina();
  }

  // Fecha: se permiten sólo dígitos, insertando los guiones automáticamente
  // en formato aaaa-mm-dd. Al filtrar por "empieza con", con sólo el año ya
  // filtra por año completo, con año+mes filtra ese mes, y con los 3 filtra
  // el día exacto.
  function formatearFecha(valor) {
    const digitos = valor.replace(/\D/g, "").slice(0, 8); // aaaammdd
    let resultado = digitos.slice(0, 4);
    if (digitos.length > 4) resultado += "-" + digitos.slice(4, 6);
    if (digitos.length > 6) resultado += "-" + digitos.slice(6, 8);
    return resultado;
  }

  inputFecha.addEventListener("input", () => {
    inputFecha.value = formatearFecha(inputFecha.value);
    aplicarFiltros();
  });

  // Botón de calendario: abre el selector de fecha nativo del navegador.
  btnAbrirCalendario.addEventListener("click", () => {
    if (typeof inputFechaNativo.showPicker === "function") {
      inputFechaNativo.showPicker();
    } else {
      inputFechaNativo.focus();
      inputFechaNativo.click();
    }
  });

  // Al elegir una fecha en el calendario, se vuelca al input de texto (ya en formato aaaa-mm-dd).
  inputFechaNativo.addEventListener("change", () => {
    inputFecha.value = inputFechaNativo.value;
    aplicarFiltros();
  });

  // DNI: se permiten sólo dígitos, hasta 9 caracteres.
  inputDni.addEventListener("input", () => {
    inputDni.value = inputDni.value.replace(/\D/g, "").slice(0, 9);
    aplicarFiltros();
  });

  inputPlanes.addEventListener("input", aplicarFiltros);

  btnLimpiarFiltros.addEventListener("click", () => {
    inputFecha.value = "";
    inputFechaNativo.value = "";
    inputDni.value = "";
    inputPlanes.value = "";
    aplicarFiltros();
  });

  // ---------- RENDER TABLA ----------
  function renderFilas(lista) {
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="estado-vacio">No se encontraron registros.</td></tr>`;
      return;
    }

    tbody.innerHTML = "";
    lista.forEach((item) => {
      const estado = item.estado || "Pendiente";
      const badgeClass = estado === "Completado" || estado === "Activo" ? "activo" : "inactivo";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.dni || "-"}</td>
        <td>${item.tipo || "-"}</td>
        <td>${item.plan || "-"}</td>
        <td>${item.fecha || "-"}</td>
        <td>${item.hora || "-"}</td>
        <td>${item.concepto || "-"}</td>
        <td>${item.metodo_pago || "-"}</td>
        <td><span class="badge ${badgeClass}">${estado}</span></td>
        <td>${item.observaciones || "-"}</td>
        <td class="actions-cell">
          <div class="actions">
            <button class="icon-btn copy" title="Copiar fila" data-id="${item.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="icon-btn more" title="Más opciones">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
            </button>
            <div class="dropdown-menu">
              <button class="dropdown-item view" data-id="${item.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Ver detalle
              </button>
              <button class="dropdown-item edit" data-id="${item.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              <button class="dropdown-item danger" data-id="${item.id}" data-dni="${item.dni ?? ""}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Eliminar
              </button>
            </div>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  // ---------- PAGINACIÓN ----------
  function totalPaginas() {
    return Math.max(1, Math.ceil(registrosFiltrados.length / porPagina));
  }

  function renderPagina() {
    const total = registrosFiltrados.length;
    const paginas = totalPaginas();
    if (paginaActual > paginas) paginaActual = paginas;

    const inicio = total === 0 ? 0 : (paginaActual - 1) * porPagina + 1;
    const fin = Math.min(paginaActual * porPagina, total);

    renderFilas(registrosFiltrados.slice(inicio - 1, fin));

    infoPaginacion.textContent = `Mostrando ${inicio} a ${fin} de ${total} registros`;

    btnFirst.disabled = paginaActual === 1;
    btnPrev.disabled = paginaActual === 1;
    btnNext.disabled = paginaActual === paginas;
    btnLast.disabled = paginaActual === paginas;

    renderNumerosPagina(paginas);
  }

  function renderNumerosPagina(paginas) {
    paginacionNumeros.innerHTML = "";
    const ventana = 2; // páginas visibles a cada lado de la actual
    const desde = Math.max(1, paginaActual - ventana);
    const hasta = Math.min(paginas, paginaActual + ventana);

    for (let p = desde; p <= hasta; p++) {
      const btn = document.createElement("button");
      btn.textContent = p;
      btn.className = "page-number" + (p === paginaActual ? " active" : "");
      btn.addEventListener("click", () => {
        paginaActual = p;
        renderPagina();
      });
      paginacionNumeros.appendChild(btn);
    }
  }

  btnFirst.addEventListener("click", () => {
    paginaActual = 1;
    renderPagina();
  });
  btnPrev.addEventListener("click", () => {
    if (paginaActual > 1) paginaActual--;
    renderPagina();
  });
  btnNext.addEventListener("click", () => {
    if (paginaActual < totalPaginas()) paginaActual++;
    renderPagina();
  });
  btnLast.addEventListener("click", () => {
    paginaActual = totalPaginas();
    renderPagina();
  });
  selectCantidad.addEventListener("change", () => {
    porPagina = Number(selectCantidad.value);
    paginaActual = 1;
    renderPagina();
  });

  // ---------- MENÚ DE ACCIONES (abrir/cerrar dropdown) ----------
  // El menú usa position:fixed y se posiciona con JS, así no lo recorta
  // el scroll ni el overflow:hidden de la tarjeta de la tabla.
  function cerrarMenu(menu) {
    menu.classList.remove("open");
    menu.style.top = "";
    menu.style.left = "";
    menu.style.bottom = "";
  }

  function cerrarTodosLosMenus() {
    document.querySelectorAll(".dropdown-menu.open").forEach(cerrarMenu);
  }

  function posicionarMenu(menu, boton) {
    const rect = boton.getBoundingClientRect();
    const anchoMenu = menu.offsetWidth || 170;
    const altoMenu = menu.offsetHeight || 150;
    const margen = 8;

    let left = rect.right - anchoMenu;
    left = Math.min(Math.max(left, margen), window.innerWidth - anchoMenu - margen);

    const espacioAbajo = window.innerHeight - rect.bottom;
    const abrirHaciaArriba = espacioAbajo < altoMenu + margen;

    menu.style.left = `${left}px`;
    if (abrirHaciaArriba) {
      menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      menu.style.top = "";
    } else {
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.bottom = "";
    }
  }

  document.addEventListener("click", (e) => {
    const moreBtn = e.target.closest(".icon-btn.more");
    if (!moreBtn) {
      cerrarTodosLosMenus();
      return;
    }
    e.stopPropagation();
    const menu = moreBtn.closest(".actions").querySelector(".dropdown-menu");
    const yaEstabaAbierto = menu.classList.contains("open");
    cerrarTodosLosMenus();
    if (yaEstabaAbierto) return;

    menu.classList.add("open");
    posicionarMenu(menu, moreBtn);
  });

  // Si se hace scroll (de la tabla o de la página) o se cambia el tamaño de
  // ventana, cerramos el menú para que no quede flotando en un lugar viejo.
  window.addEventListener("scroll", cerrarTodosLosMenus, true);
  window.addEventListener("resize", cerrarTodosLosMenus);

  // ---------- VER DETALLE ----------
  document.addEventListener("click", (e) => {
    const viewBtn = e.target.closest(".dropdown-item.view");
    if (!viewBtn) return;
    const id = viewBtn.getAttribute("data-id");
    const item = registros.find((r) => String(r.id) === String(id));
    if (!item) return;

    detalleText.innerHTML = `
      <strong>DNI:</strong> ${item.dni || "-"}<br>
      <strong>Cliente ID:</strong> ${item.cliente_id ?? "-"} &nbsp; <strong>Mascota ID:</strong> ${item.mascota_id ?? "-"}<br>
      <strong>Tipo:</strong> ${item.tipo || "-"} &nbsp; <strong>Plan:</strong> ${item.plan || "-"} &nbsp; <strong>Método:</strong> ${item.metodo_pago || "-"}<br>
      <strong>Fecha:</strong> ${item.fecha || "-"} &nbsp; <strong>Hora:</strong> ${item.hora || "-"}<br>
      <strong>Concepto:</strong> ${item.concepto || "-"}<br>
      <strong>Método de pago:</strong> ${item.metodo_pago || "-"}<br>
      <strong>Estado:</strong> ${item.estado || "-"}<br>
      <strong>Pieza N°:</strong> ${item.pieza_nro || "-"}<br>
      <strong>Observaciones:</strong> ${item.observaciones || "-"}
    `;
    detalleOverlay.classList.remove("hidden");
  });

  detalleCerrar.addEventListener("click", () => detalleOverlay.classList.add("hidden"));
  detalleOverlay.addEventListener("click", (e) => {
    if (e.target === detalleOverlay) detalleOverlay.classList.add("hidden");
  });

  // ---------- COPIAR FILA ----------
  document.addEventListener("click", async (e) => {
    const copyBtn = e.target.closest(".icon-btn.copy");
    if (!copyBtn) return;
    e.stopPropagation();

    const id = copyBtn.getAttribute("data-id");
    const item = registros.find((r) => String(r.id) === String(id));
    if (!item) return;

    const texto = [
      `DNI: ${item.dni || "-"}`,
      `Tipo: ${item.tipo || "-"}`,
      `Plan: ${item.plan || "-"}`,
      `Fecha: ${item.fecha || "-"}`,
      `Hora: ${item.hora || "-"}`,
      `Concepto: ${item.concepto || "-"}`,
      `Método de pago: ${item.metodo_pago || "-"}`,
      `Estado: ${item.estado || "-"}`,
      `Observaciones: ${item.observaciones || "-"}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(texto);
      mostrarCopiadoOk(copyBtn);
    } catch (err) {
      console.error("No se pudo copiar al portapapeles:", err);
      alert("No se pudo copiar automáticamente. Datos de la fila:\n\n" + texto);
    }
  });

  function mostrarCopiadoOk(boton) {
    const iconoOriginal = boton.innerHTML;
    boton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
    boton.classList.add("copied");
    setTimeout(() => {
      boton.innerHTML = iconoOriginal;
      boton.classList.remove("copied");
    }, 1200);
  }

  // ---------- ELIMINAR REGISTRO ----------
  document.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".dropdown-item.danger");
    if (!deleteBtn) return;
    e.stopPropagation();
    cerrarTodosLosMenus();

    idPendienteEliminar = deleteBtn.getAttribute("data-id");
    const dni = deleteBtn.getAttribute("data-dni");
    confirmText.textContent = `¿Seguro que querés eliminar el registro del DNI ${dni}? Esta acción no se puede deshacer.`;
    confirmOverlay.classList.remove("hidden");
  });

  function cerrarConfirmEliminar() {
    confirmOverlay.classList.add("hidden");
    idPendienteEliminar = null;
  }

  confirmCancel.addEventListener("click", cerrarConfirmEliminar);
  confirmOverlay.addEventListener("click", (e) => {
    if (e.target === confirmOverlay) cerrarConfirmEliminar();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!confirmOverlay.classList.contains("hidden")) cerrarConfirmEliminar();
      if (!detalleOverlay.classList.contains("hidden")) detalleOverlay.classList.add("hidden");
      if (!editarOverlay.classList.contains("hidden")) cerrarEditar();
    }
  });

  confirmDelete.addEventListener("click", async () => {
    if (!idPendienteEliminar) return;

    const registro = registros.find((r) => String(r.id) === String(idPendienteEliminar));
    if (registro && registro._modoPrueba) {
      alert("Modo de prueba: el borrado está deshabilitado para no tocar datos reales de clientes.");
      cerrarConfirmEliminar();
      return;
    }

    confirmDelete.disabled = true;
    confirmDelete.textContent = "Eliminando...";

    const { error } = await window.supabaseClient.from("registros").delete().eq("id", idPendienteEliminar);

    confirmDelete.disabled = false;
    confirmDelete.textContent = "Eliminar";

    if (error) {
      console.error("Error al eliminar registro:", error.message);
      alert("No se pudo eliminar el registro: " + error.message);
      return;
    }

    cerrarConfirmEliminar();
    await cargarHistorial();
  });

  // ---------- EDITAR REGISTRO ----------
  let idPendienteEditar = null;

  document.addEventListener("click", (e) => {
    const editBtn = e.target.closest(".dropdown-item.edit");
    if (!editBtn) return;
    e.stopPropagation();
    cerrarTodosLosMenus();

    const id = editBtn.getAttribute("data-id");
    const item = registros.find((r) => String(r.id) === String(id));
    if (!item) return;

    idPendienteEditar = id;
    const valorOVacio = (v) => (v && v !== "-" ? v : "");

    editDni.value = item.dni || "";
    editEstado.value = item.estado && item.estado !== "-" ? item.estado : "Pendiente";
    editTipo.value = valorOVacio(item.tipo);
    editPlan.value = valorOVacio(item.plan);
    editFecha.value = valorOVacio(item.fecha);
    editHora.value = valorOVacio(item.hora);
    editMetodo.value = valorOVacio(item.metodo_pago);
    editConcepto.value = valorOVacio(item.concepto);
    editObservaciones.value = valorOVacio(item.observaciones);

    editarOverlay.classList.remove("hidden");
  });

  // La fecha en el modal de edición usa el mismo formateo automático que el filtro.
  editFecha.addEventListener("input", () => {
    editFecha.value = formatearFecha(editFecha.value);
  });

  function cerrarEditar() {
    editarOverlay.classList.add("hidden");
    idPendienteEditar = null;
  }

  editarCancelar.addEventListener("click", cerrarEditar);
  editarOverlay.addEventListener("click", (e) => {
    if (e.target === editarOverlay) cerrarEditar();
  });

  editarGuardar.addEventListener("click", async () => {
    if (!idPendienteEditar) return;

    const registro = registros.find((r) => String(r.id) === String(idPendienteEditar));
    if (registro && registro._modoPrueba) {
      alert(
        "Modo de prueba: la edición está deshabilitada para no tocar datos reales de clientes. " +
          "Cuando el historial tenga su propia tabla en Supabase, este formulario va a actualizar el registro real."
      );
      cerrarEditar();
      return;
    }

    const cambios = {
      estado: editEstado.value,
      tipo: editTipo.value.trim() || null,
      plan: editPlan.value.trim() || null,
      fecha: editFecha.value.trim() || null,
      hora: editHora.value.trim() || null,
      metodo_pago: editMetodo.value.trim() || null,
      concepto: editConcepto.value.trim() || null,
      observaciones: editObservaciones.value.trim() || null,
    };

    editarGuardar.disabled = true;
    editarGuardar.textContent = "Guardando...";

    const { error } = await window.supabaseClient.from("registros").update(cambios).eq("id", idPendienteEditar);

    editarGuardar.disabled = false;
    editarGuardar.textContent = "Guardar cambios";

    if (error) {
      console.error("Error al editar registro:", error.message);
      alert("No se pudo guardar los cambios: " + error.message);
      return;
    }

    cerrarEditar();
    await cargarHistorial();
  });

  // ---------- INICIO ----------
  cargarHistorial();
});
