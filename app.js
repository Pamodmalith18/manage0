/* ============================================================
   PocketPro – app.js  v2.0
   Features: API balance fetch, global auto-save, full trade management
   ============================================================ */

// ─────────────────────────────────────────────
// MANUAL BALANCE REFRESH (Dashboard button)
// ─────────────────────────────────────────────
async function manualRefreshBalance() {
  const icon = document.getElementById('refresh-icon');
  const s    = getSettings();
  if (icon) icon.classList.add('fa-spin');

  if (s.balanceSource === 'api' && s.apiUrl) {
    const bal = await fetchApiBalance(true);
    if (bal !== null) {
      updateBalanceDisplayFull(bal);
    }
  } else {
    // Manual mode: just recalculate from starting balance + profits
    const trades      = getTrades();
    const totalProfit = trades.reduce((a, t) => a + t.profit, 0);
    const balance     = parseFloat(s.balance) + totalProfit;
    updateBalanceDisplayFull(balance);
    showToast('Balance refreshed ✅', 'success');
  }

  setTimeout(() => { if (icon) icon.classList.remove('fa-spin'); }, 800);
}

function updateBalanceDisplayFull(balance) {
  const s   = getSettings();
  const el  = document.getElementById('stat-balance');
  const upd = document.getElementById('balance-last-updated');
  const badge = document.getElementById('api-badge');

  if (el) el.textContent = fmt(balance);

  // Show LIVE badge if using API
  if (badge) {
    if (s.balanceSource === 'api') {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (upd) {
    upd.textContent = 'Updated: ' + new Date().toLocaleTimeString();
  }
}

// ─────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────
const STORAGE_KEY    = 'pocketpro_trades';
const SETTINGS_KEY   = 'pocketpro_settings';
const AUTOSAVE_KEY   = 'pocketpro_autosave';

// ─────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────
function getTrades() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveTrades(trades) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  dispatchDataChange();
}
function getSettings() {
  const defaults = {
    username:       'Hari',
    balance:        1000,
    liveBalance:    null,        // fetched from API or manually set
    balanceSource:  'manual',    // 'manual' | 'api'
    apiUrl:         '',
    apiKey:         '',
    apiBalancePath: 'balance',   // JSON key path e.g. "data.balance"
    apiRefreshSec:  30,
    payout:         80,
    currency:       'USD',
    dailyLimit:     50,
    maxTrade:       25,
    dailyTarget:    100,
    autoSave:       true,
  };
  try {
    return Object.assign({}, defaults, JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {});
  } catch { return defaults; }
}
function saveSettingsData(data) {
  const current = getSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign({}, current, data)));
  dispatchDataChange();
}
// Notify all listeners when data changes
function dispatchDataChange() {
  window.dispatchEvent(new CustomEvent('pocketpro-data-change'));
}

// ─────────────────────────────────────────────
// AUTO-SAVE ENGINE
// ─────────────────────────────────────────────
let _autoSaveTimers = {};
function autoSaveField(fieldId, settingKey, transform) {
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(_autoSaveTimers[fieldId]);
    showAutoSavePill('Saving…', 'saving');
    _autoSaveTimers[fieldId] = setTimeout(() => {
      let val = el.value;
      if (transform) val = transform(val);
      saveSettingsData({ [settingKey]: val });
      syncSidebar();
      showAutoSavePill('Auto-saved ✓', 'saved');
    }, 600);
  });
  el.addEventListener('change', () => {
    let val = el.value;
    if (transform) val = transform(val);
    saveSettingsData({ [settingKey]: val });
    syncSidebar();
    showAutoSavePill('Auto-saved ✓', 'saved');
  });
}

function showAutoSavePill(msg, state) {
  let pill = document.getElementById('autosave-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.id = 'autosave-pill';
    pill.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      z-index:9999; display:flex; align-items:center; gap:8px;
      background:#12162A; border:1px solid #1E2340; border-radius:99px;
      padding:6px 16px; font-size:12px; font-family:Inter,sans-serif;
      color:#fff; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(pill);
  }
  const dot = state === 'saving' ? '🔄' : '✅';
  pill.innerHTML = `<span>${dot}</span><span>${msg}</span>`;
  pill.style.opacity = '1';
  clearTimeout(pill._hideTimer);
  if (state === 'saved') {
    pill._hideTimer = setTimeout(() => { pill.style.opacity = '0'; }, 2000);
  }
}

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────
function currencySymbol(c) {
  const map = { USD: '$', EUR: '€', LKR: 'Rs ', INR: '₹', GBP: '£' };
  return map[c] || '$';
}
function fmt(value, currency) {
  const s = getSettings();
  const sym = currencySymbol(currency || s.currency);
  const abs = Math.abs(value).toFixed(2);
  return (value < 0 ? '-' : '') + sym + abs;
}
function calcProfit(amount, payout, result) {
  if (result === 'win')  return parseFloat((amount * payout / 100).toFixed(2));
  if (result === 'loss') return -parseFloat(parseFloat(amount).toFixed(2));
  return 0;
}
function formatDate(dt) {
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatTime(dt) {
  return new Date(dt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getText(id) { return document.getElementById(id)?.value ?? ''; }
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setVal(id, val)  { const el = document.getElementById(id); if (el) el.value = val ?? ''; }

// ─────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────
function showToast(msg, type = 'success') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9998;';
    document.body.appendChild(toast);
  }
  const icons = {
    success: 'fa-check-circle" style="color:#43E97B',
    error:   'fa-times-circle" style="color:#FF4C6A',
    info:    'fa-info-circle" style="color:#6C63FF',
    warning: 'fa-triangle-exclamation" style="color:#F0B429',
  };
  toast.innerHTML = `
    <div style="background:#12162A;border:1px solid #1E2340;border-radius:12px;
      padding:12px 20px;display:flex;align-items:center;gap:10px;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Inter,sans-serif;">
      <i class="fas ${icons[type] || icons.success}"></i>
      <p style="font-size:13px;color:#fff;font-weight:500;margin:0">${msg}</p>
    </div>`;
  toast.style.display = 'block';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.display = 'none'; }, 3500);
}

