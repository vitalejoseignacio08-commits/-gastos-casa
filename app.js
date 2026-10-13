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
  configurarMangometro();
  configurarRacha();
  configurarRegistrarGasto();
  configurarPantallaCategorias();
  configurarHistorial();
  configurarResumen();
  configurarModalConfirmar();
  configurarAjustes();
  actualizarAvisoBackup();
  pedirAlmacenamientoPersistente();
  registrarServiceWorker();
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
    actualizarAvisoBackup();
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
  const el = document.getElementById('header-total-mes');
  const texto = formatearMonto(total);
  if (el.dataset.inicializado && el.textContent !== texto) animarElemento(el, 'actualizado', 500);
  el.dataset.inicializado = '1';
  el.textContent = texto;
  // Achicar la letra si el total es largo, para que no choque con el botón de Ajustes.
  el.classList.toggle('app-header__total-monto--mediano', texto.length > 12 && texto.length <= 14);
  el.classList.toggle('app-header__total-monto--chico', texto.length > 14);
  ajustarTotalAlAncho();
  actualizarMangometro();
  actualizarRacha();
  actualizarBotonRegistrar();
}

// Si el total no entra en el espacio libre del encabezado (celulares angostos
// o montos muy largos), se achica la letra de a un píxel hasta que entre.
function ajustarTotalAlAncho() {
  const el = document.getElementById('header-total-mes');
  el.style.fontSize = '';
  let tamano = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth && tamano > 14) {
    tamano -= 1;
    el.style.fontSize = tamano + 'px';
  }
}

window.addEventListener('resize', () => ajustarTotalAlAncho());
// La tipografía puede terminar de cargar después: recalcular con el ancho real.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ajustarTotalAlAncho());

/* =========================================================================
   Mangómetro: el mango del encabezado se llena franja por franja según lo
   gastado este mes comparado con el total del mes anterior.
   ========================================================================= */

function datosMangometro() {
  const hoy = new Date();
  const anterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const totalActual = totalDelMes(hoy.getFullYear(), hoy.getMonth());
  const totalAnterior = totalDelMes(anterior.getFullYear(), anterior.getMonth());
  const nombreMesAnterior = anterior.toLocaleDateString('es-AR', { month: 'long' });
  const proporcion = totalAnterior > 0 ? totalActual / totalAnterior : null;
  return { totalActual, totalAnterior, nombreMesAnterior, proporcion };
}

function mensajeMangometro(d) {
  if (d.proporcion === null) {
    return d.totalActual > 0
      ? 'En ' + d.nombreMesAnterior + ' no registraste gastos, así que todavía no hay con qué comparar.'
      : 'Cuando registres gastos, el mango se va a ir llenando comparado con el mes anterior.';
  }
  const porcentaje = Math.round(d.proporcion * 100);
  if (porcentaje <= 100) {
    return 'Llevás el ' + porcentaje + '% de lo que gastaste en ' + d.nombreMesAnterior +
      ' (' + formatearMonto(d.totalActual) + ' de ' + formatearMonto(d.totalAnterior) + ').';
  }
  return 'Ya gastaste un ' + (porcentaje - 100) + '% más que en ' + d.nombreMesAnterior +
    ' (' + formatearMonto(d.totalActual) + ' contra ' + formatearMonto(d.totalAnterior) + ').';
}

function actualizarMangometro() {
  const boton = document.getElementById('mangometro');
  if (!boton) return;
  const d = datosMangometro();
  const franjas = boton.querySelectorAll('.mangometro__franja');
  const total = franjas.length;
  // Con algo gastado se enciende al menos una franja, para que se note el movimiento.
  let encendidas = 0;
  if (d.proporcion !== null) {
    encendidas = Math.min(total, Math.round(d.proporcion * total));
    if (d.totalActual > 0 && encendidas === 0) encendidas = 1;
  }
  // Las franjas se encienden de abajo hacia arriba.
  franjas.forEach((franja, i) => {
    franja.classList.toggle('is-encendida', i >= total - encendidas);
    // Se encienden en cascada desde abajo.
    franja.style.transitionDelay = (total - 1 - i) * 35 + 'ms';
  });
  boton.classList.toggle('is-excedido', d.proporcion !== null && d.proporcion > 1);
  boton.setAttribute('aria-label', 'Mangómetro: ' + mensajeMangometro(d));
}

