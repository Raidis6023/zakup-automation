import {
  NextRequest,
  NextResponse,
} from "next/server";


// ============================================================
// TYPES
// ============================================================

type VedOrder = {
  id: string;

  order_number:
    string | null;

  status:
    string;

  workflow_status:
    string;

  created_by_name:
    string | null;

  preparation_department:
    string | null;

  preparation_responsible_name:
    string | null;

  ved_responsible_user_id:
    string | null;

  ved_responsible_name:
    string | null;

  calculation_run_id:
    string | null;

  calculation_scenario:
    string | null;

  transport_mode:
    string | null;

  transport_variant:
    string | null;

  transport_units:
    number | null;

  selected_capacity_m3:
    number | null;

  new_products_volume_m3:
    number;

  first_sent_to_ved_at:
    string | null;

  last_sent_to_ved_at:
    string | null;

  ved_taken_at:
    string | null;

  returned_for_edit_at:
    string | null;

  return_reason:
    string | null;

  production_handoff_date:
    string | null;

  production_confirmed_at:
    string | null;

  planned_lead_days:
    number | null;

  transit_departure_date:
    string | null;

  transit_started_at:
    string | null;

  expected_arrival_date:
    string | null;

  actual_arrival_date:
    string | null;

  arrival_confirmed_at:
    string | null;

  actual_arrival_confirmed_at:
    string | null;

  notes:
    string | null;

  created_at:
    string;

  updated_at:
    string;
};


type VedOrderItem = {
  id:
    string;

  ved_order_id:
    string;

  product_id:
    string | null;

  status:
    string;

  item_kind:
    string;

  added_manually: boolean;

  chinese_article_snapshot:
    string | null;

  our_article_snapshot:
    string | null;

  product_name_snapshot:
    string | null;

  photo_url:
    string | null;

  priority_group:
    string | null;

  priority_rank:
    number | null;

  position_sort:
    number | null;

  demand_container_units:
    number | null;

  demand_truck_units:
    number | null;

  selected_demand_units:
    number | null;

  moq_quantity:
    number | null;

  moq_confirmed_at:
    string | null;

  unit_price_cny:
    number | null;

  price_confirmed_at:
    string | null;

  moq_excess_review_required:
    boolean;

  moq_review_status:
    string;

  units_per_carton_snapshot:
    number | null;

  carton_volume_m3_snapshot:
    number | null;

  carton_weight_kg_snapshot:
    number | null;

  cartons:
    number | null;

  order_quantity:
    number;

  coverage_after_order_days:
    number | null;

  is_partial_fill:
    boolean;

  manual_cartons_override:
    boolean;

  incoterm:
    string | null;

  port:
    string | null;

  analytics_comment:
    string | null;

  ved_comment:
    string | null;

  total_price_cny:
    number | null;

  total_volume_m3:
    number | null;

  total_weight_tons:
    number | null;

  quantity:
    number;
};


type VedOrderTotals = {
  ved_order_id:
    string;

  order_number:
    string | null;

  workflow_status:
    string;

  items_count:
    number;

  total_units:
    number;

  total_cartons:
    number;

  total_price_cny:
    number;

  total_volume_m3:
    number;

  total_weight_tons:
    number;
};


// ============================================================
// SUPABASE CONFIG
// ============================================================

function getSupabaseConfig() {

  const supabaseUrl =
    process.env
      .NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;


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


// ============================================================
// SUPABASE GET
// ============================================================

async function supabaseGet<T>(
  path:
    string
):
  Promise<T> {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getSupabaseConfig();


  const response =
    await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        method:
          "GET",

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
      `Ошибка Supabase. HTTP ${response.status}. ${text}`
    );

  }


  return JSON.parse(
    text
  ) as T;

}


// ============================================================
// GET /api/ved-orders/[id]
// ============================================================

