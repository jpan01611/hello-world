import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { NewPostTile } from './NewPostTile';
import { ImageCard } from './ImageCard';

type ImageRow = {
    id: string;
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

export default async function GalleryPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // RLS allows any logged-in user to read all rows, so this is a shared
    // gallery rather than a per-user one. The nested selects rely on the
    // image_id -> images(id) and caption_id -> captions(id) foreign keys.
    // Captions are explicitly ordered by creation time so their on-screen
    // position stays stable regardless of vote changes.
    const { data: images, error } = await supabase
        .from('images')
        .select('id, image_url, created_at, captions(id, description, caption, created_at, votes(user_id, value))')
        .order('created_at', { foreignTable: 'captions', ascending: true })
        .order('created_at', { ascending: false });

    // Defensive: dedupe by id so a duplicate row (e.g. a stray re-insert)
    // can never cause two list entries to share a React key, which would
    // make them share component state (one card's "show more" toggling
    // another's).
    const uniqueImages = images
        ? Array.from(new Map(images.map((img: ImageRow) => [img.id, img])).values())
        : images;

    return (
        <div className="flex flex-1 flex-col items-center gap-6 bg-zinc-50 px-6 py-12 font-sans dark:bg-black">
            <div className="w-full max-w-5xl">
                <Link href="/" className="mb-4 inline-block text-sm text-blue-600 underline">
                    ← Back to home
                </Link>

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-extrabold tracking-tight text-black dark:text-zinc-50">
                        Crackd 🥚
                    </h1>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Every picture deserves a good laugh. Upload a photo, generate a caption, and vote on your favorites.
                    </p>
                </div>

                {error ? (
                    <p className="text-sm text-red-600">Error loading images: {error.message}</p>
                ) : (
                    <div className="grid grid-cols-2 items-start gap-4 sm:grid-cols-3 lg:grid-cols-4">
                        <NewPostTile />
                        {uniqueImages?.map((image: ImageRow) => (
                            <ImageCard
                                key={image.id}
                                imageId={image.id}
                                imageUrl={image.image_url}
                                captions={image.captions}
                                currentUserId={user.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
