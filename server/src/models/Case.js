import mongoose from 'mongoose';

const suspectSchema = new mongoose.Schema({
  id: { type: String, required: true }, name: { type: String, required: true }, role: String,
  relationship: String, motive: String, background: String, alibi: String,
  supportingEvidenceIds: [String], contradictoryEvidenceIds: [String],
}, { _id: false });

const evidenceSchema = new mongoose.Schema({
  id: { type: String, required: true }, type: { type: String, required: true }, title: { type: String, required: true },
  description: String, timestamp: String, source: String, content: { type: String, required: true },
  relatedSuspectIds: [String], assetUrl: String, assetUnavailable: { type: Boolean, default: false },
}, { _id: false });

const timelineSchema = new mongoose.Schema({ time: String, event: String, relatedEvidenceIds: [String] }, { _id: false });

const caseSchema = new mongoose.Schema({
  caseNumber: { type: String, unique: true, index: true }, ownerHash: { type: String, required: true, index: true },
  status: { type: String, enum: ['generating', 'validating', 'ready', 'failed'], default: 'generating', index: true },
  generationError: { type: String, select: false },
  scenario: { type: String, required: true }, difficulty: String, suspectCount: Number, category: String, requestedEvidenceTypes: [String],
  title: String, summary: String,
  incident: { location: String, dateTime: String, description: String, initialFacts: [String] },
  suspects: [suspectSchema], evidence: [evidenceSchema], timeline: [timelineSchema],
  solution: { type: mongoose.Schema.Types.Mixed, select: false },
}, { timestamps: true, minimize: false });

caseSchema.index({ ownerHash: 1, createdAt: -1 });
export const Case = mongoose.model('Case', caseSchema);
