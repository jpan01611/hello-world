'use client';

import { useMemo, useState } from 'react';
import { ImageCard } from './ImageCard';
import { NewPostTile } from './NewPostTile';

type Vote = { user_id: string; value: number };
type Caption = { id: string; created_by: string; caption: string; created_at: string; votes: Vote[] };
export type FeedImage = {
    id: string;
    created_by: string;
    image_url: string;
    context: string | null;
    created_at: string;
    captions: Caption[];
};

type FeedFilter = 'all' | 'mine' | 'unvoted' | 'no-caption';

export function FeedGrid({ images, currentUserId, showNewPost = true }: {
    images: FeedImage[];
    currentUserId: string;
    showNewPost?: boolean;
}) {
    const [filter, setFilter] = useState<FeedFilter>('all');
    const filteredImages = useMemo(() => images.filter((image) => {
        if (filter === 'mine') return image.created_by === currentUserId;
        if (filter === 'no-caption') return image.captions.length === 0;
        if (filter === 'unvoted') {
            return !image.captions.some((caption) => caption.votes.some((vote) => vote.user_id === currentUserId));
        }
        return true;
    }), [currentUserId, filter, images]);

    const filters: { value: FeedFilter; label: string }[] = [
        { value: 'all', label: 'All posts' },
        { value: 'mine', label: 'My posts' },
        { value: 'unvoted', label: 'Unvoted' },
        { value: 'no-caption', label: 'No caption yet' },
    ];

    return (
        <>
            <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter posts">
                {filters.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        className={filter === item.value ? 'sahur-button' : 'sahur-button-secondary'}
                        aria-pressed={filter === item.value}
                        onClick={() => setFilter(item.value)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-1 items-start gap-6 min-[460px]:grid-cols-2 lg:grid-cols-3">
                {showNewPost && <NewPostTile />}
                {filteredImages.map((image, index) => (
                    <ImageCard
                        key={image.id}
                        imageId={image.id}
                        imageUrl={image.image_url}
                        context={image.context}
                        captions={image.captions}
                        currentUserId={currentUserId}
                        createdBy={image.created_by}
                        priority={index === 0}
                    />
                ))}
            </div>
            {filteredImages.length === 0 && (
                <div className="sahur-panel mt-6 text-center">
                    <h3 className="text-xl font-black">Nothing matches this filter yet.</h3>
                    <p className="mt-2">Try another view or bring a fresh photo to the wall.</p>
                </div>
            )}
        </>
    );
}
