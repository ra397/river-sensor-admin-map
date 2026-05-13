let apiConfig;
try {
    const apiConfigResponse = await fetch(`${import.meta.env.BASE_URL}assets/api-config.json`);
    apiConfig = await apiConfigResponse.json();
} catch (e) {
    console.error(e);
}
export { apiConfig };