import type { Issuer } from '../services/api';
import { calculateOutlookColor, calculateOutlookRevisionDateColor, calculateWatchlistColor, formatDate, formatOutlook } from '../utils/formatting';

interface MasterTableProps {
    issuers: Issuer[];
    loading?: boolean;
}

export default function MasterTable({ issuers, loading }: MasterTableProps) {
    if (loading) {
        return (
            <div style={{ padding: '20px', color: 'var(--text-header)', fontFamily: 'monospace' }}>
                &gt;&gt; FETCHING DATA...
            </div>
        );
    }

    if (issuers.length === 0) {
        return (
            <div style={{ padding: '20px', color: 'var(--color-red)' }}>
                NO RESULTS FOUND.
            </div>
        );
    }

    const renderCell = (
        content: string | number,
        colorStatus: 'green' | 'red' | 'amber' | 'none' = 'none',
        clickable: boolean = false,
        onClick?: () => void
    ) => {
        const classes = [
            colorStatus !== 'none' ? `status-${colorStatus}` : '',
            clickable ? 'clickable' : ''
        ].filter(Boolean).join(' ');

        return (
            <td className={classes} onClick={clickable ? onClick : undefined}>
                {(content === undefined || content === null || content === '') ? '--' : content}
            </td>
        );
    };

    return (
        <div className="table-container">
            <div className="table-wrapper">
                <table>
                    <thead>
                        <tr>
                            {/* Fixed columns */}
                            <th rowSpan={2} className="frozen">ISSUER NAME</th>
                            <th rowSpan={2}>REGION</th>
                            <th rowSpan={2}>SECTOR</th>
                            <th rowSpan={2}>INDUSTRY</th>

                            {/* Field headers - each field has 3 agencies beneath */}
                            <th colSpan={3} className="field-header">CURRENT RATING</th>
                            <th colSpan={3} className="field-header">RATING DATE</th>
                            <th colSpan={3} className="field-header">OUTLOOK</th>
                            <th colSpan={3} className="field-header">OUTLOOK REVISION DATE</th>
                            <th colSpan={3} className="field-header">WATCHLIST STATUS</th>
                            <th colSpan={3} className="field-header">WATCHLIST ENTRY DATE</th>
                        </tr>
                        <tr>
                            {/* Current Rating - agencies */}
                            <th>MOODY'S</th>
                            <th>S&P</th>
                            <th>FITCH</th>

                            {/* Rating Date - agencies */}
                            <th>MOODY'S</th>
                            <th>S&P</th>
                            <th>FITCH</th>

                            {/* Outlook - agencies */}
                            <th>MOODY'S</th>
                            <th>S&P</th>
                            <th>FITCH</th>

                            {/* Outlook Revision Date - agencies */}
                            <th>MOODY'S</th>
                            <th>S&P</th>
                            <th>FITCH</th>

                            {/* Watchlist Status - agencies with specific names */}
                            <th>MOODY'S (REV)</th>
                            <th>S&P (CW)</th>
                            <th>FITCH (RW)</th>

                            {/* Watchlist Entry Date - agencies */}
                            <th>MOODY'S</th>
                            <th>S&P</th>
                            <th>FITCH</th>
                        </tr>
                    </thead>
                    <tbody>
                        {issuers.map((issuer) => (
                            <tr key={issuer.id}>
                                {/* Fixed columns */}
                                <td className="frozen" style={{ color: 'var(--text-header)' }}>{issuer.name.toUpperCase()}</td>
                                <td>{issuer.region.toUpperCase()}</td>
                                <td>{issuer.sector.toUpperCase()}</td>
                                <td>{issuer.industry.toUpperCase()}</td>

                                {/* Current Rating */}
                                {renderCell(issuer.ratings.moodys.currentRating)}
                                {renderCell(issuer.ratings.sp.currentRating)}
                                {renderCell(issuer.ratings.fitch.currentRating)}

                                {/* Rating Date */}
                                {renderCell(formatDate(issuer.ratings.moodys.ratingDate))}
                                {renderCell(formatDate(issuer.ratings.sp.ratingDate))}
                                {renderCell(formatDate(issuer.ratings.fitch.ratingDate))}

                                {/* Outlook - simple green for positive, red for negative */}
                                {renderCell(
                                    formatOutlook(issuer.ratings.moodys.outlook).toUpperCase(),
                                    calculateOutlookColor(issuer.ratings.moodys.outlook)
                                )}
                                {renderCell(
                                    formatOutlook(issuer.ratings.sp.outlook).toUpperCase(),
                                    calculateOutlookColor(issuer.ratings.sp.outlook)
                                )}
                                {renderCell(
                                    formatOutlook(issuer.ratings.fitch.outlook).toUpperCase(),
                                    calculateOutlookColor(issuer.ratings.fitch.outlook)
                                )}

                                {/* Outlook Revision Date - amber if before horizon, red if within/after */}
                                {renderCell(
                                    formatDate(issuer.ratings.moodys.outlookRevisionDate),
                                    calculateOutlookRevisionDateColor(issuer.ratings.moodys.outlookRevisionDate, 'moodys')
                                )}
                                {renderCell(
                                    formatDate(issuer.ratings.sp.outlookRevisionDate),
                                    calculateOutlookRevisionDateColor(issuer.ratings.sp.outlookRevisionDate, 'sp')
                                )}
                                {renderCell(
                                    formatDate(issuer.ratings.fitch.outlookRevisionDate),
                                    calculateOutlookRevisionDateColor(issuer.ratings.fitch.outlookRevisionDate, 'fitch')
                                )}

                                {/* Watchlist Status - green for Positive, red for Negative */}
                                {renderCell(
                                    issuer.ratings.moodys.watchlistStatus,
                                    calculateWatchlistColor(issuer.ratings.moodys.watchlistStatus)
                                )}
                                {renderCell(
                                    issuer.ratings.sp.watchlistStatus,
                                    calculateWatchlistColor(issuer.ratings.sp.watchlistStatus)
                                )}
                                {renderCell(
                                    issuer.ratings.fitch.watchlistStatus,
                                    calculateWatchlistColor(issuer.ratings.fitch.watchlistStatus)
                                )}

                                {/* Watchlist Entry Date */}
                                {renderCell(formatDate(issuer.ratings.moodys.watchlistEntryDate))}
                                {renderCell(formatDate(issuer.ratings.sp.watchlistEntryDate))}
                                {renderCell(formatDate(issuer.ratings.fitch.watchlistEntryDate))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
