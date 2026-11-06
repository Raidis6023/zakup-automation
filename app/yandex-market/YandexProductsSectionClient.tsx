"use client";

import { useWorkspaceDisclosure } from "../ui/useWorkspaceDisclosure";
import type {YandexProductsTableItem} from "./YandexProductsTableClient";
import type {ProductExportRow} from "@/lib/marketplace-products-excel";

import {
  useEffect,
  useState,
  type ReactNode,
} from "react";




// ============================================================
// ICON
// ============================================================

function ProductsTableIcon() {

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
    >

      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2"
      />


      <path
        d="M3 9h18"
      />


      <path
        d="M3 14h18"
      />


      <path
        d="M9 4v16"
      />


      <path
        d="M15 4v16"
      />

    </svg>
  );

}


// ============================================================
// COMPONENT
// ============================================================

export default function YandexProductsSectionClient({
  children,
  items,
  periodDays,
}: {
  children:ReactNode;
  items:YandexProductsTableItem[];
  periodDays:number;
}) {

  const { expanded, toggle: toggleExpanded } = useWorkspaceDisclosure();
  const [excelBusy,setExcelBusy]=useState(false);
  const [excelError,setExcelError]=useState<string|null>(null);


  const [
    storageLoaded,
    setStorageLoaded,
  ] =
    useState(
      false
    );


  // ==========================================================
  // RESTORE STATE
  // ==========================================================

  // The section is collapsed at page entry; a focused product can be
  // revealed by opening the table explicitly.
  useEffect(() => {
    setStorageLoaded(true);
  }, []);

  // ==========================================================
  // TOGGLE
  // ==========================================================



  async function exportExcel(){
    if(excelBusy)return;
    setExcelBusy(true);
    setExcelError(null);
    try{
      const data:ProductExportRow[]=[...items].sort((a,b)=>b.sales-a.sales).map(item=>{
        const avg=periodDays>0?item.sales/periodDays:0;
        return{
          masterCode:item.master_code,sku:item.market_sku,article:item.offer_id,
          name:item.name,sales:item.sales,average:avg,
          cancellations:item.cancellations,stock:item.stock,
          stockDays:avg>0?item.stock/avg:null,
          details:item.warehouses.map(w=>{
            const wavg=periodDays>0?w.sales/periodDays:0;
            return{
              warehouse:w.warehouseName,sales:w.sales,
              average:wavg,cancellations:w.cancellations,stock:w.stock,
              stockDays:wavg>0?w.stock/wavg:null,
            };
          })
        };
      });
      const {downloadProductsExcel}=await import("@/lib/marketplace-products-excel");
      await downloadProductsExcel("yandex",data,periodDays);
    }catch(error){
      setExcelError(error instanceof Error?error.message:"Не удалось выгрузить Excel");
    }finally{setExcelBusy(false)}
  }

  return (
    <section
      className=
        "section ym-products-section ym-products-collapsible"
    >

      <div className="mp-products-header">
      <button
        type="button"

        className=
          "ym-products-toggle"

        onClick={
          toggleExpanded
        }

        aria-expanded={
          expanded
        }

        aria-controls=
          "yandex-products-table"
      >

        <span
          className=
            "ym-products-section-icon"
        >
          <ProductsTableIcon />
        </span>


        <span
          className=
            "ym-products-toggle-copy"
        >

          <strong
            className=
              "ym-products-toggle-title"
          >
            Данные по товарам
          </strong>


          <span
            className=
              "muted ym-products-toggle-subtitle"
          >
            Основная строка показывает общие показатели
            артикула. При раскрытии — показатели
            по конкретным складам.
          </span>

        </span>

      </button>
      <button type="button" className="mp-products-export-button" onClick={exportExcel}
        disabled={excelBusy||items.length===0} aria-label="Выгрузить данные Яндекс Маркета по товарам в Excel">
        {excelBusy?"Создаём Excel…":"Выгрузить Excel"}
      </button>
      </div>
      {excelError&&<div role="alert" className="mp-products-export-error">{excelError}</div>}

      {
        storageLoaded
        &&
        expanded

          ? (
            <div
              id=
                "yandex-products-table"

              className=
                "ym-products-table-content"
            >
              {children}
            </div>
          )

          : null
      }

    </section>
  );

}
