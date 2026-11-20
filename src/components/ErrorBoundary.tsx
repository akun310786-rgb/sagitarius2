import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Terjadi kendala saat memuat data aplikasi.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-12 max-w-lg rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h2 className="font-display text-xl font-bold text-stone-900">
            Terjadi Kendala Koneksi atau Izin Data
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Silakan muat ulang halaman atau pastikan akun Anda memiliki akses yang sesuai.
          </p>
          <pre className="mt-4 max-h-36 overflow-auto rounded-lg bg-stone-100 p-3 text-left text-xs text-stone-700">
            {this.state.errorMessage}
          </pre>
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
