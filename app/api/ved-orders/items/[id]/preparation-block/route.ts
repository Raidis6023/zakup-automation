import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
type Profile = {
  user_id?: string;
  role_name?: string;
  has_admin_access?: boolean;
  first_name?: string;
  last_name?: string;
};
function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, {
    status, headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) {
      return fail("Недопустимый источник запроса", 403);
    }
    const { id } = await context.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return fail("Неверный идентификатор товара", 400);
    const session = await createClient();
    const { data: { user }, error: authError } = await session.auth.getUser();
    if (!user || authError) return fail("Требуется авторизация", 401);
    const { data: rawProfile, error: profileError } = await session.rpc("app_get_my_profile");
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as Profile | null;
    if (profileError || !profile || profile.user_id !== user.id) {
      return fail("Недостаточно прав", 403);
    }
    const admin = createAdminClient();
    const { data: item, error: itemError } = await admin.from("ved_order_items")
      .select("id,ved_order_id").eq("id", id).maybeSingle();
    if (itemError || !item) return fail("Товар в заказе не найден", 404);
    const { data: order, error: orderError } = await admin.from("ved_orders")
      .select("id,workflow_status,preparation_department")
      .eq("id", item.ved_order_id).maybeSingle();
    if (orderError || !order) return fail("Заказ не найден", 404);
    const allowed = profile.has_admin_access === true ||
      (profile.role_name === "Закуп" && order.preparation_department === "procurement") ||
      (profile.role_name === "Аналитик" && order.preparation_department === "analytics");
    if (!allowed) return fail("Нет прав на редактирование этого заказа", 403);
    if (!["draft", "returned_for_edit"].includes(order.workflow_status)) {
      return fail("Этот заказ уже передан в ВЭД", 409);
    }
    const length = Number(request.headers.get("content-length") || "0");
    if (length > 20_000) return fail("Слишком большой запрос", 413);
    const input = await request.json() as { block?: string; values?: unknown };
    if (!["characteristics", "terms"].includes(input.block ?? "") ||
        !input.values || typeof input.values !== "object" ||
        Array.isArray(input.values)) {
      return fail("Неизвестный блок подтверждения", 400);
    }
    const actorName = [profile.first_name, profile.last_name]
      .map(s => String(s ?? "").trim()).filter(Boolean).join(" ") ||
      user.email || "Сотрудник";
    const { data, error } = await admin.rpc("ved_confirm_preparation_block", {
      p_item_id: id,
      p_block: input.block,
      p_payload: input.values,
      p_actor_id: user.id,
      p_actor_name: actorName,
      p_actor_role: profile.role_name || "Администратор"
    });
    if (error) {
      console.warn("[VED BLOCK] rejected", { itemId: id, block: input.block, reason: error.message });
      return fail(error.message.slice(0, 400), 400);
    }
    if (!data?.ok) return fail("Не удалось сохранить подтверждение", 500);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[VED BLOCK]", error);
    return fail("Ошибка подтверждения блока заказа", 500);
  }
}
