// Negocio de ejemplo para probar Góndola sin cargar nada: un almacén con 30 días de ventas.

const CATALOGO = [
  // nombre, categoría, costo, ganancia %, stock, mínimo, proveedor, unidad, ventas por día (promedio)
  ['Yerba mate 1 kg', 'Almacén', 3100, 35, 14, 6, 'Distribuidora Del Sur', 'u', 1.6],
  ['Yerba mate 500 g', 'Almacén', 1700, 38, 4, 6, 'Distribuidora Del Sur', 'u', 1.1],
  ['Azúcar 1 kg', 'Almacén', 980, 35, 18, 8, 'Distribuidora Del Sur', 'u', 1.4],
  ['Fideos tirabuzón 500 g', 'Almacén', 820, 40, 22, 10, 'Distribuidora Del Sur', 'u', 2.1],
  ['Arroz largo fino 1 kg', 'Almacén', 1350, 38, 9, 6, 'Distribuidora Del Sur', 'u', 0.9],
  ['Aceite de girasol 900 ml', 'Almacén', 2150, 30, 3, 5, 'Distribuidora Del Sur', 'u', 0.8],
  ['Harina 000 1 kg', 'Almacén', 690, 40, 15, 8, 'Distribuidora Del Sur', 'u', 1.0],
  ['Puré de tomate 520 g', 'Almacén', 640, 45, 20, 8, 'Distribuidora Del Sur', 'u', 1.3],
  ['Galletitas de agua 3 x 100 g', 'Almacén', 1100, 40, 11, 6, 'Golosinas Norte', 'u', 1.2],
  ['Galletitas dulces rellenas', 'Almacén', 750, 50, 26, 10, 'Golosinas Norte', 'u', 2.4],
  ['Café molido 250 g', 'Almacén', 3900, 35, 5, 3, 'Distribuidora Del Sur', 'u', 0.3],
  ['Mermelada de durazno 454 g', 'Almacén', 1650, 40, 6, 3, 'Distribuidora Del Sur', 'u', 0.3],
  ['Gaseosa cola 1,5 L', 'Bebidas', 1850, 40, 16, 12, 'Bebidas Oeste', 'u', 4.2],
  ['Gaseosa cola 2,25 L', 'Bebidas', 2450, 38, 7, 8, 'Bebidas Oeste', 'u', 2.3],
  ['Gaseosa lima limón 1,5 L', 'Bebidas', 1700, 40, 0, 6, 'Bebidas Oeste', 'u', 1.5],
  ['Agua mineral 2 L', 'Bebidas', 900, 50, 24, 12, 'Bebidas Oeste', 'u', 3.1],
  ['Agua saborizada 1,5 L', 'Bebidas', 1150, 45, 10, 8, 'Bebidas Oeste', 'u', 1.6],
  ['Cerveza lata 473 ml', 'Bebidas', 1250, 45, 36, 24, 'Bebidas Oeste', 'u', 5.5],
  ['Vino tinto 750 ml', 'Bebidas', 2600, 40, 8, 4, 'Bebidas Oeste', 'u', 0.7],
  ['Jugo en polvo', 'Bebidas', 210, 70, 60, 20, 'Golosinas Norte', 'u', 3.0],
  ['Leche entera 1 L', 'Lácteos', 1150, 30, 6, 12, 'Lácteos La Pradera', 'u', 4.8],
  ['Leche descremada 1 L', 'Lácteos', 1180, 30, 9, 6, 'Lácteos La Pradera', 'u', 1.5],
  ['Yogur bebible 1 L', 'Lácteos', 1600, 35, 7, 4, 'Lácteos La Pradera', 'u', 0.9],
  ['Manteca 200 g', 'Lácteos', 2100, 32, 5, 4, 'Lácteos La Pradera', 'u', 0.6],
  ['Queso cremoso', 'Fiambrería', 7200, 40, 3.2, 2, 'Lácteos La Pradera', 'kg', 0.45],
  ['Jamón cocido', 'Fiambrería', 9800, 45, 1.1, 1.5, 'Fiambres El Tano', 'kg', 0.35],
  ['Salame milán', 'Fiambrería', 11500, 45, 1.8, 1, 'Fiambres El Tano', 'kg', 0.15],
  ['Pan francés', 'Panadería', 1400, 45, 4, 3, 'Panadería San Martín', 'kg', 2.2],
  ['Facturas (docena)', 'Panadería', 4200, 40, 3, 2, 'Panadería San Martín', 'u', 1.1],
  ['Huevos maple x 30', 'Almacén', 5200, 25, 4, 3, 'Granja Los Abuelos', 'u', 0.6],
  ['Huevos x 12', 'Almacén', 2300, 30, 6, 4, 'Granja Los Abuelos', 'u', 1.0],
  ['Alfajor triple', 'Golosinas', 650, 60, 40, 20, 'Golosinas Norte', 'u', 4.5],
  ['Alfajor simple', 'Golosinas', 420, 65, 18, 20, 'Golosinas Norte', 'u', 3.2],
  ['Chocolate con leche 100 g', 'Golosinas', 1500, 50, 12, 6, 'Golosinas Norte', 'u', 1.1],
  ['Caramelos masticables (bolsa)', 'Golosinas', 850, 60, 9, 5, 'Golosinas Norte', 'u', 0.6],
  ['Chicles x 10', 'Golosinas', 350, 70, 30, 15, 'Golosinas Norte', 'u', 2.0],
  ['Papas fritas 150 g', 'Golosinas', 1450, 50, 2, 6, 'Golosinas Norte', 'u', 1.4],
  ['Detergente 500 ml', 'Limpieza', 1100, 40, 8, 4, 'Limpieza Total', 'u', 0.6],
  ['Lavandina 1 L', 'Limpieza', 780, 45, 12, 6, 'Limpieza Total', 'u', 0.9],
  ['Papel higiénico x 4', 'Limpieza', 1900, 35, 10, 6, 'Limpieza Total', 'u', 1.0],
  ['Jabón en polvo 800 g', 'Limpieza', 3400, 30, 4, 3, 'Limpieza Total', 'u', 0.3],
  ['Esponja doble uso', 'Limpieza', 380, 60, 15, 6, 'Limpieza Total', 'u', 0.4],
  ['Pilas AA x 2', 'Varios', 1600, 50, 6, 4, '', 'u', 0.2],
  ['Encendedor', 'Varios', 450, 80, 20, 10, '', 'u', 0.8],
  ['Carbón 4 kg', 'Varios', 4300, 35, 3, 4, '', 'u', 0.5],
  ['Hielo bolsa 2 kg', 'Varios', 900, 60, 5, 6, '', 'u', 1.2],
];

