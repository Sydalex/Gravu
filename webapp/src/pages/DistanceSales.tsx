import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Trader identity",
    content: (
      <>
        <ul>
          <li><strong>Trader:</strong> {LEGAL_CONFIG.legalEntityName}</li>
          <li><strong>Representative:</strong> {LEGAL_CONFIG.legalRepresentative}</li>
          <li><strong>Address:</strong> {LEGAL_CONFIG.legalAddress}</li>
          <li><strong>Email:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a></li>
        </ul>
      </>
    ),
  },
  {
    title: "Service description",
    content: (
      <>
        <p>
          <strong>{LEGAL_CONFIG.productName}</strong> is a digital service for processing user-supplied files
          into vector-style outputs and related assets. Available features, supported file types, limits, and
          prices are shown on the website or at checkout.
        </p>
      </>
    ),
  },
  {
    title: "How contracts are formed",
    content: (
      <>
        <ul>
          <li>You select a plan, credit pack, or other paid service and proceed through checkout.</li>
          <li>You can review and correct input errors before submitting the order.</li>
          <li>The contract is formed when we accept the order and payment is successfully initiated or confirmed.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Prices and payment",
    content: (
      <>
        <p>
          Prices shown on the website are the prices applicable at the time of checkout unless obvious error
          correction is required. Payment processing is handled through Stripe or another provider shown during
          checkout.
        </p>
      </>
    ),
  },
  {
    title: "Performance and digital-service start",
    content: (
      <>
        <p>
          The service is provided digitally. In many cases performance begins immediately after purchase or as
          soon as you submit an upload for processing.
        </p>
        <p>
          If required by applicable consumer law, we may ask for your express request to begin performance
          immediately and your acknowledgement of any resulting loss of withdrawal rights for digital content
          or digital services.
        </p>
      </>
    ),
  },
  {
    title: "Withdrawal and cancellation information",
    content: (
      <>
        <p>
          Statutory withdrawal rights for consumers may apply unless an exception for digital content or
          digital services applies. See our Refunds & Cancellation page for the operational rules we apply in
          practice.
        </p>
      </>
    ),
  },
  {
    title: "Contract language and storage",
    content: (
      <>
        <ul>
          <li>The contract language is the language used on the checkout flow unless stated otherwise.</li>
          <li>Order and billing records may be retained electronically for legal and accounting purposes.</li>
        </ul>
      </>
    ),
  },
];

const DistanceSales = () => (
  <LegalPage
    title="Distance Sales & Consumer Information"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.supportEmail}
    subtitle={
      <p>
        This page provides the core consumer information typically required before a digital-service purchase,
        including trader identity, pricing context, contract formation, and performance timing.
      </p>
    }
    footerNote={
      <p>
        Replace the trader identity fields before launch. If you operate as a sole proprietor in Germany, use
        your real full name and service address.
      </p>
    }
    sections={sections}
  />
);

export default DistanceSales;

