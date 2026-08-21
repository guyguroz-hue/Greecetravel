'use client';

/**
 * Turning a phone photo into something an OCR engine can actually read.
 *
 * Tesseract was built for scanned documents: even lighting, straight lines,
 * black text on white. A photograph of a till receipt is none of those. It is
 * grey thermal print on off-white paper, lit from one side, with the shadow of
 * the person holding the phone falling across half of it. Handed that
 * directly, the engine reads a different set of words every time the light
 * moves — which is exactly what two photos of the same receipt disagreeing
 * looks like.
 *
 * So the photo is normalised first, and the normalisation is deterministic:
 * the same photo in gives the same bitmap out, and two photos of one receipt
 * end up far closer to each other than the originals were.
 *
 * Four steps, in order:
 *
 *  1. Scale to a working size. Too large wastes seconds; too small and the
 *     print stops being resolvable. Small images are scaled UP, because a
 *     receipt photographed from far away has characters only a few pixels
 *     tall and the engine needs roughly twenty.
 *  2. Greyscale, by luminance rather than a flat average — thermal print is
 *     often a washed-out blue-grey that a flat average turns to mush.
 *  3. Adaptive threshold. This is the step that matters. A single global
 *     cutoff cannot cope with a shadow: pick it for the lit half and the
 *     shaded half goes solid black. Comparing each pixel against the average
 *     of its own neighbourhood instead makes the shadow irrelevant, because
 *     the shadow moves the pixel and its neighbourhood together.
 *  4. Out as PNG. JPEG rings around hard edges, and after thresholding the
 *     image is nothing but hard edges.
 */

/** Long edge of the working image. */
const TARGET_EDGE = 1800;
/** Below this the print is too small to resolve, so scale up instead. */
const MIN_EDGE = 1100;

/**
 * Neighbourhood size as a fraction of width, and how far below its
 * neighbourhood a pixel must sit to count as ink.
 *
 * An eighth of the width is around a dozen characters — wide enough to hold
 * both text and the paper around it, narrow enough that a shadow edge falls
 * outside it. The 12% margin keeps paper grain from being read as text.
 */
const WINDOW_FRACTION = 8;
const THRESHOLD_MARGIN = 0.12;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  /** False when the browser could not decode or draw, and the original is returned. */
  processed: boolean;
}

function canvasOf(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Bradley–Roth adaptive threshold over an integral image.
 *
 * The integral image makes the neighbourhood average a constant-time lookup
 * per pixel — four array reads — so the whole pass is linear and runs in a
 * few milliseconds on a phone, rather than being quadratic in the window size.
 */
export function adaptiveThreshold(
  grey: Uint8ClampedArray,
  width: number,
  height: number,
  windowFraction = WINDOW_FRACTION,
  margin = THRESHOLD_MARGIN
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(grey.length);
  // One row and column of zeroes on the top and left, so the area lookup
  // never has to special-case the edges.
  const integral = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += grey[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const half = Math.max(1, Math.floor(width / windowFraction / 2));

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      const mean = sum / count;
      out[y * width + x] = grey[y * width + x] < mean * (1 - margin) ? 0 : 255;
    }
  }
  return out;
}

/**
 * A photo, cleaned up for recognition.
 *
 * Never throws: anything the browser will not decode or draw comes back as
 * the original file with `processed: false`, because a worse image the engine
 * can still try is better than no reading at all.
 */
export async function prepareReceiptImage(file: Blob): Promise<PreparedImage> {
  const untouched = (): PreparedImage => ({ blob: file, width: 0, height: 0, processed: false });
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return untouched();
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return untouched();
  }

  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest === 0) return untouched();
    const target = longest < MIN_EDGE ? MIN_EDGE : TARGET_EDGE;
    const scale = target / longest;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = canvasOf(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return untouched();

    // White underneath, so a transparent PNG does not threshold to solid black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);

    const image = ctx.getImageData(0, 0, width, height);
    const px = image.data;

    const grey = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      grey[p] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    }

    const binary = adaptiveThreshold(grey, width, height);
    for (let p = 0, i = 0; p < binary.length; p++, i += 4) {
      px[i] = px[i + 1] = px[i + 2] = binary[p];
      px[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return untouched();
    return { blob, width, height, processed: true };
  } catch {
    return untouched();
  } finally {
    bitmap.close();
  }
}

/** A readable copy of the original photo, for showing next to the form. */
export async function previewImage(file: Blob, maxEdge = 900): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = canvasOf(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale))
    );
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85)
    );
    return blob ?? file;
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
