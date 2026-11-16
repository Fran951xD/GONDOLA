// Piezas de interfaz compartidas: crear elementos, formatos, avisos, diálogos e íconos.

// --- Formatos -----------------------------------------------------------

const NF = (o) => new Intl.NumberFormat('es-AR', o);
const pesos = NF({ style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const pesosCentavos = NF({ style: 'currency', currency: 'ARS', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numero = NF({ maximumFractionDigits: 2 });
const entero = NF({ maximumFractionDigits: 0 });
const pct = NF({ maximumFractionDigits: 0 });

/** $ 1.240 — sin centavos salvo que los tenga. */
export const plata = (v) => (Number.isFinite(v) ? (Math.round(v) === Math.round(v * 100) / 100 ? pesos : pesosCentavos).format(v).replace(/\s/, ' ') : '—');
export const plataRedonda = (v) => (Number.isFinite(v) ? pesos.format(v).replace(/\s/, ' ') : '—');
export const num = (v) => (Number.isFinite(v) ? numero.format(v) : '—');
export const porcentaje = (v) => (Number.isFinite(v) ? `${pct.format(v)} %` : '—');

/** "12 u" / "1,35 kg" */
export const cantidad = (v, unidad) => (unidad === 'kg' ? `${numero.format(v)} kg` : `${entero.format(v)} u`);

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export const fechaLarga = (ms) => {
  const d = new Date(ms);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
};
export const fechaCorta = (ms) => {
  const d = new Date(ms);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};
export const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** "hace 5 minutos", "ayer", "hace 3 días" */
export function hace(ms) {
  const minutos = Math.round((Date.now() - ms) / 60000);
  if (minutos < 1) return 'recién';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return 'ayer';
  return `hace ${dias} días`;
}

/** Lee lo que escribe una persona: "1.500", "1500", "1.500,50", "0,350". */
export function leerEntrada(texto) {
  let s = String(texto ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Escribe un número para un campo editable: 1240.5 → "1240,5" */
export const paraCampo = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000).replace('.', ',') : '');

// --- DOM ----------------------------------------------------------------

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

/** Crea un elemento. Los hijos de texto se insertan como texto (nunca como HTML). */
export function el(tag, atributos = {}, ...hijos) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') nodo.className = v;
    else if (k === 'dataset') Object.assign(nodo.dataset, v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, valor] of Object.entries(v)) {
        if (prop.startsWith('--')) nodo.style.setProperty(prop, valor);
        else nodo.style[prop] = valor;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (k === 'value') nodo.value = v;
    else nodo.setAttribute(k, v === true ? '' : v);
  }
  nodo.append(...hijos.flat(Infinity).filter((h) => h != null && h !== false));
  return nodo;
}

/** La etiqueta amarilla de precio, como en la góndola. */
export function etiquetaPrecio(precio, { unidad = 'u', tamano = '' } = {}) {
  return el('span', { class: `etiqueta-precio ${tamano ? `etiqueta-precio--${tamano}` : ''}` },
    plata(precio), unidad === 'kg' ? el('small', {}, '/kg') : null);
}

export function pildoraEstado(estado) {
  const textos = { agotado: 'Agotado', bajo: 'Bajo mínimo', ok: 'En stock' };
  return el('span', { class: `pildora pildora--${estado}` }, textos[estado]);
}

// --- Avisos (toasts) ----------------------------------------------------

/** Aviso breve abajo de la pantalla. `accion` = { texto, alHacer } para ofrecer "Deshacer". */
export function avisar(mensaje, { tipo = 'ok', accion = null, duracion = 5000 } = {}) {
  const zona = $('#avisos');
  const aviso = el('div', { class: `aviso aviso--${tipo}`, role: tipo === 'error' ? 'alert' : 'status' },
    el('span', {}, mensaje));
  if (accion) {
    aviso.append(el('button', {
      type: 'button', class: 'aviso__accion',
      onclick: () => {
        accion.alHacer();
        aviso.remove();
      },
    }, accion.texto));
  }
  zona.append(aviso);
  setTimeout(() => aviso.classList.add('aviso--saliendo'), duracion);
  setTimeout(() => aviso.remove(), duracion + 300);
}

// --- Diálogos -----------------------------------------------------------

/**
 * Abre un <dialog> modal con título, contenido y botones. Devuelve una promesa con el valor del botón elegido.
 * botones: [{ texto, valor, tipo: 'primario' | 'peligro' | 'secundario', alHacer?: () => boolean|Promise }]
 */
export function dialogo({ titulo, descripcion = null, contenido = null, botones = [{ texto: 'Cerrar', valor: null }], ancho = '' }) {
  return new Promise((resolver) => {
    const anterior = document.activeElement;
    const tituloId = `d-${Math.random().toString(36).slice(2, 8)}`;
    const caja = el('dialog', { class: `dialogo ${ancho ? `dialogo--${ancho}` : ''}`, 'aria-labelledby': tituloId });
    const pie = el('div', { class: 'dialogo__pie' });
    let resuelto = false;
    const cerrar = (valor) => {
      if (resuelto) return;
      resuelto = true;
      caja.close();
      caja.remove();
      anterior?.focus?.();
      resolver(valor);
    };
    for (const b of botones) {
      pie.append(el('button', {
        type: 'button', class: `boton boton--${b.tipo ?? 'secundario'}`,
        onclick: async (e) => {
          const boton = e.currentTarget; // después de un await, currentTarget ya no existe
          if (b.alHacer) {
            boton.disabled = true;
            const seguir = await Promise.resolve().then(() => b.alHacer(caja)).catch((error) => {
              avisar(error.message, { tipo: 'error' });
              return false;
            });
            boton.disabled = false;
            if (seguir === false) return;
          }
          cerrar(b.valor);
        },
      }, b.texto));
    }
    caja.append(
      el('div', { class: 'dialogo__cabecera' },
        el('h2', { id: tituloId }, titulo),
        el('button', { type: 'button', class: 'boton-icono', 'aria-label': 'Cerrar', onclick: () => cerrar(null) }, icono('cerrar'))),
      descripcion ? el('p', { class: 'dialogo__descripcion' }, descripcion) : null,
      contenido ? el('div', { class: 'dialogo__cuerpo' }, contenido) : null,
      pie,
    );
    caja.addEventListener('cancel', (e) => {
      e.preventDefault();
      cerrar(null);
    });
    document.body.append(caja);
    caja.showModal();
    // Enfoca el primer campo; si no hay, el botón principal.
    (caja.querySelector('input:not([type=hidden]), select, textarea') ?? caja.querySelector('.boton--primario') ?? caja.querySelector('button'))?.focus();
  });
}

export const confirmar = (titulo, descripcion, { texto = 'Confirmar', peligro = false } = {}) =>
  dialogo({
    titulo, descripcion,
    botones: [{ texto: 'Cancelar', valor: false }, { texto, valor: true, tipo: peligro ? 'peligro' : 'primario' }],
  });

/** Campo con etiqueta, ayuda y lugar para el error. */
export function campo({ etiqueta, id, ayuda = null, control, error = null, clase = '' }) {
  const ayudaId = ayuda ? `${id}-ayuda` : null;
  const errorId = `${id}-error`;
  control.id = id;
  if (ayudaId || error) control.setAttribute('aria-describedby', [ayudaId, errorId].filter(Boolean).join(' '));
  if (error) control.setAttribute('aria-invalid', 'true');
  return el('div', { class: `campo ${clase}` },
    el('label', { for: id }, etiqueta),
    control,
    ayuda ? el('p', { class: 'campo__ayuda', id: ayudaId }, ayuda) : null,
    el('p', { class: 'campo__error', id: errorId, hidden: !error }, error ?? ''));
}

export function mostrarErrores(formulario, errores) {
  for (const error of $$('.campo__error', formulario)) {
    error.hidden = true;
    error.textContent = '';
  }
  for (const control of $$('[aria-invalid]', formulario)) control.removeAttribute('aria-invalid');
  let primero = null;
  for (const [nombre, mensaje] of Object.entries(errores)) {
    const control = formulario.querySelector(`[name="${nombre}"]`);
    if (!control) continue;
    control.setAttribute('aria-invalid', 'true');
    const caja = $(`#${control.id}-error`, formulario);
    if (caja) {
      caja.textContent = mensaje;
      caja.hidden = false;
    }
    primero ??= control;
  }
  primero?.focus();
}

/** Descarga un archivo generado en el navegador. */
export function descargar(nombreArchivo, contenido, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const enlace = el('a', { href: url, download: nombreArchivo });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Pide un archivo al usuario. */
export function elegirArchivo(aceptar) {
  return new Promise((resolver) => {
    const entrada = el('input', { type: 'file', accept: aceptar, hidden: true });
    entrada.addEventListener('change', () => {
      resolver(entrada.files?.[0] ?? null);
      entrada.remove();
    });
    document.body.append(entrada);
    entrada.click();
  });
}

// --- Íconos (trazo de 1,75 px, 24 × 24) --------------------------------------

const TRAZOS = {
  hoy: 'M4 13h4v7H4zM10 9h4v11h-4zM16 4h4v16h-4z',
  vender: 'M3 5h2l2.2 10.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6.2M9 20.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Zm8 0a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1Z',
  productos: 'M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9ZM4 7.5l8 3.5 8-3.5M12 11v9',
  reponer: 'M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4',
  movimientos: 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3',
  ventas: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6m-6 4h3',
  ajustes: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.6 7.6 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
  sumar: 'M12 5v14M5 12h14',
  restar: 'M5 12h14',
  cerrar: 'M6 6l12 12M18 6 6 18',
  basura: 'M5 7h14M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  whatsapp: 'M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Zm5-11c0 3 2.9 6 6 6l1.2-1.2-2-1-1 .8a4 4 0 0 1-2.8-2.8l.8-1-1-2L9 9Z',
  copiar: 'M9 9h10v10H9zM5 15V5h10',
  caja: 'M4 8h16v12H4zM8 8V5h8v3M4 13h16',
  codigo: 'M4 5v14M7 5v14M11 5v14M14 5v14M18 5v14M20 5v14',
  descargar: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  subir: 'M12 20V9m0 0-4 4m4-4 4 4M5 4h14',
  flecha: 'M9 6l6 6-6 6',
  atras: 'M15 6l-6 6 6 6',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alerta: 'M12 9v4m0 3.5h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z',
  editar: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  instalar: 'M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3',
};

export function icono(nombre, { tamano = 20, etiqueta = null } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', tamano);
  svg.setAttribute('height', tamano);
  svg.setAttribute('class', 'icono');
  if (etiqueta) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', etiqueta);
  } else svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', TRAZOS[nombre] ?? '');
  svg.append(path);
  return svg;
}
