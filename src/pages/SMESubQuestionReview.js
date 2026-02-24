import { useState, useEffect } from 'react';
import API from '../api/axios';
import { useToast } from '../context/ToastContext';

const SMESubQuestionReview = () => {
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
      const { data } = await API.get('/sub-questions/sme/pending-reviews');
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      showToast('Failed to load pending reviews', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();

    if (!reviewForm.status) {
      showToast('Please select approve or reject', 'error');
      return;
    }

    try {
      await API.post(`/sub-questions/variations/${selectedReview.variation_id}/review`, reviewForm);
      showToast('Review submitted successfully!', 'success');
      setSelectedReview(null);
      setReviewForm({ status: '', comments: '' });
      await fetchPendingReviews();
    } catch (error) {
      console.error('Error submitting review:', error);
      showToast(error.response?.data?.message || 'Failed to submit review', 'error');
    }
  };

  const groupedReviews = reviews.reduce((acc, review) => {
    const key = review.full_question_number;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(review);
    return acc;
  }, {});

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: '0 0 0.5rem 0' }}>📋 Variation Reviews</h1>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Review question variations sent by examiners
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <p>Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card">
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>✅</p>
            <p style={{ margin: 0 }}>No pending reviews at the moment</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Reviews List */}
          <div>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Pending Reviews ({reviews.length})</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                {Object.entries(groupedReviews).map(([questionNumber, questionReviews]) => (
                  <div key={questionNumber} style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--primary)' }}>
                      {questionNumber}
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {questionReviews.map((review) => (
                        <button
                          key={review.review_id}
                          onClick={() => setSelectedReview(review)}
                          className="btn"
                          style={{
                            textAlign: 'left',
                            padding: '1rem',
                            background: selectedReview?.review_id === review.review_id ? 'var(--primary-light)' : 'var(--bg-secondary)',
                            border: selectedReview?.review_id === review.review_id ? '2px solid var(--primary)' : '1px solid var(--border-color)'
                          }}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                            {review.full_question_number}.{review.variation_number}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {review.question_type} • {review.marks} marks
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            From: {review.examiner_name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review Panel */}
          <div>
            {selectedReview ? (
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    Review: {selectedReview.full_question_number}.{selectedReview.variation_number}
                  </h3>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  {/* Question Details */}
                  <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: '0.5rem' }}>
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Question:</strong>
                      <p style={{ margin: '0.5rem 0 0 0' }}>{selectedReview.question_text}</p>
                    </div>

                    {selectedReview.options && (
                      <div style={{ marginBottom: '1rem' }}>
                        <strong>Options:</strong>
                        <div style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                          {JSON.parse(selectedReview.options).map((opt, idx) => (
                            <div key={idx} style={{ marginBottom: '0.25rem' }}>{opt}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <strong>Correct Answer:</strong>
                      <p style={{ margin: '0.5rem 0 0 0' }}>{selectedReview.correct_answer}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <span>Type: {selectedReview.question_type}</span>
                      <span>Marks: {selectedReview.marks}</span>
                      <span>Difficulty: {selectedReview.difficulty}</span>
                    </div>
                  </div>

                  {/* Review Form */}
                  <form onSubmit={handleReviewSubmit}>
                    <div className="form-group">
                      <label className="form-label">Decision *</label>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, status: 'approved' })}
                          className="btn"
                          style={{
                            flex: 1,
                            background: reviewForm.status === 'approved' ? 'var(--success)' : 'var(--bg-secondary)',
                            color: reviewForm.status === 'approved' ? 'white' : 'var(--text-primary)',
                            border: reviewForm.status === 'approved' ? '2px solid var(--success)' : '1px solid var(--border-color)'
                          }}
                        >
                          ✅ Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setReviewForm({ ...reviewForm, status: 'rejected' })}
                          className="btn"
                          style={{
                            flex: 1,
                            background: reviewForm.status === 'rejected' ? 'var(--error)' : 'var(--bg-secondary)',
                            color: reviewForm.status === 'rejected' ? 'white' : 'var(--text-primary)',
                            border: reviewForm.status === 'rejected' ? '2px solid var(--error)' : '1px solid var(--border-color)'
                          }}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Comments</label>
                      <textarea
                        className="form-input"
                        value={reviewForm.comments}
                        onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                        rows="4"
                        placeholder="Add your feedback here..."
                      />
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      disabled={!reviewForm.status}
                    >
                      Submit Review
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="card">
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <p style={{ fontSize: '3rem', margin: '0 0 1rem 0' }}>👈</p>
                  <p style={{ margin: 0 }}>Select a variation to review</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SMESubQuestionReview;