/* =========================================================================
   Racha: días seguidos "al mango". Un día cuenta si tiene al menos un gasto
   o si se marcó "Hoy no gasté" (config.diasSinGastos). La racha de hoy no se
   corta hasta que termina el día.
   ========================================================================= */

const ICONO_CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const ICONO_FLECHA = '<path d="M5 12h14M13 6l6 6-6 6"/>';

function listaDiasSinGastos() {
  if (!estado || !estado.config || !Array.isArray(estado.config.diasSinGastos)) return [];
  return estado.config.diasSinGastos;
}

function diasCubiertos() {
  const dias = new Set(listaDiasSinGastos());
  if (estado) estado.gastos.forEach((g) => dias.add(g.fecha));
  return dias;
}

function diaCubierto(fechaISO) {
  return diasCubiertos().has(fechaISO);
}

function sumarDias(fechaISO, delta) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return formatearFechaISO(new Date(y, m - 1, d + delta));
}

function calcularRacha() {
  const dias = diasCubiertos();
  const hoy = formatearFechaISO(new Date());
  const hoyCubierto = dias.has(hoy);
  // Si hoy todavía no está cubierto, la racha se cuenta hasta ayer.
  let dia = hoyCubierto ? hoy : sumarDias(hoy, -1);
  let actual = 0;
  while (dias.has(dia)) {
    actual += 1;
    dia = sumarDias(dia, -1);
  }

  let mejor = 0;
  let seguidos = 0;
  let anterior = null;
  Array.from(dias)
    .filter((f) => f <= hoy)
    .sort()
    .forEach((f) => {
      seguidos = anterior && sumarDias(anterior, 1) === f ? seguidos + 1 : 1;
      mejor = Math.max(mejor, seguidos);
      anterior = f;
    });

  return { actual, mejor: Math.max(mejor, actual), hoyCubierto };
}

function textoDias(n) {
  return n + (n === 1 ? ' día' : ' días');
}

function mensajeRacha(r) {
  if (r.actual === 0) {
    return 'Anotá un gasto o marcá "Hoy no gasté" para empezar tu racha.';
  }
  if (!r.hoyCubierto) {
    return 'Llevás ' + textoDias(r.actual) + ' al mango. Anotá un gasto o marcá "Hoy no gasté" para no cortar la racha.';
  }
  const mejor = r.mejor > r.actual ? ' Tu mejor racha: ' + textoDias(r.mejor) + '.' : ' ¡Es tu mejor racha!';
  return 'Llevás ' + textoDias(r.actual) + ' seguidos al mango.' + (r.actual > 1 ? mejor : '');
}

function actualizarRacha() {
  const boton = document.getElementById('racha');
  if (!boton) return;
  const r = calcularRacha();
  const numero = document.getElementById('racha-dias');
  if (numero.textContent !== String(r.actual) && boton.dataset.inicializado) {
    animarElemento(boton, 'actualizado', 500);
  }
  boton.dataset.inicializado = '1';
  numero.textContent = r.actual;
  boton.classList.toggle('is-activa', r.hoyCubierto);
  boton.setAttribute('aria-label', 'Racha: ' + mensajeRacha(r));
}

// "Hoy no gasté" solo se ofrece con el monto en 0, para un día que todavía no
// tiene gastos ni está marcado, y que no sea futuro.
function puedeMarcarSinGastos() {
  if (!estado || parsearBufferMonto(bufferMonto) > 0) return false;
  if (fechaSeleccionada > formatearFechaISO(new Date())) return false;
  return !diaCubierto(fechaSeleccionada);
}

