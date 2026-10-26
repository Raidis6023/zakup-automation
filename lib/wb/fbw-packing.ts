/**
 * FBW cargo planning using the Ozon row/layer packing principle.
 * All dimensions in millimetres. Height INCLUDES 145-mm EUR pallet.
 * This is a packing estimate, NOT confirmation from the WB warehouse.
 */
export type PackingSku = {
  sku:string; barcode:string; boxes:number; unitsPerBox:number;
  cartonLengthMm:number|null; cartonWidthMm:number|null;
  cartonHeightMm:number|null; cartonWeightKg:number|null;cartonVolumeM3:number|null;
};
type Carton={sku:string;barcode:string;dimensions:[number,number,number];weightKg:number|null;w:number;d:number;h:number};
type Row={usedWidth:number;depth:number};
type Layer={height:number;usedDepth:number;rows:Row[]};
export type Pallet={
  index:number;cartons:number;skuCount:number;
  heightCm:number;cargoWeightKg:number|null;
  // Pallet tare is not available in products table. Do not fake gross weight.
  totalWeightKg:null;volumeM3:number;contents:Array<{sku:string;boxes:number}>;
  validHeight:boolean;
};
export type PackingResult={
  totalCartons:number;knownCartons:number;missingDimensions:number;missingWeight:number;missingVolume:number;
  volumeM3:number|null;cargoWeightKg:number|null;
  // Gross shipment weight is unknown until pallet tare weights are entered.
  grossWeightKg:null;
  pallets:Pallet[];maxHeightCm:number|null;warnings:string[];
  canUseMono:boolean;
};
const PALLET_WIDTH=1200;
const PALLET_DEPTH=800;
const PALLET_TARE_HEIGHT=145;
const MONO_MAX_TOTAL=1800;
const MONO_MIN_TOTAL=500;
const BOX_MAX_TOTAL=2200; // Ozon physical-planning constraint.
const EPS=1e-8;
const valid=(x:number|null)=>x!==null&&Number.isFinite(x)&&x>0;
const round=(v:number,p=3)=>Number(v.toFixed(p));
function orient(dims:[number,number,number],limit:number){
  const smallest=Math.min(...dims),largest=Math.max(...dims);
  // Match the Ozon cargo rule: a box whose longest side is >= 2x
  // its shortest is placed with the shortest dimension vertically.
  const heightIndices=largest>=smallest*2
    ?[0,1,2].filter(i=>dims[i]===smallest):[0,1,2];
  const options:Array<{w:number;d:number;h:number;capacity:number}>=[];
  for(const index of heightIndices){
    const h=dims[index];if(h+PALLET_TARE_HEIGHT>limit)continue;
    const base=dims.filter((_,i)=>i!==index);
    for(const [w,d] of [[base[0],base[1]],[base[1],base[0]]]){
      if(w>PALLET_WIDTH||d>PALLET_DEPTH)continue;
      const capacity=Math.floor(PALLET_WIDTH/w)*Math.floor(PALLET_DEPTH/d)*
        Math.floor((limit-PALLET_TARE_HEIGHT)/h);
      if(capacity>0)options.push({w,d,h,capacity});
    }
  }
  options.sort((x,y)=>y.capacity-x.capacity||x.h-y.h);
  return options[0]??null;
}
function fit(layer:Layer,box:Carton):boolean{
  for(const [w,d] of [[box.w,box.d],[box.d,box.w]]){
    if(w>PALLET_WIDTH||d>PALLET_DEPTH)continue;
    for(const row of layer.rows){
      if(d<=row.depth&&row.usedWidth+w<=PALLET_WIDTH){row.usedWidth+=w;return true;}
    }
    if(layer.usedDepth+d<=PALLET_DEPTH){
      layer.rows.push({usedWidth:w,depth:d});layer.usedDepth+=d;return true;
    }
  }
  return false;
}
export function estimateFbwPacking(items:PackingSku[],type:"box"|"mono"):PackingResult {
  const warnings:string[]=[];
  let totalCartons=0,missingDimensions=0,missingWeight=0,missingVolume=0,volume=0,weight=0;
  const boxes:Carton[]=[];
  for(const item of items){
    if(!Number.isSafeInteger(item.boxes)||item.boxes<0){
      throw new Error("Некорректное количество коробов");
    }
    totalCartons+=item.boxes;
    if(totalCartons>12000)throw new Error("Более 12000 коробов: разбейте поставку для расчёта");
    const dims:[number|null,number|null,number|null]=[
      item.cartonLengthMm,item.cartonWidthMm,item.cartonHeightMm
    ];
    if(!valid(item.cartonWeightKg))missingWeight+=item.boxes;
    else weight+=item.boxes*item.cartonWeightKg!;
    const dimKnown=dims.every(valid);
    if(valid(item.cartonVolumeM3))volume+=item.boxes*item.cartonVolumeM3!;
    else if(dimKnown){
      const [l,w,h]=dims as [number,number,number];
      volume+=item.boxes*l*w*h/1e9;
    }else missingVolume+=item.boxes;
    if(!dimKnown){missingDimensions+=item.boxes;continue;}
    const [l,w,h]=dims as [number,number,number];
    for(let i=0;i<item.boxes;i++){
      // Dimensions describe a full transport carton, never individual units.
      boxes.push({sku:item.sku,barcode:item.barcode,dimensions:[l,w,h],
        weightKg:valid(item.cartonWeightKg)?item.cartonWeightKg:null,w:0,d:0,h:0});
    }
  }
  const maxHeight=type==="mono"?MONO_MAX_TOTAL:BOX_MAX_TOTAL;
  const usable:Carton[]=[];
  const unplaced:Carton[]=[];
  for(const box of boxes){
    const o=orient(box.dimensions,maxHeight);
    if(!o){unplaced.push(box);continue;}
    box.w=o.w;box.d=o.d;box.h=o.h;usable.push(box);
  }
  usable.sort((a,b)=>b.h-a.h||b.w*b.d-a.w*a.d);
  const pallets:Array<{height:number;layers:Layer[];cartons:Carton[];barcodes:Set<string>}>=[];
  for(const box of usable){
    let done=false;
    for(const pallet of pallets){
      if(type==="mono"&&!pallet.barcodes.has(box.barcode)&&pallet.barcodes.size>=3)continue;
      for(const layer of pallet.layers){
        if(box.h<=layer.height&&fit(layer,box)){
          pallet.cartons.push(box);pallet.barcodes.add(box.barcode);done=true;break;
        }
      }
      if(done)break;
      if(pallet.height+box.h+PALLET_TARE_HEIGHT>maxHeight)continue;
      const layer:Layer={height:box.h,usedDepth:0,rows:[]};
      if(fit(layer,box)){
        pallet.layers.push(layer);pallet.height+=box.h;
        pallet.cartons.push(box);pallet.barcodes.add(box.barcode);done=true;break;
      }
    }
    if(!done){
      const layer:Layer={height:box.h,usedDepth:0,rows:[]};
      if(!fit(layer,box)){unplaced.push(box);continue;}
      pallets.push({height:box.h,layers:[layer],cartons:[box],barcodes:new Set([box.barcode])});
    }
  }
  const result:Pallet[]=pallets.map((p,index)=>{
    const map=new Map<string,number>();
    for(const box of p.cartons)map.set(box.sku,(map.get(box.sku)??0)+1);
    return {
      index:index+1,cartons:p.cartons.length,skuCount:p.barcodes.size,
      heightCm:round((p.height+PALLET_TARE_HEIGHT)/10,1),
      cargoWeightKg:p.cartons.every(x=>x.weightKg!==null)
        ?round(p.cartons.reduce((a,b)=>a+(b.weightKg??0),0),2):null,
      totalWeightKg:null,
      volumeM3:round(p.cartons.reduce((a,b)=>a+b.dimensions[0]*b.dimensions[1]*b.dimensions[2]/1e9,0),4),
      contents:[...map].map(([sku,count])=>({sku,boxes:count})),
      validHeight:p.height+PALLET_TARE_HEIGHT<=maxHeight+EPS&&
        (type!=="mono"||p.height+PALLET_TARE_HEIGHT>=MONO_MIN_TOTAL-EPS)
    };
  });
  if(missingDimensions)warnings.push("У "+missingDimensions+" коробов нет полных габаритов: объём, высота и размещение неполные.");
  if(missingWeight)warnings.push("У "+missingWeight+" коробов отсутствует вес: общий вес груза неизвестен.");
  if(missingVolume)warnings.push("У "+missingVolume+" коробов не указан объём: общий объём неизвестен.");
  if(unplaced.length)warnings.push(unplaced.length+" коробов не помещаются на европаллету при заданной высоте.");
  if(type==="mono"&&result.some(x=>!x.validHeight)){
    warnings.push("Монопаллета должна иметь высоту от 50 до 180 см ВКЛЮЧАЯ поддон 14,5 см. Некоторые паллеты ниже минимума.");
  }
  if(type==="mono"&&new Set(items.filter(x=>x.boxes>0).map(x=>x.barcode)).size>3)
    warnings.push("Монопаллета: не более 3 различных баркодов в поставке по выбранному правилу.");
  if(totalCartons&&result.length===0)warnings.push("Невозможно оценить число паллет без габаритов.");
  return {
    totalCartons,knownCartons:boxes.length-unplaced.length,
    missingDimensions:missingDimensions+unplaced.length,
    missingWeight,missingVolume,volumeM3:missingVolume?null:round(volume,4),
    cargoWeightKg:missingWeight?null:round(weight,2),
    grossWeightKg:null,pallets:result,
    maxHeightCm:missingDimensions||unplaced.length||!result.length?null:Math.max(...result.map(x=>x.heightCm)),
    warnings,canUseMono:type==="mono"&&missingDimensions===0&&unplaced.length===0&&
      result.length>0&&result.every(x=>x.validHeight&&x.skuCount<=3)
      &&new Set(items.filter(x=>x.boxes>0).map(x=>x.barcode)).size<=3,
  };
}
