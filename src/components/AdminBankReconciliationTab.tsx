import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  ClipboardPaste,
  FileCheck,
  HelpCircle,
  RefreshCw,
  Search,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { formatRupiah } from '../data/catalogData';
import { AgentSettlement } from '../types';

interface BankMutationRow {
  id: string;
  rawText: string;
  nominal: number;
  description: string;
  tanggal?: string;
  matchedSettlementId?: string;
  matchScore: 'exact' | 'nominal' | 'none';
}

interface AdminBankReconciliationTabProps {
  pendingSettlements: AgentSettlement[];
  onBatchVerify: (settlementIds: string[]) => Promise<void>;
  bankName: string;
  bankRekening: string;
  bankAtasNama: string;
  qrisMerchant?: string;
}

export const AdminBankReconciliationTab: React.FC<AdminBankReconciliationTabProps> = ({
  pendingSettlements,
  onBatchVerify,
  bankName,
  bankRekening,
  bankAtasNama,
  qrisMerchant,
}) => {
  const [mutationInput, setMutationInput] = useState('');
  const [selectedMatchIds, setSelectedMatchIds] = useState<Record<string, boolean>>({});
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Filter only 'setor_tunai_pusat' with status 'pending'
  const pendingCashSettles = useMemo(() => {
    return pendingSettlements.filter(
      (s) => s.status === 'pending' && s.jenis === 'setor_tunai_pusat'
    );
  }, [pendingSettlements]);

  // Parse raw text pasted from Internet Banking / m-Banking / QRIS Report
  const parsedMutations = useMemo<BankMutationRow[]>(() => {
    if (!mutationInput.trim()) return [];

    const lines = mutationInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const rows: BankMutationRow[] = [];
    const usedSettlementIds = new Set<string>();

    lines.forEach((line, idx) => {
      // Find nominal in line: look for numbers like 500.000 or 1500000 or Rp 2.500.000
      // Ignore years like 2025/2026 if possible
      const cleanNominalMatch = line.match(/(?:Rp\s*)?([1-9]\d{0,2}(?:\.\d{3})+|[1-9]\d{4,9})/i);
      let nominal = 0;
      if (cleanNominalMatch) {
        nominal = Number(cleanNominalMatch[1].replace(/\./g, ''));
      }

      if (nominal < 1000) return; // skip noise lines

      // Try matching against pending settlements
      let matchedSettlementId: string | undefined;
      let matchScore: 'exact' | 'nominal' | 'none' = 'none';

      const lineUpper = line.toUpperCase();

      // First pass: match exact nominal AND agent code or name in text
      for (const st of pendingCashSettles) {
        if (usedSettlementIds.has(st.id)) continue;
        if (st.nominal === nominal) {
          const hasKode = st.agen_kode && lineUpper.includes(st.agen_kode.toUpperCase());
          const hasNama = st.agen_nama && lineUpper.includes(st.agen_nama.toUpperCase().split(' ')[0]);
          if (hasKode || hasNama) {
            matchedSettlementId = st.id;
            matchScore = 'exact';
            usedSettlementIds.add(st.id);
            break;
          }
        }
      }

      // Second pass: if no exact name match, match by nominal only
      if (!matchedSettlementId) {
        for (const st of pendingCashSettles) {
          if (usedSettlementIds.has(st.id)) continue;
          if (st.nominal === nominal) {
            matchedSettlementId = st.id;
            matchScore = 'nominal';
            usedSettlementIds.add(st.id);
            break;
          }
        }
      }

      rows.push({
        id: `mut-${idx}`,
        rawText: line,
        nominal,
        description: line.slice(0, 100),
        matchedSettlementId,
        matchScore,
      });
    });

    return rows;
  }, [mutationInput, pendingCashSettles]);

  // Pre-select matches on parse
  React.useEffect(() => {
    const initialSelected: Record<string, boolean> = {};
    parsedMutations.forEach((m) => {
      if (m.matchedSettlementId && (m.matchScore === 'exact' || m.matchScore === 'nominal')) {
        initialSelected[m.matchedSettlementId] = true;
      }
    });
    setSelectedMatchIds(initialSelected);
  }, [parsedMutations]);

  // Sample mutation preset for quick demo/testing
  const handleLoadSample = () => {
    if (pendingCashSettles.length === 0) {
      setMutationInput(
        `25/11 CR Rp 1.500.000 SETORAN AGEN TASIK\n25/11 CR Rp 750.000 TRSF KAS SETORAN KORWIL\n25/11 CR Rp 2.450.000 QRIS MERCHANT SAGITARIUS`
      );
      return;
    }
    const sampleLines = pendingCashSettles.slice(0, 5).map((st, i) => {
      const d = new Date();
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}`;
      return `${dateStr} CR ${formatRupiah(st.nominal)} SETORAN ${st.agen_kode || ''} ${st.agen_nama.toUpperCase()}`;
    });
    setMutationInput(sampleLines.join('\n'));
  };

  const matchedCount = parsedMutations.filter((m) => m.matchedSettlementId).length;
  const selectedSettlementIds = Object.keys(selectedMatchIds).filter(
    (id) => selectedMatchIds[id]
  );

  const handleExecuteBatch = async () => {
    if (selectedSettlementIds.length === 0) return;
    setIsProcessingBatch(true);
    setStatusFeedback(null);
    try {
      await onBatchVerify(selectedSettlementIds);
      setStatusFeedback(
        `Berhasil memvalidasi ${selectedSettlementIds.length} setoran kas agen secara serentak.`
      );
      setSelectedMatchIds({});
      setMutationInput('');
    } catch (err) {
      setStatusFeedback(
        err instanceof Error ? err.message : 'Gagal memproses validasi batch.'
      );
    } finally {
      setIsProcessingBatch(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Rekening Sasaran */}
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#0C3328]" />
              <h2 className="font-display text-lg font-bold text-stone-900">
                Rekonsiliasi Kas Cepat &amp; Mutasi Rekening Pusat
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-600">
              Tempel (paste) catatan mutasi rekening bank atau QRIS pusat. Sistem akan secara otomatis mencocokkan nominal dengan antrean tutup kas agen yang pending untuk validasi massal.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-[#FAF7F2] px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-700" />
              <span>Contoh Mutasi</span>
            </button>
          </div>
        </div>

        {/* Info Rekening Penerima */}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-[#E4DCCB] bg-[#FAF7F2] p-3 text-xs">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#C8A053]" />
            <span className="font-semibold text-stone-800">Rekening Tujuan:</span>
            <span className="font-bold text-[#381E5A]">{bankName}</span>
            <span className="font-mono-nums font-bold text-stone-900">{bankRekening}</span>
            <span className="text-stone-500">a.n. {bankAtasNama}</span>
          </div>
          {qrisMerchant && (
            <div className="border-l border-stone-300 pl-3 text-stone-600">
              QRIS: <strong className="text-[#0C3328]">{qrisMerchant}</strong>
            </div>
          )}
          <div className="ml-auto font-mono-nums font-semibold text-emerald-900">
            {pendingCashSettles.length} Pengajuan Pending di Sistem
          </div>
        </div>
      </div>

      {statusFeedback && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs font-bold text-emerald-950 flex items-center justify-between">
          <span>{statusFeedback}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-stone-500 hover:text-stone-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input Mutasi & Hasil Pencocokan */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Kolom Kiri: Input Paste Teks */}
        <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-4 sm:p-5 lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <ClipboardPaste className="h-4 w-4 text-stone-500" />
              <span>Tempel Baris Mutasi Bank / QRIS</span>
            </label>
            <span className="text-[11px] text-stone-400">1 baris = 1 transaksi</span>
          </div>
          <textarea
            rows={8}
            value={mutationInput}
            onChange={(e) => setMutationInput(e.target.value)}
            placeholder="Contoh format:&#10;25/11 CR Rp 1.500.000 SETORAN AGT-TSK-001 BUDI&#10;25/11 CR 750.000 TRANSFER KAS KORWIL TASIK&#10;25/11 CR Rp 2.000.000 SETORAN SETTLE QRIS..."
            className="w-full rounded-lg border border-stone-300 p-3 font-mono-nums text-xs text-stone-900 focus:border-stone-500 focus:outline-hidden"
          />

          <p className="text-[11px] text-stone-500 leading-relaxed">
            Tips: Cukup copy-paste tabel mutasi dari klikBCA, Livin by Mandiri, BRImo, atau dashboard QRIS. Sistem mengenali angka nominal dan nama agen secara otomatis.
          </p>
        </div>

        {/* Kolom Kanan: Hasil Pencocokan / Match Engine */}
        <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-4 sm:p-5 lg:col-span-7 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-emerald-800" />
                <span>Hasil Pencocokan Otomatis ({matchedCount}/{parsedMutations.length} Cocok)</span>
              </h3>
              <p className="text-[11px] text-stone-500">
                {selectedSettlementIds.length} pengajuan dipilih untuk divalidasi massal.
              </p>
            </div>

            <button
              type="button"
              disabled={selectedSettlementIds.length === 0 || isProcessingBatch}
              onClick={handleExecuteBatch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0C3328] px-4 py-2 text-xs font-bold text-[#E8CA82] hover:bg-[#144738] disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isProcessingBatch ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Memvalidasi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Validasi Batch ({selectedSettlementIds.length} Setoran)</span>
                </>
              )}
            </button>
          </div>

          {parsedMutations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 bg-[#FAF7F2] p-8 text-center text-xs text-stone-500">
              <ClipboardPaste className="mx-auto h-8 w-8 text-stone-400 mb-2" />
              <p className="font-semibold text-stone-700">Belum ada baris mutasi yang ditempel.</p>
              <p className="mt-0.5 text-stone-500">
                Tempel teks mutasi di sebelah kiri atau klik &ldquo;Contoh Mutasi&rdquo; untuk simulasi pencocokan.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {parsedMutations.map((mut) => {
                const targetSettle = pendingCashSettles.find((s) => s.id === mut.matchedSettlementId);
                const isSelected = !!(mut.matchedSettlementId && selectedMatchIds[mut.matchedSettlementId]);

                return (
                  <div
                    key={mut.id}
                    className={`rounded-xl border p-3 text-xs transition ${
                      mut.matchScore === 'exact'
                        ? 'border-emerald-300 bg-emerald-50/60'
                        : mut.matchScore === 'nominal'
                          ? 'border-amber-300 bg-amber-50/50'
                          : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono-nums font-bold text-stone-900">
                            {formatRupiah(mut.nominal)}
                          </span>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                              mut.matchScore === 'exact'
                                ? 'bg-emerald-200 text-emerald-950'
                                : mut.matchScore === 'nominal'
                                  ? 'bg-amber-200 text-amber-950'
                                  : 'bg-stone-200 text-stone-700'
                            }`}
                          >
                            {mut.matchScore === 'exact'
                              ? 'Cocok Sempurna (Nominal & Agen)'
                              : mut.matchScore === 'nominal'
                                ? 'Nominal Cocok'
                                : 'Belum Ada Klaim Agen'}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] text-stone-600 truncate max-w-[340px]">
                          {mut.rawText}
                        </p>
                      </div>

                      {targetSettle && (
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right text-[11px]">
                            <p className="font-bold text-[#0C3328]">{targetSettle.agen_nama}</p>
                            <p className="text-stone-500 font-mono-nums">
                              {targetSettle.agen_kode || targetSettle.wilayah} · {targetSettle.tanggal}
                            </p>
                          </div>
                          <label className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-stone-200 shadow-xs">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedMatchIds((prev) => ({
                                  ...prev,
                                  [targetSettle.id]: e.target.checked,
                                }))
                              }
                              className="h-3.5 w-3.5 accent-[#0C3328]"
                            />
                            <span className="text-[11px] font-semibold text-stone-800">Pilih</span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
