import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  Coins,
  Download,
  FileSpreadsheet,
  FileText,
  Package as PackageIcon,
  Printer,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import {
  AuditLogEntry,
  Deposit,
  ParcelPackage,
  Subscription,
  WarehouseInventoryItem,
  WilayahPriangan,
} from '../types';

interface WilayahRecapRow {
  wilayah: WilayahPriangan;
  agentCount: number;
  contractCount: number;
  totalMembers: number;
  totalTarget: number;
  totalCollected: number;
  totalCommission: number;
  pct: number;
}

interface AdminAnalyticsTabProps {
  korwilRecap: WilayahRecapRow[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  packages: ParcelPackage[];
  warehouseInventory?: WarehouseInventoryItem[];
  auditLogs?: AuditLogEntry[];
}

function formatAuditTime(ts: unknown): string {
  const obj = ts as { seconds?: number; toDate?: () => Date } | undefined;
  if (obj && typeof obj.toDate === 'function') {
    return obj.toDate().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (obj && typeof obj.seconds === 'number') {
    return new Date(obj.seconds * 1000).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return 'Baru saja';
}

export const AdminAnalyticsTab: React.FC<AdminAnalyticsTabProps> = ({
  korwilRecap,
  subscriptions,
  deposits,
  packages,
  warehouseInventory = [],
  auditLogs = [],
}) => {
  const [analyticsView, setAnalyticsView] = useState<'grafik' | 'hpp' | 'audit' | 'tutup_buku'>('grafik');
  const [hppCategoryFilter, setHppCategoryFilter] = useState<string>('all');

  // Executive P&L & Financial Closing Calculations
  const closingReport = useMemo(() => {
    let grossCollected = 0;
    let totalPenarikan = 0;
    deposits.forEach((d) => {
      if (d.status_verifikasi !== 'verified') return;
      const isOut =
        d.jenis_transaksi === 'penarikan' ||
        d.metode === 'pencairan_tunai' ||
        d.metode === 'transfer_keluar';
      if (isOut) totalPenarikan += d.nominal || 0;
      else grossCollected += d.nominal || 0;
    });

    const netCashInflow = Math.max(0, grossCollected - totalPenarikan);
    const totalTarget = subscriptions.reduce((s, c) => s + (c.target_nominal || 0), 0);
    const totalThrAllocated = subscriptions.reduce((s, c) => {
      const p = packages.find((pkg) => pkg.id === c.package_id);
      return s + (p?.bonus_thr || 0);
    }, 0);

    // Compute estimated COGS / HPP
    let totalHppCost = 0;
    subscriptions.forEach((sub) => {
      const pkg = packages.find((p) => p.id === sub.package_id);
      if (!pkg) return;
      const standardRatio = pkg.kategori === 'uang' ? 0.9 : 0.72;
      const estimatedCost = Math.round((pkg.harga_total - (pkg.bonus_thr || 0)) * standardRatio);
      totalHppCost += estimatedCost;
    });

    const totalCommissionEst = korwilRecap.reduce((s, r) => s + r.totalCommission, 0);
    const estimatedGrossProfit = Math.max(0, netCashInflow - (totalHppCost + totalCommissionEst + totalThrAllocated));
    const profitMargin = netCashInflow > 0 ? Math.round((estimatedGrossProfit / netCashInflow) * 100) : 0;

    return {
      grossCollected,
      totalPenarikan,
      netCashInflow,
      totalTarget,
      totalThrAllocated,
      totalHppCost,
      totalCommissionEst,
      estimatedGrossProfit,
      profitMargin,
      totalContracts: subscriptions.length,
      lunasContracts: subscriptions.filter((s) => s.status === 'lunas').length,
    };
  }, [deposits, subscriptions, packages, korwilRecap]);

  const cashflow = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    let countIn = 0;
    let countOut = 0;

    deposits.forEach((d) => {
      if (d.status_verifikasi !== 'verified') return;
      const isOut =
        d.jenis_transaksi === 'penarikan' ||
        d.metode === 'pencairan_tunai' ||
        d.metode === 'transfer_keluar';
      if (isOut) {
        totalOut += d.nominal || 0;
        countOut += 1;
      } else {
        totalIn += d.nominal || 0;
        countIn += 1;
      }
    });

    const net = Math.max(0, totalIn - totalOut);
    const maxFlow = Math.max(totalIn, totalOut, 1);
    const inPct = Math.round((totalIn / maxFlow) * 100);
    const outPct = Math.round((totalOut / maxFlow) * 100);
    const netRatio = totalIn > 0 ? Math.max(0, Math.round((net / totalIn) * 100)) : 0;

    return { totalIn, totalOut, net, countIn, countOut, inPct, outPct, netRatio };
  }, [deposits]);

  const maxRegionalTarget = useMemo(() => {
    return Math.max(
      1,
      ...korwilRecap.map((r) => Math.max(r.totalTarget, r.totalCollected))
    );
  }, [korwilRecap]);

  const topPackages = useMemo(() => {
    const counts = new Map<
      string,
      { id: string; nama: string; count: number; collected: number; target: number }
    >();
    subscriptions.forEach((s) => {
      const existing = counts.get(s.package_id);
      if (existing) {
        existing.count += 1;
        existing.collected += s.total_terkumpul || 0;
        existing.target += s.target_nominal || 0;
      } else {
        const pkg = packages.find((p) => p.id === s.package_id);
        counts.set(s.package_id, {
          id: s.package_id,
          nama: s.package_nama || pkg?.nama_paket || s.package_id,
          count: 1,
          collected: s.total_terkumpul || 0,
          target: s.target_nominal || 0,
        });
      }
    });
    const list = Array.from(counts.values())
      .sort((a, b) => b.count - a.count || b.collected - a.collected)
      .slice(0, 5);
    const maxCount = Math.max(1, ...list.map((i) => i.count));
    return { list, maxCount };
  }, [subscriptions, packages]);

  const hppRows = useMemo(() => {
    const activeCountByPkg = new Map<string, number>();
    subscriptions.forEach((s) => {
      activeCountByPkg.set(s.package_id, (activeCountByPkg.get(s.package_id) || 0) + 1);
    });

    return packages
      .filter((p) => hppCategoryFilter === 'all' || p.kategori === hppCategoryFilter)
      .slice(0, 24)
      .map((pkg) => {
        const kontrakCount = activeCountByPkg.get(pkg.id) || 0;
        const maxKomisi = Math.round(pkg.harga_total * 0.07);
        const bonusThr = pkg.bonus_thr || 0;

        let matchedItemCost = 0;
        let matchedCount = 0;
        pkg.daftar_isi.forEach((line) => {
          const lower = line.toLowerCase();
          const match = warehouseInventory.find(
            (inv) =>
              lower.includes(inv.item_nama.toLowerCase()) ||
              inv.item_nama.toLowerCase().includes(lower.split(' ')[0])
          );
          if (match && match.harga_beli_satuan > 0) {
            matchedItemCost += match.harga_beli_satuan;
            matchedCount += 1;
          }
        });

        const isExactWarehouse =
          matchedCount === pkg.daftar_isi.length && pkg.daftar_isi.length > 0;
        const standardHppRatio = pkg.kategori === 'uang' ? 0.9 : 0.72;
        const standardNetBudget = Math.max(0, pkg.harga_total - bonusThr - maxKomisi);
        const estimatedHpp = isExactWarehouse
          ? matchedItemCost
          : matchedCount > 0 && pkg.daftar_isi.length > 0
            ? Math.round(
                matchedItemCost +
                  ((pkg.daftar_isi.length - matchedCount) / pkg.daftar_isi.length) *
                    (standardNetBudget * standardHppRatio)
              )
            : Math.round(standardNetBudget * standardHppRatio);

        const marginBersih = pkg.harga_total - estimatedHpp - bonusThr - maxKomisi;
        const marginPct =
          pkg.harga_total > 0 ? Math.round((marginBersih / pkg.harga_total) * 100) : 0;

        return {
          pkg,
          kontrakCount,
          estimatedHpp,
          bonusThr,
          maxKomisi,
          marginBersih,
          marginPct,
          matchedCount,
          totalItems: pkg.daftar_isi.length,
        };
      });
  }, [packages, subscriptions, warehouseInventory, hppCategoryFilter]);

  const handleExportAuditCsv = () => {
    if (auditLogs.length === 0) return;
    const headers = ['Waktu', 'Aktor', 'Aksi', 'Target', 'Detail'];
    const rows = auditLogs.map((l) => [
      `"${formatAuditTime(l.createdAt)}"`,
      `"${(l.actor_nama || '').replace(/"/g, '""')}"`,
      `"${(l.aksi || '').replace(/"/g, '""')}"`,
      `"${(l.target_label || '').replace(/"/g, '""')}"`,
      `"${(l.detail || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-log-admin-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Sub-Navigasi Analitik */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-stone-200 bg-stone-100/80 p-1">
        <button
          type="button"
          onClick={() => setAnalyticsView('grafik')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
            analyticsView === 'grafik'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Ringkasan Grafik
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsView('hpp')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
            analyticsView === 'hpp'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          Kalkulator HPP &amp; Margin
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsView('audit')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
            analyticsView === 'audit'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <span>Log Audit Admin</span>
          {auditLogs.length > 0 && (
            <span className="font-mono-nums text-[11px] text-stone-500">({auditLogs.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setAnalyticsView('tutup_buku')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
            analyticsView === 'tutup_buku'
              ? 'bg-[#0C3328] text-[#E8CA82] shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>Laporan Tutup Buku &amp; P&amp;L</span>
        </button>
      </div>

      {/* VIEW 1: GRAFIK WILAYAH, ARUS KAS & TOP 5 PAKET */}
      {analyticsView === 'grafik' && (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Regional Comparison */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-stone-700" />
                  <h2 className="text-base font-bold text-stone-900">
                    Performa Wilayah Priangan Timur
                  </h2>
                </div>
                <div className="flex items-center gap-4 text-[11px] font-medium text-stone-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-stone-200" />
                    Target
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[#0C3328]">
                    <span className="h-2 w-2 rounded-xs bg-[#0C3328]" />
                    Terkumpul
                  </span>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {korwilRecap.map((row) => {
                  const targetW = Math.round((row.totalTarget / maxRegionalTarget) * 100);
                  const collectedW = Math.round((row.totalCollected / maxRegionalTarget) * 100);
                  return (
                    <div key={row.wilayah} className="space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-stone-900">
                          {row.wilayah}{' '}
                          <span className="font-normal text-stone-500">
                            · {row.contractCount} kontrak · {row.agentCount} agen
                          </span>
                        </span>
                        <span className="font-mono-nums font-semibold text-[#0C3328]">
                          {formatRupiah(row.totalCollected)}{' '}
                          <span className="font-normal text-stone-500">
                            / {formatRupiah(row.totalTarget)} ({row.pct}%)
                          </span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-stone-300"
                            style={{ width: `${Math.max(row.totalTarget > 0 ? 3 : 0, targetW)}%` }}
                          />
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-[#0C3328]"
                            style={{
                              width: `${Math.max(row.totalCollected > 0 ? 3 : 0, collectedW)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cashflow Balance Card */}
            <div className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-5 sm:p-6 lg:col-span-5">
              <div>
                <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
                  <Wallet className="h-4 w-4 text-[#0C3328]" />
                  <h2 className="text-base font-bold text-stone-900">
                    Arus Kas Mutasi Tervalidasi
                  </h2>
                </div>

                <div className="mt-5 space-y-5">
                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-600">
                        Setoran Masuk ({cashflow.countIn}x)
                      </span>
                      <span className="font-mono-nums font-bold text-[#0C3328]">
                        +{formatRupiah(cashflow.totalIn)}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-[#0C3328]"
                        style={{
                          width: `${Math.max(cashflow.totalIn > 0 ? 4 : 0, cashflow.inPct)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-stone-600">
                        Penarikan Keluar ({cashflow.countOut}x)
                      </span>
                      <span className="font-mono-nums font-bold text-rose-700">
                        -{formatRupiah(cashflow.totalOut)}
                      </span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-rose-600"
                        style={{
                          width: `${Math.max(cashflow.totalOut > 0 ? 4 : 0, cashflow.outPct)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-stone-100 pt-4">
                <div>
                  <p className="text-[11px] font-medium text-stone-500">Saldo Kas Bersih</p>
                  <p className="mt-0.5 font-mono-nums text-xl font-bold text-stone-900">
                    {formatRupiah(cashflow.net)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-stone-500">Rasio Retensi</p>
                  <p className="mt-0.5 inline-flex items-center gap-1 font-mono-nums text-base font-bold text-[#0C3328]">
                    <TrendingUp className="h-4 w-4" />
                    {cashflow.netRatio}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Top 5 Packages */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-stone-100 pb-4">
              <PackageIcon className="h-4 w-4 text-stone-700" />
              <h2 className="text-base font-bold text-stone-900">
                Top 5 Paket Paling Diminati Member
              </h2>
            </div>

            {topPackages.list.length === 0 ? (
              <p className="mt-4 rounded-lg bg-stone-50 p-6 text-center text-xs text-stone-500">
                Belum ada data kontrak paket untuk ditampilkan.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-stone-100">
                {topPackages.list.map((item, idx) => {
                  const barPct = Math.round((item.count / topPackages.maxCount) * 100);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono-nums text-xs font-bold text-stone-400 w-5">
                          0{idx + 1}
                        </span>
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {item.nama}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 sm:w-80">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                          <div
                            className="h-full rounded-full bg-[#381E5A]"
                            style={{ width: `${Math.max(12, barPct)}%` }}
                          />
                        </div>
                        <span className="font-mono-nums text-xs font-semibold text-stone-900 whitespace-nowrap">
                          {item.count} kontrak · {formatRupiah(item.collected)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: KALKULATOR HPP & MARGIN */}
      {analyticsView === 'hpp' && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-stone-700" />
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Kalkulator HPP &amp; Margin Bersih Paket
                </h2>
                <p className="text-xs text-stone-500">
                  Estimasi HPP dari harga beli Gudang (patokan standar 72% jika stok belum diisi), Bonus THR, &amp; Komisi maks 7%.
                </p>
              </div>
            </div>

            <select
              value={hppCategoryFilter}
              onChange={(e) => setHppCategoryFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
            >
              <option value="all">Semua Kategori</option>
              <option value="bunda">Paket Bunda</option>
              <option value="anak">Paket Anak</option>
              <option value="pilihan">Paket Pilihan</option>
              <option value="uang">Paket Uang</option>
              <option value="satuan">Barang Satuan</option>
            </select>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500">
                  <th className="py-2.5 pr-3 font-semibold">Nama Paket</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Harga Jual</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Est. HPP</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Bonus THR</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Komisi 7%</th>
                  <th className="py-2.5 pr-3 text-right font-semibold">Margin Bersih</th>
                  <th className="py-2.5 text-right font-semibold">Proyeksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {hppRows.map((r) => (
                  <tr key={r.pkg.id} className="hover:bg-stone-50">
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-stone-900">{r.pkg.nama_paket}</p>
                      <p className="text-[11px] text-stone-500">
                        {r.matchedCount > 0
                          ? `${r.matchedCount}/${r.totalItems} item dari stok gudang`
                          : 'Patokan standar'}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-nums font-medium text-stone-900">
                      {formatRupiah(r.pkg.harga_total)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-nums text-stone-700">
                      {formatRupiah(r.estimatedHpp)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-nums text-amber-800">
                      {r.bonusThr > 0 ? formatRupiah(r.bonusThr) : '—'}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-nums text-stone-700">
                      {formatRupiah(r.maxKomisi)}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-nums font-bold text-[#0C3328]">
                      {formatRupiah(r.marginBersih)}{' '}
                      <span className="text-[10px] font-medium text-stone-500">
                        ({r.marginPct}%)
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono-nums font-semibold text-stone-800">
                      {r.kontrakCount > 0
                        ? `${r.kontrakCount}x (${formatRupiah(r.marginBersih * r.kontrakCount)})`
                        : '0x'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: LOG AUDIT ADMIN */}
      {analyticsView === 'audit' && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-stone-700" />
              <div>
                <h2 className="text-base font-bold text-stone-900">
                  Log Audit Perubahan Sensitif ({auditLogs.length})
                </h2>
                <p className="text-xs text-stone-500">
                  Catatan permanen koreksi saldo, perubahan peran RBAC, penghapusan data, dan pengaturan rekening.
                </p>
              </div>
            </div>
            {auditLogs.length > 0 && (
              <button
                type="button"
                onClick={handleExportAuditCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>

          {auditLogs.length === 0 ? (
            <p className="mt-4 rounded-lg bg-stone-50 p-6 text-center text-xs text-stone-500">
              Belum ada aktivitas sensitif yang tercatat.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="py-2.5 pr-3 font-semibold">Waktu</th>
                    <th className="py-2.5 pr-3 font-semibold">Aktor</th>
                    <th className="py-2.5 pr-3 font-semibold">Aksi</th>
                    <th className="py-2.5 pr-3 font-semibold">Target</th>
                    <th className="py-2.5 font-semibold">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {auditLogs.slice(0, 60).map((log) => (
                    <tr key={log.id} className="hover:bg-stone-50">
                      <td className="py-2.5 pr-3 font-mono-nums text-[11px] text-stone-600 whitespace-nowrap">
                        {formatAuditTime(log.createdAt)}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-stone-900 whitespace-nowrap">
                        {log.actor_nama}
                      </td>
                      <td className="py-2.5 pr-3 font-mono-nums text-[11px] font-semibold text-[#381E5A] whitespace-nowrap">
                        {log.aksi}
                      </td>
                      <td className="py-2.5 pr-3 font-semibold text-[#0C3328]">
                        {log.target_label}
                      </td>
                      <td className="py-2.5 text-stone-600">{log.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 4: LAPORAN KEUANGAN KONSOLIDASIAN & TUTUP BUKU PERIODE */}
      {analyticsView === 'tutup_buku' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0C3328]" />
                <span>Laporan Keuangan Konsolidasian &amp; Tutup Buku Resmi</span>
              </h2>
              <p className="text-[11px] text-stone-500">
                Dokumen ikhtisar finansial eksekutif PT Sagitarius Trinunggal Karya periode berjalan.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-3.5 py-1.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Cetak Dokumen / Simpan PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const headers = ['Indikator Laporan Keuangan', 'Nilai / Keterangan'];
                  const rows = [
                    ['Total Setoran Terkumpul (Gross Inflow)', formatRupiah(closingReport.grossCollected)],
                    ['Penarikan Dana Member (Outflow)', formatRupiah(closingReport.totalPenarikan)],
                    ['Penerimaan Kas Bersih (Net Cash)', formatRupiah(closingReport.netCashInflow)],
                    ['Beban Pokok Penjualan HPP (COGS)', formatRupiah(closingReport.totalHppCost)],
                    ['Estimasi Beban Komisi Agen (4-7%)', formatRupiah(closingReport.totalCommissionEst)],
                    ['Alokasi Beban Hadiah & THR', formatRupiah(closingReport.totalThrAllocated)],
                    ['Estimasi Laba Kotor Usaha', formatRupiah(closingReport.estimatedGrossProfit)],
                    ['Rasio Margin Laba Bersih', `${closingReport.profitMargin}%`],
                    ['Total Target Tabungan Portfolio', formatRupiah(closingReport.totalTarget)],
                    ['Jumlah Kontrak Tabungan', `${closingReport.totalContracts} Kontrak (${closingReport.lunasContracts} Lunas)`],
                  ];
                  const csv = [headers.join(','), ...rows.map((r) => `"${r[0]}","${r[1]}"`)].join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `laporan-tutup-buku-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-800" />
                <span>Export CSV Tutup Buku</span>
              </button>
            </div>
          </div>

          {/* Lembar Laporan Formal (Printable Sheet) */}
          <div className="rounded-2xl border border-stone-300 bg-white p-6 sm:p-10 shadow-sm space-y-6">
            {/* Header Kop Surat Perusahaan */}
            <div className="border-b-2 border-stone-900 pb-5 text-center space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Building2 className="h-6 w-6 text-[#0C3328]" />
                <h1 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-stone-900">
                  PT. SAGITARIUS TRINUNGGAL KARYA
                </h1>
              </div>
              <p className="text-xs font-semibold text-stone-700">
                Penyelenggara Tabungan &amp; Bingkisan Parsel Lebaran Terpadu Priangan Timur
              </p>
              <p className="text-[11px] text-stone-500">
                Bantar Peundeuy RT. 006 RW. 001 Margajaya Mangunreja Kab. Tasikmalaya Jawa Barat 46462 · WA: 0813 2438 3479 · www.sagitarius-parcel.web.id
              </p>
              <div className="pt-2">
                <span className="inline-block rounded-md bg-[#FAF7F2] border border-[#E4DCCB] px-4 py-1 text-xs font-bold text-[#381E5A] uppercase tracking-wider">
                  IKHTISAR LABA RUGI &amp; REKONSILIASI PENUTUPAN BUKU PERIODE RAMADHAN 1447H / 2026M
                </span>
              </div>
              <p className="text-[10px] text-stone-400 font-mono-nums">
                Dicetak pada: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Metrik Finansial Utama (P&L Breakdown) */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                  Penerimaan Kas (Gross)
                </p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-[#0C3328]">
                  {formatRupiah(closingReport.grossCollected)}
                </p>
                <p className="text-[10px] text-stone-500">
                  Total dana tervalidasi masuk
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                  Beban Pokok Parsel (HPP)
                </p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-rose-800">
                  {formatRupiah(closingReport.totalHppCost)}
                </p>
                <p className="text-[10px] text-stone-500">
                  Estimasi belanja komoditas
                </p>
              </div>

              <div className="rounded-xl border border-stone-200 bg-[#FAF7F2] p-3.5">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                  Beban Komisi &amp; Bonus
                </p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-[#381E5A]">
                  {formatRupiah(closingReport.totalCommissionEst + closingReport.totalThrAllocated)}
                </p>
                <p className="text-[10px] text-stone-500">
                  Komisi agen &amp; alokasi THR
                </p>
              </div>

              <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5">
                <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide">
                  Estimasi Laba Kotor Usaha
                </p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-emerald-950">
                  {formatRupiah(closingReport.estimatedGrossProfit)}
                </p>
                <p className="text-[10px] font-bold text-emerald-800">
                  Margin: {closingReport.profitMargin}% dari arus kas
                </p>
              </div>
            </div>

            {/* Tabel Konsolidasi Per Wilayah */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wide border-b border-stone-200 pb-1.5">
                Konsolidasi Operasional Per Wilayah Priangan Timur
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-stone-300 font-bold text-stone-600">
                      <th className="py-2 pr-3">Wilayah Priangan</th>
                      <th className="py-2 pr-3 text-right">Agen Aktif</th>
                      <th className="py-2 pr-3 text-right">Kontrak Live</th>
                      <th className="py-2 pr-3 text-right">Target Portfolio</th>
                      <th className="py-2 pr-3 text-right">Dana Masuk</th>
                      <th className="py-2 pr-3 text-right">Beban Komisi</th>
                      <th className="py-2 text-right">Pencapaian (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200">
                    {korwilRecap.map((row) => (
                      <tr key={row.wilayah} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-3 font-semibold text-stone-900">{row.wilayah}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-nums">{row.agentCount} Agen</td>
                        <td className="py-2.5 pr-3 text-right font-mono-nums">{row.contractCount}</td>
                        <td className="py-2.5 pr-3 text-right font-mono-nums text-stone-600">
                          {formatRupiah(row.totalTarget)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono-nums font-bold text-[#0C3328]">
                          {formatRupiah(row.totalCollected)}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono-nums text-amber-800">
                          {formatRupiah(row.totalCommission)}
                        </td>
                        <td className="py-2 text-right font-mono-nums font-semibold text-stone-800">
                          {row.pct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-stone-900 font-bold bg-[#FAF7F2]">
                      <td className="py-2.5 pr-3 text-stone-900">TOTAL KONSOLIDASI</td>
                      <td className="py-2.5 pr-3 text-right font-mono-nums">
                        {korwilRecap.reduce((s, r) => s + r.agentCount, 0)} Agen
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono-nums">
                        {closingReport.totalContracts} Kontrak
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono-nums">
                        {formatRupiah(closingReport.totalTarget)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono-nums text-[#0C3328]">
                        {formatRupiah(closingReport.netCashInflow)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono-nums text-amber-800">
                        {formatRupiah(closingReport.totalCommissionEst)}
                      </td>
                      <td className="py-2 text-right font-mono-nums">
                        {closingReport.totalTarget > 0
                          ? Math.round((closingReport.netCashInflow / closingReport.totalTarget) * 100)
                          : 0}
                        %
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Pernyataan Integritas & Tanda Tangan */}
            <div className="pt-6 border-t border-stone-300">
              <p className="text-[11px] text-stone-500 italic text-center mb-8">
                Laporan ini diterbitkan secara otomatis dari buku besar digital Sagitarius Parcel 2.0 dan disahkan oleh manajemen PT Sagitarius Trinunggal Karya.
              </p>

              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                <div className="space-y-12">
                  <p className="text-stone-600 font-semibold">Disiapkan Oleh,</p>
                  <div className="border-t border-stone-400 pt-1.5">
                    <p className="font-bold text-stone-900">Petugas Keuangan</p>
                    <p className="text-[10px] text-stone-500">Admin Keuangan Pusat</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-stone-600 font-semibold">Diperiksa Oleh,</p>
                  <div className="border-t border-stone-400 pt-1.5">
                    <p className="font-bold text-stone-900">Koordinator Wilayah</p>
                    <p className="text-[10px] text-stone-500">Logistik &amp; Distribusi Priangan</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="text-stone-600 font-semibold">Disetujui Oleh,</p>
                  <div className="border-t border-stone-400 pt-1.5">
                    <p className="font-bold text-[#0C3328]">Direktur Utama</p>
                    <p className="text-[10px] text-stone-500">PT Sagitarius Trinunggal Karya</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
