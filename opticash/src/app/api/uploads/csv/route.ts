import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_PREVIEW_ROWS = 20;
const MAX_PARSE_ROWS = 200;

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

  const userId = userData.user.id;
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${userId}/${timestamp}-${safeName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const csvText = buffer.toString("utf-8");

  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    preview: MAX_PARSE_ROWS,
  });

  if (parsed.errors.length) {
    return NextResponse.json({ error: parsed.errors[0].message }, { status: 400 });
  }

  const rows = parsed.data as string[][];
  const headerRow = rows[0] ?? [];
  const columns =
    headerRow.length && headerRow.every((cell) => typeof cell === "string" && cell.length > 0)
      ? headerRow
      : headerRow.map((_, index) => `col_${index + 1}`);

  const previewRows = rows.slice(0, MAX_PREVIEW_ROWS);

  const { error: uploadError } = await supabaseAdmin.storage
    .from("uploads")
    .upload(storagePath, buffer, {
      contentType: file.type || "text/csv",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: uploadRow, error: insertError } = await supabaseAdmin
    .from("uploads")
    .insert({
      user_id: userId,
      kind: "csv",
      storage_path: storagePath,
      original_name: file.name,
      status: "uploaded",
      columns,
      preview: previewRows,
    })
    .select("id")
    .single();

  if (insertError || !uploadRow) {
    return NextResponse.json({ error: insertError?.message ?? "Failed to create upload" }, { status: 500 });
  }

  return NextResponse.json({ upload_id: uploadRow.id, columns, preview: previewRows });
}
