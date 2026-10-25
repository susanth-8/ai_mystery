# API reference

All endpoints are under `/api/v1` and return `{ success, data }` or `{ success: false, error: { code, message } }`. Case routes require the anonymous HTTP-only `amr_session` cookie issued by `POST /session`.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Service and database readiness |
| POST | `/session` | Create anonymous owner session |
| POST | `/cases` | Start validated case generation |
| GET | `/cases/:caseId/status` | Read generation status |
| GET | `/cases/:caseId` | Read public case (solution omitted) |
| GET | `/cases/:caseId/evidence/:evidenceId` | Read a public evidence item |
| PATCH | `/cases/:caseId/investigation` | Save viewed evidence IDs |
| POST | `/cases/:caseId/accusation` | Finalize one accusation and reveal result |
| GET | `/cases/:caseId/results` | Read results after completion only |

Create case body: `scenario`, `difficulty` (`easy|medium|hard`), `suspectCount` (3–6), `category`, and `evidenceTypes`. Accusation body: `suspectId`, optional `reasoning`.
