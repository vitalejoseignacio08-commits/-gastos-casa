'use strict';

/* =========================================================================
   Persistencia (localStorage)
   ========================================================================= */

const CLAVE_STORAGE = 'misGastosData';
const VERSION_ESTADO = 1;

function generarId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function categoriasDeEjemplo() {
  const sub = (nombre) => ({ id: generarId(), nombre, oculta: false });
  return [
    { id: generarId(), nombre: 'Supermercado', emoji: '🛒', color: 'var(--paleta-5)', oculta: false,
      subcategorias: [sub('Almacén'), sub('Carnicería'), sub('Verdulería'), sub('Limpieza')] },
    { id: generarId(), nombre: 'Servicios', emoji: '💡', color: 'var(--paleta-3)', oculta: false,
      subcategorias: [sub('Luz'), sub('Gas'), sub('Agua'), sub('Internet'), sub('Celular')] },
    { id: generarId(), nombre: 'Transporte', emoji: '🚗', color: 'var(--paleta-7)', oculta: false,
      subcategorias: [sub('Combustible'), sub('Mantenimiento')] },
    { id: generarId(), nombre: 'Hogar', emoji: '🏠', color: 'var(--paleta-8)', oculta: false,
      subcategorias: [] },
    { id: generarId(), nombre: 'Salud', emoji: '🩺', color: 'var(--paleta-1)', oculta: false,
      subcategorias: [sub('Farmacia'), sub('Consultas')] },
    { id: generarId(), nombre: 'Comida afuera', emoji: '🍔', color: 'var(--paleta-2)', oculta: false,
      subcategorias: [] },
    { id: generarId(), nombre: 'Ropa', emoji: '👕', color: 'var(--paleta-9)', oculta: false,
      subcategorias: [] },
    { id: generarId(), nombre: 'Impuestos', emoji: '🧾', color: 'var(--paleta-6)', oculta: false,
      subcategorias: [] },
  ];
}

function estadoInicial() {
  return {
    version: VERSION_ESTADO,
    gastos: [],
    categorias: categoriasDeEjemplo(),
    config: { ultimaBackup: null },
  };
}

/**
 * Carga el estado desde localStorage.
 * Devuelve { estado, error }. Si el JSON está dañado, estado es null y error
 * trae el texto crudo guardado para que la UI lo muestre, sin tocar el storage.
 */
function cargarEstado() {
  let crudo;
  try {
    crudo = window.localStorage.getItem(CLAVE_STORAGE);
  } catch (e) {
    console.error('No se pudo leer localStorage', e);
    return { estado: estadoInicial(), error: null };
  }

  if (crudo === null) {
    return { estado: estadoInicial(), error: null };
  }

  try {
    const parseado = JSON.parse(crudo);
    if (!parseado || typeof parseado !== 'object' || !Array.isArray(parseado.gastos) || !Array.isArray(parseado.categorias)) {
      throw new Error('Formato inesperado');
    }
    return { estado: parseado, error: null };
  } catch (e) {
    console.error('Datos guardados dañados', e);
    return { estado: null, error: crudo };
  }
}

function guardarEstado(estado) {
  try {
    window.localStorage.setItem(CLAVE_STORAGE, JSON.stringify(estado));
    return true;
  } catch (e) {
    console.error('No se pudo guardar el estado', e);
    return false;
  }
}

/* =========================================================================
   Estado en memoria
   ========================================================================= */

let estado = null;

function iniciarApp() {
  const resultado = cargarEstado();

  if (resultado.error !== null) {
    mostrarModalErrorDatos(resultado.error);
    estado = null;
  } else {
    estado = resultado.estado;
    guardarEstado(estado);
  }

  actualizarTotalHeader();
  configurarNavegacion();
  pedirAlmacenamientoPersistente();
}

/* =========================================================================
   Modal de error de datos dañados
   ========================================================================= */

function mostrarModalErrorDatos(contenidoCrudo) {
  const overlay = document.getElementById('modal-error-datos');
  const textarea = document.getElementById('modal-error-contenido');
  textarea.value = contenidoCrudo;
  overlay.hidden = false;

  document.getElementById('modal-error-copiar').onclick = async () => {
    try {
      await navigator.clipboard.writeText(contenidoCrudo);
      mostrarToast('Contenido copiado');
    } catch (e) {
      textarea.select();
      mostrarToast('Seleccioná y copiá manualmente');
    }
  };

  document.getElementById('modal-error-reiniciar').onclick = () => {
    estado = estadoInicial();
    guardarEstado(estado);
    overlay.hidden = true;
    actualizarTotalHeader();
  };
}

/* =========================================================================
   Formato moneda / helpers
   ========================================================================= */

function formatearMonto(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(valor || 0);
}

function totalDelMes(anio, mes) {
  if (!estado) return 0;
  return estado.gastos
    .filter((g) => {
      const [y, m] = g.fecha.split('-').map(Number);
      return y === anio && m === mes + 1;
    })
    .reduce((acc, g) => acc + g.monto, 0);
}

function actualizarTotalHeader() {
  const hoy = new Date();
  const total = totalDelMes(hoy.getFullYear(), hoy.getMonth());
  document.getElementById('header-total-mes').textContent = formatearMonto(total);
}

/* =========================================================================
   Toast
   ========================================================================= */

let toastTimeout = null;

function mostrarToast(mensaje, accionTexto, accionCallback) {
  const toast = document.getElementById('toast');
  const mensajeEl = document.getElementById('toast-mensaje');
  const accionEl = document.getElementById('toast-accion');

  mensajeEl.textContent = mensaje;

  if (accionTexto && accionCallback) {
    accionEl.hidden = false;
    accionEl.textContent = accionTexto;
    accionEl.onclick = () => {
      accionCallback();
      ocultarToast();
    };
  } else {
    accionEl.hidden = true;
    accionEl.onclick = null;
  }

  toast.hidden = false;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(ocultarToast, 4000);
}

function ocultarToast() {
  document.getElementById('toast').hidden = true;
}

/* =========================================================================
   Navegación por pestañas
   ========================================================================= */

function configurarNavegacion() {
  const tabbar = document.getElementById('tabbar');
  tabbar.addEventListener('click', (ev) => {
    const boton = ev.target.closest('.tabbar__item');
    if (!boton) return;
    irAPantalla(boton.dataset.tab);
  });

  document.getElementById('btn-ajustes').addEventListener('click', () => {
    irAPantalla('ajustes');
  });
}

function irAPantalla(nombre) {
  document.querySelectorAll('.pantalla').forEach((el) => {
    el.hidden = el.dataset.pantalla !== nombre;
  });
  document.querySelectorAll('.tabbar__item').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.tab === nombre);
  });
}

/* =========================================================================
   Almacenamiento persistente
   ========================================================================= */

async function pedirAlmacenamientoPersistente() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (e) {
      console.warn('No se pudo solicitar almacenamiento persistente', e);
    }
  }
}

/* =========================================================================
   Arranque
   ========================================================================= */

document.addEventListener('DOMContentLoaded', iniciarApp);
