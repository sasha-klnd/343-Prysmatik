// ── User tokens ───────────────────────────────────────────────────────────────
export function setToken(token: string) {
    localStorage.setItem("token", token);
}
export function getToken() {
    return localStorage.getItem("token");
}
export function clearToken() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
}

export function setRefreshToken(token: string) {
    localStorage.setItem("refresh_token", token);
}
export function getRefreshToken() {
    return localStorage.getItem("refresh_token");
}

// ── Admin token ───────────────────────────────────────────────────────────────
export function setAdminToken(token: string) {
    sessionStorage.setItem("admin_token", token);
}
export function getAdminToken() {
    return sessionStorage.getItem("admin_token");
}
export function clearAdminToken() {
    sessionStorage.removeItem("admin_token");
}

// ── Refresh access token using the stored refresh token ───────────────────────
let _refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
    // Deduplicate concurrent refresh attempts
    if (_refreshing) return _refreshing;

    _refreshing = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) return false;
        try {
            const res = await fetch("/api/auth/refresh", {
                method:  "POST",
                headers: {
                    "Content-Type":  "application/json",
                    "Authorization": `Bearer ${refreshToken}`,
                },
            });
            if (!res.ok) return false;
            const json = await res.json();
            const newAccess = json?.data?.access_token ?? json?.data?.token;
            if (!newAccess) return false;
            setToken(newAccess);
            return true;
        } catch {
            return false;
        } finally {
            _refreshing = null;
        }
    })();

    return _refreshing;
}

// ── Main fetch wrapper ────────────────────────────────────────────────────────
export async function apiFetch(
    path: string,
    options: RequestInit = {},
    useAdminToken = false,
): Promise<any> {
    const token = useAdminToken ? getAdminToken() : getToken();

    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string>),
    };

    if (options.body !== undefined && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }
    if (token) headers["Authorization"] = `Bearer ${token}`;

    let res = await fetch(`/api${path}`, { ...options, headers });

    // Auto-refresh on 401 (access token expired) — only for non-admin, non-auth calls
    if (res.status === 401 && !useAdminToken && !path.startsWith("/auth/")) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            // Retry with fresh token
            const newToken = getToken();
            if (newToken) headers["Authorization"] = `Bearer ${newToken}`;
            res = await fetch(`/api${path}`, { ...options, headers });
        }
    }

    const json = await res.json().catch(() => null);

    if (!res.ok) {
        // Surface 429 rate limit errors clearly
        if (res.status === 429) {
            throw new Error("Too many requests — please wait a moment before trying again.");
        }
        throw new Error(json?.error?.message || json?.msg || json?.message || "Request failed");
    }

    return json?.data ?? json;
}

// ── Save both tokens (call after login/register) ──────────────────────────────
export function saveAuthTokens(data: { token?: string; access_token?: string; refresh_token?: string }) {
    const access = data.access_token ?? data.token;
    if (access)              setToken(access);
    if (data.refresh_token)  setRefreshToken(data.refresh_token);
}
