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
    renderizarPantallaCategorias();
  }

  actualizarTotalHeader();
  configurarNavegacion();
  configurarRegistrarGasto();
  configurarPantallaCategorias();
  configurarHistorial();
  configurarModalConfirmar();
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
    renderizarPantallaCategorias();
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

  if (nombre === 'historial') {
    renderizarHistorial();
  } else if (nombre === 'resumen') {
    renderizarResumen();
  }
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
   Modal de confirmación genérico (reemplaza confirm())
   ========================================================================= */

function configurarModalConfirmar() {
  document.getElementById('modal-confirmar-cancelar').addEventListener('click', ocultarModalConfirmar);
}

function pedirConfirmacion(mensaje, textoAceptar, onConfirmar) {
  document.getElementById('modal-confirmar-mensaje').textContent = mensaje;
  const btnAceptar = document.getElementById('modal-confirmar-aceptar');
  btnAceptar.textContent = textoAceptar;
  btnAceptar.onclick = () => {
    onConfirmar();
    ocultarModalConfirmar();
  };
  document.getElementById('modal-confirmar').hidden = false;
}

function ocultarModalConfirmar() {
  document.getElementById('modal-confirmar').hidden = true;
}

/* =========================================================================
   Categorías y subcategorías
   ========================================================================= */

const EMOJIS_DISPONIBLES = [
  '🛒', '💡', '🚗', '🏠', '🩺', '🍔', '👕', '🧾',
  '🎓', '🎉', '🐾', '📱', '💳', '🎁', '⚽', '🎬',
  '✈️', '🍺', '☕', '🧹', '🔧', '📚', '🏥', '🚌',
];

const COLORES_DISPONIBLES = [
  'var(--paleta-1)', 'var(--paleta-2)', 'var(--paleta-3)', 'var(--paleta-4)', 'var(--paleta-5)',
  'var(--paleta-6)', 'var(--paleta-7)', 'var(--paleta-8)', 'var(--paleta-9)', 'var(--paleta-10)',
];

let emojiSeleccionado = EMOJIS_DISPONIBLES[0];
let colorSeleccionado = COLORES_DISPONIBLES[0];
let categoriaEnEdicionId = null;
let subcategoriaEnEdicion = null; // { categoriaId, subcategoriaId | null }

function categoriaTieneGastos(categoriaId) {
  return estado.gastos.some((g) => g.categoriaId === categoriaId);
}

function subcategoriaTieneGastos(subcategoriaId) {
  return estado.gastos.some((g) => g.subcategoriaId === subcategoriaId);
}

function renderizarPantallaCategorias() {
  if (!estado) return;
  const lista = document.getElementById('lista-categorias');
  const listaOcultos = document.getElementById('lista-ocultos');
  lista.innerHTML = '';
  listaOcultos.innerHTML = '';

  estado.categorias.forEach((cat) => {
    if (cat.oculta) {
      const fila = document.createElement('div');
      fila.className = 'oculto-fila';
      fila.innerHTML = '<span>' + cat.emoji + ' ' + cat.nombre + '</span>';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'oculto-fila__btn';
      btn.textContent = 'Mostrar';
      btn.addEventListener('click', () => {
        cat.oculta = false;
        guardarEstado(estado);
        renderizarPantallaCategorias();
        renderizarCategoriasRegistro();
      });
      fila.appendChild(btn);
      listaOcultos.appendChild(fila);
    } else {
      lista.appendChild(crearFilaCategoria(cat));
    }

    cat.subcategorias
      .filter((s) => s.oculta)
      .forEach((sub) => {
        const fila = document.createElement('div');
        fila.className = 'oculto-fila';
        fila.innerHTML = '<span>' + cat.nombre + ' › ' + sub.nombre + '</span>';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'oculto-fila__btn';
        btn.textContent = 'Mostrar';
        btn.addEventListener('click', () => {
          sub.oculta = false;
          guardarEstado(estado);
          renderizarPantallaCategorias();
          renderizarCategoriasRegistro();
        });
        fila.appendChild(btn);
        listaOcultos.appendChild(fila);
      });
  });
}

