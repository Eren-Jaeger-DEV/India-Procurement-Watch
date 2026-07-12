import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Scale, AlertTriangle, Building2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import './Compare.css';

const API_BASE_URL = 'https://api.ipw.satviks.dev/api';

export default function Compare() {
  const { t } = useTranslation();
  const [orgList, setOrgList] = useState([]);
  
  // Selected Organizations
  const [org1, setOrg1] = useState(null);
  const [org2, setOrg2] = useState(null);
  
  // Search Text
  const [search1, setSearch1] = useState('');
  const [search2, setSearch2] = useState('');
  const [dropdown1Open, setDropdown1Open] = useState(false);
  const [dropdown2Open, setDropdown2Open] = useState(false);

  // Data
  const [compareData, setCompareData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch Organization List
    axios.get(`${API_BASE_URL}/org-list`)
      .then(res => setOrgList(res.data))
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (org1 && org2) {
      setLoading(true);
      axios.get(`${API_BASE_URL}/org-compare?org1=${encodeURIComponent(org1)}&org2=${encodeURIComponent(org2)}`)
        .then(res => {
          setCompareData(res.data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [org1, org2]);

  const filteredOrgs1 = orgList.filter(o => o.toLowerCase().includes(search1.toLowerCase()));
  const filteredOrgs2 = orgList.filter(o => o.toLowerCase().includes(search2.toLowerCase()));

  // Prepare Radar Chart Data
  const getRadarData = () => {
    if (!compareData || !org1 || !org2 || !compareData[org1] || !compareData[org2]) return [];
    
    return [
      {
        subject: 'Single Bid %',
        A: compareData[org1].single_bid_pct,
        B: compareData[org2].single_bid_pct,
        fullMark: 100
      },
      {
        subject: 'Round Number %',
        A: compareData[org1].round_number_pct,
        B: compareData[org2].round_number_pct,
        fullMark: 100
      },
      {
        subject: 'HHI Risk Score',
        A: compareData[org1].hhi_score,
        B: compareData[org2].hhi_score,
        fullMark: 10000
      }
    ];
  };

  const getBarData = () => {
    if (!compareData || !org1 || !org2 || !compareData[org1] || !compareData[org2]) return [];
    
    return [
      {
        name: 'Total Contracts',
        [org1]: compareData[org1].total_contracts,
        [org2]: compareData[org2].total_contracts
      }
    ];
  };

  const radarData = getRadarData();
  const barData = getBarData();

  return (
    <div className="compare-page">
      <div className="compare-header">
        <div className="header-icon">
          <Scale size={24} />
        </div>
        <div>
          <h2>Compare Organizations</h2>
          <p>Analyze risk profiles side-by-side to highlight discrepancies.</p>
        </div>
      </div>

      <div className="compare-selectors">
        
        {/* Selector 1 */}
        <div className="selector-box box-a">
          <h3>Entity A</h3>
          <div className="custom-select">
            <div className="select-input-container">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search Organization..." 
                value={search1}
                onChange={e => {
                  setSearch1(e.target.value);
                  setDropdown1Open(true);
                }}
                onFocus={() => setDropdown1Open(true)}
              />
              {org1 && (
                <button className="clear-btn" onClick={() => { setOrg1(null); setSearch1(''); }}>
                  <X size={16} />
                </button>
              )}
            </div>
            {dropdown1Open && (
              <ul className="dropdown-list">
                {filteredOrgs1.slice(0, 100).map(o => (
                  <li 
                    key={o} 
                    onClick={() => {
                      setOrg1(o);
                      setSearch1(o);
                      setDropdown1Open(false);
                    }}
                  >
                    {o}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="vs-badge">VS</div>

        {/* Selector 2 */}
        <div className="selector-box box-b">
          <h3>Entity B</h3>
          <div className="custom-select">
            <div className="select-input-container">
              <Search size={16} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search Organization..." 
                value={search2}
                onChange={e => {
                  setSearch2(e.target.value);
                  setDropdown2Open(true);
                }}
                onFocus={() => setDropdown2Open(true)}
              />
              {org2 && (
                <button className="clear-btn" onClick={() => { setOrg2(null); setSearch2(''); }}>
                  <X size={16} />
                </button>
              )}
            </div>
            {dropdown2Open && (
              <ul className="dropdown-list">
                {filteredOrgs2.slice(0, 100).map(o => (
                  <li 
                    key={o} 
                    onClick={() => {
                      setOrg2(o);
                      setSearch2(o);
                      setDropdown2Open(false);
                    }}
                  >
                    {o}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </div>

      {loading && <div className="loading-spinner">Loading comparison data...</div>}

      {!loading && org1 && org2 && compareData && compareData[org1] && compareData[org2] && (
        <div className="compare-dashboard">
          
          <div className="metrics-row">
            <div className="card metric-card">
              <h4>Total Value</h4>
              <div className="split-metric">
                <div className="split-a">
                  <span className="val">₹{Number(compareData[org1].total_value_crore).toLocaleString()} Cr</span>
                  <span className="lbl">{org1}</span>
                </div>
                <div className="divider"></div>
                <div className="split-b">
                  <span className="val">₹{Number(compareData[org2].total_value_crore).toLocaleString()} Cr</span>
                  <span className="lbl">{org2}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="charts-row">
            
            <div className="card chart-card">
              <h4>Risk Profile Comparison (Radar)</h4>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={30} domain={[0, 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <Legend />
                    <Radar name={org1} dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Radar name={org2} dataKey="B" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card">
              <h4>Total Contracts Awarded</h4>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer>
                  <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" />
                    <YAxis stroke="var(--text-secondary)" />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                    <Legend />
                    <Bar dataKey={org1} fill="#3b82f6" />
                    <Bar dataKey={org2} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Background click to close dropdowns */}
      {(dropdown1Open || dropdown2Open) && (
        <div 
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }}
          onClick={() => {
            setDropdown1Open(false);
            setDropdown2Open(false);
          }}
        />
      )}

    </div>
  );
}
