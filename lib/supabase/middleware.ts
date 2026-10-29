import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Keeps the Supabase auth session cookies fresh on every request. This must
// run in middleware because Server Components cannot write cookies.
export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Avoid writing unrelated logic between createServerClient and
    // supabase.auth.getUser(). A stale refresh token can otherwise be retried
    // on every request and prevent the user from reaching the login page.
    try {
        await supabase.auth.getUser();
    } catch (error) {
        const authError = error as { code?: unknown; status?: unknown };
        const isInvalidRefreshToken =
            authError.code === 'refresh_token_not_found' ||
            (authError.status === 400 && authError.code === 'invalid_refresh_token');

        if (!isInvalidRefreshToken) {
            throw error;
        }

        for (const cookie of request.cookies.getAll()) {
            if (cookie.name.startsWith('sb-')) {
                request.cookies.delete(cookie.name);
                supabaseResponse.cookies.delete(cookie.name);
            }
        }
    }

    return supabaseResponse;
}
