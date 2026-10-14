'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';

const demoPhotos = [
    {
        src: '/demo-photos/photo-1.png',
        captions: [
            'Me pretending I absolutely understood the instructions.',
            'When someone says “be normal” and the face forgets how.',
            'That look when the front camera opens unexpectedly.',
        ],
    },
    {
        src: '/demo-photos/photo-2.gif',
        captions: [
            'Dressed for the occasion. Still waiting for the occasion.',
            'When the party invite says “black tie” but the host is a cat.',
            'The bow tie is doing all the networking tonight.',
        ],
    },
    {
        src: '/demo-photos/photo-3.jpg',
        captions: [
            'Me explaining why the answer is definitely 67.',
            'When the math is wrong but the confidence is doing numbers.',
            'The presentation had one slide and somehow it was this one.',
        ],
    },
    {
        src: '/demo-photos/photo-4.webp',
        captions: [
            'When you wake up from a nap and the meeting already started.',
            'The face of a pickle who has seen the group project chat.',
            'Me trying to look productive while my brain is buffering.',
        ],
    },
    {
        src: '/demo-photos/photo-5.webp',
        captions: [
            'When the joke is so good you leave your body for a minute.',
            'The professor said “one more example” and this was the result.',
            'Trying not to laugh in a quiet room: a short film.',
        ],
    },
    {
        src: '/demo-photos/photo-6.png',
        captions: [
            'When the snack is shaped like a person and has a better stance than you.',
            'The campus mascot after being asked to cover one more shift.',
            'Arrived with a bat, left with absolutely no answers.',
        ],
    },
];

