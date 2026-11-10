// Mirrors the caps enforced in Backend/models.py, so the forms stop the user at
// the same limit the API would reject with a 422.
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const PRICE_MAX = 50_000;