function actualizarBotonRegistrar() {
  const boton = document.getElementById('btn-elegir-categoria');
  if (!boton) return;
  const sinMonto = parsearBufferMonto(bufferMonto) <= 0;
  const sinGastos = puedeMarcarSinGastos();
  const esHoy = fechaSeleccionada === formatearFechaISO(new Date());
  const html = sinGastos
    ? (esHoy ? 'Hoy no gasté' : 'No gasté ese día') + svgIcono(ICONO_CHECK)
    : 'Elegir categoría' + svgIcono(ICONO_FLECHA);
  if (boton.dataset.html !== html) {
    boton.innerHTML = html;
    boton.dataset.html = html;
  }
  boton.classList.toggle('is-sin-gasto', sinGastos);
  boton.classList.toggle('is-vacio', sinMonto && !sinGastos);
}

function marcarDiaSinGastos() {
  const fecha = fechaSeleccionada;
  if (!estado.config) estado.config = { ultimaBackup: null };
  if (!Array.isArray(estado.config.diasSinGastos)) estado.config.diasSinGastos = [];
  estado.config.diasSinGastos.push(fecha);
  guardarEstado(estado);
  actualizarTotalHeader();
  animarGuardado();
  const r = calcularRacha();
  const texto = fecha === formatearFechaISO(new Date())
    ? 'Día sin gastos anotado. Racha: ' + textoDias(r.actual) + ' 🔥'
    : 'Día marcado sin gastos.';
  mostrarToast(texto, 'Deshacer', () => desmarcarDiaSinGastos(fecha));
}

function desmarcarDiaSinGastos(fecha) {
  estado.config.diasSinGastos = listaDiasSinGastos().filter((f) => f !== fecha);
  guardarEstado(estado);
  actualizarTotalHeader();
}

function configurarRacha() {
  document.getElementById('racha').addEventListener('click', () => {
    mostrarToast(mensajeRacha(calcularRacha()));
  });
}

function configurarMangometro() {
  document.getElementById('mangometro').addEventListener('click', () => {
    mostrarToast(mensajeMangometro(datosMangometro()));
  });
}

/* =========================================================================
   Íconos y microanimaciones (solo presentación)
   ========================================================================= */

// Las categorías guardan un emoji; acá se traduce a un ícono SVG para mostrarlo.
// Si el emoji no tiene ícono (por ejemplo, de una copia importada) se muestra el emoji.
const ICONOS_CATEGORIA = {
  '🛒': '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.6l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.9a1.5 1.5 0 0 0 1.5-1.1L21 7H6"/>',
  '💡': '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>',
  '🚗': '<path d="M5 17H3.5a1 1 0 0 1-1-1v-3.2a2 2 0 0 1 .6-1.4L5 9.5l1.6-3.6A1.5 1.5 0 0 1 8 5h8a1.5 1.5 0 0 1 1.4.9L19 9.5l1.9 1.9a2 2 0 0 1 .6 1.4V16a1 1 0 0 1-1 1H19"/><path d="M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 9.5h14"/>',
  '🏠': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v10.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9"/>',
  '🩺': '<path d="M20.4 12.6 12 21l-8.4-8.4a5 5 0 0 1 7.1-7.1L12 6.8l1.3-1.3a5 5 0 0 1 7.1 7.1z"/><path d="M6.5 12.5h2.5l1.5-2.5 2.5 5 1.5-2.5h3"/>',
  '🍔': '<path d="M7 3v8"/><path d="M4.5 3v5a2.5 2.5 0 0 0 5 0V3"/><path d="M7 11v10"/><path d="M17 21V3c-2.2 1.2-3.5 3.8-3.5 7v3H17"/>',
  '👕': '<path d="M8 3 3 6l2 4.5 2.5-1V21h9V9.5l2.5 1L21 6l-5-3a4 4 0 0 1-8 0z"/>',
  '🧾': '<path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21z"/><path d="M9 8h6"/><path d="M9 12h6"/><path d="M9 16h3"/>',
  '🎓': '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6 11.5V16c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5"/><path d="M22 9.5V15"/>',
  '🎉': '<path d="M4 20 8.5 7.5l8 8z"/><path d="M14 4.5c.7 1 .7 2.3 0 3.3"/><path d="M19.5 10c-1-.7-2.3-.7-3.3 0"/><path d="M17 3v1"/><path d="M21 7h-1"/>',
  '🐾': '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14.5" cy="5.5" r="1.8"/><circle cx="18" cy="10" r="1.8"/><path d="M12 11.5c-2.5 0-5.5 3.5-5.5 6a2.5 2.5 0 0 0 3.2 2.4c1-.3 1.6-.5 2.3-.5s1.3.2 2.3.5a2.5 2.5 0 0 0 3.2-2.4c0-2.5-3-6-5.5-6z"/>',
  '📱': '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  '💳': '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/><path d="M6.5 15h4"/>',
  '🎁': '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8"/><path d="M12 8v13"/><path d="M12 8C10.5 4 7 4 7 6s2.5 2 5 2c2.5 0 5 0 5-2s-3.5-2-5 2z"/>',
  '⚽': '<circle cx="12" cy="12" r="9"/><path d="m12 7.5 4 2.9-1.5 4.6h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.3-1.4M14.5 15l2.6 3.8M9.5 15l-2.6 3.8M8 10.4 3.7 9"/>',
  '🎬': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  '✈': '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="M21 3 10 13"/>',
  '🍺': '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10h2a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2"/><path d="M5 8a2.5 2.5 0 0 1 2.5-4c.6-.9 1.6-1.5 2.7-1.5 1.5 0 2.7 1 3 2.3A2 2 0 0 1 15 8"/><path d="M8.5 12v5M11.5 12v5"/>',
  '☕': '<path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8 3c-.5 1 .5 1.5 0 2.5M12 3c-.5 1 .5 1.5 0 2.5"/>',
  '🧹': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  '🔧': '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  '📚': '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3"/><path d="M8 7h8"/>',
  '🏥': '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
  '🚌': '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16"/><path d="M8 14.5h.01M16 14.5h.01" stroke-width="2.6"/><path d="M7 18v3M17 18v3"/>',
  '❓': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><path d="M12 17h.01" stroke-width="2.6"/>',
};

