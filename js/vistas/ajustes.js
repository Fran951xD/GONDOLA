// Ajustes: datos del negocio, copias de seguridad, planillas y reinicio.

import {
  almacenamientoPersistente, borrarTodo, crearRespaldo, datos, guardarConfig, importarProductos, marcarRespaldoHecho, reemplazarTodo, validarRespaldo,
} from '../datos.js';
import { crearNegocioDeEjemplo } from '../demo.js';
import { productosACSV, productosDesdeCSV } from '../logica.js';
import {
  $, avisar, campo, confirmar, descargar, dialogo, el, elegirArchivo, hace, icono, leerEntrada, paraCampo, plata,
} from '../ui.js';

const fechaArchivo = () => new Date().toISOString().slice(0, 10);
const slug = (texto) => (texto || 'negocio').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

export async function descargarRespaldo() {
  const respaldo = crearRespaldo();
  descargar(`gondola-${slug(datos.config.negocio)}-${fechaArchivo()}.json`, JSON.stringify(respaldo));
  await marcarRespaldoHecho();
  avisar('Copia descargada. Guardala en un lugar seguro: Drive, mail o un pendrive.');
}

async function restaurarRespaldo() {
  const archivo = await elegirArchivo('.json,application/json');
  if (!archivo) return;
  let json;
  try {
    json = JSON.parse(await archivo.text());
  } catch {
    avisar('El archivo no se pudo leer. ¿Es una copia de Góndola?', { tipo: 'error' });
    return;
  }
  const problema = validarRespaldo(json);
  if (problema) {
    avisar(problema, { tipo: 'error' });
    return;
  }
  const ok = await confirmar(
    'Restaurar la copia de seguridad',
    `La copia es de ${json.negocio || 'un negocio sin nombre'}, del ${new Date(json.creado).toLocaleDateString('es-AR')}, con ${json.productos.length} productos y ${json.ventas.length} ventas. Va a reemplazar todo lo que hay ahora en este dispositivo.`,
    { texto: 'Reemplazar con la copia', peligro: true },
  );
  if (!ok) return;
  await reemplazarTodo(json);
  avisar('Listo, restauramos la copia.');
  location.hash = '#/hoy';
}

/** Importar productos desde una planilla: muestra qué se entendió antes de guardar. */
export async function importarPlanilla() {
  const archivo = await elegirArchivo('.csv,text/csv,text/plain');
  if (!archivo) return;
  const { productos, errores, columnas } = productosDesdeCSV(await archivo.text());
  if (!productos.length) {
    await dialogo({
      titulo: 'No pudimos leer la planilla',
      contenido: el('div', {}, el('ul', { class: 'lista-simple' }, errores.map((e) => el('li', {}, e))), ayudaPlanilla()),
    });
    return;
  }
  const actualizarStock = el('input', { type: 'checkbox', id: 'imp-stock' });
  const detectadas = Object.keys(columnas).map((c) => ({ nombre: 'nombre', categoria: 'categoría', codigo: 'código', costo: 'costo', precio: 'precio', stock: 'stock', minimo: 'mínimo', proveedor: 'proveedor', unidad: 'unidad' }[c]));
  await dialogo({
    titulo: `Importar ${productos.length} productos`,
    ancho: 'ancho',
    contenido: el('div', {},
      el('p', {}, `Encontramos estas columnas: ${detectadas.join(', ')}. Si un producto ya existe (mismo código o mismo nombre), actualizamos sus datos.`),
      el('div', { class: 'tabla-scroll tabla-scroll--bajo' },
        el('table', { class: 'tabla tabla--compacta' },
          el('thead', {}, el('tr', {}, ['Producto', 'Categoría', 'Precio', 'Stock'].map((t, i) => el('th', { scope: 'col', class: i > 1 ? 'num' : '' }, t)))),
          el('tbody', {}, productos.slice(0, 8).map((p) => el('tr', {},
            el('th', { scope: 'row' }, p.nombre), el('td', {}, p.categoria), el('td', { class: 'num' }, plata(p.precio)), el('td', { class: 'num' }, String(p.stock))))))),
      productos.length > 8 ? el('p', { class: 'nota' }, `Y ${productos.length - 8} más.`) : null,
      errores.length ? el('details', { class: 'detalles' }, el('summary', {}, `${errores.length} avisos`), el('ul', { class: 'lista-simple' }, errores.slice(0, 30).map((e) => el('li', {}, e)))) : null,
      el('label', { class: 'casilla', for: 'imp-stock' }, actualizarStock, 'Reemplazar también el stock de los productos que ya existen')),
    botones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: 'Importar', tipo: 'primario', valor: true,
        alHacer: async () => {
          const r = await importarProductos(productos, { actualizarStock: actualizarStock.checked });
          avisar(`Importamos ${r.nuevos} productos nuevos${r.actualizados ? ` y actualizamos ${r.actualizados}` : ''}.`);
          return true;
        },
      },
    ],
  });
}

