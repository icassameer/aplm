import { useAuth } from "@/lib/auth";
import { useCallback } from "react";

export function useApi() {
  const { token } = useAuth();

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data.data;
  }, [token]);

  return { apiFetch };
}
