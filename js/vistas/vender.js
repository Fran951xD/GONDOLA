// Caja: buscar o escanear, armar el ticket, cobrar. Pensada para usarse rápido, también solo con teclado.

import {
  MEDIOS_DE_PAGO, anularVenta, categorias, datos, productoPorId, productosActivos, registrarVenta,
} from '../datos.js';
import { buscarProductos, estadoStock, faltantes, montosSugeridos, totalTicket, vuelto } from '../logica.js';
import {
  $, avisar, cantidad, dialogo, el, etiquetaPrecio, icono, leerEntrada, paraCampo, plata,
} from '../ui.js';

const CLAVE_TICKET = 'gondola:ticket';
const estado = {
  items: cargarTicket(),
  medio: 'efectivo',
  recibido: null,
  consulta: '',
  categoria: null,
};

function cargarTicket() {
  try {
    return JSON.parse(sessionStorage.getItem(CLAVE_TICKET)) ?? [];
  } catch {
    return [];
  }
}
function guardarTicket() {
  try {
    sessionStorage.setItem(CLAVE_TICKET, JSON.stringify(estado.items));
  } catch {
    /* sin sesión, el ticket vive mientras la pantalla esté abierta */
  }
}

/** Productos por kilo: se pregunta el peso o cuánta plata quiere llevar el cliente. */
async function pedirPeso(producto) {
  const entradaKg = el('input', { type: 'text', inputmode: 'decimal', name: 'kg', autocomplete: 'off', placeholder: '0,250' });
  const entradaPesos = el('input', { type: 'text', inputmode: 'decimal', name: 'pesos', autocomplete: 'off', placeholder: '2.000' });
  const resumen = el('p', { class: 'dialogo__resumen', 'aria-live': 'polite' });
  const actualizar = (origen) => {
    const kg = leerEntrada(entradaKg.value);
    const monto = leerEntrada(entradaPesos.value);
    if (origen === 'pesos' && monto > 0) entradaKg.value = paraCampo(Math.round((monto / producto.precio) * 1000) / 1000);
    if (origen === 'kg' && kg > 0) entradaPesos.value = paraCampo(Math.round(kg * producto.precio));
    const final = leerEntrada(entradaKg.value);
    resumen.textContent = final > 0 ? `${cantidad(final, 'kg')} de ${producto.nombre}: ${plata(final * producto.precio)}` : '';
  };
  entradaKg.addEventListener('input', () => actualizar('kg'));
  entradaPesos.addEventListener('input', () => actualizar('pesos'));
  const atajos = el('div', { class: 'atajos' }, [0.1, 0.25, 0.5, 1].map((kg) => el('button', {
    type: 'button', onclick: () => {
      entradaKg.value = paraCampo(kg);
      actualizar('kg');
    },
  }, kg < 1 ? `${kg * 1000} g` : '1 kg')));

  let elegido = null;
  await dialogo({
    titulo: producto.nombre,
    descripcion: `${plata(producto.precio)} el kilo. Escribí el peso o cuánta plata quiere llevar.`,
    contenido: el('form', { class: 'formulario', onsubmit: (e) => e.preventDefault() },
      el('div', { class: 'fila-campos' },
        el('div', { class: 'campo' }, el('label', { for: 'peso-kg' }, 'Peso en kilos'), Object.assign(entradaKg, { id: 'peso-kg' })),
        el('div', { class: 'campo' }, el('label', { for: 'peso-pesos' }, 'O monto en pesos'), Object.assign(entradaPesos, { id: 'peso-pesos' }))),
      atajos, resumen),
    botones: [
      { texto: 'Cancelar', valor: null },
      {
        texto: 'Agregar al ticket', tipo: 'primario', valor: true,
        alHacer: () => {
          elegido = leerEntrada(entradaKg.value);
          if (!(elegido > 0)) {
            avisar('Escribí el peso o el monto.', { tipo: 'error' });
            return false;
          }
          return true;
        },
      },
    ],
  });
  return elegido;
}

async function agregar(producto) {
  let cantidadNueva = 1;
  if (producto.unidad === 'kg') {
    cantidadNueva = await pedirPeso(producto);
    if (!cantidadNueva) return;
  }
  const existente = estado.items.find((i) => i.productoId === producto.id);
  if (existente && producto.unidad !== 'kg') existente.cantidad += 1;
  else if (existente) existente.cantidad = Math.round((existente.cantidad + cantidadNueva) * 1000) / 1000;
  else estado.items.push({ productoId: producto.id, nombre: producto.nombre, precio: producto.precio, unidad: producto.unidad, cantidad: cantidadNueva });
  guardarTicket();
  renderTicket({ resaltar: producto.id });
}

