// Inicio: cómo viene el día, qué se vende y qué está por faltar.

import { MEDIOS_DE_PAGO, datos } from '../datos.js';
import { listaDeReposicion, resumenVentas, serieDiaria, valorInventario } from '../logica.js';
import { cantidad, el, fechaCorta, fechaLarga, hace, icono, plata, plataRedonda, porcentaje } from '../ui.js';

const DIA = 864e5;
const inicioDeHoy = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Gráfico de barras de los últimos 14 días: el día de hoy en verde, el resto en gris. Cada barra con su valor accesible. */
function graficoDias(serie) {
  const maximo = Math.max(...serie.map((d) => d.total), 1);
  const hoy = inicioDeHoy();
  return el('figure', { class: 'grafico-dias' },
    el('figcaption', { class: 'titulo-chico' }, 'Ventas de los últimos 14 días'),
    el('span', { class: 'grafico-dias__max', 'aria-hidden': 'true' }, `máx. ${plataRedonda(maximo)}`),
    el('ol', { class: 'grafico-dias__barras' }, serie.map((d) => {
      const dia = new Date(d.fecha);
      const esHoy = d.fecha === hoy;
      return el('li', { class: `grafico-dias__dia ${esHoy ? 'es-hoy' : ''} ${[0, 6].includes(dia.getDay()) ? 'es-finde' : ''}` },
        el('span', { class: 'grafico-dias__barra', style: { '--alto': `${Math.max(2, (d.total / maximo) * 100)}%` }, tabindex: '0', 'data-valor': `${esHoy ? 'Hoy' : fechaCorta(d.fecha)}: ${plataRedonda(d.total)}` },
          el('span', { class: 'solo-lectores' }, `${fechaLarga(d.fecha)}: ${plataRedonda(d.total)}`)),
        el('span', { class: 'grafico-dias__etiqueta', 'aria-hidden': 'true' }, esHoy ? 'Hoy' : fechaCorta(d.fecha)));
    })));
}

function barraMedios(porMedio, total) {
  const orden = Object.keys(MEDIOS_DE_PAGO).filter((m) => porMedio[m] > 0);
  if (!orden.length) return el('p', { class: 'nota' }, 'Todavía no hay cobros hoy.');
  return el('div', {},
    el('div', { class: 'barra-medios', role: 'img', 'aria-label': orden.map((m) => `${MEDIOS_DE_PAGO[m]} ${porcentaje((porMedio[m] / total) * 100)}`).join(', ') },
      orden.map((m) => el('span', { class: `barra-medios__parte medio-${m}`, style: { flexGrow: String(porMedio[m]) } }))),
    el('ul', { class: 'leyenda-medios' }, orden.map((m) => el('li', { class: `medio-${m}` },
      el('span', {}, MEDIOS_DE_PAGO[m]), el('strong', {}, plataRedonda(porMedio[m])), el('span', { class: 'nota' }, porcentaje((porMedio[m] / total) * 100))))));
}

function comparacion(actual, anterior) {
  if (!(anterior > 0)) return null;
  const cambio = (actual / anterior - 1) * 100;
  const signo = cambio > 0.5 ? 'más' : cambio < -0.5 ? 'menos' : null;
  return el('p', { class: `cifra__detalle cifra__variacion ${signo ? `cifra__variacion--${signo === 'más' ? 'sube' : 'baja'}` : ''}` }, signo ?`${porcentaje(Math.abs(cambio))} ${signo} que el mismo día de la semana pasada a esta hora` : 'Igual que la semana pasada a esta hora');
}

