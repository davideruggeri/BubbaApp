const isChristmasPeriod = (dateStr) => {
    const now = new Date(dateStr);
    const month = now.getMonth(); // 0-indexed
    const day = now.getDate();

    console.log(`Checking ${dateStr}: Month ${month}, Day ${day}`);

    if (month === 11 && day >= 1) return true;
    if (month === 0 && day <= 8) return true;
    return false;
};

console.log('Dec 1:', isChristmasPeriod('2025-12-01'));
console.log('Dec 25:', isChristmasPeriod('2025-12-25'));
console.log('Jan 1:', isChristmasPeriod('2026-01-01'));
console.log('Jan 8:', isChristmasPeriod('2026-01-08'));
console.log('Nov 30:', isChristmasPeriod('2025-11-30'));
console.log('Jan 9:', isChristmasPeriod('2026-01-09'));
