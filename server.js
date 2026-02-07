const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// PPRO Configuration
const PPRO_CONFIG = {
    merchantId: process.env.PPRO_MERCHANT_ID || 'LLDEFAULTTESTCONTRACT',
    apiKey: process.env.PPRO_API_KEY || 'ncSnNPkrwQXWPA4Neotej2XANupy1ksT8vUVS0Rot9eXz6ROA82ubQDHJOTEGeIeJpvgXrK3Gk6GOpCE',
    baseUrl: process.env.PPRO_BASE_URL || 'https://api.sandbox.eu.ppro.com',
    returnUrl: process.env.RETURN_URL || 'http://localhost:3000/payment-return',
    webhookUrl: process.env.WEBHOOK_URL || 'http://localhost:3000/webhook'
};

// In-memory store for idempotency (use Redis in production)
const idempotencyStore = new Map();

// In-memory store for recurring tokens (use database in production)
const recurringTokenStore = new Map();

// Helper Functions

/**
 * Serve index.html at root path
 */
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Serve QR code page
 */
app.get('/qr-payment', (req, res) => {
    res.sendFile(path.join(__dirname, 'qrCode.html'));
});

/**
 * Make authenticated request to PPRO API
 */
async function pproRequest(endpoint, method = 'GET', body = null, idempotencyKey = null) {
    const url = `${PPRO_CONFIG.baseUrl}${endpoint}`;
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PPRO_CONFIG.apiKey}`,
        'Merchant-Id': PPRO_CONFIG.merchantId
    };
    
    // Add idempotency key if provided
    if (idempotencyKey && method === 'POST') {
        headers['Request-Idempotency-Key'] = idempotencyKey;
    }
    
    const options = {
        method,
        headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    console.log(`PPRO Request: ${method} ${url}`);

    if (body) console.log('Request body:', JSON.stringify(body, null, 2));
    
    const response = await fetch(url, options);
    const data = await response.json();
    
    console.log(`PPRO Response (${response.status}):`, JSON.stringify(data, null, 2));
    
    if (!response.ok) {
        throw new Error(data.error || data.message || 'PPRO API request failed');
    }
    
    return data;
}

/**
 * Generate unique order ID
 */
function generateOrderId() {
    return `ORDER-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

/**
 * Check and store idempotency key
 */
function checkIdempotency(key) {
    if (idempotencyStore.has(key)) {
        return idempotencyStore.get(key);
    }
    return null;
}

function storeIdempotency(key, result) {
    idempotencyStore.set(key, result);
    // Clean up after 24 hours
    setTimeout(() => idempotencyStore.delete(key), 24 * 60 * 60 * 1000);
}

function generatePaymentData(method='IDEAL', currency='EUR', amount = 0, orderId="demo_order_123", recurring = false) {
    const paymentData = {
        paymentMethod: method,
        amount: {
            value: amount,
            currency: currency,
        },
    };

    if (method === 'IDEAL') {
        if (recurring) {
            return {
                paymentMethod: method,
                consumer: {
                    name: "John Smith",
                    country: "NL"
                },
                instrument: {
                    type: "BANK_ACCOUNT",
                    details: {
                        debitMandateId: "YOUR_GENERATED_MANDATEID"
                    },
                },
                authenticationSettings: [{
                    type: 'REDIRECT',
                    settings: {
                        returnUrl: `${PPRO_CONFIG.returnUrl}?orderId=${orderId}&status=initial`,
                    }
                }],
                initialPaymentCharge: {
                    amount: {
                        value: amount,
                        currency: currency
                    }
                }
            };
        }

        return {
            ...paymentData,
            consumer: {
                country: 'NL'
            },
            instrument: {
                type: 'BANK_ACCOUNT',
                details: {
                    bankCode: 'TESTNL2A',
                },
            },
            authenticationSettings: [{
                type: 'REDIRECT',
                settings: {
                    returnUrl: `${PPRO_CONFIG.returnUrl}?orderId=${orderId}&status=initial`,
                }
            }],
        }
    }

    if (method === 'BLIK') {
        return {
            ...paymentData,
            consumer: {
                name: "John Smith",
                country: "PL",
                client: {
                    ip: "11.22.22.33",
                    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36"
                },
            },
            authenticationSettings: [{
                type: 'REDIRECT',
                settings: {
                    returnUrl: `${PPRO_CONFIG.returnUrl}?orderId=${orderId}&status=initial`,
                }
            },
            {
                type: "MULTI_FACTOR"
            }],
        }
    }

    if (method === 'BANCONTACT' || method === 'BANCONTACTQR') {
        return {
            ...paymentData,
            paymentMethod: 'BANCONTACT',
            consumer: {
                country: "BE",
            },
            authenticationSettings: [
                {
                    type: 'REDIRECT',
                    settings: {
                        returnUrl: `${PPRO_CONFIG.returnUrl}?orderId=${orderId}&status=initial`,
                    }
                },
                {
                    type: "SCAN_CODE",
                    settings: {
                        scanBy: "2025-06-22T11:09:22.937Z"
                    }
                },
                {
                    type: "APP_INTENT",
                    settings:{
                        mobileIntentUri: "webshop://paymentresponse?123"
                    }
                },
            ],
        }
    }
}

// API Routes

/**
 * Create Payment Charge (Redirect & Drop-in flows)
 */
