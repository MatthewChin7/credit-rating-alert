import { useState } from 'react';

export interface FilterState {
    regions: string[];
    sectors: string[];
    industries: string[];
    outlooks: string[];
    watchlistStatuses: string[];
    ratingDateStart?: string;
    ratingDateEnd?: string;
    outlookRevisionDateStart?: string;
    outlookRevisionDateEnd?: string;
    watchlistEntryDateStart?: string;
    watchlistEntryDateEnd?: string;
}

interface FilterPanelProps {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
    resultsCount?: number;
}

const REGIONS = [
    'North America',
    'Latin America',
    'Western Europe',
    'Eastern Europe',
    'Asia-Pacific',
    'Middle East',
    'Africa',
    'SSA'
];

const SECTORS = [
    'sovereign',
    'quasi-sovereign',
    'financial',
    'energy',
    'utilities',
    'industrials',
    'consumer',
    'healthcare',
    'technology',
    'telecommunications',
    'materials',
    'real-estate'
];

// Industries are now dynamic - loaded from API data
const INDUSTRIES: string[] = [];

const OUTLOOKS = ['positive', 'negative', 'stable', 'developing'];
const WATCHLIST_STATUSES = ['Positive', 'Negative', 'Not on watchlist'];

export default function FilterPanel({ filters, onFilterChange, resultsCount }: FilterPanelProps) {

    // Helper for single select change behavior (mimicking multi-select but simplified for this pass)
    // For a strict terminal, multi-input like command line parameters is best, but we'll use <select multiple> or just standard selects for now.
    // To match the requested "dense row", standard selects are most space efficient.

    const handleMultiSelectChange = (category: keyof FilterState, e: React.ChangeEvent<HTMLSelectElement>) => {
        const options = Array.from(e.target.options);
        const selectedValues = options
            .filter(option => option.selected)
            .map(option => option.value);

        onFilterChange({ ...filters, [category]: selectedValues });
    };

    const handleDateChange = (field: keyof FilterState, value: string) => {
        onFilterChange({ ...filters, [field]: value || undefined });
    };

    const renderSelect = (label: string, category: keyof FilterState, options: string[]) => (
        <div className="filter-group" style={{ marginRight: '10px' }}>
            <label>{label}</label>
            <select
                multiple={false} // Keeping single for density, or we can make a custom multi-select. Let's use standard select for now.
                value={(filters[category] as string[])[0] || ''}
                onChange={(e) => {
                    const val = e.target.value;
                    onFilterChange({ ...filters, [category]: val ? [val] : [] });
                }}
                style={{ height: '20px', width: '120px' }}
            >
                <option value="">ALL</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                ))}
            </select>
        </div>
    );

    const renderDate = (label: string, startField: keyof FilterState, endField: keyof FilterState) => (
        <div className="filter-group" style={{ marginRight: '10px' }}>
            <label>{label}</label>
            <div style={{ display: 'flex', gap: '2px' }}>
                <input
                    type="date"
                    value={(filters[startField] as string) || ''}
                    onChange={(e) => handleDateChange(startField, e.target.value)}
                    style={{ width: '85px' }}
                />
                <input
                    type="date"
                    value={(filters[endField] as string) || ''}
                    onChange={(e) => handleDateChange(endField, e.target.value)}
                    style={{ width: '85px' }}
                />
            </div>
        </div>
    );

    return (
        <div className="filter-panel">
            <div className="filter-grid">
                <div style={{ display: 'flex', alignItems: 'center', marginRight: '15px', color: 'var(--text-header)', fontWeight: 'bold' }}>
                    97&lt;GO&gt; FILTERS
                </div>
                {renderSelect('REGION', 'regions', REGIONS)}
                {renderSelect('SECTOR', 'sectors', SECTORS)}
                {renderSelect('OUTLOOK', 'outlooks', OUTLOOKS)}

                {renderDate('RATING DATE', 'ratingDateStart', 'ratingDateEnd')}

                <div className="filter-group" style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <button onClick={() => onFilterChange({
                        regions: [], sectors: [], industries: [], outlooks: [], watchlistStatuses: [],
                        ratingDateStart: undefined, ratingDateEnd: undefined,
                        outlookRevisionDateStart: undefined, outlookRevisionDateEnd: undefined,
                        watchlistEntryDateStart: undefined, watchlistEntryDateEnd: undefined
                    })} style={{ color: 'red' }}>
                        CLEAR
                    </button>
                    {resultsCount !== undefined && (
                        <div style={{ color: 'var(--text-data)', fontWeight: 'bold' }}>
                            {resultsCount} HITS
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
