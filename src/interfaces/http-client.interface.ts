export interface HttpClient {
    get<T>(url: string, options?: RequestInit): Promise<T>;
    post<T>(url: string, body?: unknown, options?: RequestInit): Promise<T>;
    put<T>(url: string, body?: unknown, options?: RequestInit): Promise<T>;
    delete<T>(url: string, options?: RequestInit): Promise<T>;
}

export interface HttpResponse<T> {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
}