function cambiarCantidad(productoId, nueva) {
  const item = estado.items.find((i) => i.productoId === productoId);
  if (!item) return;
  if (!(nueva > 0)) estado.items = estado.items.filter((i) => i.productoId !== productoId);
  else item.cantidad = item.unidad === 'kg' ? Math.round(nueva * 1000) / 1000 : Math.round(nueva);
  guardarTicket();
  renderTicket();
}

// --- Catálogo -------------------------------------------------------------

function tarjetaProducto(p) {
  const est = estadoStock(p);
  return el('li', {},
    el('button', {
      type: 'button', class: `producto-caja producto-caja--${est}`, dataset: { id: p.id },
      'aria-label': `${p.nombre}, ${plata(p.precio)}${p.unidad === 'kg' ? ' el kilo' : ''}. ${est === 'agotado' ? 'Sin stock' : `Quedan ${cantidad(p.stock, p.unidad)}`}`,
    },
    el('span', { class: 'producto-caja__nombre' }, p.nombre),
    etiquetaPrecio(p.precio, { unidad: p.unidad }),
    el('span', { class: 'producto-caja__stock' }, est === 'agotado' ? 'Sin stock' : `Quedan ${cantidad(p.stock, p.unidad)}`)));
}

function resultados() {
  let lista = buscarProductos(productosActivos(), estado.consulta, 60);
  if (estado.categoria && !estado.consulta) lista = lista.filter((p) => p.categoria === estado.categoria);
  return lista;
}

function renderCatalogo() {
  const lista = resultados();
  const grilla = $('#caja-grilla');
  grilla.replaceChildren(...lista.map(tarjetaProducto));
  $('#caja-vacio').hidden = lista.length > 0;
  $('#caja-vacio').textContent = estado.consulta
    ? `No hay productos que coincidan con "${estado.consulta}".`
    : 'Todavía no cargaste productos.';
  for (const chip of document.querySelectorAll('#caja-categorias button')) {
    chip.setAttribute('aria-pressed', String((chip.dataset.categoria || null) === estado.categoria));
  }
}

// --- Ticket ---------------------------------------------------------------

function filaTicket(item, resaltar) {
  const p = productoPorId(item.productoId);
  const sinStock = p && p.stock < item.cantidad;
  const control = el('input', {
    type: 'text', inputmode: 'decimal', class: 'ticket__cantidad', value: paraCampo(item.cantidad),
    'aria-label': `Cantidad de ${item.nombre}${item.unidad === 'kg' ? ' en kilos' : ''}`,
    onchange: (e) => cambiarCantidad(item.productoId, leerEntrada(e.target.value)),
    onfocus: (e) => e.target.select(),
  });
  const paso = item.unidad === 'kg' ? 0.1 : 1;
  return el('li', { class: `ticket__item ${resaltar === item.productoId ? 'ticket__item--nuevo' : ''}` },
    el('div', { class: 'ticket__detalle' },
      el('span', { class: 'ticket__nombre' }, item.nombre),
      el('span', { class: 'ticket__precio' }, `${plata(item.precio)}${item.unidad === 'kg' ? ' /kg' : ''}`,
        sinStock ? el('span', { class: 'ticket__alerta' }, ` · stock: ${cantidad(Math.max(0, p.stock), item.unidad)}`) : null)),
    el('div', { class: 'paso' },
      el('button', { type: 'button', class: 'paso__boton', 'aria-label': `Uno menos de ${item.nombre}`, onclick: () => cambiarCantidad(item.productoId, item.cantidad - paso) }, icono(item.cantidad - paso > 0 ? 'restar' : 'basura', { tamano: 16 })),
      control,
      el('button', { type: 'button', class: 'paso__boton', 'aria-label': `Uno más de ${item.nombre}`, onclick: () => cambiarCantidad(item.productoId, item.cantidad + paso) }, icono('sumar', { tamano: 16 }))),
    el('strong', { class: 'ticket__subtotal' }, plata(item.precio * item.cantidad)));
}

