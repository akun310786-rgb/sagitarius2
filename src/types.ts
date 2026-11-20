export type UserRole = 'member' | 'agen' | 'korwil' | 'admin';

export type WilayahPriangan =
  | 'Ciamis'
  | 'Tasikmalaya'
  | 'Banjar'
  | 'Pangandaran'
  | 'Garut';

export type PackageCategory = 'bunda' | 'anak' | 'pilihan' | 'uang' | 'satuan';

export type SubscriptionStatus = 'aktif' | 'lunas' | 'diambil';

export type TransactionType = 'setoran' | 'penarikan';

export type DepositMethod =
  | 'tunai_agen'
  | 'transfer'
  | 'pencairan_tunai'
  | 'transfer_keluar';

export type DepositVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface ParcelPackage {
  id: string;
  nama_paket: string;
  kategori: PackageCategory;
  sub_kategori?: string;
  harga_total: number;
  setoran_harian: number;
  setoran_mingguan: number;
  durasi_hari: number;
  bobot_kg: number;
  daftar_isi: string[];
  bonus_thr: number;
  foto_url: string;
  jadwal_ambil: string;
  deskripsi_singkat?: string;
}

export interface AgentDirectoryItem {
  id: string;
  kode_agen: string;
  nama: string;
  wilayah: WilayahPriangan;
  kecamatan: string;
  no_wa: string;
  jumlah_member: number;
  komisi_persen: number;
  aktif: boolean;
  korwil_id?: string;
}

export interface UserProfile {
  uid: string;
  nama: string;
  username?: string;
  no_wa: string;
  email?: string;
  role: UserRole;
  kode_agen?: string;
  wilayah: WilayahPriangan;
  agen_id?: string;
  korwil_id?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subscription {
  id: string;
  member_id: string;
  member_nama: string;
  agen_id: string;
  korwil_id?: string;
  agen_kode?: string;
  agen_nama?: string;
  wilayah: WilayahPriangan;
  package_id: string;
  package_nama: string;
  kategori?: PackageCategory;
  target_nominal: number;
  total_terkumpul: number;
  setoran_nominal?: number;
  frekuensi?: 'harian' | 'mingguan';
  durasi_minggu?: number;
  status: SubscriptionStatus;
  qr_code_token: string;
  jadwal_ambil?: string;
  daftar_isi?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Deposit {
  id: string;
  subscription_id: string;
  member_id: string;
  member_nama?: string;
  agen_id: string;
  korwil_id?: string;
  wilayah?: WilayahPriangan;
  jenis_transaksi?: TransactionType;
  nominal: number;
  metode: DepositMethod;
  bukti_foto_url?: string;
  catatan?: string;
  status_verifikasi: DepositVerificationStatus;
  validated_by?: string;
  tanggal: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SimulationLock {
  packageItem: ParcelPackage;
  durasiMinggu: number;
  frekuensi: 'harian' | 'mingguan';
  estimasiSetoran: number;
  selectedAgentId?: string;
}

export interface ContactMessage {
  id: string;
  nama: string;
  no_wa: string;
  pesan: string;
  status: 'baru' | 'dibalas';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublicPage =
  | 'beranda'
  | 'katalog'
  | 'detail_paket'
  | 'tabungan'
  | 'cara_pesan'
  | 'tentang'
  | 'kontak';

export const WILAYAH_LIST: WilayahPriangan[] = [
  'Ciamis',
  'Tasikmalaya',
  'Banjar',
  'Pangandaran',
  'Garut',
];
