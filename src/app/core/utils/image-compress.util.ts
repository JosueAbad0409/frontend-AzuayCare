export async function comprimirImagenPerfil(file: File, maxSize = 400, calidad = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;
  const ratio = Math.min(1, maxSize / Math.max(width, height));
  
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width; 
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/webp', calidad)
  );
  
  return new File([blob], `perfil-${Date.now()}.webp`, { type: 'image/webp' });
}