(function(){
  // Tausche s1.ripple.com gegen xrplcluster.com aus (oft toleranter bei CORS)
  const XRPL_RPC_URL = "https://xrplcluster.com";
  const STELLAR_HORIZON_URL = "https://horizon.stellar.org";

  function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
  async function postJson(url, payload){
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  function extractLedgerInfo(resp){
    const r = resp?.result ?? resp;
    const ledger = r?.ledger ?? r?.ledger_data ?? {};
    const idx = ledger?.ledger_index ?? r?.ledger_index ?? 0;
    const time = ledger?.close_time ?? r?.close_time ?? Math.floor(Date.now()/1000);
    return { idx, time };
  }
  async function fetchLedgerIndexAndTime(){
    const resp = await postJson(XRPL_RPC_URL, { method: 'ledger', params: [{ ledger_index: 'validated', transactions: false }] });
    return extractLedgerInfo(resp);
  }
  async function estimateTPS(){
    try {
      const a = await fetchLedgerIndexAndTime();
      await sleep(1200);
      const b = await fetchLedgerIndexAndTime();
      const deltaIdx = (b.idx - a.idx) || 0;
      const deltaTime = (b.time - a.time) || 1;
      return deltaIdx / deltaTime;
    } catch(_){
      return null;
    }
  }
  async function fetchFees(){
    try {
      const resp = await postJson(XRPL_RPC_URL, { method: 'fee', params: [] });
      const data = resp?.result ?? resp;
      let minFeeDrops = data?.minimum_fee;
      if (minFeeDrops == null) minFeeDrops = data?.drops?.minimum_fee ?? data?.base_fee ?? 0;
      const feeXrp = (typeof minFeeDrops === 'number') ? minFeeDrops / 1000000 : 0;
      return { feeDrops: minFeeDrops ?? 0, feeXrp };
    } catch(_){
      return { feeDrops: 0, feeXrp: 0 };
    }
  }
  async function fetchVolume(coinId){
    try {
      const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
      const res = await fetch(url);
      const data = await res.json();
      return data?.market_data?.total_volume?.usd ?? null;
    } catch(_){ return null; }
  }
  async function fetchStellarTPS(){
    try {
      const res = await fetch(`${STELLAR_HORIZON_URL}/fee_stats`);
      const data = await res.json();
      // Horizon doesn't directly give TPS in fee_stats, but we can estimate or use ledger data.
      // For simplicity and reliability in this tracker, we'll focus on fees and volume for XLM, 
      // or fetch the latest ledger.
      return null; 
    } catch(_) { return null; }
  }

  async function fetchStellarFees(){
    try {
      const res = await fetch(`${STELLAR_HORIZON_URL}/fee_stats`);
      const data = await res.json();
      const avgFeeXlm = data?.fee_charged?.p50 ? data.fee_charged.p50 / 10000000 : 0;
      return { feeXlm: avgFeeXlm };
    } catch(_) { return { feeXlm: 0 }; }
  }

  async function updateTracker(){
    if (document.getElementById('utility-tracker').style.display === 'none') return;

    const xrpTPS = await estimateTPS();
    const xrpFees = await fetchFees();
    const xrpVolume = await fetchVolume('ripple');

    const xlmFees = await fetchStellarFees();
    const xlmVolume = await fetchVolume('stellar');

    document.getElementById('xrp-tps').textContent = (xrpTPS != null) ? xrpTPS.toFixed(2) : 'n/a';
    document.getElementById('xrp-fee').textContent = (typeof xrpFees.feeXrp === 'number') ? xrpFees.feeXrp.toFixed(6) : 'n/a';
    document.getElementById('xrp-volume').textContent = (xrpVolume != null) ? `$${Number(xrpVolume).toLocaleString()}` : 'n/a';

    document.getElementById('xlm-tps').textContent = 'n/a';
    document.getElementById('xlm-fee').textContent = (typeof xlmFees.feeXlm === 'number') ? xlmFees.feeXlm.toFixed(6) : 'n/a';
    document.getElementById('xlm-volume').textContent = (xlmVolume != null) ? `$${Number(xlmVolume).toLocaleString()}` : 'n/a';
  }
  window.addEventListener('load', () => {
    if (!document.getElementById('utility-tracker')) return;
    // Don't auto-start on load if it's hidden behind login
    setInterval(() => {
        if (document.getElementById('utility-tracker').style.display !== 'none') {
            updateTracker();
        }
    }, 60000);
  });
  window.UtilityTracker = { updateTracker };
})();
