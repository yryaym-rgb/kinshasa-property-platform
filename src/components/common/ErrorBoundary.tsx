import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { APP_CONFIG } from '@/config/app.config';

interface Props {
  children: ReactNode;
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

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReport = () => {
    const subject = encodeURIComponent(`Erreur ${APP_CONFIG.name}`);
    const body = encodeURIComponent(
      `Description de l'erreur:\n\n${this.state.error?.message ?? 'Erreur inconnue'}\n\nURL: ${window.location.href}`,
    );
    window.open(`mailto:support@kinshasa.gouv.cd?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-background)] px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="font-heading text-2xl font-bold">Une erreur est survenue</h1>
            <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
              Nous sommes désolés, une erreur inattendue s&apos;est produite sur {APP_CONFIG.name}.
            </p>
            {this.state.error && (
              <pre className="mt-4 overflow-auto rounded-lg bg-[var(--color-muted)] p-3 text-left text-xs">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={this.handleReload} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Recharger la page
              </Button>
              <Button variant="outline" onClick={this.handleReport}>
                Signaler le problème
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
