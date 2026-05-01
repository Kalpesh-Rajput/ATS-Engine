# ⚡ ATS — AI-Powered Applicant Tracking System

This guide walks you through running the entire project on your local machine **without Docker**.

---

## 📦 What You Need to Install

| Software | Version | Download |
|---|---|---|
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Node.js** | 18+ | https://nodejs.org/ |
| **PostgreSQL** | 15 or 16 | https://www.postgresql.org/download/ |
| **Redis** | 7+ | See instructions below |

---

## 🏗️ Project Structure

```
ats-system/
├── .env                    ← Edit this with your credentials
├── backend/                ← Python FastAPI server
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/            ← DB migration scripts
│   └── app/
├── frontend/               ← React + Vite web UI
│   ├── package.json
│   └── src/
└── scripts/
    ├── init_db.sql          ← Run once to set up DB extensions + seed admin
    └── create_admin.py      ← Create new admin accounts
```

---

## STEP 1 — Install Python 3.11+

### Windows:
1. Go to https://www.python.org/downloads/
2. Download Python 3.11 or 3.12
3. Run installer — **tick "Add Python to PATH"** before clicking Install
4. Verify: open Command Prompt and run:
   ```
   python --version
   ```

### Mac:
```bash
brew install python@3.11
python3 --version
```

### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip -y
python3.11 --version
```

---

## STEP 2 — Install Node.js 18+

### Windows & Mac:
1. Go to https://nodejs.org/
2. Download the **LTS** version (18 or 20)
3. Run installer with all defaults
4. Verify:
   ```
   node --version
   npm --version
   ```

### Linux:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
node --version
```

---

## STEP 3 — Set Up PostgreSQL

You mentioned you already have PostgreSQL installed. Follow these steps to create the database and user.

### Open the PostgreSQL shell:

**Windows:** Open "SQL Shell (psql)" from Start Menu
**Mac/Linux:**
```bash
sudo -u postgres psql
```

### Run these commands in the psql shell:

```sql
-- Create the database user
CREATE USER ats_user WITH PASSWORD 'ats_password';

-- Create the database
CREATE DATABASE ats_db OWNER ats_user;

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE ats_db TO ats_user;

-- Connect to the new database
\c ats_db

-- Install uuid extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exit
\q
```

---

## STEP 4 — Install Redis

Redis is used as the task queue (Celery broker).

### Windows:
Redis doesn't have an official Windows build. Use one of these options:

**Option A — WSL (Recommended):**
1. Open PowerShell as Administrator, run: `wsl --install`
2. Restart, open Ubuntu terminal, then:
   ```bash
   sudo apt update && sudo apt install redis-server -y
   sudo service redis-server start
   ```

**Option B — Memurai (Redis-compatible for Windows):**
Download from https://www.memurai.com/ — free developer version available.

### Mac:
```bash
brew install redis
brew services start redis
```

### Linux:
```bash
sudo apt install redis-server -y
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

---

## STEP 5 — Get a Free Groq API Key

1. Go to https://console.groq.com
2. Sign up (free, no credit card needed)
3. Click **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_...`)

---

## STEP 6 — Configure the `.env` File

Open the `.env` file in the root `ats-system/` folder with any text editor.

Make these changes:

```env
# Change GROQ_API_KEY to your actual key:
GROQ_API_KEY=gsk_your_actual_key_here

# Change SECRET_KEY to any random string (32+ characters):
SECRET_KEY=myrandomsecretkey1234567890abcdefgh

# These are already set correctly for local use:
POSTGRES_HOST=localhost
DATABASE_URL=postgresql+asyncpg://ats_user:ats_password@localhost:5432/ats_db
DATABASE_URL_SYNC=postgresql://ats_user:ats_password@localhost:5432/ats_db
REDIS_URL=redis://localhost:6379/0

```

> If you used a different PostgreSQL password in Step 3, update `ats_password` in the `DATABASE_URL` lines accordingly.

---

## STEP 7 — Set Up the Python Backend

Open a terminal and navigate into the `backend/` folder:

```bash
cd path/to/ats-system/backend
```

### Create a virtual environment:

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**Mac/Linux:**
```bash
python3.11 -m venv venv
source venv/bin/activate
```

You should see `(venv)` at the start of your terminal prompt.

