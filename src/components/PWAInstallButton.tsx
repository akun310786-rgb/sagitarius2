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
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#C8A053] bg-[#FAF7F2] px-4 py-2.5 text-sm font-bold text-[#0C3328] transition hover:bg-[#F3ECE0] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span>Pasang Aplikasi di HP</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#C8A053]/70 bg-white px-4 py-2.5 text-sm font-semibold text-[#381E5A] transition hover:bg-[#FAF7F2] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Smartphone className="h-4 w-4 shrink-0 text-[#0C3328]" />
        <span>Pasang Aplikasi di HP</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-3 sm:p-4 backdrop-blur-xs safe-top safe-bottom"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-[#E4DCCB] bg-white p-5 sm:p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#0C3328]">Cara Pasang di Layar HP</p>
                <h3 className="mt-1 font-display text-xl font-bold text-[#381E5A]">
                  Pasang Sagitarius Parcel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 cursor-pointer"
                aria-label="Tutup panduan"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-3 text-base leading-relaxed text-stone-700">
                <li>1. Ketuk ikon <strong>Bagikan (Share)</strong> di bagian bawah layar Safari.</li>
                <li>2. Geser ke bawah lalu pilih <strong>Tambah ke Layar Utama</strong>.</li>
                <li>3. Ketuk <strong>Tambah</strong> agar ikon Sagitarius Parcel muncul di layar HP Anda.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-base leading-relaxed text-stone-700">
                <li>1. Buka menu browser (ikon titik tiga di kanan atas layar).</li>
                <li>2. Pilih <strong>Tambahkan ke layar utama</strong> atau <strong>Pasang aplikasi</strong>.</li>
                <li>3. Ikon Sagitarius Parcel akan langsung muncul di layar HP Anda agar mudah dibuka kapan saja.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 min-h-[48px] w-full rounded-xl bg-[#0C3328] py-3 text-base font-bold text-white transition hover:bg-[#144738] cursor-pointer"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
