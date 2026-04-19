import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Search, Loader2, User, Briefcase, FileText, Bot, LogOut, CheckCircle2, Filter, ChevronDown, ChevronUp, UploadCloud, XCircle, CheckCircle, Trash2, Star, ClipboardList, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

import Login from './components/auth/Login';
import ShortlistView from './components/dashboard/Shortlist';

function App() {
  const [token, setToken] = useState(localStorage.getItem('hr_token'));

  const [currentView, setCurrentView] = useState('search');

  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const fileInputRef = useRef(null);

  const [shortlist, setShortlist] = useState(() => {
    const saved = localStorage.getItem('hr_shortlist');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [newlyAddedIds, setNewlyAddedIds] = useState([]);

  useEffect(() => {
    localStorage.setItem('hr_shortlist', JSON.stringify(shortlist));
  }, [shortlist]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('hr_token');
    setResults(null);
    setQuery('');
  };

  const handleToggleShortlist = (candidate) => {
    setShortlist(prev => {
      const exists = prev.find(c => c.id === candidate.id);
      if (exists) return prev.filter(c => c.id !== candidate.id);
      return [...prev, candidate];
    });
  };

  const handleDelete = async (candidateId) => {
    if (!window.confirm("Bu adayı kalıcı olarak silmek istediğinize emin misiniz?")) return;
    
    try {
      await axios.delete(`${API_BASE}/api/delete-cv/${candidateId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (results) {
        setResults({
          ...results,
          results: results.results.filter(c => c.id !== candidateId)
        });
      }
      setShortlist(prev => prev.filter(c => c.id !== candidateId));
    } catch (err) {
      alert("Silinirken hata oluştu.");
    }
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const formData = new FormData();
    let validFilesCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].name.toLowerCase().endsWith('.docx')) {
        formData.append('files', files[i]);
        validFilesCount++;
      }
    }

    if (validFilesCount === 0) {
      setUploadStatus({ type: 'error', msg: 'Sadece .docx dosyaları seçmelisiniz.' });
      return;
    }

    setIsUploading(true);
    setUploadStatus(null);

    try {
      const response = await axios.post(`${API_BASE}/api/upload-cv`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}` 
        }
      });
      setUploadStatus({ type: 'success', msg: response.data.message });
      
      if (response.data.uploaded) {
        const newIds = response.data.uploaded.map(c => c.id);
        setNewlyAddedIds(prev => [...prev, ...newIds]);
        
        setResults(prev => {
          if (!prev) return { search_query: "Sisteme Yeni Eklenen Adaylar", min_years: 0, results: response.data.uploaded };
          
          const existingIds = new Set(prev.results.map(c => c.id));
          const toAdd = response.data.uploaded.filter(c => !existingIds.has(c.id));
          return { ...prev, results: [...toAdd, ...prev.results] };
        });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setUploadStatus({ type: 'error', msg: err.response?.data?.detail || 'Dosyalar yüklenirken bir hata oluştu.' });
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadStatus(null), 5000);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setSearchError('');
    setIsSearching(true);
    
    try {
      const response = await axios.post(`${API_BASE}/api/search`, 
      { query, top_k: 6 },
      {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setSearchError('An error occurred while searching. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  if (!token) {
    return <Login setToken={setToken} />;
  }

  return (
    <div className="app-container">
      <header className="header" style={{ marginBottom: '2.5rem' }}>
        <h1>
          <div 
            className="blue-neon"
            style={{
              background: 'linear-gradient(135deg, #00f2ff, #008ba3)',
              color: '#0b0612',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Bot size={28} />
          </div>
          AI Talent Matcher
          <span style={{ fontSize: '1rem', fontWeight: 'normal', color: 'var(--text-muted)', marginLeft: '1rem', paddingLeft: '1rem', borderLeft: '1px solid var(--border)' }}>
            Hoş geldin, <strong style={{color: 'var(--text-main)'}}>{token === 'guest' ? 'Misafir' : 'CEO'}</strong>
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {currentView === 'search' ? (
            <button 
              onClick={() => setCurrentView('shortlist')} 
              className="btn-primary" 
              style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', width: 'auto' }}
            >
              <ClipboardList size={18} /> Talent Pipeline ({shortlist.length})
            </button>
          ) : (
             <button 
                onClick={() => setCurrentView('search')} 
                className="btn-primary" 
                style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', width: 'auto' }}
             >
                Arama Portalı
             </button>
          )}
          <button onClick={handleLogout} className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', width: 'auto' }}>
            <LogOut size={16} /> Çıkış
          </button>
        </div>
      </header>

      <main>
        {currentView === 'shortlist' ? (
          <ShortlistView 
            shortlist={shortlist} 
            setShortlist={setShortlist} 
            goBack={() => setCurrentView('search')} 
            isGuest={token === 'guest'}
          />
        ) : (
          <>
        {token !== 'guest' && (
        <div 
          className="upload-zone"
          onClick={() => !isUploading && fileInputRef.current && fileInputRef.current.click()}
        >
          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="loader" style={{ width: 40, height: 40, borderTopColor: 'var(--primary)' }} />
              <h3 style={{ marginTop: '1rem' }}>Yapay Zeka Analiz Ediyor...</h3>
              <p>CV okunuyor, yetenekler çıkarılıyor ve Pinecone'a kaydediliyor.</p>
            </div>
          ) : (
            <>
              <UploadCloud size={48} color="var(--primary)" />
              <h3>Yeni Aday Ekle</h3>
              <p>Sisteme yeni bir CV (.docx) yüklemek için tıklayın veya sürükleyin.</p>
            </>
          )}
          
          <input 
            type="file" 
            accept=".docx" 
            multiple
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            disabled={isUploading}
          />
        </div>
        )}

        {uploadStatus && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            style={{ marginBottom: '2rem' }}
          >
            <div className="upload-status" style={{ 
              border: `1px solid ${uploadStatus.type === 'success' ? '#4caf50' : 'var(--error)'}`,
              color: uploadStatus.type === 'success' ? '#4caf50' : 'var(--error)',
              background: uploadStatus.type === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 117, 143, 0.1)'
            }}>
              {uploadStatus.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
              {uploadStatus.msg}
            </div>
          </motion.div>
        )}

        <motion.div 
          className="search-container glass" 
          style={{ padding: '2rem' }}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <h2 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Aday Arama Portalı</h2>
            <p style={{ color: 'var(--text-muted)' }}>Aradığınız adayın özelliklerini doğal dilde yazabilir veya aşağıdaki filtreleri kullanabilirsiniz.</p>
          </div>
          
            {token === 'guest' && (
              <div style={{ background: 'rgba(255, 117, 143, 0.1)', color: 'var(--error)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(255, 117, 143, 0.2)', marginBottom: '2rem', textAlign: 'center' }}>
                Misafir modunda yeni veri ekleme (Upload) ve kalıcı olarak veri silme işlemleri devre dışıdır. API Arama özelliklerini test etmektesiniz.
              </div>
            )}

          <form onSubmit={handleSearch} className="search-box">
            <input 
              type="text" 
              placeholder='Örn: "Python bilen ve 5+ yıl deneyimli backend uzmanı bul..."' 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn-primary" disabled={isSearching || !query.trim()}>
              {isSearching ? <div className="loader" /> : <><Search size={20} /> Ara</>}
            </button>
          </form>
          
          <div style={{ marginTop: '1rem', background: 'var(--bg-surface-hover)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div 
              style={{ padding: '0.8rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowFilters(!showFilters)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.95rem' }}>
                <Filter size={18} color="var(--primary)" />
                Hızlı Yetkinlik Filtreleri
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </div>
            
            <AnimatePresence>
              {showFilters && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['Python', 'React', 'Node.js', 'FastAPI', '10+ Yıl Deneyim', 'Yapay Zeka', 'Machine Learning', 'Java', 'Takım Lideri', 'Analitik Düşünce'].map(keyword => (
                      <button 
                        key={keyword}
                        type="button"
                        className="skill-tag"
                        style={{ cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '0.4rem 0.8rem', transition: 'all 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                        onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                        onClick={() => setQuery(prev => prev ? `${prev} ${keyword}` : keyword)}
                      >
                        + {keyword}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {searchError && <div className="error-msg" style={{ marginTop: '1rem' }}>{searchError}</div>}
        </motion.div>

        {results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stats-bar">
              <div className="stat-item">
                <CheckCircle2 size={18} color="var(--primary)" />
                Parsed intent: <span>"{results.search_query}"</span>
              </div>
              {(results.min_years > 0 || results.max_years) && (
                <div className="stat-item">
                  <Briefcase size={18} color="var(--primary)" />
                  Experience filter: <span>{results.min_years}+ years</span>
                </div>
              )}
            </div>

            <div className="results-header">
              <h3>Top Matching Candidates</h3>
              <span>{results.results.length} results</span>
            </div>

            <div className="results-grid">
              <AnimatePresence>
                {results.results.map((candidate, idx) => (
                  <CandidateCard 
                    key={candidate.id} 
                    candidate={candidate} 
                    idx={idx} 
                    onDelete={handleDelete}
                    onToggleShortlist={handleToggleShortlist}
                    isShortlisted={shortlist.some(c => c.id === candidate.id)}
                    isGuest={token === 'guest'}
                    isNew={newlyAddedIds.includes(candidate.id)}
                  />
                ))}
              </AnimatePresence>
              
              {results.results.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  <User size={48} opacity={0.2} style={{ marginBottom: '1rem' }} />
                  <p>No candidates found matching your specific criteria.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
        </>
        )}
      </main>
    </div>
  );
}

function CandidateCard({ candidate, idx, onDelete, onToggleShortlist, isShortlisted, isGuest, isNew }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div 
      className="candidate-card glass"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.1 }}
    >
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.2rem' }}
      >
        <div className="card-header">
          <div>
            <div className="candidate-name" style={{ display: 'flex', alignItems: 'center' }}>
              {candidate.filename.replace(/\.[^/.]+$/, "")}
              {isNew && (
                <span style={{ marginLeft: '10px', background: 'var(--blue-primary)', color: '#1a0b2e', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 10px rgba(0, 242, 255, 0.4)' }}>
                  <Sparkles size={10} /> YENİ EKLENDİ
                </span>
              )}
            </div>
            <div className="candidate-exp">
              <Briefcase size={14} /> {candidate.experience_years} Years Experience
            </div>
          </div>
          <div className="score-badge">{candidate.score}% Match</div>
        </div>
        
        <div className="skills-container">
          {candidate.top_skills.slice(0, 6).map((skill, i) => (
            <span key={i} className="skill-tag">{skill}</span>
          ))}
          {candidate.top_skills.length > 6 && (
            <span className="skill-tag" style={{ background: 'transparent', border: 'none' }}>+{candidate.top_skills.length - 6} more</span>
          )}
        </div>
        
        <div 
          className="candidate-summary" 
          style={expanded ? { display: 'block', WebkitLineClamp: 'unset', overflow: 'visible', whiteSpace: 'pre-wrap' } : {}}
        >
          {candidate.summary}
        </div>
        
        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', textAlign: 'center', opacity: 0.8 }}>
          {expanded ? "Daha Az Göster" : "Genişlet"}
        </div>
      </div>

      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button 
          className={`action-btn ${isShortlisted ? 'active' : ''}`}
          onClick={() => onToggleShortlist(candidate)}
          title={isShortlisted ? "Havuzdan Çıkar" : "Havuzda Değerlendir"}
        >
          <Star size={18} fill={isShortlisted ? "currentColor" : "none"} />
        </button>
        {!isGuest && (
          <button 
            className="action-btn delete"
            onClick={() => onDelete(candidate.id)}
            title="Adayı Kalıcı Olarak Sil"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default App;
