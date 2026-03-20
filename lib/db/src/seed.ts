import { db, usersTable } from "./index";
import { eq } from "drizzle-orm";

export async function runSeed(): Promise<void> {
  try {
    // Check if admin user already exists
    const [existingAdmin] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, "admin@bodypro.com"));

    if (existingAdmin) {
      console.log("✓ Admin user already exists");
      return;
    }

    // Create admin user with default password
    // Password: Admin@123456
    const hashedPassword =
      "$2b$12$ggotdIitqJ1sNww.69y6SOBr9ipqhNWSb8x4QL4YGfZDtuKZLsYdq";

    await db.insert(usersTable).values({
      email: "admin@bodypro.com",
      password: hashedPassword,
      fullName: "Admin",
      role: "admin",
      subscriptionStatus: "premium",
      isActive: true,
    });

    console.log("✓ Admin user created successfully");
    console.log("  Email: admin@bodypro.com");
    console.log("  Password: Admin@123456");
  } catch (err) {
    console.error("Seed encountered an error, continuing startup:", err);
  }
}
