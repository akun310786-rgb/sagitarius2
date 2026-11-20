import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileImage,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  QrCode,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { formatRupiah, formatWhatsAppUrl } from '../data/catalogData';
import {
  AgentDirectoryItem,
  Deposit,
  DepositMethod,
  ParcelPackage,
  SimulationLock,
  Subscription,
  TransactionType,
  UserProfile,
  WILAYAH_LIST,
  WilayahPriangan,
} from '../types';
import { RiwayatTransaksi } from './RiwayatTransaksi';

interface MemberDashboardProps {
  userProfile: UserProfile | null;
  packages: ParcelPackage[];
  agents: AgentDirectoryItem[];
  subscriptions: Subscription[];
  deposits: Deposit[];
  lockedSimulation: SimulationLock | null;
  onClearLockedSimulation: () => void;
  onNeedLogin: () => void;
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

export const MemberDashboard: React.FC<MemberDashboardProps> = ({
  userProfile,
  packages,
  agents,
  subscriptions,
  deposits,
  lockedSimulation,
  onClearLockedSimulation,
  onNeedLogin,
}) => {
  const [selectedSubId, setSelectedSubId] = useState<string>('');
  const [showNewContractForm, setShowNewContractForm] = useState<boolean>(!!lockedSimulation);

  // Registration Form State
  const [pkgId, setPkgId] = useState<string>(
    lockedSimulation?.packageItem.id || packages[0]?.id || 'pkg_bunda_reguler'
  );
  const [agentId, setAgentId] = useState<string>(
    lockedSimulation?.selectedAgentId || agents[0]?.id || 'agt_tsm_01'
  );
  const [wilayah, setWilayah] = useState<WilayahPriangan>(
    userProfile?.wilayah || 'Tasikmalaya'
  );
  const [durasiMinggu, setDurasiMinggu] = useState<number>(
    lockedSimulation?.durasiMinggu || 30
  );
  const [frekuensi, setFrekuensi] = useState<'harian' | 'mingguan'>(
    lockedSimulation?.frekuensi || 'mingguan'
  );
  const [submittingContract, setSubmittingContract] = useState(false);

  // Deposit & Withdrawal Request State
  const [txMode, setTxMode] = useState<TransactionType>('setoran');
  const [depositNominal, setDepositNominal] = useState<string>('25000');
  const [depositNote, setDepositNote] = useState<string>('');
  const [proofDataUrl, setProofDataUrl] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<'pencairan_tunai' | 'transfer_keluar'>('pencairan_tunai');
  const [uploadingDeposit, setUploadingDeposit] = useState(false);
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  const mySubscriptions = useMemo(() => {
    if (!userProfile) return [];
    return subscriptions.filter((s) => s.member_id === userProfile.uid);
  }, [subscriptions, userProfile]);

  const activeSub = useMemo(() => {
    if (mySubscriptions.length === 0) return null;
    return mySubscriptions.find((s) => s.id === selectedSubId) || mySubscriptions[0];
  }, [mySubscriptions, selectedSubId]);

  const myAllDeposits = useMemo(() => {
    if (!userProfile) return [];
    return deposits.filter((d) => d.member_id === userProfile.uid);
  }, [deposits, userProfile]);

  const activeDeposits = useMemo(() => {
    if (!activeSub) return [];
    return deposits.filter((d) => d.subscription_id === activeSub.id);
  }, [deposits, activeSub]);

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
        qr_code_token: qrToken,
        jadwal_ambil: selectedPkgForNew.jadwal_ambil,
        daftar_isi: selectedPkgForNew.daftar_isi.slice(0, 20),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'subscriptions'), payload);
      setSelectedSubId(docRef.id);
      setShowNewContractForm(false);
      onClearLockedSimulation();
      setFeedbackMsg('Kontrak tabungan berhasil dibuat dan terdaftar di agen pilihan Anda.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subscriptions');
    } finally {
      setSubmittingContract(false);
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

      await addDoc(collection(db, 'deposits'), {
        subscription_id: activeSub.id,
        member_id: userProfile.uid,
        member_nama: userProfile.nama,
        agen_id: activeSub.agen_id,
        wilayah: activeSub.wilayah,
        jenis_transaksi: txMode,
        nominal: nominalNum,
        metode,
        ...(txMode === 'setoran' && proofDataUrl ? { bukti_foto_url: proofDataUrl } : {}),
        catatan: depositNote.trim() || defaultNote,
        status_verifikasi: 'pending',
        tanggal: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setDepositNote('');
      setProofDataUrl('');
      setFeedbackMsg(
        txMode === 'penarikan'
          ? 'Pengajuan penarikan saldo berhasil dikirim. Menunggu validasi & pencairan dari Agen/Admin.'
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
        <div className="rounded-2xl border border-stone-200 bg-white p-8 sm:p-12">
          <h2 className="font-display text-2xl font-bold text-stone-900 sm:text-3xl">
            Masuk ke Buku Tabungan Member
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Masuk menggunakan Nomor WhatsApp, Username, Gmail, atau akun Google Anda untuk mengunci simulasi paket, memantau riwayat setoran digital, mengunggah bukti transfer, dan mengunduh Tiket QR Pengambilan.
          </p>
          <button
            type="button"
            onClick={onNeedLogin}
            className="mt-6 rounded-lg bg-[#26124A] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#341A63] cursor-pointer"
          >
            Masuk / Daftar Member
          </button>
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
  const isPaidOff = activeSub ? activeSub.status === 'lunas' || activeSub.status === 'diambil' || activeSub.total_terkumpul >= activeSub.target_nominal : false;
  const activeAgentInfo = activeSub ? agents.find((a) => a.id === activeSub.agen_id) : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-stone-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-800">
            Dashboard Member · {userProfile.wilayah}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-stone-900 sm:text-3xl">
            Buku Tabungan Digital — {userProfile.nama}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewContractForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>{showNewContractForm ? 'Tutup Form Daftar' : 'Tambah Kontrak Paket'}</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
          {feedbackMsg}
        </div>
      )}

      {/* New Contract / Locked Simulation Form */}
      {(showNewContractForm || lockedSimulation || mySubscriptions.length === 0) && (
        <form
          onSubmit={handleCreateContract}
          className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-amber-800">
                {lockedSimulation ? 'Simulasi Terkunci Siap Didaftarkan' : 'Pendaftaran Paket Baru'}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-stone-900">
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
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
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
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
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
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
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
                Jadwal &amp; Durasi
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
                  max={48}
                  value={durasiMinggu}
                  onChange={(e) => setDurasiMinggu(Number(e.target.value))}
                  className="w-1/2 rounded-lg border border-stone-300 bg-white px-2.5 py-2 font-mono-nums text-sm text-stone-900"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
            <div className="text-xs text-stone-600">
              Target Paket:{' '}
              <strong className="font-mono-nums text-stone-900">
                {formatRupiah(selectedPkgForNew?.harga_total || 0)}
              </strong>{' '}
              · Pengambilan: <strong>{selectedPkgForNew?.jadwal_ambil}</strong>
            </div>
            <button
              type="submit"
              disabled={submittingContract}
              className="rounded-lg bg-emerald-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
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
            <div className="flex flex-wrap gap-2">
              {mySubscriptions.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold transition cursor-pointer ${
                    sub.id === activeSub.id
                      ? 'bg-emerald-900 text-white'
                      : 'border border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {sub.package_nama} ({Math.min(100, Math.round((sub.total_terkumpul / sub.target_nominal) * 100))}%)
                </button>
              ))}
            </div>
          )}

          {/* Main Passbook + QR Grid */}
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left 8 cols: Passbook Summary & Upload Transfer */}
            <div className="space-y-6 lg:col-span-8">
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold text-emerald-800">
                      {activeSub.wilayah} · Agen: {activeSub.agen_nama || activeSub.agen_kode}
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-stone-900">
                      {activeSub.package_nama}
                    </h2>
                  </div>
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold ${
                      activeSub.status === 'diambil'
                        ? 'bg-stone-900 text-white'
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
                    <span className="font-mono-nums text-base font-bold text-emerald-900">
                      {progressPct}%
                    </span>
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-emerald-800 transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Financial Stats */}
                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-stone-500">Total Terkumpul</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-emerald-900">
                      {formatRupiah(activeSub.total_terkumpul)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Target Paket</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-stone-900">
                      {formatRupiah(activeSub.target_nominal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500">Sisa Pelunasan</p>
                    <p className="mt-1 font-mono-nums text-base font-bold text-amber-800">
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

                {activeAgentInfo && (
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs">
                    <span className="text-stone-600">
                      Butuh setoran tunai jemput bola? Hubungi Agen{' '}
                      <strong className="text-stone-900">{activeAgentInfo.nama}</strong> (
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
              </div>

              {/* Upload Setoran Transfer atau Ajukan Penarikan */}
              {activeSub.status !== 'diambil' && (!isPaidOff || activeSub.total_terkumpul > 0) && (
                <form
                  onSubmit={handleSubmitTransactionRequest}
                  className="rounded-2xl border border-stone-200 bg-white p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
                    <div>
                      <h3 className="font-display text-lg font-bold text-stone-900">
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

                    <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5 text-xs">
                      {!isPaidOff && (
                        <button
                          type="button"
                          onClick={() => {
                            setTxMode('setoran');
                            setDepositNominal(String(activeSub.setoran_nominal || 25000));
                          }}
                          className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 font-semibold transition cursor-pointer ${
                            txMode === 'setoran'
                              ? 'bg-emerald-900 text-white'
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
                        className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 font-mono-nums text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
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
                              className="rounded-md border border-stone-200 bg-stone-50 px-2 py-1 font-mono-nums text-[11px] font-medium text-stone-700 hover:bg-stone-100 cursor-pointer"
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
                        <label className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-2.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
                          <Upload className="h-4 w-4 text-emerald-800" />
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
                          className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
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
                          ? 'Catatan transfer (mis. Setoran minggu ke-4 via BCA)'
                          : 'Keterangan penarikan / no. rekening tujuan jika transfer'
                      }
                      className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-emerald-800 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={uploadingDeposit}
                      className={`rounded-lg px-5 py-2.5 text-xs font-semibold text-white transition disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer ${
                        txMode === 'penarikan'
                          ? 'bg-rose-800 hover:bg-rose-700'
                          : 'bg-emerald-900 hover:bg-emerald-800'
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
              />

              {/* Antrean Pengajuan Pending / Ditolak */}
              {pendingOrRejectedDeposits.length > 0 && (
                <div className="rounded-2xl border border-stone-200 bg-white p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-stone-900">
                        Pengajuan Menunggu Validasi / Ditolak ({pendingOrRejectedDeposits.length})
                      </h3>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Transaksi di bawah ini akan otomatis masuk ke tabel Riwayat Transaksi setelah divalidasi oleh Agen.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-stone-200 text-xs text-stone-500">
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
                            <tr key={dep.id} className="hover:bg-stone-50">
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
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
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

            {/* Right 4 cols: Tiket QR Pengambilan */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-stone-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-emerald-800">Tiket Pengambilan Paket</p>
                  <QrCode className="h-4 w-4 text-emerald-800" />
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-stone-900">
                  E-Tiket QR Gudang
                </h3>

                {isPaidOff ? (
                  <div className="mt-5 space-y-4">
                    <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-[#FAF8F4] p-5">
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
                      <p className="mt-3 font-mono-nums text-xs font-bold text-stone-900">
                        {activeSub.qr_code_token}
                      </p>
                      <p className="mt-1 text-xs text-stone-600">
                        Jadwal Ambil: <strong>{activeSub.jadwal_ambil || 'H-7 Lebaran'}</strong>
                      </p>
                    </div>

                    <p className="text-xs leading-relaxed text-stone-600">
                      Tunjukkan QR Code ini kepada petugas gudang atau agen wilayah <strong>{activeSub.wilayah}</strong> pada jadwal pengambilan (H-7 untuk sembako/kue atau H-2 untuk daging &amp; telur segar).
                    </p>

                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="no-print flex w-full items-center justify-center gap-2 rounded-lg border border-stone-300 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      <span>Cetak / Simpan Tiket QR</span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
                    <Lock className="mx-auto h-8 w-8 text-stone-400" />
                    <p className="mt-3 text-sm font-semibold text-stone-800">
                      Tiket QR Terkunci
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-stone-600">
                      Tiket QR Pengambilan akan diterbitkan secara otomatis setelah tabungan mencapai 100% (kurang{' '}
                      <strong className="font-mono-nums text-stone-900">
                        {formatRupiah(remainingAmount)}
                      </strong>
                      ).
                    </p>
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
    </div>
  );
};