// ─────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────
function syncSidebar() {
  const s = getSettings();
  const el = document.getElementById('sidebar-username');
  if (el) el.textContent = s.username || 'Hari';
}

// ─────────────────────────────────────────────
// API BALANCE FETCHER
// ─────────────────────────────────────────────
let _apiFetchInterval = null;

/**
 * Fetch balance from a user-configured REST API endpoint.
 * Supports:
 *   - Simple: { "balance": 1234.56 }
 *   - Nested: { "data": { "account": { "balance": 1234.56 } } }
 *   - Array:  [{ "balance": 1234.56 }]
 * The user sets apiBalancePath like "balance" or "data.account.balance"
 */
async function fetchApiBalance(showFeedback = false) {
  const s = getSettings();
  if (!s.apiUrl || s.balanceSource !== 'api') return null;

  const statusEl = document.getElementById('api-status');
  const balEl    = document.getElementById('api-live-balance');

  try {
    if (statusEl) statusEl.innerHTML = `
      <span class="flex items-center gap-1.5 text-[#F0B429] text-xs">
        <i class="fas fa-spinner fa-spin"></i> Fetching…
      </span>`;

    const headers = { 'Content-Type': 'application/json' };
    if (s.apiKey) headers['Authorization'] = `Bearer ${s.apiKey}`;

    const res = await fetch(s.apiUrl, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // Resolve path like "data.balance"
    const path = (s.apiBalancePath || 'balance').split('.');
    let value = Array.isArray(json) ? json[0] : json;
    for (const key of path) { value = value?.[key]; }
    const balance = parseFloat(value);

    if (isNaN(balance)) throw new Error('Balance value not found at path: ' + s.apiBalancePath);

    // Save fetched balance
    saveSettingsData({ liveBalance: balance });
    updateBalanceDisplay(balance);

    if (statusEl) statusEl.innerHTML = `
      <span class="flex items-center gap-1.5 text-[#43E97B] text-xs">
        <i class="fas fa-circle-check"></i> Connected · ${new Date().toLocaleTimeString()}
      </span>`;

    if (showFeedback) showToast(`Balance fetched: ${fmt(balance)} ✅`, 'success');
    return balance;

  } catch (err) {
    if (statusEl) statusEl.innerHTML = `
      <span class="flex items-center gap-1.5 text-[#FF4C6A] text-xs">
        <i class="fas fa-circle-xmark"></i> ${err.message}
      </span>`;
    if (showFeedback) showToast('API Error: ' + err.message, 'error');
    return null;
  }
}

function startApiPolling() {
  const s = getSettings();
  if (_apiFetchInterval) clearInterval(_apiFetchInterval);
  if (s.balanceSource === 'api' && s.apiUrl) {
    fetchApiBalance();
    const secs = Math.max(10, parseInt(s.apiRefreshSec) || 30);
    _apiFetchInterval = setInterval(() => fetchApiBalance(), secs * 1000);
  }
}

function stopApiPolling() {
  if (_apiFetchInterval) clearInterval(_apiFetchInterval);
}

function updateBalanceDisplay(liveBalance) {
  // Update dashboard balance card with live value from API
  const s = getSettings();
  const trades = getTrades();
  const totalProfit = trades.reduce((a, t) => a + t.profit, 0);
  // If API balance available, show it directly; otherwise compute from starting balance
  const displayBalance = liveBalance !== null && liveBalance !== undefined
    ? liveBalance : parseFloat(s.balance) + totalProfit;

  const el = document.getElementById('stat-balance');
  if (el) {
    el.textContent = fmt(displayBalance);
    // Add live indicator if from API
    if (liveBalance !== null && s.balanceSource === 'api') {
      el.innerHTML = fmt(displayBalance) +
        ' <span style="font-size:9px;background:rgba(67,233,123,0.2);color:#43E97B;' +
        'border:1px solid rgba(67,233,123,0.3);border-radius:99px;padding:1px 6px;vertical-align:middle">LIVE</span>';
    }
  }
}

// ─────────────────────────────────────────────
// DASHBOARD PAGE
// ─────────────────────────────────────────────
let profitChartInst = null;
let winLossChartInst = null;

function initDashboard() {
  syncSidebar();
  renderDashboardStats();
  renderDashboardCharts('all');
  renderRecentTrades();
  checkRiskAlerts();
  startApiPolling();
  // Live refresh every 60s
  setInterval(() => {
    renderDashboardStats();
    renderRecentTrades();
    checkRiskAlerts();
  }, 60000);
}

function renderDashboardStats() {
  const trades = getTrades();
  const s      = getSettings();
  const wins   = trades.filter(t => t.result === 'win');
  const losses = trades.filter(t => t.result === 'loss');
  const totalProfit = trades.reduce((a, t) => a + t.profit, 0);
  const winRate = trades.length ? ((wins.length / trades.length) * 100).toFixed(1) : 0;

  // Balance — use liveBalance from API if available
  const liveBalance = (s.balanceSource === 'api' && s.liveBalance !== null) ? s.liveBalance : null;
  const computedBalance = parseFloat(s.balance) + totalProfit;
  updateBalanceDisplay(liveBalance !== null ? liveBalance : computedBalance);

  const balancePct = s.balance ? ((totalProfit / s.balance) * 100).toFixed(2) : 0;
  const balEl = document.getElementById('stat-balance-change');
  if (balEl) {
    balEl.className = `text-xs mt-2 flex items-center gap-1 ${totalProfit >= 0 ? 'text-[#43E97B]' : 'text-[#FF4C6A]'}`;
    if (s.balanceSource === 'api' && s.liveBalance) {
      balEl.innerHTML = `<i class="fas fa-wifi"></i><span>Live from API</span>`;
    } else {
      balEl.innerHTML = `<i class="fas ${totalProfit >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i><span>${balancePct}%</span>`;
    }
  }

  // Win Rate
  setText('stat-winrate', winRate + '%');
  setText('stat-wins-count', wins.length + ' Wins');

  // Profit
  const profEl = document.getElementById('stat-profit');
  if (profEl) {
    profEl.textContent = fmt(totalProfit);
    profEl.className = `text-2xl font-bold ${totalProfit >= 0 ? 'text-[#43E97B]' : 'text-[#FF4C6A]'}`;
  }
  const pSub = document.getElementById('stat-profit-sub');
  if (pSub) pSub.className = `text-xs mt-2 flex items-center gap-1 ${totalProfit >= 0 ? 'text-[#43E97B]' : 'text-[#FF4C6A]'}`;

  // Streak
  const streak = calcCurrentStreak(trades);
  setText('stat-streak', Math.abs(streak));
  const strEl = document.getElementById('stat-total-trades');
  if (strEl) strEl.querySelector('span').textContent = trades.length + ' Total';

  // Pie labels
  setText('pie-wins', wins.length);
  setText('pie-losses', losses.length);
}

function calcCurrentStreak(trades) {
  if (!trades.length) return 0;
  const sorted = [...trades].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
  const last = sorted[0].result;
  let count = 0;
  for (const t of sorted) { if (t.result === last) count++; else break; }
  return last === 'win' ? count : -count;
}
function calcMaxStreaks(trades) {
  let maxWin = 0, maxLoss = 0, curWin = 0, curLoss = 0;
  [...trades].sort((a, b) => new Date(a.datetime) - new Date(b.datetime)).forEach(t => {
    if (t.result === 'win') { curWin++; curLoss = 0; maxWin = Math.max(maxWin, curWin); }
    else { curLoss++; curWin = 0; maxLoss = Math.max(maxLoss, curLoss); }
  });
  return { maxWin, maxLoss };
}

function renderDashboardCharts(filter) {
  const allTrades = getTrades();
  let trades = [...allTrades].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  if (filter === 'week')  { const c = new Date(); c.setDate(c.getDate()-7);  trades = trades.filter(t => new Date(t.datetime) >= c); }
  if (filter === 'month') { const c = new Date(); c.setDate(c.getDate()-30); trades = trades.filter(t => new Date(t.datetime) >= c); }

  const profitCtx   = document.getElementById('profitChart');
  const noChartData = document.getElementById('no-chart-data');
  if (profitCtx) {
    if (!trades.length) {
      noChartData?.classList.remove('hidden'); profitCtx.style.display = 'none';
    } else {
      noChartData?.classList.add('hidden'); profitCtx.style.display = 'block';
      let cum = 0;
      const labels = [], data = [];
      trades.forEach((t, i) => { cum += t.profit; labels.push('#'+(i+1)); data.push(+cum.toFixed(2)); });
      if (profitChartInst) profitChartInst.destroy();
      profitChartInst = new Chart(profitCtx, {
        type: 'line',
        data: { labels, datasets: [{ label:'Profit', data, borderColor:'#6C63FF',
          backgroundColor: ctx => { const g=ctx.chart.ctx.createLinearGradient(0,0,0,200); g.addColorStop(0,'rgba(108,99,255,.3)'); g.addColorStop(1,'rgba(108,99,255,0)'); return g; },
          fill:true, tension:0.4, pointBackgroundColor:data.map(v=>v>=0?'#43E97B':'#FF4C6A'), pointRadius:4, pointHoverRadius:6, borderWidth:2 }]
        },
        options: chartOptions()
      });
    }
  }

  const wlCtx = document.getElementById('winLossChart');
  const noPie = document.getElementById('no-pie-data');
  const wins  = allTrades.filter(t => t.result==='win').length;
  const losses= allTrades.filter(t => t.result==='loss').length;
  if (wlCtx) {
    if (!wins && !losses) { noPie && (noPie.style.display='flex'); wlCtx.style.display='none'; }
    else {
      noPie && (noPie.style.display='none'); wlCtx.style.display='block';
      if (winLossChartInst) winLossChartInst.destroy();
      winLossChartInst = new Chart(wlCtx, {
        type:'doughnut',
        data:{ labels:['Wins','Losses'], datasets:[{ data:[wins,losses],
          backgroundColor:['rgba(67,233,123,.85)','rgba(255,76,106,.85)'],
          borderColor:['#43E97B','#FF4C6A'], borderWidth:2, hoverOffset:6 }]
        },
        options:{ responsive:true, maintainAspectRatio:false, cutout:'68%',
          plugins:{ legend:{display:false},
            tooltip:{ backgroundColor:'#12162A', borderColor:'#1E2340', borderWidth:1,
              titleColor:'#fff', bodyColor:'#9CA3AF',
              callbacks:{ label:ctx=>`${ctx.label}: ${ctx.raw} (${((ctx.raw/(wins+losses))*100).toFixed(1)}%)` }
            }
          }
        }
      });
    }
  }
}

function setChartFilter(f) {
  document.querySelectorAll('.chart-filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('filter-'+f)?.classList.add('active');
  renderDashboardCharts(f);
}

function renderRecentTrades() {
  const trades = getTrades().sort((a,b)=>new Date(b.datetime)-new Date(a.datetime)).slice(0,5);
  const table=document.getElementById('trades-table'), noMsg=document.getElementById('no-trades-msg'), tbody=document.getElementById('trades-tbody');
  if (!tbody) return;
  tbody.innerHTML='';
  if (!trades.length) { table?.classList.add('hidden'); noMsg && (noMsg.style.display='block'); return; }
  table?.classList.remove('hidden'); noMsg && (noMsg.style.display='none');
  trades.forEach(t => {
    const pc = t.profit>=0?'text-[#43E97B]':'text-[#FF4C6A]';
    tbody.innerHTML += `<tr>
      <td class="font-medium text-white">${escHtml(t.asset)}</td>
      <td>${t.direction==='call'?'<span class="badge-call">📈 CALL</span>':'<span class="badge-put">📉 PUT</span>'}</td>
      <td>${fmt(t.amount)}</td>
      <td class="font-semibold ${pc}">${t.profit>=0?'+':''}${fmt(t.profit)}</td>
      <td>${t.result==='win'?'<span class="badge-win"><i class="fas fa-check"></i> WIN</span>':'<span class="badge-loss"><i class="fas fa-times"></i> LOSS</span>'}</td>
      <td class="text-gray-400">${formatDate(t.datetime)}</td>
    </tr>`;
  });
}

function checkRiskAlerts() {
  const s=getSettings(), trades=getTrades();
  const today=new Date().toDateString();
  const todayT=trades.filter(t=>new Date(t.datetime).toDateString()===today);
  const todayLoss=todayT.filter(t=>t.result==='loss').reduce((a,t)=>a+Math.abs(t.profit),0);
  const todayProfit=todayT.reduce((a,t)=>a+t.profit,0);
  const container=document.querySelector('.p-8.space-y-8');
  if (!container) return;
  container.querySelectorAll('.risk-alert,.profit-alert').forEach(e=>e.remove());
  if (s.dailyLimit && todayLoss>=parseFloat(s.dailyLimit)) {
    const a=document.createElement('div'); a.className='risk-alert';
    a.innerHTML=`<i class="fas fa-triangle-exclamation"></i><span>⚠️ Daily Loss Limit Reached! You've lost ${fmt(todayLoss)} today. Consider stopping.</span>`;
    container.prepend(a);
  }
  if (s.dailyTarget && todayProfit>=parseFloat(s.dailyTarget)) {
    const a=document.createElement('div'); a.className='profit-alert';
    a.innerHTML=`<i class="fas fa-star"></i><span>🎉 Daily Profit Target Reached! You earned ${fmt(todayProfit)} today. Great job!</span>`;
    container.prepend(a);
  }
}

// ─────────────────────────────────────────────
// TRADES PAGE
// ─────────────────────────────────────────────
function initTrades() {
  syncSidebar();
  renderTradesTable();
  renderTradeStats();
  const dtInput = document.getElementById('trade-datetime');
  if (dtInput) {
    const now = new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
    dtInput.value = now.toISOString().slice(0,16);
  }
  ['trade-amount','trade-payout','trade-result'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateProfit);
    document.getElementById(id)?.addEventListener('input', updateProfit);
  });
}

