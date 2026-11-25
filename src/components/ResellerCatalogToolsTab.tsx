import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Eye,
  MessageCircle,
  Package as PackageIcon,
  Search,
  UserPlus,
} from 'lucide-react';
import {
  BROCHURE_ANAK,
  BROCHURE_BUNDA,
  BROCHURE_PILIHAN,
  BROCHURE_SATUAN,
  BROCHURE_UANG,
  IMG_RESELLER_POSTER,
  formatRupiah,
} from '../data/catalogData';
import { PackageCategory, ParcelPackage } from '../types';

interface ResellerCatalogToolsTabProps {
  packages: ParcelPackage[];
  agentCode: string;
  onRegisterMemberWithPackage: (pkgId: string) => void;
  onPreviewImage: (src: string) => void;
}

const CATEGORY_FILTERS: Array<{ id: 'all' | PackageCategory; label: string }> = [
  { id: 'all', label: 'Semua Paket' },
  { id: 'bunda', label: 'Paket Bunda' },
  { id: 'anak', label: 'Paket Anak' },
  { id: 'pilihan', label: 'Paket Pilihan' },
  { id: 'uang', label: 'Tabungan Uang' },
  { id: 'satuan', label: 'Barang Satuan' },
];

const BROCHURE_GALLERY = [
  { id: 'bunda', title: 'Brosur Paket Bunda', image: BROCHURE_BUNDA },
  { id: 'anak', title: 'Brosur Paket Anak', image: BROCHURE_ANAK },
  { id: 'pilihan', title: 'Brosur Paket Pilihan', image: BROCHURE_PILIHAN },
  { id: 'uang', title: 'Brosur Tabungan Uang', image: BROCHURE_UANG },
  { id: 'satuan', title: 'Brosur 50 Barang Satuan', image: BROCHURE_SATUAN },
  { id: 'reseller', title: 'Tabel Komisi Reseller', image: IMG_RESELLER_POSTER },
];

function getResellerCommissionEstimate(pkg: ParcelPackage): number {
  if (pkg.kategori === 'anak') return 50000;
  if (pkg.kategori === 'bunda') return 60000;
  if (pkg.kategori === 'pilihan') return 75000;
  return Math.round(pkg.harga_total * 0.04);
}

