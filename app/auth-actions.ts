"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";

export async function signup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 8) {
    redirect(
      "/signup?error=" +
        encodeURIComponent(
          "Fill in every field. Password needs 8+ characters.",
        ),
    );
  }

  const hash = await bcrypt.hash(password, 12);
  const res = await pool.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [email, name, hash],
  );

  if (res.rowCount === 0) {
    redirect(
      "/signup?error=" +
        encodeURIComponent("That email is already registered."),
    );
  }

  await createSession(res.rows[0].id);
  redirect("/");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const res = await pool.query(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [email],
  );
  const user = res.rows[0];
  const ok =
    user?.password_hash && (await bcrypt.compare(password, user.password_hash));

  // Same message either way, so nobody can probe which emails exist
  if (!ok) {
    redirect("/login?error=" + encodeURIComponent("Wrong email or password."));
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
