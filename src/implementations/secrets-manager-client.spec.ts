import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SecretsManagerClientImpl } from './secrets-manager-client';

describe('SecretsManagerClientImpl', () => {
    let client: SecretsManagerClientImpl;
    let mockSecretsManagerClient: { send: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        mockSecretsManagerClient = { send: vi.fn() };
        client = new SecretsManagerClientImpl(mockSecretsManagerClient);
    });

    describe('getSecretValue', () => {
        it('should retrieve and parse secret value successfully', async () => {
            const mockSecretValue = { webhook_url: 'https://hooks.slack.com/services/test' };
            mockSecretsManagerClient.send.mockResolvedValue({
                SecretString: JSON.stringify(mockSecretValue),
            });

            const result = await client.getSecretValue('test-secret-arn');

            expect(result).toEqual(mockSecretValue);
            expect(mockSecretsManagerClient.send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        });

        it('should throw error if secret does not contain string value', async () => {
            mockSecretsManagerClient.send.mockResolvedValue({
                SecretString: null,
            });

            await expect(client.getSecretValue('test-secret-arn')).rejects.toThrow(
                'Secret test-secret-arn does not contain a string value',
            );
        });

        it('should throw error if secret value is not valid JSON', async () => {
            mockSecretsManagerClient.send.mockResolvedValue({
                SecretString: 'invalid json',
            });

            await expect(client.getSecretValue('test-secret-arn')).rejects.toThrow(
                'Failed to parse secret value as JSON',
            );
        });

        it('should throw error if AWS SDK call fails', async () => {
            mockSecretsManagerClient.send.mockRejectedValue(new Error('AWS SDK error'));

            await expect(client.getSecretValue('test-secret-arn')).rejects.toThrow('AWS SDK error');
        });
    });
});
