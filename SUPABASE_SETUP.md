# Free backend setup using Supabase

This app is designed to work in two modes:

1. Local mock mode (works immediately without any backend)
2. Supabase-connected mode (real database + storage + auth)

## 1) Create a free Supabase project

- Go to: https://supabase.com
- Sign up for free
- Create a new project
- Save your project URL and anon key

## 2) Add environment variables

Create a `.env` file in the project root using `.env.example` as the template:

```bash
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_APP_ADMIN_PASSWORD=balaji123
```

## 3) Create the database schema

Open the Supabase SQL Editor and run the SQL from `files/schema.sql`.

This creates:
- `events`
- `donations`
- `expenses`
- `pending_payments`
- `reserve_fund`

## 4) Storage buckets

In Supabase dashboard:

- Create a public bucket called `receipts`
- Create a private bucket called `proofs`

Then enable storage rules as needed.

## 5) Authentication (optional but recommended)

In Supabase Auth:
- enable email sign-in
- create organizer user
- add a custom app_metadata role = `organizer`

The app already supports a simple password gate in the demo mode; for real production, use Supabase auth.

## 6) Deploy free

Use Vercel or Netlify.

- Import the project folder
- Add the same environment variables
- Deploy

## 7) Free-tier notes

Supabase free tier includes:
- database storage
- authentication
- row-level security
- file storage

This is enough for a small apartment community project.
