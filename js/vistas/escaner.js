// Escanear códigos de barras con la cámara del celular (donde el navegador lo permite).
// Los lectores USB o Bluetooth no necesitan esto: escriben el código como si fuera un teclado.

import { dialogo, el } from '../ui.js';

export const puedeEscanear = () => 'BarcodeDetector' in globalThis && !!navigator.mediaDevices?.getUserMedia;

export async function escanearCodigo() {
  let flujo = null;
  let leido = null;
  let activo = true;
  const video = el('video', { class: 'escaner__video', playsinline: true, muted: true, 'aria-label': 'Vista de la cámara' });
  const estado = el('p', { class: 'nota', 'aria-live': 'polite' }, 'Pedimos permiso para usar la cámara…');

  const detener = () => {
    activo = false;
    flujo?.getTracks().forEach((t) => t.stop());
  };

  const promesa = dialogo({
    titulo: 'Escanear código',
    descripcion: 'Apuntá la cámara al código de barras del producto.',
    contenido: el('div', { class: 'escaner' }, video, estado),
    botones: [{ texto: 'Cancelar', valor: null }],
  });

  try {
    flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = flujo;
    await video.play();
    estado.textContent = 'Buscando un código…';
    const detector = new globalThis.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'] });
    const buscar = async () => {
      if (!activo) return;
      try {
        const codigos = await detector.detect(video);
        if (codigos.length) {
          leido = codigos[0].rawValue;
          detener();
          video.closest('dialog')?.querySelector('.dialogo__cabecera button')?.click();
          return;
        }
      } catch {
        /* cuadro no listo todavía */
      }
      requestAnimationFrame(buscar);
    };
    buscar();
  } catch {
    estado.textContent = 'No pudimos usar la cámara. Revisá el permiso en el navegador o escribí el código a mano.';
  }

  await promesa;
  detener();
  return leido;
}
