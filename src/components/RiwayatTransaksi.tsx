import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileImage,
  History,
  Search,
  UserCheck,
} from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import { Deposit, Subscription, TransactionType } from '../types';

interface RiwayatTransaksiProps {
  contractDeposits: Deposit[];
  allMemberDeposits: Deposit[];
  subscriptions: Subscription[];
  activeContract: Subscription | null;
  onPreviewProof: (url: string) => void;
  onOpenReceipt?: (dep: Deposit) => void;
}

type FilterJenis = 'all' | TransactionType;
type ScopeMode = 'active' | 'all_contracts';

function getTxType(dep: Deposit): TransactionType {
  if (dep.jenis_transaksi === 'penarikan') return 'penarikan';
  if (dep.metode === 'pencairan_tunai' || dep.metode === 'transfer_keluar') {
    return 'penarikan';
  }
  return 'setoran';
}

function getMethodLabel(dep: Deposit): string {
  switch (dep.metode) {
    case 'tunai_agen':
      return 'Setoran Tunai Agen';
    case 'transfer':
      return 'Transfer Bank Masuk';
    case 'pencairan_tunai':
      return 'Penarikan Tunai via Agen';
    case 'transfer_keluar':
      return 'Transfer Pencairan Keluar';
    default:
      return 'Transaksi';
  }
}

