import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="auth-loading">
          <span aria-hidden="true">!</span>
          <h1>Aplikasi mengalami kendala</h1>
          <p>Muat ulang halaman. Jika masalah berulang, hubungi administrator sekolah.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Muat ulang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

