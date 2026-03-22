import Stripe from "stripe";
import { env } from "./env";

// Stripe is optional – only initialised when STRIPE_SECRET is set.
// Billing routes will return 503 if this is null.
export const stripe = env.STRIPE_SECRET
  ? new Stripe(env.STRIPE_SECRET, { apiVersion: "2026-02-25.clover" })
  : null;
