import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-destructive/10 p-4 mb-4">
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
                <p className="text-muted-foreground mb-4">
                  We encountered an unexpected error. Please try again or return to the dashboard.
                </p>
                {process.env.NODE_ENV === "development" && this.state.error && (
                  <div className="w-full mb-4 p-3 bg-muted rounded-md text-left">
                    <p className="text-xs font-mono text-destructive break-all">
                      {this.state.error.message}
                    </p>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={this.handleGoHome}
                    data-testid="button-error-home"
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </Button>
                  <Button
                    onClick={this.handleRetry}
                    data-testid="button-error-retry"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorBanner({ title = "Error", message, onRetry, onDismiss }: ErrorBannerProps) {
  return (
    <div
      className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md"
      role="alert"
      data-testid="error-banner"
    >
      <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            data-testid="button-error-dismiss"
          >
            Dismiss
          </Button>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-testid="button-error-retry"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
