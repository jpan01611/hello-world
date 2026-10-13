'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PostPhoto } from '../posts/PostPhoto';

type PublicPost = { id: string; image_url: string; caption: string | null; score: number | null };

export function PublicFeed({ posts }: { posts: PublicPost[] }) {
    const [filter, setFilter] = useState<'all' | 'top'>('all');
    const visiblePosts = useMemo(() => filter === 'top' ? [...posts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : posts, [filter, posts]);
    return (
        <>
            <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Public post filters">
                <button type="button" onClick={() => setFilter('all')} className={filter === 'all' ? 'sahur-button' : 'sahur-button-secondary'} aria-pressed={filter === 'all'}>All posts</button>
                <button type="button" onClick={() => setFilter('top')} className={filter === 'top' ? 'sahur-button' : 'sahur-button-secondary'} aria-pressed={filter === 'top'}>Top rated</button>
            </div>
            <div className="grid grid-cols-1 items-start gap-6 min-[460px]:grid-cols-2 lg:grid-cols-3">
                {visiblePosts.map((post, index) => (
                    <article key={post.id} className="sahur-post">
                        <PostPhoto src={post.image_url} priority={index === 0} />
                        <div className="p-3">
                            <p className="text-base font-bold leading-relaxed">{post.caption ?? 'The punchline is still loading in real life.'}</p>
                            {post.caption !== null && <p className="sahur-tag mt-3">Top rated · {post.score ?? 0} net votes</p>}
                            <Link href="/login" className="sahur-button-ghost mt-4 w-full">Sign in to vote & see more</Link>
                        </div>
                    </article>
                ))}
            </div>
        </>
    );
}
