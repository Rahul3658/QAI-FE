import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const Universities = () => {
    const [universities, setUniversities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingUniversity, setEditingUniversity] = useState(null);
    const [formData, setFormData] = useState({
        university_name: '',
        location: ''
    });
    const { showToast } = useToast();

    useEffect(() => {
        fetchUniversities();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchUniversities = async () => {
        try {
            setLoading(true);
            const { data } = await API.get('/public/universities');
            setUniversities(data.universities || []);
        } catch (err) {
            console.error('Failed to fetch universities:', err);
            showToast('Failed to load universities', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleAddUniversity = async (e) => {
        e.preventDefault();
        try {
            await API.post('/universities', formData);
            showToast('University added successfully', 'success');
            setShowAddModal(false);
            setFormData({ university_name: '', location: '' });
            fetchUniversities();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add university', 'error');
        }
    };

    const handleEditUniversity = async (e) => {
        e.preventDefault();
        try {
            await API.put(`/universities/${editingUniversity.university_id}`, formData);
            showToast('University updated successfully', 'success');
            setShowEditModal(false);
            setEditingUniversity(null);
            setFormData({ university_name: '', location: '' });
            fetchUniversities();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to update university', 'error');
        }
    };

    const handleDeleteUniversity = async (universityId, universityName) => {
        if (!window.confirm(`Are you sure you want to delete "${universityName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await API.delete(`/universities/${universityId}`);
            showToast('University deleted successfully', 'success');
            fetchUniversities();
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to delete university', 'error');
        }
    };

    const openEditModal = (university) => {
        setEditingUniversity(university);
        setFormData({
            university_name: university.university_name,
            location: university.location || ''
        });
        setShowEditModal(true);
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
                    <h1 className="dashboard-title">🎓 Universities Management</h1>
                    <p className="dashboard-subtitle" style={{ color: 'white' }}>Manage all universities in the system</p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowAddModal(true)}
                >
                    ➕ Add University
                </button>
            </div>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Universities</div>
                    <div className="stat-value">{universities.length}</div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">All Universities</h2>
                </div>
                {universities.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">🎓</div>
                        <p>No universities found</p>
                    </div>
                ) : (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>University Name</th>
                                <th>Location</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {universities.map(university => (
                                <tr key={university.university_id}>
                                    <td><strong>{university.university_name}</strong></td>
                                    <td>{university.location || 'N/A'}</td>
                                    <td>
                                        <div className="btn-group">
                                            <button
                                                className="btn btn-primary btn-sm"
                                                onClick={() => openEditModal(university)}
                                            >
                                                ✏️ Edit
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleDeleteUniversity(university.university_id, university.university_name)}
                                            >
                                                🗑️ Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Add University Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>➕ Add New University</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddUniversity}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">University Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.university_name}
                                        onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                                        required
                                        placeholder="e.g., Mumbai University"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="e.g., Mumbai, Maharashtra"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add University
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit University Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>✏️ Edit University</h3>
                            <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleEditUniversity}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">University Name *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.university_name}
                                        onChange={(e) => setFormData({ ...formData, university_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Location</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Update University
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Universities;
