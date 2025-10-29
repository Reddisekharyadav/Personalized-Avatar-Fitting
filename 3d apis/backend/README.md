# Virtual Dressing Backend

## Endpoints


### GET `/api/outfits`
- Optional query param: `q` (e.g., `?q=suit`)
- Returns: `{ outfits: [ { name, thumbnail, glbUrl } ] }`

## Setup
1. Copy `.env` and fill in your API keys.
2. `npm install`
3. `npm run dev` (for development)

## Notes
- Ready Player Me and Sketchfab API integration is basic; update as needed for production.
- Avatars are stored in `/avatars` folder.
