import axios from 'axios';

// The Vite dev server will proxy '/api' to 'http://127.0.0.1:5000'
const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export const fetchKpis = async (year) => {
  const params = year ? { year } : {};
  const res = await api.get('/kpis', { params });
  return res.data;
};

export const fetchDumpFiles = async () => {
  const res = await api.get('/dump-files');
  return res.data;
};

export const fetchTrends = async (grain = 'yearly', dataset = 'aoc') => {
  const res = await api.get('/trends', { params: { grain, dataset } });
  return res.data;
};

export const fetchTopOrgs = async (by = 'count', limit = 15, dataset = 'aoc') => {
  const res = await api.get('/top-orgs', { params: { by, limit, dataset } });
  return res.data;
};

export const fetchTenderTypes = async () => {
  const res = await api.get('/tender-types');
  return res.data;
};

export const fetchValueDistribution = async () => {
  const res = await api.get('/value-distribution');
  return res.data;
};

export const fetchPortalBreakdown = async () => {
  const res = await api.get('/portal-breakdown');
  return res.data;
};

export const fetchSectorDistribution = async () => {
  const res = await api.get('/sector-distribution');
  return res.data;
};

export const searchDatabase = async (q, page = 1) => {
  const res = await api.get('/search', { params: { q, page } });
  return res.data;
};

export const aiChat = async (text, model = 'gemini-3.5-flash') => {
  const res = await api.post('/ai-chat', { text, model });
  return res.data;
};

export const streamAiChat = async (text, model, onChunk, onError, onDone) => {
  try {
    const response = await fetch('/api/ai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model })
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to communicate with AI engine');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onChunk(chunk);
    }
    if (onDone) onDone();
  } catch (err) {
    if (onError) onError(err);
  }
};


export const fetchStatus = async () => {
  const res = await api.get('/status');
  return res.data;
};

export const fetchNarrativeReport = async () => {
  const res = await api.get('/narrative-report');
  return res.data;
};

export const fetchStateStats = async () => {
  const res = await api.get('/state-stats');
  return res.data;
};

export const fetchSingleBidContracts = async (min_val = 1000000, page = 1) => {
  const res = await api.get('/single-bid-contracts', { params: { min_val, page } });
  return res.data;
};

export const fetchRepeatWinners = async (min_wins = 3, page = 1) => {
  const res = await api.get('/repeat-winners', { params: { min_wins, page } });
  return res.data;
};

export const searchNetwork = async (q) => {
  const res = await api.get('/network/search', { params: { q } });
  return res.data;
};

export const fetchNetworkEgo = async (nodeId) => {
  const res = await api.get(`/network/ego/${encodeURIComponent(nodeId)}`);
  return res.data;
};

export const fetchVendorMca = async (label) => {
  const res = await api.get(`/vendor-mca/${encodeURIComponent(label)}`);
  return res.data;
};

export default api;
