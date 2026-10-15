export async function attachmentPayload(file){
 if(!file||!file.size)return undefined;
 if(file.size>2*1024*1024)throw new Error('El archivo supera el límite de 2 MB.');
 if(!['application/pdf','image/jpeg','image/png'].includes(file.type))throw new Error('Adjuntá un archivo PDF, JPG o PNG.');
 const bytes=new Uint8Array(await file.arrayBuffer());
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {nombre:file.name,mime:file.type,base64:btoa(binary)};
}
