import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import { COMPANY_INFO, formatWhatsAppUrl, LOGO_SAGITARIUS } from '../data/catalogData';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const QUICK_PROMPTS = [
  'Apa saja varian Paket Bunda & THR-nya?',
  'Bagaimana rincian Paket Pilihan Diamond & Sultan?',
  'Kapan jadwal pembagian paket barang & daging H-2?',
  'Alamat kantor & nomor WA CS resmi?',
];

const MEMBER_QUICK_PROMPTS = [
  'Berapa sisa pelunasan tabungan saya?',
  'Cek status paket & kupon Door Prize saya',
];

const WELCOME_MESSAGE: ChatMessage = {
  role: 'model',
  text: 'Assalamu’alaikum! Saya CS Online Sagitarius Parcel. Silakan tanyakan detail Paket Bunda, Paket Anak, Diamond/Sultan, Paket Uang, 50 Barang Satuan, atau cara daftar tabungan Lebaran.',
};

interface GeminiCSChatProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  memberContext?: string;
  memberLabel?: string;
}

export const GeminiCSChat: React.FC<GeminiCSChatProps> = ({
  isOpen: controlledOpen,
  onOpenChange,
  memberContext,
  memberLabel,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = (next: boolean) => {
    setInternalOpen(next);
    if (onOpenChange) onOpenChange(next);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [lastFailedInput, setLastFailedInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen, isLoading]);

  const sendMessage = async (textToSend: string, reuseLastUserTurn = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const nextMessages: ChatMessage[] = reuseLastUserTurn
      ? messages
      : [...messages, { role: 'user', text: trimmed }];

    if (!reuseLastUserTurn) {
      setMessages(nextMessages);
      setInput('');
    }
    setErrorText('');
    setLastFailedInput('');
    setIsLoading(true);

    try {
      const apiBase = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
      const res = await fetch(`${apiBase}/api/cs-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          ...(memberContext ? { memberContext } : {}),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Layanan CS Online AI memerlukan backend API aktif. Untuk bantuan langsung, silakan hubungi WhatsApp CS Resmi di ${COMPANY_INFO.csWhatsappDisplay}.`
        );
      }

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error || 'Gagal mendapatkan balasan dari CS Online.');
      }

      setMessages((prev) => [...prev, { role: 'model', text: data.reply! }]);
    } catch (err) {
      setLastFailedInput(trimmed);
      setErrorText(
        err instanceof Error ? err.message : 'Terjadi kendala saat menghubungi CS Online.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([WELCOME_MESSAGE]);
    setErrorText('');
    setLastFailedInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const activeQuickPrompts = memberContext
    ? [...MEMBER_QUICK_PROMPTS, ...QUICK_PROMPTS.slice(0, 2)]
    : QUICK_PROMPTS;

  return (
    <div className="fixed right-4 bottom-4 z-50 no-print">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2.5 rounded-full border border-[#C8A053]/60 bg-[#0C3328] px-4 py-3 text-xs font-semibold text-[#E8CA82] shadow-lg transition hover:bg-[#144738] cursor-pointer"
        >
          <img
            src={LOGO_SAGITARIUS}
            alt="CS Sagitarius Parcel"
            className="h-6 w-6 rounded-full object-cover bg-black"
          />
          <span>Chat CS Online</span>
        </button>
      ) : (
        <div className="flex h-[520px] max-h-[82vh] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#E4DCCB] bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#0C3328] px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <img
                src={LOGO_SAGITARIUS}
                alt="Logo Sagitarius Parcel"
                className="h-9 w-9 rounded-full border border-[#C8A053]/60 bg-black object-cover"
              />
              <div>
                <p className="text-sm font-bold leading-tight text-[#E8CA82]">CS Online Sagitarius</p>
                <p className="text-[11px] text-stone-200">
                  {memberLabel ? `Mode Personal: ${memberLabel}` : 'PT. Sagitarius Trinunggal Karya'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  className="rounded-lg px-2 py-1 text-[10px] font-semibold text-[#E8CA82] hover:bg-white/10 cursor-pointer"
                >
                  Ulangi
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-stone-300 hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Tutup chat CS"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {memberContext && (
            <div className="border-b border-[#E4DCCB] bg-emerald-50 px-3.5 py-1.5 text-[11px] font-medium text-emerald-900">
              Terhubung dengan data tabungan &amp; kupon Door Prize Anda.
            </div>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#FAF7F2] p-4">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    m.role === 'user'
                      ? 'bg-[#381E5A] text-white'
                      : 'border border-[#E4DCCB] bg-white text-stone-800'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-[#E4DCCB] bg-white px-3.5 py-2.5 text-xs text-stone-500">
                  Sedang menyiapkan jawaban...
                </div>
              </div>
            )}

            {errorText && (
              <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800">
                <p>{errorText}</p>
                {lastFailedInput && (
                  <button
                    type="button"
                    onClick={() => void sendMessage(lastFailedInput, true)}
                    className="rounded-md bg-rose-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-800 cursor-pointer"
                  >
                    Coba Kirim Ulang
                  </button>
                )}
              </div>
            )}

            {messages.length <= 1 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-semibold text-stone-500">Pertanyaan Cepat:</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeQuickPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(prompt)}
                      className="rounded-lg border border-[#E4DCCB] bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-stone-700 hover:border-[#381E5A] hover:text-[#381E5A] cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Direct WA Escalation Bar */}
          <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-3.5 py-2 text-[11px]">
            <span className="text-stone-600">Butuh admin langsung?</span>
            <a
              href={formatWhatsAppUrl(
                COMPANY_INFO.csWhatsappDigits,
                'Halo CS Sagitarius Parcel, saya ingin bertanya tentang paket tabungan Lebaran.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-[#15803D] hover:underline"
            >
              <MessageCircle className="h-3 w-3" />
              <span>WA {COMPANY_INFO.csWhatsappDisplay}</span>
            </a>
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 border-t border-stone-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaan Anda..."
              className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#26124A] focus:outline-none"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="inline-flex items-center justify-center rounded-lg bg-[#26124A] p-2.5 text-white transition hover:bg-[#341A63] disabled:opacity-50 cursor-pointer"
              aria-label="Kirim pesan"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
