import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfilesTable } from "@workspace/db";
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
    firstName: null,
    lastName: null,
    role: user.role,
    hasProfile: false,
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

  const [profile] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));

  req.session.userId = user.id;

  res.json({
    id: user.id,
    email: user.email,
    firstName: null,
    lastName: null,
    role: user.role,
    hasProfile: !!profile,
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

  const [profile] = await db.select({ id: userProfilesTable.id }).from(userProfilesTable).where(eq(userProfilesTable.userId, user.id));

  res.json({
    id: user.id,
    email: user.email,
    firstName: null,
    lastName: null,
    role: user.role,
    hasProfile: !!profile,
  });
});

export default router;
