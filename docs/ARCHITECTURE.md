# Architecture

The Vite React client handles navigation, forms, evidence presentation, and progress display. The Express API owns authorization, generation, validation, persistence, and accusation evaluation. Mongoose stores each case with its solution in a server-only field and stores one investigation per anonymous session and case. The API serializes only allow-listed public fields until the investigation is complete.

Anonymous ownership uses a cryptographically random token in an HttpOnly cookie; MongoDB stores its SHA-256 hash. Generation runs asynchronously and reports persisted status. Gemini output is requested as JSON and validated against structural, cross-reference, suspect-count, evidence-count, and solution requirements before a case becomes playable. Provider/media keys are server-only.

The optional media integration is deliberately represented by typed evidence content and unavailable-asset fallbacks. No image/video generation credentials are required for a playable text investigation.
