import { HttpClient } from '../interfaces/http-client.interface';

export class FetchHttpClient implements HttpClient {
    constructor(private readonly fetchFn: typeof fetch = fetch) {}

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
        const response = await this.fetchFn(url, options);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}, statusText: ${response.statusText}`);
        }

        // Check if the response has content
        const contentType = response.headers.get('content-type');
        const text = await response.text();

        // If it's empty or plain text "ok" (Slack webhook response), return it as is
        if (!text || text.trim() === 'ok') {
            return text as T;
        }

        // Try to parse as JSON if it looks like JSON
        if (contentType?.includes('application/json') || text.startsWith('{') || text.startsWith('[')) {
            try {
                return JSON.parse(text);
            } catch {
                // If JSON parsing fails, return the text as is
                return text as T;
            }
        }

        // Return text as is for other content types
        return text as T;
    }
}
