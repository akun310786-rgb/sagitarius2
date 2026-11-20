import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  Edit3,
  FileImage,
  FileSpreadsheet,
  MessageCircle,
  Package as PackageIcon,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
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
  ContactMessage,
  Deposit,
  DepositMethod,
  PackageCategory,
  ParcelPackage,
  Subscription,
  SubscriptionStatus,
  TransactionType,
  UserProfile,
  UserRole,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';

interface AgentKorwilAdminDashboardProps {
  userProfile: UserProfile | null;
  allUsers: UserProfile[];
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  contactMessages?: ContactMessage[];
  onNeedLogin: () => void;
}

type AdminTab = 'agen' | 'kontrak' | 'master' | 'korwil' | 'gudang' | 'users' | 'pesan';
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
  onNeedLogin,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('agen');
  const [confirmDeleteMsgId, setConfirmDeleteMsgId] = useState<string | null>(null);

  // Tab 1: Transaksi (Setoran & Penarikan) & Verifikasi
  const [selectedSubId, setSelectedSubId] = useState<string>(subscriptions[0]?.id || '');
  const [cashTxType, setCashTxType] = useState<TransactionType>('setoran');
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

  // Tab 5: Gudang & QR
  const [qrInput, setQrInput] = useState<string>('');
  const [warehouseScheduleFilter, setWarehouseScheduleFilter] = useState<string>('all');

  // Tab 6: Pengguna & RBAC
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userWilayahFilter, setUserWilayahFilter] = useState<'all' | WilayahPriangan>('all');

  // General UI Feedback
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [previewProof, setPreviewProof] = useState<string | null>(null);
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

  // Warehouse Logistics Aggregation (H-7 & H-2)
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

    return {
      rows: Array.from(itemCounts.values()).sort((a, b) => b.qty - a.qty),
      totalThrBonus,
      readyToPickSubs: subscriptions.filter((s) => s.status === 'lunas'),
      pickedUpCount: subscriptions.filter((s) => s.status === 'diambil').length,
    };
  }, [subscriptions, packages, warehouseScheduleFilter]);

  // Filtered Contracts List
  const filteredContracts = useMemo(() => {
    const q = contractSearch.trim().toLowerCase();
    return managedSubscriptions.filter((s) => {
      if (contractStatusFilter !== 'all' && s.status !== contractStatusFilter) return false;
      if (contractWilayahFilter !== 'all' && s.wilayah !== contractWilayahFilter) return false;
      if (!q) return true;
      const hay = [
        s.member_nama,
        s.package_nama,
        s.qr_code_token,
        s.agen_nama || '',
        s.agen_kode || '',
        s.wilayah,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [managedSubscriptions, contractSearch, contractStatusFilter, contractWilayahFilter]);

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

      batch.set(depRef, {
        subscription_id: targetSub.id,
        member_id: targetSub.member_id,
        member_nama: targetSub.member_nama,
        agen_id: targetSub.agen_id,
        wilayah: targetSub.wilayah,
        jenis_transaksi: cashTxType,
        nominal: nominalNum,
        metode,
        catatan:
          cashNote.trim() ||
          (cashTxType === 'penarikan' ? 'Penarikan Dana via Agen/Admin' : 'Setoran Tunai Agen'),
        status_verifikasi: 'verified',
        validated_by: userProfile.nama,
        tanggal: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      batch.update(subRef, {
        total_terkumpul: newTotal,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();

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
      batch.update(depRef, {
        status_verifikasi: decision,
        validated_by: userProfile.nama,
        catatan:
          decision === 'verified'
            ? `${dep.catatan || (isWithdraw ? 'Penarikan' : 'Transfer')} — Divalidasi (${userProfile.nama})`
            : `${dep.catatan || (isWithdraw ? 'Penarikan' : 'Transfer')} — Ditolak (${userProfile.nama})`,
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
    try {
      await deleteDoc(doc(db, 'deposits', depId));
      setConfirmDeleteDepId(null);
      setStatusMessage('Log transaksi berhasil dihapus oleh Admin.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `deposits/${depId}`);
    }
  };

  // --- Handlers: Contracts Management ---
  const handleUpdateContractStatus = async (sub: Subscription, newStatus: SubscriptionStatus) => {
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      setStatusMessage(
        `Status kontrak ${sub.member_nama} (${sub.package_nama}) diperbarui menjadi ${newStatus.toUpperCase()}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${sub.id}`);
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
      setEditingBalanceSubId(null);
      setStatusMessage(
        `Saldo kontrak ${sub.member_nama} dikoreksi menjadi ${formatRupiah(val)} (${nextStatus.toUpperCase()}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${sub.id}`);
    }
  };

  const handleDeleteContract = async (subId: string) => {
    try {
      await deleteDoc(doc(db, 'subscriptions', subId));
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

  const tabs: Array<{ id: AdminTab; label: string; badge?: number; adminOnly?: boolean }> = [
    { id: 'agen', label: 'Transaksi & Validasi', badge: pendingDeposits.length },
    { id: 'kontrak', label: 'Kontrak Member', badge: managedSubscriptions.length },
    { id: 'master', label: 'Katalog & Agen Master', adminOnly: true },
    { id: 'korwil', label: 'Komisi 7% & Korwil' },
    { id: 'gudang', label: 'Gudang H-7/H-2 & QR' },
    { id: 'users', label: 'Pengguna & RBAC', badge: allUsers.length, adminOnly: true },
    { id: 'pesan', label: 'Pesan Masuk', badge: unreadMessagesCount, adminOnly: true },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Navigation */}
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-emerald-800">
              Pusat Kendali {userProfile.role.toUpperCase()} · Wilayah {userProfile.wilayah}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-stone-900 sm:text-3xl">
              {isAdmin
                ? 'Dashboard Admin Pusat Sagitarius Parcel'
                : 'Panel Operasional Agen, Korwil & Gudang'}
            </h1>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={handleSyncCatalogToFirestore}
              disabled={syncingCatalog}
              className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PackageIcon className="h-3.5 w-3.5 text-emerald-800" />
              <span>
                {syncingCatalog
                  ? 'Menyinkronkan Master...'
                  : `Sinkronkan ${DEFAULT_PACKAGES.length} Paket & ${DEFAULT_AGENTS.length} Agen`}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs
            .filter((t) => !t.adminOnly || isAdmin)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-emerald-900 text-white'
                    : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span>{t.label}</span>
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono-nums text-[10px] font-bold ${
                      activeTab === t.id
                        ? 'bg-white/20 text-white'
                        : t.id === 'agen'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Executive KPI Overview Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Dana Terkumpul Netto</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-emerald-900">
            {formatRupiah(executiveKpi.totalCollected)}
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {executiveKpi.avgProgress}% dari target
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Target Kontrak Aktif</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-stone-900">
            {formatRupiah(executiveKpi.totalTarget)}
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {managedSubscriptions.length} kontrak terdata
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Antrean Validasi</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-amber-800">
            {executiveKpi.pendingCount} Pending
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {formatRupiah(executiveKpi.pendingTotal)}
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Estimasi Komisi Agen</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-[#26124A]">
            {formatRupiah(executiveKpi.totalCommission)}
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {agents.filter((a) => a.aktif).length} agen aktif
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Logistik Paket</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-emerald-900">
            {executiveKpi.lunasCount} Lunas
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {executiveKpi.diambilCount} sudah diambil
          </p>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-medium text-stone-500">Pengguna &amp; Katalog</p>
          <p className="mt-1 font-mono-nums text-base font-bold text-stone-900">
            {allUsers.length || '—'} Akun
          </p>
          <p className="mt-0.5 font-mono-nums text-[11px] text-stone-500">
            {packages.length} produk katalog
          </p>
        </div>
      </div>

      {/* Status Alert + Quick WhatsApp Receipt */}
      {statusMessage && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          <span>{statusMessage}</span>
          <div className="flex items-center gap-2">
            {lastWaPayload && (
              <a
                href={formatWhatsAppUrl(lastWaPayload.phone, lastWaPayload.message)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#15803D]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Kirim Struk WhatsApp ke Member</span>
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

      {/* TAB 1: TRANSAKSI (SETORAN & PENARIKAN) + VERIFIKASI + LOG AUDIT */}
      {activeTab === 'agen' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Input Setoran Tunai atau Penarikan */}
            <form
              onSubmit={handleRecordCashTransaction}
              className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-5"
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
            <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-7">
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
                            Validasi
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Log Audit Transaksi Tervalidasi (Admin & Staff) */}
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
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
        </div>
      )}

      {/* TAB 2: MANAJEMEN KONTRAK MEMBER */}
      {activeTab === 'kontrak' && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-5">
          <div className="flex flex-col gap-3 border-b border-stone-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-stone-900">
                Manajemen Kontrak Tabungan Member ({filteredContracts.length})
              </h2>
              <p className="text-xs text-stone-600">
                Pantau progres pelunasan, token QR pengambilan, ubah status kontrak, atau koreksi saldo member.
              </p>
            </div>
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-800" />
              <span>Export CSV Kontrak</span>
            </button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={contractSearch}
                onChange={(e) => setContractSearch(e.target.value)}
                placeholder="Cari nama member, paket, token QR, atau kode agen..."
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
          </div>

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
                    <th className="py-2.5 pr-4 font-semibold">Paket &amp; Wilayah</th>
                    <th className="py-2.5 pr-4 text-right font-semibold">Terkumpul / Target</th>
                    <th className="py-2.5 pr-4 font-semibold">Status</th>
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-5">
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
            <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4">
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
            <div className="rounded-2xl border border-stone-200 bg-white p-6">
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
        <div className="space-y-6">
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
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

          <div className="rounded-2xl border border-stone-200 bg-white p-6">
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

      {/* TAB 5: GUDANG & LOGISTIK H-7 / H-2 + QR SCANNER */}
      {activeTab === 'gudang' && (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-emerald-900" />
                  <h2 className="font-display text-xl font-bold text-stone-900">
                    Rekap Kebutuhan Barang Gudang
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
                      ['Komoditas / Item', 'Jadwal Distribusi', 'Total Unit'],
                      warehouseRecap.rows.map((r) => [r.item, r.jadwal, r.qty])
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
                      <th className="py-2.5 pr-4 font-semibold">Jadwal Distribusi</th>
                      <th className="py-2.5 text-right font-semibold">Total Unit Paket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {warehouseRecap.rows.map((r, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="py-2.5 pr-4 font-medium text-stone-900">{r.item}</td>
                        <td className="py-2.5 pr-4 text-xs text-stone-600">{r.jadwal}</td>
                        <td className="py-2.5 text-right font-mono-nums font-bold text-emerald-900">
                          {r.qty}x
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6 lg:col-span-4">
            <form
              onSubmit={handleMarkQrPickedUp}
              className="rounded-2xl border border-stone-200 bg-white p-6"
            >
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-900" />
                <h3 className="font-display text-lg font-bold text-stone-900">
                  Verifikasi Tiket QR Pengambilan
                </h3>
              </div>
              <p className="mt-1 text-xs text-stone-600">
                Masukkan kode token QR dari HP member yang berstatus Lunas untuk menandai paket telah diambil.
              </p>
              <input
                type="text"
                required
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Contoh: SGT-CIA-M2X9A"
                className="mt-4 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900 uppercase"
              />
              <button
                type="submit"
                className="mt-3 w-full rounded-lg bg-emerald-900 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
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
              <div className="rounded-2xl border border-stone-200 bg-white p-5">
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

          <div className="rounded-2xl border border-stone-200 bg-white p-6 space-y-4">
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
    </div>
  );
};
