import { AgentDirectoryItem, ParcelPackage } from '../types';

export const IMG_HERO = '/src/assets/images/hero_lebaran_parcel_1795079090213.jpg';
export const IMG_BUNDA = '/src/assets/images/paket_bunda_sembako_1795079090089.jpg';
export const IMG_BUNDA_BOX = '/src/assets/images/paket_bunda_box_silver_gold_1795598009338.jpg';
export const IMG_BUNDA_KOPER = '/src/assets/images/paket_bunda_koper_platinum_1795598010326.jpg';
export const IMG_ANAK = '/src/assets/images/paket_anak_lebaran_1795079090980.jpg';
export const IMG_ANAK_KOPER = '/src/assets/images/paket_anak_koper_ceria_1795598010163.jpg';
export const IMG_DIAMOND_MUKENA = '/src/assets/images/paket_diamond_mukena_1795598011067.jpg';
export const IMG_SULTAN = '/src/assets/images/paket_sultan_diamond_1795079089961.jpg';
export const IMG_UANG_DAGING = '/src/assets/images/paket_uang_daging_1795079090348.jpg';
export const IMG_RESELLER = '/src/assets/images/reseller_mitra_agen_1795598011859.jpg';

// Official Sagitarius Parcel Assets uploaded by user
export const LOGO_SAGITARIUS = '/assets/aistudio/file_00000000ca58820ba2ac5348f000d329_d1d25037.png';
export const BROCHURE_COVER = '/assets/aistudio/Screenshot_20261022_113919_baf772c1.jpg';
export const BROCHURE_BUNDA = '/assets/aistudio/Screenshot_20261022_113929_75f3ccaa.jpg';
export const BROCHURE_ANAK = '/assets/aistudio/Screenshot_20261022_113924_ef1753aa.jpg';
export const BROCHURE_PILIHAN = '/assets/aistudio/Screenshot_20261022_113934_78453c2e.jpg';
export const BROCHURE_UANG = '/assets/aistudio/Screenshot_20261022_113906_7abaaaea.jpg';
export const BROCHURE_SATUAN = '/assets/aistudio/Screenshot_20261022_113857_3eccd7c1.jpg';

export const RESELLER_PROGRAM = {
  headline: 'Program Reseller & Mitra Agen Resmi Sagitarius Parcel',
  subheadline:
    'Buka peluang penghasilan jelang Ramadhan & Idul Fitri bersama PT. Sagitarius Trinunggal Karya di wilayah Priangan Timur.',
  tiers: [
    {
      label: 'Agen Pemula',
      syarat: '< 10 Member Aktif',
      komisi: '4%',
      detail: 'Tautan referral pribadi & pencatatan setoran digital.',
    },
    {
      label: 'Agen Aktif',
      syarat: '10 – 24 Member Aktif',
      komisi: '5,5%',
      detail: 'Bonus kenaikan tier & prioritas alokasi paket wilayah.',
    },
    {
      label: 'Agen Prioritas',
      syarat: '≥ 25 Member Aktif',
      komisi: '7%',
      detail: 'Komisi maksimal + dukungan penuh Korwil & Pusat.',
    },
  ],
  benefits: [
    'Tanpa stok barang di rumah — cukup kelola pendaftaran dan setoran member via aplikasi.',
    'Tautan undangan member otomatis (kode agen terhubung langsung saat member mendaftar).',
    'Laporan komisi, kwitansi digital, dan pengajuan pencairan transparan langsung di Dashboard.',
  ],
};

export const COMPANY_INFO = {
  legalName: 'PT. SAGITARIUS TRINUNGGAL KARYA',
  brandName: 'Sagitarius Parcel',
  tagline: 'Our Eid, Our Happiness',
  address:
    'Bantar Peundeuy RT. 006 RW. 001, Margajaya, Mangunreja, Kab. Tasikmalaya, Jawa Barat 46462',
  csWhatsappDisplay: '0813 2438 3479',
  csWhatsappDigits: '6281324383479',
  website: 'www.sagitariusparcel.web.id',
  terms: [
    'Pembayaran dilakukan selama 325 hari (295 hari / 42 minggu untuk Uang Munggahan; 325 hari / 45 minggu untuk Uang Lebaran).',
    'Paket Uang dibagikan lebih awal, Paket Barang selambatnya 15 Ramadhan.',
    'Paket Satuan Daging & Telur dibagikan pada H-2 Idul Fitri.',
    'Jika terdapat kelangkaan/kenaikan harga signifikan pada produk tertentu, akan diganti produk dengan harga setara.',
    'Paket uang tidak dapat diambil sebelum waktu pembagian yang telah ditentukan.',
    'Paket satuan barang tidak bisa diuangkan; jika anggota tidak menyelesaikan pembayaran penuh, diberikan barang sejumlah nominal masuk (biaya administrasi tetap sama).',
    'Setiap Member yang memenuhi syarat pembayaran berhak mendapatkan kupon Door Prize yang diundi LIVE di akun sosial Sagitarius Parcel.',
  ],
};

