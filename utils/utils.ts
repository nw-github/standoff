export const roundTo = (num: number, places: number = 1) => {
    const pow = 10 ** places;
    return Math.round(num * pow) / pow;
};
