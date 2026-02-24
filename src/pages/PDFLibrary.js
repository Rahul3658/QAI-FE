import { useState, useEffect } from 'react';
import API from '../api/axios';
import './PDFLibrary.css';

const PDFLibrary = () => {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    file: null,
    subject: '',
    topic: '',
    description: ''
  });

  useEffect(() => {
    fetchPDFs();
  }, []);

  const fetchPDFs = async () => {
    try {
      const { data } = await API.get('/pdfs');
      setPdfs(data.pdfs || []);
    } catch (error) {
      console.error('Error fetching PDFs:', error);
      setMessage({ type: 'error', text: 'Failed to load PDFs' });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setUploadData({ ...uploadData, file });
    } else {
      setMessage({ type: 'error', text: 'Please select a PDF file' });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadData.file) {
      setMessage({ type: 'error', text: 'Please select a PDF file' });
      return;
    }

    setUploading(true);
    setShowUploadModal(false);
    setShowProcessingModal(true);
    setMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('pdf', uploadData.file);
    formData.append('subject', uploadData.subject);
    formData.append('topic', uploadData.topic);
    formData.append('description', uploadData.description);

    try {
      // Stage 1: Uploading
      setProcessingStage('Uploading PDF...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Stage 2: Extracting
      setProcessingStage('Extracting text from PDF...');
      
      const { data } = await API.post('/pdfs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Stage 3: Processing
      setProcessingStage('Processing extracted data...');
      await new Promise(resolve => setTimeout(resolve, 800));

      // Stage 4: Finalizing
      setProcessingStage('Finalizing...');
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowProcessingModal(false);

      if (data.isDuplicate) {
        setMessage({ type: 'warning', text: 'This PDF has already been uploaded' });
      } else {
        setMessage({ type: 'success', text: 'PDF uploaded and processed successfully!' });
      }

      setUploadData({ file: null, subject: '', topic: '', description: '' });
      fetchPDFs();
    } catch (error) {
      setShowProcessingModal(false);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to upload PDF' 
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (pdfId) => {
    if (!window.confirm('Are you sure you want to delete this PDF? This will also delete all associated chunks.')) {
      return;
    }

    try {
      await API.delete(`/pdfs/${pdfId}`);
      setMessage({ type: 'success', text: 'PDF deleted successfully' });
      fetchPDFs();
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Failed to delete PDF' 
      });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">📚 PDF Library</h1>
          <p className="dashboard-subtitle">Upload and manage PDFs for question generation</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
        >
          📤 Upload PDF
        </button>
      </div>

      {message.text && (
        <div className={`message ${message.type === 'success' ? 'message-success' : message.type === 'warning' ? 'message-warning' : 'message-error'}`}>
          {message.text}
        </div>
      )}

      {pdfs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3>No PDFs uploaded yet</h3>
          <p>Upload your first PDF to start generating questions from documents</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
          >
            Upload PDF
          </button>
        </div>
      ) : (
        <div className="pdf-grid">
          {pdfs.map(pdf => (
            <div key={pdf.pdf_id} className="pdf-card">
              <div className="pdf-card-header">
                <div className="pdf-icon">📄</div>
                <div className={`pdf-status ${pdf.status}`}>
                  {pdf.status === 'ready' ? '✓' : pdf.status === 'processing' ? '⏳' : '✗'}
                </div>
              </div>
              
              <div className="pdf-card-body">
                <h3 className="pdf-title">{pdf.file_name}</h3>
                
                {pdf.subject && (
                  <div className="pdf-meta">
                    <span className="pdf-meta-label">Subject:</span>
                    <span className="pdf-meta-value">{pdf.subject}</span>
                  </div>
                )}
                
                {pdf.topic && (
                  <div className="pdf-meta">
                    <span className="pdf-meta-label">Topic:</span>
                    <span className="pdf-meta-value">{pdf.topic}</span>
                  </div>
                )}
                
                <div className="pdf-stats">
                  <div className="pdf-stat">
                    <span className="pdf-stat-icon">📄</span>
                    <span>{pdf.pages} pages</span>
                  </div>
                  <div className="pdf-stat">
                    <span className="pdf-stat-icon">📦</span>
                    <span>{pdf.chunks_stored} chunks</span>
                  </div>
                  <div className="pdf-stat">
                    <span className="pdf-stat-icon">💾</span>
                    <span>{formatFileSize(pdf.file_size)}</span>
                  </div>
                </div>
                
                <div className="pdf-footer">
                  <small>Uploaded by {pdf.uploaded_by_name}</small>
                  <small>{formatDate(pdf.uploaded_at)}</small>
                </div>
              </div>
              
              <div className="pdf-card-actions">
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={() => window.location.href = `/faculty?generateFromPdf=${pdf.pdf_id}`}
                  disabled={pdf.status !== 'ready'}
                >
                  Generate Questions
                </button>
                <button 
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDelete(pdf.pdf_id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Upload PDF</h2>
              <button 
                className="modal-close"
                onClick={() => setShowUploadModal(false)}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleUpload}>
              <div className="form-group">
                <label className="form-label">PDF File *</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="form-input"
                  required
                />
                {uploadData.file && (
                  <small className="form-hint">
                    Selected: {uploadData.file.name} ({formatFileSize(uploadData.file.size)})
                  </small>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Subject</label>
                <input
                  type="text"
                  value={uploadData.subject}
                  onChange={(e) => setUploadData({ ...uploadData, subject: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Mathematics, Physics"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Topic</label>
                <input
                  type="text"
                  value={uploadData.topic}
                  onChange={(e) => setUploadData({ ...uploadData, topic: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Calculus, Quantum Mechanics"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  className="form-textarea"
                  rows="3"
                  placeholder="Brief description of the PDF content"
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !uploadData.file}
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Processing Modal */}
      {showProcessingModal && (
        <div className="modal-overlay" style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0, 0, 0, 0.7)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 1000 
        }}>
          <div className="modal-content" style={{ 
            background: 'var(--bg-primary)', 
            padding: '2rem', 
            borderRadius: '1rem', 
            maxWidth: '500px', 
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)'
          }}>
            {/* Animated Spinner */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="spinner" style={{
                width: '60px',
                height: '60px',
                border: '4px solid var(--border-color)',
                borderTop: '4px solid var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }}></div>
            </div>

            {/* Processing Stage */}
            <h3 style={{ 
              color: 'var(--text-primary)', 
              marginBottom: '1rem',
              fontSize: '1.25rem'
            }}>
              🤖 Processing PDF
            </h3>
            
            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '1rem',
              marginBottom: '1.5rem'
            }}>
              {processingStage}
            </p>

            {/* Progress Steps */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '0.5rem',
              marginTop: '1rem'
            }}>
              {['📤', '📄', '⚙️', '✅'].map((emoji, index) => (
                <div key={index} style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: index <= ['Uploading', 'Extracting', 'Processing', 'Finalizing'].indexOf(processingStage.split(' ')[0]) 
                    ? 'var(--primary)' 
                    : 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.25rem',
                  transition: 'all 0.3s ease'
                }}>
                  {emoji}
                </div>
              ))}
            </div>

            <p style={{ 
              color: 'var(--text-secondary)', 
              fontSize: '0.875rem',
              marginTop: '1.5rem',
              fontStyle: 'italic'
            }}>
              Please wait while we extract and process your PDF...
            </p>
          </div>
        </div>
      )}

      {/* Add spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PDFLibrary;
