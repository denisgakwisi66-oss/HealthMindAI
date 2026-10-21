export const apiUrl = (path) => {
  const baseUrl = globalThis.HEALTHMIND_API_URL;
  return baseUrl ? new URL(path, baseUrl).toString() : path;
};
