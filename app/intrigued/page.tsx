import Link from 'next/link';

export default function IntriguedPage() {
    return (
        <div className="intrigued-page min-h-full overflow-y-auto bg-[#d8c19e] p-3 text-[#302017] sm:p-8">
            <div className="mx-auto min-h-full max-w-6xl rounded-[1.8rem] border-[6px] border-[#302017] bg-[#bda487] p-2 shadow-[8px_9px_0_#493024] sm:p-4">
                <div className="rounded-[1.35rem] border-2 border-[#493024] bg-[#fff9ec] p-4 sm:p-7">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="sahur-eyebrow">The caption lodge demo</p>
                            <h1 className="mt-1 text-2xl font-black sm:text-4xl">Six photos. Six chances to make it weird.</h1>
                            <p className="mt-2 text-sm text-[#71523c]">Generate a punchline for any photo, then give it your honest vote.</p>
                        </div>
                        <Link href="/" className="sahur-button-ghost sahur-caption-delete">Close demo</Link>
                    </div>
                    <div className="demo-slideshow">
                        <div className="demo-progress" aria-label="Demo progress: complete">
                            <div className="demo-progress-track">
                                {Array.from({ length: 6 }, (_, index) => (
                                    <span key={index} className="demo-progress-segment is-complete">
                                        <span className="demo-progress-dot" aria-hidden="true">
                                            <span className="demo-progress-number" aria-hidden="true">{index + 1}</span>
                                        </span>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="intrigued-layout demo-slide-stage">
                            <Link href="/?demo=1&demoSlide=6" className="sahur-button-secondary demo-slide-control" aria-label="Back to photo 6">←</Link>
                            <section className="demo-card mx-auto w-full max-w-2xl rounded-xl border-2 border-[#493024] bg-[#eadcc4] p-3 text-center shadow-[3px_3px_0_#bda487]">
                                <p className="intrigued-fly-in sahur-eyebrow">You made it this far</p>
                                <h2 className="intrigued-fly-in mt-2 text-5xl font-black tracking-tight">Intrigued?</h2>
                                <p className="intrigued-fly-in mt-4 leading-relaxed">Bring your own photo to the lodge and let the punchline machine begin.</p>
                                <div className="intrigued-fly-in mt-7 flex flex-wrap justify-center gap-3">
                                    <Link href="/login" className="sahur-button">Sign up</Link>
                                    <Link href="/" className="sahur-button-secondary">Back to homepage</Link>
                                </div>
                            </section>
                            <span className="demo-slide-control-spacer" aria-hidden="true" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
