// Arranque y navegación entre pantallas.

import { alCambiar, datos, hayDatos, iniciar } from './datos.js';
import { listaDeReposicion } from './logica.js';
import { $, $$, avisar } from './ui.js';
import * as ajustes from './vistas/ajustes.js';
import * as bienvenida from './vistas/bienvenida.js';
import * as hoy from './vistas/hoy.js';
import * as producto from './vistas/producto.js';
import * as productos from './vistas/productos.js';
import * as reponer from './vistas/reponer.js';
import * as vender from './vistas/vender.js';
import * as ventas from './vistas/ventas.js';

const RUTAS = [
  { patron: /^\/hoy$/, vista: hoy, titulo: 'Hoy', nav: 'hoy' },
  { patron: /^\/vender$/, vista: vender, titulo: 'Vender', nav: 'vender' },
  { patron: /^\/productos$/, vista: productos, titulo: 'Productos', nav: 'productos' },
  { patron: /^\/productos\/[\w-]+$/, vista: producto, titulo: 'Producto', nav: 'productos' },
  { patron: /^\/reponer$/, vista: reponer, titulo: 'Reponer', nav: 'reponer' },
  { patron: /^\/ventas$/, vista: ventas, titulo: 'Ventas', nav: 'ventas' },
  { patron: /^\/ajustes$/, vista: ajustes, titulo: 'Ajustes', nav: 'ajustes' },
  { patron: /^\/bienvenida$/, vista: bienvenida, titulo: 'Bienvenida', nav: null },
];

const actual = { ruta: null, vista: null, limpiar: null, params: null };

function leerHash() {
  const [ruta, consulta = ''] = location.hash.replace(/^#/, '').split('?');
  return { ruta: ruta || '/', params: new URLSearchParams(consulta) };
}

function navegar() {
  let { ruta, params } = leerHash();
  if (ruta === '/') {
    location.replace(hayDatos() ? '#/hoy' : '#/bienvenida');
    return;
  }
  const destino = RUTAS.find((r) => r.patron.test(ruta)) ?? RUTAS[0];
  if (!RUTAS.some((r) => r.patron.test(ruta))) ruta = '/hoy';

  actual.limpiar?.();
  const contenedor = $('#vista');
  contenedor.dataset.vista = destino.nav ?? 'bienvenida';
  document.body.classList.toggle('sin-navegacion', destino.vista === bienvenida);
  actual.ruta = ruta;
  actual.vista = destino.vista;
  actual.params = params;
  actual.limpiar = destino.vista.render(contenedor, params, ruta) ?? null;

  for (const enlace of $$('[data-nav]')) {
    if (enlace.dataset.nav === destino.nav) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
  const h1 = $('#titulo-vista');
  document.title = `${h1?.textContent || destino.titulo} · Góndola`;
  // Para lectores de pantalla: el foco va al título de la nueva pantalla (salvo en la caja, que enfoca el buscador).
  if (h1 && destino.vista !== vender) {
    h1.tabIndex = -1;
    h1.focus({ preventScroll: true });
  }
  window.scrollTo(0, 0);
  $('#menu-mas')?.removeAttribute('open');
}

function actualizarMarco() {
  const faltan = listaDeReposicion(datos.productos, datos.ventas).reduce((t, g) => t + g.items.length, 0);
  for (const insignia of $$('[data-insignia="reponer"]')) {
    insignia.textContent = faltan > 99 ? '99+' : String(faltan);
    insignia.hidden = faltan === 0;
    insignia.setAttribute('aria-label', `${faltan} para reponer`);
  }
  $('#nombre-negocio').textContent = datos.config.negocio || 'Tu negocio';
  $('#aviso-ejemplo').hidden = !datos.config.esEjemplo;
}

async function arrancar() {
  await iniciar();
  if (datos.enMemoria) {
    avisar('Este navegador no permite guardar datos (¿modo incógnito?). Podés probar, pero al cerrar se pierde todo.', { tipo: 'error', duracion: 12000 });
  }
  alCambiar((motivo) => {
    actualizarMarco();
    if (motivo === 'config' || motivo === 'inicio') return;
    if (motivo === 'todo') {
      navegar();
      return;
    }
    actual.vista?.alCambiarDatos?.($('#vista'), actual.params, actual.ruta);
  });
  actualizarMarco();
  addEventListener('hashchange', navegar);
  navegar();
  document.body.classList.remove('cargando');

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[góndola] sin modo offline:', e.message));
  }
}

arrancar();
