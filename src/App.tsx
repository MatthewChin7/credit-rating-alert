import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './services/api';
import MasterTable from './components/MasterTable';
import FilterPanel, { FilterState } from './components/FilterPanel';

type TabView = 'master' | 'outlook-changes' | 'watchlist-changes' | 'rating-changes';

export default function App() {
    const [activeTab, setActiveTab] = useState<TabView>('master');
    const [commandInput, setCommandInput] = useState('');
    const [filters, setFilters] = useState<FilterState>({
        regions: [],
        sectors: [],
        industries: [],
        outlooks: [],
        watchlistStatuses: [],
        ratingDateStart: undefined,
        ratingDateEnd: undefined,
        outlookRevisionDateStart: undefined,
        outlookRevisionDateEnd: undefined,
        watchlistEntryDateStart: undefined,
        watchlistEntryDateEnd: undefined,
    });

    // Fetch data based on active tab
    const { data, isLoading, error } = useQuery({
        queryKey: ['issuers', activeTab, filters],
        queryFn: () => {
            switch (activeTab) {
                case 'outlook-changes':
                    return api.fetchOutlookChangesToday();
                case 'watchlist-changes':
                    return api.fetchWatchlistChangesToday();
                case 'rating-changes':
                    return api.fetchRatingChangesToday();
                default:
                    return api.fetchIssuers(filters);
            }
        },
        refetchInterval: 60000, // Refetch every minute
    });

    const handleCommandSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple command parser
        const cmd = commandInput.trim().toUpperCase();
        if (cmd === '1' || cmd === 'M' || cmd === 'MASTER') setActiveTab('master');
        if (cmd === '2' || cmd === 'O' || cmd === 'OUTLOOK') setActiveTab('outlook-changes');
        if (cmd === '3' || cmd === 'W' || cmd === 'WATCHLIST') setActiveTab('watchlist-changes');
        if (cmd === '4' || cmd === 'R' || cmd === 'RATING') setActiveTab('rating-changes');
        setCommandInput('');
    };

    return (
        <div className="app-container">
            {/* Top Command Bar */}
            <header className="content-header" style={{ padding: 0, height: '30px', background: '#000', borderBottom: '1px solid #333', display: 'flex' }}>
                <form onSubmit={handleCommandSubmit} className="cmd-input-wrapper" style={{ height: '100%', width: '300px', background: '#00008B' }}>
                    <span className="cmd-prompt">COMMAND:</span>
                    <input
                        className="cmd-input"
                        autoFocus
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder=""
                    />
                </form>

                {/* Navigation Menu as Tabs */}
                <div style={{ display: 'flex', marginLeft: '20px', alignItems: 'center', gap: '15px' }}>
                    <button onClick={() => setActiveTab('master')} style={{ color: activeTab === 'master' ? '#00FF00' : 'var(--text-header)' }}>
                        1&lt;GO&gt; MASTER
                    </button>
                    <button onClick={() => setActiveTab('outlook-changes')} style={{ color: activeTab === 'outlook-changes' ? '#00FF00' : 'var(--text-header)' }}>
                        2&lt;GO&gt; OUTLOOK
                    </button>
                    <button onClick={() => setActiveTab('watchlist-changes')} style={{ color: activeTab === 'watchlist-changes' ? '#00FF00' : 'var(--text-header)' }}>
                        3&lt;GO&gt; WATCHLIST
                    </button>
                    <button onClick={() => setActiveTab('rating-changes')} style={{ color: activeTab === 'rating-changes' ? '#00FF00' : 'var(--text-header)' }}>
                        4&lt;GO&gt; RATINGS
                    </button>
                </div>

                {/* Status / Time */}
                <div style={{ marginLeft: 'auto', paddingRight: '10px', color: 'var(--text-primary)', fontSize: '10px' }}>
                    {data ? new Date(data.lastUpdated).toLocaleTimeString() : '--:--:--'}
                </div>
            </header>

            {/* Main Content Area */}
            <main className="content-body" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {error && (
                    <div style={{ padding: '5px', background: 'red', color: 'white', fontWeight: 'bold' }}>
                        ERROR: {error instanceof Error ? error.message : 'Unknown error'}
                    </div>
                )}

                {/* Filter Panel (Only on Master) */}
                {activeTab === 'master' && (
                    <FilterPanel
                        filters={filters}
                        onFilterChange={setFilters}
                        resultsCount={data?.count}
                    />
                )}

                {/* Results Table */}
                <MasterTable
                    issuers={data?.issuers || []}
                    loading={isLoading}
                />
            </main>
        </div>
    );
}
