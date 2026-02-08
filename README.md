# PPRO Checkout Demo - Complete Solution

A production-ready checkout page implementing PPRO Global API with multiple authentication flows, recurring payments, and mobile support.

## 🎯 Features Implemented

### Core Requirements ✅

- ✅ **Checkout Page**: Beautiful, modern HTML/CSS interface
- ✅ **Payment Methods**: BLIK, iDEAL, Bancontact support
- ✅ **Currency Selection**: EUR, PLN
- ✅ **PPRO API Integration**: Full backend integration
- ✅ **Payment Flow**: Complete redirect authentication flow

### Extra Mile Bonus Points ⭐

- ⭐ **Multiple Authentication Flows For Bancontact**: Redirect & QR code
- ⭐ **Idempotency Support**: Prevents duplicate transactions
- ⭐ **Mobile Responsive**: Optimized for all devices
- ⭐ **Recurring Payments**: iDEAL subscription support
- ⭐ **Advanced UI/UX**: Modern design with animations and feedback

## 🏗️ Architecture

```
├── Frontend (Javascript)
│   └── pages
│         ├── index.html          # Main checkout page
│         ├── paymentReturn.html  # Payment Result page
│         └── qrCode.html         # Bancontact QR code page
│   └── icons                     # Store Icons
│   └── styles
│         ├── index.css           # Modern, responsive styling for index.html
│         ├── paymentReturn.css   # Modern, responsive styling for paymentReturn.html
│         ├── qrCode.css          # Modern, responsive styling for qrCode.html
│   └── app.js                    # Client-side logic & flow management
│   └── paymentReturn.js          # Payment results refresh logic
│   └── generateQRCode.js         # Generate QR code logic
│
├── Backend (Node.js/Express)
│   └── server.js                 # API server with PPRO integration
│
└── Configuration
    ├── package.json              # Dependencies
    ├── .env                      # Environment variables
    └── README.md                 # This file
```

## 🚀 Quick Start

### Prerequisites

- Node.js v14 or higher
- npm or yarn
- PPRO sandbox credentials (provided in requirements)

### Installation

1. **Install dependencies**

```bash
npm install
```

2. **Environment Setup**
   The `.env` file is already configured with the provided credentials:

```
PPRO_MERCHANT_ID=LLDEFAULTTESTCONTRACT
PPRO_API_KEY=ncSnNPkrwQXWPA4Neotej2XANupy1ksT8vUVS0Rot9eXz6ROA82ubQDHJOTEGeIeJpvgXrK3Gk6GOpCE
```

3. **Start the server**

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

4. **Open your browser**
   Navigate to: `http://localhost:3000`

## 💳 Payment Methods

### BLIK (Polish Mobile Payment)

- **Currency**: PLN only
- **Flow**: Redirect to BLIK hosted page
- **Test**: Enter 6-digit code on payment page

### iDEAL (Dutch Online Banking)

- **Currency**: EUR only
- **Flow**: Redirect to bank selection
- **Special**: Supports recurring payments
- **Recurring**: Enable checkbox to save payment method

### Bancontact (Belgian Card)

- **Currency**: EUR only
- **Flow**: Redirect to Bancontact page
- **Test**: Follow sandbox instructions

## 🔄 Authentication Flows

### Redirect Flow

**How it works:**

1. User selects payment method
2. Backend creates charge via PPRO API
3. User redirects to payment provider
4. After completion, returns to merchant site
5. Status verified via API

## 🔁 Recurring Payments (iDEAL)

### Setup

1. Select iDEAL as payment method
2. Enable "Recurring Payments" checkbox
3. Complete first payment (INITIAL)
4. Token stored for future use

## 🔁 QR Code Payments (Bancontact)

**How it works:**

1. User selects payment method: Bancontact Scan-to-Pay
2. Backend creates charge via PPRO API
3. User redirects to QR Code payment page and scan to pay
4. QR Code will be expired after 5 miniutes.
5. After completion, QR Code payment page will refresh the payment result through verifying status via API

## 🔐 Idempotency

All payment creation endpoints support idempotency keys to prevent duplicate charges:

```javascript
Headers: {
  'Request-Idempotency-Key': 'unique-key-per-request'
}
```

**How it works:**