function ayudaPlanilla() {
  return el('div', { class: 'ayuda-planilla' },
    el('p', {}, 'La planilla tiene que tener una fila de títulos. Reconocemos columnas como:'),
    el('p', { class: 'codigo-ejemplo' }, 'Nombre; Categoría; Código; Costo; Precio; Stock; Mínimo; Proveedor; Unidad'),
    el('p', { class: 'nota' }, 'Solo el nombre es obligatorio. En Excel o Google Sheets: Archivo → Descargar → Valores separados por comas (.csv).'),
    el('button', { type: 'button', class: 'boton boton--chico boton--secundario', onclick: () => descargar('plantilla-gondola.csv', '﻿Nombre;Categoría;Código;Costo;Precio;Stock;Mínimo;Proveedor;Unidad\r\nYerba mate 1 kg;Almacén;7790000000001;3100;4190;12;6;Distribuidora Del Sur;unidad\r\nQueso cremoso;Fiambrería;;7200;10080;3,5;2;Lácteos La Pradera;kg\r\n', 'text/csv') },
      icono('descargar', { tamano: 16 }), 'Descargar plantilla de ejemplo'));
}

export async function cargarEjemplo() {
  if (datos.productos.length && !(await confirmar('Cargar el negocio de ejemplo', 'Va a reemplazar los datos que tenés ahora. Si querés conservarlos, descargá antes una copia de seguridad.', { texto: 'Reemplazar con el ejemplo', peligro: true }))) return;
  await reemplazarTodo(crearNegocioDeEjemplo());
  avisar('Cargamos un almacén de ejemplo con 30 días de ventas. Probá todo lo que quieras.');
  location.hash = '#/hoy';
}

async function borrarDatos() {
  const confirmacion = el('input', { type: 'text', autocomplete: 'off', id: 'borrar-confirmar' });
  await dialogo({
    titulo: 'Borrar todos los datos',
    descripcion: 'Se borran productos, ventas y movimientos de este dispositivo. No se puede deshacer.',
    contenido: el('div', { class: 'campo' }, el('label', { for: 'borrar-confirmar' }, 'Escribí BORRAR para confirmar'), confirmacion),
    botones: [
      { texto: 'Cancelar', valor: false },
      {
        texto: 'Borrar todo', tipo: 'peligro', valor: true,
        alHacer: async () => {
          if (confirmacion.value.trim().toUpperCase() !== 'BORRAR') {
            avisar('Escribí BORRAR para confirmar.', { tipo: 'error' });
            return false;
          }
          await borrarTodo();
          avisar('Borramos todos los datos.');
          location.hash = '#/';
          return true;
        },
      },
    ],
  });
}

let pedidoInstalacion = null;
globalThis.addEventListener?.('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoInstalacion = e;
  document.querySelector('#instalar-app')?.removeAttribute('hidden');
});

