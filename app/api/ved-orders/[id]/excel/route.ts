import {
  NextRequest,
  NextResponse,
} from "next/server";

import ExcelJS from "exceljs";
import sharp from "sharp";


export const runtime = "nodejs";


// ============================================================
// TYPES
// ============================================================

type VedOrder = {
  id: string;
  order_number: string | null;
  status: string;
  workflow_status: string;
  calculation_scenario: string | null;
  transport_mode: string | null;
  transport_variant: string | null;
  preparation_responsible_name: string | null;
  ved_responsible_name: string | null;
  created_at: string;
  first_sent_to_ved_at: string | null;
  production_handoff_date: string | null;
  expected_arrival_date: string | null;
};


type VedOrderItem = {
  id: string;
  product_id: string | null;
  position_sort: number | null;
  status: string;
  moq_review_status: string | null;
  chinese_article_snapshot: string | null;
  our_article_snapshot: string | null;
  product_name_snapshot: string | null;
  photo_url: string | null;
  incoterm: string | null;
  port: string | null;
  order_quantity: number;
  cartons: number | null;
  unit_price_cny: number | null;
  total_price_cny: number | null;
  units_per_carton_snapshot: number | null;
  carton_volume_m3_snapshot: number | null;
  carton_weight_kg_snapshot: number | null;
  total_volume_m3: number | null;
  total_weight_tons: number | null;
  moq_quantity: number | null;
  analytics_comment: string | null;
  ved_comment: string | null;
};


type HandoffReadiness = {
  ok?: boolean;
  ready?: boolean;
};


