export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function getConfig() {

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

  const cronSecret =
    process.env.CRON_SECRET;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена переменная SUPABASE_SECRET_KEY"
    );

  }


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
    cronSecret,
  };
}


function isAuthorized(
  request: Request
): boolean {

  const {
    cronSecret,
  } = getConfig();


  const authorization =
    request.headers.get(
      "authorization"
    );


  return (
    authorization
    ===
    `Bearer ${cronSecret}`
  );
}


async function handler(
  request: Request
) {

  try {

    if (
      !isAuthorized(
        request
      )
    ) {

      return Response.json(
        {
          ok: false,
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );

    }


    const {
      supabaseUrl,
      supabaseSecretKey,
    } = getConfig();


    const response =
      await fetch(
        `${supabaseUrl}/rest/v1/rpc/replace_ozon_sales_day`,
        {
          method: "POST",

          headers: {
            apikey:
              supabaseSecretKey,

            Authorization:
              `Bearer ${supabaseSecretKey}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              {
                p_sale_date:
                  "2099-12-31",

                p_rows:
                  [],
              }
            ),

          cache:
            "no-store",
        }
      );


    const text =
      await response.text();


    if (!response.ok) {

      throw new Error(
        `Supabase RPC error ${response.status}: ${text}`
      );

    }


    return Response.json(
      {
        ok: true,

        mode:
          "sales_rpc_test",

        writes_real_sales:
          false,

        test_date:
          "2099-12-31",

        rpc_result:
          text,
      }
    );

  } catch (error) {

    return Response.json(
      {
        ok: false,

        mode:
          "sales_rpc_test",

        writes_real_sales:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }
}


export async function GET(
  request: Request
) {

  return handler(
    request
  );

}


export async function POST(
  request: Request
) {

  return handler(
    request
  );

}
