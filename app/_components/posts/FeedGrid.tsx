'use client';

import { useMemo, useState } from 'react';
import { ImageCard } from './ImageCard';
import { NewPostTile } from './NewPostTile';

type Vote = { user_id: string; value: number };
type Caption = { id: string; created_by: string; caption: string; created_at: string; votes: Vote[] };
export type FeedImage = {
    id: string;
    created_by: string;
    author_name?: string | null;
    image_url: string;
    context: string | null;
    selected_caption_id: string | null;
    created_at: string;
    captions: Caption[];
};

type FeedFilter = 'all' | 'top' | 'mine' | 'unvoted' | 'no-caption';

function postScore(image: FeedImage) {
    const selectedCaption = image.captions.find((caption) => caption.id === image.selected_caption_id);
    const displayedCaption = selectedCaption ?? [...image.captions].sort((a, b) => {
        const scoreDifference = b.votes.reduce((total, vote) => total + vote.value, 0)
            - a.votes.reduce((total, vote) => total + vote.value, 0);
        if (scoreDifference !== 0) return scoreDifference;
        const dateDifference = b.created_at.localeCompare(a.created_at);
        return dateDifference !== 0 ? dateDifference : b.id.localeCompare(a.id);
    })[0];

    return displayedCaption?.votes.reduce((score, vote) => score + vote.value, 0) ?? 0;
}

export function FeedGrid({ images, currentUserId, showNewPost = true, showFilters = true, displayAllCaptions = true, showCaptionManagement = true }: {
    images: FeedImage[];
    currentUserId: string;
    showNewPost?: boolean;
    showFilters?: boolean;
    displayAllCaptions?: boolean;
    showCaptionManagement?: boolean;
}) {
    const [filter, setFilter] = useState<FeedFilter>('all');
    const filteredImages = useMemo(() => {
        const matchingImages = images.filter((image) => {
            if (filter === 'mine') return image.created_by === currentUserId;
            if (filter === 'no-caption') return image.captions.length === 0;
            if (filter === 'unvoted') {
                return !image.captions.some((caption) => caption.votes.some((vote) => vote.user_id === currentUserId));
            }
            return true;
        });

        if (filter !== 'top') return matchingImages;

        return [...matchingImages].sort((a, b) => {
            const scoreDifference = postScore(b) - postScore(a);
            if (scoreDifference !== 0) return scoreDifference;
            const dateDifference = b.created_at.localeCompare(a.created_at);
            return dateDifference !== 0 ? dateDifference : b.id.localeCompare(a.id);
        });
    }, [currentUserId, filter, images]);

    const filters: { value: FeedFilter; label: string }[] = [
        { value: 'all', label: 'All posts' },
        { value: 'top', label: 'Top rated' },
        { value: 'mine', label: 'My posts' },
        { value: 'unvoted', label: 'Unvoted' },
        { value: 'no-caption', label: 'No caption yet' },
    ];

    return (
        <>
            {showFilters && <div className="mb-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filter posts">
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
            </div>}
            <div className="grid grid-cols-1 items-start gap-6 min-[460px]:grid-cols-2 lg:grid-cols-3">
                {showNewPost && <NewPostTile />}
                {filteredImages.map((image, index) => (
                    <ImageCard
                        key={image.id}
                        imageId={image.id}
                        imageUrl={image.image_url}
                        authorName={image.author_name}
                        context={image.context}
                        selectedCaptionId={image.selected_caption_id}
                        captions={image.captions}
                        currentUserId={currentUserId}
                        createdBy={image.created_by}
                        priority={index === 0}
                        displayAllCaptions={displayAllCaptions}
                        showCaptionManagement={showCaptionManagement}
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
