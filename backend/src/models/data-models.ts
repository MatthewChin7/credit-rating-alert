export type Region =
    | 'North America'
    | 'Latin America'
    | 'Western Europe'
    | 'Eastern Europe'
    | 'Asia-Pacific'
    | 'Middle East'
    | 'Africa'
    | 'SSA';  // Sub-Saharan Africa

export type Sector =
    | 'sovereign'
    | 'quasi-sovereign'
    | 'financial'
    | 'energy'
    | 'utilities'
    | 'industrials'
    | 'consumer'
    | 'healthcare'
    | 'technology'
    | 'telecommunications'
    | 'materials'
    | 'real-estate';

// Industry is now dynamic string instead of enum (100+ GICS industries)
export type Industry = string;

export type Outlook = 'positive' | 'negative' | 'stable' | 'developing';
export type WatchlistStatus = 'Positive' | 'Negative' | 'Not on watchlist';
export type RatingAgency = 'moodys' | 'sp' | 'fitch';

export interface RatingInfo {
    currentRating: string;
    ratingDate: Date;
    outlook: Outlook;
    outlookRevisionDate: Date;
    watchlistStatus: WatchlistStatus;
    watchlistEntryDate: Date | null;
    // Bloomberg ticker for deep linking
    bloombergTicker?: string;
}

export interface Issuer {
    id: string;
    isin: string;  // ISIN identifier from Bloomberg
    name: string;
    region: Region;
    sector: Sector;
    industry: Industry;
    ratings: {
        moodys: RatingInfo;
        sp: RatingInfo;
        fitch: RatingInfo;
    };
}

export interface FilterCriteria {
    regions?: Region[];
    sectors?: Sector[];
    industries?: Industry[];
    ratings?: string[];
    outlooks?: Outlook[];
    watchlistStatuses?: WatchlistStatus[];
    ratingDateStart?: Date;
    ratingDateEnd?: Date;
    outlookRevisionStart?: Date;
    outlookRevisionEnd?: Date;
    watchlistEntryStart?: Date;
    watchlistEntryEnd?: Date;
}

export interface DashboardData {
    issuers: Issuer[];
    lastUpdated: Date;
}