### Install Python dependencies:
```bash
pip install -r requirements.txt
```

> This installs ~30 packages including FastAPI, SQLAlchemy, Celery, LangChain, sentence-transformers, etc. It may take 3–5 minutes.

### Create the uploads folder:
```bash
mkdir -p uploads
```

---

## STEP 8 — Run Database Migrations

Still inside `backend/` with the virtual environment active:

```bash
alembic upgrade head
```

This creates all the database tables (`recruiters`, `candidates`, `scoring_jobs`).

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial, Initial schema
```

### Seed the default admin account:

Run this SQL to create the default admin (password: `Admin@123`):

**Windows (in psql shell):**
```sql
\c ats_db
INSERT INTO recruiters (id, user_name, email, hashed_password, is_active, is_admin)
VALUES (
  uuid_generate_v4(),
  'Admin',
  'admin@ats.com',
  '$argon2id$v=19$m=65540,t=3,p=4$bXk0YzQ2OTI0YjEyODYxZQ$TRFOxyXmDVlXYuTDm8d4kA',
  true,
  true
) ON CONFLICT (email) DO NOTHING;
```

**Mac/Linux:**
```bash
psql -U ats_user -d ats_db -f ../scripts/init_db.sql
```

---

## STEP 9 — Set Up the Frontend

Open a **new terminal** (keep the backend terminal open), navigate to `frontend/`:

```bash
cd path/to/ats-system/frontend
npm install
```

This installs React, Vite, TailwindCSS, and all other JS packages (~300 MB in `node_modules/`).

---

## STEP 10 — Start All Services

You need **4 terminal windows** running simultaneously:

### Terminal 1 — Make sure Redis is running
```bash
# Mac:
brew services start redis

# Linux:
sudo service redis-server start

# Windows (WSL):
sudo service redis-server start

# Verify:
redis-cli ping   # should print PONG
```

### Terminal 2 — Start the FastAPI Backend
```bash
cd path/to/ats-system/backend
source venv/bin/activate      # Mac/Linux
# OR: venv\Scripts\activate   # Windows

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

You should see:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Terminal 3 — Start the Celery Worker
```bash
cd path/to/ats-system/backend
source venv/bin/activate      # Mac/Linux
# OR: venv\Scripts\activate   # Windows

celery -A app.core.celery_app worker --loglevel=info --concurrency=2
celery -A app.core.celery_app worker --loglevel=info --pool=solo   # should use this 

```

### Terminal 4 — Start the React Frontend
```bash
cd path/to/ats-system/frontend
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

---

## STEP 12 — Verify Everything Works

Open your browser and check:

| Service | URL | Expected |
|---|---|---|
| **Frontend** | http://localhost:5173 | Login page |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **Health Check** | http://localhost:8000/api/v1/health | `{"status":"ok"}` |
| **Qdrant UI** | http://localhost:6333/dashboard | Qdrant dashboard |

### Log in:
- Email: `admin@ats.com`
- Password: `Admin@123`

---

## 🔧 Common Errors and Fixes

### ❌ `ModuleNotFoundError` when starting backend
**Fix:** Make sure your virtual environment is activated:
```bash
source venv/bin/activate   # Mac/Linux
venv\Scripts\activate      # Windows
```

### ❌ `could not connect to server` (PostgreSQL error)
**Cause:** PostgreSQL is not running or wrong credentials.
**Fix:**
```bash
# Mac:
brew services start postgresql

# Linux:
sudo systemctl start postgresql

# Windows: Open Services → find PostgreSQL → Start
```
Also double-check that `.env` has `POSTGRES_HOST=localhost` (not `postgres`).

### ❌ `Error 111 connecting to localhost:6379` (Redis error)
**Cause:** Redis is not running.
**Fix:** Start Redis (see Terminal 1 instructions above).

### ❌ `Connection refused` to Qdrant
**Cause:** Qdrant binary is not running.
**Fix:** Start the Qdrant binary (see Terminal 2 instructions above).

### ❌ `CREATE EXTENSION vector` fails
**Cause:** pgvector is not installed for your PostgreSQL version.
**Fix:** Install pgvector matching your PostgreSQL version (see Step 3 above).

### ❌ Frontend shows API errors / CORS errors
**Fix:** Make sure the backend is running on port 8000, and that `.env` has:
```
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

