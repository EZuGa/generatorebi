/**
 * Server-side usage statistics for the admin dashboard.
 * Supabase REST only (service role) — no extra dependencies.
 *
 * Bandwidth is intentionally absent: Cloudflare Pages egress is unmetered
 * and Supabase egress is not exposed via the REST API (needs a personal
 * access token for the Management API), so there is nothing to measure here.
 */

import { IMAGE_BUCKET } from './supabase-admin';

/** Supabase free-tier quotas (used only to render "x of y" progress). */
export const DB_LIMIT_BYTES = 500 * 1024 * 1024; // 500 MB database
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB file storage

export interface AdminStats {
  /** Total Postgres size in bytes, or null when the RPC is missing/errored. */
  dbBytes: number | null;
  /** Sum of file sizes in the image bucket, or null on error. */
  storageBytes: number | null;
  storageFiles: number | null;
  productCount: number | null;
  postCount: number | null;
}

function headers(serviceKey: string): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
}

/** Database size via the admin_db_bytes() RPC (migration 002_admin_stats.sql). */
async function getDatabaseBytes(url: string, serviceKey: string): Promise<number | null> {
  const res = await fetch(`${url}/rest/v1/rpc/admin_db_bytes`, {
    method: 'POST',
    headers: { ...headers(serviceKey), 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) return null;
  const value = await res.json();
  return typeof value === 'number' ? value : null;
}

/** Sums file sizes in the image bucket via the Storage list API (paginated). */
async function getStorageUsage(
  url: string,
  serviceKey: string,
  bucket: string
): Promise<{ bytes: number; files: number } | null> {
  let offset = 0;
  let bytes = 0;
  let files = 0;
  for (;;) {
    const res = await fetch(`${url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { ...headers(serviceKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!res.ok) return null;
    const items = (await res.json()) as { metadata?: { size?: number } }[];
    for (const item of items) {
      if (typeof item.metadata?.size === 'number') {
        bytes += item.metadata.size;
        files++;
      }
    }
    if (items.length < 1000) break;
    offset += 1000;
  }
  return { bytes, files };
}

/** Exact row count via PostgREST's `Prefer: count=exact` content-range header. */
async function getRowCount(
  url: string,
  serviceKey: string,
  table: 'products' | 'posts'
): Promise<number | null> {
  const res = await fetch(`${url}/rest/v1/${table}?select=id&limit=0`, {
    headers: { ...headers(serviceKey), Prefer: 'count=exact' },
  });
  if (!res.ok) return null;
  const total = res.headers.get('content-range')?.split('/')[1];
  const n = Number(total);
  return Number.isFinite(n) ? n : null;
}

export async function getAdminStats(url: string, serviceKey: string): Promise<AdminStats> {
  const [dbBytes, storage, productCount, postCount] = await Promise.all([
    getDatabaseBytes(url, serviceKey).catch(() => null),
    getStorageUsage(url, serviceKey, IMAGE_BUCKET).catch(() => null),
    getRowCount(url, serviceKey, 'products').catch(() => null),
    getRowCount(url, serviceKey, 'posts').catch(() => null),
  ]);
  return {
    dbBytes,
    storageBytes: storage?.bytes ?? null,
    storageFiles: storage?.files ?? null,
    productCount,
    postCount,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
