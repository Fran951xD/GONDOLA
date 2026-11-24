// Reglas del negocio. Funciones puras: no tocan el DOM ni la base de datos, así se testean con `node --test`.

const DIA = 24 * 60 * 60 * 1000;

/** Quita tildes y pasa a minúsculas para buscar "azucar" y encontrar "Azúcar". */
export const normalizar = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Redondea un precio hacia arriba al múltiplo indicado (10 → $1.234 pasa a $1.240). 0 = sin redondeo. */
export function redondearPrecio(precio, multiplo = 10) {
  if (!Number.isFinite(precio)) return null;
  if (!multiplo) return Math.round(precio * 100) / 100;
  return Math.ceil(Math.round(precio * 100) / 100 / multiplo) * multiplo;
}

/** Ganancia sobre el costo, como lo dice un comerciante: "le pongo 40 %". */
export function gananciaSobreCosto(costo, precio) {
  if (!(costo > 0) || !Number.isFinite(precio)) return null;
  return (precio / costo - 1) * 100;
}

/** Precio de venta a partir del costo y la ganancia deseada. */
export function precioDesdeGanancia(costo, ganancia, multiplo = 10) {
  if (!(costo >= 0) || !Number.isFinite(ganancia)) return null;
  return redondearPrecio(costo * (1 + ganancia / 100), multiplo);
}

/** 'agotado' | 'bajo' | 'ok' */
export function estadoStock({ stock, minimo }) {
  if (!(stock > 0)) return 'agotado';
  if (minimo > 0 && stock <= minimo) return 'bajo';
  return 'ok';
}

/** Cantidad a pedir para volver al stock ideal (por defecto, el doble del mínimo). */
export function cantidadAPedir({ stock, minimo, ideal, unidad }) {
  const objetivo = ideal > 0 ? ideal : (minimo > 0 ? minimo * 2 : 0);
  const falta = objetivo - Math.max(0, stock || 0);
  if (!(falta > 0)) return 0;
  return unidad === 'kg' ? Math.ceil(falta * 10) / 10 : Math.ceil(falta);
}

/** Unidades vendidas por producto en los últimos `dias` días. Devuelve Map(productoId → cantidad). */
export function vendidoPorProducto(ventas, { dias = 28, ahora = Date.now() } = {}) {
  const desde = ahora - dias * DIA;
  const mapa = new Map();
  for (const venta of ventas) {
    if (venta.anulada || venta.fecha < desde) continue;
    for (const item of venta.items) mapa.set(item.productoId, (mapa.get(item.productoId) ?? 0) + item.cantidad);
  }
  return mapa;
}

/** Días que alcanza el stock al ritmo de venta reciente. null si no hubo ventas. */
export function diasDeStock(stock, vendidoEnPeriodo, dias = 28) {
  if (!(vendidoEnPeriodo > 0)) return null;
  return Math.max(0, stock) / (vendidoEnPeriodo / dias);
}

/** Productos para reponer (bajo mínimo o agotados), agrupados por proveedor y ordenados por urgencia. */
export function listaDeReposicion(productos, ventas, opciones = {}) {
  const vendidos = vendidoPorProducto(ventas, opciones);
  const items = productos
    .filter((p) => !p.archivado && estadoStock(p) !== 'ok')
    .map((p) => ({
      producto: p,
      estado: estadoStock(p),
      pedir: cantidadAPedir(p),
      dias: diasDeStock(p.stock, vendidos.get(p.id) ?? 0, opciones.dias ?? 28),
    }))
    .sort((a, b) => (a.estado === b.estado ? (a.dias ?? Infinity) - (b.dias ?? Infinity) : a.estado === 'agotado' ? -1 : 1));

  const grupos = new Map();
  for (const item of items) {
    const proveedor = item.producto.proveedor?.trim() || 'Sin proveedor';
    if (!grupos.has(proveedor)) grupos.set(proveedor, []);
    grupos.get(proveedor).push(item);
  }
  return [...grupos.entries()]
    .map(([proveedor, lista]) => ({ proveedor, items: lista, costoEstimado: lista.reduce((t, i) => t + i.pedir * (i.producto.costo || 0), 0) }))
    .sort((a, b) => (a.proveedor === 'Sin proveedor') - (b.proveedor === 'Sin proveedor') || b.items.length - a.items.length);
}

