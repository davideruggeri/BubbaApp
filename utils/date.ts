export const isChristmasPeriod = (): boolean => {
    const now = new Date();
    const month = now.getMonth(); // 0-indexed (0 = Jan, 11 = Dec)
    const day = now.getDate();

    // December (11) from 1st to 31st
    if (month === 11 && day >= 1) {
        return true;
    }

    // January (0) from 1st to 8th
    if (month === 0 && day <= 6) {
        return true;
    }

    return false;
};
