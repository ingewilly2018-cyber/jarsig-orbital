import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const supabaseUrl = required("SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const sql = postgres(required("DATABASE_URL"), { max: 1 });
const auth = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function upsertAccount(email: string, password: string, admin: boolean) {
  const normalizedEmail = email.trim().toLowerCase();
  const listed = await auth.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  let user = listed.data.users.find((item) => item.email?.toLowerCase() === normalizedEmail);

  if (!user) {
    const created = await auth.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { username: normalizedEmail.split("@")[0] },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const username = `${normalizedEmail.split("@")[0].slice(0, 38)}-${user.id.slice(0, 8)}`;
  await sql`
    INSERT INTO users (username, email, supabase_user_id, is_admin, is_active, password_change_required)
    VALUES (${username}, ${normalizedEmail}, ${user.id}, ${admin}, TRUE, ${admin})
    ON CONFLICT (email) DO UPDATE SET
      supabase_user_id = EXCLUDED.supabase_user_id,
      is_admin = EXCLUDED.is_admin,
      is_active = TRUE,
      password_change_required = CASE WHEN users.supabase_user_id IS NULL THEN EXCLUDED.password_change_required ELSE users.password_change_required END,
      updated_at = CURRENT_TIMESTAMP
  `;
}

try {
  await upsertAccount(required("ADMIN_EMAIL"), required("ADMIN_PASSWORD"), true);
  await upsertAccount(required("DEMO_USER_EMAIL"), required("DEMO_USER_PASSWORD"), false);
  console.log("Default JARSIG accounts are ready. Supabase Auth stores their password hashes.");
} finally {
  await sql.end();
}
