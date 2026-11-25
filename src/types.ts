export type UserRole = 'member' | 'agen' | 'korwil' | 'admin';

export type StaffRole = 'agen' | 'korwil' | 'admin';

export type DataSensitivityTier = 'public' | 'private' | 'privileged';

export type WilayahPriangan =
  | 'Ciamis'
  | 'Tasikmalaya'
  | 'Banjar'
  | 'Pangandaran'
  | 'Garut';

export type PackageCategory = 'bunda' | 'anak' | 'pilihan' | 'uang' | 'satuan';

export type SubscriptionStatus = 'aktif' | 'lunas' | 'diambil';

export type DeliveryStage =
  | 'menunggu_lunas'
  | 'dikemas_gudang'
  | 'kirim_korwil'
  | 'siap_diambil'
  | 'selesai';

export type TransactionType = 'setoran' | 'penarikan';

export type DepositMethod =
  | 'tunai_agen'
  | 'transfer'
  | 'pencairan_tunai'
  | 'transfer_keluar';

export type DepositVerificationStatus = 'pending' | 'verified' | 'rejected';

export interface SecurityContext {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
  wilayah: WilayahPriangan;
  isBootstrappedAdmin: boolean;
  isStaff: boolean;
}

export interface VerifiedApiCaller {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isBootstrappedAdmin: boolean;
  authTime?: number;
}

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

/**
 * Public Agent Directory entry.
 * Internal commission/routing fields must NOT be persisted into public `/agents` documents.
 */
export interface PublicAgentDirectoryItem {
  id: string;
  kode_agen: string;
  nama: string;
  wilayah: WilayahPriangan;
  kecamatan: string;
  no_wa: string;
  jumlah_member: number;
  aktif: boolean;
}

export interface AgentDirectoryItem extends PublicAgentDirectoryItem {
  komisi_persen?: number;
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
  status_pengiriman?: DeliveryStage;
  grup_arisan?: string;
  kode_referral_agen?: string;
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

export interface AppPublicSettings {
  bank_nama: string;
  bank_rekening: string;
  bank_atas_nama: string;
  qris_merchant?: string;
  qris_kode?: string;
  qris_catatan: string;
  pengumuman_judul: string;
  pengumuman_isi: string;
  pengumuman_aktif: boolean;
  updated_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DoorPrizeDraw {
  id: string;
  hadiah: string;
  kupon_kode: string;
  subscription_id: string;
  member_id: string;
  member_nama: string;
  wilayah: WilayahPriangan;
  tanggal_undi: string;
  drawn_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AgentSettlementType = 'setor_tunai_pusat' | 'pencairan_komisi';
export type AgentSettlementStatus = 'pending' | 'verified' | 'rejected';

export interface AgentSettlement {
  id: string;
  agen_id: string;
  agen_kode?: string;
  agen_nama: string;
  wilayah: WilayahPriangan;
  jenis: AgentSettlementType;
  nominal: number;
  status: AgentSettlementStatus;
  catatan?: string;
  tanggal: string;
  validated_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WarehouseInventoryItem {
  id: string;
  item_nama: string;
  stok_tersedia: number;
  harga_beli_satuan: number;
  satuan: string;
  catatan?: string;
  updated_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProductSubstitution {
  id: string;
  package_id: string;
  package_nama: string;
  produk_lama: string;
  produk_pengganti: string;
  alasan: string;
  tanggal: string;
  created_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  aksi: string;
  target_label: string;
  detail: string;
  actor_uid: string;
  actor_nama: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type AgentApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface AgentApplication {
  id: string;
  applicant_uid: string;
  nama: string;
  username?: string;
  no_wa: string;
  email?: string;
  wilayah: WilayahPriangan;
  kecamatan: string;
  catatan?: string;
  status: AgentApplicationStatus;
  assigned_kode_agen?: string;
  review_note?: string;
  reviewed_by?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NotificationRecipientType = 'user' | 'agen' | 'korwil' | 'admin' | 'broadcast';

export type NotificationCategory =
  | 'setoran'
  | 'penarikan'
  | 'pendaftaran_agen'
  | 'kontrak'
  | 'pengumuman'
  | 'pesan_kontak'
  | 'sistem';

export interface RealtimeNotification {
  id: string;
  recipient_type: NotificationRecipientType;
  recipient_uid: string;
  wilayah?: WilayahPriangan;
  kategori: NotificationCategory;
  judul: string;
  pesan: string;
  tautan_view?: 'member' | 'operasional';
  tautan_tab?: string;
  sender_uid?: string;
  sender_nama?: string;
  is_read: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type PublicPage =
  | 'beranda'
  | 'katalog'
  | 'detail_paket'
  | 'tentang'
  | 'kontak';

export const WILAYAH_LIST: WilayahPriangan[] = [
  'Ciamis',
  'Tasikmalaya',
  'Banjar',
  'Pangandaran',
  'Garut',
];
