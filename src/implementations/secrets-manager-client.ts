import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

export class SecretsManagerClientImpl {
    constructor(private readonly client: Pick<SecretsManagerClient, 'send'>) {}

    async getSecretValue(secretArn: string): Promise<Record<string, string | number | boolean>> {
        const command = new GetSecretValueCommand({ SecretId: secretArn });

        const response = await this.client.send(command);

        if (!response.SecretString) {
            throw new Error(`Secret ${secretArn} does not contain a string value`);
        }

        try {
            return JSON.parse(response.SecretString);
        } catch (error) {
            throw new Error(
                `Failed to parse secret value as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
        }
    }
}
