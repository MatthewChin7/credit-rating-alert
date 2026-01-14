import axios from 'axios';
import type { Issuer, RatingInfo, Region, Sector } from '../models/data-models.js';

/**
 * Bloomberg API Service
 * 
 * Connects to Python Flask service which interfaces with Bloomberg Terminal.
 * The Python service handles the Bloomberg API connection and data fetching.
 */

export class BloombergService {
    private pythonServiceUrl: string;
    private isConnected: boolean = false;

    constructor() {
        this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    }

    async connect(): Promise<void> {
        try {
            // Try to connect to Python Bloomberg service
            const response = await axios.post(`${this.pythonServiceUrl}/api/connect`, {}, {
                timeout: 10000
            });

            if (response.data.success) {
                this.isConnected = true;
                console.log('📊 Bloomberg Terminal connected via Python service');
            } else {
                throw new Error(response.data.error || 'Connection failed');
            }
        } catch (error) {
            console.warn('⚠️  Bloomberg Terminal not available, running in demo mode');
            console.warn('   Make sure Python service is running: python backend/bloomberg-python-service/bloomberg_api.py');
            this.isConnected = false;
            // Don't throw - allow demo mode to continue
        }
    }

    async fetchIssuers(): Promise<Issuer[]> {
        try {
            const response = await axios.get(`${this.pythonServiceUrl}/api/bonds`, {
                timeout: 30000,  // 30 second timeout for large dataset
                params: {
                    limit: 3000
                }
            });

            // Check for error response from Python service
            if (response.data.mode === 'error') {
                throw new Error(response.data.error || 'Bloomberg data unavailable');
            }

            if (response.data.bonds && Array.isArray(response.data.bonds)) {
                const issuers = response.data.bonds.map((bond: any, index: number) =>
                    this.transformBondData(bond, index)
                );

                console.log(`📊 Fetched ${issuers.length} issuers from Bloomberg (live mode)`);

                return issuers;
            } else {
                throw new Error('Invalid response format from Python service');
            }
        } catch (error: any) {
            // Extract error message from axios error or use the error directly
            const errorMessage = error.response?.data?.error || error.message || 'Unknown error';
            console.error('❌ Bloomberg API Error:', errorMessage);

            // Re-throw so the server can return proper error to frontend
            throw new Error(`Bloomberg Error: ${errorMessage}`);
        }
    }

    private transformBondData(bond: any, index: number): Issuer {
        /**
         * Transform Python service bond data to TypeScript Issuer model
         */

        // Map country code to region
        const region = this.mapCountryToRegion(bond.country);

        // Map Bloomberg sector to our sector taxonomy
        const sector = this.mapBloombergSector(bond.sector);

        return {
            id: String(index + 1),
            isin: bond.isin || '',
            name: bond.issuer || 'Unknown Issuer',
            region,
            sector,
            industry: bond.industry || 'Other',
            ratings: {
                moodys: this.createRatingInfo(
                    bond.moodys_rating,
                    bond.moodys_rating_date,
                    bond.moodys_outlook,
                    bond.moodys_outlook_date,
                    bond.moodys_watch,
                    null
                ),
                sp: this.createRatingInfo(
                    bond.sp_rating,
                    bond.sp_rating_date,
                    bond.sp_outlook,
                    bond.sp_outlook_date,
                    bond.sp_watch,
                    null
                ),
                fitch: this.createRatingInfo(
                    bond.fitch_rating,
                    bond.fitch_rating_date,
                    bond.fitch_outlook,
                    bond.fitch_outlook_date,
                    bond.fitch_watch,
                    null
                )
            }
        };
    }

    private mapCountryToRegion(countryCode: string): Region {
        /**
         * Map ISO country codes to regions
         */
        const regionMap: { [key: string]: Region } = {
            // North America
            'US': 'North America',
            'CA': 'North America',
            'MX': 'North America',

            // Latin America
            'BR': 'Latin America',
            'AR': 'Latin America',
            'CL': 'Latin America',
            'CO': 'Latin America',
            'PE': 'Latin America',

            // Western Europe
            'GB': 'Western Europe',
            'DE': 'Western Europe',
            'FR': 'Western Europe',
            'IT': 'Western Europe',
            'ES': 'Western Europe',
            'NL': 'Western Europe',
            'BE': 'Western Europe',
            'CH': 'Western Europe',
            'AT': 'Western Europe',
            'SE': 'Western Europe',
            'NO': 'Western Europe',
            'DK': 'Western Europe',
            'FI': 'Western Europe',
            'IE': 'Western Europe',
            'PT': 'Western Europe',

            // Eastern Europe
            'PL': 'Eastern Europe',
            'CZ': 'Eastern Europe',
            'HU': 'Eastern Europe',
            'RO': 'Eastern Europe',
            'BG': 'Eastern Europe',
            'SK': 'Eastern Europe',
            'SI': 'Eastern Europe',
            'HR': 'Eastern Europe',
            'RS': 'Eastern Europe',
            'RU': 'Eastern Europe',
            'UA': 'Eastern Europe',

            // Asia-Pacific
            'CN': 'Asia-Pacific',
            'JP': 'Asia-Pacific',
            'KR': 'Asia-Pacific',
            'IN': 'Asia-Pacific',
            'AU': 'Asia-Pacific',
            'NZ': 'Asia-Pacific',
            'SG': 'Asia-Pacific',
            'HK': 'Asia-Pacific',
            'TW': 'Asia-Pacific',
            'TH': 'Asia-Pacific',
            'MY': 'Asia-Pacific',
            'ID': 'Asia-Pacific',
            'PH': 'Asia-Pacific',
            'VN': 'Asia-Pacific',

            // Middle East
            'SA': 'Middle East',
            'AE': 'Middle East',
            'QA': 'Middle East',
            'KW': 'Middle East',
            'BH': 'Middle East',
            'OM': 'Middle East',
            'TR': 'Middle East',
            'IL': 'Middle East',
            'EG': 'Middle East',
            'JO': 'Middle East',
            'LB': 'Middle East',

            // Sub-Saharan Africa
            'ZA': 'SSA',
            'NG': 'SSA',
            'KE': 'SSA',
            'GH': 'SSA',
            'ET': 'SSA',
            'UG': 'SSA',
            'TZ': 'SSA',

            // Africa (North Africa)
            'MA': 'Africa',
            'TN': 'Africa',
            'DZ': 'Africa'
        };

        return regionMap[countryCode] || 'Africa';
    }