function renderTradeStats() {
  const trades=getTrades(), wins=trades.filter(t=>t.result==='win'), losses=trades.filter(t=>t.result==='loss');
  const profit=trades.reduce((a,t)=>a+t.profit,0);
  setText('log-total',trades.length); setText('log-wins',wins.length); setText('log-losses',losses.length);
  const pEl=document.getElementById('log-profit');
  if (pEl) { pEl.textContent=fmt(profit); pEl.className=`font-bold ${profit>=0?'text-[#43E97B]':'text-[#FF4C6A]'}`; }
}

function renderTradesTable() {
  let trades=getTrades();
  const noMsg=document.getElementById('no-trades-msg'), table=document.getElementById('main-trades-table'), tbody=document.getElementById('main-trades-tbody');
  if (!tbody) return;
  const search=(document.getElementById('trade-search')?.value||'').toLowerCase();
  const resF=document.getElementById('filter-result')?.value||'all';
  const dirF=document.getElementById('filter-direction')?.value||'all';
  const sort=document.getElementById('filter-sort')?.value||'newest';
  if (search)      trades=trades.filter(t=>t.asset.toLowerCase().includes(search));
  if (resF!=='all') trades=trades.filter(t=>t.result===resF);
  if (dirF!=='all') trades=trades.filter(t=>t.direction===dirF);
  if (sort==='newest')      trades.sort((a,b)=>new Date(b.datetime)-new Date(a.datetime));
  else if (sort==='oldest') trades.sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
  else if (sort==='profit-high') trades.sort((a,b)=>b.profit-a.profit);
  else if (sort==='profit-low')  trades.sort((a,b)=>a.profit-b.profit);
  tbody.innerHTML='';
  if (!trades.length) { table?.classList.add('hidden'); noMsg&&(noMsg.style.display='block'); return; }
  table?.classList.remove('hidden'); noMsg&&(noMsg.style.display='none');
  trades.forEach((t,i)=>{
    const pc=t.profit>=0?'text-[#43E97B]':'text-[#FF4C6A]';
    tbody.innerHTML+=`<tr class="fade-in">
      <td class="text-gray-400 text-xs">${i+1}</td>
      <td class="font-semibold text-white">${escHtml(t.asset)}</td>
      <td>${t.direction==='call'?'<span class="badge-call">📈 CALL</span>':'<span class="badge-put">📉 PUT</span>'}</td>
      <td class="font-medium">${fmt(t.amount)}</td>
      <td class="text-gray-300">${t.payout}%</td>
      <td class="font-bold ${pc}">${t.profit>=0?'+':''}${fmt(t.profit)}</td>
      <td>${t.result==='win'?'<span class="badge-win"><i class="fas fa-check"></i> WIN</span>':'<span class="badge-loss"><i class="fas fa-times"></i> LOSS</span>'}</td>
      <td class="text-gray-400 text-xs">${formatTime(t.datetime)}</td>
      <td class="text-gray-400 text-xs">${formatDate(t.datetime)}</td>
      <td>
        <div class="flex items-center gap-2">
          <button onclick="editTrade('${t.id}')" class="w-7 h-7 rounded-lg bg-[#1E2340] hover:bg-[#6C63FF]/20 hover:text-[#6C63FF] text-gray-400 transition-all flex items-center justify-center text-xs"><i class="fas fa-edit"></i></button>
          <button onclick="deleteTrade('${t.id}')" class="w-7 h-7 rounded-lg bg-[#1E2340] hover:bg-[#FF4C6A]/20 hover:text-[#FF4C6A] text-gray-400 transition-all flex items-center justify-center text-xs"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`;
  });
}

