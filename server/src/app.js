import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { env } from './config/env.js';
import { Case } from './models/Case.js';
import { Investigation } from './models/Investigation.js';
import { issueSession, requireSession } from './middleware/session.js';
import { generateMystery } from './services/gemini.js';
import { safeCase } from './services/caseValidator.js';
import { AppError, errorHandler, notFound } from './utils/errors.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
app.use((req, _res, next) => {
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) && req.get('origin') && req.get('origin') !== env.clientOrigin) return next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This request origin is not allowed.'));
  next();
});
const api = express.Router();
const generalLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait and try again.' } } });
const generationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message: 'You have started several cases recently. Please try again later.' } } });
api.use(generalLimit);

const createSchema = z.object({
  scenario: z.string().trim().min(30).max(3000),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  suspectCount: z.coerce.number().int().min(3).max(6).default(4),
  category: z.string().trim().min(1).max(60).default('general'),
  evidenceTypes: z.array(z.enum(['chat', 'image', 'cctv', 'witness', 'document', 'timeline', 'physical'])).min(1).max(7).default(['chat', 'image', 'cctv', 'witness', 'document', 'timeline']),
});
const idPattern = /^[a-f\d]{24}$/i;
const validateId = (value) => { if (!idPattern.test(value)) throw new AppError(400, 'VALIDATION_ERROR', 'The case reference is invalid.'); };
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const ownedCase = async (caseId, ownerHash) => {
  validateId(caseId);
  const item = await Case.findOne({ _id: caseId, ownerHash });
  if (!item) throw new AppError(404, 'CASE_NOT_FOUND', 'The requested case could not be found.');
  return item;
};
const investigationFor = async (caseId, ownerHash) => {
  const investigation = await Investigation.findOne({ caseId, ownerHash });
  if (!investigation) throw new AppError(404, 'CASE_NOT_FOUND', 'The requested case could not be found.');
  return investigation;
};

api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok', database: Case.db.readyState === 1 ? 'connected' : 'disconnected' } }));
api.post('/session', issueSession);

api.post('/cases', generationLimit, requireSession, asyncRoute(async (req, res) => {
  const input = createSchema.safeParse(req.body);
  if (!input.success) throw new AppError(400, 'VALIDATION_ERROR', input.error.issues[0]?.message || 'Check the scenario and case settings.');
  const payload = input.data;
  const caseNumber = `MR-${randomBytes(3).toString('hex').toUpperCase()}`;
  const item = await Case.create({ caseNumber, ownerHash: req.ownerHash, status: 'generating', ...payload });
  await Investigation.create({ caseId: item._id, ownerHash: req.ownerHash });
  generateMystery(payload, () => Case.updateOne({ _id: item._id, status: 'generating' }, { $set: { status: 'validating' } })).then(async (mystery) => {
    mystery.evidence = mystery.evidence.map((entry) => (entry.type === 'image' || entry.type === 'cctv') ? { ...entry, assetUnavailable: true } : entry);
    item.title = mystery.title; item.summary = mystery.summary; item.incident = mystery.incident;
    item.suspects = mystery.suspects; item.evidence = mystery.evidence; item.timeline = mystery.timeline;
    item.solution = mystery.solution; item.status = 'ready'; await item.save();
  }).catch(async (error) => {
    console.error(`[generation] ${item._id}: ${error.code || 'GENERATION_FAILED'} ${error.message}`);
    await Case.updateOne({ _id: item._id }, { $set: { status: 'failed', generationError: error.code === 'AI_PROVIDER_ERROR' ? 'Case generation is temporarily unavailable.' : 'The case could not be validated. Please try again.' } });
  });
  res.status(202).json({ success: true, data: { caseId: item._id.toString(), status: 'generating' } });
}));

api.get('/cases/:caseId/status', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  const data = { caseId: item._id.toString(), status: item.status };
  if (item.status === 'failed') { const failed = await Case.findById(item._id).select('+generationError'); data.error = failed?.generationError; }
  res.json({ success: true, data });
}));

api.get('/cases/:caseId', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  if (item.status === 'failed') throw new AppError(422, 'GENERATION_FAILED', 'This case could not be generated. Start a new investigation.');
  if (item.status !== 'ready') throw new AppError(409, 'CASE_NOT_READY', 'This case is still being prepared.');
  const investigation = await investigationFor(item._id, req.ownerHash);
  res.json({ success: true, data: safeCase(item, investigation) });
}));

