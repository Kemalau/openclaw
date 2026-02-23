import { getImageMetadata, resizeToJpeg } from "../media/image-ops.js";

export const DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE = 2000;
export const DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;

function parseImageDimensions(meta: { width: number; height: number } | null): {
  width: number;
  height: number;
} | null {
  const width = Number(meta?.width ?? 0);
  const height = Number(meta?.height ?? 0);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { width, height };
}

export async function normalizeBrowserScreenshot(
  buffer: Buffer,
  opts?: {
    maxSide?: number;
    maxBytes?: number;
  },
): Promise<{ buffer: Buffer; contentType?: "image/jpeg" }> {
  const maxSide = Math.max(1, Math.round(opts?.maxSide ?? DEFAULT_BROWSER_SCREENSHOT_MAX_SIDE));
  const maxBytes = Math.max(1, Math.round(opts?.maxBytes ?? DEFAULT_BROWSER_SCREENSHOT_MAX_BYTES));

  const inputDimensions = parseImageDimensions(await getImageMetadata(buffer));
  const maxDim = inputDimensions ? Math.max(inputDimensions.width, inputDimensions.height) : 0;
  const inputOverMaxSide = Boolean(
    inputDimensions &&
      (inputDimensions.width > maxSide || inputDimensions.height > maxSide),
  );

  if (buffer.byteLength <= maxBytes && !inputOverMaxSide) {
    return { buffer };
  }

  const qualities = [85, 75, 65, 55, 45, 35];
  const sideStart = maxDim > 0 ? Math.min(maxSide, maxDim) : maxSide;
  const sideGrid = [sideStart, 1800, 1600, 1400, 1200, 1000, 800]
    .map((v) => Math.min(maxSide, v))
    .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
    .toSorted((a, b) => b - a);

  let smallest: { buffer: Buffer; size: number; dimensions?: { width: number; height: number } } | null =
    null;

  for (const side of sideGrid) {
    for (const quality of qualities) {
      const out = await resizeToJpeg({
        buffer,
        maxSide: side,
        quality,
        withoutEnlargement: true,
      });

      const outDimensions = parseImageDimensions(await getImageMetadata(out));
      const outputWithinMaxSide = outDimensions
        ? outDimensions.width <= maxSide && outDimensions.height <= maxSide
        : !inputOverMaxSide;

      if (!smallest || out.byteLength < smallest.size) {
        smallest = { buffer: out, size: out.byteLength, dimensions: outDimensions ?? undefined };
      }

      if (out.byteLength <= maxBytes && outputWithinMaxSide) {
        return { buffer: out, contentType: "image/jpeg" };
      }
    }
  }

  const best = smallest?.buffer ?? buffer;
  const bestDimensions =
    smallest?.dimensions ?? parseImageDimensions(await getImageMetadata(best)) ?? undefined;
  const bestDimensionLabel = bestDimensions
    ? `${bestDimensions.width}x${bestDimensions.height}px`
    : "unknown dimensions";
  throw new Error(
    `Browser screenshot could not be reduced to <=${maxSide}px per side and <=${(maxBytes / (1024 * 1024)).toFixed(0)}MB (got ${(best.byteLength / (1024 * 1024)).toFixed(2)}MB, ${bestDimensionLabel})`,
  );
}
