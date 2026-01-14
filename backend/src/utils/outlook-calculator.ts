import type { Outlook, RatingInfo } from '../models/data-models.js';

/**
 * Calculate the color status for an outlook cell based on the agency's outlook horizon
 */
export type OutlookColorStatus = 'green' | 'red' | 'amber' | 'none';

interface OutlookHorizon {
    minMonths: number;
    maxMonths: number;
}

const OUTLOOK_HORIZONS: Record<'moodys' | 'sp' | 'fitch', OutlookHorizon> = {
    moodys: { minMonths: 12, maxMonths: 18 },
    sp: { minMonths: 6, maxMonths: 24 },
    fitch: { minMonths: 12, maxMonths: 24 }, // 1-2 years
};

/**
 * Calculate outlook cell color based on:
 * - Green if outlook is positive
 * - Red if outlook is negative OR date is within/after outlook horizon
 * - Amber if outlook date is before the stated horizon
 */
export function calculateOutlookColor(
    rating: RatingInfo,
    agency: 'moodys' | 'sp' | 'fitch'
): OutlookColorStatus {
    const { outlook, outlookRevisionDate } = rating;

    // Green for positive outlook
    if (outlook === 'positive') {
        return 'green';
    }

    // Red for negative outlook
    if (outlook === 'negative') {
        return 'red';
    }

    // For stable or developing, check if we're within the outlook horizon
    const horizon = OUTLOOK_HORIZONS[agency];
    const monthsSinceRevision = getMonthsDifference(outlookRevisionDate, new Date());

    // If we're within or past the minimum horizon, it's red (higher risk of change)
    if (monthsSinceRevision >= horizon.minMonths) {
        return 'red';
    }

    // If we're before the horizon but the outlook is stable/developing, it's amber
    if (outlook === 'stable' || outlook === 'developing') {
        return 'amber';
    }

    return 'none';
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
    const start = new Date(startDate);
    const end = new Date(endDate);

    const yearsDiff = end.getFullYear() - start.getFullYear();
    const monthsDiff = end.getMonth() - start.getMonth();

    return yearsDiff * 12 + monthsDiff;
}

/**
 * Format outlook for display
 */
export function formatOutlook(outlook: Outlook): string {
    return outlook.charAt(0).toUpperCase() + outlook.slice(1);
}
