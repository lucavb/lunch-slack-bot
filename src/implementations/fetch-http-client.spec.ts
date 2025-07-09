import { describe, it, expect, beforeEach } from 'vitest';
import { FetchHttpClient } from './fetch-http-client';

// Mock fetch for testing
const mockFetch = (response: any, ok: boolean = true, status: number = 200) => {
    global.fetch = async () =>
        ({
            ok,
            status,
            statusText: ok ? 'OK' : 'Error',
            json: async () => response,
        }) as Response;
};

describe('FetchHttpClient', () => {
    let httpClient: FetchHttpClient;

    beforeEach(() => {
        httpClient = new FetchHttpClient();
    });

    describe('get', () => {
        it('should make GET request and return data', async () => {
            const mockData = { message: 'success' };
            mockFetch(mockData);

            const result = await httpClient.get('https://api.example.com/data');

            expect(result).toEqual(mockData);
        });

        it('should throw error for non-ok response', async () => {
            mockFetch({ error: 'Not found' }, false, 404);

            await expect(httpClient.get('https://api.example.com/data')).rejects.toThrow(
                'HTTP error! status: 404, statusText: Error',
            );
        });
    });

    describe('post', () => {
        it('should make POST request with body', async () => {
            const mockData = { id: 1, created: true };
            const requestBody = { name: 'Test' };

            mockFetch(mockData);

            const result = await httpClient.post('https://api.example.com/data', requestBody);

            expect(result).toEqual(mockData);
        });

        it('should handle POST request without body', async () => {
            const mockData = { success: true };
            mockFetch(mockData);

            const result = await httpClient.post('https://api.example.com/data');

            expect(result).toEqual(mockData);
        });
    });

    describe('put', () => {
        it('should make PUT request with body', async () => {
            const mockData = { id: 1, updated: true };
            const requestBody = { name: 'Updated Test' };

            mockFetch(mockData);

            const result = await httpClient.put('https://api.example.com/data/1', requestBody);

            expect(result).toEqual(mockData);
        });
    });

    describe('delete', () => {
        it('should make DELETE request', async () => {
            const mockData = { deleted: true };
            mockFetch(mockData);

            const result = await httpClient.delete('https://api.example.com/data/1');

            expect(result).toEqual(mockData);
        });
    });
});
