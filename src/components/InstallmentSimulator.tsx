import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Lock, Sparkles, UserCheck } from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import { AgentDirectoryItem, ParcelPackage, SimulationLock } from '../types';

interface InstallmentSimulatorProps {
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  initialPackageId?: string;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  onLockSimulation: (lock: SimulationLock) => void;
}

export const InstallmentSimulator: React.FC<InstallmentSimulatorProps> = ({
  packages,
  agents,
  initialPackageId,
  selectedAgentId,
  onSelectAgent,
  onLockSimulation,
}) => {
  const [simPackageId, setSimPackageId] = useState<string>(
    initialPackageId || packages[0]?.id || 'pkg_bunda_reguler'
  );
  const [durasiMinggu, setDurasiMinggu] = useState<number>(46);
  const [frekuensi, setFrekuensi] = useState<'harian' | 'mingguan'>('harian');

  useEffect(() => {
    if (initialPackageId) {
      setSimPackageId(initialPackageId);
    }
  }, [initialPackageId]);

  const simPackage = useMemo(
    () => packages.find((p) => p.id === simPackageId) || packages[0],
    [packages, simPackageId]
  );

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || agents[0],
    [agents, selectedAgentId]
  );

  const estimasiMingguan = useMemo(() => {
    if (!simPackage) return 0;
    return Math.ceil(simPackage.harga_total / durasiMinggu / 500) * 500;
  }, [simPackage, durasiMinggu]);

  const estimasiHarian = useMemo(() => {
    if (!simPackage) return 0;
    const totalHari = durasiMinggu === 46 ? simPackage.durasi_hari : durasiMinggu * 7;
    return Math.ceil(simPackage.harga_total / totalHari / 25) * 25;
  }, [simPackage, durasiMinggu]);

  const handleLockClick = () => {
    if (!simPackage) return;
    onLockSimulation({
      packageItem: simPackage,
      durasiMinggu,
      frekuensi,
      estimasiSetoran: frekuensi === 'harian' ? estimasiHarian : estimasiMingguan,
      selectedAgentId: selectedAgent?.id || agents[0]?.id,
    });
  };

  return (
    <div
      id="simulator"
      className="rounded-2xl border border-[#E4DCCB] bg-white p-4 shadow-xs sm:p-8"
    >
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
        <div className="min-w-0 space-y-5 lg:col-span-7">
          <div>
            <p className="text-xs font-semibold text-[#C8A053]">
              Kalkulator &amp; Simulator Cicilan Resmi
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
              Atur Durasi &amp; Besaran Setoran Anda
            </h2>
            <p className="mt-1.5 text-sm text-stone-600">
              Pilih paket atau barang satuan dari brosur resmi, atur durasi menabung (standar 325 hari / 46 minggu atau percepat 12–48 minggu), pilih agen terdekat, lalu kunci simulasi untuk mendaftar di Buku Tabungan Member.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sim-pkg" className="block text-xs font-semibold text-stone-700">
                Pilih Paket / Barang Satuan
              </label>
              <select
                id="sim-pkg"
                value={simPackage?.id || ''}
                onChange={(e) => setSimPackageId(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#DFD6C3] bg-[#FAF7F2] px-3 py-2.5 text-sm font-medium text-stone-900 focus:border-[#0C3328] focus:outline-none"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_paket} — {formatRupiah(p.setoran_harian)}/hr ({formatRupiah(p.harga_total)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-agent" className="block text-xs font-semibold text-stone-700">
                Agen Penyetor Priangan Timur
              </label>
              <select
                id="sim-agent"
                value={selectedAgent?.id || ''}
                onChange={(e) => onSelectAgent(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#DFD6C3] bg-[#FAF7F2] px-3 py-2.5 text-sm font-medium text-stone-900 focus:border-[#0C3328] focus:outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.wilayah} — {a.nama} ({a.kode_agen})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="durasi-slider" className="text-xs font-semibold text-stone-700">
                Durasi Menabung
              </label>
              <span className="font-mono-nums text-sm font-bold text-[#381E5A]">
                {durasiMinggu} Minggu (
                {durasiMinggu === 46 ? simPackage?.durasi_hari || 325 : durasiMinggu * 7} Hari)
              </span>
            </div>
            <input
              id="durasi-slider"
              type="range"
              min={12}
              max={48}
              step={1}
              value={durasiMinggu}
              onChange={(e) => setDurasiMinggu(Number(e.target.value))}
              className="h-2 w-full cursor-pointer accent-[#0C3328]"
            />
            <div className="flex flex-wrap gap-2">
              {[
                { w: 12, label: '12 Minggu' },
                { w: 30, label: '30 Minggu' },
                { w: 46, label: '325 Hari (Standar)' },
                { w: 48, label: '48 Minggu' },
              ].map((preset) => (
                <button
                  key={preset.w}
                  type="button"
                  onClick={() => setDurasiMinggu(preset.w)}
                  className={`rounded-lg px-3 py-1.5 font-mono-nums text-xs font-semibold transition cursor-pointer ${
                    durasiMinggu === preset.w
                      ? 'bg-[#0C3328] text-white'
                      : 'border border-[#E4DCCB] bg-[#FAF7F2] text-stone-700 hover:bg-[#EFE9DC]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-semibold text-stone-700">
              Frekuensi Setoran Pilihan
            </span>
            <div className="inline-flex rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-1">
              <button
                type="button"
                onClick={() => setFrekuensi('harian')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  frekuensi === 'harian'
                    ? 'bg-[#0C3328] text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Setoran Harian
              </button>
              <button
                type="button"
                onClick={() => setFrekuensi('mingguan')}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  frekuensi === 'mingguan'
                    ? 'bg-[#0C3328] text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Setoran Mingguan
              </button>
            </div>
          </div>
        </div>

        {/* Simulation Summary Panel (Dark Emerald + Gold luxury accent) */}
        <div className="min-w-0 bg-arabesque-emerald flex flex-col justify-between rounded-2xl border border-[#C8A053]/40 p-5 sm:p-6 text-white lg:col-span-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E8CA82]">
              <Sparkles className="h-4 w-4" />
              <span>Ringkasan Simulasi Anda</span>
            </div>
            <h3 className="mt-1 font-display text-xl font-bold text-white">
              {simPackage?.nama_paket}
            </h3>

            <div className="mt-5 space-y-2.5 border-y border-white/15 py-4 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-stone-300">Target Tabungan</span>
                <span className="font-mono-nums font-semibold text-white">
                  {formatRupiah(simPackage?.harga_total || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-300">Estimasi Harian</span>
                <span className="font-mono-nums font-semibold text-white">
                  {formatRupiah(estimasiHarian)} / hari
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-300">Estimasi Mingguan</span>
                <span className="font-mono-nums font-semibold text-white">
                  {formatRupiah(estimasiMingguan)} / minggu
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-300">Bonus THR Tunai</span>
                <span className="font-mono-nums font-semibold text-[#E8CA82]">
                  {formatRupiah(simPackage?.bonus_thr || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 text-stone-300">
                  <Calendar className="h-3.5 w-3.5 text-[#E8CA82]" />
                  Jadwal Ambil
                </span>
                <span className="font-medium text-white">{simPackage?.jadwal_ambil}</span>
              </div>
              {selectedAgent && (
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-stone-300">
                    <UserCheck className="h-3.5 w-3.5 text-[#E8CA82]" />
                    Agen Pilihan
                  </span>
                  <span className="font-medium text-white">
                    {selectedAgent.nama} ({selectedAgent.wilayah})
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs text-stone-300">
                Setoran {frekuensi === 'harian' ? 'Harian' : 'Mingguan'} Terpilih
              </p>
              <p className="font-mono-nums text-3xl font-bold text-[#E8CA82]">
                {formatRupiah(frekuensi === 'harian' ? estimasiHarian : estimasiMingguan)}
                <span className="text-sm font-normal text-stone-200">
                  {' '}
                  / {frekuensi === 'harian' ? 'hari' : 'minggu'}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLockClick}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-5 py-3.5 text-sm font-bold text-[#1D122B] shadow-sm transition hover:brightness-105 cursor-pointer"
          >
            <Lock className="h-4 w-4" />
            <span>Kunci Simulasi Ini &amp; Daftar</span>
          </button>
        </div>
      </div>
    </div>
  );
};
