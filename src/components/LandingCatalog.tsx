import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gift,
  Heart,
  Home,
  Lock,
  MessageCircle,
  Package as PackageIcon,
  Scale,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import {
  BROCHURE_ANAK,
  BROCHURE_BUNDA,
  BROCHURE_COVER,
  BROCHURE_PILIHAN,
  BROCHURE_SATUAN,
  BROCHURE_UANG,
  COMPANY_INFO,
  IMG_ANAK,
  IMG_BUNDA,
  IMG_HERO,
  IMG_SULTAN,
  IMG_UANG_DAGING,
  PAKET_UANG_TABLES,
  formatRupiah,
  formatWhatsAppUrl,
} from '../data/catalogData';
import {
  AgentDirectoryItem,
  PackageCategory,
  ParcelPackage,
  PublicPage,
  SimulationLock,
} from '../types';
import {
  CaraPemesananPage,
  KontakPage,
  TabunganProgramPage,
  TentangKamiPage,
} from './ContactAndPages';

interface LandingCatalogProps {
  activePage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  onLockSimulation: (lock: SimulationLock) => void;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  detailPackageId: string | null;
  onOpenDetail: (pkg: ParcelPackage) => void;
  wishlistIds: string[];
  onToggleWishlist: (pkgId: string) => void;
  onOpenChat: () => void;
  focusSearchTrigger?: number;
}

const BROCHURE_GALLERY = [
  { title: 'Sampul Katalog 2026–2027', src: BROCHURE_COVER },
  { title: 'Brosur Paket Bunda (4 Varian)', src: BROCHURE_BUNDA },
  { title: 'Brosur Paket Anak (4 Varian)', src: BROCHURE_ANAK },
  { title: 'Brosur Paket Pilihan (Diamond & Sultan)', src: BROCHURE_PILIHAN },
  { title: 'Brosur Paket Uang Munggahan & Lebaran', src: BROCHURE_UANG },
  { title: 'Brosur 50 Barang Satuan (325 Hari)', src: BROCHURE_SATUAN },
];

const CATEGORY_OPTIONS: { id: 'all' | PackageCategory; label: string }[] = [
  { id: 'all', label: 'Semua Kategori' },
  { id: 'bunda', label: 'Paket Bunda (Keluarga)' },
  { id: 'anak', label: 'Paket Anak' },
  { id: 'pilihan', label: 'Paket Eksklusif (Diamond & Sultan)' },
  { id: 'uang', label: 'Paket Uang (Munggahan & Lebaran)' },
  { id: 'satuan', label: '50 Barang Satuan' },
];

const PRICE_RANGE_OPTIONS = [
  { id: 'all', label: 'Semua Rentang Harga' },
  { id: 'under500k', label: 'Di bawah Rp 500.000' },
  { id: '500k_1500k', label: 'Rp 500.000 – Rp 1.500.000' },
  { id: 'above1500k', label: 'Di atas Rp 1.500.000' },
] as const;

const SORT_OPTIONS = [
  { id: 'featured', label: 'Terbaru & Unggulan' },
  { id: 'price_asc', label: 'Harga Terendah' },
  { id: 'price_desc', label: 'Harga Tertinggi' },
  { id: 'daily_asc', label: 'Cicilan Harian Terkecil' },
] as const;

const SATUAN_SUBFILTERS = [
  'Semua Satuan',
  'Sembako Pokok',
  'Daging & Telur',
  'Kue & Minuman',
  'Bumbu & Dapur',
] as const;

