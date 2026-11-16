// Diálogo para mover el stock de un producto: entró mercadería, pérdida o recuento.

import { TIPOS_MOVIMIENTO, registrarMovimiento } from '../datos.js';
import { avisar, cantidad, dialogo, el, leerEntrada, paraCampo, plata } from '../ui.js';

const AYUDAS = {
  entrada: 'Cuántas unidades llegaron. Se suman al stock.',
  perdida: 'Cuántas se rompieron, vencieron o faltan. Se restan del stock.',
  recuento: 'Cuántas contaste en el local. El stock pasa a ser ese número.',
};

export async function cargarStockRapido(producto, tipoInicial = 'entrada') {
  let tipo = tipoInicial;
  const unidadTexto = producto.unidad === 'kg' ? 'kilos' : 'unidades';
  const cantidadCampo = el('input', { type: 'text', inputmode: 'decimal', name: 'cantidad', autocomplete: 'off', id: 'mov-cantidad' });
  const costoCampo = el('input', { type: 'text', inputmode: 'decimal', name: 'costo', autocomplete: 'off', id: 'mov-costo', placeholder: paraCampo(producto.costo) });
  const motivo = el('input', { type: 'text', name: 'motivo', autocomplete: 'off', id: 'mov-motivo', placeholder: 'Opcional' });
  const ayuda = el('p', { class: 'campo__ayuda', id: 'mov-ayuda' });
  const etiquetaCantidad = el('label', { for: 'mov-cantidad' });
  const campoCosto = el('div', { class: 'campo' }, el('label', { for: 'mov-costo' }, 'Costo por unidad'), costoCampo, el('p', { class: 'campo__ayuda' }, 'Si cambió, actualizamos el costo del producto.'));
  const resultado = el('p', { class: 'dialogo__resumen', 'aria-live': 'polite' });

  const actualizar = () => {
    ayuda.textContent = AYUDAS[tipo];
    etiquetaCantidad.textContent = tipo === 'recuento' ? `${unidadTexto[0].toUpperCase()}${unidadTexto.slice(1)} contadas` : `Cantidad (${unidadTexto})`;
    campoCosto.hidden = tipo !== 'entrada';
    const valor = leerEntrada(cantidadCampo.value);
    if (valor == null) {
      resultado.textContent = `Ahora: ${cantidad(producto.stock, producto.unidad)}`;
      return;
    }
    const final = tipo === 'entrada' ? producto.stock + valor : tipo === 'perdida' ? producto.stock - valor : valor;
    resultado.textContent = `Ahora: ${cantidad(producto.stock, producto.unidad)}. Va a quedar en ${cantidad(Math.round(final * 1000) / 1000, producto.unidad)}.`;
  };

  const opciones = el('div', { class: 'segmentado segmentado--ancho', role: 'radiogroup', 'aria-label': 'Qué pasó' },
    ['entrada', 'perdida', 'recuento'].map((t) => {
      const boton = el('button', { type: 'button', role: 'radio', 'aria-checked': String(t === tipo), dataset: { tipo: t }, onclick: () => {
        tipo = t;
        for (const b of opciones.children) b.setAttribute('aria-checked', String(b.dataset.tipo === t));
        actualizar();
        cantidadCampo.focus();
      } }, TIPOS_MOVIMIENTO[t]);
      return boton;
    }));
  opciones.addEventListener('keydown', (e) => {
    const lista = [...opciones.children];
    const i = lista.indexOf(document.activeElement);
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (i >= 0 && d) {
      e.preventDefault();
      lista[(i + d + lista.length) % lista.length].click();
      lista[(i + d + lista.length) % lista.length].focus();
    }
  });
  cantidadCampo.addEventListener('input', actualizar);
  actualizar();

  const guardar = async () => {
    const valor = leerEntrada(cantidadCampo.value);
    if (valor == null || valor < 0 || (tipo !== 'recuento' && valor === 0)) {
      avisar('Escribí una cantidad válida.', { tipo: 'error' });
      cantidadCampo.focus();
      return false;
    }
    await registrarMovimiento({ productoId: producto.id, tipo, cantidad: valor, motivo: motivo.value.trim(), costoUnitario: leerEntrada(costoCampo.value) });
    avisar(`${producto.nombre}: stock actualizado a ${cantidad(producto.stock, producto.unidad)}.`);
    return true;
  };

  const form = el('form', { class: 'formulario', onsubmit: async (e) => {
    e.preventDefault();
    if (await guardar()) form.closest('dialog')?.querySelector('.dialogo__cabecera button')?.click();
  } },
  opciones,
  el('div', { class: 'fila-campos' },
    el('div', { class: 'campo' }, etiquetaCantidad, cantidadCampo, ayuda),
    campoCosto),
  el('div', { class: 'campo' }, el('label', { for: 'mov-motivo' }, 'Nota'), motivo),
  resultado);

  return dialogo({
    titulo: producto.nombre,
    descripcion: `Stock actual: ${cantidad(producto.stock, producto.unidad)}. Precio: ${plata(producto.precio)}.`,
    contenido: form,
    botones: [{ texto: 'Cancelar', valor: false }, { texto: 'Guardar', tipo: 'primario', valor: true, alHacer: guardar }],
  });
}
