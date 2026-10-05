import { redirect } from 'next/navigation';
import Image from "next/image";
import Link from "next/link";
import { createClient } from '@/lib/supabase/server';

export default async function Home() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single();

  if (!profile?.first_name || !profile?.last_name) {
    redirect('/complete-profile');
  }
  return (
      <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">

          {/* Next.js logo */}
          <Image
              className="dark:invert h-5 w-25"
              src="/next.svg"
              alt="Next.js logo"
              width={100}
              height={20}
              priority
          />

          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Hello World
              <br />
              Checkpoint at hw3
            </h1>

            <p className="text-black dark:text-zinc-50">
              Welcome back, {profile.first_name}!
            </p>

            <div className="flex gap-4">
              <Link href="/dashboard" className="text-blue-600 underline">
                Dashboard
              </Link>
              <Link href="/profile" className="text-blue-600 underline">
                Profile
              </Link>
              <Link href="/gallery" className="text-blue-600 underline">
                Gallery
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">

            {/* Deploy button */}
            <a
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-39.5"
                href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                target="_blank"
                rel="noopener noreferrer"
            >
              <Image
                  className="dark:invert h-3.5 w-4"
                  src="/vercel.svg"
                  alt="Vercel logomark"
                  width={16}
                  height={14}
              />
              Deploy Now
            </a>

            {/* Docs button */}
            <a
                className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/8 px-5 transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-39.5"
                href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
                target="_blank"
                rel="noopener noreferrer"
            >
              Documentation
            </a>
          </div>
        </main>
      </div>
  );

}