const ICONOS_UI = {
  editar: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  borrar: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/>',
};

function svgIcono(contenido) {
  return '<svg class="icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + contenido + '</svg>';
}

function htmlIconoEmoji(emoji) {
  const clave = String(emoji || '❓').replace(/️/g, '');
  const trazo = ICONOS_CATEGORIA[clave];
  return trazo ? svgIcono(trazo) : '<span class="icono-emoji">' + emoji + '</span>';
}

function htmlChipCategoria(categoria, chico) {
  const emoji = categoria ? categoria.emoji : '❓';
  const color = categoria ? categoria.color : 'var(--color-texto-suave)';
  return '<span class="cat-chip' + (chico ? ' cat-chip--chico' : '') + '" style="--cat:' + color + '">' +
    htmlIconoEmoji(emoji) + '</span>';
}

// Reinicia una animación CSS aunque ya se esté reproduciendo.
function animarElemento(el, clase, duracionMs) {
  if (!el) return;
  el.classList.remove(clase);
  void el.offsetWidth;
  el.classList.add(clase);
  setTimeout(() => el.classList.remove(clase), duracionMs || 600);
}

// Anima la salida de un elemento y después vuelve a dibujar la pantalla.
function animarSalidaYRenderizar(el, renderizar) {
  if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    renderizar();
    return;
  }
  el.classList.add('saliendo');
  setTimeout(renderizar, 260);
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

  // Ocultar y volver a mostrar reinicia la animación de entrada si ya estaba visible.
  toast.hidden = true;
  void toast.offsetWidth;
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
  document.getElementById('btn-ajustes').classList.toggle('is-active', nombre === 'ajustes');

  if (nombre === 'historial') {
    renderizarHistorial();
  } else if (nombre === 'resumen') {
    renderizarResumen();
  } else if (nombre === 'ajustes') {
    actualizarAvisoBackup();
    actualizarEstadoAlmacenamiento();
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
  const el = document.getElementById('monto-display');
  const numero = formatearBufferMonto(bufferMonto);
  const texto = '$ ' + numero;
  el.innerHTML = '<span class="monto-display__moneda">$</span>' + numero;
  el.classList.toggle('monto-display--mediano', texto.length > 10 && texto.length <= 13);
  el.classList.toggle('monto-display--chico', texto.length > 13);
  actualizarBotonRegistrar();
}

