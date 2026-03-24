import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Scope of this policy",
    content: (
      <>
        <p>
          This page explains how <strong>{LEGAL_CONFIG.productName}</strong> handles cancellations,
          refunds, subscriptions, credits, and other paid digital-service issues.
        </p>
      </>
    ),
  },
  {
    title: "Free process, subscriptions, and credits",
    content: (
      <>
        <ul>
          <li>New users may receive one free successful process, subject to anti-abuse controls.</li>
          <li>Further paid usage may require a subscription, a credit purchase, or both.</li>
          <li>
            The active pricing, credit amount, and checkout terms shown in your account or at checkout
            control the specific offer you buy.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Digital-service performance and withdrawal",
    content: (
      <>
        <p>
          {LEGAL_CONFIG.productName} is a digital service. Performance may begin immediately after
          purchase or as soon as you submit a paid request for processing.
        </p>
        <p>
          If applicable law permits it, we may ask you to confirm that performance should begin
          immediately and that statutory withdrawal rights may end once performance starts.
        </p>
      </>
    ),
  },
  {
    title: "Subscriptions and cancellation",
    content: (
      <>
        <ul>
          <li>You may cancel a paid subscription for the next billing period at any time.</li>
          <li>
            Cancellation stops future renewals but does not usually refund the current period that has
            already started.
          </li>
          <li>
            Unless stated otherwise at checkout, paid features remain available until the end of the
            already-paid period.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Credits, usage, and failed jobs",
    content: (
      <>
        <ul>
          <li>Credits or included usage are consumed only when the paid processing request succeeds.</li>
          <li>
            If a job fails because of a platform-side issue, we may retry it or restore the affected
            usage where technically possible.
          </li>
          <li>
            Unused credits, free-trial access, or promotional entitlements are not redeemable for cash
            unless required by law.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "When refunds may be granted",
    content: (
      <>
        <ul>
          <li>duplicate charges for the same order or renewal,</li>
          <li>material billing errors,</li>
          <li>a paid service that could not be delivered because of a platform fault,</li>
          <li>cases where we are legally required to refund, or</li>
          <li>other situations where we expressly agree to a goodwill refund.</li>
        </ul>
      </>
    ),
  },
  {
    title: "When refunds are normally not granted",
    content: (
      <>
        <ul>
          <li>you changed your mind after digital performance already started,</li>
          <li>you uploaded the wrong file or used unsuitable instructions,</li>
          <li>you are dissatisfied with the source material you supplied, or</li>
          <li>the request concerns already-used credits or already-delivered paid outputs.</li>
        </ul>
      </>
    ),
  },
  {
    title: "How to request a refund",
    content: (
      <>
        <p>
          Send refund requests to{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a> and include:
        </p>
        <ul>
          <li>the account email address,</li>
          <li>the date of the charge,</li>
          <li>the Stripe receipt or transaction reference if available,</li>
          <li>a short explanation of the issue, and</li>
          <li>screenshots or other supporting material where relevant.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Review and payout timing",
    content: (
      <>
        <ul>
          <li>We aim to review refund requests within 5 business days.</li>
          <li>We may request more information before deciding.</li>
          <li>
            Approved refunds are usually returned through the original payment method, subject to Stripe
            and card-network timelines.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Policy changes",
    content: (
      <>
        <p>
          We may update this policy if the product, pricing model, or legal requirements change. Updated
          versions become effective when published on the site unless a later date is stated.
        </p>
      </>
    ),
  },
];

const Policy = () => (
  <LegalPage
    title="Refunds & Cancellation"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        This policy covers the paid side of Gravu: subscriptions, credit packs, cancellations, refunds,
        and what happens when a paid job fails.
      </p>
    }
    footerNote={
      <p>
        This page was updated for the current Gravu model of one free successful process followed by paid
        subscriptions or credit purchases. Final checkout wording should still be reviewed against your
        live Stripe setup and consumer-law advice.
      </p>
    }
    sections={sections}
  />
);

export default Policy;
