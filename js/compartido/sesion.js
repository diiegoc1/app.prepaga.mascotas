// ==========================================
// SESIÓN CENTRAL (Supabase Auth + Roles)
// Requiere: js/compartido/supabaseClient.js cargado antes.
// Guarda en sessionStorage solo {id_empleado, nombre, rol} (nunca password).
// ==========================================
let _perfil = null;

async function getSession() {
  if (!window.supabaseClient) return null;
  const { data } = await window.supabaseClient.auth.getSession();
  return data.session ?? null;
}

async function getEmpleadoActual() {
  const session = await getSession();
  if (!session) return null;
  if (_perfil) return _perfil;
  try {
    const cache = JSON.parse(sessionStorage.getItem("perfil") || "null");
    if (cache) {
      _perfil = cache;
      return _perfil;
    }
  } catch {}
  const [{ data: emp, error: e1 }, { data: roles, error: e2 }] =
    await Promise.all([
      window.supabaseClient
        .from("empleados")
        .select("id_empleado, nombre_empleado, estado, id_rol")
        .eq("user_id", session.user.id)
        .single(),
      window.supabaseClient.from("roles").select("id_rol, nombre_rol"),
    ]);
  if (e1 || e2 || !emp) return null;
  const rol = (roles || []).find(
    (r) => String(r.id_rol) === String(emp.id_rol),
  );
  _perfil = {
    id_empleado: emp.id_empleado,
    nombre: emp.nombre_empleado,
    estado: emp.estado,
    rol: rol ? rol.nombre_rol : `Rol ${emp.id_rol}`,
  };
  sessionStorage.setItem("perfil", JSON.stringify(_perfil));
  
  return _perfil;
}

function esActivo(perfil) {
  return String(perfil?.estado ?? "").trim().toLowerCase() === "activo";
}

function aplicarPermisosUI(rol) {
  
  document.querySelectorAll("[data-rol]").forEach((el) => {
    const permitidos = el.dataset.rol.split(",").map((s) => s.trim());
    if (!permitidos.includes(rol)) el.style.display = "none";
  });
}

function rolCache() {
  try {
    return JSON.parse(sessionStorage.getItem("perfil") || "null")?.rol ?? null;
  } catch {
    return null;
  }
}

// Reaplica el gating sobre contenido renderizado dinámicamente (tablas/dropdowns).
function reaplicarPermisos() {
  const r = rolCache();
  if (r) aplicarPermisosUI(r);
}

async function protegerRuta({ soloAdminRecep = false } = {}) {
  if (!(await getSession())) {
    window.location.href = "index.html";
    return null;
  }
  const perfil = await getEmpleadoActual();
  if (!perfil || !esActivo(perfil)) {
    await cerrarSesion();
    return null;
  }
  if (soloAdminRecep && perfil.rol === "Veterinario") {
    window.location.href = "dashboard.html";
    return null;
  }
  aplicarPermisosUI(perfil.rol);
  return perfil;
}

async function cerrarSesion() {
  try {
    await window.supabaseClient.auth.signOut();
  } catch {}
  sessionStorage.removeItem("empleado");
  sessionStorage.removeItem("perfil");
  _perfil = null;
  localStorage.removeItem("supabase.auth.token");
  window.location.href = "index.html";
}