function crearFilaCategoria(cat) {
  const fila = document.createElement('div');
  fila.className = 'categoria-row';
  fila.dataset.catId = cat.id;

  const cabecera = document.createElement('div');
  cabecera.className = 'categoria-row__cabecera';
  cabecera.innerHTML =
    '<span class="categoria-row__swatch" style="background:' + cat.color + '">' + cat.emoji + '</span>' +
    '<span class="categoria-row__nombre">' + cat.nombre + '</span>' +
    '<button type="button" class="icon-btn btn-editar-categoria" aria-label="Editar categoría">✏️</button>' +
    '<button type="button" class="icon-btn btn-borrar-categoria" aria-label="Borrar categoría">🗑️</button>';
  fila.appendChild(cabecera);

  const subs = document.createElement('div');
  subs.className = 'categoria-row__subs';

  cat.subcategorias
    .filter((s) => !s.oculta)
    .forEach((sub) => {
      const filaSub = document.createElement('div');
      filaSub.className = 'subcategoria-row';
      filaSub.dataset.subId = sub.id;
      filaSub.innerHTML =
        '<span>' + sub.nombre + '</span>' +
        '<button type="button" class="icon-btn btn-editar-subcategoria" aria-label="Editar subcategoría">✏️</button>' +
        '<button type="button" class="icon-btn btn-borrar-subcategoria" aria-label="Borrar subcategoría">🗑️</button>';
      subs.appendChild(filaSub);
    });

  const btnNuevaSub = document.createElement('button');
  btnNuevaSub.type = 'button';
  btnNuevaSub.className = 'btn-chico-link btn-nueva-subcategoria';
  btnNuevaSub.textContent = '+ Subcategoría';
  subs.appendChild(btnNuevaSub);

  fila.appendChild(subs);
  return fila;
}

function renderEmojiGrid() {
  const cont = document.getElementById('emoji-grid');
  cont.innerHTML = '';
  EMOJIS_DISPONIBLES.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-opcion' + (emoji === emojiSeleccionado ? ' is-active' : '');
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      emojiSeleccionado = emoji;
      cont.querySelectorAll('.emoji-opcion').forEach((el) => el.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
    cont.appendChild(btn);
  });
}

function renderColorGrid() {
  const cont = document.getElementById('color-grid');
  cont.innerHTML = '';
  COLORES_DISPONIBLES.forEach((color) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-opcion' + (color === colorSeleccionado ? ' is-active' : '');
    btn.style.background = color;
    btn.addEventListener('click', () => {
      colorSeleccionado = color;
      cont.querySelectorAll('.color-opcion').forEach((el) => el.classList.remove('is-active'));
      btn.classList.add('is-active');
    });
    cont.appendChild(btn);
  });
}

function abrirPanelCategoria(catId) {
  categoriaEnEdicionId = catId || null;
  const categoria = catId ? estado.categorias.find((c) => c.id === catId) : null;

  document.getElementById('panel-categoria-titulo').textContent = categoria ? 'Editar categoría' : 'Nueva categoría';
  document.getElementById('input-categoria-nombre').value = categoria ? categoria.nombre : '';
  emojiSeleccionado = categoria ? categoria.emoji : EMOJIS_DISPONIBLES[0];
  colorSeleccionado = categoria ? categoria.color : COLORES_DISPONIBLES[0];

  renderEmojiGrid();
  renderColorGrid();

  document.getElementById('panel-categoria').hidden = false;
}

function cerrarPanelCategoria() {
  document.getElementById('panel-categoria').hidden = true;
  categoriaEnEdicionId = null;
}

function guardarCategoria() {
  const nombre = document.getElementById('input-categoria-nombre').value.trim();
  if (!nombre) {
    mostrarToast('Escribí un nombre para la categoría');
    return;
  }

  if (categoriaEnEdicionId) {
    const categoria = estado.categorias.find((c) => c.id === categoriaEnEdicionId);
    categoria.nombre = nombre;
    categoria.emoji = emojiSeleccionado;
    categoria.color = colorSeleccionado;
  } else {
    estado.categorias.push({
      id: generarId(),
      nombre,
      emoji: emojiSeleccionado,
      color: colorSeleccionado,
      oculta: false,
      subcategorias: [],
    });
  }

  guardarEstado(estado);
  cerrarPanelCategoria();
  renderizarPantallaCategorias();
  renderizarCategoriasRegistro();
}

