// Datos del negocio guardados en el propio dispositivo (IndexedDB), con una copia en memoria para que todo sea instantáneo.
// Cada operación que toca varias cosas (una venta descuenta stock y deja movimientos) se guarda en una sola transacción.

import { normalizar } from './logica.js';

const NOMBRE_BD = 'gondola';
const VERSION_BD = 1;
const VERSION_RESPALDO = 1;

const CONFIG_INICIAL = {
  negocio: '',
  redondeo: 10,
  gananciaPorDefecto: 40,
  proveedores: {}, // nombre → { telefono }
  ultimoRespaldo: null,
  creado: null,
};

const estado = {
  bd: null,
  enMemoria: false,
  productos: [],
  ventas: [],
  movimientos: [],
  config: { ...CONFIG_INICIAL },
};
const oyentes = new Set();

export const datos = estado;

/** Avisa a la interfaz que algo cambió. */
export function alCambiar(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
const avisar = (motivo) => oyentes.forEach((fn) => fn(motivo));

const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

// --- IndexedDB ----------------------------------------------------------

function abrirBD() {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(NOMBRE_BD, VERSION_BD);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      bd.createObjectStore('productos', { keyPath: 'id' });
      bd.createObjectStore('ventas', { keyPath: 'id' }).createIndex('fecha', 'fecha');
      const mov = bd.createObjectStore('movimientos', { keyPath: 'id' });
      mov.createIndex('productoId', 'productoId');
      mov.createIndex('fecha', 'fecha');
      bd.createObjectStore('config');
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => rechazar(pedido.error);
    pedido.onblocked = () => rechazar(new Error('La base de datos está abierta en otra pestaña con una versión anterior.'));
  });
}

const comoPromesa = (pedido) => new Promise((ok, mal) => {
  pedido.onsuccess = () => ok(pedido.result);
  pedido.onerror = () => mal(pedido.error);
});

function leerTodo(almacen) {
  const tx = estado.bd.transaction(almacen, 'readonly');
  return comoPromesa(tx.objectStore(almacen).getAll());
}

/**
 * Guarda varios cambios juntos. `cambios` = { productos: [...], ventas: [...], movimientos: [...], config, borrar: { almacen: [ids] } }
 * Si falla, no se guarda nada (y la copia en memoria se restaura desde la base).
 */
function guardar(cambios) {
  if (estado.enMemoria) return Promise.resolve();
  const almacenes = ['productos', 'ventas', 'movimientos', 'config'].filter((a) => cambios[a] !== undefined || cambios.borrar?.[a]);
  if (!almacenes.length) return Promise.resolve();
  return new Promise((ok, mal) => {
    const tx = estado.bd.transaction(almacenes, 'readwrite');
    for (const a of ['productos', 'ventas', 'movimientos']) {
      for (const registro of cambios[a] ?? []) tx.objectStore(a).put(registro);
      for (const id of cambios.borrar?.[a] ?? []) tx.objectStore(a).delete(id);
    }
    if (cambios.config) tx.objectStore('config').put(cambios.config, 'principal');
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error ?? new Error('No se pudo guardar.'));
  });
}

async function recargarDesdeBD() {
  if (estado.enMemoria) return;
  const [productos, ventas, movimientos] = await Promise.all(['productos', 'ventas', 'movimientos'].map(leerTodo));
  const tx = estado.bd.transaction('config', 'readonly');
  const config = await comoPromesa(tx.objectStore('config').get('principal'));
  estado.productos = productos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  estado.ventas = ventas.sort((a, b) => a.fecha - b.fecha);
  estado.movimientos = movimientos.sort((a, b) => a.fecha - b.fecha);
  estado.config = { ...CONFIG_INICIAL, ...(config ?? {}) };
}

