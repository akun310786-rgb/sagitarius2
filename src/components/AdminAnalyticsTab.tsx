import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calculator,
  Download,
  Package as PackageIcon,
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
  const [analyticsView, setAnalyticsView] = useState<'grafik' | 'hpp' | 'audit'>('grafik');
  const [hppCategoryFilter, setHppCategoryFilter] = useState<string>('all');

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
    </div>
  );
};
