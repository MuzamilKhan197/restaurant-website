import 'server-only';
import sharp from 'sharp';

// Decode before storing: signature checks alone do not establish a valid image.
// Re-encoding also removes EXIF metadata and limits dimensions/decompression work.
export async function prepareMenuImage(bytes: Uint8Array) {
  try {
    return await sharp(bytes, { limitInputPixels: 20000000, animated: false })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new Error('This photograph could not be read, or exceeds the 20-megapixel limit.');
  }
}
