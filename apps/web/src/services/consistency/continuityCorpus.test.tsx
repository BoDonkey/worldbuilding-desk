import {describe, expect, it} from 'vitest';
import {CONTINUITY_CORPUS} from '../../fixtures/continuityCorpus';
import {evaluateContinuityCase, runContinuityCase, summarizeCorpusEvaluations, toCanonicalFacts} from './continuityCorpus';
import {selectCanonCheckFacts, validateCanonCheckCandidates} from './modelCanonCheck';

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

  it('measures the model-assisted check separately: its targets are structural non-hits it can cite (4.38)', async () => {
    const cases = CONTINUITY_CORPUS.filter((corpusCase) => corpusCase.modelCheckTargets?.length);
    expect(cases.length).toBeGreaterThan(0);
    for (const corpusCase of cases) {
      const run = await runContinuityCase(corpusCase);
      const facts = toCanonicalFacts(corpusCase);
      for (const target of corpusCase.modelCheckTargets ?? []) {
        const fact = facts[target.factIndex];
        // The structural comparator misses it: that is why the model path exists.
        expect(
          run.findings.filter((finding) => finding.code === 'STATE_CONFLICT' && finding.entityIds.includes(fact.targetId)),
          `${corpusCase.id}: structural hit`
        ).toEqual([]);
        const scene = corpusCase.scenes.find((entry) => entry.id === target.sceneId);
        expect(scene, corpusCase.id).toBeDefined();
        const selected = selectCanonCheckFacts({
          sceneText: scene!.text,
          entities: corpusCase.entities.map((entity) => ({id: entity.id, name: entity.name, aliases: entity.aliases ?? []})),
          facts
        });
        const sent = selected.find((entry) => entry.fact.id === fact.id);
        expect(sent, `${corpusCase.id}: fact not sent`).toBeDefined();
        const {accepted} = validateCanonCheckCandidates({
          candidates: [{factId: sent!.ref, evidence: {text: target.evidence}, summary: target.note}],
          sceneText: scene!.text,
          facts: selected
        });
        expect(accepted.map((entry) => entry.evidence.text), corpusCase.id).toEqual([target.evidence]);
      }
    }
  });
});
