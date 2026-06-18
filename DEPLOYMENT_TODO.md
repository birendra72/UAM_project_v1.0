# 🚀 Global Deployment Process

## ✅ Completed Setup
- [x] Supabase account and project configured
- [x] Upstash Redis database created
- [x] Environment variables prepared
- [x] Security files (.gitignore) updated
- [x] DEPLOYMENT_LINKS.md created with all credentials

## 🔄 Deployment Steps

### Step 1: Set up Neon PostgreSQL Database
- [ ] Create an account at https://neon.tech
- [ ] Create a new database project named `uam-prod`
- [ ] Copy the connection string (e.g. `postgresql://user:password@ep-host.region.pooler.neon.tech/neondb?sslmode=require`)
- [ ] Update the `DATABASE_URL` in your production environment variables (Render / `.env`)
- [ ] Run Alembic migrations:
  ```bash
  # Execute migrations on the local terminal pointing to the Neon DB
  DATABASE_URL="postgresql://user:password@ep-host.region.pooler.neon.tech/neondb?sslmode=require" alembic upgrade head
  ```
- [ ] Verify that tables are created on the Neon console

### Step 2: Push Code to GitHub
- [x] Ensure all code is committed locally (FrontEnd and parent repo)
- [ ] Push commits to remote repositories (run `git push origin main` in FrontEnd, `git push origin master` in project root)
- [x] Verify .gitignore files are working (sensitive files like DEPLOYMENT_LINKS.md excluded)

### Step 3: Deploy Backend to Render
- [ ] Create Render account at https://dashboard.render.com
- [ ] Connect GitHub repository
- [ ] Create Web Service with Docker runtime (Render will automatically detect the Dockerfile)
- [ ] Configure environment variables from DEPLOYMENT_LINKS.md:
  * `DATABASE_URL` -> (Your Neon connection string)
  * `REDIS_URL` -> (Your Upstash Redis URL)
  * `S3_ACCESS_KEY` / `S3_SECRET_KEY` -> (Your Supabase S3 credentials)
  * `S3_ENDPOINT_URL` / `S3_BUCKET` -> (Your Supabase storage bucket endpoints)
- [ ] Deploy and verify backend is running (check health endpoint at `https://<your-render-app>.onrender.com/api/health`)
- [ ] Update DEPLOYMENT_LINKS.md with Render service URL

### Step 4: Deploy Frontend to Vercel
- [ ] Create Vercel account at https://vercel.com/dashboard
- [ ] Connect GitHub repository (FrontEnd/ directory)
- [ ] Configure environment variables:
  * `VITE_API_BASE_URL` -> `https://<your-render-app>.onrender.com`
- [ ] Deploy and verify frontend is running
- [ ] Update DEPLOYMENT_LINKS.md with Vercel frontend URL

### Step 5: Configure CORS and Final Setup
- [ ] Update `ALLOWED_ORIGINS` in Render with Vercel URL
- [ ] Test full application functionality
- [ ] Update DEPLOYMENT_LINKS.md with final URLs

### Step 6: Verification and Testing
- [ ] Test user registration/login
- [ ] Test dataset upload and processing
- [ ] Test ML model training
- [ ] Verify all API endpoints work
- [ ] Confirm global accessibility

## 📋 Current Status
**Ready to start Step 1: Set up Neon PostgreSQL Database**
