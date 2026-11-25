import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const BOOTSTRAPPED_ADMIN_EMAIL = 'akun310786@gmail.com';

interface FirebaseAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw) as FirebaseAppletConfig;
  } catch {
    return {};
  }
}

const firebaseAppletConfig = loadFirebaseAppletConfig();
const configuredProjectId =
  firebaseAppletConfig.projectId && firebaseAppletConfig.projectId !== 'remixed-project-id'
    ? firebaseAppletConfig.projectId
    : undefined;

const firebaseAdminApp = configuredProjectId
  ? getApps().length
    ? getApp()
    : initializeApp({ projectId: configuredProjectId })
  : null;

export interface VerifiedAuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  isBootstrappedAdmin: boolean;
  authTime?: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: VerifiedAuthUser | null;
}

// Simple sliding-window in-memory rate limiter for API routes
const rateLimitBuckets = new Map<string, number[]>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientKey = `${req.path}:${req.ip || 'unknown'}`;
    const recent = (rateLimitBuckets.get(clientKey) || []).filter((ts) => now - ts < windowMs);
    if (recent.length >= maxRequests) {
      res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({
        error: 'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu beberapa saat.',
      });
    }
    recent.push(now);
    rateLimitBuckets.set(clientKey, recent);
    if (rateLimitBuckets.size > 5000) {
      // Prevent unbounded growth
      const oldestKey = rateLimitBuckets.keys().next().value;
      if (oldestKey) rateLimitBuckets.delete(oldestKey);
    }
    return next();
  };
}

async function verifyBearerTokenFromHeader(authHeader?: string): Promise<VerifiedAuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || token.length > 8192 || !firebaseAdminApp) return null;

  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
  const email = typeof decoded.email === 'string' ? decoded.email : null;
  const emailVerified = Boolean(decoded.email_verified);
  return {
    uid: decoded.uid,
    email,
    emailVerified,
    isBootstrappedAdmin: Boolean(emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL),
    authTime: typeof decoded.auth_time === 'number' ? decoded.auth_time : undefined,
  };
}

async function attachOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  req.authUser = null;
  try {
    req.authUser = await verifyBearerTokenFromHeader(req.headers.authorization);
  } catch {
    req.authUser = null;
  }
  return next();
}

async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Autentikasi diperlukan. Sertakan Bearer token Firebase yang valid.',
      });
    }
    const verified = await verifyBearerTokenFromHeader(authHeader);
    if (!verified) {
      return res.status(401).json({
        error: 'Token autentikasi tidak valid atau konfigurasi server belum siap.',
      });
    }
    req.authUser = verified;
    return next();
  } catch {
    return res.status(401).json({
      error: 'Sesi token tidak valid atau sudah kedaluwarsa. Silakan masuk ulang.',
    });
  }
}

function sanitizeMemberContext(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[disensor]')
    .trim()
    .slice(0, 2000);
}

