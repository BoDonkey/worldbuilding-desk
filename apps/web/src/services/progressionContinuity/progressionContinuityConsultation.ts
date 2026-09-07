import type {ProgressionContinuityCandidate} from './progressionContinuityCandidates';

const KIND_DESCRIPTIONS: Record<ProgressionContinuityCandidate['kind'], string> = {
  unused_solution:
    'a character has an established ability that would plainly resolve a situation, and the ' +
    'text never has them consider it',
  abandoned_progression_method:
    'a named, rapid-advancement method is established once and never referenced again, with no ' +
    'in-world reason given'
};

const KIND_QUESTION: Record<ProgressionContinuityCandidate['kind'], string> = {
  unused_solution:
    'Does any of the cited evidence show a situation this ability would plainly resolve, where ' +
    "the character doesn't even consider it? Or is the omission unremarkable (the situation " +
    "doesn't call for it, or the character has a good reason not to use it)?",
  abandoned_progression_method:
    'Does the absence of any later reference look like a genuine gap, or is there a plausible ' +
    'in-world reason apparent from the evidence (e.g. the method is explicitly limited, ' +
    "dangerous, or was later superseded)?"
};

export function buildProgressionContinuityConsultationPrompt(params: {
  candidate: ProgressionContinuityCandidate;
  evidence: Array<{sceneTitle: string; excerpt: string}>;
}): {systemPrompt: string; userPrompt: string} {
  const {candidate, evidence} = params;

  const systemPrompt =
    'You are checking one deterministic shortlist candidate for a craft-and-continuity pattern ' +
    'in a fiction manuscript. Deterministic code produced this candidate using only lexical ' +
    'absence in the evidence given below - it has not read anything else, and neither have you. ' +
    'Do not assume anything about the manuscript beyond that evidence.\n\n' +
    'Be concise and specific, quoting or pointing to the evidence. This is advice for the ' +
    "author to weigh, not a decision - false positives are expected and normal, so say plainly " +
    'when the evidence does not support a genuine finding.\n\n' +
    'After your explanation, add exactly one final line, on its own, in precisely this form: ' +
    '"Verdict: finding" or "Verdict: not_a_finding". Do not add any text after that line.';

  const evidenceText = evidence.length > 0
    ? evidence.map((item) => `Scene "${item.sceneTitle}":\n${item.excerpt}`).join('\n\n')
    : '(No scene evidence was available.)';

  const userPrompt =
    `Candidate pattern: ${KIND_DESCRIPTIONS[candidate.kind]}\n` +
    `Subject: ${candidate.subjectLabel}\n` +
    `Detail: ${candidate.detailText}\n\n` +
    `Evidence:\n${evidenceText}\n\n` +
    `Question:\n${KIND_QUESTION[candidate.kind]}`;

  return {systemPrompt, userPrompt};
}
