'use client';

import Image from 'next/image';
import { useOptimistic, useState, useTransition } from 'react';
import { generateCaptionAction, voteOnCaptionAction } from './actions';

// Only photos hosted in our own Supabase Storage bucket (allowlisted in
// next.config.ts) can go through next/image's optimizer. Arbitrary
// user-pasted URLs render `unoptimized` instead, since we can't allowlist
// every possible external host.
const SUPABASE_STORAGE_PREFIX = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`
    : null;

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
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                    mine === 1
                        ? 'bg-orange-500 text-white'
                        : 'text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10'
                }`}
            >
                ▲
            </button>
            <span className="min-w-5 text-center font-semibold text-black dark:text-zinc-50">
                {score}
            </span>
            <button
                type="button"
                onClick={() => onVote(caption.id, -1)}
                disabled={pending}
                aria-label="Downvote"
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
                    mine === -1
                        ? 'bg-blue-500 text-white'
                        : 'text-zinc-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10'
                }`}
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
export function ImageCard({ imageId, imageUrl, captions, currentUserId }: ImageCardProps) {
    const [isGenerating, startGenerateTransition] = useTransition();
    const [, startVoteTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [votingId, setVotingId] = useState<string | null>(null);
    const [showAllCaptions, setShowAllCaptions] = useState(false);

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
                await generateCaptionAction(imageId, imageUrl);
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
            return bestIdx;
        }, 0);
    const otherCaptions = optimisticCaptions.filter((_, i) => i !== featuredIndex);
    const isOptimizableImage = SUPABASE_STORAGE_PREFIX !== null && imageUrl.startsWith(SUPABASE_STORAGE_PREFIX);

    function renderCaption(c: Caption) {
        return (
            <li key={`${imageId}-${c.id}`} className="flex flex-col gap-1 border-t border-black/5 pt-2 first:border-t-0 first:pt-0 dark:border-white/10">
                <p className="text-sm font-semibold text-black dark:text-zinc-50">
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
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            Top caption
                        </span>
                    )}
                </div>
            </li>
        );
    }

    return (
        <div className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 transition-shadow hover:shadow-lg dark:bg-zinc-900 dark:ring-white/10">
            <div className="relative aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <Image
                    src={imageUrl}
                    alt="Uploaded"
                    fill
                    unoptimized={!isOptimizableImage}
                    loading="lazy"
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
            </div>

            <div className="flex flex-col gap-2 p-3">
                <button
                    type="button"
                    onClick={handleGenerateCaption}
                    disabled={isGenerating}
                    className="h-8 rounded-full border border-black/15 text-xs font-medium text-black transition-colors hover:bg-black/5 disabled:opacity-60 dark:border-white/20 dark:text-zinc-50 dark:hover:bg-white/10"
                >
                    {isGenerating
                        ? 'Generating…'
                        : optimisticCaptions.length > 0
                            ? 'Generate another caption'
                            : 'Generate Caption'}
                </button>

                {error && <p className="text-xs text-red-600">{error}</p>}

                {optimisticCaptions.length > 0 && (
                    <ul className="flex flex-col gap-2">
                        {featuredIndex !== -1 && renderCaption(optimisticCaptions[featuredIndex])}
                        {showAllCaptions && otherCaptions.map(renderCaption)}
                    </ul>
                )}

                {otherCaptions.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowAllCaptions((v) => !v)}
                        className="self-start text-xs font-medium text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                        {showAllCaptions
                            ? 'Hide other captions'
                            : `Show ${otherCaptions.length} more caption${otherCaptions.length === 1 ? '' : 's'}`}
                    </button>
                )}
            </div>
        </div>
    );
}
