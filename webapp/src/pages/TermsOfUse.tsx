import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Acceptance and scope",
    content: (
      <>
        <p>
          These Terms of Use govern your access to and use of <strong>{LEGAL_CONFIG.productName}</strong> at{" "}
          <strong>{LEGAL_CONFIG.websiteName}</strong>.
        </p>
        <p>
          By creating an account, purchasing a plan, or using the service, you agree to these terms. If you
          do not agree, do not use the service.
        </p>
      </>
    ),
  },
  {
    title: "Eligibility and accounts",
    content: (
      <>
        <ul>
          <li>You must be legally capable of entering into a binding contract.</li>
          <li>You must provide accurate account information and keep your login credentials secure.</li>
          <li>You are responsible for activity carried out through your account.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Service description",
    content: (
      <>
        <p>
          The service allows you to upload files and generate vector-style outputs and related assets. Parts
          of the service may use automated processing, AI-assisted workflows, and third-party providers.
        </p>
        <p>
          Features, limits, file types, and prices may change over time. We may also introduce paid tiers,
          quotas, and credits.
        </p>
      </>
    ),
  },
  {
    title: "Your uploads and your responsibility",
    content: (
      <>
        <p>You may upload only material that you are legally allowed to use and process.</p>
        <ul>
          <li>
            If you upload copyrighted or trademarked material, you represent that you own it or have a valid
            license or permission.
          </li>
          <li>
            If you upload images of identifiable people, you represent that you have any required consent,
            publicity, privacy, or data-protection permissions.
          </li>
          <li>
            You are solely responsible for the legality of your uploads, your prompts, your instructions, and
            your downstream use of the generated outputs.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "License you grant to us",
    content: (
      <>
        <p>
          You grant us a limited, non-exclusive, revocable license to host, store, process, reproduce, and
          transmit your uploads and related data solely as necessary to operate, secure, troubleshoot, and
          improve the service, and to comply with legal obligations.
        </p>
      </>
    ),
  },
  {
    title: "Prohibited uses",
    content: (
      <>
        <ul>
          <li>Uploading illegal content or facilitating unlawful conduct.</li>
          <li>Uploading child sexual abuse material or exploitative imagery of minors.</li>
          <li>Uploading non-consensual intimate imagery.</li>
          <li>Infringing copyright, trademark, privacy, publicity, or other third-party rights.</li>
          <li>Uploading or generating hateful, harassing, defamatory, or fraudulent material.</li>
          <li>Attempting to probe, reverse engineer, abuse, or disrupt the service or other users.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Moderation, removals, and enforcement",
    content: (
      <>
        <p>
          We may remove content, disable access, restrict features, suspend accounts, or report material to
          relevant authorities where we reasonably believe this is necessary to enforce these terms, protect
          users, or comply with the law.
        </p>
        <p>
          We are not obliged to monitor all uploads, but we may review content and account activity where
          appropriate.
        </p>
      </>
    ),
  },
  {
    title: "Outputs and no guarantees",
    content: (
      <>
        <p>
          Generated outputs may contain errors, omissions, distortions, or rights issues depending on the
          source material and processing mode. You must review outputs before relying on them for production,
          commercial, or legal purposes.
        </p>
      </>
    ),
  },
  {
    title: "Payments and plans",
    content: (
      <>
        <p>
          Paid plans, credits, and promotional offers are governed by the checkout terms shown at purchase and
          our Refunds & Cancellation page.
        </p>
      </>
    ),
  },
  {
    title: "Liability and governing law",
    content: (
      <>
        <p>
          To the maximum extent permitted by law, we are not liable for indirect, incidental, special, or
          consequential losses, or for content uploaded by users. Nothing in these terms excludes liability
          that cannot lawfully be excluded.
        </p>
        <p>
          These terms are governed by the laws of {LEGAL_CONFIG.country}, except where mandatory consumer law
          in your country of residence provides otherwise.
        </p>
      </>
    ),
  },
];

const TermsOfUse = () => (
  <LegalPage
    title="Terms of Use"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        These terms set the rules for using <strong>{LEGAL_CONFIG.productName}</strong>, including what you
        may upload, how we may act on reported content, and how responsibility is allocated.
      </p>
    }
    footerNote={
      <p>
        This is a first-pass terms draft. It should be reviewed against your final pricing model, moderation
        process, and launch jurisdictions.
      </p>
    }
    sections={sections}
  />
);

export default TermsOfUse;

