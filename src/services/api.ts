import axios from 'axios';

const API_BASE = '/api';

export interface RatingInfo {
    currentRating: string;
    ratingDate: string;
    outlook: 'positive' | 'negative' | 'stable' | 'developing';
    outlookRevisionDate: string;
    watchlistStatus: 'Positive' | 'Negative' | 'Not on watchlist';
    watchlistEntryDate: string | null;
}

export interface Issuer {
    id: string;
    name: string;
    region: string;
    sector: string;
    industry: string;
    ratings: {
        moodys: RatingInfo;
        sp: RatingInfo;
        fitch: RatingInfo;
    };
}

export interface DashboardResponse {
    issuers: Issuer[];
    lastUpdated: string;
    count: number;
}

export interface FilterParams {
    regions?: string[];
    sectors?: string[];
    industries?: string[];
    ratings?: string[];
    outlooks?: string[];
    watchlistStatuses?: string[];
    ratingDateStart?: string;
    ratingDateEnd?: string;
    outlookRevisionDateStart?: string;
    outlookRevisionDateEnd?: string;
    watchlistEntryDateStart?: string;
    watchlistEntryDateEnd?: string;
}

export const api = {
    async fetchIssuers(filters?: FilterParams): Promise<DashboardResponse> {
        const params = new URLSearchParams();

        if (filters) {
            Object.entries(filters).forEach(([key, values]) => {
                if (values) {
                    if (Array.isArray(values) && values.length > 0) {
                        values.forEach((value: string) => params.append(key, value));
                    } else if (typeof values === 'string') {
                        params.append(key, values);
                    }
                }
            });
        }

        const response = await axios.get<DashboardResponse>(
            `${API_BASE}/issuers${params.toString() ? `?${params.toString()}` : ''}`
        );
        return response.data;
    },

    async fetchOutlookChangesToday(): Promise<DashboardResponse> {
        const response = await axios.get<DashboardResponse>(`${API_BASE}/issuers/outlook-changes-today`);
        return response.data;
    },

    async fetchWatchlistChangesToday(): Promise<DashboardResponse> {
        const response = await axios.get<DashboardResponse>(`${API_BASE}/issuers/watchlist-changes-today`);
        return response.data;
    },

    async fetchRatingChangesToday(): Promise<DashboardResponse> {
        const response = await axios.get<DashboardResponse>(`${API_BASE}/issuers/rating-changes-today`);
        return response.data;
    },
};
