import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FetchHttpClient } from './fetch-http-client';

const createMockResponse = (response: unknown, ok: boolean = true, status: number = 200, contentType: string = 'application/json') => {
    const responseText = typeof response === 'string' ? response : JSON.stringify(response);
    
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: async () => response,
        text: async () => responseText,
        headers: {
            get: (name: string) => {
                if (name.toLowerCase() === 'content-type') {
                    return contentType;
                }
                return null;
            }
        }
    } as Response;
};

describe('FetchHttpClient', () => {
    let httpClient: FetchHttpClient;
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn();
        httpClient = new FetchHttpClient(mockFetch);
    });

    describe('get', () => {
        it('should make GET request and return data', async () => {
            const mockData = { message: 'success' };
            mockFetch.mockResolvedValue(createMockResponse(mockData));

            const result = await httpClient.get('https://api.example.com/data');

            expect(result).toEqual(mockData);
        });

        it('should throw error for non-ok response', async () => {
            mockFetch.mockResolvedValue(createMockResponse({ error: 'Not found' }, false, 404));

            await expect(httpClient.get('https://api.example.com/data')).rejects.toThrow(
                'HTTP error! status: 404, statusText: Error',
            );
        });
    });

    describe('post', () => {
        it('should make POST request with body', async () => {
            const mockData = { id: 1, created: true };
            const requestBody = { name: 'Test' };

            mockFetch.mockResolvedValue(createMockResponse(mockData));

            const result = await httpClient.post('https://api.example.com/data', requestBody);

            expect(result).toEqual(mockData);
        });

        it('should handle POST request without body', async () => {
            const mockData = { success: true };
            mockFetch.mockResolvedValue(createMockResponse(mockData));

            const result = await httpClient.post('https://api.example.com/data');

            expect(result).toEqual(mockData);
        });

        it('should handle plain text response (like Slack webhook)', async () => {
            mockFetch.mockResolvedValue(createMockResponse('ok', true, 200, 'text/plain'));

            const result = await httpClient.post('https://hooks.slack.com/webhook');

            expect(result).toBe('ok');
        });
    });

    describe('put', () => {
        it('should make PUT request with body', async () => {
            const mockData = { id: 1, updated: true };
            const requestBody = { name: 'Updated Test' };

            mockFetch.mockResolvedValue(createMockResponse(mockData));

            const result = await httpClient.put('https://api.example.com/data/1', requestBody);

            expect(result).toEqual(mockData);
        });
    });

    describe('delete', () => {
        it('should make DELETE request', async () => {
            const mockData = { deleted: true };
            mockFetch.mockResolvedValue(createMockResponse(mockData));

            const result = await httpClient.delete('https://api.example.com/data/1');

            expect(result).toEqual(mockData);
        });
    });
});
