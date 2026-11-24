import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buscarProductos, calcularAumento, cantidadAPedir, diasDeStock, enlaceWhatsApp, estadoStock, faltantes, gananciaSobreCosto,
  leerNumero, listaDeReposicion, montosSugeridos, normalizar, parsearCSV, precioDesdeGanancia, productosACSV, productosDesdeCSV,
  redondearPrecio, resumenVentas, serieDiaria, textoDelPedido, totalTicket, valorInventario, vuelto,
} from '../js/logica.js';

const DIA = 86400000;
const producto = (extra) => ({ id: 'p', nombre: 'X', categoria: 'General', costo: 100, precio: 150, stock: 10, minimo: 3, unidad: 'u', proveedor: '', ...extra });

test('normalizar quita tildes y mayúsculas', () => {
  assert.equal(normalizar('  Azúcar Ledesma '), 'azucar ledesma');
});

test('redondearPrecio sube al múltiplo indicado', () => {
  assert.equal(redondearPrecio(1234, 10), 1240);
  assert.equal(redondearPrecio(1240, 10), 1240);
  assert.equal(redondearPrecio(1201, 50), 1250);
  assert.equal(redondearPrecio(99.999, 0), 100);
  // Evita errores de coma flotante: 1.1 * 1000 no debe redondear a 1110
  assert.equal(redondearPrecio(1.1 * 1000, 10), 1100);
});

test('ganancia sobre el costo y precio desde la ganancia', () => {
  assert.ok(Math.abs(gananciaSobreCosto(100, 140) - 40) < 1e-9);
  assert.equal(gananciaSobreCosto(0, 140), null);
  assert.equal(precioDesdeGanancia(733, 40, 10), 1030);
});

test('estadoStock distingue agotado, bajo y ok', () => {
  assert.equal(estadoStock({ stock: 0, minimo: 2 }), 'agotado');
  assert.equal(estadoStock({ stock: -1, minimo: 2 }), 'agotado');
  assert.equal(estadoStock({ stock: 2, minimo: 2 }), 'bajo');
  assert.equal(estadoStock({ stock: 3, minimo: 2 }), 'ok');
  assert.equal(estadoStock({ stock: 1, minimo: 0 }), 'ok');
});

test('cantidadAPedir vuelve al ideal (o al doble del mínimo)', () => {
  assert.equal(cantidadAPedir({ stock: 1, minimo: 5 }), 9);
  assert.equal(cantidadAPedir({ stock: 1, minimo: 5, ideal: 24 }), 23);
  assert.equal(cantidadAPedir({ stock: -3, minimo: 5 }), 10); // stock negativo cuenta como cero
  assert.equal(cantidadAPedir({ stock: 0.35, minimo: 1, unidad: 'kg' }), 1.7);
  assert.equal(cantidadAPedir({ stock: 20, minimo: 5 }), 0);
});

test('diasDeStock usa el ritmo de venta reciente', () => {
  assert.equal(diasDeStock(10, 28, 28), 10);
  assert.equal(diasDeStock(10, 0), null);
});

test('listaDeReposicion agrupa por proveedor y pone primero lo agotado', () => {
  const productos = [
    producto({ id: 'a', nombre: 'Coca 1,5', stock: 2, minimo: 6, proveedor: 'Distribuidora Sur' }),
    producto({ id: 'b', nombre: 'Agua', stock: 0, minimo: 6, proveedor: 'Distribuidora Sur' }),
    producto({ id: 'c', nombre: 'Yerba', stock: 1, minimo: 4, proveedor: '' }),
    producto({ id: 'd', nombre: 'Fideos', stock: 50, minimo: 4, proveedor: 'Mayorista' }),
  ];
  const grupos = listaDeReposicion(productos, []);
  assert.deepEqual(grupos.map((g) => g.proveedor), ['Distribuidora Sur', 'Sin proveedor']);
  assert.deepEqual(grupos[0].items.map((i) => i.producto.id), ['b', 'a']);
  assert.equal(grupos[0].costoEstimado, (12 + 10) * 100);
});