const id = (i) => `demo-${String(i).padStart(3, '0')}`;

export function crearNegocioDeEjemplo(ahora = Date.now()) {
  let semilla = 11;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646;
  const redondear10 = (v) => Math.ceil(v / 10) * 10;
  const codigoEAN = (i) => `779${String(1000000000 + i * 7919).slice(-9)}${i % 10}`;

  const inicio = ahora - 30 * 864e5;
  const productos = CATALOGO.map(([nombre, categoria, costo, ganancia, stock, minimo, proveedor, unidad], i) => ({
    id: id(i), nombre, categoria, costo, precio: redondear10(costo * (1 + ganancia / 100)), stock, minimo, ideal: 0,
    proveedor, unidad, codigo: unidad === 'kg' ? '' : codigoEAN(i), archivado: false, creado: inicio, actualizado: inicio,
  }));

  // Ventas de los últimos 30 días: más movimiento a la mañana y a la tarde, y los fines de semana.
  const ventas = [];
  const movimientos = [];
  let numero = 0;
  for (let d = 29; d >= 0; d--) {
    const dia = new Date(ahora - d * 864e5);
    const finde = [0, 6].includes(dia.getDay());
    const tickets = Math.round((finde ? 34 : 26) + azar() * 10);
    for (let t = 0; t < tickets; t++) {
      const hora = azar() < 0.55 ? 8 + azar() * 5 : 16 + azar() * 5.5;
      const fecha = new Date(dia);
      fecha.setHours(Math.floor(hora), Math.floor((hora % 1) * 60), Math.floor(azar() * 60), 0);
      if (fecha.getTime() > ahora) continue;
      const items = [];
      const cantidadItems = 1 + Math.floor(azar() * azar() * 5);
      for (let k = 0; k < cantidadItems; k++) {
        // Elige productos según su popularidad.
        const pesos = CATALOGO.map((c) => c[8]);
        let r = azar() * pesos.reduce((a, b) => a + b, 0);
        let indice = 0;
        while (r > pesos[indice]) r -= pesos[indice++];
        const p = productos[indice];
        if (items.some((x) => x.productoId === p.id)) continue;
        const cantidad = p.unidad === 'kg' ? Math.round((0.15 + azar() * 0.5) * 100) / 100 : 1 + (azar() < 0.15 ? 1 : 0);
        items.push({ productoId: p.id, nombre: p.nombre, unidad: p.unidad, cantidad, precio: p.precio, costo: p.costo });
      }
      if (!items.length) continue;
      const total = Math.round(items.reduce((s, i) => s + i.precio * i.cantidad, 0) * 100) / 100;
      const r = azar();
      const medio = r < 0.38 ? 'efectivo' : r < 0.66 ? 'qr' : r < 0.86 ? 'transferencia' : 'debito';
      const venta = { id: `demo-v${++numero}`, numero, fecha: fecha.getTime(), medio, recibido: null, items, total };
      ventas.push(venta);
      for (const i of items) {
        movimientos.push({ id: `demo-m${venta.numero}-${i.productoId}`, productoId: i.productoId, tipo: 'venta', cantidad: -i.cantidad, stockFinal: null, ventaId: venta.id, motivo: `Ticket ${numero}`, fecha: venta.fecha });
      }
    }
  }
  ventas.sort((a, b) => a.fecha - b.fecha).forEach((v, i) => (v.numero = i + 1));

  // Una entrada de mercadería reciente y un recuento, para que el historial tenga de todo.
  movimientos.push({ id: 'demo-e1', productoId: id(12), tipo: 'entrada', cantidad: 24, stockFinal: null, motivo: 'Llegó el pedido', costoUnitario: 1850, fecha: ahora - 3 * 864e5 });
  movimientos.push({ id: 'demo-r1', productoId: id(25), tipo: 'perdida', cantidad: -0.3, stockFinal: null, motivo: 'Vencido', fecha: ahora - 2 * 864e5 });

  return {
    app: 'gondola',
    version: 1,
    creado: new Date(ahora).toISOString(),
    productos,
    ventas,
    movimientos,
    config: { negocio: 'Almacén La Esquina', redondeo: 10, gananciaPorDefecto: 40, proveedores: { 'Bebidas Oeste': { telefono: '' } }, ultimoRespaldo: ahora - 9 * 864e5, creado: inicio, esEjemplo: true },
  };
}
