// Alta y edición de un producto, con su historial de stock.

import {
  TIPOS_MOVIMIENTO, archivarProducto, categorias, datos, guardarProducto, movimientosDe, productoPorId, proveedores,
} from '../datos.js';
import { diasDeStock, estadoStock, gananciaSobreCosto, precioDesdeGanancia, vendidoPorProducto } from '../logica.js';
import {
  $, avisar, campo, cantidad, confirmar, el, fechaCorta, hace, hora, icono, leerEntrada, mostrarErrores, paraCampo, pildoraEstado, plata,
} from '../ui.js';
import { escanearCodigo, puedeEscanear } from './escaner.js';
import { cargarStockRapido } from './stock-rapido.js';

function formulario(p, esNuevo) {
  const control = (tag, atributos) => el(tag, { autocomplete: 'off', ...atributos });
  const nombre = control('input', { type: 'text', name: 'nombre', value: p?.nombre ?? '', required: true, placeholder: 'Ej.: Yerba mate 1 kg' });
  const categoria = control('input', { type: 'text', name: 'categoria', value: p?.categoria ?? '', list: 'lista-categorias', placeholder: 'Ej.: Almacén' });
  const codigo = control('input', { type: 'text', name: 'codigo', value: p?.codigo ?? '', inputmode: 'numeric', placeholder: 'Escaneá o escribí el código' });
  const costo = control('input', { type: 'text', name: 'costo', inputmode: 'decimal', value: paraCampo(p?.costo ?? null), placeholder: '0' });
  const ganancia = control('input', { type: 'text', name: 'ganancia', inputmode: 'decimal', placeholder: String(datos.config.gananciaPorDefecto) });
  const precio = control('input', { type: 'text', name: 'precio', inputmode: 'decimal', value: paraCampo(p?.precio ?? null), required: true, placeholder: '0' });
  const stock = control('input', { type: 'text', name: 'stock', inputmode: 'decimal', value: '', placeholder: '0' });
  const minimo = control('input', { type: 'text', name: 'minimo', inputmode: 'decimal', value: paraCampo(p?.minimo ?? null), placeholder: '0' });
  const ideal = control('input', { type: 'text', name: 'ideal', inputmode: 'decimal', value: p?.ideal ? paraCampo(p.ideal) : '', placeholder: 'El doble del mínimo' });
  const proveedor = control('input', { type: 'text', name: 'proveedor', value: p?.proveedor ?? '', list: 'lista-proveedores', placeholder: 'Ej.: Distribuidora Del Sur' });
  let unidad = p?.unidad ?? 'u';

  const g = gananciaSobreCosto(p?.costo, p?.precio);
  if (g != null) ganancia.value = paraCampo(Math.round(g * 10) / 10);

  // Costo y ganancia calculan el precio; si se escribe el precio, se recalcula la ganancia.
  const desdeGanancia = () => {
    const c = leerEntrada(costo.value);
    const gan = leerEntrada(ganancia.value) ?? datos.config.gananciaPorDefecto;
    if (c > 0) precio.value = paraCampo(precioDesdeGanancia(c, gan, datos.config.redondeo));
  };
  const desdePrecio = () => {
    const nueva = gananciaSobreCosto(leerEntrada(costo.value), leerEntrada(precio.value));
    ganancia.value = nueva == null ? '' : paraCampo(Math.round(nueva * 10) / 10);
  };
  costo.addEventListener('input', () => (leerEntrada(precio.value) && !leerEntrada(ganancia.value) ? desdePrecio() : desdeGanancia()));
  ganancia.addEventListener('input', desdeGanancia);
  precio.addEventListener('input', desdePrecio);

  const unidades = el('div', { class: 'segmentado', role: 'radiogroup', 'aria-labelledby': 'unidad-etiqueta' },
    [['u', 'Por unidad'], ['kg', 'Por kilo']].map(([valor, texto]) => el('button', {
      type: 'button', role: 'radio', 'aria-checked': String(unidad === valor), dataset: { valor },
      onclick: (e) => {
        unidad = valor;
        for (const b of unidades.children) b.setAttribute('aria-checked', String(b === e.currentTarget));
      },
    }, texto)));

  const botonEscanear = puedeEscanear()
    ? el('button', { type: 'button', class: 'boton-icono boton-icono--borde', 'aria-label': 'Escanear código con la cámara', onclick: async () => {
      const leido = await escanearCodigo();
      if (leido) codigo.value = leido;
    } }, icono('codigo'))
    : null;

  const form = el('form', { class: 'formulario formulario--producto', novalidate: true },
    el('datalist', { id: 'lista-categorias' }, categorias().map((c) => el('option', { value: c }))),
    el('datalist', { id: 'lista-proveedores' }, proveedores().map((c) => el('option', { value: c }))),
    el('fieldset', { class: 'grupo' },
      el('legend', {}, 'Qué es'),
      campo({ etiqueta: 'Nombre', id: 'f-nombre', control: nombre }),
      el('div', { class: 'fila-campos' },
        campo({ etiqueta: 'Categoría', id: 'f-categoria', control: categoria }),
        el('div', { class: 'campo' }, el('span', { class: 'campo__etiqueta', id: 'unidad-etiqueta' }, 'Se vende'), unidades)),
      el('div', { class: 'campo' },
        el('label', { for: 'f-codigo' }, 'Código de barras'),
        el('div', { class: 'con-boton' }, Object.assign(codigo, { id: 'f-codigo', 'aria-describedby': 'f-codigo-error' }), botonEscanear),
        el('p', { class: 'campo__error', id: 'f-codigo-error', hidden: true }))),
    el('fieldset', { class: 'grupo' },
      el('legend', {}, 'Precio'),
      el('div', { class: 'fila-campos fila-campos--3' },
        campo({ etiqueta: 'Costo', id: 'f-costo', control: costo, ayuda: 'Lo que te cobra el proveedor.' }),
        campo({ etiqueta: 'Ganancia %', id: 'f-ganancia', control: ganancia, ayuda: 'Sobre el costo.' }),
        campo({ etiqueta: 'Precio de venta', id: 'f-precio', control: precio, ayuda: datos.config.redondeo ? `Redondeado a $${datos.config.redondeo}.` : null }))),
    el('fieldset', { class: 'grupo' },
      el('legend', {}, 'Stock'),
      el('div', { class: `fila-campos ${esNuevo ? 'fila-campos--3' : ''}` },
        esNuevo ? campo({ etiqueta: 'Stock actual', id: 'f-stock', control: stock, ayuda: 'Lo que tenés hoy.' }) : null,
        campo({ etiqueta: 'Avisarme con', id: 'f-minimo', control: minimo, ayuda: 'Cuando quede esto o menos, aparece en Reponer.' }),
        campo({ etiqueta: 'Reponer hasta', id: 'f-ideal', control: ideal, ayuda: 'Cuánto querés tener después de pedir.' })),
      campo({ etiqueta: 'Proveedor', id: 'f-proveedor', control: proveedor })),
    el('div', { class: 'formulario__acciones' },
      el('button', { type: 'submit', class: 'boton boton--primario' }, esNuevo ? 'Guardar producto' : 'Guardar cambios'),
      esNuevo ? el('button', { type: 'button', class: 'boton boton--secundario', dataset: { otro: '1' } }, 'Guardar y cargar otro') : null,
      el('a', { href: '#/productos', class: 'boton boton--texto' }, 'Cancelar')));

  const enviar = async (otro) => {
    try {
      const guardado = await guardarProducto({
        id: p?.id, nombre: nombre.value, categoria: categoria.value, codigo: codigo.value, unidad,
        costo: leerEntrada(costo.value) ?? 0, precio: leerEntrada(precio.value), stock: leerEntrada(stock.value) ?? 0,
        minimo: leerEntrada(minimo.value) ?? 0, ideal: leerEntrada(ideal.value) ?? 0, proveedor: proveedor.value,
      });
      avisar(esNuevo ? `"${guardado.nombre}" agregado.` : 'Cambios guardados.');
      if (otro) {
        // Mantiene categoría y proveedor, que suelen repetirse al cargar mercadería.
        for (const c of [nombre, codigo, costo, precio, stock, minimo, ideal]) c.value = '';
        nombre.focus();
      } else location.hash = esNuevo ? '#/productos' : `#/productos/${guardado.id}`;
    } catch (error) {
      if (error.campos) mostrarErrores(form, error.campos);
      else avisar(error.message, { tipo: 'error' });
    }
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(false);
  });
  form.querySelector('[data-otro]')?.addEventListener('click', () => enviar(true));
  return form;
}

