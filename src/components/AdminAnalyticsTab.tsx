import React, { useMemo } from 'react';
import { BarChart3, Package as PackageIcon, TrendingUp, Wallet } from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import { Deposit, ParcelPackage, Subscription, WilayahPriangan } from '../types';

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
}

export const AdminAnalyticsTab: React.FC<AdminAnalyticsTabProps> = ({
  korwilRecap,
  subscriptions,
  deposits,
  packages,
}) => {
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

  return (
    <div className="space-y-6">
      {/* Row 1: Regional Performance & Cashflow Summary */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Regional Comparison Chart */}
        <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-[#E4DCCB]/70 pb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#381E5A]" />
              <div>
                <h2 className="font-display text-lg font-bold text-[#381E5A]">
                  Performa Wilayah Priangan Timur
                </h2>
                <p className="text-xs text-stone-600">
                  Perbandingan Target Kontrak vs Dana Terkumpul pada 5 Kabupaten/Kota
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1 text-stone-500">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#E4DCCB]" />
                Target
              </span>
              <span className="inline-flex items-center gap-1 text-[#0C3328]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#0C3328]" />
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
                    <span className="font-bold text-[#381E5A]">
                      {row.wilayah}{' '}
                      <span className="font-normal text-stone-500">
                        ({row.contractCount} kontrak · {row.agentCount} agen)
                      </span>
                    </span>
                    <span className="font-mono-nums font-bold text-[#0C3328]">
                      {formatRupiah(row.totalCollected)}{' '}
                      <span className="font-normal text-stone-500">
                        / {formatRupiah(row.totalTarget)} ({row.pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FAF7F2]">
                      <div
                        className="h-full rounded-full bg-[#E4DCCB] transition-all"
                        style={{ width: `${Math.max(row.totalTarget > 0 ? 3 : 0, targetW)}%` }}
                      />
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#FAF7F2]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0C3328] to-[#1D6B54] transition-all"
                        style={{ width: `${Math.max(row.totalCollected > 0 ? 3 : 0, collectedW)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cashflow Balance Card */}
        <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 lg:col-span-5">
          <div className="flex items-center gap-2 border-b border-[#E4DCCB]/70 pb-4">
            <Wallet className="h-5 w-5 text-[#0C3328]" />
            <div>
              <h2 className="font-display text-lg font-bold text-[#381E5A]">
                Arus Kas Mutasi Tervalidasi
              </h2>
              <p className="text-xs text-stone-600">
                Setoran masuk vs penarikan keluar yang telah diverifikasi
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">Setoran Masuk ({cashflow.countIn}x)</span>
                <span className="font-mono-nums font-bold text-[#0C3328]">
                  +{formatRupiah(cashflow.totalIn)}
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-[#0C3328]"
                  style={{ width: `${Math.max(cashflow.totalIn > 0 ? 4 : 0, cashflow.inPct)}%` }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-600">Penarikan Keluar ({cashflow.countOut}x)</span>
                <span className="font-mono-nums font-bold text-rose-700">
                  -{formatRupiah(cashflow.totalOut)}
                </span>
              </div>
              <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-rose-600"
                  style={{ width: `${Math.max(cashflow.totalOut > 0 ? 4 : 0, cashflow.outPct)}%` }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#0C3328] p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#E8CA82]">Saldo Kas Bersih Mutasi</p>
                  <p className="mt-1 font-mono-nums text-xl font-bold text-white">
                    {formatRupiah(cashflow.net)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-stone-300">Rasio Retensi</p>
                  <p className="mt-1 inline-flex items-center gap-1 font-mono-nums text-lg font-bold text-[#E8CA82]">
                    <TrendingUp className="h-4 w-4" />
                    {cashflow.netRatio}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Top 5 Packages Chart */}
      <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
        <div className="flex items-center gap-2 border-b border-[#E4DCCB]/70 pb-4">
          <PackageIcon className="h-5 w-5 text-[#C8A053]" />
          <div>
            <h2 className="font-display text-lg font-bold text-[#381E5A]">
              Top 5 Paket Paling Diminati Member
            </h2>
            <p className="text-xs text-stone-600">
              Peringkat paket berdasarkan jumlah kontrak aktif &amp; lunas tercatat
            </p>
          </div>
        </div>

        {topPackages.list.length === 0 ? (
          <p className="mt-6 rounded-xl bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
            Belum ada data kontrak paket untuk ditampilkan dalam grafik peringkat.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-5">
            {topPackages.list.map((item, idx) => {
              const barPct = Math.round((item.count / topPackages.maxCount) * 100);
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md bg-[#381E5A] px-2 py-0.5 font-mono-nums text-[10px] font-bold text-[#E8CA82]">
                        #{idx + 1}
                      </span>
                      <span className="font-mono-nums text-xs font-bold text-[#0C3328]">
                        {item.count} Kontrak
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm font-bold text-[#381E5A] line-clamp-2">
                      {item.nama}
                    </p>
                  </div>
                  <div className="mt-4 space-y-1.5">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#381E5A] to-[#C8A053]"
                        style={{ width: `${Math.max(12, barPct)}%` }}
                      />
                    </div>
                    <p className="font-mono-nums text-[11px] font-semibold text-stone-600">
                      Terkumpul: {formatRupiah(item.collected)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
