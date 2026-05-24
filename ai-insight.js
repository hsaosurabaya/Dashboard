/**
 * AI INSIGHT ENGINE — Dashboard HS AO Surabaya
 * Engine: OpenAI GPT-5.5
 * Shared module untuk index.html & penjualan.html
 *
 * Fitur:
 * - Modal popup API key (hanya muncul sekali)
 * - Auto-generate insight saat data berubah (fingerprint cache)
 * - localStorage cache → insight tetap muncul walau browser di-refresh
 * - Context-aware → tiap halaman dapat analisa berbeda
 */

const AIInsight = (() => {

  // ── CONFIG ────────────────────────────────────────────────────────────
  const CACHE_KEY_PREFIX = 'ai_insight_cache_';
  const API_KEY_STORAGE  = 'ai_insight_api_key';
  const MODEL            = 'gpt-5.4-mini';
  const MAX_TOKENS       = 4096;

  // ── STATE ─────────────────────────────────────────────────────────────
  let _apiKey      = localStorage.getItem(API_KEY_STORAGE) || '';
  let _isRunning   = false;
  let _currentPage = detectPage();
  let _pendingPayload = null;

  // ── DETECT PAGE ───────────────────────────────────────────────────────
  function detectPage() {
    const path = window.location.pathname;
    if (path.includes('penjualan')) return 'penjualan';
    return 'summary';
  }

  // ── FINGERPRINT ───────────────────────────────────────────────────────
  function buildFingerprint(payload) {
    const str = JSON.stringify(payload);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return String(Math.abs(hash));
  }

  // ── CACHE ─────────────────────────────────────────────────────────────
  function getCached(fingerprint) {
    try {
      const raw = localStorage.getItem(CACHE_KEY_PREFIX + _currentPage);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (cached.fingerprint === fingerprint) return cached;
      return null;
    } catch { return null; }
  }

  function saveCache(fingerprint, insight, payload) {
    try {
      localStorage.setItem(CACHE_KEY_PREFIX + _currentPage, JSON.stringify({
        fingerprint,
        insight,
        generatedAt: new Date().toISOString(),
        periode: payload.periode || '',
      }));
    } catch(e) { console.warn('AI Insight: cache save failed', e); }
  }

  // ── INJECT STYLES ─────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ai-insight-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-insight-styles';
    style.innerHTML = `
      /* ── MODAL OVERLAY ── */
      #ai-modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.55);
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
        animation: ai-fade-in 0.2s ease;
      }
      #ai-modal-box {
        background: #fff;
        border-radius: 16px;
        padding: 32px 28px 28px;
        max-width: 420px; width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        animation: ai-slide-up 0.25s ease;
        position: relative;
      }
      #ai-modal-box .ai-modal-logo {
        width: 52px; height: 52px;
        background: linear-gradient(135deg, #0a2e1a, #1a6b3c);
        border-radius: 14px;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; margin: 0 auto 16px;
      }
      #ai-modal-box h2 {
        font-size: 18px; font-weight: 700;
        color: #0d2115; text-align: center; margin: 0 0 6px;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-modal-box p {
        font-size: 13px; color: #6b8f7a;
        text-align: center; margin: 0 0 24px; line-height: 1.6;
      }
      #ai-modal-box label {
        display: block; font-size: 12px; font-weight: 600;
        color: #0d2115; margin-bottom: 6px;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-modal-key-input {
        width: 100%; box-sizing: border-box;
        border: 1.5px solid #e0ece4; border-radius: 10px;
        padding: 10px 14px; font-size: 13px;
        font-family: 'JetBrains Mono', monospace;
        color: #0d2115; background: #f4faf6;
        outline: none; transition: border-color .15s;
        margin-bottom: 6px;
      }
      #ai-modal-key-input:focus { border-color: #1a6b3c; background: #fff; }
      #ai-modal-key-input.error { border-color: #dc2626; background: #fef2f2; }
      #ai-modal-error {
        font-size: 11px; color: #dc2626;
        margin-bottom: 12px; display: none;
      }
      #ai-modal-hint {
        font-size: 11px; color: #89aa96;
        margin-bottom: 20px; line-height: 1.5;
      }
      #ai-modal-hint a { color: #1a6b3c; }
      #ai-modal-submit {
        width: 100%; background: linear-gradient(135deg, #0a2e1a, #1a6b3c);
        color: #fff; border: none; border-radius: 10px;
        padding: 12px; font-size: 14px; font-weight: 600;
        cursor: pointer; font-family: 'DM Sans', sans-serif;
        transition: opacity .15s; letter-spacing: 0.2px;
      }
      #ai-modal-submit:hover { opacity: 0.9; }
      #ai-modal-submit:disabled { opacity: 0.5; cursor: not-allowed; }
      #ai-modal-skip {
        display: block; text-align: center; margin-top: 12px;
        font-size: 12px; color: #89aa96; cursor: pointer;
        background: none; border: none; width: 100%;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-modal-skip:hover { color: #4a7260; }

      /* ── PANEL ── */
      #ai-insight-panel {
        background: #fff;
        border: 1px solid #e0ece4;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(10,46,26,0.06);
        margin-bottom: 20px;
      }
      #ai-insight-panel .ai-header {
        background: linear-gradient(135deg, #0a2e1a 0%, #1a6b3c 100%);
        padding: 14px 18px;
        display: flex; align-items: center;
        justify-content: space-between;
        flex-wrap: wrap; gap: 8px;
      }
      #ai-insight-panel .ai-header-left {
        display: flex; align-items: center; gap: 10px;
      }
      #ai-insight-panel .ai-icon {
        width: 32px; height: 32px;
        background: rgba(255,255,255,0.15);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; flex-shrink: 0;
      }
      #ai-insight-panel .ai-title {
        font-size: 13px; font-weight: 700; color: #fff;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-insight-panel .ai-subtitle {
        font-size: 11px; color: rgba(255,255,255,0.6); margin-top: 1px;
      }
      #ai-insight-panel .ai-badge {
        font-size: 10px; font-weight: 600;
        padding: 3px 10px; border-radius: 20px;
        background: rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.9);
        border: 1px solid rgba(255,255,255,0.2);
        white-space: nowrap;
      }
      #ai-insight-panel .ai-badge.live {
        background: rgba(34,197,94,0.25);
        border-color: rgba(34,197,94,0.4); color: #86efac;
      }
      #ai-insight-panel .ai-badge.cached {
        background: rgba(147,51,234,0.2);
        border-color: rgba(147,51,234,0.3); color: #d8b4fe;
      }
      #ai-insight-panel .ai-body { padding: 16px 18px; }
      #ai-insight-panel .ai-loading {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 0; color: #4a7260; font-size: 13px;
      }
      #ai-insight-panel .ai-spinner {
        width: 20px; height: 20px;
        border: 2px solid #e0ece4;
        border-top-color: #1a6b3c;
        border-radius: 50%;
        animation: ai-spin .7s linear infinite; flex-shrink: 0;
      }
      #ai-insight-panel .ai-content { display: none; }
      #ai-insight-panel .ai-footer {
        display: flex; align-items: center;
        justify-content: space-between;
        padding: 10px 18px;
        border-top: 1px solid #e0ece4;
        background: #f4faf6;
        flex-wrap: wrap; gap: 8px;
      }
      #ai-insight-panel .ai-footer-info {
        font-size: 11px; color: #89aa96;
        display: flex; align-items: center; gap: 6px;
      }
      #ai-insight-panel .ai-refresh-btn {
        background: transparent; border: 1px solid #e0ece4;
        border-radius: 6px; color: #4a7260;
        font-size: 11px; font-weight: 600;
        padding: 5px 12px; cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        display: flex; align-items: center; gap: 5px;
        transition: all .15s;
      }
      #ai-insight-panel .ai-refresh-btn:hover {
        border-color: #1a6b3c; color: #1a6b3c;
        background: rgba(26,107,60,0.04);
      }
      #ai-insight-panel .ai-change-key {
        background: transparent; border: none;
        color: #89aa96; font-size: 10px;
        cursor: pointer; padding: 0;
        text-decoration: underline;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-insight-panel .ai-change-key:hover { color: #4a7260; }
      #ai-insight-panel .ai-error {
        background: rgba(220,38,38,0.06);
        border-left: 3px solid #dc2626;
        border-radius: 0 8px 8px 0;
        padding: 12px 14px; font-size: 12px; color: #991b1b;
      }
      .ai-section ul {
        margin: 6px 0 0; padding-left: 16px;
        display: flex; flex-direction: column; gap: 4px;
      }
      .ai-section ul li { font-size: 12px; color: #2d4a3a; line-height: 1.6; }

      @keyframes ai-spin { to { transform: rotate(360deg); } }
      @keyframes ai-fade-in { from { opacity: 0; } to { opacity: 1; } }
      @keyframes ai-slide-up {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  // ── MODAL ─────────────────────────────────────────────────────────────
  function showModal() {
    if (document.getElementById('ai-modal-overlay')) return;
    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = 'ai-modal-overlay';
    overlay.innerHTML = `
      <div id="ai-modal-box">
        <div class="ai-modal-logo">🧠</div>
        <h2>AI Business Analyst</h2>
        <p>Masukkan OpenAI API Key untuk mengaktifkan analisa bisnis otomatis di seluruh dashboard.</p>
        <label for="ai-modal-key-input">OpenAI API Key</label>
        <input type="password" id="ai-modal-key-input" placeholder="sk-proj-..." autocomplete="off" />
        <div id="ai-modal-error">Format tidak valid. API key harus diawali dengan <strong>sk-</strong></div>
        <div id="ai-modal-hint">
          🔒 Key tersimpan aman di browser kamu saja — tidak dikirim ke server manapun selain OpenAI.<br>
          Dapatkan API key di <a href="https://platform.openai.com/api-keys" target="_blank">platform.openai.com/api-keys</a>
        </div>
        <button id="ai-modal-submit" onclick="AIInsight.saveKey()">Aktifkan AI Analyst</button>
        <button id="ai-modal-skip" onclick="AIInsight.skipModal()">Lewati untuk sekarang</button>
      </div>
    `;
    document.body.appendChild(overlay);

    // Enter key submit
    setTimeout(() => {
      const input = document.getElementById('ai-modal-key-input');
      if (input) {
        input.focus();
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') AIInsight.saveKey();
        });
      }
    }, 100);
  }

  function closeModal() {
    const overlay = document.getElementById('ai-modal-overlay');
    if (overlay) overlay.remove();
  }

  // ── PANEL ─────────────────────────────────────────────────────────────
  function renderPanel() {
    if (document.getElementById('ai-insight-panel')) return;
    injectStyles();

    const panel = document.createElement('div');
    panel.id = 'ai-insight-panel';
    panel.innerHTML = `
      <div class="ai-header">
        <div class="ai-header-left">
          <div class="ai-icon">🧠</div>
          <div>
            <div class="ai-title">AI Business Analyst</div>
            <div class="ai-subtitle">Powered by GPT-5.4-mini · HS AO Surabaya</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ai-badge" id="ai-status-badge">Menunggu data...</span>
        </div>
      </div>
      <div class="ai-body" id="ai-body">
        <div class="ai-loading" id="ai-loading" style="display:none">
          <div class="ai-spinner"></div>
          <div>
            <div style="font-weight:600;color:#0d2115">Menganalisa data...</div>
            <div style="font-size:11px;color:#89aa96;margin-top:2px" id="ai-loading-sub">Mempersiapkan analisa</div>
          </div>
        </div>
        <div class="ai-content" id="ai-content"></div>
      </div>
      <div class="ai-footer" id="ai-footer" style="display:none">
        <div class="ai-footer-info">
          <span>⏱</span>
          <span id="ai-gen-time">—</span>
          <span>·</span>
          <button class="ai-change-key" onclick="AIInsight.resetKey()">Ganti API Key</button>
        </div>
        <button class="ai-refresh-btn" onclick="AIInsight.forceRefresh()">
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Regenerate
        </button>
      </div>
    `;

    const content = document.querySelector('.content');
    if (content) content.insertBefore(panel, content.firstChild);
  }

  // ── UI HELPERS ────────────────────────────────────────────────────────
  function setBadge(text, type = '') {
    const badge = document.getElementById('ai-status-badge');
    if (!badge) return;
    badge.textContent = text;
    badge.className = 'ai-badge' + (type ? ' ' + type : '');
  }

  function showLoading(show) {
    const loading = document.getElementById('ai-loading');
    const content = document.getElementById('ai-content');
    if (loading) loading.style.display = show ? 'flex' : 'none';
    if (content && show) content.style.display = 'none';
  }

  function setLoadingText(text) {
    const el = document.getElementById('ai-loading-sub');
    if (el) el.textContent = text;
  }

  function startLoadingMessages() {
    const msgs = [
      'Menghitung total penjualan dan margin...',
      'Menganalisa performa per channel...',
      'Membandingkan produktivitas salesman...',
      'Mendeteksi tren dan anomali data...',
      'Menyusun rekomendasi strategis...',
      'Memfinalisasi laporan eksekutif...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < msgs.length) setLoadingText(msgs[i++]);
      else clearInterval(interval);
    }, 1800);
    return interval;
  }

  // ── FORMAT INSIGHT TO HTML ────────────────────────────────────────────
  function formatInsight(text) {
    if (!text || !text.trim()) return '';

    const sectionStyles = {
      '📊': { border: '#1a6b3c', bg: 'rgba(26,107,60,0.05)' },
      '✅': { border: '#16a34a', bg: 'rgba(22,163,74,0.05)' },
      '⚠️': { border: '#ea7010', bg: 'rgba(234,112,16,0.05)' },
      '🔮': { border: '#9333ea', bg: 'rgba(147,51,234,0.05)' },
      '💡': { border: '#0891b2', bg: 'rgba(8,145,178,0.05)' },
    };

    // Cek apakah ada emoji heading — kalau tidak, tampilkan sebagai plain text
    const hasEmojiHeading = Object.keys(sectionStyles).some(k => text.includes(k));

    if (!hasEmojiHeading) {
      // Fallback: tampilkan teks mentah dengan formatting minimal
      const fallbackHtml = text.trim()
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^#{1,3}\s+(.+)$/gm, '<div style="font-size:12px;font-weight:700;color:#0d2115;margin:12px 0 6px">$1</div>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul style="margin:6px 0;padding-left:16px">${m}</ul>`)
        .replace(/\n\n/g, '</p><p style="margin:8px 0">')
        .replace(/\n/g, '<br>');
      return `<div class="ai-section" style="background:rgba(26,107,60,0.04);border-left:3px solid #1a6b3c;border-radius:0 8px 8px 0;padding:14px 16px;">
        <div style="font-size:12px;color:#2d4a3a;line-height:1.8"><p style="margin:0">${fallbackHtml}</p></div>
      </div>`;
    }

    let html = '';
    const lines = text.split('\n');
    let currentSection = null;
    let sectionContent = [];

    const flushSection = () => {
      if (!currentSection) return;
      const cfg = Object.entries(sectionStyles).find(([k]) => currentSection.startsWith(k));
      const style = cfg ? cfg[1] : { border: '#ccc', bg: 'rgba(0,0,0,0.03)' };
      const contentHtml = sectionContent.join('\n').trim()
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul style="margin:6px 0 0;padding-left:16px;display:flex;flex-direction:column;gap:4px">${m}</ul>`)
        .replace(/\n/g, '<br>');

      html += `
        <div class="ai-section" style="
          background:${style.bg};
          border-left:3px solid ${style.border};
          border-radius:0 8px 8px 0;
          padding:12px 14px;
          margin-bottom:10px;
        ">
          <div style="font-size:12px;font-weight:700;color:#0d2115;margin-bottom:6px">${currentSection}</div>
          <div style="font-size:12px;color:#2d4a3a;line-height:1.7">${contentHtml}</div>
        </div>`;
      sectionContent = [];
      currentSection = null;
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed === '---') return;
      const isHeading = Object.keys(sectionStyles).some(k => trimmed.startsWith(k));
      if (isHeading) { flushSection(); currentSection = trimmed; }
      else sectionContent.push(trimmed);
    });
    flushSection();
    return html;
  }

  function animateContent(html) {
    const contentEl = document.getElementById('ai-content');
    if (!contentEl) return;
    contentEl.innerHTML = html;
    contentEl.style.display = 'block';
    const sections = contentEl.querySelectorAll('.ai-section');
    sections.forEach((s, i) => {
      s.style.opacity = '0';
      s.style.transform = 'translateY(8px)';
      s.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(() => { s.style.opacity = '1'; s.style.transform = 'translateY(0)'; }, i * 120);
    });
  }

  // ── BUILD PROMPT ──────────────────────────────────────────────────────
  function buildPrompt(payload, page) {
    const base = `Kamu adalah analis bisnis senior spesialis distribusi FMCG di Indonesia, khususnya area Jawa Timur.
Analisa data penjualan berikut dengan gaya laporan eksekutif profesional dalam Bahasa Indonesia.
Gunakan angka konkret dari data. Tulis dengan nada tegas, insight tajam, dan rekomendasi actionable.
Hindari saran umum tanpa tindakan spesifik.

Format output WAJIB:

📊 RINGKASAN EKSEKUTIF
[2-3 kalimat ringkasan performa keseluruhan dengan angka kunci]

✅ HIGHLIGHT POSITIF
- [poin dengan data spesifik]
- [poin dengan data spesifik]
- [poin dengan data spesifik]

⚠️ PERHATIAN & RISIKO
- [poin yang perlu tindakan segera dengan angka]
- [poin yang perlu tindakan segera dengan angka]
- [poin yang perlu tindakan segera dengan angka]

🔮 PROYEKSI & TREN
- [estimasi atau proyeksi berbasis tren dari data]
- [estimasi atau proyeksi berbasis tren dari data]

💡 REKOMENDASI AKSI
- [rekomendasi spesifik dan actionable]
- [rekomendasi spesifik dan actionable]
- [rekomendasi spesifik dan actionable]
- [rekomendasi spesifik dan actionable]

---
DATA DASHBOARD:`;

    if (page === 'summary') {
      return `${base}

HALAMAN: Summary Penjualan (Ringkasan Eksekutif)
PERIODE: ${payload.periode}

KPI UTAMA:
- Total Penjualan (Cash+TOP): ${payload.totalPenjualan}
- Total Margin: ${payload.totalMargin}
- Total Qty Terjual: ${payload.totalQty} pcs
- Outlet Aktif: ${payload.outletAktif}
- Total COH: ${payload.totalCOH}
- Rasio Cash: ${payload.cashPct}%
- Rasio TOP: ${payload.topPct}%
${payload.tagihanPct > 0 ? `- Rasio Tagihan: ${payload.tagihanPct}%` : ''}
- Avg Margin: ${payload.avgMarginPct}%
- Total Transaksi: ${payload.totalTrx}

DISTRIBUSI PER CHANNEL:
${payload.channels.map(c => `- ${c.name}: ${c.nominal} (${c.pct}%)`).join('\n')}

TOP 5 PRODUK (by Qty):
${payload.topProduk.map((p, i) => `${i+1}. ${p.nama}: ${p.qty} pcs — ${p.nominal}`).join('\n')}

TOP 5 SALESMAN (by Penjualan):
${payload.topSalesman.map((s, i) => `${i+1}. ${s.nama}: ${s.total} (margin ${s.margin})`).join('\n')}

TOP 5 OUTLET (by Penjualan):
${payload.topOutlet.map((o, i) => `${i+1}. ${o.nama}: ${o.total}`).join('\n')}

STATUS PEMBAYARAN:
- Cash: ${payload.cashNominal}
- TOP: ${payload.topNominal}
${payload.tagihanNominal ? `- Tagihan: ${payload.tagihanNominal}` : ''}`;
    }

    if (page === 'penjualan') {
      return `${base}

HALAMAN: Detail Penjualan (Analisa Mendalam)
PERIODE: ${payload.periode}

KPI PENJUALAN:
- Total Penjualan: ${payload.totalPenjualan}
- Total Qty: ${payload.totalQty} pcs
- Total Outlet: ${payload.totalOutlet}
- Cash: ${payload.cashNominal} (${payload.cashPct}%)
- TOP: ${payload.topNominal} (${payload.topPct}%)

COH PER CHANNEL:
- COH Total: ${payload.totalCOH}
- COH Retail: ${payload.cohRetail}
- COH Grosir: ${payload.cohGrosir}
- COH Agen: ${payload.cohAgen}

PERFORMA PER DEPO:
${payload.depos.map(d => `- ${d.nama}: ${d.total} (${d.qty} pcs)`).join('\n')}

TOP SKU TERJUAL:
${payload.topSKU.map((s, i) => `${i+1}. ${s.nama}: ${s.qty} pcs — ${s.nominal}`).join('\n')}

TOP SALESMAN RETAIL:
${payload.topRetail.map((s, i) => `${i+1}. ${s.nama} (${s.depo}): ${s.total} — ${s.qty} pcs`).join('\n')}

TOP SALESMAN WS/GROSIR:
${payload.topWS.map((s, i) => `${i+1}. ${s.nama} (${s.depo}): ${s.total} — ${s.qty} pcs`).join('\n')}`;
    }

    return base;
  }

  // ── CALL OPENAI API ───────────────────────────────────────────────────
  async function callAPI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${_apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'system',
            content: 'Kamu adalah analis bisnis senior FMCG Indonesia. Selalu balas dalam Bahasa Indonesia dengan format yang diminta. Gunakan data yang diberikan secara konkret dan spesifik.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('AI Insight API response:', JSON.stringify(data).substring(0, 800));
    // Support berbagai struktur response OpenAI (Chat Completions & Responses API)
    const content = data.choices?.[0]?.message?.content
      || data.choices?.[0]?.text
      || data.output?.[0]?.content?.[0]?.text
      || data.output_text
      || '';
    return content;
  }

  // ── MAIN: RUN INSIGHT ─────────────────────────────────────────────────
  async function run(payload) {
    // Belum ada API key → simpan payload, tampilkan modal
    if (!_apiKey) {
      _pendingPayload = payload;
      renderPanel();
      showModal();
      return;
    }

    renderPanel();
    const fingerprint = buildFingerprint(payload);
    const cached = getCached(fingerprint);

    if (cached) {
      const html = formatInsight(cached.insight);
      showLoading(false);
      animateContent(html);
      setBadge('✓ Cached · ' + new Date(cached.generatedAt).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      }), 'cached');
      const footer = document.getElementById('ai-footer');
      if (footer) footer.style.display = 'flex';
      const genTime = document.getElementById('ai-gen-time');
      if (genTime) genTime.textContent = 'Dari cache · ' + new Date(cached.generatedAt).toLocaleTimeString('id-ID');
      return;
    }

    if (_isRunning) return;
    _isRunning = true;

    showLoading(true);
    setBadge('⟳ Menganalisa...', '');
    const loadingInterval = startLoadingMessages();

    try {
      const prompt = buildPrompt(payload, _currentPage);
      const insight = await callAPI(prompt);

      clearInterval(loadingInterval);
      saveCache(fingerprint, insight, payload);

      const html = formatInsight(insight);
      showLoading(false);
      animateContent(html);
      setBadge('✓ Live Analysis', 'live');

      const now = new Date();
      const footer = document.getElementById('ai-footer');
      if (footer) footer.style.display = 'flex';
      const genTime = document.getElementById('ai-gen-time');
      if (genTime) genTime.textContent = 'Digenerate: ' + now.toLocaleTimeString('id-ID');

    } catch (err) {
      clearInterval(loadingInterval);
      showLoading(false);
      const contentEl = document.getElementById('ai-content');
      if (contentEl) {
        contentEl.style.display = 'block';
        contentEl.innerHTML = `<div class="ai-error">
          <strong>⚠️ Gagal generate insight:</strong> ${err.message}
          <br><small style="margin-top:4px;display:block;opacity:.7">Cek API key atau koneksi, lalu klik Regenerate.</small>
        </div>`;
      }
      setBadge('Error', '');
      const footer = document.getElementById('ai-footer');
      if (footer) footer.style.display = 'flex';
    } finally {
      _isRunning = false;
    }
  }

  // ── PUBLIC API ────────────────────────────────────────────────────────
  function saveKey() {
    const input = document.getElementById('ai-modal-key-input');
    const errorEl = document.getElementById('ai-modal-error');
    const submitBtn = document.getElementById('ai-modal-submit');
    if (!input) return;

    const key = input.value.trim();
    if (!key.startsWith('sk-')) {
      input.classList.add('error');
      if (errorEl) errorEl.style.display = 'block';
      setTimeout(() => {
        input.classList.remove('error');
        if (errorEl) errorEl.style.display = 'none';
      }, 3000);
      return;
    }

    _apiKey = key;
    localStorage.setItem(API_KEY_STORAGE, key);
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Mengaktifkan...'; }

    closeModal();

    // Jalankan pending payload atau trigger re-render
    if (_pendingPayload) {
      const p = _pendingPayload;
      _pendingPayload = null;
      run(p);
    } else {
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
      else if (typeof window.renderAll === 'function') window.renderAll();
    }
  }

  function skipModal() {
    closeModal();
  }

  function resetKey() {
    if (!confirm('Hapus API Key dan reset AI Insight?')) return;
    _apiKey = '';
    localStorage.removeItem(API_KEY_STORAGE);
    localStorage.removeItem(CACHE_KEY_PREFIX + 'summary');
    localStorage.removeItem(CACHE_KEY_PREFIX + 'penjualan');
    const panel = document.getElementById('ai-insight-panel');
    if (panel) panel.remove();
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    else if (typeof window.renderAll === 'function') window.renderAll();
  }

  function forceRefresh() {
    localStorage.removeItem(CACHE_KEY_PREFIX + _currentPage);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    else if (typeof window.renderAll === 'function') window.renderAll();
  }

  // ── FORMAT ANGKA ──────────────────────────────────────────────────────
  function fmtShort(n) {
    if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + ' M';
    if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + ' Jt';
    if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + ' Rb';
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  // ── PAYLOAD BUILDER: SUMMARY ──────────────────────────────────────────
  function buildSummaryPayload(data, filterLabel) {
    const penjualan = data.filter(r => r.keterangan === 'CASH' || r.keterangan === 'TOP');
    const coh       = data.filter(r => r.keterangan === 'CASH' || r.keterangan === 'TAGIHAN');

    const totalPenjualan = penjualan.reduce((s, r) => s + r.total, 0);
    const totalMargin    = penjualan.reduce((s, r) => s + r.margin, 0);
    const totalQty       = penjualan.reduce((s, r) => s + r.qtyJual, 0);
    const outletAktif    = new Set(penjualan.map(r => r.kodeOutlet)).size;
    const cashNom        = penjualan.filter(r => r.keterangan === 'CASH').reduce((s, r) => s + r.total, 0);
    const topNom         = penjualan.filter(r => r.keterangan === 'TOP').reduce((s, r) => s + r.total, 0);
    const tagihanNom     = coh.filter(r => r.keterangan === 'TAGIHAN').reduce((s, r) => s + r.total, 0);
    const cohRetail      = coh.filter(r => r.channel === 'RETAIL').reduce((s, r) => s + r.total, 0);
    const cohGrosir      = coh.filter(r => r.channel === 'GROSIR').reduce((s, r) => s + r.total, 0);
    const cohAgen        = coh.filter(r => r.channel === 'AGEN').reduce((s, r) => s + r.total, 0);
    const totalCOH       = cohRetail + cohGrosir + cohAgen;
    const bayar          = cashNom + topNom + tagihanNom;

    const chMap = {};
    penjualan.forEach(r => { chMap[r.channel] = (chMap[r.channel] || 0) + r.total; });
    const channels = Object.entries(chMap).map(([name, val]) => ({
      name, nominal: fmtShort(val),
      pct: totalPenjualan > 0 ? (val / totalPenjualan * 100).toFixed(1) : 0,
    }));

    const prodMap = {};
    penjualan.forEach(r => {
      if (!prodMap[r.namaBarang]) prodMap[r.namaBarang] = { qty: 0, nominal: 0 };
      prodMap[r.namaBarang].qty += r.qtyJual;
      prodMap[r.namaBarang].nominal += r.total;
    });
    const topProduk = Object.entries(prodMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)
      .map(([nama, v]) => ({ nama, qty: v.qty, nominal: fmtShort(v.nominal) }));

    const salesMap = {};
    penjualan.forEach(r => {
      if (!salesMap[r.salesman]) salesMap[r.salesman] = { total: 0, margin: 0 };
      salesMap[r.salesman].total  += r.total;
      salesMap[r.salesman].margin += r.margin;
    });
    const topSalesman = Object.entries(salesMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([nama, v]) => ({ nama, total: fmtShort(v.total), margin: fmtShort(v.margin) }));

    const outletMap = {};
    penjualan.forEach(r => {
      if (!r.namaOutlet) return;
      outletMap[r.namaOutlet] = (outletMap[r.namaOutlet] || 0) + r.total;
    });
    const topOutlet = Object.entries(outletMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nama, val]) => ({ nama, total: fmtShort(val) }));

    return {
      periode: filterLabel,
      totalPenjualan: fmtShort(totalPenjualan),
      totalMargin: fmtShort(totalMargin),
      totalQty: totalQty.toLocaleString('id-ID'),
      outletAktif,
      totalCOH: fmtShort(totalCOH),
      cashNominal: fmtShort(cashNom),
      topNominal: fmtShort(topNom),
      tagihanNominal: tagihanNom > 0 ? fmtShort(tagihanNom) : null,
      cashPct: bayar > 0 ? (cashNom / bayar * 100).toFixed(1) : 0,
      topPct:  bayar > 0 ? (topNom  / bayar * 100).toFixed(1) : 0,
      tagihanPct: bayar > 0 ? (tagihanNom / bayar * 100).toFixed(1) : 0,
      avgMarginPct: totalPenjualan > 0 ? (totalMargin / totalPenjualan * 100).toFixed(2) : 0,
      totalTrx: penjualan.length,
      channels, topProduk, topSalesman, topOutlet,
    };
  }

  // ── PAYLOAD BUILDER: PENJUALAN ────────────────────────────────────────
  function buildPenjualanPayload(data, filterLabel) {
    const penjualan = data.filter(r => r.keterangan === 'CASH' || r.keterangan === 'TOP');
    const coh       = data.filter(r => r.keterangan === 'CASH' || r.keterangan === 'TAGIHAN');

    const totalPenjualan = penjualan.reduce((s, r) => s + r.total, 0);
    const totalQty       = penjualan.reduce((s, r) => s + r.qtyJual, 0);
    const totalOutlet    = new Set(penjualan.map(r => r.kodeOutlet)).size;
    const cashNom        = penjualan.filter(r => r.keterangan === 'CASH').reduce((s, r) => s + r.total, 0);
    const topNom         = penjualan.filter(r => r.keterangan === 'TOP').reduce((s, r) => s + r.total, 0);
    const bayar          = cashNom + topNom;
    const cohRetail      = coh.filter(r => r.channel === 'RETAIL').reduce((s, r) => s + r.total, 0);
    const cohGrosir      = coh.filter(r => r.channel === 'GROSIR').reduce((s, r) => s + r.total, 0);
    const cohAgen        = coh.filter(r => r.channel === 'AGEN').reduce((s, r) => s + r.total, 0);
    const totalCOH       = cohRetail + cohGrosir + cohAgen;

    const depoList = ['SURABAYA', 'SIDOARJO', 'GRESIK', 'MOJOKERTO'];
    const depos = depoList.map(nama => {
      const d = penjualan.filter(r => r.depo === nama);
      return { nama, total: fmtShort(d.reduce((s, r) => s + r.total, 0)), qty: d.reduce((s, r) => s + r.qtyJual, 0) };
    }).filter(d => d.qty > 0);

    const skuMap = {};
    penjualan.forEach(r => {
      if (!skuMap[r.namaBarang]) skuMap[r.namaBarang] = { qty: 0, nominal: 0 };
      skuMap[r.namaBarang].qty     += r.qtyJual;
      skuMap[r.namaBarang].nominal += r.total;
    });
    const topSKU = Object.entries(skuMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 7)
      .map(([nama, v]) => ({ nama, qty: v.qty, nominal: fmtShort(v.nominal) }));

    const retailMap = {};
    penjualan.filter(r => r.jobtitle === 'RETAIL').forEach(r => {
      if (!retailMap[r.salesman]) retailMap[r.salesman] = { total: 0, qty: 0, depo: r.depo };
      retailMap[r.salesman].total += r.total;
      retailMap[r.salesman].qty   += r.qtyJual;
    });
    const topRetail = Object.entries(retailMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([nama, v]) => ({ nama, depo: v.depo, total: fmtShort(v.total), qty: v.qty }));

    const wsMap = {};
    penjualan.filter(r => r.jobtitle === 'WS').forEach(r => {
      if (!wsMap[r.salesman]) wsMap[r.salesman] = { total: 0, qty: 0, depo: r.depo };
      wsMap[r.salesman].total += r.total;
      wsMap[r.salesman].qty   += r.qtyJual;
    });
    const topWS = Object.entries(wsMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([nama, v]) => ({ nama, depo: v.depo, total: fmtShort(v.total), qty: v.qty }));

    return {
      periode: filterLabel,
      totalPenjualan: fmtShort(totalPenjualan),
      totalQty: totalQty.toLocaleString('id-ID'),
      totalOutlet,
      cashNominal: fmtShort(cashNom),
      topNominal: fmtShort(topNom),
      cashPct: bayar > 0 ? (cashNom / bayar * 100).toFixed(1) : 0,
      topPct:  bayar > 0 ? (topNom  / bayar * 100).toFixed(1) : 0,
      totalCOH: fmtShort(totalCOH),
      cohRetail: fmtShort(cohRetail),
      cohGrosir: fmtShort(cohGrosir),
      cohAgen: fmtShort(cohAgen),
      depos, topSKU, topRetail, topWS,
    };
  }

  // ── EXPOSE ────────────────────────────────────────────────────────────
  return {
    run,
    saveKey,
    skipModal,
    resetKey,
    forceRefresh,
    buildSummaryPayload,
    buildPenjualanPayload,
  };

})();
