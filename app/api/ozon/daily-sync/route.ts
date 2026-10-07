export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(
  request: Request
): boolean {

  const cronSecret =
    process.env.CRON_SECRET;


  if (!cronSecret) {

    throw new Error(
      "Не найдена переменная CRON_SECRET"
    );

  }


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


    return Response.json(
      {
        ok: true,
        mode: "auth_test_only",
        writes_to_database: false,
        message:
          "CRON_SECRET работает. Daily sync пока ничего не записывает.",
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    return Response.json(
      {
        ok: false,
        mode: "auth_test_only",
        writes_to_database: false,
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
