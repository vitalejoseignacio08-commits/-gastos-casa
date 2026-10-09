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
    renderizarCategoriasRegistro();
  }

  actualizarTotalHeader();
  configurarNavegacion();
  configurarRegistrarGasto();
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
    renderizarCategoriasRegistro();
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
   Registrar gasto
   ========================================================================= */

let bufferMonto = '';
let fechaSeleccionada = formatearFechaISO(new Date());
let categoriaSeleccionadaId = null;
let subcategoriaElegidaId = null;

function formatearFechaISO(fecha) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatearBufferMonto(buffer) {
  if (buffer === '') return '0';
  const partes = buffer.split(',');
  const enteroCrudo = partes[0] === '' ? '0' : partes[0].replace(/^0+(?=\d)/, '');
  const enteroFormateado = enteroCrudo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  if (partes.length === 1) return enteroFormateado;
  return enteroFormateado + ',' + partes[1];
}

function parsearBufferMonto(buffer) {
  if (buffer === '') return 0;
  const valor = parseFloat(buffer.replace(',', '.'));
  return isNaN(valor) ? 0 : valor;
}

function actualizarDisplayMonto() {
  document.getElementById('monto-display').textContent = '$ ' + formatearBufferMonto(bufferMonto);
}

function shakeMonto() {
  const el = document.getElementById('monto-display');
  el.classList.remove('shake');
  // Forzar reflow para poder re-disparar la animación si ya estaba corriendo.
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 300);
}

function animarGuardado() {
  const el = document.getElementById('monto-display');
  el.classList.add('guardado-ok');
  setTimeout(() => el.classList.remove('guardado-ok'), 400);
}

function actualizarLabelFecha() {
  const hoyISO = formatearFechaISO(new Date());
  const label = document.getElementById('fecha-label');
  if (fechaSeleccionada === hoyISO) {
    label.textContent = 'Hoy';
    return;
  }
  const [y, m, d] = fechaSeleccionada.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  label.textContent = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

function renderizarCategoriasRegistro() {
  const cont = document.getElementById('grid-categorias');
  if (!cont || !estado) return;
  cont.innerHTML = '';
  estado.categorias
    .filter((c) => !c.oculta)
    .forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'categoria-card';
      btn.style.setProperty('--categoria-color', cat.color);
      btn.dataset.categoriaId = cat.id;
      btn.innerHTML =
        '<span class="categoria-card__emoji">' + cat.emoji + '</span>' +
        '<span class="categoria-card__nombre">' + cat.nombre + '</span>';
      cont.appendChild(btn);
    });
}

function onTocarCategoria(categoriaId) {
  const monto = parsearBufferMonto(bufferMonto);
  if (monto <= 0) {
    shakeMonto();
    return;
  }

  const categoria = estado.categorias.find((c) => c.id === categoriaId);
  if (!categoria) return;

  const subcategoriasVisibles = categoria.subcategorias.filter((s) => !s.oculta);

  if (subcategoriasVisibles.length > 0) {
    abrirPanelSubcategoria(categoria, subcategoriasVisibles);
  } else {
    guardarGasto(categoriaId, null, '');
  }
}

function abrirPanelSubcategoria(categoria, subcategoriasVisibles) {
  categoriaSeleccionadaId = categoria.id;
  subcategoriaElegidaId = null;

  document.getElementById('panel-subcategoria-titulo').textContent = categoria.nombre;
  document.getElementById('input-nota').value = '';

  const lista = document.getElementById('lista-subcategorias');
  lista.innerHTML = '';

  const opcionSinSub = crearOpcionSubcategoria('Sin subcategoría', null);
  opcionSinSub.classList.add('is-active');
  lista.appendChild(opcionSinSub);

  subcategoriasVisibles.forEach((sub) => {
    lista.appendChild(crearOpcionSubcategoria(sub.nombre, sub.id));
  });

  document.getElementById('panel-subcategoria').hidden = false;
}

function crearOpcionSubcategoria(nombre, subId) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'subcategoria-opcion';
  btn.textContent = nombre;
  btn.dataset.subId = subId === null ? '' : subId;
  btn.addEventListener('click', () => {
    subcategoriaElegidaId = subId;
    document.querySelectorAll('.subcategoria-opcion').forEach((el) => el.classList.remove('is-active'));
    btn.classList.add('is-active');
  });
  return btn;
}

function cerrarPanelSubcategoria() {
  document.getElementById('panel-subcategoria').hidden = true;
  categoriaSeleccionadaId = null;
  subcategoriaElegidaId = null;
}

function guardarGasto(categoriaId, subcategoriaId, nota) {
  const monto = parsearBufferMonto(bufferMonto);
  if (monto <= 0) return;

  const ahora = new Date().toISOString();
  const gasto = {
    id: generarId(),
    monto,
    fecha: fechaSeleccionada,
    categoriaId,
    subcategoriaId: subcategoriaId || null,
    nota: nota || '',
    creadoEn: ahora,
    actualizadoEn: ahora,
  };

  estado.gastos.push(gasto);
  guardarEstado(estado);
  actualizarTotalHeader();

  bufferMonto = '';
  actualizarDisplayMonto();
  cerrarPanelSubcategoria();
  animarGuardado();

  mostrarToast('Gasto guardado', 'Deshacer', () => deshacerGasto(gasto.id));
}

function deshacerGasto(id) {
  estado.gastos = estado.gastos.filter((g) => g.id !== id);
  guardarEstado(estado);
  actualizarTotalHeader();
}

function configurarRegistrarGasto() {
  document.getElementById('teclado-numerico').addEventListener('click', (ev) => {
    const boton = ev.target.closest('.tecla');
    if (!boton || !estado) return;
    const tecla = boton.dataset.tecla;

    if (tecla === 'borrar') {
      bufferMonto = bufferMonto.slice(0, -1);
    } else if (tecla === ',') {
      if (!bufferMonto.includes(',')) {
        bufferMonto = (bufferMonto === '' ? '0' : bufferMonto) + ',';
      }
    } else {
      const partes = bufferMonto.split(',');
      const decimales = partes[1];
      const digitosEnteros = partes[0].replace(/^0+(?=\d)/, '').length;
      if (decimales !== undefined && decimales.length >= 2) return;
      if (decimales === undefined && digitosEnteros >= 9) return;
      bufferMonto += tecla;
    }

    actualizarDisplayMonto();
  });

  document.getElementById('grid-categorias').addEventListener('click', (ev) => {
    const tarjeta = ev.target.closest('.categoria-card');
    if (!tarjeta || !estado) return;
    onTocarCategoria(tarjeta.dataset.categoriaId);
  });

  const inputFecha = document.getElementById('input-fecha');
  inputFecha.value = fechaSeleccionada;

  document.getElementById('btn-cambiar-fecha').addEventListener('click', () => {
    if (typeof inputFecha.showPicker === 'function') {
      inputFecha.showPicker();
    } else {
      inputFecha.click();
    }
  });

  inputFecha.addEventListener('change', () => {
    if (inputFecha.value) {
      fechaSeleccionada = inputFecha.value;
      actualizarLabelFecha();
    }
  });

  document.getElementById('btn-subcategoria-cancelar').addEventListener('click', cerrarPanelSubcategoria);

  document.getElementById('btn-subcategoria-guardar').addEventListener('click', () => {
    const nota = document.getElementById('input-nota').value.trim();
    guardarGasto(categoriaSeleccionadaId, subcategoriaElegidaId, nota);
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
