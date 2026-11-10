const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const XLSX=require('xlsx');
require.extensions['.ts']=(module,filename)=>{
 const src=fs.readFileSync(filename,'utf8');
 const out=ts.transpileModule(src,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
  esModuleInterop:true
 }}).outputText;
 module._compile(out,filename);
};
const {parseWorkbooks}=require('../lib/yandex/finance-parser.ts');
const sheet=(cells)=>{
 const s={};
 for(const [a,v] of Object.entries(cells))s[a]={t:typeof v==='number'?'n':'s',v};
 s['!ref']='A1:AK2';
 return s;
};
const orders={SheetNames:['Транзакции по заказам и товарам'],Sheets:{
 'Транзакции по заказам и товарам':sheet({
  Y1:'Статус товара',N1:'Ваша цена за шт.',V1:'Передано в доставку',
  J1:'Дата оформления',H2:'12345',J2:'2026-11-08',L2:'SKU1',
  M2:'Товар',N2:100,V2:1,Y2:'Доставлен покупателю'
 })
}};
const essential=sheet({
 AJ1:'Стоимость услуги без скидок',
 A2:1,H2:'12345',I2:'2026-11-08',J2:'SKU1',
 AH2:'2026-11-08',AJ2:10
});
const services={SheetNames:['Размещение товаров и услуг'],Sheets:{
 'Размещение товаров и услуг':essential
}};
let missing=[];
let r=parseWorkbooks(services,orders,x=>missing=x);
assert.equal(r.filter(x=>x.source==='income').length,1);
assert.equal(r.filter(x=>x.source==='expense').length,1);
assert(missing.includes('Программа лояльности и отзывы'));
assert(missing.includes('Платное хранение с 01.09.26'));
assert(!missing.includes('Размещение товаров и услуг'));
assert.throws(()=>parseWorkbooks({SheetNames:[],Sheets:{}},orders),/Отсутствует обязательный лист/);
const wrong={...services,Sheets:{'Размещение товаров и услуг':sheet({AJ1:'Другая структура',A2:1})}};
assert.throws(()=>parseWorkbooks(wrong,orders),/Изменена структура/);
const storage=sheet({
 Z1:'Стоимость платного хранения',A2:1,I2:'SKU1',
 X2:'2026-11-08',Z2:12.5
});
const extra={SheetNames:[...services.SheetNames,'Платное хранение за период'],Sheets:{
 ...services.Sheets,'Платное хранение за период':storage
}};
missing=[];
r=parseWorkbooks(extra,orders,x=>missing=x);
assert.equal(r.filter(x=>x.sheet==='Платное хранение с 01.09.26').length,1);
assert(!missing.includes('Платное хранение с 01.09.26'));
assert.equal(r.find(x=>x.sheet==='Платное хранение с 01.09.26').amount,1250);
console.log('PASS Yandex finance parser: missing optional services, required tabs, schema guard, renamed storage');
