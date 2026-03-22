import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfilesTable, pool } from "@workspace/db";
import {
  SignupBody,
  LoginBody,
} from "@workspace/api-zod";

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { email, password, passwordConfirm, firstName, lastName } = parsed.data;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  if (password !== passwordConfirm) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    password: hashedPassword,
    fullName: fullName,
  }).returning();

  req.session.userId = user.id;

  res.status(201).json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    hasProfile: false,
    coachId: null,
    coachName: null,
    coachUpdatedAt: null,
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "ACCOUNT_DEACTIVATED" });
    return;
  }

  const [profile] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));

  req.session.userId = user.id;

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    hasProfile: !!profile,
    coachId: null,
    coachName: null,
    coachUpdatedAt: null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (!user.isActive) {
    req.session.destroy(() => {});
    res.status(403).json({ error: "ACCOUNT_DEACTIVATED" });
    return;
  }

  const [profile] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));

  // Fetch coach info and plan updated banner
  const extraRes = await pool.query(`
    SELECT
      c.id AS coach_id, c.full_name AS coach_name,
      p.coach_updated_at
    FROM users u
    LEFT JOIN users c ON c.id = u.coach_id
    LEFT JOIN LATERAL (
      SELECT coach_updated_at FROM plans WHERE user_id = u.id ORDER BY version DESC LIMIT 1
    ) p ON TRUE
    WHERE u.id = $1
  `, [user.id]);

  const extra = extraRes.rows[0];

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    hasProfile: !!profile,
    coachId: extra?.coach_id ?? null,
    coachName: extra?.coach_name ?? null,
    coachUpdatedAt: extra?.coach_updated_at ?? null,
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    res.json({ message: "If that email exists, a reset link has been sent." });
    return;
  }

  await pool.query(
    `DELETE FROM password_reset_tokens WHERE user_id = $1`,
    [user.id]
  );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
    [user.id, token, expiresAt]
  );

  console.log(`\n🔐 PASSWORD RESET TOKEN for ${user.email}:`);
  console.log(`   Token: ${token}`);
  console.log(`   Expires: ${expiresAt.toISOString()}\n`);

  res.json({
    message: "If that email exists, a reset link has been sent.",
    token,
  });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password, passwordConfirm } = req.body;

  if (!token || !password || !passwordConfirm) {
    res.status(400).json({ error: "Token, password, and confirmation are required" });
    return;
  }

  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  if (password !== passwordConfirm) {
    res.status(400).json({ error: "Passwords do not match" });
    return;
  }

  const result = await pool.query(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1`,
    [token]
  );

  const tokenRow = result.rows[0];
  if (!tokenRow) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  if (tokenRow.used_at) {
    res.status(400).json({ error: "This reset link has already been used" });
    return;
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    res.status(400).json({ error: "This reset link has expired. Please request a new one." });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await db.update(usersTable)
    .set({ password: hashedPassword })
    .where(eq(usersTable.id, tokenRow.user_id));

  await pool.query(
    `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
    [tokenRow.id]
  );

  res.json({ message: "Password reset successfully. You can now log in." });
});

router.put("/auth/change-password", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword, newPasswordConfirm } = req.body;

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    res.status(400).json({ error: "All fields are required" });
    return;
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    res.status(400).json({ error: "New passwords do not match" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable)
    .set({ password: hashedPassword })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Password changed successfully" });
});

router.post("/auth/setup-admin", async (req, res): Promise<void> => {
  const setupSecret = process.env.ADMIN_SETUP_SECRET;
  if (!setupSecret) {
    res.status(403).json({ error: "Admin setup is not enabled" });
    return;
  }

  const { secret, email } = req.body;
  if (!secret || secret !== setupSecret) {
    res.status(403).json({ error: "Invalid setup secret" });
    return;
  }

  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user) {
    res.status(404).json({ error: "No account found with that email" });
    return;
  }

  await db.update(usersTable)
    .set({ role: "admin" })
    .where(eq(usersTable.id, user.id));

  res.json({ message: `User ${user.email} has been promoted to admin` });
});

export default router;
