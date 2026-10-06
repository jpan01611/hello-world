import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PostPhoto } from './PostPhoto';
import { createClient } from '@/lib/supabase/server';
import { NewPostTile } from './NewPostTile';
import { ImageCard } from './ImageCard';

type ImageRow = {
    id: string;
    created_by: string;
    image_url: string;
    created_at: string;
    captions: {
        id: string;
        description: string;
        caption: string;
        created_at: string;
        votes: { user_id: string; value: number }[];
    }[];
};

type PublicPost = { id: string; image_url: string; caption: string | null; score: number | null };

export default async function Home() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', user.id)
            .single();

        if (!profile?.first_name || !profile?.last_name) {
            redirect('/complete-profile');
        }
    }

    const publicFeed = !user ? await supabase.rpc('public_featured_feed') : null;

    // RLS allows any logged-in user to read all rows, so this is a shared
    // gallery rather than a per-user one. The nested selects rely on the
    // image_id -> images(id) and caption_id -> captions(id) foreign keys.
    // Captions are explicitly ordered by creation time so their on-screen
    // position stays stable regardless of vote changes.
    const { data: images, error: imageError } = user ? await supabase
        .from('images')
        .select('id, created_by, image_url, created_at, captions(id, description, caption, created_at, votes(user_id, value))')
        .order('created_at', { foreignTable: 'captions', ascending: true })
        .order('created_at', { ascending: false }) : { data: null, error: null };
    const error = publicFeed?.error ?? imageError;
    const publicPosts: PublicPost[] = publicFeed?.data ?? [];

    // Defensive: dedupe by id so a duplicate row (e.g. a stray re-insert)
    // can never cause two list entries to share a React key, which would
    // make them share component state (one card's "show more" toggling
    // another's).
    const uniqueImages = images
        ? Array.from(new Map(images.map((img: ImageRow) => [img.id, img])).values())
        : images;

    return (
        <div className="sahur-page">
            <div className="w-full max-w-6xl">
                <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="sahur-logo" aria-label="funfunfunsahur">
                            <span aria-hidden="true" className="sahur-logo-seal">f.</span>
                            <div aria-hidden="true">
                                <span className="sahur-logo-wordmark"><span>fun</span><span>fun</span><span>fun</span><span className="sahur-logo-ending">sahur</span></span>
                                <span className="sahur-logo-caption">the caption lodge</span>
                            </div>
                        </div>
                    </div>
                    <nav aria-label="Account" className="flex gap-3">
                    {user ? (
                        <>
                            <Link href="/profile" className="sahur-button-secondary">My profile</Link>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className="sahur-button-secondary">Log in</Link>
                            <Link href="/login" className="sahur-button">Join the lodge</Link>
                        </>
                    )}
                    </nav>
                </header>

                <section className="relative mb-10 overflow-hidden rounded-[2rem] border-2 border-[#302017] bg-[#493024] px-6 py-10 text-[#fff9ec] shadow-[6px_7px_0_#bda487] sm:px-10">
                    <p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[#dbf575]">Good photos. Questionable punchlines.</p>
                    <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
                        Bring the photo.<br />We bring the <span className="text-[#ffae70]">chaos.</span>
                    </h1>
                    <p className="mt-5 max-w-xl text-base leading-relaxed text-[#e4ccb1]">
                        Dorm lore, subway moments, weekend side quests. Turn your photos into AI punchlines and let the crowd pick the bangers.
                    </p>
                    <div className="mt-7 flex flex-wrap gap-3">
                        <Link href={user ? '/new' : '/login'} className="sahur-button">{user ? 'Drop a photo +' : 'Sign up & make a caption'}</Link>
                        <span className="inline-flex items-center rounded-xl border border-[#a78669] px-4 py-2 text-xs font-semibold">Photo → AI caption → crowd vote</span>
                    </div>
                </section>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div><p className="sahur-eyebrow">The community corkboard</p><h2 className="mt-1 text-2xl font-black">Fresh from the lodge</h2></div>
                    <span className="sahur-tag">{user ? 'Tap a vote. Settle the debate.' : 'Top captions, open to everyone.'}</span>
                </div>

                {error ? (
                    <p className="text-sm text-red-600">Error loading images: {error.message}</p>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-6 min-[460px]:grid-cols-2 lg:grid-cols-3">
                        {user && <NewPostTile />}
                        {user && uniqueImages?.map((image: ImageRow) => (
                            <ImageCard
                                key={image.id}
                                imageId={image.id}
                                imageUrl={image.image_url}
                                captions={image.captions}
                                currentUserId={user.id}
                                createdBy={image.created_by}
                            />
                        ))}
                        {!user && publicPosts.map((post) => (
                            <article key={post.id} className="sahur-post">
                                <PostPhoto src={post.image_url} />
                                <div className="p-3">
                                    <p className="text-base font-bold leading-relaxed">{post.caption ?? 'The punchline is still loading in real life.'}</p>
                                    {post.caption !== null && <p className="sahur-tag mt-3">Crowd pick · {post.score ?? 0} net votes</p>}
                                    <Link href="/login" className="sahur-button-ghost mt-4 w-full">Sign in to vote & see more</Link>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
                {!error && (user ? uniqueImages?.length === 0 : publicPosts.length === 0) && (
                    <div className="sahur-panel mt-6 text-center">
                        <h3 className="text-xl font-black">Quiet lodge. Loud potential.</h3>
                        <p className="mt-2">Be the first to bring a photo worth captioning.</p>
                        <Link href={user ? '/new' : '/login'} className="sahur-button mt-5">Start the fun</Link>
                    </div>
                )}
                <footer className="mt-12 border-t-2 border-dashed border-[#bda487] pt-5 text-sm text-[#71523c]">Made for the group-chat sense of humor. Powered by AI, judged by humans.</footer>
            </div>
        </div>
    );
}
