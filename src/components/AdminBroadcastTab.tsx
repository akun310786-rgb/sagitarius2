import React, { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  Copy,
  Download,
  Filter,
  Megaphone,
  MessageCircle,
  Radio,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { formatRupiah, formatWhatsAppUrl } from '../data/catalogData';
import { AgentDirectoryItem, Subscription, UserProfile, WilayahPriangan, WILAYAH_LIST } from '../types';

interface AdminBroadcastTabProps {
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  allUsers: UserProfile[];
  onPublishToAppBanner?: (judul: string, isi: string) => Promise<void>;
}

type BroadcastTargetAudience = 'agents' | 'members_active' | 'members_delinquent' | 'members_lunas';

interface BroadcastRecipient {
  id: string;
  nama: string;
  no_wa: string;
  wilayah: WilayahPriangan;
  tipe: 'Agen' | 'Member';
  detail: string;
}

const BROADCAST_TEMPLATES = [
  {
    id: 'jadwal_distribusi',
    title: 'Jadwal Distribusi Parsel Ramadhan',
    judul: 'Jadwal Resmi Distribusi & Serah Terima Parsel Lebaran 1447H',
    pesan: `Bismillah. Diberitahukan kepada seluruh keluarga besar {nama} di wilayah {wilayah}.\n\nPengambilan paket parsel Lebaran Sagitarius Parcel periode tahun ini dijadwalkan selambatnya tanggal 15 Ramadhan (untuk Paket Barang Bunda, Pilihan & Anak). Pastikan Anda membawa kupon / QR Code serah terima saat mengunjungi titik drop point agen setempat.\n\nInformasi lebih lanjut: 0813 2438 3479 (PT Sagitarius Trinunggal Karya).`,
  },
  {
    id: 'substitusi_barang',
    title: 'Penyesuaian Komoditas Pabrik',
    judul: 'Pemberitahuan Penyesuaian Komoditas Biskuit/Sirup Resmi',
    pesan: `Pemberitahuan resmi Sagitarius Parcel untuk {nama} di {wilayah}.\n\nSehubungan dengan kelangkaan stok dari pabrik distributor pusat, kami melakukan penyesuaian komoditas dengan merk setara/lebih tinggi dengan nilai yang sama demi menjamin kualitas parsel Lebaran Anda. Rincian substitusi dapat dilihat di menu Katalog Resmi Aplikasi.\n\nTerima kasih atas kepercayaannya bersama Sagitarius Parcel.`,
  },
  {
    id: 'batas_setoran',
    title: 'Peringatan Batas Penutupan Setoran',
    judul: 'Pemberitahuan Batas Akhir Penutupan Setoran Tabungan Lebaran',
    pesan: `Halo {nama},\n\nKami mengingatkan kembali bahwa penutupan buku setoran tabungan parsel Lebaran akan segera berakhir. Pastikan saldo tabungan paket Anda telah mencukupi minimal 150 hari pembayaran penuh agar parsel siap dikemas dan diikutsertakan dalam pengundian Door Prize Akbar Sagitarius Parcel!\n\nHubungi Agen pembina wilayah Anda untuk setoran jemput bola hari ini.`,
  },
  {
    id: 'doorprize_akbar',
    title: 'Undangan Live Pengundian Door Prize',
    judul: 'Undangan Siaran Langsung Pengundian Door Prize Member Resmi',
    pesan: `Kabar Gembira untuk {nama}!\n\nPengundian hadiah Door Prize Resmi Sagitarius Parcel (Sepeda Motor, Mesin Cuci, Kulkas, TV & HP Android) akan disiarkan langsung melalui media sosial resmi Sagitarius Parcel. Cek nomor kupon DP-... Anda di Dashboard Member untuk melihat nomor undian yang terdaftar.\n\nSemoga keberuntungan menyertai Anda!`,
  },
];

export const AdminBroadcastTab: React.FC<AdminBroadcastTabProps> = ({
  agents,
  subscriptions,
  allUsers,
  onPublishToAppBanner,
}) => {
  const [audience, setAudience] = useState<BroadcastTargetAudience>('agents');
  const [selectedWilayah, setSelectedWilayah] = useState<'all' | WilayahPriangan>('all');
  const [customJudul, setCustomJudul] = useState(BROADCAST_TEMPLATES[0].judul);
  const [customPesan, setCustomPesan] = useState(BROADCAST_TEMPLATES[0].pesan);
  const [copiedPhones, setCopiedPhones] = useState(false);
  const [publishingBanner, setPublishingBanner] = useState(false);
  const [bannerSuccess, setBannerSuccess] = useState(false);

  // Build recipients list based on selected target audience
  const recipients = useMemo<BroadcastRecipient[]>(() => {
    if (audience === 'agents') {
      return agents
        .filter((a) => (selectedWilayah === 'all' ? true : a.wilayah === selectedWilayah))
        .map((a) => ({
          id: a.id,
          nama: a.nama,
          no_wa: a.no_wa,
          wilayah: a.wilayah,
          tipe: 'Agen',
          detail: `Kode: ${a.kode_agen} · ${a.jumlah_member} Member`,
        }));
    }

    // For member audiences, use subscriptions
    const subList = subscriptions.filter((s) => {
      if (selectedWilayah !== 'all' && s.wilayah !== selectedWilayah) return false;
      if (audience === 'members_lunas') return s.status === 'lunas';
      if (audience === 'members_active') return s.status === 'aktif';
      if (audience === 'members_delinquent') {
        // Delinquent criteria: aktif and target not met
        return s.status === 'aktif' && s.total_terkumpul < s.target_nominal;
      }
      return true;
    });

    const uniqueMembers = new Map<string, BroadcastRecipient>();
    subList.forEach((s) => {
      // Extract phone number from member_nama if present, or userProfile lookup
      const waMatch = s.member_nama.match(/(?:08|\+628|628)\d{8,13}/);
      const cleanWa = waMatch ? waMatch[0].replace(/\D/g, '') : '';
      const existing = uniqueMembers.get(s.member_nama);
      if (!existing) {
        uniqueMembers.set(s.member_nama, {
          id: s.id,
          nama: s.member_nama.replace(/\s*\(?(?:08|\+628|628)\d{8,13}\)?/g, '').trim(),
          no_wa: cleanWa,
          wilayah: s.wilayah,
          tipe: 'Member',
          detail: `${s.package_nama} (${formatRupiah(s.total_terkumpul)})`,
        });
      }
    });

    return Array.from(uniqueMembers.values());
  }, [audience, selectedWilayah, agents, subscriptions]);

  const validPhoneRecipients = useMemo(() => {
    return recipients.filter((r) => r.no_wa && r.no_wa.length >= 8);
  }, [recipients]);

  const handleApplyTemplate = (tpl: typeof BROADCAST_TEMPLATES[0]) => {
    setCustomJudul(tpl.judul);
    setCustomPesan(tpl.pesan);
  };

  const handleCopyAllPhones = () => {
    const list = validPhoneRecipients.map((r) => r.no_wa).join(', ');
    if (list) {
      void navigator.clipboard.writeText(list);
      setCopiedPhones(true);
      setTimeout(() => setCopiedPhones(false), 2000);
    }
  };

  const handlePublishBanner = async () => {
    if (!onPublishToAppBanner) return;
    setPublishingBanner(true);
    try {
      await onPublishToAppBanner(customJudul, customPesan);
      setBannerSuccess(true);
      setTimeout(() => setBannerSuccess(false), 3000);
    } finally {
      setPublishingBanner(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Nama', 'Nomor WhatsApp', 'Wilayah', 'Tipe', 'Detail'];
    const rows = recipients.map((r) => [r.nama, r.no_wa || '-', r.wilayah, r.tipe, r.detail]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daftar-penerima-broadcast-${audience}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Info */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-700" />
              <h2 className="font-display text-lg font-bold text-stone-900">
                Pusat Siaran Informasi &amp; WhatsApp Blast Terstruktur
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Kirimkan pengumuman resmi terformat ke seluruh Agen binaan atau Member per wilayah secara serentak, atau terbitkan langsung ke running banner aplikasi publik.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV Kontak</span>
            </button>
            <button
              type="button"
              onClick={handleCopyAllPhones}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#381E5A] px-3.5 py-1.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#492975] cursor-pointer"
            >
              {copiedPhones ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{validPhoneRecipients.length} Nomor Disalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Semua No. WA ({validPhoneRecipients.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Pemilihan Sasaran Penerima */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={() => setAudience('agents')}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              audience === 'agents'
                ? 'border-[#0C3328] bg-[#FAF7F2] ring-1 ring-[#0C3328]'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            }`}
          >
            <p className="text-[10px] font-semibold text-stone-500 uppercase">Target 1</p>
            <p className="font-bold text-stone-900 mt-0.5 text-xs">Seluruh Agen &amp; Korwil</p>
            <p className="font-mono-nums text-[11px] text-emerald-800 font-semibold">{agents.length} Kontak</p>
          </button>

          <button
            type="button"
            onClick={() => setAudience('members_active')}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              audience === 'members_active'
                ? 'border-[#0C3328] bg-[#FAF7F2] ring-1 ring-[#0C3328]'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            }`}
          >
            <p className="text-[10px] font-semibold text-stone-500 uppercase">Target 2</p>
            <p className="font-bold text-stone-900 mt-0.5 text-xs">Member Tabungan Aktif</p>
            <p className="font-mono-nums text-[11px] text-[#381E5A] font-semibold">Konsumen Berjalan</p>
          </button>

          <button
            type="button"
            onClick={() => setAudience('members_delinquent')}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              audience === 'members_delinquent'
                ? 'border-[#0C3328] bg-[#FAF7F2] ring-1 ring-[#0C3328]'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            }`}
          >
            <p className="text-[10px] font-semibold text-stone-500 uppercase">Target 3</p>
            <p className="font-bold text-rose-900 mt-0.5 text-xs">Konsumen Menunggak</p>
            <p className="font-mono-nums text-[11px] text-rose-700 font-semibold">Perlu Follow-Up</p>
          </button>

          <button
            type="button"
            onClick={() => setAudience('members_lunas')}
            className={`rounded-xl border p-3 text-left transition cursor-pointer ${
              audience === 'members_lunas'
                ? 'border-[#0C3328] bg-[#FAF7F2] ring-1 ring-[#0C3328]'
                : 'border-stone-200 bg-white hover:bg-stone-50'
            }`}
          >
            <p className="text-[10px] font-semibold text-stone-500 uppercase">Target 4</p>
            <p className="font-bold text-stone-900 mt-0.5 text-xs">Member Lunas (Siap Ambil)</p>
            <p className="font-mono-nums text-[11px] text-amber-800 font-semibold">Info Serah Terima</p>
          </button>
        </div>
      </div>

      {/* Template & Form Komposisi Pesan */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Kolom Kiri: Template & Editor */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-700" />
              <span>Pilih Template Siaran Resmi</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {BROADCAST_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleApplyTemplate(tpl)}
                  className="rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-stone-800 hover:bg-stone-100 cursor-pointer"
                >
                  {tpl.title}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700">Judul Siaran / Banner</label>
            <input
              type="text"
              value={customJudul}
              onChange={(e) => setCustomJudul(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 p-2 text-xs font-bold text-stone-900"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700">Isi Pesan WhatsApp / Siaran</label>
              <span className="text-[10px] text-stone-400">Variabel: {'{nama}'}, {'{wilayah}'}</span>
            </div>
            <textarea
              rows={8}
              value={customPesan}
              onChange={(e) => setCustomPesan(e.target.value)}
              className="mt-1 w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-800 leading-relaxed font-sans focus:outline-hidden"
            />
          </div>

          {/* Tombol Terbitkan ke Banner Web */}
          {onPublishToAppBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5 text-amber-700" />
                  <span>Siarkan ke Banner Aplikasi Web</span>
                </span>
                {bannerSuccess && (
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    Banner Diperbarui!
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-600">
                Pesan ini akan langsung tampil di bilah pengumuman atas (top bar) untuk seluruh pengunjung &amp; member.
              </p>
              <button
                type="button"
                disabled={publishingBanner}
                onClick={handlePublishBanner}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-3.5 py-1.5 text-xs font-bold text-[#E8CA82] hover:bg-[#154b3c] cursor-pointer disabled:opacity-50"
              >
                <Radio className="h-3 w-3" />
                <span>{publishingBanner ? 'Menerbitkan...' : 'Terbitkan ke Banner Sekarang'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Kolom Kanan: Daftar Penerima & Aksi Kirim Per Kontak */}
        <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-emerald-800" />
                <span>Daftar Penerima Terpilih ({recipients.length} Orang)</span>
              </h3>
              <p className="text-[11px] text-stone-500">
                {validPhoneRecipients.length} kontak memiliki nomor WhatsApp valid.
              </p>
            </div>

            <select
              value={selectedWilayah}
              onChange={(e) => setSelectedWilayah(e.target.value as 'all' | WilayahPriangan)}
              className="rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-800"
            >
              <option value="all">Semua Wilayah</option>
              {WILAYAH_LIST.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          {recipients.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
              Tidak ada penerima pada filter target ini.
            </div>
          ) : (
            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {recipients.map((rec) => {
                // Personalize message with contact name and region
                const personalizedMsg = customPesan
                  .replace(/\{nama\}/g, rec.nama)
                  .replace(/\{wilayah\}/g, rec.wilayah);

                return (
                  <div
                    key={rec.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-2.5 text-xs hover:bg-stone-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-900 truncate">{rec.nama}</span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.2 text-[10px] text-stone-600">
                          {rec.wilayah}
                        </span>
                      </div>
                      <p className="font-mono-nums text-[11px] text-stone-500">
                        {rec.no_wa || 'Nomor WA belum dicatat'} · {rec.detail}
                      </p>
                    </div>

                    {rec.no_wa ? (
                      <a
                        href={formatWhatsAppUrl(rec.no_wa, personalizedMsg)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#16A34A] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#15803D]"
                        title="Buka WhatsApp dengan pesan yang sudah terformat"
                      >
                        <MessageCircle className="h-3 w-3" />
                        <span>Kirim WA</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-stone-400">Tanpa WA</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
