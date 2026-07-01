let apiConfig;
try {
    const request = await fetch(`${import.meta.env.BASE_URL}assets/api-config.json`);
    apiConfig = await request.json();
} catch (e) {
    console.error(e);
}

const baseUrl = import.meta.env.VITE_API_BASE;

export { baseUrl, apiConfig };