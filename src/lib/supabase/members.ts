'use client';

import { requireSupabase } from './client';

export type TripRole = 'owner' | 'editor' | 'viewer';

export interface TripMember {
  userId: string;
  role: TripRole;
  email: string;
  name: string;
  joinedAt: string;
}

export interface TripInvite {
  id: string;
  email: string | null;
  role: TripRole;
  token: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

export const ROLE_LABEL: Record<TripRole, string> = {
  owner: 'בעלים',
  editor: 'עריכה',
  viewer: 'צפייה',
};

/**
 * Members and their profiles are read separately and joined here: the
 * membership row points at `auth.users`, not at `profiles`, so PostgREST has
 * no relationship to traverse and an embedded select would fail.
 */
export async function fetchMembers(tripId: string): Promise<TripMember[]> {
  const supabase = requireSupabase();

  const { data: rows, error } = await supabase
    .from('trip_members')
    .select('user_id, role, created_at')
    .eq('trip_id', tripId);
  if (error) throw error;

  const ids = (rows ?? []).map((r) => r.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('id', ids);
  if (pErr) throw pErr;

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));

  return (rows ?? []).map((r) => {
    const p = byId.get(r.user_id as string);
    const email = (p?.email as string) ?? '';
    return {
      userId: r.user_id as string,
      role: r.role as TripRole,
      email,
      name: (p?.full_name as string) || email.split('@')[0] || 'מטייל',
      joinedAt: String(r.created_at ?? ''),
    };
  });
}

export async function fetchInvites(tripId: string): Promise<TripInvite[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('trip_invites')
    .select('id, email, role, token, created_at, expires_at, accepted_at')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    id: r.id as string,
    email: (r.email as string) ?? null,
    role: r.role as TripRole,
    token: r.token as string,
    createdAt: String(r.created_at ?? ''),
    expiresAt: String(r.expires_at ?? ''),
    acceptedAt: (r.accepted_at as string) ?? null,
  }));
}

/** `email: null` creates a reusable share link instead of a personal invite. */
export async function createInvite(
  tripId: string,
  role: TripRole,
  email?: string
): Promise<TripInvite> {
  const supabase = requireSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('not signed in');

  const { data, error } = await supabase
    .from('trip_invites')
    .insert({
      trip_id: tripId,
      email: email?.trim().toLowerCase() || null,
      role,
      invited_by: auth.user.id,
    })
    .select('id, email, role, token, created_at, expires_at, accepted_at')
    .single();
  if (error) throw error;

  return {
    id: data.id as string,
    email: (data.email as string) ?? null,
    role: data.role as TripRole,
    token: data.token as string,
    createdAt: String(data.created_at ?? ''),
    expiresAt: String(data.expires_at ?? ''),
    acceptedAt: (data.accepted_at as string) ?? null,
  };
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase.from('trip_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

export async function setMemberRole(
  tripId: string,
  userId: string,
  role: TripRole
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('trip_members')
    .update({ role })
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function removeMember(tripId: string, userId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('trip_id', tripId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** What the current user is allowed to do on a trip. */
export async function fetchMyRole(tripId: string): Promise<TripRole | null> {
  const supabase = requireSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as TripRole) ?? null;
}

/* ------------------------------------------------------------------ *
 * Joining
 * ------------------------------------------------------------------ */

export interface InvitePreview {
  tripId: string;
  tripName: string;
  destination: string;
  role: TripRole;
  expired: boolean;
}

export async function peekInvite(token: string): Promise<InvitePreview | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('peek_trip_invite', { p_token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    tripId: row.trip_id as string,
    tripName: row.trip_name as string,
    destination: row.destination as string,
    role: row.role as TripRole,
    expired: Boolean(row.expired),
  };
}

export async function acceptInvite(token: string): Promise<string> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('accept_trip_invite', { p_token: token });
  if (error) throw error;
  return data as string;
}

export function inviteLink(token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/join?token=${token}`;
}
