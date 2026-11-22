export type UserRole = 'member' | 'agen' | 'admin';

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
  | 'qris'
  | 'pencairan_tunai'
  | 'transfer_keluar';

export type DepositVerificationStatus = 'pending' | 'verified' | 'rejected';

export type UpgradeRequestStatus = 'pending' | 'approved' | 'rejected';

export type NotificationType = 'reminder' | 'approval' | 'info';

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
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subscription {
  id: string;
  member_id: string;
  member_nama: string;
  agen_id: string;
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
  upgrade_request_id?: string;
  target_package_id?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Deposit {
  id: string;
  subscription_id: string;
  member_id: string;
  member_nama?: string;
  agen_id: string;
  wilayah?: WilayahPriangan;
  jenis_transaksi?: TransactionType;
  nominal: number;
  metode: DepositMethod;
  qr_code_url?: string;
  qr_is?: string;
  rekening_number?: string;
  bukti_foto_url?: string;
  catatan?: string;
  status_verifikasi: DepositVerificationStatus;
  validated_by?: string;
  tanggal: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DepositSettings {
  id: string;
  qr_code_url?: string;
  qr_is?: string;
  rekening_number?: string;
  rekening_bank?: string;
  rekening_atas_nama?: string;
  updated_by?: string;
  updated_at?: unknown;
}

export interface UpgradeRequest {
  id: string;
  member_id: string;
  subscription_id: string;
  current_package_id: string;
  target_package_id: string;
  current_package_nama?: string;
  target_package_nama?: string;
  status: UpgradeRequestStatus;
  admin_notes?: string;
  created_at?: unknown;
  updated_at?: unknown;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  is_read: boolean;
  created_at?: unknown;
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