import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const uploadId = body?.id as string | undefined;
  if (!uploadId) {
    return NextResponse.json({ error: "Missing upload id" }, { status: 400 });
  }

  const { data: upload, error: fetchError } = await supabaseAdmin
    .from("uploads")
    .select("id, user_id, storage_path")
    .eq("id", uploadId)
    .maybeSingle();

  if (fetchError || !upload) {
    return NextResponse.json({ error: "Upload not found" }, { status: 404 });
  }

  if (upload.user_id !== userData.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: storageError } = await supabaseAdmin.storage
    .from("uploads")
    .remove([upload.storage_path]);

  if (storageError) {
    return NextResponse.json({ error: storageError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin.from("uploads").delete().eq("id", uploadId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