test('textoDelPedido y enlace de WhatsApp', () => {
  const texto = textoDelPedido({
    proveedor: 'Distribuidora Sur', negocio: 'Almacén Rosa',
    items: [{ pedir: 12, producto: { nombre: 'Coca 1,5 L', unidad: 'u' } }, { pedir: 2.5, producto: { nombre: 'Queso', unidad: 'kg' } }, { pedir: 0, producto: { nombre: 'Nada' } }],
  });
  assert.match(texto, /Hola, Distribuidora Sur\. Te paso el pedido de Almacén Rosa/);
  assert.match(texto, /• 12 × Coca 1,5 L/);
  assert.match(texto, /• 2,5 kg × Queso/);
  assert.doesNotMatch(texto, /Nada/);
  assert.equal(enlaceWhatsApp('hola mundo', '+54 9 11 5555-1234'), 'https://wa.me/5491155551234?text=hola%20mundo');
  // Como lo escribe la gente en Argentina: sin 549, con 0 y con 15.
  for (const tel of ['11 5555-1234', '011 15 5555-1234', '1155551234']) {
    assert.equal(enlaceWhatsApp('x', tel), 'https://wa.me/5491155551234?text=x', tel);
  }
  assert.equal(enlaceWhatsApp('x', '0351 15 555-1234'), 'https://wa.me/5493515551234?text=x');
  assert.equal(enlaceWhatsApp('x', ''), 'https://wa.me/?text=x');
  assert.equal(enlaceWhatsApp('x', '123'), 'https://wa.me/?text=x');
});

test('totalTicket, vuelto y montos sugeridos', () => {
  assert.equal(totalTicket([{ precio: 1500, cantidad: 2 }, { precio: 899.9, cantidad: 0.5 }]), 3449.95);
  assert.equal(vuelto(3450, 5000), 1550);
  assert.equal(vuelto(3450, 3000), null);
  assert.deepEqual(montosSugeridos(3450), [3450, 4000, 10000, 20000]);
});

test('faltantes detecta ventas sin stock suficiente', () => {
  const porId = new Map([['a', producto({ id: 'a', nombre: 'Pan', stock: 1 })]]);
  assert.deepEqual(faltantes([{ productoId: 'a', cantidad: 3 }], porId), [{ nombre: 'Pan', pedido: 3, disponible: 1 }]);
});

test('resumenVentas suma total, ganancia, medios y más vendidos; ignora anuladas', () => {
  const ahora = Date.now();
  const ventas = [
    { fecha: ahora - 1000, total: 300, medio: 'efectivo', items: [{ productoId: 'a', nombre: 'A', cantidad: 2, precio: 150, costo: 100 }] },
    { fecha: ahora - 2000, total: 150, medio: 'qr', items: [{ productoId: 'b', nombre: 'B', cantidad: 1, precio: 150, costo: 50 }] },
    { fecha: ahora - 3000, total: 999, medio: 'qr', anulada: true, items: [] },
    { fecha: ahora - 10 * DIA, total: 500, medio: 'qr', items: [] },
  ];
  const r = resumenVentas(ventas, { desde: ahora - DIA });
  assert.equal(r.total, 450);
  assert.equal(r.ganancia, 200);
  assert.equal(r.tickets, 2);
  assert.equal(r.ticketPromedio, 225);
  assert.deepEqual(r.porMedio, { efectivo: 300, qr: 150 });
  assert.equal(r.masVendidos[0].productoId, 'a');
});

test('serieDiaria completa los días sin ventas', () => {
  const serie = serieDiaria([], 7);
  assert.equal(serie.length, 7);
  assert.ok(serie.every((d) => d.total === 0));
});

