import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Copy,
  Download,
  Edit3,
  FileImage,
  FileSpreadsheet,
  Gift,
  Layers,
  Link2,
  Megaphone,
  MessageCircle,
  Package as PackageIcon,
  Plus,
  Printer,
  QrCode,
  Replace,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_AGENTS,
  DEFAULT_PACKAGES,
  IMG_BUNDA,
  formatRupiah,
  formatWhatsAppUrl,
} from '../data/catalogData';
import {
  AgentDirectoryItem,
  AgentSettlement,
  AgentSettlementType,
  AppPublicSettings,
  AuditLogEntry,
  ContactMessage,
  DeliveryStage,
  Deposit,
  DepositMethod,
  DoorPrizeDraw,
  PackageCategory,
  ParcelPackage,
  ProductSubstitution,
  Subscription,
  SubscriptionStatus,
  TransactionType,
  UserProfile,
  UserRole,
  WarehouseInventoryItem,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';
import { AdminAnalyticsTab } from './AdminAnalyticsTab';
import { QrCameraScanner } from './QrCameraScanner';
import { ReceiptGeneratorModal } from './ReceiptGeneratorModal';

interface AgentKorwilAdminDashboardProps {
  userProfile: UserProfile | null;
  allUsers: UserProfile[];
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  contactMessages?: ContactMessage[];
  appSettings: AppPublicSettings;
  doorPrizeDraws?: DoorPrizeDraw[];
  agentSettlements?: AgentSettlement[];
  warehouseInventory?: WarehouseInventoryItem[];
  productSubstitutions?: ProductSubstitution[];
  auditLogs?: AuditLogEntry[];
  onNeedLogin: () => void;
}

const DELIVERY_STAGE_OPTIONS: Array<{ value: DeliveryStage; label: string }> = [
  { value: 'menunggu_lunas', label: 'Menunggu Lunas' },
  { value: 'dikemas_gudang', label: 'Dikemas Gudang' },
  { value: 'kirim_korwil', label: 'Dikirim ke Korwil/Agen' },
  { value: 'siap_diambil', label: 'Siap Diambil Member' },
  { value: 'selesai', label: 'Selesai Diterima' },
];

type AdminTab =
  | 'agen'
  | 'kontrak'
  | 'master'
  | 'korwil'
  | 'gudang'
  | 'doorprize'
  | 'analitik'
  | 'pengaturan'
  | 'users'
  | 'pesan';
type MasterSubTab = 'packages' | 'agents';

function getTxType(dep: Deposit): TransactionType {
  if (dep.jenis_transaksi === 'penarikan') return 'penarikan';
  if (dep.metode === 'pencairan_tunai' || dep.metode === 'transfer_keluar') {
    return 'penarikan';
  }
  return 'setoran';
}

function getMethodLabel(dep: Deposit): string {
  switch (dep.metode) {
    case 'tunai_agen':
      return 'Tunai via Agen';
    case 'transfer':
      return 'Transfer Bank Masuk';
    case 'pencairan_tunai':
      return 'Pencairan Tunai Agen';
    case 'transfer_keluar':
      return 'Transfer Keluar';
    default:
      return dep.metode;
  }
}

function getCouponCode(sub: Subscription): string {
  return `DP-${sub.qr_code_token}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escapeCell = (val: string | number) => {
    const s = String(val ?? '');
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const AgentKorwilAdminDashboard: React.FC<AgentKorwilAdminDashboardProps> = ({
  userProfile,
  allUsers,
  packages,
  agents,
  subscriptions,
  deposits,
  contactMessages = [],
  appSettings,
  doorPrizeDraws = [],
  agentSettlements = [],
  warehouseInventory = [],
  productSubstitutions = [],
  auditLogs = [],
  onNeedLogin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('agen');
  const [txSubTab, setTxSubTab] = useState<'input' | 'harian' | 'riwayat'>('input');
  const [korwilSubTab, setKorwilSubTab] = useState<'tutup_kas' | 'wilayah' | 'referral'>('tutup_kas');
  const [gudangSubTab, setGudangSubTab] = useState<'kebutuhan' | 'manifest' | 'stok'>('kebutuhan');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);
  const cashFormRef = useRef<HTMLFormElement | null>(null);

  // Tab 1: Transaksi (Setoran & Penarikan) & Verifikasi & Checklist Jemput Bola
  const [selectedSubId, setSelectedSubId] = useState<string>(subscriptions[0]?.id || '');
  const [cashTxType, setCashTxType] = useState<TransactionType>('setoran');
  const [checklistFilter, setChecklistFilter] = useState<'all' | 'overdue' | 'near_lunas'>('all');
  const [withdrawMethod, setWithdrawMethod] = useState<'pencairan_tunai' | 'transfer_keluar'>(
    'pencairan_tunai'
  );
  const [cashNominal, setCashNominal] = useState<string>('25000');
  const [cashNote, setCashNote] = useState<string>('Setoran Tunai Jemput Bola');
  const [submittingCash, setSubmittingCash] = useState(false);

  // Audit Log Filter
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | TransactionType>('all');
  const [auditWilayahFilter, setAuditWilayahFilter] = useState<'all' | WilayahPriangan>('all');
  const [confirmDeleteDepId, setConfirmDeleteDepId] = useState<string | null>(null);

  // Tab 2: Manajemen Kontrak Member
  const [contractSearch, setContractSearch] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState<'all' | SubscriptionStatus>('all');
  const [contractWilayahFilter, setContractWilayahFilter] = useState<'all' | WilayahPriangan>('all');
  const [contractGroupFilter, setContractGroupFilter] = useState<string>('all');
  const [editingBalanceSubId, setEditingBalanceSubId] = useState<string | null>(null);
  const [editBalanceValue, setEditBalanceValue] = useState<string>('');
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);

  // Tab 3: Master Katalog & Agen
  const [masterSubTab, setMasterSubTab] = useState<MasterSubTab>('packages');
  const [pkgSearch, setPkgSearch] = useState('');
  const [pkgCatFilter, setPkgCatFilter] = useState<'all' | PackageCategory>('all');
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [confirmDeletePkgId, setConfirmDeletePkgId] = useState<string | null>(null);
  const [confirmDeleteAgentId, setConfirmDeleteAgentId] = useState<string | null>(null);

  // Package Modal Form State
  const [showPkgForm, setShowPkgForm] = useState(false);
  const [editingPkgId, setEditingPkgId] = useState<string | null>(null);
  const [pkgFormNama, setPkgFormNama] = useState('');
  const [pkgFormKategori, setPkgFormKategori] = useState<PackageCategory>('bunda');
  const [pkgFormSubKategori, setPkgFormSubKategori] = useState('');
  const [pkgFormHarga, setPkgFormHarga] = useState('650000');
  const [pkgFormHarian, setPkgFormHarian] = useState('2000');
  const [pkgFormMingguan, setPkgFormMingguan] = useState('14000');
  const [pkgFormDurasi, setPkgFormDurasi] = useState('325');
  const [pkgFormBobot, setPkgFormBobot] = useState('5');
  const [pkgFormBonus, setPkgFormBonus] = useState('0');
  const [pkgFormJadwal, setPkgFormJadwal] = useState('Selambatnya 15 Ramadhan');
  const [pkgFormFoto, setPkgFormFoto] = useState(IMG_BUNDA);
  const [pkgFormIsi, setPkgFormIsi] = useState('');
  const [savingPkg, setSavingPkg] = useState(false);

  // Agent Modal Form State
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [agentFormKode, setAgentFormKode] = useState('');
  const [agentFormNama, setAgentFormNama] = useState('');
  const [agentFormWilayah, setAgentFormWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const [agentFormKecamatan, setAgentFormKecamatan] = useState('');
  const [agentFormWa, setAgentFormWa] = useState('');
  const [agentFormMemberCount, setAgentFormMemberCount] = useState('15');
  const [agentFormKomisi, setAgentFormKomisi] = useState('5.5');
  const [agentFormAktif, setAgentFormAktif] = useState(true);
  const [savingAgent, setSavingAgent] = useState(false);

  // Tab 5: Gudang & QR + Stok HPP + Manifest + Substitusi
  const [qrInput, setQrInput] = useState<string>('');
  const [warehouseScheduleFilter, setWarehouseScheduleFilter] = useState<string>('all');
  const [manifestGroupBy, setManifestGroupBy] = useState<'wilayah' | 'agen'>('wilayah');
  const [manifestOnlyPending, setManifestOnlyPending] = useState(true);

  const [invEditId, setInvEditId] = useState<string | null>(null);
  const [invNama, setInvNama] = useState('');
  const [invStok, setInvStok] = useState('100');
  const [invHarga, setInvHarga] = useState('45000');
  const [invSatuan, setInvSatuan] = useState('unit');
  const [invCatatan, setInvCatatan] = useState('');
  const [savingInv, setSavingInv] = useState(false);
  const [confirmDeleteInvId, setConfirmDeleteInvId] = useState<string | null>(null);

  const [subNoticePkgId, setSubNoticePkgId] = useState<string>('all');
  const [subNoticeLama, setSubNoticeLama] = useState('');
  const [subNoticeBaru, setSubNoticeBaru] = useState('');
  const [subNoticeAlasan, setSubNoticeAlasan] = useState('');
  const [savingSubNotice, setSavingSubNotice] = useState(false);
  const [confirmDeleteSubNoticeId, setConfirmDeleteSubNoticeId] = useState<string | null>(null);

  // Tab 6: Pengguna & RBAC
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userWilayahFilter, setUserWilayahFilter] = useState<'all' | WilayahPriangan>('all');

  // Offline Member Contract Registration Modal State
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [offNama, setOffNama] = useState('');
  const [offWa, setOffWa] = useState('');
  const [offGrupArisan, setOffGrupArisan] = useState('');
  const [offPackageId, setOffPackageId] = useState<string>(packages[0]?.id || '');
  const [offFrekuensi, setOffFrekuensi] = useState<'harian' | 'mingguan'>('mingguan');
  const [offDurasiMinggu, setOffDurasiMinggu] = useState('46');
  const [offWilayah, setOffWilayah] = useState<WilayahPriangan>(
    userProfile?.wilayah || 'Tasikmalaya'
  );
  const [offAgentId, setOffAgentId] = useState<string>(agents[0]?.id || '');
  const [savingOffline, setSavingOffline] = useState(false);

  // Tab 4: Tutup Kas Setor Tunai Pusat & Klaim Komisi + Referral Link
  const [settleJenis, setSettleJenis] = useState<AgentSettlementType>('setor_tunai_pusat');
  const [settleNominal, setSettleNominal] = useState('250000');
  const [settleCatatan, setSettleCatatan] = useState('Setoran tunai kolektif member binaan');
  const [savingSettlement, setSavingSettlement] = useState(false);
  const [confirmDeleteSettleId, setConfirmDeleteSettleId] = useState<string | null>(null);
  const [referralAgentCode, setReferralAgentCode] = useState<string>(
    userProfile?.kode_agen || agents[0]?.kode_agen || 'AGT-TSM-01'
  );
  const [copiedRefLink, setCopiedRefLink] = useState(false);

  // Tab Door Prize State
  const [prizeName, setPrizeName] = useState('Rice Cooker Digital');
  const [drawingPrize, setDrawingPrize] = useState(false);
  const [confirmDeletePrizeId, setConfirmDeletePrizeId] = useState<string | null>(null);

  // Tab Pengaturan Rekening & Pengumuman (app_settings/public)
  const [setBankNama, setSetBankNama] = useState(appSettings.bank_nama);
  const [setBankRekening, setSetBankRekening] = useState(appSettings.bank_rekening);
  const [setBankAtasNama, setSetBankAtasNama] = useState(appSettings.bank_atas_nama);
  const [setQrisCatatan, setSetQrisCatatan] = useState(appSettings.qris_catatan);
  const [setPengJudul, setSetPengJudul] = useState(appSettings.pengumuman_judul);
  const [setPengIsi, setSetPengIsi] = useState(appSettings.pengumuman_isi);
  const [setPengAktif, setSetPengAktif] = useState(appSettings.pengumuman_aktif);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSetBankNama(appSettings.bank_nama);
    setSetBankRekening(appSettings.bank_rekening);
    setSetBankAtasNama(appSettings.bank_atas_nama);
    setSetQrisCatatan(appSettings.qris_catatan);
    setSetPengJudul(appSettings.pengumuman_judul);
    setSetPengIsi(appSettings.pengumuman_isi);
    setSetPengAktif(appSettings.pengumuman_aktif);
  }, [appSettings]);

  // General UI Feedback & Receipt Modal
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [previewProof, setPreviewProof] = useState<string | null>(null);
  const [lastValidatedDeposit, setLastValidatedDeposit] = useState<Deposit | null>(null);
  const [receiptDeposit, setReceiptDeposit] = useState<Deposit | null>(null);
  const [lastWaPayload, setLastWaPayload] = useState<{
    phone: string;
    message: string;
  } | null>(null);

  const isAdmin = userProfile?.role === 'admin';
  const isStaff =
    userProfile &&
    (userProfile.role === 'agen' ||
      userProfile.role === 'korwil' ||
      userProfile.role === 'admin');

  useEffect(() => {
    if (userProfile?.kode_agen) {
      setReferralAgentCode(userProfile.kode_agen);
    }
  }, [userProfile?.kode_agen]);

  const writeAuditLog = async (aksi: string, targetLabel: string, detail: string) => {
    if (!isAdmin || !userProfile) return;
    try {
      const safeAksi = (aksi.trim() || 'ADMIN_ACTION').slice(0, 60);
      const safeTarget = (targetLabel.trim() || 'Sistem').slice(0, 120);
      const safeDetail = (detail.trim() || 'Perubahan data oleh admin').slice(0, 400);
      const safeActor = (userProfile.nama.trim() || 'Admin').slice(0, 100);
      await addDoc(collection(db, 'audit_logs'), {
        aksi: safeAksi.length < 2 ? `${safeAksi}-` : safeAksi,
        target_label: safeTarget.length < 2 ? `${safeTarget}-` : safeTarget,
        detail: safeDetail.length < 2 ? `${safeDetail}-` : safeDetail,
        actor_uid: userProfile.uid,
        actor_nama: safeActor.length < 2 ? 'Admin' : safeActor,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Audit log write skipped:', err);
    }
  };

  // Visible subscriptions for current user role
  const managedSubscriptions = useMemo(() => {
    if (!userProfile) return [];
    if (userProfile.role === 'admin') return subscriptions;
    if (userProfile.role === 'korwil') {
      return subscriptions.filter(
        (s) => s.wilayah === userProfile.wilayah || s.korwil_id === userProfile.uid
      );
    }
    if (userProfile.role === 'agen') {
      return subscriptions.filter(
        (s) => s.agen_id === userProfile.uid || s.agen_kode === userProfile.kode_agen
      );
    }
    return [];
  }, [subscriptions, userProfile]);

  const pendingDeposits = useMemo(() => {
    const subIds = new Set(managedSubscriptions.map((s) => s.id));
    return deposits.filter(
      (d) => d.status_verifikasi === 'pending' && (isAdmin || subIds.has(d.subscription_id))
    );
  }, [deposits, managedSubscriptions, isAdmin]);

  // Verified Audit Ledger
  const verifiedTransactions = useMemo(() => {
    const subIds = new Set(managedSubscriptions.map((s) => s.id));
    const q = auditSearch.trim().toLowerCase();
    return deposits.filter((d) => {
      if (d.status_verifikasi !== 'verified') return false;
      if (!isAdmin && !subIds.has(d.subscription_id)) return false;
      const jenis = getTxType(d);
      if (auditTypeFilter !== 'all' && jenis !== auditTypeFilter) return false;
      if (auditWilayahFilter !== 'all' && d.wilayah !== auditWilayahFilter) return false;
      if (!q) return true;
      const hay = [
        d.member_nama || '',
        d.catatan || '',
        d.validated_by || '',
        d.tanggal,
        getMethodLabel(d),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [deposits, managedSubscriptions, isAdmin, auditSearch, auditTypeFilter, auditWilayahFilter]);

  // Calculate Agent Commission up to 7%
  const agentCommissionSummary = useMemo(() => {
    return agents.map((agent) => {
      const agentSubs = subscriptions.filter(
        (s) => s.agen_id === agent.id || s.agen_kode === agent.kode_agen
      );
      const liveCollected = agentSubs.reduce((sum, s) => sum + (s.total_terkumpul || 0), 0);
      const totalMembers = agent.jumlah_member + agentSubs.length;
      const rate = totalMembers >= 25 ? 7 : totalMembers >= 10 ? 5.5 : 4;
      const commissionEarned = Math.round((liveCollected * rate) / 100);
      return {
        ...agent,
        liveContracts: agentSubs.length,
        totalMembers,
        rate,
        liveCollected,
        commissionEarned,
      };
    });
  }, [agents, subscriptions]);

  // Executive KPI Summary
  const executiveKpi = useMemo(() => {
    const totalCollected = managedSubscriptions.reduce(
      (sum, s) => sum + (s.total_terkumpul || 0),
      0
    );
    const totalTarget = managedSubscriptions.reduce(
      (sum, s) => sum + (s.target_nominal || 0),
      0
    );
    const pendingTotal = pendingDeposits.reduce((sum, d) => sum + (d.nominal || 0), 0);
    const totalCommission = agentCommissionSummary.reduce(
      (sum, a) => sum + a.commissionEarned,
      0
    );
    const lunasCount = managedSubscriptions.filter((s) => s.status === 'lunas').length;
    const diambilCount = managedSubscriptions.filter((s) => s.status === 'diambil').length;
    const avgProgress =
      totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget) * 100)) : 0;

    return {
      totalCollected,
      totalTarget,
      avgProgress,
      pendingCount: pendingDeposits.length,
      pendingTotal,
      totalCommission,
      lunasCount,
      diambilCount,
    };
  }, [managedSubscriptions, pendingDeposits, agentCommissionSummary]);

  // Korwil Regional Recapitulation (5 Wilayah Priangan Timur)
  const korwilRecap = useMemo(() => {
    return WILAYAH_LIST.map((wilayah) => {
      const regAgents = agentCommissionSummary.filter((a) => a.wilayah === wilayah);
      const regSubs = subscriptions.filter((s) => s.wilayah === wilayah);
      const totalMembers = regAgents.reduce((sum, a) => sum + a.totalMembers, 0);
      const totalTarget = regSubs.reduce((sum, s) => sum + s.target_nominal, 0);
      const totalCollected = regSubs.reduce((sum, s) => sum + s.total_terkumpul, 0);
      const totalCommission = regAgents.reduce((sum, a) => sum + a.commissionEarned, 0);
      const pct = totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget) * 100)) : 0;
      return {
        wilayah,
        agentCount: regAgents.length,
        contractCount: regSubs.length,
        totalMembers,
        totalTarget,
        totalCollected,
        totalCommission,
        pct,
      };
    });
  }, [agentCommissionSummary, subscriptions]);

  // Daily Closing Sheet (Rekap Kas Hari Ini)
  const todayIsoDate = new Date().toISOString().slice(0, 10);
  const dailyClosingSummary = useMemo(() => {
    const subIds = new Set(managedSubscriptions.map((s) => s.id));
    let cashIn = 0;
    let transferIn = 0;
    let cashOut = 0;
    let txCountToday = 0;

    deposits.forEach((d) => {
      if (d.status_verifikasi !== 'verified') return;
      if (d.tanggal !== todayIsoDate) return;
      if (!isAdmin && !subIds.has(d.subscription_id)) return;
      txCountToday += 1;
      if (getTxType(d) === 'penarikan') {
        cashOut += d.nominal || 0;
      } else if (d.metode === 'transfer') {
        transferIn += d.nominal || 0;
      } else {
        cashIn += d.nominal || 0;
      }
    });

    const netCashInHand = Math.max(0, cashIn - cashOut);
    return {
      todayIsoDate,
      cashIn,
      transferIn,
      cashOut,
      netCashInHand,
      txCountToday,
    };
  }, [deposits, managedSubscriptions, isAdmin, todayIsoDate]);

  // Agent Leaderboard sorted by live collected volume
  const agentLeaderboard = useMemo(() => {
    return [...agentCommissionSummary]
      .filter((a) => a.aktif)
      .sort((a, b) => b.liveCollected - a.liveCollected || b.totalMembers - a.totalMembers)
      .map((a, idx) => {
        const nextTierTarget = a.totalMembers >= 25 ? 25 : a.totalMembers >= 10 ? 25 : 10;
        const nextTierRate = a.totalMembers >= 25 ? 7 : a.totalMembers >= 10 ? 7 : 5.5;
        const tierPct = Math.min(100, Math.round((a.totalMembers / nextTierTarget) * 100));
        return {
          ...a,
          rank: idx + 1,
          nextTierTarget,
          nextTierRate,
          tierPct,
        };
      });
  }, [agentCommissionSummary]);

  // Arisan Groups list for Tab 2 filter
  const arisanGroups = useMemo(() => {
    const names = new Set<string>();
    managedSubscriptions.forEach((s) => {
      if (s.grup_arisan && s.grup_arisan.trim()) {
        names.add(s.grup_arisan.trim());
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [managedSubscriptions]);

  // Warehouse Logistics Aggregation (H-7 & H-2) matched against warehouseInventory
  const warehouseRecap = useMemo(() => {
    const itemCounts = new Map<string, { item: string; qty: number; jadwal: string }>();
    let totalThrBonus = 0;

    subscriptions.forEach((sub) => {
      if (sub.status === 'diambil') return;
      const pkg = packages.find((p) => p.id === sub.package_id);
      if (pkg) totalThrBonus += pkg.bonus_thr || 0;
      const items = sub.daftar_isi || pkg?.daftar_isi || [];
      const jadwal = sub.jadwal_ambil || pkg?.jadwal_ambil || 'H-7 Lebaran';
      if (
        warehouseScheduleFilter !== 'all' &&
        !jadwal.toLowerCase().includes(warehouseScheduleFilter.toLowerCase())
      ) {
        return;
      }
      items.forEach((line) => {
        const key = `${line}__${jadwal}`;
        const existing = itemCounts.get(key);
        if (existing) {
          existing.qty += 1;
        } else {
          itemCounts.set(key, { item: line, qty: 1, jadwal });
        }
      });
    });

    const rowsWithStock = Array.from(itemCounts.values())
      .sort((a, b) => b.qty - a.qty)
      .map((r) => {
        const lowName = r.item.toLowerCase();
        const inv = warehouseInventory.find((w) => {
          const wLow = w.item_nama.toLowerCase();
          return lowName.includes(wLow) || wLow.includes(lowName);
        });
        const stokTersedia = inv ? inv.stok_tersedia : null;
        const selisihBelanja = stokTersedia !== null ? Math.max(0, r.qty - stokTersedia) : null;
        return {
          ...r,
          stokTersedia,
          selisihBelanja,
        };
      });

    return {
      rows: rowsWithStock,
      totalThrBonus,
      readyToPickSubs: subscriptions.filter((s) => s.status === 'lunas'),
      pickedUpCount: subscriptions.filter((s) => s.status === 'diambil').length,
    };
  }, [subscriptions, packages, warehouseScheduleFilter, warehouseInventory]);

  // Delivery Manifest Grouping (Surat Jalan Wilayah / Agen)
  const manifestGroups = useMemo(() => {
    const groups = new Map<string, { label: string; subs: Subscription[]; totalNilai: number }>();
    managedSubscriptions.forEach((s) => {
      const stage: DeliveryStage =
        s.status_pengiriman ||
        (s.status === 'diambil'
          ? 'selesai'
          : s.status === 'lunas'
            ? 'siap_diambil'
            : 'menunggu_lunas');
      if (manifestOnlyPending && (stage === 'selesai' || s.status === 'diambil')) {
        return;
      }
      const key =
        manifestGroupBy === 'wilayah'
          ? s.wilayah
          : `${s.agen_nama || s.agen_kode || 'Agen'} (${s.wilayah})`;
      const existing = groups.get(key);
      if (existing) {
        existing.subs.push(s);
        existing.totalNilai += s.target_nominal;
      } else {
        groups.set(key, { label: key, subs: [s], totalNilai: s.target_nominal });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.subs.length - a.subs.length);
  }, [managedSubscriptions, manifestGroupBy, manifestOnlyPending]);

  // Filtered Contracts List
  const filteredContracts = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    return managedSubscriptions.filter((s) => {
      if (contractStatusFilter !== 'all' && s.status !== contractStatusFilter) return false;
      if (contractWilayahFilter !== 'all' && s.wilayah !== contractWilayahFilter) return false;
      if (
        contractGroupFilter !== 'all' &&
        (s.grup_arisan || '').trim() !== contractGroupFilter
      ) {
        return false;
      }
      if (!q) return true;
      const hay = [
        s.member_nama,
        s.package_nama,
        s.qr_code_token,
        s.agen_nama || '',
        s.agen_kode || '',
        s.grup_arisan || '',
        s.wilayah,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [
    managedSubscriptions,
    contractSearch,
    contractStatusFilter,
    contractWilayahFilter,
    contractGroupFilter,
  ]);

  // Filtered Packages for Master Tab
  const filteredMasterPackages = useMemo(() => {
    const q = pkgSearch.trim().toLowerCase();
    return packages.filter((p) => {
      if (pkgCatFilter !== 'all' && p.kategori !== pkgCatFilter) return false;
      if (!q) return true;
      return `${p.nama_paket} ${p.kategori} ${p.sub_kategori || ''}`.toLowerCase().includes(q);
    });
  }, [packages, pkgSearch, pkgCatFilter]);

  // Filtered Users for RBAC Tab
  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (userWilayahFilter !== 'all' && u.wilayah !== userWilayahFilter) return false;
      if (!q) return true;
      return `${u.nama} ${u.username || ''} ${u.email || ''} ${u.no_wa} ${u.kode_agen || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [allUsers, userSearch, userRoleFilter, userWilayahFilter]);

  const roleCounts = useMemo(() => {
    return {
      member: allUsers.filter((u) => u.role === 'member').length,
      agen: allUsers.filter((u) => u.role === 'agen').length,
      korwil: allUsers.filter((u) => u.role === 'korwil').length,
      admin: allUsers.filter((u) => u.role === 'admin').length,
    };
  }, [allUsers]);

  // Checklist Jemput Bola Member Binaan
  const checklistItems = useMemo(() => {
    const todayMs = Date.now();
    const rows = managedSubscriptions
      .filter((s) => s.status === 'aktif')
      .map((s) => {
        const verifiedSets = deposits
          .filter(
            (d) =>
              d.subscription_id === s.id &&
              d.status_verifikasi === 'verified' &&
              getTxType(d) === 'setoran'
          )
          .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        const lastDate = verifiedSets[0]?.tanggal || '';
        const daysSince = lastDate
          ? Math.floor((todayMs - new Date(lastDate).getTime()) / 86400000)
          : 999;
        const pct = Math.min(
          100,
          Math.round(((s.total_terkumpul || 0) / Math.max(1, s.target_nominal)) * 100)
        );
        const memberUser = allUsers.find((u) => u.uid === s.member_id);
        return {
          sub: s,
          lastDate,
          daysSince,
          pct,
          memberWa: memberUser?.no_wa || '',
        };
      });

    return rows.filter((r) => {
      if (checklistFilter === 'overdue') return r.daysSince > 6;
      if (checklistFilter === 'near_lunas') return r.pct >= 80;
      return true;
    });
  }, [managedSubscriptions, deposits, checklistFilter, allUsers]);

  // Door Prize Eligible Coupons
  const doorPrizeEligible = useMemo(() => {
    const wonIds = new Set(doorPrizeDraws.map((d) => d.subscription_id));
    return subscriptions
      .filter((s) => (s.total_terkumpul || 0) > 0 && s.status !== 'diambil')
      .map((s) => ({
        sub: s,
        kuponKode: getCouponCode(s),
        alreadyWon: wonIds.has(s.id),
      }));
  }, [subscriptions, doorPrizeDraws]);

  // --- Handlers: Cash Deposit or Withdrawal ---
  const handleRecordCashTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetSub =
      managedSubscriptions.find((s) => s.id === selectedSubId) || managedSubscriptions[0];
    if (!userProfile || !targetSub) {
      setStatusMessage('Pilih kontrak member yang valid terlebih dahulu.');
      return;
    }
    const nominalNum = Number(cashNominal);
    if (!Number.isFinite(nominalNum) || nominalNum < 1000) {
      setStatusMessage('Nominal transaksi minimal Rp 1.000.');
      return;
    }

    if (cashTxType === 'penarikan') {
      if (targetSub.status === 'diambil' && !isAdmin) {
        setStatusMessage('Kontrak berstatus Sudah Diambil dan tidak dapat ditarik lagi.');
        return;
      }
      if (nominalNum > (targetSub.total_terkumpul || 0)) {
        setStatusMessage(
          `Nominal penarikan (${formatRupiah(nominalNum)}) melebihi saldo terkumpul member (${formatRupiah(
            targetSub.total_terkumpul
          )}).`
        );
        return;
      }
    }

    setSubmittingCash(true);
    setStatusMessage('');
    try {
      const batch = writeBatch(db);
      const depRef = doc(collection(db, 'deposits'));
      const subRef = doc(db, 'subscriptions', targetSub.id);

      const newTotal =
        cashTxType === 'penarikan'
          ? Math.max(0, (targetSub.total_terkumpul || 0) - nominalNum)
          : (targetSub.total_terkumpul || 0) + nominalNum;

      const newStatus: SubscriptionStatus =
        targetSub.status === 'diambil'
          ? 'diambil'
          : newTotal >= targetSub.target_nominal
            ? 'lunas'
            : 'aktif';

      const metode: DepositMethod =
        cashTxType === 'penarikan' ? withdrawMethod : 'tunai_agen';
      const todayDate = new Date().toISOString().slice(0, 10);
      const finalCatatan =
        cashNote.trim() ||
        (cashTxType === 'penarikan' ? 'Penarikan Dana via Agen/Admin' : 'Setoran Tunai Agen');

      batch.set(depRef, {
        subscription_id: targetSub.id,
        member_id: targetSub.member_id,
        member_nama: targetSub.member_nama,
        agen_id: targetSub.agen_id,
        wilayah: targetSub.wilayah,
        jenis_transaksi: cashTxType,
        nominal: nominalNum,
        metode,
        catatan: finalCatatan,
        status_verifikasi: 'verified',
        validated_by: userProfile.nama,
        tanggal: todayDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(subRef, {
        total_terkumpul: newTotal,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

      const receiptItem: Deposit = {
        id: depRef.id,
        subscription_id: targetSub.id,
        member_id: targetSub.member_id,
        member_nama: targetSub.member_nama,
        agen_id: targetSub.agen_id,
        wilayah: targetSub.wilayah,
        jenis_transaksi: cashTxType,
        nominal: nominalNum,
        metode,
        catatan: finalCatatan,
        status_verifikasi: 'verified',
        validated_by: userProfile.nama,
        tanggal: todayDate,
      };
      setLastValidatedDeposit(receiptItem);

      const memberObj = allUsers.find((u) => u.uid === targetSub.member_id);
      const sisa = Math.max(0, targetSub.target_nominal - newTotal);
      setLastWaPayload({
        phone: memberObj?.no_wa || '081324383479',
        message:
          cashTxType === 'penarikan'
            ? `Assalamu'alaikum ${targetSub.member_nama}, penarikan dana Anda sebesar ${formatRupiah(
                nominalNum
              )} dari paket ${targetSub.package_nama} telah DIVALIDASI oleh ${userProfile.nama}. Saldo terbaru: ${formatRupiah(
                newTotal
              )}.`
            : `Assalamu'alaikum ${targetSub.member_nama}, setoran tunai Anda sebesar ${formatRupiah(
                nominalNum
              )} untuk ${targetSub.package_nama} telah TERVALIDASI oleh ${userProfile.nama}. Saldo terkumpul: ${formatRupiah(
                newTotal
              )} (Sisa: ${formatRupiah(sisa)}). Status: ${newStatus.toUpperCase()}.`,
      });

      setStatusMessage(
        `${
          cashTxType === 'penarikan' ? 'Penarikan' : 'Setoran tunai'
        } ${formatRupiah(nominalNum)} untuk ${targetSub.member_nama} berhasil divalidasi & saldo terbarui.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'deposits/subscriptions');
    } finally {
      setSubmittingCash(false);
    }
  };

  // --- Handler: Verify Pending Deposit or Withdrawal ---
  const handleVerifyDeposit = async (dep: Deposit, decision: 'verified' | 'rejected') => {
    if (!userProfile) return;
    const targetSub = subscriptions.find((s) => s.id === dep.subscription_id);
    if (!targetSub) return;

    const isWithdraw = getTxType(dep) === 'penarikan';
    if (decision === 'verified' && isWithdraw && dep.nominal > (targetSub.total_terkumpul || 0)) {
      setStatusMessage(
        `Tidak dapat memvalidasi penarikan ${formatRupiah(dep.nominal)} karena melebihi saldo ${targetSub.member_nama} (${formatRupiah(
          targetSub.total_terkumpul
        )}).`
      );
      return;
    }

    try {
      const batch = writeBatch(db);
      const depRef = doc(db, 'deposits', dep.id);
      const nextNote =
        decision === 'verified'
          ? `${dep.catatan || (isWithdraw ? 'Penarikan' : 'Transfer')} — Divalidasi (${userProfile.nama})`
          : `${dep.catatan || (isWithdraw ? 'Penarikan' : 'Transfer')} — Ditolak (${userProfile.nama})`;
      batch.update(depRef, {
        status_verifikasi: decision,
        validated_by: userProfile.nama,
        catatan: nextNote.slice(0, 250),
        updatedAt: serverTimestamp(),
      });

      let newTotal = targetSub.total_terkumpul;
      let newStatus: SubscriptionStatus = targetSub.status;
      if (decision === 'verified') {
        newTotal = isWithdraw
          ? Math.max(0, (targetSub.total_terkumpul || 0) - dep.nominal)
          : (targetSub.total_terkumpul || 0) + dep.nominal;
        newStatus =
          targetSub.status === 'diambil'
            ? 'diambil'
            : newTotal >= targetSub.target_nominal
              ? 'lunas'
              : 'aktif';

        const subRef = doc(db, 'subscriptions', targetSub.id);
        batch.update(subRef, {
          total_terkumpul: newTotal,
          status: newStatus,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      if (decision === 'verified') {
        setLastValidatedDeposit({
          ...dep,
          status_verifikasi: 'verified',
          validated_by: userProfile.nama,
          catatan: nextNote,
        });
        const memberObj = allUsers.find((u) => u.uid === targetSub.member_id);
        const sisa = Math.max(0, targetSub.target_nominal - newTotal);
        setLastWaPayload({
          phone: memberObj?.no_wa || '081324383479',
          message: isWithdraw
            ? `Assalamu'alaikum ${targetSub.member_nama}, pengajuan penarikan Anda sebesar ${formatRupiah(
                dep.nominal
              )} pada ${targetSub.package_nama} telah DIVALIDASI oleh ${userProfile.nama}. Saldo tersisa: ${formatRupiah(
                newTotal
              )}.`
            : `Assalamu'alaikum ${targetSub.member_nama}, bukti transfer Anda sebesar ${formatRupiah(
                dep.nominal
              )} untuk ${targetSub.package_nama} telah DIVALIDASI oleh ${userProfile.nama}. Saldo terkumpul: ${formatRupiah(
                newTotal
              )} (Sisa: ${formatRupiah(sisa)}).`,
        });
      }

      setStatusMessage(
        decision === 'verified'
          ? `${isWithdraw ? 'Penarikan' : 'Setoran'} ${formatRupiah(dep.nominal)} telah divalidasi oleh ${userProfile.nama}.`
          : `${isWithdraw ? 'Penarikan' : 'Setoran'} ${formatRupiah(dep.nominal)} ditolak.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `deposits/${dep.id}`);
    }
  };

  const handleDeleteDepositRecord = async (depId: string) => {
    const depObj = deposits.find((d) => d.id === depId);
    try {
      await deleteDoc(doc(db, 'deposits', depId));
      await writeAuditLog(
        'HAPUS_TRANSAKSI',
        depObj?.member_nama || depId,
        `Menghapus log transaksi ${depObj ? formatRupiah(depObj.nominal) : depId} (${depObj?.tanggal || '-'})`
      );
      setConfirmDeleteDepId(null);
      setStatusMessage('Log transaksi berhasil dihapus oleh Admin.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `deposits/${depId}`);
    }
  };

  // --- Handlers: Contracts Management & Delivery Tracking ---
  const handleUpdateContractStatus = async (sub: Subscription, newStatus: SubscriptionStatus) => {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'UBAH_STATUS_KONTRAK',
        sub.member_nama,
        `Status kontrak ${sub.package_nama} diubah ${sub.status} -> ${newStatus}`
      );
      setStatusMessage(
        `Status kontrak ${sub.member_nama} (${sub.package_nama}) diperbarui menjadi ${newStatus.toUpperCase()}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${sub.id}`);
    }
  };

  const handleUpdateDeliveryStage = async (sub: Subscription, nextStage: DeliveryStage) => {
    if (!isAdmin && sub.status === 'diambil') {
      setStatusMessage('Kontrak sudah berstatus Diambil dan tidak dapat diubah lagi oleh agen.');
      return;
    }
    try {
      const updates: Record<string, unknown> = {
        status_pengiriman: nextStage,
        updatedAt: serverTimestamp(),
      };
      if (nextStage === 'selesai' && sub.status === 'lunas') {
        updates.status = 'diambil';
      }
      await updateDoc(doc(db, 'subscriptions', sub.id), updates);
      await writeAuditLog(
        'UPDATE_PENGIRIMAN',
        sub.member_nama,
        `Tahap pengiriman ${sub.package_nama} diperbarui menjadi ${nextStage}`
      );
      setStatusMessage(
        `Tahap pengiriman paket ${sub.member_nama} (${sub.package_nama}) diperbarui menjadi ${
          DELIVERY_STAGE_OPTIONS.find((o) => o.value === nextStage)?.label || nextStage
        }.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${sub.id}`);
    }
  };

  const handleBatchAdvanceDelivery = async (subs: Subscription[], nextStage: DeliveryStage) => {
    const eligible = subs.filter((s) => isAdmin || s.status !== 'diambil');
    if (eligible.length === 0) {
      setStatusMessage('Tidak ada paket dalam grup ini yang dapat diperbarui tahap pengirimannya.');
      return;
    }
    try {
      const batch = writeBatch(db);
      eligible.forEach((s) => {
        const updates: Record<string, unknown> = {
          status_pengiriman: nextStage,
          updatedAt: serverTimestamp(),
        };
        if (nextStage === 'selesai' && s.status === 'lunas') {
          updates.status = 'diambil';
        }
        batch.update(doc(db, 'subscriptions', s.id), updates);
      });
      await batch.commit();
      await writeAuditLog(
        'BATCH_MANIFEST_KIRIM',
        `${eligible.length} Paket`,
        `Memperbarui tahap pengiriman massal ${eligible.length} kontrak ke ${nextStage}`
      );
      setStatusMessage(
        `${eligible.length} paket berhasil diperbarui tahap pengirimannya menjadi "${
          DELIVERY_STAGE_OPTIONS.find((o) => o.value === nextStage)?.label || nextStage
        }".`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'subscriptions/batch');
    }
  };

  const handleSaveManualBalance = async (sub: Subscription) => {
    const val = Number(editBalanceValue);
    if (!Number.isFinite(val) || val < 0) {
      setStatusMessage('Nominal koreksi saldo tidak valid.');
      return;
    }
    try {
      const nextStatus: SubscriptionStatus =
        sub.status === 'diambil'
          ? 'diambil'
          : val >= sub.target_nominal
            ? 'lunas'
            : 'aktif';
      await updateDoc(doc(db, 'subscriptions', sub.id), {
        total_terkumpul: Math.round(val),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'KOREKSI_SALDO',
        sub.member_nama,
        `Koreksi saldo ${sub.package_nama}: ${formatRupiah(sub.total_terkumpul)} -> ${formatRupiah(val)}`
      );
      setEditingBalanceSubId(null);
      setStatusMessage(
        `Saldo kontrak ${sub.member_nama} dikoreksi menjadi ${formatRupiah(val)} (${nextStatus.toUpperCase()}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${sub.id}`);
    }
  };

  const handleDeleteContract = async (subId: string) => {
    const subObj = subscriptions.find((s) => s.id === subId);
    try {
      await deleteDoc(doc(db, 'subscriptions', subId));
      await writeAuditLog(
        'HAPUS_KONTRAK',
        subObj?.member_nama || subId,
        `Menghapus kontrak ${subObj?.package_nama || subId} (saldo ${formatRupiah(subObj?.total_terkumpul || 0)})`
      );
      setConfirmDeleteSubId(null);
      setStatusMessage('Kontrak berhasil dihapus dari Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subscriptions/${subId}`);
    }
  };

  // --- Handlers: Master Packages CRUD ---
  const openCreatePackageForm = () => {
    setEditingPkgId(null);
    setPkgFormNama('');
    setPkgFormKategori('bunda');
    setPkgFormSubKategori('Paket Baru');
    setPkgFormHarga('650000');
    setPkgFormHarian('2000');
    setPkgFormMingguan('14000');
    setPkgFormDurasi('325');
    setPkgFormBobot('5');
    setPkgFormBonus('0');
    setPkgFormJadwal('Selambatnya 15 Ramadhan');
    setPkgFormFoto(IMG_BUNDA);
    setPkgFormIsi('Beras Premium 5Kg\nMinyak Goreng 2L\nGula Pasir 1Kg');
    setShowPkgForm(true);
  };

  const openEditPackageForm = (pkg: ParcelPackage) => {
    setEditingPkgId(pkg.id);
    setPkgFormNama(pkg.nama_paket);
    setPkgFormKategori(pkg.kategori);
    setPkgFormSubKategori(pkg.sub_kategori || '');
    setPkgFormHarga(String(pkg.harga_total));
    setPkgFormHarian(String(pkg.setoran_harian));
    setPkgFormMingguan(String(pkg.setoran_mingguan));
    setPkgFormDurasi(String(pkg.durasi_hari));
    setPkgFormBobot(String(pkg.bobot_kg || 0));
    setPkgFormBonus(String(pkg.bonus_thr || 0));
    setPkgFormJadwal(pkg.jadwal_ambil || 'Selambatnya 15 Ramadhan');
    setPkgFormFoto(pkg.foto_url || IMG_BUNDA);
    setPkgFormIsi((pkg.daftar_isi || []).join('\n'));
    setShowPkgForm(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    const items = pkgFormIsi
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (items.length === 0) {
      setStatusMessage('Isi daftar komoditas paket minimal 1 baris.');
      return;
    }

    const docId =
      editingPkgId ||
      `pkg_${pkgFormKategori}_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_-]/g, '');

    setSavingPkg(true);
    try {
      const ref = doc(db, 'packages', docId);
      const existingSnap = await getDoc(ref);
      const createdAtVal = existingSnap.exists()
        ? existingSnap.data().createdAt
        : serverTimestamp();

      await setDoc(ref, {
        nama_paket: pkgFormNama.trim().slice(0, 120),
        kategori: pkgFormKategori,
        sub_kategori: (pkgFormSubKategori.trim() || pkgFormKategori).slice(0, 60),
        harga_total: Math.max(1000, Number(pkgFormHarga) || 1000),
        setoran_harian: Math.max(100, Number(pkgFormHarian) || 100),
        setoran_mingguan: Math.max(500, Number(pkgFormMingguan) || 500),
        durasi_hari: Math.min(400, Math.max(7, Number(pkgFormDurasi) || 325)),
        bobot_kg: Math.max(0, Number(pkgFormBobot) || 0),
        daftar_isi: items,
        bonus_thr: Math.max(0, Number(pkgFormBonus) || 0),
        foto_url: (pkgFormFoto.trim() || IMG_BUNDA).slice(0, 500),
        jadwal_ambil: (pkgFormJadwal.trim() || 'Selambatnya 15 Ramadhan').slice(0, 40),
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      });

      setShowPkgForm(false);
      setStatusMessage(
        editingPkgId
          ? `Paket "${pkgFormNama.trim()}" berhasil diperbarui di Firestore.`
          : `Paket baru "${pkgFormNama.trim()}" berhasil ditambahkan ke Katalog.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `packages/${docId}`);
    } finally {
      setSavingPkg(false);
    }
  };

  const handleDeletePackage = async (pkgId: string) => {
    try {
      await deleteDoc(doc(db, 'packages', pkgId));
      setConfirmDeletePkgId(null);
      setStatusMessage('Paket berhasil dihapus dari Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `packages/${pkgId}`);
    }
  };

  // --- Handlers: Master Agents CRUD ---
  const openCreateAgentForm = () => {
    setEditingAgentId(null);
    setAgentFormKode(`AGT-TSM-${String(agents.length + 1).padStart(2, '0')}`);
    setAgentFormNama('');
    setAgentFormWilayah('Tasikmalaya');
    setAgentFormKecamatan('');
    setAgentFormWa('0813');
    setAgentFormMemberCount('10');
    setAgentFormKomisi('5.5');
    setAgentFormAktif(true);
    setShowAgentForm(true);
  };

  const openEditAgentForm = (agt: AgentDirectoryItem) => {
    setEditingAgentId(agt.id);
    setAgentFormKode(agt.kode_agen);
    setAgentFormNama(agt.nama);
    setAgentFormWilayah(agt.wilayah);
    setAgentFormKecamatan(agt.kecamatan || '');
    setAgentFormWa(agt.no_wa);
    setAgentFormMemberCount(String(agt.jumlah_member));
    setAgentFormKomisi(String(agt.komisi_persen));
    setAgentFormAktif(agt.aktif);
    setShowAgentForm(true);
  };

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const docId =
      editingAgentId ||
      `agt_${Date.now().toString(36)}`.replace(/[^a-zA-Z0-9_-]/g, '');

    setSavingAgent(true);
    try {
      const ref = doc(db, 'agents', docId);
      const existingSnap = await getDoc(ref);
      const createdAtVal = existingSnap.exists()
        ? existingSnap.data().createdAt
        : serverTimestamp();

      await setDoc(ref, {
        kode_agen: agentFormKode.trim().toUpperCase().slice(0, 32),
        nama: agentFormNama.trim().slice(0, 100),
        wilayah: agentFormWilayah,
        kecamatan: agentFormKecamatan.trim().slice(0, 80),
        no_wa: agentFormWa.trim().slice(0, 20),
        jumlah_member: Math.max(0, Number(agentFormMemberCount) || 0),
        komisi_persen: Math.min(15, Math.max(0, Number(agentFormKomisi) || 4)),
        aktif: agentFormAktif,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      });

      setShowAgentForm(false);
      setStatusMessage(
        editingAgentId
          ? `Data agen "${agentFormNama.trim()}" diperbarui.`
          : `Agen baru "${agentFormNama.trim()}" berhasil ditambahkan ke direktori.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `agents/${docId}`);
    } finally {
      setSavingAgent(false);
    }
  };

  const handleToggleAgentActive = async (agt: AgentDirectoryItem) => {
    try {
      const ref = doc(db, 'agents', agt.id);
      const existingSnap = await getDoc(ref);
      const createdAtVal = existingSnap.exists()
        ? existingSnap.data().createdAt
        : serverTimestamp();
      await setDoc(ref, {
        kode_agen: agt.kode_agen,
        nama: agt.nama,
        wilayah: agt.wilayah,
        kecamatan: agt.kecamatan || '',
        no_wa: agt.no_wa,
        jumlah_member: agt.jumlah_member,
        komisi_persen: agt.komisi_persen,
        aktif: !agt.aktif,
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `Status agen ${agt.nama} diubah menjadi ${!agt.aktif ? 'AKTIF' : 'NONAKTIF'}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agents/${agt.id}`);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    try {
      await deleteDoc(doc(db, 'agents', agentId));
      setConfirmDeleteAgentId(null);
      setStatusMessage('Agen berhasil dihapus dari direktori Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `agents/${agentId}`);
    }
  };

  // --- Handler: Warehouse QR Pickup ---
  const handleMarkQrPickedUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = qrInput.trim();
    const matched = subscriptions.find(
      (s) => s.qr_code_token.toLowerCase() === token.toLowerCase()
    );
    if (!matched) {
      setStatusMessage(`Token QR "${token}" tidak ditemukan dalam database kontrak.`);
      return;
    }
    if (matched.status !== 'lunas') {
      setStatusMessage(
        `Kontrak ${matched.member_nama} berstatus "${matched.status}" (belum lunas atau sudah diambil).`
      );
      return;
    }
    try {
      await updateDoc(doc(db, 'subscriptions', matched.id), {
        status: 'diambil',
        updatedAt: serverTimestamp(),
      });
      setQrInput('');
      setStatusMessage(
        `Serah terima paket ${matched.package_nama} atas nama ${matched.member_nama} selesai!`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${matched.id}`);
    }
  };

  // --- Handler: Contact Messages Inbox ---
  const handleMarkMessageReplied = async (msg: ContactMessage) => {
    try {
      await updateDoc(doc(db, 'contact_messages', msg.id), {
        status: msg.status === 'baru' ? 'dibalas' : 'baru',
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `Status pesan dari ${msg.nama} diperbarui menjadi ${
          msg.status === 'baru' ? 'DIBALAS' : 'BARU'
        }.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `contact_messages/${msg.id}`);
    }
  };

  const handleDeleteContactMessage = async (msgId: string) => {
    try {
      await deleteDoc(doc(db, 'contact_messages', msgId));
      setConfirmDeleteMsgId(null);
      setStatusMessage('Pesan kontak berhasil dihapus dari Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `contact_messages/${msgId}`);
    }
  };

  // --- Handler: User RBAC Role & Kode Agen ---
  const handleUpdateUserRole = async (
    targetUser: UserProfile,
    newRole: UserRole,
    newWilayah: WilayahPriangan,
    customKodeAgen?: string
  ) => {
    try {
      const nextKode =
        customKodeAgen !== undefined
          ? customKodeAgen.trim().toUpperCase().slice(0, 32)
          : newRole === 'agen' && !targetUser.kode_agen
            ? `AGT-${newWilayah.slice(0, 3).toUpperCase()}-${targetUser.uid.slice(0, 3).toUpperCase()}`
            : targetUser.kode_agen || '';

      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: newRole,
        wilayah: newWilayah,
        kode_agen: nextKode,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'UBAH_ROLE_RBAC',
        targetUser.nama,
        `Role ${targetUser.role} -> ${newRole} | Wilayah ${targetUser.wilayah} -> ${newWilayah}`
      );
      setStatusMessage(
        `Peran ${targetUser.nama} diperbarui menjadi ${newRole.toUpperCase()} (${newWilayah}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  // --- Handler: Sync Master Defaults ---
  const handleSyncCatalogToFirestore = async () => {
    setSyncingCatalog(true);
    setStatusMessage('');
    try {
      const batch = writeBatch(db);
      DEFAULT_PACKAGES.forEach((p) => {
        batch.set(doc(db, 'packages', p.id), {
          nama_paket: p.nama_paket,
          kategori: p.kategori,
          sub_kategori: p.sub_kategori || p.kategori,
          harga_total: p.harga_total,
          setoran_harian: p.setoran_harian,
          setoran_mingguan: p.setoran_mingguan,
          durasi_hari: p.durasi_hari,
          bobot_kg: p.bobot_kg,
          daftar_isi: p.daftar_isi,
          bonus_thr: p.bonus_thr,
          foto_url: p.foto_url,
          jadwal_ambil: p.jadwal_ambil,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      DEFAULT_AGENTS.forEach((a) => {
        batch.set(doc(db, 'agents', a.id), {
          kode_agen: a.kode_agen,
          nama: a.nama,
          wilayah: a.wilayah,
          kecamatan: a.kecamatan,
          no_wa: a.no_wa,
          jumlah_member: a.jumlah_member,
          komisi_persen: a.komisi_persen,
          aktif: a.aktif,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      setStatusMessage(
        `Berhasil menyinkronkan ${DEFAULT_PACKAGES.length} paket katalog dan ${DEFAULT_AGENTS.length} agen Priangan Timur ke Firestore (${BOOTSTRAPPED_ADMIN_EMAIL}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'packages/agents');
    } finally {
      setSyncingCatalog(false);
    }
  };

  // --- Handler: Open & Save Offline Member Contract ---
  const openOfflineRegistration = () => {
    setOffNama('');
    setOffWa('');
    setOffGrupArisan('');
    const firstPkg = packages[0];
    setOffPackageId(firstPkg?.id || '');
    setOffFrekuensi('mingguan');
    setOffDurasiMinggu(
      String(firstPkg ? Math.min(60, Math.max(12, Math.round(firstPkg.durasi_hari / 7))) : 46)
    );
    setOffWilayah(userProfile?.wilayah || 'Tasikmalaya');
    setOffAgentId(agents[0]?.id || '');
    setShowOfflineModal(true);
  };

  const handleCreateOfflineContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const pkg = packages.find((p) => p.id === offPackageId) || packages[0];
    if (!pkg) {
      setStatusMessage('Pilih paket katalog terlebih dahulu.');
      return;
    }
    const cleanName = offNama.trim();
    if (cleanName.length < 2) {
      setStatusMessage('Nama lengkap member minimal 2 karakter.');
      return;
    }

    const durasi = Math.min(60, Math.max(1, Number(offDurasiMinggu) || 46));
    const totalPeriods = offFrekuensi === 'harian' ? durasi * 7 : durasi;
    const setoranNominal = Math.max(500, Math.ceil(pkg.harga_total / totalPeriods / 500) * 500);

    const chosenAgent = agents.find((a) => a.id === offAgentId) || agents[0];
    const assignedAgenId =
      userProfile.role === 'agen' ? userProfile.uid : chosenAgent?.id || userProfile.uid;
    const assignedAgenKode =
      userProfile.role === 'agen'
        ? userProfile.kode_agen || chosenAgent?.kode_agen || 'AGT-RESMI'
        : chosenAgent?.kode_agen || 'AGT-PUSAT';
    const assignedAgenNama =
      userProfile.role === 'agen' ? userProfile.nama : chosenAgent?.nama || userProfile.nama;

    const cleanWaNote = offWa.trim();
    const memberLabel = cleanWaNote ? `${cleanName} (${cleanWaNote})` : cleanName;
    const qrToken = `SGT-${offWilayah.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    setSavingOffline(true);
    try {
      const payload: Record<string, unknown> = {
        member_id: `offline_${Date.now().toString(36)}`,
        member_nama: memberLabel.slice(0, 100),
        agen_id: assignedAgenId,
        korwil_id: userProfile.role === 'korwil' ? userProfile.uid : '',
        agen_kode: assignedAgenKode.slice(0, 32),
        agen_nama: assignedAgenNama.slice(0, 100),
        wilayah: offWilayah,
        package_id: pkg.id,
        package_nama: pkg.nama_paket.slice(0, 120),
        kategori: pkg.kategori,
        target_nominal: pkg.harga_total,
        total_terkumpul: 0,
        setoran_nominal: setoranNominal,
        frekuensi: offFrekuensi,
        durasi_minggu: durasi,
        status: 'aktif',
        status_pengiriman: 'menunggu_lunas',
        qr_code_token: qrToken,
        jadwal_ambil: (pkg.jadwal_ambil || 'Selambatnya 15 Ramadhan').slice(0, 40),
        daftar_isi: (pkg.daftar_isi || [pkg.nama_paket]).slice(0, 30),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (offGrupArisan.trim()) {
        payload.grup_arisan = offGrupArisan.trim().slice(0, 80);
      }
      const createdRef = await addDoc(collection(db, 'subscriptions'), payload);
      setSelectedSubId(createdRef.id);
      setShowOfflineModal(false);
      setStatusMessage(
        `Kontrak offline untuk ${cleanName} (${pkg.nama_paket}) berhasil didaftarkan! Token QR: ${qrToken}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subscriptions');
    } finally {
      setSavingOffline(false);
    }
  };

  // --- Handlers: Agent Settlement (Setor Tunai Pusat & Klaim Komisi) ---
  const handleCreateSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    const nominal = Math.round(Number(settleNominal));
    if (!Number.isFinite(nominal) || nominal < 1000) {
      setStatusMessage('Nominal pengajuan minimal Rp 1.000.');
      return;
    }

    setSavingSettlement(true);
    try {
      await addDoc(collection(db, 'agent_settlements'), {
        agen_id: userProfile.uid,
        agen_kode: (userProfile.kode_agen || '').slice(0, 32),
        agen_nama: userProfile.nama.slice(0, 100),
        wilayah: userProfile.wilayah,
        jenis: settleJenis,
        nominal,
        status: 'pending',
        catatan: settleCatatan.trim().slice(0, 250),
        tanggal: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `Pengajuan ${
          settleJenis === 'setor_tunai_pusat' ? 'Setor Tunai Pusat' : 'Klaim Pencairan Komisi'
        } sebesar ${formatRupiah(nominal)} berhasil dikirim ke Admin Pusat.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'agent_settlements');
    } finally {
      setSavingSettlement(false);
    }
  };

  const handleVerifySettlement = async (
    item: AgentSettlement,
    decision: 'verified' | 'rejected'
  ) => {
    if (!userProfile) return;
    try {
      await updateDoc(doc(db, 'agent_settlements', item.id), {
        status: decision,
        validated_by: userProfile.nama.slice(0, 100),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'VALIDASI_KAS_AGEN',
        item.agen_nama,
        `${item.jenis} sebesar ${formatRupiah(item.nominal)} -> ${decision.toUpperCase()}`
      );
      setStatusMessage(
        `Pengajuan ${item.agen_nama} (${formatRupiah(item.nominal)}) telah ${
          decision === 'verified' ? 'DIVALIDASI' : 'DITOLAK'
        }.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `agent_settlements/${item.id}`);
    }
  };

  const handleDeleteSettlement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'agent_settlements', id));
      setConfirmDeleteSettleId(null);
      setStatusMessage('Catatan tutup kas / komisi berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `agent_settlements/${id}`);
    }
  };

  // --- Handlers: Warehouse Inventory CRUD & Product Substitution CRUD ---
  const handleSaveInventoryItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isAdmin) return;
    const cleanName = invNama.trim().slice(0, 120);
    const cleanSatuan = invSatuan.trim().slice(0, 30) || 'unit';
    const stokNum = Math.max(0, Math.round(Number(invStok) || 0));
    const hargaNum = Math.max(0, Math.round(Number(invHarga) || 0));

    if (cleanName.length < 2) {
      setStatusMessage('Nama barang inventaris minimal 2 karakter.');
      return;
    }

    setSavingInv(true);
    try {
      if (invEditId) {
        await updateDoc(doc(db, 'warehouse_inventory', invEditId), {
          item_nama: cleanName,
          stok_tersedia: stokNum,
          harga_beli_satuan: hargaNum,
          satuan: cleanSatuan,
          catatan: invCatatan.trim().slice(0, 200),
          updated_by: userProfile.nama.slice(0, 100),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'UPDATE_STOK_HPP',
          cleanName,
          `Stok: ${stokNum} ${cleanSatuan}, HPP: ${formatRupiah(hargaNum)}`
        );
        setStatusMessage(`Stok & HPP "${cleanName}" berhasil diperbarui.`);
      } else {
        await addDoc(collection(db, 'warehouse_inventory'), {
          item_nama: cleanName,
          stok_tersedia: stokNum,
          harga_beli_satuan: hargaNum,
          satuan: cleanSatuan,
          catatan: invCatatan.trim().slice(0, 200),
          updated_by: userProfile.nama.slice(0, 100),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog(
          'TAMBAH_STOK_HPP',
          cleanName,
          `Stok awal: ${stokNum} ${cleanSatuan}, HPP: ${formatRupiah(hargaNum)}`
        );
        setStatusMessage(`Barang gudang "${cleanName}" berhasil ditambahkan.`);
      }
      setInvEditId(null);
      setInvNama('');
      setInvStok('100');
      setInvHarga('45000');
      setInvSatuan('unit');
      setInvCatatan('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'warehouse_inventory');
    } finally {
      setSavingInv(false);
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    const item = warehouseInventory.find((w) => w.id === id);
    try {
      await deleteDoc(doc(db, 'warehouse_inventory', id));
      await writeAuditLog(
        'HAPUS_STOK_HPP',
        item?.item_nama || id,
        `Menghapus item stok gudang ${item?.item_nama || id}`
      );
      setConfirmDeleteInvId(null);
      setStatusMessage('Item stok gudang berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `warehouse_inventory/${id}`);
    }
  };

  const handleCreateSubstitutionNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isAdmin) return;
    const lama = subNoticeLama.trim().slice(0, 120);
    const baru = subNoticeBaru.trim().slice(0, 120);
    const alasan = subNoticeAlasan.trim().slice(0, 250);
    if (lama.length < 2 || baru.length < 2 || alasan.length < 2) {
      setStatusMessage('Isi produk lama, produk pengganti, dan alasan substitusi minimal 2 karakter.');
      return;
    }

    const chosenPkg = packages.find((p) => p.id === subNoticePkgId);
    const pkgId = chosenPkg ? chosenPkg.id.replace(/[^a-zA-Z0-9_-]/g, '') : 'all';
    const pkgNama = chosenPkg ? chosenPkg.nama_paket.slice(0, 120) : 'Semua Paket Terkait';
    const todayStr = new Date().toISOString().slice(0, 10);

    setSavingSubNotice(true);
    try {
      await addDoc(collection(db, 'product_substitutions'), {
        package_id: pkgId || 'all',
        package_nama: pkgNama,
        produk_lama: lama,
        produk_pengganti: baru,
        alasan,
        tanggal: todayStr,
        created_by: userProfile.nama.slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'SUBSTITUSI_PRODUK',
        pkgNama,
        `${lama} -> ${baru} (${alasan})`
      );
      setSubNoticeLama('');
      setSubNoticeBaru('');
      setSubNoticeAlasan('');
      setStatusMessage('Pengumuman substitusi produk resmi dipublikasikan ke Dashboard Member.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'product_substitutions');
    } finally {
      setSavingSubNotice(false);
    }
  };

  const handleDeleteSubstitutionNotice = async (id: string) => {
    const item = productSubstitutions.find((s) => s.id === id);
    try {
      await deleteDoc(doc(db, 'product_substitutions', id));
      await writeAuditLog(
        'HAPUS_SUBSTITUSI',
        item?.package_nama || id,
        `Menghapus info substitusi ${item?.produk_lama || ''} -> ${item?.produk_pengganti || ''}`
      );
      setConfirmDeleteSubNoticeId(null);
      setStatusMessage('Info substitusi produk berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `product_substitutions/${id}`);
    }
  };

  // --- Handlers: Door Prize Random Draw ---
  const handleRunDoorPrizeDraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isAdmin) return;
    const cleanHadiah = prizeName.trim();
    if (cleanHadiah.length < 2) {
      setStatusMessage('Masukkan nama hadiah Door Prize terlebih dahulu.');
      return;
    }

    const freshPool = doorPrizeEligible.filter((item) => !item.alreadyWon);
    const pool = freshPool.length > 0 ? freshPool : doorPrizeEligible;
    if (pool.length === 0) {
      setStatusMessage('Belum ada peserta dengan kupon aktif (minimal 1 setoran tervalidasi).');
      return;
    }

    setDrawingPrize(true);
    try {
      const winner = pool[Math.floor(Math.random() * pool.length)];
      await addDoc(collection(db, 'door_prize_draws'), {
        hadiah: cleanHadiah.slice(0, 100),
        kupon_kode: winner.kuponKode,
        subscription_id: winner.sub.id,
        member_id: winner.sub.member_id,
        member_nama: winner.sub.member_nama.slice(0, 100),
        wilayah: winner.sub.wilayah,
        tanggal_undi: new Date().toISOString().slice(0, 10),
        drawn_by: userProfile.nama.slice(0, 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'UNDI_DOOR_PRIZE',
        winner.sub.member_nama,
        `Hadiah ${cleanHadiah} (Kupon ${winner.kuponKode})`
      );
      setStatusMessage(
        `Selamat! Pemenang ${cleanHadiah}: ${winner.sub.member_nama} (${winner.kuponKode} · ${winner.sub.wilayah}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'door_prize_draws');
    } finally {
      setDrawingPrize(false);
    }
  };

  const handleDeleteDoorPrize = async (id: string) => {
    const dp = doorPrizeDraws.find((d) => d.id === id);
    try {
      await deleteDoc(doc(db, 'door_prize_draws', id));
      await writeAuditLog(
        'HAPUS_DOOR_PRIZE',
        dp?.member_nama || id,
        `Menghapus pemenang Door Prize ${dp?.hadiah || ''} (${dp?.kupon_kode || id})`
      );
      setConfirmDeletePrizeId(null);
      setStatusMessage('Data pemenang Door Prize berhasil dihapus.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `door_prize_draws/${id}`);
    }
  };

  // --- Handler: Save App Public Settings (Bank & Broadcast) ---
  const handleSaveAppSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !isAdmin) return;
    setSavingSettings(true);
    try {
      const ref = doc(db, 'app_settings', 'public');
      const existingSnap = await getDoc(ref);
      const createdAtVal = existingSnap.exists()
        ? existingSnap.data().createdAt
        : serverTimestamp();

      await setDoc(ref, {
        bank_nama: setBankNama.trim().slice(0, 60) || 'BRI / BCA Resmi',
        bank_rekening: setBankRekening.trim().slice(0, 50) || '0100-01-002345-30-8',
        bank_atas_nama:
          setBankAtasNama.trim().slice(0, 100) || 'PT. SAGITARIUS TRINUNGGAL KARYA',
        qris_catatan: setQrisCatatan.trim().slice(0, 250),
        pengumuman_judul: setPengJudul.trim().slice(0, 120),
        pengumuman_isi: setPengIsi.trim().slice(0, 600),
        pengumuman_aktif: setPengAktif,
        updated_by: userProfile.nama.slice(0, 100),
        createdAt: createdAtVal,
        updatedAt: serverTimestamp(),
      });
      await writeAuditLog(
        'UPDATE_PENGATURAN_PUBLIK',
        setBankNama.trim() || 'Rekening & Info',
        `Rekening ${setBankRekening.trim()} | Pengumuman aktif: ${setPengAktif ? 'YA' : 'TIDAK'}`
      );
      setStatusMessage(
        'Pengaturan rekening transfer resmi & papan pengumuman berhasil dipublikasikan ke seluruh dashboard member.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'app_settings/public');
    } finally {
      setSavingSettings(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-stone-900">
            Portal Agen, Korwil &amp; Admin Pusat
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Silakan masuk menggunakan akun resmi Agen, Korwil, atau Admin Pusat (WhatsApp / Username / Gmail / Google) untuk mengelola setoran, penarikan, komisi, kontrak member, master katalog, dan logistik gudang H-7/H-2.
          </p>
          <button
            type="button"
            onClick={onNeedLogin}
            className="mt-6 rounded-lg bg-[#26124A] px-6 py-3 text-sm font-semibold text-white hover:bg-[#341A63] cursor-pointer"
          >
            Masuk Akun Resmi
          </button>
        </div>
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 sm:p-10">
          <ShieldCheck className="mx-auto h-10 w-10 text-emerald-800" />
          <h2 className="mt-3 font-display text-2xl font-bold text-stone-900">
            Akses Khusus Agen, Korwil &amp; Admin Pusat
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            Akun Anda saat ini terdaftar sebagai <strong>Member</strong> (
            {userProfile.email || userProfile.no_wa || userProfile.username}). Hubungi Admin Pusat
            untuk aktivasi peran sebagai Agen Wilayah atau Korwil Priangan Timur.
          </p>
        </div>
      </div>
    );
  }

  const unreadMessagesCount = contactMessages.filter((m) => m.status === 'baru').length;
  const pendingSettlementsCount = agentSettlements.filter((s) => s.status === 'pending').length;

  const tabs: Array<{
    id: AdminTab;
    label: string;
    group: 'operasional' | 'keuangan' | 'pusat';
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    adminOnly?: boolean;
  }> = [
    { id: 'agen', label: 'Transaksi & Validasi', group: 'operasional', icon: ClipboardCheck, badge: pendingDeposits.length },
    { id: 'kontrak', label: 'Kontrak Member', group: 'operasional', icon: Layers, badge: managedSubscriptions.length },
    { id: 'gudang', label: 'Gudang & Pengiriman', group: 'operasional', icon: Warehouse },
    { id: 'korwil', label: 'Komisi & Setoran Kas', group: 'keuangan', icon: Coins, badge: pendingSettlementsCount },
    { id: 'doorprize', label: 'Door Prize', group: 'keuangan', icon: Gift, badge: doorPrizeDraws.length },
    { id: 'analitik', label: 'Analitik & Audit', group: 'keuangan', icon: BarChart3, adminOnly: true },
    { id: 'master', label: 'Katalog & Agen', group: 'pusat', icon: PackageIcon, adminOnly: true },
    { id: 'users', label: 'Pengguna & RBAC', group: 'pusat', icon: Users, badge: allUsers.length, adminOnly: true },
    { id: 'pesan', label: 'Pesan Masuk', group: 'pusat', icon: MessageCircle, badge: unreadMessagesCount, adminOnly: true },
    { id: 'pengaturan', label: 'Rekening & Info', group: 'pusat', icon: Settings, adminOnly: true },
  ];

  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  const activeTabMeta = visibleTabs.find((t) => t.id === activeTab) || visibleTabs[0];
  const sidebarGroups: Array<{ key: 'operasional' | 'keuangan' | 'pusat'; title: string }> = [
    { key: 'operasional', title: 'Operasional' },
    { key: 'keuangan', title: 'Keuangan & Program' },
    { key: 'pusat', title: 'Pengaturan Pusat' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-60 shrink-0 rounded-xl border border-stone-200 bg-white p-3">
          <div className="border-b border-stone-100 px-3 pb-3 mb-3">
            <p className="text-[11px] font-semibold text-[#0C3328]">
              {isAdmin ? 'Admin Pusat' : userProfile.role.toUpperCase()}
            </p>
            <p className="truncate text-sm font-bold text-stone-900">{userProfile.nama}</p>
            <p className="text-[11px] text-stone-500">Wilayah {userProfile.wilayah}</p>
          </div>

          <nav className="space-y-4" aria-label="Menu Dashboard">
            {sidebarGroups.map((grp) => {
              const items = visibleTabs.filter((t) => t.group === grp.key);
              if (items.length === 0) return null;
              return (
                <div key={grp.key}>
                  <p className="px-3 pb-1.5 text-[11px] font-semibold text-stone-400">
                    {grp.title}
                  </p>
                  <div className="space-y-0.5">
                    {items.map((t) => {
                      const Icon = t.icon;
                      const isActive = activeTab === t.id;
                      const isAlertBadge = t.id === 'agen' || t.id === 'korwil' || t.id === 'pesan';
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTab(t.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition cursor-pointer ${
                            isActive
                              ? 'bg-[#0C3328] text-[#E8CA82] font-semibold'
                              : 'text-stone-700 hover:bg-stone-100/80 hover:text-stone-900'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#E8CA82]' : 'text-stone-400'}`} />
                            <span className="truncate">{t.label}</span>
                          </span>
                          {typeof t.badge === 'number' && t.badge > 0 && (
                            <span
                              className={`font-mono-nums text-[11px] font-semibold shrink-0 ${
                                isActive
                                  ? 'text-[#E8CA82]'
                                  : isAlertBadge
                                    ? 'text-amber-700'
                                    : 'text-stone-400'
                              }`}
                            >
                              {t.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className="mt-4 border-t border-stone-100 pt-3">
            <a
              href="/panduan-penggunaan-sagitarius-parcel.pdf"
              target="_blank"
              rel="noopener noreferrer"
              download="Panduan-Penggunaan-Sagitarius-Parcel.pdf"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            >
              <Download className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
              <span>Buku Panduan (PDF)</span>
            </a>
          </div>
        </aside>

        {/* Main Workspace */}
        <div className="min-w-0 flex-1 space-y-5">
          {/* Compact Top Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-stone-200 pb-4">
            <div>
              <p className="text-xs text-stone-500">
                Dashboard {isAdmin ? 'Admin Pusat' : userProfile.role} / {activeTabMeta?.label}
              </p>
              <h1 className="mt-0.5 font-display text-xl font-bold text-stone-900 sm:text-2xl">
                {activeTabMeta?.label}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openOfflineRegistration}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Kontrak Baru</span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleSyncCatalogToFirestore}
                  disabled={syncingCatalog}
                  title={`Sinkronkan ${DEFAULT_PACKAGES.length} Paket & ${DEFAULT_AGENTS.length} Agen ke Firestore`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PackageIcon className="h-3.5 w-3.5 text-stone-500" />
                  <span>{syncingCatalog ? 'Menyinkronkan...' : 'Sinkronkan Katalog'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Mobile Horizontal Menu Strip */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {visibleTabs.map((t) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#0C3328] text-[#E8CA82]'
                      : 'border border-stone-200 bg-white text-stone-700'
                  }`}
                >
                  <span>{t.label}</span>
                  {typeof t.badge === 'number' && t.badge > 0 && (
                    <span className="font-mono-nums text-[11px] opacity-80">({t.badge})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Clean 4-Column Summary Strip */}
          <div className="grid grid-cols-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
            <div className="p-4">
              <p className="text-[11px] font-medium text-stone-500">Dana Terkumpul</p>
              <p className="mt-1 font-mono-nums text-base font-bold text-[#0C3328]">
                {formatRupiah(executiveKpi.totalCollected)}
              </p>
              <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
                {executiveKpi.avgProgress}% dari {formatRupiah(executiveKpi.totalTarget)}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium text-stone-500">Antrean Validasi</p>
              <p className="mt-1 font-mono-nums text-base font-bold text-amber-800">
                {executiveKpi.pendingCount} Pending
              </p>
              <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
                {formatRupiah(executiveKpi.pendingTotal)} menunggu cek
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium text-stone-500">Kontrak &amp; Logistik</p>
              <p className="mt-1 font-mono-nums text-base font-bold text-stone-900">
                {managedSubscriptions.length} Kontrak
              </p>
              <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
                {executiveKpi.lunasCount} lunas · {executiveKpi.diambilCount} diambil
              </p>
            </div>
            <div className="p-4">
              <p className="text-[11px] font-medium text-stone-500">Komisi &amp; Jaringan</p>
              <p className="mt-1 font-mono-nums text-base font-bold text-[#381E5A]">
                {formatRupiah(executiveKpi.totalCommission)}
              </p>
              <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
                {agents.filter((a) => a.aktif).length} agen · {allUsers.length || '—'} akun
              </p>
            </div>
          </div>

          {/* Status Alert + Quick WhatsApp & PNG/Thermal Receipt */}
          {statusMessage && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
              <span>{statusMessage}</span>
              <div className="flex flex-wrap items-center gap-2">
                {lastValidatedDeposit && (
                  <button
                    type="button"
                    onClick={() => setReceiptDeposit(lastValidatedDeposit)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#381E5A] px-3.5 py-1.5 text-xs font-semibold text-[#E8CA82] hover:bg-[#492975] cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Cetak Struk PNG</span>
                  </button>
                )}
                {lastWaPayload && (
                  <a
                    href={formatWhatsAppUrl(lastWaPayload.phone, lastWaPayload.message)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Kirim Struk WA</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setStatusMessage('')}
                  className="rounded p-1 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                  aria-label="Tutup notifikasi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

      {/* TAB 1: TRANSAKSI (SETORAN & PENARIKAN) + VERIFIKASI + JEMPUT BOLA + LOG AUDIT */}
      {activeTab === 'agen' && (
        <div className="space-y-5">
          {/* Sub-Tab Navigasi Transaksi */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setTxSubTab('input')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  txSubTab === 'input'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Validasi &amp; Input ({pendingDeposits.length} Pending)
              </button>
              <button
                type="button"
                onClick={() => setTxSubTab('harian')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  txSubTab === 'harian'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Kas Harian &amp; Jemput Bola ({checklistItems.length})
              </button>
              <button
                type="button"
                onClick={() => setTxSubTab('riwayat')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  txSubTab === 'riwayat'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Riwayat Tervalidasi ({verifiedTransactions.length})
              </button>
            </div>
          </div>

          {txSubTab === 'input' && (
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Input Setoran Tunai atau Penarikan */}
            <form
              ref={cashFormRef}
              onSubmit={handleRecordCashTransaction}
              className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-emerald-900">
                  <Wallet className="h-5 w-5" />
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Input Transaksi Langsung
                  </h2>
                </div>
                <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setCashTxType('setoran');
                      setCashNote('Setoran Tunai Jemput Bola');
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                      cashTxType === 'setoran'
                        ? 'bg-emerald-900 text-white'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowDownLeft className="h-3 w-3" />
                    Setoran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashTxType('penarikan');
                      setCashNote('Penarikan Dana Member Tervalidasi');
                    }}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-semibold cursor-pointer ${
                      cashTxType === 'penarikan'
                        ? 'bg-rose-800 text-white'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    <ArrowUpRight className="h-3 w-3" />
                    Penarikan
                  </button>
                </div>
              </div>

              <p className="text-xs text-stone-600">
                {cashTxType === 'setoran'
                  ? 'Catat setoran tunai harian/mingguan member. Saldo & status kontrak langsung diperbarui dan tercatat sebagai Setoran Tervalidasi.'
                  : 'Catat pencairan/penarikan dana member. Saldo kontrak dikurangi secara otomatis dan masuk ke Riwayat Transaksi Tervalidasi.'}
              </p>

              {managedSubscriptions.length === 0 ? (
                <div className="rounded-lg bg-stone-50 p-4 text-xs text-stone-600">
                  Belum ada kontrak tabungan member yang terhubung.
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Pilih Kontrak Member
                    </label>
                    <select
                      value={selectedSubId || managedSubscriptions[0]?.id}
                      onChange={(e) => setSelectedSubId(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                    >
                      {managedSubscriptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.member_nama} — {s.package_nama} ({formatRupiah(s.total_terkumpul)} /{' '}
                          {formatRupiah(s.target_nominal)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {cashTxType === 'penarikan' && (
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        Metode Pencairan
                      </label>
                      <select
                        value={withdrawMethod}
                        onChange={(e) =>
                          setWithdrawMethod(
                            e.target.value as 'pencairan_tunai' | 'transfer_keluar'
                          )
                        }
                        className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                      >
                        <option value="pencairan_tunai">Pencairan Tunai via Agen</option>
                        <option value="transfer_keluar">Transfer Keluar ke Member</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Nominal {cashTxType === 'penarikan' ? 'Penarikan' : 'Tunai Diterima'} (Rp)
                    </label>
                    <input
                      type="number"
                      min={1000}
                      step={500}
                      required
                      value={cashNominal}
                      onChange={(e) => setCashNominal(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700">
                      Catatan Transaksi
                    </label>
                    <input
                      type="text"
                      value={cashNote}
                      onChange={(e) => setCashNote(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingCash}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer ${
                      cashTxType === 'penarikan'
                        ? 'bg-rose-800 hover:bg-rose-700'
                        : 'bg-emerald-900 hover:bg-emerald-800'
                    }`}
                  >
                    {submittingCash
                      ? 'Menyimpan...'
                      : cashTxType === 'penarikan'
                        ? 'Catat & Validasi Penarikan Dana'
                        : 'Catat & Validasi Setoran Tunai'}
                  </button>
                </>
              )}
            </form>

            {/* Antrean Verifikasi Setoran & Penarikan Pending */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-900" />
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Antrean Validasi Setoran &amp; Penarikan ({pendingDeposits.length})
                  </h2>
                </div>
              </div>

              {pendingDeposits.length === 0 ? (
                <p className="mt-6 rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">
                  Semua pengajuan setoran transfer maupun penarikan member telah divalidasi.
                </p>
              ) : (
                <div className="mt-4 divide-y divide-stone-100">
                  {pendingDeposits.map((dep) => {
                    const isWithdraw = getTxType(dep) === 'penarikan';
                    const hasUniqueCode =
                      !isWithdraw &&
                      Boolean(
                        dep.catatan &&
                          (dep.catatan.includes('INV-SGT-') || dep.catatan.includes('Kode Unik'))
                      );
                    return (
                      <div
                        key={dep.id}
                        className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isWithdraw
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-900'
                              }`}
                            >
                              {isWithdraw ? 'Penarikan' : 'Setoran'}
                            </span>
                            {hasUniqueCode && (
                              <span className="rounded bg-[#381E5A]/10 px-2 py-0.5 text-[10px] font-bold text-[#381E5A]">
                                Invoice Kode Unik
                              </span>
                            )}
                            <p className="text-sm font-bold text-stone-900">
                              {dep.member_nama || dep.member_id} —{' '}
                              <span
                                className={`font-mono-nums ${
                                  isWithdraw ? 'text-rose-700' : 'text-emerald-900'
                                }`}
                              >
                                {isWithdraw ? '-' : '+'}
                                {formatRupiah(dep.nominal)}
                              </span>
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {dep.tanggal} · {getMethodLabel(dep)} · {dep.catatan || '-'}
                          </p>
                          {dep.bukti_foto_url && (
                            <button
                              type="button"
                              onClick={() => setPreviewProof(dep.bukti_foto_url || null)}
                              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                            >
                              <FileImage className="h-3.5 w-3.5" />
                              Periksa Foto Bukti Transfer
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleVerifyDeposit(dep, 'rejected')}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyDeposit(dep, 'verified')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>{hasUniqueCode ? 'Cocok Mutasi & Validasi' : 'Validasi'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          )}

          {txSubTab === 'harian' && (
          <div className="space-y-5">
          {/* Daily Closing Sheet / Rekap Kas Harian Agen */}
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  Daily Closing Sheet · {dailyClosingSummary.todayIsoDate}
                </p>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Rekap Kas Harian &amp; Tutup Kas Otomatis
                </h2>
                <p className="text-xs text-stone-600">
                  Ringkasan mutasi tervalidasi hari ini ({dailyClosingSummary.txCountToday} transaksi) sebelum disetorkan ke Admin Pusat.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettleJenis('setor_tunai_pusat');
                  setSettleNominal(String(Math.max(1000, dailyClosingSummary.netCashInHand)));
                  setSettleCatatan(
                    `Tutup kas harian ${dailyClosingSummary.todayIsoDate}: Tunai ${formatRupiah(
                      dailyClosingSummary.cashIn
                    )}, Pencairan ${formatRupiah(dailyClosingSummary.cashOut)}`
                  );
                  setKorwilSubTab('tutup_kas');
                  setActiveTab('korwil');
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Ajukan Tutup Kas Hari Ini</span>
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                <p className="text-[11px] text-stone-500">Tunai Masuk Hari Ini</p>
                <p className="mt-1 font-mono-nums text-base font-bold text-[#0C3328]">
                  +{formatRupiah(dailyClosingSummary.cashIn)}
                </p>
              </div>
              <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                <p className="text-[11px] text-stone-500">Transfer Masuk Hari Ini</p>
                <p className="mt-1 font-mono-nums text-base font-bold text-[#381E5A]">
                  +{formatRupiah(dailyClosingSummary.transferIn)}
                </p>
              </div>
              <div className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3.5">
                <p className="text-[11px] text-stone-500">Penarikan / Keluar</p>
                <p className="mt-1 font-mono-nums text-base font-bold text-rose-700">
                  -{formatRupiah(dailyClosingSummary.cashOut)}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
                <p className="text-[11px] font-semibold text-emerald-900">Kas Bersih di Tangan</p>
                <p className="mt-1 font-mono-nums text-base font-bold text-emerald-950">
                  {formatRupiah(dailyClosingSummary.netCashInHand)}
                </p>
              </div>
            </div>
          </div>

          {/* Checklist Jemput Bola Member Binaan */}
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Checklist Jemput Bola Member Binaan ({checklistItems.length})
                </h2>
                <p className="text-xs text-stone-600">
                  Pantau member aktif yang belum menyetor lebih dari 6 hari atau mendekati lunas, lalu catat setoran 1-klik atau kirim pengingat halus.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setChecklistFilter('all')}
                  className={`rounded-md px-3 py-1 font-semibold cursor-pointer ${
                    checklistFilter === 'all'
                      ? 'bg-[#0C3328] text-[#E8CA82]'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Semua Aktif
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('overdue')}
                  className={`rounded-md px-3 py-1 font-semibold cursor-pointer ${
                    checklistFilter === 'overdue'
                      ? 'bg-amber-700 text-white'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Perlu Setor (&gt;6 hari)
                </button>
                <button
                  type="button"
                  onClick={() => setChecklistFilter('near_lunas')}
                  className={`rounded-md px-3 py-1 font-semibold cursor-pointer ${
                    checklistFilter === 'near_lunas'
                      ? 'bg-[#381E5A] text-[#E8CA82]'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Dekat Lunas (&ge;80%)
                </button>
              </div>
            </div>

            {checklistItems.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
                Tidak ada member binaan pada kategori filter ini.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {checklistItems.slice(0, 12).map((row) => {
                  const s = row.sub;
                  const waMessage = `Assalamu'alaikum ${s.member_nama}, pengingat ramah dari Sagitarius Parcel mengenai tabungan ${s.package_nama}. Saldo saat ini ${formatRupiah(
                    s.total_terkumpul
                  )} (${row.pct}%). Setoran rutin dapat dititipkan ke agen atau transfer ke rekening resmi. Terima kasih.`;
                  const waHref = row.memberWa
                    ? formatWhatsAppUrl(row.memberWa, waMessage)
                    : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

                  return (
                    <div
                      key={s.id}
                      className="flex flex-col justify-between rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-[#381E5A]">{s.member_nama}</p>
                            <p className="text-xs text-stone-600">{s.package_nama}</p>
                          </div>
                          <span
                            className={`rounded px-2 py-0.5 font-mono-nums text-[10px] font-bold ${
                              row.daysSince > 6
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {row.lastDate ? `${row.daysSince} hr lalu` : 'Belum setor'}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-xs">
                          <span className="font-mono-nums font-bold text-[#0C3328]">
                            {formatRupiah(s.total_terkumpul)}
                          </span>
                          <span className="font-mono-nums text-stone-500">
                            / {formatRupiah(s.target_nominal)} ({row.pct}%)
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white">
                          <div
                            className="h-full rounded-full bg-[#0C3328]"
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubId(s.id);
                            setCashTxType('setoran');
                            setCashNominal(String(s.setoran_nominal || 20000));
                            setCashNote('Setoran Tunai Jemput Bola');
                            setTxSubTab('input');
                            setTimeout(() => {
                              cashFormRef.current?.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                              });
                            }, 50);
                          }}
                          className="flex-1 rounded-lg bg-[#0C3328] py-1.5 text-[11px] font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                        >
                          1-Klik Setor
                        </button>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#E4DCCB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#15803D] hover:bg-emerald-50"
                        >
                          <MessageCircle className="h-3 w-3" />
                          Tagih WA
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
          )}

          {txSubTab === 'riwayat' && (
          /* Log Audit Transaksi Tervalidasi (Admin & Staff) */
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Log Audit Transaksi Tervalidasi ({verifiedTransactions.length})
                </h2>
                <p className="text-xs text-stone-500">
                  Seluruh mutasi setoran dan penarikan yang telah diverifikasi dan masuk ke buku tabungan member.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `audit-transaksi-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Tanggal', 'Member', 'Wilayah', 'Jenis', 'Metode', 'Nominal', 'Validator', 'Catatan'],
                    verifiedTransactions.map((d) => [
                      d.tanggal,
                      d.member_nama || d.member_id,
                      d.wilayah || '-',
                      getTxType(d),
                      getMethodLabel(d),
                      d.nominal,
                      d.validated_by || '-',
                      d.catatan || '',
                    ])
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV Transaksi</span>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Cari nama member, validator, atau catatan..."
                  className="w-full rounded-lg border border-stone-300 py-1.5 pl-8 pr-3 text-xs text-stone-900"
                />
              </div>
              <select
                value={auditTypeFilter}
                onChange={(e) => setAuditTypeFilter(e.target.value as 'all' | TransactionType)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
              >
                <option value="all">Semua Jenis</option>
                <option value="setoran">Hanya Setoran (+)</option>
                <option value="penarikan">Hanya Penarikan (-)</option>
              </select>
              <select
                value={auditWilayahFilter}
                onChange={(e) => setAuditWilayahFilter(e.target.value as 'all' | WilayahPriangan)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
              >
                <option value="all">Semua Wilayah</option>
                {WILAYAH_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {verifiedTransactions.length === 0 ? (
              <p className="mt-5 rounded-xl bg-stone-50 p-6 text-center text-xs text-stone-500">
                Tidak ada transaksi tervalidasi sesuai filter saat ini.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="py-2 pr-4 font-semibold">Tanggal</th>
                      <th className="py-2 pr-4 font-semibold">Member</th>
                      <th className="py-2 pr-4 font-semibold">Jenis &amp; Metode</th>
                      <th className="py-2 pr-4 font-semibold">Validator</th>
                      <th className="py-2 pr-4 text-right font-semibold">Nominal</th>
                      <th className="py-2 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {verifiedTransactions.slice(0, 60).map((d) => {
                      const isWithdraw = getTxType(d) === 'penarikan';
                      return (
                        <tr key={d.id} className="hover:bg-stone-50">
                          <td className="py-2.5 pr-4 font-mono-nums text-xs text-stone-700 whitespace-nowrap">
                            {d.tanggal}
                          </td>
                          <td className="py-2.5 pr-4">
                            <p className="text-xs font-semibold text-stone-900">
                              {d.member_nama || d.member_id}
                            </p>
                            <p className="text-[11px] text-stone-500">{d.wilayah || '-'}</p>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                isWithdraw
                                  ? 'bg-rose-50 text-rose-800'
                                  : 'bg-emerald-50 text-emerald-900'
                              }`}
                            >
                              {isWithdraw ? 'Penarikan' : 'Setoran'}
                            </span>
                            <span className="ml-2 text-xs text-stone-700">{getMethodLabel(d)}</span>
                            {d.catatan && (
                              <p className="text-[11px] text-stone-500">{d.catatan}</p>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-stone-700 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-800" />
                              {d.validated_by || 'Agen / Admin'}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 pr-4 text-right font-mono-nums text-xs font-bold whitespace-nowrap ${
                              isWithdraw ? 'text-rose-700' : 'text-emerald-900'
                            }`}
                          >
                            {isWithdraw ? '-' : '+'}
                            {formatRupiah(d.nominal)}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setReceiptDeposit(d)}
                                className="inline-flex items-center gap-1 rounded border border-[#E4DCCB] bg-[#FAF7F2] px-2 py-0.5 text-[11px] font-semibold text-[#381E5A] hover:bg-[#EFE8DA] cursor-pointer"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Struk PNG</span>
                              </button>
                              {d.bukti_foto_url && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewProof(d.bukti_foto_url || null)}
                                  className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
                                >
                                  Bukti
                                </button>
                              )}
                              {isAdmin && (
                                <>
                                  {confirmDeleteDepId === d.id ? (
                                    <span className="inline-flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDepositRecord(d.id)}
                                        className="rounded bg-rose-700 px-2 py-0.5 text-[11px] font-semibold text-white cursor-pointer"
                                      >
                                        Ya, Hapus
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteDepId(null)}
                                        className="text-[11px] text-stone-500 cursor-pointer"
                                      >
                                        Batal
                                      </button>
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteDepId(d.id)}
                                      className="text-stone-400 hover:text-rose-700 cursor-pointer"
                                      title="Hapus Log Transaksi"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* TAB 2: MANAJEMEN KONTRAK MEMBER */}
      {activeTab === 'kontrak' && (
        <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-5">
          <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                Manajemen Kontrak Tabungan Member ({filteredContracts.length})
              </h2>
              <p className="text-xs text-stone-600">
                Pantau progres pelunasan, token QR pengambilan, ubah status kontrak, atau koreksi saldo member.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={openOfflineRegistration}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#381E5A] px-3.5 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#492975] cursor-pointer"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Daftarkan Kontrak Member</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `kontrak-member-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Token QR', 'Member', 'Paket', 'Wilayah', 'Agen', 'Terkumpul', 'Target', 'Status'],
                    filteredContracts.map((s) => [
                      s.qr_code_token,
                      s.member_nama,
                      s.package_nama,
                      s.wilayah,
                      s.agen_nama || s.agen_kode || s.agen_id,
                      s.total_terkumpul,
                      s.target_nominal,
                      s.status,
                    ])
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3.5 py-2 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#0C3328]" />
                <span>Export CSV Kontrak</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                placeholder="Cari nama member, grup arisan, paket, token QR, atau kode agen..."
                className="w-full rounded-lg border border-stone-300 py-2 pl-8 pr-3 text-xs text-stone-900"
              />
            </div>
            <select
              value={contractStatusFilter}
              onChange={(e) =>
                setContractStatusFilter(e.target.value as 'all' | SubscriptionStatus)
              }
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="lunas">Lunas (Siap Ambil)</option>
              <option value="diambil">Sudah Diambil</option>
            </select>
            <select
              value={contractWilayahFilter}
              onChange={(e) =>
                setContractWilayahFilter(e.target.value as 'all' | WilayahPriangan)
              }
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              <option value="all">Semua Wilayah</option>
              {WILAYAH_LIST.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            {arisanGroups.length > 0 && (
              <select
                value={contractGroupFilter}
                onChange={(e) => setContractGroupFilter(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-[#381E5A]"
              >
                <option value="all">Semua Grup / Arisan ({arisanGroups.length})</option>
                {arisanGroups.map((g) => (
                  <option key={g} value={g}>
                    Grup: {g}
                  </option>
                ))}
              </select>
            )}
          </div>

          {contractGroupFilter !== 'all' && filteredContracts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#C8A053]/60 bg-[#FAF7F2] px-4 py-3 text-xs">
              <div>
                <p className="font-bold text-[#381E5A]">
                  Grup Terhubung: {contractGroupFilter} ({filteredContracts.length} Kontrak)
                </p>
                <p className="font-mono-nums text-stone-600">
                  Total Terkumpul:{' '}
                  <strong className="text-[#0C3328]">
                    {formatRupiah(
                      filteredContracts.reduce((acc, s) => acc + (s.total_terkumpul || 0), 0)
                    )}
                  </strong>{' '}
                  /{' '}
                  {formatRupiah(
                    filteredContracts.reduce((acc, s) => acc + (s.target_nominal || 0), 0)
                  )}
                </p>
              </div>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(
                  `*Rekap Tabungan Grup "${contractGroupFilter}" — Sagitarius Parcel*\n` +
                    filteredContracts
                      .map(
                        (s, idx) =>
                          `${idx + 1}. ${s.member_nama} (${s.package_nama}): ${formatRupiah(
                            s.total_terkumpul
                          )} / ${formatRupiah(s.target_nominal)}`
                      )
                      .join('\n')
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#15803D]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Bagikan Rekap WA Grup</span>
              </a>
            </div>
          )}

          {filteredContracts.length === 0 ? (
            <p className="rounded-xl bg-stone-50 p-8 text-center text-sm text-stone-500">
              Tidak ada kontrak member yang cocok dengan filter pencarian.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 pr-4 font-semibold">Member &amp; Token QR</th>
                    <th className="py-2.5 pr-4 font-semibold">Paket, Grup &amp; Wilayah</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Terkumpul / Target</th>
                    <th className="py-2.5 pr-4 font-semibold">Status &amp; Pengiriman</th>
                    {isAdmin && <th className="py-2.5 text-right font-semibold">Aksi Admin</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredContracts.map((s) => {
                    const pct = Math.min(
                      100,
                      Math.round(((s.total_terkumpul || 0) / s.target_nominal) * 100)
                    );
                    const isEditingBal = editingBalanceSubId === s.id;
                    const currentStage: DeliveryStage =
                      s.status_pengiriman ||
                      (s.status === 'diambil'
                        ? 'selesai'
                        : s.status === 'lunas'
                          ? 'siap_diambil'
                          : 'menunggu_lunas');
                    return (
                      <tr key={s.id} className="hover:bg-stone-50">
                        <td className="py-3 pr-4">
                          <p className="text-xs font-bold text-stone-900">{s.member_nama}</p>
                          <p className="font-mono-nums text-[11px] text-emerald-900">
                            {s.qr_code_token}
                          </p>
                        </td>
                        <td className="py-3 pr-4">
                          <p className="text-xs font-semibold text-stone-900">{s.package_nama}</p>
                          <p className="text-[11px] text-stone-500">
                            {s.wilayah} · Agen: {s.agen_nama || s.agen_kode || s.agen_id}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {s.grup_arisan && (
                              <span className="inline-flex items-center gap-1 rounded bg-[#381E5A]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#381E5A]">
                                <Layers className="h-2.5 w-2.5" />
                                {s.grup_arisan}
                              </span>
                            )}
                            {s.kode_referral_agen && (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 font-mono-nums text-[10px] font-semibold text-amber-900">
                                Ref: {s.kode_referral_agen}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-right whitespace-nowrap">
                          {isEditingBal ? (
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                value={editBalanceValue}
                                onChange={(e) => setEditBalanceValue(e.target.value)}
                                className="w-28 rounded border border-stone-300 px-2 py-1 font-mono-nums text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveManualBalance(s)}
                                className="rounded bg-emerald-900 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                              >
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBalanceSubId(null)}
                                className="text-[11px] text-stone-500 cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="font-mono-nums text-xs font-bold text-emerald-900">
                                {formatRupiah(s.total_terkumpul)}
                              </p>
                              <p className="font-mono-nums text-[11px] text-stone-500">
                                / {formatRupiah(s.target_nominal)} ({pct}%)
                              </p>
                            </>
                          )}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1.5">
                            {isAdmin ? (
                              <select
                                value={s.status}
                                onChange={(e) =>
                                  handleUpdateContractStatus(
                                    s,
                                    e.target.value as SubscriptionStatus
                                  )
                                }
                                className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold text-stone-900"
                              >
                                <option value="aktif">Aktif</option>
                                <option value="lunas">Lunas</option>
                                <option value="diambil">Sudah Diambil</option>
                              </select>
                            ) : (
                              <span className="text-xs font-semibold uppercase text-stone-800">
                                {s.status}
                              </span>
                            )}
                            <select
                              value={currentStage}
                              disabled={!isAdmin && s.status === 'diambil'}
                              onChange={(e) =>
                                handleUpdateDeliveryStage(s, e.target.value as DeliveryStage)
                              }
                              aria-label={`Status pengiriman ${s.member_nama}`}
                              className="rounded-md border border-[#E4DCCB] bg-[#FAF7F2] px-2 py-1 text-[11px] font-semibold text-[#0C3328] disabled:opacity-60"
                            >
                              {DELIVERY_STAGE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                        {isAdmin && (
                          <td className="py-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingBalanceSubId(s.id);
                                  setEditBalanceValue(String(s.total_terkumpul || 0));
                                }}
                                className="inline-flex items-center gap-1 rounded border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                              >
                                <Edit3 className="h-3 w-3" />
                                Koreksi Saldo
                              </button>

                              {confirmDeleteSubId === s.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteContract(s.id)}
                                    className="rounded bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                                  >
                                    Ya, Hapus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSubId(null)}
                                    className="text-[11px] text-stone-500 cursor-pointer"
                                  >
                                    Batal
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteSubId(s.id)}
                                  className="rounded p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                                  title="Hapus Kontrak"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KATALOG PAKET & DIREKTORI AGEN MASTER (ADMIN ONLY) */}
      {activeTab === 'master' && isAdmin && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
            <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMasterSubTab('packages')}
                className={`rounded-md px-4 py-1.5 font-semibold cursor-pointer ${
                  masterSubTab === 'packages'
                    ? 'bg-emerald-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Katalog Paket ({packages.length})
              </button>
              <button
                type="button"
                onClick={() => setMasterSubTab('agents')}
                className={`rounded-md px-4 py-1.5 font-semibold cursor-pointer ${
                  masterSubTab === 'agents'
                    ? 'bg-emerald-900 text-white'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Direktori Agen ({agents.length})
              </button>
            </div>

            {masterSubTab === 'packages' ? (
              <button
                type="button"
                onClick={openCreatePackageForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#26124A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#341A63] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Paket Katalog
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateAgentForm}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#26124A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#341A63] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah Agen Wilayah
              </button>
            )}
          </div>

          {masterSubTab === 'packages' ? (
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={pkgSearch}
                    onChange={(e) => setPkgSearch(e.target.value)}
                    placeholder="Cari nama paket atau sub-kategori..."
                    className="w-full rounded-lg border border-stone-300 py-2 pl-8 pr-3 text-xs text-stone-900"
                  />
                </div>
                <select
                  value={pkgCatFilter}
                  onChange={(e) => setPkgCatFilter(e.target.value as 'all' | PackageCategory)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="bunda">Paket Bunda</option>
                  <option value="anak">Paket Anak</option>
                  <option value="pilihan">Paket Pilihan</option>
                  <option value="uang">Paket Uang</option>
                  <option value="satuan">Barang Satuan</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="py-2.5 pr-4 font-semibold">Nama Paket</th>
                      <th className="py-2.5 pr-4 font-semibold">Kategori</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Harian</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Total Target</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Bonus THR</th>
                      <th className="py-2.5 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filteredMasterPackages.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-4">
                          <p className="text-xs font-bold text-stone-900">{p.nama_paket}</p>
                          <p className="text-[11px] text-stone-500">
                            {p.daftar_isi.length} item · {p.jadwal_ambil}
                          </p>
                        </td>
                        <td className="py-2.5 pr-4 text-xs uppercase font-semibold text-[#26124A]">
                          {p.kategori}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono-nums text-xs">
                          {formatRupiah(p.setoran_harian)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono-nums text-xs font-bold text-emerald-900">
                          {formatRupiah(p.harga_total)}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono-nums text-xs text-amber-800">
                          {p.bonus_thr > 0 ? formatRupiah(p.bonus_thr) : '—'}
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditPackageForm(p)}
                              className="inline-flex items-center gap-1 rounded border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                            {confirmDeletePkgId === p.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeletePackage(p.id)}
                                  className="rounded bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePkgId(null)}
                                  className="text-[11px] text-stone-500 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePkgId(p.id)}
                                className="rounded p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                                title="Hapus Paket"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-xs text-stone-500">
                      <th className="py-2.5 pr-4 font-semibold">Kode</th>
                      <th className="py-2.5 pr-4 font-semibold">Nama Agen</th>
                      <th className="py-2.5 pr-4 font-semibold">Wilayah &amp; Kecamatan</th>
                      <th className="py-2.5 pr-4 font-semibold">WhatsApp</th>
                      <th className="py-2.5 pr-4 text-right font-semibold">Member</th>
                      <th className="py-2.5 pr-4 font-semibold">Status</th>
                      <th className="py-2.5 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {agents.map((a) => (
                      <tr key={a.id} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-4 font-mono-nums text-xs font-bold text-[#26124A]">
                          {a.kode_agen}
                        </td>
                        <td className="py-2.5 pr-4 text-xs font-semibold text-stone-900">
                          {a.nama}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-stone-600">
                          {a.wilayah} · {a.kecamatan}
                        </td>
                        <td className="py-2.5 pr-4 font-mono-nums text-xs text-stone-700">
                          {a.no_wa}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono-nums text-xs">
                          {a.jumlah_member}
                        </td>
                        <td className="py-2.5 pr-4">
                          <button
                            type="button"
                            onClick={() => handleToggleAgentActive(a)}
                            className={`rounded px-2 py-0.5 text-[11px] font-semibold cursor-pointer ${
                              a.aktif
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {a.aktif ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditAgentForm(a)}
                              className="inline-flex items-center gap-1 rounded border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                            {confirmDeleteAgentId === a.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAgent(a.id)}
                                  className="rounded bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteAgentId(null)}
                                  className="text-[11px] text-stone-500 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteAgentId(a.id)}
                                className="rounded p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                                title="Hapus Agen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: KOMISI OTOMATIS & REKAP KORWIL */}
      {activeTab === 'korwil' && (
        <div className="space-y-5">
          {/* Sub-Tab Navigasi Komisi & Setoran Kas */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setKorwilSubTab('tutup_kas')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  korwilSubTab === 'tutup_kas'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Tutup Kas &amp; Pencairan ({agentSettlements.length})
              </button>
              <button
                type="button"
                onClick={() => setKorwilSubTab('wilayah')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  korwilSubTab === 'wilayah'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Rekap Wilayah &amp; Komisi 7%
              </button>
              <button
                type="button"
                onClick={() => setKorwilSubTab('referral')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  korwilSubTab === 'referral'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Link QR &amp; Leaderboard
              </button>
            </div>
          </div>

          {korwilSubTab === 'wilayah' && (
          <div className="space-y-5">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-900" />
                <h2 className="font-display text-xl font-bold text-stone-900">
                  Rekapitulasi Wilayah Korwil Priangan Timur
                </h2>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `rekap-korwil-priangan-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Wilayah', 'Agen Aktif', 'Member Binaan', 'Kontrak Live', 'Target Total', 'Dana Terkumpul', 'Estimasi Komisi'],
                    korwilRecap.map((r) => [
                      r.wilayah,
                      r.agentCount,
                      r.totalMembers,
                      r.contractCount,
                      r.totalTarget,
                      r.totalCollected,
                      r.totalCommission,
                    ])
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV Wilayah</span>
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 pr-4 font-semibold">Wilayah</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Agen</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Member Binaan</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Kontrak Live</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Progres</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Dana Terkumpul</th>
                    <th className="py-2.5 text-right font-semibold">Estimasi Komisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {korwilRecap.map((row) => (
                    <tr key={row.wilayah} className="hover:bg-stone-50">
                      <td className="py-3 pr-4 font-semibold text-stone-900">{row.wilayah}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums">{row.agentCount}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums">{row.totalMembers}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums">{row.contractCount}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums text-xs text-stone-600">
                        {row.pct}%
                      </td>
                      <td className="py-3 pr-4 text-right font-mono-nums font-semibold text-emerald-900">
                        {formatRupiah(row.totalCollected)}
                      </td>
                      <td className="py-3 text-right font-mono-nums font-semibold text-amber-800">
                        {formatRupiah(row.totalCommission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-700" />
                  <h2 className="font-display text-xl font-bold text-stone-900">
                    Perhitungan Komisi Agen Otomatis (s.d. 7%)
                  </h2>
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  Tier komisi dihitung otomatis berdasarkan jumlah member binaan: &lt;10 member (4%), 10–24 member (5.5%), dan 25+ member (7%).
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `komisi-agen-sagitarius-${new Date().toISOString().slice(0, 10)}.csv`,
                    ['Kode Agen', 'Nama Agen', 'Wilayah', 'Member Binaan', 'Tier (%)', 'Dana Terkumpul', 'Komisi'],
                    agentCommissionSummary.map((a) => [
                      a.kode_agen,
                      a.nama,
                      a.wilayah,
                      a.totalMembers,
                      a.rate,
                      a.liveCollected,
                      a.commissionEarned,
                    ])
                  )
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV Komisi</span>
              </button>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 pr-4 font-semibold">Kode Agen</th>
                    <th className="py-2.5 pr-4 font-semibold">Nama Agen</th>
                    <th className="py-2.5 pr-4 font-semibold">Wilayah</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Member Binaan</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Tier Komisi</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Setoran Terkumpul</th>
                    <th className="py-2.5 text-right font-semibold">Komisi Didapat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {agentCommissionSummary.map((a) => (
                    <tr key={a.id} className="hover:bg-stone-50">
                      <td className="py-3 pr-4 font-mono-nums text-xs font-semibold text-emerald-900">
                        {a.kode_agen}
                      </td>
                      <td className="py-3 pr-4 font-medium text-stone-900">{a.nama}</td>
                      <td className="py-3 pr-4 text-stone-600">{a.wilayah}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums">{a.totalMembers}</td>
                      <td className="py-3 pr-4 text-right font-mono-nums font-semibold text-stone-900">
                        {a.rate}%
                      </td>
                      <td className="py-3 pr-4 text-right font-mono-nums">
                        {formatRupiah(a.liveCollected)}
                      </td>
                      <td className="py-3 text-right font-mono-nums font-bold text-emerald-900">
                        {formatRupiah(a.commissionEarned)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </div>
          )}

          {korwilSubTab === 'tutup_kas' && (
          /* Tutup Kas Setor Tunai Agen -> Pusat & Klaim Pencairan Komisi */
          <div className="grid gap-5 lg:grid-cols-12">
            <form
              onSubmit={handleCreateSettlement}
              className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-5"
            >
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-900" />
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Tutup Kas Agen &amp; Klaim Komisi
                </h2>
              </div>
              <p className="text-xs text-stone-600">
                Laporkan penyetoran uang tunai kolektif ke kas pusat atau ajukan pencairan komisi agen untuk diverifikasi Admin Pusat.
              </p>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Jenis Pengajuan</label>
                <select
                  value={settleJenis}
                  onChange={(e) => {
                    const val = e.target.value as AgentSettlementType;
                    setSettleJenis(val);
                    setSettleCatatan(
                      val === 'setor_tunai_pusat'
                        ? 'Setoran tunai kolektif member binaan'
                        : 'Klaim pencairan komisi agen wilayah'
                    );
                  }}
                  className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                >
                  <option value="setor_tunai_pusat">Setor Tunai Agen ke Pusat</option>
                  <option value="pencairan_komisi">Klaim Pencairan Komisi Agen</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Nominal (Rp)</label>
                <input
                  type="number"
                  min={1000}
                  step={1000}
                  required
                  value={settleNominal}
                  onChange={(e) => setSettleNominal(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">Catatan / Ref Transfer</label>
                <input
                  type="text"
                  maxLength={250}
                  value={settleCatatan}
                  onChange={(e) => setSettleCatatan(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettlement}
                className="w-full rounded-lg bg-[#0C3328] py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
              >
                {savingSettlement ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan Tutup Kas / Komisi'}
              </button>
            </form>

            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7">
              <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-stone-900">
                    Riwayat Setor Kas &amp; Pencairan Komisi ({agentSettlements.length})
                  </h3>
                  <p className="text-xs text-stone-600">
                    Validasi Admin Pusat atas setoran kas agen dan pencairan komisi resmi.
                  </p>
                </div>
              </div>

              {agentSettlements.length === 0 ? (
                <p className="mt-6 rounded-xl bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
                  Belum ada riwayat tutup kas atau klaim pencairan komisi.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E4DCCB] text-stone-500">
                        <th className="py-2 pr-3 font-semibold">Tanggal &amp; Agen</th>
                        <th className="py-2 pr-3 font-semibold">Jenis &amp; Catatan</th>
                        <th className="py-2 pr-3 text-right font-semibold">Nominal</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        {isAdmin && <th className="py-2 text-right font-semibold">Validasi Admin</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {agentSettlements.map((st) => (
                        <tr key={st.id} className="hover:bg-[#FAF7F2]/60">
                          <td className="py-2.5 pr-3">
                            <p className="font-mono-nums font-semibold text-stone-800">{st.tanggal}</p>
                            <p className="text-[11px] text-stone-500">
                              {st.agen_nama} ({st.wilayah})
                            </p>
                          </td>
                          <td className="py-2.5 pr-3">
                            <p className="font-bold text-[#381E5A]">
                              {st.jenis === 'setor_tunai_pusat'
                                ? 'Setor Tunai Pusat'
                                : 'Pencairan Komisi'}
                            </p>
                            {st.catatan && <p className="text-[11px] text-stone-500">{st.catatan}</p>}
                          </td>
                          <td className="py-2.5 pr-3 text-right font-mono-nums font-bold text-[#0C3328] whitespace-nowrap">
                            {formatRupiah(st.nominal)}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                                st.status === 'verified'
                                  ? 'bg-emerald-100 text-emerald-900'
                                  : st.status === 'rejected'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {st.status}
                            </span>
                            {st.validated_by && (
                              <p className="mt-0.5 text-[10px] text-stone-500">
                                oleh {st.validated_by}
                              </p>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {st.status === 'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleVerifySettlement(st, 'verified')}
                                      className="rounded bg-[#0C3328] px-2 py-1 text-[10px] font-bold text-[#E8CA82] cursor-pointer"
                                    >
                                      Validasi
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleVerifySettlement(st, 'rejected')}
                                      className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-700 cursor-pointer"
                                    >
                                      Tolak
                                    </button>
                                  </>
                                )}
                                {confirmDeleteSettleId === st.id ? (
                                  <span className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteSettlement(st.id)}
                                      className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                                    >
                                      Hapus
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteSettleId(null)}
                                      className="text-[10px] text-stone-500 cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteSettleId(st.id)}
                                    className="p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                                    title="Hapus"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          )}

          {korwilSubTab === 'referral' && (
          /* Link & QR Pendaftaran Khusus Agen + Leaderboard Agen */
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-emerald-900" />
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Link &amp; QR Pendaftaran Agen
                </h2>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                Bagikan link atau QR Code ini ke calon member agar nama Anda otomatis terpilih saat mereka mendaftar paket.
              </p>

              {isAdmin && agents.length > 0 && (
                <div className="mt-3">
                  <label className="block text-[11px] font-semibold text-stone-600">
                    Pilih Agen
                  </label>
                  <select
                    value={referralAgentCode}
                    onChange={(e) => setReferralAgentCode(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.kode_agen}>
                        {a.kode_agen} — {a.nama} ({a.wilayah})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(() => {
                const origin =
                  typeof window !== 'undefined'
                    ? window.location.origin
                    : 'https://www.sagitariusparcel.web.id';
                const activeCode = referralAgentCode || agents[0]?.kode_agen || 'AGT-TSM-01';
                const referralUrl = `${origin}/?agen=${encodeURIComponent(activeCode)}`;
                return (
                  <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 sm:flex-row">
                    <div className="shrink-0 rounded-xl border border-[#E4DCCB] bg-white p-2.5">
                      <QRCodeSVG value={referralUrl} size={108} />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <p className="font-mono-nums text-[11px] font-bold text-[#0C3328]">
                        Kode Agen: {activeCode}
                      </p>
                      <p className="break-all rounded border border-[#E4DCCB] bg-white px-2.5 py-1.5 font-mono-nums text-[11px] text-stone-700">
                        {referralUrl}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(referralUrl);
                            setCopiedRefLink(true);
                            setTimeout(() => setCopiedRefLink(false), 2000);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#381E5A] px-3 py-1.5 text-[11px] font-bold text-[#E8CA82] hover:bg-[#492975] cursor-pointer"
                        >
                          {copiedRefLink ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          <span>{copiedRefLink ? 'Tersalin!' : 'Salin Link'}</span>
                        </button>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(
                            `Assalamu'alaikum, yuk persiapkan Parcel & Tabungan Lebaran Sagitarius Parcel bersama saya (${activeCode}). Lihat katalog & daftar langsung melalui link resmi ini: ${referralUrl}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#15803D]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>Bagikan WA</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-700" />
                  <div>
                    <h2 className="font-display text-lg font-bold text-stone-900">
                      Leaderboard Agen &amp; Progres Tier Komisi
                    </h2>
                    <p className="text-xs text-stone-600">
                      Peringkat setoran terkumpul &amp; jarak menuju tier komisi 5.5% (10 member) atau 7% (25 member).
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2.5">
                {agentLeaderboard.slice(0, 6).map((row) => (
                  <div
                    key={row.id}
                    className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full font-mono-nums text-[11px] font-bold ${
                            row.rank === 1
                              ? 'bg-[#C8A053] text-[#1D122B]'
                              : row.rank === 2
                                ? 'bg-stone-300 text-stone-900'
                                : row.rank === 3
                                  ? 'bg-amber-700 text-white'
                                  : 'bg-white text-stone-700 border border-stone-200'
                          }`}
                        >
                          #{row.rank}
                        </span>
                        <div>
                          <p className="font-bold text-[#381E5A]">
                            {row.nama}{' '}
                            <span className="font-mono-nums text-[11px] font-normal text-stone-500">
                              ({row.kode_agen} · {row.wilayah})
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="text-right font-mono-nums">
                        <p className="font-bold text-[#0C3328]">{formatRupiah(row.liveCollected)}</p>
                        <p className="text-[11px] text-stone-600">
                          Tier {row.rate}% · Komisi {formatRupiah(row.commissionEarned)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-[#0C3328]"
                          style={{ width: `${row.tierPct}%` }}
                        />
                      </div>
                      <span className="font-mono-nums font-semibold text-stone-600">
                        {row.totalMembers >= 25
                          ? `${row.totalMembers} Member (Tier Maks 7%)`
                          : `${row.totalMembers}/${row.nextTierTarget} menuju ${row.nextTierRate}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {/* TAB 5: GUDANG & LOGISTIK H-7 / H-2 + STOK HPP + MANIFEST + SUBSTITUSI + QR */}
      {activeTab === 'gudang' && (
        <div className="space-y-5">
          {/* Sub-Tab Navigasi Gudang & Pengiriman */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
            <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-200 bg-stone-50 p-1">
              <button
                type="button"
                onClick={() => setGudangSubTab('kebutuhan')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  gudangSubTab === 'kebutuhan'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Kebutuhan &amp; Scan QR ({warehouseRecap.readyToPickSubs.length} Siap)
              </button>
              <button
                type="button"
                onClick={() => setGudangSubTab('manifest')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  gudangSubTab === 'manifest'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Surat Jalan &amp; Manifest ({manifestGroups.length})
              </button>
              <button
                type="button"
                onClick={() => setGudangSubTab('stok')}
                className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  gudangSubTab === 'stok'
                    ? 'bg-emerald-900 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Stok Modal HPP &amp; Substitusi ({warehouseInventory.length})
              </button>
            </div>
          </div>

          {gudangSubTab === 'kebutuhan' && (
          <div className="grid gap-5 lg:grid-cols-12">
            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Boxes className="h-5 w-5 text-emerald-900" />
                    <h2 className="font-display text-xl font-bold text-stone-900">
                      Rekap Kebutuhan Barang vs Stok Gudang
                    </h2>
                  </div>
                  <p className="mt-0.5 font-mono-nums text-xs font-semibold text-amber-800">
                    Total Alokasi Bonus THR: {formatRupiah(warehouseRecap.totalThrBonus)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={warehouseScheduleFilter}
                    onChange={(e) => setWarehouseScheduleFilter(e.target.value)}
                    className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                  >
                    <option value="all">Semua Jadwal</option>
                    <option value="15 Ramadhan">15 Ramadhan</option>
                    <option value="H-7">H-7 Lebaran</option>
                    <option value="H-2">H-2 Idul Fitri (Daging/Telur)</option>
                    <option value="Lebih Awal">Paket Uang (Lebih Awal)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `logistik-gudang-${new Date().toISOString().slice(0, 10)}.csv`,
                        ['Komoditas / Item', 'Jadwal Distribusi', 'Kebutuhan', 'Stok Gudang', 'Selisih Belanja'],
                        warehouseRecap.rows.map((r) => [
                          r.item,
                          r.jadwal,
                          r.qty,
                          r.stokTersedia ?? '-',
                          r.selisihBelanja ?? '-',
                        ])
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    CSV
                  </button>
                </div>
              </div>

              {warehouseRecap.rows.length === 0 ? (
                <p className="mt-6 rounded-xl bg-stone-50 p-6 text-center text-sm text-stone-500">
                  Belum ada kontrak aktif sesuai filter jadwal untuk direkap ke daftar kebutuhan gudang.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-xs text-stone-500">
                        <th className="py-2.5 pr-4 font-semibold">Nama Item / Komoditas</th>
                        <th className="py-2.5 pr-4 font-semibold">Jadwal</th>
                        <th className="py-2.5 pr-4 text-right font-semibold">Butuh</th>
                        <th className="py-2.5 pr-4 text-right font-semibold">Stok Gudang</th>
                        <th className="py-2.5 text-right font-semibold">Kurang / Beli</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {warehouseRecap.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-stone-50">
                          <td className="py-2.5 pr-4 font-medium text-stone-900">{r.item}</td>
                          <td className="py-2.5 pr-4 text-xs text-stone-600">{r.jadwal}</td>
                          <td className="py-2.5 pr-4 text-right font-mono-nums font-bold text-emerald-900">
                            {r.qty}x
                          </td>
                          <td className="py-2.5 pr-4 text-right font-mono-nums text-xs text-stone-700">
                            {r.stokTersedia !== null ? `${r.stokTersedia}` : '—'}
                          </td>
                          <td className="py-2.5 text-right font-mono-nums text-xs font-bold">
                            {r.selisihBelanja === null ? (
                              <span className="text-stone-400">—</span>
                            ) : r.selisihBelanja === 0 ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">
                                Aman
                              </span>
                            ) : (
                              <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-800">
                                Kurang {r.selisihBelanja}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-5 lg:col-span-4">
              <form
                onSubmit={handleMarkQrPickedUp}
                className="rounded-xl border border-stone-200 bg-white p-5"
              >
                <div className="flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-emerald-900" />
                  <h3 className="font-display text-lg font-bold text-stone-900">
                    Verifikasi Tiket QR Pengambilan
                  </h3>
                </div>
                <p className="mt-1 text-xs text-stone-600">
                  Scan kamera atau masukkan kode token QR dari HP member berstatus Lunas untuk menandai paket telah diambil.
                </p>

                <QrCameraScanner
                  onScan={(code) => {
                    setQrInput(code.toUpperCase());
                    setStatusMessage(
                      `QR terdeteksi: ${code.toUpperCase()}. Klik "Konfirmasi Pengambilan Paket" untuk menyelesaikan serah terima.`
                    );
                  }}
                />

                <input
                  type="text"
                  required
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  placeholder="Contoh: SGT-CIA-M2X9A"
                  className="mt-3 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900 uppercase"
                />
                <button
                  type="submit"
                  className="mt-3 w-full rounded-lg bg-[#0C3328] py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                >
                  Konfirmasi Pengambilan Paket
                </button>

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-xs">
                  <div>
                    <p className="text-stone-500">Siap Diambil (Lunas)</p>
                    <p className="mt-0.5 font-mono-nums text-lg font-bold text-emerald-900">
                      {warehouseRecap.readyToPickSubs.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-stone-500">Sudah Diambil</p>
                    <p className="mt-0.5 font-mono-nums text-lg font-bold text-stone-900">
                      {warehouseRecap.pickedUpCount}
                    </p>
                  </div>
                </div>
              </form>

              {warehouseRecap.readyToPickSubs.length > 0 && (
                <div className="rounded-xl border border-stone-200 bg-white p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-stone-700">
                    Antrean Paket Lunas Siap Ambil
                  </h4>
                  <div className="mt-3 divide-y divide-stone-100">
                    {warehouseRecap.readyToPickSubs.slice(0, 8).map((s) => (
                      <div key={s.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                        <div>
                          <p className="font-semibold text-stone-900">{s.member_nama}</p>
                          <p className="font-mono-nums text-[11px] text-emerald-800">
                            {s.qr_code_token}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setQrInput(s.qr_code_token)}
                          className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                        >
                          Pilih Token
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {gudangSubTab === 'manifest' && (
          /* Surat Jalan & Manifest Pengiriman per Wilayah / Agen */
          <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex flex-col gap-3 border-b border-stone-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-900" />
                <div>
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Surat Jalan &amp; Manifest Pengiriman
                  </h2>
                  <p className="text-xs text-stone-600">
                    Kelompokkan distribusi parcel berdasarkan Wilayah Korwil atau Agen penanggung jawab, lalu perbarui tahap pengiriman secara massal.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={manifestGroupBy}
                  onChange={(e) => setManifestGroupBy(e.target.value as 'wilayah' | 'agen')}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800"
                >
                  <option value="wilayah">Kelompok: Per Wilayah</option>
                  <option value="agen">Kelompok: Per Agen</option>
                </select>
                <label className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={manifestOnlyPending}
                    onChange={(e) => setManifestOnlyPending(e.target.checked)}
                    className="h-3.5 w-3.5 rounded text-[#0C3328]"
                  />
                  <span>Hanya Belum Selesai</span>
                </label>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3 py-1.5 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer no-print"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Cetak Manifest</span>
                </button>
              </div>
            </div>

            {manifestGroups.length === 0 ? (
              <p className="rounded-xl bg-[#FAF7F2] p-6 text-center text-xs text-stone-500">
                Tidak ada daftar paket yang perlu dimanifest saat ini.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {manifestGroups.map((grp) => (
                  <div
                    key={grp.label}
                    className="flex flex-col justify-between rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-[#381E5A]">{grp.label}</h3>
                          <p className="font-mono-nums text-[11px] text-stone-600">
                            {grp.subs.length} Parcel · Nilai {formatRupiah(grp.totalNilai)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            downloadCsv(
                              `surat-jalan-${grp.label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}.csv`,
                              ['Token QR', 'Member', 'Paket', 'Agen', 'Wilayah', 'Jadwal', 'Status Pengiriman'],
                              grp.subs.map((s) => [
                                s.qr_code_token,
                                s.member_nama,
                                s.package_nama,
                                s.agen_nama || s.agen_kode || '-',
                                s.wilayah,
                                s.jadwal_ambil || '-',
                                s.status_pengiriman || 'menunggu_lunas',
                              ])
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-[#E4DCCB] bg-white px-2.5 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                        >
                          <Download className="h-3 w-3" />
                          <span>CSV</span>
                        </button>
                      </div>

                      <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1 text-xs">
                        {grp.subs.map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#E4DCCB]/80 bg-white px-2.5 py-1.5"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-stone-900">
                                {s.member_nama}
                              </p>
                              <p className="truncate font-mono-nums text-[10px] text-stone-500">
                                {s.qr_code_token} · {s.package_nama}
                              </p>
                            </div>
                            <span className="shrink-0 rounded bg-[#0C3328]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#0C3328]">
                              {DELIVERY_STAGE_OPTIONS.find(
                                (o) => o.value === (s.status_pengiriman || 'menunggu_lunas')
                              )?.label || 'Menunggu'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#E4DCCB] pt-3 no-print">
                      <button
                        type="button"
                        onClick={() => handleBatchAdvanceDelivery(grp.subs, 'dikemas_gudang')}
                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-bold text-stone-800 hover:bg-stone-100 cursor-pointer"
                      >
                        Set: Dikemas Gudang
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchAdvanceDelivery(grp.subs, 'kirim_korwil')}
                        className="rounded-lg border border-stone-300 bg-white px-2.5 py-1 text-[10px] font-bold text-[#381E5A] hover:bg-stone-100 cursor-pointer"
                      >
                        Set: Kirim Korwil/Agen
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBatchAdvanceDelivery(grp.subs, 'siap_diambil')}
                        className="rounded-lg bg-[#0C3328] px-2.5 py-1 text-[10px] font-bold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                      >
                        Set: Siap Diambil
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}

          {gudangSubTab === 'stok' && (
          /* Stok Gudang HPP & Pengumuman Substitusi Produk Resmi */
          <div className="grid gap-5 lg:grid-cols-12">
            {/* Stok Gudang & HPP (Admin CRUD) */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-emerald-900" />
                <div>
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Stok Gudang &amp; Harga Beli (HPP) ({warehouseInventory.length})
                  </h2>
                  <p className="text-xs text-stone-600">
                    Dipakai otomatis untuk menghitung kekurangan belanja gudang dan margin bersih paket di tab Analitik.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleSaveInventoryItem}
                  className="grid gap-2.5 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 sm:grid-cols-2"
                >
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={invNama}
                    onChange={(e) => setInvNama(e.target.value)}
                    placeholder="Nama Komoditas (mis: Beras Premium 5Kg)"
                    className="sm:col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <input
                    type="number"
                    min={0}
                    required
                    value={invStok}
                    onChange={(e) => setInvStok(e.target.value)}
                    placeholder="Stok Tersedia"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-mono-nums text-xs text-stone-900"
                  />
                  <input
                    type="number"
                    min={0}
                    required
                    value={invHarga}
                    onChange={(e) => setInvHarga(e.target.value)}
                    placeholder="Harga Beli Satuan (Rp)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 font-mono-nums text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    required
                    maxLength={30}
                    value={invSatuan}
                    onChange={(e) => setInvSatuan(e.target.value)}
                    placeholder="Satuan (unit/dus/sak)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    maxLength={200}
                    value={invCatatan}
                    onChange={(e) => setInvCatatan(e.target.value)}
                    placeholder="Catatan supplier (opsional)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      type="submit"
                      disabled={savingInv}
                      className="flex-1 rounded-lg bg-[#0C3328] py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
                    >
                      {savingInv
                        ? 'Menyimpan...'
                        : invEditId
                          ? 'Simpan Perubahan Stok'
                          : 'Tambah / Catat Stok Gudang'}
                    </button>
                    {invEditId && (
                      <button
                        type="button"
                        onClick={() => {
                          setInvEditId(null);
                          setInvNama('');
                          setInvStok('100');
                          setInvHarga('45000');
                          setInvSatuan('unit');
                          setInvCatatan('');
                        }}
                        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer"
                      >
                        Batal
                      </button>
                    )}
                  </div>
                </form>
              )}

              {warehouseInventory.length === 0 ? (
                <p className="rounded-xl bg-[#FAF7F2] p-5 text-center text-xs text-stone-500">
                  Belum ada data stok &amp; harga beli modal gudang yang dicatat.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 text-xs">
                  {warehouseInventory.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-bold text-stone-900">{w.item_nama}</p>
                        <p className="font-mono-nums text-[11px] text-stone-600">
                          Stok: <strong className="text-[#0C3328]">{w.stok_tersedia}</strong>{' '}
                          {w.satuan} · Beli: {formatRupiah(w.harga_beli_satuan)}
                        </p>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setInvEditId(w.id);
                              setInvNama(w.item_nama);
                              setInvStok(String(w.stok_tersedia));
                              setInvHarga(String(w.harga_beli_satuan));
                              setInvSatuan(w.satuan);
                              setInvCatatan(w.catatan || '');
                            }}
                            className="rounded border border-stone-200 px-2 py-1 text-[11px] font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
                          >
                            Edit
                          </button>
                          {confirmDeleteInvId === w.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteInventoryItem(w.id)}
                                className="rounded bg-rose-700 px-2 py-1 text-[11px] font-bold text-white cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteInvId(null)}
                                className="text-[11px] text-stone-500 cursor-pointer"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteInvId(w.id)}
                              className="p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pengumuman Substitusi Produk Resmi */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-6 space-y-4">
              <div className="flex items-center gap-2">
                <Replace className="h-5 w-5 text-amber-700" />
                <div>
                  <h2 className="font-display text-lg font-bold text-stone-900">
                    Info Substitusi Produk Resmi ({productSubstitutions.length})
                  </h2>
                  <p className="text-xs text-stone-600">
                    Jika stok merek barang tertentu kosong di pasar, umumkan penggantian bernilai setara agar langsung tampil transparan di Dashboard Member.
                  </p>
                </div>
              </div>

              {isAdmin && (
                <form
                  onSubmit={handleCreateSubstitutionNotice}
                  className="grid gap-2.5 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 sm:grid-cols-2"
                >
                  <select
                    value={subNoticePkgId}
                    onChange={(e) => setSubNoticePkgId(e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-900"
                  >
                    <option value="all">Semua Paket yang Memuat Produk Ini</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nama_paket}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={subNoticeLama}
                    onChange={(e) => setSubNoticeLama(e.target.value)}
                    placeholder="Produk Lama (mis: Sirup ABC Squash)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={subNoticeBaru}
                    onChange={(e) => setSubNoticeBaru(e.target.value)}
                    placeholder="Pengganti Setara (mis: Sirup Marjan 460ml)"
                    className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={250}
                    value={subNoticeAlasan}
                    onChange={(e) => setSubNoticeAlasan(e.target.value)}
                    placeholder="Alasan resmi (mis: Kelangkaan stok pabrik, kualitas ditingkatkan)"
                    className="sm:col-span-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900"
                  />
                  <button
                    type="submit"
                    disabled={savingSubNotice}
                    className="sm:col-span-2 rounded-lg bg-[#381E5A] py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#492975] disabled:opacity-60 cursor-pointer"
                  >
                    {savingSubNotice ? 'Mempublikasikan...' : 'Publikasikan Info Substitusi ke Member'}
                  </button>
                </form>
              )}

              {productSubstitutions.length === 0 ? (
                <p className="rounded-xl bg-[#FAF7F2] p-5 text-center text-xs text-stone-500">
                  Belum ada pengumuman substitusi merek produk saat ini.
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y divide-stone-100 text-xs">
                  {productSubstitutions.map((subNote) => (
                    <div key={subNote.id} className="flex items-start justify-between gap-2 py-2.5">
                      <div>
                        <p className="font-bold text-[#381E5A]">
                          {subNote.package_nama}{' '}
                          <span className="font-mono-nums font-normal text-stone-500">
                            · {subNote.tanggal}
                          </span>
                        </p>
                        <p className="mt-0.5 text-stone-800">
                          <span className="line-through text-rose-700">{subNote.produk_lama}</span>{' '}
                          →{' '}
                          <strong className="text-[#0C3328]">{subNote.produk_pengganti}</strong>
                        </p>
                        <p className="text-[11px] text-stone-600">{subNote.alasan}</p>
                      </div>
                      {isAdmin && (
                        <div className="shrink-0">
                          {confirmDeleteSubNoticeId === subNote.id ? (
                            <span className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteSubstitutionNotice(subNote.id)}
                                className="rounded bg-rose-700 px-2 py-1 text-[10px] font-bold text-white cursor-pointer"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteSubNoticeId(null)}
                                className="text-[10px] text-stone-500 cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteSubNoticeId(subNote.id)}
                              className="p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {/* TAB 6: PENGGUNA & RBAC (ADMIN PUSAT) */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="text-[11px] text-stone-500">Total Member</p>
              <p className="mt-0.5 font-mono-nums text-lg font-bold text-stone-900">
                {roleCounts.member}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="text-[11px] text-stone-500">Agen Wilayah</p>
              <p className="mt-0.5 font-mono-nums text-lg font-bold text-emerald-900">
                {roleCounts.agen}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="text-[11px] text-stone-500">Koordinator Wilayah</p>
              <p className="mt-0.5 font-mono-nums text-lg font-bold text-[#26124A]">
                {roleCounts.korwil}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
              <p className="text-[11px] text-stone-500">Admin Pusat</p>
              <p className="mt-0.5 font-mono-nums text-lg font-bold text-amber-800">
                {roleCounts.admin}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                Manajemen Peran Pengguna &amp; RBAC ({filteredUsers.length})
              </h2>
              <p className="mt-1 text-xs text-stone-600">
                Tetapkan peran resmi (Member, Agen Wilayah, Korwil, atau Admin Pusat), wilayah Priangan Timur, dan kode agen.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari nama, username, email, atau nomor WA..."
                  className="w-full rounded-lg border border-stone-300 py-2 pl-8 pr-3 text-xs text-stone-900"
                />
              </div>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value as 'all' | UserRole)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
              >
                <option value="all">Semua Peran</option>
                <option value="member">Member</option>
                <option value="agen">Agen</option>
                <option value="korwil">Korwil</option>
                <option value="admin">Admin</option>
              </select>
              <select
                value={userWilayahFilter}
                onChange={(e) => setUserWilayahFilter(e.target.value as 'all' | WilayahPriangan)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
              >
                <option value="all">Semua Wilayah</option>
                {WILAYAH_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-xs text-stone-500">
                    <th className="py-2.5 pr-4 font-semibold">Nama &amp; Username</th>
                    <th className="py-2.5 pr-4 font-semibold">Email / WhatsApp</th>
                    <th className="py-2.5 pr-4 font-semibold">Kode Agen</th>
                    <th className="py-2.5 pr-4 font-semibold">Wilayah</th>
                    <th className="py-2.5 font-semibold">Peran RBAC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-stone-50">
                      <td className="py-3 pr-4">
                        <p className="text-xs font-semibold text-stone-900">{u.nama}</p>
                        {u.username && (
                          <p className="text-[11px] text-stone-500">@{u.username}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-xs text-stone-600">
                        <p>{u.email || '—'}</p>
                        <p className="font-mono-nums">{u.no_wa}</p>
                      </td>
                      <td className="py-3 pr-4 font-mono-nums text-xs text-stone-700">
                        {u.kode_agen || '—'}
                      </td>
                      <td className="py-3 pr-4">
                        <select
                          value={u.wilayah}
                          onChange={(e) =>
                            handleUpdateUserRole(u, u.role, e.target.value as WilayahPriangan)
                          }
                          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs"
                        >
                          {WILAYAH_LIST.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3">
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleUpdateUserRole(u, e.target.value as UserRole, u.wilayah)
                          }
                          className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-semibold"
                        >
                          <option value="member">Member</option>
                          <option value="agen">Agen</option>
                          <option value="korwil">Korwil</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: PESAN MASUK DARI HALAMAN KONTAK (ADMIN PUSAT) */}
      {activeTab === 'pesan' && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-6">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                Pesan Masuk Pengunjung ({contactMessages.length})
              </h2>
              <p className="mt-1 text-xs text-stone-600">
                Pesan pertanyaan dari formulir halaman Kontak publik. Balas via WhatsApp lalu tandai selesai.
              </p>
            </div>
            <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-mono-nums text-xs font-bold text-amber-900">
              {unreadMessagesCount} Pesan Baru
            </span>
          </div>

          {contactMessages.length === 0 ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
              Belum ada pesan masuk dari halaman Kontak.
            </div>
          ) : (
            <div className="space-y-3">
              {contactMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:flex-row sm:items-start"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-stone-900">{msg.nama}</span>
                      <span className="font-mono-nums text-xs font-medium text-stone-600">
                        {msg.no_wa}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          msg.status === 'baru'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-900'
                        }`}
                      >
                        {msg.status === 'baru' ? 'Baru' : 'Dibalas'}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-stone-700 whitespace-pre-line">
                      {msg.pesan}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <a
                      href={formatWhatsAppUrl(
                        msg.no_wa,
                        `Halo ${msg.nama}, terima kasih telah menghubungi Sagitarius Parcel. Menanggapi pesan Anda: "${msg.pesan.slice(0, 60)}..."`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Balas WA</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleMarkMessageReplied(msg)}
                      className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
                    >
                      {msg.status === 'baru' ? 'Tandai Dibalas' : 'Buka Lagi'}
                    </button>
                    {confirmDeleteMsgId === msg.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteContactMessage(msg.id)}
                          className="rounded-lg bg-rose-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteMsgId(null)}
                          className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs text-stone-600 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMsgId(msg.id)}
                        className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50 cursor-pointer"
                        aria-label="Hapus pesan"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: DOOR PRIZE UNDIAN RESMI */}
      {activeTab === 'doorprize' && (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-5 lg:col-span-5">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-900" />
              <h2 className="font-display text-lg font-bold text-stone-900">
                Undian Door Prize Member
              </h2>
            </div>
            <p className="text-xs text-stone-600">
              Setiap kontrak aktif dengan minimal 1 setoran tervalidasi berhak memperoleh nomor kupon undian resmi{' '}
              <span className="font-mono-nums font-semibold">DP-...</span>.
            </p>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 text-xs">
              <div>
                <p className="text-stone-500">Kupon Memenuhi Syarat</p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-[#0C3328]">
                  {doorPrizeEligible.length} Kupon
                </p>
              </div>
              <div>
                <p className="text-stone-500">Pemenang Tercatat</p>
                <p className="mt-1 font-mono-nums text-lg font-bold text-[#381E5A]">
                  {doorPrizeDraws.length} Pemenang
                </p>
              </div>
            </div>

            {isAdmin ? (
              <form onSubmit={handleRunDoorPrizeDraw} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Pilih / Ketik Nama Hadiah
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {[
                      'HP Android',
                      'Rice Cooker',
                      'Kompor Gas 2 Tungku',
                      'Kipas Angin',
                      'Dispenser',
                      'Voucher Belanja',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPrizeName(preset)}
                        className={`rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer ${
                          prizeName === preset
                            ? 'border-[#381E5A] bg-[#381E5A] text-[#E8CA82]'
                            : 'border-[#E4DCCB] bg-[#FAF7F2] text-stone-700'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={prizeName}
                    onChange={(e) => setPrizeName(e.target.value)}
                    placeholder="Nama hadiah Door Prize..."
                    className="mt-2 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={drawingPrize || doorPrizeEligible.length === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0C3328] py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>
                    {drawingPrize ? 'Mengundi Kupon...' : 'Putar Undian Acak Sekarang'}
                  </span>
                </button>
              </form>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Pengacakan &amp; pengumuman pemenang Door Prize dilakukan secara resmi oleh Admin Pusat Sagitarius Parcel.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-5 lg:col-span-7">
            <h3 className="font-display text-lg font-bold text-stone-900">
              Daftar Pemenang Door Prize ({doorPrizeDraws.length})
            </h3>
            <p className="text-xs text-stone-600">
              Pemenang langsung tampil di Dashboard Member secara real-time.
            </p>

            {doorPrizeDraws.length === 0 ? (
              <p className="mt-6 rounded-xl bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
                Belum ada pengundian Door Prize yang dipublikasikan.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#E4DCCB] text-stone-500">
                      <th className="py-2 pr-3 font-semibold">Tanggal</th>
                      <th className="py-2 pr-3 font-semibold">Hadiah</th>
                      <th className="py-2 pr-3 font-semibold">Kupon &amp; Pemenang</th>
                      <th className="py-2 pr-3 font-semibold">Wilayah</th>
                      {isAdmin && <th className="py-2 text-right font-semibold">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {doorPrizeDraws.map((dp) => (
                      <tr key={dp.id} className="hover:bg-[#FAF7F2]/60">
                        <td className="py-2.5 pr-3 font-mono-nums text-stone-600 whitespace-nowrap">
                          {dp.tanggal_undi}
                        </td>
                        <td className="py-2.5 pr-3 font-bold text-[#381E5A]">{dp.hadiah}</td>
                        <td className="py-2.5 pr-3">
                          <p className="font-bold text-stone-900">{dp.member_nama}</p>
                          <p className="font-mono-nums text-[11px] font-semibold text-[#0C3328]">
                            {dp.kupon_kode}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 text-stone-600">{dp.wilayah}</td>
                        {isAdmin && (
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {confirmDeletePrizeId === dp.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDoorPrize(dp.id)}
                                  className="rounded bg-rose-700 px-2 py-0.5 text-[10px] font-bold text-white cursor-pointer"
                                >
                                  Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePrizeId(null)}
                                  className="text-[10px] text-stone-500 cursor-pointer"
                                >
                                  Batal
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePrizeId(dp.id)}
                                className="p-1 text-stone-400 hover:text-rose-700 cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: ANALITIK & GRAFIK VISUAL + HPP + LOG AUDIT (ADMIN ONLY) */}
      {activeTab === 'analitik' && isAdmin && (
        <AdminAnalyticsTab
          korwilRecap={korwilRecap}
          subscriptions={subscriptions}
          deposits={deposits}
          packages={packages}
          warehouseInventory={warehouseInventory}
          auditLogs={auditLogs}
        />
      )}

      {/* TAB: PENGATURAN REKENING & PENGUMUMAN PUBLIK (ADMIN ONLY) */}
      {activeTab === 'pengaturan' && isAdmin && (
        <form
          onSubmit={handleSaveAppSettings}
          className="grid gap-6 rounded-xl border border-stone-200 bg-white p-5 lg:grid-cols-2"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Settings className="h-5 w-5 text-emerald-900" />
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Rekening Transfer Resmi Perusahaan
                </h2>
                <p className="text-xs text-stone-600">
                  Ditampilkan otomatis di kotak Setor Transfer Bank pada Dashboard Member.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Nama Bank Resmi</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={60}
                value={setBankNama}
                onChange={(e) => setSetBankNama(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">Nomor Rekening</label>
              <input
                type="text"
                required
                minLength={4}
                maxLength={50}
                value={setBankRekening}
                onChange={(e) => setSetBankRekening(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">Atas Nama Pemilik Rekening</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={100}
                value={setBankAtasNama}
                onChange={(e) => setSetBankAtasNama(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Catatan / Instruksi Transfer &amp; QRIS
              </label>
              <textarea
                rows={3}
                maxLength={250}
                value={setQrisCatatan}
                onChange={(e) => setSetQrisCatatan(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
              <Megaphone className="h-5 w-5 text-emerald-900" />
              <div>
                <h2 className="font-display text-lg font-bold text-stone-900">
                  Papan Pengumuman Broadcast Member
                </h2>
                <p className="text-xs text-stone-600">
                  Banner info jadwal H-7/H-2, promo, atau pengundian Door Prize LIVE.
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#381E5A] cursor-pointer">
              <input
                type="checkbox"
                checked={setPengAktif}
                onChange={(e) => setSetPengAktif(e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-[#0C3328]"
              />
              Tampilkan Banner Pengumuman di Dashboard Member
            </label>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Judul Pengumuman</label>
              <input
                type="text"
                maxLength={120}
                value={setPengJudul}
                onChange={(e) => setSetPengJudul(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Isi Pesan Broadcast</label>
              <textarea
                rows={4}
                maxLength={600}
                value={setPengIsi}
                onChange={(e) => setSetPengIsi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0C3328] py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
              >
                <BarChart3 className="h-4 w-4" />
                <span>
                  {savingSettings
                    ? 'Menyimpan Perubahan...'
                    : 'Simpan & Publikasikan ke Dashboard Member'}
                </span>
              </button>
            </div>
          </div>
        </form>
      )}
        </div>
      </div>

      {/* Modal Form: Daftarkan Kontrak Member Offline (Agen / Korwil / Admin) */}
      {showOfflineModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateOfflineContract}
            className="w-full max-w-lg rounded-2xl border border-[#E4DCCB] bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#E4DCCB]/70 pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-[#381E5A]">
                  Daftarkan Kontrak Member Baru
                </h3>
                <p className="text-xs text-stone-500">
                  Pendaftaran kontrak langsung oleh Agen/Admin untuk member offline atau tanpa HP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="rounded p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Nama Lengkap Member
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={75}
                  value={offNama}
                  onChange={(e) => setOffNama(e.target.value)}
                  placeholder="Contoh: Ibu Siti Aminah"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    No. WhatsApp (Opsional)
                  </label>
                  <input
                    type="tel"
                    maxLength={20}
                    value={offWa}
                    onChange={(e) => setOffWa(e.target.value)}
                    placeholder="0813xxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">Wilayah</label>
                  <select
                    value={offWilayah}
                    onChange={(e) => setOffWilayah(e.target.value as WilayahPriangan)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  >
                    {WILAYAH_LIST.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Pilih Paket Katalog
                </label>
                <select
                  value={offPackageId}
                  onChange={(e) => setOffPackageId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                >
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama_paket} — {formatRupiah(p.harga_total)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Frekuensi Setoran
                  </label>
                  <select
                    value={offFrekuensi}
                    onChange={(e) => setOffFrekuensi(e.target.value as 'harian' | 'mingguan')}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  >
                    <option value="harian">Harian (Setiap Hari)</option>
                    <option value="mingguan">Mingguan (Jemput Bola)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Durasi (Minggu, 1–60)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    required
                    value={offDurasiMinggu}
                    onChange={(e) => setOffDurasiMinggu(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900"
                  />
                </div>
              </div>

              {userProfile.role !== 'agen' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-700">
                    Agen Penanggung Jawab
                  </label>
                  <select
                    value={offAgentId}
                    onChange={(e) => setOffAgentId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.kode_agen} — {a.nama} ({a.wilayah})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Nama Grup / Arisan / Majelis (Opsional)
                </label>
                <input
                  type="text"
                  maxLength={80}
                  value={offGrupArisan}
                  onChange={(e) => setOffGrupArisan(e.target.value)}
                  placeholder="Contoh: Majelis Al-Hidayah / Arisan RT 04"
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingOffline}
                className="rounded-lg bg-[#0C3328] px-5 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
              >
                {savingOffline ? 'Mendaftarkan...' : 'Simpan Kontrak Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Form: Tambah / Edit Paket Katalog */}
      {showPkgForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSavePackage}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-display text-xl font-bold text-stone-900">
                {editingPkgId ? 'Edit Paket Katalog' : 'Tambah Paket Katalog Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowPkgForm(false)}
                className="rounded p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Nama Paket</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={120}
                  value={pkgFormNama}
                  onChange={(e) => setPkgFormNama(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Kategori</label>
                <select
                  value={pkgFormKategori}
                  onChange={(e) => setPkgFormKategori(e.target.value as PackageCategory)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="bunda">Paket Bunda</option>
                  <option value="anak">Paket Anak</option>
                  <option value="pilihan">Paket Pilihan</option>
                  <option value="uang">Paket Uang</option>
                  <option value="satuan">Barang Satuan</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Harga Total (Rp)
                </label>
                <input
                  type="number"
                  min={1000}
                  required
                  value={pkgFormHarga}
                  onChange={(e) => setPkgFormHarga(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Setoran Harian (Rp)
                </label>
                <input
                  type="number"
                  min={100}
                  required
                  value={pkgFormHarian}
                  onChange={(e) => setPkgFormHarian(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Setoran Mingguan (Rp)
                </label>
                <input
                  type="number"
                  min={500}
                  required
                  value={pkgFormMingguan}
                  onChange={(e) => setPkgFormMingguan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Durasi (Hari, 7-400)
                </label>
                <input
                  type="number"
                  min={7}
                  max={400}
                  required
                  value={pkgFormDurasi}
                  onChange={(e) => setPkgFormDurasi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Bonus THR (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={pkgFormBonus}
                  onChange={(e) => setPkgFormBonus(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Jadwal Pengambilan
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={pkgFormJadwal}
                  onChange={(e) => setPkgFormJadwal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Sub-Kategori</label>
                <input
                  type="text"
                  maxLength={60}
                  value={pkgFormSubKategori}
                  onChange={(e) => setPkgFormSubKategori(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Bobot Estimasi (Kg)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={pkgFormBobot}
                  onChange={(e) => setPkgFormBobot(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-stone-700">URL Foto Paket</label>
              <input
                type="text"
                maxLength={500}
                value={pkgFormFoto}
                onChange={(e) => setPkgFormFoto(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-stone-700">
                Daftar Isi Paket (1 item per baris, maksimal 30 baris)
              </label>
              <textarea
                rows={4}
                required
                value={pkgFormIsi}
                onChange={(e) => setPkgFormIsi(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPkgForm(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingPkg}
                className="rounded-lg bg-emerald-900 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
              >
                {savingPkg ? 'Menyimpan...' : 'Simpan Paket'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Form: Tambah / Edit Agen */}
      {showAgentForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveAgent}
            className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="font-display text-xl font-bold text-stone-900">
                {editingAgentId ? 'Edit Data Agen Wilayah' : 'Tambah Agen Resmi Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAgentForm(false)}
                className="rounded p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-stone-700">Kode Agen</label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={32}
                  value={agentFormKode}
                  onChange={(e) => setAgentFormKode(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Nama Agen</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={agentFormNama}
                  onChange={(e) => setAgentFormNama(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Wilayah</label>
                <select
                  value={agentFormWilayah}
                  onChange={(e) => setAgentFormWilayah(e.target.value as WilayahPriangan)}
                  className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  {WILAYAH_LIST.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">Kecamatan</label>
                <input
                  type="text"
                  maxLength={80}
                  value={agentFormKecamatan}
                  onChange={(e) => setAgentFormKecamatan(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">No. WhatsApp</label>
                <input
                  type="tel"
                  required
                  minLength={8}
                  maxLength={20}
                  value={agentFormWa}
                  onChange={(e) => setAgentFormWa(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Member Binaan Awal
                </label>
                <input
                  type="number"
                  min={0}
                  value={agentFormMemberCount}
                  onChange={(e) => setAgentFormMemberCount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700">
                  Komisi Dasar (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={15}
                  step="0.5"
                  value={agentFormKomisi}
                  onChange={(e) => setAgentFormKomisi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agentFormAktif}
                    onChange={(e) => setAgentFormAktif(e.target.checked)}
                    className="h-4 w-4 rounded border-stone-300 text-emerald-900"
                  />
                  Agen Berstatus Aktif
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAgentForm(false)}
                className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingAgent}
                className="rounded-lg bg-emerald-900 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
              >
                {savingAgent ? 'Menyimpan...' : 'Simpan Agen'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Preview Photo */}
      {previewProof && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-stone-900">Verifikasi Foto Bukti</span>
              <button
                type="button"
                onClick={() => setPreviewProof(null)}
                className="rounded-lg p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={previewProof}
              alt="Bukti Transfer"
              className="max-h-[70vh] w-full rounded-lg bg-stone-100 object-contain"
            />
          </div>
        </div>
      )}

      <ReceiptGeneratorModal
        deposit={receiptDeposit}
        subscription={
          subscriptions.find((s) => s.id === receiptDeposit?.subscription_id) || null
        }
        onClose={() => setReceiptDeposit(null)}
      />
    </div>
  );
};
