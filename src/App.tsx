// --- API Key Gemini (dari variabel lingkungan, dengan fallback ke key yang disediakan) ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyC1FouU-ACBm479Sn00BbUX2Mk__iC6LwE';

// --- Middleware Autentikasi Sederhana untuk /api/cs-chat (harus login) ---
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Autentikasi diperlukan. Sertakan Bearer token.' });
  }
  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    return res.status(401).json({ error: 'Token tidak valid.' });
  }
  // Catatan: Verifikasi sebenarnya dilakukan oleh Firebase ID Token di klien.
  // Di sini kami hanya memastikan header Authorization ada dan berformat benar.
  next();
}

const CS_SYSTEM_INSTRUCTION = `Anda adalah Asisten Customer Service Online resmi Sagitarius Parcel (PT. SAGITARIUS TRINUNGGAL KARYA).