import { HttpError } from './http.ts';

const bad = (): never => { throw new HttpError(400,'Foto non valida o formato non supportato. Usa una foto JPEG, PNG o WebP statica.'); };
const ascii = (b:Uint8Array,start:number,length:number) => String.fromCharCode(...b.subarray(start,start+length));
function join(parts:Uint8Array[]) { const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result; }
function dimensions(width:number,height:number) {
  if(!width||!height||width>8192||height>8192||width*height>16_000_000) throw new HttpError(400,'Foto troppo grande: massimo 16 megapixel e 8192 pixel per lato. Ridimensionala prima di caricarla.');
  return {width,height};
}

// Preserve only the display orientation from EXIF. GPS, camera identifiers,
// thumbnails, dates, comments, XMP and arbitrary application data are discarded.
function orientation(exif:Uint8Array) {
  try {
    if(ascii(exif,0,6)!=='Exif\0\0') return 1;
    const t=exif.subarray(6),v=new DataView(t.buffer,t.byteOffset,t.byteLength);
    const little=ascii(t,0,2)==='II';if(!little&&ascii(t,0,2)!=='MM')return bad();
    if(v.getUint16(2,little)!==42)return bad();
    const at=v.getUint32(4,little),count=v.getUint16(at,little);
    if(count>512||at+2+count*12>t.length)return bad();
    for(let i=0;i<count;i++){const p=at+2+i*12;if(v.getUint16(p,little)===0x112){if(v.getUint16(p+2,little)!==3||v.getUint32(p+4,little)!==1)return bad();const value=v.getUint16(p+8,little);return value>=1&&value<=8?value:bad();}}
    return 1;
  } catch { return bad(); }
}
function cleanOrientation(value:number) {
  // Minimal TIFF: one SHORT orientation tag, no pointers or personal metadata.
  return new Uint8Array([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,value,0,0,0,0,0,0,0]);
}
function tiffOrientation(bytes:Uint8Array){return orientation(ascii(bytes,0,6)==='Exif\0\0'?bytes:join([new Uint8Array([69,120,105,102,0,0]),bytes]));}
function pngOrientation(value:number){const tiff=cleanOrientation(value).subarray(10),chunk=new Uint8Array(12+tiff.length),v=new DataView(chunk.buffer);v.setUint32(0,tiff.length);chunk.set([101,88,73,102],4);chunk.set(tiff,8);v.setUint32(chunk.length-4,crc(chunk.subarray(4,chunk.length-4)));return chunk;}

function jpeg(b:Uint8Array) {
  if(b[0]!==255||b[1]!==216)return bad();
  const parts=[b.subarray(0,2)];let at=2,frame=false,scan=false,display=1,size={width:0,height:0};
  while(at<b.length){
    const start=at;if(b[at++]!==255)return bad();while(b[at]===255)at++;
    const marker=b[at++];
    if(marker===217){if(!frame||!scan||at!==b.length)return bad();parts.push(b.subarray(start,at));if(display!==1)parts.splice(1,0,cleanOrientation(display));return {data:join(parts),...size};}
    if(marker===0||marker===216||marker===1||marker>=208&&marker<=215||at+2>b.length)return bad();
    const length=(b[at]<<8)|b[at+1],end=at+length;if(length<2||end>b.length)return bad();
    if(marker===225&&ascii(b,at+2,6)==='Exif\0\0')display=orientation(b.subarray(at+2,end));
    // Baseline/progressive JPEG only; all APP/COM segments except structural
    // Adobe color transform are removed, including metadata after scan data.
    if(marker===192||marker===194){if(frame||length<8)return bad();size=dimensions((b[at+5]<<8)|b[at+6],(b[at+3]<<8)|b[at+4]);frame=true;}
    if(marker>=192&&marker<=207&&![192,194,196].includes(marker))return bad();
    if(marker===238){if(length!==14||ascii(b,at+2,5)!=='Adobe')return bad();parts.push(b.subarray(start,end));}
    else if(!(marker>=224&&marker<=239)&&marker!==254)parts.push(b.subarray(start,end));
    at=end;
    if(marker===218){
      if(!frame)return bad();scan=true;const scanStart=at;
      while(at<b.length){if(b[at]!==255){at++;continue;}let next=at+1;while(b[next]===255)next++;if(b[next]===0||b[next]>=208&&b[next]<=215){at=next+1;continue;}break;}
      parts.push(b.subarray(scanStart,at));
    }
  }
  return bad();
}

