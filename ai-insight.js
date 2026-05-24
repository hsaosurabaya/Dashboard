# ai-insight.js — AI Insight Engine Architecture

```javascript
/* =========================================================
   AI INSIGHT ENGINE
   Dashboard AI Layer
   ========================================================= */

const AI_CONFIG = {
  apiUrl: "https://YOUR-VERCEL-API.vercel.app/api/insight",

  cacheKeys: {
    summary: "ai_summary_cache",
    sales: "ai_sales_cache"
  },

  signatureKeys: {
    summary: "ai_summary_signature",
    sales: "ai_sales_signature"
  },

  metadataKeys: {
    summary: "ai_summary_metadata",
    sales: "ai_sales_metadata"
  },

  model: "gpt-5.5",

  refreshCooldownMinutes: 30
};


/* =========================================================
   MENU DETECTION
   ========================================================= */

function getCurrentMenu() {
  const activeMenu = document.body.dataset.menu;

  if (activeMenu === "penjualan") {
    return "sales";
  }

  return "summary";
}


/* =========================================================
   KPI COLLECTOR
   ========================================================= */

function collectSummaryData() {
  return {
    menu: "summary",

    totalSales: window.dashboardData?.totalSales || 0,
    salesGrowth: window.dashboardData?.salesGrowth || 0,
    cashRatio: window.dashboardData?.cashRatio || 0,
    agingOver14: window.dashboardData?.agingOver14 || 0,
    targetAchievement: window.dashboardData?.targetAchievement || 0,

    bestArea: window.dashboardData?.bestArea || "-",
    worstArea: window.dashboardData?.worstArea || "-",

    bestSalesman: window.dashboardData?.bestSalesman || "-",
    worstSalesman: window.dashboardData?.worstSalesman || "-",

    lastUpdated: window.dashboardData?.lastUpdated || new Date().toISOString()
  };
}


function collectSalesData() {
  return {
    menu: "sales",

    totalSales: window.salesData?.totalSales || 0,
    salesGrowth: window.salesData?.salesGrowth || 0,

    topSKU: window.salesData?.topSKU || "-",
    topOutlet: window.salesData?.topOutlet || "-",

    worstSKU: window.salesData?.worstSKU || "-",
    worstOutlet: window.salesData?.worstOutlet || "-",

    topArea: window.salesData?.topArea || "-",
    weakArea: window.salesData?.weakArea || "-",

    totalOutlet: window.salesData?.totalOutlet || 0,

    lastUpdated: window.salesData?.lastUpdated || new Date().toISOString()
  };
}


/* =========================================================
   DATA SIGNATURE ENGINE
   ========================================================= */

function generateDataSignature(data) {
  const simplified = {
    totalSales: data.totalSales,
    salesGrowth: data.salesGrowth,
    cashRatio: data.cashRatio,
    agingOver14: data.agingOver14,
    topSKU: data.topSKU,
    topOutlet: data.topOutlet,
    lastUpdated: data.lastUpdated
  };

  return btoa(JSON.stringify(simplified));
}


/* =========================================================
   CACHE ENGINE
   ========================================================= */

function getCachedInsight(menu) {
  const cacheKey = AI_CONFIG.cacheKeys[menu];

  return localStorage.getItem(cacheKey);
}


function getCachedSignature(menu) {
  const signatureKey = AI_CONFIG.signatureKeys[menu];

  return localStorage.getItem(signatureKey);
}


function saveInsightCache(menu, insight, signature) {
  const cacheKey = AI_CONFIG.cacheKeys[menu];
  const signatureKey = AI_CONFIG.signatureKeys[menu];
  const metadataKey = AI_CONFIG.metadataKeys[menu];

  localStorage.setItem(cacheKey, insight);
  localStorage.setItem(signatureKey, signature);

  localStorage.setItem(metadataKey, JSON.stringify({
    generatedAt: new Date().toISOString(),
    model: AI_CONFIG.model,
    menu
  }));
}


function getMetadata(menu) {
  const metadataKey = AI_CONFIG.metadataKeys[menu];

  const raw = localStorage.getItem(metadataKey);

  if (!raw) return null;

  return JSON.parse(raw);
}


/* =========================================================
   PROMPT ENGINE
   ========================================================= */

function buildPrompt(menu, data) {

  if (menu === "summary") {
    return `
Kamu adalah analis bisnis senior spesialis distribusi FMCG di Indonesia, khususnya area Jawa Timur.

Tujuan bisnis:
- meningkatkan omzet penjualan
- menjaga cashflow sehat
- menekan aging piutang >14 hari
- meningkatkan distribusi SKU utama

