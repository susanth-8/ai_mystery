import mongoose from 'mongoose';

const investigationSchema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true, index: true },
  ownerHash: { type: String, required: true, index: true },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  viewedEvidenceIds: { type: [String], default: [] },
  accusation: { suspectId: String, reasoning: String, submittedAt: Date },
  result: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

investigationSchema.index({ caseId: 1, ownerHash: 1 }, { unique: true });
export const Investigation = mongoose.model('Investigation', investigationSchema);
