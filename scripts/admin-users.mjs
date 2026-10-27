#!/usr/bin/env node
// Gestión de usuarios del panel administrativo (/admin).
//
//   npm run admin:create-user -- --email ana@devnation.tech [--name "Ana Pérez"] [--password "..."]
//   npm run admin:list-users
//   npm run admin:remove-user -- --email ana@devnation.tech
//
// Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (clave secreta o
// service_role) en .env.local. Si no se indica --password, se pide por consola.

import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";

const MIN_PASSWORD_LENGTH = 10;

function fail(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  if (!url || !secretKey) {
    fail("Define NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local.");
  }
  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function promptHidden(question) {
  let muted = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function findUserByEmail(supabase, email) {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(error.message);
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

async function createUser({ email, name, password }) {
  if (!email) fail("Indica --email.");
  if (!password) {
    password = await promptHidden("Contraseña: ");
    const confirmation = await promptHidden("Repite la contraseña: ");
    if (password !== confirmation) fail("Las contraseñas no coinciden.");
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }

  const supabase = getAdminClient();
  let user = await findUserByEmail(supabase, email);

  if (user) {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });
    if (error) fail(error.message);
    console.log(`• El usuario ${email} ya existía: contraseña actualizada.`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) fail(error.message);
    user = data.user;
    console.log(`• Usuario ${email} creado.`);
  }

  const { error } = await supabase
    .from("admin_users")
    .upsert({ user_id: user.id, ...(name ? { full_name: name } : {}) }, { onConflict: "user_id" });
  if (error) fail(error.message);

  console.log(`✔ ${email} tiene acceso al panel administrativo.`);
}

async function listUsers() {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id, full_name, created_at")
    .order("created_at");
  if (error) fail(error.message);
  if (!data.length) {
    console.log("No hay administradores registrados.");
    return;
  }
  for (const row of data) {
    const { data: auth } = await supabase.auth.admin.getUserById(row.user_id);
    console.log(
      `${auth?.user?.email ?? row.user_id}\t${row.full_name ?? ""}\t${new Date(row.created_at).toLocaleDateString("es-EC")}`,
    );
  }
}

async function removeUser({ email }) {
  if (!email) fail("Indica --email.");
  const supabase = getAdminClient();
  const user = await findUserByEmail(supabase, email);
  if (!user) fail(`No existe un usuario con el correo ${email}.`);

  // Borrar la fila de admin_users revoca el acceso a los datos de inmediato
  // (RLS), aunque el token de sesión siga vigente hasta que expire.
  const { error: revokeError } = await supabase.from("admin_users").delete().eq("user_id", user.id);
  if (revokeError) fail(revokeError.message);
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) fail(error.message);
  console.log(`✔ ${email} eliminado.`);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
  },
});

const commands = { create: createUser, list: listUsers, remove: removeUser };
const command = commands[positionals[0]];
if (!command) fail("Uso: admin-users.mjs <create|list|remove> [--email] [--name] [--password]");

await command({ ...values, email: values.email?.trim() });