const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc(b:Uint8Array){let c=0xffffffff;for(const value of b)c=crcTable[(c^value)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function png(b:Uint8Array) {
  if(![137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return bad();
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength),parts=[b.subarray(0,8)];let at=8,header=false,pixels=false,size={width:0,height:0};
  while(at+12<=b.length){const length=v.getUint32(at),end=at+12+length;if(end>b.length)return bad();const type=ascii(b,at+4,4);if(!/^[a-zA-Z]{4}$/.test(type)||crc(b.subarray(at+4,end-4))!==v.getUint32(end-4))return bad();
    if(!header&&type!=='IHDR')return bad();
    if(type==='IHDR'){if(header||length!==13)return bad();size=dimensions(v.getUint32(at+8),v.getUint32(at+12));header=true;}
    if(['acTL','fcTL','fdAT'].includes(type))return bad();
    if(type==='IDAT')pixels=true;
    if(type==='eXIf'){const display=tiffOrientation(b.subarray(at+8,end-4));if(display!==1)parts.push(pngOrientation(display));}
    if(['IHDR','PLTE','IDAT','IEND','tRNS'].includes(type))parts.push(b.subarray(at,end));
    else if(type[0]===type[0].toUpperCase())return bad();
    if(type==='IEND'){if(length||!pixels||end!==b.length)return bad();return {data:join(parts),...size};}at=end;
  }
  return bad();
}

function webp(b:Uint8Array) {
  if(ascii(b,0,4)!=='RIFF'||ascii(b,8,4)!=='WEBP'||b.length<20)return bad();
  const v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(v.getUint32(4,true)+8!==b.length)return bad();
  const parts:Uint8Array[]=[];let at=12,image=false,extended=false,display=1,size={width:0,height:0};
  while(at+8<=b.length){const type=ascii(b,at,4),length=v.getUint32(at+4,true),end=at+8+length+(length&1),p=at+8;if(end>b.length)return bad();
    if(type==='VP8X'){if(extended||image||length!==10||b[p]&2)return bad();extended=true;size=dimensions(1+b[p+4]+(b[p+5]<<8)+(b[p+6]<<16),1+b[p+7]+(b[p+8]<<8)+(b[p+9]<<16));const chunk=b.slice(at,end);chunk[8]&=~(32|8|4);parts.push(chunk);}
    else if(type==='VP8 '||type==='VP8L'){
      if(image)return bad();image=true;let decoded;
      if(type==='VP8 '){if(length<10||b[p]&1||b[p+3]!==157||b[p+4]!==1||b[p+5]!==42)return bad();decoded=dimensions(v.getUint16(p+6,true)&0x3fff,v.getUint16(p+8,true)&0x3fff);}
      else {if(length<5||b[p]!==47||b[p+4]>>5)return bad();decoded=dimensions(1+b[p+1]+((b[p+2]&63)<<8),1+(b[p+2]>>6)+(b[p+3]<<2)+((b[p+4]&15)<<10));}
      if(extended&&(decoded.width!==size.width||decoded.height!==size.height))return bad();size=decoded;parts.push(b.subarray(at,end));
    } else if(type==='ALPH'){if(!extended||image)return bad();parts.push(b.subarray(at,end));}
    else if(type==='EXIF')display=tiffOrientation(b.subarray(p,p+length));
    else if(!['XMP ','ICCP'].includes(type))return bad();
    at=end;
  }
  if(!image||at!==b.length)return bad();
  if(display!==1){if(!extended)return bad();parts[0][8]|=8;const tiff=cleanOrientation(display).subarray(10),chunk=new Uint8Array(8+tiff.length);chunk.set([69,88,73,70]);new DataView(chunk.buffer).setUint32(4,tiff.length,true);chunk.set(tiff,8);parts.push(chunk);}
  const header=b.slice(0,12),data=join([header,...parts]);new DataView(data.buffer).setUint32(4,data.length-8,true);return {data,...size};
}

// Lossless container sanitization on the server is authoritative. It deliberately
// does not claim antivirus scanning or a full pixel decode (the editor decodes).
export function sanitizePhoto(bytes:Uint8Array,type:string) {
  if(bytes.length<12||bytes.length>6_000_000)return bad();
  if(type==='image/jpeg')return jpeg(bytes);
  if(type==='image/png')return png(bytes);
  if(type==='image/webp')return webp(bytes);
  return bad();
}
