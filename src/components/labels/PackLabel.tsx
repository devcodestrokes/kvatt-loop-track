import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

interface PackLabelProps {
  packId: string;
  showBorder?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const sizeConfig = {
  small: { qr: 60, barHeight: 30, barWidth: 1.2, fontSize: 8 },
  medium: { qr: 80, barHeight: 40, barWidth: 1.5, fontSize: 10 },
  large: { qr: 100, barHeight: 50, barWidth: 2, fontSize: 12 },
};

const PackLabel = ({ packId, showBorder = true, size = 'medium' }: PackLabelProps) => {
  const config = sizeConfig[size];
  
  return (
    <div 
      className={`bg-white p-3 flex flex-col items-center gap-2 ${showBorder ? 'border border-gray-300' : ''}`}
      style={{ width: 'fit-content' }}
    >
      <QRCodeSVG 
        value={packId} 
        size={config.qr}
        level="M"
        includeMargin={false}
      />
      <Barcode 
        value={packId}
        format="CODE128"
        width={config.barWidth}
        height={config.barHeight}
        fontSize={config.fontSize}
        margin={0}
        displayValue={true}
        background="#ffffff"
        lineColor="#000000"
      />
    </div>
  );
};

export default PackLabel;
