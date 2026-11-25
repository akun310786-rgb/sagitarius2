import React, { useState } from 'react';
import {
  AlertTriangle,
  FileText,
  RefreshCw,
  ShieldAlert,
  Undo2,
  X,
} from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import { Deposit, Subscription } from '../types';

interface AdminVoidModalProps {
  deposit: Deposit | null;
  subscription?: Subscription;
  isOpen: boolean;
  onClose: () => void;
  onConfirmVoid: (
    deposit: Deposit,
    reason: string,
    note: string,
    baNumber: string
  ) => Promise<void>;
}

const VOID_REASONS = [
  'Salah input nominal setoran oleh petugas / agen',
  'Salah memilih nama member atau paket tabungan',
  'Transaksi ganda (duplikat pencatatan di lapangan)',
  'Koreksi selisih hasil rekonsiliasi audit kas fisik',
  'Pembatalan resmi atas permohonan tertulis member & agen',
];

export const AdminVoidModal: React.FC<AdminVoidModalProps> = ({
  deposit,
  subscription,
  isOpen,
  onClose,
  onConfirmVoid,
}) => {
  const [selectedReason, setSelectedReason] = useState(VOID_REASONS[0]);
  const [formalNote, setFormalNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !deposit) return null;

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const baNumber = `BA-VOID-${dateStr}-${deposit.id.slice(-4).toUpperCase()}`;

  const isSetoran = !deposit.jenis_transaksi || deposit.jenis_transaksi === 'setoran';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formalNote.trim().length < 8) {
      setErrorMsg('Catatan berita acara wajib diisi minimal 8 karakter.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirmVoid(deposit, selectedReason, formalNote.trim(), baNumber);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kegagalan saat memproses pembatalan transaksi.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rose-100 pb-3">
          <div className="flex items-center gap-2 text-rose-700">
            <ShieldAlert className="h-5 w-5" />
            <h3 className="font-display text-base font-bold text-stone-900">
              Berita Acara Pembatalan Transaksi (VOID)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 cursor-pointer text-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nomor BA & Info Transaksi */}
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono font-bold text-rose-950">No. Registrasi: {baNumber}</span>
            <span className="rounded bg-rose-200 px-2 py-0.5 text-[10px] font-bold text-rose-900 uppercase">
              Otoritas Admin Pusat
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-rose-200/60 pt-2 text-[11px] text-stone-700">
            <div>
              <p className="text-stone-500">Member &amp; Paket:</p>
              <p className="font-bold text-stone-900 truncate">
                {deposit.member_nama || subscription?.member_nama || 'Member Sagitarius'}
              </p>
              <p className="text-stone-600 truncate">
                {subscription?.package_nama || 'Paket Parsel'}
              </p>
            </div>
            <div>
              <p className="text-stone-500">Jenis &amp; Nominal:</p>
              <p className="font-mono-nums font-bold text-rose-700">
                {isSetoran ? 'Setoran Tunai' : 'Penarikan Dana'} ({formatRupiah(deposit.nominal)})
              </p>
              <p className="text-stone-500 font-mono-nums">
                Tgl: {deposit.tanggal} · ID: {deposit.id.slice(0, 10)}...
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-2.5 text-xs text-rose-900">
            {errorMsg}
          </div>
        )}

        {/* Formulir Alasan & Catatan */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-stone-700">Alasan Pembatalan / Void</label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-stone-900 focus:outline-hidden"
            >
              {VOID_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-stone-700">
              Uraian Catatan Berita Acara (Wajib)
            </label>
            <textarea
              rows={3}
              required
              minLength={8}
              maxLength={250}
              value={formalNote}
              onChange={(e) => setFormalNote(e.target.value)}
              placeholder="Jelaskan dasar pembatalan transaksi untuk kebutuhan audit finansial resmi..."
              className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-stone-900 focus:border-stone-500 focus:outline-hidden"
            />
          </div>

          <div className="rounded-lg bg-amber-50 p-3 text-[11px] text-amber-900 flex items-start gap-2 border border-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
            <p className="leading-relaxed">
              Konfirmasi ini akan <strong>membalik saldo kontrak member</strong> secara otomatis via Firestore Database Transaction, menerbitkan entri pembalik di buku besar, mencatat audit log, dan mengabari agen pembina.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-stone-300 px-3.5 py-2 font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-700 px-4 py-2 font-bold text-white hover:bg-rose-800 disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Memproses Void...</span>
                </>
              ) : (
                <>
                  <Undo2 className="h-3.5 w-3.5" />
                  <span>Terbitkan Berita Acara VOID</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
