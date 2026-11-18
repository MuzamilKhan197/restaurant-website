import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareMenuImage} from '../src/features/menu/image-processing.ts';
test('food photos are decoded, resized and re-encoded without EXIF metadata',async()=>{
  const source=await sharp({create:{width:2600,height:1000,channels:3,background:'#f97316'}}).jpeg().withExif({IFD0:{Artist:'Synthetic test'}}).toBuffer();
  const result=await prepareMenuImage(source);const meta=await sharp(result).metadata();assert.equal(meta.format,'webp');assert.equal(meta.width,2400);assert.equal(meta.exif,undefined);
});
test('corrupt image data cannot pass storage upload processing',async()=>{
  await assert.rejects(prepareMenuImage(Uint8Array.from([137,80,78,71,13,10,26,10])),/could not be read/);
});
test('decompression dimensions are capped before processing',async()=>{
  const source=await sharp({create:{width:5000,height:5000,channels:3,background:'#ffffff'}}).png().toBuffer();
  await assert.rejects(prepareMenuImage(source),/20-megapixel/);
});
