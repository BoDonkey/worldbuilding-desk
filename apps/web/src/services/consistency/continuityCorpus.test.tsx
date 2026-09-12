import {describe, expect, it} from 'vitest';
import {CONTINUITY_CORPUS} from '../../fixtures/continuityCorpus';
import {evaluateContinuityCase, runContinuityCase, summarizeCorpusEvaluations} from './continuityCorpus';

// .test.tsx so validateProposal's guardrail-event writes hit fake-indexeddb
// under the jsdom project (see vitest.config.ts).
describe('continuity review regression corpus (slice 4.23)', () => {
  it('has unique case ids and at least one expectation per case', () => {
    const ids = CONTINUITY_CORPUS.map((corpusCase) => corpusCase.id);
    expect(new Set(ids).size).toBe(ids.length);
    CONTINUITY_CORPUS.forEach((corpusCase) => {
      expect(
        corpusCase.expected.length +
          corpusCase.expectedAbsent.length +
          (corpusCase.expectedNotResolved?.length ?? 0) +
          (corpusCase.expectedNoConflictFor?.length ?? 0),
        `${corpusCase.id} asserts nothing`
      ).toBeGreaterThan(0);
    });
  });

  it('finds every planted issue, surfaces none of the planted absences, and keeps known gaps honest', async () => {
    const evaluations = [];
    for (const corpusCase of CONTINUITY_CORPUS) {
      evaluations.push(evaluateContinuityCase(corpusCase, await runContinuityCase(corpusCase)));
    }
    const summary = summarizeCorpusEvaluations(evaluations);
    const problems = evaluations.filter(
      (item) =>
        item.missed.length > 0 ||
        item.absenceViolations.length > 0 ||
        item.resolutionViolations.length > 0 ||
        item.conflictViolations.length > 0 ||
        item.unanchoredFindings.length > 0 ||
        item.healedKnownGaps.length > 0
    );
    expect(problems.map((item) => item.caseId), `\n${summary}\n`).toEqual([]);
  });
});