export async function GET(

  _request:
    NextRequest,

  context: {
    params:
      Promise<{
        id:
          string;
      }>;
  }

) {

  try {

    // ========================================================
    // 1. ID ЗАКАЗА
    // ========================================================

    const {
      id,
    } =
      await context.params;


    if (
      !id
      ||
      !id.trim()
    ) {

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


    const orderId =
      encodeURIComponent(
        id.trim()
      );


    // ========================================================
    // 2. ЗАКАЗ
    // ========================================================

    const orders =
      await supabaseGet<
        VedOrder[]
      >(
        [
          "ved_orders",

          `?id=eq.${orderId}`,

          "&select=",

          [

            "id",

            "order_number",

            "status",

            "workflow_status",


            "created_by_name",


            "preparation_department",

            "preparation_responsible_name",

            "ved_responsible_user_id",

            "ved_responsible_name",


            "calculation_run_id",

            "calculation_scenario",


            "transport_mode",

            "transport_variant",

            "transport_units",

            "selected_capacity_m3",


            "new_products_volume_m3",


            "first_sent_to_ved_at",

            "last_sent_to_ved_at",


            "ved_taken_at",


            "returned_for_edit_at",

            "return_reason",


            // ================================================
            // ПРОИЗВОДСТВО
            // ================================================

            "production_handoff_date",

            "production_confirmed_at",

            "planned_lead_days",


            // ================================================
            // В ПУТИ
            // ================================================

            "transit_departure_date",

            "transit_started_at",


            // ================================================
            // ПРИБЫТИЕ
            // ================================================

            "expected_arrival_date",

            "actual_arrival_date",

            "arrival_confirmed_at",


            // Старое поле пока оставляем для совместимости.
            "actual_arrival_confirmed_at",


            "notes",


            "created_at",

            "updated_at",

          ].join(
            ","
          ),

        ].join(
          ""
        )
      );


    if (
      !orders.length
    ) {

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


    const order =
      orders[0];


    // ========================================================
    // 3. ПОЗИЦИИ ЗАКАЗА
    // ========================================================

    const items =
      await supabaseGet<
        VedOrderItem[]
      >(
        [
          "ved_order_items",

          `?ved_order_id=eq.${orderId}`,

          "&select=",

          [

            "id",

            "ved_order_id",

            "product_id",


            "status",

            "item_kind",

            "added_manually",


            "chinese_article_snapshot",

            "our_article_snapshot",

            "product_name_snapshot",

            "photo_url",


            "priority_group",

            "priority_rank",

            "position_sort",


            "demand_container_units",

            "demand_truck_units",

            "selected_demand_units",


            "moq_quantity",

            "moq_confirmed_at",


            "unit_price_cny",

            "price_confirmed_at",


            "moq_excess_review_required",

            "moq_review_status",


            "units_per_carton_snapshot",

            "carton_volume_m3_snapshot",

            "carton_weight_kg_snapshot",


            "cartons",

            "order_quantity",


            "coverage_after_order_days",


            "is_partial_fill",

            "manual_cartons_override",


            "incoterm",

            "port",


            "analytics_comment",

            "ved_comment",


            "total_price_cny",

            "total_volume_m3",

            "total_weight_tons",


            "quantity",

          ].join(
            ","
          ),


          "&order=position_sort.asc.nullslast,priority_rank.asc.nullslast",

        ].join(
          ""
        )
      );


    // ========================================================
    // 4. ИТОГИ
    // ========================================================

    const totalsRows =
      await supabaseGet<
        VedOrderTotals[]
      >(
        [
          "ved_order_totals",

          `?ved_order_id=eq.${orderId}`,

          "&select=*",

        ].join(
          ""
        )
      );


    const totals =
      totalsRows.length
        ? totalsRows[0]
        : {

            ved_order_id:
              order.id,

            order_number:
              order.order_number,

            workflow_status:
              order.workflow_status,

            items_count:
              items.length,

            total_units:
              0,

            total_cartons:
              0,

            total_price_cny:
              0,

            total_volume_m3:
              0,

            total_weight_tons:
              0,

          };


    // ========================================================
    // 5. СТАТИСТИКА ГОТОВНОСТИ
    // ========================================================

    const termsConfirmedCount =
      items.filter(
        (
          item
        ) =>
          item.moq_confirmed_at
          &&
          item.price_confirmed_at
      ).length;


    const termsPendingCount =
      items.length
      -
      termsConfirmedCount;


    const moqReviewPendingCount =
      items.filter(
        (
          item
        ) =>
          item.moq_review_status ===
            "pending"
      ).length;


    const readyForTransportCount =
      items.filter(
        (
          item
        ) =>
          item.order_quantity > 0
          &&
          item.cartons !== null
          &&
          item.cartons > 0
          &&
          item.moq_review_status !==
            "pending"
          &&
          item.moq_review_status !==
            "rejected"
      ).length;


    const missingChineseArticleCount =
      items.filter(
        (
          item
        ) =>
          !item
            .chinese_article_snapshot
            ?.trim()
      ).length;


    const missingWeightCount =
      items.filter(
        (
          item
        ) =>
          item
            .carton_weight_kg_snapshot
          === null
      ).length;


    // ========================================================
    // 6. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        order,

        totals,

        statistics: {

          items_count:
            items.length,

          terms_confirmed:
            termsConfirmedCount,

          terms_pending:
            termsPendingCount,

          moq_review_pending:
            moqReviewPendingCount,

          ready_for_transport:
            readyForTransportCount,

          missing_chinese_article:
            missingChineseArticleCount,

          missing_weight:
            missingWeightCount,

        },

        items,
      },
      {
        status:
          200,
      }
    );


  } catch (
    error
  ) {

    console.error(
      "VED order GET error:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Неизвестная ошибка получения заказа",
      },
      {
        status:
          500,
      }
    );

  }

}
