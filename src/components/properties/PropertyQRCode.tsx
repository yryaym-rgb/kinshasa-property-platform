import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { buildPropertyQRContent } from '@/utils/qrUtils';

interface PropertyQRCodeProps {
  code: string;
  className?: string;
}

export function PropertyQRCode({ code, className }: PropertyQRCodeProps) {
  const qrValue = buildPropertyQRContent(code);

  const handleDownloadPng = () => {
    const svg = document.getElementById(`qr-${code}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `qr-${code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Code QR du logement</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
          <QRCodeSVG
            id={`qr-${code}`}
            value={qrValue}
            size={160}
            level="H"
            includeMargin
          />
        </div>
        <p className="text-center text-xs font-mono text-[var(--color-muted-foreground)]">{code}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />} onClick={handleDownloadPng}>
            PNG
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Printer className="h-4 w-4" />} onClick={handlePrint}>
            Imprimer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
