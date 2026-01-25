# Vercel Deployment Guide for LawnFlowAI

## Prerequisites
- GitHub repository connected: https://github.com/GoToMarketNow/LawnFlowAI
- Vercel account (sign up at https://vercel.com if needed)

## Deployment Steps

### 1. Import Project to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select "Import Git Repository"
4. Choose your GitHub repository: **GoToMarketNow/LawnFlowAI**
5. Click "Import"

### 2. Configure Project Settings

Vercel will auto-detect most settings, but verify:

- **Framework Preset**: Other (custom build)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Development Command**: `npm run dev`

### 3. Configure Environment Variables

Add these environment variables in Vercel dashboard under "Environment Variables":

**Required:**
- `DATABASE_URL` - Your production PostgreSQL connection string
- `SESSION_SECRET` - A secure random string for sessions
- `NODE_ENV` - Set to `production`

**Optional (based on features you use):**
- `TWILIO_ACCOUNT_SID` - For SMS functionality
- `TWILIO_AUTH_TOKEN` - For SMS functionality
- `TWILIO_MESSAGING_SERVICE_SID` - For SMS functionality
- `TWILIO_PHONE_NUMBER` - For SMS functionality
- `OPENAI_API_KEY` - For AI features
- `STRIPE_SECRET_KEY` - For payment processing
- `STRIPE_PUBLISHABLE_KEY` - For payment processing
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `VITE_GOOGLE_MAPS_API_KEY` - For Google Maps integration

### 4. Database Setup

⚠️ **Important**: You'll need a production PostgreSQL database.

**Recommended Options:**
- **Vercel Postgres** (easiest, integrated)
- **Neon** (serverless PostgreSQL)
- **Supabase** (includes auth and storage)
- **Railway** (full PostgreSQL instance)

**To use Vercel Postgres:**
1. Go to your Vercel project → Storage tab
2. Create new Postgres database
3. It will automatically add `DATABASE_URL` to your environment variables

### 5. Deploy

1. Click "Deploy" button
2. Wait for the build to complete
3. Your app will be live at `https://your-project.vercel.app`

## Post-Deployment

### Run Database Migrations
After first deployment, run:
```bash
vercel env pull .env.production
npm run db:push
```

### Custom Domain (Optional)
1. Go to Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

### Monitoring
- View logs: Project → Deployments → [Latest] → Logs
- Monitor analytics: Project → Analytics tab

## Troubleshooting

### Build Fails
- Check the build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Ensure TypeScript compilation succeeds

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Check if database allows connections from Vercel IPs
- For serverless, ensure connection pooling is configured

### Environment Variables Not Working
- Must redeploy after adding/changing environment variables
- Check variable names match exactly (case-sensitive)

## Important Notes

1. **Serverless Functions**: Your Express app will run as a serverless function
2. **Cold Starts**: First request after inactivity may be slower
3. **Temporal Workflows**: May need separate hosting for Temporal server (consider Temporal Cloud)
4. **WebSockets**: May need alternative configuration for WS support on Vercel

## Security Checklist

- [ ] `.env` file is in `.gitignore` (already configured)
- [ ] All secrets are stored in Vercel environment variables
- [ ] `SESSION_SECRET` is a strong random string
- [ ] Database has proper access controls
- [ ] API keys are not exposed in client-side code

## Support

- Vercel Documentation: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Project Issues: https://github.com/GoToMarketNOW/LawnFlowAI/issues