/** Ejecuta un cambio en memoria y lo guarda; si guardar falla, vuelve atrás leyendo la base. */
async function transaccion(aplicar, motivo) {
  const cambios = aplicar();
  try {
    await guardar(cambios);
  } catch (error) {
    console.error('[góndola] no se pudo guardar', error);
    await recargarDesdeBD();
    avisar('error');
    throw new Error('No se pudo guardar el cambio en este dispositivo. Probá de nuevo; si sigue fallando, revisá el espacio disponible.');
  }
  avisar(motivo);
  return cambios;
}

export async function iniciar() {
  try {
    if (!('indexedDB' in globalThis)) throw new Error('sin IndexedDB');
    estado.bd = await abrirBD();
    await recargarDesdeBD();
  } catch (error) {
    console.warn('[góndola] trabajando sin guardar:', error.message);
    estado.enMemoria = true;
  }
  // Pedirle al navegador que no borre los datos para liberar espacio.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* no todos los navegadores lo permiten */
  }
  avisar('inicio');
}

export async function almacenamientoPersistente() {
  try {
    return (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    return false;
  }
}

// --- Productos ----------------------------------------------------------

export const productoPorId = (id) => estado.productos.find((p) => p.id === id);
export const productosActivos = () => estado.productos.filter((p) => !p.archivado);
export const categorias = () => [...new Set(productosActivos().map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
export const proveedores = () => [...new Set(productosActivos().map((p) => p.proveedor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

/** Problemas con los datos de un producto, en palabras para mostrar al lado de cada campo. */
export function validarProducto(p) {
  const errores = {};
  if (!p.nombre?.trim()) errores.nombre = 'Escribí el nombre del producto.';
  if (!(p.precio >= 0)) errores.precio = 'Escribí un precio válido.';
  if (p.costo != null && p.costo < 0) errores.costo = 'El costo no puede ser negativo.';
  if (p.minimo != null && p.minimo < 0) errores.minimo = 'El mínimo no puede ser negativo.';
  if (p.codigo?.trim()) {
    const repetido = estado.productos.find((o) => !o.archivado && o.id !== p.id && o.codigo === p.codigo.trim());
    if (repetido) errores.codigo = `Este código ya lo tiene "${repetido.nombre}".`;
  }
  return errores;
}

export async function guardarProducto(entrada) {
  const errores = validarProducto(entrada);
  if (Object.keys(errores).length) {
    const error = new Error('Revisá los datos del producto.');
    error.campos = errores;
    throw error;
  }
  const ahora = Date.now();
  const existente = entrada.id ? productoPorId(entrada.id) : null;
  const producto = {
    id: existente?.id ?? nuevoId(),
    nombre: entrada.nombre.trim(),
    categoria: entrada.categoria?.trim() || 'General',
    codigo: entrada.codigo?.trim() || '',
    unidad: entrada.unidad === 'kg' ? 'kg' : 'u',
    costo: Number(entrada.costo) || 0,
    precio: Number(entrada.precio) || 0,
    stock: existente ? existente.stock : Number(entrada.stock) || 0,
    minimo: Number(entrada.minimo) || 0,
    ideal: Number(entrada.ideal) || 0,
    proveedor: entrada.proveedor?.trim() || '',
    archivado: false,
    creado: existente?.creado ?? ahora,
    actualizado: ahora,
  };
  const movimientos = [];
  if (!existente && producto.stock !== 0) {
    movimientos.push({ id: nuevoId(), productoId: producto.id, tipo: 'inicial', cantidad: producto.stock, stockFinal: producto.stock, motivo: 'Stock inicial', fecha: ahora });
  }
  await transaccion(() => {
    if (existente) Object.assign(existente, producto);
    else estado.productos.push(producto);
    estado.productos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    estado.movimientos.push(...movimientos);
    return { productos: [producto], movimientos };
  }, 'productos');
  return producto;
}

export async function archivarProducto(id, archivar = true) {
  const p = productoPorId(id);
  if (!p) return;
  await transaccion(() => {
    p.archivado = archivar;
    p.actualizado = Date.now();
    return { productos: [p] };
  }, 'productos');
}

// --- Stock --------------------------------------------------------------

export const TIPOS_MOVIMIENTO = {
  entrada: 'Entró mercadería',
  recuento: 'Recuento',
  perdida: 'Pérdida',
  venta: 'Venta',
  anulacion: 'Venta anulada',
  inicial: 'Stock inicial',
};

/**
 * Registra un movimiento manual.
 * tipo 'entrada' suma `cantidad`; 'perdida' resta `cantidad`; 'recuento' fija el stock en `cantidad` (lo contado).
 */
export async function registrarMovimiento({ productoId, tipo, cantidad, motivo = '', costoUnitario = null }) {
  const p = productoPorId(productoId);
  if (!p) throw new Error('No encontramos el producto.');
  const valor = Number(cantidad);
  if (!Number.isFinite(valor) || (tipo !== 'recuento' && valor <= 0) || valor < 0) throw new Error('Escribí una cantidad válida.');
  const delta = tipo === 'entrada' ? valor : tipo === 'perdida' ? -valor : valor - p.stock;
  const ahora = Date.now();
  await transaccion(() => {
    p.stock = Math.round((p.stock + delta) * 1000) / 1000;
    if (tipo === 'entrada' && costoUnitario > 0) p.costo = costoUnitario;
    p.actualizado = ahora;
    const mov = { id: nuevoId(), productoId, tipo, cantidad: delta, stockFinal: p.stock, motivo, costoUnitario: costoUnitario || null, fecha: ahora };
    estado.movimientos.push(mov);
    return { productos: [p], movimientos: [mov] };
  }, 'stock');
}

/** Llegó un pedido: suma varias entradas de una vez. items = [{ productoId, cantidad, costoUnitario? }] */
export async function recibirMercaderia(items, motivo = 'Llegó el pedido') {
  const ahora = Date.now();
  await transaccion(() => {
    const productos = [];
    const movimientos = [];
    for (const { productoId, cantidad, costoUnitario } of items) {
      const p = productoPorId(productoId);
      if (!p || !(cantidad > 0)) continue;
      p.stock = Math.round((p.stock + cantidad) * 1000) / 1000;
      if (costoUnitario > 0) p.costo = costoUnitario;
      p.actualizado = ahora;
      productos.push(p);
      movimientos.push({ id: nuevoId(), productoId, tipo: 'entrada', cantidad, stockFinal: p.stock, motivo, costoUnitario: costoUnitario || null, fecha: ahora });
    }
    estado.movimientos.push(...movimientos);
    return { productos, movimientos };
  }, 'stock');
}

export const movimientosDe = (productoId) => estado.movimientos.filter((m) => m.productoId === productoId).sort((a, b) => b.fecha - a.fecha);

// --- Ventas -------------------------------------------------------------

export const MEDIOS_DE_PAGO = { efectivo: 'Efectivo', transferencia: 'Transferencia', debito: 'Débito', credito: 'Crédito', qr: 'QR' };

/** Cobra un ticket: guarda la venta, descuenta el stock y deja un movimiento por producto, todo junto. */
export async function registrarVenta({ items, medio, recibido = null }) {
  if (!items.length) throw new Error('El ticket está vacío.');
  if (!MEDIOS_DE_PAGO[medio]) throw new Error('Elegí cómo pagó el cliente.');
  const ahora = Date.now();
  const venta = {
    id: nuevoId(),
    numero: (estado.ventas.at(-1)?.numero ?? 0) + 1,
    fecha: ahora,
    medio,
    recibido: medio === 'efectivo' && recibido > 0 ? recibido : null,
    items: items.map((i) => {
      const p = productoPorId(i.productoId);
      return { productoId: i.productoId, nombre: p?.nombre ?? i.nombre, unidad: p?.unidad ?? 'u', cantidad: i.cantidad, precio: i.precio, costo: p?.costo ?? 0 };
    }),
  };
  venta.total = Math.round(venta.items.reduce((t, i) => t + i.precio * i.cantidad, 0) * 100) / 100;

  await transaccion(() => {
    const productos = [];
    const movimientos = [];
    for (const item of venta.items) {
      const p = productoPorId(item.productoId);
      if (!p) continue;
      p.stock = Math.round((p.stock - item.cantidad) * 1000) / 1000;
      p.actualizado = ahora;
      productos.push(p);
      movimientos.push({ id: nuevoId(), productoId: p.id, tipo: 'venta', cantidad: -item.cantidad, stockFinal: p.stock, ventaId: venta.id, motivo: `Ticket ${venta.numero}`, fecha: ahora });
    }
    estado.ventas.push(venta);
    estado.movimientos.push(...movimientos);
    return { ventas: [venta], productos, movimientos };
  }, 'venta');
  return venta;
}

/** Anula una venta: la marca y devuelve el stock. */
export async function anularVenta(id) {
  const venta = estado.ventas.find((v) => v.id === id);
  if (!venta || venta.anulada) return;
  const ahora = Date.now();
  await transaccion(() => {
    venta.anulada = true;
    venta.anuladaEl = ahora;
    const productos = [];
    const movimientos = [];
    for (const item of venta.items) {
      const p = productoPorId(item.productoId);
      if (!p) continue;
      p.stock = Math.round((p.stock + item.cantidad) * 1000) / 1000;
      productos.push(p);
      movimientos.push({ id: nuevoId(), productoId: p.id, tipo: 'anulacion', cantidad: item.cantidad, stockFinal: p.stock, ventaId: venta.id, motivo: `Ticket ${venta.numero} anulado`, fecha: ahora });
    }
    estado.movimientos.push(...movimientos);
    return { ventas: [venta], productos, movimientos };
  }, 'venta');
}

// --- Precios ------------------------------------------------------------

/** Aplica los cambios calculados por `calcularAumento`. */
export async function aplicarCambiosDePrecio(cambios) {
  const ahora = Date.now();
  await transaccion(() => {
    const productos = [];
    for (const c of cambios) {
      const p = productoPorId(c.id);
      if (!p) continue;
      p.precio = c.precioDespues;
      p.costo = c.costoDespues;
      p.actualizado = ahora;
      productos.push(p);
    }
    return { productos };
  }, 'productos');
}

// --- Configuración ------------------------------------------------------

export async function guardarConfig(cambios) {
  await transaccion(() => {
    Object.assign(estado.config, cambios);
    return { config: { ...estado.config } };
  }, 'config');
}

export async function guardarTelefonoProveedor(nombre, telefono) {
  const proveedoresConfig = { ...estado.config.proveedores, [nombre]: { telefono: telefono.trim() } };
  await guardarConfig({ proveedores: proveedoresConfig });
}

// --- Importar, respaldo y reinicio ----------------------------------------

/**
 * Importa productos de una planilla. Si ya existe uno con el mismo código (o, sin código, el mismo nombre),
 * actualiza precio, costo y datos; el stock se actualiza solo si `actualizarStock` es true.
 */
export async function importarProductos(lista, { actualizarStock = false } = {}) {
  const ahora = Date.now();
  const resultado = { nuevos: 0, actualizados: 0 };
  await transaccion(() => {
    const productos = [];
    const movimientos = [];
    const porCodigo = new Map(estado.productos.filter((p) => p.codigo).map((p) => [p.codigo, p]));
    const porNombre = new Map(estado.productos.map((p) => [normalizar(p.nombre), p]));
    for (const entrada of lista) {
      const existente = (entrada.codigo && porCodigo.get(entrada.codigo)) || porNombre.get(normalizar(entrada.nombre));
      if (existente) {
        const stockAntes = existente.stock;
        Object.assign(existente, {
          nombre: entrada.nombre, categoria: entrada.categoria || existente.categoria, codigo: entrada.codigo || existente.codigo,
          unidad: entrada.unidad, costo: entrada.costo || existente.costo, precio: entrada.precio || existente.precio,
          minimo: entrada.minimo || existente.minimo, proveedor: entrada.proveedor || existente.proveedor, archivado: false, actualizado: ahora,
        });
        if (actualizarStock && entrada.stock !== stockAntes) {
          existente.stock = entrada.stock;
          movimientos.push({ id: nuevoId(), productoId: existente.id, tipo: 'recuento', cantidad: entrada.stock - stockAntes, stockFinal: entrada.stock, motivo: 'Importado de planilla', fecha: ahora });
        }
        productos.push(existente);
        resultado.actualizados++;
      } else {
        const nuevo = { id: nuevoId(), ideal: 0, archivado: false, creado: ahora, actualizado: ahora, ...entrada };
        estado.productos.push(nuevo);
        porNombre.set(normalizar(nuevo.nombre), nuevo);
        if (nuevo.codigo) porCodigo.set(nuevo.codigo, nuevo);
        if (nuevo.stock) movimientos.push({ id: nuevoId(), productoId: nuevo.id, tipo: 'inicial', cantidad: nuevo.stock, stockFinal: nuevo.stock, motivo: 'Importado de planilla', fecha: ahora });
        productos.push(nuevo);
        resultado.nuevos++;
      }
    }
    estado.productos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    estado.movimientos.push(...movimientos);
    return { productos, movimientos };
  }, 'productos');
  return resultado;
}

export function crearRespaldo() {
  return {
    app: 'gondola',
    version: VERSION_RESPALDO,
    creado: new Date().toISOString(),
    negocio: estado.config.negocio,
    productos: estado.productos,
    ventas: estado.ventas,
    movimientos: estado.movimientos,
    config: estado.config,
  };
}

export async function marcarRespaldoHecho() {
  await guardarConfig({ ultimoRespaldo: Date.now() });
}

/** Revisa que un archivo sea un respaldo de Góndola antes de reemplazar nada. */
export function validarRespaldo(json) {
  if (!json || json.app !== 'gondola') return 'El archivo no es una copia de seguridad de Góndola.';
  if (!Array.isArray(json.productos) || !Array.isArray(json.ventas) || !Array.isArray(json.movimientos)) return 'La copia está incompleta o dañada.';
  if (json.version > VERSION_RESPALDO) return 'La copia es de una versión más nueva de Góndola. Actualizá la página e intentá de nuevo.';
  return null;
}

/** Reemplaza todos los datos por los de `json` (validado antes). */
export async function reemplazarTodo(json) {
  const anteriores = { productos: estado.productos.map((p) => p.id), ventas: estado.ventas.map((v) => v.id), movimientos: estado.movimientos.map((m) => m.id) };
  await transaccion(() => {
    estado.productos = [...json.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    estado.ventas = [...json.ventas].sort((a, b) => a.fecha - b.fecha);
    estado.movimientos = [...json.movimientos].sort((a, b) => a.fecha - b.fecha);
    estado.config = { ...CONFIG_INICIAL, ...(json.config ?? {}) };
    const nuevos = { productos: new Set(estado.productos.map((p) => p.id)), ventas: new Set(estado.ventas.map((v) => v.id)), movimientos: new Set(estado.movimientos.map((m) => m.id)) };
    return {
      productos: estado.productos,
      ventas: estado.ventas,
      movimientos: estado.movimientos,
      config: { ...estado.config },
      borrar: Object.fromEntries(Object.entries(anteriores).map(([a, ids]) => [a, ids.filter((id) => !nuevos[a].has(id))])),
    };
  }, 'todo');
}

export async function borrarTodo() {
  await reemplazarTodo({ productos: [], ventas: [], movimientos: [], config: { ...CONFIG_INICIAL, creado: Date.now() } });
}

export const hayDatos = () => estado.productos.length > 0 || estado.ventas.length > 0;
