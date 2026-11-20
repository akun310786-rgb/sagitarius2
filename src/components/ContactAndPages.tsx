import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Gift,
  HeartHandshake,
  Mail,
  MapPin,
  MessageCircle,
  PackageCheck,
  SearchCheck,
  Share2,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import {
  BROCHURE_ANAK,
  BROCHURE_BUNDA,
  BROCHURE_PILIHAN,
  COMPANY_INFO,
  IMG_BUNDA,
  IMG_HERO,
  IMG_SULTAN,
  IMG_UANG_DAGING,
  formatWhatsAppUrl,
} from '../data/catalogData';
import {
  AgentDirectoryItem,
  ParcelPackage,
  PublicPage,
  SimulationLock,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';
import { InstallmentSimulator } from './InstallmentSimulator';

interface TabunganPageProps {
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onLockSimulation: (lock: SimulationLock) => void;
  initialPackageId?: string;
  onOpenChat: () => void;
}

const FAQ_ITEMS = [
  {
    q: 'Apa itu Program Tabungan Sagitarius Parcel?',
    a: 'Program menabung resmi dari PT. Sagitarius Trinunggal Karya yang memudahkan keluarga Priangan Timur mempersiapkan paket sembako, kue kering, perlengkapan anak, hingga uang tunai THR dengan cicilan ringan harian atau mingguan.',
  },
  {
    q: 'Bagaimana cara mendaftar program tabungan?',
    a: 'Pilih paket di Katalog, hitung cicilan pada Simulator di bawah, lalu klik "Kunci Simulasi Ini & Daftar" atau hubungi agen terdekat di wilayah Anda untuk aktivasi kontrak.',
  },
  {
    q: 'Apakah pembayaran bisa dicicil harian atau mingguan?',
    a: 'Ya. Anda bebas memilih setoran harian (mulai Rp 100/hari untuk barang satuan dan Rp 1.500/hari untuk paket anak) atau mingguan selama periode 295 hari (Paket Uang Munggahan) hingga 325 hari (Paket Barang & Uang Lebaran).',
  },
  {
    q: 'Bagaimana ketentuan pembatalan atau tidak selesai penuh?',
    a: 'Sesuai aturan resmi brosur, paket satuan barang tidak bisa diuangkan; jika anggota tidak menyelesaikan pembayaran penuh, akan diberikan barang sejumlah nominal masuk (biaya administrasi tetap sama). Paket uang hanya dibagikan sesuai jadwal pembagian.',
  },
  {
    q: 'Kapan parcel dan uang tunai akan diserahkan?',
    a: 'Paket Uang dibagikan lebih awal menjelang Lebaran, Paket Barang/Parcel selambatnya 15 Ramadhan, sedangkan Paket Daging Sapi, Ayam & Telur segar dibagikan pada H-2 Idul Fitri menggunakan Tiket QR resmi.',
  },
];

export const TabunganProgramPage: React.FC<TabunganPageProps> = ({
  packages,
  agents,
  selectedAgentId,
  onSelectAgent,
  onLockSimulation,
  initialPackageId,
  onOpenChat,
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number>(0);

  return (
    <div className="space-y-12 pb-16">
      {/* Hero + Ringkasan Program */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-5">
            <p className="text-xs font-semibold text-[#C8A053]">
              Program Tabungan Resmi 2026–2027
            </p>
            <h1
              className="font-display text-3xl leading-tight font-bold text-[#381E5A] sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              Rencanakan Paket Lebaran dengan Lebih Terarah
            </h1>
            <p className="text-sm leading-relaxed text-stone-600 sm:text-base">
              Program tabungan khusus untuk membantu Anda mempersiapkan parcel Lebaran berkualitas, paket sembako, maupun dana tunai THR dengan lebih ringan, aman, dan terencana.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#0C3328] px-5 py-3 text-xs font-semibold text-white hover:bg-[#144738] cursor-pointer"
              >
                <span>Hitung Simulasi Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onOpenChat}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-5 py-3 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <MessageCircle className="h-4 w-4 text-[#0C3328]" />
                <span>Tanyakan Program (CS AI)</span>
              </button>
            </div>
          </div>

          <div className="flex justify-center lg:col-span-4">
            <div className="overflow-hidden rounded-t-[140px] rounded-b-2xl border-2 border-[#C8A053]/50 bg-white shadow-sm">
              <img
                src={IMG_SULTAN}
                alt="Paket Tabungan Lebaran Sagitarius Parcel"
                className="h-80 w-full object-cover"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 shadow-xs lg:col-span-3">
            <h2 className="font-display text-lg font-bold text-[#381E5A]">Ringkasan Program</h2>
            <ul className="mt-4 space-y-3.5 text-xs text-stone-700">
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                <span>Rencanakan lebih awal, persiapan Lebaran lebih tenang</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Wallet className="h-3.5 w-3.5" />
                </span>
                <span>Menabung bertahap harian/mingguan, ringankan beban</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </span>
                <span>Aman, transparan di Buku Tabungan Digital &amp; terpercaya</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Gift className="h-3.5 w-3.5" />
                </span>
                <span>Parcel &amp; THR berkualitas siap di Hari Kemenangan + Door Prize</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Dark Emerald Band: Cara Kerja */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bg-arabesque-emerald rounded-2xl border border-[#C8A053]/40 p-6 text-white sm:p-8">
          <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
            <h2 className="font-display text-2xl font-bold text-white">Cara Kerja</h2>
            <div className="grid flex-1 gap-6 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 font-mono-nums text-sm font-bold text-[#E8CA82]">
                  01
                </span>
                <div>
                  <p className="text-sm font-bold text-[#E8CA82]">Pilih Paket</p>
                  <p className="mt-0.5 text-xs text-stone-200">
                    Tentukan jenis paket Bunda, Anak, Pilihan, Uang, atau Satuan sesuai kebutuhan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 font-mono-nums text-sm font-bold text-[#E8CA82]">
                  02
                </span>
                <div>
                  <p className="text-sm font-bold text-[#E8CA82]">Daftar Program</p>
                  <p className="mt-0.5 text-xs text-stone-200">
                    Daftarkan kontrak Anda melalui Dashboard Member atau agen wilayah Priangan Timur.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 font-mono-nums text-sm font-bold text-[#E8CA82]">
                  03
                </span>
                <div>
                  <p className="text-sm font-bold text-[#E8CA82]">Setor Bertahap</p>
                  <p className="mt-0.5 text-xs text-stone-200">
                    Setor tunai via agen atau upload bukti transfer hingga target lunas &amp; QR terbit.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4 Info Cards Row (Real Brochure Data) */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <Wallet className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono-nums text-xs font-bold text-[#C8A053]">01</p>
                <h3 className="text-sm font-bold text-[#381E5A]">Nominal Pembayaran</h3>
              </div>
            </div>
            <p className="mt-3 border-t border-[#F0EAE0] pt-3 font-mono-nums text-xs font-semibold text-[#0C3328]">
              Mulai Rp 100/hari (Satuan) · Rp 1.500–Rp 10.000/hari (Paket)
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <Calendar className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono-nums text-xs font-bold text-[#C8A053]">02</p>
                <h3 className="text-sm font-bold text-[#381E5A]">Jadwal Pembayaran</h3>
              </div>
            </div>
            <p className="mt-3 border-t border-[#F0EAE0] pt-3 text-xs font-semibold text-[#0C3328]">
              Harian atau Mingguan (42 / 45 Minggu) via Agen &amp; Transfer
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono-nums text-xs font-bold text-[#C8A053]">03</p>
                <h3 className="text-sm font-bold text-[#381E5A]">Periode Program</h3>
              </div>
            </div>
            <p className="mt-3 border-t border-[#F0EAE0] pt-3 font-mono-nums text-xs font-semibold text-[#0C3328]">
              325 Hari (Paket &amp; Uang Lebaran) · 295 Hari (Munggahan)
            </p>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <Truck className="h-4 w-4" />
              </span>
              <div>
                <p className="font-mono-nums text-xs font-bold text-[#C8A053]">04</p>
                <h3 className="text-sm font-bold text-[#381E5A]">Waktu Penyerahan</h3>
              </div>
            </div>
            <p className="mt-3 border-t border-[#F0EAE0] pt-3 text-xs font-semibold text-[#0C3328]">
              15 Ramadhan (Parcel), H-2 (Daging/Telur), Lebih Awal (Uang)
            </p>
          </div>
        </div>
      </section>

      {/* Simulator + FAQ Split */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <InstallmentSimulator
              packages={packages}
              agents={agents}
              initialPackageId={initialPackageId}
              selectedAgentId={selectedAgentId}
              onSelectAgent={onSelectAgent}
              onLockSimulation={onLockSimulation}
            />
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 lg:col-span-4">
            <h2 className="text-center font-display text-2xl font-bold text-[#381E5A]">FAQ</h2>
            <div className="mx-auto mt-2 mb-5 h-0.5 w-16 bg-[#C8A053]/60" />
            <div className="space-y-2.5">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-[#E8E1D3] bg-[#FAF7F2]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? -1 : idx)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-[#381E5A] hover:bg-[#F1ECE1] cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-[#C8A053] transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="border-t border-[#E8E1D3] bg-white px-4 py-3 text-xs leading-relaxed text-stone-600">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="bg-arabesque-emerald flex flex-col items-center justify-between gap-4 rounded-2xl border border-[#C8A053]/40 p-6 text-white sm:flex-row sm:px-10">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/50 bg-white/5 text-[#E8CA82]">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Butuh informasi lebih lanjut?
              </h3>
              <p className="mt-0.5 text-xs text-stone-200">
                Tim CS kami &amp; Asisten Sagitarius siap membantu Anda merencanakan parcel Lebaran terbaik untuk keluarga.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-6 py-3 text-xs font-bold text-[#1D122B] hover:brightness-105 whitespace-nowrap cursor-pointer"
            >
              <span>Tanyakan Program</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

interface CaraPemesananPageProps {
  onNavigate: (page: PublicPage) => void;
  onOpenChat: () => void;
}

export const CaraPemesananPage: React.FC<CaraPemesananPageProps> = ({
  onNavigate,
  onOpenChat,
}) => {
  const steps = [
    {
      num: '01',
      title: 'Pilih paket',
      desc: 'Lihat katalog Bunda, Anak, Pilihan, Uang, atau 50 Satuan.',
      icon: PackageCheck,
      action: () => onNavigate('katalog'),
    },
    {
      num: '02',
      title: 'Hubungi admin / agen',
      desc: 'Konsultasikan via WhatsApp CS atau pilih agen wilayah terdekat.',
      icon: MessageCircle,
      action: () => onNavigate('kontak'),
    },
    {
      num: '03',
      title: 'Konfirmasi pesanan',
      desc: 'Kunci simulasi cicilan & aktifkan kontrak di Dashboard Member.',
      icon: SearchCheck,
      action: () => onNavigate('tabungan'),
    },
    {
      num: '04',
      title: 'Lakukan pembayaran',
      desc: 'Setor tunai via agen jemput bola atau transfer & unggah bukti.',
      icon: Wallet,
      action: () => onNavigate('tabungan'),
    },
    {
      num: '05',
      title: 'Terima paket',
      desc: 'Tunjukkan E-Tiket QR Lunas pada jadwal 15 Ramadhan / H-2.',
      icon: Truck,
      action: () => onNavigate('tabungan'),
    },
  ];

  return (
    <div className="space-y-12 pb-16">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-6">
            <div className="flex items-center gap-3 text-xs font-semibold text-[#C8A053]">
              <span className="h-px w-8 bg-[#C8A053]" />
              <span>Panduan Pemesanan Resmi</span>
            </div>
            <h1 className="font-display text-3xl leading-tight font-bold text-[#381E5A] sm:text-5xl">
              Cara Memesan Paket Lebaran
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-stone-600 sm:text-base">
              Mudah, aman, dan penuh berkah. Ikuti 5 langkah terstruktur berikut untuk memesan dan menabung paket Lebaran spesial dari Sagitarius Parcel.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('katalog')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0C3328] px-5 py-3 text-xs font-semibold text-white hover:bg-[#144738] cursor-pointer"
              >
                <span>Mulai Pilih Paket</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tabungan')}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-5 py-3 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <span>Buka Simulator Cicilan</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-tl-[120px] rounded-br-[32px] rounded-tr-2xl rounded-bl-2xl border-2 border-[#C8A053]/50 bg-[#0C3328] shadow-sm">
              <img
                src={IMG_HERO}
                alt="Cara Memesan Paket Lebaran Sagitarius Parcel"
                className="aspect-[16/10] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5-Step Card */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6 shadow-xs sm:p-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={step.action}
                  className="group flex flex-col items-center rounded-xl border border-transparent p-3 text-center transition hover:border-[#E4DCCB] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0C3328] font-mono-nums text-[11px] font-bold text-[#E8CA82]">
                    {step.num}
                  </span>
                  <div className="mt-3 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#C8A053]/60 bg-[#FAF7F2] text-[#0C3328] transition group-hover:scale-105">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-[#381E5A]">{step.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">{step.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Payment, Delivery & Need Help 3-column grid */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-[#381E5A]">
                  Metode Pembayaran
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  Pembayaran dapat dilakukan secara <strong>Tunai Jemput Bola</strong> melalui Agen Wilayah Priangan Timur atau <strong>Transfer Bank Resmi</strong> dengan unggah bukti struk di Dashboard Member untuk validasi digital.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                <Truck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-[#381E5A]">
                  Metode Pengiriman
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600">
                  Pengambilan paket menggunakan <strong>E-Tiket QR Lunas</strong> di Agen/Gudang Pusat Mangunreja: selambatnya <strong>15 Ramadhan</strong> (Paket Barang), <strong>H-2 Idul Fitri</strong> (Daging &amp; Telur), dan <strong>Lebih Awal</strong> (Paket Uang).
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E4DCCB] bg-[#FAF7F2] p-6">
            <h3 className="font-display text-xl font-bold text-[#381E5A]">Butuh Bantuan?</h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-600">
              Tim kami siap membantu Anda memilih paket, mengecek saldo tabungan, atau menghubungkan dengan agen terdekat.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={formatWhatsAppUrl(
                  COMPANY_INFO.csWhatsappDigits,
                  'Halo Admin Sagitarius Parcel, saya butuh panduan pemesanan paket Lebaran.'
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#0C3328] px-4 py-2.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738]"
              >
                <span>Hubungi Admin</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={onOpenChat}
                className="rounded-xl border border-[#0C3328]/30 bg-white px-4 py-2.5 text-xs font-semibold text-[#0C3328] hover:bg-stone-50 cursor-pointer"
              >
                Chat CS AI
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

interface TentangKamiPageProps {
  agents: AgentDirectoryItem[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onNavigate: (page: PublicPage) => void;
}

export const TentangKamiPage: React.FC<TentangKamiPageProps> = ({
  agents,
  selectedAgentId,
  onSelectAgent,
  onNavigate,
}) => {
  const [wilayahFilter, setWilayahFilter] = useState<'Semua' | WilayahPriangan>('Semua');

  const filteredAgents = useMemo(() => {
    if (wilayahFilter === 'Semua') return agents;
    return agents.filter((a) => a.wilayah === wilayahFilter);
  }, [agents, wilayahFilter]);

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
      img: IMG_BUNDA,
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
          <div className="space-y-4 lg:col-span-5">
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
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-5 py-2.5 text-xs font-bold text-[#1D122B] hover:brightness-105 cursor-pointer"
            >
              <span>Lihat Paket Lebaran</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white shadow-xs">
              <img
                src={IMG_HERO}
                alt="Tim Pengemasan Sagitarius Parcel"
                className="aspect-[16/9] w-full object-cover"
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
            <div className="space-y-3 lg:col-span-3">
              <h2 className="font-display text-2xl font-bold text-white">
                Proses Pengemasan Sagitarius Parcel
              </h2>
              <div className="h-0.5 w-12 bg-[#C8A053]" />
              <p className="text-xs leading-relaxed text-stone-200">
                Setiap parcel diproses dengan teliti melalui tahapan yang rapi untuk memastikan kualitas dan tampilan terbaik sampai ke tangan Anda.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-4">
              {packagingSteps.map((s) => (
                <div key={s.num} className="space-y-2.5">
                  <div className="overflow-hidden rounded-xl border border-[#C8A053]/40 bg-black/20">
                    <img
                      src={s.img}
                      alt={s.title}
                      className="aspect-[16/10] w-full object-cover"
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
            const waUrl = formatWhatsAppUrl(
              agent.no_wa,
              `Halo ${agent.nama} (${agent.kode_agen}), saya ingin bertanya & mendaftar tabungan parcel Lebaran Sagitarius Parcel wilayah ${agent.wilayah}.`
            );
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

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectAgent(agent.id)}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#0C3328] text-white'
                        : 'border border-[#E4DCCB] text-stone-800 hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {isSelected ? 'Agen Dipilih' : 'Pilih Agen Ini'}
                  </button>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#15803D]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

interface KontakPageProps {
  onOpenChat: () => void;
}

export const KontakPage: React.FC<KontakPageProps> = ({ onOpenChat }) => {
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
        <div className="space-y-4 lg:col-span-4">
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

            <button
              type="button"
              onClick={onOpenChat}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 text-left transition hover:border-[#C8A053] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#381E5A]">Jam Operasional &amp; CS AI</p>
                  <p className="text-xs text-stone-600">
                    Senin–Sabtu 08.00–17.00 WIB · CS AI 24 Jam
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#C8A053]" />
            </button>

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
        <div className="space-y-4 lg:col-span-4">
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
        <div className="space-y-4 lg:col-span-4">
          <div className="overflow-hidden rounded-tl-[160px] rounded-tr-2xl rounded-b-2xl border-2 border-[#C8A053]/60 bg-white shadow-xs">
            <img
              src={IMG_UANG_DAGING}
              alt="Parcel Eid Mubarak Sagitarius Parcel"
              className="aspect-[4/4.2] w-full object-cover"
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
