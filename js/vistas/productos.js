// Lista de productos: buscar, filtrar por estado y categoría, cargar stock rápido y aumentar precios en bloque.

import { aplicarCambiosDePrecio, categorias, datos, productosActivos, proveedores } from '../datos.js';
import { buscarProductos, calcularAumento, estadoStock, gananciaSobreCosto } from '../logica.js';
import {
  $, avisar, cantidad, dialogo, el, etiquetaPrecio, icono, leerEntrada, pildoraEstado, plata, porcentaje,
} from '../ui.js';
import { cargarStockRapido } from './stock-rapido.js';

const filtros = { consulta: '', categoria: '', estado: '' };

function filtrar() {
  let lista = buscarProductos(productosActivos(), filtros.consulta, 5000);
  if (filtros.categoria) lista = lista.filter((p) => p.categoria === filtros.categoria);
  if (filtros.estado === 'reponer') lista = lista.filter((p) => estadoStock(p) !== 'ok');
  if (filtros.estado === 'agotado') lista = lista.filter((p) => estadoStock(p) === 'agotado');
  return lista;
}

function fila(p) {
  const est = estadoStock(p);
  const ganancia = gananciaSobreCosto(p.costo, p.precio);
  return el('tr', { class: `fila-producto fila-producto--${est}` },
    el('th', { scope: 'row' },
      el('a', { href: `#/productos/${p.id}`, class: 'fila-producto__nombre' }, p.nombre),
      el('span', { class: 'fila-producto__meta' }, [p.categoria, p.proveedor].filter(Boolean).join(', '))),
    el('td', { class: 'num' },
      el('span', { class: 'stock' }, cantidad(p.stock, p.unidad)),
      est !== 'ok' ? pildoraEstado(est) : el('span', { class: 'fila-producto__meta' }, `mín. ${cantidad(p.minimo, p.unidad)}`)),
    el('td', { class: 'num' }, etiquetaPrecio(p.precio, { unidad: p.unidad, tamano: 'chica' })),
    el('td', { class: 'num col-opcional' }, p.costo ? plata(p.costo) : '—'),
    el('td', { class: `num col-opcional ${ganancia != null && ganancia < 15 ? 'negativo' : ''}` }, ganancia == null ? '—' : porcentaje(ganancia)),
    el('td', { class: 'acciones-fila' },
      el('button', { type: 'button', class: 'boton boton--chico boton--secundario', onclick: () => cargarStockRapido(p) }, 'Cargar stock')));
}

function renderLista() {
  const lista = filtrar();
  const cuerpo = $('#productos-filas');
  cuerpo.replaceChildren(...lista.map(fila));
  const total = productosActivos().length;
  $('#productos-cuenta').textContent = lista.length === total ? `${total} productos` : `${lista.length} de ${total} productos`;
  $('#productos-vacio').hidden = lista.length > 0;
  $('#productos-tabla').hidden = lista.length === 0;
  $('#productos-vacio').replaceChildren(...(total === 0
    ? [el('strong', {}, 'Todavía no hay productos.'), ' Cargá el primero o importalos desde una planilla en ', el('a', { href: '#/ajustes' }, 'Ajustes'), '.']
    : ['Ningún producto coincide con la búsqueda.']));
}

