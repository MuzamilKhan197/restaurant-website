import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {handleSupportFile} from './handler.ts';
// JWT verification is implemented in the handler; guest requests prove a
// resource-scoped capability through the database, never through an API key.
Deno.serve(request=>handleSupportFile(request,{
 url:Deno.env.get('SUPABASE_URL')||'',
 anonKey:Deno.env.get('SUPABASE_ANON_KEY')||'',
 serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',
},createClient));
