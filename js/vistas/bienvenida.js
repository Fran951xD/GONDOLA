// Primera vez: tres caminos claros para empezar.

import { guardarConfig } from '../datos.js';
import { avisar, el, icono } from '../ui.js';
import { cargarEjemplo, importarPlanilla } from './ajustes.js';

export function render(contenedor) {
  const nombre = el('input', { type: 'text', id: 'bv-nombre', autocomplete: 'organization', placeholder: 'Ej.: Almacén La Esquina' });
  const guardarNombre = async () => {
    if (nombre.value.trim()) await guardarConfig({ negocio: nombre.value.trim() });
  };
  contenedor.replaceChildren(
    el('div', { class: 'bienvenida' },
      el('p', { class: 'marca marca--grande', 'aria-hidden': 'true' }, 'góndola'),
      el('h1', { id: 'titulo-vista' }, 'El stock de tu negocio, al día'),
      el('p', { class: 'bienvenida__bajada' }, 'Vendé desde la caja y el stock se descuenta solo. Sabé qué falta, armá el pedido para el proveedor y mirá cuánto vendiste. Sin internet, sin cuentas y sin pagar nada.'),
      el('ul', { class: 'bienvenida__beneficios', 'aria-label': 'Ventajas' },
        ['Funciona sin internet', 'Gratis', 'Sin cuentas'].map((b) => el('li', {}, icono('check', { tamano: 16 }), b))),
      // vista de la app en miniatura (decorativa)
      el('div', { class: 'muestra', 'aria-hidden': 'true' },
        el('div', { class: 'muestra__barra' }, el('span'), el('span'), el('span')),
        el('div', { class: 'muestra__cuerpo' },
          el('div', { class: 'muestra__grilla' },
            [['Yerba 1 kg', '$ 5.890'], ['Leche 1 L', '$ 1.450'], ['Galletitas', '$ 1.540'], ['Gaseosa 2,25 L', '$ 3.200']].map(([n, p]) =>
              el('div', { class: 'muestra__producto' }, n, el('span', { class: 'etiqueta-precio' }, p)))),
          el('div', { class: 'muestra__ticket' },
            el('p', {}, el('span', {}, 'Yerba 1 kg'), el('span', {}, '$ 5.890')),
            el('p', {}, el('span', {}, 'Leche 1 L × 2'), el('span', {}, '$ 2.900')),
            el('div', { class: 'muestra__total' }, el('span', {}, 'Total'), el('strong', {}, '$ 8.790')),
            el('div', { class: 'muestra__cobrar' }, 'Cobrar')))),
      el('div', { class: 'campo bienvenida__nombre' }, el('label', { for: 'bv-nombre' }, '¿Cómo se llama tu negocio?'), nombre),
      el('ul', { class: 'caminos' },
        el('li', {}, el('a', { href: '#/productos/nuevo', class: 'camino', onclick: guardarNombre },
          icono('sumar', { tamano: 24 }), el('strong', {}, 'Cargar mis productos'), el('span', {}, 'De a uno, con el lector de códigos o escribiendo.'))),
        el('li', {}, el('button', { type: 'button', class: 'camino', onclick: async () => {
          await guardarNombre();
          await importarPlanilla();
          if (location.hash !== '#/hoy') location.hash = '#/productos';
        } }, icono('subir', { tamano: 24 }), el('strong', {}, 'Importar una planilla'), el('span', {}, 'Si ya los tenés en Excel o Google Sheets.'))),
        el('li', {}, el('button', { type: 'button', class: 'camino camino--secundario', onclick: async () => {
          await cargarEjemplo();
          avisar('Es un negocio inventado: cuando quieras empezar con el tuyo, borralo desde Ajustes.');
        } }, icono('caja', { tamano: 24 }), el('strong', {}, 'Probar con un ejemplo'), el('span', {}, 'Un almacén con productos y un mes de ventas.')))),
      el('p', { class: 'nota bienvenida__privacidad' }, 'Tus datos quedan en este dispositivo. Nadie más los ve.')),
  );
}