export const BOOTSTRAPPED_ADMIN_EMAIL = 'akun310786@gmail.com';

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('62')
      ? digits
      : `62${digits}`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(text)}`;
}

export const HERO_SLIDES = [
  {
    id: 'slide-1',
    kicker: 'Katalog 2026–2027 · PT. Sagitarius Trinunggal Karya',
    title: 'Paket Lebaran Sagitarius Parcel — Our Eid, Our Happiness',
    subtitle:
      'Menabung ringan selama 325 hari untuk Paket Bunda, Paket Anak, Paket Pilihan Diamond & Sultan, Paket Uang, dan 50 Barang Satuan.',
    image: BROCHURE_COVER,
    ctaLabel: 'Lihat Katalog Lengkap',
    targetCategory: 'all' as const,
  },
  {
    id: 'slide-2',
    kicker: 'Paket Bunda · Reguler, Silver, Gold & Platinum',
    title: 'Mulai Rp 2.000/Hari Lengkap dengan Travel Bag, Box & Koper + THR',
    subtitle:
      'Dilengkapi sembako utama, kue kering Khong Guan & Monde Butter Cookies, minuman sirup, serta bonus THR tunai hingga Rp 800.000.',
    image: BROCHURE_BUNDA,
    ctaLabel: 'Lihat Paket Bunda',
    targetCategory: 'bunda' as const,
  },
  {
    id: 'slide-3',
    kicker: 'Paket Pilihan Diamond & Sultan · Kupon Door Prize',
    title: 'THR Tunai Hingga Rp 2.000.000 + Kesempatan Door Prize Menarik',
    subtitle:
      'Setiap member berhak mendapatkan kupon undian HP Android, Rice Cooker, Kompor Gas, Kipas Angin, dan hadiah menarik lainnya.',
    image: BROCHURE_PILIHAN,
    ctaLabel: 'Lihat Diamond & Sultan',
    targetCategory: 'pilihan' as const,
  },
  {
    id: 'slide-4',
    kicker: 'Paket Uang Munggahan & Lebaran + 50 Barang Satuan',
    title: 'Tabungan Tunai 295/325 Hari & 50 Sembako Satuan Mulai Rp 100/Hari',
    subtitle:
      'Tersedia setoran harian & mingguan (42/45 minggu) serta daging sapi, iga, ayam & telur segar yang dibagikan H-2 Idul Fitri.',
    image: BROCHURE_UANG,
    ctaLabel: 'Lihat Paket Uang',
    targetCategory: 'uang' as const,
  },
];

// Paket Uang Lookup Tables (exact brochure numbers)
export const PAKET_UANG_TABLES = {
  munggahanHarian295: [
    { setoran: 1000, hasil: 265000 },
    { setoran: 2000, hasil: 550000 },
    { setoran: 3000, hasil: 835000 },
    { setoran: 4000, hasil: 1120000 },
    { setoran: 5000, hasil: 1405000 },
    { setoran: 6000, hasil: 1690000 },
    { setoran: 7000, hasil: 1975000 },
    { setoran: 8000, hasil: 2260000 },
    { setoran: 9000, hasil: 2545000 },
    { setoran: 10000, hasil: 2830000 },
    { setoran: 15000, hasil: 4255000 },
    { setoran: 20000, hasil: 5680000 },
  ],
  munggahanMingguan42: [
    { setoran: 20000, hasil: 800000 },
    { setoran: 30000, hasil: 1200000 },
    { setoran: 40000, hasil: 1600000 },
    { setoran: 50000, hasil: 2000000 },
    { setoran: 60000, hasil: 2400000 },
    { setoran: 70000, hasil: 2800000 },
    { setoran: 80000, hasil: 3200000 },
    { setoran: 90000, hasil: 3600000 },
    { setoran: 100000, hasil: 4000000 },
    { setoran: 150000, hasil: 6000000 },
    { setoran: 200000, hasil: 8000000 },
  ],
  lebaranHarian325: [
    { setoran: 5000, hasil: 1550000 },
    { setoran: 6000, hasil: 1865000 },
    { setoran: 7000, hasil: 2180000 },
    { setoran: 8000, hasil: 2495000 },
    { setoran: 9000, hasil: 2810000 },
    { setoran: 10000, hasil: 3125000 },
    { setoran: 15000, hasil: 4700000 },
    { setoran: 20000, hasil: 6275000 },
  ],
  lebaranMingguan45: [
    { setoran: 20000, hasil: 860000 },
    { setoran: 30000, hasil: 1290000 },
    { setoran: 40000, hasil: 1720000 },
    { setoran: 50000, hasil: 2150000 },
    { setoran: 60000, hasil: 2580000 },
    { setoran: 70000, hasil: 3010000 },
    { setoran: 80000, hasil: 3440000 },
    { setoran: 90000, hasil: 3870000 },
    { setoran: 100000, hasil: 4300000 },
    { setoran: 150000, hasil: 6450000 },
    { setoran: 200000, hasil: 8600000 },
  ],
};

// Exact packages matching the uploaded brochures
export const CORE_PACKAGES: ParcelPackage[] = [
  // PAKET BUNDA (4 Varian - 325 Hari)
  {
    id: 'pkg_bunda_reguler',
    nama_paket: 'Paket Bunda Reguler',
    kategori: 'bunda',
    sub_kategori: 'Bunda · Travel Bag',
    harga_total: 650000,
    setoran_harian: 2000,
    setoran_mingguan: 14000,
    durasi_hari: 325,
    bobot_kg: 9.5,
    daftar_isi: [
      'Travel Bag Eksklusif Sagitarius',
      'THR Tunai Rp. 200.000',
      'Minyak Goreng 2L',
      'Good Day 10 pcs x 20g',
      'Tepung Terigu 1kg',
      'Indomie AB 69g 10pcs',
      'Sosro Teh Botol 1L',
      'Khong Guan Klg 650g',
      'Kental Manis 545g',
      'Fanta 1L',
      'Gula Pasir 1kg',
      'Kapal Api Special Rcg 10x6g',
      'Monde Butter 150g',
    ],
    bonus_thr: 200000,
    foto_url: IMG_BUNDA,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 2.000/hari selama 325 hari · Bonus Travel Bag & THR Rp 200.000.',
  },
  {
    id: 'pkg_bunda_silver',
    nama_paket: 'Paket Bunda Silver',
    kategori: 'bunda',
    sub_kategori: 'Bunda · Container Box',
    harga_total: 975000,
    setoran_harian: 3000,
    setoran_mingguan: 21000,
    durasi_hari: 325,
    bobot_kg: 15.0,
    daftar_isi: [
      'Container Box Sagitarius',
      'THR Tunai Rp. 350.000',
      'Beras Premium 5kg',
      'Minyak Goreng 2L',
      'Tepung Terigu 1kg',
      'Gula Pasir 1kg',
      'ABC Squash Orange 425ml',
      'Pulpy Orange Btl 1L',
      'Teh Celup Box 30x2g',
      'Tango Wafer Kaleng 200g',
      'Roma Sari Gandum 149g',
      'Indomie Mie AB 69g 10pcs',
      'Sosro Teh Botol Kotak 1L',
      'Monde Butter 454g',
      'Kental Manis 545g',
      'Fanta 1L',
      "Fox's Candy 170g",
      'Kapal Api 10x6g & Good Day Mocacino 10pcs',
    ],
    bonus_thr: 350000,
    foto_url: IMG_BUNDA_BOX,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 3.000/hari selama 325 hari · Container Box & THR Rp 350.000.',
  },
  {
    id: 'pkg_bunda_gold',
    nama_paket: 'Paket Bunda Gold',
    kategori: 'bunda',
    sub_kategori: 'Bunda · Container Box',
    harga_total: 1300000,
    setoran_harian: 4000,
    setoran_mingguan: 28000,
    durasi_hari: 325,
    bobot_kg: 17.5,
    daftar_isi: [
      'Container Box Sagitarius',
      'THR Tunai Rp. 600.000',
      'Khong Guan Klg 1600g',
      'Monde Butter Cookies 454g',
      'Kental Manis 545g',
      'Fanta 1L',
      'Sosro Teh Botol Kotak 1L',
      'ABC Squash 450/425ml',
      'Sosro Teh Celup 30x2g',
      'Beras Premium 5kg',
      'Gula Pasir 1kg',
      'Tepung Terigu 1kg',
      'Indomie AB 69g 15pcs',
      'Minyak Goreng 2L',
      "Fox's Kaleng 170g",
    ],
    bonus_thr: 600000,
    foto_url: IMG_BUNDA_BOX,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 4.000/hari selama 325 hari · Khong Guan 1600g & THR Rp 600.000.',
  },
  {
    id: 'pkg_bunda_platinum',
    nama_paket: 'Paket Bunda Platinum',
    kategori: 'bunda',
    sub_kategori: 'Bunda · Koper Dewasa',
    harga_total: 1625000,
    setoran_harian: 5000,
    setoran_mingguan: 35000,
    durasi_hari: 325,
    bobot_kg: 16.0,
    daftar_isi: [
      'Koper Dewasa Eksklusif',
      'THR Tunai Rp. 800.000',
      'Khong Guan Klg 650g',
      'Monde Butter Cookies 454g',
      'Gula Pasir 1kg',
      'Tepung Terigu 1kg',
      'Indomie AB 69g 15pcs',
      'Minyak Goreng Btl 2L',
      'Chocolatos Dark Klg',
      'Good Time Klg 133g',
      'Kacang Tanah Kupas 1kg',
      'Kental Manis 545g',
      'Fanta 1L',
      'Marjan Syrup 460ml',
    ],
    bonus_thr: 800000,
    foto_url: IMG_BUNDA_KOPER,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 5.000/hari selama 325 hari · Koper Dewasa & THR Rp 800.000.',
  },

  // PAKET ANAK (4 Varian - 325 Hari)
  {
    id: 'pkg_anak_hemat',
    nama_paket: 'Paket Anak Hemat',
    kategori: 'anak',
    sub_kategori: 'Anak · Travel Bag',
    harga_total: 487500,
    setoran_harian: 1500,
    setoran_mingguan: 10500,
    durasi_hari: 325,
    bobot_kg: 4.5,
    daftar_isi: [
      'Travel Bag Karakter',
      'THR Tunai Rp. 100.000',
      'Silver Queen CB 85g',
      'Oreo Original 105g',
      'Chitato Lite Snack 68g',
      'Qtela Original 60g',
      'Happytos Snack 140g',
      'Japota & Potabee Potato Chips',
      'Ultra UHT 1L & Sosro Teh Botol Kotak 1L',
      'Nutriboost 300ml & Buavita 245ml',
      "Beng-Beng Share It 10's & Ritz Crackers 91g",
      'My Jelly Pck 15x14g & Monde Serena 50g',
      'Pop Mie Cup 75g, Chiki Twist 75g & Fox Candy 170g',
    ],
    bonus_thr: 100000,
    foto_url: IMG_ANAK,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 1.500/hari selama 325 hari · Travel Bag & THR Rp 100.000.',
  },
  {
    id: 'pkg_anak_asyik',
    nama_paket: 'Paket Anak Asyik',
    kategori: 'anak',
    sub_kategori: 'Anak · Container Box',
    harga_total: 812500,
    setoran_harian: 2500,
    setoran_mingguan: 17500,
    durasi_hari: 325,
    bobot_kg: 6.8,
    daftar_isi: [
      'Container Box Anak',
      'THR Tunai Rp. 300.000',
      'Silver Queen CB 85g & Pringles Potato 42g',
      'Oreo Original 105g & Tango Wafer Kaleng 200g',
      'Pop Mie Cup 75g & Kanzler Singles Sosis 65g',
      'Japota 68g, Qtela Singkong 175g & Tic Tic 70g',
      'Ritz Crackers 91g & Monde Biscuit Serena 50g',
      "Fox's Candy Klg 170g & Koko Crunch 150g",
      'Chiki Snack Balls, Chiki Twist 75g & Astor Box 40g',
      'Ultra UHT 1L, Pulpy 1L, Buavita 245ml & Kental Manis 370g',
    ],
    bonus_thr: 300000,
    foto_url: IMG_ANAK,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 2.500/hari selama 325 hari · Container Box & THR Rp 300.000.',
  },
  {
    id: 'pkg_anak_ceria',
    nama_paket: 'Paket Anak Ceria',
    kategori: 'anak',
    sub_kategori: 'Anak · Koper Karakter',
    harga_total: 1300000,
    setoran_harian: 4000,
    setoran_mingguan: 28000,
    durasi_hari: 325,
    bobot_kg: 9.0,
    daftar_isi: [
      'Koper Karakter Anak',
      'THR Tunai Rp. 600.000',
      'Tango Wafer 200g & Good Time Klg 133g',
      "Fox's Candy 170g & Pocky Chocolate 47g",
      'Ultra UHT 1L, Minute Maid 1L, Buavita 245ml & Tujuh Kurma 189ml',
      'Koko Krunch 150g & Roma Sari Gandum 149g',
      'Silver Queen CB 85g & Beng-Beng Share It 10s',
      'Pringles 102g, Japota 68g, Potabee 65g & Qtela 175g',
      'Kanzler Sosis 65g, Ritz 91g, Oreo 110g, Chiki Twist & Taro 62g',
      'Kental Manis 545g',
    ],
    bonus_thr: 600000,
    foto_url: IMG_ANAK_KOPER,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 4.000/hari selama 325 hari · Koper Karakter & THR Rp 600.000.',
  },
  {
    id: 'pkg_anak_hebat',
    nama_paket: 'Paket Anak Hebat',
    kategori: 'anak',
    sub_kategori: 'Anak · Koper Dewasa',
    harga_total: 1625000,
    setoran_harian: 5000,
    setoran_mingguan: 35000,
    durasi_hari: 325,
    bobot_kg: 12.0,
    daftar_isi: [
      'Koper Dewasa Eksklusif',
      'THR Tunai Rp. 900.000',
      "Silver Queen CB 85g & Beng-Beng Share It 10's",
      'Oreo 105g, Ritz 91g, Monde Butter 150g & Roma Sari Gandum 149g',
      'Tango Kaleng 200g & Astor Wafer',
      'Pringles 102g, Chitato 68g, Japota 68g, Potabee & Qtela 60g',
      'Taro 62g, Chiki Balls 55g, Chiki Twist 75g, Tic Tic 70g & Happytos 140g',
      "Fox's 90g, My Jelly Konnyaku, Pop Mie Cup & Kanzler Sosis",
      'Ultra Susu UHT 1L, Sosro Teh Botol 1L, Nutriboost, Buavita & Tujuh Kurma 189ml',
      'Koko Krunch Box 150g',
    ],
    bonus_thr: 900000,
    foto_url: IMG_ANAK_KOPER,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 5.000/hari selama 325 hari · Koper Dewasa & THR Rp 900.000.',
  },

  // PAKET PILIHAN (Diamond & Sultan - 325 Hari)
  {
    id: 'pkg_pilihan_diamond',
    nama_paket: 'Paket Pilihan Diamond',
    kategori: 'pilihan',
    sub_kategori: 'Pilihan · Container Box + Mukena',
    harga_total: 2275000,
    setoran_harian: 7000,
    setoran_mingguan: 49000,
    durasi_hari: 325,
    bobot_kg: 21.0,
    daftar_isi: [
      'Container Box Besar',
      'THR Tunai Rp. 1.000.000',
      'Mukena Silky Motif Eksklusif',
      'Royal Choice 960g & Khong Guan Klg 1600g',
      'Chocolatos Dark Klg & Good Time Klg 133g',
      'Tango Wafer Kaleng 200g & Fox Candy Klg 170g',
      'Beras Premium 5kg & Minyak Goreng 5L',
      'Gula Pasir 1kg, Tepung Terigu 1kg & Kacang Tanah Kupas 1kg',
      'Kental Manis 545g, Pulpy Orange 1L, Marjan Syrup 460ml & Sosro Kotak 1L',
      'Indomie Mi Goreng 10pcs & Indomie AB 69g 10pcs',
    ],
    bonus_thr: 1000000,
    foto_url: IMG_DIAMOND_MUKENA,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 7.000/hari · Mukena Silky, Container Box & THR Rp 1.000.000.',
  },
  {
    id: 'pkg_pilihan_sultan',
    nama_paket: 'Paket Pilihan Sultan',
    kategori: 'pilihan',
    sub_kategori: 'Pilihan · Sultan Eksklusif',
    harga_total: 3250000,
    setoran_harian: 10000,
    setoran_mingguan: 70000,
    durasi_hari: 325,
    bobot_kg: 29.0,
    daftar_isi: [
      'Container Box Besar',
      'THR Tunai Rp. 2.000.000',
      'Royal Choice 960g & Khong Guan Klg 1600g',
      'Chocolatos Dark Klg, Good Time Klg 133g & Tango Wafer 200g',
      'Beras Premium 10kg & Minyak Goreng 5L',
      'Indomie AB 1 Dus & ABC Sardines 425g',
      'Kacang Kupas 1kg, Gula Pasir 1kg & Tepung Terigu 1kg',
      'Kental Manis 545g & Marjan Syrup 460ml',
      'Kopi Kapal Api 10pcs & Kopi ABC 10pcs',
    ],
    bonus_thr: 2000000,
    foto_url: IMG_SULTAN,
    jadwal_ambil: 'Selambatnya 15 Ramadhan',
    deskripsi_singkat: 'Cicilan Rp 10.000/hari · Paket Terbesar dengan THR Rp 2.000.000.',
  },

  // PAKET UANG (Munggahan & Lebaran - Brosur Resmi)
  {
    id: 'pkg_uang_munggahan_harian',
    nama_paket: 'Paket Uang Munggahan (295 Hari)',
    kategori: 'uang',
    sub_kategori: 'Uang · 295 Hari (Rp 5.000/hr)',
    harga_total: 1405000,
    setoran_harian: 5000,
    setoran_mingguan: 35000,
    durasi_hari: 295,
    bobot_kg: 0.5,
    daftar_isi: [
      'Pencairan Dana Tunai Rp 1.405.000 (untuk setoran Rp 5.000/hari)',
      'Tersedia pilihan setoran Rp 1.000 s.d. Rp 20.000/hari (295 Hari)',
      'Hasil akhir mulai Rp 265.000 hingga Rp 5.680.000',
      'Paket Uang dibagikan lebih awal menjelang Munggahan',
    ],
    bonus_thr: 0,
    foto_url: IMG_UANG_DAGING,
    jadwal_ambil: 'Lebih Awal (Menjelang Munggahan)',
    deskripsi_singkat: 'Tabungan uang tunai Munggahan 295 hari (tersedia Rp 1 rb – Rp 20 rb/hari).',
  },
  {
    id: 'pkg_uang_munggahan_mingguan',
    nama_paket: 'Paket Uang Munggahan (42 Minggu)',
    kategori: 'uang',
    sub_kategori: 'Uang · 42 Minggu (Rp 50.000/mg)',
    harga_total: 2000000,
    setoran_harian: 7000,
    setoran_mingguan: 50000,
    durasi_hari: 294,
    bobot_kg: 0.5,
    daftar_isi: [
      'Pencairan Dana Tunai Rp 2.000.000 (untuk setoran Rp 50.000/minggu)',
      'Tersedia pilihan Rp 20.000 s.d. Rp 200.000/minggu (42 Minggu)',
      'Hasil akhir mulai Rp 800.000 hingga Rp 8.000.000',
      'Paket Uang dibagikan lebih awal menjelang Munggahan',
    ],
    bonus_thr: 0,
    foto_url: IMG_UANG_DAGING,
    jadwal_ambil: 'Lebih Awal (Menjelang Munggahan)',
    deskripsi_singkat: 'Tabungan uang mingguan Munggahan 42 minggu (Rp 20 rb – Rp 200 rb/mg).',
  },
  {
    id: 'pkg_uang_lebaran_harian',
    nama_paket: 'Paket Uang Lebaran (325 Hari)',
    kategori: 'uang',
    sub_kategori: 'Uang · 325 Hari (Rp 10.000/hr)',
    harga_total: 3125000,
    setoran_harian: 10000,
    setoran_mingguan: 70000,
    durasi_hari: 325,
    bobot_kg: 0.5,
    daftar_isi: [
      'Pencairan Dana Tunai Rp 3.125.000 (untuk setoran Rp 10.000/hari)',
      'Tersedia pilihan setoran Rp 5.000 s.d. Rp 20.000/hari (325 Hari)',
      'Hasil akhir mulai Rp 1.550.000 hingga Rp 6.275.000',
      'Dibagikan lebih awal sebelum Hari Raya Idul Fitri',
    ],
    bonus_thr: 0,
    foto_url: IMG_UANG_DAGING,
    jadwal_ambil: 'Lebih Awal (Sebelum Lebaran)',
    deskripsi_singkat: 'Tabungan uang Lebaran 325 hari (Rp 5 rb – Rp 20 rb/hari).',
  },
  {
    id: 'pkg_uang_lebaran_mingguan',
    nama_paket: 'Paket Uang Lebaran (45 Minggu)',
    kategori: 'uang',
    sub_kategori: 'Uang · 45 Minggu (Rp 100.000/mg)',
    harga_total: 4300000,
    setoran_harian: 14000,
    setoran_mingguan: 100000,
    durasi_hari: 315,
    bobot_kg: 0.5,
    daftar_isi: [
      'Pencairan Dana Tunai Rp 4.300.000 (untuk setoran Rp 100.000/minggu)',
      'Tersedia pilihan Rp 20.000 s.d. Rp 200.000/minggu (45 Minggu)',
      'Hasil akhir mulai Rp 860.000 hingga Rp 8.600.000',
      'Dibagikan lebih awal sebelum Hari Raya Idul Fitri',
    ],
    bonus_thr: 0,
    foto_url: IMG_UANG_DAGING,
    jadwal_ambil: 'Lebih Awal (Sebelum Lebaran)',
    deskripsi_singkat: 'Tabungan uang mingguan Lebaran 45 minggu (Rp 20 rb – Rp 200 rb/mg).',
  },
];

// Exact 50 Barang Satuan (325 Hari) from Brochure Image
interface RawSatuanItem {
  no: number;
  name: string;
  daily: number;
  sub: 'Sembako Pokok' | 'Daging & Telur' | 'Kue & Minuman' | 'Bumbu & Dapur';
  kg: number;
  jadwal: string;
}

const RAW_SATUAN_50: RawSatuanItem[] = [
  { no: 1, name: 'Bimoli 5 Liter', daily: 450, sub: 'Sembako Pokok', kg: 5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 2, name: 'Bimoli 2 Liter (6 pcs)', daily: 950, sub: 'Sembako Pokok', kg: 12, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 3, name: 'Segitiga Biru 3 pcs (1 kg)', daily: 200, sub: 'Sembako Pokok', kg: 3, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 4, name: 'Gula Pasir 3 pcs (1 kg)', daily: 250, sub: 'Sembako Pokok', kg: 3, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 5, name: 'Kacang Kupas', daily: 150, sub: 'Bumbu & Dapur', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 6, name: 'Daging Ayam', daily: 200, sub: 'Daging & Telur', kg: 1.5, jadwal: 'H-2 Idul Fitri' },
  { no: 7, name: 'Daging Iga', daily: 450, sub: 'Daging & Telur', kg: 1, jadwal: 'H-2 Idul Fitri' },
  { no: 8, name: 'Daging Sapi', daily: 500, sub: 'Daging & Telur', kg: 1, jadwal: 'H-2 Idul Fitri' },
  { no: 9, name: 'Babat Sapi', daily: 350, sub: 'Daging & Telur', kg: 1, jadwal: 'H-2 Idul Fitri' },
  { no: 10, name: 'Tulang Iga Rib', daily: 400, sub: 'Daging & Telur', kg: 1, jadwal: 'H-2 Idul Fitri' },
  { no: 11, name: 'Telur Ayam', daily: 150, sub: 'Daging & Telur', kg: 1.5, jadwal: 'H-2 Idul Fitri' },
  { no: 12, name: 'Beras Premium 5 kg', daily: 300, sub: 'Sembako Pokok', kg: 5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 13, name: 'Beras Premium 25 kg', daily: 1200, sub: 'Sembako Pokok', kg: 25, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 14, name: 'Beras Gentong 25 kg', daily: 1250, sub: 'Sembako Pokok', kg: 25, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 15, name: 'Indomie Goreng 1 Dus', daily: 475, sub: 'Sembako Pokok', kg: 3.5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 16, name: 'Indomie Kocok 1 Dus', daily: 475, sub: 'Sembako Pokok', kg: 3.5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 17, name: 'Indomie Soto', daily: 425, sub: 'Sembako Pokok', kg: 3.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 18, name: 'Indomie Goreng Rendang', daily: 475, sub: 'Sembako Pokok', kg: 3.5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 19, name: 'Indomie Aceh', daily: 475, sub: 'Sembako Pokok', kg: 3.5, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 20, name: 'Indomie Ayam Bawang 1 Dus', daily: 425, sub: 'Sembako Pokok', kg: 3.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 21, name: 'Monde Butter Cookies 908 gr', daily: 500, sub: 'Kue & Minuman', kg: 1.1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 22, name: 'Monde Butter Cookies 454 gr', daily: 350, sub: 'Kue & Minuman', kg: 0.6, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 23, name: 'Khong Guan Kaleng 1600g', daily: 450, sub: 'Kue & Minuman', kg: 1.8, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 24, name: 'Khong Guan Wafer', daily: 450, sub: 'Kue & Minuman', kg: 1.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 25, name: 'Khong Guan Kaleng 650g', daily: 275, sub: 'Kue & Minuman', kg: 0.8, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 26, name: 'Astor (1 Klg)', daily: 700, sub: 'Kue & Minuman', kg: 1.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 27, name: 'Astor Mini Amora (1 Klg)', daily: 600, sub: 'Kue & Minuman', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 28, name: 'Marie Pandawa (1 Klg)', daily: 650, sub: 'Kue & Minuman', kg: 1.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 29, name: 'Wafer Coklat (1 Klg)', daily: 650, sub: 'Kue & Minuman', kg: 1.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 30, name: 'Egg Roll 600 gr', daily: 450, sub: 'Kue & Minuman', kg: 0.7, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 31, name: 'Egg Roll (1 Klg)', daily: 650, sub: 'Kue & Minuman', kg: 1.1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 32, name: 'Agar Inaco (1 kg)', daily: 150, sub: 'Kue & Minuman', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 33, name: 'Good Day Mocca 3 Renceng', daily: 225, sub: 'Kue & Minuman', kg: 0.6, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 34, name: 'Indocafe 3 Renceng', daily: 225, sub: 'Kue & Minuman', kg: 0.6, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 35, name: 'Kapal Api 3 Renceng', daily: 250, sub: 'Kue & Minuman', kg: 0.6, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 36, name: 'ABC Susu 3 Renceng', daily: 250, sub: 'Kue & Minuman', kg: 0.7, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 37, name: 'ABC Moca 3 Renceng', daily: 250, sub: 'Kue & Minuman', kg: 0.7, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 38, name: 'Buah Vita 1000 ml', daily: 150, sub: 'Kue & Minuman', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 39, name: 'Coca-Cola / Fanta / Sprite 3 pcs', daily: 200, sub: 'Kue & Minuman', kg: 3, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 40, name: 'Minute Maid Pulpy 1 Ltr 2 pcs', daily: 125, sub: 'Kue & Minuman', kg: 2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 41, name: 'SilverQueen 5 pcs', daily: 350, sub: 'Kue & Minuman', kg: 0.4, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 42, name: 'Susu UHT', daily: 100, sub: 'Kue & Minuman', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 43, name: 'Susu Indomilk Kaleng', daily: 200, sub: 'Sembako Pokok', kg: 0.6, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 44, name: 'Cadbury 5 pcs', daily: 350, sub: 'Kue & Minuman', kg: 0.4, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 45, name: 'Wong Coco 1 kg', daily: 100, sub: 'Kue & Minuman', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 46, name: 'Pop Mie', daily: 400, sub: 'Sembako Pokok', kg: 2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 47, name: 'Susu Kental Manis (4 pcs)', daily: 225, sub: 'Sembako Pokok', kg: 2.2, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 48, name: 'Sirup Marjan', daily: 100, sub: 'Kue & Minuman', kg: 0.8, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 49, name: 'Sirup ABC (4 pcs)', daily: 225, sub: 'Kue & Minuman', kg: 3, jadwal: 'Selambatnya 15 Ramadhan' },
  { no: 50, name: 'Mentega Blue Band (5 pcs)', daily: 275, sub: 'Bumbu & Dapur', kg: 1, jadwal: 'Selambatnya 15 Ramadhan' },
];

export const SATUAN_PACKAGES: ParcelPackage[] = RAW_SATUAN_50.map((item) => {
  const total325 = item.daily * 325;
  const weekly = Math.max(500, item.daily * 7);
  const photo =
    item.sub === 'Daging & Telur' || item.sub === 'Bumbu & Dapur'
      ? IMG_UANG_DAGING
      : item.sub === 'Kue & Minuman'
        ? IMG_HERO
        : IMG_BUNDA_BOX;

  return {
    id: `satuan_${String(item.no).padStart(2, '0')}`,
    nama_paket: `${item.no}. ${item.name}`,
    kategori: 'satuan',
    sub_kategori: item.sub,
    harga_total: total325,
    setoran_harian: item.daily,
    setoran_mingguan: weekly,
    durasi_hari: 325,
    bobot_kg: item.kg,
    daftar_isi: [`${item.name} (Cicilan 325 hari @ ${formatRupiah(item.daily)}/hari)`],
    bonus_thr: 0,
    foto_url: photo,
    jadwal_ambil: item.jadwal,
    deskripsi_singkat: `${item.sub} · ${formatRupiah(item.daily)}/hari × 325 hari · ${item.jadwal}.`,
  };
});

export const DEFAULT_PACKAGES: ParcelPackage[] = [...CORE_PACKAGES, ...SATUAN_PACKAGES];

const LEGACY_DEFAULT_PHOTOS = new Set([
  IMG_HERO,
  IMG_BUNDA,
  IMG_ANAK,
  IMG_SULTAN,
  IMG_UANG_DAGING,
]);

export function resolvePackagePhoto(pkg: ParcelPackage): ParcelPackage {
  const defaultMatch = DEFAULT_PACKAGES.find((d) => d.id === pkg.id);
  if (!defaultMatch) return pkg;
  if (!pkg.foto_url || LEGACY_DEFAULT_PHOTOS.has(pkg.foto_url)) {
    return { ...pkg, foto_url: defaultMatch.foto_url };
  }
  return pkg;
}

// Direktori Agen Resmi Priangan Timur (plus Pusat Mangunreja Tasikmalaya)
export const DEFAULT_AGENTS: AgentDirectoryItem[] = [
  {
    id: 'agt_tsm_01',
    kode_agen: 'AGT-TSM-01',
    nama: 'Kantor Pusat Mangunreja (CS Resmi)',
    wilayah: 'Tasikmalaya',
    kecamatan: 'Margajaya, Mangunreja, Kab. Tasikmalaya',
    no_wa: '081324383479',
    jumlah_member: 120,
    aktif: true,
  },
  {
    id: 'agt_tsm_02',
    kode_agen: 'AGT-TSM-02',
    nama: 'Teh Rina Marlina',
    wilayah: 'Tasikmalaya',
    kecamatan: 'Tawang & Cihideung, Kota Tasikmalaya',
    no_wa: '082115678903',
    jumlah_member: 56,
    aktif: true,
  },
  {
    id: 'agt_cms_01',
    kode_agen: 'AGT-CMS-01',
    nama: 'Hj. Siti Aminah',
    wilayah: 'Ciamis',
    kecamatan: 'Ciamis Kota & Cijeungjing',
    no_wa: '081223456701',
    jumlah_member: 48,
    aktif: true,
  },
  {
    id: 'agt_cms_02',
    kode_agen: 'AGT-CMS-02',
    nama: 'Kang Dedi Kusnadi',
    wilayah: 'Ciamis',
    kecamatan: 'Kawali & Panjalu',
    no_wa: '081322456702',
    jumlah_member: 31,
    aktif: true,
  },
  {
    id: 'agt_bnj_01',
    kode_agen: 'AGT-BNJ-01',
    nama: 'Ibu Neneng Suryani',
    wilayah: 'Banjar',
    kecamatan: 'Banjar Patroman & Purwaharja',
    no_wa: '085223445505',
    jumlah_member: 39,
    aktif: true,
  },
  {
    id: 'agt_bnj_02',
    kode_agen: 'AGT-BNJ-02',
    nama: 'Pak Asep Saepudin',
    wilayah: 'Banjar',
    kecamatan: 'Langensari',
    no_wa: '081311223306',
    jumlah_member: 22,
    aktif: true,
  },
  {
    id: 'agt_pgd_01',
    kode_agen: 'AGT-PGD-01',
    nama: 'Teh Maya Kartika',
    wilayah: 'Pangandaran',
    kecamatan: 'Pangandaran & Sidamulih',
    no_wa: '081288990007',
    jumlah_member: 34,
    aktif: true,
  },
  {
    id: 'agt_pgd_02',
    kode_agen: 'AGT-PGD-02',
    nama: 'Kang Hendra Wijaya',
    wilayah: 'Pangandaran',
    kecamatan: 'Parigi & Cijulang',
    no_wa: '085344556608',
    jumlah_member: 19,
    aktif: true,
  },
  {
    id: 'agt_grt_01',
    kode_agen: 'AGT-GRT-01',
    nama: 'Ibu Lilis Rohayati',
    wilayah: 'Garut',
    kecamatan: 'Garut Kota & Tarogong',
    no_wa: '081277665509',
    jumlah_member: 44,
    aktif: true,
  },
  {
    id: 'agt_grt_02',
    kode_agen: 'AGT-GRT-02',
    nama: 'Kang Ridwan Kamiludin',
    wilayah: 'Garut',
    kecamatan: 'Limbangan & Cikajang',
    no_wa: '082233445510',
    jumlah_member: 24,
    aktif: true,
  },
];
