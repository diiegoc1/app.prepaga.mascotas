# CONTEXTO DEL PROYECTO — Handoff para continuar en otra PC

> Última actualización: 2026-10-13. Este archivo resume TODO lo trabajado con la IA
> anterior para que la próxima IA (o persona) entienda el estado sin releer el chat.

## 1. Qué es

**VetCare / prepaga-mascotas**: sistema de gestión para prepaga de mascotas (veterinaria).
Stack: **HTML + CSS + JS vanilla, sin build** (migración a Vite: planificada, ver §9).
Repo: `https://github.com/diiegoc1/prepaga-mascotas.git` (rama `main`).
Deploy: Vercel (con 404 pendiente, ver §10). Login en `index.html`.

## 2. Estructura

```
cliente.html, dashboard.html, mascotas.html, planes.html, usuarios.html,
historial.html (EXCLUIDA — en corrección, ignorarla), index.html (login),
panel.html (vacío), testConeccion.html (borrado, no subir)
css/ (uno por página + globals.css; existe además global.css duplicado)
js/cliente.js, dashboard.js, mascotas.js, planes.js, usuarios.js,
js/login.js, js/iconos.js (iconos por DB: planes.icono),
js/compartido/supabaseClient.js (CREDENCIALES REALES, gitignored, NO subir),
js/compartido/supabaseClient.example.js (plantilla pública),
js/compartido/sesion.js (cerebro Auth/roles, ver §5)
public/img/ (PNGdogandcat.png, icono.png)
```

## 3. Supabase

- Proyecto ref `fhpjopuazrupysftsaes`. Tablas usadas por la app: `clientes`,
  `mascotas`, `planes`, `beneficios_plan`, `empleados`, `roles`.
- Tablas que existen pero NADA las consulta: `auditoria`, `contratos`,
  `detalles_recibo`, `hist_titularidad`, `pagos`, `recibo` (RLS on, sin policies = denegadas, bien).
- Tabla `registros` **NO existe** (historial.js la referencia; coherente con historial en corrección).
- `empleados`: `id_empleado, nombre_empleado, email, contraseña (legacy texto plano),
  id_rol, estado ('activo' en minúscula), user_id (uuid → auth.users, vínculo Auth)`.
- `roles`: **`id_rol` 1=Administrador, 2=Veterinario, 3=Recepcionista.
  ¡NOMBRES CAPITALIZADOS!** Todo el sistema (policies, data-rol, sesion.js) usa
  capitalizados. Hubo un incidente por minúsculas (ver §8).
- `rol_actual()` (SQL, SECURITY DEFINER): devuelve `nombre_rol` del logueado vía `auth.uid()`.
- 3 perfiles Auth creados en dashboard (admin, veterinario, recepcionista) con passwords nuevas.
- Login viejo `rpc login_empleado` ya no se usa en frontend (quedó en la DB; eliminarlo cuando se confirme).

## 4. Matriz de permisos acordada

| Acción | Administrador | Veterinario | Recepcionista |
|---|---|---|---|
| Ver clientes/mascotas/planes/beneficios | ✅ | ✅ | ✅ |
| Crear/editar/borrar clientes/mascotas/planes | ✅ | ❌ | ✅ |
| Entrar a usuarios.html | ✅ | ❌ (rebota a dashboard) | ✅ (solo ver) |
| Crear/borrar empleados | ✅ | ❌ | ❌ |

## 5. Auth en frontend (commits c5634f5, b112f81, c5ad09e)

- `js/compartido/sesion.js`: `getSession`, `getEmpleadoActual` (empleado+rol por
  `user_id`; guarda en sessionStorage solo `{id_empleado, nombre, rol}`),
  `esActivo` (case-insensitive), `protegerRuta({soloAdminRecep})`,
  `aplicarPermisosUI(rol)` + `reaplicarPermisos()` (para tablas renderizadas por JS),
  `cerrarSesion()` (`auth.signOut()` + limpieza + redirect).
- `js/login.js`: `auth.signInWithPassword({email, password})`; input usuario es `type=email`;
  valida estado activo; sin sesión → `index.html`.
- **Gating UI = atributo `data-rol`** (ej: `data-rol="Administrador,Recepcionista"`).
  `aplicarPermisosUI` oculta con `display:none` lo que no matchea (comparación exacta).
  Los renders JS agregan `data-rol` en templates + llaman `reaplicarPermisos()` al final.
- Los 7 logout delegan en `cerrarSesion()`.
- ⚠️ PRINCIPIO DE SEGURIDAD: `sessionStorage` es solo espejo de UI, nunca autorización.
  Editar el rol ahí muestra botones pero RLS frena todo (verificado por diseño).
  La seguridad real vive en las policies, no en ocultar código.

## 6. Edge Function `gestionar-empleado` (EN CURSO — tema activo)

- Objetivo: alta/baja automática de usuarios (crear Auth + fila vinculados; borrar ambos,
  sin huérfanos). Sin CLI/Deno local → creada desde **dashboard Supabase**.
