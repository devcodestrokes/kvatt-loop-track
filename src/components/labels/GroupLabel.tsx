import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

interface GroupLabelProps {
  groupId: string;
  packCount: number;
  createdAt: string;
  showBorder?: boolean;
}

const GroupLabel = ({ groupId, packCount, createdAt, showBorder = true }: GroupLabelProps) => {
  return (
    <div 
      className={`bg-white p-4 flex flex-col items-center gap-3 ${showBorder ? 'border-2 border-dashed border-gray-400' : ''}`}
      style={{ width: 'fit-content', minWidth: '200px' }}
    >
      <div className="text-center">
        <h3 className="text-lg font-bold text-gray-900">GROUP LABEL</h3>
        <p className="text-sm text-gray-600">{packCount} packs</p>
      </div>
      
      <QRCodeSVG 
        value={groupId} 
        size={120}
        level="H"
        includeMargin={false}
      />
      
      <Barcode 
        value={groupId}
        format="CODE128"
        width={2}
        height={50}
        fontSize={12}
        margin={0}
        displayValue={true}
        background="#ffffff"
        lineColor="#000000"
      />
      
      <div className="text-xs text-gray-500 text-center">
        Created: {new Date(createdAt).toLocaleDateString()}
      </div>
    </div>
  );
};

export default GroupLabel;