/** Aumento masivo: elegir porcentaje y alcance, ver cómo quedan los precios y confirmar. */
async function aumentarPrecios() {
  const porcentajeCampo = el('input', { type: 'text', inputmode: 'decimal', name: 'porcentaje', placeholder: '8', autocomplete: 'off' });
  const categoria = el('select', { name: 'categoria' }, el('option', { value: '' }, 'Todas'), categorias().map((c) => el('option', { value: c }, c)));
  const proveedor = el('select', { name: 'proveedor' }, el('option', { value: '' }, 'Todos'), proveedores().map((c) => el('option', { value: c }, c)));
  const redondeo = el('select', { name: 'redondeo' },
    [[0, 'Sin redondear'], [10, 'A $10'], [50, 'A $50'], [100, 'A $100']].map(([v, t]) => el('option', { value: v, selected: v === datos.config.redondeo }, t)));
  const tambienCosto = el('input', { type: 'checkbox', name: 'costo', id: 'aum-costo' });
  const vista = el('div', { class: 'vista-previa', 'aria-live': 'polite' });
  let cambios = [];

  const calcular = () => {
    cambios = calcularAumento(datos.productos, {
      porcentaje: leerEntrada(porcentajeCampo.value), categoria: categoria.value || null, proveedor: proveedor.value || null,
      redondeo: Number(redondeo.value), tambienCosto: tambienCosto.checked,
    });
    if (!cambios.length) {
      vista.replaceChildren(el('p', { class: 'nota' }, 'Escribí un porcentaje para ver cómo quedan los precios.'));
      return;
    }
    vista.replaceChildren(...[
      el('p', {}, el('strong', {}, `${cambios.length} ${cambios.length === 1 ? 'producto cambia' : 'productos cambian'} de precio.`)),
      el('div', { class: 'tabla-scroll' },
        el('table', { class: 'tabla tabla--compacta' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Producto'), el('th', { scope: 'col', class: 'num' }, 'Antes'), el('th', { scope: 'col', class: 'num' }, 'Después'))),
          el('tbody', {}, cambios.slice(0, 40).map((c) => el('tr', {},
            el('th', { scope: 'row' }, c.nombre),
            el('td', { class: 'num' }, plata(c.precioAntes)),
            el('td', { class: 'num' }, el('strong', {}, plata(c.precioDespues)))))))),
      cambios.length > 40 ? el('p', { class: 'nota' }, `Y ${cambios.length - 40} más.`) : null,
    ].filter(Boolean));
  };
  for (const control of [porcentajeCampo, categoria, proveedor, redondeo, tambienCosto]) control.addEventListener('input', calcular);
  calcular();

  await dialogo({
    titulo: 'Aumentar precios',
    descripcion: 'Subí los precios de una categoría, de un proveedor o de todo el negocio. Para bajar, escribí un número negativo.',
    ancho: 'ancho',
    contenido: el('form', { class: 'formulario', onsubmit: (e) => e.preventDefault() },
      el('div', { class: 'fila-campos fila-campos--4' },
        el('div', { class: 'campo' }, el('label', { for: 'aum-pct' }, 'Porcentaje'), el('div', { class: 'con-sufijo' }, Object.assign(porcentajeCampo, { id: 'aum-pct' }), el('span', {}, '%'))),
        el('div', { class: 'campo' }, el('label', { for: 'aum-cat' }, 'Categoría'), Object.assign(categoria, { id: 'aum-cat' })),
        el('div', { class: 'campo' }, el('label', { for: 'aum-prov' }, 'Proveedor'), Object.assign(proveedor, { id: 'aum-prov' })),
        el('div', { class: 'campo' }, el('label', { for: 'aum-red' }, 'Redondear'), Object.assign(redondeo, { id: 'aum-red' }))),
      el('label', { class: 'casilla', for: 'aum-costo' }, tambienCosto, 'Subir también el costo (si el proveedor aumentó)'),
      vista),
    botones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: 'Aplicar aumento', tipo: 'primario', valor: true,
        alHacer: async () => {
          if (!cambios.length) {
            avisar('No hay precios para cambiar.', { tipo: 'error' });
            return false;
          }
          const antes = cambios.map((c) => ({ ...c, precioDespues: c.precioAntes, costoDespues: c.costoAntes }));
          await aplicarCambiosDePrecio(cambios);
          avisar(`Actualizamos ${cambios.length} precios.`, { accion: { texto: 'Deshacer', alHacer: () => aplicarCambiosDePrecio(antes).then(() => avisar('Volvimos los precios a como estaban.')) } });
          return true;
        },
      },
    ],
  });
}

export function render(contenedor, params) {
  if (params.get('estado')) filtros.estado = params.get('estado');
  const cats = categorias();
  contenedor.replaceChildren(
    el('div', { class: 'cabecera-vista' },
      el('div', {}, el('h1', { id: 'titulo-vista' }, 'Productos'), el('p', { class: 'nota', id: 'productos-cuenta' })),
      el('div', { class: 'cabecera-vista__acciones' },
        el('button', { type: 'button', class: 'boton boton--secundario', onclick: aumentarPrecios }, 'Aumentar precios'),
        el('a', { href: '#/productos/nuevo', class: 'boton boton--primario' }, icono('sumar', { tamano: 18 }), 'Nuevo producto'))),
    el('div', { class: 'barra-filtros' },
      el('div', { class: 'buscador buscador--chico' },
        icono('buscar', { tamano: 18 }),
        el('label', { for: 'productos-buscar', class: 'solo-lectores' }, 'Buscar producto'),
        el('input', { id: 'productos-buscar', type: 'search', placeholder: 'Buscar por nombre o código', value: filtros.consulta, autocomplete: 'off',
          oninput: (e) => { filtros.consulta = e.target.value; renderLista(); } })),
      el('label', { class: 'solo-lectores', for: 'productos-categoria' }, 'Categoría'),
      el('select', { id: 'productos-categoria', onchange: (e) => { filtros.categoria = e.target.value; renderLista(); } },
        el('option', { value: '' }, 'Todas las categorías'), cats.map((c) => el('option', { value: c, selected: c === filtros.categoria }, c))),
      el('div', { class: 'segmentado', role: 'group', 'aria-label': 'Estado del stock' },
        [['', 'Todos'], ['reponer', 'Para reponer'], ['agotado', 'Agotados']].map(([valor, texto]) =>
          el('button', { type: 'button', 'aria-pressed': String(filtros.estado === valor), onclick: (e) => {
            filtros.estado = valor;
            for (const b of e.currentTarget.parentElement.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
            renderLista();
          } }, texto)))),
    el('div', { class: 'tabla-scroll' },
      el('table', { class: 'tabla', id: 'productos-tabla' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, 'Producto'),
          el('th', { scope: 'col', class: 'num' }, 'Stock'),
          el('th', { scope: 'col', class: 'num' }, 'Precio'),
          el('th', { scope: 'col', class: 'num col-opcional' }, 'Costo'),
          el('th', { scope: 'col', class: 'num col-opcional' }, 'Ganancia'),
          el('th', { scope: 'col' }, el('span', { class: 'solo-lectores' }, 'Acciones')))),
        el('tbody', { id: 'productos-filas' }))),
    el('p', { id: 'productos-vacio', class: 'vacio', hidden: true }),
  );
  renderLista();
}

export function alCambiarDatos() {
  if ($('#productos-filas')) renderLista();
}
