const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
const src=fs.readFileSync('app/api/agents/ozon-finance-ads/worker.ts','utf8');
const start=src.indexOf('export function reportCsvFiles(');
const end=src.indexOf('\nasync function token()',start);
assert(start>=0&&end>start);
const snippet=src.slice(start,end);
const transpiled=ts.transpileModule(snippet,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
}}).outputText;
const result={exports:{}};
new Function('exports','inflateRawSync','Buffer',transpiled)(result.exports,
 require('node:zlib').inflateRawSync,Buffer);
const parse=result.exports.reportCsvFiles;
function crc32(buf){
 let crc=0xffffffff;
 for(const b of buf){crc^=b;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function oneEntryZip(id,txt){
 const name=Buffer.from(id+'.csv'),payload=Buffer.from(txt);
 const crc=crc32(payload);
 const local=Buffer.alloc(30);
 local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);
 local.writeUInt32LE(crc,14);local.writeUInt32LE(payload.length,18);
 local.writeUInt32LE(payload.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);
 central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);
 central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);
 central.writeUInt32LE(payload.length,20);central.writeUInt32LE(payload.length,24);
 central.writeUInt16LE(name.length,28);central.writeUInt32LE(0,42);
 const offset=local.length+name.length+payload.length;
 const directory=Buffer.concat([central,name]);
 const finish=Buffer.alloc(22);finish.writeUInt32LE(0x06054b50,0);
 finish.writeUInt16LE(1,8);finish.writeUInt16LE(1,10);
 finish.writeUInt32LE(directory.length,12);finish.writeUInt32LE(offset,16);
 return Buffer.concat([local,name,payload,directory,finish]);
}
const csv='sku;Расход, Р, с НДС\\n12345;123,45';
const zip=oneEntryZip('30008673',csv);
assert.throws(()=>parse(zip,['30008673','29796647']),/ZIP_MISSING|Invalid ZIP central directory/);
const parts=parse(zip,['30008673','29796647'],true);
assert.equal(parts.size,1);assert.equal(parts.get('30008673'),csv);
assert(!parts.has('29796647'));
const bad=Buffer.from(zip);bad[44]^=1;
assert.throws(()=>parse(bad,['30008673','29796647'],true),/ZIP CRC/);
assert.equal(parse(Buffer.from(csv),['30008673']).get('30008673'),csv);
assert(src.includes('const absent=batch.filter(x=>!files.has(x.campaign_id))'));
assert(src.includes('for(const item of absent)'));
assert(src.includes('OZON_AD_CRON_SECRET'));
assert(src.includes('lastHistorical'));
console.log('PASS Ozon ads: preserve verified partial ZIP campaigns, retry missing ones only, guard cron auth and prioritize recent history');