const cantidadLegible = (cantidad, unidad) =>
  unidad === 'kg' ? `${String(cantidad).replace('.', ',')} kg` : `${cantidad}`;

/** Texto del pedido para mandar por WhatsApp. */
export function textoDelPedido({ proveedor, items, negocio }) {
  const lineas = items.filter((i) => i.pedir > 0).map((i) => `• ${cantidadLegible(i.pedir, i.producto.unidad)} × ${i.producto.nombre}`);
  const saludo = proveedor && proveedor !== 'Sin proveedor' ? `Hola, ${proveedor}.` : 'Hola.';
  return `${saludo} Te paso el pedido${negocio ? ` de ${negocio}` : ''}:\n\n${lineas.join('\n')}\n\n¿Me confirmás disponibilidad y precio? Gracias.`;
}

/** Enlace de WhatsApp con el texto ya escrito. El teléfono es opcional (sin él, WhatsApp pide elegir el contacto). */
export function enlaceWhatsApp(texto, telefono = '') {
  return `https://wa.me/${numeroWhatsApp(telefono)}?text=${encodeURIComponent(texto)}`;
}

/**
 * Celular argentino al formato de WhatsApp (549 + área + número), como lo escribe la gente:
 * "11 5555-1234", "011 15 5555-1234", "0351 15 555-1234", "+54 9 11 5555 1234".
 * Un número que no se puede interpretar sin adivinar se deja como vino si parece internacional, o vacío.
 */
export function numeroWhatsApp(telefono) {
  const crudo = String(telefono).replace(/\D/g, '');
  let d = crudo;
  if (d.startsWith('54')) { d = d.slice(2); if (d.startsWith('9')) d = d.slice(1); }
  else if (d.startsWith('0')) d = d.slice(1);
  // Con el "15" quedan 12 dígitos: se saca probando áreas de 2, 3 y 4 cifras.
  if (d.length === 12) {
    for (const a of [2, 3, 4]) if (d.slice(a, a + 2) === '15') { d = d.slice(0, a) + d.slice(a + 2); break; }
  }
  if (d.length === 10 && !d.startsWith('0') && !d.startsWith('15')) return `549${d}`;
  return crudo.length >= 11 ? crudo : '';
}

// --- Caja ---------------------------------------------------------------

export function totalTicket(items) {
  return Math.round(items.reduce((t, i) => t + i.precio * i.cantidad, 0) * 100) / 100;
}

export function vuelto(total, recibido) {
  if (!Number.isFinite(recibido) || recibido < total) return null;
  return Math.round((recibido - total) * 100) / 100;
}

/** Billetes cómodos para pagar en efectivo un total: el mismo monto y los redondeos útiles. */
export function montosSugeridos(total) {
  if (!(total > 0)) return [];
  const opciones = [total];
  for (const paso of [1000, 2000, 10000, 20000]) {
    const redondo = Math.ceil(total / paso) * paso;
    if (redondo > total && !opciones.includes(redondo)) opciones.push(redondo);
  }
  return opciones.slice(0, 4);
}

/** Valida que haya stock para el ticket. Devuelve la lista de faltantes (puede venderse igual si se confirma). */
export function faltantes(items, productosPorId) {
  return items
    .map((i) => ({ item: i, producto: productosPorId.get(i.productoId) }))
    .filter(({ item, producto }) => producto && producto.stock < item.cantidad)
    .map(({ item, producto }) => ({ nombre: producto.nombre, pedido: item.cantidad, disponible: producto.stock }));
}

// --- Reportes -----------------------------------------------------------

const inicioDelDia = (ms) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Resumen de ventas entre dos momentos: total, ganancia, tickets, por medio de pago, por día y más vendidos. */
export function resumenVentas(ventas, { desde, hasta = Date.now() } = {}) {
  const enRango = ventas.filter((v) => !v.anulada && v.fecha >= desde && v.fecha <= hasta);
  const porMedio = {};
  const porProducto = new Map();
  const porDia = new Map();
  let total = 0;
  let ganancia = 0;
  for (const v of enRango) {
    total += v.total;
    porMedio[v.medio] = (porMedio[v.medio] ?? 0) + v.total;
    const dia = inicioDelDia(v.fecha);
    porDia.set(dia, (porDia.get(dia) ?? 0) + v.total);
    for (const i of v.items) {
      ganancia += (i.precio - (i.costo ?? 0)) * i.cantidad;
      const actual = porProducto.get(i.productoId) ?? { productoId: i.productoId, nombre: i.nombre, cantidad: 0, total: 0, unidad: i.unidad };
      actual.cantidad += i.cantidad;
      actual.total += i.precio * i.cantidad;
      porProducto.set(i.productoId, actual);
    }
  }
  return {
    total,
    ganancia,
    tickets: enRango.length,
    ticketPromedio: enRango.length ? total / enRango.length : 0,
    porMedio,
    porDia,
    masVendidos: [...porProducto.values()].sort((a, b) => b.total - a.total),
  };
}