function renderTicket({ resaltar = null } = {}) {
  const total = totalTicket(estado.items);
  const unidades = estado.items.reduce((t, i) => t + (i.unidad === 'kg' ? 1 : i.cantidad), 0);
  $('#ticket-items').replaceChildren(...estado.items.map((i) => filaTicket(i, resaltar)));
  $('#ticket-vacio').hidden = estado.items.length > 0;
  $('#ticket-vaciar').hidden = !estado.items.length;
  $('#ticket-total').textContent = plata(total);
  $('#ticket-resumen-barra').textContent = estado.items.length ? `${unidades} ${unidades === 1 ? 'producto' : 'productos'} · ${plata(total)}` : 'Ticket vacío';

  // Efectivo: monto recibido y vuelto
  const efectivo = estado.medio === 'efectivo';
  $('#ticket-efectivo').hidden = !efectivo || !estado.items.length;
  if (efectivo) {
    $('#ticket-sugeridos').replaceChildren(...montosSugeridos(total).map((m) => el('button', {
      type: 'button', 'aria-pressed': String(estado.recibido === m),
      onclick: () => {
        estado.recibido = m;
        $('#ticket-recibido').value = paraCampo(m);
        renderTicket();
      },
    }, plata(m))));
    const v = vuelto(total, estado.recibido);
    const vueltoTexto = $('#ticket-vuelto');
    if (estado.recibido == null) vueltoTexto.textContent = '';
    else if (v == null) vueltoTexto.textContent = `Faltan ${plata(total - estado.recibido)}`;
    else vueltoTexto.replaceChildren('Vuelto ', el('strong', {}, plata(v)));
    vueltoTexto.classList.toggle('negativo', v == null && estado.recibido != null);
  }
  const cobrar = $('#ticket-cobrar');
  cobrar.disabled = !estado.items.length;
  cobrar.textContent = estado.items.length ? `Cobrar ${plata(total)}` : 'Cobrar';
}

async function cobrar() {
  if (!estado.items.length) return;
  const porId = new Map(datos.productos.map((p) => [p.id, p]));
  const sinStock = faltantes(estado.items, porId);
  if (sinStock.length) {
    const seguir = await dialogo({
      titulo: 'Hay productos sin stock suficiente',
      descripcion: 'Si los tenés en el local, cobrá igual: el stock va a quedar en negativo hasta que lo corrijas con un recuento.',
      contenido: el('ul', { class: 'lista-simple' }, sinStock.map((f) => el('li', {}, `${f.nombre}: querés vender ${num(f.pedido)}, figuran ${num(Math.max(0, f.disponible))}`))),
      botones: [{ texto: 'Revisar el ticket', valor: false }, { texto: 'Cobrar igual', valor: true, tipo: 'primario' }],
    });
    if (!seguir) return;
  }
  try {
    const venta = await registrarVenta({ items: estado.items, medio: estado.medio, recibido: estado.recibido });
    const v = vuelto(venta.total, venta.recibido);
    estado.items = [];
    estado.recibido = null;
    $('#ticket-recibido').value = '';
    guardarTicket();
    renderTicket();
    renderCatalogo();
    document.querySelector('.ticket')?.classList.remove('ticket--abierto');
    avisar(`Ticket ${venta.numero} cobrado: ${plata(venta.total)} en ${MEDIOS_DE_PAGO[venta.medio].toLowerCase()}${v ? `. Vuelto: ${plata(v)}` : ''}.`, {
      accion: {
        texto: 'Deshacer',
        alHacer: async () => {
          await anularVenta(venta.id);
          // Si no empezaste otro ticket, se vuelve a cargar el anulado para corregirlo.
          const recargar = estado.items.length === 0;
          if (recargar) {
            estado.items = venta.items.map(({ productoId, nombre, precio, unidad, cantidad: c }) => ({ productoId, nombre, precio, unidad, cantidad: c }));
            guardarTicket();
            renderTicket();
          }
          renderCatalogo();
          avisar(recargar ? `Ticket ${venta.numero} anulado. Lo volvimos a cargar para que lo corrijas.` : `Ticket ${venta.numero} anulado y el stock devuelto.`);
        },
      },
      duracion: 8000,
    });
    $('#caja-buscar').focus();
  } catch (error) {
    avisar(error.message, { tipo: 'error' });
  }
}

const num = (v) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(v);

// --- Vista ----------------------------------------------------------------

