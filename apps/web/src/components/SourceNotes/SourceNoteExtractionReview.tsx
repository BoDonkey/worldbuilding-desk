import type {CanonicalFact, LoreFactProposal} from '../../entityTypes';
import {buildCanonicalFactSummary} from '../../services/lore/canonicalFactActions';
import type {SourceNoteExtractionReviewState} from '../../hooks/useSourceNoteExtractionReview';
import styles from '../../styles/LoreRoute.module.css';

const formatFactValue = (value: CanonicalFact['value'] | LoreFactProposal['value']): string =>
  typeof value === 'string' ? value : `${value.label}: ${value.value}`;

/** Entity and fact candidates from the open Source Note, and its accepted canon. */
export function SourceNoteExtractionReview({review}: {review: SourceNoteExtractionReviewState}) {
  const {
    actingProposalId,
    actingEntityProposalId,
    removingFactId,
    factLinkableTargets,
    editingDocumentProposals,
    editingEntityProposals,
    editingDocumentFacts,
    sourceScenes,
    getFactProposalTargetValue,
    updateFactTargetDraft,
    handleAcceptProposal,
    handleRejectProposal,
    handleAcceptEntityProposal,
    handleRejectEntityProposal,
    handleRemoveFact
  } = review;

  return (
    <div className={styles.reviewCard}>
      <div className={styles.cardHeader}>
        <h2>Extraction Review</h2>
        <span className={styles.countBadge}>
          {editingEntityProposals.length + editingDocumentProposals.length}
        </span>
      </div>
      <p className={styles.subsectionCopy}>
        Source Note text is not canon by itself. These local candidates do
        not change the World Bible or accepted canon until you explicitly
        accept one; an accepted candidate can then become a World Bible
        record or canon fact.
      </p>
      <div className={styles.acceptedSection}>
        <div className={styles.cardHeader}>
          <h3>Entity Candidates</h3>
          <span className={styles.countBadge}>{editingEntityProposals.length}</span>
        </div>
        {editingEntityProposals.length === 0 ? (
          <p className={styles.emptyState}>
            No entity candidates yet.
          </p>
        ) : (
          <div className={styles.proposalList}>
            {editingEntityProposals.map((proposal) => (
              <article key={proposal.id} className={styles.proposalCard}>
                <div className={styles.proposalHeader}>
                  <strong>{proposal.entityKind}</strong>
                  <span className={styles.statusBadge}>{proposal.status}</span>
                </div>
                <p className={styles.proposalValue}>{proposal.name}</p>
                <p className={styles.proposalMeta}>
                  {proposal.targetId
                    ? `Matches existing ${proposal.targetType === 'character' ? 'character' : 'world record'}`
                    : 'Will create a new record'}
                </p>
                <p className={styles.proposalMeta}>
                  Confidence: {Math.round(proposal.confidence * 100)}%
                </p>
                <p className={styles.evidenceText}>{proposal.evidence.text}</p>
                {proposal.status === 'proposed' ? (
                  <div className={styles.inlineActions}>
                    <button
                      type='button'
                      onClick={() => void handleAcceptEntityProposal(proposal)}
                      disabled={actingEntityProposalId === proposal.id}
                    >
                      Accept
                    </button>
                    <button
                      type='button'
                      onClick={() => void handleRejectEntityProposal(proposal)}
                      disabled={actingEntityProposalId === proposal.id}
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>

      <div className={styles.acceptedSection}>
        <div className={styles.cardHeader}>
          <h3>Fact Candidates</h3>
          <span className={styles.countBadge}>{editingDocumentProposals.length}</span>
        </div>
        <p className={styles.subsectionCopy}>
          Every target is a suggestion you can change before acceptance.
          {editingEntityProposals.length > 0
            ? ' Facts with no saved target remain blocked until you resolve the relevant entity candidate or choose an existing World Bible record.'
            : ' Accepting writes the fact only to the selected World Bible record.'}
        </p>
        {editingDocumentProposals.length === 0 ? (
          <p className={styles.emptyState}>
            No fact proposals yet. Run extraction on this document after saving it.
          </p>
        ) : (
        <div className={styles.proposalList}>
          {editingDocumentProposals.map((proposal) => (
            <article key={proposal.id} className={styles.proposalCard}>
              <div className={styles.proposalHeader}>
                <strong>{proposal.factType.replace(/_/g, ' ')}</strong>
                <span className={styles.statusBadge}>{proposal.status}</span>
              </div>
              <p className={styles.proposalValue}>{formatFactValue(proposal.value)}</p>
              <label className={styles.targetSelectLabel}>
                World Bible target
                <select
                  value={getFactProposalTargetValue(proposal)}
                  onChange={(event) =>
                    updateFactTargetDraft(proposal.id, event.target.value)
                  }
                >
                  <option value=''>Choose target</option>
                  {factLinkableTargets.map((target) => (
                    <option
                      key={target.key}
                      value={`entity:${target.targetId}`}
                    >
                      {target.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.proposalMeta}>
                Confidence: {Math.round(proposal.confidence * 100)}%
              </p>
              <p className={styles.evidenceText}>{proposal.evidence.text}</p>
              {proposal.status === 'proposed' ? (
                <div className={styles.inlineActions}>
                  <button
                    type='button'
                    onClick={() => void handleAcceptProposal(proposal)}
                    disabled={
                      actingProposalId === proposal.id ||
                      !getFactProposalTargetValue(proposal)
                    }
                  >
                    {editingEntityProposals.length > 0 && !getFactProposalTargetValue(proposal)
                      ? 'Resolve Entities First'
                      : getFactProposalTargetValue(proposal)
                        ? 'Accept'
                        : 'Choose Target'}
                  </button>
                  <button
                    type='button'
                    onClick={() => void handleRejectProposal(proposal)}
                    disabled={actingProposalId === proposal.id}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
        )}
      </div>

      <div className={styles.acceptedSection}>
        <div className={styles.cardHeader}>
          <h3>Accepted Canon</h3>
          <span className={styles.countBadge}>{editingDocumentFacts.length}</span>
        </div>
        {editingDocumentFacts.length === 0 ? (
          <p className={styles.emptyState}>No accepted facts from this document yet.</p>
        ) : (
          <div className={styles.factList}>
            {editingDocumentFacts.map((fact) => (
              <article key={fact.id} className={styles.factCard}>
                <p className={styles.proposalValue}>{buildCanonicalFactSummary(fact, sourceScenes)}</p>
                <button
                  type='button'
                  onClick={() => void handleRemoveFact(fact)}
                  disabled={removingFactId === fact.id}
                >
                  {removingFactId === fact.id ? 'Removing...' : 'Remove'}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
