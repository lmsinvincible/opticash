import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

const getPriceId = (interval: string | undefined) => {
  if (interval === "yearly") return process.env.STRIPE_PRICE_ID_YEARLY;
  return process.env.STRIPE_PRICE_ID_MONTHLY;
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Missing access token" }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = userData.user.id;
    const email = userData.user.email;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;

    if (!customerId) {
      const stripe = getStripe();
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { user_id: userId },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", userId);
    }

    const body = await request.json().catch(() => ({}));
    const interval = body?.interval as string | undefined;
    const priceId = getPriceId(interval);

    if (!priceId) {
      return NextResponse.json({ error: "Missing Stripe price id" }, { status: 500 });
    }

    const appUrl = process.env.APP_URL || "http://localhost:3001";

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/upgrade/success`,
      cancel_url: `${appUrl}/upgrade/cancel`,
      allow_promotion_codes: true,
      metadata: { user_id: userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
