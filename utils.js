export const getQueryParams = (queryString) => {
    const params = new URLSearchParams(queryString);
    const result = {};
    for (const [key, value] of params.entries()) {
        result[key] = value;
    }
    return result;
};

export const getBooleanFromLocalStorage = (key) => {
    const value = localStorage.getItem(key);
    return value === 'true';
};