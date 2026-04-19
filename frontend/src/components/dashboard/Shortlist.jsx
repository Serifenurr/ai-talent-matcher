import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Download, MessageSquare, Tag, LayoutPanelLeft } from 'lucide-react';

export default function ShortlistView({ shortlist, setShortlist, goBack, isGuest }) {
  const [notes, setNotes] = useState(() => {
    const saved = localStorage.getItem('hr_notes');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [statuses, setStatuses] = useState(() => {
    const saved = localStorage.getItem('hr_statuses');
    return saved ? JSON.parse(saved) : {};
  });

  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  React.useEffect(() => {
    localStorage.setItem('hr_notes', JSON.stringify(notes));
  }, [notes]);

  React.useEffect(() => {
    localStorage.setItem('hr_statuses', JSON.stringify(statuses));
  }, [statuses]);

  const handleNoteChange = (id, text) => {
    setNotes(prev => ({ ...prev, [id]: text }));
  };

  const handleStatusChange = (id, status) => {
    setStatuses(prev => ({ ...prev, [id]: status }));
  };

  const handleRemove = (id) => {
    setShortlist(prev => prev.filter(c => c.id !== id));
  };

  const toggleCompare = (id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) {
        alert("Karşılaştırma için en fazla 3 aday seçebilirsiniz.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const statusOptions = ["Değerlendirmede", "Mülakat Planlandı", "Reddedildi", "Teklif Verildi"];

  if (compareMode) {
    const compareCandidates = shortlist.filter(c => selectedForCompare.includes(c.id));
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <h2>Yapay Zeka Aday Karşılaştırması</h2>
          <button className="btn-primary" onClick={() => setCompareMode(false)} style={{ width: 'auto' }}>
            <ArrowLeft size={16} /> Geri Dön
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(2, compareCandidates.length)}, 1fr)`, gap: '2rem' }}>
          {compareCandidates.map(c => (
            <div key={c.id} className="shortlist-card" style={{ background: 'var(--bg-surface)' }}>
              <h3>{c.filename.replace(/\.[^/.]+$/, "")}</h3>
              <p style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{c.experience_years} Yıl Tecrübe</p>
              
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--text-main)' }}>Öne Çıkan Yetenekler:</strong>
                <div className="skills-container" style={{ marginTop: '0.5rem' }}>
                  {c.top_skills.map((s, i) => <span key={i} className="skill-tag">{s}</span>)}
                </div>
              </div>

              <div>
                <strong style={{ color: 'var(--text-main)' }}>Kariyer Özeti:</strong>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>{c.summary}</p>
              </div>
            </div>
          ))}
          {compareCandidates.length === 0 && <p>Lütfen karşılaştırmak için grid üzerinden aday seçin.</p>}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <button onClick={goBack} className="btn-primary" style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', width: 'auto' }}>
          <ArrowLeft size={16} /> Arama Portalı
        </button>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-primary" 
            onClick={() => setCompareMode(true)} 
            disabled={selectedForCompare.length < 2} 
            style={{ 
              width: 'auto', 
              background: selectedForCompare.length < 2 ? 'rgba(0, 242, 255, 0.1)' : 'linear-gradient(135deg, #00f2ff, #008ba3)',
              color: selectedForCompare.length < 2 ? 'rgba(0, 242, 255, 0.4)' : '#1a0b2e',
              border: selectedForCompare.length < 2 ? '1px solid rgba(0, 242, 255, 0.2)' : 'none',
              fontWeight: 'bold',
              boxShadow: selectedForCompare.length < 2 ? 'none' : '0 0 15px rgba(0, 242, 255, 0.3)'
            }}
          >
            <LayoutPanelLeft size={16} /> Kıyasla ({selectedForCompare.length}/3)
          </button>
        </div>
      </div>

      <div className="results-grid">
        {shortlist.map((candidate) => {
          const isSelected = selectedForCompare.includes(candidate.id);
          return (
            <div 
              key={candidate.id} 
              className="candidate-card glass" 
              style={{ 
                border: isSelected ? '2px solid #00f2ff' : '1px solid var(--glass-border)',
                transition: 'all 0.3s ease',
                boxShadow: isSelected ? '0 0 15px rgba(0, 242, 255, 0.2)' : 'none'
              }}
            >
              <div 
                className="card-header" 
                style={{ marginBottom: '1rem', cursor: 'pointer' }}
                onClick={() => toggleCompare(candidate.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '4px',
                    border: '2px solid #00f2ff',
                    background: isSelected ? '#00f2ff' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    boxShadow: isSelected ? '0 0 10px rgba(0, 242, 255, 0.5)' : 'none'
                  }}>
                    {isSelected && <div style={{ width: '10px', height: '10px', background: '#1a0b2e', borderRadius: '2px' }} />}
                  </div>
                  <div>
                    <div className="candidate-name">{candidate.filename.replace(/\.[^/.]+$/, "")}</div>
                    <div className="candidate-exp">{candidate.experience_years} Yıl Tecrübe | %{candidate.score} Eşleşme</div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Tag size={12}/> Süreç Durumu:</div>
                <select 
                  value={statuses[candidate.id] || "Değerlendirmede"}
                  onChange={(e) => handleStatusChange(candidate.id, e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none' }}
                >
                  {statusOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MessageSquare size={12}/> Özel Notlar:</div>
                <textarea 
                  value={notes[candidate.id] || ''}
                  onChange={(e) => handleNoteChange(candidate.id, e.target.value)}
                  placeholder="Bu aday mülakat için ideal..."
                  style={{ width: '100%', minHeight: '80px', padding: '0.5rem', background: 'rgba(0,0,0,0.1)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div className="card-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button 
                  className="action-btn"
                  title="Orijinal .docx Yükle"
                  onClick={() => alert('Bu özellik sistemde cloud storage entegre edildiğinde çalışır.')}
                >
                  <Download size={16} />
                </button>
                {!isGuest && (
                  <button 
                    className="action-btn delete"
                    title="Listeden Çıkar"
                    onClick={() => handleRemove(candidate.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {shortlist.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <p>Listeniz boş. Arama yaparak adayları "Havuz"unuza ekleyin.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
