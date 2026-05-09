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
  const timelineSteps = [
    {
      id: 1,
      title: 'Processing fee paid',
      description: 'Your M-Pesa fee payment has been confirmed successfully.',
      status: 'done',
    },
    {
      id: 2,
      title: 'Application under review',
      description: 'Our loan team is validating your request and account details.',
      status: 'active',
    },
    {
      id: 3,
      title: 'Disbursement',
      description: 'Once approved, funds will be sent directly to your M-Pesa account within 48 hours.',
      status: 'pending',
    },
    {
      id: 4,
      title: 'Completion notice',
      description: 'You will receive an SMS confirmation once disbursement is complete.',
      status: 'pending',
    },
  ];

  return (
    <div className="loan-processing-page">
      <Header logoInitial="P" />

      <main className="loan-processing-shell">
        <section className="loan-processing-card-wrap">
          <div className="loan-processing-success-ring" aria-hidden="true">
            <span>✓</span>
          </div>

          <h1>APPLICATION RECEIVED!</h1>
          <p className="loan-processing-intro">
            Thank you for applying. We have confirmed your processing fee and your request is now in review.
          </p>

          <div className="loan-processing-deadline" role="status" aria-live="polite">
            <strong>Expected disbursement:</strong> within 48 hours after payment confirmation.
          </div>

          <div className="loan-processing-summary-grid">
            <div>
              <span>Requested amount</span>
              <strong>{formatCurrency(application.amount)}</strong>
            </div>
            <div>
              <span>Fee paid</span>
              <strong>{formatCurrency(application.fee)}</strong>
            </div>
            <div>
              <span>Expected deposit</span>
              <strong>{formatCurrency(netDeposit)}</strong>
            </div>
            <div>
              <span>Reference</span>
              <strong>{application.reference || 'Pending'}</strong>
            </div>
          </div>

          <section className="loan-processing-timeline">
            {timelineSteps.map((step, index) => (
              <article key={step.id} className="loan-processing-timeline-item">
                <div className="loan-processing-timeline-track" aria-hidden="true">
                  <span className={`loan-processing-timeline-dot ${step.status}`}>
                    {step.status === 'done' ? '✓' : ''}
                  </span>
                  {index < timelineSteps.length - 1 && <span className="loan-processing-timeline-line" />}
                </div>
                <div className="loan-processing-timeline-copy">
                  <h2>{step.title}</h2>
                  <p>{step.description}</p>
                </div>
              </article>
            ))}
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
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LoanProcessing;