import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Configuration Supabase absente : renseignez VITE_SUPABASE_URL et ' +
      'VITE_SUPABASE_ANON_KEY dans le fichier .env.local (voir .env.example).',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false },
  realtime: { params: { eventsPerSecond: 5 } },
})

export const BUCKET_PREUVES = 'preuves'
