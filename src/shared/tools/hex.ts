export function normalizeHexString(hex: string): string {
  return hex.toLowerCase().replace(/^0x/, '');
}

export function convertHexToUint(hex: string): number {
  return parseInt(hex, 16);
}

export function convertUintToHex(num: number): string {
  return '0x' + num.toString(16);
}

export function stringToHex(str: string): string {
  if (/^0x/.test(str)) return str;
  return '0x' + str;
}
