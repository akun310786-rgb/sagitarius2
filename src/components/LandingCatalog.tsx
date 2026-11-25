import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  Heart,
  Home,
  MessageCircle,
  Package as PackageIcon,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserCheck,
  UserPlus,
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
  IMG_BUNDA,
  IMG_BUNDA_BOX,
  IMG_HERO,
  IMG_RESELLER,
  IMG_SULTAN,
  IMG_UANG_DAGING,
  PAKET_UANG_TABLES,
  RESELLER_PROGRAM,
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
import { KontakPage, TentangKamiPage } from './ContactAndPages';

export type MainCatalogCategory = 'paket_lebaran' | 'tabungan_uang';
type PaketLebaranSubFilter = 'all_lebaran' | 'bunda' | 'anak' | 'pilihan' | 'satuan';

interface LandingCatalogProps {
  activePage: PublicPage;
  onNavigate: (page: PublicPage) => void;
  catalogCategory: MainCatalogCategory;
  onSelectCatalogCategory: (cat: MainCatalogCategory) => void;
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  onLockSimulation: (lock: SimulationLock) => void;
  selectedAgentId: string;
  onSelectAgent: (agentId: string) => void;
  detailPackageId: string | null;
  onOpenDetail: (pkg: ParcelPackage) => void;
  wishlistIds: string[];
  onToggleWishlist: (pkgId: string) => void;
  focusSearchTrigger?: number;
  referralAgent?: AgentDirectoryItem | null;
  onOpenAuth: (mode: 'login' | 'register_member' | 'register_agent') => void;
}

const BROCHURE_GALLERY = [
  { title: 'Sampul Katalog 2026–2027', src: BROCHURE_COVER },
  { title: 'Brosur Paket Bunda (4 Varian)', src: BROCHURE_BUNDA },
  { title: 'Brosur Paket Anak (4 Varian)', src: BROCHURE_ANAK },
  { title: 'Brosur Paket Pilihan (Diamond & Sultan)', src: BROCHURE_PILIHAN },
  { title: 'Brosur Paket Uang Munggahan & Lebaran', src: BROCHURE_UANG },
  { title: 'Brosur 50 Barang Satuan (325 Hari)', src: BROCHURE_SATUAN },
];

