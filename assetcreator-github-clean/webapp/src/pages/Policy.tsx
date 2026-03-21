import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'info@asset-creator.com';
const LAST_UPDATED = 'November 15, 2025';

const sections = [
  {
    number: '1',
    title: 'General Provisions',
    content: (
      <p>
        This Refund and Cancellation Policy regulates the refund and service cancellation conditions for
        digital credits purchased through <strong>asset-creator.com</strong> ("Seller"). It has been prepared
        within the framework of the Consumer Protection Law No. 6502 and the Distance Contracts Regulation.
      </p>
    ),
  },
  {
    number: '2',
    title: 'Digital Content and Right of Withdrawal',
    content: (
      <>
        <p className="mb-3">
          In accordance with Article 15 of Law No. 6502 and Article 15 of the Distance Contracts Regulation:
        </p>
        <ul className="space-y-2">
          <li>For goods provided as digital content or digital services, the right of withdrawal cannot be exercised if performance begins with the consumer's consent.</li>
          <li>asset-creator.com credits are loaded to your account instantly upon completion of the purchase transaction and are ready for use.</li>
          <li>Therefore, <strong>there is no right of withdrawal for credit purchase transactions.</strong></li>
        </ul>
      </>
    ),
  },
  {
    number: '3',
    title: 'Refund Conditions',
    content: (
      <>
        <p className="mb-4">
          Under normal circumstances, credits cannot be refunded after being delivered to your account.
          However, refund requests may be evaluated in the following exceptional cases:
        </p>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">3.1 Technical Issues</h4>
            <ul className="space-y-1.5">
              <li>Purchased credits not being loaded to the account</li>
              <li>Service being unavailable due to system errors</li>
              <li>Conversion process not being completed due to platform-related technical failures</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">3.2 Billing Errors</h4>
            <ul className="space-y-1.5">
              <li>Incorrect amount being charged</li>
              <li>Double payment being made</li>
              <li>Unwanted automatic renewal (if applicable)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">3.3 Refund Request Period</h4>
            <p>
              For the above cases, refund requests must be made to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a>{' '}
              within <strong>7 days</strong> after the purchase transaction.
            </p>
          </div>
        </div>
      </>
    ),
  },
  {
    number: '4',
    title: 'Refund Request Process',
    content: (
      <>
        <p className="mb-3">
          For a refund request, you need to send the following information to{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a>:
        </p>
        <ul className="space-y-2">
          <li>Your first name, last name, and registered email address</li>
          <li>Transaction date and transaction number</li>
          <li>Amount of credits purchased and amount paid</li>
          <li>Reason for your refund request and detailed explanation</li>
          <li>Screenshots or supporting documents, if available</li>
        </ul>
      </>
    ),
  },
  {
    number: '5',
    title: 'Refund Evaluation Process',
    content: (
      <>
        <p className="mb-3">After refund requests are received:</p>
        <ul className="space-y-2">
          <li>Your request will be reviewed within <strong>3 business days</strong> at the latest</li>
          <li>Additional information or documents may be requested if necessary</li>
          <li>If the refund is approved, the amount will be refunded to your payment card within <strong>14 days</strong></li>
          <li>If the refund is rejected, you will be notified via email with the reason</li>
        </ul>
      </>
    ),
  },
  {
    number: '6',
    title: 'Account Cancellation',
    content: (
      <>
        <p className="mb-3">You can cancel your account at any time:</p>
        <ul className="space-y-2">
          <li>For account cancellation request, apply to <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a></li>
          <li>When the account is canceled, unused credits lose their validity</li>
          <li>No refund is made for unused credits</li>
          <li>After cancellation, your data is processed within the scope of KVKK and deleted after the specified period</li>
        </ul>
      </>
    ),
  },
  {
    number: '7',
    title: 'Credit Validity and Expiration',
    content: (
      <>
        <p className="mb-3">Purchased credits are valid for a certain period:</p>
        <ul className="space-y-2">
          <li>Credit validity period is specified during purchase</li>
          <li>Unused credits are automatically deleted at the end of the period</li>
          <li>No refund or extension is made for expired credits</li>
          <li>You can track credit validity periods from your account settings</li>
        </ul>
      </>
    ),
  },
  {
    number: '8',
    title: 'Exceptions',
    content: (
      <>
        <p className="mb-3">Refunds are not made in the following cases:</p>
        <ul className="space-y-2">
          <li>Credits being partially or fully used</li>
          <li>Account being suspended or closed due to violation of service terms</li>
          <li>User-caused errors (wrong file upload, inappropriate content, etc.)</li>
          <li>Refund request period having passed (7 days)</li>
        </ul>
      </>
    ),
  },
  {
    number: '9',
    title: 'Dispute Resolution',
    content: (
      <>
        <p className="mb-3">For disputes arising from refund and cancellation issues:</p>
        <ul className="space-y-2">
          <li>It is recommended to contact via <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a> first.</li>
          <li>If no resolution is reached, you can apply to Consumer Arbitration Committees according to your place of residence.</li>
          <li>The monetary limits applicable for Consumer Arbitration Committees are updated annually in accordance with relevant legislation, and current amounts should be followed from announcements of the Ministry of Commerce and other official institutions.</li>
          <li>Consumer Courts are also authorized.</li>
        </ul>
      </>
    ),
  },
  {
    number: '10',
    title: 'Changes to the Policy',
    content: (
      <p>
        asset-creator.com reserves the right to update this policy. Changes will be announced on the website
        and will become effective immediately.
      </p>
    ),
  },
];

const Policy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
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

export default Policy;
