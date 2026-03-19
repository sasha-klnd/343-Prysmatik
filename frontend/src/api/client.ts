export function setToken(token: string) {
    localStorage.setItem("token", token);
}

export function getToken() {
    return localStorage.getItem("token");
}

export function clearToken() {
    localStorage.removeItem("token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
    const token = getToken();

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
    };

    // Only set JSON content-type when sending a body
    const hasBody = options.body !== undefined && options.body !== null;
    if (hasBody && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`/api${path}`, { ...options, headers });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error(json?.error?.message || json?.msg || json?.message || "Request failed");
    }

    return json?.data ?? json;
}