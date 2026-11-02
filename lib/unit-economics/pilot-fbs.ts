/**
 * Pilot-only FBS calculations from the five verified FBO/FBY examples.
 * No writes to the existing Google workbook. Monetary values remain unrounded internally.
 * All assumptions are listed in notes and visible as formulas.
 */
export type PilotEntry={tab:string;row:number;values:(number|string|null)[];display:string[];formulas:Record<string,string>;calculated?:boolean;notes?:string[]};
export type PilotProduct={sku:string;name:string;models:Record<string,PilotEntry>};
export type PilotModel="ozon-fbs"|"ym-fbs";
const OZON_VOLUME_THRESHOLDS=[0,0.1,0.2,0.4,0.6,0.8,1,1.25,1.5,1.75,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,20,25,30,35,40,45,50,60,70,80];
const OZON_SHIPPING_HIGH=[66.5,66.5,66.5,77.01,84.59,85,86.94,96,103.57,103.57,103.57,107.73,129.24,155.83,156.03,177,180.86,186.59,188.74,196.88,196.88,199.04,211.78,228.38,249.32,275.8,320.91,373.38,425.22,481.64,534.95,591.81,647.74,757.2,868.91];
const OZON_SHIPPING_LOW=[17.28,17.28,17.28,19.32,21.35,22.37,23.38,25.42,26.43,27.45,29.48,31.52,35.58,38.63,42.7,57.95,62.02,65.07,69.13,79.3,83.37,87.43,92.52,96.58,101.67,110.82,118.95,131.15,146.4,156.57,175.88,189.1,207.4,230.78,249.08];
function ozonShipping(volume:number,price:number){let i=0;for(let j=0;j<OZON_VOLUME_THRESHOLDS.length;j++){if(OZON_VOLUME_THRESHOLDS[j]<=volume)i=j;else break}return(price>300?OZON_SHIPPING_HIGH:OZON_SHIPPING_LOW)[i]}
const OZON_RATES:Record<string,[number,number,number]>={
 "Смеситель":[.17,.23,.51],
 "Ножницы кухонные":[.17,.23,.52],
 "Ватные палочки":[.17,.23,.52],
 "Ланч-бокс с подогревом":[.17,.23,.51],
 "Капсулы для стирки":[.17,.23,.48]
};
const YM_FBS_RATES:Record<string,number>={
 "Смесители":.485,
 "Ножницы кухонные":.495,
 "Ватные палочки":.47,
 "Ланч-боксы":.49,
 "Капсулы и таблетки для стирки":.465
};
const pct=(v:number)=>new Intl.NumberFormat("ru-RU",{style:"percent",minimumFractionDigits:1,maximumFractionDigits:2}).format(v);
const rub=(v:number)=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:2}).format(v)+" ₽";
const num=(entry:PilotEntry,i:number)=>{const v=entry.values[i];return typeof v==="number"?v:Number(String(v??0).replace(",","."))||0};
const rate=(v:string|number|null|undefined)=>typeof v==="number"?v:Number(String(v??"0").replace("%","").replace(",","."))/100||0;
function empty(tab:string):PilotEntry{return {tab,row:0,values:[],display:[],formulas:{},calculated:true,notes:[]};}
function set(e:PilotEntry,i:number,v:number|string,explain?:string,percent=false){
 e.values[i]=v;
 e.display[i]=typeof v==="number"?(percent?pct(v):rub(v)):v;
 if(explain)e.formulas[String(i)]=explain;
}
function vatPart(gross:number,share=1){return gross*(.22/1.22)*share;}
function discount(price:number){return price<=100?0.18:price<=300?0.25:price<=1000?0.42:0.46;}
export function calculatePilotFbs(product:PilotProduct,model:PilotModel,priceOverride?:number):PilotEntry{
 const oz=model==="ozon-fbs";
 const origin=product.models[oz?"ozon-fbo":"ym-fby"];
 if(!origin)throw new Error("Нет исходных данных для расчёта FBS: "+product.sku);
 const result=empty((oz?"Ozon FBS":"ЯМ ЮНИТКА FBS")+" · расчет пилота");
 result.notes=[
 "Прогноз нового движка, не существующая строка Google Таблицы",
 "Цена, себестоимость, товарная категория, литраж и доступные нормативы взяты из FBO/FBY того же артикула",
 "Комиссия FBS проверена по тарифному справочнику исходной книги; дата тарифов 02.11.2026",
 "НДС по ОСНО, стандартная ставка 22%; вычеты по правилам листа «НДС настройки»",
 "Параметры, не определённые по отдельной FBS отгрузке, взяты из FBS-шаблона и явно указаны в формулах"
 ];
 const g=(i:number)=>num(origin,i);
 const gross=g(11),price=priceOverride??g(13),litres=g(9),volume=Math.max(0,litres);
 const vatRate=rate(origin.values[oz?37:27])||.22;
 const purchaseVat=origin.values[oz?41:31]!==""?Math.max(0,g(oz?41:31)):vatPart(gross);
 const costNet=Math.max(0,gross-purchaseVat);
 const ctype=String(origin.values[4]||"");
 if(!Number.isFinite(gross)||gross<=0||!Number.isFinite(price)||price<=0||volume<=0)throw Error("Нет обязательных входных данных: "+product.sku);
 const vatOf=(x:number)=>vatPart(x);
 const outputVat=price*vatRate/(1+vatRate);
 if(oz){
  const rates=OZON_RATES[ctype];if(!rates)throw Error("Не найдена FBS комиссия Ozon для "+ctype);
  const commissionRate=price<=100?rates[0]:price<=300?rates[1]:rates[2];
  const commission=price*commissionRate,acquiring=price*.015,buyout=g(23);
  if(buyout<=0||buyout>1)throw Error("Некорректный процент выкупа "+product.sku);
  const shipping=ozonShipping(volume,price);
  const reverse=(shipping+15.25)*(1-buyout);
  const shippingNet=(buyout*shipping+(shipping+reverse)*(1-buyout))/buyout;
  const receiving=g(24),lastMile=Math.min(price*.015,25),mayak=g(26);
  const orderHandling=0,fuelAndPacking=0,handling=Math.min(60,5+Math.max(0,Math.ceil(volume)-1)),palletBox=g(28),unitsInBox=g(29),boxesOnPallet=g(30),unitPallet=unitsInBox*boxesOnPallet;
  const supplies=0,defect=gross*.025,drr=rate(origin.values[35])||.10,ads=price*drr;
  const vatPurch=purchaseVat,vatCom=vatOf(commission),vatLog=vatOf(shippingNet),vatAds=vatOf(ads),vatReceive=vatOf(receiving),vatLast=vatOf(lastMile),vatHandle=vatOf(orderHandling);
  const allInput=vatPurch+vatCom+vatLog+vatAds+vatReceive+vatLast+vatHandle;
  const vatDue=outputVat-allInput;
  const expenses=commission+acquiring+shippingNet+receiving+lastMile+orderHandling+fuelAndPacking+mayak+handling+supplies+defect+ads;
  const profit=price-gross-expenses-vatDue,margin=price-outputVat>0?profit/(price-outputVat):0,roi=costNet>0?profit/costNet:0;
  set(result,0,product.name);set(result,1,ctype);set(result,2,String(origin.values[5]||""));
  for(let k=0;k<3;k++)set(result,3+k,g(6+k),"Исходные габариты из Ozon FBO "+origin.row);
  set(result,6,volume,"Объём по исходной записи Ozon FBO");
  set(result,7,Math.ceil(volume),"Округление литров вверх");
  set(result,8,gross,"Себестоимость с НДС из исходного Ozon FBO");
  set(result,9,costNet,"Себестоимость с НДС − входящий НДС закупки");
  set(result,10,price,"Цена из исходной Ozon FBO");
  set(result,11,discount(price),"СПП по ценовому диапазону Ozon",true);
  set(result,12,price*(1-discount(price)),"Цена продажи × (1 − СПП)");
  set(result,13,commissionRate,"Комиссия по категории "+ctype+" из «Ozon Комиссия новые»",true);
  set(result,14,commission,"Цена × ставка комиссии");
  set(result,15,acquiring,"Цена × 1,5%");
  set(result,16,volume===0?0:5,"Базовый тариф за 1 л из FBS-шаблона");
  set(result,17,shipping,"VLOOKUP(объём; Ozon Тарифы перевозки!A3:B37 или D3:E37; 2; 1), выбор диапазона по цене 300 ₽");
  set(result,18,reverse,"(Прямая логистика + 15,25) × (1 − доля выкупов)");
  set(result,19,shippingNet,"(Доля выкупов × доставка + (доставка + возврат) × доля невыкупа) / доля выкупов");
  set(result,20,buyout,"Доля выкупов по исходному товару Ozon",true);
  set(result,21,receiving,"Тариф приёмки по литражу из исходного Ozon FBO");
  set(result,22,lastMile,"min(1,5% × цена; 25 ₽)");
  set(result,23,orderHandling,"Норматив FBS-шаблона: ручная обработка отправления 0 ₽");
  set(result,24,fuelAndPacking,"Норматив FBS-шаблона: доставка до точки отгрузки и упаковка 0 ₽");
  set(result,25,mayak,"ТК Маяк из исходного товара Ozon FBO, временный норматив");
  set(result,26,handling,"min(60; 5 + max(0; ceil(литры) − 1))");
  set(result,27,palletBox,"Объём транспортировочной коробки из Ozon FBO");
  set(result,28,unitsInBox,"Вложимость товара из Ozon FBO");
  set(result,29,boxesOnPallet,"Коробок на паллете из Ozon FBO");
  set(result,30,unitPallet,"Коробок на паллете × вложимость");
  set(result,31,supplies,"Стикеровка/коробка: FBS-шаблон 0 ₽ (можно уточнить вручную позднее)");
  set(result,32,defect,"Себестоимость с НДС × 2,5%");
  set(result,33,drr,"ДРР из исходного товара",true);
  set(result,34,ads,"Цена × ДРР");
  set(result,35,vatRate,"Ставка НДС продажи",true);
  set(result,36,vatDue,"Исходящий НДС − входящие вычеты");
  set(result,37,outputVat,"Цена × ставка НДС / (1 + ставка)");
  set(result,38,allInput,"Сумма подтверждаемых прогнозных вычетов");
  [vatPurch,vatCom,0,vatLog,vatAds,0,vatReceive].forEach((v,i)=>set(result,39+i,v,["НДС закупки по исходному товару","НДС комиссии","Эквайринг: доля вычета 0%","НДС логистики","НДС рекламы","Доставка на МП: доля вычета 0%","НДС приёмки"][i]));
  set(result,45,profit,"Цена − себестоимость − все расходы − (исходящий НДС − входящий)");
  set(result,46,margin,"Чистая прибыль / (цена − исходящий НДС)",true);
  set(result,47,roi,"Чистая прибыль / себестоимость без НДС",true);
 for(const i of [3,4,5,6,7,27,28,29,30])result.display[i]=String(Math.round(Number(result.values[i])*1000)/1000);
 result.display[20]=pct(buyout);
  result.notes.push("Ozon FBS: показатели доставки, приёмки и ТК Маяк перенесены из FBO как временные нормативы");
 }else{
  const commissionBase=YM_FBS_RATES[ctype];if(commissionBase===undefined)throw Error("Не найдена FBS комиссия Яндекс для "+ctype);
  const special=price<=300&&volume>0&&volume<=5;
  const commissionRate=special?0.42:commissionBase,commission=price*commissionRate;
  const acquiring=price*.016,processing=25,base=92;
  const volRound=Math.ceil(volume),middle=special?0:Math.min(5500,base+8*Math.max(0,Math.min(volRound,200)-1)+5*Math.max(0,volRound-200));
  const last=special?0:Math.min(1000,price*.05),mayak=g(22);
  const orderFee=.12,defect=costNet*.01,drr=rate(origin.values[25])||.10,ads=price*drr;
  const vatPurch=purchaseVat,vatCom=vatOf(commission),vatProcess=vatOf(processing),vatOrder=vatOf(orderFee),vatMiddle=vatOf(middle),vatLast=vatOf(last),vatAds=vatOf(ads);
  const incoming=vatPurch+vatCom+vatProcess+vatOrder+vatMiddle+vatLast+vatAds;
  const vatDue=outputVat-incoming;
  const profit=price-gross-(commission+acquiring+processing+middle+last+mayak+orderFee+defect+ads)-vatDue;
  const margin=price-outputVat>0?profit/(price-outputVat):0;
  const invest=gross+processing+mayak,roi=invest>0?profit/invest:0;
  set(result,0,product.name);set(result,1,product.sku);set(result,2,ctype);set(result,3,String(origin.values[5]||""));
  set(result,4,"");set(result,5,"Пилот");
  for(let k=0;k<3;k++)set(result,6+k,g(6+k),"Габариты Яндекс FBY исходной строки");
  set(result,9,volume,"Литраж из исходного Яндекс FBY");
  set(result,10,Math.max(0,volRound-1),"Округлённый литраж − 1");
  set(result,11,gross,"Себестоимость исходного Яндекс FBY");
  set(result,12,costNet,"Себестоимость за вычетом входящего НДС закупки");
  set(result,13,price,"Цена продажи из исходного Яндекс FBY");
  set(result,14,"","Цена акции не указана");
  set(result,15,commissionRate,"Тариф Яндекс FBS по категории "+ctype+(special?"; спецусловие цены ≤300 ₽ и объёма ≤5 л":""));
  result.display[15]=pct(commissionRate);
  set(result,16,commission,"Цена × комиссия Яндекс FBS");
  set(result,17,acquiring,"Цена × 1,6%");
  set(result,18,processing,"Норматив FBS: обработка заказа ПВЗ 25 ₽");
  set(result,19,base,"Яндекс FBS базовый тариф 92 ₽");
  set(result,20,middle,"min(5 500; 92 + 8 × (литры до 200 − 1) + 5 × литры сверх 200); при спецусловии 0");
  set(result,21,last,"min(1 000; 5% × цена); при спецусловии 0");
  set(result,22,mayak,"ТК Маяк по текущему товару Яндекс FBY, временный норматив для FBS");
  set(result,23,orderFee,"Норматив FBS: приём заказа 0,12 ₽");
  set(result,24,0,"Цена акции не задана");
  set(result,25,0,"Акционный сценарий не задан");
  set(result,26,processing,"Обработка заказа ПВЗ");
  set(result,27,base,"Базовый тариф для акции");
  set(result,28,middle,"Средняя миля для базовой цены");
  set(result,29,last,"Последняя миля для базовой цены");
  set(result,30,mayak,"ТК Маяк");
  set(result,31,orderFee,"Приём заказа от покупателя");
  set(result,32,defect,"Себестоимость без НДС × 1%");
  set(result,33,drr,"ДРР по исходному Яндекс FBY",true);
  set(result,34,ads,"Цена продажи × ДРР");
  set(result,35,vatRate,"Ставка НДС продажи",true);
  set(result,36,vatDue,"Исходящий НДС − входящие вычеты");
  set(result,37,outputVat,"Цена продажи × НДС/(1 + НДС)");
  set(result,38,incoming,"Сумма прогнозных входящих вычетов");
  set(result,39,vatPurch,"Входящий НДС закупки из исходного товара");
  set(result,40,0,"Эквайринг: доля вычета 0 по «НДС настройки»");
  set(result,41,vatLast,"НДС последней мили");
  set(result,42,vatAds,"НДС рекламы");
  set(result,43,vatMiddle,"НДС средней мили");
  set(result,44,profit,"Цена − себестоимость − комиссия − эквайринг − обработка − средняя/последняя миля − Маяк − приём − брак − реклама − НДС к уплате");
  set(result,45,margin,"Чистая прибыль / (цена − исходящий НДС)",true);
  set(result,46,roi,"Чистая прибыль / (себестоимость с НДС + обработка ПВЗ + ТК Маяк)",true);
 for(const i of [6,7,8,9,10])result.display[i]=String(Math.round(Number(result.values[i])*1000)/1000);
  result.notes.push("Яндекс FBS: комиссия отдельная, 25 ₽ за обработку ПВЗ, средняя/последняя миля по тарифу FBS");
 }
 return result;
}


/** Cheapest price in kopecks that reaches 15.001% ROI.
 * Scan each commission bracket independently because tariff jumps destroy global monotonicity. */
export function pilotFbsMinPrice(product:PilotProduct,model:PilotModel,target=.15001):number|null{
 const brackets=[[1,10000],[10001,30000],[30001,100000],[100001,100000000]];
 const roiAt=(kopecks:number)=>{const e=calculatePilotFbs(product,model,kopecks/100);return Number(e.values[model==="ozon-fbs"?47:46]);};
 for(const [low,high] of brackets){
  if(roiAt(high)<target)continue;
  let left=low,right=high;
  while(left<right){
   const mid=Math.floor((left+right)/2);
   if(roiAt(mid)>=target)right=mid;
   else left=mid+1;
  }
  if(roiAt(left)>=target)return left/100;
 }
 return null;
}