function openModal() {
  const modal=document.getElementById('trade-modal');
  if (!modal) return;
  modal.classList.remove('hidden'); modal.classList.add('open');
  document.getElementById('modal-title').textContent='Add New Trade';
  document.getElementById('trade-form').reset();
  document.getElementById('edit-trade-id').value='';
  document.getElementById('profit-preview').classList.add('hidden');
  const now=new Date(); now.setMinutes(now.getMinutes()-now.getTimezoneOffset());
  const dtInput=document.getElementById('trade-datetime'); if(dtInput) dtInput.value=now.toISOString().slice(0,16);
  const s=getSettings(); if(s.payout) document.getElementById('trade-payout').value=s.payout;
}
function closeModal() {
  const modal=document.getElementById('trade-modal');
  if (!modal) return;
  modal.classList.add('hidden'); modal.classList.remove('open');
}
function updateProfit() {
  const amount=parseFloat(document.getElementById('trade-amount')?.value)||0;
  const payout=parseFloat(document.getElementById('trade-payout')?.value)||0;
  const result=document.getElementById('trade-result')?.value;
  const preview=document.getElementById('profit-preview'), previewVal=document.getElementById('profit-preview-value');
  if (!result||!amount) { preview?.classList.add('hidden'); return; }
  const profit=calcProfit(amount,payout,result);
  preview?.classList.remove('hidden');
  if (previewVal) { previewVal.textContent=(profit>=0?'+':'')+fmt(profit); previewVal.className=`font-bold ${profit>=0?'text-[#43E97B]':'text-[#FF4C6A]'}`; }
}
function saveTrade(e) {
  e.preventDefault();
  const editId=document.getElementById('edit-trade-id').value;
  const amount=parseFloat(document.getElementById('trade-amount').value);
  const payout=parseFloat(document.getElementById('trade-payout').value);
  const result=document.getElementById('trade-result').value;
  const profit=calcProfit(amount,payout,result);
  const trade={
    id:editId||uid(), asset:document.getElementById('trade-asset').value.trim().toUpperCase(),
    direction:document.getElementById('trade-direction').value, amount, payout, result, profit,
    duration:document.getElementById('trade-duration').value,
    datetime:document.getElementById('trade-datetime').value,
    notes:document.getElementById('trade-notes').value.trim(),
  };
  const s=getSettings();
  if (s.maxTrade&&amount>parseFloat(s.maxTrade)) {
    if (!confirm(`⚠️ Trade (${fmt(amount)}) exceeds max size (${fmt(s.maxTrade)}). Continue?`)) return;
  }
  let trades=getTrades();
  if (editId) { trades=trades.map(t=>t.id===editId?trade:t); showToast('Trade updated! ✅','success'); }
  else { trades.push(trade); showToast('Trade saved! '+(result==='win'?'🎉 WIN!':'📉 Loss recorded.'),result==='win'?'success':'error'); }
  saveTrades(trades);
  closeModal(); renderTradesTable(); renderTradeStats();
}
function editTrade(id) {
  const trade=getTrades().find(t=>t.id===id); if (!trade) return;
  openModal();
  document.getElementById('modal-title').textContent='Edit Trade';
  document.getElementById('edit-trade-id').value=id;
  document.getElementById('trade-asset').value=trade.asset;
  document.getElementById('trade-direction').value=trade.direction;
  document.getElementById('trade-amount').value=trade.amount;
  document.getElementById('trade-payout').value=trade.payout;
  document.getElementById('trade-result').value=trade.result;
  document.getElementById('trade-duration').value=trade.duration||'1m';
  document.getElementById('trade-notes').value=trade.notes||'';
  const dt=new Date(trade.datetime); dt.setMinutes(dt.getMinutes()-dt.getTimezoneOffset());
  document.getElementById('trade-datetime').value=dt.toISOString().slice(0,16);
  updateProfit();
}
function deleteTrade(id) {
  if (!confirm('Delete this trade? This cannot be undone.')) return;
  saveTrades(getTrades().filter(t=>t.id!==id));
  renderTradesTable(); renderTradeStats(); showToast('Trade deleted.','info');
}
function clearFilters() {
  ['trade-search','filter-result','filter-direction','filter-sort'].forEach(id=>{
    const el=document.getElementById(id);
    if (el) { if (el.tagName==='INPUT') el.value=''; else el.value=el.options[0].value; }
  });
  renderTradesTable();
}

