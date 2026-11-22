import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Printer, X } from 'lucide-react';
import { COMPANY_INFO, formatRupiah } from '../data/catalogData';
import { Deposit, Subscription, TransactionType } from '../types';

interface ReceiptGeneratorModalProps {
  deposit: Deposit | null;
  subscription?: Subscription | null;
  onClose: () => void;
}

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
      return 'Setoran Tunai Agen';
    case 'transfer':
      return 'Transfer Bank Masuk';
    case 'pencairan_tunai':
      return 'Penarikan Tunai Agen';
    case 'transfer_keluar':
      return 'Transfer Pencairan';
    default:
      return dep.metode;
  }
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;
  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

export const ReceiptGeneratorModal: React.FC<ReceiptGeneratorModalProps> = ({
  deposit,
  subscription,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-thermal-receipt');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-thermal-receipt');
    };
  }, []);

  if (!deposit) return null;

  const isWithdraw = getTxType(deposit) === 'penarikan';
  const memberName = deposit.member_nama || subscription?.member_nama || deposit.member_id;
  const packageName = subscription?.package_nama || 'Kontrak Tabungan Sagitarius';
  const wilayah = deposit.wilayah || subscription?.wilayah || 'Priangan Timur';
  const validator =
    deposit.validated_by || subscription?.agen_nama || subscription?.agen_kode || 'Agen / Admin Resmi';
  const refCode = `SGT-${deposit.id.slice(-8).toUpperCase()}`;

  const handleDownloadPng = () => {
    setDownloading(true);
    try {
      const width = 600;
      const height = 780;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#F5F1E9';
      ctx.fillRect(0, 0, width, height);

      // Card container
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(28, 28, width - 56, height - 56);
      ctx.strokeStyle = '#C8A053';
      ctx.lineWidth = 2;
      ctx.strokeRect(28, 28, width - 56, height - 56);

      // Header Band (Royal Purple -> Forest Emerald)
      const grad = ctx.createLinearGradient(28, 28, width - 28, 165);
      grad.addColorStop(0, '#381E5A');
      grad.addColorStop(1, '#0C3328');
      ctx.fillStyle = grad;
      ctx.fillRect(28, 28, width - 56, 132);

      ctx.fillStyle = '#E8CA82';
      ctx.font = 'bold 20px Georgia, serif';
      ctx.fillText('SAGITARIUS PARCEL', 54, 72);

      ctx.fillStyle = '#E7E5E4';
      ctx.font = '12px sans-serif';
      ctx.fillText('PT. SAGITARIUS TRINUNGGAL KARYA', 54, 96);
      ctx.fillText('Our Eid, Our Happiness · Priangan Timur', 54, 114);

      // Verified Stamp
      ctx.fillStyle = '#0C3328';
      ctx.fillRect(width - 190, 54, 136, 34);
      ctx.strokeStyle = '#E8CA82';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(width - 190, 54, 136, 34);
      ctx.fillStyle = '#E8CA82';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('✓ TERVALIDASI', width - 174, 76);

      // Receipt Title
      ctx.fillStyle = '#381E5A';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(
        isWithdraw ? 'BUKTI PENCAIRAN / PENARIKAN DANA' : 'KWITANSI SETORAN TABUNGAN RESMI',
        54,
        196
      );

      // Nominal Highlight Box
      ctx.fillStyle = isWithdraw ? '#FFF1F2' : '#ECFDF5';
      ctx.fillRect(54, 214, width - 108, 84);
      ctx.strokeStyle = isWithdraw ? '#FECDD3' : '#A7F3D0';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(54, 214, width - 108, 84);

      ctx.fillStyle = '#57534E';
      ctx.font = '12px sans-serif';
      ctx.fillText('NOMINAL TRANSAKSI TERVALIDASI', 74, 240);

      ctx.fillStyle = isWithdraw ? '#9F1239' : '#0C3328';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`${isWithdraw ? '-' : '+'}${formatRupiah(deposit.nominal)}`, 74, 278);

      // Key-Value Rows
      const rows: Array<[string, string]> = [
        ['No. Referensi', refCode],
        ['Tanggal Transaksi', deposit.tanggal],
        ['Nama Member', memberName],
        ['Wilayah', wilayah],
        ['Paket Tabungan', packageName],
        ['Metode Transaksi', getMethodLabel(deposit)],
        ['Divalidasi Oleh', validator],
      ];

      if (subscription) {
        rows.push([
          'Saldo Terkumpul',
          `${formatRupiah(subscription.total_terkumpul)} / ${formatRupiah(
            subscription.target_nominal
          )}`,
        ]);
      }

      let curY = 336;
      rows.forEach(([label, val]) => {
        ctx.fillStyle = '#78716C';
        ctx.font = '13px sans-serif';
        ctx.fillText(label, 54, curY);

        ctx.fillStyle = '#1C1917';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(val.slice(0, 38), width - 54, curY);
        ctx.textAlign = 'left';

        ctx.strokeStyle = '#EFE8D8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(54, curY + 12);
        ctx.lineTo(width - 54, curY + 12);
        ctx.stroke();

        curY += 36;
      });

      // Catatan
      if (deposit.catatan) {
        ctx.fillStyle = '#78716C';
        ctx.font = '12px sans-serif';
        ctx.fillText('Catatan:', 54, curY + 4);
        ctx.fillStyle = '#292524';
        ctx.font = '12px sans-serif';
        curY = wrapCanvasText(ctx, deposit.catatan, 54, curY + 24, width - 108, 18);
      }

      // Footer
      ctx.fillStyle = '#FAF7F2';
      ctx.fillRect(54, height - 118, width - 108, 62);
      ctx.fillStyle = '#381E5A';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`WA CS Resmi: ${COMPANY_INFO.csWhatsappDisplay} · ${COMPANY_INFO.website}`, 70, height - 92);
      ctx.fillStyle = '#57534E';
      ctx.font = '11px sans-serif';
      ctx.fillText(
        `Token Kontrak: ${subscription?.qr_code_token || refCode} · Dicetak Digital`,
        70,
        height - 72
      );

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `struk-${refCode.toLowerCase()}-${deposit.tanggal}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintThermal = () => {
    document.body.classList.add('printing-thermal-receipt');
    window.setTimeout(() => {
      window.print();
    }, 60);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      {/* Modal Screen Card */}
      <div className="no-print w-full max-w-md overflow-hidden rounded-2xl border border-[#C8A053]/60 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-[#381E5A] to-[#0C3328] px-5 py-4 text-white">
          <div>
            <p className="text-[11px] font-semibold text-[#E8CA82]">
              {COMPANY_INFO.legalName}
            </p>
            <h3 className="font-display text-lg font-bold">
              Struk Transaksi Digital
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="Tutup modal struk"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div
            className={`rounded-xl border p-4 ${
              isWithdraw
                ? 'border-rose-200 bg-rose-50/70'
                : 'border-emerald-200 bg-emerald-50/70'
            }`}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-600">
                {isWithdraw ? 'Penarikan Dana' : 'Setoran Tabungan'}
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-[#0C3328] px-2 py-0.5 text-[10px] font-bold text-[#E8CA82]">
                <CheckCircle2 className="h-3 w-3" />
                TERVALIDASI
              </span>
            </div>
            <p
              className={`mt-1.5 font-mono-nums text-2xl font-bold ${
                isWithdraw ? 'text-rose-800' : 'text-[#0C3328]'
              }`}
            >
              {isWithdraw ? '-' : '+'}
              {formatRupiah(deposit.nominal)}
            </p>
            <p className="mt-1 font-mono-nums text-[11px] text-stone-500">
              Ref: {refCode} · {deposit.tanggal}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-[#E4DCCB] bg-[#FAF7F2] p-4 text-xs">
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Member</span>
              <span className="font-bold text-stone-900 text-right">{memberName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Wilayah</span>
              <span className="font-semibold text-stone-800 text-right">{wilayah}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Paket</span>
              <span className="font-semibold text-[#381E5A] text-right">{packageName}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Metode</span>
              <span className="font-semibold text-stone-800 text-right">
                {getMethodLabel(deposit)}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-stone-500">Validator</span>
              <span className="font-semibold text-[#0C3328] text-right">{validator}</span>
            </div>
            {subscription && (
              <div className="flex justify-between gap-3 border-t border-[#E4DCCB] pt-2">
                <span className="text-stone-500">Saldo Kontrak</span>
                <span className="font-mono-nums font-bold text-[#0C3328] text-right">
                  {formatRupiah(subscription.total_terkumpul)} /{' '}
                  {formatRupiah(subscription.target_nominal)}
                </span>
              </div>
            )}
            {deposit.catatan && (
              <p className="border-t border-[#E4DCCB] pt-2 text-[11px] text-stone-600">
                Catatan: {deposit.catatan}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0C3328] px-4 py-2.5 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-60 cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>{downloading ? 'Memproses...' : 'Unduh Struk PNG'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintThermal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#381E5A] bg-white px-4 py-2.5 text-xs font-bold text-[#381E5A] hover:bg-[#FAF7F2] cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Cetak Thermal 58mm</span>
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Thermal 58mm Print Sheet (shown ONLY during thermal print) */}
      <div className="thermal-receipt-sheet hidden mx-auto w-[58mm] bg-white p-2 font-mono text-[10px] leading-snug text-black">
        <div className="border-b border-dashed border-black pb-2 text-center">
          <p className="text-xs font-bold">SAGITARIUS PARCEL</p>
          <p className="text-[9px]">PT. SAGITARIUS TRINUNGGAL KARYA</p>
          <p className="text-[9px]">WA CS: {COMPANY_INFO.csWhatsappDisplay}</p>
        </div>

        <div className="space-y-1 border-b border-dashed border-black py-2">
          <p className="font-bold">
            {isWithdraw ? 'BUKTI PENARIKAN' : 'STRUK SETORAN RESMI'}
          </p>
          <p>Ref: {refCode}</p>
          <p>Tgl: {deposit.tanggal}</p>
          <p>Member: {memberName}</p>
          <p>Wilayah: {wilayah}</p>
          <p>Paket: {packageName}</p>
          <p>Metode: {getMethodLabel(deposit)}</p>
        </div>

        <div className="border-b border-dashed border-black py-2">
          <div className="flex justify-between font-bold text-xs">
            <span>NOMINAL:</span>
            <span>
              {isWithdraw ? '-' : '+'}
              {formatRupiah(deposit.nominal)}
            </span>
          </div>
          {subscription && (
            <>
              <div className="mt-1 flex justify-between">
                <span>Saldo Total:</span>
                <span>{formatRupiah(subscription.total_terkumpul)}</span>
              </div>
              <div className="flex justify-between">
                <span>Target:</span>
                <span>{formatRupiah(subscription.target_nominal)}</span>
              </div>
            </>
          )}
        </div>

        <div className="pt-2 text-center text-[9px]">
          <p>Status: TERVALIDASI</p>
          <p>Oleh: {validator}</p>
          {subscription?.qr_code_token && <p>Token: {subscription.qr_code_token}</p>}
          <p className="mt-1 font-bold">Terima Kasih · Our Eid, Our Happiness</p>
        </div>
      </div>
    </div>
  );
};
