import {
  CheckCircle2,
  FileStack,
  GitPullRequest,
  MessageSquare,
  Play,
  ShieldAlert,
} from 'lucide-react';
import type {
  PullRequestChangeGroup,
  PullRequestReviewReport,
  PullRequestRiskLevel,
  PullRequestValidationStatus,
} from '../../services/prReviewUnderstanding';

export interface PullRequestReviewPanelProps {
  report: PullRequestReviewReport;
  onStartFollowUp: (prompt: string) => void;
}

const RISK_LABELS: Record<PullRequestRiskLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const VALIDATION_LABELS: Record<PullRequestValidationStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  pending: 'Pending',
  missing: 'Missing',
};

export function PullRequestReviewPanel({ report, onStartFollowUp }: PullRequestReviewPanelProps) {
  return (
    <section className="pr-review-panel" role="region" aria-label="Merge review understanding">
      <header className="pr-review-header">
        <div className="pr-review-title-group">
          <span className="panel-eyebrow"><GitPullRequest size={12} aria-hidden="true" />Review</span>
          <h2>{report.title}</h2>
          <p>{report.summary}</p>
        </div>
        <div className={`pr-review-readiness pr-review-readiness--${report.readiness.status}`}>
          <strong>{report.readiness.status === 'ready' ? 'ready' : 'needs review'}</strong>
          <span>{report.readiness.passedValidations} passed checks</span>
          <span>{report.readiness.browserEvidenceCount} evidence links</span>
        </div>
      </header>

      <div className="pr-review-body">
        <section className="pr-review-section" aria-labelledby="pr-review-groups-heading">
          <div className="pr-review-section-heading">
            <FileStack size={14} aria-hidden="true" />
            <h3 id="pr-review-groups-heading">Change groups</h3>
          </div>
          <div className="pr-review-group-list">
            {report.groups.map((group) => (
              <ChangeGroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>

        <section className="pr-review-section" aria-labelledby="pr-review-risks-heading">
          <div className="pr-review-section-heading">
            <ShieldAlert size={14} aria-hidden="true" />
            <h3 id="pr-review-risks-heading">Review risks</h3>
          </div>
          {report.risks.length ? (
            <div className="pr-review-risk-list">
              {report.risks.map((risk) => (
                <article className={`pr-review-risk pr-review-risk--${risk.severity}`} key={`${risk.severity}:${risk.title}`}>
                  <span>{RISK_LABELS[risk.severity]}</span>
                  <div>
                    <strong>{risk.title}</strong>
                    <p>{risk.reason}</p>
                    <em>{risk.recommendedCheck}</em>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="pr-review-empty">No review risks detected.</p>
          )}
        </section>

        <section className="pr-review-section" aria-labelledby="pr-review-evidence-heading">
          <div className="pr-review-section-heading">
            <CheckCircle2 size={14} aria-hidden="true" />
            <h3 id="pr-review-evidence-heading">Validation evidence</h3>
          </div>
          <div className="pr-review-evidence-list">
            {report.validations.map((validation) => (
              <article className="pr-review-evidence" key={`${validation.label}:${validation.command}`}>
                <span className={`pr-review-status pr-review-status--${validation.status}`}>{VALIDATION_LABELS[validation.status]}</span>
                <strong>{validation.label}</strong>
                <code>{validation.command}</code>
                {validation.detail ? <p>{validation.detail}</p> : null}
              </article>
            ))}
            {report.browserEvidence.map((evidence) => (
              <article className="pr-review-evidence" key={`${evidence.kind}:${evidence.path}`}>
                <span className="pr-review-status pr-review-status--passed">{evidence.kind}</span>
                <strong>{evidence.label}</strong>
                <code>{evidence.path}</code>
              </article>
            ))}
          </div>
        </section>

        <section className="pr-review-section" aria-labelledby="pr-review-comments-heading">
          <div className="pr-review-section-heading">
            <MessageSquare size={14} aria-hidden="true" />
            <h3 id="pr-review-comments-heading">Reviewer follow-up</h3>
          </div>
          <div className="pr-review-comment-list">
            {report.reviewerComments.map((comment, index) => (
              <article className="pr-review-comment" key={`${comment.author}:${index}`}>
                <strong>{comment.author}</strong>
                <p>{comment.body}</p>
              </article>
            ))}
          </div>
          <div className="pr-review-follow-up-list">
            {report.followUps.map((followUp) => (
              <button
                type="button"
                className="pr-review-follow-up"
                key={followUp.id}
                aria-label={`Start follow-up: ${followUp.title}`}
                onClick={() => onStartFollowUp(followUp.prompt)}
              >
                <Play size={13} aria-hidden="true" />
                <span>{followUp.title}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

function ChangeGroupCard({ group }: { group: PullRequestChangeGroup }) {
  return (
    <article className={`pr-review-group pr-review-group--${group.riskLevel}`}>
      <div className="pr-review-group-header">
        <strong>{group.title}</strong>
        <span>{RISK_LABELS[group.riskLevel]} risk</span>
      </div>
      <p>{group.intent}</p>
      <ul>
        {group.files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </article>
  );
}
