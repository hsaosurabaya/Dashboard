/**
 * AI INSIGHT ENGINE — Dashboard HS AO Surabaya
 * Shared module untuk index.html & penjualan.html
 * 
 * Fitur:
 * - Auto-generate insight saat data berubah (fingerprint cache)
 * - localStorage cache → insight tetap muncul walau browser di-refresh
 * - Context-aware → tiap halaman dapat analisa berbeda
 * - Streaming text animation
 */

const AIInsight = (() => {

  // ── CONFIG ──────────────────────────────────────────────────────────
  const CACHE_KEY_PREFIX = 'ai_insight_cache_';
  const API_KEY_STORAGE  = 'ai_insight_api_key';
  const MODEL            = 'claude-sonnet-4-20250514';
  const MAX_TOKENS       = 1024;

  // ── STATE ────────────────────────────────────────────────────────────
  let _apiKey      = localStorage.getItem(API_KEY_STORAGE) || '';
  let _isRunning   = false;
  let _currentPage = detectPage();

  // ── DETECT PAGE ──────────────────────────────────────────────────────
  function detectPage() {
    const path = window.location.pathname;
    if (path.includes('penjualan')) return 'penjualan';
    return 'summary';
  }

  // ── FINGERPRINT ──────────────────────────────────────────────────────
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
        period: payload.periode || '',
      }));
    } catch(e) { console.warn('AI Insight: cache save failed', e); }
  }

  // ── BUILD PROMPT ──────────────────────────────────────────────────────
  function buildPrompt(payload, page) {
    const base = `Kamu adalah analis bisnis senior spesialis distribusi FMCG di Indonesia, khususnya area Jawa Timur. 
Analisa data penjualan berikut dengan gaya laporan eksekutif profesional dalam Bahasa Indonesia.
Gunakan angka konkret dari data. Tulis dengan nada tegas, insight tajam, dan rekomendasi yang actionable.
Hindari kata-kata umum seperti "perlu diperhatikan" tanpa diikuti tindakan spesifik.

Format output WAJIB menggunakan struktur ini (gunakan emoji dan heading):

📊 RINGKASAN EKSEKUTIF
[2-3 kalimat ringkasan performa keseluruhan dengan angka kunci]

✅ HIGHLIGHT POSITIF
[2-3 poin kekuatan dengan data spesifik]

⚠️ PERHATIAN & RISIKO  
[2-3 poin yang perlu tindakan segera, dengan angka konkret]

🔮 PROYEKSI & TREN
[Estimasi atau proyeksi berbasis tren yang terlihat dari data]

💡 REKOMENDASI AKSI
[3-4 rekomendasi spesifik dan actionable, bukan saran umum]

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
- Total COH (Cash+Tagihan): ${payload.totalCOH}
- Rasio Cash: ${payload.cashPct}%
- Rasio TOP: ${payload.topPct}%
${payload.tagihanPct > 0 ? `- Rasio Tagihan: ${payload.tagihanPct}%` : ''}

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
${payload.tagihanNominal ? `- Tagihan: ${payload.tagihanNominal}` : ''}

${payload.avgMarginPct ? `AVG MARGIN: ${payload.avgMarginPct}%` : ''}
${payload.totalTrx ? `TOTAL TRANSAKSI: ${payload.totalTrx}` : ''}`;
    }

    if (page === 'penjualan') {
      return `${base}

HALAMAN: Detail Penjualan (Analisa Mendalam per SKU, Depo & Salesman)
PERIODE: ${payload.periode}

KPI PENJUALAN (Cash+TOP):
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

  // ── CALL API ──────────────────────────────────────────────────────────
  async function callAPI(prompt) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': _apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }

  // ── FORMAT INSIGHT TO HTML ────────────────────────────────────────────
  function formatInsight(text) {
    const sectionColors = {
      '📊': { bg: 'rgba(26,107,60,0.06)', border: '#1a6b3c', icon: '📊' },
      '✅': { bg: 'rgba(22,163,74,0.06)', border: '#16a34a', icon: '✅' },
      '⚠️': { bg: 'rgba(234,112,16,0.06)', border: '#ea7010', icon: '⚠️' },
      '🔮': { bg: 'rgba(147,51,234,0.06)', border: '#9333ea', icon: '🔮' },
      '💡': { bg: 'rgba(8,145,178,0.06)', border: '#0891b2', icon: '💡' },
    };

    let html = '';
    const lines = text.split('\n');
    let currentSection = null;
    let sectionContent = [];

    const flushSection = () => {
      if (!currentSection) return;
      const cfg = Object.entries(sectionColors).find(([k]) => currentSection.startsWith(k));
      const style = cfg ? cfg[1] : { bg: 'rgba(0,0,0,0.03)', border: '#ccc' };
      const contentHtml = sectionContent
        .join('\n')
        .trim()
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul style="margin:6px 0 0 0;padding-left:16px;display:flex;flex-direction:column;gap:4px">${m}</ul>`)
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
      const isHeading = Object.keys(sectionColors).some(k => trimmed.startsWith(k));
      if (isHeading) {
        flushSection();
        currentSection = trimmed;
      } else {
        sectionContent.push(trimmed);
      }
    });
    flushSection();

    return html;
  }

  // ── RENDER UI ─────────────────────────────────────────────────────────
  function renderPanel() {
    if (document.getElementById('ai-insight-panel')) return;

    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = `
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
      }
      #ai-insight-panel .ai-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #ai-insight-panel .ai-icon {
        width: 32px;
        height: 32px;
        background: rgba(255,255,255,0.15);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        flex-shrink: 0;
      }
      #ai-insight-panel .ai-title {
        font-size: 13px;
        font-weight: 700;
        color: #fff;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-insight-panel .ai-subtitle {
        font-size: 11px;
        color: rgba(255,255,255,0.6);
        margin-top: 1px;
      }
      #ai-insight-panel .ai-badge {
        font-size: 10px;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 20px;
        background: rgba(255,255,255,0.15);
        color: rgba(255,255,255,0.9);
        border: 1px solid rgba(255,255,255,0.2);
        white-space: nowrap;
      }
      #ai-insight-panel .ai-badge.live {
        background: rgba(34,197,94,0.25);
        border-color: rgba(34,197,94,0.4);
        color: #86efac;
      }
      #ai-insight-panel .ai-badge.cached {
        background: rgba(147,51,234,0.2);
        border-color: rgba(147,51,234,0.3);
        color: #d8b4fe;
      }
      #ai-insight-panel .ai-body {
        padding: 16px 18px;
      }
      #ai-insight-panel .ai-setup {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        padding: 20px 0 8px;
        text-align: center;
      }
      #ai-insight-panel .ai-setup-icon {
        font-size: 32px;
      }
      #ai-insight-panel .ai-setup p {
        font-size: 13px;
        color: #4a7260;
        max-width: 380px;
      }
      #ai-insight-panel .ai-key-wrap {
        display: flex;
        gap: 8px;
        width: 100%;
        max-width: 420px;
      }
      #ai-insight-panel .ai-key-input {
        flex: 1;
        border: 1px solid #e0ece4;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        font-family: 'JetBrains Mono', monospace;
        color: #0d2115;
        background: #f4faf6;
        outline: none;
        transition: border-color .15s;
      }
      #ai-insight-panel .ai-key-input:focus {
        border-color: #1a6b3c;
        background: #fff;
      }
      #ai-insight-panel .ai-key-btn {
        background: #1a6b3c;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        transition: background .15s;
        white-space: nowrap;
      }
      #ai-insight-panel .ai-key-btn:hover { background: #0f4d2b; }
      #ai-insight-panel .ai-loading {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 0;
        color: #4a7260;
        font-size: 13px;
      }
      #ai-insight-panel .ai-spinner {
        width: 20px; height: 20px;
        border: 2px solid #e0ece4;
        border-top-color: #1a6b3c;
        border-radius: 50%;
        animation: ai-spin .7s linear infinite;
        flex-shrink: 0;
      }
      @keyframes ai-spin { to { transform: rotate(360deg); } }
      #ai-insight-panel .ai-content {
        display: none;
      }
      #ai-insight-panel .ai-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 18px;
        border-top: 1px solid #e0ece4;
        background: #f4faf6;
        flex-wrap: wrap;
        gap: 8px;
      }
      #ai-insight-panel .ai-footer-info {
        font-size: 11px;
        color: #89aa96;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #ai-insight-panel .ai-refresh-btn {
        background: transparent;
        border: 1px solid #e0ece4;
        border-radius: 6px;
        color: #4a7260;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 12px;
        cursor: pointer;
        font-family: 'DM Sans', sans-serif;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all .15s;
      }
      #ai-insight-panel .ai-refresh-btn:hover {
        border-color: #1a6b3c;
        color: #1a6b3c;
        background: rgba(26,107,60,0.04);
      }
      #ai-insight-panel .ai-change-key {
        background: transparent;
        border: none;
        color: #89aa96;
        font-size: 10px;
        cursor: pointer;
        padding: 0;
        text-decoration: underline;
        font-family: 'DM Sans', sans-serif;
      }
      #ai-insight-panel .ai-change-key:hover { color: #4a7260; }
      #ai-insight-panel .ai-error {
        background: rgba(220,38,38,0.06);
        border-left: 3px solid #dc2626;
        border-radius: 0 8px 8px 0;
        padding: 12px 14px;
        font-size: 12px;
        color: #991b1b;
      }
      .ai-section ul li {
        font-size: 12px;
        color: #2d4a3a;
        line-height: 1.6;
      }
    `;
    document.head.appendChild(style);

    // Panel HTML
    const panel = document.createElement('div');
    panel.id = 'ai-insight-panel';
    panel.innerHTML = `
      <div class="ai-header">
        <div class="ai-header-left">
          <div class="ai-icon">🧠</div>
          <div>
            <div class="ai-title">AI Business Analyst</div>
            <div class="ai-subtitle" id="ai-subtitle">Powered by Claude · HS AO Surabaya</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="ai-badge" id="ai-status-badge">Menunggu data...</span>
        </div>
      </div>
      <div class="ai-body" id="ai-body">
        <div class="ai-setup" id="ai-setup">
          <div class="ai-setup-icon">🔑</div>
          <p>Masukkan Anthropic API Key untuk mengaktifkan AI Business Analyst. Key tersimpan aman di browser dan tidak dikirim ke server manapun selain Anthropic.</p>
          <div class="ai-key-wrap">
            <input type="password" class="ai-key-input" id="ai-key-input" placeholder="sk-ant-api03-..." />
            <button class="ai-key-btn" onclick="AIInsight.saveKey()">Aktifkan</button>
          </div>
          <small style="font-size:10px;color:#89aa96">Dapatkan API key di <a href="https://console.anthropic.com" target="_blank" style="color:#1a6b3c">console.anthropic.com</a></small>
        </div>
        <div class="ai-loading" id="ai-loading" style="display:none">
          <div class="ai-spinner"></div>
          <div>
            <div style="font-weight:600;color:#0d2115">Menganalisa data...</div>
            <div style="font-size:11px;color:#89aa96;margin-top:2px" id="ai-loading-sub">Menghitung KPI dan tren penjualan</div>
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
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Regenerate
        </button>
      </div>
    `;

    // Insert BEFORE content starts (after topbar, before kpi-grid or kpi-grid-top)
    const content = document.querySelector('.content');
    if (content) {
      content.insertBefore(panel, content.firstChild);
    }
  }

  function setLoadingText(text) {
    const el = document.getElementById('ai-loading-sub');
    if (el) el.textContent = text;
  }

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
    if (content) content.style.display = show ? 'none' : 'block';
  }

  function showSetup(show) {
    const setup = document.getElementById('ai-setup');
    const loading = document.getElementById('ai-loading');
    const content = document.getElementById('ai-content');
    const footer = document.getElementById('ai-footer');
    if (setup) setup.style.display = show ? 'flex' : 'none';
    if (!show && loading) loading.style.display = 'none';
    if (!show && footer) footer.style.display = 'flex';
  }

  // ── ANIMATE TEXT ──────────────────────────────────────────────────────
  function animateContent(html) {
    const contentEl = document.getElementById('ai-content');
    if (!contentEl) return;
    contentEl.innerHTML = html;
    contentEl.style.display = 'block';

    // Fade-in sections one by one
    const sections = contentEl.querySelectorAll('.ai-section');
    sections.forEach((s, i) => {
      s.style.opacity = '0';
      s.style.transform = 'translateY(8px)';
      s.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      setTimeout(() => {
        s.style.opacity = '1';
        s.style.transform = 'translateY(0)';
      }, i * 120);
    });
  }

  // ── LOADING MESSAGES ──────────────────────────────────────────────────
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

  // ── MAIN: RUN INSIGHT ─────────────────────────────────────────────────
  async function run(payload) {
    if (!_apiKey) {
      renderPanel();
      showSetup(true);
      return;
    }

    renderPanel();
    showSetup(false);

    const fingerprint = buildFingerprint(payload);
    const cached = getCached(fingerprint);

    if (cached) {
      // Tampilkan dari cache
      const html = formatInsight(cached.insight);
      animateContent(html);
      showLoading(false);
      setBadge('✓ Cached · ' + new Date(cached.generatedAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), 'cached');
      const footer = document.getElementById('ai-footer');
      if (footer) footer.style.display = 'flex';
      const genTime = document.getElementById('ai-gen-time');
      if (genTime) genTime.textContent = 'Dari cache · ' + new Date(cached.generatedAt).toLocaleTimeString('id-ID');
      return;
    }

    // Data berubah → panggil API
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
          <br><small style="margin-top:4px;display:block;opacity:.7">Cek API key atau koneksi internet, lalu klik Regenerate.</small>
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
    const input = document.getElementById('ai-key-input');
    if (!input) return;
    const key = input.value.trim();
    if (!key.startsWith('sk-ant')) {
      input.style.borderColor = '#dc2626';
      input.placeholder = 'Format tidak valid! Harus dimulai sk-ant-...';
      setTimeout(() => { input.style.borderColor = ''; input.placeholder = 'sk-ant-api03-...'; }, 2500);
      return;
    }
    _apiKey = key;
    localStorage.setItem(API_KEY_STORAGE, key);
    showSetup(false);
    // Trigger re-render dari halaman
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    else if (typeof window.renderAll === 'function') window.renderAll();
  }

  function resetKey() {
    if (!confirm('Hapus API Key tersimpan?')) return;
    _apiKey = '';
    localStorage.removeItem(API_KEY_STORAGE);
    // Clear cache
    localStorage.removeItem(CACHE_KEY_PREFIX + 'summary');
    localStorage.removeItem(CACHE_KEY_PREFIX + 'penjualan');
    const panel = document.getElementById('ai-insight-panel');
    if (panel) panel.remove();
    renderPanel();
    showSetup(true);
  }

  function forceRefresh() {
    // Hapus cache untuk halaman ini
    localStorage.removeItem(CACHE_KEY_PREFIX + _currentPage);
    if (typeof window.renderDashboard === 'function') window.renderDashboard();
    else if (typeof window.renderAll === 'function') window.renderAll();
  }

  // ── HELPER: FORMAT ANGKA ──────────────────────────────────────────────
  function fmtShort(n) {
    if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + ' M';
    if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + ' Jt';
    if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + ' Rb';
    return 'Rp ' + Math.round(n).toLocaleString('id-ID');
  }

  // ── PAYLOAD BUILDER: SUMMARY PAGE ─────────────────────────────────────
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

    // Channels
    const chMap = {};
    penjualan.forEach(r => { chMap[r.channel] = (chMap[r.channel] || 0) + r.total; });
    const channels = Object.entries(chMap).map(([name, val]) => ({
      name, nominal: fmtShort(val), pct: totalPenjualan > 0 ? (val / totalPenjualan * 100).toFixed(1) : 0,
    }));

    // Top produk
    const prodMap = {};
    penjualan.forEach(r => {
      if (!prodMap[r.namaBarang]) prodMap[r.namaBarang] = { qty: 0, nominal: 0 };
      prodMap[r.namaBarang].qty += r.qtyJual;
      prodMap[r.namaBarang].nominal += r.total;
    });
    const topProduk = Object.entries(prodMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5)
      .map(([nama, v]) => ({ nama, qty: v.qty, nominal: fmtShort(v.nominal) }));

    // Top salesman
    const salesMap = {};
    penjualan.forEach(r => {
      if (!salesMap[r.salesman]) salesMap[r.salesman] = { total: 0, margin: 0 };
      salesMap[r.salesman].total  += r.total;
      salesMap[r.salesman].margin += r.margin;
    });
    const topSalesman = Object.entries(salesMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([nama, v]) => ({ nama, total: fmtShort(v.total), margin: fmtShort(v.margin) }));

    // Top outlet
    const outletMap = {};
    penjualan.forEach(r => {
      if (!r.namaOutlet) return;
      outletMap[r.namaOutlet] = (outletMap[r.namaOutlet] || 0) + r.total;
    });
    const topOutlet = Object.entries(outletMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([nama, val]) => ({ nama, total: fmtShort(val) }));

    const avgMarginPct = totalPenjualan > 0 ? (totalMargin / totalPenjualan * 100).toFixed(2) : 0;

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
      channels,
      topProduk,
      topSalesman,
      topOutlet,
      avgMarginPct,
      totalTrx: penjualan.length,
    };
  }

  // ── PAYLOAD BUILDER: PENJUALAN PAGE ───────────────────────────────────
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

    // Depo breakdown
    const depoList = ['SURABAYA', 'SIDOARJO', 'GRESIK', 'MOJOKERTO'];
    const depos = depoList.map(nama => {
      const d = penjualan.filter(r => r.depo === nama);
      return { nama, total: fmtShort(d.reduce((s, r) => s + r.total, 0)), qty: d.reduce((s, r) => s + r.qtyJual, 0) };
    }).filter(d => d.qty > 0);

    // Top SKU
    const skuMap = {};
    penjualan.forEach(r => {
      if (!skuMap[r.namaBarang]) skuMap[r.namaBarang] = { qty: 0, nominal: 0 };
      skuMap[r.namaBarang].qty     += r.qtyJual;
      skuMap[r.namaBarang].nominal += r.total;
    });
    const topSKU = Object.entries(skuMap).sort((a, b) => b[1].qty - a[1].qty).slice(0, 7)
      .map(([nama, v]) => ({ nama, qty: v.qty, nominal: fmtShort(v.nominal) }));

    // Top Retail salesman
    const retailMap = {};
    penjualan.filter(r => r.jobtitle === 'RETAIL').forEach(r => {
      if (!retailMap[r.salesman]) retailMap[r.salesman] = { total: 0, qty: 0, depo: r.depo };
      retailMap[r.salesman].total += r.total;
      retailMap[r.salesman].qty   += r.qtyJual;
    });
    const topRetail = Object.entries(retailMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
      .map(([nama, v]) => ({ nama, depo: v.depo, total: fmtShort(v.total), qty: v.qty }));

    // Top WS salesman
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
      depos,
      topSKU,
      topRetail,
      topWS,
    };
  }

  // ── EXPOSE ────────────────────────────────────────────────────────────
  return {
    run,
    saveKey,
    resetKey,
    forceRefresh,
    buildSummaryPayload,
    buildPenjualanPayload,
    detectPage,
  };

})();
