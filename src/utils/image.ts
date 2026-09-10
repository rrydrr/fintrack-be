/**
 * Converts File/Blob, base64 data URL, or raw base64 string into a standard data URL.
 */
export async function formatImageUrl(image: File | Blob | string): Promise<string> {
  if (typeof image === "string") {
    if (
      image.startsWith("data:") ||
      image.startsWith("http://") ||
      image.startsWith("https://")
    ) {
      return image;
    }
    return `data:image/jpeg;base64,${image}`;
  }

  const arrayBuffer = await image.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = image.type || "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
}
