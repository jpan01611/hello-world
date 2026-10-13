import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { ImageCard } from '@/app/_components/posts/ImageCard';

type PostPageProps = {
    params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: image, error } = await supabase
        .from('images')
        .select('id, created_by, image_url, context, selected_caption_id, created_at, captions:captions!captions_image_id_fkey(id, created_by, caption, created_at, votes(user_id, value))')
        .eq('id', id)
        .maybeSingle();

    if (error || !image) notFound();

    const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', image.created_by)
        .maybeSingle();
    const authorName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Columbia creator';

    return (
        <div className="sahur-page">
            <div className="w-full max-w-2xl">
                <Link href="/" className="sahur-button-ghost mb-5 inline-flex">← Back to the lodge</Link>
                <p className="sahur-eyebrow">Post details</p>
                <h1 className="mt-1 mb-5 text-3xl font-black tracking-tight">The full caption board</h1>
                <ImageCard
                    imageId={image.id}
                    imageUrl={image.image_url}
                    authorName={authorName}
                    context={image.context}
                    selectedCaptionId={image.selected_caption_id}
                    captions={image.captions}
                    currentUserId={user.id}
                    createdBy={image.created_by}
                    priority
                    displayAllCaptions
                    showCaptionManagement={image.created_by === user.id}
                />
            </div>
        </div>
    );
}
