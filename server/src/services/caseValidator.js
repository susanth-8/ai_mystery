import { AppError } from '../utils/errors.js';

const allowedTypes = new Set(['chat', 'image', 'cctv', 'witness', 'document', 'timeline', 'physical']);

export function validateMystery(mystery, expectedSuspects) {
  const fail = (message) => { throw new Error(`Mystery validation failed: ${message}`); };
  if (!mystery || typeof mystery !== 'object') fail('response must be an object');
  for (const field of ['title', 'summary', 'incident', 'suspects', 'evidence', 'timeline', 'solution']) if (!mystery[field]) fail(`missing ${field}`);
  if (mystery.suspects.length !== expectedSuspects) fail('suspect count does not match the request');
  if (mystery.evidence.length < 8) fail('at least eight evidence items are required');
  if (mystery.timeline.length < 4) fail('timeline needs at least four events');
  const suspectIds = new Set(mystery.suspects.map((s) => s.id));
  const evidenceIds = new Set(mystery.evidence.map((e) => e.id));
  if (suspectIds.size !== mystery.suspects.length) fail('suspect IDs must be unique');
  if (evidenceIds.size !== mystery.evidence.length) fail('evidence IDs must be unique');
  if (!suspectIds.has(mystery.solution.culpritSuspectId)) fail('culprit must be one of the suspects');
  if (new Set(mystery.evidence.map((e) => e.type)).size < 3) fail('at least three evidence types are required');
  for (const suspect of mystery.suspects) {
    for (const key of ['name', 'role', 'relationship', 'motive', 'background', 'alibi']) if (typeof suspect[key] !== 'string' || !suspect[key].trim()) fail(`suspect is missing ${key}`);
    for (const id of [...(suspect.supportingEvidenceIds || []), ...(suspect.contradictoryEvidenceIds || [])]) if (!evidenceIds.has(id)) fail(`suspect references unknown evidence ${id}`);
  }
  const culprit = mystery.suspects.find((s) => s.id === mystery.solution.culpritSuspectId);
  if ((culprit.supportingEvidenceIds || []).length < 2) fail('culprit needs at least two supporting evidence references');
  const innocentSuspicion = mystery.suspects.filter((s) => s.id !== culprit.id).reduce((total, s) => total + (s.supportingEvidenceIds || []).length, 0);
  if (innocentSuspicion < 2) fail('innocent suspects need evidence that reasonably creates suspicion');
  for (const item of mystery.evidence) {
    if (!item.id || !item.title || !item.content || !allowedTypes.has(item.type)) fail('evidence item is incomplete or has an unsupported type');
    for (const id of item.relatedSuspectIds || []) if (!suspectIds.has(id)) fail(`evidence references unknown suspect ${id}`);
  }
  for (const event of mystery.timeline) for (const id of event.relatedEvidenceIds || []) if (!evidenceIds.has(id)) fail(`timeline references unknown evidence ${id}`);
  const solution = mystery.solution;
  for (const key of ['motive', 'eventSequence', 'method', 'opportunity', 'explanation', 'misleadingClues']) if (typeof solution[key] !== 'string' || !solution[key].trim()) fail(`solution is missing ${key}`);
  if (!Array.isArray(solution.decisiveEvidenceIds) || solution.decisiveEvidenceIds.length < 2 || solution.decisiveEvidenceIds.some((id) => !evidenceIds.has(id))) fail('solution must reference existing decisive evidence');
  if (!solution.decisiveEvidenceIds.some((id) => (culprit.supportingEvidenceIds || []).includes(id))) fail('decisive evidence must support the culprit link');
  if (!solution.decisiveEvidenceIds.every((id) => solution.explanation.includes(id))) fail('final explanation must cite decisive evidence IDs');
  return mystery;
}

export function safeCase(document, investigation) {
  if (!document) throw new AppError(404, 'CASE_NOT_FOUND', 'The requested case could not be found.');
  const item = document.toObject ? document.toObject() : document;
  return {
    id: item._id.toString(), caseNumber: item.caseNumber, status: item.status, title: item.title,
    summary: item.summary, category: item.category, difficulty: item.difficulty, suspectCount: item.suspectCount,
    incident: item.incident, suspects: item.suspects, evidence: item.evidence.map(({ content, ...metadata }) => metadata),
    timeline: item.timeline, createdAt: item.createdAt,
    investigation: investigation ? { status: investigation.status, viewedEvidenceIds: investigation.viewedEvidenceIds } : null,
  };
}