function getTimestampValue(dep: Deposit): number {
  const ts = dep.createdAt as { seconds?: number; toMillis?: () => number } | undefined;
  if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
  const parsed = Date.parse(dep.tanggal || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

export const RiwayatTransaksi: React.FC<RiwayatTransaksiProps> = ({
  contractDeposits,
  allMemberDeposits,
  subscriptions,
  activeContract,
  onPreviewProof,
  onOpenReceipt,
}) => {
  const [filterJenis, setFilterJenis] = useState<FilterJenis>('all');
  const [scope, setScope] = useState<ScopeMode>('active');
  const [searchTerm, setSearchTerm] = useState('');

  const subMap = useMemo(() => {
    const map = new Map<string, Subscription>();
    subscriptions.forEach((s) => map.set(s.id, s));
    return map;
  }, [subscriptions]);

  // Strictly only transactions validated by Agen / Admin ('verified')
  const validatedSource = useMemo(() => {
    const base = scope === 'active' && activeContract ? contractDeposits : allMemberDeposits;
    return base
      .filter((d) => d.status_verifikasi === 'verified')
      .sort((a, b) => getTimestampValue(b) - getTimestampValue(a));
  }, [scope, activeContract, contractDeposits, allMemberDeposits]);

  const counts = useMemo(() => {
    let setoranCount = 0;
    let penarikanCount = 0;
    let totalSetoran = 0;
    let totalPenarikan = 0;

    validatedSource.forEach((d) => {
      if (getTxType(d) === 'penarikan') {
        penarikanCount += 1;
        totalPenarikan += d.nominal || 0;
      } else {
        setoranCount += 1;
        totalSetoran += d.nominal || 0;
      }
    });

    return {
      allCount: validatedSource.length,
      setoranCount,
      penarikanCount,
      totalSetoran,
      totalPenarikan,
      saldoBersih: Math.max(0, totalSetoran - totalPenarikan),
    };
  }, [validatedSource]);

  const filteredRows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return validatedSource.filter((d) => {
      const jenis = getTxType(d);
      if (filterJenis !== 'all' && jenis !== filterJenis) return false;
      if (!q) return true;
      const sub = subMap.get(d.subscription_id);
      const validator = d.validated_by || sub?.agen_nama || '';
      const haystack = [
        d.tanggal,
        getMethodLabel(d),
        d.catatan || '',
        validator,
        sub?.package_nama || '',
        String(d.nominal),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [validatedSource, filterJenis, searchTerm, subMap]);

  const handleExportCsv = () => {
    if (filteredRows.length === 0) return;
    const headers = [
      'Tanggal',
      'Jenis',
      'Kontrak Paket',
      'Metode',
      'Nominal (Rp)',
      'Divalidasi Oleh',
      'Catatan',
    ];
    const csvRows = [
      headers.join(','),
      ...filteredRows.map((d) => {
        const sub = subMap.get(d.subscription_id);
        const jenis = getTxType(d) === 'penarikan' ? 'Penarikan' : 'Setoran';
        const validator = d.validated_by || sub?.agen_nama || 'Agen Resmi';
        return [
          `"${d.tanggal}"`,
          `"${jenis}"`,
          `"${(sub?.package_nama || '-').replace(/"/g, '""')}"`,
          `"${getMethodLabel(d)}"`,
          d.nominal,
          `"${validator.replace(/"/g, '""')}"`,
          `"${(d.catatan || '').replace(/"/g, '""')}"`,
        ].join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `riwayat-transaksi-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Riwayat Transaksi Tervalidasi"
      className="rounded-2xl border border-[#E4DCCB] bg-white p-4 sm:p-6 min-w-0"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#EFE8D8] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#0C3328]">
            <History className="h-5 w-5 text-[#C8A053]" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Mutasi Tervalidasi Agen
            </span>
          </div>
          <h3 className="mt-1 font-display text-xl font-bold text-[#381E5A]">
            Riwayat Transaksi
          </h3>
          <p className="mt-0.5 text-xs text-stone-600">
            Daftar setoran dan penarikan yang telah diverifikasi serta divalidasi oleh agen atau admin resmi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subscriptions.length > 1 && (
            <div className="inline-flex rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope('active')}
                className={`rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                  scope === 'active'
                    ? 'bg-white text-[#381E5A] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Kontrak Aktif
              </button>
              <button
                type="button"
                onClick={() => setScope('all_contracts')}
                className={`rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                  scope === 'all_contracts'
                    ? 'bg-white text-[#381E5A] shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Semua Kontrak
              </button>
            </div>
          )}

          {filteredRows.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3 py-1.5 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip (Tabular Numerals) */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-4">
        <div className="min-w-0 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="text-[11px] font-medium text-stone-500">Total Setoran Valid</p>
          <p className="mt-1 font-mono-nums text-xs font-bold text-[#0C3328] sm:text-base break-words">
            +{formatRupiah(counts.totalSetoran)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="text-[11px] font-medium text-stone-500">Total Penarikan Valid</p>
          <p className="mt-1 font-mono-nums text-xs font-bold text-rose-700 sm:text-base break-words">
            -{formatRupiah(counts.totalPenarikan)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="text-[11px] font-medium text-stone-500">Saldo Bersih Mutasi</p>
          <p className="mt-1 font-mono-nums text-xs font-bold text-[#381E5A] sm:text-base break-words">
            {formatRupiah(counts.saldoBersih)}
          </p>
        </div>
        <div className="min-w-0 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="text-[11px] font-medium text-stone-500">Jumlah Transaksi</p>
          <p className="mt-1 font-mono-nums text-xs font-bold text-stone-900 sm:text-base break-words">
            {counts.allCount} Validasi
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilterJenis('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              filterJenis === 'all'
                ? 'bg-[#381E5A] text-white'
                : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
            }`}
          >
            Semua ({counts.allCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterJenis('setoran')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              filterJenis === 'setoran'
                ? 'bg-[#0C3328] text-[#E8CA82]'
                : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>Setoran ({counts.setoranCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterJenis('penarikan')}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              filterJenis === 'penarikan'
                ? 'bg-rose-800 text-white'
                : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>Penarikan ({counts.penarikanCount})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari catatan, tanggal, agen..."
            className="w-full rounded-lg border border-stone-300 bg-white py-1.5 pl-8 pr-3 text-xs text-stone-900 focus:border-emerald-800 focus:outline-none"
          />
        </div>
      </div>

      {/* Table / Empty State */}
      {filteredRows.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-stone-200 bg-stone-50 px-5 py-8 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-stone-400" />
          <p className="mt-2 text-sm font-semibold text-stone-800">
            {validatedSource.length === 0
              ? 'Belum Ada Transaksi Tervalidasi'
              : 'Tidak Ada Transaksi yang Cocok'}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {validatedSource.length === 0
              ? 'Setoran tunai/transfer maupun pengajuan penarikan yang sudah divalidasi oleh agen akan muncul di daftar ini.'
              : 'Coba ubah filter jenis transaksi atau kata kunci pencarian Anda.'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Card List (No Horizontal Clipping) */}
          <div className="mt-4 space-y-2.5 md:hidden">
            {filteredRows.map((dep) => {
              const jenis = getTxType(dep);
              const isPenarikan = jenis === 'penarikan';
              const sub = subMap.get(dep.subscription_id);
              const validatorName =
                dep.validated_by || sub?.agen_nama || sub?.agen_kode || 'Agen Resmi';

              return (
                <div
                  key={`mobile-${dep.id}`}
                  className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2]/60 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {isPenarikan ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
                            <ArrowUpRight className="h-3 w-3" />
                            Penarikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 border border-emerald-200">
                            <ArrowDownLeft className="h-3 w-3" />
                            Setoran
                          </span>
                        )}
                        <span className="font-mono-nums text-[11px] text-stone-500">
                          {dep.tanggal}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-stone-900">
                        {getMethodLabel(dep)}
                      </p>
                    </div>
                    <p
                      className={`shrink-0 font-mono-nums text-sm font-bold ${
                        isPenarikan ? 'text-rose-700' : 'text-emerald-900'
                      }`}
                    >
                      {isPenarikan ? '-' : '+'}
                      {formatRupiah(dep.nominal)}
                    </p>
                  </div>

                  {scope === 'all_contracts' && sub && (
                    <p className="text-[11px] font-medium text-[#26124A] break-words">
                      Paket: {sub.package_nama}
                    </p>
                  )}
                  {dep.catatan && (
                    <p className="text-xs text-stone-600 break-words">{dep.catatan}</p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DCCB]/80 pt-2">
                    <div className="inline-flex items-center gap-1.5 text-[11px] text-stone-700 min-w-0">
                      <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-800" />
                      <span className="truncate font-medium">{validatorName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {onOpenReceipt && (
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(dep)}
                          className="inline-flex items-center gap-1 rounded-md border border-[#E4DCCB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#381E5A] hover:bg-[#EFE8D8] cursor-pointer"
                        >
                          <Download className="h-3 w-3 text-[#C8A053]" />
                          <span>Struk PNG</span>
                        </button>
                      )}
                      {dep.bukti_foto_url && (
                        <button
                          type="button"
                          onClick={() => onPreviewProof(dep.bukti_foto_url || '')}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 cursor-pointer"
                        >
                          <FileImage className="h-3 w-3" />
                          <span>Bukti</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="mt-4 hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-xs text-stone-500">
                  <th className="py-2.5 pr-4 font-semibold">Tanggal</th>
                  <th className="py-2.5 pr-4 font-semibold">Jenis</th>
                  <th className="py-2.5 pr-4 font-semibold">Metode &amp; Catatan</th>
                  <th className="py-2.5 pr-4 font-semibold">Divalidasi Oleh</th>
                  <th className="py-2.5 pr-4 text-right font-semibold">Nominal</th>
                  <th className="py-2.5 text-right font-semibold">Bukti</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRows.map((dep) => {
                  const jenis = getTxType(dep);
                  const isPenarikan = jenis === 'penarikan';
                  const sub = subMap.get(dep.subscription_id);
                  const validatorName =
                    dep.validated_by || sub?.agen_nama || sub?.agen_kode || 'Agen Resmi';

                  return (
                    <tr key={dep.id} className="hover:bg-stone-50/80">
                      <td className="py-3 pr-4 font-mono-nums text-xs text-stone-700 whitespace-nowrap">
                        {dep.tanggal}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {isPenarikan ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-200">
                            <ArrowUpRight className="h-3 w-3" />
                            Penarikan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900 border border-emerald-200">
                            <ArrowDownLeft className="h-3 w-3" />
                            Setoran
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="text-xs font-semibold text-stone-900">
                          {getMethodLabel(dep)}
                        </p>
                        {(scope === 'all_contracts' && sub) && (
                          <p className="text-[11px] font-medium text-[#26124A]">
                            Paket: {sub.package_nama}
                          </p>
                        )}
                        {dep.catatan && (
                          <p className="text-xs text-stone-500">{dep.catatan}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 text-xs text-stone-700">
                          <UserCheck className="h-3.5 w-3.5 text-emerald-800" />
                          <span className="font-medium">{validatorName}</span>
                        </div>
                        <p className="text-[10px] font-semibold text-emerald-800">
                          Tervalidasi Agen
                        </p>
                      </td>
                      <td
                        className={`py-3 pr-4 text-right font-mono-nums text-xs font-bold whitespace-nowrap ${
                          isPenarikan ? 'text-rose-700' : 'text-emerald-900'
                        }`}
                      >
                        {isPenarikan ? '-' : '+'}
                        {formatRupiah(dep.nominal)}
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2.5">
                          {onOpenReceipt && (
                            <button
                              type="button"
                              onClick={() => onOpenReceipt(dep)}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E4DCCB] bg-[#FAF7F2] px-2 py-1 text-[11px] font-semibold text-[#381E5A] hover:bg-[#EFE8D8] cursor-pointer"
                            >
                              <Download className="h-3 w-3 text-[#C8A053]" />
                              <span>Struk PNG</span>
                            </button>
                          )}
                          {dep.bukti_foto_url ? (
                            <button
                              type="button"
                              onClick={() => onPreviewProof(dep.bukti_foto_url || '')}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                            >
                              <FileImage className="h-3.5 w-3.5" />
                              <span>Lihat</span>
                            </button>
                          ) : !onOpenReceipt ? (
                            <span className="text-xs text-stone-400">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
};
