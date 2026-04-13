/**
 * Media Optimization Utilities
 * ============================
 * Functions to handle client-side image compression and conversion.
 * Focuses on converting images to WebP format to reduce bandwidth and storage.
 */

/**
 * Convert an image file/blob to a optimized WebP blob.
 * 
 * @param file - The source image File or Blob
 * @param options - Optimization settings (quality 0.0-1.0, maxWidth, maxHeight)
 */
export async function convertToWebP(
  file: File | Blob,
  options: { quality?: number; maxWidth?: number; maxHeight?: number } = {}
): Promise<Blob> {
  const { quality = 0.8, maxWidth = 1920, maxHeight = 1080 } = options;

  // 1. Create a bitmap from the source file
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.src = url;

  // Wait for load
  await new Promise<void>((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for optimization"));
    };
  });

  // 2. Calculate dimensions to fit within maxWidth/maxHeight
  let { width, height } = img;
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  // 3. Draw to canvas and get WebP blob
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.drawImage(img, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Image conversion failed"));
      },
      "image/webp",
      quality
    );
  });
}
  