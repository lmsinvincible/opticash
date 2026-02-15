import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const payload = await request.json();
  const { items, totalGain } = payload as {
    items: Array<{ title: string; gain: number }>;
    totalGain: number;
  };

  const userId = userData.user.id;
  const timestamp = Date.now();
  const filename = `impots-boost-${timestamp}.json`;
  const storagePath = `${userId}/${filename}`;

  const json = JSON.stringify({ items, totalGain, created_at: new Date().toISOString() }, null, 2);
  const buffer = Buffer.from(json, "utf-8");

  const { error: uploadError } = await supabaseAdmin.storage
    .from("uploads")
    .upload(storagePath, buffer, {
      contentType: "application/json",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const columns = ["Action", "Gain €/an"];
  const preview = (items ?? []).map((item) => [item.title, String(item.gain)]);

  const { data: uploadRow, error: insertError } = await supabaseAdmin
    .from("uploads")
    .insert({
      user_id: userId,
      kind: "impots",
      storage_path: storagePath,
      original_name: filename,
      status: "parsed",
      columns,
      preview,
    })
    .select("id")
    .single();

  if (insertError || !uploadRow) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create upload" },
      { status: 500 }
    );
  }

  return NextResponse.json({ upload_id: uploadRow.id });
}
