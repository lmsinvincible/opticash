import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const deleteResult = await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
  if (deleteResult.error) {
    return NextResponse.json({ error: "Unable to delete user" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