export function render(contenedor) {
  const ahora = Date.now();
  const hoy = inicioDeHoy();
  const r = resumenVentas(datos.ventas, { desde: hoy, hasta: ahora });
  const semanaPasada = resumenVentas(datos.ventas, { desde: hoy - 7 * DIA, hasta: ahora - 7 * DIA });
  const semana = resumenVentas(datos.ventas, { desde: hoy - 6 * DIA, hasta: ahora });
  const reponer = listaDeReposicion(datos.productos, datos.ventas).flatMap((g) => g.items);
  const inventario = valorInventario(datos.productos);
  const diasSinRespaldo = datos.config.ultimoRespaldo ? (ahora - datos.config.ultimoRespaldo) / DIA : null;
  const pedirRespaldo = datos.productos.length > 0 && (diasSinRespaldo == null || diasSinRespaldo > 7);

  contenedor.replaceChildren(...[
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', { id: 'titulo-vista' }, 'Hoy'),
        el('p', { class: 'nota fecha-hoy' }, fechaLarga(ahora))),
      el('a', { href: '#/vender', class: 'boton boton--primario boton--grande' }, icono('vender', { tamano: 20 }), 'Abrir la caja')),

    pedirRespaldo ? el('div', { class: 'aviso-fijo', role: 'note' },
      icono('alerta'),
      el('p', {}, diasSinRespaldo == null ? 'Todavía no descargaste una copia de seguridad.' : `Hace ${Math.floor(diasSinRespaldo)} días que no descargás una copia de seguridad.`,
        ' Si se rompe o se pierde este dispositivo, es la única forma de recuperar tus datos.'),
      el('a', { href: '#/ajustes', class: 'boton boton--chico boton--secundario' }, 'Hacer copia')) : null,

    el('section', { class: 'cifras-hoy', 'aria-label': 'Resumen del día' },
      el('div', { class: 'cifra cifra--principal' },
        el('p', { class: 'cifra__etiqueta' }, 'Vendido hoy'),
        el('p', { class: 'cifra__valor' }, plataRedonda(r.total)),
        comparacion(r.total, semanaPasada.total)),
      el('div', { class: 'cifra' },
        el('p', { class: 'cifra__etiqueta' }, 'Ganancia estimada'),
        el('p', { class: 'cifra__valor' }, plataRedonda(r.ganancia)),
        el('p', { class: 'cifra__detalle' }, 'Precio de venta menos costo.')),
      el('div', { class: 'cifra' },
        el('p', { class: 'cifra__etiqueta' }, 'Tickets'),
        el('p', { class: 'cifra__valor' }, String(r.tickets)),
        el('p', { class: 'cifra__detalle' }, r.tickets ? `${plataRedonda(r.ticketPromedio)} en promedio` : 'Sin ventas todavía'))),

    el('div', { class: 'tablero' },
      el('section', { class: 'panel panel--ancho', 'aria-label': 'Ventas por día' },
        graficoDias(serieDiaria(datos.ventas, 14, ahora)),
        el('p', { class: 'nota' }, `Últimos 7 días: ${plataRedonda(semana.total)} en ${semana.tickets} tickets.`)),

      el('section', { class: 'panel', 'aria-labelledby': 'faltan-titulo' },
        el('div', { class: 'panel__cabecera' },
          el('h2', { id: 'faltan-titulo', class: 'titulo-chico' }, 'Por agotarse'),
          reponer.length ? el('a', { href: '#/reponer', class: 'enlace-flecha' }, `Ver los ${reponer.length}`, icono('flecha', { tamano: 16 })) : null),
        reponer.length
          ? el('ul', { class: 'lista-faltantes' }, reponer.slice(0, 6).map((i) => el('li', {},
            el('a', { href: `#/productos/${i.producto.id}` }, i.producto.nombre),
            el('span', { class: `pildora pildora--${i.estado}` }, i.estado === 'agotado' ? 'Agotado' : `Quedan ${cantidad(i.producto.stock, i.producto.unidad)}`))))
          : el('p', { class: 'nota' }, 'Nada por debajo del mínimo.')),

      el('section', { class: 'panel', 'aria-labelledby': 'medios-titulo' },
        el('h2', { id: 'medios-titulo', class: 'titulo-chico' }, 'Cómo te pagaron hoy'),
        barraMedios(r.porMedio, r.total)),

      el('section', { class: 'panel', 'aria-labelledby': 'top-titulo' },
        el('h2', { id: 'top-titulo', class: 'titulo-chico' }, 'Lo más vendido en la semana'),
        semana.masVendidos.length
          ? el('ol', { class: 'ranking' }, semana.masVendidos.slice(0, 5).map((p) => el('li', {},
            el('span', { class: 'ranking__nombre' }, p.nombre),
            el('span', { class: 'ranking__valor' }, plataRedonda(p.total)))))
          : el('p', { class: 'nota' }, 'Sin ventas en los últimos 7 días.')),

      el('section', { class: 'panel', 'aria-labelledby': 'inv-titulo' },
        el('h2', { id: 'inv-titulo', class: 'titulo-chico' }, 'Mercadería en el local'),
        el('p', { class: 'cifra__valor cifra__valor--chica' }, plataRedonda(inventario.costo)),
        el('p', { class: 'nota' }, `A costo, en ${inventario.unidades} productos con stock. Vendida a precio de lista serían ${plata(inventario.venta)}.`))),

    datos.ventas.length ? el('p', { class: 'nota pie-vista' }, `Última venta ${hace(datos.ventas.at(-1).fecha)}.`) : null,
  ].filter(Boolean));
}

export const alCambiarDatos = (contenedor) => render(contenedor);
