import { supabase } from '@/lib/supabaseClient';

type Item = {
    id: number;
    name: string;
};


export default async function ItemsPage() {
    const { data: items, error } = await supabase
        .from('items')
        .select('*');

    if (error) {
        return <div>Error loading items</div>;
    }

    return (
        <div style={{ padding: 20 }}>
            <h1>Items List</h1>
            <ul>
                {items.map((item:Item) => (
                    <li key={item.id}>{item.name}</li>
                ))}
            </ul>
        </div>
    );
}
