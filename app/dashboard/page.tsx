import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { FeedGrid, type FeedImage } from '../_components/posts/FeedGrid';

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const [{ data: profile }, { data: images, error }] = await Promise.all([
        supabase.from('profiles').select('first_name, last_name').eq('id', user.id).maybeSingle(),
        supabase
        .from('images')
        .select('id, created_by, image_url, context, created_at, captions(id, created_by, caption, created_at, votes(user_id, value))')
        .eq('created_by', user.id)
        .order('created_at', { foreignTable: 'captions', ascending: true })
        .order('created_at', { ascending: false }),
    ]);

    const imageRows = images ?? [];
    const authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'You';
    const posts = imageRows.map((post) => ({ ...post, author_name: authorName })) as FeedImage[];
    const captionCount = posts.reduce((count, post) => count + post.captions.length, 0);
    const voteCount = posts.reduce((count, post) => count + post.captions.reduce((inner, caption) => inner + caption.votes.length, 0), 0);

    return (
        <div className="sahur-page">
            <div className="w-full max-w-6xl">
                <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link href="/" className="sahur-button-ghost mb-4 inline-flex">← Back to the lodge</Link>
                        <p className="sahur-eyebrow">Your personal corner</p>
                        <h1 className="mt-1 text-4xl font-black tracking-tight">Creator dashboard</h1>
                        <p className="mt-2 max-w-xl leading-relaxed">Keep track of your photos, caption ideas, and the votes your posts are collecting.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link href="/profile" className="sahur-button-secondary">My profile</Link>
                        <Link href="/new" className="sahur-button">Upload a new post +</Link>
                    </div>
                </header>

                {error ? (
                    <p className="text-sm text-red-600">Error loading your dashboard: {error.message}</p>
                ) : (
                    <>
                        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="sahur-panel p-4"><p className="sahur-eyebrow">Your posts</p><p className="mt-2 text-3xl font-black">{posts.length}</p></div>
                            <div className="sahur-panel p-4"><p className="sahur-eyebrow">AI captions</p><p className="mt-2 text-3xl font-black">{captionCount}</p></div>
                            <div className="sahur-panel p-4"><p className="sahur-eyebrow">Community votes</p><p className="mt-2 text-3xl font-black">{voteCount}</p></div>
                        </div>
                        {posts.length > 0 ? <FeedGrid images={posts} currentUserId={user.id} showNewPost={false} showFilters={false} /> : (
                            <div className="sahur-panel text-center">
                                <h2 className="text-2xl font-black">Your wall is ready.</h2>
                                <p className="mt-2">Upload a NYC or Columbia moment and give the AI some context.</p>
                                <Link href="/new" className="sahur-button mt-5">Upload your first post</Link>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
