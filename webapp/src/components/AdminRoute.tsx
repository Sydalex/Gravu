import { Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { NavBar } from "@/components/NavBar";

interface SubscriptionStatus {
  plan: string;
  isAdmin: boolean;
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ["subscription"],
    queryFn: () => api.get<SubscriptionStatus>("/api/payments/subscription"),
    enabled: !!session?.user,
  });

  if (isPending || (session?.user && subLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />;
  }

  if (!subscription?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <NavBar />
      {children}
    </>
  );
}
