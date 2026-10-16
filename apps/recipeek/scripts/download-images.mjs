import { mkdir, writeFile } from 'node:fs/promises';
const photos = {pasta:'1473093295043-cdd812d0e601',salad:'1512621776951-a57141f2eefd',pancakes:'1528207776546-365bb710ee93',focaccia:'1549931319-a545dcf3bc73',vegetables:'1511690743698-d9d85f2fbf38',cake:'1578985545062-69928b1d9587'};
await mkdir('public/images',{recursive:true});
await Promise.all(Object.entries(photos).map(async([name,id])=>{const url=`https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1100&q=85`;const response=await fetch(url);if(!response.ok)throw new Error(`${name}: ${response.status}`);const bytes=new Uint8Array(await response.arrayBuffer());await writeFile(`public/images/${name}.jpg`,bytes);console.log(name,bytes.byteLength);}));