const CS_SYSTEM_INSTRUCTION = `Anda adalah Asisten Customer Service Online resmi Sagitarius Parcel (PT. SAGITARIUS TRINUNGGAL KARYA).
Jawab selalu dengan ramah, jelas, sopan, dan akurat dalam Bahasa Indonesia. Gunakan informasi resmi berikut sebagai sumber kebenaran utama:

IDENTITAS & KONTAK RESMI:
- Perusahaan: PT. SAGITARIUS TRINUNGGAL KARYA
- Brand: Sagitarius Parcel ("Our Eid, Our Happiness")
- Alamat Kantor / Gudang Pusat: Bantar Peundeuy RT. 006 RW. 001, Margajaya, Mangunreja, Kab. Tasikmalaya, Jawa Barat 46462
- Nomor WhatsApp CS Resmi: 0813 2438 3479 (https://wa.me/6281324383479)
- Website Resmi: www.sagitariusparcel.web.id
- Wilayah Layanan Agen Resmi Priangan Timur: Ciamis, Tasikmalaya, Banjar, Pangandaran, dan Garut.

KATALOG PAKET RESMI (Durasi standar 325 Hari):
1. PAKET BUNDA (4 Varian):
   - Reguler: Rp 2.000/hari (Total 325 hari Rp 650.000) · Wadah Travel Bag · THR Rp 200.000 · Minyak 2L, Good Day 10pcs, Terigu 1kg, Indomie AB 10pcs, Sosro Teh Botol 1L, Khong Guan 650g, Kental Manis 545g, Fanta 1L, Gula Pasir 1kg, Kapal Api 10pcs, Monde Butter 150g.
   - Silver: Rp 3.000/hari (Total 325 hari Rp 975.000) · Wadah Container Box · THR Rp 350.000 · Beras Premium 5kg, Minyak 2L, Terigu 1kg, Gula 1kg, ABC Squash, Pulpy Orange 1L, Teh Celup, Tango Wafer 200g, Roma Sari Gandum, Indomie AB 10pcs, Sosro Teh Botol 1L, Monde Butter 454g, Kental Manis 545g, Fanta 1L, Fox's Candy 170g, Kapal Api & Good Day Mocacino.
   - Gold: Rp 4.000/hari (Total 325 hari Rp 1.300.000) · Wadah Container Box · THR Rp 600.000 · Khong Guan 1600g, Monde Butter Cookies 454g, Beras Premium 5kg, Minyak 2L, Terigu 1kg, Gula 1kg, Kental Manis 545g, Fanta 1L, Sosro Teh Botol 1L, ABC Squash, Teh Celup, Indomie AB 15pcs, Fox's 170g.
   - Platinum: Rp 5.000/hari (Total 325 hari Rp 1.625.000) · Wadah Koper Dewasa · THR Rp 800.000 · Khong Guan 650g, Monde Butter 454g, Gula 1kg, Terigu 1kg, Indomie AB 15pcs, Minyak Btl 2L, Chocolatos Dark Klg, Good Time 133g, Kacang Tanah Kupas 1kg, Kental Manis 545g, Fanta 1L, Marjan Syrup 460ml.

2. PAKET ANAK (4 Varian):
   - Paket Hemat: Rp 1.500/hari (325 hari = Rp 487.500) · Travel Bag · THR Rp 100.000 · Berisi 18 jenis snack favorit anak (SilverQueen, Oreo, Chitato Lite, Qtela, Happytos, Japota, Potabee, Ultra UHT 1L, Sosro, Nutriboost, Buavita, Beng-Beng, Ritz, My Jelly, Monde Serena, Pop Mie, Chiki Twist, Fox's).
   - Paket Asyik: Rp 2.500/hari (325 hari = Rp 812.500) · Container Box · THR Rp 300.000 · Berisi 20 item (SilverQueen, Pringles, Oreo, Tango 200g, Pop Mie, Japota, Qtela, Tic Tic, Kanzler Sosis, Ritz, Fox's, Koko Crunch, Chiki Balls, Astor, Chiki Twist, Ultra UHT 1L, Pulpy 1L, Kental Manis 370g, Buavita, Monde Serena).
   - Paket Ceria: Rp 4.000/hari (325 hari = Rp 1.300.000) · Koper Karakter · THR Rp 600.000 · Berisi 22 item lengkap termasuk Pocky, Good Time, Tujuh Kurma, Koko Krunch, Pringles 102g, Kanzler Sosis, Roma Sari Gandum, dll.
   - Paket Hebat: Rp 5.000/hari (325 hari = Rp 1.625.000) · Koper Dewasa · THR Rp 900.000 · Berisi 28 item super lengkap.

3. PAKET PILIHAN (2 Varian Eksklusif):
   - Diamond: Rp 7.000/hari (325 hari = Rp 2.275.000) · Container Box · THR Rp 1.000.000 · Royal Choice 960g, Khong Guan 1600g, Beras Premium 5kg, Minyak 5L, Gula 1kg, Terigu 1kg, Mukena Silky Motif, Kental Manis, Pulpy Orange 1L, Marjan Syrup, Chocolatos Dark, Good Time, Kacang Kupas 1kg, Sosro 1L, Fox's 170g, Tango 200g, Indomie Goreng 10pcs & AB 10pcs.
   - Sultan: Rp 10.000/hari (325 hari = Rp 3.250.000) · Container Box · THR Rp 2.000.000 · Royal Choice 960g, Khong Guan 1600g, Beras 10kg, Minyak 5L, Indomie AB 1 Dus, ABC Sardines 425g, Chocolatos Dark, Good Time, Tango 200g, Kacang Kupas 1kg, Marjan Syrup, Gula 1kg, Terigu 1kg, Kental Manis 545g, Kapal Api 10pcs, Kopi ABC 10pcs.

4. PAKET UANG:
   - Paket Uang Munggahan: 295 Hari (mulai Rp 1.000/hari -> Rp 265.000 s.d. Rp 20.000/hari -> Rp 5.680.000) atau 42 Minggu (mulai Rp 20.000/minggu -> Rp 800.000 s.d. Rp 200.000/minggu -> Rp 8.000.000).
   - Paket Uang Lebaran: 325 Hari (mulai Rp 5.000/hari -> Rp 1.550.000 s.d. Rp 20.000/hari -> Rp 6.275.000) atau 45 Minggu (mulai Rp 20.000/minggu -> Rp 860.000 s.d. Rp 200.000/minggu -> Rp 8.600.000).

5. PAKET BARANG SATUAN (50 Item · 325 Hari):
   - Mulai Rp 100/hari (Susu UHT, Wong Coco 1kg, Sirup Marjan) hingga Beras 25kg (Rp 1.200–1.250/hari), Bimoli 5L (Rp 450/hari), Daging Sapi (Rp 500/hari), Daging Iga (Rp 450/hari), Daging Ayam (Rp 200/hari), Telur Ayam (Rp 150/hari), Monde Butter 908g (Rp 500/hari), Khong Guan 1600g (Rp 450/hari), Astor 1 Klg (Rp 700/hari).

KETENTUAN PENTING:
- Pembayaran standar selama 325 hari.
- Paket Uang dibagikan lebih awal; Paket Barang selambatnya 15 Ramadhan.
- Paket Satuan Daging & Telur dibagikan H-2 Idul Fitri.
- Paket uang tidak dapat diambil sebelum waktu pembagian yang ditentukan. Paket satuan barang tidak bisa diuangkan; jika anggota tidak menyelesaikan pembayaran hingga penuh, akan diberikan barang sejumlah nominal yang masuk (dikenakan biaya administrasi).
- Setiap Member berhak mendapatkan kupon Door Prize (HP Android, Rice Cooker, Kipas Angin, Kompor Gas, Tas, Voucher, dll.) jika memenuhi syarat rules pembayaran, diundi LIVE di akun sosial Sagitarius Parcel.

Jika user bertanya tentang pendaftaran, cek tabungan, atau kendala transaksi spesifik, arahkan juga ke menu Simulator/Tabungan Member di aplikasi ini atau ke WhatsApp CS Resmi 0813 2438 3479. Jawab singkat, terstruktur, dan mudah dibaca.`;

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const allowedOrigins = new Set([
    'https://www.sagitariusparcel.web.id',
    'https://sagitariusparcel.web.id',
    'https://www.sagitarius-parcel.web.id',
    'https://sagitarius-parcel.web.id',
    'https://sagitarius-parcel.web.app',
    'https://sagitarius-parcel.firebaseapp.com',
  ]);

  app.use('/api', (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.has(origin) || origin.startsWith('http://localhost:'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'sagitarius-parcel-api',
      authConfigured: Boolean(firebaseAdminApp),
    });
  });

  // Verified caller identity endpoint (verifies Firebase ID token cryptographically; never trusts body claims)
  app.get(
    '/api/me',
    createRateLimiter(60, 60_000),
    requireAuth,
    (req: AuthenticatedRequest, res: Response) => {
      return res.json({
        user: req.authUser,
      });
    }
  );

  app.post(
    '/api/cs-chat',
    createRateLimiter(25, 60_000),
    attachOptionalAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
        if (!apiKey || apiKey.includes('MY_GEMINI_API_KEY')) {
          return res.status(500).json({
            error:
              'API key Gemini belum aktif pada environment server. Periksa panel Settings > Secrets untuk memastikan GEMINI_API_KEY sudah terpasang.',
          });
        }

        if (!req.body || typeof req.body !== 'object' || !Array.isArray(req.body.messages)) {
          return res.status(400).json({ error: 'Format payload chat tidak valid.' });
        }

        const rawMessages = req.body.messages;
        if (rawMessages.length === 0 || rawMessages.length > 30) {
          return res.status(400).json({
            error: 'Jumlah riwayat pesan harus antara 1 hingga 30 pesan.',
          });
        }

        const mapped = rawMessages
          .slice(-14)
          .map((m: { role?: unknown; text?: unknown }) => ({
            role: (m?.role === 'model' ? 'model' : 'user') as 'user' | 'model',
            text: typeof m?.text === 'string' ? m.text.trim().slice(0, 2000) : '',
          }))
          .filter((m: { text: string }) => m.text.length > 0);

        const firstUserIdx = mapped.findIndex((m: { role: string }) => m.role === 'user');
        if (firstUserIdx === -1) {
          return res.status(400).json({ error: 'Pesan chat tidak boleh kosong.' });
        }

        const alternating: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
        for (const item of mapped.slice(firstUserIdx)) {
          const last = alternating[alternating.length - 1];
          if (last && last.role === item.role) {
            last.parts[0].text = `${last.parts[0].text}\n${item.text}`;
          } else {
            alternating.push({ role: item.role, parts: [{ text: item.text }] });
          }
        }

        // Only attach personal memberContext when caller presents a verified Firebase ID token
        const verifiedMemberContext = req.authUser
          ? sanitizeMemberContext(req.body?.memberContext)
          : '';

        const effectiveSystemInstruction = verifiedMemberContext
          ? `${CS_SYSTEM_INSTRUCTION}\n\nKONTEKS AKUN MEMBER TERVERIFIKASI (UID: ${req.authUser?.uid}):\n${verifiedMemberContext}`
          : CS_SYSTEM_INSTRUCTION;

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        const extractErrorInfo = (err: unknown): { status: number; code: string; message: string } => {
          const rawMsg = err instanceof Error ? err.message : String(err);
          let status = 500;
          let code = '';
          let msg = rawMsg;

          if (typeof err === 'object' && err !== null && 'status' in err) {
            const s = Number((err as { status?: unknown }).status);
            if (s >= 400 && s < 600) status = s;
          }

          try {
            const parsed = JSON.parse(rawMsg) as {
              error?: { code?: number; message?: string; status?: string };
            };
            if (parsed?.error) {
              if (parsed.error.code) status = parsed.error.code;
              if (parsed.error.status) code = parsed.error.status;
              if (parsed.error.message) msg = parsed.error.message;
            }
          } catch {
            // Raw text message
          }

          return { status, code, message: msg };
        };

        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const attemptGenerate = async (model: string, thinkingLevel: ThinkingLevel) => {
          return ai.models.generateContent({
            model,
            contents: alternating,
            config: {
              abortSignal: AbortSignal.timeout(12000),
              systemInstruction: effectiveSystemInstruction,
              thinkingConfig: {
                thinkingLevel,
              },
            },
          });
        };

        const modelCandidates: Array<{ model: string; thinkingLevel: ThinkingLevel }> = [
          { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
          { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL },
        ];

        let lastErr: unknown = null;
        let replyText = '';

        for (const candidate of modelCandidates) {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const response = await attemptGenerate(candidate.model, candidate.thinkingLevel);
              const txt = response.text?.trim();
              if (txt) {
                replyText = txt;
                break;
              }
            } catch (err) {
              lastErr = err;
              const info = extractErrorInfo(err);
              const isTimeout =
                (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) ||
                info.message.toLowerCase().includes('timeout') ||
                info.message.toLowerCase().includes('aborted');
              const isTransient =
                isTimeout ||
                info.status === 503 ||
                info.status === 502 ||
                info.status === 504 ||
                info.code === 'UNAVAILABLE';
              if (!isTransient) {
                throw err;
              }
              if (isTimeout) {
                break;
              }
              if (attempt === 0) {
                await sleep(600);
              }
            }
          }
          if (replyText) break;
        }

        if (!replyText) {
          if (lastErr) throw lastErr;
          return res.status(502).json({
            error: 'Respon dari asisten Gemini kosong. Silakan coba beberapa saat lagi.',
          });
        }

        return res.json({ reply: replyText });
      } catch (error) {
        console.error('Error /api/cs-chat:', error);
        const rawMsg = error instanceof Error ? error.message : String(error);
        let status = 500;
        let friendlyMsg = 'Gagal menghubungi layanan CS Online Gemini.';

        try {
          const parsed = JSON.parse(rawMsg) as {
            error?: { code?: number; message?: string; status?: string };
          };
          if (parsed?.error?.code) status = parsed.error.code;
          if (parsed?.error?.status === 'API_KEY_INVALID' || status === 400) {
            friendlyMsg =
              'API key Gemini tidak valid atau permintaan bermasalah. Silakan periksa API key di panel Settings > Secrets.';
          } else if (parsed?.error?.status === 'PERMISSION_DENIED' || status === 403) {
            friendlyMsg =
              'Akses API Gemini ditolak (PERMISSION_DENIED). Pastikan API key di panel Settings > Secrets memiliki izin yang aktif.';
          } else if (parsed?.error?.status === 'RESOURCE_EXHAUSTED' || status === 429) {
            friendlyMsg =
              'Kuota permintaan Gemini sedang penuh (429). Silakan coba beberapa saat lagi atau cek kuota API key di Settings > Secrets.';
          } else if (parsed?.error?.status === 'UNAVAILABLE' || status === 503) {
            friendlyMsg =
              'Server model Gemini sedang mengalami lonjakan permintaan sementara (503). Silakan kirim ulang sesaat lagi atau hubungi WA CS 0813 2438 3479.';
          } else if (parsed?.error?.message) {
            friendlyMsg = parsed.error.message;
          }
        } catch {
          if (rawMsg) friendlyMsg = rawMsg;
        }

        return res.status(status >= 400 && status < 600 ? status : 500).json({ error: friendlyMsg });
      }
    }
  );

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sagitarius Parcel server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
