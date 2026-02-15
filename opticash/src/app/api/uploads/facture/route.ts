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

  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const yearly = formData.get("yearly");
  const bestName = formData.get("best_name");
  const bestYearly = formData.get("best_yearly");
  const savings = formData.get("savings");

  const userId = userData.user.id;
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/facture-${timestamp}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from("uploads")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const columns = ["Indicateur", "Valeur"];
  const preview = [
    ["Coût annuel estimé", String(yearly ?? "")],
    ["Meilleure offre", String(bestName ?? "")],
    ["Coût meilleure offre", String(bestYearly ?? "")],
    ["Économie potentielle", String(savings ?? "")],
  ];

  const { data: uploadRow, error: insertError } = await supabaseAdmin
    .from("uploads")
    .insert({
      user_id: userId,
      kind: "facture",
      storage_path: storagePath,
      original_name: file.name,
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