function borrarCategoria(catId) {
  const categoria = estado.categorias.find((c) => c.id === catId);
  if (!categoria) return;

  const tieneGastos = categoriaTieneGastos(catId);
  const mensaje = tieneGastos
    ? 'Esta categoría tiene gastos registrados, así que se va a ocultar en vez de borrarse. Vas a poder volver a mostrarla después desde "Categorías y subcategorías ocultas".'
    : '¿Querés borrar la categoría "' + categoria.nombre + '"? Esta acción no se puede deshacer.';

  pedirConfirmacion(mensaje, tieneGastos ? 'Ocultar' : 'Borrar', () => {
    if (tieneGastos) {
      categoria.oculta = true;
    } else {
      estado.categorias = estado.categorias.filter((c) => c.id !== catId);
    }
    guardarEstado(estado);
    renderizarPantallaCategorias();
    renderizarCategoriasRegistro();
  });
}

function abrirPanelSubcat(categoriaId, subcategoriaId) {
  subcategoriaEnEdicion = { categoriaId, subcategoriaId: subcategoriaId || null };
  const categoria = estado.categorias.find((c) => c.id === categoriaId);
  const sub = subcategoriaId ? categoria.subcategorias.find((s) => s.id === subcategoriaId) : null;

  document.getElementById('panel-subcat-editor-titulo').textContent = sub ? 'Editar subcategoría' : 'Nueva subcategoría';
  document.getElementById('input-subcat-nombre').value = sub ? sub.nombre : '';
  document.getElementById('panel-subcat-editor').hidden = false;
}

function cerrarPanelSubcat() {
  document.getElementById('panel-subcat-editor').hidden = true;
  subcategoriaEnEdicion = null;
}

function guardarSubcategoria() {
  const nombre = document.getElementById('input-subcat-nombre').value.trim();
  if (!nombre) {
    mostrarToast('Escribí un nombre para la subcategoría');
    return;
  }

  const categoria = estado.categorias.find((c) => c.id === subcategoriaEnEdicion.categoriaId);
  if (subcategoriaEnEdicion.subcategoriaId) {
    const sub = categoria.subcategorias.find((s) => s.id === subcategoriaEnEdicion.subcategoriaId);
    sub.nombre = nombre;
  } else {
    categoria.subcategorias.push({ id: generarId(), nombre, oculta: false });
  }

  guardarEstado(estado);
  cerrarPanelSubcat();
  renderizarPantallaCategorias();
  renderizarCategoriasRegistro();
}

function borrarSubcategoria(categoriaId, subcategoriaId) {
  const categoria = estado.categorias.find((c) => c.id === categoriaId);
  const sub = categoria.subcategorias.find((s) => s.id === subcategoriaId);
  if (!sub) return;

  const tieneGastos = subcategoriaTieneGastos(subcategoriaId);
  const mensaje = tieneGastos
    ? 'Esta subcategoría tiene gastos registrados, así que se va a ocultar en vez de borrarse. Vas a poder volver a mostrarla después.'
    : '¿Querés borrar la subcategoría "' + sub.nombre + '"? Esta acción no se puede deshacer.';

  pedirConfirmacion(mensaje, tieneGastos ? 'Ocultar' : 'Borrar', () => {
    if (tieneGastos) {
      sub.oculta = true;
    } else {
      categoria.subcategorias = categoria.subcategorias.filter((s) => s.id !== subcategoriaId);
    }
    guardarEstado(estado);
    renderizarPantallaCategorias();
    renderizarCategoriasRegistro();
  });
}

