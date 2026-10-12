'use client';

import { PostPhoto } from './PostPhoto';
import { useOptimistic, useState, useTransition } from 'react';
import { deleteCaptionAction, deleteImageAction, generateCaptionAction, updateImageContextAction, voteOnCaptionAction } from '@/app/_actions/posts';

type Vote = {
    user_id: string;
    value: number;
};

type Caption = {
    id: string;
    created_by: string;
    caption: string;
    created_at: string;
    votes: Vote[];
};

type ImageCardProps = {
    imageId: string;
    imageUrl: string;
    authorName?: string | null;
    context?: string | null;
    captions: Caption[];
    currentUserId: string;
    createdBy: string;
    priority?: boolean;
};

type VoteAction = {
    type: 'vote';
    captionId: string;
    value: 1 | -1;
    userId: string;
};

type CaptionAction = VoteAction | { type: 'delete'; captionId: string };

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
export function ImageCard({ imageId, imageUrl, authorName, captions, currentUserId, createdBy, context, priority = false }: ImageCardProps) {
    const [isGenerating, startGenerateTransition] = useTransition();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [isSavingContext, startSaveContextTransition] = useTransition();
    const [deletingCaptionId, setDeletingCaptionId] = useState<string | null>(null);
    const [isVoting, startVoteTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [showAllCaptions, setShowAllCaptions] = useState(false);
    const [isEditingContext, setIsEditingContext] = useState(false);
    const [currentContext, setCurrentContext] = useState(context ?? '');
    const isOwner = currentUserId === createdBy;

    function handleDelete() {
        if (!window.confirm('Delete this post and all its captions and votes?')) return;
        setError(null);
        startDeleteTransition(async () => {
            try {
                await deleteImageAction(imageId);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete post');
            }
        });
    }

    function handleContextSubmit(formData: FormData) {
        setError(null);
        startSaveContextTransition(async () => {
            try {
                await updateImageContextAction(imageId, formData);
                setCurrentContext(String(formData.get('context') ?? '').trim());
                setIsEditingContext(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to update context');
            }
        });
    }

    // Mirrors the server's toggle_vote logic locally so the score/highlight
    // flips the instant you click, instead of waiting on the full round
    // trip (RPC + gallery re-fetch) to see it reflected.
    const [optimisticCaptions, applyOptimisticVote] = useOptimistic(
        captions,
        (current: Caption[], action: CaptionAction) => {
            if (action.type === 'delete') {
                return current.filter((c) => c.id !== action.captionId);
            }

            return current.map((c) => {
                if (c.id !== action.captionId) {
                    return c;
                }
                const mine = myVote(c, action.userId);
                const votesWithoutMine = c.votes.filter((v) => v.user_id !== action.userId);
                const votes = mine === action.value
                    ? votesWithoutMine
                    : [...votesWithoutMine, { user_id: action.userId, value: action.value }];
                return { ...c, votes };
            });
        },
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
        if (isVoting) return;
        setError(null);
        startVoteTransition(async () => {
            applyOptimisticVote({ type: 'vote', captionId, value, userId: currentUserId });
            try {
                await voteOnCaptionAction(captionId, value);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to vote');
            }
        });
    }

    function handleDeleteCaption(captionId: string) {
        if (!window.confirm('Delete this caption and its votes?')) return;
        setError(null);
        setDeletingCaptionId(captionId);
        startDeleteTransition(async () => {
            applyOptimisticVote({ type: 'delete', captionId });
            try {
                await deleteCaptionAction(captionId);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete caption');
            } finally {
                setDeletingCaptionId(null);
            }
        });
    }

    const scores = optimisticCaptions.map((c) => netVotes(c));
    const topScore = scores.reduce<number | null>((best, score) => best === null || score > best ? score : best, null);
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
            if (scores[i] > scores[bestIdx]) return i;
            if (scores[i] === scores[bestIdx] && c.created_at > best.created_at) return i;
            if (scores[i] === scores[bestIdx] && c.created_at === best.created_at && c.id > best.id) return i;
            return bestIdx;
        }, 0);
    const otherCaptions = optimisticCaptions.filter((_, i) => i !== featuredIndex);

    function renderCaption(c: Caption) {
        return (
            <li key={`${imageId}-${c.id}`} className="flex flex-col gap-3 border-t-2 border-dashed border-[#dbc5a5] pt-4 first:border-t-0 first:pt-0">
                <p className="text-base font-bold leading-relaxed">
                    {c.caption}
                </p>
                <div className="flex items-center justify-between gap-3">
                    <VoteControls
                        caption={c}
                        currentUserId={currentUserId}
                        pending={isVoting}
                        onVote={handleVote}
                    />
                    <div className="flex items-center gap-2">
                        {hasUniqueTop && netVotes(c) === topScore && (
                            <span className="sahur-tag">Crowd pick</span>
                        )}
                        {c.created_by === currentUserId && (
                            <button
                                type="button"
                                onClick={() => handleDeleteCaption(c.id)}
                                disabled={isDeleting || deletingCaptionId === c.id}
                                className="sahur-button-ghost sahur-caption-delete"
                            >
                                {deletingCaptionId === c.id ? 'Deleting…' : 'Delete'}
                            </button>
                        )}
                    </div>
                </div>
            </li>
        );
    }

    return (
        <article className="sahur-post group flex flex-col">
            <PostPhoto src={imageUrl} priority={priority} />
            {authorName && <p className="px-3 pt-2 text-xs font-bold text-[#71523c]">Posted by {authorName}</p>}

            <div className="flex flex-col gap-4 p-3">
                <p className="sahur-eyebrow">{isOwner ? 'Your photo. Your chaos.' : 'AI wrote it. You judge it.'}</p>
                {isOwner && isEditingContext ? (
                    <form action={handleContextSubmit} className="flex flex-col gap-2 rounded-xl bg-[#eadcc4] p-3">
                        <label className="text-sm font-bold" htmlFor={`context-${imageId}`}>Post context</label>
                        <textarea
                            id={`context-${imageId}`}
                            name="context"
                            defaultValue={currentContext}
                            maxLength={500}
                            rows={3}
                            className="sahur-input resize-y"
                            placeholder="Add NYC or Columbia context for the caption"
                        />
                        <div className="flex gap-2">
                            <button type="submit" disabled={isSavingContext} className="sahur-button-secondary">{isSavingContext ? 'Saving…' : 'Save context'}</button>
                            <button type="button" disabled={isSavingContext} onClick={() => setIsEditingContext(false)} className="sahur-button-ghost">Cancel</button>
                        </div>
                    </form>
                ) : (
                    <div className="flex items-start justify-between gap-2">
                        {currentContext ? (
                            <p className="flex-1 rounded-lg bg-[#fff1d7] px-3 py-2 text-sm leading-relaxed"><span className="font-bold">Creator context:</span> {currentContext}</p>
                        ) : isOwner ? (
                            <p className="flex-1 rounded-lg bg-[#fff1d7] px-3 py-2 text-sm text-[#71523c]">Add context to guide the NYC/Columbia caption.</p>
                        ) : null}
                        {isOwner && <button type="button" onClick={() => setIsEditingContext(true)} className="sahur-button-ghost sahur-caption-delete">{currentContext ? 'Edit context' : 'Add context'}</button>}
                    </div>
                )}
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
                    <button type="button" onClick={handleDelete} disabled={isDeleting} className="sahur-button-ghost w-full">{isDeleting ? 'Deleting…' : 'Delete post'}</button>
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