function abrirPanelElegirCategoria() {
  if (puedeMarcarSinGastos()) {
    marcarDiaSinGastos();
    return;
  }
  if (parsearBufferMonto(bufferMonto) <= 0) {
    shakeMonto();
    return;
  }
  document.getElementById('panel-elegir-monto').textContent = '$ ' + formatearBufferMonto(bufferMonto);
  document.getElementById('panel-elegir-categoria').hidden = false;
}

function cerrarPanelElegirCategoria() {
  document.getElementById('panel-elegir-categoria').hidden = true;
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
  } else {
    const [y, m, d] = fechaSeleccionada.split('-').map(Number);
    const fecha = new Date(y, m - 1, d);
    label.textContent = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }
  actualizarBotonRegistrar();
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
      btn.style.setProperty('--cat', cat.color);
      btn.dataset.categoriaId = cat.id;
      btn.innerHTML =
        htmlChipCategoria(cat) +
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
  // Si ese día estaba marcado como "sin gastos", la marca ya no corresponde.
  if (listaDiasSinGastos().includes(gasto.fecha)) {
    estado.config.diasSinGastos = listaDiasSinGastos().filter((f) => f !== gasto.fecha);
  }
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
  const teclado = document.getElementById('teclado-numerico');
  // Feedback visual inmediato al apoyar el dedo (en iOS :active no siempre se dispara).
  teclado.addEventListener('pointerdown', (ev) => {
    const boton = ev.target.closest('.tecla');
    if (boton) boton.classList.add('is-pressed');
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((tipo) => {
    teclado.addEventListener(tipo, () => {
      teclado.querySelectorAll('.tecla.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
    });
  });

  teclado.addEventListener('click', (ev) => {
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
    cerrarPanelElegirCategoria();
    onTocarCategoria(tarjeta.dataset.categoriaId);
  });

  document.getElementById('btn-elegir-categoria').addEventListener('click', abrirPanelElegirCategoria);
  document.getElementById('btn-elegir-cancelar').addEventListener('click', cerrarPanelElegirCategoria);
  // Tocar fuera del panel también lo cierra.
  document.getElementById('panel-elegir-categoria').addEventListener('click', (ev) => {
    if (ev.target === ev.currentTarget) cerrarPanelElegirCategoria();
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
      fila.innerHTML = '<span>' + htmlChipCategoria(cat, true) + cat.nombre + '</span>';
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
    htmlChipCategoria(cat) +
    '<span class="categoria-row__nombre">' + cat.nombre + '</span>' +
    '<button type="button" class="icon-btn btn-editar-categoria" aria-label="Editar categoría">' + svgIcono(ICONOS_UI.editar) + '</button>' +
    '<button type="button" class="icon-btn icon-btn--peligro btn-borrar-categoria" aria-label="Borrar categoría">' + svgIcono(ICONOS_UI.borrar) + '</button>';
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
        '<button type="button" class="icon-btn btn-editar-subcategoria" aria-label="Editar subcategoría">' + svgIcono(ICONOS_UI.editar) + '</button>' +
        '<button type="button" class="icon-btn icon-btn--peligro btn-borrar-subcategoria" aria-label="Borrar subcategoría">' + svgIcono(ICONOS_UI.borrar) + '</button>';
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
    btn.innerHTML = htmlIconoEmoji(emoji);
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

  let idGuardado = categoriaEnEdicionId;
  if (categoriaEnEdicionId) {
    const categoria = estado.categorias.find((c) => c.id === categoriaEnEdicionId);
    categoria.nombre = nombre;
    categoria.emoji = emojiSeleccionado;
    categoria.color = colorSeleccionado;
  } else {
    idGuardado = generarId();
    estado.categorias.push({
      id: idGuardado,
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
  resaltarFilaCategoria(idGuardado);
}

function filaCategoriaPorId(catId) {
  return document.querySelector('.categoria-row[data-cat-id="' + CSS.escape(catId) + '"]');
}

function resaltarFilaCategoria(catId) {
  const fila = filaCategoriaPorId(catId);
  if (!fila) return;
  fila.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  animarElemento(fila, 'resaltado', 1200);
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
    renderizarCategoriasRegistro();
    animarSalidaYRenderizar(filaCategoriaPorId(catId), renderizarPantallaCategorias);
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
  resaltarFilaCategoria(categoria.id);
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
    renderizarCategoriasRegistro();
    const filaCat = filaCategoriaPorId(categoriaId);
    const filaSub = filaCat ? filaCat.querySelector('.subcategoria-row[data-sub-id="' + CSS.escape(subcategoriaId) + '"]') : null;
    animarSalidaYRenderizar(filaSub, renderizarPantallaCategorias);
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
        const etiquetaCategoria = sub ? nombreCategoria + ' › ' + sub.nombre : nombreCategoria;

        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'gasto-item';
        item.dataset.gastoId = g.id;
        item.innerHTML =
          htmlChipCategoria(categoria) +
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

  const item = itemGastoPorId(gasto.id);
  if (item) {
    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    animarElemento(item, 'resaltado', 1200);
  }
}

function borrarGastoEnEdicion() {
  const id = gastoEnEdicionId;
  pedirConfirmacion('¿Querés borrar este gasto? Esta acción no se puede deshacer.', 'Borrar', () => {
    estado.gastos = estado.gastos.filter((g) => g.id !== id);
    guardarEstado(estado);
    cerrarPanelEditarGasto();
    actualizarTotalHeader();
    mostrarToast('Gasto borrado');
    animarSalidaYRenderizar(itemGastoPorId(id), renderizarHistorial);
  });
}

function itemGastoPorId(id) {
  return document.querySelector('.gasto-item[data-gasto-id="' + CSS.escape(id) + '"]');
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

function cambiarMesResumen(delta) {
  resumenMes += delta;
  if (resumenMes < 0) {
    resumenMes = 11;
    resumenAnio -= 1;
  } else if (resumenMes > 11) {
    resumenMes = 0;
    resumenAnio += 1;
  }
  renderizarResumen();
}

function configurarResumen() {
  document.getElementById('btn-resumen-mes-anterior').addEventListener('click', () => cambiarMesResumen(-1));
  document.getElementById('btn-resumen-mes-siguiente').addEventListener('click', () => cambiarMesResumen(1));
}

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
  const color = categoria ? categoria.color : 'var(--color-texto-suave)';
  const porcentajeAncho = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  const fila = document.createElement('div');
  fila.className = 'categoria-barra';

  fila.innerHTML =
    '<div class="categoria-barra__fila">' +
    '<span class="categoria-barra__nombre">' + htmlChipCategoria(categoria, true) + nombre + '</span>' +
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
   Copias de seguridad
   ========================================================================= */

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function registrarBackupRealizado() {
  estado.config.ultimaBackup = new Date().toISOString();
  guardarEstado(estado);
  actualizarAvisoBackup();
}

function exportarJSON() {
  const contenido = JSON.stringify(estado, null, 2);
  const blob = new Blob([contenido], { type: 'application/json' });
  descargarBlob(blob, 'mis-gastos-' + formatearFechaISO(new Date()) + '.json');
  registrarBackupRealizado();
  mostrarToast('Copia exportada');
}

function escaparCampoCsv(valor) {
  const texto = String(valor === undefined || valor === null ? '' : valor);
  if (texto.includes(';') || texto.includes('"') || texto.includes('\n')) {
    return '"' + texto.replace(/"/g, '""') + '"';
  }
  return texto;
}

function exportarCSV() {
  const encabezado = ['Fecha', 'Categoría', 'Subcategoría', 'Nota', 'Monto'];

  const filas = estado.gastos
    .slice()
    .sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map((g) => {
      const categoria = obtenerCategoriaPorId(g.categoriaId);
      const sub = obtenerSubcategoriaPorId(categoria, g.subcategoriaId);
      const montoTexto = g.monto.toFixed(2).replace('.', ',');
      return [g.fecha, categoria ? categoria.nombre : '', sub ? sub.nombre : '', g.nota || '', montoTexto];
    });

  const lineas = [encabezado, ...filas].map((fila) => fila.map(escaparCampoCsv).join(';'));
  const contenido = '﻿' + lineas.join('\r\n');
  const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8' });
  descargarBlob(blob, 'mis-gastos-' + formatearFechaISO(new Date()) + '.csv');
  registrarBackupRealizado();
  mostrarToast('CSV exportado');
}

function intentarImportarJSON(contenidoTexto) {
  let datos;
  try {
    datos = JSON.parse(contenidoTexto);
  } catch (e) {
    mostrarToast('El archivo no es un JSON válido');
    return;
  }

  if (!datos || typeof datos !== 'object' || !Array.isArray(datos.gastos) || !Array.isArray(datos.categorias)) {
    mostrarToast('El archivo no tiene el formato que espera la app');
    return;
  }

  const cantidad = datos.gastos.length;
  const mensaje =
    'Este archivo tiene ' + cantidad + (cantidad === 1 ? ' gasto registrado' : ' gastos registrados') +
    '. Si confirmás, se va a reemplazar todo lo que tenés guardado ahora en este dispositivo.';

  pedirConfirmacion(mensaje, 'Reemplazar datos', () => {
    estado = datos;
    if (!estado.config) estado.config = { ultimaBackup: null };
    if (typeof estado.version !== 'number') estado.version = VERSION_ESTADO;

    guardarEstado(estado);
    renderizarCategoriasRegistro();
    renderizarPantallaCategorias();
    actualizarTotalHeader();
    actualizarAvisoBackup();
    mostrarToast('Datos importados correctamente');
  });
}

function actualizarAvisoBackup() {
  const aviso = document.getElementById('aviso-backup');
  if (!estado || estado.gastos.length === 0) {
    aviso.hidden = true;
    return;
  }

  const ultimaBackup = estado.config.ultimaBackup;
  if (!ultimaBackup) {
    aviso.hidden = false;
    aviso.textContent = 'Todavía no hiciste ninguna copia de seguridad. Te recomendamos exportar tus datos.';
    return;
  }

  const dias = Math.floor((Date.now() - new Date(ultimaBackup).getTime()) / (1000 * 60 * 60 * 24));
  if (dias > 30) {
    aviso.hidden = false;
    aviso.textContent = 'Pasaron ' + dias + ' días desde tu última copia de seguridad. Te recomendamos exportar tus datos de nuevo.';
  } else {
    aviso.hidden = true;
  }
}

function configurarAjustes() {
  document.getElementById('btn-exportar-json').addEventListener('click', exportarJSON);
  document.getElementById('btn-exportar-csv').addEventListener('click', exportarCSV);

  document.getElementById('input-importar-json').addEventListener('change', (ev) => {
    const archivo = ev.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => {
      intentarImportarJSON(lector.result);
      ev.target.value = '';
    };
    lector.onerror = () => {
      mostrarToast('No se pudo leer el archivo');
      ev.target.value = '';
    };
    lector.readAsText(archivo);
  });
}

/* =========================================================================
   Almacenamiento persistente, instalación y service worker
   ========================================================================= */

async function pedirAlmacenamientoPersistente() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch (e) {
      console.warn('No se pudo solicitar almacenamiento persistente', e);
    }
  }
  actualizarEstadoAlmacenamiento();
}

async function actualizarEstadoAlmacenamiento() {
  const elPersistido = document.getElementById('estado-almacenamiento-persistido');
  const elInstalada = document.getElementById('estado-almacenamiento-instalada');
  if (!elPersistido || !elInstalada) return;

  let persistido = false;
  if (navigator.storage && navigator.storage.persisted) {
    try {
      persistido = await navigator.storage.persisted();
    } catch (e) {
      persistido = false;
    }
  }
  elPersistido.textContent = persistido
    ? 'Protegido: el sistema no va a borrar estos datos para liberar espacio.'
    : 'No protegido: en algunos casos el sistema podría llegar a borrar estos datos si el dispositivo necesita espacio.';

  const esStandalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  elInstalada.textContent = esStandalone
    ? 'Estás usando la app instalada en tu celular.'
    : 'Estás usando la app desde el navegador (no instalada). Instalala para una mejor experiencia.';
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => {
      console.warn('No se pudo registrar el service worker', e);
    });
  });
}

/* =========================================================================
   Arranque
   ========================================================================= */

document.addEventListener('DOMContentLoaded', iniciarApp);