function configurarPantallaCategorias() {
  document.getElementById('btn-nueva-categoria').addEventListener('click', () => abrirPanelCategoria(null));
  document.getElementById('btn-categoria-cancelar').addEventListener('click', cerrarPanelCategoria);
  document.getElementById('btn-categoria-guardar').addEventListener('click', guardarCategoria);
  document.getElementById('btn-subcat-cancelar').addEventListener('click', cerrarPanelSubcat);
  document.getElementById('btn-subcat-guardar').addEventListener('click', guardarSubcategoria);

  document.getElementById('lista-categorias').addEventListener('click', (ev) => {
    const filaCategoria = ev.target.closest('.categoria-row');
    if (!filaCategoria) return;
    const catId = filaCategoria.dataset.catId;

    if (ev.target.closest('.btn-editar-categoria')) {
      abrirPanelCategoria(catId);
    } else if (ev.target.closest('.btn-borrar-categoria')) {
      borrarCategoria(catId);
    } else if (ev.target.closest('.btn-nueva-subcategoria')) {
      abrirPanelSubcat(catId, null);
    } else {
      const filaSub = ev.target.closest('.subcategoria-row');
      if (!filaSub) return;
      const subId = filaSub.dataset.subId;
      if (ev.target.closest('.btn-editar-subcategoria')) {
        abrirPanelSubcat(catId, subId);
      } else if (ev.target.closest('.btn-borrar-subcategoria')) {
        borrarSubcategoria(catId, subId);
      }
    }
  });
}

/* =========================================================================
   Historial
   ========================================================================= */

const hoyHistorial = new Date();
let historialAnio = hoyHistorial.getFullYear();
let historialMes = hoyHistorial.getMonth(); // 0-11
let gastoEnEdicionId = null;

function obtenerCategoriaPorId(id) {
  return estado.categorias.find((c) => c.id === id) || null;
}

function obtenerSubcategoriaPorId(categoria, subId) {
  if (!categoria || !subId) return null;
  return categoria.subcategorias.find((s) => s.id === subId) || null;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function cambiarMesHistorial(delta) {
  historialMes += delta;
  if (historialMes < 0) {
    historialMes = 11;
    historialAnio -= 1;
  } else if (historialMes > 11) {
    historialMes = 0;
    historialAnio += 1;
  }
  renderizarHistorial();
}

function renderizarHistorial() {
  if (!estado) return;

  const label = capitalizar(
    new Date(historialAnio, historialMes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  );
  document.getElementById('historial-mes-label').textContent = label;

  const gastosDelMes = estado.gastos.filter((g) => {
    const [y, m] = g.fecha.split('-').map(Number);
    return y === historialAnio && m === historialMes + 1;
  });

  const totalMes = gastosDelMes.reduce((acc, g) => acc + g.monto, 0);
  document.getElementById('historial-mes-total').textContent = formatearMonto(totalMes);

  const contenido = document.getElementById('historial-contenido');
  contenido.innerHTML = '';

  if (gastosDelMes.length === 0) {
    contenido.innerHTML = '<p class="placeholder">No hay gastos registrados este mes.</p>';
    return;
  }

  const porDia = {};
  gastosDelMes.forEach((g) => {
    if (!porDia[g.fecha]) porDia[g.fecha] = [];
    porDia[g.fecha].push(g);
  });

  Object.keys(porDia)
    .sort((a, b) => (a < b ? 1 : -1))
    .forEach((fecha) => {
      const gastosDelDia = porDia[fecha].sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1));
      const totalDia = gastosDelDia.reduce((acc, g) => acc + g.monto, 0);

      const [y, m, d] = fecha.split('-').map(Number);
      const fechaLabel = capitalizar(
        new Date(y, m - 1, d).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
      );

      const grupo = document.createElement('div');
      grupo.className = 'dia-grupo';

      const cabecera = document.createElement('div');
      cabecera.className = 'dia-grupo__cabecera';
      cabecera.innerHTML =
        '<span>' + fechaLabel + '</span><span class="dia-grupo__total">' + formatearMonto(totalDia) + '</span>';
      grupo.appendChild(cabecera);

      const lista = document.createElement('div');
      lista.className = 'dia-grupo__gastos';

      gastosDelDia.forEach((g) => {
        const categoria = obtenerCategoriaPorId(g.categoriaId);
        const sub = obtenerSubcategoriaPorId(categoria, g.subcategoriaId);
        const nombreCategoria = categoria ? categoria.nombre : 'Categoría borrada';
        const emoji = categoria ? categoria.emoji : '❓';
        const etiquetaCategoria = sub ? nombreCategoria + ' › ' + sub.nombre : nombreCategoria;

        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gasto-item';
        item.dataset.gastoId = g.id;
        item.innerHTML =
          '<span class="gasto-item__emoji">' + emoji + '</span>' +
          '<span class="gasto-item__info">' +
          '<span class="gasto-item__categoria">' + etiquetaCategoria + '</span>' +
          (g.nota ? '<span class="gasto-item__nota">' + g.nota + '</span>' : '') +
          '</span>' +
          '<span class="gasto-item__monto">' + formatearMonto(g.monto) + '</span>';
        lista.appendChild(item);
      });

      grupo.appendChild(lista);
      contenido.appendChild(grupo);
    });
}

