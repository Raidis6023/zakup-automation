import { getIntegrationSecret } from "@/lib/integrations/secrets";
import {
  NextResponse,
} from "next/server";


export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// ============================================================
// TYPES
// ============================================================

type CampaignResponse = {
  campaign?: {
    id?: number;

    domain?: string;

    placementType?:
      string;

    apiAvailability?:
      string;

    business?: {
      id?: number;
      name?: string;
    };
  };
};


type WarehouseResponse = {
  status?: string;

  result?: {
    warehouses?: Array<{
      id?: number;

      name?: string;

      address?: {
        city?: string;

        street?: string;

        number?: string;
      };
    }>;
  };

  errors?: Array<{
    code?: string;
    message?: string;
  }>;
};


// ============================================================
// CONFIG
// ============================================================

async function getConfig() {
  const apiKey =
    await getIntegrationSecret("yandex_api_key");


  const campaignId =
    await getIntegrationSecret("yandex_campaign_id");


  if (!apiKey) {
    throw new Error(
      "Не найдена YANDEX_API_KEY"
    );
  }


  if (!campaignId) {
    throw new Error(
      "Не найдена YANDEX_CAMPAIGN_ID"
    );
  }


  if (
    !/^\d+$/.test(
      campaignId
    )
  ) {
    throw new Error(
      "YANDEX_CAMPAIGN_ID должен быть числом"
    );
  }


  return {
    apiKey,
    campaignId,
  };
}


// ============================================================
// FETCH JSON
// ============================================================

async function fetchYandex(
  url: string,
  apiKey: string
) {
  const response =
    await fetch(
      url,
      {
        method:
          "GET",

        headers: {
          "Api-Key":
            apiKey,

          Accept:
            "application/json",
        },

        cache:
          "no-store",
      }
    );


  const text =
    await response.text();


  let data:
    unknown;


  try {
    data =
      text
        ? JSON.parse(
            text
          )
        : null;

  } catch {
    data =
      {
        raw:
          text,
      };
  }


  return {
    ok:
      response.ok,

    status:
      response.status,

    data,
  };
}


// ============================================================
// GET
//
// ТОЛЬКО ЧТЕНИЕ.
// ============================================================

export async function GET() {
  try {
    const {
      apiKey,
      campaignId,
    } =
      await getConfig();


    // ========================================================
    // 1. CAMPAIGN
    // ========================================================

    const campaignResult =
      await fetchYandex(
        `https://api.partner.market.yandex.ru/v2/campaigns/${campaignId}`,
        apiKey
      );


    if (!campaignResult.ok) {
      return NextResponse.json(
        {
          ok:
            false,

          mode:
            "read_only_yandex_info",

          writes_to_yandex:
            false,

          writes_to_database:
            false,

          source:
            "campaign",

          yandex_status:
            campaignResult.status,

          yandex_response:
            campaignResult.data,
        },
        {
          status:
            502,
        }
      );
    }


    const campaignData =
      campaignResult.data as CampaignResponse;


    // ========================================================
    // 2. FULFILLMENT WAREHOUSES
    // ========================================================

    const warehousesUrl =
      new URL(
        "https://api.partner.market.yandex.ru/v2/warehouses"
      );


    warehousesUrl.searchParams.set(
      "campaignId",
      campaignId
    );


    const warehousesResult =
      await fetchYandex(
        warehousesUrl.toString(),
        apiKey
      );


    if (!warehousesResult.ok) {
      return NextResponse.json(
        {
          ok:
            false,

          mode:
            "read_only_yandex_info",

          writes_to_yandex:
            false,

          writes_to_database:
            false,

          source:
            "warehouses",

          campaign:
            campaignData.campaign
            ??
            null,

          yandex_status:
            warehousesResult.status,

          yandex_response:
            warehousesResult.data,
        },
        {
          status:
            502,
        }
      );
    }


    const warehousesData =
      warehousesResult.data as WarehouseResponse;


    // ========================================================
    // 3. NORMALIZED WAREHOUSES
    // ========================================================

    const warehouses =
      (
        warehousesData
          .result
          ?.warehouses
        ??
        []
      ).map(
        warehouse => ({
          id:
            warehouse.id
            ??
            null,

          name:
            warehouse.name
            ??
            null,

          city:
            warehouse
              .address
              ?.city
            ??
            null,

          street:
            warehouse
              .address
              ?.street
            ??
            null,

          number:
            warehouse
              .address
              ?.number
            ??
            null,
        })
      );


    // ========================================================
    // 4. RESPONSE
    // ========================================================

    return NextResponse.json(
      {
        ok:
          true,

        mode:
          "read_only_yandex_info",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        campaign: {
          id:
            campaignData
              .campaign
              ?.id
            ??
            null,

          domain:
            campaignData
              .campaign
              ?.domain
            ??
            null,

          placement_type:
            campaignData
              .campaign
              ?.placementType
            ??
            null,

          api_availability:
            campaignData
              .campaign
              ?.apiAvailability
            ??
            null,

          business_id:
            campaignData
              .campaign
              ?.business
              ?.id
            ??
            null,

          business_name:
            campaignData
              .campaign
              ?.business
              ?.name
            ??
            null,
        },

        warehouses_count:
          warehouses.length,

        warehouses,
      },
      {
        status:
          200,
      }
    );

  } catch (error) {

    console.error(
      "YANDEX INFO ERROR:",
      error
    );


    return NextResponse.json(
      {
        ok:
          false,

        mode:
          "read_only_yandex_info",

        writes_to_yandex:
          false,

        writes_to_database:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status:
          500,
      }
    );
  }
}
