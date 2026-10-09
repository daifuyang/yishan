export type TabKey = 'profile' | 'security' | 'apiToken';

export type ApiTokenDurationValue = '7d' | '30d' | '60d' | '90d' | '1y' | 'never';

export type ApiTokenFormValues = {
  name: string;
  duration: ApiTokenDurationValue;
  scopes: string[];
};

export type AvailableScopeGroup = API.availableScopeGroup;

export type ApiTokenRecord = API.apiTokenRecord;