/** Serie diaria de los últimos `dias` días (incluye días sin ventas en cero). */
export function serieDiaria(ventas, dias = 14, ahora = Date.now()) {
  const hoy = inicioDelDia(ahora);
  const desde = hoy - (dias - 1) * DIA;
  const { porDia } = resumenVentas(ventas, { desde, hasta: ahora });
  const serie = [];
  for (let i = 0; i < dias; i++) {
    // Se recalcula con Date para no fallar en los cambios de horario.
    const d = new Date(desde);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    serie.push({ fecha: d.getTime(), total: porDia.get(d.getTime()) ?? 0 });
  }
  return serie;
}

/** Cuánta plata hay en mercadería, a costo y a precio de venta. */
export function valorInventario(productos) {
  return productos
    .filter((p) => !p.archivado && p.stock > 0)
    .reduce((t, p) => ({ costo: t.costo + p.stock * (p.costo || 0), venta: t.venta + p.stock * (p.precio || 0), unidades: t.unidades + 1 }), { costo: 0, venta: 0, unidades: 0 });
}

// --- Precios ------------------------------------------------------------

/**
 * Calcula un aumento masivo. No modifica nada: devuelve los cambios para mostrarlos antes de confirmar.
 * opciones: { porcentaje, categoria (null = todas), proveedor (null = todos), redondeo, tambienCosto }
 */
export function calcularAumento(productos, { porcentaje, categoria = null, proveedor = null, redondeo = 10, tambienCosto = false }) {
  if (!Number.isFinite(porcentaje) || porcentaje === 0) return [];
  const factor = 1 + porcentaje / 100;
  return productos
    .filter((p) => !p.archivado && (!categoria || p.categoria === categoria) && (!proveedor || p.proveedor === proveedor))
    .map((p) => ({
      id: p.id,
      nombre: p.nombre,
      precioAntes: p.precio,
      precioDespues: redondearPrecio(p.precio * factor, redondeo),
      costoAntes: p.costo,
      costoDespues: tambienCosto ? Math.round(p.costo * factor * 100) / 100 : p.costo,
    }))
    .filter((c) => c.precioDespues !== c.precioAntes || c.costoDespues !== c.costoAntes);
}

// --- Búsqueda -----------------------------------------------------------

/** Busca por código exacto primero; si no, todas las palabras deben aparecer en nombre, categoría o proveedor. */
export function buscarProductos(productos, consulta, limite = 50) {
  const q = normalizar(consulta);
  const activos = productos.filter((p) => !p.archivado);
  if (!q) return activos.slice(0, limite);
  const porCodigo = activos.filter((p) => p.codigo && normalizar(p.codigo) === q);
  if (porCodigo.length) return porCodigo;
  const palabras = q.split(/\s+/);
  return activos
    .map((p) => {
      const nombre = normalizar(p.nombre);
      const texto = `${nombre} ${normalizar(p.categoria)} ${normalizar(p.proveedor)} ${normalizar(p.codigo)}`;
      if (!palabras.every((w) => texto.includes(w))) return null;
      // Más relevante si el nombre empieza con lo buscado.
      const puntaje = (nombre.startsWith(palabras[0]) ? 2 : 0) + (nombre.includes(q) ? 1 : 0);
      return { p, puntaje };
    })
    .filter(Boolean)
    .sort((a, b) => b.puntaje - a.puntaje || a.p.nombre.localeCompare(b.p.nombre, 'es'))
    .slice(0, limite)
    .map((x) => x.p);
}

// --- Planillas (CSV) ----------------------------------------------------

