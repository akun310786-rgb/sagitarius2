import React, { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { CheckCircle2, LifeBuoy, Megaphone, MessageCircle, Send } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { COMPANY_INFO, formatWhatsAppUrl } from '../data/catalogData';
import { AppPublicSettings, Subscription, UserProfile } from '../types';

interface SentTicketRecord {
  id: string;
  topik: string;
  kontrakLabel: string;
  pesan: string;
  waktu: string;
}

interface ResellerHelpTabProps {
  userProfile: UserProfile;
  managedSubscriptions: Subscription[];
  appSettings: AppPublicSettings;
  onStatusMessage: (msg: string) => void;
}

const TICKET_TOPICS = [
  'Koreksi / Salah Input Setoran',
  'Pengajuan Pindah / Upgrade Paket Member',
  'Konfirmasi Mutasi Setor Kas Pusat',
  'Kendala Pengiriman / Stok Barang',
  'Kendala Akun Member & Lainnya',
];

export const ResellerHelpTab: React.FC<ResellerHelpTabProps> = ({
  userProfile,
  managedSubscriptions,
  appSettings,
  onStatusMessage,
}) => {
  const [topik, setTopik] = useState<string>(TICKET_TOPICS[0]);
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [pesan, setPesan] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [sentTickets, setSentTickets] = useState<SentTicketRecord[]>([]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPesan = pesan.trim();
    if (cleanPesan.length < 5) {
      onStatusMessage('Tuliskan keterangan kendala minimal 5 karakter.');
      return;
    }

    const linkedSub = managedSubscriptions.find((s) => s.id === selectedSubId);
    const kontrakLabel = linkedSub
      ? `${linkedSub.member_nama} — ${linkedSub.package_nama} (${linkedSub.qr_code_token})`
      : 'Umum / Tanpa kontrak spesifik';

    const composedMessage = `[TIKET RESELLER: ${topik}]${
      linkedSub ? `\nKontrak: ${kontrakLabel}` : ''
    }\nWilayah: ${userProfile.wilayah} (${userProfile.kode_agen || 'RESELLER'})\n\n${cleanPesan}`.slice(
      0,
      1000
    );

    const senderDisplayName = `[AGEN ${userProfile.kode_agen || userProfile.wilayah}] ${userProfile.nama}`.slice(
      0,
      100
    );

    setSubmitting(true);
    try {
      const msgRef = await addDoc(collection(db, 'contact_messages'), {
        nama: senderDisplayName,
        no_wa: (userProfile.no_wa || COMPANY_INFO.csWhatsappDisplay).slice(0, 25),
        pesan: composedMessage,
        status: 'baru',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await Promise.allSettled([
        addDoc(collection(db, 'notifications'), {
          recipient_type: 'admin',
          recipient_uid: 'staff_admin',
          wilayah: userProfile.wilayah,
          kategori: 'sistem',
          judul: `Tiket Bantuan Reseller: ${topik}`,
          pesan: `${userProfile.nama} (${userProfile.kode_agen || userProfile.wilayah}) mengirim laporan: "${cleanPesan.slice(0, 140)}"`,
          tautan_view: 'operasional',
          tautan_tab: 'pesan',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ]);

      setSentTickets((prev) => [
        {
          id: msgRef.id,
          topik,
          kontrakLabel,
          pesan: cleanPesan,
          waktu: new Date().toLocaleTimeString('id-ID', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
        ...prev,
      ]);
      setPesan('');
      setSelectedSubId('');
      onStatusMessage(
        'Laporan bantuan berhasil dikirim ke Admin Pusat dan notifikasi realtime sudah diteruskan.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'contact_messages');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {appSettings.pengumuman_aktif && appSettings.pengumuman_judul && (
        <div className="rounded-xl border border-[#C8A053]/60 bg-[#FAF7F2] p-4">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-[#381E5A]" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-[#381E5A]">{appSettings.pengumuman_judul}</p>
              <p className="leading-relaxed text-stone-700">{appSettings.pengumuman_isi}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        <form
          onSubmit={handleSubmitTicket}
          className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7"
        >
          <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <LifeBuoy className="h-5 w-5 text-[#0C3328]" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Kirim Tiket Bantuan ke Admin Pusat
              </h2>
              <p className="text-xs text-stone-600">
                Laporkan kendala transaksi, revisi nominal, atau pindah paket member langsung ke kotak masuk Admin Pusat.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Kategori Kendala
              </label>
              <select
                value={topik}
                onChange={(e) => setTopik(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900"
              >
                {TICKET_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Kontrak Member Terkait <span className="font-normal text-stone-400">(Opsional)</span>
              </label>
              <select
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
              >
                <option value="">Umum / Tidak spesifik</option>
                {managedSubscriptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.member_nama} — {s.package_nama} ({s.qr_code_token})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700">
              Detail Laporan / Permintaan Bantuan
            </label>
            <textarea
              rows={4}
              required
              minLength={5}
              maxLength={700}
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              placeholder="Jelaskan kronologi kendala, tanggal transaksi, atau perubahan paket yang diajukan..."
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={formatWhatsAppUrl(
                COMPANY_INFO.csWhatsappDigits,
                `Halo Admin Pusat Sagitarius Parcel, saya Reseller ${userProfile.nama} (${
                  userProfile.kode_agen || userProfile.wilayah
                }) ingin konsultasi terkait: ${topik}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#16A34A] bg-white px-3.5 py-2 text-xs font-semibold text-[#15803D] hover:bg-emerald-50"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Chat Cepat WA Admin ({COMPANY_INFO.csWhatsappDisplay})</span>
            </a>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{submitting ? 'Mengirim...' : 'Kirim ke Admin Pusat'}</span>
            </button>
          </div>
        </form>

        <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-5">
          <div>
            <h3 className="font-display text-base font-bold text-stone-900">
              Ringkasan Ketentuan &amp; Jadwal Layanan
            </h3>
            <p className="text-xs text-stone-600">
              Acuan cepat saat menjawab pertanyaan member di lapangan.
            </p>
          </div>

          <ul className="space-y-1.5 text-[11px] leading-relaxed text-stone-700 list-disc pl-4">
            {COMPANY_INFO.terms.map((term, idx) => (
              <li key={idx}>{term}</li>
            ))}
          </ul>

          {sentTickets.length > 0 && (
            <div className="border-t border-stone-100 pt-3 space-y-2">
              <p className="text-xs font-bold text-[#0C3328]">
                Tiket Terkirim Sesi Ini ({sentTickets.length})
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sentTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-[11px]"
                  >
                    <div className="flex items-center justify-between gap-2 font-semibold text-emerald-950">
                      <span className="inline-flex items-center gap-1 truncate">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                        {t.topik}
                      </span>
                      <span className="font-mono-nums text-[10px] text-emerald-800">{t.waktu}</span>
                    </div>
                    <p className="mt-1 text-stone-600">{t.kontrakLabel}</p>
                    <p className="mt-0.5 text-stone-800">{t.pesan}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
