
const isBrowser = () => typeof window !== "undefined";

export const setAuthToken = (tokenType: string, accessToken: string) => {
  if (!isBrowser()) return;

  const token = `${tokenType} ${accessToken}`.trim();
  document.cookie = `token=${encodeURIComponent(
    token
  )}; path=/; max-age=86400; secure; samesite=strict`;
};

export const getAuthToken = (): string | null => {
  if (!isBrowser()) return null;

  try {
    const cookies = document.cookie.split(";");
    const tokenCookie = cookies.find((cookie) =>
      cookie.trim().startsWith("token=")
    );
    if (!tokenCookie) {
      return null;
    }

    const token = decodeURIComponent(tokenCookie.split("=")[1].trim());
    if (!token) {
      return null;
    }

    // Ensure token is in correct Bearer format
    if (!token.toLowerCase().startsWith("bearer ")) {
      const formattedToken = `Bearer ${token}`;
      return formattedToken;
    }
    return token;
  } catch (error) {
    console.error("Error reading auth token:", error);
    return null;
  }
};

export const removeAuthToken = () => {
  if (!isBrowser()) return;

  try {
    document.cookie =
      "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=strict";
  } catch (error) {
    console.error("Error removing auth token:", error);
  }
};