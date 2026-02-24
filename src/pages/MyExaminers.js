import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const MyExaminers = () => {
    const [loading, setLoading] = useState(true);
    const [examiners, setExaminers] = useState([]);
    const [department, setDepartment] = useState(null);
    const [filter, setFilter] = useState('all'); // all, active, inactive, pending
    const [modalConfig, setModalConfig] = useState({ isOpen: false });
    const navigate = useNavigate();
    const { showToast } = useToast();

    useEffect(() => {
        fetchExaminers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchExaminers = async () => {
        try {
            setLoading(true);

            // Fetch department info
            try {
                const { data: deptData } = await API.get('/departments/my-department');
                setDepartment(deptData.department);
            } catch (err) {
                console.error('Error fetching department:', err);
            }

            // Fetch examiners
            const { data } = await API.get('/users/my-examiners');
            setExaminers(data.examiners || []);
        } catch (error) {
            console.error('Error fetching examiners:', error);
            if (error.response?.status === 403) {
                showToast('Access denied. Only Subject Matter Experts can view this page.', 'error');
                navigate('/');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = (examinerId, currentStatus, examinerName) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        const action = newStatus === 'active' ? 'activate' : 'deactivate';
        
        setModalConfig({
            isOpen: true,
            type: newStatus === 'active' ? 'success' : 'warning',
            title: `${action.charAt(0).toUpperCase() + action.slice(1)} Examiner`,
            message: `Are you sure you want to ${action} ${examinerName}? ${
                newStatus === 'inactive' 
                    ? 'They will not be able to login until reactivated.' 
                    : 'They will be able to login and access the system.'
            }`,
            confirmText: action.charAt(0).toUpperCase() + action.slice(1),
            onConfirm: () => confirmStatusChange(examinerId, newStatus, action)
        });
    };

    const confirmStatusChange = async (examinerId, newStatus, action) => {
        try {
            await API.put(`/users/examiner/${examinerId}/status`, { status: newStatus });
            showToast(`Examiner ${action}d successfully`, 'success');
            fetchExaminers(); // Refresh the list
        } catch (error) {
            console.error('Error updating examiner status:', error);
            showToast(error.response?.data?.message || 'Failed to update examiner status', 'error');
        }
    };

    const filteredExaminers = examiners.filter(examiner => {
        if (filter === 'all') return true;
        return examiner.status === filter;
    });

    const stats = {
        total: examiners.length,
        active: examiners.filter(e => e.status === 'active').length,
        inactive: examiners.filter(e => e.status === 'inactive').length,
        pending: examiners.filter(e => e.status === 'pending').length
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
                    <h1 className="dashboard-title">👨‍🏫 My Examiners</h1>
                    <p className="dashboard-subtitle">
                        {department ? `${department.department_name} Department` : 'Manage your department examiners'}
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div 
                    className={`stat-card ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-label">Total Examiners</div>
                    <div className="stat-value">{stats.total}</div>
                </div>
                <div 
                    className={`stat-card ${filter === 'active' ? 'active' : ''}`}
                    onClick={() => setFilter('active')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-label">Active</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.active}</div>
                </div>
                <div 
                    className={`stat-card ${filter === 'inactive' ? 'active' : ''}`}
                    onClick={() => setFilter('inactive')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-label">Inactive</div>
                    <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.inactive}</div>
                </div>
                <div 
                    className={`stat-card ${filter === 'pending' ? 'active' : ''}`}
                    onClick={() => setFilter('pending')}
                    style={{ cursor: 'pointer' }}
                >
                    <div className="stat-label">Pending</div>
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>{stats.pending}</div>
                </div>
            </div>

            {/* Examiners List */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">
                        {filter === 'all' ? 'All Examiners' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Examiners`}
                    </h2>
                    <span className="badge badge-primary">{filteredExaminers.length} Total</span>
                </div>
                {filteredExaminers.length > 0 ? (
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th>Last Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredExaminers.map((examiner) => (
                                <tr key={examiner.user_id}>
                                    <td>
                                        <strong>{examiner.name}</strong>
                                    </td>
                                    <td>{examiner.email}</td>
                                    <td>
                                        <span className={`badge badge-${
                                            examiner.status === 'active' ? 'success' : 
                                            examiner.status === 'pending' ? 'warning' : 
                                            'danger'
                                        }`}>
                                            {examiner.status}
                                        </span>
                                    </td>
                                    <td>{new Date(examiner.created_at).toLocaleDateString()}</td>
                                    <td>
                                        {examiner.last_login 
                                            ? new Date(examiner.last_login).toLocaleDateString()
                                            : <span style={{ color: 'var(--text-secondary)' }}>Never</span>
                                        }
                                    </td>
                                    <td>
                                        {examiner.status !== 'pending' && (
                                            <button
                                                className={`btn btn-sm ${examiner.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                                                onClick={() => handleStatusChange(examiner.user_id, examiner.status, examiner.name)}
                                            >
                                                {examiner.status === 'active' ? '🚫 Deactivate' : '✓ Activate'}
                                            </button>
                                        )}
                                        {examiner.status === 'pending' && (
                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                                Pending approval
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon">👥</div>
                        <p>No {filter !== 'all' ? filter : ''} examiners found</p>
                        <small style={{ color: 'var(--text-secondary)' }}>
                            {filter === 'pending' 
                                ? 'Pending examiners will appear here after registration'
                                : 'Examiners in your department will appear here'
                            }
                        </small>
                    </div>
                )}
            </div>

            {/* Modal */}
            <Modal
                isOpen={modalConfig.isOpen}
                onClose={() => setModalConfig({ isOpen: false })}
                onConfirm={modalConfig.onConfirm}
                title={modalConfig.title}
                message={modalConfig.message}
                type={modalConfig.type}
                confirmText={modalConfig.confirmText}
            />
        </div>
    );
};

export default MyExaminers;
