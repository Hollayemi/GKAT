// Helper export function to generate all date periods between start and end
export function generateDatePeriods(
    startDate: Date, 
    endDate: Date, 
    interval: 'daily' | 'weekly' | 'monthly' | 'yearly'
): Array<{ date: Date; label: string }> {
    const periods: Array<{ date: Date; label: string }> = [];
    const current = new Date(startDate);
    
    // Set to start of day
    current.setHours(0, 0, 0, 0);
    
    while (current <= endDate) {
        periods.push({
            date: new Date(current),
            label: formatLabel(current, interval)
        });
        
        // Increment based on interval
        switch (interval) {
            case 'daily':
                current.setDate(current.getDate() + 1);
                break;
            case 'weekly':
                current.setDate(current.getDate() + 7);
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + 1);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + 1);
                break;
        }
    }
    
    return periods;
}

// Helper export function to format label based on interval
export function formatLabel(date: Date, interval: 'daily' | 'weekly' | 'monthly' | 'yearly'): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const dateYear = date.getFullYear();
    const showYear = dateYear !== currentYear;
    
    switch (interval) {
        case 'daily':
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: showYear ? 'numeric' : undefined
            });
        case 'weekly':
            const weekNum = getWeekNumber(date);
            return `Week ${weekNum}${showYear ? ` ${dateYear}` : ''}`;
        case 'monthly':
            return date.toLocaleDateString('en-US', { 
                month: 'short',
                year: showYear ? 'numeric' : undefined
            });
        case 'yearly':
            return dateYear.toString();
        default:
            return '';
    }
}

// Helper export function to get ISO week number
export function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
