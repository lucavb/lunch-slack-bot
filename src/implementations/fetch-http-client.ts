import { HttpClient } from '../interfaces/http-client.interface';

export class FetchHttpClient implements HttpClient {
    async get<T>(url: string, options?: RequestInit): Promise<T> {
        return this.request<T>(url, { ...options, method: 'GET' });
    }

    async post<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
        return this.request<T>(url, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : null,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
    }

    async put<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
        return this.request<T>(url, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : null,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });
    }

    async delete<T>(url: string, options?: RequestInit): Promise<T> {
        return this.request<T>(url, { ...options, method: 'DELETE' });
    }

    private async request<T>(url: string, options: RequestInit): Promise<T> {
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        }

        return await response.json();
    }
}
