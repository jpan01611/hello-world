'use server';

import { createClient } from '@/lib/supabase/server';

export async function deleteAccountAction() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'You must be signed in to delete your account.' };
    }

    const { error } = await supabase.rpc('delete_current_account');
    if (error) {
        if (error.code === 'PGRST202') {
            return {
                error: 'Account deletion is not enabled yet. Apply supabase/migrations/0014_delete_account.sql to the connected Supabase project, then try again.',
            };
        }
        return { error: error.message };
    }

    return { success: true };
}