Prioritas analisa:
1. Pertumbuhan omzet
2. Cash ratio
3. Aging piutang
4. Produktivitas salesman
5. Performa area

Gunakan gaya laporan eksekutif profesional dalam Bahasa Indonesia.
Gunakan angka konkret dari data.
Tulis dengan nada tegas, insight tajam, dan rekomendasi actionable.

Jangan membuat asumsi yang tidak didukung data.
Jika data kurang, nyatakan secara eksplisit.

Format output WAJIB:

📊 RINGKASAN EKSEKUTIF

✅ HIGHLIGHT POSITIF

⚠️ PERHATIAN & RISIKO

🔮 PROYEKSI & TREN

💡 REKOMENDASI AKSI

DATA:
${JSON.stringify(data, null, 2)}
`;
  }


  return `
Kamu adalah sales distribution analyst senior FMCG area Jawa Timur.

Fokus analisa:
- performa SKU
- performa outlet
- area penjualan
- growth penjualan
- distribusi produk

Gunakan insight yang tajam, konkret, dan profesional.

Jangan menggunakan kalimat umum.
Selalu gunakan angka dan tindakan spesifik.

Format output WAJIB:

📊 RINGKASAN PENJUALAN

✅ HIGHLIGHT PENJUALAN

⚠️ RISIKO PENJUALAN

🔮 PROYEKSI SALES

💡 REKOMENDASI DISTRIBUSI

DATA:
${JSON.stringify(data, null, 2)}
`;
}


/* =========================================================
   AI REQUEST ENGINE
   ========================================================= */

async function requestAIInsight(menu, payload) {

  const prompt = buildPrompt(menu, payload);

  const response = await fetch(AI_CONFIG.apiUrl, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      menu,
      prompt,
      payload
    })
  });

  if (!response.ok) {
    throw new Error("Failed to generate AI insight");
  }

  return response.json();
}


/* =========================================================
   UI RENDER ENGINE
   ========================================================= */

function renderInsight(content) {

  const insightContainer = document.getElementById("aiInsightContent");

  if (!insightContainer) return;

  insightContainer.innerHTML = content
    .replace(/\n/g, "<br>")
    .replace(/📊/g, '<div class="ai-section-title">📊')
    .replace(/✅/g, '</div><div class="ai-section-title">✅')
    .replace(/⚠️/g, '</div><div class="ai-section-title">⚠️')
    .replace(/🔮/g, '</div><div class="ai-section-title">🔮')
    .replace(/💡/g, '</div><div class="ai-section-title">💡');
}


function renderMetadata(menu) {

  const metadata = getMetadata(menu);

  if (!metadata) return;

  const metaContainer = document.getElementById("aiInsightMeta");

  if (!metaContainer) return;

  const generatedTime = new Date(metadata.generatedAt)
    .toLocaleString("id-ID");

  metaContainer.innerHTML = `
    AI Insight terakhir diperbarui:
    ${generatedTime}
  `;
}


/* =========================================================
   LOADING UI
   ========================================================= */

function showLoadingState() {
  const container = document.getElementById("aiInsightContent");

  if (!container) return;

  container.innerHTML = `
    <div class="ai-loading">
      Generating AI Insight...
    </div>
  `;
}


function showErrorState(error) {
  const container = document.getElementById("aiInsightContent");

  if (!container) return;

  container.innerHTML = `
    <div class="ai-error">
      Failed to generate AI insight.
      <br>
      ${error.message}
    </div>
  `;
}


/* =========================================================
   MAIN ENGINE
   ========================================================= */

async function initializeAIInsight() {

  try {

    const menu = getCurrentMenu();


    let data;

    if (menu === "summary") {
      data = collectSummaryData();
    } else {
      data = collectSalesData();
    }


    const newSignature = generateDataSignature(data);

    const oldSignature = getCachedSignature(menu);

    const cachedInsight = getCachedInsight(menu);


    /* ========================================
       USE CACHE IF DATA IS SAME
       ======================================== */

    if (
      newSignature === oldSignature &&
      cachedInsight
    ) {

      console.log("Using cached AI insight...");

      renderInsight(cachedInsight);
      renderMetadata(menu);

      return;
    }


    /* ========================================
       GENERATE NEW AI INSIGHT
       ======================================== */

    console.log("Generating new AI insight...");

    showLoadingState();


    const result = await requestAIInsight(menu, data);

    const insight = result.insight;


    saveInsightCache(
      menu,
      insight,
      newSignature
    );


    renderInsight(insight);
    renderMetadata(menu);

  }

  catch (error) {

    console.error(error);

    showErrorState(error);
  }
}


/* =========================================================
   AUTO START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initializeAIInsight();
});
