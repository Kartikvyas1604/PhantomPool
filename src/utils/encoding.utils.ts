export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/, ''), 'hex');
}

export function bufferToHex(buffer: Buffer): string {
  return '0x' + buffer.toString('hex');
}

export function pointToHex(point: { x: string; y: string }): string {
  return `04${point.x}${point.y}`;
}

export function hexToPoint(hex: string): { x: string; y: string } {
  const clean = hex.replace(/^0x|^04/, '');
  const x = clean.substring(0, 64);
  const y = clean.substring(64, 128);
  
  return { x, y };
}

export function generateOrderHash(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15) +
         Date.now().toString(36);
}

export function toBase64(data: Uint8Array | Buffer): string {
  return Buffer.from(data).toString('base64');
}

export function fromBase64(encoded: string): Buffer {
  return Buffer.from(encoded, 'base64');
}