function poblarSelectCategoriaEdicion(categoriaIdActual) {
  const select = document.getElementById('editar-categoria');
  select.innerHTML = '';

  estado.categorias
    .filter((c) => !c.oculta || c.id === categoriaIdActual)
    .forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.emoji + ' ' + c.nombre + (c.oculta ? ' (oculta)' : '');
      select.appendChild(opt);
    });

  select.value = categoriaIdActual;
}

function poblarSelectSubcategoriaEdicion(categoriaId, subIdActual) {
  const select = document.getElementById('editar-subcategoria');
  select.innerHTML = '';

  const opcionVacia = document.createElement('option');
  opcionVacia.value = '';
  opcionVacia.textContent = 'Sin subcategoría';
  select.appendChild(opcionVacia);

  const categoria = obtenerCategoriaPorId(categoriaId);
  if (categoria) {
    categoria.subcategorias
      .filter((s) => !s.oculta || s.id === subIdActual)
      .forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.nombre + (s.oculta ? ' (oculta)' : '');
        select.appendChild(opt);
      });
  }

  select.value = subIdActual || '';
}

function abrirPanelEditarGasto(id) {
  const gasto = estado.gastos.find((g) => g.id === id);
  if (!gasto) return;

  gastoEnEdicionId = id;

  const montoTexto = Number.isInteger(gasto.monto) ? String(gasto.monto) : gasto.monto.toFixed(2).replace('.', ',');
  document.getElementById('editar-monto').value = montoTexto;
  document.getElementById('editar-fecha').value = gasto.fecha;
  document.getElementById('editar-nota').value = gasto.nota || '';

  poblarSelectCategoriaEdicion(gasto.categoriaId);
  poblarSelectSubcategoriaEdicion(gasto.categoriaId, gasto.subcategoriaId);

  document.getElementById('panel-editar-gasto').hidden = false;
}

function cerrarPanelEditarGasto() {
  document.getElementById('panel-editar-gasto').hidden = true;
  gastoEnEdicionId = null;
}

function guardarEdicionGasto() {
  const gasto = estado.gastos.find((g) => g.id === gastoEnEdicionId);
  if (!gasto) return;

  const montoTexto = document.getElementById('editar-monto').value.trim().replace(/\./g, '');
  const monto = parsearBufferMonto(montoTexto);
  if (monto <= 0) {
    mostrarToast('Ingresá un monto válido');
    return;
  }

  const fecha = document.getElementById('editar-fecha').value;
  if (!fecha) {
    mostrarToast('Elegí una fecha');
    return;
  }

  gasto.monto = monto;
  gasto.fecha = fecha;
  gasto.categoriaId = document.getElementById('editar-categoria').value;
  gasto.subcategoriaId = document.getElementById('editar-subcategoria').value || null;
  gasto.nota = document.getElementById('editar-nota').value.trim();
  gasto.actualizadoEn = new Date().toISOString();

  guardarEstado(estado);
  cerrarPanelEditarGasto();
  renderizarHistorial();
  actualizarTotalHeader();
  mostrarToast('Gasto actualizado');
}

function borrarGastoEnEdicion() {
  const id = gastoEnEdicionId;
  pedirConfirmacion('¿Querés borrar este gasto? Esta acción no se puede deshacer.', 'Borrar', () => {
    estado.gastos = estado.gastos.filter((g) => g.id !== id);
    guardarEstado(estado);
    cerrarPanelEditarGasto();
    renderizarHistorial();
    actualizarTotalHeader();
    mostrarToast('Gasto borrado');
  });
}