    private mapBloombergSector(sectorName: string): Sector {
        /**
         * Map Bloomberg GICS sector names to our sector types
         */
        if (!sectorName) return 'sovereign';

        const sectorLower = sectorName.toLowerCase();

        if (sectorLower.includes('financ') || sectorLower.includes('bank')) return 'financial';
        if (sectorLower.includes('energy') || sectorLower.includes('oil')) return 'energy';
        if (sectorLower.includes('utilit')) return 'utilities';
        if (sectorLower.includes('industr')) return 'industrials';
        if (sectorLower.includes('consumer')) return 'consumer';
        if (sectorLower.includes('health')) return 'healthcare';
        if (sectorLower.includes('tech') || sectorLower.includes('information')) return 'technology';
        if (sectorLower.includes('telecom') || sectorLower.includes('communication')) return 'telecommunications';
        if (sectorLower.includes('material')) return 'materials';
        if (sectorLower.includes('real estate') || sectorLower.includes('property')) return 'real-estate';
        if (sectorLower.includes('sovereign') || sectorLower.includes('government')) return 'sovereign';
        if (sectorLower.includes('quasi')) return 'quasi-sovereign';

        return 'sovereign';
    }

    private createRatingInfo(
        rating: string,
        ratingDate: string,
        outlook: string,
        outlookDate: string,
        watchStatus: string,
        watchDate: string | null
    ): RatingInfo {
        return {
            currentRating: rating || 'NR',
            ratingDate: ratingDate ? new Date(ratingDate) : new Date(),
            outlook: this.normalizeOutlook(outlook),
            outlookRevisionDate: outlookDate ? new Date(outlookDate) : new Date(),
            watchlistStatus: this.normalizeWatchlistStatus(watchStatus),
            watchlistEntryDate: watchDate ? new Date(watchDate) : null
        };
    }

    private normalizeOutlook(outlook: string): 'positive' | 'negative' | 'stable' | 'developing' {
        if (!outlook) return 'stable';
        const lower = outlook.toLowerCase();
        if (lower.includes('pos')) return 'positive';
        if (lower.includes('neg')) return 'negative';
        if (lower.includes('dev')) return 'developing';
        return 'stable';
    }

    private normalizeWatchlistStatus(status: string): 'Positive' | 'Negative' | 'Not on watchlist' {
        if (!status) return 'Not on watchlist';
        const lower = status.toLowerCase();
        if (lower.includes('positive') || lower.includes('upgrade')) return 'Positive';
        if (lower.includes('negative') || lower.includes('downgrade')) return 'Negative';
        return 'Not on watchlist';
    }

    private getDemoData(): Issuer[] {
        /**
         * Fallback demo data when Bloomberg/Python service is unavailable
         */
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        const oneMonthAgo = new Date(today);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        const sixMonthsAgo = new Date(today);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        return [
            {
                id: '1',
                isin: 'US912828Z250',
                name: 'United States Treasury',
                region: 'North America',
                sector: 'sovereign',
                industry: 'Government',
                ratings: {
                    moodys: this.createRatingInfo('Aaa', oneYearAgo.toISOString(), 'stable', oneYearAgo.toISOString(), 'Not on watchlist', null),
                    sp: this.createRatingInfo('AA+', oneYearAgo.toISOString(), 'stable', oneYearAgo.toISOString(), 'Not on watchlist', null),
                    fitch: this.createRatingInfo('AAA', oneYearAgo.toISOString(), 'stable', oneYearAgo.toISOString(), 'Not on watchlist', null)
                }
            },
            {
                id: '2',
                isin: 'BRVALEACNOR0',
                name: 'Vale S.A.',
                region: 'Latin America',
                sector: 'materials',
                industry: 'Metals & Mining',
                ratings: {
                    moodys: this.createRatingInfo('Ba1', sixMonthsAgo.toISOString(), 'positive', today.toISOString(), 'Positive', today.toISOString()),
                    sp: this.createRatingInfo('BBB-', sixMonthsAgo.toISOString(), 'stable', lastWeek.toISOString(), 'Not on watchlist', null),
                    fitch: this.createRatingInfo('BBB-', sixMonthsAgo.toISOString(), 'stable', oneMonthAgo.toISOString(), 'Not on watchlist', null)
                }
            },
            {
                id: '3',
                isin: 'CNE1000002H1',
                name: 'Industrial and Commercial Bank of China',
                region: 'Asia-Pacific',
                sector: 'financial',
                industry: 'Banks',
                ratings: {
                    moodys: this.createRatingInfo('A1', sixMonthsAgo.toISOString(), 'negative', today.toISOString(), 'Negative', today.toISOString()),
                    sp: this.createRatingInfo('A', sixMonthsAgo.toISOString(), 'stable', oneMonthAgo.toISOString(), 'Not on watchlist', null),
                    fitch: this.createRatingInfo('A', sixMonthsAgo.toISOString(), 'stable', oneMonthAgo.toISOString(), 'Not on watchlist', null)
                }
            }
        ];
    }
}

export const bloombergService = new BloombergService();
