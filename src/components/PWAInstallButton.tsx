import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-700/20 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" />
        <span>Pasang Aplikasi</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 transition hover:bg-stone-50 whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="h-3.5 w-3.5 text-emerald-800" />
        <span>Pasang PWA</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-3 sm:p-4 backdrop-blur-xs safe-top safe-bottom"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 sm:p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-800">Aplikasi Layar Utama</p>
                <h3 className="mt-1 font-display text-xl font-bold text-stone-900">
                  Pasang Sagitarius Parcel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
                aria-label="Tutup panduan"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-stone-700">
                <li>1. Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.</li>
                <li>2. Gulir ke bawah dan pilih <strong>Tambah ke Layar Utama (Add to Home Screen)</strong>.</li>
                <li>3. Ketuk <strong>Tambah</strong> untuk menggunakan aplikasi secara penuh tanpa browser bar.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-stone-700">
                <li>1. Buka menu browser (ikon titik tiga di kanan atas Chrome/Edge).</li>
                <li>2. Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Install app</strong>.</li>
                <li>3. Ikon Sagitarius Parcel akan muncul di layar utama HP Anda dan mendukung akses offline.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full rounded-lg bg-emerald-900 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
