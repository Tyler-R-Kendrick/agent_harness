import QRCode from 'qrcode';

export async function renderQrDataUrl(data: string): Promise<string> {
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
    color: { dark: '#06110d', light: '#f7fff9' },
  });
}
