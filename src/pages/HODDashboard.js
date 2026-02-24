import React, { useState, useEffect } from 'react';
import API from '../api/axios';
import Modal from '../components/Modal';
import { useToast } from '../context/ToastContext';

const HODDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [department, setDepartment] = useState(null);
    const [pendingExaminers, setPendingExaminers] = useState([]);
    const [modalConfig, setModalConfig] = useState({ isOpen: false });
    const [stats, setStats] = useState({
        totalExaminers: 0,
        activeExaminers: 0,
        pendingApprovals: 0,
        pendingSets: 0
    });
    const { showToast } = useToast();

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            // Fetch department info
            let deptData = null;
            try {
                const response = await API.get('/departments/my-department');
                deptData = response.data;
                setDepartment(deptData.department);
                console.log('✅ Department loaded:', deptData.department);
            } catch (err) {
                console.error('❌ Error fetching department:', err.response?.data || err.message);
            }

            // Fetch pending examiner registrations
            let pendingData = { pending_users: [] };
            try {
                const response = await API.get('/users/pending-examiners');
                pendingData = response.data;
                console.log("Pending :",pendingData)
                setPendingExaminers(pendingData.pending_users || []);
            } catch (err) {
                console.error('Error fetching pending examiners:', err);
                setPendingExaminers([]);
            }

            // Fetch pending sets for selection
            let pendingSetsData = { requests: [] };
            try {
                console.log('📋 Fetching pending sets...');
                const response = await API.get('/sme-selection/pending-requests');
                pendingSetsData = response.data;
                console.log('✅ Pending sets loaded:', pendingSetsData.requests?.length || 0);
            } catch (err) {
                console.error('❌ Error fetching pending sets:', err.response?.data || err.message);
            }

            // Fetch examiner stats
            try {
                const { data: examinersData } = await API.get('/users/my-examiners');
                console.log("examinersData :",examinersData)
                const examiners = Array.isArray(examinersData)
                    ? examinersData
                    : (examinersData?.examiners ?? []);

                setStats({
                    totalExaminers: examiners.length,
                    activeExaminers: examiners.filter(e => e.status === 'active').length,
                    pendingApprovals: pendingData?.pending_users?.length ?? 0,
                    pendingSets: pendingSetsData?.requests?.length ?? 0
                });
            } catch (err) {
                console.error('Error fetching examiner stats:', err);
                setStats({
                    totalExaminers: 0,
                    activeExaminers: 0,
                    pendingApprovals: pendingData.pending_users?.length || 0,
                    pendingSets: 0
                });
            }

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApproveExaminer = (userId, action, examinerName) => {
        setModalConfig({
            isOpen: true,
            type: action === 'approve' ? 'success' : 'error',
            title: action === 'approve' ? 'Approve Examiner' : 'Reject Examiner',
            message: action === 'approve'
                ? `Are you sure you want to approve ${examinerName}? They will be able to login and create question papers.`
                : `Are you sure you want to reject ${examinerName}'s registration? This action cannot be undone and they will need to register again.`,
            confirmText: action === 'approve' ? 'Approve' : 'Reject',
            onConfirm: () => confirmApproveExaminer(userId, action)
        });
    };

    const confirmApproveExaminer = async (userId, action) => {
        try {
            await API.put(`/users/${userId}/approve-examiner`, { action });
            showToast(
                `Examiner ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
                action === 'approve' ? 'success' : 'info'
            );
            fetchDashboardData(); // Refresh data
        } catch (error) {
            console.error('Error approving examiner:', error);
            const errorMsg = error.response?.data?.message || 'Failed to process request';
            const existingSME = error.response?.data?.existingSME;
            
            if (existingSME) {
                // Show detailed modal for SME constraint
                setModalConfig({
                    isOpen: true,
                    title: '⚠️ Cannot Approve SME',
                    message: `${errorMsg}\n\nExisting SME: ${existingSME}\n\nOnly one SME is allowed per subject. Please deactivate the existing SME first, or reject this application.`,
                    confirmText: 'OK',
                    onConfirm: () => setModalConfig({ isOpen: false })
                });
            } else {
                showToast(errorMsg, 'error');
            }
        }
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
                    <h1 className="dashboard-title">👨‍💼 Subject Matter Expert's Dashboard</h1>
                    <p className="dashboard-subtitle" style={{ color: 'white' }}>
                        {department ? `${department.department_name} Department` : 'Department Management'}
                    </p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Total Examiners</div>
                    <div className="stat-value">{stats.totalExaminers}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Active Examiners</div>
                    <div className="stat-value">{stats.activeExaminers}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Pending Approvals</div>
                    <div className="stat-value">{stats.pendingApprovals}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Sets to Select</div>
                    <div className="stat-value">{stats.pendingSets}</div>
                </div>
            </div>

            {/* Department Info */}
            {department && (
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">🏛️ Department Information</h2>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    Department Name
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.125rem' }}>
                                    {department.department_name}
                                </div>
                            </div>
                            <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    Department Code
                                </div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.125rem' }}>
                                    {department.department_code}
                                </div>
                            </div>
                            {/* <div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                                    Status
                                </div>
                                <span className={`badge ${department.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                                    {department.status}
                                </span>
                            </div> */}
                        </div>
                    </div>
                </div>
            )}

            {/* Info Card - New Workflow */}
            {stats.pendingSets > 0 && (
                <div className="card" style={{ border: '2px solid var(--info)', background: 'var(--info-light)' }}>
                    <div className="card-header" style={{ background: 'var(--info)', color: 'white' }}>
                        <h2 className="card-title">📋 Paper Sets Awaiting Selection</h2>
                        <span className="badge" style={{ background: 'white', color: 'var(--info)' }}>
                            {stats.pendingSets} Requests
                        </span>
                    </div>
                    <div style={{ padding: '1.5rem' }}>
                        <p style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-primary)' }}>
                            You have {stats.pendingSets} generation request{stats.pendingSets !== 1 ? 's' : ''} waiting for your review.
                            Each request contains 10 question paper sets that need your selection.
                        </p>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.href = '/sme-selection'}
                        >
                            📋 Review & Select Paper Sets →
                        </button>
                    </div>
                </div>
            )}

            {/* Pending Examiner Registrations - Only show if there are pending examiners */}
            {pendingExaminers.length > 0 && (
                <div className="card" style={{ border: '2px solid var(--warning)', background: 'var(--warning-light)' }}>
                    <div className="card-header" style={{ background: 'var(--warning)', color: 'white' }}>
                        <h2 className="card-title">⏳ Pending Examiner Registrations</h2>
                        <span className="badge" style={{ background: 'white', color: 'var(--warning)' }}>
                            {pendingExaminers.length} Pending
                        </span>
                    </div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Department</th>
                                <th>Registered</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pendingExaminers.map((examiner) => (
                                <tr key={examiner.user_id}>
                                    <td><strong>{examiner.name}</strong></td>
                                    <td>{examiner.email}</td>
                                    <td>{examiner.department_name || 'N/A'}</td>
                                    <td>{new Date(examiner.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-success btn-sm"
                                                onClick={() => handleApproveExaminer(examiner.user_id, 'approve', examiner.name)}
                                            >
                                                ✓ Approve
                                            </button>
                                            <button
                                                className="btn btn-danger btn-sm"
                                                onClick={() => handleApproveExaminer(examiner.user_id, 'reject', examiner.name)}
                                            >
                                                ✗ Reject
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}



            {/* Quick Actions */}
            <div className="card">
                <div className="card-header">
                    <h2 className="card-title">⚡ Quick Actions</h2>
                </div>
                <div style={{ padding: '1.5rem' }}>
                    <div className="btn-group">
                        <button className="btn btn-primary"
                            onClick={() => window.location.href = '/sme-papers'}
                        >
                            🗞️ Review Papers
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={() => window.location.href = '/my-examiners'}
                        >
                            🧑‍💼 View My Examiners
                        </button>
                        

                    </div>
                </div>
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

export default HODDashboard;
