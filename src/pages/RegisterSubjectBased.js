import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';

const RegisterSubjectBased = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'examiner',
    subject_id: '',
    custom_subject_name: '',
    custom_subject_code: '',
    custom_subject_description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData({ ...formData, [name]: value });
  };

  const nextStep = () => {
    setError('');
    
    if (step === 1) {
      if (!formData.role) {
        setError('Please select a role');
        return;
      }
    } else if (step === 2) {
      if (!formData.name || !formData.email || !formData.password || !formData.phone) {
        setError('Please fill in all required fields');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return;
      }
      // Phone validation: Indian format +91 followed by 10 digits
      const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
      const cleanPhone = formData.phone.replace(/[\s\-()]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        setError('Please enter a valid Indian phone number (10 digits starting with 6-9, optional +91)');
        return;
      }
    } else if (step === 3) {
      if (!formData.custom_subject_name?.trim()) {
        setError('Please enter a subject name');
        return;
      }
    }
    
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data } = await API.post('/auth/register', formData);

      if (data.user?.status === 'pending') {
        let approvalMsg = 'Registration submitted successfully! ';
        if (formData.role === 'examiner') {
          approvalMsg += 'Waiting for Subject Matter Expert approval.';
        } else if (formData.role === 'subject_matter_expert') {
          approvalMsg += 'Waiting for Moderator approval.';
        } else if (formData.role === 'moderator') {
          approvalMsg += 'Waiting for Super Admin approval.';
        }
        setSuccess(approvalMsg);
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setSuccess('Registration successful!');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', gap: '0.5rem' }}>
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: step >= s ? 'linear-gradient(135deg, var(--primary), var(--info))' : 'var(--bg-tertiary)',
            color: step >= s ? 'white' : 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '600',
            fontSize: '0.875rem',
            transition: 'all 0.3s ease'
          }}
        >
          {s}
        </div>
      ))}
    </div>
  );

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ maxWidth: '550px' }}>
        <h1 className="auth-title">Registration</h1>
        <p className="auth-subtitle">
          {step === 1 && 'Step 1: Choose Your Role'}
          {step === 2 && 'Step 2: Personal Information'}
          {step === 3 && 'Step 3: Subject Selection'}
        </p>

        {renderStepIndicator()}

        {error && <div className="form-error">{error}</div>}
        {success && <div className="form-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          {/* Step 1: Role Selection */}
          {step === 1 && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="form-group">
                <label className="form-label">Select Your Role</label>
                <div style={{ display: 'grid', gap: '1rem', marginTop: '1rem' }}>
                  {[
                    { value: 'examiner', label: 'Examiner', desc: 'Create and manage question papers' },
                    { value: 'subject_matter_expert', label: 'Subject Matter Expert (SME)', desc: 'Review papers and manage examiners' },
                    { value: 'moderator', label: 'Moderator', desc: 'Manage subject operations and approvals' }
                  ].map((role) => (
                    <div
                      key={role.value}
                      onClick={() => setFormData({ ...formData, role: role.value })}
                      style={{
                        padding: '1.25rem',
                        border: `2px solid ${formData.role === role.value ? 'var(--primary)' : 'var(--border-color)'}`,
                        borderRadius: '0.75rem',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        background: formData.role === role.value ? 'var(--primary-light)' : 'var(--bg-secondary)'
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                        {role.label}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {role.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Personal Info */}
          {step === 2 && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  name="password"
                  className="form-input"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+919876543210 or 9876543210"
                  maxLength="13"
                  required
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Enter 10 digits starting with 6-9 (optional +91 prefix)
                </small>
              </div>
            </div>
          )}

          {/* Step 3: Subject Selection */}
          {step === 3 && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div className="form-group">
                <label className="form-label">Subject Name *</label>
                <input
                  type="text"
                  name="custom_subject_name"
                  className="form-input"
                  value={formData.custom_subject_name}
                  onChange={handleChange}
                  placeholder="e.g., Advanced Machine Learning"
                  required
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  If this name matches an existing subject without a moderator, you will be linked to it. Otherwise we create a new subject automatically.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Subject Code</label>
                <input
                  type="text"
                  name="custom_subject_code"
                  className="form-input"
                  value={formData.custom_subject_code}
                  onChange={handleChange}
                  placeholder="e.g., CS401, MATH101"
                />
                <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Codes must be unique. If the code already exists registration will warn you.
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  name="custom_subject_description"
                  className="form-input"
                  value={formData.custom_subject_description}
                  onChange={handleChange}
                  placeholder="Brief description of the subject"
                  rows="3"
                />
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                ← Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Next →
              </button>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 1 }}
                disabled={loading}
              >
                {loading ? 'Registering...' : 'Complete Registration'}
              </button>
            )}
          </div>
        </form>

        <div className="auth-link" style={{ marginTop: '1.5rem' }}>
          Already have an account? <Link to="/login">Sign In</Link>
        </div>

        {step === 3 && (
          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <strong>📋 Approval Flow:</strong> Examiner → SME approval | SME → Moderator approval | Moderator → Super Admin approval
          </div>
        )}
      </div>
    </div>
  );
};

export default RegisterSubjectBased;
