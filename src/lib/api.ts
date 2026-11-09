/**
 * All database calls live here so screens stay simple.
 * Every function throws an Error with a readable message when something fails.
 */

import type {
    AppEvent,
    AuthorInfo,
    Business,
    Comment,
    MediaType,
    Post,
    PostThumb,
    Profile,
    Promotion,
    Review,
    ReviewTarget,
    Story,
    StoryGroup,
} from '../types';
import { supabase } from './supabase';

// Rows come back from Supabase without generated types, so keep them loose here
// and give them proper types on the way out.
type Row = Record<string, any>;

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const AUTHOR = 'author:profiles(id, username, avatar_url)';

/* ------------------------------- Profiles -------------------------------- */

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  check(error);
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  patch: { full_name?: string | null; bio?: string | null; avatar_url?: string | null },
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  check(error);
}

export async function fetchProfileStats(
  userId: string,
): Promise<{ posts: number; followers: number; following: number }> {
  const [posts, followers, following] = await Promise.all([
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  check(posts.error);
  check(followers.error);
  check(following.error);
  return { posts: posts.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function fetchUserPosts(userId: string): Promise<PostThumb[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, media_url, media_type, like_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  check(error);
  return (data ?? []) as PostThumb[];
}

/* -------------------------------- Follows -------------------------------- */

async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
  check(error);
  return (data ?? []).map((r: Row) => r.following_id as string);
}

export async function isFollowing(me: string, target: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', me)
    .eq('following_id', target)
    .maybeSingle();
  check(error);
  return data !== null;
}

export async function setFollowing(me: string, target: string, follow: boolean): Promise<void> {
  if (follow) {
    const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: target });
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', target);
    check(error);
  }
}

/* --------------------------------- Posts --------------------------------- */

const POST_SELECT = `*, ${AUTHOR}, business:businesses(id, name), event:events(id, title)`;
export const PAGE_SIZE = 10;

export type FeedMode = 'latest' | 'following' | 'trending';

async function decoratePosts(userId: string, rows: Row[]): Promise<Post[]> {
  if (rows.length === 0) return [];
  const postIds = rows.map((r) => r.id as string);
  const authorIds = [...new Set(rows.map((r) => r.user_id as string))];

  const [likes, follows] = await Promise.all([
    supabase.from('post_likes').select('post_id').eq('user_id', userId).in('post_id', postIds),
    supabase.from('follows').select('following_id').eq('follower_id', userId).in('following_id', authorIds),
  ]);
  check(likes.error);
  check(follows.error);

  const likedSet = new Set((likes.data ?? []).map((l: Row) => l.post_id as string));
  const followSet = new Set((follows.data ?? []).map((f: Row) => f.following_id as string));

  return rows.map((r): Post => ({
    ...(r as any),
    liked: likedSet.has(r.id),
    following: followSet.has(r.user_id),
  }));
}

export async function fetchFeed(userId: string, mode: FeedMode, page: number): Promise<Post[]> {
  let query = supabase.from('posts').select(POST_SELECT);

  if (mode === 'following') {
    const ids = await fetchFollowingIds(userId);
    if (ids.length === 0) return [];
    query = query.in('user_id', ids);
  }

  if (mode === 'trending') {
    query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const from = page * PAGE_SIZE;
  const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
  check(error);
  return decoratePosts(userId, data ?? []);
}

export async function fetchPost(userId: string, postId: string): Promise<Post> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', postId).single();
  check(error);
  const [post] = await decoratePosts(userId, [data as Row]);
  if (!post) throw new Error('Post not found');
  return post;
}

export async function createPost(
  userId: string,
  input: {
    mediaUrl: string;
    mediaType: MediaType;
    caption: string;
    placeName: string | null;
    businessId: string | null;
    eventId: string | null;
  },
): Promise<void> {
  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    media_url: input.mediaUrl,
    media_type: input.mediaType,
    caption: input.caption.trim() || null,
    place_name: input.placeName,
    business_id: input.businessId,
    event_id: input.eventId,
  });
  check(error);
}

export async function setLiked(userId: string, postId: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from('post_likes').insert({ user_id: userId, post_id: postId });
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
    check(error);
  }
}

/* -------------------------------- Comments ------------------------------- */

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`*, ${AUTHOR}`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  check(error);
  return (data ?? []) as Comment[];
}

export async function addComment(userId: string, postId: string, body: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ user_id: userId, post_id: postId, body: body.trim() })
    .select(`*, ${AUTHOR}`)
    .single();
  check(error);
  return data as Comment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', commentId);
  check(error);
}

/* --------------------------------- Stories ------------------------------- */

export async function fetchStoryGroups(userId: string): Promise<StoryGroup[]> {
  const ids = [userId, ...(await fetchFollowingIds(userId))];
  const { data, error } = await supabase
    .from('stories')
    .select(`*, ${AUTHOR}`)
    .in('user_id', ids)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  check(error);

  const groups = new Map<string, StoryGroup>();
  for (const row of (data ?? []) as Row[]) {
    const story: Story = {
      id: row.id,
      user_id: row.user_id,
      media_url: row.media_url,
      media_type: row.media_type,
      created_at: row.created_at,
      expires_at: row.expires_at,
    };
    const existing = groups.get(row.user_id);
    if (existing) {
      existing.stories.push(story);
    } else {
      groups.set(row.user_id, { user: row.author as AuthorInfo, stories: [story] });
    }
  }

  const all = [...groups.values()];
  // Your own story first.
  return [...all.filter((g) => g.user.id === userId), ...all.filter((g) => g.user.id !== userId)];
}

export async function fetchUserStories(userId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });
  check(error);
  return (data ?? []) as Story[];
}