// ─────────────────────────────────────────────
// ANALYTICS PAGE
// ─────────────────────────────────────────────
let anProfitChart=null, anDailyChart=null, anDurationChart=null;
function initAnalytics() {
  syncSidebar();
  const trades=getTrades().sort((a,b)=>new Date(a.datetime)-new Date(b.datetime));
  const wins=trades.filter(t=>t.result==='win'), losses=trades.filter(t=>t.result==='loss');
  const invested=trades.reduce((a,t)=>a+t.amount,0);
  const totalProfit=trades.reduce((a,t)=>a+t.profit,0);
  const avgProfit=trades.length?totalProfit/trades.length:0;
  const bestTrade=wins.length?Math.max(...wins.map(t=>t.profit)):0;
  const worstTrade=losses.length?Math.min(...losses.map(t=>t.profit)):0;
  const {maxWin,maxLoss}=calcMaxStreaks(trades);
  setText('an-best',fmt(bestTrade));
  const anWorst=document.getElementById('an-worst'); if(anWorst) anWorst.textContent=fmt(worstTrade);
  const anAvg=document.getElementById('an-avg');
  if(anAvg){anAvg.textContent=(avgProfit>=0?'+':'')+fmt(avgProfit);anAvg.className=`text-2xl font-bold ${avgProfit>=0?'text-[#43E97B]':'text-[#FF4C6A]'}`;}
  setText('an-invested',fmt(invested)); setText('an-max-win-streak',maxWin); setText('an-max-loss-streak',maxLoss);
  renderAnProfitChart(trades); renderAnDailyChart(trades); renderAssetPerformance(trades); renderDurationChart(trades);
}
function renderAnProfitChart(trades) {
  const ctx=document.getElementById('an-profit-chart'),noData=document.getElementById('an-no-data-1');
  if (!ctx) return;
  if (!trades.length){noData&&(noData.style.display='flex');ctx.style.display='none';return;}
  noData&&(noData.style.display='none');ctx.style.display='block';
  let cum=0; const labels=trades.map((_,i)=>'#'+(i+1)); const data=trades.map(t=>{cum+=t.profit;return+cum.toFixed(2);});
  if(anProfitChart) anProfitChart.destroy();
  anProfitChart=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Cumulative Profit',data,borderColor:'#6C63FF',
    backgroundColor:c=>{const g=c.chart.ctx.createLinearGradient(0,0,0,200);g.addColorStop(0,'rgba(108,99,255,.35)');g.addColorStop(1,'rgba(108,99,255,0)');return g;},
    fill:true,tension:0.4,pointRadius:3,borderWidth:2,pointBackgroundColor:data.map(v=>v>=0?'#43E97B':'#FF4C6A')}]},options:chartOptions()});
}
function renderAnDailyChart(trades) {
  const ctx=document.getElementById('an-daily-chart'),noData=document.getElementById('an-no-data-2');
  if (!ctx) return;
  if (!trades.length){noData&&(noData.style.display='flex');ctx.style.display='none';return;}
  noData&&(noData.style.display='none');ctx.style.display='block';
  const daily={};
  trades.forEach(t=>{const day=new Date(t.datetime).toLocaleDateString('en-US',{month:'short',day:'numeric'});daily[day]=(daily[day]||0)+t.profit;});
  const labels=Object.keys(daily),data=Object.values(daily).map(v=>+v.toFixed(2));
  if(anDailyChart) anDailyChart.destroy();
  anDailyChart=new Chart(ctx,{type:'bar',data:{labels,datasets:[{label:'Daily P&L',data,backgroundColor:data.map(v=>v>=0?'rgba(67,233,123,.6)':'rgba(255,76,106,.6)'),borderColor:data.map(v=>v>=0?'#43E97B':'#FF4C6A'),borderWidth:1,borderRadius:6}]},options:chartOptions()});
}
function renderAssetPerformance(trades) {
  const container=document.getElementById('asset-perf-list');
  if (!container) return;
  if (!trades.length){container.innerHTML='<div class="text-center text-gray-500 text-sm py-6">No trades yet</div>';return;}
  const assets={};
  trades.forEach(t=>{if(!assets[t.asset])assets[t.asset]={wins:0,total:0,profit:0};assets[t.asset].total++;assets[t.asset].profit+=t.profit;if(t.result==='win')assets[t.asset].wins++;});
  const sorted=Object.entries(assets).sort((a,b)=>b[1].profit-a[1].profit);
  container.innerHTML=sorted.map(([asset,d])=>{
    const wr=((d.wins/d.total)*100).toFixed(0),pc=d.profit>=0?'text-[#43E97B]':'text-[#FF4C6A]',bc=d.profit>=0?'bg-[#43E97B]':'bg-[#FF4C6A]';
    return `<div><div class="flex items-center justify-between mb-1">
      <div class="flex items-center gap-2"><span class="text-sm font-semibold text-white">${escHtml(asset)}</span><span class="text-xs text-gray-400">${d.total} trades · ${wr}% WR</span></div>
      <span class="text-sm font-bold ${pc}">${d.profit>=0?'+':''}${fmt(d.profit)}</span></div>
      <div class="progress-bar-bg"><div class="progress-bar-fill ${bc}" style="width:${wr}%"></div></div></div>`;
  }).join('');
}
function renderDurationChart(trades) {
  const ctx=document.getElementById('an-duration-chart'),noData=document.getElementById('an-no-data-3');
  if (!ctx) return;
  if (!trades.length){noData&&(noData.style.display='flex');ctx.style.display='none';return;}
  noData&&(noData.style.display='none');ctx.style.display='block';
  const durs={};trades.forEach(t=>{durs[t.duration||'1m']=(durs[t.duration||'1m']||0)+1;});
  const colors=['#6C63FF','#FF6584','#43E97B','#F0B429','#38BDF8','#FB923C','#A78BFA','#34D399'];
  if(anDurationChart) anDurationChart.destroy();
  anDurationChart=new Chart(ctx,{type:'doughnut',data:{labels:Object.keys(durs),datasets:[{data:Object.values(durs),backgroundColor:colors.slice(0,Object.keys(durs).length),borderWidth:2,borderColor:'#12162A',hoverOffset:6}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{color:'#9CA3AF',font:{size:10},padding:8,boxWidth:10}},tooltip:{backgroundColor:'#12162A',borderColor:'#1E2340',borderWidth:1,titleColor:'#fff',bodyColor:'#9CA3AF'}},cutout:'55%'}});
}

