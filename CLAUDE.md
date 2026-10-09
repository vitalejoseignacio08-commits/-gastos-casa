# Mis Gastos — PWA de gastos del hogar

PWA para registrar gastos del hogar, pensada solo para celular. Se publica en GitHub Pages.

## Restricciones técnicas (no negociables)

- HTML, CSS y JavaScript puros. Sin frameworks, sin librerías externas, sin build, sin backend.
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

- Nombre de la app (manifest, pantalla de inicio): **"Mis Gastos"**.
- Navegación: pestañas abajo (Registrar, Historial, Resumen, Categorías) + ícono de Ajustes arriba.
- Total del mes actual siempre visible arriba. Modo claro/oscuro según `prefers-color-scheme`.
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
    ultimaBackup   // ISO date o null, se actualiza al exportar JSON/CSV
  }
}
```

Funciones centrales en `app.js`: `cargarEstado()` y `guardarEstado(estado)`, usadas por todos los
módulos de la app (no acceder a `localStorage` directamente desde otros lados).

## Etapas de desarrollo

El proyecto se construyó en 7 etapas (ver historial de commits): estructura y persistencia,
registrar gasto, categorías/subcategorías, historial, resumen mensual, copias de seguridad, y
empaquetado PWA (manifest, íconos, service worker, offline).
