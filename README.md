# AI Mystery Room

An AI-powered fictional investigation game built with React, Express, MongoDB, and Google Gemini.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB (local or hosted)
- Google Gemini API key for case generation

## Setup

1. Install dependencies from the repository root: `npm install`, `npm install --prefix client`, and `npm install --prefix server`.
2. Copy `server/.env.example` to `server/.env` and set `MONGODB_URI`, `GEMINI_API_KEY`, and a long random `SESSION_SECRET`.
3. Copy `client/.env.example` to `client/.env.local` if the API is not at its default URL.
4. Start both apps with `npm run dev` (client at port 5173, API at port 5000).

The Gemini key is optional for the server to start, but case generation returns a clear provider-configuration error until it is set. MongoDB is required for persistent cases and anonymous ownership. All cases are fictional; do not submit real private conversations, photographs, or surveillance footage.

## Project map

- `client/`: React/Vite application and investigation interface.
- `server/`: Express API, Gemini generation and validation, MongoDB models, anonymous session ownership.
- `docs/`: API and architecture notes.
- `spec.md`: product source specification.

## API

The API is rooted at `/api/v1`. See [docs/API.md](docs/API.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Current implementation notes

Image and CCTV evidence are represented as fictional text-based evidence cards unless a media provider is configured. Cases can be created, investigated, and solved end to end. The server never sends the solution before an accusation is finalized.
