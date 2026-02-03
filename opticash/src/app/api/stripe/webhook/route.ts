import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Missing webhook secret", { status: 500 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const handleSubscriptionUpdate = async (subscription: Stripe.Subscription) => {
    const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
    const isActive = subscription.status === "active" || subscription.status === "trialing";
    const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number })
      .current_period_end;
    const premiumUntil = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

    await supabaseAdmin
      .from("profiles")
      .update({
        is_premium: isActive,
        premium_until: isActive ? premiumUntil : null,
      })
      .eq("stripe_customer_id", customerId);
  };

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await handleSubscriptionUpdate(subscription);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      default:
        break;
    }
  } catch {
    return new Response("Webhook handler failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
