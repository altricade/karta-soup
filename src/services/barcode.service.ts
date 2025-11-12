import { Injectable, Logger } from '@nestjs/common';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import sharp from 'sharp';
import axios from 'axios';

@Injectable()
export class BarcodeService {
  private readonly logger = new Logger(BarcodeService.name);
  private readonly codeReader = new BrowserMultiFormatReader();

  async scanBarcodeFromUrl(imageUrl: string): Promise<string | null> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });

      const imageBuffer = Buffer.from(response.data);
      
      const processedImage = await sharp(imageBuffer)
        .resize(1200, 1200, { fit: 'inside' })
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();

      const base64Image = processedImage.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      const result = await this.codeReader.decodeFromImageUrl(dataUrl);
      
      if (result && result.getText()) {
        const barcode = result.getText();
        this.logger.log(`Barcode detected: ${barcode}`);
        return barcode;
      }

      return null;
    } catch (error) {
      if (error instanceof NotFoundException) {
        this.logger.warn('No barcode found in image');
      } else {
        this.logger.error('Error scanning barcode:', error.message);
      }
      return null;
    }
  }
}