function panelProducto(p) {
  const est = estadoStock(p);
  const vendido = vendidoPorProducto(datos.ventas).get(p.id) ?? 0;
  const dias = diasDeStock(p.stock, vendido);
  const movimientos = movimientosDe(p.id).slice(0, 40);
  return el('aside', { class: 'panel-producto' },
    el('section', { class: 'tarjeta-stock', 'aria-labelledby': 'stock-titulo' },
      el('h2', { id: 'stock-titulo', class: 'titulo-chico' }, 'Stock'),
      el('p', { class: 'tarjeta-stock__cifra' }, cantidad(p.stock, p.unidad)),
      el('p', {}, pildoraEstado(est)),
      el('dl', { class: 'datos-lista' },
        el('div', {}, el('dt', {}, 'Vendido en 4 semanas'), el('dd', {}, cantidad(vendido, p.unidad))),
        el('div', {}, el('dt', {}, 'Alcanza para'), el('dd', {}, dias == null ? 'Sin ventas recientes' : dias < 1 ? 'Menos de un día' : Math.round(dias) === 1 ? '1 día' : `${Math.round(dias)} días`)),
        el('div', {}, el('dt', {}, 'Mercadería a costo'), el('dd', {}, plata(Math.max(0, p.stock) * (p.costo || 0))))),
      el('div', { class: 'tarjeta-stock__acciones' },
        el('button', { type: 'button', class: 'boton boton--primario', onclick: () => cargarStockRapido(p, 'entrada') }, 'Entró mercadería'),
        el('button', { type: 'button', class: 'boton boton--secundario', onclick: () => cargarStockRapido(p, 'perdida') }, 'Pérdida'),
        el('button', { type: 'button', class: 'boton boton--secundario', onclick: () => cargarStockRapido(p, 'recuento') }, 'Recuento'))),
    el('section', { 'aria-labelledby': 'historial-titulo' },
      el('h2', { id: 'historial-titulo', class: 'titulo-chico' }, 'Historial'),
      movimientos.length
        ? el('ol', { class: 'historial' }, movimientos.map((m) => el('li', { class: `historial__item historial__item--${m.cantidad >= 0 ? 'suma' : 'resta'}` },
          el('span', { class: 'historial__cantidad' }, `${m.cantidad > 0 ? '+' : m.cantidad < 0 ? '−' : ''}${cantidad(Math.abs(m.cantidad), p.unidad)}`),
          el('span', { class: 'historial__texto' }, TIPOS_MOVIMIENTO[m.tipo] ?? m.tipo, m.motivo && m.motivo !== TIPOS_MOVIMIENTO[m.tipo] ? el('small', {}, m.motivo) : null),
          el('time', { datetime: new Date(m.fecha).toISOString(), title: `${fechaCorta(m.fecha)} ${hora(m.fecha)}` }, hace(m.fecha)))))
        : el('p', { class: 'nota' }, 'Todavía no hay movimientos.')),
    el('button', { type: 'button', class: 'boton boton--texto boton--peligro-texto', onclick: async () => {
      if (await confirmar(`¿Quitar "${p.nombre}"?`, 'Deja de aparecer en la caja y en las listas. Las ventas anteriores se conservan.', { texto: 'Quitar producto', peligro: true })) {
        await archivarProducto(p.id);
        avisar(`"${p.nombre}" quitado.`, { accion: { texto: 'Deshacer', alHacer: () => archivarProducto(p.id, false) } });
        location.hash = '#/productos';
      }
    } }, icono('basura', { tamano: 18 }), 'Quitar producto'));
}

