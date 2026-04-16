import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, LifeBuoy, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
import { toast } from "@/components/ui/sonner";
import { getErrorDiagnostics } from "@/lib/user-facing-errors";
import type { SupportTicketThread } from "../../../backend/src/types";

type CuratedErrorKind = "app-error" | "not-found" | "refurbishing";

interface CuratedErrorPageProps {
  kind: CuratedErrorKind;
  title?: string;
  description?: string;
  diagnostics?: unknown;
  resetError?: () => void;
}

function createReportId() {
  return `GR-${Date.now().toString(36).toUpperCase()}`;
}

function safeStringify(value: unknown) {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function copyForKind(kind: CuratedErrorKind) {
  if (kind === "refurbishing") {
    return {
      eyebrow: "Updating Gravu",
      code: "503",
      title: "We'll be right back.",
      description:
        "Gravu is being updated right now. Refresh in a moment and your work should continue normally.",
      primaryLabel: "Refresh page",
      reportLabel: "Still stuck? Send ticket",
    };
  }

  if (kind === "not-found") {
    return {
      eyebrow: "Lost page",
      code: "404",
      title: "We could not find that page.",
      description:
        "The link may be old, the page may have moved, or the address may be incomplete.",
      primaryLabel: "Back to Gravu",
      reportLabel: "Report broken link",
    };
  }

  return {
    eyebrow: "Handled error",
    code: "SAFE",
    title: "Something did not load correctly.",
    description:
      "Your screen has been protected from a technical error. Try refreshing, or send the issue to support.",
    primaryLabel: "Refresh page",
    reportLabel: "Send support ticket",
  };
}

function buildTicketMessage(params: {
  reportId: string;
  kind: CuratedErrorKind;
  path: string;
  diagnostics: unknown;
}) {
  const diagnostics = getErrorDiagnostics(params.diagnostics);
  const hiddenDetails = [
    `Report ID: ${params.reportId}`,
    `Source: ${params.kind}`,
    `Path: ${params.path}`,
    `Time: ${new Date().toISOString()}`,
    "",
    "Hidden diagnostic details:",
    safeStringify(diagnostics).slice(0, 3_500),
  ]
    .filter(Boolean)
    .join("\n");

  return hiddenDetails.slice(0, 5_000);
}

export function CuratedErrorPage({
  kind,
  title,
  description,
  diagnostics,
  resetError,
}: CuratedErrorPageProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const reportId = useMemo(createReportId, []);
  const copy = copyForKind(kind);
  const resolvedTitle = title ?? copy.title;
  const resolvedDescription = description ?? copy.description;
  const isSignedIn = !!session?.user;

  const supportMutation = useMutation({
    mutationFn: () =>
      api.post<SupportTicketThread>("/api/support", {
        subject:
          kind === "not-found"
            ? `Broken link report ${reportId}`
            : `App issue report ${reportId}`,
        category: "bug",
        message: buildTicketMessage({
          reportId,
          kind,
          path: location.pathname,
          diagnostics: diagnostics ?? {
            message: resolvedDescription,
          },
        }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["support", "tickets"] });
      toast.success("Support ticket sent to admin.");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const handlePrimaryAction = () => {
    if (resetError) {
      resetError();
      return;
    }

    window.location.reload();
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f8f8f6] px-5 py-10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,#f2d8c3_0,transparent_52%)] opacity-60" />
      <div className="pointer-events-none absolute bottom-[-18rem] left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full border border-neutral-900/5" />

      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 grid w-full max-w-5xl gap-8 border border-neutral-200 bg-white/88 p-6 shadow-[0_24px_80px_rgba(35,31,26,0.08)] backdrop-blur md:grid-cols-[0.8fr_1.2fr] md:p-10"
      >
        <aside className="flex min-h-[260px] flex-col justify-between border border-neutral-100 bg-[#fbfaf7] p-5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-400">
              {copy.eyebrow}
            </p>
            <p className="mt-8 font-mono text-[64px] leading-none tracking-[-0.08em] text-neutral-900/10 md:text-[96px]">
              {copy.code}
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400">
            <ShieldAlert className="h-3.5 w-3.5" />
            Safe message only
          </div>
        </aside>

        <section className="flex flex-col justify-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-orange-500">
            Gravu kept the technical details hidden
          </p>
          <h1 className="mt-4 max-w-2xl text-[clamp(2.2rem,6vw,4.8rem)] font-light leading-[0.92] tracking-[-0.06em] text-neutral-900">
            {resolvedTitle}
          </h1>
          <p className="mt-5 max-w-xl font-mono text-[12px] leading-6 text-neutral-500">
            {resolvedDescription}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handlePrimaryAction}
              className="inline-flex items-center justify-center gap-2 border border-neutral-900 bg-neutral-900 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition hover:bg-neutral-800"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {copy.primaryLabel}
            </button>

            {isSignedIn ? (
              <button
                type="button"
                onClick={() => supportMutation.mutate()}
                disabled={supportMutation.isPending}
                className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {supportMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LifeBuoy className="h-3.5 w-3.5" />
                )}
                {copy.reportLabel}
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-white transition hover:bg-orange-600"
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                {sessionPending ? "Checking session" : "Sign in for support"}
              </Link>
            )}
          </div>

          <Link
            to={isSignedIn ? "/app" : "/welcome"}
            className="mt-6 inline-flex w-fit items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-500 transition hover:text-neutral-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {isSignedIn ? "app" : "home"}
          </Link>
        </section>
      </motion.main>
    </div>
  );
}
