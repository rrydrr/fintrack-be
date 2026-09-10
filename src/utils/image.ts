import sharp from "sharp";

/**
 * Converts File/Blob, base64 data URL, or raw base64 string into a standard JPEG data URL.
 * Automatically normalizes formats (like WebP, PNG, TIFF) to JPEG to ensure maximum
 * compatibility with upstream AI vision models.
 */
export async function formatImageUrl(image: File | Blob | string): Promise<string> {
  if (typeof image === "string") {
    if (image.startsWith("http://") || image.startsWith("https://")) {
      return image;
    }

    try {
      let buffer: Buffer;
      if (image.startsWith("data:")) {
        const base64Data = image.split(",")[1];
        buffer = Buffer.from(base64Data, "base64");
      } else {
        buffer = Buffer.from(image, "base64");
      }

      const jpegBuffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer();
      return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
    } catch {
      return image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`;
    }
  }

  const arrayBuffer = await image.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  try {
    const jpegBuffer = await sharp(inputBuffer).jpeg({ quality: 90 }).toBuffer();
    return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
  } catch {
    const base64 = inputBuffer.toString("base64");
    const mimeType = image.type || "image/jpeg";
    return `data:${mimeType};base64,${base64}`;
  }
}
