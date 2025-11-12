# Barcode Scanning Feature

## Overview
Users can now scan the barcode on their Карта Суп card using their phone camera or by uploading a photo from their gallery.

## How It Works

### For Users
1. Start the bot with `/start` or use `/changecode`
2. Choose one of two options:
   - **📸 Send a photo** of the barcode (from camera or gallery)
   - **✍️ Enter the code manually** (13 digits starting with 2001)

### Technical Implementation

#### Libraries Used
- **@zxing/library**: Barcode detection and decoding
- **sharp**: Image preprocessing and optimization
- **canvas**: Image rendering for barcode reader

#### Image Processing Pipeline
1. Download photo from Telegram servers
2. Resize to max 1200x1200 (maintains aspect ratio)
3. Convert to grayscale
4. Normalize contrast
5. Apply sharpening filter
6. Scan for barcode using ZXing

#### Validation
- Barcode must be exactly 13 digits
- Must start with "2001"
- If validation fails, user is prompted to enter manually

## User Experience

### Success Flow
```
User sends photo
↓
"Сканирую штрих-код... 🔍"
↓
"Проверяю код... ⏳"
↓
"✅ Код успешно сохранен!"
↓
Display balance and transactions
```

### Error Handling
- **No barcode detected**: Helpful tips for better photo quality
- **Invalid barcode format**: Shows detected code and asks for manual entry
- **API error**: Prompts to try again or enter manually

## Tips for Best Results
Users are advised to:
- Take photos in good lighting
- Hold camera steady
- Ensure barcode is clearly visible
- Avoid glare or shadows on the barcode

## Rate Limiting
Barcode scanning respects the same rate limits as manual balance checks:
- 60 seconds after successful check
- 10 seconds after failed check