- Same key within 24h returns cached response
- Prevents accidental duplicate charges
- Automatically handled by frontend
- Pass to PPRO Server for backend verification

## 📱 Mobile Support

The checkout page is fully responsive with:

- Touch-optimized controls
- Adaptive layouts
- Mobile-first design
- Fast loading on slow connections

**Breakpoints:**

- Desktop: 1024px+
- Tablet: 640px - 1024px
- Mobile: < 640px

## 🛠️ API Endpoints

### Create Payment

```http
POST /api/payments/create
Content-Type: application/json

{
  "method": "blik|ideal|bancontact",
  "currency": "EUR|PLN",
  "amount": 11979,
  "recurring": false,
  "idempotencyKey": "unique-key"
}
```

### Get Payment Status

```http
GET /api/payments/status/:chargeId
```

### Health Check

```http
GET /health
```

## 🎨 Design Features

- **Modern Dark Theme**: Professional financial UI
- **Custom Typography**: Outfit + JetBrains Mono
- **Smooth Animations**: CSS transitions and keyframes
- **Gradient Accents**: Warm, trustworthy color palette
- **Micro-interactions**: Hover states and loading states
- **Accessibility**: Semantic HTML and ARIA labels

## 🧪 Testing Flow

### Test BLIK Payment (Redirect)

1. Select PLN currency
2. Choose BLIK payment method
3. Select "Redirect" flow
4. Click "Pay €119.79"
5. Enter test code on BLIK page
6. Return to merchant site
7. View success status

### Test iDEAL Recurring

1. Select EUR currency
2. Choose iDEAL payment method
3. Enable "Recurring Payments"
4. Complete payment with charge
5. Token saved automatically
6. View success status

## 📊 Status Flow

```
CREATED → PENDING → PROCESSING → CAPTURED
↓                            ↓
CANCELLED                    FAILED
```

The system automatically polls for status updates and displays real-time feedback.

## 🔒 Security Features

- **HTTPS Ready**: Configure SSL in production
- **API Key Security**: Environment variables
- **CORS Protection**: Configurable origins
- **Input Validation**: All user inputs validated
- **Webhook Verification**: Signature validation ready
- **PCI Compliance**: PPRO handles sensitive data

## 🌐 Production Deployment

### Environment Variables

Update `.env` for production:

```bash
NODE_ENV=production
BASE_URL=https://yourdomain.com
RETURN_URL=https://yourdomain.com/payment-return
WEBHOOK_URL=https://yourdomain.com/webhook
ALLOWED_ORIGINS=https://yourdomain.com
```

### Deployment Checklist

- [ ] Update PPRO credentials to production
- [ ] Configure HTTPS/SSL
- [ ] Set up database for tokens
- [ ] Configure webhook endpoint
- [ ] Enable logging and monitoring
- [ ] Set up error tracking
- [ ] Test all payment flows
- [ ] Configure CORS for your domain

## 📝 Code Structure

### Frontend (`app.js`)

- State management
- Payment method filtering
- Status polling
- Error handling

### Frontend (`paymentReturn.js`)

- Status display
- Status polling
- Error handling

### Frontend (`generateQRCode.js`)

- QR code generation
- QR code expiration timer
- Status polling
- Error handling

### Backend (`server.js`)

- PPRO API wrapper
- Idempotency handling
- Recurring token management
- Error handling
- Logging

## 🐛 Troubleshooting

### Payment not redirecting

- Check console for errors
- Verify PPRO credentials
- Ensure return URL is accessible

### Status not updating

- Check network connectivity

## 📚 Resources

- [PPRO Developer Hub](https://developerhub.ppro.com/)
- [Global API Documentation](https://developerhub.ppro.com/global-api/docs)

## 🎯 Demo Highlights

This implementation showcases:

1. **Production-Ready Code**: Clean, documented, maintainable
2. **Modern Best Practices**: ES6+, async/await, error handling
3. **User Experience**: Smooth animations, clear feedback
4. **Flexibility**: Multiple flows, easy to extend
5. **Robustness**: Idempotency, validation, error recovery

## 📧 Support

For questions about this implementation, refer to the PPRO documentation or check the inline code comments for detailed explanations.

---

**Built with ❤️ for the APAC Solution Manager Technical Assessment**
