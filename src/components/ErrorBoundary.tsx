import React from 'react';
import { getFriendlyFirestoreErrorMessage } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  friendlyMessage: string;
  operationContext: string;
}

function parseErrorPresentation(rawMessage: string): {
  friendlyMessage: string;
  operationContext: string;
} {
  try {
    const parsed = JSON.parse(rawMessage) as {
      error?: string;
      operationType?: string;
      path?: string | null;
    };
    if (parsed && typeof parsed.error === 'string' && parsed.operationType) {
      return {
        friendlyMessage: getFriendlyFirestoreErrorMessage(new Error(parsed.error)),
        operationContext: `${parsed.operationType.toUpperCase()} · ${parsed.path || '-'}`,
      };
    }
  } catch {
    // Not a JSON FirestoreErrorInfo payload
  }
  return {
    friendlyMessage: getFriendlyFirestoreErrorMessage(new Error(rawMessage)),
    operationContext: '',
  };
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, friendlyMessage: '', operationContext: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error.message || 'Terjadi kendala saat memuat data aplikasi.';
    const { friendlyMessage, operationContext } = parseErrorPresentation(raw);
    return {
      hasError: true,
      friendlyMessage,
      operationContext,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h2 className="font-display text-xl font-bold text-stone-900">
            Terjadi Kendala Koneksi atau Izin Data
          </h2>
          <p className="mt-2 text-sm text-stone-700">{this.state.friendlyMessage}</p>
          {this.state.operationContext && (
            <p className="mt-2 rounded-lg bg-stone-100 px-3 py-1.5 font-mono-nums text-xs text-stone-600">
              Operasi: {this.state.operationContext}
            </p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 cursor-pointer"
          >
            Muat Ulang Aplikasi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