// ─────────────────────────────────────────────
// SETTINGS PAGE  (with auto-save + API config)
// ─────────────────────────────────────────────
function initSettings() {
  syncSidebar();
  const s = getSettings();
  setVal('set-username',     s.username);
  setVal('set-balance',      s.balance);
  setVal('set-payout',       s.payout);
  setVal('set-currency',     s.currency);
  setVal('set-daily-limit',  s.dailyLimit);
  setVal('set-max-trade',    s.maxTrade);
  setVal('set-daily-target', s.dailyTarget);
  setVal('set-api-url',      s.apiUrl);
  setVal('set-api-key',      s.apiKey);
  setVal('set-api-path',     s.apiBalancePath);
  setVal('set-api-refresh',  s.apiRefreshSec);

  // Source toggle
  const manualBtn = document.getElementById('src-manual');
  const apiBtn    = document.getElementById('src-api');
  const apiPanel  = document.getElementById('api-config-panel');
  function updateSourceUI() {
    const isApi = s.balanceSource === 'api';
    if (manualBtn) manualBtn.classList.toggle('active-src', !isApi);
    if (apiBtn)    apiBtn.classList.toggle('active-src', isApi);
    if (apiPanel)  apiPanel.classList.toggle('hidden', !isApi);
  }
  updateSourceUI();
  if (manualBtn) manualBtn.onclick = () => { saveSettingsData({balanceSource:'manual'}); stopApiPolling(); updateSourceUI2('manual'); };
  if (apiBtn)    apiBtn.onclick    = () => { saveSettingsData({balanceSource:'api'}); startApiPolling(); updateSourceUI2('api'); };

  function updateSourceUI2(src) {
    if (manualBtn) manualBtn.classList.toggle('active-src', src==='manual');
    if (apiBtn)    apiBtn.classList.toggle('active-src', src==='api');
    if (apiPanel)  apiPanel.classList.toggle('hidden', src!=='api');
    showAutoSavePill('Balance source saved ✓','saved');
  }

  // ── AUTO-SAVE all fields ──────────────────────
  autoSaveField('set-username',     'username',    v => v.trim() || 'Hari');
  autoSaveField('set-balance',      'balance',     v => parseFloat(v)||0);
  autoSaveField('set-payout',       'payout',      v => parseFloat(v)||80);
  autoSaveField('set-currency',     'currency',    v => v);
  autoSaveField('set-daily-limit',  'dailyLimit',  v => parseFloat(v)||0);
  autoSaveField('set-max-trade',    'maxTrade',    v => parseFloat(v)||0);
  autoSaveField('set-daily-target', 'dailyTarget', v => parseFloat(v)||0);
  autoSaveField('set-api-url',      'apiUrl',      v => v.trim());
  autoSaveField('set-api-key',      'apiKey',      v => v.trim());
  autoSaveField('set-api-path',     'apiBalancePath', v => v.trim()||'balance');
  autoSaveField('set-api-refresh',  'apiRefreshSec',  v => parseInt(v)||30);

  // Test API button
  document.getElementById('test-api-btn')?.addEventListener('click', async () => {
    await fetchApiBalance(true);
  });
}

