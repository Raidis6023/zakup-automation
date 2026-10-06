import { NextResponse } from "next/server";
import { inflateRawSync } from "zlib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const WB_BASE =
  "https://seller-analytics-api.wildberries.ru";

const CREATE_URL =
  `${WB_BASE}/api/v2/nm-report/downloads`;

const DEFAULT_NM_ID =
  1286384330;

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMoscowDateOffset(
  daysOffset: number
): string {
  const now = new Date();

  const moscowNow =
    new Date(
      now.toLocaleString(
        "en-US",
        {
          timeZone:
            "Europe/Moscow",
        }
      )
    );

  moscowNow.setDate(
    moscowNow.getDate() +
      daysOffset
  );

  const year =
    moscowNow.getFullYear();

  const month =
    String(
      moscowNow.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      moscowNow.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function normalizeHeader(
  value: string
): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim();
}

function detectDelimiter(
  firstLine: string
): string {
  const delimiters = [
    ",",
    ";",
    "\t",
  ];

  let bestDelimiter = ",";
  let bestCount = -1;

  for (
    const delimiter
    of delimiters
  ) {
    const count =
      firstLine.split(
        delimiter
      ).length;

    if (
      count >
      bestCount
    ) {
      bestCount =
        count;

      bestDelimiter =
        delimiter;
    }
  }

  return bestDelimiter;
}

// ============================================================
// ПРОСТОЙ CSV-ПАРСЕР
//
// Учитывает:
// "текст, с запятой"
// "текст ""в кавычках"""
// ============================================================

function parseCsvLine(
  line: string,
  delimiter: string
): string[] {
  const result:
    string[] = [];

  let current = "";
  let insideQuotes =
    false;

  for (
    let i = 0;
    i < line.length;
    i++
  ) {
    const char =
      line[i];

    if (
      char === '"'
    ) {
      if (
        insideQuotes &&
        line[i + 1] === '"'
      ) {
        current += '"';
        i++;
      } else {
        insideQuotes =
          !insideQuotes;
      }

      continue;
    }

    if (
      char === delimiter &&
      !insideQuotes
    ) {
      result.push(
        current
      );

      current = "";
      continue;
    }

    current +=
      char;
  }

  result.push(
    current
  );

  return result;
}

// ============================================================
// ИЗВЛЕЧЕНИЕ ПЕРВОГО ФАЙЛА ИЗ ZIP
//
// Без сторонних npm-пакетов.
// Читаем central directory ZIP и распаковываем DEFLATE.
// ============================================================

function extractFirstFileFromZip(
  buffer: Buffer
): {
  fileName: string;
  data: Buffer;
} {
  const EOCD_SIGNATURE =
    0x06054b50;

  const CENTRAL_SIGNATURE =
    0x02014b50;

  const LOCAL_SIGNATURE =
    0x04034b50;

  let eocdOffset = -1;

  const minOffset =
    Math.max(
      0,
      buffer.length -
        65557
    );

  for (
    let i =
      buffer.length - 22;
    i >= minOffset;
    i--
  ) {
    if (
      buffer.readUInt32LE(
        i
      ) ===
      EOCD_SIGNATURE
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (
    eocdOffset < 0
  ) {
    throw new Error(
      "Не найден конец ZIP-архива"
    );
  }

  const centralDirectoryOffset =
    buffer.readUInt32LE(
      eocdOffset + 16
    );

  if (
    buffer.readUInt32LE(
      centralDirectoryOffset
    ) !==
    CENTRAL_SIGNATURE
  ) {
    throw new Error(
      "Не найден central directory ZIP"
    );
  }

  const compressionMethod =
    buffer.readUInt16LE(
      centralDirectoryOffset +
        10
    );

  const compressedSize =
    buffer.readUInt32LE(
      centralDirectoryOffset +
        20
    );

  const uncompressedSize =
    buffer.readUInt32LE(
      centralDirectoryOffset +
        24
    );

  const fileNameLength =
    buffer.readUInt16LE(
      centralDirectoryOffset +
        28
    );

  const extraLength =
    buffer.readUInt16LE(
      centralDirectoryOffset +
        30
    );

  const commentLength =
    buffer.readUInt16LE(
      centralDirectoryOffset +
        32
    );

  const localHeaderOffset =
    buffer.readUInt32LE(
      centralDirectoryOffset +
        42
    );

  const fileName =
    buffer
      .subarray(
        centralDirectoryOffset +
          46,
        centralDirectoryOffset +
          46 +
          fileNameLength
      )
      .toString(
        "utf8"
      );

  // Переменные нужны для валидации структуры ZIP.
  void extraLength;
  void commentLength;
  void uncompressedSize;

  if (
    buffer.readUInt32LE(
      localHeaderOffset
    ) !==
    LOCAL_SIGNATURE
  ) {
    throw new Error(
      "Некорректный локальный заголовок ZIP"
    );
  }

  const localFileNameLength =
    buffer.readUInt16LE(
      localHeaderOffset +
        26
    );

  const localExtraLength =
    buffer.readUInt16LE(
      localHeaderOffset +
        28
    );

  const dataStart =
    localHeaderOffset +
    30 +
    localFileNameLength +
    localExtraLength;

  const compressedData =
    buffer.subarray(
      dataStart,
      dataStart +
        compressedSize
    );

  let data:
    Buffer;

  if (
    compressionMethod ===
    0
  ) {
    // Stored — без сжатия
    data =
      compressedData;
  } else if (
    compressionMethod ===
    8
  ) {
    // Deflate
    data =
      inflateRawSync(
        compressedData
      );
  } else {
    throw new Error(
      `Неподдерживаемый метод сжатия ZIP: ${compressionMethod}`
    );
  }

  return {
    fileName,
    data,
  };
}

// ============================================================
// ПРЕВРАЩАЕМ CSV В ОБЪЕКТЫ
// ============================================================

function parseCsv(
  csvText: string
) {
  const normalizedText =
    csvText.replace(
      /\r\n/g,
      "\n"
    );

  const lines =
    normalizedText
      .split("\n")
      .filter(
        (line) =>
          line.trim()
            .length > 0
      );

  if (
    lines.length === 0
  ) {
    return {
      delimiter: null,
      headers: [],
      rows: [],
    };
  }

  const delimiter =
    detectDelimiter(
      lines[0]
    );

  const headers =
    parseCsvLine(
      lines[0],
      delimiter
    ).map(
      normalizeHeader
    );

  const rows =
    lines
      .slice(1)
      .map(
        (line) => {
          const values =
            parseCsvLine(
              line,
              delimiter
            );

          const row:
            Record<
              string,
              string
            > = {};

          headers.forEach(
            (
              header,
              index
            ) => {
              row[header] =
                values[
                  index
                ] ?? "";
            }
          );

          return row;
        }
      );

  return {
    delimiter,
    headers,
    rows,
  };
}

// ============================================================
// ПОИСК ПОЛЕЙ, ПОХОЖИХ НА СКЛАД / РЕГИОН
// ============================================================

function findInterestingColumns(
  headers: string[]
) {
  const keywords = [
    "warehouse",
    "office",
    "region",
    "склад",
    "регион",
    "quantity",
    "stock",
    "остат",
    "nm",
    "date",
    "dt",
  ];

  return headers.filter(
    (header) => {
      const lower =
        header.toLowerCase();

      return keywords.some(
        (keyword) =>
          lower.includes(
            keyword
          )
      );
    }
  );
}

// ============================================================
// GET
//
// action=start
// action=status&id=UUID
// action=download&id=UUID
// ============================================================

export async function GET(
  request: Request
) {
  const token =
    process.env.WB_READ_TOKEN;

  if (!token) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "В Vercel не найден WB_READ_TOKEN",
      },
      {
        status: 500,
      }
    );
  }

  const url =
    new URL(
      request.url
    );

  const action =
    url.searchParams.get(
      "action"
    ) ??
    "start";

  const id =
    url.searchParams.get(
      "id"
    );

  const nmIdParam =
    url.searchParams.get(
      "nmId"
    );

  const nmId =
    nmIdParam
      ? Number(
          nmIdParam
        )
      : DEFAULT_NM_ID;

  if (
    !Number.isInteger(
      nmId
    ) ||
    nmId <= 0
  ) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Некорректный nmId",
        received:
          nmIdParam,
      },
      {
        status: 400,
      }
    );
  }

  // ==========================================================
  // ACTION = START
  // ==========================================================

  if (
    action ===
    "start"
  ) {
    // Берём 7 ПОЛНЫХ прошедших дней.
    //
    // Сегодня не берём,
    // потому что DAILY-отчёт показывает остаток
    // на конец дня — 23:59.
    const endDate =
      getMoscowDateOffset(
        -1
      );

    const startDate =
      getMoscowDateOffset(
        -7
      );

    const reportId =
      crypto.randomUUID();

    const body = {
      id:
        reportId,

      reportType:
        "STOCK_HISTORY_DAILY_CSV",

      userReportName:
        `WB stock history test ${nmId}`,

      params: {
        nmIds: [
          nmId,
        ],

        subjectIds: [],

        brandNames: [],

        tagIds: [],

        currentPeriod: {
          start:
            startDate,

          end:
            endDate,
        },

        stockType:
          "wb",

        skipDeletedNm:
          false,
      },
    };

    try {
      const response =
        await fetch(
          CREATE_URL,
          {
            method:
              "POST",

            headers: {
              Authorization:
                token,

              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body
              ),

            cache:
              "no-store",
          }
        );

      const text =
        await response.text();

      const parsed =
        parseJson(
          text
        );

      return NextResponse.json(
        {
          ok:
            response.ok,

          step:
            "START",

          message:
            response.ok
              ? "Задание на формирование STOCK_HISTORY_DAILY_CSV создано"
              : "WB не создал отчёт",

          wbStatus:
            response.status,

          reportId,

          nmId,

          period: {
            start:
              startDate,

            end:
              endDate,
          },

          requestBody:
            body,

          wbResponse:
            parsed,

          next:
            response.ok
              ? `/api/wb/stock-history-daily-test?action=status&id=${reportId}`
              : null,

          warning:
            "Не запускайте action=start повторно. Для Basic у метода создания отчёта лимит 1 запрос в час.",
        },
        {
          status:
            response.ok
              ? 200
              : response.status,
        }
      );
    } catch (
      error
    ) {
      return NextResponse.json(
        {
          ok: false,
          step:
            "START",

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка",
        },
        {
          status: 500,
        }
      );
    }
  }

  // ==========================================================
  // ДЛЯ STATUS И DOWNLOAD НУЖЕН REPORT ID
  // ==========================================================

  if (!id) {
    return NextResponse.json(
      {
        ok: false,

        message:
          "Для этого действия нужен параметр id",

        example:
          "/api/wb/stock-history-daily-test?action=status&id=UUID",
      },
      {
        status: 400,
      }
    );
  }

  // ==========================================================
  // ACTION = STATUS
  // ==========================================================

  if (
    action ===
    "status"
  ) {
    const statusUrl =
      `${CREATE_URL}?filter%5BdownloadIds%5D=${encodeURIComponent(
        id
      )}`;

    try {
      const response =
        await fetch(
          statusUrl,
          {
            method:
              "GET",

            headers: {
              Authorization:
                token,

              Accept:
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      const text =
        await response.text();

      const parsed =
        parseJson(
          text
        );

      let reportStatus:
        string | null =
        null;

      if (
        parsed &&
        typeof parsed ===
          "object" &&
        "data" in parsed
      ) {
        const data =
          (
            parsed as {
              data?: Array<{
                id?: string;
                status?: string;
              }>;
            }
          ).data;

        if (
          Array.isArray(
            data
          )
        ) {
          const report =
            data.find(
              (
                item
              ) =>
                item.id ===
                id
            );

          reportStatus =
            report
              ?.status ??
            null;
        }
      }

      return NextResponse.json(
        {
          ok:
            response.ok,

          step:
            "STATUS",

          wbStatus:
            response.status,

          reportId:
            id,

          reportStatus,

          ready:
            reportStatus ===
            "SUCCESS",

          failed:
            reportStatus ===
            "FAILED",

          wbResponse:
            parsed,

          next:
            reportStatus ===
            "SUCCESS"
              ? `/api/wb/stock-history-daily-test?action=download&id=${id}`
              : null,

          warning:
            "Не обновляйте status многократно. Для Basic у этого метода лимит 1 запрос в час.",
        },
        {
          status:
            response.ok
              ? 200
              : response.status,
        }
      );
    } catch (
      error
    ) {
      return NextResponse.json(
        {
          ok: false,

          step:
            "STATUS",

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка",
        },
        {
          status: 500,
        }
      );
    }
  }

  // ==========================================================
  // ACTION = DOWNLOAD
  // ==========================================================

  if (
    action ===
    "download"
  ) {
    const downloadUrl =
      `${CREATE_URL}/file/${encodeURIComponent(
        id
      )}`;

    try {
      const response =
        await fetch(
          downloadUrl,
          {
            method:
              "GET",

            headers: {
              Authorization:
                token,

              Accept:
                "application/zip",
            },

            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        const errorText =
          await response.text();

        return NextResponse.json(
          {
            ok: false,

            step:
              "DOWNLOAD",

            wbStatus:
              response.status,

            reportId:
              id,

            message:
              "WB не отдал ZIP-отчёт",

            wbResponse:
              parseJson(
                errorText
              ),

            warning:
              "Не повторяйте download сразу. У Basic лимит метода 1 запрос в час.",
          },
          {
            status:
              response.status,
          }
        );
      }

      const arrayBuffer =
        await response.arrayBuffer();

      const zipBuffer =
        Buffer.from(
          arrayBuffer
        );

      const extracted =
        extractFirstFileFromZip(
          zipBuffer
        );

      const csvText =
        extracted.data.toString(
          "utf8"
        );

      const parsedCsv =
        parseCsv(
          csvText
        );

      const interestingColumns =
        findInterestingColumns(
          parsedCsv.headers
        );

      // Уникальные значения в потенциально интересных колонках.
      const distinctValues:
        Record<
          string,
          string[]
        > = {};

      for (
        const column
        of interestingColumns
      ) {
        distinctValues[
          column
        ] =
          Array.from(
            new Set(
              parsedCsv.rows
                .map(
                  (row) =>
                    row[
                      column
                    ]
                )
                .filter(
                  (
                    value
                  ) =>
                    typeof value ===
                      "string" &&
                    value.trim()
                      .length > 0
                )
            )
          ).slice(
            0,
            100
          );
      }

      // Ищем именно колонки,
      // в названии которых явно фигурирует склад/office.
      const warehouseColumns =
        parsedCsv.headers.filter(
          (header) => {
            const lower =
              header.toLowerCase();

            return (
              lower.includes(
                "warehouse"
              ) ||
              lower.includes(
                "office"
              ) ||
              lower.includes(
                "склад"
              )
            );
          }
        );

      const regionColumns =
        parsedCsv.headers.filter(
          (header) => {
            const lower =
              header.toLowerCase();

            return (
              lower.includes(
                "region"
              ) ||
              lower.includes(
                "регион"
              )
            );
          }
        );

      // Показываем максимум первые 50 строк,
      // чтобы браузер не превратился в археологический объект.
      const previewRows =
        parsedCsv.rows.slice(
          0,
          50
        );

      let conclusion =
        "";

      if (
        warehouseColumns.length >
        0
      ) {
        conclusion =
          "В CSV найдены поля, связанные со складами. Теперь смотрим их distinctValues и строки previewRows: если там есть реальные названия вроде Коледино/Электросталь, поскладочная история доступна.";
      } else if (
        regionColumns.length >
        0
      ) {
        conclusion =
          "Отдельных складских колонок в CSV не найдено, но есть региональные поля. Проверяем, насколько подробные значения WB в них вернул.";
      } else {
        conclusion =
          "В CSV не обнаружены очевидные поля склада или офиса. Вероятнее всего этот отчёт не даст нам физическую складскую детализацию.";
      }

      return NextResponse.json({
        ok: true,

        step:
          "DOWNLOAD",

        wbStatus:
          response.status,

        reportId:
          id,

        zip: {
          bytes:
            zipBuffer.length,

          fileName:
            extracted.fileName,

          csvBytes:
            extracted.data
              .length,
        },

        csv: {
          delimiter:
            parsedCsv.delimiter,

          headers:
            parsedCsv.headers,

          rowsCount:
            parsedCsv.rows
              .length,

          warehouseColumns,

          regionColumns,

          interestingColumns,

          distinctValues,

          previewRows,
        },

        conclusion,

        warning:
          "Не запускайте download повторно сразу. Для Basic у метода получения отчёта лимит 1 запрос в час.",
      });
    } catch (
      error
    ) {
      return NextResponse.json(
        {
          ok: false,

          step:
            "DOWNLOAD",

          reportId:
            id,

          message:
            "Не удалось скачать или разобрать ZIP/CSV",

          error:
            error instanceof Error
              ? error.message
              : "Неизвестная ошибка",
        },
        {
          status: 500,
        }
      );
    }
  }

  return NextResponse.json(
    {
      ok: false,

      message:
        "Неизвестное действие",

      receivedAction:
        action,

      allowedActions: [
        "start",
        "status",
        "download",
      ],
    },
    {
      status: 400,
    }
  );
}
