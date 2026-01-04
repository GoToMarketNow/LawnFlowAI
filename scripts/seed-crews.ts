/**
 * Seed script for demo crews and users
 * Creates 3 crews with members in the Charlottesville/Albemarle/Greene area
 * 
 * Run with: npx tsx scripts/seed-crews.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { 
  users, 
  crews, 
  crewMembers,
  type User
} from "../shared/schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

async function seed() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  console.log("Starting crew seed...\n");

  // Get existing business ID from onboarding
  const existingUsers = await db.select().from(users).limit(1);
  const businessId = existingUsers[0]?.businessId ?? 1;

  console.log(`Using businessId: ${businessId}`);

  // Create demo users for crew members
  const demoUsers = [
    { email: "mike.johnson@greenridge.local", displayName: "Mike Johnson", role: "CREW_LEAD", phoneE164: "+14345550101" },
    { email: "sarah.chen@greenridge.local", displayName: "Sarah Chen", role: "STAFF", phoneE164: "+14345550102" },
    { email: "james.wilson@greenridge.local", displayName: "James Wilson", role: "STAFF", phoneE164: "+14345550103" },
    { email: "maria.garcia@greenridge.local", displayName: "Maria Garcia", role: "CREW_LEAD", phoneE164: "+14345550104" },
    { email: "david.brown@greenridge.local", displayName: "David Brown", role: "STAFF", phoneE164: "+14345550105" },
    { email: "linda.martinez@greenridge.local", displayName: "Linda Martinez", role: "STAFF", phoneE164: "+14345550106" },
    { email: "chris.taylor@greenridge.local", displayName: "Chris Taylor", role: "CREW_LEAD", phoneE164: "+14345550107" },
    { email: "emily.davis@greenridge.local", displayName: "Emily Davis", role: "STAFF", phoneE164: "+14345550108" },
    { email: "robert.jones@greenridge.local", displayName: "Robert Jones", role: "STAFF", phoneE164: "+14345550109" },
  ];

  const insertedUsers: User[] = [];
  for (const u of demoUsers) {
    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, u.email)).limit(1);
    if (existing.length > 0) {
      console.log(`  User already exists: ${u.displayName}`);
      insertedUsers.push(existing[0]);
    } else {
      const [inserted] = await db.insert(users).values({
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        phoneE164: u.phoneE164,
        passwordHash: "$2b$10$placeholder",
        businessId,
      }).returning();
      console.log(`  Created user: ${u.displayName}`);
      insertedUsers.push(inserted);
    }
  }

  // Define crews with home bases in Charlottesville area
  const demoCrew = [
    {
      name: "Alpha Crew",
      homeBaseAddress: "2100 Ivy Rd, Charlottesville, VA 22903",
      homeBaseLat: 38.0311,
      homeBaseLng: -78.5142,
      serviceRadiusMiles: 15,
      dailyCapacityMinutes: 480, // 8 hours
      skillsJson: ["mowing", "edging", "cleanup"],
      equipmentJson: ["mower-1", "trimmer-1", "blower-1"],
      memberIndices: [0, 1, 2], // Mike, Sarah, James
      leaderIndex: 0, // Mike
    },
    {
      name: "Bravo Crew",
      homeBaseAddress: "1815 Hydraulic Rd, Charlottesville, VA 22901",
      homeBaseLat: 38.0589,
      homeBaseLng: -78.4896,
      serviceRadiusMiles: 20,
      dailyCapacityMinutes: 420, // 7 hours
      skillsJson: ["mowing", "mulch", "landscaping", "hardscape"],
      equipmentJson: ["mower-2", "mulch-spreader-1", "skid-steer-1"],
      memberIndices: [3, 4, 5], // Maria, David, Linda
      leaderIndex: 3, // Maria
    },
    {
      name: "Charlie Crew",
      homeBaseAddress: "980 Rio Rd E, Charlottesville, VA 22901",
      homeBaseLat: 38.0758,
      homeBaseLng: -78.4561,
      serviceRadiusMiles: 25,
      dailyCapacityMinutes: 480, // 8 hours
      skillsJson: ["mowing", "irrigation", "cleanup", "aeration"],
      equipmentJson: ["mower-3", "aerator-1", "irrigation-kit-1"],
      memberIndices: [6, 7, 8], // Chris, Emily, Robert
      leaderIndex: 6, // Chris
    },
  ];

  for (const c of demoCrew) {
    // Check if crew exists by name
    const existingCrew = await db.select().from(crews).where(eq(crews.name, c.name)).limit(1);
    
    let crewId: number;
    if (existingCrew.length > 0) {
      console.log(`  Crew already exists: ${c.name}`);
      crewId = existingCrew[0].id;
    } else {
      const [inserted] = await db.insert(crews).values({
        businessId,
        name: c.name,
        homeBaseAddress: c.homeBaseAddress,
        homeBaseLat: c.homeBaseLat,
        homeBaseLng: c.homeBaseLng,
        serviceRadiusMiles: c.serviceRadiusMiles,
        dailyCapacityMinutes: c.dailyCapacityMinutes,
        skillsJson: c.skillsJson,
        equipmentJson: c.equipmentJson,
        status: "ACTIVE",
        isActive: true,
      }).returning();
      console.log(`  Created crew: ${c.name} (id: ${inserted.id})`);
      crewId = inserted.id;
    }

    // Add members to crew
    const leaderUser = insertedUsers[c.leaderIndex];
    for (const idx of c.memberIndices) {
      const user = insertedUsers[idx];
      const isLeader = idx === c.leaderIndex;
      
      // Check if member already exists in this crew
      const existingMember = await db.select().from(crewMembers)
        .where(eq(crewMembers.crewId, crewId))
        .limit(10);
      
      const alreadyMember = existingMember.some(m => m.userId === user.id);
      if (alreadyMember) {
        console.log(`    Member already in crew: ${user.displayName}`);
        continue;
      }

      await db.insert(crewMembers).values({
        crewId,
        userId: user.id,
        displayName: user.displayName ?? user.email,
        role: isLeader ? "LEADER" : "MEMBER",
        isActive: true,
        startAt: new Date(),
      });
      console.log(`    Added member: ${user.displayName} ${isLeader ? "(Leader)" : ""}`);
    }
  }

  console.log("\nSeed completed successfully!");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
