import { NextResponse } from "next/server";

/** Раньше: запрос SMS/кода для входа по телефону. Сейчас отключено. */
export async function POST() {
  return NextResponse.json(
    { error: "Вход и регистрация по номеру телефона отключены." },
    { status: 410 },
  );
}
