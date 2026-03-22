import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Mail } from "lucide-react";
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
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="-ml-2 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
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
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          {subtitle ? (
            <div className="text-sm leading-relaxed text-muted-foreground [&_strong]:text-foreground">
              {subtitle}
            </div>
          ) : null}
        </motion.div>

        <div className="space-y-1">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 + index * 0.04 }}
              className="group rounded-xl border border-transparent px-5 py-5 transition-all duration-200 hover:border-border hover:bg-card"
            >
              <div className="flex gap-4">
                <div className="flex-shrink-0 pt-0.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary font-mono text-[11px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    className="mb-3 text-base font-semibold text-foreground"
                    style={{ fontFamily: "'Syne', sans-serif" }}
                  >
                    {section.title}
                  </h2>
                  <div className="space-y-2 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-2 hover:[&_a]:underline [&_ul]:ml-4 [&_ul]:list-none [&_ul>li]:relative [&_ul>li]:pl-4 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:text-primary [&_ul>li]:before:content-['—'] [&_strong]:font-semibold [&_strong]:text-foreground">
                    {section.content}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {contactEmail ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 }}
            className="mt-10 rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{contactLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Use this address for rights requests, complaints, refunds, and legal notices.
                </p>
              </div>
              <a href={`mailto:${contactEmail}`}>
                <Button className="gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-shrink-0">
                  <Mail className="h-3.5 w-3.5" />
                  {contactEmail}
                </Button>
              </a>
            </div>
            {footerNote ? (
              <div className="mt-4 border-t border-border/60 pt-4 text-xs leading-relaxed text-muted-foreground [&_strong]:text-foreground">
                {footerNote}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </div>
    </div>
  );
};

