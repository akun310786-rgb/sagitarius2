import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  Clock,
  Download,
  Filter,
  MessageCircle,
  Phone,
  Search,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { formatRupiah, formatWhatsAppUrl } from '../data/catalogData';
import {
  AgentDirectoryItem,
  Deposit,
  Subscription,
  WilayahPriangan,
  WILAYAH_LIST,
} from '../types';

interface AdminDelinquencyTabProps {
  subscriptions: Subscription[];
  deposits: Deposit[];
  agents: AgentDirectoryItem[];
}

interface DelinquencyRow {
  subscription: Subscription;
  lastDepositDate: string | null;
  daysSinceLastDeposit: number;
  totalCollected: number;
  targetNominal: number;
  progressPct: number;
  severity: 'parah' | 'waspada' | 'lancar';
  agentInfo: {
    nama: string;
    no_wa: string;
    kode: string;
  } | null;
  memberWa: string;
}

export const AdminDelinquencyTab: React.FC<AdminDelinquencyTabProps> = ({
  subscriptions,
  deposits,
  agents,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWilayah, setSelectedWilayah] = useState<'all' | WilayahPriangan>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'parah' | 'waspada'>('all');
  const [selectedAgentCode, setSelectedAgentCode] = useState<string>('all');

  // Agent lookup map
  const agentMap = useMemo(() => {
    const map = new Map<string, AgentDirectoryItem>();
    agents.forEach((a) => {
      if (a.kode_agen) map.set(a.kode_agen.toUpperCase(), a);
      if (a.id) map.set(a.id, a);
    });
    return map;
  }, [agents]);

  // Map deposits by subscription id to find latest verified deposit
  const lastDepositMap = useMemo(() => {
    const map = new Map<string, Deposit>();
    deposits.forEach((d) => {
      if (d.status_verifikasi !== 'verified') return;
      const prev = map.get(d.subscription_id);
      if (!prev || d.tanggal > prev.tanggal) {
        map.set(d.subscription_id, d);
      }
    });
    return map;
  }, [deposits]);

  // Compute delinquency for all active contracts
  const delinquencyRows = useMemo<DelinquencyRow[]>(() => {
    const now = new Date();
    const activeSubs = subscriptions.filter((s) => s.status === 'aktif');

    return activeSubs.map((sub) => {
      const lastDep = lastDepositMap.get(sub.id);
      let days = 999;
      let lastDateStr: string | null = null;

      if (lastDep?.tanggal) {
        lastDateStr = lastDep.tanggal;
        const depDate = new Date(lastDep.tanggal);
        if (!isNaN(depDate.getTime())) {
          const diffMs = now.getTime() - depDate.getTime();
          days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      } else if (sub.createdAt) {
        // Fallback to subscription creation date
        const cObj = sub.createdAt as { seconds?: number; toDate?: () => Date };
        const createdDate = cObj.toDate
          ? cObj.toDate()
          : cObj.seconds
            ? new Date(cObj.seconds * 1000)
            : null;
        if (createdDate && !isNaN(createdDate.getTime())) {
          const diffMs = now.getTime() - createdDate.getTime();
          days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
        }
      }

      let severity: 'parah' | 'waspada' | 'lancar' = 'lancar';
      if (days >= 14) {
        severity = 'parah';
      } else if (days >= 7) {
        severity = 'waspada';
      }

      // Extract WA number from member_nama if format includes phone or lookup
      const waMatch = sub.member_nama.match(/(?:08|\+628|628)\d{8,13}/);
      const memberWa = waMatch ? waMatch[0].replace(/\D/g, '') : '';

      // Lookup agent info
      const agentObj =
        (sub.agen_kode && agentMap.get(sub.agen_kode.toUpperCase())) ||
        (sub.agen_id && agentMap.get(sub.agen_id)) ||
        null;

      const agentInfo = agentObj
        ? {
            nama: agentObj.nama,
            no_wa: agentObj.no_wa,
            kode: agentObj.kode_agen,
          }
        : sub.agen_nama
          ? {
              nama: sub.agen_nama,
              no_wa: '',
              kode: sub.agen_kode || '',
            }
          : null;

      const progressPct =
        sub.target_nominal > 0
          ? Math.min(100, Math.round((sub.total_terkumpul / sub.target_nominal) * 100))
          : 0;

      return {
        subscription: sub,
        lastDepositDate: lastDateStr,
        daysSinceLastDeposit: days,
        totalCollected: sub.total_terkumpul,
        targetNominal: sub.target_nominal,
        progressPct,
        severity,
        agentInfo,
        memberWa,
      };
    });
  }, [subscriptions, lastDepositMap, agentMap]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return delinquencyRows.filter((row) => {
      if (severityFilter === 'parah' && row.severity !== 'parah') return false;
      if (severityFilter === 'waspada' && row.severity !== 'waspada') return false;
      if (severityFilter === 'all' && row.severity === 'lancar') {
        // By default on Early Warning view, show delinquent only unless searching
        if (!searchQuery.trim() && selectedWilayah === 'all' && selectedAgentCode === 'all') {
          return false;
        }
      }

      if (selectedWilayah !== 'all' && row.subscription.wilayah !== selectedWilayah) {
        return false;
      }

      if (
        selectedAgentCode !== 'all' &&
        row.subscription.agen_kode?.toUpperCase() !== selectedAgentCode.toUpperCase()
      ) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = row.subscription.member_nama.toLowerCase().includes(q);
        const matchPkg = row.subscription.package_nama.toLowerCase().includes(q);
        const matchAgent = (row.agentInfo?.nama || '').toLowerCase().includes(q);
        const matchKode = (row.subscription.agen_kode || '').toLowerCase().includes(q);
        if (!matchName && !matchPkg && !matchAgent && !matchKode) return false;
      }

      return true;
    });
  }, [delinquencyRows, severityFilter, selectedWilayah, selectedAgentCode, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const parahList = delinquencyRows.filter((r) => r.severity === 'parah');
    const waspadaList = delinquencyRows.filter((r) => r.severity === 'waspada');
    const totalTertahan = [...parahList, ...waspadaList].reduce(
      (sum, r) => sum + (r.targetNominal - r.totalCollected),
      0
    );

    return {
      parahCount: parahList.length,
      waspadaCount: waspadaList.length,
      totalTertahan,
      totalActive: delinquencyRows.length,
    };
  }, [delinquencyRows]);

  // Export CSV helper
  const handleExportCsv = () => {
    const headers = [
      'Wilayah',
      'Nama Member',
      'Nomor Kontak Member',
      'Paket',
      'Saldo Terkumpul',
      'Target Nominal',
      'Sisa Tagihan',
      'Terakhir Setor (Hari Lalu)',
      'Status Keterlambatan',
      'Kode Agen',
      'Nama Agen Pembina',
      'WhatsApp Agen',
    ];

    const rows = filteredRows.map((r) => [
      r.subscription.wilayah,
      r.subscription.member_nama,
      r.memberWa || '-',
      r.subscription.package_nama,
      r.totalCollected,
      r.targetNominal,
      Math.max(0, r.targetNominal - r.totalCollected),
      r.daysSinceLastDeposit === 999 ? 'Belum pernah' : `${r.daysSinceLastDeposit} hari`,
      r.severity === 'parah' ? 'Macet > 14 Hari' : r.severity === 'waspada' ? 'Menunggak 7-14 Hari' : 'Lancar',
      r.subscription.agen_kode || '-',
      r.agentInfo?.nama || r.subscription.agen_nama || '-',
      r.agentInfo?.no_wa || '-',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pengawasan-macet-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header & KPI Summary */}
      <div className="rounded-xl border border-rose-200 bg-linear-to-r from-rose-50 via-amber-50 to-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-700" />
              <h2 className="font-display text-lg font-bold text-stone-900">
                Pengawasan Risiko Tabungan Macet &amp; Early Warning
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Deteksi dini konsumen aktif yang tidak menyetor harian/mingguan. Hubungi Agen binaan untuk jemput bola sebelum menjelang Idul Fitri.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 shadow-xs hover:bg-stone-50 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-stone-600" />
            <span>Export CSV Tagihan Macet</span>
          </button>
        </div>

        {/* Metrik Angka */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-rose-300/80 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800">
              <span>Macet Parah (&gt;14 Hari)</span>
              <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <p className="mt-1 font-mono-nums text-xl font-bold text-rose-950">
              {stats.parahCount}{' '}
              <span className="text-xs font-normal text-stone-500">Kontrak</span>
            </p>
            <p className="text-[10px] text-stone-500">Perlu penanganan mendesak</p>
          </div>

          <div className="rounded-xl border border-amber-300/80 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800">
              <span>Menunggak (7–14 Hari)</span>
              <Clock className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="mt-1 font-mono-nums text-xl font-bold text-amber-950">
              {stats.waspadaCount}{' '}
              <span className="text-xs font-normal text-stone-500">Kontrak</span>
            </p>
            <p className="text-[10px] text-stone-500">Perlu diingatkan Agen</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-600">
              <span>Potensi Dana Tertahan</span>
              <ArrowDownRight className="h-3.5 w-3.5 text-stone-500" />
            </div>
            <p className="mt-1 font-mono-nums text-base font-bold text-stone-900 truncate">
              {formatRupiah(stats.totalTertahan)}
            </p>
            <p className="text-[10px] text-stone-500">Total sisa target tertunggak</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-800">
              <span>Total Kontrak Aktif</span>
              <Users className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <p className="mt-1 font-mono-nums text-xl font-bold text-emerald-950">
              {stats.totalActive}
            </p>
            <p className="text-[10px] text-stone-500">Dalam pembinaan wilayah</p>
          </div>
        </div>
      </div>

      {/* Filter & Kontrol Pencarian */}
      <div className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama member, nama paket, atau agen..."
            className="w-full rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs text-stone-900 focus:border-stone-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-stone-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Kategori:</span>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as 'all' | 'parah' | 'waspada')}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
          >
            <option value="all">Semua Tertunggak (&ge;7 Hari)</option>
            <option value="parah">Macet Parah (&gt;14 Hari Saja)</option>
            <option value="waspada">Menunggak (7–14 Hari Saja)</option>
          </select>

          <select
            value={selectedWilayah}
            onChange={(e) => setSelectedWilayah(e.target.value as 'all' | WilayahPriangan)}
            className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
          >
            <option value="all">Semua Wilayah</option>
            {WILAYAH_LIST.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>

          {agents.length > 0 && (
            <select
              value={selectedAgentCode}
              onChange={(e) => setSelectedAgentCode(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
            >
              <option value="all">Semua Agen Binaan ({agents.length})</option>
              {agents.map((a) => (
                <option key={a.id} value={a.kode_agen}>
                  {a.kode_agen} — {a.nama}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Tabel Data Konsumen Menunggak */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-stone-800">
            Daftar Kontrak Perlu Tindak Lanjut ({filteredRows.length} Kontrak)
          </p>
          <span className="text-[11px] text-stone-500">
            Klik tombol WhatsApp untuk instruksikan jemput bola ke Agen atau kontak Member
          </span>
        </div>

        {filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
            <UserCheck className="mx-auto h-8 w-8 text-emerald-700 mb-2" />
            <p className="font-bold text-stone-800">Tidak ada kontrak menunggak sesuai filter.</p>
            <p className="mt-0.5 text-stone-500">
              Seluruh konsumen aktif dalam pantauan menyetor dengan teratur dalam kurun waktu 7 hari terakhir.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="py-2.5 pr-3">Member &amp; Wilayah</th>
                  <th className="py-2.5 pr-3">Paket Diikuti</th>
                  <th className="py-2.5 pr-3 text-right">Saldo / Target</th>
                  <th className="py-2.5 pr-3">Terakhir Setor</th>
                  <th className="py-2.5 pr-3">Status Tunggakan</th>
                  <th className="py-2.5 pr-3">Agen Pembina</th>
                  <th className="py-2.5 text-right font-semibold">Aksi Jemput Bola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRows.map((r) => {
                  const sisa = Math.max(0, r.targetNominal - r.totalCollected);
                  const isParah = r.severity === 'parah';

                  // Pesan template WA untuk Agen
                  const waAgenMsg = `Halo Agen ${r.agentInfo?.nama || 'Sagitarius'},\n\nMohon bantuan follow-up dan jemput bola untuk konsumen binaan Anda:\n👤 Nama Member: ${r.subscription.member_nama}\n📦 Paket: ${r.subscription.package_nama}\n💰 Saldo Terkumpul: ${formatRupiah(r.totalCollected)} dari target ${formatRupiah(r.targetNominal)}\n⚠️ Catatan: Tercatat belum melakukan setoran selama ${r.daysSinceLastDeposit === 999 ? 'lebih dari 14' : r.daysSinceLastDeposit} hari terakhir.\n\nMohon segera dikunjungi atau dihubungi agar target tabungan Lebaran tidak tertinggal. Terima kasih. - Admin Pusat Sagitarius Parcel`;

                  // Pesan template WA untuk Member
                  const waMemberMsg = `Halo ${r.subscription.member_nama},\n\nKami dari Sagitarius Parcel menginformasikan bahwa tabungan paket *${r.subscription.package_nama}* Anda saat ini terkumpul *${formatRupiah(r.totalCollected)}* (Sisa target: *${formatRupiah(sisa)}*).\n\nUntuk menjaga kelancaran persiapan bingkisan Lebaran Idul Fitri dan kelayakan kupon Door Prize, mohon dapat melanjutkan setoran rutin melalui Agen binaan Anda (${r.agentInfo?.nama || 'Agen Resmi'}). Terima kasih!`;

                  return (
                    <tr key={r.subscription.id} className="hover:bg-[#FAF7F2]/60">
                      <td className="py-3 pr-3">
                        <p className="font-bold text-stone-900">{r.subscription.member_nama}</p>
                        <p className="text-[11px] text-stone-500">
                          {r.subscription.wilayah}
                          {r.memberWa ? ` · ${r.memberWa}` : ''}
                        </p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#381E5A]">
                          {r.subscription.package_nama}
                        </p>
                        <span className="font-mono-nums text-[10px] text-stone-500">
                          {r.progressPct}% tercapai
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <p className="font-mono-nums font-bold text-stone-900">
                          {formatRupiah(r.totalCollected)}
                        </p>
                        <p className="font-mono-nums text-[11px] text-rose-700">
                          Kurang {formatRupiah(sisa)}
                        </p>
                      </td>
                      <td className="py-3 pr-3 font-mono-nums">
                        {r.lastDepositDate ? (
                          <>
                            <p className="font-semibold text-stone-800">{r.lastDepositDate}</p>
                            <p className="text-[10px] text-stone-500">
                              {r.daysSinceLastDeposit} hari lalu
                            </p>
                          </>
                        ) : (
                          <span className="text-stone-400">Belum pernah setor</span>
                        )}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isParah
                              ? 'bg-rose-100 text-rose-900'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>
                            {isParah
                              ? `Macet ${r.daysSinceLastDeposit === 999 ? '>14' : r.daysSinceLastDeposit} Hari`
                              : `Menunggak ${r.daysSinceLastDeposit} Hari`}
                          </span>
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-stone-800">
                          {r.agentInfo?.nama || r.subscription.agen_nama || '—'}
                        </p>
                        <p className="font-mono-nums text-[10px] text-emerald-800">
                          {r.subscription.agen_kode || '—'}
                        </p>
                      </td>
                      <td className="py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Tombol Kontak Agen */}
                          {r.agentInfo?.no_wa ? (
                            <a
                              href={formatWhatsAppUrl(r.agentInfo.no_wa, waAgenMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-[#0C3328] px-2.5 py-1 text-[11px] font-semibold text-[#E8CA82] hover:bg-[#154c3c]"
                              title="Instruksikan jemput bola ke Agen via WhatsApp"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>WA Agen</span>
                            </a>
                          ) : (
                            <span className="text-[10px] text-stone-400">No WA Agen -</span>
                          )}

                          {/* Tombol Kontak Member Langsung */}
                          {r.memberWa && (
                            <a
                              href={formatWhatsAppUrl(r.memberWa, waMemberMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                              title="Kirim pengingat ramah langsung ke Member"
                            >
                              <Phone className="h-3 w-3 text-stone-500" />
                              <span>Member</span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
