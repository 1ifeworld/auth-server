export function processHexString(value: string): string {
    if (typeof value !== 'string') return value
    const cleanedValue = value.replace(/\\x/g, '0x')
    return cleanedValue.startsWith('0x') ? cleanedValue : `0x${cleanedValue}`
  }