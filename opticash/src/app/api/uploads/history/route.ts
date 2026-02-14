import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const LIMITS = {
  free: 10,
  premium: 20,
  max: 50,
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return NextResponse.json({ error: "Missing access token" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const userId = userData.user.id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium, is_admin")
    .eq("id", userId)
    .maybeSingle();

  const isAdmin = Boolean(profile?.is_admin);
  const isPremium = Boolean(profile?.is_premium);
  const limit = isAdmin ? LIMITS.max : isPremium ? LIMITS.premium : LIMITS.free;

  const { count } = await supabaseAdmin
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  const { data: uploads, error: uploadsError } = await supabaseAdmin
    .from("uploads")
    .select("id, original_name, created_at, status, storage_path, columns, preview")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (uploadsError) {
    return NextResponse.json({ error: "Failed to load uploads" }, { status: 500 });
  }

  const items = await Promise.all(
    (uploads ?? []).map(async (upload) => {
      const { data: signed } = await supabaseAdmin.storage
        .from("uploads")
        .createSignedUrl(upload.storage_path, 60);
      return {
        id: upload.id,
        original_name: upload.original_name,
        created_at: upload.created_at,
        status: upload.status,
        columns: upload.columns ?? [],
        preview: upload.preview ?? [],
        download_url: signed?.signedUrl ?? null,
      };
    })
  );

  return NextResponse.json({
    limit,
    total: count ?? items.length,
    items,
  });
}
