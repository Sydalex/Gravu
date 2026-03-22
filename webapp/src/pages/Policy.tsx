import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'info@gravu.app';
const LAST_UPDATED = 'November 15, 2025';

const sections = [
  {
    number: '1',
    title: 'General Provisions',
    content: (
      <p>
        This Refund and Cancellation Policy regulates the refund and service cancellation conditions for
        digital credits purchased through <strong>gravu.app</strong> ("Seller"). It has been prepared
        within the framework of the Consumer Protection Law No. 6502 and the Distance Contracts Regulation.
      </p>
    ),
  },
  {
    number: '2',
    title: 'Digital Content and Right of Withdrawal',
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
        <ul className="space-y-2">
          <li>For goods provided as digital content or digital services, the right of withdrawal cannot be exercised if performance begins with the consumer's consent.</li>
          <li>gravu.app credits are loaded to your account instantly upon completion of the purchase transaction and are ready for use.</li>
          <li>Therefore, <strong>there is no right of withdrawal for credit purchase transactions.</strong></li>
        </ul>
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
  {
    number: '10',
    title: 'Changes to the Policy',
    content: (
      <p>
        gravu.app reserves the right to update this policy. Changes will be announced on the website
        and will become effective immediately.
      </p>
    ),
  },
];

const Policy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Minimal header */}
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-12 space-y-3"
        >
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Legal
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/60">v1.0</span>
          </div>
          <h1
            className="text-3xl font-bold text-foreground md:text-4xl"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            Refund and Cancellation Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-1">
          {sections.map((section, i) => (
            <motion.div
              key={section.number}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 + i * 0.04 }}
              className="group rounded-xl border border-transparent hover:border-border hover:bg-card transition-all duration-200 px-5 py-5"
            >
              <div className="flex gap-4">
                {/* Section number */}
                <div className="flex-shrink-0 pt-0.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary font-mono text-[11px] font-semibold text-muted-foreground">
                    {section.number}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    className="mb-3 text-base font-semibold text-foreground"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_ul]:ml-4 [&_ul]:list-none [&_ul>li]:relative [&_ul>li]:pl-4 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-accent [&_ul>li]:before:content-['—'] [&_strong]:font-semibold [&_strong]:text-foreground">
                    {section.content}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-10 rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Have a question or refund request?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Our support team typically responds within 1–2 business days.
              </p>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Button className="gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 sm:flex-shrink-0">
                <Mail className="h-3.5 w-3.5" />
                Contact Support
              </Button>
            </a>
          </div>
          <div className="mt-4 border-t border-border/60 pt-4">
            <p className="font-mono text-xs text-muted-foreground/60">{SUPPORT_EMAIL}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
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

