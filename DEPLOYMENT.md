# Deployment to Vercel

1. Push this project to GitHub.
2. Import the repository into Vercel.
3. Add these environment variables in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `RESEND_API_KEY` (optional)
   - `NOTIFICATION_FROM_EMAIL` (optional)
4. Deploy.
5. In Supabase Authentication settings, add your Vercel URL to the allowed site/redirect URLs if required by your authentication configuration.
6. Test with all three roles before sharing the live link.

Never expose a Supabase service-role key in a `NEXT_PUBLIC_` variable or commit it to GitHub.