// ============================================================
// SUPABASE
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {
    throw new Error(
      "Vercel не видит NEXT_PUBLIC_SUPABASE_URL"
    );
  }


  if (!supabaseSecretKey) {
    throw new Error(
      "Vercel не видит SUPABASE_SECRET_KEY"
    );
  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


function getSupabaseHeaders(
  secretKey: string
) {

  return {
    apikey:
      secretKey,

    Authorization:
      `Bearer ${secretKey}`,

    Accept:
      "application/json",

    "Content-Type":
      "application/json",
  };

}


// ============================================================
// HELPERS
// ============================================================

function formatDateRu(
  value:
    string
    | null
    | undefined
) {

  if (!value) {
    return "—";
  }


  const parts =
    value
      .substring(
        0,
        10
      )
      .split("-");


  if (
    parts.length !== 3
  ) {
    return value;
  }


  return (
    `${parts[2]}.` +
    `${parts[1]}.` +
    `${parts[0]}`
  );

}


function getWorkflowStatusLabel(
  status: string
) {

  const labels:
    Record<string, string> = {

      draft:
        "Черновик",

      sent_to_ved:
        "Передан в ВЭД",

      ved_in_work:
        "В работе ВЭД",

      returned_for_edit:
        "Возвращён на доработку",

      production_confirmed:
        "Передан в производство",

      in_transit:
        "В пути",

      arrived:
        "Прибыл",

      rejected:
        "Отклонён",

      cancelled:
        "Отменён",

    };


  return (
    labels[status]
    ??
    status
  );

}


function getTransportLabel(
  order: VedOrder
) {

  const rawValue =
    order.transport_mode
    ??
    order.calculation_scenario
    ??
    order.transport_variant
    ??
    "";


  const value =
    rawValue.toLowerCase();


  if (
    value.includes(
      "container"
    )
  ) {
    return "Контейнер";
  }


  if (
    value.includes(
      "truck"
    )
  ) {
    return "Фура";
  }


  return (
    rawValue
    ||
    "—"
  );

}


function sanitizeFilename(
  value: string
) {

  return value
    .replace(
      /[\\/:*?"<>|]/g,
      "_"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();

}


function numberOrZero(
  value:
    number
    | string
    | null
    | undefined
) {

  if (
    value === null
    ||
    value === undefined
    ||
    value === ""
  ) {
    return 0;
  }


  const result =
    Number(value);


  if (
    Number.isNaN(
      result
    )
  ) {
    return 0;
  }


  return result;

}


// ============================================================
// SMART NUMBER FORMAT
//
// Целое:
// 7200 -> 7 200
//
// Дробное:
// 7.35 -> 7,35
//
// Максимум два знака после запятой.
// ============================================================

function getNumericValueFromCell(
  value: unknown
):
  number | null {

  if (
    typeof value === "number"
    &&
    Number.isFinite(value)
  ) {
    return value;
  }


  if (
    typeof value === "object"
    &&
    value !== null
    &&
    "result" in value
  ) {

    const result =
      (
        value as {
          result?: unknown;
        }
      ).result;


    if (
      typeof result === "number"
      &&
      Number.isFinite(result)
    ) {
      return result;
    }

  }


  return null;

}


function applySmartNumberFormat(
  cell: ExcelJS.Cell
) {

  const value =
    getNumericValueFromCell(
      cell.value
    );


  if (
    value === null
  ) {
    return;
  }


  if (
    Number.isInteger(value)
  ) {

    cell.numFmt =
      "#,##0";

    return;

  }


  cell.numFmt =
    "#,##0.##";

}


// ============================================================
// EXCEL COLUMN LETTER
// ============================================================

function getExcelColumnLetter(
  columnNumber: number
) {

  let result =
    "";


  let number =
    columnNumber;


  while (
    number > 0
  ) {

    const remainder =
      (
        number - 1
      )
      %
      26;


    result =
      String.fromCharCode(
        65 + remainder
      )
      +
      result;


    number =
      Math.floor(
        (
          number - 1
        )
        /
        26
      );

  }


  return result;

}


// ============================================================
// IMAGE
// ============================================================

async function loadImageAsPng(
  url: string
) {

  try {

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Accept:
              "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          },

          signal:
            AbortSignal.timeout(
              10000
            ),
        }
      );


    if (
      !response.ok
    ) {
      return null;
    }


    const arrayBuffer =
      await response.arrayBuffer();


    if (
      arrayBuffer.byteLength === 0
    ) {
      return null;
    }


    const originalBuffer =
      Buffer.from(
        arrayBuffer
      );


    const pngBuffer =
      await sharp(
        originalBuffer
      )
        .rotate()
        .png()
        .toBuffer();


    const base64 =
      pngBuffer.toString(
        "base64"
      );


    return {
      base64:
        `data:image/png;base64,${base64}`,

      extension:
        "png" as const,
    };

  } catch (
    error
  ) {

    console.error(
      "Не удалось обработать фото для Excel:",
      url,
      error
    );


    return null;

  }

}


// ============================================================
// GET
// ============================================================

export async function GET(

  _request: NextRequest,

  context: {
    params:
      Promise<{
        id: string;
      }>;
  }

) {

  try {

    // ========================================================
    // 1. ORDER ID
    // ========================================================

    const {
      id,
    } =
      await context.params;


    const orderId =
      id?.trim();


    if (!orderId) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Не указан ID заказа",
        },
        {
          status:
            400,
        }
      );

    }


    // ========================================================
    // 2. SUPABASE
    // ========================================================

    const {
      supabaseUrl,
      supabaseSecretKey,
    } =
      getSupabaseConfig();


    const headers =
      getSupabaseHeaders(
        supabaseSecretKey
      );


    // ========================================================
    // 3. ORDER
    // ========================================================

    const orderResponse =
      await fetch(
        `${supabaseUrl}` +
        `/rest/v1/ved_orders` +
        `?id=eq.${encodeURIComponent(
          orderId
        )}` +
        `&select=*`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );


    if (
      !orderResponse.ok
    ) {

      const text =
        await orderResponse.text();


      throw new Error(
        `Не удалось получить заказ. ${text}`
      );

    }


    const orders:
      VedOrder[] =
        await orderResponse.json();


    const order =
      orders[0];


    if (!order) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Заказ не найден",
        },
        {
          status:
            404,
        }
      );

    }


    // ========================================================
    // 4. DRAFT READINESS
    // ========================================================

    if (
      order.workflow_status ===
        "draft"
    ) {

      const readinessResponse =
        await fetch(
          `${supabaseUrl}` +
          `/rest/v1/rpc/get_ved_order_handoff_readiness`,
          {
            method:
              "POST",

            headers,

            body:
              JSON.stringify(
                {
                  p_order_id:
                    orderId,
                }
              ),

            cache:
              "no-store",
          }
        );


      if (
        !readinessResponse.ok
      ) {

        const text =
          await readinessResponse.text();


        throw new Error(
          `Не удалось проверить готовность заказа. ${text}`
        );

      }


      const readiness:
        HandoffReadiness =
          await readinessResponse.json();


      if (
        readiness.ready !== true
      ) {

        return NextResponse.json(
          {
            ok:
              false,

            error:
              "Экспорт Excel станет доступен после заполнения всех обязательных данных заказа",
          },
          {
            status:
              409,
          }
        );

      }

    }


    // ========================================================
    // 5. ITEMS
    // ========================================================

    const itemsResponse =
      await fetch(
        `${supabaseUrl}` +
        `/rest/v1/ved_order_items` +
        `?ved_order_id=eq.${encodeURIComponent(
          orderId
        )}` +
        `&select=*` +
        `&order=position_sort.asc.nullslast`,
        {
          method:
            "GET",

          headers,

          cache:
            "no-store",
        }
      );


    if (
      !itemsResponse.ok
    ) {

      const text =
        await itemsResponse.text();


      throw new Error(
        `Не удалось получить позиции заказа. ${text}`
      );

    }


    const allItems:
      VedOrderItem[] =
        await itemsResponse.json();


    const items =
      allItems.filter(
        (
          item
        ) => {

          if (
            item.status ===
              "rejected"
          ) {
            return false;
          }


          if (
            item.moq_review_status ===
              "rejected"
          ) {
            return false;
          }


          if (
            numberOrZero(
              item.order_quantity
            ) <= 0
          ) {
            return false;
          }


          return true;

        }
      );


    if (
      items.length === 0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "В заказе нет позиций для экспорта",
        },
        {
          status:
            409,
        }
      );

    }


    // ========================================================
    // 6. WORKBOOK
    // ========================================================

    const workbook =
      new ExcelJS.Workbook();


    workbook.creator =
      "WorkSpace";


    workbook.created =
      new Date();


    workbook.calcProperties
      .fullCalcOnLoad =
        true;


    const worksheet =
      workbook.addWorksheet(
        "Заказ"
      );


    worksheet.properties
      .defaultRowHeight =
        22;


    // ========================================================
    // 7. COLUMNS
    // ========================================================

    const firstProductColumn =
      2;


    const lastProductColumn =
      items.length + 1;


    const totalColumn =
      lastProductColumn + 1;


    worksheet.getColumn(
      1
    ).width =
      30;


    for (
      let column =
        firstProductColumn;

      column <=
        lastProductColumn;

      column++
    ) {

      worksheet.getColumn(
        column
      ).width =
        27;

    }


    worksheet.getColumn(
      totalColumn
    ).width =
      18;


    // ========================================================
    // 8. TITLE
    // ========================================================

    worksheet.mergeCells(
      1,
      1,
      1,
      totalColumn
    );


    const titleCell =
      worksheet.getCell(
        1,
        1
      );


    titleCell.value =
      "ЗАКАЗ В КИТАЙ";


    titleCell.font = {
      bold:
        true,

      size:
        16,
    };


    titleCell.alignment = {
      vertical:
        "middle",

      horizontal:
        "left",
    };


    worksheet.getRow(
      1
    ).height =
      28;


    // ========================================================
    // 9. ORDER META
    // ========================================================

    const exportDateSource =
      order.first_sent_to_ved_at
      ??
      order.created_at;


    const orderInfo:
      Array<
        [
          string,
          string
        ]
      > = [

        [
          "Номер заказа",
          order.order_number
          ??
          "Черновик",
        ],

        [
          "Дата заказа",
          formatDateRu(
            exportDateSource
          ),
        ],

        [
          "Статус",
          getWorkflowStatusLabel(
            order.workflow_status
          ),
        ],

        [
          "Транспорт",
          getTransportLabel(
            order
          ),
        ],

        [
          "Ответственный ВЭД",
          order.ved_responsible_name
          ??
          "—",
        ],

      ];


    orderInfo.forEach(
      (
        row,
        index
      ) => {

        const rowNumber =
          index + 2;


        worksheet.getCell(
          rowNumber,
          1
        ).value =
          row[0];


        worksheet.getCell(
          rowNumber,
          2
        ).value =
          row[1];


        worksheet.getCell(
          rowNumber,
          1
        ).font = {
          bold:
            true,
        };

      }
    );


    // ========================================================
    // 10. TABLE HEADER
    // ========================================================

    const tableHeaderRow =
      7;


    worksheet.getCell(
      tableHeaderRow,
      1
    ).value =
      "Показатель";


    items.forEach(
      (
        _item,
        index
      ) => {

        worksheet.getCell(
          tableHeaderRow,
          index + 2
        ).value =
          `Товар ${index + 1}`;

      }
    );


    worksheet.getCell(
      tableHeaderRow,
      totalColumn
    ).value =
      "ИТОГО";


    // ========================================================
    // 11. ROWS
    // ========================================================

    const rows = [

      [
        "chinese_article",
        "Китайский артикул",
      ],

      [
        "our_article",
        "Наш артикул",
      ],

      [
        "name",
        "Наименование",
      ],

      [
        "photo",
        "Фото",
      ],

      [
        "incoterm",
        "Incoterm",
      ],

      [
        "port",
        "Порт",
      ],

      [
        "quantity",
        "Итоговое количество, шт.",
      ],

      [
        "cartons",
        "Коробов",
      ],

      [
        "unit_price",
        "Цена за 1 шт., CNY",
      ],

      [
        "total_price",
        "Сумма, CNY",
      ],

      [
        "units_per_carton",
        "В 1 коробе, шт.",
      ],

      [
        "carton_volume",
        "Объём 1 короба, м³",
      ],

      [
        "carton_weight",
        "Вес 1 короба, кг",
      ],

      [
        "total_volume",
        "Общий объём, м³",
      ],

      [
        "total_weight",
        "Общий вес, т",
      ],

      [
        "moq",
        "MOQ",
      ],

      [
        "analytics_comment",
        "Комментарий аналитики",
      ],

      [
        "ved_comment",
        "Комментарий ВЭД",
      ],

    ] as const;


    const firstDataRow =
      tableHeaderRow + 1;


    const rowByKey =
      new Map<
        string,
        number
      >();


    rows.forEach(
      (
        row,
        index
      ) => {

        const rowNumber =
          firstDataRow +
          index;


        rowByKey.set(
          row[0],
          rowNumber
        );


        const labelCell =
          worksheet.getCell(
            rowNumber,
            1
          );


        labelCell.value =
          row[1];


        labelCell.font = {
          bold:
            true,
        };

      }
    );


    // ========================================================
    // 12. SET VALUE
    // ========================================================

    function setValue(
      column: number,

      key: string,

      value:
        string
        | number
        | null
        | undefined
    ) {

      const row =
        rowByKey.get(
          key
        );


      if (!row) {
        return;
      }


      worksheet.getCell(
        row,
        column
      ).value =
        value
        ??
        "";

    }


    // ========================================================
    // 13. PRODUCT VALUES
    // ========================================================

    items.forEach(
      (
        item,
        index
      ) => {

        const column =
          index + 2;


        setValue(
          column,
          "chinese_article",
          item.chinese_article_snapshot
        );


        setValue(
          column,
          "our_article",
          item.our_article_snapshot
        );


        setValue(
          column,
          "name",
          item.product_name_snapshot
        );


        setValue(
          column,
          "incoterm",
          item.incoterm
        );


        setValue(
          column,
          "port",
          item.port
        );


        setValue(
          column,
          "quantity",
          numberOrZero(
            item.order_quantity
          )
        );


        setValue(
          column,
          "cartons",
          numberOrZero(
            item.cartons
          )
        );


        setValue(
          column,
          "unit_price",
          item.unit_price_cny
        );


        setValue(
          column,
          "total_price",
          item.total_price_cny
        );


        setValue(
          column,
          "units_per_carton",
          item.units_per_carton_snapshot
        );


        setValue(
          column,
          "carton_volume",
          item.carton_volume_m3_snapshot
        );


        setValue(
          column,
          "carton_weight",
          item.carton_weight_kg_snapshot
        );


        setValue(
          column,
          "total_volume",
          item.total_volume_m3
        );


        setValue(
          column,
          "total_weight",
          item.total_weight_tons
        );


        setValue(
          column,
          "moq",
          item.moq_quantity
        );


        setValue(
          column,
          "analytics_comment",
          item.analytics_comment
        );


        setValue(
          column,
          "ved_comment",
          item.ved_comment
        );

      }
    );


    // ========================================================
    // 14. TOTAL FORMULAS
    // ========================================================

    const firstProductLetter =
      getExcelColumnLetter(
        firstProductColumn
      );


    const lastProductLetter =
      getExcelColumnLetter(
        lastProductColumn
      );


    function setSumFormula(
      key: string,

      cachedResult: number
    ) {

      const row =
        rowByKey.get(
          key
        );


      if (!row) {
        return;
      }


      worksheet.getCell(
        row,
        totalColumn
      ).value = {

        formula:
          `SUM(` +
          `${firstProductLetter}${row}:` +
          `${lastProductLetter}${row}` +
          `)`,

        result:
          cachedResult,

      };

    }


    const totalQuantity =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          numberOrZero(
            item.order_quantity
          ),
        0
      );


    const totalCartons =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          numberOrZero(
            item.cartons
          ),
        0
      );


    const totalPrice =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          numberOrZero(
            item.total_price_cny
          ),
        0
      );


    const totalVolume =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          numberOrZero(
            item.total_volume_m3
          ),
        0
      );


    const totalWeight =
      items.reduce(
        (
          sum,
          item
        ) =>
          sum +
          numberOrZero(
            item.total_weight_tons
          ),
        0
      );


    setSumFormula(
      "quantity",
      totalQuantity
    );


    setSumFormula(
      "cartons",
      totalCartons
    );


    setSumFormula(
      "total_price",
      totalPrice
    );


    setSumFormula(
      "total_volume",
      totalVolume
    );


    setSumFormula(
      "total_weight",
      totalWeight
    );


    // ========================================================
    // 15. PHOTOS
    // ========================================================

    const photoRow =
      rowByKey.get(
        "photo"
      );


    if (
      photoRow
    ) {

      worksheet.getRow(
        photoRow
      ).height =
        82;


      await Promise.all(

        items.map(
          async (
            item,
            index
          ) => {

            if (
              !item.photo_url
            ) {
              return;
            }


            const column =
              index + 2;


            const image =
              await loadImageAsPng(
                item.photo_url
              );


            if (
              !image
            ) {

              worksheet.getCell(
                photoRow,
                column
              ).value = {

                text:
                  "Открыть фото",

                hyperlink:
                  item.photo_url,

                tooltip:
                  "Открыть изображение товара",

              };


              return;

            }


            const imageId =
              workbook.addImage(
                {
                  base64:
                    image.base64,

                  extension:
                    image.extension,
                }
              );


            worksheet.addImage(
              imageId,
              {
                tl: {
                  col:
                    column - 1 + 0.15,

                  row:
                    photoRow - 1 + 0.15,
                },

                ext: {
                  width:
                    90,

                  height:
                    90,
                },

                editAs:
                  "oneCell",
              }
            );

          }
        )

      );

    }


    // ========================================================
    // 16. HEIGHTS
    // ========================================================

    const nameRow =
      rowByKey.get(
        "name"
      );


    if (
      nameRow
    ) {

      worksheet.getRow(
        nameRow
      ).height =
        58;

    }


    const analyticsCommentRow =
      rowByKey.get(
        "analytics_comment"
      );


    if (
      analyticsCommentRow
    ) {

      worksheet.getRow(
        analyticsCommentRow
      ).height =
        52;

    }


    const vedCommentRow =
      rowByKey.get(
        "ved_comment"
      );


    if (
      vedCommentRow
    ) {

      worksheet.getRow(
        vedCommentRow
      ).height =
        52;

    }


    // ========================================================
    // 17. HEADER STYLE
    // ========================================================

    const headerRow =
      worksheet.getRow(
        tableHeaderRow
      );


    headerRow.font = {
      bold:
        true,
    };


    headerRow.height =
      30;


    for (
      let column = 1;
      column <= totalColumn;
      column++
    ) {

      const cell =
        worksheet.getCell(
          tableHeaderRow,
          column
        );


      cell.fill = {
        type:
          "pattern",

        pattern:
          "solid",

        fgColor: {
          argb:
            "FFD9EAF7",
        },
      };


      cell.alignment = {
        vertical:
          "middle",

        horizontal:
          "center",

        wrapText:
          true,
      };


      cell.border = {
        top: {
          style:
            "thin",
        },

        left: {
          style:
            "thin",
        },

        bottom: {
          style:
            "thin",
        },

        right: {
          style:
            "thin",
        },
      };

    }


    // ========================================================
    // 18. TABLE STYLE
    // ========================================================

    for (
      let row =
        firstDataRow;

      row <
        firstDataRow +
        rows.length;

      row++
    ) {

      for (
        let column = 1;
        column <= totalColumn;
        column++
      ) {

        const cell =
          worksheet.getCell(
            row,
            column
          );


        cell.alignment = {
          vertical:
            "middle",

          horizontal:
            column === 1
              ? "left"
              : "center",

          wrapText:
            true,
        };


        cell.border = {
          top: {
            style:
              "thin",
          },

          left: {
            style:
              "thin",
          },

          bottom: {
            style:
              "thin",
          },

          right: {
            style:
              "thin",
          },
        };


        if (
          column === 1
        ) {

          cell.fill = {
            type:
              "pattern",

            pattern:
              "solid",

            fgColor: {
              argb:
                "FFF3F4F6",
            },
          };

        }


        if (
          column ===
            totalColumn
        ) {

          cell.font = {
            bold:
              true,
          };


          cell.fill = {
            type:
              "pattern",

            pattern:
              "solid",

            fgColor: {
              argb:
                "FFF8F1D4",
            },
          };

        }

      }

    }


    // ========================================================
    // 19. NUMBER FORMATS
    // ========================================================

    const integerKeys = [
      "quantity",
      "cartons",
      "units_per_carton",
      "moq",
    ];


    integerKeys.forEach(
      (
        key
      ) => {

        const row =
          rowByKey.get(
            key
          );


        if (!row) {
          return;
        }


        for (
          let column = 2;
          column <= totalColumn;
          column++
        ) {

          worksheet.getCell(
            row,
            column
          ).numFmt =
            "#,##0";

        }

      }
    );


    // ========================================================
    // УМНОЕ ФОРМАТИРОВАНИЕ
    //
    // Целое число -> без запятой.
    // Дробное -> максимум 2 цифры.
    // ========================================================

    const smartDecimalKeys = [
      "unit_price",
      "total_price",
      "carton_volume",
      "carton_weight",
      "total_volume",
      "total_weight",
    ];


    smartDecimalKeys.forEach(
      (
        key
      ) => {

        const row =
          rowByKey.get(
            key
          );


        if (!row) {
          return;
        }


        for (
          let column = 2;
          column <= totalColumn;
          column++
        ) {

          applySmartNumberFormat(
            worksheet.getCell(
              row,
              column
            )
          );

        }

      }
    );


    // ========================================================
    // 20. FREEZE
    // ========================================================

    worksheet.views = [
      {
        state:
          "frozen",

        xSplit:
          1,

        ySplit:
          tableHeaderRow,
      },
    ];


    // ========================================================
    // 21. PRINT
    // ========================================================

    worksheet.pageSetup = {
      orientation:
        "landscape",

      fitToPage:
        true,

      fitToWidth:
        1,

      fitToHeight:
        0,

      paperSize:
        9,

      margins: {
        left:
          0.25,

        right:
          0.25,

        top:
          0.4,

        bottom:
          0.4,

        header:
          0.2,

        footer:
          0.2,
      },
    };


    // ========================================================
    // 22. FILENAME
    // ========================================================

    const fileDate =
      formatDateRu(
        exportDateSource
      );


    const baseFilename =
      order.order_number
        ?.trim()
      ?
        `${order.order_number.trim()} от ${fileDate}`
      :
        `Черновик заказа от ${fileDate}`;


    const filename =
      `${sanitizeFilename(
        baseFilename
      )}.xlsx`;


    // ========================================================
    // 23. WRITE
    // ========================================================

    const excelBuffer =
      await workbook.xlsx
        .writeBuffer();


    return new NextResponse(
      Buffer.from(
        excelBuffer
      ),
      {
        status:
          200,

        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

          "Content-Disposition":
            `attachment; filename="order.xlsx"; filename*=UTF-8''${encodeURIComponent(
              filename
            )}`,

          "Cache-Control":
            "no-store",
        },
      }
    );


  } catch (
    error
  ) {

    console.error(
      "VED Excel export error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка экспорта Excel",
      },
      {
        status:
          500,
      }
    );

  }

}
