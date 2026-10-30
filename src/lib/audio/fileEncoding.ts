/**
 * Converts a browser File or Blob to a base64 data URL.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * Returns only the base64 payload without mime/data prefix.
 */
export async function fileToBase64Payload(file: File | Blob): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  return dataUrl.split(',')[1] || dataUrl;
}
