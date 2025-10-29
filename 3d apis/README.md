# Personalized Avatar Fitting

A web application for creating and customizing 3D avatars with virtual clothing using React, Next.js, Node.js, and Three.js.

## Project Structure

- `backend/` - Node.js/Express backend API server
- `frontend/` - Next.js React frontend

## Updated Project Structure

The project is organized as follows:

```plaintext
project/
├── backend/                # Backend API server (Node.js/Express)
│   ├── index.js           # Main entry point for the backend
│   ├── package.json       # Backend dependencies and scripts
│   ├── routes/            # API route handlers
│   │   ├── tryon2d.js     # Endpoint for 2D try-on functionality
│   ├── models/            # Mongoose models
│   │   ├── User.js        # User schema and model
│   │   ├── WardrobeItem.js # Wardrobe item schema and model
│   ├── scripts/           # Utility scripts for model conversion
│   ├── uploads/           # Directory for uploaded files
│   ├── avatars/           # Directory for avatar-related files
│   ├── cache/             # Cache for temporary files
│   └── utils/             # Utility functions
├── frontend/               # Frontend application (Next.js/React)
│   ├── components/        # React components
│   ├── pages/             # Next.js pages
│   ├── public/            # Static assets
│   ├── styles/            # Global styles
│   ├── utils/             # Utility functions (e.g., API client)
│   ├── package.json       # Frontend dependencies and scripts
│   └── README.md          # Frontend-specific documentation
├── README.md               # Project documentation
```

This structure ensures a clear separation of concerns between the backend and frontend, making the project easier to navigate and maintain.

---

### Backend Setup

1. Navigate to the backend folder:

   ```powershell
   cd backend
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create a `.env` file with the following variables:

   ```plaintext
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret
   SKETCHFAB_API_TOKEN=your_sketchfab_api_token
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

The backend will be available at [http://localhost:5000](http://localhost:5000).

---

### Frontend Setup

1. Navigate to the frontend folder:

   ```powershell
   cd frontend
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Create a `.env.local` file with the following variables:

   ```plaintext
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

---

### 3D Model Conversion Utilities

The project includes utilities to convert GLTF models to GLB format, which helps solve common texture loading and resource reference issues.

#### Why Use These Utilities

GLTF files often have external dependencies (textures, bin files) that can cause loading errors:

- 404 errors when loading textures
- Missing "scene.bin" files
- Incorrect relative paths

GLB is a binary format that packages all resources into a single file, eliminating these issues.

#### Available Scripts

Run these scripts from the `backend` directory:

1. **Complete Conversion Workflow**

   The easiest way to convert models:

   ```powershell
   npm run convert-workflow
   ```

   This guided process will:

   1. Scan your project for models that need conversion
   2. Convert GLTF models to GLB format
   3. Find code references that need updating
   4. Verify conversion results

2. **Individual Scripts**

   If you prefer to run steps individually:

   ```powershell
   # Scan for models that need conversion
   npm run scan-models

   # Convert a single model
   npm run gltf-to-glb -- "path/to/model.gltf" "path/to/output.glb"

   # Batch convert all models in a directory
   npm run convert-batch -- "path/to/models"

   # Find code references to update
   npm run find-references
   ```

For more details, see the conversion utilities documentation in `backend/scripts/README.md`.