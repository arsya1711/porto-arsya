import { Component, type ErrorInfo, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type Props = { children: ReactNode };
type State = { failed: boolean; referenceId: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    failed: false,
    referenceId: crypto.randomUUID(),
  };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
    const referenceId = this.state.referenceId;
    try {
      sessionStorage.setItem(
        "awexam:last-error",
        JSON.stringify({
          referenceId,
          message: error.message.slice(0, 500),
          path: window.location.pathname,
          occurredAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Pelaporan jarak jauh tetap dicoba ketika sessionStorage tidak tersedia.
    }
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        return supabase?.from("frontend_error_logs").insert({
          reference_id: referenceId,
          user_id: data.user.id,
          error_message: error.message.slice(0, 500),
          component_stack: info.componentStack?.slice(0, 5000) || null,
          path: `${window.location.pathname}${window.location.search}`.slice(0, 1000),
          user_agent: navigator.userAgent.slice(0, 1000),
        });
      });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="auth-loading">
          <span aria-hidden="true">!</span>
          <h1>Aplikasi mengalami kendala</h1>
          <p>Muat ulang halaman. Jika masalah berulang, hubungi administrator sekolah.</p>
          <small>Referensi kendala: {this.state.referenceId}</small>
          <button className="primary" onClick={() => window.location.reload()}>
            Muat ulang
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}
