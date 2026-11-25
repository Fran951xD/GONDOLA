// Ventas: tickets por día, con detalle y opción de anular.

import { MEDIOS_DE_PAGO, anularVenta, datos } from '../datos.js';
import { resumenVentas } from '../logica.js';
import { $, avisar, cantidad, confirmar, el, fechaLarga, hora, plata, plataRedonda } from '../ui.js';

const DIA = 864e5;
const PERIODOS = { hoy: 'Hoy', ayer: 'Ayer', semana: '7 días', mes: '30 días' };
let periodo = 'hoy';

function rango() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicio = hoy.getTime();
  if (periodo === 'ayer') return { desde: inicio - DIA, hasta: inicio - 1 };
  if (periodo === 'semana') return { desde: inicio - 6 * DIA, hasta: Date.now() };
  if (periodo === 'mes') return { desde: inicio - 29 * DIA, hasta: Date.now() };
  return { desde: inicio, hasta: Date.now() };
}

function ticket(v) {
  return el('li', { class: `venta ${v.anulada ? 'venta--anulada' : ''}` },
    el('details', {},
      el('summary', {},
        el('span', { class: 'venta__hora' }, hora(v.fecha)),
        el('span', { class: 'venta__resumen' }, `Ticket ${v.numero}`, el('small', {}, v.items.map((i) => i.nombre).join(', '))),
        el('span', { class: 'venta__medio' }, MEDIOS_DE_PAGO[v.medio] ?? v.medio),
        el('strong', { class: 'venta__total' }, v.anulada ? el('s', {}, plata(v.total)) : plata(v.total))),
      el('div', { class: 'venta__detalle' },
        el('table', { class: 'tabla tabla--compacta' },
          el('tbody', {}, v.items.map((i) => el('tr', {},
            el('th', { scope: 'row' }, i.nombre),
            el('td', { class: 'num' }, cantidad(i.cantidad, i.unidad)),
            el('td', { class: 'num' }, plata(i.precio)),
            el('td', { class: 'num' }, plata(i.precio * i.cantidad)))))),
        v.recibido ? el('p', { class: 'nota' }, `Pagó con ${plata(v.recibido)}, vuelto ${plata(v.recibido - v.total)}.`) : null,
        v.anulada
          ? el('p', { class: 'nota' }, 'Anulada. El stock se devolvió.')
          : el('button', { type: 'button', class: 'boton boton--chico boton--peligro-texto', onclick: async () => {
            if (await confirmar(`¿Anular el ticket ${v.numero}?`, `Se descuenta ${plata(v.total)} de las ventas y los productos vuelven al stock.`, { texto: 'Anular ticket', peligro: true })) {
              await anularVenta(v.id);
              avisar(`Ticket ${v.numero} anulado.`);
            }
          } }, 'Anular ticket'))));
}

function renderLista() {
  const { desde, hasta } = rango();
  const ventas = datos.ventas.filter((v) => v.fecha >= desde && v.fecha <= hasta).sort((a, b) => b.fecha - a.fecha);
  const r = resumenVentas(ventas, { desde, hasta });
  $('#ventas-resumen').replaceChildren(
    el('div', { class: 'cifra' }, el('p', { class: 'cifra__etiqueta' }, 'Vendido'), el('p', { class: 'cifra__valor' }, plataRedonda(r.total))),
    el('div', { class: 'cifra' }, el('p', { class: 'cifra__etiqueta' }, 'Ganancia estimada'), el('p', { class: 'cifra__valor' }, plataRedonda(r.ganancia))),
    el('div', { class: 'cifra' }, el('p', { class: 'cifra__etiqueta' }, 'Tickets'), el('p', { class: 'cifra__valor' }, String(r.tickets))),
  );
  // Agrupa por día
  const porDia = new Map();
  for (const v of ventas) {
    const d = new Date(v.fecha);
    d.setHours(0, 0, 0, 0);
    if (!porDia.has(d.getTime())) porDia.set(d.getTime(), []);
    porDia.get(d.getTime()).push(v);
  }
  $('#ventas-lista').replaceChildren(...(ventas.length
    ? [...porDia.entries()].map(([dia, lista]) => el('section', { class: 'dia-ventas' },
      el('h2', { class: 'titulo-chico' }, fechaLarga(dia), el('span', {}, plataRedonda(lista.filter((v) => !v.anulada).reduce((t, v) => t + v.total, 0)))),
      el('ol', { class: 'lista-ventas' }, lista.map(ticket))))
    : [el('p', { class: 'vacio vacio--grande' }, periodo === 'hoy' ? 'Todavía no hay ventas hoy. ' : 'No hay ventas en este período. ', el('a', { href: '#/vender' }, 'Ir a la caja'))]));
}

export function render(contenedor) {
  contenedor.replaceChildren(
    el('div', { class: 'cabecera-vista' },
      el('h1', { id: 'titulo-vista' }, 'Ventas'),
      el('div', { class: 'segmentado', role: 'group', 'aria-label': 'Período' },
        Object.entries(PERIODOS).map(([valor, texto]) => el('button', { type: 'button', 'aria-pressed': String(valor === periodo), onclick: (e) => {
          periodo = valor;
          for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
          renderLista();
        } }, texto)))),
    el('section', { id: 'ventas-resumen', class: 'cifras-hoy cifras-hoy--compactas', 'aria-label': 'Resumen del período' }),
    el('div', { id: 'ventas-lista' }),
  );
  renderLista();
}

export function alCambiarDatos() {
  if ($('#ventas-lista')) renderLista();
}
