import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envFile = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envFile.match(/VITE_SUPABASE_URL=(.*)/)[1].trim()
const supabaseKey = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim()

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase.from('decks').select('*')
  console.log("Error:", error)
  console.log("Data:", data)
}

test()
