import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  FileImage,
  Gift,
  Layers,
  Lock,
  Megaphone,
  MessageCircle,
  PackageCheck,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Replace,
  Ticket,
  Trash2,
  Truck,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatRupiah, formatWhatsAppUrl } from '../data/catalogData';
import {
  AgentApplication,
  AgentDirectoryItem,
  AppPublicSettings,
  DeliveryStage,
  Deposit,
  DepositMethod,
  DoorPrizeDraw,
  ParcelPackage,
  ProductSubstitution,
  SimulationLock,
  Subscription,
  TransactionType,
  UserProfile,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';
import { ReceiptGeneratorModal } from './ReceiptGeneratorModal';
import { RiwayatTransaksi } from './RiwayatTransaksi';

interface MemberDashboardProps {
  userProfile: UserProfile | null;
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  appSettings: AppPublicSettings;
  doorPrizeDraws: DoorPrizeDraw[];
  productSubstitutions?: ProductSubstitution[];
  agentApplications?: AgentApplication[];
  referralAgent?: AgentDirectoryItem | null;
  lockedSimulation: SimulationLock | null;
  onClearLockedSimulation: () => void;
  onNeedLogin: () => void;
  onOpenAgentRegister?: () => void;
}

function getCreatedMillis(ts: unknown): number {
  const obj = ts as { seconds?: number; toMillis?: () => number } | undefined;
  if (obj && typeof obj.toMillis === 'function') return obj.toMillis();
  if (obj && typeof obj.seconds === 'number') return obj.seconds * 1000;
  return Date.now();
}

async function compressImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.onerror = () => reject(new Error('Gagal membaca gambar'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}

function isSafeImageSource(value: string): boolean {
  const v = value.trim();
  return (
    v.startsWith('data:image/') ||
    v.startsWith('https://') ||
    v.startsWith('http://') ||
    v.startsWith('/assets/')
  );
}

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  userProfile,
  packages,
  agents,
  subscriptions,
  deposits,
  appSettings,
  doorPrizeDraws,
  productSubstitutions = [],
  agentApplications = [],
  referralAgent = null,
  lockedSimulation,
  onClearLockedSimulation,
  onNeedLogin,
  onOpenAgentRegister,
}) => {
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [showNewContractForm, setShowNewContractForm] = useState<boolean>(!!lockedSimulation);

  // Registration Form State
  const [pkgId, setPkgId] = useState<string>(
    lockedSimulation?.packageItem.id || packages[0]?.id || 'pkg_bunda_reguler'
  );
  const [agentId, setAgentId] = useState<string>(
    lockedSimulation?.selectedAgentId || referralAgent?.id || agents[0]?.id || 'agt_tsm_01'
  );
  const [wilayah, setWilayah] = useState<WilayahPriangan>(
    referralAgent?.wilayah || userProfile?.wilayah || 'Tasikmalaya'
  );
  const [durasiMinggu, setDurasiMinggu] = useState<number>(
    lockedSimulation?.durasiMinggu || 45
  );
  const [frekuensi, setFrekuensi] = useState<'harian' | 'mingguan'>(
    lockedSimulation?.frekuensi || 'mingguan'
  );
  const [newGrupArisan, setNewGrupArisan] = useState<string>('');
  const [submittingContract, setSubmittingContract] = useState(false);

  // Deposit & Withdrawal Request State
  const [txMode, setTxMode] = useState<TransactionType>('setoran');
  const [depositNominal, setDepositNominal] = useState<string>('25000');
  const [depositNote, setDepositNote] = useState<string>('');
  const [proofDataUrl, setProofDataUrl] = useState<string>('');
  const [useUniqueInvoice, setUseUniqueInvoice] = useState<boolean>(false);
  const [uniqueCodeSuffix, setUniqueCodeSuffix] = useState<number>(() =>
    101 + Math.floor(Math.random() * 398)
  );
  const [copiedExactAmount, setCopiedExactAmount] = useState<boolean>(false);
  const [withdrawMethod, setWithdrawMethod] = useState<'pencairan_tunai' | 'transfer_keluar'>(
    'pencairan_tunai'
  );
  const [uploadingDeposit, setUploadingDeposit] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [receiptDeposit, setReceiptDeposit] = useState<Deposit | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedQris, setCopiedQris] = useState(false);

  // Contract Controls: Expand Package Items / Change Agent / Grup Arisan / Cancel Contract
  const [showPackageContents, setShowPackageContents] = useState(false);
  const [showAgentSwitch, setShowAgentSwitch] = useState(false);
  const [switchAgentId, setSwitchAgentId] = useState('');
  const [showGrupEdit, setShowGrupEdit] = useState(false);
  const [editGrupValue, setEditGrupValue] = useState('');
  const [updatingAgent, setUpdatingAgent] = useState(false);
  const [confirmCancelContract, setConfirmCancelContract] = useState(false);

  const mySubscriptions = useMemo(() => {
    if (!userProfile) return [];
    return subscriptions.filter((s) => s.member_id === userProfile.uid);
  }, [subscriptions, userProfile]);

  const activeSub = useMemo(() => {
    if (mySubscriptions.length === 0) return null;
    return mySubscriptions.find((s) => s.id === selectedSubId) || mySubscriptions[0];
  }, [mySubscriptions, selectedSubId]);

  const activePackageMeta = useMemo(() => {
    if (!activeSub) return null;
    return packages.find((p) => p.id === activeSub.package_id) || null;
  }, [packages, activeSub]);

  const myAllDeposits = useMemo(() => {
    if (!userProfile) return [];
    return deposits.filter((d) => d.member_id === userProfile.uid);
  }, [deposits, userProfile]);

  const activeDeposits = useMemo(() => {
    if (!activeSub) return [];
    return deposits.filter((d) => d.subscription_id === activeSub.id);
  }, [deposits, activeSub]);

  const verifiedActiveDeposits = useMemo(() => {
    return activeDeposits.filter((d) => d.status_verifikasi === 'verified');
  }, [activeDeposits]);

  const pendingOrRejectedDeposits = useMemo(() => {
    return activeDeposits.filter((d) => d.status_verifikasi !== 'verified');
  }, [activeDeposits]);

  const selectedPkgForNew = useMemo(() => {
    if (lockedSimulation && !showNewContractForm) return lockedSimulation.packageItem;
    return packages.find((p) => p.id === pkgId) || packages[0];
  }, [packages, pkgId, lockedSimulation, showNewContractForm]);

  const selectedAgentForNew = useMemo(
    () => agents.find((a) => a.id === agentId) || agents[0],
    [agents, agentId]
  );

  const installmentSchedule = useMemo(() => {
    if (!activeSub) return null;
    const totalWeeks = activeSub.durasi_minggu || Math.max(12, Math.round((activePackageMeta?.durasi_hari || 325) / 7));
    const startMs = getCreatedMillis(activeSub.createdAt);
    const elapsedDays = Math.max(1, Math.floor((Date.now() - startMs) / (1000 * 60 * 60 * 24)) + 1);
    const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil(elapsedDays / 7)));
    const expectedByNow = Math.min(
      activeSub.target_nominal,
      Math.round((activeSub.target_nominal / totalWeeks) * currentWeek)
    );
    const actual = activeSub.total_terkumpul || 0;
    const diff = actual - expectedByNow;
    const estEndDate = new Date(startMs + totalWeeks * 7 * 24 * 60 * 60 * 1000);
    const estEndStr = estEndDate.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    let paceLabel = 'Sesuai Jadwal';
    let paceTone = 'bg-emerald-50 text-emerald-900 border-emerald-200';
    if (activeSub.status === 'lunas' || activeSub.status === 'diambil' || actual >= activeSub.target_nominal) {
      paceLabel = 'Sudah Lunas';
      paceTone = 'bg-emerald-100 text-emerald-950 border-emerald-300';
    } else if (diff >= (activeSub.setoran_nominal || 20000)) {
      paceLabel = 'Lebih Cepat dari Jadwal';
      paceTone = 'bg-emerald-50 text-emerald-900 border-emerald-200';
    } else if (diff < -(activeSub.setoran_nominal || 20000)) {
      paceLabel = 'Perlu Tambah Setoran';
      paceTone = 'bg-amber-50 text-amber-900 border-amber-200';
    }

    return {
      totalWeeks,
      currentWeek,
      expectedByNow,
      diff,
      estEndStr,
      paceLabel,
      paceTone,
      totalDays: activePackageMeta?.durasi_hari || totalWeeks * 7,
      elapsedDays,
    };
  }, [activeSub, activePackageMeta]);

  const handleCopyRekening = async () => {
    try {
      await navigator.clipboard.writeText(appSettings.bank_rekening);
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2200);
    } catch {
      setFeedbackMsg(`Nomor Rekening Resmi: ${appSettings.bank_rekening}`);
    }
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) {
      onNeedLogin();
      return;
    }
    if (!selectedPkgForNew || !selectedAgentForNew) return;
    setSubmittingContract(true);
    setFeedbackMsg('');
    try {
      const targetNominal = selectedPkgForNew.harga_total;
      const setoranNom =
        frekuensi === 'harian'
          ? Math.ceil(targetNominal / (durasiMinggu * 7) / 100) * 100
          : Math.ceil(targetNominal / durasiMinggu / 500) * 500;
      const qrToken = `SGT-${selectedAgentForNew.wilayah.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      const cleanGrup = newGrupArisan.trim().slice(0, 80);
      const effectiveRefCode = (
        referralAgent?.kode_agen ||
        selectedAgentForNew.kode_agen ||
        ''
      ).slice(0, 32);

      const payload = {
        member_id: userProfile.uid,
        member_nama: userProfile.nama,
        agen_id: selectedAgentForNew.id,
        agen_kode: selectedAgentForNew.kode_agen,
        agen_nama: selectedAgentForNew.nama,
        wilayah: selectedAgentForNew.wilayah || wilayah,
        package_id: selectedPkgForNew.id,
        package_nama: selectedPkgForNew.nama_paket,
        kategori: selectedPkgForNew.kategori,
        target_nominal: targetNominal,
        total_terkumpul: 0,
        setoran_nominal: setoranNom,
        frekuensi,
        durasi_minggu: durasiMinggu,
        status: 'aktif',
        status_pengiriman: 'menunggu_lunas' as DeliveryStage,
        ...(cleanGrup ? { grup_arisan: cleanGrup } : {}),
        ...(effectiveRefCode ? { kode_referral_agen: effectiveRefCode } : {}),
        qr_code_token: qrToken,
        jadwal_ambil: selectedPkgForNew.jadwal_ambil,
        daftar_isi: selectedPkgForNew.daftar_isi.slice(0, 25),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'subscriptions'), payload);

      const contractWilayah = selectedAgentForNew.wilayah || wilayah;
      const contractNotifs = [
        {
          recipient_type: 'user',
          recipient_uid: userProfile.uid,
          wilayah: contractWilayah,
          kategori: 'kontrak',
          judul: 'Kontrak Tabungan Baru Aktif',
          pesan: `Kontrak ${selectedPkgForNew.nama_paket} (Target ${formatRupiah(targetNominal)}) bersama ${selectedAgentForNew.nama} berhasil didaftarkan.`,
          tautan_view: 'member',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          recipient_type: 'agen',
          recipient_uid:
            selectedAgentForNew.id.startsWith('agt_') && selectedAgentForNew.kode_agen
              ? selectedAgentForNew.kode_agen
              : selectedAgentForNew.id,
          wilayah: contractWilayah,
          kategori: 'kontrak',
          judul: `Member Baru: ${userProfile.nama}`,
          pesan: `${userProfile.nama} membuka kontrak ${selectedPkgForNew.nama_paket} (${formatRupiah(setoranNom)}/${frekuensi}) di bawah binaan Anda.`,
          tautan_view: 'operasional',
          tautan_tab: 'agen',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          recipient_type: 'admin',
          recipient_uid: 'staff_admin',
          wilayah: contractWilayah,
          kategori: 'kontrak',
          judul: `Kontrak Baru: ${userProfile.nama}`,
          pesan: `${userProfile.nama} mendaftar paket ${selectedPkgForNew.nama_paket} (${contractWilayah}) melalui agen ${selectedAgentForNew.nama}.`,
          tautan_view: 'operasional',
          tautan_tab: 'kontrak',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ];
      await Promise.allSettled(
        contractNotifs.map((n) => addDoc(collection(db, 'notifications'), n))
      );

      setSelectedSubId(docRef.id);
      setNewGrupArisan('');
      setShowNewContractForm(false);
      onClearLockedSimulation();
      setFeedbackMsg('Kontrak tabungan berhasil dibuat dan terdaftar di agen pilihan Anda.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subscriptions');
    } finally {
      setSubmittingContract(false);
    }
  };

  const handleSaveGrupArisan = async () => {
    if (!activeSub || activeSub.status !== 'aktif') return;
    setUpdatingAgent(true);
    setFeedbackMsg('');
    try {
      const cleaned = editGrupValue.trim().slice(0, 80);
      await updateDoc(doc(db, 'subscriptions', activeSub.id), {
        grup_arisan: cleaned,
        updatedAt: serverTimestamp(),
      });
      setShowGrupEdit(false);
      setFeedbackMsg(
        cleaned
          ? `Kontrak ${activeSub.package_nama} ditautkan ke Grup/Arisan "${cleaned}".`
          : `Label Grup/Arisan pada kontrak ${activeSub.package_nama} dihapus.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${activeSub.id}`);
    } finally {
      setUpdatingAgent(false);
    }
  };

  const handleSwitchAgent = async () => {
    if (!activeSub || !switchAgentId) return;
    const targetAgent = agents.find((a) => a.id === switchAgentId);
    if (!targetAgent) return;
    setUpdatingAgent(true);
    setFeedbackMsg('');
    try {
      await updateDoc(doc(db, 'subscriptions', activeSub.id), {
        agen_id: targetAgent.id,
        agen_kode: targetAgent.kode_agen,
        agen_nama: targetAgent.nama,
        wilayah: targetAgent.wilayah,
        updatedAt: serverTimestamp(),
      });
      setShowAgentSwitch(false);
      setFeedbackMsg(
        `Agen pendamping untuk kontrak ${activeSub.package_nama} berhasil dialihkan ke ${targetAgent.nama} (${targetAgent.wilayah}).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subscriptions/${activeSub.id}`);
    } finally {
      setUpdatingAgent(false);
    }
  };

  const handleCancelContract = async () => {
    if (!activeSub || activeSub.total_terkumpul > 0 || activeSub.status !== 'aktif') return;
    setUpdatingAgent(true);
    setFeedbackMsg('');
    try {
      await deleteDoc(doc(db, 'subscriptions', activeSub.id));
      setConfirmCancelContract(false);
      setSelectedSubId('');
      setFeedbackMsg(`Kontrak ${activeSub.package_nama} berhasil dibatalkan sebelum setoran pertama.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subscriptions/${activeSub.id}`);
    } finally {
      setUpdatingAgent(false);
    }
  };

  const handleProofFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setProofDataUrl(compressed);
    } catch {
      setFeedbackMsg('Gagal memproses file gambar bukti transfer.');
    }
  };

  const handleSubmitTransactionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !activeSub) return;
    const nominalNum = Number(depositNominal);
    if (!Number.isFinite(nominalNum) || nominalNum < 1000) {
      setFeedbackMsg('Nominal transaksi minimal Rp 1.000.');
      return;
    }

    if (txMode === 'penarikan') {
      if (activeSub.status === 'diambil') {
        setFeedbackMsg('Paket sudah berstatus diambil sehingga saldo tidak dapat ditarik lagi.');
        return;
      }
      if (nominalNum > (activeSub.total_terkumpul || 0)) {
        setFeedbackMsg(
          `Nominal penarikan melebihi saldo terkumpul saat ini (${formatRupiah(
            activeSub.total_terkumpul
          )}).`
        );
        return;
      }
    }

    setUploadingDeposit(true);
    setFeedbackMsg('');
    try {
      const metode: DepositMethod =
        txMode === 'penarikan' ? withdrawMethod : 'transfer';
      const defaultNote =
        txMode === 'penarikan'
          ? withdrawMethod === 'pencairan_tunai'
            ? 'Pengajuan Penarikan Tunai via Agen'
            : 'Pengajuan Penarikan Transfer Bank'
          : 'Transfer Tabungan Member';

      const finalNominal =
        txMode === 'setoran' && useUniqueInvoice ? nominalNum + uniqueCodeSuffix : nominalNum;
      const invoiceRef = `INV-SGT-${activeSub.qr_code_token.slice(-4)}-${uniqueCodeSuffix}`;
      const baseNoteText = depositNote.trim() || defaultNote;
      const finalCatatan =
        txMode === 'setoran' && useUniqueInvoice
          ? `[${invoiceRef} · Kode Unik +${uniqueCodeSuffix}] ${baseNoteText}`.slice(0, 250)
          : baseNoteText.slice(0, 250);

      await addDoc(collection(db, 'deposits'), {
        subscription_id: activeSub.id,
        member_id: userProfile.uid,
        member_nama: userProfile.nama,
        agen_id: activeSub.agen_id,
        wilayah: activeSub.wilayah,
        jenis_transaksi: txMode,
        nominal: finalNominal,
        metode,
        ...(txMode === 'setoran' && proofDataUrl ? { bukti_foto_url: proofDataUrl } : {}),
        catatan: finalCatatan,
        status_verifikasi: 'pending',
        tanggal: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const agentRecipientUid =
        activeSub.agen_id.startsWith('agt_') && activeSub.agen_kode
          ? activeSub.agen_kode
          : activeSub.agen_id;

      const txNotifs = [
        {
          recipient_type: 'user',
          recipient_uid: userProfile.uid,
          wilayah: activeSub.wilayah,
          kategori: txMode,
          judul:
            txMode === 'penarikan'
              ? `Pengajuan Penarikan ${formatRupiah(finalNominal)} Terkirim`
              : `Pengajuan Setoran ${formatRupiah(finalNominal)} Terkirim`,
          pesan:
            txMode === 'penarikan'
              ? `Pengajuan penarikan saldo untuk paket ${activeSub.package_nama} sedang menunggu validasi Agen/Admin.`
              : `Bukti transfer setoran paket ${activeSub.package_nama} (${
                  useUniqueInvoice ? invoiceRef : 'Transfer'
                }) berhasil dikirim dan menunggu verifikasi.`,
          tautan_view: 'member',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          recipient_type: 'agen',
          recipient_uid: agentRecipientUid,
          wilayah: activeSub.wilayah,
          kategori: txMode,
          judul:
            txMode === 'penarikan'
              ? `Pengajuan Penarikan: ${userProfile.nama}`
              : `Setoran Transfer Baru: ${userProfile.nama}`,
          pesan: `${userProfile.nama} mengajukan ${
            txMode === 'penarikan' ? 'penarikan dana' : 'setoran transfer'
          } sebesar ${formatRupiah(finalNominal)} untuk paket ${activeSub.package_nama}.`,
          tautan_view: 'operasional',
          tautan_tab: 'agen',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          recipient_type: 'korwil',
          recipient_uid: `korwil_${activeSub.wilayah}`,
          wilayah: activeSub.wilayah,
          kategori: txMode,
          judul:
            txMode === 'penarikan'
              ? `Aktivitas Penarikan Wilayah: ${userProfile.nama}`
              : `Setoran Transfer Wilayah: ${userProfile.nama}`,
          pesan: `Member ${userProfile.nama} (${activeSub.wilayah}) mengajukan ${
            txMode === 'penarikan' ? 'penarikan' : 'setoran transfer'
          } ${formatRupiah(finalNominal)} pada paket ${activeSub.package_nama}.`,
          tautan_view: 'operasional',
          tautan_tab: 'agen',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        {
          recipient_type: 'admin',
          recipient_uid: 'staff_admin',
          wilayah: activeSub.wilayah,
          kategori: txMode,
          judul:
            txMode === 'penarikan'
              ? `Penarikan Member: ${userProfile.nama}`
              : `Setoran Masuk Member: ${userProfile.nama}`,
          pesan: `${userProfile.nama} (${activeSub.wilayah}) mengirim ${
            txMode === 'penarikan' ? 'pengajuan penarikan' : 'bukti transfer setoran'
          } ${formatRupiah(finalNominal)} (${activeSub.package_nama}).`,
          tautan_view: 'operasional',
          tautan_tab: 'agen',
          sender_uid: userProfile.uid,
          sender_nama: userProfile.nama,
          is_read: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
      ];

      await Promise.allSettled(
        txNotifs.map((n) => addDoc(collection(db, 'notifications'), n))
      );

      setDepositNote('');
      setProofDataUrl('');
      setUniqueCodeSuffix(101 + Math.floor(Math.random() * 398));
      setFeedbackMsg(
        txMode === 'penarikan'
          ? 'Pengajuan penarikan saldo berhasil dikirim. Menunggu validasi & pencairan dari Agen/Admin.'
          : useUniqueInvoice
            ? `Invoice ${invoiceRef} (${formatRupiah(finalNominal)}) berhasil dicatat! Menunggu verifikasi mutasi oleh Agen/Admin.`
            : 'Bukti transfer setoran berhasil diunggah. Status saat ini: Menunggu Verifikasi Agen/Admin.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'deposits');
    } finally {
      setUploadingDeposit(false);
    }
  };

  if (!userProfile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-[#E4DCCB] bg-white p-8 sm:p-12 shadow-sm">
          <h2 className="font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
            Masuk ke Buku Tabungan Member
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Masuk menggunakan Nomor WhatsApp, Username, Gmail, atau akun Google Anda untuk mengunci simulasi paket, memantau riwayat setoran digital, mengunggah bukti transfer, mengecek kupon Door Prize, dan mengunduh Tiket QR Pengambilan.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNeedLogin}
              className="rounded-xl bg-[#381E5A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#492974] cursor-pointer"
            >
              Masuk / Daftar Member
            </button>
            {onOpenAgentRegister && (
              <button
                type="button"
                onClick={onOpenAgentRegister}
                className="rounded-xl border border-[#0C3328] bg-white px-6 py-3 text-sm font-semibold text-[#0C3328] transition hover:bg-emerald-50 cursor-pointer"
              >
                Daftar Agen Baru
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const progressPct = activeSub
    ? Math.min(100, Math.round((activeSub.total_terkumpul / activeSub.target_nominal) * 100))
    : 0;
  const remainingAmount = activeSub
    ? Math.max(0, activeSub.target_nominal - activeSub.total_terkumpul)
    : 0;
  const isPaidOff = activeSub
    ? activeSub.status === 'lunas' ||
      activeSub.status === 'diambil' ||
      activeSub.total_terkumpul >= activeSub.target_nominal
    : false;
  const activeAgentInfo = activeSub ? agents.find((a) => a.id === activeSub.agen_id) : undefined;
  const couponCode = activeSub ? `DP-${activeSub.qr_code_token.replace(/^SGT-/, '')}` : '';
  const isCouponEligible = Boolean(
    activeSub && (activeSub.total_terkumpul > 0 || verifiedActiveDeposits.length > 0)
  );
  const myWinningDraws = activeSub
    ? doorPrizeDraws.filter(
        (d) => d.member_id === userProfile.uid || d.subscription_id === activeSub.id
      )
    : [];
  const activePackageItems = activeSub?.daftar_isi || activePackageMeta?.daftar_isi || [];
  const activeBonusThr = activePackageMeta?.bonus_thr || 0;

  const effectiveDeliveryStage: DeliveryStage = activeSub
    ? activeSub.status === 'diambil'
      ? 'selesai'
      : activeSub.status_pengiriman ||
        (activeSub.status === 'lunas' ? 'siap_diambil' : 'menunggu_lunas')
    : 'menunggu_lunas';

  const matchingSubstitutions = useMemo(() => {
    if (!activeSub) return [];
    return productSubstitutions.filter(
      (s) => s.package_id === 'all' || s.package_id === activeSub.package_id
    );
  }, [productSubstitutions, activeSub]);

  const groupArisanSummaries = useMemo(() => {
    const map = new Map<
      string,
      { groupName: string; contracts: Subscription[]; collected: number; target: number }
    >();
    mySubscriptions.forEach((s) => {
      const name = (s.grup_arisan || '').trim();
      if (!name) return;
      const existing = map.get(name);
      if (existing) {
        existing.contracts.push(s);
        existing.collected += s.total_terkumpul || 0;
        existing.target += s.target_nominal || 0;
      } else {
        map.set(name, {
          groupName: name,
          contracts: [s],
          collected: s.total_terkumpul || 0,
          target: s.target_nominal || 0,
        });
      }
    });
    return Array.from(map.values());
  }, [mySubscriptions]);

  const baseDepositNum = Number(depositNominal) || 0;
  const exactTransferTotal =
    baseDepositNum + (useUniqueInvoice && baseDepositNum >= 1000 ? uniqueCodeSuffix : 0);
  const currentInvoiceCode = activeSub
    ? `INV-SGT-${activeSub.qr_code_token.slice(-4)}-${uniqueCodeSuffix}`
    : `INV-SGT-${uniqueCodeSuffix}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      {/* Broadcast Announcement Banner from Admin */}
      {appSettings.pengumuman_aktif && appSettings.pengumuman_isi && (
        <div className="no-print flex items-start gap-3 rounded-2xl border border-[#C8A053]/60 bg-gradient-to-r from-[#381E5A] to-[#281443] px-5 py-4 text-white shadow-sm">
          <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-[#E8CA82]" />
          <div className="text-xs leading-relaxed">
            <p className="font-bold text-[#E8CA82]">
              {appSettings.pengumuman_judul || 'Pengumuman Resmi Sagitarius Parcel'}
            </p>
            <p className="mt-0.5 text-stone-100 whitespace-pre-line">{appSettings.pengumuman_isi}</p>
          </div>
        </div>
      )}

      {/* Agent Application Status Banner (if user registered via Daftar Agen Baru) */}
      {agentApplications
        .filter((a) => a.applicant_uid === userProfile.uid && a.status !== 'approved')
        .map((app) => (
          <div
            key={app.id}
            className={`no-print rounded-2xl border px-5 py-4 text-xs leading-relaxed ${
              app.status === 'pending'
                ? 'border-amber-300 bg-amber-50 text-amber-950'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            <p className="font-bold">
              {app.status === 'pending'
                ? `Pengajuan Agen Wilayah ${app.wilayah} (${app.kecamatan}) — Menunggu Verifikasi Admin Pusat`
                : `Pengajuan Agen Wilayah ${app.wilayah} Ditolak`}
            </p>
            <p className="mt-1">
              {app.status === 'pending'
                ? 'Tim Admin Pusat sedang meninjau pengajuan kemitraan agen Anda. Notifikasi realtime akan muncul pada ikon pesan di pojok kanan bawah segera setelah kode agen Anda aktif.'
                : app.review_note || 'Silakan hubungi CS Resmi 0813 2438 3479 untuk informasi lebih lanjut.'}
            </p>
          </div>
        ))}

      {/* Header Bar */}
      <div className="no-print flex flex-col gap-4 border-b border-[#E4DCCB] pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C3328]">
            Dashboard Member · Wilayah {userProfile.wilayah}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#381E5A] sm:text-3xl">
            Buku Tabungan Digital — {userProfile.nama}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activeSub && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E4DCCB] bg-white px-4 py-2.5 text-xs font-semibold text-[#381E5A] transition hover:bg-[#FAF7F2] whitespace-nowrap cursor-pointer"
            >
              <Printer className="h-4 w-4 text-[#C8A053]" />
              <span>Cetak Kartu Tabungan</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowNewContractForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0C3328] px-4 py-2.5 text-xs font-semibold text-[#E8CA82] transition hover:bg-[#144738] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>{showNewContractForm ? 'Tutup Form Daftar' : 'Tambah Kontrak Paket'}</span>
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="no-print rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          {feedbackMsg}
        </div>
      )}

      {/* New Contract / Locked Simulation Form */}
      {(showNewContractForm || lockedSimulation || mySubscriptions.length === 0) && (
        <form
          onSubmit={handleCreateContract}
          className="no-print rounded-2xl border border-[#E4DCCB] bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-[#B98E3A]">
                {lockedSimulation ? 'Simulasi Terkunci Siap Didaftarkan' : 'Pendaftaran Paket Baru'}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-[#381E5A]">
                Pilih Paket Tabungan &amp; Agen Penyetor
              </h2>
            </div>
            {lockedSimulation && (
              <button
                type="button"
                onClick={onClearLockedSimulation}
                className="text-xs font-medium text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Batalkan Kunci Simulasi
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700">Paket Pilihan</label>
              <select
                value={lockedSimulation ? lockedSimulation.packageItem.id : pkgId}
                onChange={(e) => {
                  if (lockedSimulation) onClearLockedSimulation();
                  setPkgId(e.target.value);
                }}
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama_paket} ({formatRupiah(p.harga_total)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Agen Penyetor Priangan Timur
              </label>
              <select
                value={agentId}
                onChange={(e) => {
                  setAgentId(e.target.value);
                  const found = agents.find((a) => a.id === e.target.value);
                  if (found) setWilayah(found.wilayah);
                }}
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.wilayah} — {a.nama} ({a.kode_agen})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">Wilayah Domisili</label>
              <select
                value={wilayah}
                onChange={(e) => setWilayah(e.target.value as WilayahPriangan)}
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
              >
                {WILAYAH_LIST.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Jadwal &amp; Durasi (Minggu)
              </label>
              <div className="mt-1.5 flex gap-2">
                <select
                  value={frekuensi}
                  onChange={(e) => setFrekuensi(e.target.value as 'harian' | 'mingguan')}
                  className="w-1/2 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-sm text-stone-900"
                >
                  <option value="mingguan">Mingguan</option>
                  <option value="harian">Harian</option>
                </select>
                <input
                  type="number"
                  min={12}
                  max={52}
                  value={durasiMinggu}
                  onChange={(e) => setDurasiMinggu(Number(e.target.value))}
                  className="w-1/2 rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-mono-nums text-sm text-stone-900"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-stone-700">
                Nama Grup / Arisan Keluarga atau Kantor (Opsional)
              </label>
              <input
                type="text"
                maxLength={80}
                value={newGrupArisan}
                onChange={(e) => setNewGrupArisan(e.target.value)}
                placeholder="Contoh: Arisan Keluarga Besar Ibu Hj. Siti"
                className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
              />
            </div>
            {referralAgent && (
              <div className="flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-950">
                <span>
                  Terhubung via Link Referral Agen <strong>{referralAgent.nama}</strong> (
                  {referralAgent.kode_agen}).
                </span>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[#EFE8D8] pt-4">
            <div className="text-xs text-stone-600">
              Target Paket:{' '}
              <strong className="font-mono-nums text-[#381E5A]">
                {formatRupiah(selectedPkgForNew?.harga_total || 0)}
              </strong>{' '}
              · Pengambilan: <strong>{selectedPkgForNew?.jadwal_ambil}</strong>
              {selectedPkgForNew && selectedPkgForNew.bonus_thr > 0 && (
                <>
                  {' '}
                  · Bonus THR:{' '}
                  <strong className="text-[#0C3328]">
                    {formatRupiah(selectedPkgForNew.bonus_thr)}
                  </strong>
                </>
              )}
            </div>
            <button
              type="submit"
              disabled={submittingContract}
              className="rounded-xl bg-[#0C3328] px-6 py-2.5 text-sm font-semibold text-[#E8CA82] transition hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
            >
              {submittingContract ? 'Menyimpan Kontrak...' : 'Aktifkan Kontrak Tabungan'}
            </button>
          </div>
        </form>
      )}

      {/* Active Contracts Switcher */}
      {mySubscriptions.length > 0 && activeSub && (
        <>
          {mySubscriptions.length > 1 && (
            <div className="no-print flex flex-wrap gap-2">
              {mySubscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => {
                    setSelectedSubId(sub.id);
                    setShowAgentSwitch(false);
                    setConfirmCancelContract(false);
                  }}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                    sub.id === activeSub.id
                      ? 'bg-[#381E5A] text-[#E8CA82]'
                      : 'border border-[#E4DCCB] bg-white text-stone-700 hover:bg-[#FAF7F2]'
                  }`}
                >
                  {sub.package_nama} (
                  {Math.min(100, Math.round((sub.total_terkumpul / sub.target_nominal) * 100))}%)
                </button>
              ))}
            </div>
          )}

          {/* Print-Only Formal Passbook Sheet */}
          <div className="hidden print:block rounded-xl border border-stone-300 bg-white p-6 text-stone-900">
            <div className="flex items-center justify-between border-b border-stone-300 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">PT. SAGITARIUS TRINUNGGAL KARYA</p>
                <h2 className="text-xl font-bold">KARTU BUKU TABUNGAN PARCEL LEBARAN</h2>
                <p className="text-xs text-stone-600">
                  Member: {userProfile.nama} · WA: {userProfile.no_wa} · Wilayah: {activeSub.wilayah}
                </p>
              </div>
              <div className="text-right text-xs">
                <p className="font-mono font-bold">{activeSub.qr_code_token}</p>
                <p>Kupon Door Prize: {couponCode}</p>
                <p>Dicetak: {new Date().toLocaleDateString('id-ID')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-stone-500">Paket</p>
                <p className="font-bold">{activeSub.package_nama}</p>
              </div>
              <div>
                <p className="text-stone-500">Total Terkumpul</p>
                <p className="font-bold">{formatRupiah(activeSub.total_terkumpul)}</p>
              </div>
              <div>
                <p className="text-stone-500">Target Paket</p>
                <p className="font-bold">{formatRupiah(activeSub.target_nominal)}</p>
              </div>
              <div>
                <p className="text-stone-500">Status &amp; Agen</p>
                <p className="font-bold">
                  {activeSub.status.toUpperCase()} ({activeSub.agen_nama || activeSub.agen_kode})
                </p>
              </div>
            </div>
            {verifiedActiveDeposits.length > 0 && (
              <table className="mt-4 w-full border-t border-stone-300 text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="py-1.5">Tanggal</th>
                    <th className="py-1.5">Metode</th>
                    <th className="py-1.5">Catatan</th>
                    <th className="py-1.5 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedActiveDeposits.map((d) => (
                    <tr key={d.id} className="border-b border-stone-100">
                      <td className="py-1">{d.tanggal}</td>
                      <td className="py-1">{d.metode}</td>
                      <td className="py-1">{d.catatan || '-'}</td>
                      <td className="py-1 text-right font-mono">
                        {d.jenis_transaksi === 'penarikan' ? '-' : '+'}
                        {formatRupiah(d.nominal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Main Passbook + QR Grid */}
          <div className="no-print grid gap-6 lg:grid-cols-12">
            {/* Left 8 cols: Passbook Summary, Tracker, Contents & Upload Transfer */}
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-[#0C3328]">
                      {activeSub.wilayah} · Agen: {activeSub.agen_nama || activeSub.agen_kode}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-[#381E5A]">
                      {activeSub.package_nama}
                    </h2>
                  </div>
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      activeSub.status === 'diambil'
                        ? 'bg-[#381E5A] text-white'
                        : isPaidOff
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {activeSub.status === 'diambil'
                      ? 'Paket Sudah Diambil'
                      : isPaidOff
                        ? 'Lunas — Siap Ambil'
                        : 'Tabungan Aktif'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="mt-6">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-stone-600">Progres Pelunasan</span>
                    <span className="font-mono-nums text-base font-bold text-[#0C3328]">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#EFE8D8]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0C3328] to-[#1A634D] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Financial Stats */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#EFE8D8] pt-5 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-stone-500">Total Terkumpul</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-[#0C3328]">
                      {formatRupiah(activeSub.total_terkumpul)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Target Paket</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-[#381E5A]">
                      {formatRupiah(activeSub.target_nominal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Sisa Pelunasan</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-[#B98E3A]">
                      {formatRupiah(remainingAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Jadwal Ambil</p>
                    <p className="mt-1 text-sm font-semibold text-stone-900">
                      {activeSub.jadwal_ambil || 'H-7 Lebaran'}
                    </p>
                  </div>
                </div>

                {/* Installment Tracker Card */}
                {installmentSchedule && (
                  <div className="mt-5 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#381E5A]">
                        <CalendarClock className="h-4 w-4 text-[#C8A053]" />
                        <span>
                          Tracker Cicilan: Minggu ke-{installmentSchedule.currentWeek} dari{' '}
                          {installmentSchedule.totalWeeks} Minggu ({installmentSchedule.totalDays}{' '}
                          Hari)
                        </span>
                      </div>
                      <span
                        className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${installmentSchedule.paceTone}`}
                      >
                        {installmentSchedule.paceLabel}
                      </span>
                    </div>
                    <div className="mt-2.5 grid gap-2 text-xs text-stone-600 sm:grid-cols-3">
                      <div>
                        Cicilan Ideal:{' '}
                        <strong className="font-mono-nums text-stone-900">
                          {formatRupiah(activeSub.setoran_nominal || 20000)}
                        </strong>{' '}
                        ({activeSub.frekuensi === 'harian' ? 'Harian' : 'Mingguan'})
                      </div>
                      <div>
                        Target s.d. Minggu Ini:{' '}
                        <strong className="font-mono-nums text-stone-900">
                          {formatRupiah(installmentSchedule.expectedByNow)}
                        </strong>
                      </div>
                      <div>
                        Estimasi Lunas:{' '}
                        <strong className="text-stone-900">{installmentSchedule.estEndStr}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5-Stage Delivery & Packing Stepper */}
                <div className="mt-5 rounded-xl border border-[#E4DCCB] bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#381E5A]">
                      <Truck className="h-4 w-4 text-[#0C3328]" />
                      Status Pengepakan &amp; Pengiriman Paket
                    </span>
                    {activeSub.grup_arisan && (
                      <span className="inline-flex items-center gap-1 rounded bg-[#381E5A]/10 px-2 py-0.5 text-[11px] font-bold text-[#381E5A]">
                        <Users className="h-3 w-3" />
                        Grup: {activeSub.grup_arisan}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {(
                      [
                        { id: 'menunggu_lunas', label: '1. Tabungan Aktif' },
                        { id: 'dikemas_gudang', label: '2. Dikemas Gudang' },
                        { id: 'kirim_korwil', label: '3. Kirim Korwil/Agen' },
                        { id: 'siap_diambil', label: '4. Siap Diambil' },
                        { id: 'selesai', label: '5. Diterima Member' },
                      ] as Array<{ id: DeliveryStage; label: string }>
                    ).map((step, idx, arr) => {
                      const currentIdx = arr.findIndex((s) => s.id === effectiveDeliveryStage);
                      const isDone = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <div
                          key={step.id}
                          className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition ${
                            isCurrent
                              ? 'border-[#0C3328] bg-[#0C3328] text-[#E8CA82]'
                              : isDone
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-stone-200 bg-stone-50 text-stone-400'
                          }`}
                        >
                          {step.label}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Official Product Substitution Notice (if any applies) */}
                {matchingSubstitutions.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-xs">
                    <p className="inline-flex items-center gap-1.5 font-bold text-amber-950">
                      <Replace className="h-4 w-4 text-amber-800" />
                      Pemberitahuan Resmi Penyesuaian / Substitusi Produk Setara
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {matchingSubstitutions.map((subNote) => (
                        <div
                          key={subNote.id}
                          className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-stone-800"
                        >
                          <p className="font-semibold text-[#381E5A]">
                            {subNote.produk_lama} &rarr;{' '}
                            <span className="text-[#0C3328]">{subNote.produk_pengganti}</span>
                          </p>
                          <p className="text-[11px] text-stone-600">
                            {subNote.alasan} ({subNote.tanggal})
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Package Contents & THR Breakdown Toggle */}
                {(activePackageItems.length > 0 || activeBonusThr > 0) && (
                  <div className="mt-4 rounded-xl border border-[#E4DCCB] bg-white">
                    <button
                      type="button"
                      onClick={() => setShowPackageContents((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] rounded-xl cursor-pointer"
                    >
                      <span className="inline-flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-[#0C3328]" />
                        <span>
                          Rincian Isi Paket ({activePackageItems.length} item)
                          {activeBonusThr > 0 && ` + THR Tunai ${formatRupiah(activeBonusThr)}`}
                        </span>
                      </span>
                      {showPackageContents ? (
                        <ChevronUp className="h-4 w-4 text-stone-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-stone-500" />
                      )}
                    </button>
                    {showPackageContents && (
                      <div className="border-t border-[#EFE8D8] px-4 py-3 text-xs">
                        {activeBonusThr > 0 && (
                          <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 font-semibold text-amber-900">
                            <Gift className="h-3.5 w-3.5 text-[#B98E3A]" />
                            <span>Bonus Uang THR Tunai: {formatRupiah(activeBonusThr)}</span>
                          </div>
                        )}
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {activePackageItems.map((item, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-stone-700">
                              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0C3328]" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Agent Contact + Switch Agent / Cancel Contract (only if balance == 0 && aktif) */}
                <div className="mt-5 space-y-3">
                  {activeAgentInfo && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FAF7F2] border border-[#E4DCCB] px-4 py-3 text-xs">
                      <span className="text-stone-600">
                        Setoran tunai jemput bola? Hubungi Agen{' '}
                        <strong className="text-[#381E5A]">{activeAgentInfo.nama}</strong> (
                        {activeAgentInfo.kode_agen}).
                      </span>
                      <a
                        href={formatWhatsAppUrl(
                          activeAgentInfo.no_wa,
                          `Halo ${activeAgentInfo.nama}, saya ${userProfile.nama} ingin konfirmasi setoran paket ${activeSub.package_nama} (Token: ${activeSub.qr_code_token}).`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#15803D] hover:underline"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Chat Agen via WhatsApp</span>
                      </a>
                    </div>
                  )}

                  {activeSub.status === 'aktif' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSwitchAgentId(activeSub.agen_id);
                            setShowAgentSwitch((v) => !v);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3 py-1.5 font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Ganti Agen Wilayah</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditGrupValue(activeSub.grup_arisan || '');
                            setShowGrupEdit((v) => !v);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3 py-1.5 font-semibold text-[#0C3328] hover:bg-[#FAF7F2] cursor-pointer"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>{activeSub.grup_arisan ? 'Ubah Label Grup/Arisan' : 'Tautkan Grup/Arisan'}</span>
                        </button>
                      </div>

                      {activeSub.total_terkumpul === 0 && (
                        <>
                          {confirmCancelContract ? (
                            <div className="flex items-center gap-2">
                              <span className="text-rose-700 font-semibold">Yakin batalkan?</span>
                              <button
                                type="button"
                                disabled={updatingAgent}
                                onClick={() => void handleCancelContract()}
                                className="rounded-lg bg-rose-700 px-3 py-1.5 font-semibold text-white hover:bg-rose-800 cursor-pointer"
                              >
                                Ya, Batalkan Kontrak
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmCancelContract(false)}
                                className="rounded-lg border border-stone-300 px-2.5 py-1.5 text-stone-600 cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmCancelContract(true)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Batalkan Kontrak (Saldo Rp 0)</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {showAgentSwitch && activeSub.status === 'aktif' && (
                    <div className="flex flex-col gap-2 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3 sm:flex-row sm:items-center">
                      <select
                        value={switchAgentId}
                        onChange={(e) => setSwitchAgentId(e.target.value)}
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.wilayah} — {a.nama} ({a.kode_agen})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={updatingAgent}
                        onClick={() => void handleSwitchAgent()}
                        className="rounded-lg bg-[#381E5A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#492974] disabled:opacity-60 cursor-pointer"
                      >
                        {updatingAgent ? 'Menyimpan...' : 'Simpan Agen Baru'}
                      </button>
                    </div>
                  )}

                  {showGrupEdit && activeSub.status === 'aktif' && (
                    <div className="flex flex-col gap-2 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        maxLength={80}
                        value={editGrupValue}
                        onChange={(e) => setEditGrupValue(e.target.value)}
                        placeholder="Nama Grup/Arisan Keluarga atau Kantor..."
                        className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
                      />
                      <button
                        type="button"
                        disabled={updatingAgent}
                        onClick={() => void handleSaveGrupArisan()}
                        className="rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
                      >
                        {updatingAgent ? 'Menyimpan...' : 'Simpan Grup'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Ringkasan Program Grup / Arisan Keluarga & Kantor */}
              {groupArisanSummaries.length > 0 && (
                <div className="rounded-2xl border border-[#E4DCCB] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#381E5A]" />
                    <h3 className="font-display text-lg font-bold text-[#381E5A]">
                      Ringkasan Grup &amp; Arisan Terhubung
                    </h3>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {groupArisanSummaries.map((grp) => {
                      const gPct =
                        grp.target > 0
                          ? Math.min(100, Math.round((grp.collected / grp.target) * 100))
                          : 0;
                      const shareText = `Rekap Grup "${grp.groupName}" (${grp.contracts.length} kontrak Sagitarius Parcel): Terkumpul ${formatRupiah(
                        grp.collected
                      )} dari target ${formatRupiah(grp.target)} (${gPct}%).`;
                      return (
                        <div
                          key={grp.groupName}
                          className="rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-[#381E5A]">{grp.groupName}</p>
                              <p className="text-[11px] text-stone-500">
                                {grp.contracts.length} Kontrak Terdaftar
                              </p>
                            </div>
                            <span className="font-mono-nums font-bold text-[#0C3328]">
                              {gPct}%
                            </span>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white">
                            <div
                              className="h-full rounded-full bg-[#0C3328]"
                              style={{ width: `${gPct}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="font-mono-nums font-semibold text-stone-700">
                              {formatRupiah(grp.collected)} / {formatRupiah(grp.target)}
                            </span>
                            <a
                              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-[#15803D] hover:underline"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Bagikan WA
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload Setoran Transfer atau Ajukan Penarikan */}
              {activeSub.status !== 'diambil' && (!isPaidOff || activeSub.total_terkumpul > 0) && (
                <form
                  onSubmit={handleSubmitTransactionRequest}
                  className="rounded-2xl border border-[#E4DCCB] bg-white p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE8D8] pb-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#381E5A]">
                        {txMode === 'setoran'
                          ? 'Kirim Setoran Transfer & Unggah Bukti'
                          : 'Ajukan Penarikan Saldo Tabungan'}
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-600">
                        {txMode === 'setoran'
                          ? 'Transfer ke rekening resmi Sagitarius Parcel lalu unggah struk. Saldo bertambah setelah divalidasi Agen/Admin.'
                          : 'Ajukan pencairan/penarikan saldo yang tersedia. Saldo berkurang otomatis setelah divalidasi Agen/Admin.'}
                      </p>
                    </div>

                    <div className="inline-flex rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-0.5 text-xs">
                      {!isPaidOff && (
                        <button
                          type="button"
                          onClick={() => {
                            setTxMode('setoran');
                            setDepositNominal(String(activeSub.setoran_nominal || 25000));
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                            txMode === 'setoran'
                              ? 'bg-[#0C3328] text-[#E8CA82]'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          <span>Setoran</span>
                        </button>
                      )}
                      {activeSub.total_terkumpul > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTxMode('penarikan');
                            setDepositNominal(
                              String(Math.min(50000, activeSub.total_terkumpul))
                            );
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                            txMode === 'penarikan'
                              ? 'bg-rose-800 text-white'
                              : 'text-stone-600 hover:text-stone-900'
                          }`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span>Penarikan</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Official Company Bank Account & Unique 3-Digit Invoice / QRIS Box */}
                  {txMode === 'setoran' && (
                    <div className="mt-4 space-y-3 rounded-xl border border-[#C8A053]/40 bg-[#FAF7F2] p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#381E5A]">
                          <Building2 className="h-4 w-4 text-[#C8A053]" />
                          <span>Rekening Resmi Transfer Setoran</span>
                        </div>
                        <span className="rounded bg-[#0C3328] px-2 py-0.5 text-[10px] font-semibold text-[#E8CA82]">
                          {appSettings.bank_nama}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-mono-nums text-base font-bold text-[#381E5A]">
                            {appSettings.bank_rekening}
                          </p>
                          <p className="text-xs text-stone-600">
                            a.n. <strong>{appSettings.bank_atas_nama}</strong>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyRekening()}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DCCB] bg-white px-3 py-1.5 text-xs font-semibold text-[#381E5A] hover:bg-stone-50 cursor-pointer"
                        >
                          {copiedBank ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-700" />
                              <span>Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Salin No. Rekening</span>
                            </>
                          )}
                        </button>
                      </div>

                      {appSettings.qris_kode && appSettings.qris_kode.trim() && (
                        <div className="border-t border-[#EFE8D8] pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-bold text-[#381E5A]">
                              <QrCode className="h-4 w-4 text-[#0C3328]" />
                              <span>QRIS Resmi Perusahaan</span>
                            </div>
                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-[#0C3328]">
                              {appSettings.qris_merchant?.trim() || appSettings.bank_atas_nama}
                            </span>
                          </div>
                          <div className="mt-2.5 flex flex-col gap-3 rounded-xl border border-[#C8A053]/50 bg-white p-3 sm:flex-row sm:items-center">
                            {isSafeImageSource(appSettings.qris_kode) ? (
                              <button
                                type="button"
                                onClick={() => setPreviewProofUrl(appSettings.qris_kode || null)}
                                className="group relative shrink-0 self-start overflow-hidden rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-1.5 cursor-pointer"
                                title="Klik untuk memperbesar gambar QRIS"
                              >
                                <img
                                  src={appSettings.qris_kode.trim()}
                                  alt="QRIS Resmi Sagitarius Parcel"
                                  className="h-28 w-28 object-contain"
                                />
                                <span className="mt-1 block text-center text-[10px] font-semibold text-[#381E5A] group-hover:underline">
                                  Perbesar QRIS
                                </span>
                              </button>
                            ) : (
                              <div className="shrink-0 self-start rounded-lg border border-[#E4DCCB] bg-white p-2">
                                <QRCodeSVG
                                  value={appSettings.qris_kode.trim()}
                                  size={112}
                                  level="M"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                              <p className="font-semibold text-[#381E5A]">
                                Scan QRIS untuk setoran instan via m-Banking / e-Wallet
                              </p>
                              <p className="text-[11px] leading-relaxed text-stone-600">
                                Pastikan nama penerima sesuai{' '}
                                <strong>
                                  {appSettings.qris_merchant?.trim() || appSettings.bank_atas_nama}
                                </strong>
                                , lalu unggah bukti bayar di bawah ini.
                              </p>
                              {!isSafeImageSource(appSettings.qris_kode) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(
                                      appSettings.qris_kode?.trim() || ''
                                    );
                                    setCopiedQris(true);
                                    setTimeout(() => setCopiedQris(false), 1800);
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DCCB] bg-[#FAF7F2] px-2.5 py-1 text-[11px] font-semibold text-[#381E5A] hover:bg-[#EFE8D8] cursor-pointer"
                                >
                                  {copiedQris ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-700" />
                                      <span>Kode QRIS Disalin</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Salin String QRIS</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="border-t border-[#EFE8D8] pt-3">
                        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#381E5A] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useUniqueInvoice}
                            onChange={(e) => setUseUniqueInvoice(e.target.checked)}
                            className="h-4 w-4 rounded border-stone-300 text-[#0C3328]"
                          />
                          <span>
                            Aktifkan Invoice Kode Unik 3-Digit (+{uniqueCodeSuffix}) &amp; QRIS Nominal Eksak
                          </span>
                        </label>

                        {useUniqueInvoice && baseDepositNum >= 1000 && (
                          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-[#C8A053]/60 bg-white p-3 sm:flex-row sm:items-center">
                            <div className="shrink-0 rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-2">
                              <QRCodeSVG
                                value={
                                  appSettings.qris_kode?.trim() &&
                                  !isSafeImageSource(appSettings.qris_kode)
                                    ? appSettings.qris_kode.trim()
                                    : `QRIS-SAGITARIUS|${currentInvoiceCode}|NOMINAL:${exactTransferTotal}|REK:${appSettings.bank_rekening}|MEMBER:${userProfile.nama}`
                                }
                                size={88}
                                level="M"
                              />
                            </div>
                            <div className="flex-1 space-y-1 text-xs">
                              <p className="font-mono-nums font-bold text-[#381E5A]">
                                {currentInvoiceCode}
                              </p>
                              <p className="text-stone-600">
                                Transfer nominal persis agar mudah dicocokkan oleh Agen/Admin:
                              </p>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono-nums text-base font-bold text-[#0C3328]">
                                  {formatRupiah(exactTransferTotal)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void navigator.clipboard.writeText(String(exactTransferTotal));
                                    setCopiedExactAmount(true);
                                    setTimeout(() => setCopiedExactAmount(false), 1800);
                                  }}
                                  className="inline-flex items-center gap-1 rounded border border-[#E4DCCB] bg-[#FAF7F2] px-2 py-0.5 text-[11px] font-semibold text-[#381E5A] cursor-pointer"
                                >
                                  <Copy className="h-3 w-3" />
                                  {copiedExactAmount ? 'Nominal Disalin' : 'Salin Nominal'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {appSettings.qris_catatan && (
                        <p className="border-t border-[#EFE8D8] pt-2 text-[11px] text-stone-600">
                          {appSettings.qris_catatan}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700">
                        {txMode === 'setoran'
                          ? 'Nominal Setoran (Rp)'
                          : `Nominal Penarikan (Maks ${formatRupiah(activeSub.total_terkumpul)})`}
                      </label>
                      <input
                        type="number"
                        min={1000}
                        max={txMode === 'penarikan' ? activeSub.total_terkumpul : undefined}
                        step={500}
                        required
                        value={depositNominal}
                        onChange={(e) => setDepositNominal(e.target.value)}
                        className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
                      />
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(txMode === 'setoran'
                          ? [
                              activeSub.setoran_nominal || 20000,
                              50000,
                              100000,
                              remainingAmount > 0 ? remainingAmount : 0,
                            ]
                          : [
                              Math.round(activeSub.total_terkumpul * 0.25),
                              Math.round(activeSub.total_terkumpul * 0.5),
                              activeSub.total_terkumpul,
                            ]
                        )
                          .filter((v, idx, arr) => v >= 1000 && arr.indexOf(v) === idx)
                          .map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setDepositNominal(String(preset))}
                              className="rounded-md border border-[#E4DCCB] bg-[#FAF7F2] px-2 py-1 font-mono-nums text-[11px] font-medium text-[#381E5A] hover:bg-[#EFE8D8] cursor-pointer"
                            >
                              {formatRupiah(preset)}
                            </button>
                          ))}
                      </div>
                    </div>

                    {txMode === 'setoran' ? (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Foto Bukti Transfer (JPG/PNG)
                        </label>
                        <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#C8A053] bg-[#FAF7F2] px-4 py-2.5 text-xs font-medium text-[#381E5A] hover:bg-[#EFE8D8]">
                          <Upload className="h-4 w-4 text-[#0C3328]" />
                          <span>
                            {proofDataUrl ? 'Bukti Siap Diunggah (Ganti)' : 'Pilih Foto Struk'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProofFileChange}
                            className="hidden"
                          />
                        </label>
                        {proofDataUrl && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-emerald-800">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Foto terkompresi siap dikirim</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-stone-700">
                          Metode Pencairan Dana
                        </label>
                        <select
                          value={withdrawMethod}
                          onChange={(e) =>
                            setWithdrawMethod(
                              e.target.value as 'pencairan_tunai' | 'transfer_keluar'
                            )
                          }
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
                        >
                          <option value="pencairan_tunai">Pencairan Tunai via Agen</option>
                          <option value="transfer_keluar">Transfer ke Rekening Member</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={depositNote}
                      onChange={(e) => setDepositNote(e.target.value)}
                      placeholder={
                        txMode === 'setoran'
                          ? 'Catatan transfer (mis. Setoran minggu ke-4 via BRI/BCA)'
                          : 'Keterangan penarikan / no. rekening tujuan jika transfer'
                      }
                      className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#381E5A] focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={uploadingDeposit}
                      className={`rounded-xl px-5 py-2.5 text-xs font-semibold transition disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer ${
                        txMode === 'penarikan'
                          ? 'bg-rose-800 text-white hover:bg-rose-700'
                          : 'bg-[#0C3328] text-[#E8CA82] hover:bg-[#144738]'
                      }`}
                    >
                      {uploadingDeposit
                        ? 'Mengirim...'
                        : txMode === 'penarikan'
                          ? 'Ajukan Penarikan Saldo'
                          : 'Kirim Bukti Setoran'}
                    </button>
                  </div>
                </form>
              )}

              {/* KOMPONEN UTAMA: RIWAYAT TRANSAKSI (Setoran & Penarikan Tervalidasi Agen) */}
              <RiwayatTransaksi
                contractDeposits={activeDeposits}
                allMemberDeposits={myAllDeposits}
                subscriptions={mySubscriptions}
                activeContract={activeSub}
                onPreviewProof={(url) => setPreviewProofUrl(url)}
                onOpenReceipt={(dep) => setReceiptDeposit(dep)}
              />

              {/* Antrean Pengajuan Pending / Ditolak */}
              {pendingOrRejectedDeposits.length > 0 && (
                <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#381E5A]">
                      Pengajuan Menunggu Validasi / Ditolak ({pendingOrRejectedDeposits.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-500">
                      Transaksi di bawah ini otomatis masuk ke tabel Riwayat Transaksi setelah divalidasi oleh Agen.
                    </p>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#EFE8D8] text-xs text-stone-500">
                          <th className="py-2 pr-4 font-semibold">Tanggal</th>
                          <th className="py-2 pr-4 font-semibold">Jenis &amp; Catatan</th>
                          <th className="py-2 pr-4 text-right font-semibold">Nominal</th>
                          <th className="py-2 pr-4 font-semibold">Status</th>
                          <th className="py-2 text-right font-semibold">Bukti</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {pendingOrRejectedDeposits.map((dep) => {
                          const isWithdraw =
                            dep.jenis_transaksi === 'penarikan' ||
                            dep.metode === 'pencairan_tunai' ||
                            dep.metode === 'transfer_keluar';
                          return (
                            <tr key={dep.id} className="hover:bg-[#FAF7F2]">
                              <td className="py-2.5 pr-4 font-mono-nums text-xs text-stone-700 whitespace-nowrap">
                                {dep.tanggal}
                              </td>
                              <td className="py-2.5 pr-4">
                                <p className="text-xs font-semibold text-stone-900">
                                  {isWithdraw ? 'Pengajuan Penarikan' : 'Setoran Transfer'}
                                </p>
                                {dep.catatan && (
                                  <p className="text-xs text-stone-500">{dep.catatan}</p>
                                )}
                              </td>
                              <td className="py-2.5 pr-4 text-right font-mono-nums text-xs font-semibold text-stone-900 whitespace-nowrap">
                                {isWithdraw ? '-' : '+'}
                                {formatRupiah(dep.nominal)}
                              </td>
                              <td className="py-2.5 pr-4 whitespace-nowrap">
                                {dep.status_verifikasi === 'rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
                                    <XCircle className="h-3.5 w-3.5" />
                                    Ditolak
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                                    <Clock className="h-3.5 w-3.5" />
                                    Menunggu Validasi Agen
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 text-right">
                                {dep.bukti_foto_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewProofUrl(dep.bukti_foto_url || null)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C3328] hover:underline cursor-pointer"
                                  >
                                    <FileImage className="h-3.5 w-3.5" />
                                    Lihat
                                  </button>
                                ) : (
                                  <span className="text-xs text-stone-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Right 4 cols: Tiket QR Pengambilan & Kupon Undian Door Prize */}
            <div className="space-y-6 lg:col-span-4">
              <div className="rounded-2xl border border-[#E4DCCB] bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#0C3328]">Tiket Pengambilan Paket</p>
                  <QrCode className="h-4 w-4 text-[#0C3328]" />
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-[#381E5A]">
                  E-Tiket QR Gudang
                </h3>

                {isPaidOff ? (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-col items-center rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-5">
                      <QRCodeSVG
                        value={JSON.stringify({
                          token: activeSub.qr_code_token,
                          subId: activeSub.id,
                          member: activeSub.member_nama,
                          paket: activeSub.package_nama,
                        })}
                        size={176}
                        level="M"
                        includeMargin
                      />
                      <p className="mt-3 font-mono-nums text-xs font-bold text-[#381E5A]">
                        {activeSub.qr_code_token}
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        Jadwal Ambil: <strong>{activeSub.jadwal_ambil || 'H-7 Lebaran'}</strong>
                      </p>
                    </div>

                    <p className="text-xs leading-relaxed text-stone-600">
                      Tunjukkan QR Code ini kepada petugas gudang atau agen wilayah{' '}
                      <strong>{activeSub.wilayah}</strong> pada jadwal pengambilan (H-7 untuk sembako/kue atau H-2 untuk daging &amp; telur segar).
                    </p>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="no-print flex w-full items-center justify-center gap-2 rounded-xl border border-[#E4DCCB] py-2.5 text-xs font-semibold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Cetak / Simpan Tiket QR</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-6 text-center">
                    <Lock className="mx-auto h-8 w-8 text-[#C8A053]" />
                    <p className="mt-3 text-sm font-semibold text-[#381E5A]">
                      Tiket QR Terkunci
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                      Tiket QR Pengambilan diterbitkan otomatis setelah tabungan mencapai 100% (kurang{' '}
                      <strong className="font-mono-nums text-stone-900">
                        {formatRupiah(remainingAmount)}
                      </strong>
                      ).
                    </p>
                  </div>
                )}
              </div>

              {/* Kupon Undian Door Prize Digital */}
              <div className="rounded-2xl border border-[#C8A053]/60 bg-gradient-to-br from-[#381E5A] to-[#241140] p-6 text-white shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#E8CA82]">
                    <Ticket className="h-4 w-4" />
                    KUPON DOOR PRIZE LIVE
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isCouponEligible
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                        : 'bg-white/10 text-stone-300 border border-white/20'
                    }`}
                  >
                    {isCouponEligible ? 'Kupon Aktif' : 'Belum Aktif'}
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-[#C8A053]/50 bg-black/25 p-4 text-center">
                  <p className="text-[11px] text-stone-300">Nomor Kupon Undian Anda</p>
                  <p className="mt-1 font-mono-nums text-lg font-bold tracking-wider text-[#E8CA82]">
                    {couponCode}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-stone-300">
                    {isCouponEligible
                      ? 'Terdaftar otomatis untuk pengundian LIVE HP Android, Rice Cooker, Kipas Angin, & Kompor Gas.'
                      : 'Lakukan minimal 1x setoran tervalidasi untuk mengaktifkan nomor kupon undian ini.'}
                  </p>
                </div>

                {myWinningDraws.length > 0 && (
                  <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-950/70 p-3 text-xs">
                    <p className="inline-flex items-center gap-1.5 font-bold text-[#E8CA82]">
                      <Award className="h-4 w-4" />
                      Selamat! Kupon Anda Memenangkan Hadiah:
                    </p>
                    {myWinningDraws.map((w) => (
                      <p key={w.id} className="mt-1 text-emerald-100">
                        {w.hadiah} ({w.tanggal_undi}) — Kupon {w.kupon_kode}
                      </p>
                    ))}
                  </div>
                )}

                {doorPrizeDraws.length > 0 && (
                  <div className="mt-4 border-t border-white/15 pt-3">
                    <p className="text-[11px] font-semibold text-[#E8CA82]">
                      Pemenang Undian Terbaru
                    </p>
                    <div className="mt-2 space-y-1.5 text-[11px]">
                      {doorPrizeDraws.slice(0, 4).map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5"
                        >
                          <span className="truncate font-medium text-white">
                            {d.member_nama} ({d.wilayah})
                          </span>
                          <span className="ml-2 shrink-0 font-semibold text-[#E8CA82]">
                            {d.hadiah}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Preview Proof Photo */}
      {previewProofUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-bold text-stone-900">Bukti Transfer Member</span>
              <button
                type="button"
                onClick={() => setPreviewProofUrl(null)}
                className="rounded-lg p-1 text-stone-500 hover:bg-stone-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <img
              src={previewProofUrl}
              alt="Bukti Transfer"
              className="max-h-[70vh] w-full rounded-lg object-contain bg-stone-100"
            />
          </div>
        </div>
      )}
      <ReceiptGeneratorModal
        deposit={receiptDeposit}
        subscription={
          receiptDeposit
            ? mySubscriptions.find((s) => s.id === receiptDeposit.subscription_id) || activeSub
            : activeSub
        }
        onClose={() => setReceiptDeposit(null)}
      />
    </div>
  );
};
