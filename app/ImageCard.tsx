'use client';

import { PostPhoto } from './PostPhoto';
import { useOptimistic, useState, useTransition } from 'react';
import { deleteImageAction, generateCaptionAction, updateImageAction, voteOnCaptionAction } from './actions';
import { UPLOAD_SIZE_HINT, uploadSizeError } from '@/lib/upload-limits';

type Vote = {
    user_id: string;
    value: number;
};

type Caption = {
    id: string;
    description: string;
    caption: string;
    created_at: string;
    votes: Vote[];
};

type ImageCardProps = {
    imageId: string;
    imageUrl: string;
    captions: Caption[];
    currentUserId: string;
    createdBy: string;
};

type VoteAction = {
    captionId: string;
    value: 1 | -1;
    userId: string;
};

function netVotes(caption: Caption) {
    return caption.votes.reduce((sum, v) => sum + v.value, 0);
}

function myVote(caption: Caption, userId: string) {
    return caption.votes.find((v) => v.user_id === userId)?.value ?? 0;
}

// Up/down arrows + net score for a single caption, Crackd.ai-style voting.
function VoteControls({
    caption,
    currentUserId,
    pending,
    onVote,
}: {
    caption: Caption;
    currentUserId: string;
    pending: boolean;
    onVote: (captionId: string, value: 1 | -1) => void;
}) {
    const score = netVotes(caption);
    const mine = myVote(caption, currentUserId);

    return (
        <div className="flex items-center gap-1 text-sm">
            <button
                type="button"
                onClick={() => onVote(caption.id, 1)}
                disabled={pending}
                aria-label="Upvote"
                aria-pressed={mine === 1}
                className="sahur-vote"
            >
                ▲
            </button>
            <span className="min-w-8 text-center font-black" aria-live="polite">
                {score}
            </span>
            <button
                type="button"
                onClick={() => onVote(caption.id, -1)}
                disabled={pending}
                aria-label="Downvote"
                aria-pressed={mine === -1}
                className="sahur-vote"
            >
                ▼
            </button>
        </div>
    );
}

