# Rediseño "Mostrador" — V1

Estado: en curso (rama `rediseno/profesional`)

## Objetivo

Que Góndola se vea como un producto comercial (vara: Linear, Stripe Dashboard, Shopify POS) sin cambiar la idea ni lo que hace. Quien la usa está detrás del mostrador: tiene que leer montos y estados de un vistazo, en una compu vieja o un celular modesto.

Éxito = las 8 vistas rediseñadas, los flujos idénticos, los tests en verde y las métricas de `CONSTRAINTS.md` sin empeorar.

## Dirección visual (aprobada)

| Rol | Valor | Uso |
|---|---|---|
| Grafito | `#1b1c20` | texto, menú lateral, botón principal |
| Papel | `#f6f6f4` / `#ffffff` | fondo y superficies |
| Gris | `#5b5e66` / `#e6e6e3` | texto secundario, bordes |
| Etiqueta | `#ffd43b` (canto `#e8b500`) | **solo** isotipo, precios destacados, ítem activo, "hoy" en el gráfico, monto del botón Cobrar; además, el contorno de foco sobre superficies grafito (11,9:1), por accesibilidad |
| Estados | rojo `#c8322b`, ámbar `#9a5300`, verde `#1e7f4f` | siempre con texto o ícono |
| Medios de pago | paleta actual | validada para daltonismo, no se toca |

- **Tipografía:** Inter (texto) + Inter Display (montos grandes y títulos), ambas `.woff` locales con licencia OFL. Montos con `tabular-nums`.
- **La etiqueta:** forma de etiqueta de góndola (punta a la izquierda y agujerito). En tablas el precio va como texto plano.
- **Menú lateral grafito** con contenido claro; en celu, barra inferior blanca con Vender grafito al centro.
- **Ticket con aire de ticket real:** separadores punteados, borde inferior dentado, total grande y Cobrar grafito con el monto en etiqueta.
- **Hoy:** KPI principal grande con chip ▲/▼ contra la semana pasada, gráfico con guías, hoy en amarillo y valor visible al enfocar o pasar el mouse.

## Stack y comandos

PWA sin frameworks: HTML + CSS + JS con módulos ES, IndexedDB y service worker.

```
Servidor:   python -m http.server 5173        (npm run dev usa python3, que en Windows no existe)
Unitarios:  npm test
E2E:        python tests/e2e/flujos.py         (con el servidor corriendo)
Lighthouse: ver CONSTRAINTS.md
```

## Qué se toca

- `css/app.css`: reescritura completa sobre tokens nuevos.
- `js/vistas/*.js` y `js/ui.js`: **solo markup y clases** (envoltorios, íconos, un `<span>` más). Nada de lógica nueva, ni cambios de ids, `data-*`, roles ARIA o textos de botones.
- `index.html`: isotipo y preload de fuentes.
- `fonts/`: + `inter-display-semibold.woff`; − `adventor-bold.woff` si deja de usarse.
- `assets/icono*`, `manifest.webmanifest`, `sw.js` (`VERSION` y lista de archivos).
- `docs/*.png`, README ("Identidad visual").

## Qué NO se toca

- `js/logica.js`, `js/datos.js`, `js/demo.js`.
- Flujos, textos (salvo microcopy que se muestre antes), atajos `/` y `Ctrl+Enter`, diálogos nativos.
- `tests/e2e/flujos.py`, salvo que un selector cambie (se avisa).
- Sin dependencias, sin CDN.

## Criterios de éxito

1. `npm test` y `python tests/e2e/flujos.py` pasan, incluida la apertura sin internet.
2. Lighthouse en celu, en bienvenida, hoy, vender y productos: performance ≥ 90 y no más de 2 puntos abajo de la línea base; accesibilidad 100; CLS ≤ 0,1.
3. Contraste AA en todo texto (lo verifica la auditoría `color-contrast` de Lighthouse en las 4 vistas).
4. Botones y controles ≥ 44 px en celu; nada cortado a 390, 768, 1024 y 1440 px.
5. Consola sin errores ni advertencias en el recorrido completo.
6. La etiqueta amarilla aparece solo en los usos de la tabla de arriba.

## Fuera de alcance (V2)

- Modo oscuro: duplica el trabajo de contraste; mejor después de estabilizar los tokens.
- Gráficos nuevos o métricas nuevas en Hoy: requieren lógica.
- Skeletons de carga: la app pinta desde IndexedDB en milisegundos y la vista ya se oculta hasta tener datos (`body.cargando`); se suman solo si aparece un estado de carga real.

## Plan

Cada tarea deja la app funcionando, se verifica con capturas de Playwright (1440 y 390 px) y termina en un commit.

| # | Tarea | Aceptación | Archivos |
|---|---|---|---|
| 1 | Tokens, fuentes y base | `:root` nuevo, Inter Display local, tipografía y foco; sin valores sueltos fuera de tokens | `css/app.css`, `fonts/`, `index.html` |
| 2 | Componentes base | botones, inputs, segmentados, chips, píldoras, tablas, diálogos, avisos y etiqueta con estados hover/active/focus | `css/app.css` |
| 3 | Navegación | lateral grafito con ítem activo en etiqueta; barra inferior con Vender destacado; isotipo nuevo | `css/app.css`, `index.html`, `assets/` |
| — | **Control 1** | unitarios + e2e en verde | |
| 4 | Vender | tarjetas escaneables, ticket con aire de ticket, total y Cobrar dominantes, medios segmentados | `css/app.css`, `js/vistas/vender.js` |
| 5 | Hoy | KPIs con chip de variación, gráfico con guías y valor al enfocar, alertas claras | `css/app.css`, `js/vistas/hoy.js` |
| 6 | Productos, Reponer, Ventas, Ajustes, ficha | tablas densas y respiradas, cabeceras y badges uniformes, vacíos con ícono y acción | `css/app.css`, vistas |
| 7 | Bienvenida | hero fuerte, vista de la app y 3 beneficios | `css/app.css`, `js/vistas/bienvenida.js` |
| — | **Control 2** | unitarios + e2e + Lighthouse + recorrido 390/768/1024/1440 | |
| 8 | Cierre | `VERSION`, capturas de `docs/`, README, cabecera del CSS, revisión | varios |

## Registro de performance

Lighthouse 12 en celu emulado, misma máquina y mismo script en cada medición. La variación entre corridas es de ±1 punto.

| Medición | bienvenida | hoy | vender | productos | LCP | Peso | Veredicto |
|---|---|---|---|---|---|---|---|
| `main` (línea base) | 94 | 94 | 94 | 95 | 2,9 s | 280 KiB | — |
| Rediseño, corrida 1 | 93 | 92 | 92 | 92 | 3,0 s | 309 KiB | — |
| Rediseño, corrida 2 | 93 | 93 | 93 | 93 | 3,0 s | 309 KiB | dentro de CONSTRAINTS (≥ 90, ≤ 2 puntos abajo) |
| Sin `preload` de Inter Display | 91 | 91 | 93 | 92 | 3,2 s | 309 KiB | **revertido**: el título grande usa esa fuente y llega más tarde |

El costo del rediseño es la fuente Inter Display (+26 KiB, ~1 punto). Accesibilidad sigue en 100 en las cuatro vistas.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Romper un selector del e2e | no se renombran clases ni ids que use `flujos.py`; e2e en cada control |
| Que el amarillo se use de más y pierda fuerza | lista cerrada de usos (arriba); revisión visual por pantalla |
| Bajar la performance por una fuente más | solo un peso de Inter Display (~26 KB), con `font-display: swap` |
