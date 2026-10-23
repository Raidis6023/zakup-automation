import {
  buildCargoPlan,
} from "@/lib/ozon-fbo-cargo-auto";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  180;


type SupplyRequestRow = {
  id: string;
  calculation_run_id: string;
  cluster_name: string | null;
  ozon_order_id: string | number | null;
};


function getConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL
      ?.replace(
        /\/$/,
        ""
      );

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY
      ?.trim();


  if (
    !supabaseUrl
    ||
    !supabaseSecretKey
  ) {

    throw new Error(
      "Не найдены настройки Supabase"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


async function supabaseGet<T>(
  path:
    string
):
Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        headers: {
          apikey:
            supabaseSecretKey,

          Authorization:
            `Bearer ${supabaseSecretKey}`,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  if (!response.ok) {

    throw new Error(
      `Supabase GET ${path}: HTTP ${response.status}: ${text}`
    );

  }


  return (
    text
      ? JSON.parse(
          text
        ) as T
      : [] as T
  );

}


function toPositiveInteger(
  value:
    unknown
):
number | null {

  const number =
    Number(
      value
    );


  if (
    !Number.isFinite(
      number
    )
    ||
    number <=
      0
  ) {

    return null;

  }


  const integer =
    Math.floor(
      number
    );


  return Number.isSafeInteger(
    integer
  )
    ? integer
    : null;

}


export async function GET(
  request:
    Request
) {

  try {

    const url =
      new URL(
        request.url
      );

    const runId =
      url.searchParams.get(
        "run_id"
      )
        ?.trim();


    if (!runId) {

      return Response.json(
        {
          ok:
            false,

          error:
            "Не передан run_id",
        },
        {
          status:
            400,
        }
      );

    }


    const rows =
      await supabaseGet<
        SupplyRequestRow[]
      >(
        [
          "ozon_fbo_supply_requests",
          "?select=id,calculation_run_id,cluster_name,ozon_order_id",
          `&supply_run_id=eq.${encodeURIComponent(
            runId
          )}`,
          "&ozon_order_id=not.is.null",
          "&order=macrolocal_cluster_id.asc",
        ].join(
          ""
        )
      );


    let palletGm =
      0;

    let boxGm =
      0;

    let transportPallets =
      0;

    let totalVolumeLitres =
      0;

    let knownWeightKg =
      0;

    let missingWeightCartons =
      0;

    let transportUnplacedBoxes =
      0;

    let maxHeightMm:
      number | null =
      null;

    let includedApplications =
      0;


    const errors:
      Array<{
        request_id:
          string;

        cluster_name:
          string | null;

        error:
          string;
      }> =
      [];


    for (
      const row
      of rows
    ) {

      const orderId =
        toPositiveInteger(
          row.ozon_order_id
        );


      if (
        orderId ===
          null
      ) {

        continue;

      }


      try {

        const plan =
          await buildCargoPlan(
            row.calculation_run_id,
            orderId,
            row.cluster_name
            ??
            "Неизвестный кластер"
          );


        if (
          !plan.ready
        ) {

          errors.push({
            request_id:
              row.id,

            cluster_name:
              row.cluster_name,

            error:
              plan.reason,
          });


          continue;

        }


        const summary =
          plan.physical_summary;


        includedApplications +=
          1;

        palletGm +=
          summary.pallet_gm;

        boxGm +=
          summary.box_gm;

        transportPallets +=
          summary.transport_pallets_for_boxes;

        totalVolumeLitres +=
          summary.total_volume_litres;

        knownWeightKg +=
          summary.known_weight_kg;

        missingWeightCartons +=
          summary.missing_weight_cartons;

        transportUnplacedBoxes +=
          summary.transport_unplaced_boxes;


        if (
          summary.max_height_mm !==
            null
        ) {

          maxHeightMm =
            maxHeightMm ===
              null
              ? summary.max_height_mm
              : Math.max(
                  maxHeightMm,
                  summary.max_height_mm
                );

        }

      } catch (
        error
      ) {

        errors.push({
          request_id:
            row.id,

          cluster_name:
            row.cluster_name,

          error:
            error instanceof Error
              ? error.message
              : String(
                  error
                ),
        });

      }

    }


    return Response.json(
      {
        ok:
          true,

        applications_count:
          includedApplications,

        total_orders_found:
          rows.length,

        pallet_gm:
          palletGm,

        box_gm:
          boxGm,

        transport_pallets_for_boxes:
          transportPallets,

        total_volume_m3:
          totalVolumeLitres
          /
          1000,

        total_weight_kg:
          missingWeightCartons ===
            0
            ? knownWeightKg
            : null,

        known_weight_kg:
          knownWeightKg,

        missing_weight_cartons:
          missingWeightCartons,

        transport_unplaced_boxes:
          transportUnplacedBoxes,

        max_height_cm:
          maxHeightMm ===
            null
            ? null
            : maxHeightMm
              /
              10,

        errors,
      }
    );

  } catch (
    error
  ) {

    return Response.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error
              ),
      },
      {
        status:
          500,
      }
    );

  }

}