test('valorInventario a costo y a precio', () => {
  const v = valorInventario([producto({ stock: 2 }), producto({ stock: -1 }), producto({ stock: 5, archivado: true })]);
  assert.deepEqual(v, { costo: 200, venta: 300, unidades: 1 });
});

test('calcularAumento filtra por categoría, redondea y no modifica los originales', () => {
  const productos = [producto({ id: 'a', categoria: 'Bebidas', precio: 1000 }), producto({ id: 'b', categoria: 'Almacén', precio: 1000 })];
  const cambios = calcularAumento(productos, { porcentaje: 8, categoria: 'Bebidas', redondeo: 50 });
  assert.equal(cambios.length, 1);
  assert.equal(cambios[0].precioDespues, 1100);
  assert.equal(productos[0].precio, 1000);
  assert.deepEqual(calcularAumento(productos, { porcentaje: 0 }), []);
});

test('buscarProductos: código exacto, palabras en cualquier orden y sin tildes', () => {
  const productos = [
    producto({ id: '1', nombre: 'Azúcar Ledesma 1 kg', codigo: '7790150000011' }),
    producto({ id: '2', nombre: 'Yerba Playadito 1 kg' }),
    producto({ id: '3', nombre: 'Yerba Taragüí 500 g', archivado: true }),
  ];
  assert.deepEqual(buscarProductos(productos, '7790150000011').map((p) => p.id), ['1']);
  assert.deepEqual(buscarProductos(productos, 'kg azucar').map((p) => p.id), ['1']);
  assert.deepEqual(buscarProductos(productos, 'yerba').map((p) => p.id), ['2']);
});

test('leerNumero entiende formatos de Argentina y de planillas en inglés', () => {
  assert.equal(leerNumero('1.234,50'), 1234.5);
  assert.equal(leerNumero('$ 1.500'), 1.5); // un solo punto: se toma como decimal
  assert.equal(leerNumero('1.500.000'), 1500000);
  assert.equal(leerNumero('1234.5'), 1234.5);
  assert.equal(leerNumero(''), null);
});

test('parsearCSV soporta ";" y comillas con saltos de línea', () => {
  const { filas, separador } = parsearCSV('Nombre;Precio\r\n"Galletitas ""Oreo""";1.200,50\r\n"Queso\ncremoso";800\r\n');
  assert.equal(separador, ';');
  assert.deepEqual(filas, [['Nombre', 'Precio'], ['Galletitas "Oreo"', '1.200,50'], ['Queso\ncremoso', '800']]);
});

test('productosDesdeCSV reconoce encabezados en distintas formas', () => {
  const csv = 'Producto,Rubro,Precio de venta,Costo,Cantidad,Unidad\nYerba,Almacén,3500,2500,12,unidad\nQueso,Fiambrería,9800,7000,3.5,kg\n,,,,,\n';
  const { productos, errores } = productosDesdeCSV(csv);
  assert.equal(productos.length, 2);
  assert.equal(productos[1].unidad, 'kg');
  assert.equal(productos[1].stock, 3.5);
  assert.equal(productos[0].categoria, 'Almacén');
  assert.equal(errores.length, 0);
});

test('productosDesdeCSV avisa si falta la columna del nombre', () => {
  const { errores } = productosDesdeCSV('Precio;Stock\n100;2');
  assert.match(errores[0], /columna del nombre/);
});

test('exportar e importar CSV conserva los datos', () => {
  const csv = productosACSV([producto({ nombre: 'Queso; cremoso', precio: 9800.5, stock: 3.5, unidad: 'kg', proveedor: 'Lácteos "La Vaca"' })]);
  const { productos } = productosDesdeCSV(csv);
  assert.equal(productos[0].nombre, 'Queso; cremoso');
  assert.equal(productos[0].precio, 9800.5);
  assert.equal(productos[0].unidad, 'kg');
  assert.equal(productos[0].proveedor, 'Lácteos "La Vaca"');
});