export const ResellerCatalogToolsTab: React.FC<ResellerCatalogToolsTabProps> = ({
  packages,
  agentCode,
  onRegisterMemberWithPackage,
  onPreviewImage,
}) => {
  const [catFilter, setCatFilter] = useState<'all' | PackageCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [calcPkgId, setCalcPkgId] = useState<string>(packages[0]?.id || '');
  const [calcFrek, setCalcFrek] = useState<'harian' | 'mingguan'>('harian');
  const [calcMinggu, setCalcMinggu] = useState<number>(46);

  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://www.sagitariusparcel.web.id';
  const referralUrl = `${origin}/?agen=${encodeURIComponent(agentCode)}`;

  const selectedCalcPkg = useMemo(
    () => packages.find((p) => p.id === calcPkgId) || packages[0] || null,
    [packages, calcPkgId]
  );

  const calcResult = useMemo(() => {
    if (!selectedCalcPkg) return null;
    const totalPeriods = calcFrek === 'harian' ? calcMinggu * 7 : calcMinggu;
    const installment = Math.max(
      500,
      Math.ceil(selectedCalcPkg.harga_total / Math.max(1, totalPeriods) / 500) * 500
    );
    const estCommission = getResellerCommissionEstimate(selectedCalcPkg);
    return {
      totalPeriods,
      installment,
      estCommission,
    };
  }, [selectedCalcPkg, calcFrek, calcMinggu]);

  const filteredPackages = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return packages.filter((p) => {
      if (catFilter !== 'all' && p.kategori !== catFilter) return false;
      if (!q) return true;
      return `${p.nama_paket} ${p.kategori} ${p.daftar_isi.join(' ')}`
        .toLowerCase()
        .includes(q);
    });
  }, [packages, catFilter, searchTerm]);

  const buildShareWaHref = (pkg: ParcelPackage, customInstallment?: number, customFrek?: 'harian' | 'mingguan') => {
    const freqLabel = customFrek || 'harian';
    const nominal = customInstallment ?? pkg.setoran_harian;
    const text = `Assalamu'alaikum, yuk ikut tabungan *${pkg.nama_paket}* Sagitarius Parcel!\n• Cicilan ringan: ${formatRupiah(
      nominal
    )}/${freqLabel}\n• Total target: ${formatRupiah(pkg.harga_total)}${
      pkg.bonus_thr > 0 ? ` + Bonus THR ${formatRupiah(pkg.bonus_thr)}` : ''
    }\n• Pengambilan: ${pkg.jadwal_ambil}\n\nDaftar langsung lewat link resmi saya (${agentCode}): ${referralUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-5">
      {/* Interactive Target & Commission Simulator */}
      {selectedCalcPkg && calcResult && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <Calculator className="h-5 w-5 text-[#0C3328]" />
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Kalkulator Cicilan &amp; Penawaran Member
                </h2>
                <p className="text-xs text-stone-600">
                  Hitung simulasi setoran untuk ditunjukkan ke calon member, lalu bagikan via WhatsApp atau langsung daftarkan.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={buildShareWaHref(selectedCalcPkg, calcResult.installment, calcFrek)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#15803D] whitespace-nowrap shrink-0"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Kirim Penawaran WA</span>
              </a>
              <button
                type="button"
                onClick={() => onRegisterMemberWithPackage(selectedCalcPkg.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-3.5 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Daftarkan Paket Ini</span>
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <div className="grid gap-3 sm:grid-cols-3 lg:col-span-7">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Pilih Paket</label>
                <select
                  value={selectedCalcPkg.id}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setCalcPkgId(nextId);
                    const found = packages.find((p) => p.id === nextId);
                    if (found) {
                      setCalcMinggu(
                        Math.min(60, Math.max(12, Math.round(found.durasi_hari / 7)))
                      );
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_paket} ({formatRupiah(p.harga_total)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Pola Setoran</label>
                <select
                  value={calcFrek}
                  onChange={(e) => setCalcFrek(e.target.value as 'harian' | 'mingguan')}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900"
                >
                  <option value="harian">Harian (Setiap Hari)</option>
                  <option value="mingguan">Mingguan (Jemput Bola)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Tenor ({calcMinggu} Minggu / {calcMinggu * 7} Hari)
                </label>
                <input
                  type="range"
                  min={12}
                  max={52}
                  value={calcMinggu}
                  onChange={(e) => setCalcMinggu(Number(e.target.value))}
                  className="mt-3 w-full accent-[#0C3328] cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 divide-x divide-stone-200 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] lg:col-span-5">
              <div className="p-3">
                <p className="text-[11px] text-stone-500">Setoran/{calcFrek}</p>
                <p className="mt-0.5 font-mono-nums text-sm font-bold text-[#0C3328]">
                  {formatRupiah(calcResult.installment)}
                </p>
                <p className="font-mono-nums text-[10px] text-stone-500">
                  {calcResult.totalPeriods}x bayar
                </p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-stone-500">Target Paket</p>
                <p className="mt-0.5 font-mono-nums text-sm font-bold text-[#381E5A]">
                  {formatRupiah(selectedCalcPkg.harga_total)}
                </p>
                <p className="font-mono-nums text-[10px] text-stone-500">
                  THR: {selectedCalcPkg.bonus_thr > 0 ? formatRupiah(selectedCalcPkg.bonus_thr) : '-'}
                </p>
              </div>
              <div className="p-3">
                <p className="text-[11px] text-stone-500">Komisi Anda</p>
                <p className="mt-0.5 font-mono-nums text-sm font-bold text-emerald-900">
                  {formatRupiah(calcResult.estCommission)}
                </p>
                <p className="text-[10px] text-stone-500">per paket</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Digital Brochures (Full-Screen Zoom for Field Presentation) */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
          <div>
            <h3 className="font-display text-base font-bold text-stone-900">
              Galeri Brosur Resmi Sagitarius Parcel
            </h3>
            <p className="text-xs text-stone-600">
              Ketuk gambar brosur untuk memperbesar di layar HP saat menjelaskan isi paket ke calon member.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {BROCHURE_GALLERY.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onPreviewImage(item.image)}
              className="group overflow-hidden rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-2 text-left transition hover:border-[#0C3328] cursor-pointer"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg bg-white">
                <img
                  src={item.image}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <p className="mt-1.5 flex items-center justify-between gap-1 text-[11px] font-semibold text-[#381E5A]">
                <span className="truncate">{item.title}</span>
                <Eye className="h-3 w-3 shrink-0 text-stone-400" />
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Filterable Catalog List */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5 text-[#0C3328]" />
            <div>
              <h2 className="font-display text-lg font-bold text-stone-900">
                Daftar Lengkap Paket Katalog ({filteredPackages.length})
              </h2>
              <p className="text-xs text-stone-600">
                Rincian harga harian/mingguan, daftar isi barang, dan tombol bagikan langsung ke calon member.
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama paket atau isi..."
              className="w-full rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs text-stone-900"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_FILTERS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCatFilter(cat.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap shrink-0 cursor-pointer ${
                catFilter === cat.id
                  ? 'bg-[#0C3328] text-[#E8CA82]'
                  : 'border border-stone-200 bg-[#FAF7F2] text-stone-700 hover:bg-stone-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filteredPackages.length === 0 ? (
          <p className="rounded-xl bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
            Tidak ada paket yang cocok dengan kata kunci atau kategori yang dipilih.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPackages.map((pkg) => {
              const estComm = getResellerCommissionEstimate(pkg);
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col justify-between rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 space-y-3"
                >
                  <div className="space-y-2.5">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => onPreviewImage(pkg.foto_url)}
                        className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#E4DCCB] bg-white p-1 cursor-pointer"
                        title="Klik untuk memperbesar gambar paket"
                      >
                        <img
                          src={pkg.foto_url}
                          alt={pkg.nama_paket}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                        />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium text-stone-500">
                          {pkg.kategori.toUpperCase()} · {pkg.durasi_hari} Hari
                        </p>
                        <h3 className="truncate font-display text-base font-bold text-[#381E5A]">
                          {pkg.nama_paket}
                        </h3>
                        <p className="font-mono-nums text-sm font-bold text-[#0C3328]">
                          {formatRupiah(pkg.setoran_harian)}/hr{' '}
                          <span className="text-[11px] font-normal text-stone-500">
                            ({formatRupiah(pkg.setoran_mingguan)}/mgg)
                          </span>
                        </p>
                        <p className="font-mono-nums text-[11px] text-stone-600">
                          Total: {formatRupiah(pkg.harga_total)}
                          {pkg.bonus_thr > 0 ? ` · THR ${formatRupiah(pkg.bonus_thr)}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#E4DCCB] bg-white p-2.5 text-[11px] text-stone-700">
                      <p className="font-semibold text-stone-800">
                        Isi Paket ({pkg.daftar_isi.length} item) · Komisi Est.{' '}
                        <span className="font-mono-nums text-[#0C3328]">
                          {formatRupiah(estComm)}
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-3 leading-relaxed text-stone-600">
                        {pkg.daftar_isi.join(', ')}
                      </p>
                      <p className="mt-1 text-[10px] text-stone-500">
                        Jadwal: {pkg.jadwal_ambil}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <a
                      href={buildShareWaHref(pkg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-[#E4DCCB] bg-white px-2.5 py-2 text-[11px] font-semibold text-[#15803D] hover:bg-emerald-50"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Bagikan WA</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => onRegisterMemberWithPackage(pkg.id)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#0C3328] px-2.5 py-2 text-[11px] font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Daftarkan</span>
                    </button>
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