function configurarHistorial() {
  document.getElementById('btn-mes-anterior').addEventListener('click', () => cambiarMesHistorial(-1));
  document.getElementById('btn-mes-siguiente').addEventListener('click', () => cambiarMesHistorial(1));

  document.getElementById('historial-contenido').addEventListener('click', (ev) => {
    const item = ev.target.closest('.gasto-item');
    if (!item) return;
    abrirPanelEditarGasto(item.dataset.gastoId);
  });

  document.getElementById('editar-categoria').addEventListener('change', (ev) => {
    poblarSelectSubcategoriaEdicion(ev.target.value, null);
  });

  document.getElementById('btn-editar-cancelar').addEventListener('click', cerrarPanelEditarGasto);
  document.getElementById('btn-editar-guardar').addEventListener('click', guardarEdicionGasto);
  document.getElementById('btn-editar-borrar').addEventListener('click', borrarGastoEnEdicion);
}

/* =========================================================================
   Resumen mensual
   ========================================================================= */

let resumenAnio = hoyHistorial.getFullYear();
let resumenMes = hoyHistorial.getMonth();

function diasParaPromedio(anio, mes) {
  const hoy = new Date();
  const esMesActual = anio === hoy.getFullYear() && mes === hoy.getMonth();
  if (esMesActual) return hoy.getDate();
  return new Date(anio, mes + 1, 0).getDate();
}

function renderizarResumen() {
  if (!estado) return;

  document.getElementById('resumen-mes-label').textContent = capitalizar(
    new Date(resumenAnio, resumenMes, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  );

  const gastosDelMes = estado.gastos.filter((g) => {
    const [y, m] = g.fecha.split('-').map(Number);
    return y === resumenAnio && m === resumenMes + 1;
  });
  const totalMes = gastosDelMes.reduce((acc, g) => acc + g.monto, 0);
  document.getElementById('resumen-total-monto').textContent = formatearMonto(totalMes);

  renderizarComparacionMensual(totalMes);
  renderizarPromedioDiario(totalMes);
  renderizarCategoriasResumen(gastosDelMes, totalMes);
  renderizarGrafico12Meses();
}

function renderizarComparacionMensual(totalActual) {
  let mesAnterior = resumenMes - 1;
  let anioAnterior = resumenAnio;
  if (mesAnterior < 0) {
    mesAnterior = 11;
    anioAnterior -= 1;
  }
  const totalAnterior = totalDelMes(anioAnterior, mesAnterior);
  const el = document.getElementById('resumen-comparacion');

  if (totalAnterior === 0) {
    el.textContent = totalActual === 0 ? 'Sin gastos registrados este mes.' : 'El mes anterior no tuviste gastos registrados.';
    return;
  }

  const diferencia = totalActual - totalAnterior;
  const porcentaje = (diferencia / totalAnterior) * 100;
  const signo = diferencia >= 0 ? '+' : '';
  el.textContent = signo + porcentaje.toFixed(0) + '% vs. mes anterior (' + signo + formatearMonto(diferencia) + ')';
}

function renderizarPromedioDiario(totalActual) {
  const dias = diasParaPromedio(resumenAnio, resumenMes);
  const promedio = dias > 0 ? totalActual / dias : 0;
  document.getElementById('resumen-promedio').textContent = 'Promedio por día: ' + formatearMonto(promedio);
}

function renderizarCategoriasResumen(gastosDelMes, totalMes) {
  const cont = document.getElementById('resumen-categorias');
  cont.innerHTML = '';

  const totalesPorCategoria = {};
  gastosDelMes.forEach((g) => {
    totalesPorCategoria[g.categoriaId] = (totalesPorCategoria[g.categoriaId] || 0) + g.monto;
  });

  const filas = Object.keys(totalesPorCategoria)
    .map((catId) => ({ catId, total: totalesPorCategoria[catId] }))
    .sort((a, b) => b.total - a.total);

  renderizarDonaCategorias(filas, totalMes);

  if (filas.length === 0) {
    cont.innerHTML = '<p class="placeholder">No hay gastos registrados este mes.</p>';
    return;
  }

  const maxTotal = filas[0].total;

  filas.forEach((f) => {
    cont.appendChild(crearFilaCategoriaResumen(f.catId, f.total, maxTotal, gastosDelMes));
  });
}

function renderizarDonaCategorias(filas, totalMes) {
  const svg = document.getElementById('dona-svg');
  svg.querySelectorAll('circle.dona-segmento').forEach((c) => c.remove());
  document.getElementById('dona-centro-monto').textContent = formatearMonto(totalMes);

  if (!totalMes || totalMes <= 0 || filas.length === 0) return;

  const radio = 40;
  const circunferencia = 2 * Math.PI * radio;
  let acumulado = 0;

  filas.forEach((f) => {
    const categoria = obtenerCategoriaPorId(f.catId);
    const color = categoria ? categoria.color : 'var(--color-texto-suave)';
    const largo = (f.total / totalMes) * circunferencia;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '50');
    circle.setAttribute('cy', '50');
    circle.setAttribute('r', String(radio));
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', '16');
    circle.setAttribute('stroke-dasharray', largo + ' ' + (circunferencia - largo));
    circle.setAttribute('stroke-dashoffset', String(-acumulado));
    circle.setAttribute('transform', 'rotate(-90 50 50)');
    circle.classList.add('dona-segmento');
    svg.appendChild(circle);

    acumulado += largo;
  });
}