/** Lee un número escrito en español ("1.234,50") o en inglés ("1234.50"). */
export function leerNumero(texto) {
  if (texto == null) return null;
  let s = String(texto).trim().replace(/[$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Parser de CSV que soporta comillas, saltos de línea dentro de comillas y separador "," o ";". */
export function parsearCSV(texto) {
  const limpio = String(texto).replace(/^﻿/, '');
  const primeraLinea = limpio.split(/\r?\n/, 1)[0] ?? '';
  const separador = (primeraLinea.match(/;/g) ?? []).length > (primeraLinea.match(/,/g) ?? []).length ? ';' : ',';
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === separador) { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo);
      if (fila.some((x) => x.trim() !== '')) filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim() !== '')) filas.push(fila);
  return { filas, separador };
}

const SINONIMOS = {
  nombre: ['nombre', 'producto', 'descripcion', 'articulo', 'detalle'],
  categoria: ['categoria', 'rubro', 'seccion', 'familia'],
  codigo: ['codigo', 'codigo de barras', 'ean', 'sku', 'cod'],
  costo: ['costo', 'precio de costo', 'precio costo', 'compra', 'precio compra'],
  precio: ['precio', 'precio de venta', 'precio venta', 'venta', 'pvp'],
  stock: ['stock', 'cantidad', 'existencia', 'unidades'],
  minimo: ['minimo', 'stock minimo', 'min'],
  proveedor: ['proveedor', 'distribuidor', 'marca proveedor'],
  unidad: ['unidad', 'medida', 'unidad de medida'],
};

/** Detecta qué columna es cada dato según el encabezado. */
export function detectarColumnas(encabezado) {
  const mapa = {};
  encabezado.forEach((titulo, indice) => {
    const t = normalizar(titulo).replace(/[_.]/g, ' ').replace(/\s+/g, ' ');
    for (const [campo, opciones] of Object.entries(SINONIMOS)) {
      if (mapa[campo] == null && opciones.includes(t)) mapa[campo] = indice;
    }
  });
  return mapa;
}

/** Convierte un CSV en productos. Devuelve { productos, errores, columnas }. */
export function productosDesdeCSV(texto) {
  const { filas } = parsearCSV(texto);
  if (filas.length < 2) return { productos: [], errores: ['La planilla está vacía o no tiene encabezado.'], columnas: {} };
  const columnas = detectarColumnas(filas[0]);
  if (columnas.nombre == null) return { productos: [], errores: ['No encontramos la columna del nombre del producto (por ejemplo "Nombre" o "Producto").'], columnas };
  const productos = [];
  const errores = [];
  filas.slice(1).forEach((f, i) => {
    const valor = (campo) => (columnas[campo] == null ? '' : (f[columnas[campo]] ?? '').trim());
    const nombre = valor('nombre');
    if (!nombre) {
      errores.push(`Fila ${i + 2}: no tiene nombre, la salteamos.`);
      return;
    }
    const precio = leerNumero(valor('precio'));
    const unidadTexto = normalizar(valor('unidad'));
    productos.push({
      nombre,
      categoria: valor('categoria') || 'General',
      codigo: valor('codigo'),
      costo: leerNumero(valor('costo')) ?? 0,
      precio: precio ?? 0,
      stock: leerNumero(valor('stock')) ?? 0,
      minimo: leerNumero(valor('minimo')) ?? 0,
      proveedor: valor('proveedor'),
      unidad: ['kg', 'kilo', 'kilos', 'kilogramo'].includes(unidadTexto) ? 'kg' : 'u',
    });
    if (precio == null) errores.push(`Fila ${i + 2} (${nombre}): sin precio, quedó en $0.`);
  });
  return { productos, errores, columnas };
}

const celdaCSV = (v) => {
  const s = v == null ? '' : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const numeroCSV = (n) => (Number.isFinite(n) ? String(n).replace('.', ',') : '');

/** Exporta productos a CSV con ";" (lo que Excel en español abre bien). */
export function productosACSV(productos) {
  const encabezado = ['Nombre', 'Categoría', 'Código', 'Unidad', 'Costo', 'Precio', 'Stock', 'Mínimo', 'Proveedor'];
  const filas = productos
    .filter((p) => !p.archivado)
    .map((p) => [p.nombre, p.categoria, p.codigo, p.unidad === 'kg' ? 'kg' : 'unidad', numeroCSV(p.costo), numeroCSV(p.precio), numeroCSV(p.stock), numeroCSV(p.minimo), p.proveedor].map(celdaCSV).join(';'));
  return `﻿${[encabezado.join(';'), ...filas].join('\r\n')}`;
}
