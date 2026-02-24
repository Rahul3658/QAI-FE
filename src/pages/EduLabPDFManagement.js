import { useState, useEffect, useCallback } from 'react'; // <-- Added useCallback
import API from '../api/axios';
import './EduLabPDFManagement.css';

const EduLabPDFManagement = () => {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    file: null,
    subject_name: '', // Keep as text input
    class_level: '',
    topic: '',
    description: ''
  });
  
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // 1. Wrap fetchData in useCallback to give it a stable identity
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch EduLab PDFs
      const pdfsRes = await API.get('/subject-pdfs/list');
      setPdfs(pdfsRes.data.pdfs || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      showMessage('error', err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. useEffect will run once on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]); // <-- Now correctly includes the stable fetchData function

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 50 * 1024 * 1024) {
        showMessage('error', 'File size must be less than 50MB');
        e.target.value = '';
        return;
      }
      setUploadForm({ ...uploadForm, file });
    } else {
      showMessage('error', 'Please select a PDF file');
      e.target.value = '';
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.file) {
      showMessage('error', 'Please select a PDF file');
      return;
    }

    if (!uploadForm.subject_name || !uploadForm.subject_name.trim()) {
      showMessage('error', 'Please enter a subject name');
      return;
    }
    
    if (!uploadForm.class_level || uploadForm.class_level.trim() === '') {
      showMessage('error', 'Please select a class/grade level');
      return;
    }

    try {
      setUploading(true);
      
      const formData = new FormData();
      formData.append('pdf', uploadForm.file);
      formData.append('subject_name', uploadForm.subject_name.trim());
      formData.append('class_level', uploadForm.class_level);
      formData.append('topic', uploadForm.topic);
      formData.append('description', uploadForm.description);

      const res = await API.post('/subject-pdfs/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data.isDuplicate) {
        showMessage('warning', 'This PDF already exists for this subject');
      } else {
        showMessage('success', 'PDF uploaded successfully!');
      }
      
      // Reset form
      setUploadForm({
        file: null,
        subject_name: '',
        class_level: '',
        topic: '',
        description: ''
      });
      document.getElementById('pdf-file-input').value = '';
      
      // Refresh list
      fetchData();
      
    } catch (err) {
      console.error('Upload error:', err);
      showMessage('error', err.response?.data?.message || 'Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (pdfId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      await API.delete(`/subject-pdfs/${pdfId}`);
      showMessage('success', 'PDF deleted successfully');
      // Refresh list - fetchData is now safe to call here
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      showMessage('error', err.response?.data?.message || 'Failed to delete PDF');
    }
  };

  const filteredPdfs = pdfs.filter(pdf => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pdf.filename?.toLowerCase().includes(search) ||
      pdf.topic?.toLowerCase().includes(search) ||
      pdf.subject_name?.toLowerCase().includes(search)
    );
  });

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="edulab-pdf-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="edulab-pdf-container">
      <div className="edulab-pdf-header">
        <h1>📚 EduLab PDF Library</h1>
        <p className="subtitle">Manage Maharashtra Board reference materials for all subjects</p>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Upload Section */}
      <div className="upload-section">
        <h2>Upload New PDF</h2>
        <form onSubmit={handleUpload} className="upload-form">
          <div className="form-row">
            <div className="form-group">
              <label>PDF File *</label>
              <input
                id="pdf-file-input"
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                disabled={uploading}
                required
              />
              <small>Max size: 50MB</small>
            </div>

            <div className="form-group">
              <label>Subject Name *</label>
              <input
                type="text"
                value={uploadForm.subject_name}
                onChange={(e) => setUploadForm({ ...uploadForm, subject_name: e.target.value })}
                disabled={uploading}
                placeholder="e.g., Physics, Chemistry, Mathematics"
                required
              />
              <small>Enter the subject name for this PDF</small>
            </div>

            

            <div className="form-group">
              <label>Class/Grade *</label>
              <select
                value={uploadForm.class_level}
                onChange={(e) => setUploadForm({ ...uploadForm, class_level: e.target.value })}
                disabled={uploading}
                required
              >
                <option value="">Select Class</option>
                <option value="Class 5">Class 5</option>
                <option value="Class 6">Class 6</option>
                <option value="Class 7">Class 7</option>
                <option value="Class 8">Class 8</option>
                <option value="Class 9">Class 9</option>
                <option value="Class 10">Class 10</option>
                <option value="Class 11">Class 11</option>
                <option value="Class 12">Class 12</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            {/* The Topic/Chapter input is commented out, keeping it that way */}
            {/* <div className="form-group">
              <label>Topic/Chapter</label>
              <input
                type="text"
                placeholder="e.g., Algebra, Thermodynamics"
                value={uploadForm.topic}
                onChange={(e) => setUploadForm({ ...uploadForm, topic: e.target.value })}
                disabled={uploading}
              />
            </div> */}

            <div className="form-group">
              <label>Description</label>
              <input
                type="text"
                placeholder="Brief description of PDF content"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                disabled={uploading}
              />
            </div>
          </div>

          <button type="submit" className={`btn-upload ${uploading ? 'uploading' : ''}`} disabled={uploading}>
            {uploading ? (
              <>
                <span className="spinner"></span>
                Uploading...
              </>
            ) : (
              '📤 Upload PDF'
            )}
          </button>
        </form>
      </div>

      {/* PDF List Section */}
      <div className="pdf-list-section">
        <div className="list-header">
          <h2>Uploaded PDFs ({filteredPdfs.length})</h2>
          
          <div className="filters">
            <input
              type="text"
              placeholder="🔍 Search by filename, subject, or topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        {filteredPdfs.length === 0 ? (
          <div className="no-pdfs">
            <p>No PDFs found. Upload your first Maharashtra Board reference material!</p>
          </div>
        ) : (
          <div className="pdf-table-container">
            <table className="pdf-table">
              <thead>
                <tr>
                  <th>Filename</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Topic</th>
                  <th>Size</th>
                  <th>Usage</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPdfs.map(pdf => (
                  <tr key={pdf.pdf_id}>
                    <td className="filename-cell">
                      <span className="pdf-icon">📄</span>
                      <div>
                        <div className="filename">{pdf.filename}</div>
                        {pdf.description && (
                          <div className="description">{pdf.description}</div>
                        )}
                      </div>
                    </td>
                    <td>{pdf.subject_name}</td>
                    <td>
                      <span className="class-badge">{pdf.class_level || '-'}</span>
                    </td>
                    <td>{pdf.topic || '-'}</td>
                    <td>{formatFileSize(pdf.file_size)}</td>
                    <td>
                      <span className="usage-badge">{pdf.usage_count} times</span>
                    </td>
                    <td>{formatDate(pdf.upload_date)}</td>
                    <td>
                      <button
                        onClick={() => handleDelete(pdf.pdf_id, pdf.filename)}
                        className="btn-delete"
                        title="Delete PDF"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EduLabPDFManagement;