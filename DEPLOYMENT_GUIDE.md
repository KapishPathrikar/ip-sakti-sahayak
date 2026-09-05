# ?? 100% Free Production Deployment Guide: IP Shakti Sahayak

This guide walks you through deploying the complete **IP Shakti Sahayak** application (Frontend + Backend + Vector Store + PostgreSQL + LLM) completely **FREE**, with **no credit card required**.

---

## ??? System Architecture in Production

```
+--------------------------------------------------------+
¦ 1. Frontend: Vercel (Hobby Tier - Free)                ¦
¦    Next.js 16 App Router • Global Edge CDN • Free SSL  ¦
+--------------------------------------------------------+
                            ¦ HTTPS & SSE Token Streaming
                            ?
+--------------------------------------------------------+
¦ 2. Backend + RAG: Hugging Face Spaces (Docker - Free)  ¦
¦    FastAPI • 2 vCPU • 16 GB RAM • 50 GB Disk           ¦
¦    Hosts ChromaDB & Sentence-Transformers Embedding    ¦
+--------------------------------------------------------+
               ¦                          ¦
               ?                          ?
+---------------------------+ +--------------------------+
¦ 3. Database: Neon.tech    ¦ ¦ 4. LLM: Google AI Studio ¦
¦    Serverless PostgreSQL  ¦ ¦    Gemini 2.5 / 1.5 Flash¦
¦    0.5 GB Storage (Free)  ¦ ¦    15 RPM / Free Tier    ¦
+---------------------------+ +--------------------------+
```

---

## ?? Step 1: Set Up Free PostgreSQL Database ([Neon.tech](https://neon.tech))

On cloud containers, local SQLite files wipe whenever containers restart. Neon provides a free, permanent, cloud-hosted PostgreSQL database.