api.get('/cases/:caseId/evidence/:evidenceId', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  if (item.status !== 'ready') throw new AppError(409, 'CASE_NOT_READY', 'This case is still being prepared.');
  const evidence = item.evidence.find((entry) => entry.id === req.params.evidenceId);
  if (!evidence) throw new AppError(404, 'INVALID_EVIDENCE', 'That evidence does not belong to this case.');
  const { _id, type, title, description, timestamp, source, content, relatedSuspectIds, assetUrl, assetUnavailable } = evidence.toObject();
  res.json({ success: true, data: { id: _id || evidence.id, type, title, description, timestamp, source, content, relatedSuspectIds, assetUrl, assetUnavailable } });
}));

api.patch('/cases/:caseId/investigation', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  if (item.status !== 'ready') throw new AppError(409, 'CASE_NOT_READY', 'This case is still being prepared.');
  const schema = z.object({ viewedEvidenceIds: z.array(z.string().min(1).max(80)).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || parsed.data.viewedEvidenceIds.some((id) => !item.evidence.some((entry) => entry.id === id))) throw new AppError(400, 'INVALID_EVIDENCE', 'One or more evidence references are invalid.');
  const investigation = await investigationFor(item._id, req.ownerHash);
  if (investigation.status === 'completed') throw new AppError(409, 'ALREADY_COMPLETED', 'This investigation has already been completed.');
  investigation.viewedEvidenceIds = parsed.data.viewedEvidenceIds; await investigation.save();
  res.json({ success: true, data: { status: investigation.status, viewedEvidenceIds: investigation.viewedEvidenceIds } });
}));

api.post('/cases/:caseId/accusation', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  if (item.status !== 'ready') throw new AppError(409, 'CASE_NOT_READY', 'This case is still being prepared.');
  const parsed = z.object({ suspectId: z.string().min(1).max(80), reasoning: z.string().max(1000).optional().default('') }).safeParse(req.body);
  if (!parsed.success) throw new AppError(400, 'VALIDATION_ERROR', 'Choose a suspect and keep reasoning under 1,000 characters.');
  const suspect = item.suspects.find((entry) => entry.id === parsed.data.suspectId);
  if (!suspect) throw new AppError(400, 'INVALID_SUSPECT', 'That suspect does not belong to this case.');
  const investigation = await investigationFor(item._id, req.ownerHash);
  if (investigation.status === 'completed') throw new AppError(409, 'ALREADY_COMPLETED', 'This accusation has already been finalized.');
  const secretCase = await Case.findOne({ _id: item._id, ownerHash: req.ownerHash }).select('+solution');
  const solution = secretCase.solution;
  const culprit = item.suspects.find((entry) => entry.id === solution.culpritSuspectId);
  const byId = new Map(item.evidence.map((entry) => [entry.id, entry]));
  const result = {
    correct: suspect.id === solution.culpritSuspectId, selectedSuspectId: suspect.id,
    culprit: { suspectId: culprit.id, name: culprit.name }, motive: solution.motive, method: solution.method,
    eventSequence: solution.eventSequence, explanation: solution.explanation, misleadingClues: solution.misleadingClues,
    decisiveEvidence: solution.decisiveEvidenceIds.map((id) => byId.get(id)).filter(Boolean).map((entry) => ({ id: entry.id, type: entry.type, title: entry.title, content: entry.content })),
    finalTimeline: item.timeline,
  };
  const finalized = await Investigation.findOneAndUpdate(
    { _id: investigation._id, ownerHash: req.ownerHash, status: 'active' },
    { $set: { status: 'completed', accusation: { suspectId: suspect.id, reasoning: parsed.data.reasoning, submittedAt: new Date() }, result } },
    { new: true },
  );
  if (!finalized) throw new AppError(409, 'ALREADY_COMPLETED', 'This accusation has already been finalized.');
  res.json({ success: true, data: result });
}));

api.get('/cases/:caseId/results', requireSession, asyncRoute(async (req, res) => {
  const item = await ownedCase(req.params.caseId, req.ownerHash);
  const investigation = await investigationFor(item._id, req.ownerHash);
  if (investigation.status !== 'completed' || !investigation.result) throw new AppError(403, 'CASE_NOT_COMPLETED', 'Submit a final accusation before viewing the solution.');
  res.json({ success: true, data: investigation.result });
}));

app.use('/api/v1', api);
app.use(notFound);
app.use(errorHandler);
export default app;
