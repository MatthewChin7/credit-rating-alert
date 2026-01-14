import type { RatingInfo } from '../services/api';

export type OutlookColorStatus = 'green' | 'red' | 'amber' | 'none';

interface OutlookHorizon {
    minMonths: number; maxMonths: number;
}

const OUTLOOK_HORIZONS: Record<'moodys' | 'sp' | 'fitch', OutlookHorizon> = {
    moodys: { minMonths: 12, maxMonths: 18 },
    sp: { minMonths: 6, maxMonths: 24 },
    fitch: { minMonths: 12, maxMonths: 24 },
};

/**
 * Calculate outlook cell color (simple: positive=green, negative=red)
 */
export function calculateOutlookColor(outlook: string): OutlookColorStatus {
    if (outlook === 'positive') return 'green';
    if (outlook === 'negative') return 'red';
    return 'none';
}

/**
 * Calculate outlook revision date cell color based on outlook horizon
 * - Amber if before the minimum horizon (smaller risk)
 * - Red if within or after the minimum horizon (higher risk of change)
 */
export function calculateOutlookRevisionDateColor(
    outlookRevisionDate: string,
    agency: 'moodys' | 'sp' | 'fitch'
): OutlookColorStatus {
    const horizon = OUTLOOK_HORIZONS[agency];
    const monthsSinceRevision = getMonthsDifference(new Date(outlookRevisionDate), new Date());

    // If we're within or past the minimum horizon, it's red (higher risk of change)
    if (monthsSinceRevision >= horizon.minMonths) {
        return 'red';
    }

    // If we're before the horizon, it's amber (lower but non-zero risk)
    return 'amber';
}

/**
 * Calculate watchlist cell color
 */
export function calculateWatchlistColor(status: string): OutlookColorStatus {
    if (status === 'Positive') return 'green';
    if (status === 'Negative') return 'red';
    return 'none';
}

/**
 * Calculate months between two dates
 */
function getMonthsDifference(startDate: Date, endDate: Date): number {
    const yearsDiff = endDate.getFullYear() - startDate.getFullYear();
    const monthsDiff = endDate.getMonth() - startDate.getMonth();
    return yearsDiff * 12 + monthsDiff;
}

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
