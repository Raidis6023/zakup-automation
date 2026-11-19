import { getServerSupabaseFetch } from "./server-fetch";
import {
  createClient as createSupabaseClient,
} from "@supabase/supabase-js";


function getAdminSupabaseConfig() {

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;


  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;


  if (!supabaseUrl) {

    throw new Error(
      "Не найдена переменная NEXT_PUBLIC_SUPABASE_URL"
    );

  }


  if (!supabaseSecretKey) {

    throw new Error(
      "Не найдена переменная SUPABASE_SECRET_KEY"
    );

  }


  return {
    supabaseUrl,
    supabaseSecretKey,
  };

}


export function createAdminClient() {

  const {
    supabaseUrl,
    supabaseSecretKey,
  } =
    getAdminSupabaseConfig();


  return createSupabaseClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { fetch: getServerSupabaseFetch() },
    }
  );

}