function crearFilaCategoriaResumen(catId, total, maxTotal, gastosDelMes) {
  const categoria = obtenerCategoriaPorId(catId);
  const nombre = categoria ? categoria.nombre : 'Categoría borrada';
  const emoji = categoria ? categoria.emoji : '❓';
  const color = categoria ? categoria.color : 'var(--color-texto-suave)';
  const porcentajeAncho = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  const fila = document.createElement('div');
  fila.className = 'categoria-barra';

  fila.innerHTML =
    '<div class="categoria-barra__fila">' +
    '<span class="categoria-barra__nombre">' + emoji + ' ' + nombre + '</span>' +
    '<span class="categoria-barra__monto">' + formatearMonto(total) + '</span>' +
    '</div>' +
    '<div class="categoria-barra__track"><div class="categoria-barra__relleno" style="width:' + porcentajeAncho + '%;background:' + color + '"></div></div>';

  const detalle = document.createElement('div');
  detalle.className = 'categoria-barra__detalle';
  detalle.hidden = true;

  const totalesPorSub = {};
  gastosDelMes
    .filter((g) => g.categoriaId === catId)
    .forEach((g) => {
      const clave = g.subcategoriaId || '_sin';
      totalesPorSub[clave] = (totalesPorSub[clave] || 0) + g.monto;
    });

  Object.keys(totalesPorSub)
    .map((clave) => ({ clave, total: totalesPorSub[clave] }))
    .sort((a, b) => b.total - a.total)
    .forEach((s) => {
      const sub = s.clave !== '_sin' && categoria ? obtenerSubcategoriaPorId(categoria, s.clave) : null;
      const nombreSub = sub ? sub.nombre : 'Sin subcategoría';
      const subfila = document.createElement('div');
      subfila.className = 'categoria-barra__subfila';
      subfila.innerHTML = '<span>' + nombreSub + '</span><span>' + formatearMonto(s.total) + '</span>';
      detalle.appendChild(subfila);
    });

  fila.appendChild(detalle);
  fila.querySelector('.categoria-barra__fila').addEventListener('click', () => {
    detalle.hidden = !detalle.hidden;
  });

  return fila;
}

function renderizarGrafico12Meses() {
  const cont = document.getElementById('grafico-12meses');
  cont.innerHTML = '';

  const ahora = new Date();
  const meses = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() });
  }

  const totales = meses.map((m) => totalDelMes(m.anio, m.mes));
  const maxTotal = Math.max.apply(null, totales);

  meses.forEach((m, idx) => {
    const total = totales[idx];
    const alturaPct = maxTotal > 0 ? Math.max((total / maxTotal) * 100, total > 0 ? 6 : 0) : 0;
    const activa = m.anio === resumenAnio && m.mes === resumenMes;
    const nombreCorto = capitalizar(new Date(m.anio, m.mes, 1).toLocaleDateString('es-AR', { month: 'short' })).replace('.', '');

    const barra = document.createElement('button');
    barra.type = 'button';
    barra.className = 'mes-barra' + (activa ? ' is-active' : '');
    barra.innerHTML =
      '<span class="mes-barra__track"><span class="mes-barra__relleno" style="height:' + alturaPct + '%"></span></span>' +
      '<span class="mes-barra__label">' + nombreCorto + '</span>';
    barra.addEventListener('click', () => {
      resumenAnio = m.anio;
      resumenMes = m.mes;
      renderizarResumen();
    });

    cont.appendChild(barra);
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
