import { LegalPage } from "@/components/legal/LegalPage";
import { LEGAL_CONFIG, LEGAL_LAST_UPDATED } from "@/components/legal/legalConfig";

const sections = [
  {
    title: "Purpose of this page",
    content: (
      <>
        <p>
          This page explains what content is not allowed on <strong>{LEGAL_CONFIG.productName}</strong>, how to
          report copyright infringement or illegal content, and how we may respond to notices.
        </p>
      </>
    ),
  },
  {
    title: "Content that is not allowed",
    content: (
      <>
        <ul>
          <li>copyright-infringing or trademark-infringing uploads,</li>
          <li>images of identifiable people uploaded or processed without required consent or other lawful basis,</li>
          <li>child sexual abuse material or exploitative content involving minors,</li>
          <li>non-consensual intimate imagery,</li>
          <li>terrorist, violent extremist, fraudulent, or otherwise illegal material,</li>
          <li>hate speech, threats, harassment, or defamatory content, and</li>
          <li>instructions or material intended to facilitate unlawful conduct.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Copyright complaints",
    content: (
      <>
        <p>
          If you believe uploaded material infringes your copyright or another protected right, send a notice
          to <a href={`mailto:${LEGAL_CONFIG.contentReportEmail}`}>{LEGAL_CONFIG.contentReportEmail}</a>.
        </p>
        <p>Include as much of the following as possible:</p>
        <ul>
          <li>your name and contact details,</li>
          <li>the URL or other information identifying the material,</li>
          <li>a description of the protected work or right being infringed,</li>
          <li>why you believe the use is unauthorized, and</li>
          <li>a statement that the information in your notice is accurate to the best of your knowledge.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Illegal-content and safety reports",
    content: (
      <>
        <p>
          Use the same reporting address for illegal content, privacy/publicity complaints, impersonation, or
          reports concerning non-consensual or exploitative imagery.
        </p>
        <p>
          Please include enough detail for us to identify the material, understand the basis of the complaint,
          and contact you if more information is required.
        </p>
      </>
    ),
  },
  {
    title: "What we may do after a report",
    content: (
      <>
        <ul>
          <li>remove or disable access to the reported material,</li>
          <li>seek additional information from the reporter or the affected user,</li>
          <li>suspend or terminate repeat infringers or abusive accounts, and</li>
          <li>preserve records or contact authorities where legally required or appropriate.</li>
        </ul>
      </>
    ),
  },
  {
    title: "Abuse of the reporting process",
    content: (
      <>
        <p>
          Do not submit knowingly false, misleading, or abusive notices. We may reject or deprioritize reports
          that are obviously incomplete, malicious, or repetitive without substance.
        </p>
      </>
    ),
  },
  {
    title: "Repeat infringements and appeals",
    content: (
      <>
        <p>
          We may restrict or terminate accounts that repeatedly infringe rights or repeatedly upload prohibited
          material. If you believe we removed or restricted material in error, contact{" "}
          <a href={`mailto:${LEGAL_CONFIG.supportEmail}`}>{LEGAL_CONFIG.supportEmail}</a>.
        </p>
      </>
    ),
  },
];

const ContentPolicy = () => (
  <LegalPage
    title="Copyright & Illegal Content Policy"
    lastUpdated={LEGAL_LAST_UPDATED}
    contactEmail={LEGAL_CONFIG.contentReportEmail}
    contactLabel="Report content"
    subtitle={
      <p>
        This page is your notice-and-action contact point for copyright complaints, illegal content reports,
        and complaints about uploads involving other people without required permission.
      </p>
    }
    footerNote={
      <p>
        If you later register a dedicated DMCA agent or publish a formal complaint form, update this page and
        the reporting contact details accordingly.
      </p>
    }
    sections={sections}
  />
);

export default ContentPolicy;