export const LandingCatalog: React.FC<LandingCatalogProps> = ({
  activePage,
  onNavigate,
  packages,
  agents,
  onLockSimulation,
  selectedAgentId,
  onSelectAgent,
  detailPackageId,
  onOpenDetail,
  wishlistIds,
  onToggleWishlist,
  onOpenChat,
  focusSearchTrigger,
}) => {
  // Katalog Filters
  const [activeCategory, setActiveCategory] = useState<'all' | PackageCategory>('all');
  const [priceRange, setPriceRange] =
    useState<(typeof PRICE_RANGE_OPTIONS)[number]['id']>('all');
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number]['id']>('featured');
  const [satuanSubFilter, setSatuanSubFilter] = useState<string>('Semua Satuan');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSatuan, setShowAllSatuan] = useState(false);

  // Brochure Lightbox Modal
  const [showBrochuresModal, setShowBrochuresModal] = useState(false);
  const [activeBrochureIdx, setActiveBrochureIdx] = useState(0);

  // Detail Paket UI State
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [detailTab, setDetailTab] = useState<'isi' | 'kemasan' | 'pengiriman' | 'ketentuan'>('isi');
  const [quickBookFreq, setQuickBookFreq] = useState<'harian' | 'mingguan'>('harian');
  const [recOffset, setRecOffset] = useState(0);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearchTrigger && activePage === 'katalog') {
      window.setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [focusSearchTrigger, activePage]);

  // Reset gallery & tab when opening a different package
  useEffect(() => {
    setGalleryIdx(0);
    setDetailTab('isi');
  }, [detailPackageId]);

  const currentDetailPkg = useMemo(() => {
    if (!detailPackageId) return packages[0];
    return packages.find((p) => p.id === detailPackageId) || packages[0];
  }, [packages, detailPackageId]);

  const filteredPackages = useMemo(() => {
    const list = packages.filter((pkg) => {
      if (activeCategory !== 'all' && pkg.kategori !== activeCategory) return false;
      if (
        (activeCategory === 'satuan' || activeCategory === 'all') &&
        satuanSubFilter !== 'Semua Satuan' &&
        pkg.kategori === 'satuan' &&
        pkg.sub_kategori !== satuanSubFilter
      ) {
        return false;
      }
      if (priceRange === 'under500k' && pkg.harga_total >= 500000) return false;
      if (
        priceRange === '500k_1500k' &&
        (pkg.harga_total < 500000 || pkg.harga_total > 1500000)
      ) {
        return false;
      }
      if (priceRange === 'above1500k' && pkg.harga_total <= 1500000) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = pkg.nama_paket.toLowerCase().includes(q);
        const matchCat =
          pkg.kategori.toLowerCase().includes(q) ||
          (pkg.sub_kategori || '').toLowerCase().includes(q);
        const matchContent = pkg.daftar_isi.some((item) => item.toLowerCase().includes(q));
        return matchName || matchCat || matchContent;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => a.harga_total - b.harga_total);
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => b.harga_total - a.harga_total);
    } else if (sortBy === 'daily_asc') {
      sorted.sort((a, b) => a.setoran_harian - b.setoran_harian);
    }
    return sorted;
  }, [packages, activeCategory, satuanSubFilter, priceRange, searchQuery, sortBy]);

  const displayedPackages = useMemo(() => {
    if (activeCategory === 'all' && !searchQuery.trim() && priceRange === 'all' && !showAllSatuan) {
      const mainPkgs = filteredPackages.filter((p) => p.kategori !== 'satuan');
      const sampleSatuan = filteredPackages.filter((p) => p.kategori === 'satuan').slice(0, 4);
      return [...mainPkgs, ...sampleSatuan];
    }
    return filteredPackages;
  }, [filteredPackages, activeCategory, searchQuery, priceRange, showAllSatuan]);

  const openCategoryCatalog = (cat: 'all' | PackageCategory) => {
    setActiveCategory(cat);
    setSatuanSubFilter('Semua Satuan');
    setPriceRange('all');
    onNavigate('katalog');
  };

  // Delegate standalone pages
  if (activePage === 'tabungan') {
    return (
      <TabunganProgramPage
        packages={packages}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={onSelectAgent}
        onLockSimulation={onLockSimulation}
        initialPackageId={detailPackageId || undefined}
        onOpenChat={onOpenChat}
      />
    );
  }

  if (activePage === 'cara_pesan') {
    return <CaraPemesananPage onNavigate={onNavigate} onOpenChat={onOpenChat} />;
  }

  if (activePage === 'tentang') {
    return (
      <TentangKamiPage
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={onSelectAgent}
        onNavigate={onNavigate}
      />
    );
  }

  if (activePage === 'kontak') {
    return <KontakPage onOpenChat={onOpenChat} />;
  }

  // Detail gallery images built from package photo + relevant official brochures
  const buildPackageGallery = (pkg: ParcelPackage) => {
    const categoryBrochure =
      pkg.kategori === 'bunda'
        ? BROCHURE_BUNDA
        : pkg.kategori === 'anak'
          ? BROCHURE_ANAK
          : pkg.kategori === 'pilihan'
            ? BROCHURE_PILIHAN
            : pkg.kategori === 'uang'
              ? BROCHURE_UANG
              : BROCHURE_SATUAN;

    return [
      { label: pkg.nama_paket, src: pkg.foto_url },
      { label: 'Brosur Resmi Kategori', src: categoryBrochure },
      { label: 'Katalog Utama 2026–2027', src: BROCHURE_COVER },
      { label: 'Kemasan Eksklusif Sagitarius', src: IMG_HERO },
      { label: 'Varian Paket Unggulan', src: pkg.kategori === 'pilihan' ? IMG_SULTAN : IMG_BUNDA },
    ];
  };

  const renderBrochuresModal = () =>
    showBrochuresModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#C8A053]/50 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E4DCCB] bg-[#0C3328] px-5 py-3.5 text-white">
            <div>
              <p className="text-[11px] font-semibold text-[#E8CA82]">
                {COMPANY_INFO.legalName}
              </p>
              <h3 className="font-display text-lg font-bold">
                {BROCHURE_GALLERY[activeBrochureIdx].title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBrochuresModal(false)}
              className="rounded-lg p-1.5 text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
              aria-label="Tutup galeri brosur"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-stone-950 p-4 text-center">
            <img
              src={BROCHURE_GALLERY[activeBrochureIdx].src}
              alt={BROCHURE_GALLERY[activeBrochureIdx].title}
              className="mx-auto max-h-[64vh] rounded-lg object-contain"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DCCB] bg-[#FAF7F2] px-5 py-3">
            <div className="flex flex-wrap gap-1.5">
              {BROCHURE_GALLERY.map((b, i) => (
                <button
                  key={b.title}
                  type="button"
                  onClick={() => setActiveBrochureIdx(i)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    i === activeBrochureIdx
                      ? 'bg-[#381E5A] text-white'
                      : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  Hal {i + 1}
                </button>
              ))}
            </div>
            <a
              href={formatWhatsAppUrl(
                COMPANY_INFO.csWhatsappDigits,
                `Halo CS Sagitarius Parcel, saya ingin bertanya tentang ${BROCHURE_GALLERY[activeBrochureIdx].title}.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#15803D]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Tanya CS WA</span>
            </a>
          </div>
        </div>
      </div>
    );

  // =========================================================================
  // PAGE: DETAIL PAKET (Matches 6_4e5e6576.png)
  // =========================================================================
  if (activePage === 'detail_paket' && currentDetailPkg) {
    const gallery = buildPackageGallery(currentDetailPkg);
    const activePhoto = gallery[galleryIdx] || gallery[0];
    const isLiked = wishlistIds.includes(currentDetailPkg.id);
    const recommendations = packages.filter((p) => p.id !== currentDetailPkg.id);
    const maxOffset = Math.max(0, recommendations.length - 4);
    const visibleRecs = recommendations.slice(recOffset, recOffset + 4);

    const handleDirectOrder = () => {
      const estimasi =
        quickBookFreq === 'harian'
          ? currentDetailPkg.setoran_harian
          : currentDetailPkg.setoran_mingguan;
      onLockSimulation({
        packageItem: currentDetailPkg,
        durasiMinggu: Math.max(12, Math.round(currentDetailPkg.durasi_hari / 7)),
        frekuensi: quickBookFreq,
        estimasiSetoran: estimasi,
        selectedAgentId: selectedAgentId || agents[0]?.id,
      });
    };

    const getPackagingText = (pkg: ParcelPackage) => {
      if (pkg.kategori === 'bunda') {
        return `${pkg.nama_paket} dikemas aman menggunakan wadah eksklusif (${pkg.sub_kategori || 'Travel Bag / Container Box / Koper'}) lengkap dengan segel pengaman Sagitarius Parcel dan label identitas member.`;
      }
      if (pkg.kategori === 'anak') {
        return `Dikemas rapi menggunakan tas/koper karakter ramah anak atau kotak parcel kuat untuk melindungi kue kering dan minuman kemasan.`;
      }
      if (pkg.kategori === 'pilihan') {
        return `Menggunakan Container Box tebal kapasitas besar bersegel rapi, menjaga seluruh kue kaleng, minyak goreng 5L, beras 5–10Kg, dan perlengkapan tetap utuh.`;
      }
      if (pkg.kategori === 'uang') {
        return `Diserahkan dalam amplop resmi bersegel PT. Sagitarius Trinunggal Karya beserta rincian buku/kartu tabungan tervalidasi.`;
      }
      return `Dikemas per item sesuai standar gudang Mangunreja; produk daging & telur segar dipacking higienis khusus distribusi H-2 Idul Fitri.`;
    };

    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500"
        >
          <button
            type="button"
            onClick={() => onNavigate('beranda')}
            className="inline-flex items-center gap-1 text-[#381E5A] hover:underline cursor-pointer"
          >
            <Home className="h-3.5 w-3.5 text-[#C8A053]" />
            <span>Beranda</span>
          </button>
          <span>&gt;</span>
          <button
            type="button"
            onClick={() => onNavigate('katalog')}
            className="text-[#381E5A] hover:underline cursor-pointer"
          >
            Paket Parcel
          </button>
          <span>&gt;</span>
          <span className="font-semibold text-[#C8A053]">{currentDetailPkg.nama_paket}</span>
        </nav>

        {/* Main Detail Split Grid */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Left Gallery + 5 Thumbnails */}
          <div className="space-y-3 lg:col-span-6">
            <div className="relative overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white shadow-xs">
              <img
                src={activePhoto.src}
                alt={activePhoto.label}
                className="aspect-[4/3] w-full object-cover"
              />
              <button
                type="button"
                onClick={() =>
                  setGalleryIdx((prev) => (prev - 1 + gallery.length) % gallery.length)
                }
                aria-label="Foto sebelumnya"
                className="absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4DCCB] bg-white/95 text-[#381E5A] shadow transition hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryIdx((prev) => (prev + 1) % gallery.length)}
                aria-label="Foto berikutnya"
                className="absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4DCCB] bg-white/95 text-[#381E5A] shadow transition hover:bg-white cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              {gallery.map((g, idx) => (
                <button
                  key={`${g.label}-${idx}`}
                  type="button"
                  onClick={() => setGalleryIdx(idx)}
                  className={`overflow-hidden rounded-xl border-2 bg-white transition cursor-pointer ${
                    galleryIdx === idx
                      ? 'border-[#C8A053] ring-1 ring-[#C8A053]'
                      : 'border-[#E4DCCB] opacity-75 hover:opacity-100'
                  }`}
                >
                  <img
                    src={g.src}
                    alt={g.label}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Spec Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E4DCCB] bg-white p-6 sm:p-8 lg:col-span-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
                    {currentDetailPkg.nama_paket}
                  </h1>
                  <p className="mt-1 font-mono-nums text-xs font-medium text-[#C8A053]">
                    Kode Paket: {currentDetailPkg.id.toUpperCase()} ·{' '}
                    {currentDetailPkg.sub_kategori || currentDetailPkg.kategori}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleWishlist(currentDetailPkg.id)}
                  aria-label="Simpan paket pilihan"
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition cursor-pointer ${
                    isLiked
                      ? 'border-rose-300 bg-rose-50 text-rose-600'
                      : 'border-[#E4DCCB] bg-[#FAF7F2] text-stone-500 hover:text-rose-500'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${isLiked ? 'fill-rose-500' : ''}`} />
                </button>
              </div>

              {/* Price & Availability Row */}
              <div className="mt-5 grid gap-4 border-y border-[#F0EAE0] py-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-stone-500">Harga Total &amp; Cicilan</p>
                  <p className="mt-1 font-mono-nums text-2xl font-bold text-[#381E5A]">
                    {formatRupiah(currentDetailPkg.harga_total)}
                  </p>
                  <p className="mt-0.5 font-mono-nums text-xs text-stone-600">
                    Mulai <strong>{formatRupiah(currentDetailPkg.setoran_harian)}/hari</strong>{' '}
                    atau {formatRupiah(currentDetailPkg.setoran_mingguan)}/minggu (
                    {currentDetailPkg.durasi_hari} hari)
                  </p>
                  {currentDetailPkg.bonus_thr > 0 && (
                    <p className="mt-1 font-mono-nums text-xs font-bold text-[#B98E3A]">
                      + Bonus THR Tunai {formatRupiah(currentDetailPkg.bonus_thr)}
                    </p>
                  )}
                </div>

                <div className="sm:border-l sm:border-[#F0EAE0] sm:pl-5">
                  <p className="text-xs font-semibold text-[#B98E3A]">Ketersediaan &amp; Jadwal</p>
                  <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-bold text-[#0C3328]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A]" />
                    <span>Tersedia (Program 2026–2027)</span>
                  </p>
                  <p className="mt-1 text-xs text-stone-600">
                    Pembagian: <strong>{currentDetailPkg.jadwal_ambil}</strong>
                  </p>
                  <p className="mt-0.5 font-mono-nums text-xs text-stone-500">
                    Estimasi bobot: {currentDetailPkg.bobot_kg} kg
                  </p>
                </div>
              </div>

              {/* Ringkasan Manfaat */}
              <div className="mt-4">
                <p className="text-xs font-bold text-[#B98E3A]">Ringkasan Manfaat</p>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                  Mencakup <strong>{currentDetailPkg.daftar_isi.length} item resmi</strong>:{' '}
                  {currentDetailPkg.daftar_isi.slice(0, 5).join(', ')}
                  {currentDetailPkg.daftar_isi.length > 5
                    ? `, serta ${currentDetailPkg.daftar_isi.length - 5} item pelengkap lainnya.`
                    : '.'}{' '}
                  Berlaku untuk pendaftaran harian maupun mingguan dengan kupon Door Prize resmi.
                </p>
              </div>

              {/* Frequency & Agent quick selector before booking */}
              <div className="mt-4 grid gap-3 rounded-xl border border-[#F0EAE0] bg-[#FAF7F2] p-3.5 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600">
                    Pilih Frekuensi Setoran
                  </label>
                  <div className="mt-1.5 flex rounded-lg border border-[#E4DCCB] bg-white p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setQuickBookFreq('harian')}
                      className={`flex-1 rounded-md py-1.5 font-semibold transition cursor-pointer ${
                        quickBookFreq === 'harian'
                          ? 'bg-[#0C3328] text-white'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Harian
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickBookFreq('mingguan')}
                      className={`flex-1 rounded-md py-1.5 font-semibold transition cursor-pointer ${
                        quickBookFreq === 'mingguan'
                          ? 'bg-[#0C3328] text-white'
                          : 'text-stone-600 hover:text-stone-900'
                      }`}
                    >
                      Mingguan
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600">
                    Agen Binaan Priangan Timur
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => onSelectAgent(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-[#E4DCCB] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.wilayah} — {a.nama}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDirectOrder}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0C3328] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#144738] cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4 text-[#E8CA82]" />
                <span>Pesan Paket Sekarang</span>
              </button>
              <a
                href={formatWhatsAppUrl(
                  COMPANY_INFO.csWhatsappDigits,
                  `Halo CS Sagitarius Parcel, saya ingin menanyakan detail & ketersediaan ${currentDetailPkg.nama_paket} (${formatRupiah(currentDetailPkg.setoran_harian)}/hari).`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0C3328] bg-white px-5 py-3.5 text-sm font-bold text-[#0C3328] transition hover:bg-[#FAF7F2]"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Tanyakan Detail</span>
              </a>
            </div>
          </div>
        </div>

        {/* 4 Interactive Tabs */}
        <div className="overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white">
          <div className="grid grid-cols-2 border-b border-[#E4DCCB] bg-[#FAF7F2] sm:grid-cols-4">
            {[
              { id: 'isi' as const, label: 'Isi Paket', icon: Gift },
              { id: 'kemasan' as const, label: 'Pengemasan', icon: PackageIcon },
              { id: 'pengiriman' as const, label: 'Pengiriman', icon: Truck },
              { id: 'ketentuan' as const, label: 'Ketentuan Pemesanan', icon: ShieldCheck },
            ].map((t) => {
              const Icon = t.icon;
              const active = detailTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id)}
                  className={`flex items-center justify-center gap-2 px-4 py-3.5 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-[#0C3328] text-[#E8CA82]'
                      : 'text-[#381E5A] hover:bg-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-[#E8CA82]' : 'text-[#C8A053]'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6">
            {detailTab === 'isi' && (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                  <h3 className="font-display text-lg font-bold text-[#381E5A]">
                    Rincian Komoditas Resmi ({currentDetailPkg.daftar_isi.length} Item)
                  </h3>
                  <span className="font-mono-nums text-xs font-semibold text-stone-500">
                    Total Estimasi Bobot: {currentDetailPkg.bobot_kg} kg
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentDetailPkg.daftar_isi.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-[#F0EAE0] bg-[#FAF7F2] px-3.5 py-2.5 text-xs font-medium text-stone-800"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0C3328]" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detailTab === 'kemasan' && (
              <div className="space-y-2 text-sm leading-relaxed text-stone-700">
                <h3 className="font-display text-lg font-bold text-[#381E5A]">
                  Standar Pengemasan &amp; Kualitas
                </h3>
                <p className="text-xs sm:text-sm">{getPackagingText(currentDetailPkg)}</p>
                <p className="text-xs text-stone-500">
                  Seluruh produk pangan dicek kesegaran dan masa kedaluwarsanya oleh tim gudang{' '}
                  {COMPANY_INFO.legalName} sebelum didistribusikan ke masing-masing Korwil dan Agen.
                </p>
              </div>
            )}

            {detailTab === 'pengiriman' && (
              <div className="space-y-3">
                <h3 className="font-display text-lg font-bold text-[#381E5A]">
                  Jadwal Pengambilan &amp; Pengiriman Priangan Timur
                </h3>
                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                    <p className="font-bold text-[#381E5A]">Jadwal Paket Ini</p>
                    <p className="mt-1 font-semibold text-[#0C3328]">
                      {currentDetailPkg.jadwal_ambil}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                    <p className="font-bold text-[#381E5A]">Metode Serah Terima</p>
                    <p className="mt-1 text-stone-600">
                      Scan E-Tiket QR Lunas melalui Agen Binaan atau langsung di Gudang Pusat Mangunreja.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                    <p className="font-bold text-[#381E5A]">Area Layanan</p>
                    <p className="mt-1 text-stone-600">
                      Tasikmalaya, Ciamis, Banjar, Pangandaran, dan Garut.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'ketentuan' && (
              <div className="space-y-2">
                <h3 className="font-display text-lg font-bold text-[#381E5A]">
                  Ketentuan Resmi Sagitarius Parcel
                </h3>
                <ul className="space-y-1.5 text-xs leading-relaxed text-stone-700">
                  {COMPANY_INFO.terms.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C8A053]" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Rekomendasi Paket Lainnya */}
        <section className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-[#381E5A]">
              Rekomendasi Paket Lainnya
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={recOffset === 0}
                onClick={() => setRecOffset((v) => Math.max(0, v - 1))}
                aria-label="Rekomendasi sebelumnya"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E4DCCB] bg-white text-[#381E5A] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={recOffset >= maxOffset}
                onClick={() => setRecOffset((v) => Math.min(maxOffset, v + 1))}
                aria-label="Rekomendasi berikutnya"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E4DCCB] bg-white text-[#381E5A] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleRecs.map((pkg) => {
              const liked = wishlistIds.includes(pkg.id);
              return (
                <article
                  key={pkg.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <img
                      src={pkg.foto_url}
                      alt={pkg.nama_paket}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(pkg.id)}
                      aria-label={`Simpan ${pkg.nama_paket}`}
                      className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#381E5A] shadow cursor-pointer"
                    >
                      <Heart
                        className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : 'text-[#B98E3A]'}`}
                      />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#381E5A]">{pkg.nama_paket}</h3>
                      <p className="mt-1 line-clamp-2 text-[11px] text-stone-600">
                        {pkg.daftar_isi.slice(0, 3).join(', ')}
                      </p>
                      <p className="mt-2 font-mono-nums text-xs font-bold text-[#381E5A]">
                        {formatRupiah(pkg.harga_total)} ·{' '}
                        <span className="font-normal text-stone-500">
                          {formatRupiah(pkg.setoran_harian)}/hr
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#F0EAE0] pt-3">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                        <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                        Tersedia
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDetail(pkg);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-[#241142] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#381E5A] cursor-pointer"
                      >
                        <span>Lihat Detail</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {renderBrochuresModal()}
      </div>
    );
  }

  // =========================================================================
  // PAGE: KATALOG PAKET LEBARAN (Matches 7_10f3e5fa.png)
  // =========================================================================
  if (activePage === 'katalog') {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        {/* Arched Hero Header */}
        <section className="grid items-center gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-6">
            <p className="text-xs font-semibold text-[#C8A053]">
              Katalog Resmi 2026–2027 · {COMPANY_INFO.legalName}
            </p>
            <h1 className="font-display text-3xl leading-tight font-bold text-[#381E5A] sm:text-5xl">
              Temukan Paket Lebaran Pilihan Anda
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-stone-600">
              Hampers berkualitas untuk momen penuh makna bersama keluarga, rekan, dan sahabat. Pilih Paket Bunda, Paket Anak, Diamond &amp; Sultan, Paket Uang, atau 50 Barang Satuan.
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowBrochuresModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-4 py-2.5 text-xs font-bold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-[#C8A053]" />
                <span>Lihat 6 Brosur Resmi</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tabungan')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0C3328] px-4 py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>Simulasi Tabungan 325 Hari</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-t-[160px] rounded-b-2xl border-2 border-[#C8A053]/60 bg-white shadow-xs">
              <img
                src={IMG_HERO}
                alt="Temukan Paket Lebaran Pilihan Anda"
                className="aspect-[16/9] w-full object-cover"
              />
            </div>
          </div>
        </section>

        {/* Search & 3 Dropdown Filters Bar */}
        <section className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari paket hadiah, isi (misal: beras, khong guan, daging), atau kategori..."
              className="w-full rounded-xl border border-[#E4DCCB] bg-white py-3 pr-10 pl-11 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#381E5A] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-stone-400 hover:bg-stone-100 cursor-pointer"
                aria-label="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="relative">
              <select
                value={activeCategory}
                onChange={(e) => {
                  const val = e.target.value as 'all' | PackageCategory;
                  setActiveCategory(val);
                  if (val !== 'satuan') setSatuanSubFilter('Semua Satuan');
                }}
                aria-label="Filter kategori"
                className="w-full appearance-none rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 pr-9 text-xs font-semibold text-[#381E5A] focus:border-[#381E5A] focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            </div>

            <div className="relative">
              <select
                value={priceRange}
                onChange={(e) =>
                  setPriceRange(e.target.value as (typeof PRICE_RANGE_OPTIONS)[number]['id'])
                }
                aria-label="Filter rentang harga"
                className="w-full appearance-none rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 pr-9 text-xs font-semibold text-[#381E5A] focus:border-[#381E5A] focus:outline-none"
              >
                {PRICE_RANGE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as (typeof SORT_OPTIONS)[number]['id'])
                }
                aria-label="Urutkan katalog"
                className="w-full appearance-none rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 pr-9 text-xs font-semibold text-[#381E5A] focus:border-[#381E5A] focus:outline-none"
              >
                {SORT_OPTIONS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
            </div>
          </div>

          {/* Sub-filter chips when 50 Barang Satuan */}
          {(activeCategory === 'satuan' || activeCategory === 'all') && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-stone-500">Filter Satuan:</span>
              {SATUAN_SUBFILTERS.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setSatuanSubFilter(sub);
                    if (sub !== 'Semua Satuan') setActiveCategory('satuan');
                  }}
                  className={`rounded-lg px-3 py-1 font-semibold transition cursor-pointer ${
                    satuanSubFilter === sub
                      ? 'bg-[#0C3328] text-[#E8CA82]'
                      : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Exact Lookup Tables when Paket Uang is selected */}
        {activeCategory === 'uang' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
              <h3 className="font-display text-lg font-bold text-[#381E5A]">
                Tabel Paket Uang Munggahan (295 Hari &amp; 42 Minggu)
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="mb-1.5 font-semibold text-stone-700">Harian (295 Hari)</p>
                  <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB]">
                    {PAKET_UANG_TABLES.munggahanHarian295.map((r) => (
                      <div key={r.setoran} className="flex justify-between px-3 py-1.5 font-mono-nums">
                        <span>{formatRupiah(r.setoran)}/hr</span>
                        <span className="font-bold text-[#0C3328]">{formatRupiah(r.hasil)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-stone-700">Mingguan (42 Minggu)</p>
                  <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB]">
                    {PAKET_UANG_TABLES.munggahanMingguan42.map((r) => (
                      <div key={r.setoran} className="flex justify-between px-3 py-1.5 font-mono-nums">
                        <span>{formatRupiah(r.setoran)}/mg</span>
                        <span className="font-bold text-[#0C3328]">{formatRupiah(r.hasil)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
              <h3 className="font-display text-lg font-bold text-[#381E5A]">
                Tabel Paket Uang Lebaran (325 Hari &amp; 45 Minggu)
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                <div>
                  <p className="mb-1.5 font-semibold text-stone-700">Harian (325 Hari)</p>
                  <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB]">
                    {PAKET_UANG_TABLES.lebaranHarian325.map((r) => (
                      <div key={r.setoran} className="flex justify-between px-3 py-1.5 font-mono-nums">
                        <span>{formatRupiah(r.setoran)}/hr</span>
                        <span className="font-bold text-[#0C3328]">{formatRupiah(r.hasil)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 font-semibold text-stone-700">Mingguan (45 Minggu)</p>
                  <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB]">
                    {PAKET_UANG_TABLES.lebaranMingguan45.map((r) => (
                      <div key={r.setoran} className="flex justify-between px-3 py-1.5 font-mono-nums">
                        <span>{formatRupiah(r.setoran)}/mg</span>
                        <span className="font-bold text-[#0C3328]">{formatRupiah(r.hasil)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4-Column Product Grid */}
        {displayedPackages.length === 0 ? (
          <div className="rounded-2xl border border-[#E4DCCB] bg-white p-12 text-center">
            <PackageIcon className="mx-auto h-10 w-10 text-stone-400" />
            <p className="mt-3 text-sm font-semibold text-[#381E5A]">
              Tidak ada paket yang sesuai dengan filter Anda.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setPriceRange('all');
                setSatuanSubFilter('Semua Satuan');
              }}
              className="mt-4 rounded-xl border border-[#E4DCCB] px-5 py-2 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
            >
              Reset Filter Katalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {displayedPackages.map((pkg) => {
              const liked = wishlistIds.includes(pkg.id);
              return (
                <article
                  key={pkg.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                    <img
                      src={pkg.foto_url}
                      alt={pkg.nama_paket}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(pkg.id)}
                      aria-label={`Simpan ${pkg.nama_paket} ke daftar pilihan`}
                      className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow transition hover:scale-105 cursor-pointer"
                    >
                      <Heart
                        className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : 'text-[#B98E3A]'}`}
                      />
                    </button>
                    {pkg.bonus_thr > 0 && (
                      <span className="absolute bottom-2.5 left-2.5 rounded-lg bg-[#0C3328]/90 px-2.5 py-1 font-mono-nums text-[10px] font-bold text-[#E8CA82]">
                        THR {formatRupiah(pkg.bonus_thr)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C8A053]">
                        {pkg.sub_kategori || pkg.kategori} · {pkg.bobot_kg} kg
                      </p>
                      <h2 className="mt-0.5 text-base font-bold text-[#381E5A]">
                        {pkg.nama_paket}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-600">
                        {pkg.daftar_isi.slice(0, 3).join(', ')}
                        {pkg.daftar_isi.length > 3
                          ? ` (+${pkg.daftar_isi.length - 3} item lainnya)`
                          : ''}
                      </p>
                    </div>

                    <div className="mt-3 border-t border-[#F0EAE0] pt-3">
                      <p className="font-mono-nums text-sm font-bold text-[#381E5A]">
                        {formatRupiah(pkg.harga_total)}{' '}
                        <span className="text-[11px] font-normal text-stone-500">
                          ({formatRupiah(pkg.setoran_harian)}/hari)
                        </span>
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600">
                          <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                          Tersedia
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onOpenDetail(pkg);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="inline-flex items-center gap-1 rounded-full bg-[#241142] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#381E5A] cursor-pointer"
                        >
                          <span>Lihat Detail</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* Action Card at end of grid (replaces decorative "Katalog sedang diperbarui" card with live action) */}
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D5CBB8] bg-[#FAF7F2] p-6 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#381E5A]/10 text-[#381E5A]">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <h3 className="mt-3 text-sm font-bold text-[#381E5A]">
                {activeCategory === 'all' && !showAllSatuan
                  ? 'Lihat 50 Barang Satuan Lengkap'
                  : 'Cek Brosur Cetak Resmi'}
              </h3>
              <p className="mt-1 text-xs text-stone-600">
                {activeCategory === 'all' && !showAllSatuan
                  ? 'Beras, Minyak, Daging Sapi, Ayam, dan Telur H-2 mulai Rp 100/hari.'
                  : 'Bandingkan seluruh varian langsung dari brosur resmi 2026–2027.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (activeCategory === 'all' && !showAllSatuan) {
                    setActiveCategory('satuan');
                    setShowAllSatuan(true);
                  } else {
                    setShowBrochuresModal(true);
                  }
                }}
                className="mt-4 rounded-xl bg-[#0C3328] px-4 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
              >
                {activeCategory === 'all' && !showAllSatuan
                  ? 'Muat 50 Barang Satuan'
                  : 'Buka Galeri Brosur'}
              </button>
            </div>
          </div>
        )}

        {renderBrochuresModal()}
      </div>
    );
  }

  // =========================================================================
  // PAGE: BERANDA (Matches 8_2fabc4d5.png)
  // =========================================================================
  const featuredHighlight = packages.filter((p) => p.kategori !== 'satuan').slice(0, 4);

  return (
    <div className="space-y-10 pb-12">
      {/* Split Hero Section */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            <p className="text-xs font-semibold text-[#C8A053]">
              {COMPANY_INFO.legalName} · {COMPANY_INFO.tagline}
            </p>
            <h1
              className="font-display text-4xl leading-[1.12] font-bold text-[#381E5A] sm:text-5xl"
              style={{ textWrap: 'balance' }}
            >
              Sambut Lebaran dengan Bingkisan Bermakna
            </h1>
            <p className="text-sm leading-relaxed text-stone-600 sm:text-base">
              Persiapkan paket Lebaran untuk keluarga dan orang terkasih bersama Sagitarius Parcel. Mulai Rp 100–Rp 10.000/hari selama 325 hari lengkap dengan bonus THR &amp; kupon Door Prize.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => openCategoryCatalog('all')}
                className="inline-flex items-center gap-2 rounded-full bg-[#0C3328] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#144738] cursor-pointer"
              >
                <span>Lihat Paket</span>
                <ArrowRight className="h-4 w-4 text-[#E8CA82]" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tabungan')}
                className="inline-flex items-center gap-2 rounded-full border border-[#C8A053] bg-white px-6 py-3 text-sm font-semibold text-[#381E5A] transition hover:bg-[#FAF7F2] cursor-pointer"
              >
                <span>Pelajari Tabungan</span>
                <ArrowRight className="h-4 w-4 text-[#0C3328]" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="relative overflow-hidden rounded-tl-[160px] rounded-tr-2xl rounded-b-2xl border-2 border-[#C8A053]/60 bg-white shadow-sm">
              <img
                src={IMG_HERO}
                alt="Bingkisan Parcel Lebaran Sagitarius Parcel"
                className="aspect-[16/9] w-full object-cover"
              />
              <button
                type="button"
                onClick={() => setShowBrochuresModal(true)}
                className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full border border-[#C8A053]/70 bg-[#0C3328]/90 px-4 py-2 text-xs font-semibold text-[#E8CA82] backdrop-blur-xs hover:bg-[#0C3328] cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Lihat Brosur Cetak 2026–2027</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3 Category Showcase Cards */}
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <button
            type="button"
            onClick={() => openCategoryCatalog('bunda')}
            className="group flex items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#C8A053] hover:shadow-md cursor-pointer"
          >
            <img
              src={IMG_BUNDA}
              alt="Paket Keluarga"
              className="h-24 w-28 shrink-0 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold text-[#381E5A]">Paket Keluarga</h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Paket Bunda 4 varian (Travel Bag, Box &amp; Koper) lengkap sembako &amp; THR.
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => openCategoryCatalog('pilihan')}
            className="group flex items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#C8A053] hover:shadow-md cursor-pointer"
          >
            <img
              src={IMG_SULTAN}
              alt="Paket Eksklusif"
              className="h-24 w-28 shrink-0 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold text-[#381E5A]">Paket Eksklusif</h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Paket Diamond &amp; Sultan berhadiah THR hingga Rp 2.000.000 + Door Prize.
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => openCategoryCatalog('anak')}
            className="group flex items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#C8A053] hover:shadow-md cursor-pointer"
          >
            <img
              src={IMG_ANAK}
              alt="Paket Hemat"
              className="h-24 w-28 shrink-0 rounded-xl object-cover"
            />
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold text-[#381E5A]">Paket Hemat</h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Paket Anak mulai Rp 1.500/hari &amp; 50 Barang Satuan mulai Rp 100/hari.
              </p>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* 3-Column Bento Grid */}
        <div className="mt-6 grid gap-5 lg:grid-cols-12">
          {/* Card 1: Program Tabungan Lebaran */}
          <div className="bg-arabesque-emerald flex flex-col justify-between rounded-2xl border border-[#C8A053]/40 p-6 text-white lg:col-span-5">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 text-[#E8CA82]">
                <Gift className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Program Tabungan Lebaran
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-200">
                  Rencanakan Lebaran lebih tenang dengan menabung secara bertahap harian atau mingguan.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-[11px]">
              <div className="flex items-start gap-1.5">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8CA82]" />
                <span>Ringan 325 hari</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8CA82]" />
                <span>Fleksibel Harian/Minggu</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#E8CA82]" />
                <span>Siap 15 Ramadhan</span>
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => onNavigate('tabungan')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E8CA82] hover:underline cursor-pointer"
              >
                <span>Buka Kalkulator &amp; Info Program</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Cara Pemesanan */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E4DCCB] bg-white p-6 lg:col-span-4">
            <div>
              <h3 className="text-center font-display text-xl font-bold text-[#381E5A]">
                Cara Pemesanan
              </h3>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => openCategoryCatalog('all')}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                  <span className="-mt-2 rounded-full bg-[#C8A053] px-1.5 font-mono-nums text-[10px] font-bold text-white">
                    1
                  </span>
                  <p className="mt-1.5 text-xs font-bold text-[#381E5A]">Pilih Paket</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">Sesuaikan kebutuhan</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('cara_pesan')}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                    <MessageCircle className="h-4 w-4" />
                  </span>
                  <span className="-mt-2 rounded-full bg-[#C8A053] px-1.5 font-mono-nums text-[10px] font-bold text-white">
                    2
                  </span>
                  <p className="mt-1.5 text-xs font-bold text-[#381E5A]">Konfirmasi</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">Daftar via Agen/CS</p>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('cara_pesan')}
                  className="flex flex-col items-center cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0C3328] text-[#E8CA82]">
                    <Truck className="h-4 w-4" />
                  </span>
                  <span className="-mt-2 rounded-full bg-[#C8A053] px-1.5 font-mono-nums text-[10px] font-bold text-white">
                    3
                  </span>
                  <p className="mt-1.5 text-xs font-bold text-[#381E5A]">Pengiriman</p>
                  <p className="mt-0.5 text-[10px] text-stone-500">Ambil dengan QR</p>
                </button>
              </div>
            </div>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => onNavigate('cara_pesan')}
                className="text-xs font-semibold text-[#381E5A] underline hover:text-[#C8A053] cursor-pointer"
              >
                Lihat Panduan 5 Langkah Lengkap
              </button>
            </div>
          </div>

          {/* Card 3: Siap berbagi kebahagiaan? */}
          <div className="bg-arabesque-emerald flex flex-col justify-between rounded-2xl border border-[#C8A053]/40 p-6 text-white lg:col-span-3">
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Siap berbagi kebahagiaan?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-200">
                Hubungi kami untuk konsultasi dan pemesanan paket Lebaran Priangan Timur.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => onNavigate('kontak')}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-5 py-2.5 text-xs font-bold text-[#1D122B] transition hover:brightness-105 cursor-pointer"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Hubungi Kami</span>
              </button>
              <button
                type="button"
                onClick={onOpenChat}
                className="text-center text-[11px] font-semibold text-[#E8CA82] hover:underline cursor-pointer"
              >
                Atau tanya CS Online AI
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Paket Unggulan Preview Strip */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#E4DCCB] pb-4">
          <div>
            <p className="text-xs font-semibold text-[#C8A053]">Katalog 2026–2027</p>
            <h2 className="mt-0.5 font-display text-2xl font-bold text-[#381E5A]">
              Pilihan Paket Terfavorit Member
            </h2>
          </div>
          <button
            type="button"
            onClick={() => openCategoryCatalog('all')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#381E5A] hover:text-[#C8A053] cursor-pointer"
          >
            <span>Lihat Semua {packages.length} Paket &amp; Satuan</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredHighlight.map((pkg) => {
            const liked = wishlistIds.includes(pkg.id);
            return (
              <article
                key={pkg.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-stone-100">
                  <img
                    src={pkg.foto_url}
                    alt={pkg.nama_paket}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(pkg.id)}
                    aria-label={`Simpan ${pkg.nama_paket}`}
                    className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow cursor-pointer"
                  >
                    <Heart
                      className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : 'text-[#B98E3A]'}`}
                    />
                  </button>
                </div>
                <div className="flex flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#381E5A]">{pkg.nama_paket}</h3>
                    <p className="mt-1 line-clamp-2 text-[11px] text-stone-600">
                      {pkg.daftar_isi.slice(0, 3).join(', ')}
                    </p>
                    <p className="mt-2 font-mono-nums text-xs font-bold text-[#381E5A]">
                      {formatRupiah(pkg.harga_total)} ·{' '}
                      <span className="font-normal text-stone-500">
                        {formatRupiah(pkg.setoran_harian)}/hr
                      </span>
                    </p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-[#F0EAE0] pt-3">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-stone-600">
                      <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                      Tersedia
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDetail(pkg);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#241142] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#381E5A] cursor-pointer"
                    >
                      <span>Lihat Detail</span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {renderBrochuresModal()}
    </div>
  );
};
