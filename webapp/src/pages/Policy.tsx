import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Scope of this policy",
    content: (
      <>
        <p>
          This page explains how cancellations, refunds, subscription changes, and credit adjustments are
          handled for <strong>{LEGAL_CONFIG.productName}</strong> at <strong>{LEGAL_CONFIG.websiteName}</strong>.
        </p>
        <p>
          It is a first-pass operational policy and should be read together with the Terms of Use, the
          Privacy Policy, and the consumer information page. Mandatory consumer rights under applicable law
          continue to apply even if this page says otherwise.
        </p>
      </>
    ),
  },
  {
    title: "Subscriptions and cancellation",
    content: (
      <>
        <ul>
          <li>You may cancel a paid subscription at any time for the next billing period.</li>
          <li>
            Cancellation stops future renewals but does not normally create a refund for the current billing
            period that has already started.
          </li>
          <li>
            If you cancel, paid features typically remain available until the end of the already-paid period,
            unless we state otherwise at checkout.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Credits, usage, and consumption",
    content: (
      <>
        <p>
          Where the service uses credits, quotas, or per-conversion allowances, those are consumed according
          to the active product configuration shown in your account and at checkout.
        </p>
        <ul>
          <li>Successfully completed paid conversions may consume credits or subscription usage.</li>
          <li>
            Failed platform-side jobs may be reversed, re-credited, or retried at our discretion and where
            technically possible.
          </li>
          <li>
            Unused credits, included usage, or promotional entitlements are generally not redeemable for cash
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
        <p>Refunds may be considered in particular where:</p>
        <ul>
          <li>you were charged twice for the same order or renewal,</li>
          <li>the service was unavailable due to a platform fault and the paid service was not delivered,</li>
          <li>a material billing error occurred,</li>
          <li>we are legally required to refund, or</li>
          <li>we expressly agree to a goodwill refund.</li>
        </ul>
      </>
    ),
  },
  {
    title: "When refunds are normally not granted",
    content: (
      <>
        <ul>
          <li>you changed your mind after a digital service has already been performed,</li>
          <li>you uploaded the wrong file or chose unsuitable settings,</li>
          <li>you are dissatisfied with the source material you uploaded,</li>
          <li>you breached the Terms of Use or Acceptable Use rules, or</li>
          <li>the request concerns expired or already-consumed usage, unless required by law.</li>
        </ul>
      </>
    ),
  },
  {
    title: "How to request a refund",
    content: (
      <>
        <p>
          Send your request without undue delay to{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a> and include:
        </p>
        <ul>
          <li>the email address on your account,</li>
          <li>the date of the charge,</li>
          <li>the Stripe receipt, invoice, or transaction reference if available,</li>
          <li>a short explanation of the issue, and</li>
          <li>screenshots or supporting evidence where relevant.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Review and timing",
    content: (
      <>
        <ul>
          <li>We aim to review refund requests within 5 business days.</li>
          <li>We may request additional information before deciding.</li>
          <li>
            If a refund is approved, it is usually sent back through the original payment method subject to
            Stripe and the relevant card network timelines.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Statutory withdrawal rights",
    content: (
      <>
        <p>
          If you are a consumer in the EU or EEA, statutory withdrawal rights may apply unless an exception
          for digital content or digital services applies.
        </p>
        <p>
          Where we begin performing a digital service immediately at your request, and you acknowledge any
          resulting loss of withdrawal rights to the extent permitted by law, that statutory right may expire
          once performance starts.
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
        This page covers subscription cancellation, billing issues, credits, and refund requests for{" "}
        <strong>{LEGAL_CONFIG.productName}</strong>.
      </p>
    }
    footerNote={
      <p>
        Replace this first-pass text with your final business rules before launch, and have it reviewed by a
        lawyer qualified in your sales jurisdiction.
      </p>
    }
    sections={sections}
  />
);

export default Policy;

