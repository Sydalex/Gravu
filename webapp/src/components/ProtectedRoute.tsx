import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { Loader2 } from "lucide-react";
import { NavBar } from "@/components/NavBar";

// Design review mode - set to true to bypass auth
const DESIGN_REVIEW_MODE = true;

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  // Allow all users in design review mode
  if (DESIGN_REVIEW_MODE) {
    return (
      <>
        <NavBar />
        {children}
      </>
    );
  }

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
