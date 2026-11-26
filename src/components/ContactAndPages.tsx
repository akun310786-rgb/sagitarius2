import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  Share2,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BROCHURE_ANAK,
  BROCHURE_BUNDA,
  BROCHURE_PILIHAN,
  COMPANY_INFO,
  IMG_BUNDA_GOLD,
  IMG_HERO,
  IMG_RESELLER_POSTER,
  RESELLER_PROGRAM,
  formatRupiah,
  formatWhatsAppUrl,
} from '../data/catalogData';
import {
  AgentDirectoryItem,
  PublicPage,
  UserRole,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';

interface TentangKamiPageProps {
  agents: AgentDirectoryItem[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onNavigate: (page: PublicPage) => void;
  onOpenAuth: (mode: 'login' | 'register_member' | 'register_agent') => void;
  userRole?: UserRole | null;
}

export const TentangKamiPage: React.FC<TentangKamiPageProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onNavigate,
  onOpenAuth,
  userRole = null,
}) => {
  const isMemberLoggedIn = userRole === 'member';
  const isAgentLoggedIn = userRole === 'agen';
  const [wilayahFilter, setWilayahFilter] = useState<'Semua' | WilayahPriangan>('Semua');
  const [activeResellerGroup, setActiveResellerGroup] = useState<'anak' | 'ibu' | 'pilihan'>('anak');
  const [showPosterModal, setShowPosterModal] = useState(false);

  const filteredAgents = useMemo(() => {
    if (wilayahFilter === 'Semua') return agents;
    return agents.filter((a) => a.wilayah === wilayahFilter);
  }, [agents, wilayahFilter]);

  const currentResellerGroup =
    RESELLER_PROGRAM.groups.find((g) => g.id === activeResellerGroup) ||
    RESELLER_PROGRAM.groups[0];

  const packagingSteps = [
    {
      num: '1',
      title: 'Seleksi Produk',
      desc: 'Kami memilih produk berkualitas, berizin resmi, dan tanggal kedaluwarsa panjang.',
      img: BROCHURE_BUNDA,
    },
    {
      num: '2',
      title: 'Penyusunan',
      desc: 'Produk disusun seimbang dalam Travel Bag, Container Box, maupun Koper.',
      img: IMG_BUNDA_GOLD,
    },
    {
      num: '3',
      title: 'Pengemasan',
      desc: 'Dikemas rapi dengan sentuhan elegan, pita pengaman, dan label nama member.',
      img: BROCHURE_ANAK,
    },
    {
      num: '4',
      title: 'Siap Dikirim',
      desc: 'Parcel terverifikasi QR siap diambil atau didistribusikan tepat waktu.',
      img: BROCHURE_PILIHAN,
    },
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* Editorial Intro */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-5">
            <p className="text-xs font-semibold text-[#C8A053]">
              {COMPANY_INFO.legalName}
            </p>
            <h1 className="font-display text-3xl leading-tight font-bold text-[#381E5A] sm:text-5xl">
              Tentang Sagitarius Parcel
            </h1>
            <div className="flex items-center gap-2">
              <span className="h-0.5 w-12 bg-[#C8A053]" />
              <Sparkles className="h-4 w-4 text-[#C8A053]" />
            </div>
            <p className="text-sm leading-relaxed text-stone-600 sm:text-base">
              Sagitarius Parcel hadir untuk menjadi jembatan kebaikan di momen istimewa. Berbasis di Mangunreja, Kab. Tasikmalaya, kami berfokus pada program tabungan dan penyusunan parcel Lebaran berkualitas di seluruh wilayah Priangan Timur dengan sistem buku tabungan digital yang transparan.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('katalog')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-5 py-2.5 text-xs font-bold text-[#1D122B] hover:brightness-105 cursor-pointer"
            >
              <span>Lihat Paket Lebaran</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="min-w-0 lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-[#E4DCCB] bg-[#FAF5FC] shadow-xs">
              <img
                src={IMG_HERO}
                alt="Bingkisan Katalog Resmi Sagitarius Parcel"
                className="aspect-[16/10] w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>

        {/* 3 Value Cards */}
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 text-center">
            <h3 className="font-display text-xl font-bold text-[#381E5A]">Pelayanan Ramah</h3>
            <div className="mx-auto my-3 h-0.5 w-10 bg-[#C8A053]" />
            <p className="text-xs leading-relaxed text-stone-600">
              Kami mendampingi setiap member bersama agen binaan wilayah dengan komunikasi yang jelas dan responsif dari awal menabung hingga pengambilan paket.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 text-center">
            <h3 className="font-display text-xl font-bold text-[#381E5A]">Kualitas Terjaga</h3>
            <div className="mx-auto my-3 h-0.5 w-10 bg-[#C8A053]" />
            <p className="text-xs leading-relaxed text-stone-600">
              Setiap pilihan produk sembako, kue kaleng, koper, hingga daging sapi &amp; telur segar H-2 kami kontrol mutunya secara ketat.
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 text-center">
            <h3 className="font-display text-xl font-bold text-[#381E5A]">Penuh Makna</h3>
            <div className="mx-auto my-3 h-0.5 w-10 bg-[#C8A053]" />
            <p className="text-xs leading-relaxed text-stone-600">
              Kami percaya setiap parcel membawa pesan kebahagiaan — <em>Our Eid, Our Happiness</em> — disertai bonus THR &amp; kesempatan kupon Door Prize.
            </p>
          </div>
        </div>
      </section>

      {/* Dark Emerald Band: Proses Pengemasan */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-arabesque-emerald rounded-2xl border border-[#C8A053]/40 p-6 text-white sm:p-8">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="min-w-0 space-y-3 lg:col-span-3">
              <h2 className="font-display text-2xl font-bold text-white">
                Proses Pengemasan Sagitarius Parcel
              </h2>
              <div className="h-0.5 w-12 bg-[#C8A053]" />
              <p className="text-xs leading-relaxed text-stone-200">
                Setiap parcel diproses dengan teliti melalui tahapan yang rapi untuk memastikan kualitas dan tampilan terbaik sampai ke tangan Anda.
              </p>
            </div>

            <div className="min-w-0 grid gap-4 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4">
              {packagingSteps.map((s) => (
                <div key={s.num} className="space-y-2.5">
                  <div className="overflow-hidden rounded-xl border border-[#C8A053]/40 bg-[#FAF5FC]">
                    <img
                      src={s.img}
                      alt={s.title}
                      className="aspect-[16/10] w-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] font-mono-nums text-xs font-bold text-[#1D122B]">
                      {s.num}
                    </span>
                    <div>
                      <h3 className="text-xs font-bold text-white">{s.title}</h3>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-stone-300">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Program Komisi Reseller Eksklusif & Mitra Agen */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white p-4 sm:p-8 lg:grid-cols-12">
          <div className="min-w-0 space-y-3 lg:col-span-5">
            <button
              type="button"
              onClick={() => setShowPosterModal(true)}
              className="group relative block w-full overflow-hidden rounded-2xl border border-[#E4DCCB] bg-[#FAF5FC] cursor-pointer"
            >
              <img
                src={IMG_RESELLER_POSTER}
                alt="Poster Resmi Komisi Reseller Eksklusif Sagitarius Parcel"
                className="aspect-[3/4] w-full object-contain"
                referrerPolicy="no-referrer"
              />
              <span className="absolute right-3 bottom-3 rounded-full bg-[#0C3328]/90 px-3 py-1.5 text-[11px] font-semibold text-[#E8CA82] shadow transition group-hover:bg-[#0C3328]">
                Klik untuk Perbesar Poster
              </span>
            </button>
          </div>

          <div className="min-w-0 space-y-5 lg:col-span-7">
            <div>
              <p className="text-xs font-semibold text-[#C8A053]">Program Kemitraan Resmi</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
                {RESELLER_PROGRAM.headline}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-600 sm:text-sm">
                {RESELLER_PROGRAM.subheadline}
              </p>
            </div>

            {/* Category Tabs for Commission Table */}
            <div className="flex flex-wrap gap-2">
              {RESELLER_PROGRAM.groups.map((grp) => (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setActiveResellerGroup(grp.id)}
                  className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                    activeResellerGroup === grp.id
                      ? 'bg-[#381E5A] text-[#E8CA82]'
                      : 'border border-[#E4DCCB] bg-[#FAF7F2] text-[#381E5A] hover:bg-stone-100'
                  }`}
                >
                  {grp.title} · {grp.komisiLabel}
                </button>
              ))}
            </div>

            {/* Official Commission & Bonus Table */}
            <div className="overflow-x-auto rounded-xl border border-[#E4DCCB]">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead className="bg-[#0C3328] text-[#E8CA82]">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Paket</th>
                    <th className="px-3 py-2.5 font-semibold">Komisi/Pkt</th>
                    <th className="px-3 py-2.5 font-semibold">Bonus 20 Pkt</th>
                    <th className="px-3 py-2.5 font-semibold">Bonus 50 Pkt</th>
                    <th className="px-3 py-2.5 font-semibold">Bonus 100 Pkt</th>
                    <th className="px-3 py-2.5 font-semibold">Bonus 200 Pkt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EAE0] bg-white font-mono-nums">
                  {currentResellerGroup.rows.map((row) => (
                    <tr key={row.nama} className="hover:bg-[#FAF7F2]">
                      <td className="px-3 py-2.5 font-sans">
                        <p className="font-bold text-[#381E5A]">{row.nama}</p>
                        <p className="text-[11px] text-stone-500">{row.harian}</p>
                      </td>
                      <td className="px-3 py-2.5 font-bold text-[#0C3328]">
                        {formatRupiah(row.komisi)}
                      </td>
                      <td className="px-3 py-2.5 text-stone-700">{formatRupiah(row.bonus20)}</td>
                      <td className="px-3 py-2.5 text-stone-700">{formatRupiah(row.bonus50)}</td>
                      <td className="px-3 py-2.5 text-stone-700">{formatRupiah(row.bonus100)}</td>
                      <td className="px-3 py-2.5 font-bold text-[#B98E3A]">
                        {formatRupiah(row.bonus200)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 7 Ketentuan Komisi Reseller */}
            <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4">
              <p className="text-xs font-bold text-[#381E5A]">Ketentuan Komisi Reseller:</p>
              <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-700">
                {RESELLER_PROGRAM.ketentuan.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono-nums font-bold text-[#0C3328]">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                disabled={isAgentLoggedIn}
                title={isAgentLoggedIn ? 'Anda sudah masuk sebagai Agen' : undefined}
                onClick={() => onOpenAuth('register_agent')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0C3328] px-5 py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[#0C3328] cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                <span>Gabung Agen / Reseller</span>
              </button>
              <button
                type="button"
                disabled={isMemberLoggedIn}
                title={isMemberLoggedIn ? 'Anda sudah masuk sebagai Member' : undefined}
                onClick={() => onOpenAuth('register_member')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-5 py-2.5 text-xs font-bold text-[#381E5A] hover:bg-[#FAF7F2] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-white cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-[#0C3328]" />
                <span>Gabung Member</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {showPosterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 p-3 sm:p-4 backdrop-blur-xs safe-top safe-bottom"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowPosterModal(false)}
        >
          <div
            className="relative max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[#C8A053]/60 bg-stone-950 p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowPosterModal(false)}
              className="mb-2 ml-auto flex min-h-[38px] items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 cursor-pointer"
            >
              Tutup Poster
            </button>
            <img
              src={IMG_RESELLER_POSTER}
              alt="Poster Komisi Reseller Eksklusif Sagitarius Parcel"
              className="mx-auto max-h-[80vh] w-auto rounded-lg object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      )}

      {/* Direktori Agen Priangan Timur */}
      <section id="agen" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-[#E4DCCB] pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold text-[#C8A053]">
              Jaringan Agen Resmi Priangan Timur
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
              Direktori Agen Binaan Wilayah
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Pilih agen terdekat di Tasikmalaya, Ciamis, Banjar, Pangandaran, atau Garut untuk penyetoran tunai maupun pengambilan paket.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(['Semua', ...WILAYAH_LIST] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWilayahFilter(w)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  wilayahFilter === w
                    ? 'bg-[#0C3328] text-white'
                    : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgentId === agent.id;
            return (
              <div
                key={agent.id}
                className={`flex flex-col justify-between rounded-2xl border bg-white p-5 transition ${
                  isSelected
                    ? 'border-[#0C3328] ring-1 ring-[#0C3328]'
                    : 'border-[#E4DCCB]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-stone-500">
                    <span className="font-mono-nums font-bold text-[#381E5A]">
                      {agent.kode_agen}
                    </span>
                    <span>{agent.wilayah}</span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-stone-900">{agent.nama}</h3>
                  <p className="mt-0.5 text-xs text-stone-600">{agent.kecamatan}</p>
                  <div className="mt-4 flex items-center gap-3 border-t border-[#F0EAE0] pt-3 text-xs text-stone-600">
                    <span className="inline-flex items-center gap-1 font-mono-nums">
                      <Users className="h-3.5 w-3.5 text-[#C8A053]" />
                      {agent.jumlah_member} Member Binaan
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-[#15803D]">
                      {agent.aktif ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className={`w-full rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#0C3328] text-white'
                        : 'border border-[#E4DCCB] text-stone-800 hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {isSelected ? 'Agen Dipilih' : 'Pilih Agen Ini'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export const KontakPage: React.FC = () => {
  const [nama, setNama] = useState('');
  const [noWa, setNoWa] = useState('');
  const [pesan, setPesan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSentSuccess(false);

    if (nama.trim().length < 2) {
      setErrorMsg('Nama minimal 2 karakter.');
      return;
    }
    if (noWa.trim().length < 6) {
      setErrorMsg('Nomor telepon / WhatsApp minimal 6 digit.');
      return;
    }
    if (pesan.trim().length < 5) {
      setErrorMsg('Pesan minimal 5 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      const msgId = `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await setDoc(doc(collection(db, 'contact_messages'), msgId), {
        nama: nama.trim().slice(0, 100),
        no_wa: noWa.trim().slice(0, 25),
        pesan: pesan.trim().slice(0, 1000),
        status: 'baru',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSentSuccess(true);
      setNama('');
      setNoWa('');
      setPesan('');
    } catch {
      setErrorMsg(
        'Gagal menyimpan pesan ke database. Anda tetap dapat menghubungi CS kami langsung via WhatsApp.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    'Bantar Peundeuy Margajaya Mangunreja Tasikmalaya Jawa Barat 46462'
  )}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid items-start gap-8 lg:grid-cols-12">
        {/* Left Column: Heading + 4 Clickable Contact Cards */}
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <h1 className="font-display text-3xl leading-tight font-bold text-[#381E5A] sm:text-4xl">
            Mari Terhubung dengan Sagitarius Parcel
          </h1>
          <p className="text-sm leading-relaxed text-stone-600">
            Punya pertanyaan, kebutuhan khusus, atau ingin berkonsultasi tentang parcel Lebaran &amp; tabungan? Tim kami siap membantu Anda dengan sepenuh hati.
          </p>

          <div className="space-y-3 pt-2">
            <a
              href={formatWhatsAppUrl(
                COMPANY_INFO.csWhatsappDigits,
                'Halo CS Sagitarius Parcel, saya ingin berkonsultasi tentang paket parcel Lebaran.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 transition hover:border-[#C8A053]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#381E5A]">WhatsApp CS Resmi</p>
                  <p className="font-mono-nums text-xs text-stone-600">
                    {COMPANY_INFO.csWhatsappDisplay}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#C8A053]" />
            </a>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 transition hover:border-[#C8A053]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#381E5A]">Alamat Kantor Pusat</p>
                  <p className="text-[11px] leading-snug text-stone-600">
                    Bantar Peundeuy RT 06/01, Margajaya, Mangunreja, Tasikmalaya 46462
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-[#C8A053]" />
            </a>

            <a
              href={formatWhatsAppUrl(
                COMPANY_INFO.csWhatsappDigits,
                'Halo Admin Sagitarius Parcel, saya ingin bertanya tentang jam operasional dan layanan.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 text-left transition hover:border-[#C8A053]"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#381E5A]">Jam Operasional &amp; CS Resmi</p>
                  <p className="text-xs text-stone-600">
                    Senin–Sabtu 08.00–17.00 WIB · WA {COMPANY_INFO.csWhatsappDisplay}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#C8A053]" />
            </a>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Share2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#381E5A]">Media Sosial &amp; Website</p>
                  <p className="text-xs text-stone-600">
                    FB / TikTok / IG: Sagitarius Parcel · {COMPANY_INFO.website}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column: Dark Forest Emerald Contact Form + Hubungi Admin */}
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <form
            onSubmit={handleSubmitMessage}
            className="bg-arabesque-emerald rounded-2xl border-2 border-[#C8A053]/60 p-6 text-white shadow-sm"
          >
            <div className="flex flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#C8A053]/60 text-[#E8CA82]">
                <Mail className="h-5 w-5" />
              </span>
              <h2 className="mt-2 font-display text-2xl font-bold text-[#E8CA82]">Kirim Pesan</h2>
              <p className="mt-1 text-xs text-stone-200">
                Sampaikan pesan Anda kepada kami, Admin Pusat akan segera merespons.
              </p>
            </div>

            {sentSuccess && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-400/40 bg-emerald-950/60 p-3 text-xs text-emerald-100">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                <span>
                  Pesan Anda berhasil terkirim ke Admin Sagitarius Parcel! Kami akan menghubungi WhatsApp Anda segera.
                </span>
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/60 p-3 text-xs text-rose-100">
                {errorMsg}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-200">Nama</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  className="mt-1 w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-200">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  type="tel"
                  required
                  minLength={6}
                  maxLength={25}
                  value={noWa}
                  onChange={(e) => setNoWa(e.target.value)}
                  placeholder="0813xxxxxxxx"
                  className="mt-1 w-full rounded-xl bg-white px-3.5 py-2.5 font-mono-nums text-sm text-stone-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-200">Pesan</label>
                <textarea
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  value={pesan}
                  onChange={(e) => setPesan(e.target.value)}
                  placeholder="Tulis pertanyaan mengenai paket atau pendaftaran..."
                  className="mt-1 w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-stone-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] py-3 text-sm font-bold text-[#1D122B] transition hover:brightness-105 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Mengirim Pesan...' : 'Kirim Pesan'}
            </button>
          </form>

          <a
            href={formatWhatsAppUrl(
              COMPANY_INFO.csWhatsappDigits,
              'Halo Admin Sagitarius Parcel, saya ingin menghubungi CS resmi.'
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#C8A053] bg-white py-3.5 text-sm font-bold text-[#381E5A] transition hover:bg-[#FAF7F2]"
          >
            <MessageCircle className="h-4 w-4 text-[#16A34A]" />
            <span>Hubungi Admin ({COMPANY_INFO.csWhatsappDisplay})</span>
          </a>
        </div>

        {/* Right Column: Arched Hamper Photo + Peta Lokasi Kami */}
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <div className="overflow-hidden rounded-tl-[140px] rounded-tr-2xl rounded-b-2xl border-2 border-[#C8A053]/60 bg-[#FAF5FC] shadow-xs">
            <img
              src={IMG_HERO}
              alt="Parcel Eid Mubarak Sagitarius Parcel"
              className="aspect-[16/10] w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl border border-[#C8A053]/60 bg-white p-5 text-center transition hover:bg-[#FAF7F2]"
          >
            <MapPin className="mx-auto h-7 w-7 text-[#C8A053]" />
            <h3 className="mt-2 font-display text-lg font-bold text-[#381E5A]">
              Peta Lokasi Kami
            </h3>
            <p className="mt-1 text-xs text-stone-600">{COMPANY_INFO.address}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#0C3328] underline">
              <HeartHandshake className="h-3.5 w-3.5" />
              Buka di Google Maps
            </span>
          </a>
        </div>
      </div>
    </div>
  );
};
