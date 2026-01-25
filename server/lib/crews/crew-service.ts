import { db } from "../../db";
import { crews, crewMembers, users } from "../../../shared/schema";
import type {
  Crew,
  CrewMember,
  CrewWithMembers,
  InsertCrew,
  InsertCrewMember,
  User,
} from "../../../shared/schema";
import { eq, and, desc } from "drizzle-orm";

type MemberWithUser = { member: CrewMember; user: User | null };

export async function createCrew(
  data: Omit<InsertCrew, "id" | "createdAt" | "updatedAt">
): Promise<Crew> {
  const [crew] = await db
    .insert(crews)
    .values({
      ...data,
      status: data.status ?? "ACTIVE",
    })
    .returning();
  return crew;
}

export async function updateCrew(
  crewId: number,
  data: Partial<Omit<InsertCrew, "id" | "createdAt" | "updatedAt" | "businessId">>
): Promise<Crew | null> {
  const [crew] = await db
    .update(crews)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(crews.id, crewId))
    .returning();
  return crew ?? null;
}

export async function getCrew(crewId: number): Promise<Crew | null> {
  const [crew] = await db.select().from(crews).where(eq(crews.id, crewId));
  return crew ?? null;
}

export async function getCrewWithMembers(crewId: number): Promise<CrewWithMembers | null> {
  const crew = await getCrew(crewId);
  if (!crew) return null;

  const membersWithUsers = await db
    .select({
      member: crewMembers,
      user: users,
    })
    .from(crewMembers)
    .leftJoin(users, eq(crewMembers.userId, users.id))
    .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.isActive, true)));

  const members = membersWithUsers.map((row: MemberWithUser) => ({
    ...row.member,
    user: row.user ?? undefined,
  }));

  const leader = members.find((m: CrewMember & { user?: User | null }) => m.role === "LEADER") ?? null;

  return {
    ...crew,
    members,
    leader,
    memberCount: members.length,
  };
}

export async function listCrews(businessId: number): Promise<Crew[]> {
  return db
    .select()
    .from(crews)
    .where(eq(crews.businessId, businessId))
    .orderBy(desc(crews.createdAt));
}

export async function listCrewsWithMembers(businessId: number): Promise<CrewWithMembers[]> {
  const allCrews = await listCrews(businessId);

  const crewsWithMembers: CrewWithMembers[] = [];

  for (const crew of allCrews) {
    const membersWithUsers = await db
      .select({
        member: crewMembers,
        user: users,
      })
      .from(crewMembers)
      .leftJoin(users, eq(crewMembers.userId, users.id))
      .where(and(eq(crewMembers.crewId, crew.id), eq(crewMembers.isActive, true)));

    const members = membersWithUsers.map((row: MemberWithUser) => ({
      ...row.member,
      user: row.user ?? undefined,
    }));

    const leader = members.find((m: CrewMember & { user?: User | null }) => m.role === "LEADER") ?? null;

    crewsWithMembers.push({
      ...crew,
      members,
      leader,
      memberCount: members.length,
    });
  }

  return crewsWithMembers;
}

export async function addCrewMember(
  data: Omit<InsertCrewMember, "id" | "createdAt">
): Promise<CrewMember> {
  const existingMember = await db
    .select()
    .from(crewMembers)
    .where(
      and(
        eq(crewMembers.crewId, data.crewId),
        eq(crewMembers.displayName, data.displayName),
        eq(crewMembers.isActive, true)
      )
    );

  if (existingMember.length > 0) {
    throw new Error(`Member "${data.displayName}" already exists in this crew`);
  }

  const [member] = await db
    .insert(crewMembers)
    .values({
      ...data,
      role: data.role ?? "MEMBER",
      isActive: true,
      startAt: new Date(),
    })
    .returning();
  return member;
}

export async function removeCrewMember(memberId: number): Promise<CrewMember | null> {
  const [member] = await db
    .update(crewMembers)
    .set({
      isActive: false,
      endAt: new Date(),
    })
    .where(eq(crewMembers.id, memberId))
    .returning();
  return member ?? null;
}

export async function updateCrewMember(
  memberId: number,
  data: Partial<Pick<InsertCrewMember, "displayName" | "role" | "userId">>
): Promise<CrewMember | null> {
  const [member] = await db
    .update(crewMembers)
    .set(data)
    .where(eq(crewMembers.id, memberId))
    .returning();
  return member ?? null;
}

export async function setCrewLeader(crewId: number, memberId: number): Promise<void> {
  await db
    .update(crewMembers)
    .set({ role: "MEMBER" })
    .where(and(eq(crewMembers.crewId, crewId), eq(crewMembers.role, "LEADER")));

  await db
    .update(crewMembers)
    .set({ role: "LEADER" })
    .where(eq(crewMembers.id, memberId));
}

export async function getCrewByMemberId(memberId: number): Promise<Crew | null> {
  const [member] = await db
    .select()
    .from(crewMembers)
    .where(eq(crewMembers.id, memberId));
  
  if (!member) return null;
  
  return getCrew(member.crewId);
}

export async function getCrewMember(memberId: number): Promise<(CrewMember & { user?: User | null }) | null> {
  const [result] = await db
    .select({
      member: crewMembers,
      user: users,
    })
    .from(crewMembers)
    .leftJoin(users, eq(crewMembers.userId, users.id))
    .where(eq(crewMembers.id, memberId));

  if (!result) return null;

  return {
    ...result.member,
    user: result.user ?? undefined,
  };
}

export async function deleteCrew(crewId: number): Promise<boolean> {
  await db.update(crewMembers).set({ isActive: false, endAt: new Date() }).where(eq(crewMembers.crewId, crewId));
  
  const [crew] = await db
    .update(crews)
    .set({ status: "INACTIVE", isActive: false, updatedAt: new Date() })
    .where(eq(crews.id, crewId))
    .returning();
  
  return !!crew;
}
