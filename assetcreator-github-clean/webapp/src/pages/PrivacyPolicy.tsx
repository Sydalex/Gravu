import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SUPPORT_EMAIL = 'info@asset-creator.com';
const LAST_UPDATED = 'November 15, 2025';

const sections = [
  {
    number: '1',
    title: 'Data Controller',
    content: (
      <p>
        Under the Personal Data Protection Law No. 6698 (KVKK) and the General Data Protection Regulation
        (GDPR), the data controller for personal data collected through <strong>asset-creator.com</strong> is{' '}
        <strong>asset-creator.com</strong>. You may contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a> for
        any privacy-related inquiries.
      </p>
    ),
  },
  {
    number: '2',
    title: 'Data We Collect',
    content: (
      <>
        <p className="mb-3">We collect the following categories of personal data:</p>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">2.1 Account Data</h4>
            <ul className="space-y-1.5">
              <li>Email address (used for registration, login, and OTP verification)</li>
              <li>Password (stored as a secure hash, never in plain text)</li>
              <li>Account creation date and last login timestamp</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">2.2 Usage Data</h4>
            <ul className="space-y-1.5">
              <li>Files you upload for vectorisation (architectural drawings, DWG/raster images)</li>
              <li>SVG and DXF output files generated for your account</li>
              <li>Conversion history stored in your personal library</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">2.3 Payment Data</h4>
            <ul className="space-y-1.5">
              <li>Subscription status and plan type (Free / Pro)</li>
              <li>Stripe Customer ID (used to manage billing — we do not store card numbers)</li>
              <li>Payment date and subscription period dates</li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-2">2.4 Technical Data</h4>
            <ul className="space-y-1.5">
              <li>IP address and browser/device type (via server logs)</li>
              <li>Session tokens for authentication</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },
  {
    number: '3',
    title: 'Purpose and Legal Basis for Processing',
    content: (
      <>
        <p className="mb-3">We process your personal data for the following purposes:</p>
        <ul className="space-y-2">
          <li><strong>Providing the service</strong> — to operate your account, process your uploads, and deliver vectorisation results (contractual necessity)</li>
          <li><strong>Authentication and security</strong> — to verify your identity, prevent fraud, and protect account access (legitimate interest)</li>
          <li><strong>Billing and subscriptions</strong> — to manage payments and subscription status via Stripe (contractual necessity)</li>
          <li><strong>Legal compliance</strong> — to meet obligations under Turkish law (KVKK), EU law (GDPR), and financial regulations (legal obligation)</li>
          <li><strong>Customer support</strong> — to respond to your enquiries, refund requests, and complaints (legitimate interest)</li>
        </ul>
      </>
    ),
  },
  {
    number: '4',
    title: 'Data Sharing and Third Parties',
    content: (
      <>
        <p className="mb-3">
          We do not sell your personal data. We share data only with the following trusted service providers
          that are necessary to operate the platform:
        </p>
        <ul className="space-y-2">
          <li><strong>Stripe Inc.</strong> — payment processing and subscription management (USA; adequacy through SCCs)</li>
          <li><strong>Vectoriser.AI</strong> — cloud-based SVG vectorisation processing (your uploaded images are sent to this service)</li>
          <li><strong>Hosting provider</strong> — our servers run on cloud infrastructure within the EU/EEA where possible</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground/70">
          Each third party is bound by their own privacy policy and relevant data processing agreements.
        </p>
      </>
    ),
  },
  {
    number: '5',
    title: 'Data Retention',
    content: (
      <ul className="space-y-2">
        <li>Account data is retained for the duration of your account and up to <strong>3 years</strong> after deletion (for legal obligations)</li>
        <li>Uploaded images and generated vector files are stored until you delete them or close your account</li>
        <li>Payment records are retained for <strong>10 years</strong> as required by Turkish tax law</li>
        <li>Server logs are retained for up to <strong>90 days</strong></li>
      </ul>
    ),
  },
  {
    number: '6',
    title: 'Your Rights',
    content: (
      <>
        <p className="mb-3">
          Under KVKK (Article 11) and GDPR (Articles 15–22), you have the following rights regarding your
          personal data:
        </p>
        <ul className="space-y-2">
          <li><strong>Right to information</strong> — to know whether your data is being processed</li>
          <li><strong>Right of access</strong> — to request a copy of all personal data we hold about you</li>
          <li><strong>Right to rectification</strong> — to correct inaccurate or incomplete data</li>
          <li><strong>Right to erasure</strong> — to request deletion of your data ("right to be forgotten")</li>
          <li><strong>Right to restriction</strong> — to limit how we process your data</li>
          <li><strong>Right to data portability</strong> — to receive your data in a machine-readable format</li>
          <li><strong>Right to object</strong> — to object to processing based on legitimate interest</li>
          <li><strong>Right to withdraw consent</strong> — where processing is based on consent, you may withdraw at any time</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, contact us at{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a>.
          We will respond within <strong>30 days</strong>.
        </p>
      </>
    ),
  },
  {
    number: '7',
    title: 'Cookies and Tracking',
    content: (
      <>
        <p className="mb-3">asset-creator.com uses minimal cookies necessary for the service to function:</p>
        <ul className="space-y-2">
          <li><strong>Session cookies</strong> — to keep you logged in during your browser session (essential)</li>
          <li><strong>Authentication tokens</strong> — stored in secure HTTP-only cookies to verify your identity (essential)</li>
        </ul>
        <p className="mt-3">
          We do not use advertising cookies, cross-site tracking, or analytics tools that share data with
          third parties.
        </p>
      </>
    ),
  },
  {
    number: '8',
    title: 'Data Security',
    content: (
      <ul className="space-y-2">
        <li>All data transmission is encrypted using TLS/HTTPS</li>
        <li>Passwords are hashed using industry-standard algorithms and are never stored in plain text</li>
        <li>Access to production systems is restricted to authorised personnel only</li>
        <li>We conduct regular security reviews of our infrastructure and dependencies</li>
        <li>In the event of a data breach, we will notify affected users and relevant authorities within the legally required timeframe</li>
      </ul>
    ),
  },
  {
    number: '9',
    title: 'Children\'s Privacy',
    content: (
      <p>
        asset-creator.com is not directed at children under the age of 18. We do not knowingly collect personal
        data from minors. If you believe a child has provided us with personal data, please contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent hover:underline">{SUPPORT_EMAIL}</a>{' '}
        and we will delete it promptly.
      </p>
    ),
  },
  {
    number: '10',
    title: 'International Transfers',
    content: (
      <p>
        Some of our service providers (such as Stripe) are based outside the EU/EEA and Turkey. Where
        personal data is transferred internationally, we ensure appropriate safeguards are in place,
        including Standard Contractual Clauses (SCCs) as approved by the European Commission, or reliance
        on adequacy decisions. Transfers to Turkey-based infrastructure are compliant with KVKK
        cross-border transfer provisions.
      </p>
    ),
  },
  {
    number: '11',
    title: 'Changes to This Policy',
    content: (
      <p>
        We may update this Privacy Policy from time to time to reflect changes in law, our practices, or
        the services we offer. When we make material changes, we will update the "Last updated" date at
        the top of this page and, where appropriate, notify you by email. Continued use of the service
        after changes take effect constitutes acceptance of the revised policy.
      </p>
    ),
  },
  {
    number: '12',
    title: 'Supervisory Authority',
    content: (
      <>
        <p className="mb-3">
          If you believe we have not handled your personal data in accordance with applicable law, you
          have the right to lodge a complaint with the relevant supervisory authority:
        </p>
        <ul className="space-y-2">
          <li><strong>EU/EEA:</strong> Your local Data Protection Authority (DPA)</li>
          <li><strong>UK:</strong> Information Commissioner's Office (ICO) — <span className="font-mono text-xs">ico.org.uk</span></li>
        </ul>
      </>
    ),
  },
];

const PrivacyPolicy = () => {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {LAST_UPDATED}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This policy explains what personal data <strong className="text-foreground">asset-creator.com</strong>{' '}
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

export default PrivacyPolicy;
