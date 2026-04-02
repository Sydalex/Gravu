import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  title: string;
  subtitle?: ReactNode;
  sections: LegalSection[];
  lastUpdated: string;
  contactEmail?: string;
  contactLabel?: string;
  footerNote?: ReactNode;
};

export const LegalPage = ({
  title,
  subtitle,
  sections,
  lastUpdated,
  contactEmail,
  contactLabel = "Contact",
  footerNote,
}: LegalPageProps) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-[#302d29]">
      <div className="sticky top-0 z-20 border-b border-[#e7e0d5] bg-[#f8f8f6]/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="-ml-2 gap-2 rounded-full px-3 text-[#7b756b] hover:bg-[#f1ece3] hover:text-[#302d29]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-[#7b756b] transition-colors hover:text-[#302d29]"
          >
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#1f1f1f]" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            Gravu
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="border-b border-[#e7e0d5] pb-10"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#8a8378]">
                <span className="h-px w-8 bg-[#d8d0c3]" />
                Legal information
              </div>
              <h1
                className="max-w-[10ch] text-[42px] font-light uppercase leading-[0.92] tracking-[-0.04em] text-[#26231f] sm:text-[58px] lg:text-[72px]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                {title}
              </h1>
            </div>

            <div className="space-y-5 lg:max-w-[52ch] flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a8378]">
                <span>Gravu</span>
                <span className="h-1 w-1 rounded-full bg-[#d8d0c3]" />
                <span>Last updated {lastUpdated}</span>
              </div>
              {subtitle ? (
                <div className="text-[15px] leading-7 text-[#686257] [&_strong]:font-semibold [&_strong]:text-[#26231f]">
                  {subtitle}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 text-[13px] text-[#7b756b]">
                <Link
                  to="/policy/terms"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-[#26231f]"
                >
                  Terms <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/policy/privacy"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-[#26231f]"
                >
                  Privacy <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/policy/refunds"
                  className="inline-flex items-center gap-1.5 transition-colors hover:text-[#26231f]"
                >
                  Refunds <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-10 border-t border-[#ece6db]">
          {sections.map((section, index) => (
            <motion.section
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.04 + index * 0.03 }}
              className="grid gap-5 border-b border-[#ece6db] py-8 lg:grid-cols-[120px_minmax(0,1fr)] lg:gap-10"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9b9387]">
                {(index + 1).toString().padStart(2, "0")}
              </div>
              <div className="max-w-[74ch]">
                <h2
                  className="mb-3 text-[22px] font-semibold tracking-[-0.03em] text-[#26231f] sm:text-[26px]"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {section.title}
                </h2>
                <div className="space-y-3 text-[15px] leading-7 text-[#686257] [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline [&_ul]:space-y-2 [&_ul]:pl-0 [&_ul]:list-none [&_ul>li]:relative [&_ul>li]:pl-5 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.78rem] [&_ul>li]:before:h-1 [&_ul>li]:before:w-1 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-primary [&_strong]:font-semibold [&_strong]:text-[#26231f]">
                  {section.content}
                </div>
              </div>
            </motion.section>
          ))}
        </div>

        {contactEmail ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="mt-10 border-t border-[#e7e0d5] pt-8"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a8378]">
                  {contactLabel}
                </p>
                <p
                  className="mt-3 text-[28px] font-light uppercase leading-[1] tracking-[-0.04em] text-[#26231f]"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  Contact
                </p>
                <p className="mt-3 max-w-[52ch] text-[14px] leading-6 text-[#686257]">
                  Use this address for rights requests, complaints, refunds, and legal notices.
                </p>
              </div>
              <a href={`mailto:${contactEmail}`} className="lg:justify-self-end">
                <Button className="h-12 gap-2 rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary/90 sm:flex-shrink-0">
                  <Mail className="h-3.5 w-3.5" />
                  {contactEmail}
                </Button>
              </a>
              {footerNote ? (
                <div className="border-t border-[#ece6db] pt-5 text-[13px] leading-6 text-[#7b756b] lg:col-span-2 [&_strong]:text-[#26231f]">
                  {footerNote}
                </div>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};
