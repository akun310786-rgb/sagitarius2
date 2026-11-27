import React, { useState } from 'react';
import {
  Briefcase,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  MapPin,
  Phone,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  X,
} from 'lucide-react';
import { LOGO_SAGITARIUS } from '../data/catalogData';
import { UserProfile, WILAYAH_LIST, WilayahPriangan } from '../types';

export interface RegisterMemberInput {
  nama: string;
  username: string;
  no_wa: string;
  email: string;
  wilayah: WilayahPriangan;
  password: string;
}

export interface RegisterAgentInput extends RegisterMemberInput {
  kecamatan: string;
  catatan: string;
}

export type AuthModalMode = 'login' | 'register_member' | 'register_agent';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  userProfile?: UserProfile | null;
  onClose: () => void;
  onLoginIdentifier: (identifier: string, password: string) => Promise<void>;
  onRegisterMember: (input: RegisterMemberInput) => Promise<void>;
  onRegisterAgent: (input: RegisterAgentInput) => Promise<void>;
  onLoginGoogle: () => Promise<void>;
  onSendPasswordReset?: (email: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  userProfile = null,
  onClose,
  onLoginIdentifier,
  onRegisterMember,
  onRegisterAgent,
  onLoginGoogle,
  onSendPasswordReset,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Login Form State
  const [identifier, setIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register Form State (shared between Member & Agen)
  const [regNama, setRegNama] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regWa, setRegWa] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWilayah, setRegWilayah] = useState<WilayahPriangan>('Tasikmalaya');
  const [regKecamatan, setRegKecamatan] = useState('');
  const [regCatatan, setRegCatatan] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const isMemberLoggedIn = userProfile?.role === 'member';
  const isAgentLoggedIn = userProfile?.role === 'agen';

  React.useEffect(() => {
    if (isOpen) {
      let resolvedMode = initialMode;
      if (userProfile?.role === 'member' && resolvedMode === 'register_member') {
        resolvedMode = 'login';
      } else if (userProfile?.role === 'agen' && resolvedMode === 'register_agent') {
        resolvedMode = 'login';
      }
      setMode(resolvedMode);
      setErrorMsg('');
      setInfoMsg('');
      if (userProfile?.role === 'member' && resolvedMode === 'register_agent') {
        setRegNama(userProfile.nama || '');
        setRegUsername(userProfile.username || '');
        setRegWa(userProfile.no_wa || '');
        setRegEmail(userProfile.email || '');
        setRegWilayah(userProfile.wilayah || 'Tasikmalaya');
      }
    }
  }, [isOpen, initialMode, userProfile]);

  if (!isOpen) return null;

  const isAgentMode = mode === 'register_agent';
  const isRegisterMode = mode === 'register_member' || mode === 'register_agent';
  const isUpgradeMemberToAgent = Boolean(isMemberLoggedIn && isAgentMode);

  const switchMode = (nextMode: AuthModalMode) => {
    if (isMemberLoggedIn && nextMode === 'register_member') return;
    if (isAgentLoggedIn && nextMode === 'register_agent') return;
    setMode(nextMode);
    setErrorMsg('');
    setInfoMsg('');
    setShowResetHelp(false);
    setShowPassword(false);
    if (isMemberLoggedIn && nextMode === 'register_agent' && userProfile) {
      setRegNama(userProfile.nama || '');
      setRegUsername(userProfile.username || '');
      setRegWa(userProfile.no_wa || '');
      setRegEmail(userProfile.email || '');
      setRegWilayah(userProfile.wilayah || 'Tasikmalaya');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    if (!identifier.trim() || !loginPassword) {
      setErrorMsg('Masukkan Nomor WhatsApp / Username / Gmail dan kata sandi Anda.');
      return;
    }
    setSubmitting(true);
    try {
      await onLoginIdentifier(identifier.trim(), loginPassword);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk ke akun.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetClick = async () => {
    setErrorMsg('');
    setInfoMsg('');
    const target = (resetEmail || (identifier.includes('@') ? identifier : '')).trim().toLowerCase();
    if (!target || !target.includes('@')) {
      setErrorMsg('Masukkan alamat Gmail terdaftar pada kolom reset, atau gunakan bantuan Admin WA di bawah.');
      return;
    }
    if (!onSendPasswordReset) return;
    setSubmitting(true);
    try {
      await onSendPasswordReset(target);
      setInfoMsg(`Tautan reset kata sandi telah dikirim ke ${target}. Periksa kotak masuk atau folder Spam Gmail Anda.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    const cleanUsername = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (regNama.trim().length < 2) {
      setErrorMsg('Nama lengkap minimal 2 karakter.');
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMsg('Username minimal 3 karakter (huruf, angka, atau garis bawah "_").');
      return;
    }
    if (regWa.replace(/\D/g, '').length < 8) {
      setErrorMsg('Nomor WhatsApp tidak valid (minimal 8 digit).');
      return;
    }
    if (isAgentMode && regKecamatan.trim().length < 2) {
      setErrorMsg('Masukkan Kecamatan / area pemasaran calon Agen (minimal 2 karakter).');
      return;
    }
    if (!isUpgradeMemberToAgent && regPassword.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }

    setSubmitting(true);
    try {
      if (isAgentMode) {
        await onRegisterAgent({
          nama: regNama.trim(),
          username: cleanUsername,
          no_wa: regWa.trim(),
          email: regEmail.trim().toLowerCase(),
          wilayah: regWilayah,
          kecamatan: regKecamatan.trim().slice(0, 80),
          catatan: regCatatan.trim().slice(0, 300),
          password: regPassword,
        });
      } else {
        await onRegisterMember({
          nama: regNama.trim(),
          username: cleanUsername,
          no_wa: regWa.trim(),
          email: regEmail.trim().toLowerCase(),
          wilayah: regWilayah,
          password: regPassword,
        });
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isAgentMode
            ? 'Gagal mengirim pendaftaran agen baru.'
            : 'Gagal mendaftarkan akun member.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setSubmitting(true);
    try {
      await onLoginGoogle();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal masuk dengan Google.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/65 p-3 sm:p-4 backdrop-blur-xs safe-top safe-bottom"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#E4DCCB] bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#C8A053]/40 bg-[#381E5A] px-4 py-3.5 sm:px-6 sm:py-4 text-white">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <img
              src={LOGO_SAGITARIUS}
              alt="Logo Sagitarius Parcel"
              className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full border border-[#C8A053]/60 bg-black object-cover"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[#E8CA82]">Sagitarius Parcel</p>
              <h2 id="auth-modal-title" className="truncate font-display text-base sm:text-lg font-bold leading-tight">
                {mode === 'login'
                  ? 'Masuk Akun Sagitarius'
                  : isAgentMode
                    ? 'Daftar Agen Baru'
                    : 'Daftar Member Baru'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Tutup jendela login"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Switcher: Masuk | Daftar Member | Daftar Agen */}
        <div className="grid grid-cols-3 gap-1 border-b border-[#E4DCCB] bg-[#FAF7F2] p-1.5 text-[11px] font-semibold sm:text-xs">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-center transition cursor-pointer ${
              mode === 'login'
                ? 'bg-white text-[#381E5A] shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LogIn className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            <span className="truncate">Masuk Akun</span>
          </button>
          <button
            type="button"
            disabled={isMemberLoggedIn}
            title={isMemberLoggedIn ? 'Anda sudah masuk sebagai Member' : undefined}
            onClick={() => switchMode('register_member')}
            className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-center transition ${
              isMemberLoggedIn
                ? 'cursor-not-allowed opacity-45 text-stone-400'
                : mode === 'register_member'
                  ? 'bg-white text-[#381E5A] shadow-xs cursor-pointer'
                  : 'text-stone-600 hover:text-stone-900 cursor-pointer'
            }`}
          >
            <UserPlus className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            <span className="truncate">Daftar Member</span>
          </button>
          <button
            type="button"
            disabled={isAgentLoggedIn}
            title={isAgentLoggedIn ? 'Anda sudah masuk sebagai Agen' : undefined}
            onClick={() => switchMode('register_agent')}
            className={`flex items-center justify-center gap-1 rounded-lg px-1 py-2 text-center transition ${
              isAgentLoggedIn
                ? 'cursor-not-allowed opacity-45 text-stone-400'
                : mode === 'register_agent'
                  ? 'bg-[#0C3328] text-[#E8CA82] shadow-xs cursor-pointer'
                  : 'text-stone-600 hover:text-stone-900 cursor-pointer'
            }`}
          >
            <Briefcase className="hidden h-3.5 w-3.5 shrink-0 sm:block" />
            <span className="truncate">Daftar Agen</span>
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-rose-800">
              {errorMsg}
            </div>
          )}
          {infoMsg && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs leading-relaxed font-medium text-emerald-900">
              {infoMsg}
            </div>
          )}

          {!isRegisterMode ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-stone-700"
                >
                  Nomor WhatsApp, Username, atau Gmail
                </label>
                <div className="relative mt-1.5">
                  <UserIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="0813xxxx / username / nama@gmail.com"
                    className="w-full rounded-lg border border-stone-300 py-2.5 pr-3 pl-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#381E5A] focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-stone-500">
                  Masukkan Nomor WA, Username terdaftar, atau alamat Gmail Anda.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Kata Sandi
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowResetHelp((v) => !v)}
                    className="text-[11px] font-semibold text-[#381E5A] hover:underline cursor-pointer"
                  >
                    Lupa kata sandi?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-lg border border-stone-300 py-2.5 pr-10 pl-9 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#381E5A] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                    aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {showResetHelp && (
                <div className="space-y-2.5 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-3 text-xs">
                  <p className="font-semibold text-[#381E5A]">Bantuan Reset Kata Sandi</p>
                  {onSendPasswordReset && (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="Gmail terdaftar Anda..."
                        className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs"
                      />
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleSendResetClick()}
                        className="shrink-0 rounded-lg bg-[#0C3328] px-3 py-2 text-xs font-semibold text-[#E8CA82] hover:bg-[#144738] cursor-pointer"
                      >
                        Kirim Link
                      </button>
                    </div>
                  )}
                  <p className="text-[11px] text-stone-600">
                    Daftar tanpa Gmail?{' '}
                    <a
                      href={`https://wa.me/6281324383479?text=${encodeURIComponent(
                        `Halo Admin Sagitarius Parcel, saya lupa kata sandi akun (${
                          identifier || 'Nomor WA/Username saya'
                        }). Mohon dibantu reset akses akun.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#15803D] hover:underline"
                    >
                      Hubungi WA Admin CS (0813 2438 3479)
                    </a>
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-[#381E5A] py-2.5 text-sm font-semibold text-white transition hover:bg-[#492974] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Memeriksa Akun...' : 'Masuk Sekarang'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {isAgentMode && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950">
                  <p className="inline-flex items-center gap-1.5 font-bold text-[#0C3328]">
                    <ShieldCheck className="h-4 w-4 text-emerald-700" />
                    Pendaftaran Mitra Agen Resmi Priangan Timur
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-emerald-900">
                    {isUpgradeMemberToAgent
                      ? `Pengajuan agen akan dikirim langsung menggunakan akun Member aktif Anda (${userProfile?.nama}) tanpa perlu membuat kata sandi baru.`
                      : 'Setelah mendaftar, pengajuan agen Anda langsung dikirim ke Admin Pusat secara realtime untuk aktivasi kode agen resmi.'}
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="reg-nama" className="block text-xs font-semibold text-stone-700">
                  Nama Lengkap {isAgentMode ? 'Calon Agen' : ''}
                </label>
                <input
                  id="reg-nama"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={regNama}
                  onChange={(e) => setRegNama(e.target.value)}
                  placeholder={isAgentMode ? 'Contoh: Hj. Siti Aminah' : 'Contoh: Ibu Siti Aminah'}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-username"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Username
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={32}
                    value={regUsername}
                    onChange={(e) =>
                      setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                    }
                    placeholder={isAgentMode ? 'agen_siti' : 'siti_tasik'}
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="reg-wa" className="block text-xs font-semibold text-stone-700">
                    Nomor WhatsApp Aktif
                  </label>
                  <div className="relative mt-1">
                    <Phone className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                    <input
                      id="reg-wa"
                      type="tel"
                      required
                      minLength={8}
                      maxLength={20}
                      value={regWa}
                      onChange={(e) => setRegWa(e.target.value)}
                      placeholder="0813xxxxxxxx"
                      className="w-full rounded-lg border border-stone-300 py-2 pr-3 pl-8 font-mono-nums text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-wilayah"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Wilayah {isAgentMode ? 'Penugasan' : ''}
                  </label>
                  <div className="relative mt-1">
                    <MapPin className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
                    <select
                      id="reg-wilayah"
                      value={regWilayah}
                      onChange={(e) => setRegWilayah(e.target.value as WilayahPriangan)}
                      className="w-full rounded-lg border border-stone-300 bg-white py-2 pr-3 pl-8 text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
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
                  <label htmlFor="reg-email" className="block text-xs font-semibold text-stone-700">
                    Gmail / Email <span className="font-normal text-stone-400">(Opsional)</span>
                  </label>
                  <input
                    id="reg-email"
                    type="email"
                    maxLength={150}
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
                  />
                </div>
              </div>

              {isAgentMode && (
                <>
                  <div>
                    <label
                      htmlFor="reg-kecamatan"
                      className="block text-xs font-semibold text-stone-700"
                    >
                      Kecamatan / Area Pemasaran
                    </label>
                    <input
                      id="reg-kecamatan"
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={regKecamatan}
                      onChange={(e) => setRegKecamatan(e.target.value)}
                      placeholder="Contoh: Ciamis Kota & Cijeungjing"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#0C3328] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="reg-catatan"
                      className="block text-xs font-semibold text-stone-700"
                    >
                      Catatan / Pengalaman Koordinator{' '}
                      <span className="font-normal text-stone-400">(Opsional)</span>
                    </label>
                    <input
                      id="reg-catatan"
                      type="text"
                      maxLength={300}
                      value={regCatatan}
                      onChange={(e) => setRegCatatan(e.target.value)}
                      placeholder="Contoh: Mengelola kelompok arisan RT / toko sembako"
                      className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-[#0C3328] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {!isUpgradeMemberToAgent && (
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-semibold text-stone-700"
                  >
                    Buat Kata Sandi (Min. 6 Karakter)
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimal 6 huruf atau angka"
                      className="w-full rounded-lg border border-stone-300 py-2 pr-10 pl-3 text-sm text-stone-900 focus:border-[#26124A] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-stone-400 hover:text-stone-700 cursor-pointer"
                      aria-label={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-60 cursor-pointer ${
                  isAgentMode
                    ? 'bg-[#0C3328] text-[#E8CA82] hover:bg-[#144738]'
                    : 'bg-[#26124A] text-white hover:bg-[#341A63]'
                }`}
              >
                {submitting
                  ? isAgentMode
                    ? 'Mengirim Pendaftaran Agen...'
                    : 'Mendaftarkan Akun...'
                  : isAgentMode
                    ? 'Daftar Sebagai Agen Baru'
                    : 'Daftar & Masuk Member'}
              </button>
            </form>
          )}

          {/* Divider + Google Login Below */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-[11px] font-medium text-stone-500">
              atau lebih cepat dengan
            </span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleGoogleClick()}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-stone-300 bg-white py-2.5 text-sm font-semibold text-stone-800 transition hover:bg-stone-50 disabled:opacity-60 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
              />
            </svg>
            <span>Masuk dengan Google</span>
          </button>

          <p className="mt-4 text-center text-xs text-stone-500">
            {mode === 'login' ? (
              <>
                Belum punya akun?{' '}
                <button
                  type="button"
                  disabled={isMemberLoggedIn}
                  onClick={() => switchMode('register_member')}
                  className={`font-semibold text-[#26124A] ${
                    isMemberLoggedIn ? 'cursor-not-allowed opacity-45' : 'hover:underline cursor-pointer'
                  }`}
                >
                  Daftar Member
                </button>{' '}
                atau{' '}
                <button
                  type="button"
                  disabled={isAgentLoggedIn}
                  onClick={() => switchMode('register_agent')}
                  className={`font-semibold text-[#0C3328] ${
                    isAgentLoggedIn ? 'cursor-not-allowed opacity-45' : 'hover:underline cursor-pointer'
                  }`}
                >
                  Daftar Agen Baru
                </button>
              </>
            ) : (
              <>
                Sudah terdaftar sebelumnya?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-semibold text-[#26124A] hover:underline cursor-pointer"
                >
                  Masuk Akun
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