export function render(contenedor) {
  const negocio = el('input', { type: 'text', name: 'negocio', value: datos.config.negocio, autocomplete: 'organization', placeholder: 'Ej.: Almacén La Esquina' });
  const redondeo = el('select', { name: 'redondeo' }, [[0, 'Sin redondear'], [10, 'A $10'], [50, 'A $50'], [100, 'A $100']].map(([v, t]) => el('option', { value: v, selected: v === datos.config.redondeo }, t)));
  const ganancia = el('input', { type: 'text', inputmode: 'decimal', name: 'ganancia', value: paraCampo(datos.config.gananciaPorDefecto) });
  const persistente = el('span', {}, 'Revisando…');
  almacenamientoPersistente().then((ok) => {
    persistente.textContent = ok ? 'El navegador no va a borrar estos datos por falta de espacio.' : 'El navegador podría borrarlos si se queda sin espacio. Hacé copias seguido o instalá la app.';
  });

  contenedor.replaceChildren(
    el('div', { class: 'cabecera-vista' }, el('h1', { id: 'titulo-vista' }, 'Ajustes')),
    el('div', { class: 'ajustes' },
      el('section', { class: 'seccion-ajustes', 'aria-labelledby': 'aj-negocio' },
        el('h2', { id: 'aj-negocio' }, 'Tu negocio'),
        el('form', { class: 'formulario', onsubmit: async (e) => {
          e.preventDefault();
          await guardarConfig({ negocio: negocio.value.trim(), redondeo: Number(redondeo.value), gananciaPorDefecto: leerEntrada(ganancia.value) ?? 40 });
          avisar('Ajustes guardados.');
        } },
        campo({ etiqueta: 'Nombre del negocio', id: 'aj-nombre', control: negocio, ayuda: 'Aparece en los pedidos que mandás a los proveedores.' }),
        el('div', { class: 'fila-campos' },
          campo({ etiqueta: 'Redondear precios', id: 'aj-redondeo', control: redondeo, ayuda: 'Al calcular precios y aumentos.' }),
          campo({ etiqueta: 'Ganancia habitual %', id: 'aj-ganancia', control: ganancia, ayuda: 'Se propone al cargar un producto.' })),
        el('button', { type: 'submit', class: 'boton boton--primario' }, 'Guardar'))),

      el('section', { class: 'seccion-ajustes', 'aria-labelledby': 'aj-copias' },
        el('h2', { id: 'aj-copias' }, 'Copias de seguridad'),
        el('p', {}, 'Tus datos se guardan solo en este dispositivo, no en internet. Descargá una copia cada semana y guardala en Drive, en el mail o en un pendrive. Con ella podés pasar todo a otro celular o computadora.'),
        el('p', { class: 'nota' }, datos.config.ultimoRespaldo ? `Última copia: ${hace(datos.config.ultimoRespaldo)}.` : 'Todavía no hiciste ninguna copia.', ' ', persistente),
        el('div', { class: 'botonera' },
          el('button', { type: 'button', class: 'boton boton--primario', onclick: () => descargarRespaldo().then(() => render(contenedor)) }, icono('descargar', { tamano: 18 }), 'Descargar copia'),
          el('button', { type: 'button', class: 'boton boton--secundario', onclick: restaurarRespaldo }, icono('subir', { tamano: 18 }), 'Restaurar una copia'))),

      el('section', { class: 'seccion-ajustes', 'aria-labelledby': 'aj-planillas' },
        el('h2', { id: 'aj-planillas' }, 'Planillas'),
        el('p', {}, 'Si ya tenés tus productos en Excel o Google Sheets, importalos de una vez. También podés exportar la lista para imprimirla o compartirla.'),
        el('div', { class: 'botonera' },
          el('button', { type: 'button', class: 'boton boton--secundario', onclick: importarPlanilla }, icono('subir', { tamano: 18 }), 'Importar planilla'),
          el('button', { type: 'button', class: 'boton boton--secundario', onclick: () => descargar(`productos-${slug(datos.config.negocio)}-${fechaArchivo()}.csv`, productosACSV(datos.productos), 'text/csv;charset=utf-8') }, icono('descargar', { tamano: 18 }), 'Exportar productos')),
        el('details', { class: 'detalles' }, el('summary', {}, 'Cómo tiene que ser la planilla'), ayudaPlanilla())),

      el('section', { class: 'seccion-ajustes', 'aria-labelledby': 'aj-app' },
        el('h2', { id: 'aj-app' }, 'Usar como app'),
        el('p', {}, 'Góndola funciona sin internet. Instalala para abrirla desde el inicio del celular o la computadora, como cualquier app.'),
        el('button', { type: 'button', id: 'instalar-app', class: 'boton boton--secundario', hidden: !pedidoInstalacion, onclick: async () => {
          await pedidoInstalacion?.prompt();
          pedidoInstalacion = null;
          $('#instalar-app')?.setAttribute('hidden', '');
        } }, icono('instalar', { tamano: 18 }), 'Instalar Góndola'),
        el('p', { class: 'nota' }, 'En iPhone: tocá Compartir y después "Agregar a inicio".')),

      el('section', { class: 'seccion-ajustes seccion-ajustes--peligro', 'aria-labelledby': 'aj-reinicio' },
        el('h2', { id: 'aj-reinicio' }, 'Probar y empezar de nuevo'),
        el('div', { class: 'botonera' },
          el('button', { type: 'button', class: 'boton boton--secundario', onclick: cargarEjemplo }, 'Cargar negocio de ejemplo'),
          el('button', { type: 'button', class: 'boton boton--peligro', onclick: borrarDatos }, 'Borrar todos los datos')))),
  );
}
