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

