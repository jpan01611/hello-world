import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// This route is the OAuth/PKCE redirect target configured in Supabase
// (redirect URI: /auth/callback). It exchanges the `code` query param for a
// session and then sends the user back into the app.
export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const metadata = user.user_metadata ?? {};
                const fullName = String(metadata.full_name ?? metadata.name ?? '').trim();
                const nameParts = fullName.split(/\s+/).filter(Boolean);
                const googleFirstName = String(metadata.given_name ?? nameParts[0] ?? '').trim();
                const googleLastName = String(metadata.family_name ?? nameParts.slice(1).join(' ')).trim();
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile && (!profile.first_name || !profile.last_name) && googleFirstName && googleLastName) {
                    await supabase
                        .from('profiles')
                        .update({
                            first_name: profile.first_name || googleFirstName,
                            last_name: profile.last_name || googleLastName,
                        })
                        .eq('id', user.id);
                }
            }
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    // Something went wrong (missing/invalid code) - send the user back to login.
    return NextResponse.redirect(`${origin}/login?error=auth`);
}
