import { Component, type ErrorInfo, type ReactNode } from "react";
import { CuratedErrorPage } from "@/components/CuratedErrorPage";
import { isRedeployOrMaintenanceError } from "@/lib/user-facing-errors";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[app-error-boundary] Render error captured", {
      error,
      componentStack: errorInfo.componentStack,
    });
  }

  reset = () => {
    this.setState({ error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    const { error, errorInfo } = this.state;

    if (error) {
      const isRefurbishing = isRedeployOrMaintenanceError(error);
      return (
        <CuratedErrorPage
          kind={isRefurbishing ? "refurbishing" : "app-error"}
          diagnostics={{
            error,
            componentStack: errorInfo?.componentStack,
          }}
          resetError={this.reset}
        />
      );
    }

    return this.props.children;
  }
}
