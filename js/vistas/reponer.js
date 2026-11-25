// Reponer: lo que falta, agrupado por proveedor, con el pedido listo para mandar por WhatsApp.

import { datos, guardarTelefonoProveedor, recibirMercaderia } from '../datos.js';
import { enlaceWhatsApp, listaDeReposicion, textoDelPedido } from '../logica.js';
import {
  $, avisar, cantidad, dialogo, el, icono, leerEntrada, paraCampo, pildoraEstado, plata,
} from '../ui.js';

// Cantidades editadas a mano (productoId → cantidad), para que no se pierdan al refrescar.
const editadas = new Map();

const cantidadDe = (item) => editadas.get(item.producto.id) ?? item.pedir;

function textoGrupo(grupo) {
  return textoDelPedido({
    proveedor: grupo.proveedor,
    negocio: datos.config.negocio,
    items: grupo.items.map((i) => ({ ...i, pedir: cantidadDe(i) })),
  });
}

async function copiarPedido(grupo, boton) {
  try {
    await navigator.clipboard.writeText(textoGrupo(grupo));
    boton.replaceChildren(icono('check', { tamano: 18 }), 'Copiado');
  } catch {
    avisar('No se pudo copiar. Mantené apretado el texto del pedido para copiarlo.', { tipo: 'error' });
  }
  setTimeout(() => boton.replaceChildren(icono('copiar', { tamano: 18 }), 'Copiar'), 1800);
}

async function llegoElPedido(grupo) {
  const filas = grupo.items.map((i) => {
    const cantidadCampo = el('input', { type: 'text', inputmode: 'decimal', value: paraCampo(cantidadDe(i)), 'aria-label': `Cantidad recibida de ${i.producto.nombre}` });
    const costoCampo = el('input', { type: 'text', inputmode: 'decimal', placeholder: paraCampo(i.producto.costo), 'aria-label': `Costo nuevo de ${i.producto.nombre} (opcional)` });
    return { i, cantidadCampo, costoCampo };
  });
  await dialogo({
    titulo: `Llegó el pedido de ${grupo.proveedor}`,
    descripcion: 'Revisá lo que llegó y corregí las cantidades. Si cambió algún costo, escribilo: lo actualizamos en el producto.',
    ancho: 'ancho',
    contenido: el('div', { class: 'tabla-scroll' },
      el('table', { class: 'tabla tabla--compacta tabla--formulario' },
        el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Producto'), el('th', { scope: 'col', class: 'num' }, 'Llegaron'), el('th', { scope: 'col', class: 'num' }, 'Costo nuevo'))),
        el('tbody', {}, filas.map(({ i, cantidadCampo, costoCampo }) => el('tr', {},
          el('th', { scope: 'row' }, i.producto.nombre, el('small', {}, `Hay ${cantidad(i.producto.stock, i.producto.unidad)}`)),
          el('td', { class: 'num' }, cantidadCampo),
          el('td', { class: 'num' }, costoCampo)))))),
    botones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: 'Sumar al stock', tipo: 'primario', valor: true,
        alHacer: async () => {
          const items = filas
            .map(({ i, cantidadCampo, costoCampo }) => ({ productoId: i.producto.id, cantidad: leerEntrada(cantidadCampo.value) ?? 0, costoUnitario: leerEntrada(costoCampo.value) }))
            .filter((x) => x.cantidad > 0);
          if (!items.length) {
            avisar('No hay cantidades para sumar.', { tipo: 'error' });
            return false;
          }
          await recibirMercaderia(items, `Pedido de ${grupo.proveedor}`);
          for (const x of items) editadas.delete(x.productoId);
          avisar(`Sumamos ${items.length} ${items.length === 1 ? 'producto' : 'productos'} al stock.`);
          return true;
        },
      },
    ],
  });
}

