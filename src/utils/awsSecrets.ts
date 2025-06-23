import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

interface GmailTokens {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date?: number;
}

interface GoogleCredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export class AWSSecretsManager {
  private client: SecretsManagerClient;
  private cache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor(region: string = 'us-east-1', profile?: string) {
    const config: any = { region };
    
    if (profile) {
      config.credentials = { profile };
    }
    
    this.client = new SecretsManagerClient(config);
  }

  private async getSecretValue(secretName: string): Promise<string> {
    const command = new GetSecretValueCommand({
      SecretId: secretName,
    });

    try {
      const response = await this.client.send(command);
      
      if (response.SecretString) {
        return response.SecretString;
      } else if (response.SecretBinary) {
        return Buffer.from(response.SecretBinary).toString('utf-8');
      } else {
        throw new Error('Secret has no string or binary value');
      }
    } catch (error) {
      console.error(`Error retrieving secret ${secretName}:`, error);
      throw new Error(`Failed to retrieve secret ${secretName}: ${error}`);
    }
  }

  private isCacheValid(secretName: string): boolean {
    const expiry = this.cacheExpiry.get(secretName);
    return expiry ? Date.now() < expiry : false;
  }

  private setCache(secretName: string, value: any): void {
    this.cache.set(secretName, value);
    this.cacheExpiry.set(secretName, Date.now() + this.CACHE_DURATION);
  }

  private getCache(secretName: string): any | null {
    if (this.isCacheValid(secretName)) {
      return this.cache.get(secretName);
    }
    return null;
  }

  async getGmailTokens(): Promise<GmailTokens> {
    const cacheKey = 'gmail-tokens';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const secretValue = await this.getSecretValue('chatterbox/gmail-tokens');
    const tokens: GmailTokens = JSON.parse(secretValue);
    
    this.setCache(cacheKey, tokens);
    return tokens;
  }

  async getOpenAIApiKey(): Promise<string> {
    const cacheKey = 'openai-api-key';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const secretValue = await this.getSecretValue('chatterbox/openai-api-key');
    this.setCache(cacheKey, secretValue);
    return secretValue;
  }

  async getGoogleCredentials(): Promise<GoogleCredentials> {
    const cacheKey = 'google-credentials';
    const cached = this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const secretValue = await this.getSecretValue('chatterbox/google-credentials');
    const credentials: GoogleCredentials = JSON.parse(secretValue);
    
    this.setCache(cacheKey, credentials);
    return credentials;
  }

  async getSecret(secretName: string): Promise<string> {
    const cached = this.getCache(secretName);
    if (cached) {
      return cached;
    }

    const secretValue = await this.getSecretValue(secretName);
    this.setCache(secretName, secretValue);
    return secretValue;
  }

  async getSecretAsJson<T>(secretName: string): Promise<T> {
    const cached = this.getCache(secretName);
    if (cached) {
      return cached;
    }

    const secretValue = await this.getSecretValue(secretName);
    const parsed: T = JSON.parse(secretValue);
    this.setCache(secretName, parsed);
    return parsed;
  }

  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  clearCacheForSecret(secretName: string): void {
    this.cache.delete(secretName);
    this.cacheExpiry.delete(secretName);
  }
}

// Default instance
export const awsSecrets = new AWSSecretsManager();

// Convenience functions
export async function getGmailTokens(): Promise<GmailTokens> {
  return awsSecrets.getGmailTokens();
}

export async function getOpenAIApiKey(): Promise<string> {
  return awsSecrets.getOpenAIApiKey();
}

export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  return awsSecrets.getGoogleCredentials();
} 