export function render(contenedor) {
  const cats = categorias();
  contenedor.replaceChildren(
    el('div', { class: 'caja' },
      el('section', { class: 'caja__catalogo', 'aria-labelledby': 'titulo-vista' },
        el('div', { class: 'cabecera-vista' },
          el('h1', { id: 'titulo-vista' }, 'Vender')),
        el('div', { class: 'buscador' },
          icono('buscar'),
          el('label', { for: 'caja-buscar', class: 'solo-lectores' }, 'Buscar producto o escanear código'),
          el('input', {
            id: 'caja-buscar', type: 'search', placeholder: 'Buscar o escanear código', autocomplete: 'off', enterkeyhint: 'search',
            oninput: (e) => {
              estado.consulta = e.target.value;
              renderCatalogo();
            },
            onkeydown: (e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const lista = resultados();
              // Un lector de códigos escribe el código y "aprieta" Enter: si hay una coincidencia, se agrega directo.
              if (lista.length >= 1 && (lista.length === 1 || lista[0].codigo === estado.consulta.trim())) {
                agregar(lista[0]);
                e.target.value = '';
                estado.consulta = '';
                renderCatalogo();
              } else if (!lista.length) avisar(`No encontramos "${estado.consulta}".`, { tipo: 'error', duracion: 3000 });
            },
          }),
          el('kbd', { class: 'buscador__atajo', 'aria-hidden': 'true' }, '/')),
        cats.length > 1 ? el('div', { class: 'chips', id: 'caja-categorias', role: 'group', 'aria-label': 'Filtrar por categoría' },
          el('button', { type: 'button', 'aria-pressed': 'true', dataset: { categoria: '' }, onclick: () => { estado.categoria = null; renderCatalogo(); } }, 'Todo'),
          cats.map((c) => el('button', { type: 'button', 'aria-pressed': 'false', dataset: { categoria: c }, onclick: () => { estado.categoria = c; renderCatalogo(); } }, c))) : null,
        el('ul', { id: 'caja-grilla', class: 'grilla-caja', onclick: (e) => {
          const boton = e.target.closest('[data-id]');
          if (boton) agregar(productoPorId(boton.dataset.id));
        } }),
        el('p', { id: 'caja-vacio', class: 'vacio', hidden: true })),

      el('aside', { class: 'ticket', 'aria-labelledby': 'ticket-titulo' },
        el('button', { type: 'button', class: 'ticket__barra', 'aria-controls': 'ticket-cuerpo', onclick: (e) => {
          const abierto = document.querySelector('.ticket').classList.toggle('ticket--abierto');
          e.currentTarget.setAttribute('aria-expanded', String(abierto));
        } }, el('span', { id: 'ticket-resumen-barra' }), el('span', { class: 'ticket__barra-accion' }, 'Ver ticket')),
        el('div', { class: 'ticket__cuerpo', id: 'ticket-cuerpo' },
          el('div', { class: 'ticket__cabecera' },
            el('h2', { id: 'ticket-titulo' }, 'Ticket'),
            el('button', { type: 'button', id: 'ticket-vaciar', class: 'boton-texto', onclick: () => {
              estado.items = [];
              estado.recibido = null;
              guardarTicket();
              renderTicket();
            } }, 'Vaciar')),
          el('ol', { id: 'ticket-items', class: 'ticket__items', 'aria-live': 'polite' }),
          el('p', { id: 'ticket-vacio', class: 'ticket__vacio' }, 'Tocá un producto o escaneá su código para agregarlo.'),
          el('div', { class: 'ticket__pie' },
            el('div', { class: 'ticket__total' }, el('span', {}, 'Total'), el('strong', { id: 'ticket-total' }, '$ 0')),
            el('fieldset', { class: 'medios' },
              el('legend', {}, 'Cómo paga'),
              Object.entries(MEDIOS_DE_PAGO).filter(([k]) => k !== 'credito').map(([valor, texto]) =>
                el('label', { class: 'medio' },
                  el('input', { type: 'radio', name: 'medio', value: valor, checked: valor === estado.medio, onchange: () => {
                    estado.medio = valor;
                    renderTicket();
                  } }),
                  el('span', {}, texto)))),
            el('div', { id: 'ticket-efectivo', class: 'efectivo' },
              el('label', { for: 'ticket-recibido' }, 'Te da'),
              el('input', { id: 'ticket-recibido', type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '$', oninput: (e) => {
                estado.recibido = leerEntrada(e.target.value);
                const v = $('#ticket-vuelto');
                const total = totalTicket(estado.items);
                const r = vuelto(total, estado.recibido);
                v.classList.toggle('negativo', r == null && estado.recibido != null);
                if (estado.recibido == null) v.textContent = '';
                else if (r == null) v.textContent = `Faltan ${plata(total - estado.recibido)}`;
                else v.replaceChildren('Vuelto ', el('strong', {}, plata(r)));
              } }),
              el('div', { id: 'ticket-sugeridos', class: 'atajos', role: 'group', 'aria-label': 'Montos rápidos' }),
              el('p', { id: 'ticket-vuelto', class: 'efectivo__vuelto', 'aria-live': 'polite' })),
            el('button', { type: 'button', id: 'ticket-cobrar', class: 'boton boton--primario boton--grande', onclick: cobrar }, 'Cobrar'),
            el('p', { class: 'ticket__ayuda' }, el('kbd', {}, 'Ctrl'), ' + ', el('kbd', {}, 'Enter'), ' para cobrar'))))),
  );
  renderCatalogo();
  renderTicket();

  const teclas = (e) => {
    const escribiendo = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
    if (e.key === '/' && !escribiendo && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      $('#caja-buscar').focus();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      cobrar();
    }
  };
  document.addEventListener('keydown', teclas);
  if (matchMedia('(pointer: fine)').matches) $('#caja-buscar').focus();
  return () => document.removeEventListener('keydown', teclas);
}

/** Se llama cuando cambian los datos (otra pestaña, una importación): refresca stock y precios del catálogo. */
export function alCambiarDatos() {
  if ($('#caja-grilla')) renderCatalogo();
}
