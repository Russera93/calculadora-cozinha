// js/ocr.js
//
// Reads the text of a receipt photo on the device itself (Tesseract.js,
// Portuguese model). It is the app's only runtime dependency, loaded from
// a pinned CDN version only when someone picks an image, so the rest of
// the app never pays for it. Tesseract keeps the language file in
// IndexedDB after the first download; the service worker caches the rest.

const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.esm.min.js';
const MAX_SIDE = 2000;
const MIN_SIDE = 1200;

function ocrError(code, cause) {
  const err = new Error(code === 'offline' ? 'sem conexão para baixar o leitor' : 'falha ao ler a imagem');
  err.code = code;
  err.cause = cause;
  return err;
}

function statusText(status) {
  if (/recogniz/.test(status)) return 'Lendo a nota…';
  if (/initializ/.test(status)) return 'Preparando o leitor…';
  return 'Baixando o leitor (só na primeira vez)…';
}

// Scaled to a size Tesseract reads well, in grayscale with the contrast
// stretched (thermal receipts are often faded gray on gray).
async function preprocess(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_SIDE ? MAX_SIDE / longest : longest < MIN_SIDE ? MIN_SIDE / longest : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = image.data;
  const gray = new Uint8ClampedArray(px.length / 4);
  const histogram = new Uint32Array(256);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[j] = g;
    histogram[gray[j]] += 1;
  }
  // 2nd and 98th percentiles become black and white.
  const percentile = (p) => {
    let acc = 0;
    const target = gray.length * p;
    for (let v = 0; v < 256; v += 1) {
      acc += histogram[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = percentile(0.02);
  const hi = Math.max(percentile(0.98), lo + 1);
  for (let i = 0, j = 0; i < px.length; i += 4, j += 1) {
    const v = ((gray[j] - lo) * 255) / (hi - lo);
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export async function readReceiptImage(file, onProgress = () => {}) {
  onProgress(0, 'Preparando a imagem…');
  let canvas;
  try {
    canvas = await preprocess(file);
  } catch (cause) {
    throw ocrError('falha', cause);
  }

  let Tesseract;
  try {
    Tesseract = (await import(TESSERACT_URL)).default;
  } catch (cause) {
    throw ocrError('offline', cause);
  }

  let worker;
  try {
    worker = await Tesseract.createWorker('por', 1, {
      logger: (m) => onProgress(typeof m.progress === 'number' ? m.progress : 0, statusText(String(m.status || '')))
    });
    // 6 = one uniform block of text (a receipt column);
    // interword spaces keep "2 UN X 7,49" apart from the name.
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } catch (cause) {
    throw ocrError(navigator.onLine === false ? 'offline' : 'falha', cause);
  } finally {
    worker?.terminate().catch(() => {});
  }
}