### ❌ Alembic migration fails: `column already exists`
**Cause:** Tables were partially created already.
**Fix:** Drop and recreate:
```sql
-- In psql:
\c ats_db
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO ats_user;
```
Then re-run `alembic upgrade head`.

### ❌ `pip install` fails on `sentence-transformers`
**Fix:** Make sure you have Python 3.11+ and upgrade pip first:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### ❌ `celery` command not found
**Fix:** Make sure virtual environment is active and install succeeded:
```bash
pip install celery==5.4.0
```

---

## 📋 Quick-Start Cheatsheet (After First Setup)

Every time you want to run the project, open 4 terminals:

```bash
# Terminal 1 — Redis (Mac)
brew services start redis

# Terminal 2 — Qdrant
./path/to/qdrant

# Terminal 3 — Backend
cd ats-system/backend && source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 4 — Celery Worker
cd ats-system/backend && source venv/bin/activate
celery -A app.core.celery_app worker --loglevel=info --concurrency=2

# Terminal 5 — Frontend
cd ats-system/frontend
npm run dev
```

Then open http://localhost:5173

---

## 🌐 All URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API (Swagger docs) | http://localhost:8000/docs |
| API (Redoc) | http://localhost:8000/redoc |
| Health check | http://localhost:8000/api/v1/health |
| Qdrant Dashboard | http://localhost:6333/dashboard |

---

## 👤 Default Login

| Field | Value |
|---|---|
| Email | admin@ats.com |
| Password | Admin@123 |




--- If comflict happen in vector.index

Options
Keep and save your local changes:

git stash push -m "save local vector index changes"
git pull origin main
later: git stash pop
Discard local changes and pull:

git checkout -- candidates.faiss backend/vector_indices/candidates_metadata.pkl
git pull origin main
Commit local changes if you want them in history:

git add candidates.faiss backend/vector_indices/candidates_metadata.pkl
git commit -m "Save local vector indices"
git pull origin main


alembic error solution
check current version : alembic current 
chnage code with down_revision : alembic stamp d323aee86632
final : alembic upgrade head




# MinIO Setup

👉 Download MinIO server:
https://dl.min.io/server/minio/release/windows-amd64/minio.exe

mkdir C:\minio  - create a  folder any where in working folder most same user that you are working on

-move this file to that folder 
-Open terminal and run the command

$env:MINIO_ROOT_USER="minioadmin"; $env:MINIO_ROOT_PASSWORD="minioadmin"; .\minio.exe server C:\minio\data --console-address ":9001"

```

- **API endpoint:** `http://localhost:9000`
- **Console:** `http://localhost:9001` (user: `minioadmin`, pass: `minioadmin`)

## 2. Create Bucket in MinIO

folder name  - ats-bucket

In your project root path creatre folder  = ats-bucket , then copy this path and past this in minIO under (Create new Path)



## 3. Environment variables (already set in `.env`)

```env
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
```

## 4. How it works

- Resumes and LinkedIn profiles are stored in MinIO (not local disk)
- Each recruiter gets their own bucket: `ats-resumes-{recruiter_id}`
- View/download links use presigned URLs (1-hour expiry)
- Celery workers stream files from MinIO to temp local paths for parsing

> **Existing candidates** with local file paths will need to be re-uploaded to appear in MinIO.



# LangSmith Integration Guide

### 1. Create a LangSmith Account
- Visit https://smith.langchain.com
- Sign up for a free account
- Create an organization and project

### 2. Get Your API Key
- Go to Settings → API Keys
- Create a new API key and copy it

### 3. Add Environment Variables
Add these to your `.env` file:

```env
# LangSmith Configuration
LANGSMITH_API_KEY=your-api-key-here
LANGSMITH_PROJECT=ats-engine
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_TRACING_V2=true
LANGSMITH_ENABLED=true
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### Quick Fix - Create the Project
- Option 1: Auto-Create Project (Recommended)
- Simply process another candidate in your ATS app. LangSmith will automatically create the ats-engine project when the first trace is sent.

### Option 2: Manual Creation
- Go to https://smith.langchain.com
- Click "Projects" in the left sidebar
- Click "+ New Project"
- Name: ats-engine
- Click "Create Project"

### Test It Now
- Let me run a quick test to send a trace to your ats-engine project:

```bash
cd backend
python test_langsmith.py
```