export async function createStory(userId: string, mediaUrl: string, mediaType: MediaType): Promise<void> {
  const { error } = await supabase
    .from('stories')
    .insert({ user_id: userId, media_url: mediaUrl, media_type: mediaType });
  check(error);
}

/* --------------------------------- Events -------------------------------- */

export async function fetchEvents(opts: { from: Date; to?: Date; category?: string }): Promise<AppEvent[]> {
  let query = supabase
    .from('events')
    .select('*')
    .gte('starts_at', opts.from.toISOString())
    .order('starts_at', { ascending: true })
    .limit(200);
  if (opts.to) query = query.lte('starts_at', opts.to.toISOString());
  if (opts.category) query = query.eq('category', opts.category);
  const { data, error } = await query;
  check(error);
  return (data ?? []) as AppEvent[];
}

export async function fetchEvent(eventId: string): Promise<AppEvent> {
  const { data, error } = await supabase.from('events').select('*').eq('id', eventId).single();
  check(error);
  return data as AppEvent;
}

export interface EventInput {
  title: string;
  description: string | null;
  category: string;
  starts_at: string;
  ends_at: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_url: string | null;
  ticket_url: string | null;
  ticket_price: string | null;
  contact: string | null;
}

export async function createEvent(userId: string, input: EventInput): Promise<string> {
  const { data, error } = await supabase
    .from('events')
    .insert({ organizer_id: userId, ...input })
    .select('id')
    .single();
  check(error);
  return (data as Row).id as string;
}

export async function isInterested(userId: string, eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_interest')
    .select('event_id')
    .eq('user_id', userId)
    .eq('event_id', eventId)
    .maybeSingle();
  check(error);
  return data !== null;
}

export async function setInterested(userId: string, eventId: string, interested: boolean): Promise<void> {
  if (interested) {
    const { error } = await supabase.from('event_interest').insert({ user_id: userId, event_id: eventId });
    if (error && error.code !== '23505') throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('event_interest')
      .delete()
      .eq('user_id', userId)
      .eq('event_id', eventId);
    check(error);
  }
}

/* ------------------------------- Businesses ------------------------------ */

export async function fetchBusinesses(opts: {
  category?: string;
  categories?: string[];
  search?: string;
  ownerId?: string;
}): Promise<Business[]> {
  let query = supabase.from('businesses').select('*').order('created_at', { ascending: false }).limit(200);
  if (opts.category) query = query.eq('category', opts.category);
  if (opts.categories && opts.categories.length > 0) query = query.in('category', opts.categories);
  if (opts.ownerId) query = query.eq('owner_id', opts.ownerId);
  if (opts.search && opts.search.trim()) query = query.ilike('name', `%${opts.search.trim()}%`);
  const { data, error } = await query;
  check(error);
  return (data ?? []) as Business[];
}

export async function fetchBusiness(businessId: string): Promise<Business> {
  const { data, error } = await supabase.from('businesses').select('*').eq('id', businessId).single();
  check(error);
  return data as Business;
}

export interface BusinessInput {
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  website: string | null;
  booking_url: string | null;
  opening_hours: string | null;
  price_from: string | null;
  rooms_available: number | null;
  cover_url: string | null;
}

export async function createBusiness(userId: string, input: BusinessInput): Promise<string> {
  const { data, error } = await supabase
    .from('businesses')
    .insert({ owner_id: userId, ...input })
    .select('id')
    .single();
  check(error);
  return (data as Row).id as string;
}

export async function fetchPromotions(businessId: string): Promise<Promotion[]> {
  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  check(error);
  const now = Date.now();
  return ((data ?? []) as Promotion[]).filter((p) => !p.ends_at || new Date(p.ends_at).getTime() >= now);
}

export async function createPromotion(
  businessId: string,
  input: { title: string; description: string | null; media_url: string | null; ends_at: string | null },
): Promise<void> {
  const { error } = await supabase.from('promotions').insert({ business_id: businessId, ...input });
  check(error);
}

/* --------------------------------- Reviews ------------------------------- */

export async function fetchReviews(targetType: ReviewTarget, targetId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(`*, ${AUTHOR}`)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as Review[];
}

export async function upsertReview(
  userId: string,
  targetType: ReviewTarget,
  targetId: string,
  rating: number,
  comment: string,
): Promise<void> {
  const { error } = await supabase.from('reviews').upsert(
    {
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
      rating,
      comment: comment.trim() || null,
    },
    { onConflict: 'user_id,target_type,target_id' },
  );
  check(error);
}

/* ---------------------------- Tags and search ---------------------------- */

export interface TagResult {
  kind: 'business' | 'event';
  id: string;
  label: string;
}

export async function searchTags(text: string): Promise<TagResult[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const [biz, ev] = await Promise.all([
    supabase.from('businesses').select('id, name').ilike('name', `%${q}%`).limit(5),
    supabase.from('events').select('id, title').ilike('title', `%${q}%`).limit(5),
  ]);
  check(biz.error);
  check(ev.error);
  return [
    ...(biz.data ?? []).map((b: Row) => ({ kind: 'business' as const, id: b.id as string, label: b.name as string })),
    ...(ev.data ?? []).map((e: Row) => ({ kind: 'event' as const, id: e.id as string, label: e.title as string })),
  ];
}

/* ------------------------ Personalised recommendations ------------------- */

/** Remembers what the user looked at, so recommendations can improve over time. */
export function logInteraction(userId: string, kind: string, category?: string | null): void {
  supabase
    .from('interactions')
    .insert({ user_id: userId, kind, category: category ?? null })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** The categories this user interacts with most, from their last 100 actions. */
export async function fetchTopCategories(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('interactions')
    .select('category')
    .eq('user_id', userId)
    .not('category', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);
  check(error);

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Row[]) {
    const key = row.category as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}
