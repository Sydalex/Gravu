import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Controller and scope",
    content: (
      <>
        <p>
          This privacy policy explains how <strong>{LEGAL_CONFIG.productName}</strong> handles personal
          data when you use the service, create an account, upload source material, buy credits or
          subscriptions, or contact support.
        </p>
        <p>
          Unless another controller is identified in a specific workflow, the controller is{" "}
          <strong>{LEGAL_CONFIG.legalEntityName}</strong>. You can reach us at{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>.
        </p>
      </>
    ),
  },
  {
    title: "Data we collect",
    content: (
      <>
        <ul>
          <li>account data such as your email address, authentication records, and profile details,</li>
          <li>uploads, prompts, selected subjects, generated linework, and export files,</li>
          <li>billing data such as Stripe customer identifiers, subscription state, and receipts,</li>
          <li>support messages, moderation reports, and legal correspondence, and</li>
          <li>
            technical and security data such as IP logs, browser metadata, device-token records, and
            service diagnostics.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Why we process data",
    content: (
      <>
        <p>We process personal data in order to:</p>
        <ul>
          <li>create and maintain user accounts,</li>
          <li>authenticate users and keep the service secure,</li>
          <li>process uploads into requested outputs such as PNG, SVG, and DXF files,</li>
          <li>operate subscriptions, credits, invoices, refunds, and payment support,</li>
          <li>detect fraud, abuse, duplicate free-trial claims, and service misuse,</li>
          <li>review complaints about uploads, copyright, or illegal content, and</li>
          <li>comply with legal obligations and defend legal claims.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Legal bases",
    content: (
      <>
        <ul>
          <li>
            <strong>Contract:</strong> we need certain data to provide the service you asked us to
            perform.
          </li>
          <li>
            <strong>Legitimate interests:</strong> we secure the platform, prevent abuse, improve the
            service, and respond to complaints or disputes.
          </li>
          <li>
            <strong>Legal obligation:</strong> some records must be kept for tax, accounting, consumer,
            or other legal duties.
          </li>
          <li>
            <strong>Consent:</strong> where consent is required for an optional feature or communication,
            we rely on it only for that specific purpose.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "Uploads, people, and third-party material",
    content: (
      <>
        <p>
          Uploads may contain identifiable people, third-party copyright material, or other protected
          content. You are responsible for ensuring that your upload and your requested processing are
          lawful.
        </p>
        <p>
          We process uploaded material only to provide the requested workflow, apply our rules, handle
          complaints, and meet legal obligations.
        </p>
      </>
    ),
  },
  {
    title: "Fraud prevention, cookies, and device tokens",
    content: (
      <>
        <p>
          We use technical identifiers and security logs to protect the service. This can include a
          persistent device token used to prevent repeated abuse of free trials, repeated failed access
          attempts, or other suspicious activity.
        </p>
        <p>
          These measures are used for security, service integrity, and fraud prevention rather than for
          advertising profiling.
        </p>
      </>
    ),
  },
  {
    title: "Processors and recipients",
    content: (
      <>
        <p>We use service providers that help us run the platform, for example:</p>
        <ul>
          <li>hosting and infrastructure providers, including Hetzner,</li>
          <li>payment providers, including Stripe,</li>
          <li>email and authentication providers where relevant, and</li>
          <li>AI or image-processing providers used to complete requested workflows.</li>
        </ul>
        <p>
          We share data with these providers only to the extent reasonably necessary to operate the
          service, comply with the law, or protect our rights.
        </p>
      </>
    ),
  },
  {
    title: "Retention",
    content: (
      <>
        <ul>
          <li>account data is kept while your account remains active and for a limited period after,</li>
          <li>billing and tax records may be retained for statutory retention periods,</li>
          <li>support, moderation, and legal records are kept as needed to resolve disputes, and</li>
          <li>
            security logs and anti-abuse records are kept only as long as reasonably necessary for fraud
            prevention and troubleshooting.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "International transfers",
    content: (
      <>
        <p>
          Some providers may process personal data outside the EU or EEA. Where required, we rely on
          appropriate safeguards such as adequacy decisions or Standard Contractual Clauses.
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
          <li>request data portability where applicable, and</li>
          <li>withdraw consent where we rely on consent.</li>
        </ul>
        <p>
          You may also lodge a complaint with the data-protection authority competent for your place of
          residence or the controller.
        </p>
      </>
    ),
  },
  {
    title: "Security and minors",
    content: (
      <>
        <p>
          We use technical and organisational measures intended to protect personal data in transit and at
          rest. No online service can guarantee absolute security, so you should also protect your own
          credentials and devices.
        </p>
        <p>
          {LEGAL_CONFIG.productName} is not intended for children who are not legally able to use the
          service. If you believe a minor has provided data unlawfully, contact us at{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>.
        </p>
      </>
    ),
  },
];

const PrivacyPolicy = () => (
  <LegalPage
    title="Privacy Policy"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        This policy explains what personal data <strong>{LEGAL_CONFIG.productName}</strong> uses, why we
        use it, how we protect the service from abuse, and what rights you have under applicable data
        protection law.
      </p>
    }
    footerNote={
      <p>
        This draft was updated to match the current Gravu product flow, including one free process,
        subscriptions, paid credits, and device-based anti-abuse controls. It should still be reviewed
        against your final cookie banner and launch jurisdiction setup.
      </p>
    }
    sections={sections}
  />
);

export default PrivacyPolicy;