app.post('/api/payments/create', async (req, res) => {

    try {
        const { method, currency, amount, recurring, idempotencyKey } = req.body;
        console.log('method is:', method);
        // Validate required fields
        if (!method || !currency || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Check idempotency
        const idempKey = idempotencyKey || req.headers['x-idempotency-key'];
        if (idempKey) {
            const cached = checkIdempotency(idempKey);
            if (cached) {
                console.log('Returning cached response for idempotency key:', idempKey);
                return res.json(cached);
            }
        }
        
        // Map payment methods to PPRO method codes
        const methodMap = {
            'blik': 'BLIK',
            'ideal': 'IDEAL',
            'bancontact': 'BANCONTACT',
            'bancontactqr': 'BANCONTACTQR',
        };
        
        const pproMethod = methodMap[method.toLowerCase()];
        if (!pproMethod) {
            return res.status(400).json({ error: 'Invalid payment method' });
        }
        
        // Generate order ID
        const orderId = generateOrderId();
        
        // Prepare payment data
        const paymentData = generatePaymentData(pproMethod, currency, amount, orderId, recurring);
        console.log('Creating payment charge:', paymentData);

        let charge = {};
        let requestUrl = '';
        let qrCode = '';
        // Add recurring parameters for iDEAL if enabled
        if (recurring && method === 'ideal') {
            // Create agreement via PPRO API
            charge = await pproRequest('/v1/payment-agreements', 'POST', paymentData, idempKey);
            
            requestUrl = charge.authenticationMethods[0].details.requestUrl;
            console.log('ideal recurring request URL: ', requestUrl);
            
        } else {        
            // Create charge via PPRO API
            charge = await pproRequest('/v1/payment-charges', 'POST', paymentData, idempKey);

            if (method === 'bancontact') {
                requestUrl = charge.authenticationMethods.at(-1).details.requestUrl;
            } else if (method === 'bancontactQR') {
                qrCode = charge.authenticationMethods[1].details.codePayload;
                console.log('qrcode payload:', qrCode);
            } else {
                requestUrl = charge.authenticationMethods[0].details.requestUrl;
            }

            console.log('LPM recurring request URL: ', requestUrl);
        }
        
        console.log('Creating payment response :', charge);
        
        const result = {
            success: true,
            chargeId: recurring && method === 'ideal' ? charge.initialPaymentChargeId : charge.id,
            orderId: orderId,
            redirectUrl: charge.redirectUrl || charge.redirect_url || `${PPRO_CONFIG.returnUrl}?orderId=${orderId}&status=${charge.status}&chargeId=${charge.id}`,
            status: charge.status,
            merchantId: PPRO_CONFIG.merchantId,
            method: pproMethod,
            requestUrl,
            qrCode,
        };
        
        // Store for idempotency
        if (idempKey) {
            storeIdempotency(idempKey, result);
        }
        
        // Store recurring token if applicable
        if (recurring) {
            recurringTokenStore.set(charge.instrumentId, {
                token: charge.id,
                method: method,
                currency: currency,
            });
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({ 
            error: error.message || 'Failed to create payment',
            details: error.toString()
        });
    }
});

/**
 * Get Payment Status
 */
app.get('/api/payments/status/:chargeId', async (req, res) => {
    try {
        const { chargeId } = req.params;
        
        console.log('Fetching status for charge:', chargeId);
        
        // Get charge details from PPRO
        const charge = await pproRequest(`/v1/payment-charges/${chargeId}`, 'GET');

        console.log('Fetching status for charge:', JSON.stringify(charge));
        
        res.json({
            success: true,
            chargeId: charge.id || charge.chargeId,
            status: charge.status,
            orderId: charge.orderId || charge.order_id || charge.instrumentId,
            amount: charge.amount,
            currency: charge.currency,
            redirectUrl: charge.redirectUrl || charge.redirect_url || `${PPRO_CONFIG.returnUrl}?orderId=${charge.instrumentId}&status=${charge.status}`,
            paymentMethod: charge.paymentMethod || charge.payment_method,
            recurringToken: charge.recurringToken
        });
        
    } catch (error) {
        console.error('Status fetch error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Payment Return URL Handler
 */
app.get('/payment-return', (req, res) => {
    const { orderId, status, chargeId } = req.query;
    
    console.log('Payment return:', { orderId, status, chargeId });
    
    // Serve the payment return HTML page
    res.sendFile(path.join(__dirname, 'paymentReturn.html'));
});

/**
 * Health Check
 */
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        ppro: {
            merchantId: PPRO_CONFIG.merchantId,
            baseUrl: PPRO_CONFIG.baseUrl
        }
    });
});

/**
 * API Documentation
 */
app.get('/api', (req, res) => {
    res.json({
        name: 'PPRO Payment Gateway',
        version: '1.0.0',
        endpoints: {
            'POST /api/payments/create': 'Create payment charge',
            'GET /api/payments/status/:chargeId': 'Get payment status',
            'GET /health': 'Health check'
        },
        supportedMethods: ['BLIK', 'IDEAL', 'BANCONTACT'],
        features: [
            'Multiple authentication flows',
            'Idempotency support',
            'Mobile responsive',
            'Webhook integration'
        ]
    });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          🚀 PPRO Payment Gateway Server                     ║
║                                                              ║
║          Server running on: http://localhost:${PORT}        ║
║          Frontend: http://localhost:${PORT}                 ║
║          API Docs: http://localhost:${PORT}/api             ║
║          Health: http://localhost:${PORT}/health            ║
║                                                              ║
║          Merchant ID: ${PPRO_CONFIG.merchantId}    ║
║          Environment: Sandbox                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
