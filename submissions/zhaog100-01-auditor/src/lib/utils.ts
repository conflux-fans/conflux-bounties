export function isValidEVMAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function normalizeAddress(address: string): string {
  // Handle cfx: format -> extract evm address
  if (address.startsWith('cfx:')) {
    const match = address.match(/:0x[a-fA-F0-9]{40}/);
    if (match) return match[0].substring(1);
  }
  return address.toLowerCase();
}

export function isCuid(value: string): boolean {
  return /^[a-z0-9]{25,}$/.test(value);
}

export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