// Displays one gallery image plus all of its captions in a stable,
// creation-order list (never reshuffled by vote changes — that caused
// captions to visually "jump" between a special top slot and a collapsed
// list). The highest-voted caption is labelled "Top caption" in place,
// without moving position.
export function ImageCard({ imageId, imageUrl, captions, currentUserId, createdBy }: ImageCardProps) {
    const [isGenerating, startGenerateTransition] = useTransition();
    const [, startVoteTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [votingId, setVotingId] = useState<string | null>(null);
    const [showAllCaptions, setShowAllCaptions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, startSaveTransition] = useTransition();
    const isOwner = currentUserId === createdBy;

    function handleUpdate(formData: FormData) {
        setError(null);
        const file = formData.get('file');
        const sizeError = file instanceof File ? uploadSizeError(file) : null;
        if (sizeError) {
            setError(sizeError);
            return;
        }
        startSaveTransition(async () => {
            try {
                await updateImageAction(imageId, formData);
                setIsEditing(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update post');
            }
        });
    }

    function handleDelete() {
        if (!window.confirm('Delete this post and all its captions and votes?')) return;
        setError(null);
        startSaveTransition(async () => {
            try {
                await deleteImageAction(imageId);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete post');
            }
        });
    }

    // Mirrors the server's toggle_vote logic locally so the score/highlight
    // flips the instant you click, instead of waiting on the full round
    // trip (RPC + gallery re-fetch) to see it reflected.
    const [optimisticCaptions, applyOptimisticVote] = useOptimistic(
        captions,
        (current: Caption[], action: VoteAction) => current.map((c) => {
            if (c.id !== action.captionId) {
                return c;
            }
            const mine = myVote(c, action.userId);
            const votesWithoutMine = c.votes.filter((v) => v.user_id !== action.userId);
            const votes = mine === action.value
                ? votesWithoutMine
                : [...votesWithoutMine, { user_id: action.userId, value: action.value }];
            return { ...c, votes };
        }),
    );

    function handleGenerateCaption() {
        setError(null);
        startGenerateTransition(async () => {
            try {
                await generateCaptionAction(imageId);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to generate caption');
            }
        });
    }

    function handleVote(captionId: string, value: 1 | -1) {
        setError(null);
        setVotingId(captionId);
        startVoteTransition(async () => {
            applyOptimisticVote({ captionId, value, userId: currentUserId });
            try {
                await voteOnCaptionAction(captionId, value);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to vote');
            } finally {
                setVotingId(null);
            }
        });
    }

    const scores = optimisticCaptions.map((c) => netVotes(c));
    const topScore = scores.length > 0 ? Math.max(...scores) : null;
    const topScoreCount = scores.filter((s) => s === topScore).length;
    // Only label a caption "Top caption" when there's a unique leader among
    // 2+ captions — a tie (including all-zero) means no caption stands out.
    const hasUniqueTop = optimisticCaptions.length > 1 && topScoreCount === 1;

    // Feature the best-rated caption by default (priority 1: highest net
    // votes; priority 2, among ties, the newest). The rest stay collapsed
    // behind a "show more" toggle so each post reads cleanly at a glance.
    const featuredIndex = optimisticCaptions.length === 0
        ? -1
        : optimisticCaptions.reduce((bestIdx, c, i) => {
            const best = optimisticCaptions[bestIdx];
            if (netVotes(c) > netVotes(best)) return i;
            if (netVotes(c) === netVotes(best) && c.created_at > best.created_at) return i;
            if (netVotes(c) === netVotes(best) && c.created_at === best.created_at && c.id > best.id) return i;
            return bestIdx;
        }, 0);
    const otherCaptions = optimisticCaptions.filter((_, i) => i !== featuredIndex);

    function renderCaption(c: Caption) {
        return (
            <li key={`${imageId}-${c.id}`} className="flex flex-col gap-3 border-t-2 border-dashed border-[#dbc5a5] pt-4 first:border-t-0 first:pt-0">
                <p className="text-base font-bold leading-relaxed">
                    {c.caption}
                </p>
                <div className="flex items-center justify-between">
                    <VoteControls
                        caption={c}
                        currentUserId={currentUserId}
                        pending={votingId === c.id}
                        onVote={handleVote}
                    />
                    {hasUniqueTop && netVotes(c) === topScore && (
                        <span className="sahur-tag">
                            Crowd pick
                        </span>
                    )}
                </div>
            </li>
        );
    }

    return (
        <article className="sahur-post group flex flex-col">
            <PostPhoto src={imageUrl} />

            <div className="flex flex-col gap-4 p-3">
                <p className="sahur-eyebrow">{isOwner ? 'Your photo. Your chaos.' : 'AI wrote it. You judge it.'}</p>
                {isOwner && <button
                    type="button"
                    onClick={handleGenerateCaption}
                    disabled={isGenerating}
                    className={`sahur-button w-full ${isGenerating ? 'sahur-loading' : ''}`}
                >
                    {isGenerating
                        ? 'Generating…'
                        : optimisticCaptions.length > 0
                            ? 'Generate another caption'
                            : 'Generate Caption'}
                </button>}

                {isOwner && (
                    <div className="flex flex-col gap-2 text-xs">
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className="sahur-button-ghost" aria-expanded={isEditing} disabled={isSaving} onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancel edit' : 'Edit post'}</button>
                            <button type="button" disabled={isSaving} onClick={handleDelete} className="sahur-button-ghost">Delete post</button>
                        </div>
                        {isEditing && (
                            <form action={handleUpdate} className="flex flex-col gap-3 rounded-xl bg-[#eadcc4] p-3">
                                <label>Replace with a photo
                                    <input type="file" name="file" accept="image/*" className="mt-1 w-full" onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        setError(file ? uploadSizeError(file) : null);
                                    }} />
                                </label>
                                <p>{UPLOAD_SIZE_HINT}</p>
                                <label>Or use an image URL
                                    <input type="url" name="imageUrl" placeholder={imageUrl} className="sahur-input mt-1" />
                                </label>
                                <button type="submit" className="sahur-button-secondary" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save photo'}</button>
                            </form>
                        )}
                    </div>
                )}

                {error && <p role="alert" className="rounded-lg bg-[#ffe0cf] p-3 text-sm text-[#8d301a]">{error}</p>}

                {optimisticCaptions.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {featuredIndex !== -1 && renderCaption(optimisticCaptions[featuredIndex])}
                        {showAllCaptions && otherCaptions.map(renderCaption)}
                    </ul>
                )}

                {otherCaptions.length > 0 && (
                    <button
                        type="button"
                        aria-expanded={showAllCaptions}
                        onClick={() => setShowAllCaptions((v) => !v)}
                        className="sahur-button-secondary w-full"
                    >
                        {showAllCaptions
                            ? 'Hide other captions'
                            : `Show ${otherCaptions.length} more caption${otherCaptions.length === 1 ? '' : 's'}`}
                    </button>
                )}
            </div>
        </article>
    );
}