const PAKET_LEBARAN_SUBFILTERS: { id: PaketLebaranSubFilter; label: string }[] = [
  { id: 'all_lebaran', label: 'Semua Paket Lebaran' },
  { id: 'bunda', label: 'Paket Bunda' },
  { id: 'anak', label: 'Paket Anak' },
  { id: 'pilihan', label: 'Diamond & Sultan' },
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
  catalogCategory,
  onSelectCatalogCategory,
  packages,
  agents,
  onLockSimulation,
  selectedAgentId,
  onSelectAgent,
  detailPackageId,
  onOpenDetail,
  wishlistIds,
  onToggleWishlist,
  focusSearchTrigger,
  referralAgent,
  onOpenAuth,
}) => {
  const [lebaranSubCategory, setLebaranSubCategory] =
    useState<PaketLebaranSubFilter>('all_lebaran');
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

  useEffect(() => {
    setGalleryIdx(0);
    setDetailTab('isi');
  }, [detailPackageId]);

  const currentDetailPkg = useMemo(() => {
    if (!detailPackageId) return packages[0];
    return packages.find((p) => p.id === detailPackageId) || packages[0];
  }, [packages, detailPackageId]);

  // Strict 2-category separation
  const tabunganUangPackages = useMemo(
    () => packages.filter((pkg) => pkg.kategori === 'uang'),
    [packages]
  );

  const filteredLebaranPackages = useMemo(() => {
    const list = packages.filter((pkg) => {
      // Strictly exclude Tabungan Uang when Paket Lebaran is selected
      if (pkg.kategori === 'uang') return false;

      if (lebaranSubCategory !== 'all_lebaran' && pkg.kategori !== lebaranSubCategory) {
        return false;
      }

      if (
        (lebaranSubCategory === 'satuan' || lebaranSubCategory === 'all_lebaran') &&
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
  }, [packages, lebaranSubCategory, satuanSubFilter, priceRange, searchQuery, sortBy]);

  const displayedLebaranPackages = useMemo(() => {
    if (
      lebaranSubCategory === 'all_lebaran' &&
      !searchQuery.trim() &&
      priceRange === 'all' &&
      !showAllSatuan
    ) {
      const mainPkgs = filteredLebaranPackages.filter((p) => p.kategori !== 'satuan');
      const sampleSatuan = filteredLebaranPackages
        .filter((p) => p.kategori === 'satuan')
        .slice(0, 4);
      return [...mainPkgs, ...sampleSatuan];
    }
    return filteredLebaranPackages;
  }, [filteredLebaranPackages, lebaranSubCategory, searchQuery, priceRange, showAllSatuan]);

  const openMainCategory = (mainCat: MainCatalogCategory, subCat?: PackageCategory) => {
    onSelectCatalogCategory(mainCat);
    if (mainCat === 'paket_lebaran') {
      setLebaranSubCategory(
        subCat && subCat !== 'uang' ? subCat : 'all_lebaran'
      );
      setSatuanSubFilter('Semua Satuan');
      setPriceRange('all');
    }
    onNavigate('katalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectUangNominal = (
    programTitle: string,
    frekuensi: 'harian' | 'mingguan',
    setoran: number,
    hasil: number,
    durasiHari: number,
    durasiMinggu: number,
    jadwalAmbil: string
  ) => {
    const virtualPkg: ParcelPackage = {
      id: `pkg_uang_${frekuensi}_${durasiHari}_${setoran}`,
      nama_paket: `${programTitle} (${formatRupiah(setoran)}/${frekuensi === 'harian' ? 'hr' : 'mg'})`,
      kategori: 'uang',
      sub_kategori: `Tabungan Uang · ${frekuensi === 'harian' ? `${durasiHari} Hari` : `${durasiMinggu} Minggu`}`,
      harga_total: hasil,
      setoran_harian: frekuensi === 'harian' ? setoran : Math.round(setoran / 7),
      setoran_mingguan: frekuensi === 'mingguan' ? setoran : setoran * 7,
      durasi_hari: durasiHari,
      bobot_kg: 0.5,
      daftar_isi: [
        `Pencairan Dana Tunai ${formatRupiah(hasil)}`,
        `Setoran ${formatRupiah(setoran)}/${frekuensi === 'harian' ? 'hari' : 'minggu'}`,
        `Periode resmi ${frekuensi === 'harian' ? `${durasiHari} hari` : `${durasiMinggu} minggu`}`,
      ],
      bonus_thr: 0,
      foto_url: IMG_UANG_DAGING,
      jadwal_ambil: jadwalAmbil,
    };

    onLockSimulation({
      packageItem: virtualPkg,
      durasiMinggu,
      frekuensi,
      estimasiSetoran: setoran,
      selectedAgentId: selectedAgentId || agents[0]?.id,
    });
  };

  // Delegate standalone pages
  if (activePage === 'tentang') {
    return (
      <TentangKamiPage
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={onSelectAgent}
        onNavigate={onNavigate}
        onOpenAuth={onOpenAuth}
      />
    );
  }

  if (activePage === 'kontak') {
    return <KontakPage />;
  }

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-3 sm:p-4 backdrop-blur-xs"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#C8A053]/50 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[#E4DCCB] bg-[#0C3328] px-4 py-3 sm:px-5 sm:py-3.5 text-white">
            <div className="min-w-0 pr-2">
              <p className="truncate text-[11px] font-semibold text-[#E8CA82]">
                {COMPANY_INFO.legalName}
              </p>
              <h3 className="truncate font-display text-base font-bold sm:text-lg">
                {BROCHURE_GALLERY[activeBrochureIdx].title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBrochuresModal(false)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
              aria-label="Tutup galeri brosur"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-stone-950 p-3 sm:p-4 text-center">
            <img
              src={BROCHURE_GALLERY[activeBrochureIdx].src}
              alt={BROCHURE_GALLERY[activeBrochureIdx].title}
              className="mx-auto max-h-[60vh] rounded-lg object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E4DCCB] bg-[#FAF7F2] px-4 py-3 sm:px-5">
            <div className="flex flex-wrap gap-1.5">
              {BROCHURE_GALLERY.map((b, i) => (
                <button
                  key={b.title}
                  type="button"
                  onClick={() => setActiveBrochureIdx(i)}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
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
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#15803D]"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Tanya CS WA</span>
            </a>
          </div>
        </div>
      </div>
    );

  // =========================================================================
  // PAGE: DETAIL PAKET
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
            onClick={() =>
              openMainCategory(
                currentDetailPkg.kategori === 'uang' ? 'tabungan_uang' : 'paket_lebaran'
              )
            }
            className="text-[#381E5A] hover:underline cursor-pointer"
          >
            {currentDetailPkg.kategori === 'uang' ? 'Tabungan Uang' : 'Paket Lebaran'}
          </button>
          <span>&gt;</span>
          <span className="font-semibold text-[#C8A053]">{currentDetailPkg.nama_paket}</span>
        </nav>

        {/* Main Detail Split Grid */}
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
          {/* Left Gallery + 5 Thumbnails */}
          <div className="space-y-3 lg:col-span-6">
            <div className="relative overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white shadow-xs">
              <img
                src={activePhoto.src}
                alt={activePhoto.label}
                className="aspect-[4/3] w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() =>
                  setGalleryIdx((prev) => (prev - 1 + gallery.length) % gallery.length)
                }
                aria-label="Foto sebelumnya"
                className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4DCCB] bg-white/95 text-[#381E5A] shadow transition hover:bg-white cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryIdx((prev) => (prev + 1) % gallery.length)}
                aria-label="Foto berikutnya"
                className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#E4DCCB] bg-white/95 text-[#381E5A] shadow transition hover:bg-white cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
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
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right Spec Card */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#E4DCCB] bg-white p-5 sm:p-8 lg:col-span-6">
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
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition cursor-pointer ${
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
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-bold text-[#0C3328]">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
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
                      className={`min-h-[38px] flex-1 rounded-md py-1.5 font-semibold transition cursor-pointer ${
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
                      className={`min-h-[38px] flex-1 rounded-md py-1.5 font-semibold transition cursor-pointer ${
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
                    className="mt-1.5 min-h-[40px] w-full rounded-lg border border-[#E4DCCB] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-800"
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
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#0C3328] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#144738] cursor-pointer"
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
                className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#0C3328] bg-white px-5 py-3 text-sm font-bold text-[#0C3328] transition hover:bg-[#FAF7F2]"
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
                  className={`flex min-h-[46px] items-center justify-center gap-2 px-3 py-3 text-xs font-bold transition cursor-pointer ${
                    active
                      ? 'bg-[#0C3328] text-[#E8CA82]'
                      : 'text-[#381E5A] hover:bg-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#E8CA82]' : 'text-[#C8A053]'}`} />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-5 sm:p-6">
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
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C8A053]" />
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
            <h2 className="font-display text-xl font-bold text-[#381E5A] sm:text-2xl">
              Rekomendasi Paket Lainnya
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={recOffset === 0}
                onClick={() => setRecOffset((v) => Math.max(0, v - 1))}
                aria-label="Rekomendasi sebelumnya"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4DCCB] bg-white text-[#381E5A] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={recOffset >= maxOffset}
                onClick={() => setRecOffset((v) => Math.min(maxOffset, v + 1))}
                aria-label="Rekomendasi berikutnya"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E4DCCB] bg-white text-[#381E5A] hover:bg-[#FAF7F2] disabled:opacity-40 cursor-pointer"
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
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(pkg.id)}
                      aria-label={`Simpan ${pkg.nama_paket}`}
                      className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#381E5A] shadow cursor-pointer"
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
                      <span className="text-[11px] font-medium text-[#0C3328]">
                        {pkg.durasi_hari} Hari
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onOpenDetail(pkg);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#241142] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#381E5A] cursor-pointer"
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
  // PAGE: PAKET LEBARAN (STRICT 2-CATEGORY MODEL: PAKET LEBARAN vs TABUNGAN UANG)
  // =========================================================================
  if (activePage === 'katalog') {
    const isTabunganUang = catalogCategory === 'tabungan_uang';

    return (
      <div className="mx-auto max-w-7xl space-y-7 px-4 py-6 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <section className="grid items-center gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-6">
            <p className="text-xs font-semibold text-[#C8A053]">
              Katalog Resmi 2026–2027 · {COMPANY_INFO.legalName}
            </p>
            <h1 className="font-display text-[clamp(1.75rem,3.8vw,3rem)] leading-tight font-bold text-[#381E5A]">
              {isTabunganUang
                ? 'Tabungan Uang Munggahan & Lebaran'
                : 'Pilih Paket Lebaran Anda'}
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-stone-600">
              {isTabunganUang
                ? 'Menabung uang tunai harian atau mingguan secara ringan selama 295 hari (Munggahan) atau 325 hari (Lebaran) dengan nominal hasil pasti.'
                : 'Tersedia Paket Bunda, Paket Anak, Paket Pilihan Diamond & Sultan, serta 50 Barang Satuan yang bisa dicicil harian atau mingguan.'}
            </p>
            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowBrochuresModal(true)}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-4 py-2 text-xs font-bold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <BookOpen className="h-4 w-4 text-[#C8A053]" />
                <span>Lihat 6 Brosur Resmi</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register_member')}
                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Gabung Member</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="overflow-hidden rounded-t-[100px] sm:rounded-t-[150px] rounded-b-2xl border-2 border-[#C8A053]/60 bg-white shadow-xs">
              <img
                src={isTabunganUang ? IMG_UANG_DAGING : IMG_HERO}
                alt={isTabunganUang ? 'Program Tabungan Uang Sagitarius Parcel' : 'Paket Lebaran Sagitarius Parcel'}
                className="aspect-[16/9] w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </section>

        {/* SIMPLE 2-CATEGORY SWITCHER */}
        <section aria-label="Kategori Pilihan" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onSelectCatalogCategory('paket_lebaran');
              setSatuanSubFilter('Semua Satuan');
            }}
            className={`flex min-h-[72px] items-center gap-4 rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
              !isTabunganUang
                ? 'border-[#0C3328] bg-[#0C3328] text-white shadow-sm'
                : 'border-[#E4DCCB] bg-white text-[#381E5A] hover:border-[#C8A053]'
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                !isTabunganUang ? 'bg-white/15 text-[#E8CA82]' : 'bg-[#FAF7F2] text-[#0C3328]'
              }`}
            >
              <Gift className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-snug">Paket Lebaran</p>
              <p
                className={`mt-0.5 text-xs ${
                  !isTabunganUang ? 'text-stone-200' : 'text-stone-600'
                }`}
              >
                Paket Bunda, Paket Anak, Diamond &amp; Sultan, serta 50 Barang Satuan
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelectCatalogCategory('tabungan_uang')}
            className={`flex min-h-[72px] items-center gap-4 rounded-2xl border-2 p-4 text-left transition cursor-pointer ${
              isTabunganUang
                ? 'border-[#0C3328] bg-[#0C3328] text-white shadow-sm'
                : 'border-[#E4DCCB] bg-white text-[#381E5A] hover:border-[#C8A053]'
            }`}
          >
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                isTabunganUang ? 'bg-white/15 text-[#E8CA82]' : 'bg-[#FAF7F2] text-[#0C3328]'
              }`}
            >
              <Banknote className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-bold leading-snug">Tabungan Uang</p>
              <p
                className={`mt-0.5 text-xs ${
                  isTabunganUang ? 'text-stone-200' : 'text-stone-600'
                }`}
              >
                Dana Tunai Munggahan (295 Hari / 42 Mg) &amp; Lebaran (325 Hari / 45 Mg)
              </p>
            </div>
          </button>
        </section>

        {/* CATEGORY VIEW A: TABUNGAN UANG ONLY */}
        {isTabunganUang ? (
          <div className="space-y-6">
            {/* Agent selection bar for quick Tabungan Uang enrollment */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#E4DCCB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold text-[#381E5A]">
                  Pilih Nominal Langsung dari Tabel atau Kartu Tabungan Uang
                </p>
                <p className="text-xs text-stone-600">
                  Klik salah satu baris nominal pada tabel di bawah untuk langsung mengunci setoran dan mendaftar.
                </p>
              </div>
              <div className="w-full sm:w-72">
                <label className="sr-only" htmlFor="uang-agent-select">
                  Agen Binaan Wilayah
                </label>
                <select
                  id="uang-agent-select"
                  value={selectedAgentId}
                  onChange={(e) => onSelectAgent(e.target.value)}
                  className="min-h-[42px] w-full rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-3 py-2 text-xs font-semibold text-[#381E5A]"
                >
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      Agen: {a.wilayah} — {a.nama}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Tabungan Uang Core Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {tabunganUangPackages.map((pkg) => {
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
                        referrerPolicy="no-referrer"
                      />
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(pkg.id)}
                        aria-label={`Simpan ${pkg.nama_paket}`}
                        className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow cursor-pointer"
                      >
                        <Heart
                          className={`h-4 w-4 ${liked ? 'fill-rose-500 text-rose-500' : 'text-[#B98E3A]'}`}
                        />
                      </button>
                    </div>
                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#C8A053]">
                          {pkg.sub_kategori || 'Tabungan Uang'}
                        </p>
                        <h2 className="mt-0.5 text-base font-bold text-[#381E5A]">
                          {pkg.nama_paket}
                        </h2>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-600">
                          {pkg.deskripsi_singkat || pkg.daftar_isi.slice(0, 2).join(', ')}
                        </p>
                      </div>

                      <div className="mt-3 border-t border-[#F0EAE0] pt-3">
                        <p className="font-mono-nums text-sm font-bold text-[#381E5A]">
                          Cair {formatRupiah(pkg.harga_total)}
                        </p>
                        <p className="font-mono-nums text-[11px] text-stone-500">
                          Setoran {formatRupiah(pkg.setoran_harian)}/hari · {pkg.jadwal_ambil}
                        </p>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenDetail(pkg)}
                            className="min-h-[40px] flex-1 rounded-xl border border-[#E4DCCB] px-3 py-2 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
                          >
                            Detail
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const isWeekly = pkg.id.includes('mingguan');
                              onLockSimulation({
                                packageItem: pkg,
                                durasiMinggu: Math.max(12, Math.round(pkg.durasi_hari / 7)),
                                frekuensi: isWeekly ? 'mingguan' : 'harian',
                                estimasiSetoran: isWeekly
                                  ? pkg.setoran_mingguan
                                  : pkg.setoran_harian,
                                selectedAgentId: selectedAgentId || agents[0]?.id,
                              });
                            }}
                            className="min-h-[40px] flex-1 rounded-xl bg-[#0C3328] px-3 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                          >
                            Pilih Paket
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Interactive Lookup Tables for Paket Uang Munggahan & Lebaran */}
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
                <h3 className="font-display text-lg font-bold text-[#381E5A]">
                  Tabel Tabungan Uang Munggahan (295 Hari &amp; 42 Minggu)
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Klik baris nominal untuk langsung memilih paket &amp; mendaftar.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="mb-1.5 font-semibold text-stone-700">Harian (295 Hari)</p>
                    <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB] overflow-hidden">
                      {PAKET_UANG_TABLES.munggahanHarian295.map((r) => (
                        <button
                          key={r.setoran}
                          type="button"
                          onClick={() =>
                            handleSelectUangNominal(
                              'Tabungan Uang Munggahan',
                              'harian',
                              r.setoran,
                              r.hasil,
                              295,
                              42,
                              'Lebih Awal (Menjelang Munggahan)'
                            )
                          }
                          className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-left font-mono-nums transition hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <span className="text-stone-700">{formatRupiah(r.setoran)}/hr</span>
                          <span className="font-bold text-[#0C3328]">
                            {formatRupiah(r.hasil)} →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-semibold text-stone-700">Mingguan (42 Minggu)</p>
                    <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB] overflow-hidden">
                      {PAKET_UANG_TABLES.munggahanMingguan42.map((r) => (
                        <button
                          key={r.setoran}
                          type="button"
                          onClick={() =>
                            handleSelectUangNominal(
                              'Tabungan Uang Munggahan',
                              'mingguan',
                              r.setoran,
                              r.hasil,
                              294,
                              42,
                              'Lebih Awal (Menjelang Munggahan)'
                            )
                          }
                          className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-left font-mono-nums transition hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <span className="text-stone-700">{formatRupiah(r.setoran)}/mg</span>
                          <span className="font-bold text-[#0C3328]">
                            {formatRupiah(r.hasil)} →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
                <h3 className="font-display text-lg font-bold text-[#381E5A]">
                  Tabel Tabungan Uang Lebaran (325 Hari &amp; 45 Minggu)
                </h3>
                <p className="mt-1 text-xs text-stone-500">
                  Klik baris nominal untuk langsung memilih paket &amp; mendaftar.
                </p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="mb-1.5 font-semibold text-stone-700">Harian (325 Hari)</p>
                    <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB] overflow-hidden">
                      {PAKET_UANG_TABLES.lebaranHarian325.map((r) => (
                        <button
                          key={r.setoran}
                          type="button"
                          onClick={() =>
                            handleSelectUangNominal(
                              'Tabungan Uang Lebaran',
                              'harian',
                              r.setoran,
                              r.hasil,
                              325,
                              45,
                              'Lebih Awal (Sebelum Lebaran)'
                            )
                          }
                          className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-left font-mono-nums transition hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <span className="text-stone-700">{formatRupiah(r.setoran)}/hr</span>
                          <span className="font-bold text-[#0C3328]">
                            {formatRupiah(r.hasil)} →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 font-semibold text-stone-700">Mingguan (45 Minggu)</p>
                    <div className="divide-y divide-[#F0EAE0] rounded-xl border border-[#E4DCCB] overflow-hidden">
                      {PAKET_UANG_TABLES.lebaranMingguan45.map((r) => (
                        <button
                          key={r.setoran}
                          type="button"
                          onClick={() =>
                            handleSelectUangNominal(
                              'Tabungan Uang Lebaran',
                              'mingguan',
                              r.setoran,
                              r.hasil,
                              315,
                              45,
                              'Lebih Awal (Sebelum Lebaran)'
                            )
                          }
                          className="flex min-h-[38px] w-full items-center justify-between px-3 py-2 text-left font-mono-nums transition hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <span className="text-stone-700">{formatRupiah(r.setoran)}/mg</span>
                          <span className="font-bold text-[#0C3328]">
                            {formatRupiah(r.hasil)} →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CATEGORY VIEW B: PAKET LEBARAN ONLY (Bunda, Anak, Diamond/Sultan, 50 Satuan) */
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari paket lebaran, isi (misal: beras, khong guan, daging, koper)..."
                  className="min-h-[46px] w-full rounded-xl border border-[#E4DCCB] bg-white py-3 pr-10 pl-11 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#381E5A] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1.5 text-stone-400 hover:bg-stone-100 cursor-pointer"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Jenis Paket Lebaran Filter Tabs + Price & Sort */}
              <div className="flex flex-wrap gap-2">
                {PAKET_LEBARAN_SUBFILTERS.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      setLebaranSubCategory(sub.id);
                      if (sub.id !== 'satuan') setSatuanSubFilter('Semua Satuan');
                    }}
                    className={`min-h-[40px] rounded-xl px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
                      lebaranSubCategory === sub.id
                        ? 'bg-[#381E5A] text-[#E8CA82]'
                        : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <select
                    value={priceRange}
                    onChange={(e) =>
                      setPriceRange(e.target.value as (typeof PRICE_RANGE_OPTIONS)[number]['id'])
                    }
                    aria-label="Filter rentang harga"
                    className="min-h-[42px] w-full appearance-none rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 pr-9 text-xs font-semibold text-[#381E5A] focus:border-[#381E5A] focus:outline-none"
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
                    className="min-h-[42px] w-full appearance-none rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 pr-9 text-xs font-semibold text-[#381E5A] focus:border-[#381E5A] focus:outline-none"
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

              {(lebaranSubCategory === 'satuan' || lebaranSubCategory === 'all_lebaran') && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="font-semibold text-stone-500">Filter Satuan:</span>
                  {SATUAN_SUBFILTERS.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => {
                        setSatuanSubFilter(sub);
                        if (sub !== 'Semua Satuan') setLebaranSubCategory('satuan');
                      }}
                      className={`min-h-[36px] rounded-lg px-3 py-1.5 font-semibold transition cursor-pointer ${
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

            {/* Product Grid */}
            {displayedLebaranPackages.length === 0 ? (
              <div className="rounded-2xl border border-[#E4DCCB] bg-white p-10 text-center">
                <PackageIcon className="mx-auto h-10 w-10 text-stone-400" />
                <p className="mt-3 text-sm font-semibold text-[#381E5A]">
                  Tidak ada paket yang sesuai dengan filter Anda.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setLebaranSubCategory('all_lebaran');
                    setPriceRange('all');
                    setSatuanSubFilter('Semua Satuan');
                  }}
                  className="mt-4 min-h-[42px] rounded-xl border border-[#E4DCCB] px-5 py-2 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
                >
                  Reset Filter Katalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {displayedLebaranPackages.map((pkg) => {
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
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={() => onToggleWishlist(pkg.id)}
                          aria-label={`Simpan ${pkg.nama_paket} ke daftar pilihan`}
                          className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow transition hover:scale-105 cursor-pointer"
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
                            <span className="text-xs font-medium text-[#0C3328]">
                              {pkg.durasi_hari} Hari
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenDetail(pkg);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-[#241142] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#381E5A] cursor-pointer"
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

                {/* Action Card at end of grid */}
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D5CBB8] bg-[#FAF7F2] p-6 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#381E5A]/10 text-[#381E5A]">
                    <ShoppingBag className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 text-sm font-bold text-[#381E5A]">
                    {lebaranSubCategory === 'all_lebaran' && !showAllSatuan
                      ? 'Lihat 50 Barang Satuan Lengkap'
                      : 'Cek Brosur Cetak Resmi'}
                  </h3>
                  <p className="mt-1 text-xs text-stone-600">
                    {lebaranSubCategory === 'all_lebaran' && !showAllSatuan
                      ? 'Beras, Minyak, Daging Sapi, Ayam, dan Telur H-2 mulai Rp 100/hari.'
                      : 'Bandingkan seluruh varian langsung dari brosur resmi 2026–2027.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (lebaranSubCategory === 'all_lebaran' && !showAllSatuan) {
                        setLebaranSubCategory('satuan');
                        setShowAllSatuan(true);
                      } else {
                        setShowBrochuresModal(true);
                      }
                    }}
                    className="mt-4 min-h-[40px] rounded-xl bg-[#0C3328] px-4 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                  >
                    {lebaranSubCategory === 'all_lebaran' && !showAllSatuan
                      ? 'Muat 50 Barang Satuan'
                      : 'Buka Galeri Brosur'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {renderBrochuresModal()}
      </div>
    );
  }

  // =========================================================================
  // PAGE: BERANDA
  // =========================================================================
  const featuredHighlight = packages
    .filter((p) => p.kategori !== 'satuan' && p.kategori !== 'uang')
    .slice(0, 4);

  return (
    <div className="space-y-10 pb-12 sm:space-y-12 sm:pb-16">
      {referralAgent && (
        <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#C8A053]/60 bg-gradient-to-r from-[#0C3328] to-[#164A3B] px-4 py-3.5 text-white shadow-sm sm:flex-row sm:items-center sm:px-5">
            <div className="flex items-start gap-3 sm:items-center">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#E8CA82] sm:mt-0" />
              <div className="text-xs">
                <p className="font-bold text-[#E8CA82]">
                  Tautan Pendaftaran Resmi Agen ({referralAgent.kode_agen})
                </p>
                <p className="text-stone-200">
                  Pendamping Anda: <strong>{referralAgent.nama}</strong> — Wilayah{' '}
                  {referralAgent.wilayah} ({referralAgent.kecamatan}). Agen otomatis terpilih saat Anda mendaftar paket.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openMainCategory('paket_lebaran')}
              className="min-h-[40px] shrink-0 rounded-lg bg-[#E8CA82] px-4 py-2 text-xs font-bold text-[#1D122B] hover:brightness-105 cursor-pointer"
            >
              Pilih Paket Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Split Hero Section with Gabung Member & Gabung Agen CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:pt-7 lg:px-8">
        <div className="grid items-center gap-7 lg:grid-cols-12 lg:gap-10">
          <div className="space-y-4 sm:space-y-5 lg:col-span-6">
            <p className="text-xs font-semibold text-[#C8A053]">
              {COMPANY_INFO.legalName} · {COMPANY_INFO.tagline}
            </p>
            <h1
              className="font-display text-[clamp(1.85rem,4.2vw,3.2rem)] leading-[1.12] font-bold text-[#381E5A]"
              style={{ textWrap: 'balance' }}
            >
              Sambut Lebaran dengan Bingkisan Bermakna
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-stone-600 sm:text-base">
              Persiapkan Paket Lebaran atau Tabungan Uang untuk keluarga Anda dengan cicilan ringan mulai Rp 100–Rp 10.000/hari selama 295–325 hari lengkap dengan bonus THR &amp; kupon Door Prize.
            </p>

            {/* Primary Onboarding Buttons for Non-Technical Visitors */}
            <div className="grid grid-cols-1 gap-2.5 pt-1 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth('register_member')}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#0C3328] px-5 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#144738] sm:w-auto cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-[#E8CA82]" />
                <span>Gabung Member</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register_agent')}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D5B263] to-[#B98E3A] px-5 py-3 text-sm font-bold text-[#1D122B] shadow-xs transition hover:brightness-105 sm:w-auto cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                <span>Gabung Agen</span>
              </button>
              <button
                type="button"
                onClick={() => openMainCategory('paket_lebaran')}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#C8A053] bg-white px-5 py-3 text-sm font-semibold text-[#381E5A] transition hover:bg-[#FAF7F2] sm:w-auto cursor-pointer"
              >
                <span>Pilih Paket</span>
                <ArrowRight className="h-4 w-4 text-[#0C3328]" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="relative overflow-hidden rounded-tl-[100px] sm:rounded-tl-[150px] rounded-tr-2xl rounded-b-2xl border-2 border-[#C8A053]/60 bg-white shadow-sm">
              <img
                src={IMG_HERO}
                alt="Bingkisan Parcel Lebaran Sagitarius Parcel"
                className="aspect-[16/10] w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setShowBrochuresModal(true)}
                className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#C8A053]/70 bg-[#0C3328]/90 px-3.5 py-2 text-xs font-semibold text-[#E8CA82] backdrop-blur-xs hover:bg-[#0C3328] cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Lihat Brosur Cetak</span>
              </button>
            </div>
          </div>
        </div>

        {/* 2 Simple Category Entry Cards */}
        <div className="mt-8 grid gap-4 md:grid-cols-2 md:gap-5">
          <button
            type="button"
            onClick={() => openMainCategory('paket_lebaran')}
            className="group flex items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C8A053] hover:shadow-md cursor-pointer"
          >
            <img
              src={IMG_BUNDA_BOX}
              alt="Paket Lebaran"
              className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-28"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-[#381E5A] sm:text-xl">
                Paket Lebaran
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Paket Bunda (Travel Bag, Box &amp; Koper), Paket Anak, Diamond &amp; Sultan, serta 50 Barang Satuan.
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => openMainCategory('tabungan_uang')}
            className="group flex items-center gap-4 rounded-2xl border border-[#E4DCCB] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#C8A053] hover:shadow-md cursor-pointer"
          >
            <img
              src={IMG_UANG_DAGING}
              alt="Tabungan Uang"
              className="h-20 w-24 shrink-0 rounded-xl object-cover sm:h-24 sm:w-28"
              referrerPolicy="no-referrer"
            />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-[#381E5A] sm:text-xl">
                Tabungan Uang
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Tabungan Uang Munggahan (295 Hari / 42 Minggu) &amp; Lebaran (325 Hari / 45 Minggu) harian atau mingguan.
              </p>
            </div>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D5B263] to-[#B98E3A] text-white transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        {/* Simple 3-Step Guide Strip inline on Beranda */}
        <div className="mt-6 bg-arabesque-emerald rounded-2xl border border-[#C8A053]/40 p-5 text-white sm:p-6">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 text-[#E8CA82]">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-[#E8CA82]">1. Pilih Paket / Tabungan</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-200">
                  Pilih kategori Paket Lebaran atau Tabungan Uang sesuai kebutuhan keluarga.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 text-[#E8CA82]">
                <UserPlus className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-[#E8CA82]">2. Daftar Member / Agen</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-200">
                  Klik Gabung Member untuk menabung atau Gabung Agen untuk menjadi mitra resmi.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#C8A053]/60 text-[#E8CA82]">
                <QrCode className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-[#E8CA82]">3. Setor &amp; Ambil Pakai QR</p>
                <p className="mt-0.5 text-xs leading-relaxed text-stone-200">
                  Pantau saldo real-time di dashboard hingga terbit Tiket QR pengambilan paket.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Program Reseller & Mitra Agen Resmi */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-6 overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white p-5 sm:p-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-[#E4DCCB]">
              <img
                src={IMG_RESELLER}
                alt="Program Reseller & Mitra Agen Sagitarius Parcel"
                className="aspect-[16/10] w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <div className="space-y-4 lg:col-span-7">
            <p className="text-xs font-semibold text-[#C8A053]">
              Kemitraan Priangan Timur · Tanpa Modal Stok Barang
            </p>
            <h2 className="font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
              {RESELLER_PROGRAM.headline}
            </h2>
            <p className="text-xs leading-relaxed text-stone-600 sm:text-sm">
              {RESELLER_PROGRAM.subheadline}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {RESELLER_PROGRAM.tiers.map((tier) => (
                <div
                  key={tier.label}
                  className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5"
                >
                  <p className="text-xs font-bold text-[#381E5A]">{tier.label}</p>
                  <p className="mt-1 font-mono-nums text-xl font-bold text-[#0C3328]">
                    Komisi {tier.komisi}
                  </p>
                  <p className="text-[11px] font-medium text-[#B98E3A]">{tier.syarat}</p>
                  <p className="mt-1 text-[11px] leading-snug text-stone-600">{tier.detail}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onOpenAuth('register_agent')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0C3328] px-5 py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
              >
                <UserCheck className="h-4 w-4" />
                <span>Gabung Agen Sekarang</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('register_member')}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#C8A053] bg-white px-5 py-2.5 text-xs font-bold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <UserPlus className="h-4 w-4 text-[#0C3328]" />
                <span>Gabung Member</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('tentang')}
                className="inline-flex min-h-[44px] items-center gap-1.5 px-2 text-xs font-semibold text-[#381E5A] underline hover:text-[#C8A053] cursor-pointer"
              >
                <span>Lihat Direktori Agen</span>
                <ArrowRight className="h-3.5 w-3.5" />
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
            onClick={() => openMainCategory('paket_lebaran')}
            className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-bold text-[#381E5A] hover:text-[#C8A053] cursor-pointer"
          >
            <span>Lihat Semua Paket Lebaran</span>
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
                    referrerPolicy="no-referrer"
                  />
                  <button
                    type="button"
                    onClick={() => onToggleWishlist(pkg.id)}
                    aria-label={`Simpan ${pkg.nama_paket}`}
                    className="absolute top-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow cursor-pointer"
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
                    <span className="text-[11px] font-medium text-[#0C3328]">
                      {pkg.durasi_hari} Hari
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onOpenDetail(pkg);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-[#241142] px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#381E5A] cursor-pointer"
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
