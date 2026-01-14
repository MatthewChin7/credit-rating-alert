import express from 'express';
import cors from 'cors';
import { bloombergService } from './services/bloomberg-service.js';
import { filteringService } from './services/filtering-service.js';
import type { FilterCriteria } from './models/data-models.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Bloomberg service
await bloombergService.connect();

/**
 * GET /api/issuers
 * Fetch all issuers with optional filtering
 */
app.get('/api/issuers', async (req, res) => {
    try {
        const issuers = await bloombergService.fetchIssuers();

        // Parse filter criteria from query params
        const criteria: FilterCriteria = {};

        if (req.query.regions) {
            criteria.regions = Array.isArray(req.query.regions)
                ? req.query.regions as any[]
                : [req.query.regions as any];
        }

        if (req.query.sectors) {
            criteria.sectors = Array.isArray(req.query.sectors)
                ? req.query.sectors as any[]
                : [req.query.sectors as any];
        }

        if (req.query.industries) {
            criteria.industries = Array.isArray(req.query.industries)
                ? req.query.industries as any[]
                : [req.query.industries as any];
        }

        if (req.query.ratings) {
            criteria.ratings = Array.isArray(req.query.ratings)
                ? req.query.ratings as string[]
                : [req.query.ratings as string];
        }

        if (req.query.outlooks) {
            criteria.outlooks = Array.isArray(req.query.outlooks)
                ? req.query.outlooks as any[]
                : [req.query.outlooks as any];
        }

        if (req.query.watchlistStatuses) {
            criteria.watchlistStatuses = Array.isArray(req.query.watchlistStatuses)
                ? req.query.watchlistStatuses as any[]
                : [req.query.watchlistStatuses as any];
        }

        // Date range filters
        if (req.query.ratingDateStart) {
            criteria.ratingDateStart = new Date(req.query.ratingDateStart as string);
        }
        if (req.query.ratingDateEnd) {
            criteria.ratingDateEnd = new Date(req.query.ratingDateEnd as string);
        }
        if (req.query.outlookRevisionDateStart) {
            criteria.outlookRevisionStart = new Date(req.query.outlookRevisionDateStart as string);
        }
        if (req.query.outlookRevisionDateEnd) {
            criteria.outlookRevisionEnd = new Date(req.query.outlookRevisionDateEnd as string);
        }
        if (req.query.watchlistEntryDateStart) {
            criteria.watchlistEntryStart = new Date(req.query.watchlistEntryDateStart as string);
        }
        if (req.query.watchlistEntryDateEnd) {
            criteria.watchlistEntryEnd = new Date(req.query.watchlistEntryDateEnd as string);
        }

        // Apply filters
        const filteredIssuers = Object.keys(criteria).length > 0
            ? filteringService.filterIssuers(issuers, criteria)
            : issuers;

        res.json({
            issuers: filteredIssuers,
            lastUpdated: new Date(),
            count: filteredIssuers.length
        });
    } catch (error: any) {
        console.error('Error fetching issuers:', error);
        res.status(503).json({ error: error.message || 'Failed to fetch issuers from Bloomberg' });
    }
});

/**
 * GET /api/issuers/outlook-changes-today
 * Get issuers with outlook changes today
 */
app.get('/api/issuers/outlook-changes-today', async (req, res) => {
    try {
        const issuers = await bloombergService.fetchIssuers();
        const changedIssuers = filteringService.getOutlookChangesToday(issuers);

        res.json({
            issuers: changedIssuers,
            lastUpdated: new Date(),
            count: changedIssuers.length
        });
    } catch (error) {
        console.error('Error fetching outlook changes:', error);
        res.status(500).json({ error: 'Failed to fetch outlook changes' });
    }
});

/**
 * GET /api/issuers/watchlist-changes-today
 * Get issuers with watchlist status changes today
 */
app.get('/api/issuers/watchlist-changes-today', async (req, res) => {
    try {
        const issuers = await bloombergService.fetchIssuers();
        const changedIssuers = filteringService.getWatchlistChangesToday(issuers);

        res.json({
            issuers: changedIssuers,
            lastUpdated: new Date(),
            count: changedIssuers.length
        });
    } catch (error) {
        console.error('Error fetching watchlist changes:', error);
        res.status(500).json({ error: 'Failed to fetch watchlist changes' });
    }
});

/**
 * GET /api/issuers/rating-changes-today
 * Get issuers with rating changes today
 */
app.get('/api/issuers/rating-changes-today', async (req, res) => {
    try {
        const issuers = await bloombergService.fetchIssuers();
        const changedIssuers = filteringService.getRatingChangesToday(issuers);

        res.json({
            issuers: changedIssuers,
            lastUpdated: new Date(),
            count: changedIssuers.length
        });
    } catch (error) {
        console.error('Error fetching rating changes:', error);
        res.status(500).json({ error: 'Failed to fetch rating changes' });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Credit Rating Alert API running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard frontend: http://localhost:5173`);
});
