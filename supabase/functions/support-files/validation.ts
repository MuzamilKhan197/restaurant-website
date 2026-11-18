export const MAX_FILE_SIZE=5*1024*1024;
export function validateEvidence(bytes:Uint8Array,type:string){
 if(!bytes.length||bytes.length>MAX_FILE_SIZE)throw new Error('Choose a file up to 5 MB.');
 const match=(signature:number[],offset=0)=>signature.every((v,i)=>bytes[offset+i]===v);
 const valid=type==='image/jpeg'?match([255,216,255]):type==='image/png'?match([137,80,78,71,13,10,26,10]):type==='image/webp'?match([82,73,70,70])&&match([87,69,66,80],8):type==='application/pdf'?match([37,80,68,70,45]):type==='text/plain'?(()=>{try{return !new TextDecoder('utf-8',{fatal:true}).decode(bytes).includes('\u0000');}catch{return false;}})():false;
 if(!valid)throw new Error('File contents do not match a supported image, PDF or UTF-8 text file.');
}
export function safeFilename(name:string){return name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(0,150)||'attachment';}
