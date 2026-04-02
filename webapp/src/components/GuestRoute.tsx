import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { isPreviewAuthBypassEnabled } from "@/lib/preview-mode";
import { Loader2 } from "lucide-react";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  if (isPreviewAuthBypassEnabled()) {
    return <>{children}</>;
  }

  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (session?.user) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
