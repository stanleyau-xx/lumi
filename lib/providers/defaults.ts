// Default model seeding is disabled — add models manually from the Models admin page.
// Returning an empty array prevents misleading placeholder models from appearing
// for providers that don't actually expose those model IDs.
export function getDefaultModels(providerType: string): string[] {
  return [];
}
