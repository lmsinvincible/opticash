import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { supabaseAdmin } from "@/lib/supabase/admin";

const formatCents = (value: string | number) => {
  const cents = typeof value === "string" ? Number(value) : value;
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(euros);
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing access token" }), { status: 401 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
  }
  const userId = userData.user.id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_premium")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.is_premium) {
    return new Response(JSON.stringify({ error: "Premium required" }), { status: 402 });
  }

  const { data: planRow, error: planError } = await supabaseAdmin
    .from("plans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (planError || !planRow) {
    return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404 });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("plan_items")
    .select("*")
    .eq("plan_id", planRow.id)
    .order("position", { ascending: true })
    .limit(10);

  if (itemsError) {
    return new Response(JSON.stringify({ error: "Failed to load plan items" }), { status: 500 });
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 790;
  const left = 50;
  const lineHeight = 18;

  page.drawText("OptiCash — Ton plan d’économies", {
    x: left,
    y,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 30;

  page.drawText(`Généré le : ${new Date().toLocaleDateString("fr-FR")}`, {
    x: left,
    y,
    size: 11,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 18;

  page.drawText(`Gain estimé : ${formatCents(planRow.total_gain_estimated_yearly_cents)} / an`, {
    x: left,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;

  page.drawText("Actions prioritaires", {
    x: left,
    y,
    size: 13,
    font: fontBold,
  });
  y -= 20;

  page.drawText("#  Action                               Statut    Gain/an    Effort", {
    x: left,
    y,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 12;

  (items ?? []).forEach((item, index) => {
    const status = String(item.status ?? "todo");
    const gain = formatCents(item.gain_estimated_yearly_cents);
    const effort = `${item.effort_minutes ?? 0} min`;
    const title = String(item.action_title ?? "").slice(0, 30);

    page.drawText(`${index + 1}`.padEnd(3, " "), {
      x: left,
      y,
      size: 10,
      font,
    });
    page.drawText(title, {
      x: left + 20,
      y,
      size: 10,
      font,
    });
    page.drawText(status, {
      x: left + 270,
      y,
      size: 10,
      font,
    });
    page.drawText(gain, {
      x: left + 340,
      y,
      size: 10,
      font,
    });
    page.drawText(effort, {
      x: left + 430,
      y,
      size: 10,
      font,
    });
    y -= lineHeight;
    if (y < 120) {
      y = 790;
      pdfDoc.addPage([595.28, 841.89]);
    }
  });

  y -= 10;
  page.drawText("Notes & hypothèses", {
    x: left,
    y,
    size: 12,
    font: fontBold,
  });
  y -= 16;
  page.drawText(
    "Estimations basées sur les données importées. Les gains peuvent varier selon votre situation.",
    {
      x: left,
      y,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    }
  );
  y -= 22;
  page.drawText(
    "Ce document ne constitue pas un conseil fiscal, juridique ou financier.",
    {
      x: left,
      y,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    }
  );

  const pdfBytes = await pdfDoc.save();
  const pdfBuffer = Buffer.from(pdfBytes);

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"opticash-plan.pdf\"",
    },
  });
}
