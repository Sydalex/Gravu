import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { isRedeployOrMaintenanceError } from "@/lib/user-facing-errors";

export function GlobalErrorNotifications() {
  const navigate = useNavigate();

  useEffect(() => {
    let lastToastAt = 0;

    function showCuratedError(input: unknown) {
      if (isRedeployOrMaintenanceError(input)) {
        navigate("/refurbishing", { replace: true });
        return;
      }

      const now = Date.now();
      if (now - lastToastAt < 2500) return;
      lastToastAt = now;
      toast.error(input);
    }

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      console.error("[global-error] Unhandled promise rejection", event.reason);
      showCuratedError(event.reason);
    }

    function handleRuntimeError(event: ErrorEvent) {
      console.error("[global-error] Runtime error", event.error ?? event.message);
      showCuratedError(event.error ?? event.message);
    }

    function handlePreloadError(event: Event) {
      // Vite emits this when the browser still points at an old chunk during a redeploy.
      event.preventDefault();
      navigate("/refurbishing", { replace: true });
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleRuntimeError);
    window.addEventListener("vite:preloadError", handlePreloadError as EventListener);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleRuntimeError);
      window.removeEventListener("vite:preloadError", handlePreloadError as EventListener);
    };
  }, [navigate]);

  return null;
}