function grupoProveedor(grupo) {
  const telefono = datos.config.proveedores?.[grupo.proveedor]?.telefono ?? '';
  const sinProveedor = grupo.proveedor === 'Sin proveedor';
  const idGrupo = `prov-${grupo.proveedor.replace(/\W+/g, '-').toLowerCase()}`;
  const campoTelefono = el('input', {
    type: 'tel', inputmode: 'tel', id: `${idGrupo}-tel`, value: telefono, placeholder: '11 5555 1234', autocomplete: 'off',
    onchange: (e) => guardarTelefonoProveedor(grupo.proveedor, e.target.value).then(() => avisar('Guardamos el WhatsApp del proveedor.', { duracion: 2500 })),
  });
  const total = () => grupo.items.reduce((t, i) => t + cantidadDe(i) * (i.producto.costo || 0), 0);
  const totalTexto = el('span', {}, plata(total()));

  return el('section', { class: 'grupo-reponer', 'aria-labelledby': idGrupo },
    el('header', { class: 'grupo-reponer__cabecera' },
      el('div', {},
        el('h2', { id: idGrupo }, grupo.proveedor),
        el('p', { class: 'nota' }, `${grupo.items.length} ${grupo.items.length === 1 ? 'producto' : 'productos'}, alrededor de `, totalTexto, ' a costo')),
      sinProveedor ? null : el('div', { class: 'campo campo--en-linea' }, el('label', { for: `${idGrupo}-tel` }, 'WhatsApp'), campoTelefono)),
    el('div', { class: 'tabla-scroll' },
      el('table', { class: 'tabla' },
        el('thead', {}, el('tr', {},
          el('th', { scope: 'col' }, 'Producto'),
          el('th', { scope: 'col', class: 'num' }, 'Hay'),
          el('th', { scope: 'col', class: 'num col-opcional' }, 'Alcanza para'),
          el('th', { scope: 'col', class: 'num' }, 'Pedir'))),
        el('tbody', {}, grupo.items.map((i) => el('tr', {},
          el('th', { scope: 'row' }, el('a', { href: `#/productos/${i.producto.id}` }, i.producto.nombre), ' ', pildoraEstado(i.estado)),
          el('td', { class: 'num' }, cantidad(i.producto.stock, i.producto.unidad), el('small', { class: 'bloque nota' }, `mín. ${cantidad(i.producto.minimo, i.producto.unidad)}`)),
          el('td', { class: 'num col-opcional' }, i.dias == null ? '—' : i.dias < 1 ? 'Hoy' : Math.round(i.dias) === 1 ? '1 día' : `${Math.round(i.dias)} días`),
          el('td', { class: 'num' }, el('input', {
            type: 'text', inputmode: 'decimal', class: 'campo-tabla', value: paraCampo(cantidadDe(i)),
            'aria-label': `Cantidad a pedir de ${i.producto.nombre}`,
            onchange: (e) => {
              const n = leerEntrada(e.target.value);
              editadas.set(i.producto.id, n > 0 ? n : 0);
              totalTexto.textContent = plata(total());
            },
          }))))))),
    el('div', { class: 'grupo-reponer__acciones' },
      sinProveedor
        ? el('p', { class: 'nota' }, 'Asigná un proveedor a estos productos para armar el pedido por WhatsApp.')
        : el('a', {
          class: 'boton boton--whatsapp', target: '_blank', rel: 'noopener',
          href: enlaceWhatsApp(textoGrupo(grupo), telefono),
          onclick: (e) => { e.currentTarget.href = enlaceWhatsApp(textoGrupo(grupo), campoTelefono.value); },
        }, icono('whatsapp', { tamano: 18 }), 'Pedir por WhatsApp'),
      sinProveedor ? null : el('button', { type: 'button', class: 'boton boton--secundario', onclick: (e) => copiarPedido(grupo, e.currentTarget) }, icono('copiar', { tamano: 18 }), 'Copiar'),
      el('button', { type: 'button', class: 'boton boton--secundario', onclick: () => llegoElPedido(grupo) }, 'Llegó el pedido')));
}

export function render(contenedor) {
  const grupos = listaDeReposicion(datos.productos, datos.ventas);
  const totalItems = grupos.reduce((t, g) => t + g.items.length, 0);
  contenedor.replaceChildren(
    el('div', { class: 'cabecera-vista' },
      el('div', {},
        el('h1', { id: 'titulo-vista' }, 'Reponer'),
        el('p', { class: 'nota' }, totalItems
          ? `${totalItems} ${totalItems === 1 ? 'producto está' : 'productos están'} en el mínimo o agotados. Las cantidades sugeridas te dejan en el stock ideal; podés cambiarlas.`
          : ''))),
    totalItems
      ? el('div', { class: 'lista-grupos' }, grupos.map(grupoProveedor))
      : el('div', { class: 'vacio vacio--grande' },
        el('p', {}, el('strong', {}, 'No falta nada.')),
        el('p', {}, 'Cuando un producto llegue a su mínimo, aparece acá agrupado por proveedor. Para que funcione, cargá el mínimo de cada producto.'),
        el('a', { href: '#/productos', class: 'boton boton--secundario' }, 'Ver productos')),
  );
}

export const alCambiarDatos = (contenedor) => {
  if ($('#titulo-vista')?.textContent === 'Reponer') render(contenedor);
};
