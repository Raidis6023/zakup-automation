import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

type MyProfile = {
  user_id?: string;
  role_name?: string;
  has_admin_access?: boolean;
  first_name?: string;
  last_name?: string;
};

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers: { "Cache-Control": "no-store" } });
}

async function authorize(orderId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return { error: fail("Неверный идентификатор заказа", 400) };
  }
  const session = await createClient();
  const { data: { user }, error: sessionError } = await session.auth.getUser();
  if (sessionError || !user) return { error: fail("Требуется авторизация", 401) };

  const { data: rawProfile, error: profileError } = await session.rpc("app_get_my_profile");
  const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as MyProfile | null;
  if (profileError || !profile || profile.user_id !== user.id) {
    return { error: fail("Нет доступа к работе с заказами", 403) };
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("ved_orders")
    .select("id,workflow_status,preparation_department,created_by_user_id")
    .eq("id", orderId).maybeSingle();
  if (orderError) return { error: fail("Не удалось проверить заказ", 500) };
  if (!order) return { error: fail("Заказ не найден", 404) };

  const adminAccess = profile.has_admin_access === true;
  const roleMatches = (profile.role_name === "Закуп" && order.preparation_department === "procurement") ||
    (profile.role_name === "Аналитик" && order.preparation_department === "analytics");
  if (!adminAccess && !roleMatches) {
    return { error: fail("Нет прав на изменение этого заказа", 403) };
  }
  if (!["draft", "returned_for_edit"].includes(order.workflow_status)) {
    return { error: fail("Добавлять товары можно только в черновик или возвращённый на доработку заказ", 409) };
  }

  const actorName = [profile.first_name, profile.last_name].map(v => String(v ?? "").trim())
    .filter(Boolean).join(" ") || user.email || "Сотрудник";
  return { admin, userId: user.id, actorName, actorRole: profile.role_name || "Администратор" };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    const access = await authorize(id);
    if (access.error) return access.error;
    const admin = access.admin!;

    // Remove characters that could change the PostgREST OR filter structure.
    const raw = request.nextUrl.searchParams.get("q") ?? "";
    const query = raw.replace(/[^0-9A-Za-zА-Яа-яЁё\- ]/g, "").trim().slice(0, 80);
    if (raw.trim() && query.length < 2) return NextResponse.json({ ok: true, products: [] });
    let lookup = admin.from("products").select(
      "id,master_code,offer_id,name,chinese_article,main_photo_url,units_per_carton,transport_carton_volume_m3,carton_volume_m3,carton_weight_kg,last_unit_price_cny,last_moq"
    ).eq("is_active", true).not("master_code", "is", null);
    if (query) {
      lookup = lookup.or([
        "master_code.ilike.%" + query + "%",
        "offer_id.ilike.%" + query + "%",
        "name.ilike.%" + query + "%",
        "chinese_article.ilike.%" + query + "%"
      ].join(","));
    }
    const { data, error } = await lookup.order("offer_id", { ascending: true }).limit(35);
    if (error) {
      console.error("[VED ADD] product search", error.message);
      return fail("Не удалось получить товары каталога", 500);
    }
    return NextResponse.json({ ok: true, products: data ?? [] }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("[VED ADD] catalog", error);
    return fail("Ошибка поиска товаров", 500);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    // Cookie-based session: block cross-site form submissions.
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return fail("Недопустимый источник запроса", 403);
    }
    const { id } = await context.params;
    const access = await authorize(id);
    if (access.error) return access.error;
    const body = await request.json() as { items?: unknown };
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
      return fail("Выберите от 1 до 50 товаров", 400);
    }

    const { data, error } = await access.admin!.rpc("ved_add_draft_items", {
      p_order_id: id,
      p_items: body.items,
      p_actor_id: access.userId,
      p_actor_name: access.actorName,
      p_actor_role: access.actorRole,
    });
    if (error) {
      const safe = error.message.replace(/^.*?ERROR:\s*/i, "").slice(0, 300);
      console.warn("[VED ADD] rejected", { orderId: id, reason: safe });
      return fail(safe || "Не удалось добавить товар", error.code === "P0001" ? 409 : 400);
    }
    if (!data || data.ok !== true || !Number.isInteger(data.added) || data.added < 1) {
      return fail("Сервер не подтвердил добавление товаров", 500);
    }
    return NextResponse.json({ ok: true, added: data.added, items: data.items }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("[VED ADD] save", error);
    return fail("Ошибка добавления товаров", 500);
  }
}


export async function DELETE(request: NextRequest, context: Context) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return fail("Недопустимый источник запроса", 403);
    }
    const { id } = await context.params;
    const access = await authorize(id);
    if (access.error) return access.error;

    const body = await request.json() as { itemId?: string };
    const itemId = body.itemId ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(itemId)) {
      return fail("Некорректная позиция для удаления", 400);
    }
    const { data, error } = await access.admin!.rpc("ved_remove_manual_draft_item", {
      p_order_id: id,
      p_item_id: itemId,
      p_actor_id: access.userId,
      p_actor_name: access.actorName,
      p_actor_role: access.actorRole,
    });
    if (error) {
      const safe = error.message.slice(0, 300);
      return fail(safe || "Не удалось удалить позицию", 409);
    }
    if (!data || data.ok !== true) return fail("Сервер не подтвердил удаление", 500);
    return NextResponse.json({ ok: true, removedId: data.removed_id }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    console.error("[VED ADD] remove", error);
    return fail("Ошибка удаления позиции", 500);
  }
}
