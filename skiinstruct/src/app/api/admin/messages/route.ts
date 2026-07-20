import { NextResponse } from "next/server";
import { z } from "zod";

import { isApiErrorResponse, requireAdminSession } from "@/lib/api-session";
import {
  listAdminDirectMessages,
  sendAdminDirectMessage,
} from "@/lib/services/admin-direct-message";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().min(1).max(4000),
  subject: z.string().max(200).optional().nullable(),
});

export async function GET() {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  const messages = await listAdminDirectMessages({ take: 50 });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if (isApiErrorResponse(auth)) return auth;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await sendAdminDirectMessage({
    senderId: auth.userId,
    recipientId: parsed.data.recipientId,
    body: parsed.data.body,
    subject: parsed.data.subject,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    emailSent: result.message.emailSent,
  });
}