export function DemoExperience() {
    const [isOpen, setIsOpen] = useState(false);
    const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
    const [generatedCaptions, setGeneratedCaptions] = useState<(string | null)[]>(() => demoPhotos.map(() => null));
    const [scores, setScores] = useState(() => demoPhotos.map(() => 0));
    const [lastCaptionIndexes, setLastCaptionIndexes] = useState<(number | null)[]>(() => demoPhotos.map(() => null));
    const [votes, setVotes] = useState<(number | null)[]>(() => demoPhotos.map(() => null));

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const demoSlide = Number(params.get('demoSlide'));
        const frame = window.requestAnimationFrame(() => {
            if (Number.isInteger(demoSlide) && demoSlide >= 1 && demoSlide <= demoPhotos.length) {
                setCurrentPhotoIndex(demoSlide - 1);
            }
            if (params.get('demo') === '1') {
                setIsOpen(true);
            }
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen]);

    function generateCaption(index: number) {
        const photo = demoPhotos[index];
        const previousIndex = lastCaptionIndexes[index];
        let captionIndex = Math.floor(Math.random() * photo.captions.length);
        if (photo.captions.length > 1 && captionIndex === previousIndex) {
            captionIndex = (captionIndex + 1) % photo.captions.length;
        }
        const caption = photo.captions[captionIndex];
        setGeneratedCaptions((current) => current.map((value, itemIndex) => itemIndex === index ? caption : value));
        setLastCaptionIndexes((current) => current.map((value, itemIndex) => itemIndex === index ? captionIndex : value));
    }

    function changeScore(index: number, amount: number) {
        const previousVote = votes[index];
        const nextVote = previousVote === amount ? null : amount;
        const scoreChange = previousVote === null
            ? amount
            : previousVote === amount
                ? -amount
                : amount * 2;
        setScores((current) => current.map((score, itemIndex) => itemIndex === index ? score + scoreChange : score));
        setVotes((current) => current.map((vote, itemIndex) => itemIndex === index ? nextVote : vote));
    }

    function changePhoto(direction: -1 | 1) {
        setCurrentPhotoIndex((current) => (current + direction + demoPhotos.length) % demoPhotos.length);
    }

    return (
        <>
            <button type="button" onClick={() => setIsOpen(true)} className="demo-launcher sahur-button-secondary">
                Try the demo →
            </button>
            {isOpen && (
                <div className="demo-overlay fixed inset-0 z-50 overflow-y-auto bg-[#d8c19e] p-3 text-[#302017] sm:p-8" role="dialog" aria-modal="true" aria-label="Caption demo">
                    <div className="demo-mat mx-auto min-h-full max-w-6xl rounded-[1.8rem] border-[6px] border-[#302017] bg-[#bda487] p-2 shadow-[8px_9px_0_#493024] sm:p-4">
                        <div className="rounded-[1.35rem] border-2 border-[#493024] bg-[#fff9ec] p-4 sm:p-7">
                            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <p className="sahur-eyebrow">The caption lodge demo</p>
                                    <h2 className="mt-1 text-2xl font-black sm:text-4xl">Six photos. Six chances to make it weird.</h2>
                                    <p className="mt-2 text-sm text-[#71523c]">Generate a punchline for any photo, then give it your honest vote.</p>
                                </div>
                                <button type="button" onClick={() => setIsOpen(false)} className="sahur-button-ghost sahur-caption-delete">Close demo</button>
                            </div>
                            <div className="demo-slideshow">
                                <div className="demo-progress" aria-label={`Demo progress: photo ${currentPhotoIndex + 1} of ${demoPhotos.length}`}>
                                    <div className="demo-progress-track">
                                        {demoPhotos.map((photo, index) => (
                                            <span
                                                key={photo.src}
                                                className={`demo-progress-segment ${index <= currentPhotoIndex ? 'is-complete' : ''} ${index === currentPhotoIndex ? 'is-current' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    className="demo-progress-dot"
                                                    onClick={() => setCurrentPhotoIndex(index)}
                                                    aria-label={`Go to photo ${index + 1}`}
                                                    aria-current={index === currentPhotoIndex ? 'step' : undefined}
                                                >
                                                    <span className="demo-progress-number" aria-hidden="true">{index + 1}</span>
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="mb-4 flex justify-center">
                                    <span className="sahur-tag">Photo {currentPhotoIndex + 1} of {demoPhotos.length}</span>
                                </div>
                                <div className="demo-slide-stage">
                                    {currentPhotoIndex === 0 ? (
                                        <span className="demo-slide-control-spacer" aria-hidden="true" />
                                    ) : (
                                        <button type="button" onClick={() => changePhoto(-1)} className="sahur-button-secondary demo-slide-control" aria-label="Previous demo photo">←</button>
                                    )}
                                    <article key={demoPhotos[currentPhotoIndex].src} className="demo-card max-w-2xl rounded-xl border-2 border-[#493024] bg-[#eadcc4] p-3 shadow-[3px_3px_0_#bda487]" style={{ '--demo-delay': '0ms' } as CSSProperties}>
                                    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-[#493024]">
                                        <img src={demoPhotos[currentPhotoIndex].src} alt="A playful demo scene" className="max-h-full max-w-full object-contain" />
                                    </div>
                                    <div className="p-2 sm:p-4">
                                        {generatedCaptions[currentPhotoIndex] ? (
                                            <p className="demo-caption min-h-16 text-base font-black leading-relaxed sm:text-xl">{generatedCaptions[currentPhotoIndex]}</p>
                                        ) : (
                                            <p className="min-h-16 text-sm font-semibold text-[#71523c] sm:text-base">Your caption is waiting in the wings.</p>
                                        )}
                                        {!generatedCaptions[currentPhotoIndex] && (
                                            <button type="button" onClick={() => generateCaption(currentPhotoIndex)} className="sahur-button demo-generate w-full">
                                                Generate caption
                                            </button>
                                        )}
                                        {generatedCaptions[currentPhotoIndex] && (
                                            <div className="mt-2 flex items-center justify-center gap-2">
                                                <button type="button" className="sahur-vote" onClick={() => changeScore(currentPhotoIndex, 1)} aria-label="Upvote demo caption" aria-pressed={votes[currentPhotoIndex] === 1}>▲</button>
                                                <span className="min-w-6 text-center font-black">{scores[currentPhotoIndex]}</span>
                                                <button type="button" className="sahur-vote sahur-vote-down" onClick={() => changeScore(currentPhotoIndex, -1)} aria-label="Downvote demo caption" aria-pressed={votes[currentPhotoIndex] === -1}>▼</button>
                                            </div>
                                        )}
                                    </div>
                                    </article>
                                    {currentPhotoIndex === demoPhotos.length - 1 ? (
                                        <Link href="/intrigued" className="sahur-button-secondary demo-slide-control" aria-label="Continue to the question">→</Link>
                                    ) : (
                                        <button type="button" onClick={() => changePhoto(1)} className="sahur-button-secondary demo-slide-control" aria-label="Next demo photo">→</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
