/** The by-day Seller endpoint puts service type_id inside nested fee
 * objects, not on the accrual. Only classify a parent accrual when ALL of its
 * components have the same type; mixed postings stay unclassified so their
 * full sales amount can never be mislabeled as a logistics fee. */
type Fee={type_id?:string|number|null};
type Item={fees?:Fee[]|null};
type RecordRow={
 type_id?:string|number|null;
 accrued_category?:string|null;
 non_item_fee?:Fee|null;
 item_fees?:{fees?:Item[]|null}|null;
};
export function accrualTypeId(row:RecordRow):string|null{
 if(row.type_id!==undefined&&row.type_id!==null&&String(row.type_id).trim()!=='')
  return String(row.type_id);
 const category=row.accrued_category;
 const fees:Fee[]=category==='NON_ITEM'
  ?(row.non_item_fee?[row.non_item_fee]:[])
  :category==='ITEM'?(row.item_fees?.fees??[]).flatMap(item=>item.fees??[]):[];
 if(!fees.length)return null;
 const types=new Set(fees.map(f=>f.type_id==null?'':String(f.type_id).trim()));
 return types.size===1&&!types.has('')?[...types][0]:null;
}
