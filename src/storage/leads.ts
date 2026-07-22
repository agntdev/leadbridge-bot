import type { RedisLike } from "../toolkit/session/redis.js";

export interface StoredLead {
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  budget: string;
  notes?: string;
  source?: string;
  submittedAt: string;
  userId: number;
}

const LEAD_PREFIX = "lead:";
const LEAD_INDEX_PREFIX = "leads:index";
const USER_LEAD_PREFIX = "user:leads:";

let redisClient: RedisLike | null = null;

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    redisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    }) as RedisLike;
    return redisClient;
  } catch {
    return null;
  }
}

export async function saveLead(lead: StoredLead): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) {
    console.warn("[leads] Redis not configured — lead not persisted");
    return false;
  }

  try {
    const key = LEAD_PREFIX + lead.id;
    await client.set(key, JSON.stringify(lead));

    // Add to index (user's leads)
    const userKey = USER_LEAD_PREFIX + lead.userId;
    const existing = await client.get(userKey);
    const leadIds: string[] = existing ? JSON.parse(existing) : [];
    if (!leadIds.includes(lead.id)) {
      leadIds.push(lead.id);
      await client.set(userKey, JSON.stringify(leadIds));
    }

    // Add to global index
    const globalIndex = await client.get(LEAD_INDEX_PREFIX);
    const allLeadIds: string[] = globalIndex ? JSON.parse(globalIndex) : [];
    if (!allLeadIds.includes(lead.id)) {
      allLeadIds.push(lead.id);
      await client.set(LEAD_INDEX_PREFIX, JSON.stringify(allLeadIds));
    }

    return true;
  } catch (error) {
    console.error("[leads] Failed to save lead:", error);
    return false;
  }
}

export async function getLead(id: string): Promise<StoredLead | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(LEAD_PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function getUserLeads(userId: number): Promise<StoredLead[]> {
  const client = await getRedisClient();
  if (!client) return [];

  try {
    const indexData = await client.get(USER_LEAD_PREFIX + userId);
    if (!indexData) return [];

    const leadIds: string[] = JSON.parse(indexData);
    const leads: StoredLead[] = [];

    for (const id of leadIds) {
      const lead = await getLead(id);
      if (lead) leads.push(lead);
    }

    return leads;
  } catch {
    return [];
  }
}

export function generateLeadId(): string {
  return `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
