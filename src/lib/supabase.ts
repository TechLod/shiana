import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://halnoikqjqijqgbkutff.supabase.co';
const supabaseAnonKey = 'sb_publishable_kfSsqhkT-pCn5BV6xN5ymA_JB5K4rEB';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// FIXED: export both ways so all imports work
export default supabase;