export function render(contenedor, params, ruta) {
  const id = ruta.split('/')[2];
  const esNuevo = id === 'nuevo';
  const p = esNuevo ? null : productoPorId(id);
  if (!esNuevo && !p) {
    contenedor.replaceChildren(el('div', { class: 'vacio' }, el('h1', { id: 'titulo-vista' }, 'No encontramos ese producto'), el('a', { href: '#/productos', class: 'boton boton--secundario' }, 'Volver a productos')));
    return;
  }
  contenedor.replaceChildren(
    el('a', { href: '#/productos', class: 'volver' }, icono('atras', { tamano: 18 }), 'Productos'),
    el('div', { class: 'cabecera-vista' }, el('h1', { id: 'titulo-vista' }, esNuevo ? 'Nuevo producto' : p.nombre)),
    el('div', { class: esNuevo ? 'una-columna' : 'dos-columnas' }, formulario(p, esNuevo), esNuevo ? null : panelProducto(p)),
  );
  if (esNuevo) $('#f-nombre')?.focus();
}

export function alCambiarDatos(contenedor, params, ruta) {
  // Si cambia el stock de este producto, se refresca solo el panel (el formulario puede tener cambios sin guardar).
  const id = ruta.split('/')[2];
  const p = productoPorId(id);
  const panel = contenedor.querySelector('.panel-producto');
  if (p && panel) panel.replaceWith(panelProducto(p));
}
