export const WORKBOOK_ID = "1_fiAA9789kfHsn2FO5x7MUS07TiBaJJ1thgFbU1qf-E";
export const WORKBOOK_URL = "https://docs.google.com/spreadsheets/d/" + WORKBOOK_ID + "/edit";
export const MODEL_KEYS = ["ozon-fbo","ozon-fbs","wb-fbw","wb-fbs","ym-fby","ym-fbs"] as const;
export type ModelKey = typeof MODEL_KEYS[number];
export type Marketplace = "ozon" | "wb" | "ym";
export const MARKET_NAMES: Record<Marketplace,string> = {ozon:"Ozon",wb:"Wildberries",ym:"Яндекс Маркет"};
export const MODELS: Record<ModelKey,{label:string;market:Marketplace;tab:string;last:string;end:number}> = {
 "ozon-fbo":{label:"FBO",market:"ozon",tab:"Ozon Юнитка",last:"AX",end:2232},
 "ozon-fbs":{label:"FBS",market:"ozon",tab:"Ozon FBS",last:"BB",end:1163},
 "wb-fbw":{label:"FBW",market:"wb",tab:"WB Юнитка",last:"AS",end:1558},
 "wb-fbs":{label:"FBS",market:"wb",tab:"WB FBS",last:"AU",end:1558},
 "ym-fby":{label:"FBY",market:"ym",tab:"ЯМ Юнитка после 01.09.2026",last:"AW",end:1265},
 "ym-fbs":{label:"FBS",market:"ym",tab:"ЯМ ЮНИТКА FBS",last:"AW",end:1000}
};
export type SheetRow={r:number;v:string[]};
export type SheetData={tab:string;headers:string[];constants:string[];rows:SheetRow[];endRow:number};
