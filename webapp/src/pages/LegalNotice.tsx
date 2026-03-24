import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Provider information",
    content: (
      <>
        <ul>
          <li><strong>Name / business:</strong> {LEGAL_CONFIG.legalEntityName}</li>
          <li><strong>Representative:</strong> {LEGAL_CONFIG.legalRepresentative}</li>
          <li><strong>Address:</strong> {LEGAL_CONFIG.legalAddress}</li>
          <li><strong>Email:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a></li>
          <li><strong>VAT ID:</strong> {LEGAL_CONFIG.vatId}</li>
          <li><strong>Tax note:</strong> {LEGAL_CONFIG.taxNote}</li>
          <li><strong>Register details:</strong> {LEGAL_CONFIG.commercialRegister}</li>
        </ul>
      </>
    ),
  },
  {
    title: "Responsible for content",
    content: (
      <>
        <p>
          Responsible for content under applicable law: <strong>{LEGAL_CONFIG.legalRepresentative}</strong>,{" "}
          {LEGAL_CONFIG.legalAddress}.
        </p>
      </>
    ),
  },
  {
    title: "Consumer dispute resolution",
    content: (
      <>
        <p>
          We are {`[willing / not willing / obliged]`} to participate in dispute resolution proceedings before
          a consumer arbitration board.
        </p>
        <p>
          Competent body, if applicable: <strong>{LEGAL_CONFIG.consumerDisputeBody}</strong>.
        </p>
      </>
    ),
  },
  {
    title: "No old EU ODR link",
    content: (
      <>
        <p>
          Do not add the old EU online dispute resolution platform link. The ODR platform was discontinued on
          July 20, 2025.
        </p>
      </>
    ),
  },
];

const LegalNotice = () => (
  <LegalPage
    title="Legal Notice / Impressum"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        This page is the place for your provider identity and German/EU trader disclosure details. The fields
        below are placeholders until you replace them with your real business information.
      </p>
    }
    footerNote={
      <p>
        This page is placeholder-heavy on purpose. Do not publish it unchanged. Replace every bracketed field
        with your real legal details first.
      </p>
    }
    sections={sections}
  />
);

export default LegalNotice;
