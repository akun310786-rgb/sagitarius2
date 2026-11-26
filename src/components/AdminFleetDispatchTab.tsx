import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Truck,
  Users,
} from 'lucide-react';
import { formatWhatsAppUrl } from '../data/catalogData';
import {
  AgentDirectoryItem,
  DeliveryStage,
  Subscription,
  WilayahPriangan,
  WILAYAH_LIST,
} from '../types';

export interface FleetDispatchRecord {
  id: string;
  nopolArmada: string;
  jenisKendaraan: string;
  driverNama: string;
  driverWa: string;
  wilayahTujuan: WilayahPriangan;
  dropPointAgenNama: string;
  dropPointAgenWa: string;
  tanggalKirim: string;
  estimasiTiba: string;
  subscriptionIds: string[];
  totalPaket: number;
  status: 'dipacking' | 'on_delivery' | 'tiba_drop_point' | 'selesai';
  catatan?: string;
}

interface AdminFleetDispatchTabProps {
  subscriptions: Subscription[];
  agents: AgentDirectoryItem[];
  onUpdateDeliveryStage: (subIds: string[], stage: DeliveryStage) => Promise<void>;
}

export const AdminFleetDispatchTab: React.FC<AdminFleetDispatchTabProps> = ({
  subscriptions,
  agents,
  onUpdateDeliveryStage,
}) => {
  const [dispatches, setDispatches] = useState<FleetDispatchRecord[]>([
    {
      id: 'DISP-TSK-01',
      nopolArmada: 'Z 8899 SP',
      jenisKendaraan: 'Gran Max Blind Van',
      driverNama: 'Kang Asep Supriatna',
      driverWa: '081324383479',
      wilayahTujuan: 'Tasikmalaya',
      dropPointAgenNama: 'Agen Pusat Margajaya',
      dropPointAgenWa: '081324383479',
      tanggalKirim: new Date().toISOString().slice(0, 10),
      estimasiTiba: '14:00 WIB',
      subscriptionIds: [],
      totalPaket: 24,
      status: 'on_delivery',
      catatan: 'Prioritas Paket Bunda Reguler & Paket Anak Hemat',
    },
  ]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWilayahFilter, setSelectedWilayahFilter] = useState<'all' | WilayahPriangan>('all');
  const [updatingDispatchId, setUpdatingDispatchId] = useState<string | null>(null);

  // Form states for new dispatch
  const [formNopol, setFormNopol] = useState('Z ');
  const [formKendaraan, setFormKendaraan] = useState('Gran Max Box');
  const [formDriverNama, setFormDriverNama] = useState('');
  const [formDriverWa, setFormDriverWa] = useState('');
  const [formWilayah, setFormWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const [formDropPointAgenId, setFormDropPointAgenId] = useState('');
  const [formEstimasiTiba, setFormEstimasiTiba] = useState('15:00 WIB');
  const [formCatatan, setFormCatatan] = useState('');
  const [selectedSubIds, setSelectedSubIds] = useState<Record<string, boolean>>({});

  // Eligible ready-to-deliver subscriptions (lunas and in packing stage)
  const readySubscriptions = useMemo(() => {
    return subscriptions.filter(
      (s) =>
        s.status === 'lunas' &&
        (!s.status_pengiriman ||
          s.status_pengiriman === 'dikemas_gudang' ||
          s.status_pengiriman === 'kirim_korwil')
    );
  }, [subscriptions]);

  const regionalReadySubs = useMemo(() => {
    return readySubscriptions.filter((s) => s.wilayah === formWilayah);
  }, [readySubscriptions, formWilayah]);

  const handleCreateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenSubIds = Object.keys(selectedSubIds).filter((id) => selectedSubIds[id]);
    const targetAgent = agents.find((a) => a.id === formDropPointAgenId || a.kode_agen === formDropPointAgenId);

    const newRec: FleetDispatchRecord = {
      id: `DISP-${formWilayah.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`,
      nopolArmada: formNopol.trim().toUpperCase(),
      jenisKendaraan: formKendaraan,
      driverNama: formDriverNama.trim(),
      driverWa: formDriverWa.trim(),
      wilayahTujuan: formWilayah,
      dropPointAgenNama: targetAgent ? targetAgent.nama : `Drop Point ${formWilayah}`,
      dropPointAgenWa: targetAgent ? targetAgent.no_wa : '',
      tanggalKirim: new Date().toISOString().slice(0, 10),
      estimasiTiba: formEstimasiTiba.trim(),
      subscriptionIds: chosenSubIds,
      totalPaket: chosenSubIds.length || 1,
      status: 'dipacking',
      catatan: formCatatan.trim(),
    };

    setDispatches((prev) => [newRec, ...prev]);

    // If subs were selected, update their delivery stage to 'kirim_korwil'
    if (chosenSubIds.length > 0) {
      void onUpdateDeliveryStage(chosenSubIds, 'kirim_korwil');
    }

    // Reset & close
    setShowCreateModal(false);
    setFormDriverNama('');
    setFormDriverWa('');
    setFormCatatan('');
    setSelectedSubIds({});
  };

  const handleAdvanceStatus = async (disp: FleetDispatchRecord) => {
    let nextStatus: FleetDispatchRecord['status'] = 'dipacking';
    let targetDeliveryStage: DeliveryStage | null = null;

    if (disp.status === 'dipacking') {
      nextStatus = 'on_delivery';
      targetDeliveryStage = 'kirim_korwil';
    } else if (disp.status === 'on_delivery') {
      nextStatus = 'tiba_drop_point';
      targetDeliveryStage = 'siap_diambil';
    } else if (disp.status === 'tiba_drop_point') {
      nextStatus = 'selesai';
      targetDeliveryStage = 'selesai';
    }

    setUpdatingDispatchId(disp.id);
    try {
      if (targetDeliveryStage && disp.subscriptionIds.length > 0) {
        await onUpdateDeliveryStage(disp.subscriptionIds, targetDeliveryStage);
      }
      setDispatches((prev) =>
        prev.map((d) => (d.id === disp.id ? { ...d, status: nextStatus } : d))
      );
    } finally {
      setUpdatingDispatchId(null);
    }
  };

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((d) => {
      if (selectedWilayahFilter !== 'all' && d.wilayahTujuan !== selectedWilayahFilter) {
        return false;
      }
      return true;
    });
  }, [dispatches, selectedWilayahFilter]);

  return (
    <div className="space-y-5">
      {/* Top Banner & Action */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-emerald-900" />
              <h2 className="font-display text-lg font-bold text-stone-900">
                Manajemen Rute Armada &amp; Ekspedisi Drop-Point Gudang
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Jadwalkan armada logistik pusat (mobil box/truk), atur rute ke agen wilayah, pantau status pengiriman bertingkat, dan kirim surat jalan langsung ke WhatsApp driver.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Jadwalkan Armada Baru</span>
          </button>
        </div>

        {/* Filter Wilayah Priangan */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3 text-xs">
          <span className="font-semibold text-stone-500">Filter Wilayah:</span>
          <button
            type="button"
            onClick={() => setSelectedWilayahFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
              selectedWilayahFilter === 'all'
                ? 'bg-[#0C3328] text-[#E8CA82]'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            Semua Wilayah ({dispatches.length})
          </button>
          {WILAYAH_LIST.map((w) => {
            const count = dispatches.filter((d) => d.wilayahTujuan === w).length;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setSelectedWilayahFilter(w)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold cursor-pointer ${
                  selectedWilayahFilter === w
                    ? 'bg-[#0C3328] text-[#E8CA82]'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {w} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Daftar Pengiriman Armada */}
      <div className="space-y-3">
        {filteredDispatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
            <Truck className="mx-auto h-8 w-8 text-stone-400 mb-2" />
            <p className="font-bold text-stone-800">Belum ada jadwal armada pengiriman.</p>
            <p className="mt-0.5 text-stone-500">
              Klik &ldquo;Jadwalkan Armada Baru&rdquo; untuk menugaskan driver dan mendistribusikan paket ke agen wilayah.
            </p>
          </div>
        ) : (
          filteredDispatches.map((disp) => {
            // WhatsApp message for driver
            const driverMsg = `Halo ${disp.driverNama},\n\nBerikut Surat Jalan & Penugasan Armada Logistik Sagitarius Parcel:\n🚚 Armada: ${disp.nopolArmada} (${disp.jenisKendaraan})\n📍 Wilayah Tujuan: ${disp.wilayahTujuan}\n🏬 Drop Point: ${disp.dropPointAgenNama}\n📦 Jumlah Muatan: ${disp.totalPaket} Paket Parsel\n⏰ Target Tiba: ${disp.estimasiTiba}\n📝 Catatan: ${disp.catatan || '-'}\n\nHarap hubungi Agen penerima setibanya di lokasi drop point. Terima kasih. - Logistik Pusat Sagitarius Parcel`;

            // WhatsApp message for agent
            const agentMsg = `Halo ${disp.dropPointAgenNama},\n\nArmada logistik pusat Sagitarius Parcel dengan Nopol *${disp.nopolArmada}* (Driver: *${disp.driverNama}* / WA: ${disp.driverWa}) telah diberangkatkan menuju drop point Anda di *${disp.wilayahTujuan}* dengan estimasi tiba sekitar *${disp.estimasiTiba}* membawa *${disp.totalPaket} paket*.\n\nMohon dipersiapkan tempat penerimaan dan lakukan serah terima dengan driver. Terima kasih!`;

            return (
              <div
                key={disp.id}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C3328] text-[#E8CA82]">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-stone-900">
                          {disp.nopolArmada}
                        </span>
                        <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                          {disp.jenisKendaraan}
                        </span>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            disp.status === 'selesai'
                              ? 'bg-emerald-100 text-emerald-900'
                              : disp.status === 'tiba_drop_point'
                                ? 'bg-sky-100 text-sky-900'
                                : disp.status === 'on_delivery'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {disp.status === 'selesai'
                            ? 'Selesai Serah Terima'
                            : disp.status === 'tiba_drop_point'
                              ? 'Tiba di Drop Point'
                              : disp.status === 'on_delivery'
                                ? 'Dalam Perjalanan'
                                : 'Dipersiapkan di Gudang'}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-0.5">
                        Driver: <strong>{disp.driverNama}</strong> ({disp.driverWa}) · ID: {disp.id}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Advance Status */}
                  <div className="flex flex-wrap items-center gap-2">
                    {disp.status !== 'selesai' && (
                      <button
                        type="button"
                        disabled={updatingDispatchId === disp.id}
                        onClick={() => void handleAdvanceStatus(disp)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#381E5A] px-3.5 py-1.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#4a2977] cursor-pointer disabled:opacity-50"
                      >
                        {updatingDispatchId === disp.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <PackageCheck className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {disp.status === 'dipacking'
                            ? 'Berangkatkan Armada'
                            : disp.status === 'on_delivery'
                              ? 'Tandai Tiba di Drop Point'
                              : 'Selesaikan Serah Terima'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Detail Rute & Drops */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                  <div className="rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-2.5">
                    <p className="text-[10px] text-stone-500">Tujuan Wilayah</p>
                    <p className="font-bold text-[#0C3328] mt-0.5">{disp.wilayahTujuan}</p>
                    <p className="text-[11px] text-stone-600 truncate">{disp.dropPointAgenNama}</p>
                  </div>
                  <div className="rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-2.5">
                    <p className="text-[10px] text-stone-500">Jumlah Muatan</p>
                    <p className="font-mono-nums font-bold text-stone-900 mt-0.5">
                      {disp.totalPaket} Paket
                    </p>
                    <p className="text-[10px] text-stone-500">{disp.tanggalKirim}</p>
                  </div>
                  <div className="rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-2.5">
                    <p className="text-[10px] text-stone-500">Target Tiba</p>
                    <p className="font-semibold text-stone-800 mt-0.5">{disp.estimasiTiba}</p>
                    <p className="text-[10px] text-stone-500 truncate">{disp.catatan || 'Sesuai manifest'}</p>
                  </div>
                  <div className="flex flex-col justify-center gap-1.5">
                    {/* WA Sopir */}
                    {disp.driverWa && (
                      <a
                        href={formatWhatsAppUrl(disp.driverWa, driverMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-md bg-[#16A34A] py-1 px-2 text-[11px] font-semibold text-white hover:bg-[#15803D]"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>Kirim Surat Jalan ke Sopir</span>
                      </a>
                    )}
                    {/* WA Agen */}
                    {disp.dropPointAgenWa && (
                      <a
                        href={formatWhatsAppUrl(disp.dropPointAgenWa, agentMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 rounded-md border border-stone-300 bg-white py-1 px-2 text-[11px] font-semibold text-stone-700 hover:bg-stone-50"
                      >
                        <Send className="h-3 w-3 text-stone-500" />
                        <span>Notifikasi ke Agen Wilayah</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Formulir Penugasan Armada Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 safe-top safe-bottom">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 sm:p-6 shadow-xl space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="font-display text-base font-bold text-stone-900 flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-900" />
                <span>Jadwalkan Pengiriman Armada Pusat</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-700 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDispatch} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700">Nomor Polisi Armada</label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    value={formNopol}
                    onChange={(e) => setFormNopol(e.target.value.toUpperCase())}
                    placeholder="Contoh: Z 8899 SP"
                    className="mt-1 w-full rounded-lg border border-stone-300 p-2 font-mono font-bold text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700">Jenis Kendaraan</label>
                  <select
                    value={formKendaraan}
                    onChange={(e) => setFormKendaraan(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-stone-900"
                  >
                    <option value="Gran Max Box">Gran Max Box</option>
                    <option value="Truk Engkel 4 Roda">Truk Engkel 4 Roda</option>
                    <option value="Truk CDD 6 Roda">Truk CDD 6 Roda</option>
                    <option value="Mobil Blind Van">Mobil Blind Van</option>
                    <option value="Motor Roda 3 Tossa/Viar">Motor Roda 3 Tossa/Viar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700">Nama Driver / Sopir</label>
                  <input
                    type="text"
                    required
                    value={formDriverNama}
                    onChange={(e) => setFormDriverNama(e.target.value)}
                    placeholder="Nama lengkap sopir..."
                    className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-stone-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-stone-700">WhatsApp Driver</label>
                  <input
                    type="tel"
                    required
                    value={formDriverWa}
                    onChange={(e) => setFormDriverWa(e.target.value)}
                    placeholder="0812xxxxxxx"
                    className="mt-1 w-full rounded-lg border border-stone-300 p-2 font-mono-nums text-stone-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-stone-700">Wilayah Priangan</label>
                  <select
                    value={formWilayah}
                    onChange={(e) => setFormWilayah(e.target.value as WilayahPriangan)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-stone-900"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-stone-700">Drop Point Agen Wilayah</label>
                  <select
                    value={formDropPointAgenId}
                    onChange={(e) => setFormDropPointAgenId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-stone-900"
                  >
                    <option value="">Pilih Agen Drop Point</option>
                    {agents
                      .filter((a) => a.wilayah === formWilayah)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nama} ({a.kecamatan})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700">Estimasi Jam Tiba</label>
                <input
                  type="text"
                  value={formEstimasiTiba}
                  onChange={(e) => setFormEstimasiTiba(e.target.value)}
                  placeholder="Contoh: 14:00 WIB"
                  className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-stone-900"
                />
              </div>

              {/* Pilih Paket Siap Kirim */}
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Pilih Paket Siap Kirim di {formWilayah} ({regionalReadySubs.length} Tersedia)
                </label>
                {regionalReadySubs.length === 0 ? (
                  <p className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-[11px] text-stone-500">
                    Belum ada paket lunas di {formWilayah} yang menunggu pengiriman gudang. Anda tetap dapat menjadwalkan armada secara umum.
                  </p>
                ) : (
                  <div className="max-h-32 overflow-y-auto space-y-1 rounded-lg border border-stone-200 p-2 bg-stone-50">
                    {regionalReadySubs.slice(0, 15).map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selectedSubIds[s.id]}
                          onChange={(e) =>
                            setSelectedSubIds((prev) => ({ ...prev, [s.id]: e.target.checked }))
                          }
                          className="h-3.5 w-3.5 accent-[#0C3328]"
                        />
                        <span className="font-semibold text-stone-800">{s.member_nama}</span>
                        <span className="text-stone-500">— {s.package_nama}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-stone-700">Catatan Khusus Pengiriman</label>
                <input
                  type="text"
                  maxLength={200}
                  value={formCatatan}
                  onChange={(e) => setFormCatatan(e.target.value)}
                  placeholder="Instruksi jalan, nomor telepon darurat, dll."
                  className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-stone-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-stone-100 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer shadow-xs"
                >
                  Simpan &amp; Terbitkan Surat Jalan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
