// The browser applies EXIF orientation while decoding, then writes fresh pixels.
// Original files and their metadata never leave the device through the editor.
export async function preparePhoto(file:File):Promise<Blob> {
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Usa JPEG, PNG o WebP. Per HEIC esporta prima in JPEG.');
  if(file.size>6_000_000)throw new Error('La foto supera 6 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try {
    image.src=url;await image.decode();
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>40_000_000)throw new Error('Foto troppo grande: ridimensionala prima di caricarla.');
    const factor=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
    const context=canvas.getContext('2d');if(!context)throw new Error('Non è possibile preparare questa foto nel browser.');
    context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',0.88));
    if(!blob||blob.size>6_000_000)throw new Error('Non è stato possibile ridimensionare la foto. Prova un altro file.');
    canvas.width=canvas.height=1;return blob;
  } finally {image.src='';URL.revokeObjectURL(url);}
}
