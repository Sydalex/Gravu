import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'info@gravu.app';
const LAST_UPDATED = 'November 15, 2025';

const sections = [
  {
    number: '1',
    title: 'Data Controller',
    content: (
      <p>
        Under the Personal Data Protection Law No. 6698 (KVKK) and the General Data Protection Regulation
        (GDPR), the data controller for personal data collected through <strong>gravu.app</strong> is{' '}
        <strong>gravu.app</strong>. You may contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a> for
        any privacy-related inquiries.
      </p>
    ),
  },
  {
    number: '2',
    title: 'Data We Collect',
import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Who controls your data",
    content: (
      <>
        <p>
          The controller for personal data collected through <strong>{LEGAL_CONFIG.websiteName}</strong> is{" "}
          <strong>{LEGAL_CONFIG.legalEntityName}</strong>, {LEGAL_CONFIG.legalAddress}.
        </p>
        <p>
          You can contact us for privacy matters at{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>.
        </p>
      </>
    ),
  },
  {
    title: "What data we collect",
    content: (
      <>
        <ul>
          <li>account data such as your email address, password hash, and authentication records,</li>
          <li>uploaded files and images you submit for processing,</li>
          <li>generated results and export files such as SVG and DXF outputs,</li>
          <li>billing and subscription data such as Stripe customer IDs and plan status,</li>
          <li>support communications, and</li>
          <li>technical logs such as IP address, browser metadata, and error records.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Why we process data",
    content: (
      <>
        <p>We process personal data to:</p>
        <ul>
          <li>create and manage your account,</li>
          <li>authenticate you and secure the service,</li>
          <li>process uploads and generate requested outputs,</li>
          <li>bill subscriptions and handle payments, refunds, and fraud prevention,</li>
          <li>provide support and respond to complaints or legal notices, and</li>
          <li>comply with legal obligations and enforce our Terms of Use.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Legal bases",
    content: (
      <>
        <ul>
          <li><strong>Contract:</strong> to provide the service you requested.</li>
          <li><strong>Legitimate interests:</strong> to secure, improve, and defend the service.</li>
          <li><strong>Legal obligation:</strong> to meet tax, accounting, consumer, and other legal duties.</li>
          <li>
            <strong>Consent:</strong> where we rely on consent, for example if you explicitly agree to a
            particular optional processing activity.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Processors and recipients",
    content: (
      <>
        <p className="mb-3">gravu.app uses minimal cookies necessary for the service to function:</p>
        <ul className="space-y-2">
          <li><strong>Session cookies</strong> — to keep you logged in during your browser session (essential)</li>
          <li><strong>Authentication tokens</strong> — stored in secure HTTP-only cookies to verify your identity (essential)</li>
        <p>We use service providers that help us run the platform, such as:</p>
        <ul>
          <li>hosting and infrastructure providers, including Hetzner,</li>
          <li>payment processors, including Stripe,</li>
          <li>email delivery providers where email features are enabled, and</li>
          <li>
            AI or processing providers used to perform features you request, where applicable to the chosen
            workflow.
          </li>
        </ul>
        <p>
          We share personal data only where reasonably necessary to operate the service, comply with the law,
          or protect our rights.
        </p>
      </>
    ),
  },
  {
    title: "Uploads containing people or third-party material",
    content: (
      <>
        <p>
          Uploads may contain personal data, including images of identifiable people or third-party protected
          works. You are responsible for ensuring you have a lawful basis and any required permissions before
          uploading such material.
        </p>
        <p>
          We process those uploads only to provide the requested service, enforce our rules, and meet legal
          obligations.
        </p>
      </>
    ),
  },
  {
    title: "Retention",
    content: (
      <p>
        gravu.app is not directed at children under the age of 18. We do not knowingly collect personal
        data from minors. If you believe a child has provided us with personal data, please contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a>{' '}
        and we will delete it promptly.
      </p>
      <>
        <ul>
          <li>account data is kept while your account remains open and for a limited period afterward,</li>
          <li>billing records may be retained for statutory tax and accounting periods,</li>
          <li>support and legal records are retained as needed to resolve disputes and comply with law, and</li>
          <li>logs are retained only as long as reasonably necessary for security and troubleshooting.</li>
        </ul>
      </>
    ),
  },
  {
    title: "International transfers",
    content: (
      <>
        <p>
          Some providers may process data outside the EU or EEA. Where that happens, we rely on appropriate
          safeguards such as adequacy decisions or Standard Contractual Clauses where required.
        </p>
      </>
    ),
  },
  {
    title: "Your rights",
    content: (
      <>
        <ul>
          <li>access your personal data,</li>
          <li>request correction of inaccurate data,</li>
          <li>request deletion where the law allows it,</li>
          <li>request restriction or object to certain processing,</li>
          <li>receive portable data where applicable, and</li>
          <li>withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          You can also lodge a complaint with your local supervisory authority if you believe your rights have
          been infringed.
        </p>
      </>
    ),
  },
  {
    title: "Security and children",
    content: (
      <>
        <ul>
          <li>We use technical and organizational measures intended to protect data in transit and at rest.</li>
          <li>
            The service is not directed at children, and you should not use it if you are not old enough to
            form a binding contract in your jurisdiction.
          </li>
        </ul>
      </>
    ),
  },
];

const PrivacyPolicy = () => {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This policy explains what personal data <strong className="text-foreground">gravu.app</strong>{' '}
            collects, why we collect it, how we use it, and what rights you have over it.
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
          transition={{ duration: 0.4, delay: 0.6 }}
          className="mt-10 rounded-2xl border border-border bg-card p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Questions about your data?</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Contact our privacy team — we respond within 30 days.
              </p>
            </div>
            <a href={`mailto:${SUPPORT_EMAIL}`}>
              <Button className="gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 sm:flex-shrink-0">
                <Mail className="h-3.5 w-3.5" />
                Contact Us
              </Button>
            </a>
          </div>
          <div className="mt-4 border-t border-border/60 pt-4 space-y-1">
            <p className="font-mono text-xs text-muted-foreground/60">{SUPPORT_EMAIL}</p>

          </div>
        </motion.div>
      </div>
    </div>
  );
};
const PrivacyPolicy = () => (
  <LegalPage
    title="Privacy Policy"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        This policy explains what personal data <strong>{LEGAL_CONFIG.productName}</strong> processes, why we
        process it, and what rights you have.
      </p>
    }
    footerNote={
      <p>
        Before launch, replace the controller identity, address, and retention details with your final legal
        and operational information.
      </p>
    }
    sections={sections}
  />
);

export default PrivacyPolicy;

