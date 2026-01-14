import type { Issuer, FilterCriteria } from '../models/data-models.js';

export class FilteringService {
    /**
     * Filter issuers based on criteria
     */
    filterIssuers(issuers: Issuer[], criteria: FilterCriteria): Issuer[] {
        return issuers.filter(issuer => {
            // Region filter
            if (criteria.regions && criteria.regions.length > 0) {
                if (!criteria.regions.includes(issuer.region)) return false;
            }

            // Sector filter
            if (criteria.sectors && criteria.sectors.length > 0) {
                if (!criteria.sectors.includes(issuer.sector)) return false;
            }

            // Industry filter
            if (criteria.industries && criteria.industries.length > 0) {
                if (!criteria.industries.includes(issuer.industry)) return false;
            }

            // Ratings filter - check if any agency has the specified rating
            if (criteria.ratings && criteria.ratings.length > 0) {
                const hasMatchingRating = criteria.ratings.some(rating =>
                    issuer.ratings.moodys.currentRating === rating ||
                    issuer.ratings.sp.currentRating === rating ||
                    issuer.ratings.fitch.currentRating === rating
                );
                if (!hasMatchingRating) return false;
            }

            // Outlooks filter
            if (criteria.outlooks && criteria.outlooks.length > 0) {
                const hasMatchingOutlook = criteria.outlooks.some(outlook =>
                    issuer.ratings.moodys.outlook === outlook ||
                    issuer.ratings.sp.outlook === outlook ||
                    issuer.ratings.fitch.outlook === outlook
                );
                if (!hasMatchingOutlook) return false;
            }

            // Watchlist status filter
            if (criteria.watchlistStatuses && criteria.watchlistStatuses.length > 0) {
                const hasMatchingWatchlist = criteria.watchlistStatuses.some(status =>
                    issuer.ratings.moodys.watchlistStatus === status ||
                    issuer.ratings.sp.watchlistStatus === status ||
                    issuer.ratings.fitch.watchlistStatus === status
                );
                if (!hasMatchingWatchlist) return false;
            }

            // Date range filters
            if (criteria.ratingDateStart || criteria.ratingDateEnd) {
                const dates = [
                    issuer.ratings.moodys.ratingDate,
                    issuer.ratings.sp.ratingDate,
                    issuer.ratings.fitch.ratingDate
                ];
                if (!this.hasDateInRange(dates, criteria.ratingDateStart, criteria.ratingDateEnd)) {
                    return false;
                }
            }

            if (criteria.outlookRevisionStart || criteria.outlookRevisionEnd) {
                const dates = [
                    issuer.ratings.moodys.outlookRevisionDate,
                    issuer.ratings.sp.outlookRevisionDate,
                    issuer.ratings.fitch.outlookRevisionDate
                ];
                if (!this.hasDateInRange(dates, criteria.outlookRevisionStart, criteria.outlookRevisionEnd)) {
                    return false;
                }
            }

            if (criteria.watchlistEntryStart || criteria.watchlistEntryEnd) {
                const dates = [
                    issuer.ratings.moodys.watchlistEntryDate,
                    issuer.ratings.sp.watchlistEntryDate,
                    issuer.ratings.fitch.watchlistEntryDate
                ].filter((d): d is Date => d !== null);

                if (dates.length === 0) return false;
                if (!this.hasDateInRange(dates, criteria.watchlistEntryStart, criteria.watchlistEntryEnd)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Get issuers with outlook changes today
     */
    getOutlookChangesToday(issuers: Issuer[]): Issuer[] {
        const today = this.getToday();
        return issuers.filter(issuer =>
            this.isSameDay(issuer.ratings.moodys.outlookRevisionDate, today) ||
            this.isSameDay(issuer.ratings.sp.outlookRevisionDate, today) ||
            this.isSameDay(issuer.ratings.fitch.outlookRevisionDate, today)
        );
    }

    /**
     * Get issuers with watchlist changes today
     */
    getWatchlistChangesToday(issuers: Issuer[]): Issuer[] {
        const today = this.getToday();
        return issuers.filter(issuer => {
            const moodysChanged = issuer.ratings.moodys.watchlistEntryDate &&
                this.isSameDay(issuer.ratings.moodys.watchlistEntryDate, today);
            const spChanged = issuer.ratings.sp.watchlistEntryDate &&
                this.isSameDay(issuer.ratings.sp.watchlistEntryDate, today);
            const fitchChanged = issuer.ratings.fitch.watchlistEntryDate &&
                this.isSameDay(issuer.ratings.fitch.watchlistEntryDate, today);

            return moodysChanged || spChanged || fitchChanged;
        });
    }

    /**
     * Get issuers with rating changes today
     */
    getRatingChangesToday(issuers: Issuer[]): Issuer[] {
        const today = this.getToday();
        return issuers.filter(issuer =>
            this.isSameDay(issuer.ratings.moodys.ratingDate, today) ||
            this.isSameDay(issuer.ratings.sp.ratingDate, today) ||
            this.isSameDay(issuer.ratings.fitch.ratingDate, today)
        );
    }

    private hasDateInRange(dates: Date[], start?: Date, end?: Date): boolean {
        if (!start && !end) return true;

        return dates.some(date => {
            if (start && date < start) return false;
            if (end && date > end) return false;
            return true;
        });
    }

    private isSameDay(date1: Date, date2: Date): boolean {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    private getToday(): Date {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }
}

export const filteringService = new FilteringService();