// Legacy save buttons (still work but no longer required)
function saveSettings() {
  const data = {
    username: document.getElementById('set-username')?.value.trim()||'Hari',
    balance:  parseFloat(document.getElementById('set-balance')?.value)||0,
    payout:   parseFloat(document.getElementById('set-payout')?.value)||80,
    currency: document.getElementById('set-currency')?.value,
  };
  saveSettingsData(data); syncSidebar(); showToast('Profile saved ✅','success');
}
function saveRiskSettings() {
  const data = {
    dailyLimit:  parseFloat(document.getElementById('set-daily-limit')?.value)||0,
    maxTrade:    parseFloat(document.getElementById('set-max-trade')?.value)||0,
    dailyTarget: parseFloat(document.getElementById('set-daily-target')?.value)||0,
  };
  saveSettingsData(data); showToast('Risk rules saved ✅','success');
}

// ─────────────────────────────────────────────
// DATA MANAGEMENT
// ─────────────────────────────────────────────
function exportData() {
  const trades=getTrades();
  const blob=new Blob([JSON.stringify(trades,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`pocketpro_${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url); showToast('Exported as JSON!','success');
}
function exportCSV() {
  const trades=getTrades(); if(!trades.length){showToast('No trades to export.','info');return;}
  const headers=['#','Asset','Direction','Amount','Payout%','Profit','Result','Duration','DateTime','Notes'];
  const rows=trades.map((t,i)=>[i+1,t.asset,t.direction.toUpperCase(),t.amount,t.payout,t.profit,t.result.toUpperCase(),t.duration,t.datetime,(t.notes||'').replace(/,/g,';')]);
  const csv=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`pocketpro_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url); showToast('Exported as CSV!','success');
}
function importData() { document.getElementById('import-file')?.click(); }
function handleImport(event) {
  const file=event.target.files[0]; if (!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const imported=JSON.parse(e.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      if (!confirm(`Import ${imported.length} trades? (Merges with existing)`)) return;
      const existing=getTrades(); const existingIds=new Set(existing.map(t=>t.id));
      const newT=imported.filter(t=>!existingIds.has(t.id));
      saveTrades([...existing,...newT]); showToast(`Imported ${newT.length} trades!`,'success');
    } catch {showToast('Invalid file format.','error');}
  };
  reader.readAsText(file); event.target.value='';
}
function confirmClearData() {
  if (!confirm('⚠️ Delete ALL trade data permanently?')) return;
  if (!confirm('Final confirmation: Delete everything?')) return;
  localStorage.removeItem(STORAGE_KEY); showToast('All data cleared.','info');
}

// ─────────────────────────────────────────────
// CHART OPTIONS
// ─────────────────────────────────────────────
function chartOptions() {
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false},
      tooltip:{ backgroundColor:'#12162A', borderColor:'#1E2340', borderWidth:1,
        titleColor:'#fff', bodyColor:'#9CA3AF', padding:10,
        callbacks:{ label:ctx=>` ${fmt(ctx.raw)}` }
      }
    },
    scales:{
      x:{ grid:{color:'rgba(30,35,64,.6)'}, ticks:{color:'#6B7280',font:{size:11}} },
      y:{ grid:{color:'rgba(30,35,64,.6)'}, ticks:{color:'#6B7280',font:{size:11},callback:v=>fmt(v)} }
    },
    interaction:{intersect:false,mode:'index'},
  };
}

// ─────────────────────────────────────────────
// GLOBAL EVENT LISTENERS
// ─────────────────────────────────────────────
document.addEventListener('click', e => {
  const modal=document.getElementById('trade-modal');
  if (modal && !modal.classList.contains('hidden') && e.target===modal) closeModal();
});
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });
