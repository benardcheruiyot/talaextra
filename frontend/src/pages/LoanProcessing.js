import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { formatCurrency } from '../utils/helpers';
import './LoanProcessing.css';

const readPendingApplication = (locationState) => {
  if (locationState && Object.keys(locationState).length > 0) {
    return locationState;
  }

  try {
    const saved = localStorage.getItem('pending_loan_application');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const LoanProcessing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [application, setApplication] = useState(() => readPendingApplication(location.state));

  useEffect(() => {
    document.title = 'Loan Processing | Tala Mkopo Extra';
  }, []);

  useEffect(() => {
    if (!application) {
      navigate('/loan', { replace: true });
    }
  }, [application, navigate]);

  const submittedTime = useMemo(() => {
    if (!application?.submittedAt) return 'Just now';
    return new Intl.DateTimeFormat('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(application.submittedAt));
  }, [application?.submittedAt]);

  if (!application) {
    return null;
  }

  const netDeposit = Math.max(Number(application.amount || 0) - Number(application.fee || 0), 0);

  return (
    <div className="loan-processing-page">
      <Header logoInitial="P" />

      <main className="loan-processing-shell">
        <section className="loan-processing-hero">
          <div className="loan-processing-badge">Payment confirmed</div>
          <h1>Your loan application is now being processed</h1>
          <p>
            We have received your M-Pesa processing fee and locked your selected loan amount for review.
          </p>

          <div className="loan-processing-status">
            <span className="loan-processing-status-dot" />
            <span>Under review by our loan team</span>
          </div>
        </section>

        <section className="loan-processing-card-grid">
          <article className="loan-processing-card highlight">
            <span>Requested amount</span>
            <strong>{formatCurrency(application.amount)}</strong>
          </article>
          <article className="loan-processing-card">
            <span>Processing fee paid</span>
            <strong>{formatCurrency(application.fee)}</strong>
          </article>
          <article className="loan-processing-card">
            <span>Expected deposit</span>
            <strong>{formatCurrency(netDeposit)}</strong>
          </article>
          <article className="loan-processing-card">
            <span>Reference</span>
            <strong>{application.reference || 'Pending'}</strong>
          </article>
        </section>

        <section className="loan-processing-timeline">
          <div className="loan-processing-step done">
            <div className="loan-processing-step-index">1</div>
            <div>
              <h2>Payment received</h2>
              <p>We have confirmed the fee payment from your phone number.</p>
            </div>
          </div>
          <div className="loan-processing-step active">
            <div className="loan-processing-step-index">2</div>
            <div>
              <h2>Application in review</h2>
              <p>
                Your selected loan amount is being verified. This usually finishes within a short review window.
              </p>
            </div>
          </div>
          <div className="loan-processing-step">
            <div className="loan-processing-step-index">3</div>
            <div>
              <h2>Disbursement</h2>
              <p>Once approved, the funds will be sent to your M-Pesa account.</p>
            </div>
          </div>
        </section>

        <section className="loan-processing-note">
          <strong>Submitted:</strong> {submittedTime}
          <span>Phone: {application.phone || 'Not available'}</span>
        </section>

        <div className="loan-processing-actions">
          <Link to="/loan" className="loan-processing-back">
            Back to loan options
          </Link>
          <button
            type="button"
            className="loan-processing-clear"
            onClick={() => {
              localStorage.removeItem('pending_loan_application');
              setApplication(null);
              navigate('/loan', { replace: true });
            }}
          >
            View other amounts
          </button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default LoanProcessing;