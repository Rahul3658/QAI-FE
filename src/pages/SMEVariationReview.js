import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const SMEVariationReview = () => {
  const { showToast } = useToast();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    status: '',
    comments: ''
  });

  useEffect(() => {
    fetchPendingReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/question-variations/sme/pending-reviews');
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      showToast('Failed to load pending reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (variationId, status) => {
    if (!reviewForm.comments && status === 'rejected') {
      showToast('Please provide comments for rejection', 'error');
      return;
    }

    try {
      await API.post(`/question-variations/variations/${variationId}/review`, {
        status,
        comments: reviewForm.comments
      });

      showToast(`Variation ${status === 'approved' ? 'approved' : 'rejected'} successfully!`, 'success');
      
      // Reset form and refresh
      setReviewForm({ status: '', comments: '' });
      setSelectedReview(null);
      await fetchPendingReviews();

    } catch (error) {
      console.error('Error submitting review:', error);
      showToast(error.response?.data?.message || 'Failed to submit review', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: { color: 'var(--warning)', bg: 'var(--warning-light)', text: '⏳ Pending' },
      approved: { color: 'var(--success)', bg: 'var(--success-light)', text: '✅ Approved' },
      rejected: { color: 'var(--error)', bg: 'var(--error-light)', text: '❌ Rejected' }
    };

    const badge = badges[status] || badges.pending;

    return (
      <span style={{
        padding: '0.25rem 0.75rem',
        borderRadius: '1rem',
        fontSize: '0.75rem',
        fontWeight: '500',
        color: badge.color,
        background: badge.bg,
        border: `1px solid ${badge.color}`
      }}>
        {badge.text}
      </span>
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>📋 Variation Reviews</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Review question variations submitted by examiners
        </p>
      </div>

      {loading ? (
        <div className="card">
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p>Loading reviews...</p>
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card">
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>✅</p>
            <p style={{ margin: 0 }}>No pending reviews. All caught up!</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {reviews.map((review) => (
            <div key={review.review_id} className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 className="card-title" style={{ margin: '0 0 0.25rem 0' }}>
                    Variation {review.variation_number}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                    From: {review.examiner_name} • {review.marks} marks • {review.question_type}
                  </p>
                </div>
                {getStatusBadge(review.status)}
              </div>

              <div style={{ padding: '1.5rem' }}>
                {/* Question */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                    Question
                  </label>
                  <p style={{ margin: 0, fontWeight: '500', fontSize: '1rem' }}>
                    {review.question_text}
                  </p>
                </div>

                {/* Options (if MCQ) */}
                {review.options && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                      Options
                    </label>
                    <div style={{ marginLeft: '1rem' }}>
                      {JSON.parse(review.options).map((opt, idx) => (
                        <div key={idx} style={{ marginBottom: '0.25rem', fontSize: '0.875rem' }}>
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Answer */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                    Correct Answer
                  </label>
                  <p style={{ margin: 0, fontSize: '0.875rem', padding: '0.75rem', background: 'var(--success-light)', borderRadius: '0.5rem', border: '1px solid var(--success)' }}>
                    {review.correct_answer}
                  </p>
                </div>

                {/* Review Section */}
                {review.status === 'pending' && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <div className="form-group">
                      <label className="form-label">Comments (optional for approval, required for rejection)</label>
                      <textarea
                        className="form-input"
                        value={selectedReview === review.review_id ? reviewForm.comments : ''}
                        onChange={(e) => {
                          setSelectedReview(review.review_id);
                          setReviewForm({ ...reviewForm, comments: e.target.value });
                        }}
                        placeholder="Add your feedback here..."
                        rows="3"
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => handleReview(review.variation_id, 'rejected')}
                        className="btn btn-error"
                      >
                        ❌ Reject
                      </button>
                      <button
                        onClick={() => handleReview(review.variation_id, 'approved')}
                        className="btn btn-success"
                      >
                        ✅ Approve
                      </button>
                    </div>
                  </div>
                )}

                {/* Show comments if already reviewed */}
                {review.status !== 'pending' && review.comments && (
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }}>
                      Your Comments
                    </label>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                      {review.comments}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SMEVariationReview;
