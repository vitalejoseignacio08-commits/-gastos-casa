# Al Mango — PWA de gastos del hogar

PWA para registrar gastos del hogar, pensada solo para celular. Se publica en GitHub Pages.

## Restricciones técnicas (no negociables)

- HTML, CSS y JavaScript puros. Sin frameworks, sin librerías externas, sin build, sin backend.
  Única excepción: la tipografía Manrope se carga desde Google Fonts (`display=swap`); el service
  worker la guarda en cache y, si no está disponible, se usa la fuente del sistema.
- Archivos del proyecto: `index.html`, `app.js`, `styles.css`, `sw.js`, `manifest.webmanifest`,
  `icon-192.png`, `icon-512.png`.
- Funciona 100% offline después de la primera carga. El service worker (`sw.js`) usa estrategia
  cache-first y tiene una constante de versión (`CACHE_VERSION`) que hay que subir para forzar
  la actualización de la cache.
- Todos los datos viven en `localStorage` bajo la clave **`misGastosData`**, como un único JSON
  con un campo `version` (actualmente `1`) para poder migrar el formato en el futuro.
- Toda lectura/escritura a localStorage va envuelta en try/catch. Si el JSON guardado existe pero
  no se puede parsear, **nunca se sobrescribe automáticamente**: se avisa dentro de la app y se
  ofrece ver/copiar el contenido dañado para que el usuario intente recuperarlo.
- Al iniciar se pide `navigator.storage.persist()`. En Ajustes se muestra si el storage quedó
  persistido y si la app corre instalada (`display-mode: standalone`) o en el navegador.
- Los datos deben sobrevivir cerrar la app, reiniciar el teléfono, actualizar la app y meses sin uso.
- Instalable en Android y iPhone (manifest + meta tags de Apple, `viewport-fit=cover`, estilos con
  `env(safe-area-inset-*)` para notch y barra inferior).
- Todas las rutas son relativas (sin `/` inicial) por el despliegue en GitHub Pages (subpath).
- Prohibido usar `alert()`, `confirm()` o `prompt()`. Todas las confirmaciones son UI propia dentro
  de la app (modales/paneles).
- Moneda: pesos argentinos, formato `es-AR` (ej. `$ 12.500,50`). Toda la interfaz en español.

## Decisiones de producto

- Nombre de la app (manifest, pantalla de inicio): **"Al Mango"**, lema **"Cada mango cuenta."**
  ("al mango" en el sentido de llevar las cuentas peso por peso). Antes se llamaba "Mis Gastos";
  la clave de localStorage (`misGastosData`) y el prefijo de cache del service worker no cambian.
- Logo: silueta de mango formada por franjas horizontales (monedas apiladas / mangos contados), con
  degradé cálido y hoja verde menta sobre fondo oscuro. Los íconos tienen fondo a sangre y el arte
  dentro de la zona segura, así que sirven como `any maskable`.
- Mangómetro: en el encabezado, el mango del logo (11 franjas) se llena de abajo hacia arriba según
  lo gastado este mes comparado con el total del mes anterior; si lo supera, queda lleno en tono
  rojizo. Al tocarlo, un aviso explica el porcentaje. Sin datos del mes anterior queda vacío.
- Racha: pastilla con llama en el encabezado (junto a Ajustes) con los días seguidos "al mango". Un
  día cuenta si tiene al menos un gasto o está marcado como sin gastos; si hoy todavía no está
  cubierto, la racha se cuenta hasta ayer (no se corta hasta que termina el día).
- "Hoy no gasté": con el monto en 0 y un día (hoy o pasado) sin gastos ni marca, el botón de
  Registrar ofrece "Hoy no gasté" / "No gasté ese día" en lugar de "Elegir categoría". Si después se
  anota un gasto en un día marcado, la marca se quita.
- Navegación: pestañas abajo (Registrar, Historial, Resumen, Categorías) + ícono de Ajustes arriba.
- Registrar en dos pasos: la pantalla tiene solo fecha, monto y teclado grande + botón "Elegir
  categoría"; ese botón abre un panel inferior con todas las categorías en grilla (si el monto es 0,
  el monto se sacude y no se abre). Después sigue el panel de subcategoría/nota como siempre.
- Total del mes actual siempre visible arriba. Diseño oscuro como base, con variante clara según
  `prefers-color-scheme`. Un solo color de acento (`--color-primario`) y colores suaves por categoría
  (`--paleta-1` a `--paleta-10`; los datos guardan `var(--paleta-N)`, así que se ajustan desde CSS).
- Las categorías guardan un emoji; la interfaz lo muestra como ícono SVG (`ICONOS_CATEGORIA` en
  `app.js`) y cae al emoji si no hay ícono para ese emoji.
- Categorías de ejemplo precargadas: Supermercado (Almacén, Carnicería, Verdulería, Limpieza),
  Servicios (Luz, Gas, Agua, Internet, Celular), Transporte (Combustible, Mantenimiento), Hogar,
  Salud (Farmacia, Consultas), Comida afuera, Ropa, Impuestos.
- Borrar una categoría/subcategoría con gastos asociados la **oculta** (no la elimina), para no
  romper el historial; se puede volver a mostrar desde la pantalla de Categorías.

## Modelo de datos (localStorage, clave `misGastosData`)

```js
{
  version: 1,
  gastos: [
    {
      id,                 // crypto.randomUUID()
      monto,               // number
      fecha,                // "YYYY-MM-DD"
      categoriaId,
      subcategoriaId,       // o null
      nota,                 // o ""
      creadoEn,             // ISO datetime
      actualizadoEn         // ISO datetime
    }
  ],
  categorias: [
    {
      id, nombre, emoji, color, oculta,  // boolean
      subcategorias: [ { id, nombre, oculta } ]
    }
  ],
  config: {
    ultimaBackup,  // ISO date o null, se actualiza al exportar JSON/CSV
    diasSinGastos  // ["YYYY-MM-DD"], días marcados con "Hoy no gasté" (opcional: si falta, es [])
  }
}
```

Funciones centrales en `app.js`: `cargarEstado()` y `guardarEstado(estado)`, usadas por todos los
módulos de la app (no acceder a `localStorage` directamente desde otros lados).

## Etapas de desarrollo

El proyecto se construyó en 7 etapas (ver historial de commits): estructura y persistencia,
registrar gasto, categorías/subcategorías, historial, resumen mensual, copias de seguridad, y
empaquetado PWA (manifest, íconos, service worker, offline).