1. Sign up at [Neon.tech](https://neon.tech) (Free, no credit card).
2. Click **Create Project**:
   - **Project Name:** `ip-shakti-sahayak`
   - **Region:** Choose the region closest to you (e.g., `AWS US East (N. Virginia)` or `AWS Asia Pacific (Singapore)`).
3. On the project dashboard, look for **Connection Details**.
4. Set dropdown to **Connection string** (or `Parameters`) with `psql` / `SQLAlchemy`.
5. Copy the connection string. It will look like this:
   ```text
   postgresql://username:password@ep-cool-cloud-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   *(Keep this safe for Step 3)*.

---

## ?? Step 2: Get Your Free Google Gemini API Key

Your backend uses Gemini Cloud API (`backend/rag/cloud_llm.py`) for lightning-fast legal reasoning without needing an expensive local GPU.

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Click **Get API key** -> **Create API key**.
4. Copy the generated key.
   *(Free tier provides 15 Requests Per Minute and 1,500 Requests Per Day for free)*.

---

## ?? Step 3: Deploy Backend on [Hugging Face Spaces](https://huggingface.co/spaces)

> **Why Hugging Face Spaces?** Standard free tiers (Render, Koyeb) limit RAM to 512 MB, which crashes when loading PyTorch + SentenceTransformers. Hugging Face Spaces provides **2 vCPU and 16 GB of RAM for free**, giving your vector database plenty of headroom!

### 3.1 Create the Space
1. Sign in or sign up at [Hugging Face](https://huggingface.co/).
2. Click your profile avatar -> **New Space** (or navigate to https://huggingface.co/new-space).
3. Fill in the Space details:
   - **Space name:** `ip-shakti-api`
   - **License:** `mit` (or `apache-2.0`)
   - **Select Space SDK:** Choose **Docker** -> **Blank**
   - **Space hardware:** Select **Free: 2 vCPU · 16 GB RAM**
   - **Visibility:** **Public** (required so your Vercel frontend can make API calls to it)
4. Click **Create Space**.

### 3.2 Configure Environment Variables & Secrets
In your new Space:
1. Navigate to **Settings** -> **Variables and secrets**.
2. Click **New secret** and add:
   - **Name:** `DATABASE_URL`
   - **Value:** *[Your Neon connection string from Step 1]*
3. Click **New secret** and add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** *[Your Google AI Studio API key from Step 2]*
4. Click **New variable** and add:
   - **Name:** `CORS_ORIGINS`
   - **Value:** `*` *(We will update this to your exact Vercel URL in Step 5)*
5. Click **New variable** and add:
   - **Name:** `GEMINI_MODEL`
   - **Value:** `gemini-2.5-flash`

### 3.3 Push Backend Code to Hugging Face
Your project already includes the prepared `Dockerfile`, `requirements.txt`, `chroma_db/`, and `backend/`.

In PowerShell, clone your Space and copy the backend files, or push directly via Git:
```powershell
# Add your HF space as a git remote
git remote add space https://huggingface.co/spaces/<YOUR_HF_USERNAME>/ip-shakti-api

# Push your repository to the space
git push space main
```
*Note: Hugging Face automatically tracks large vector files (`chroma_db/*.bin`) via Git LFS.*

### 3.4 Verify Backend Health
Once the Space builds and shows **Running**:
1. Open `https://<YOUR_HF_USERNAME>-ip-shakti-api.hf.space/health` in your browser.
2. You should see:
   ```json
   {"status": "ok", "service": "IP Shakti Sahayak API", "version": "0.1.0"}
   ```
3. Interactive Swagger documentation will be available at:
   `https://<YOUR_HF_USERNAME>-ip-shakti-api.hf.space/docs`

---

## ? Step 4: Deploy Frontend on [Vercel](https://vercel.com)

1. Ensure your latest project code is pushed to your GitHub repository.
2. Log in to [Vercel](https://vercel.com/) with GitHub.
3. Click **Add New...** -> **Project**.
4. Locate your repository (`ip_shakti-sahayak`) and click **Import**.
5. Configure the build settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** Click **Edit** and select the `frontend` folder.
6. Expand **Environment Variables**:
   - **Key:** `NEXT_PUBLIC_API_BASE_URL`
   - **Value:** `https://<YOUR_HF_USERNAME>-ip-shakti-api.hf.space` *(Note: No trailing slash)*
7. Click **Deploy**.

Within 2 minutes, Vercel will complete the build and assign you a live HTTPS URL, such as:
`https://ip-shakti-sahayak.vercel.app`

---

## ?? Step 5: Final CORS Lock (Production Best Practice)

Once your frontend is live on Vercel:
1. Return to your Hugging Face Space -> **Settings** -> **Variables and secrets**.
2. Edit the `CORS_ORIGINS` variable and set it to your real Vercel URL:
   ```text
   https://ip-shakti-sahayak.vercel.app,http://localhost:3000
   ```
3. Click **Restart Space**.

---

## ?? Verification Checklist

- [ ] **Database Connectivity:** Register a new user on the frontend (`/auth/register`). Verify the user is created and login persists.
- [ ] **Fast FAQ Answers:** Test a common FAQ (e.g. *"What is Intellectual Property?"*). It should answer deterministically in `<0.05s`.
- [ ] **RAG Grounded Citations:** Ask a patent question (e.g. *"What is Section 3(p) under Indian Patent Act?"*). Verify it retrieves source citations from the 768-dim vector store.
- [ ] **Real-Time Token Streaming:** Notice real-time typing animation streamed over Server-Sent Events (SSE).
- [ ] **PDF Consultation Advisory:** Download a PDF advisory report from the consultation session.

---

## ? Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **CORS error in browser console** | `CORS_ORIGINS` doesn't match frontend domain | Check that your Hugging Face Space variable `CORS_ORIGINS` contains your exact Vercel URL without a trailing slash. |
| **Mock response returned instead of AI answer** | `GEMINI_API_KEY` missing or invalid | Verify `GEMINI_API_KEY` in Hugging Face Space Secrets and ensure no leading/trailing spaces. |
| **Backend 500 error on chat** | Database not connected | Check the Space build logs and verify `DATABASE_URL` matches your Neon connection string. |
| **Space sleeping / cold start** | HF free Spaces sleep after 48 hours of inactivity | Visiting the space or setting up a free monitor (e.g., [UptimeRobot](https://uptimerobot.com) pinging `/health` every 15 min) keeps it awake 24/7 for free. |