- **Estado actual**: la función hizo boot OK (`booted`, `Listening`), pero el front da
  **CORS preflight failed** (`FunctionsFetchError`) en crear Y borrar.
  Ya descartado: nombre incorrecto (renombrada a `gestionar-empleado`), crash de arranque.
  Pendiente de respuesta: reintentar y ver logs de invocación; si no llegan requests,
  revisar toggle Verify JWT + GET directo a la URL; si el GET da JSON, falta el bloque
  OPTIONS/CORS en el código desplegado.
- Frontend Fase 3 YA implementada (`js/usuarios.js`, commit c5ad09e): `crearUsuario` valida
  (email, clave 6+, rol) e invoca `{action:'crear',...}`; `borrarUsuario` invoca
  `{action:'eliminar',...}`; helper `mensajeErrorFuncion` extrae el error del JSON
  (200 y 4xx/5xx). Ya NO escribe `contraseña` (login 100% Auth).
- Código completo de la función: ver historial del chat (plan Fase 1: serve Deno con
  acciones crear/eliminar, check admin vía empleados+roles, `createUser` con
  `email_confirm:true`, rollback anti-huérfanos, CORS en todas las respuestas).
- Pendientes ligados: FASE 2 (desactivar signup público en Auth settings),
  verificar que el trigger legacy tolere insert sin `contraseña`,
  acción `resetear` clave (preguntado, sin respuesta aún).

## 7. Git (estado al generar este archivo)

- Commits: `fce9367` (inicial) → `c5634f5` (Auth/roles) → `b112f81` (capitalizados,
  baja configuracion.*) → `c5ad09e` (Fase 3 frontend). `origin/main` va en `b112f81`:
  **c5ad09e aún NO pusheado** → correr `git push -u origin main`.
- `.gitignore` protege `js/compartido/supabaseClient.js` y `testConeccion.html` (verificado
  antes de cada commit). `supabaseClient.example.js` es la plantilla pública.
- Working tree con cambios del usuario SIN commitear: M cliente/dashboard/mascotas/usuarios.html,
  D historial.* y panel.html. No tocar sin preguntar.
- Identidad git local: `diiegoc1` / `diiegodelmonte@gmail.com` (solo este repo).

## 8. Incidentes ya resueltos (no reabrir)

1. **Dropdown cortado con 1 fila**: fix `min-height: 280px` en `.table-card` (`css/cliente.css`).
2. **Case de roles**: policies en minúsculas nunca matcheaban → recreadas capitalizadas;
   `mascotas_select_autenticados` creado; `allow_all_anon` + `allow_select_anon` dropeados
   (paso 14). ⚠️ **Verificar**: re-correr consulta `with_check` y confirmar
   `'Administrador'` (último dump mostraba minúsculas ANTES del fix).
3. **Espacio fantasma en "Juan Recepcionista"** (`length 19` vs 18): fix `trim()` en DB.
4. **Select de roles cruzado** (2=Recep/3=Vet): el usuario ya lo corrigió
   (`usuarios.html:137-139` → 1 Admin, 2 Vet, 3 Recep). Resta typo `Veterianario`.
5. **Sidebar mascotas sin Usuarios**: descartado código/CSS/rol con evidencia → era
   caché + sesiones por pestaña en Edge; en Brave fresco funciona. Hábito: una incógnito
   por rol al testear.
6. **Precio de planes**: el usuario lo reimplementó como `input-costo-plan` +
   `formatearCosto` + costo editable (TAILS: no re-agregar `input-precio-plan`).
7. **Iconos por DB**: `iconos.js` lee `planes.icono`; `guardarIconoPlan` eliminado (no usar).
8. Archivos `configuracion.*` creados y luego borrados dos veces; `global.css` duplicado
   de `globals.css`. `testConeccion.html` eliminado.

## 9. Planes pendientes (en orden sugerido)

1. **Cerrar CORS de la Edge Function** (tema activo §6) + matriz de pruebas crear/borrar × roles.
2. **Verificar RLS capitalizado** (`with_check` con 'Administrador') + test 401 del veterinario.
3. **Migración a Vite** (plan detallado en chat: MPA 8 entradas, `base:'./'`, Lucide por CDN,
   `.env` + `.env.example`, convertir ~40 `window.supabaseClient` a imports; NO resuelve el 404).
4. **404 Vercel** (postergado a propósito): con `index.html` en raíz, revisar Root Directory
   (`./`), preset, estado Ready y URL exacta. OJO: env vars de Vercel NO sirven en sitio
   estático (solo con build/Vite) — hoy el deploy no tiene `supabaseClient.js`.
5. **Limpieza legacy**: vaciar columna `contraseña`, eliminar `rpc login_empleado`,
   desactivar signup público, headers `vercel.json`, auditoría de borrados ( backlog ).

## 10. Convenciones de trabajo con el usuario

- Español, respuestas concisas, referencias `archivo:línea`, sin emojis.
- Verificar con ejecución (`node --check`, `git status`) antes de afirmar.
- Preguntar ante tradeoffs (opciones A/B) en vez de asumir; no commitear trabajo ajeno
  sin avisar; push con credencial cacheada (acordado: puede pushear la IA si lo pide).
- Temas sensibles: nunca subir `supabaseClient.js` real (decisión abierta: sigue excluido;
  el usuario lo carga manual en Vercel — avisar método cuando lo haga por el próximo pull).
- `historial.*`: EXCLUIDO de todo plan hasta nuevo aviso.
