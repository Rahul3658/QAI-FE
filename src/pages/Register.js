import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api/axios';

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'examiner',
    university_id: '',
    college_id: '',
    department_id: '',
    custom_university: '',
    custom_college: '',
    custom_department: ''
  });
  const [universities, setUniversities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCustomUniversity, setIsCustomUniversity] = useState(false);
  const [isCustomCollege, setIsCustomCollege] = useState(false);
  const [isCustomDepartment, setIsCustomDepartment] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchUniversities();
  }, []);

  useEffect(() => {
    if (formData.university_id) {
      fetchColleges(formData.university_id);
    }
  }, [formData.university_id]);

  useEffect(() => {
    if (formData.college_id && (formData.role === 'examiner' || formData.role === 'subject_matter_expert')) {
      fetchDepartments(formData.college_id);
    } else if (isCustomCollege && (formData.role === 'examiner' || formData.role === 'subject_matter_expert')) {
      // For custom colleges, show empty department list with custom option
      setDepartments([]);
    }
  }, [formData.college_id, formData.role, isCustomCollege]);

  const fetchUniversities = async () => {
    try {
      const { data } = await API.get('/public/universities');
      setUniversities(data.universities);
    } catch (err) {
      console.error('Failed to fetch universities');
    }
  };

  const fetchColleges = async (universityId) => {
    try {
      const { data } = await API.get(`/public/colleges?university_id=${universityId}`);
      setColleges(data.colleges);
    } catch (err) {
      console.error('Failed to fetch colleges');
    }
  };

  const fetchDepartments = async (collegeId) => {
    try {
      const { data } = await API.get(`/public/departments?college_id=${collegeId}`);
      setDepartments(data.departments);
    } catch (err) {
      console.error('Failed to fetch departments');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Handle university selection
    if (name === 'university_id') {
      if (value === 'custom') {
        setIsCustomUniversity(true);
        setFormData({ ...formData, university_id: '', custom_university: '', college_id: '', department_id: '' });
        setColleges([]);
        setDepartments([]);
      } else {
        setIsCustomUniversity(false);
        setFormData({ ...formData, university_id: value, custom_university: '', college_id: '', department_id: '' });
        setDepartments([]);
      }
    }
    // Handle college selection
    else if (name === 'college_id') {
      if (value === 'custom') {
        setIsCustomCollege(true);
        setFormData({ ...formData, college_id: '', custom_college: '', department_id: '' });
        setDepartments([]);
      } else {
        setIsCustomCollege(false);
        setFormData({ ...formData, college_id: value, custom_college: '', department_id: '' });
      }
    }
    // Handle department selection
    else if (name === 'department_id') {
      if (value === 'custom') {
        setIsCustomDepartment(true);
        setFormData({ ...formData, department_id: '', custom_department: '' });
      } else {
        setIsCustomDepartment(false);
        setFormData({ ...formData, department_id: value, custom_department: '' });
      }
    }
    // Handle other fields
    else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const nextStep = () => {
    setError('');
    
    // Validation for each step
    if (step === 1) {
      if (!formData.role) {
        setError('Please select a role');
        return;
      }
    } else if (step === 2) {
      if (!formData.name || !formData.email || !formData.password) {
        setError('Please fill in all fields');
        return;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
    } else if (step === 3) {
      if (!formData.university_id && !isCustomUniversity) {
        setError('Please select a university');
        return;
      }
      if (isCustomUniversity && !formData.custom_university) {
        setError('Please enter university name');
        return;
      }
      if (!formData.college_id && !isCustomCollege) {
        setError('Please select a college');
        return;
      }
      if (isCustomCollege && !formData.custom_college) {
        setError('Please enter college name');
        return;
      }
      if ((formData.role === 'examiner' || formData.role === 'subject_matter_expert') && !formData.department_id && !isCustomDepartment) {
        setError('Please select a department');
        return;
      }
      if (isCustomDepartment && !formData.custom_department) {
        setError('Please enter department name');
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
        let approvalMsg = 'Registration submitted! ';
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
          {step === 3 && 'Step 3: Institution Details'}
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
                    { value: 'subject_matter_expert', label: 'Subject Matter Expert', desc: 'Department head - Manage and review' },
                    { value: 'moderator', label: 'Moderator', desc: 'Manage college operations and approvals' }
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
                <label className="form-label">Full Name</label>
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
                <label className="form-label">Email Address</label>
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
                <label className="form-label">Password</label>
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
            </div>
          )}

          {/* Step 3: Institution Details */}
          {step === 3 && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>

              <div className="form-group">
                <label className="form-label">University</label>
                <select
                  name="university_id"
                  className="form-select"
                  value={isCustomUniversity ? 'custom' : formData.university_id}
                  onChange={handleChange}
                  required={!isCustomUniversity}
                  disabled={isCustomUniversity}
                >
                  <option value="">Select University</option>
                  {universities.map(uni => (
                    <option key={uni.university_id} value={uni.university_id}>
                      {uni.university_name}
                    </option>
                  ))}
                  <option value="custom">Other (Type Custom)</option>
                </select>
              </div>

              {isCustomUniversity && (
                <div className="form-group">
                  <label className="form-label">Custom University Name</label>
                  <input
                    type="text"
                    name="custom_university"
                    className="form-input"
                    value={formData.custom_university}
                    onChange={handleChange}
                    placeholder="Enter university name"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                    onClick={() => {
                      setIsCustomUniversity(false);
                      setFormData({ ...formData, custom_university: '', university_id: '' });
                    }}
                  >
                    ← Back to List
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">College</label>
                <select
                  name="college_id"
                  className="form-select"
                  value={isCustomCollege ? 'custom' : formData.college_id}
                  onChange={handleChange}
                  required={!isCustomCollege}
                  disabled={isCustomCollege || (!formData.university_id && !isCustomUniversity)}
                >
                  <option value="">Select College</option>
                  {colleges.map(college => (
                    <option key={college.college_id} value={college.college_id}>
                      {college.college_name}
                    </option>
                  ))}
                  <option value="custom">Other (Type Custom)</option>
                </select>
              </div>

              {isCustomCollege && (
                <div className="form-group">
                  <label className="form-label">Custom College Name</label>
                  <input
                    type="text"
                    name="custom_college"
                    className="form-input"
                    value={formData.custom_college}
                    onChange={handleChange}
                    placeholder="Enter college name"
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                    onClick={() => {
                      setIsCustomCollege(false);
                      setFormData({ ...formData, custom_college: '', college_id: '' });
                    }}
                  >
                    ← Back to List
                  </button>
                </div>
              )}

              {(formData.role === 'examiner' || formData.role === 'subject_matter_expert') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <select
                      name="department_id"
                      className="form-select"
                      value={isCustomDepartment ? 'custom' : formData.department_id}
                      onChange={handleChange}
                      required={!isCustomDepartment}
                      disabled={isCustomDepartment || (!formData.college_id && !isCustomCollege)}
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option 
                          key={dept.department_id} 
                          value={dept.department_id}
                          disabled={formData.role === 'subject_matter_expert' && dept.hod_user_id}
                        >
                          {dept.department_name} {dept.department_code && `(${dept.department_code})`}
                          {formData.role === 'subject_matter_expert' && dept.hod_user_id && ' - SME Assigned'}
                        </option>
                      ))}
                      <option value="custom">Other (Type Custom)</option>
                    </select>
                    {formData.role === 'subject_matter_expert' && !isCustomDepartment && (
                      <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                        Only departments without an existing Subject Matter Expert are available
                      </small>
                    )}
                  </div>

                  {isCustomDepartment && (
                    <div className="form-group">
                      <label className="form-label">Custom Department Name</label>
                      <input
                        type="text"
                        name="custom_department"
                        className="form-input"
                        value={formData.custom_department}
                        onChange={handleChange}
                        placeholder="Enter department name"
                        required
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: '0.5rem', fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                        onClick={() => {
                          setIsCustomDepartment(false);
                          setFormData({ ...formData, custom_department: '', department_id: '' });
                        }}
                      >
                        ← Back to List
                      </button>
                    </div>
                  )}
                </>
              )}
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
            <strong>📋 Note:</strong> Examiner requires Subject Matter Expert approval. Subject Matter Expert requires Moderator approval. Moderator requires Super Admin approval.
          </div>
        )}
      </div>
    </div>
  );
};

export default Register;
