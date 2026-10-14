// ============================================
// TEMA CLARO/OSCURO - VetCare
// Se aplica a nivel <html data-theme="...">
// Persiste en localStorage bajo 'vetcare_tema'
// ============================================

const STORAGE_KEY = 'vetcare_tema';

/**
 * Devuelve el tema actual ('light' | 'dark').
 * Prioridad: localStorage > preferencia del sistema > 'light'
 */
function getTemaActual() {
  const guardado = localStorage.getItem(STORAGE_KEY);
  if (guardado === 'light' || guardado === 'dark') return guardado;

  // Detectar preferencia del sistema
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Aplica el tema al <html> y guarda en localStorage.
 */
function setTema(tema) {
  if (tema !== 'light' && tema !== 'dark') return;
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem(STORAGE_KEY, tema);

  // Avisar a la app que cambió (útil para charts, etc.)
  window.dispatchEvent(new CustomEvent('tema-change', { detail: { tema } }));
}

/**
 * Alterna entre light y dark.
 */
function toggleTema() {
  const actual = getTemaActual();
  setTema(actual === 'dark' ? 'light' : 'dark');
}

/**
 * Aplica el tema inmediatamente al cargar.
 * Se ejecuta ANTES de que el DOM se pinte (por eso se llama desde <head>).
 */
function aplicarTemaInicial() {
  const tema = getTemaActual();
  document.documentElement.setAttribute('data-theme', tema);
}

// Aplicar apenas se carga el script (antes del DOMContentLoaded)
aplicarTemaInicial();

// Escuchar cambios de preferencia del sistema
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', (e) => {
    // Solo aplicar si el usuario NO tiene preferencia guardada
    if (!localStorage.getItem(STORAGE_KEY)) {
      setTema(e.matches ? 'dark' : 'light');
    }
  });
}

export {
  getTemaActual,
  setTema,
  toggleTema,
  aplicarTemaInicial,
};