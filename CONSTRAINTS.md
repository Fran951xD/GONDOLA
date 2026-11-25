# Constraints

Última revisión: 2026-11-24, al empezar el rediseño "Mostrador" (`docs/REDISENO.md`).

## Piso (siempre)

- Sin dependencias nuevas en `package.json` ni recursos de CDN: la app tiene que abrir sin internet.
- Fuentes solo como `.woff` locales en `fonts/`, con su licencia en `fonts/LICENCIAS.md`.
- No se tocan `js/logica.js`, `js/datos.js` ni `js/demo.js` durante un cambio visual.
- No se saltean, borran ni ablandan tests para que algo pase.
- Este archivo no se afloja para que un cambio pase.

## Con número

| Dimensión | Regla | Por qué | Lo verifica | Cuándo |
|---|---|---|---|---|
| Lógica | 20/20 tests unitarios | son las reglas del negocio | `npm test` | cada commit |
| Flujos | el recorrido completo pasa, incluida la apertura sin internet, con `ERRORES: []` | es lo que hace una persona real | `python tests/e2e/flujos.py` (servidor en :5173) | cada control y antes de mergear |
| Accesibilidad | 100 en Lighthouse, sin fallas de `color-contrast` (AA) | ya está en 100: no se negocia bajar | Lighthouse en celu, en bienvenida, hoy, vender y productos | cada control |
| Performance | ≥ 90 y no más de 2 puntos abajo de la línea base en cada vista | margen para la variación normal de Lighthouse sin tolerar una caída real | ídem | cada control |
| Estabilidad visual | CLS ≤ 0,1 | umbral "bueno" de Core Web Vitals; hoy es 0 | ídem | cada control |
| Toques en celu | controles ≥ 44 px a 390 px de ancho | mínimo cómodo para el dedo detrás del mostrador | Playwright: medir `getBoundingClientRect` de botones, enlaces e inputs | control 2 |

Comando de Lighthouse (por vista; para las vistas con datos se usa un perfil con "Probar con un ejemplo" cargado y `--disable-storage-reset`):

```
CHROME_PATH=<chrome de Playwright> npx --yes lighthouse@12 "http://localhost:5173/#/<vista>" \
  --only-categories=performance,accessibility,best-practices --output=json
```

Lighthouse es la opinión externa: mide contraste (reglas de axe) y performance en un navegador real, no en tests escritos por nosotros.

## Medido (línea base en `main`, 2026-11-24, celu emulado)

| Vista | Performance | Accesibilidad | Buenas prácticas | LCP | CLS | Peso |
|---|---|---|---|---|---|---|
| bienvenida | 94 | 100 | 100 | 2,9 s | 0 | 280 KiB |
| hoy | 94 | 100 | 100 | 2,9 s | 0 | 280 KiB |
| vender | 94 | 100 | 100 | 2,9 s | 0 | 280 KiB |
| productos | 95 | 100 | 100 | 2,9 s | 0 | 280 KiB |

Dirección: performance y accesibilidad no bajan; el peso total no sube más de 30 KiB (una fuente nueva como máximo).

## Excepciones

Ninguna.
