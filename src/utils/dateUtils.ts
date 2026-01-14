export function formatDate(date: string | null): string {
    if (!date) return 'N/A';
    try {
        const d = new Date(date);
        const month = d.toLocaleString('default', { month: 'short' });
        const day = d.getDate();
        const year = d.getFullYear();
        return `${month} ${day}, ${year}`;
    } catch {
        return 'Invalid date';
    }
}

export function formatOutlook(outlook: string): string {
    return outlook.charAt(0).toUpperCase() + outlook.slice(1);
}
