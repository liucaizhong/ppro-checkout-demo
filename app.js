// Configuration
const CONFIG = {
    API_BASE_URL: 'http://localhost:3000/api',
    PPRO_DROPIN_SCRIPT: 'https://checkout.ppro.com/js/checkout.js'
};

// State management
const state = {
    selectedMethod: null,
    selectedCurrency: 'EUR',
    recurringEnabled: false,
    currentChargeId: null,
    dropinInstance: null
};

// DOM Elements
const elements = {
    currencySelect: document.getElementById('currency'),
    paymentMethods: document.querySelectorAll('input[name="paymentMethod"]'),
    payButton: document.getElementById('payButton'),
    recurringOption: document.getElementById('recurringOption'),
    enableRecurring: document.getElementById('enableRecurring'),
    errorMessage: document.getElementById('errorMessage'),
    paymentStatus: document.getElementById('paymentStatus'),
    dropinContainer: document.getElementById('dropinContainer'),
    formSection: document.querySelector('.form-section'),
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    updatePaymentMethodAvailability();
    checkPaymentStatus();
});

// Event Listeners
function initializeEventListeners() {
    // Currency change
    elements.currencySelect.addEventListener('change', (e) => {
        state.selectedCurrency = e.target.value;
        updatePaymentMethodAvailability();
        updatePayButton();
    });

    // Payment method selection
    elements.paymentMethods.forEach(input => {
        input.addEventListener('change', (e) => {
            state.selectedMethod = e.target.value;
            updateRecurringOption();
            updatePayButton();
        });
    });

    // Recurring checkbox
    elements.enableRecurring.addEventListener('change', (e) => {
        state.recurringEnabled = e.target.checked;
    });

    // Pay button
    elements.payButton.addEventListener('click', handlePayment);

}

// Update payment method availability based on currency
function updatePaymentMethodAvailability() {
    const currency = state.selectedCurrency;
    
    document.querySelectorAll('.payment-method').forEach(method => {
        const allowedCurrency = method.getAttribute('data-currency');
        const input = method.querySelector('input[type="radio"]');
        
        if (allowedCurrency && allowedCurrency !== currency) {
            method.style.opacity = '0.4';
            method.style.pointerEvents = 'none';
            input.disabled = true;
            if (input.checked) {
                input.checked = false;
                state.selectedMethod = null;
            }
        } else {
            method.style.opacity = '1';
            method.style.pointerEvents = 'auto';
            input.disabled = false;
        }
    });
    
    updatePayButton();
}

// Update recurring option visibility
function updateRecurringOption() {
    if (state.selectedMethod === 'ideal') {
        elements.recurringOption.style.display = 'block';
        // Animate in
        setTimeout(() => {
            elements.recurringOption.style.animation = 'slideUp 0.3s ease';
        }, 10);
    } else {
        elements.recurringOption.style.display = 'none';
        state.recurringEnabled = false;
        elements.enableRecurring.checked = false;
    }
}

// Update pay button state
function updatePayButton() {
    if (state.selectedMethod) {
        elements.payButton.disabled = false;
        const amount = '€119.79';
        elements.payButton.querySelector('.button-text').textContent = `Pay ${amount}`;
    } else {
        elements.payButton.disabled = true;
        elements.payButton.querySelector('.button-text').textContent = 'Select a payment method';
    }
}

// Handle payment
async function handlePayment() {
    hideError();
    hideStatus();
    
    if (!state.selectedMethod) {
        showError('Please select a payment method');
        return;
    }
    
    setButtonLoading(true);
    
    try {
        const paymentData = {
            method: state.selectedMethod,
            currency: state.selectedCurrency,
            amount: 11979, // €119.79 in cents
            recurring: state.recurringEnabled,
            // Generate idempotency key for this transaction
            idempotencyKey: generateIdempotencyKey()
        };
        
        console.log('Initiating payment:', paymentData);
        
        await handleRedirectFlow(paymentData);
        
    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Payment failed. Please try again.');
        setButtonLoading(false);
    }
}

// Redirect Flow
async function handleRedirectFlow(paymentData) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/payments/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Idempotency-Key': paymentData.idempotencyKey
            },
            body: JSON.stringify(paymentData)
        });
        
        const data = await response.json();

        console.log('response', JSON.stringify(data));
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to create payment');
        }
        
        state.currentChargeId = data.chargeId;
        
        // Store charge ID in session for status check after redirect
        sessionStorage.setItem('pendingChargeId', data.chargeId);
        sessionStorage.setItem('idempotencyKey', paymentData.idempotencyKey);
        
        if (data.requestUrl) {
            showStatus(`Redirecting to ${data.method}...`, 'pending');
            setTimeout(() => {
                window.location.href = data.requestUrl;
            }, 1000);
        }// Redirect to payment page
        else if (data.redirectUrl) {
            showStatus('Redirecting to payment page...', 'pending');
           // Replace {{chargeId}} placeholder if present in redirect URL
            let finalRedirectUrl = data.redirectUrl;
            if (finalRedirectUrl.includes('{{chargeId}}')) {
                finalRedirectUrl = finalRedirectUrl.replace('{{chargeId}}', data.chargeId);
            }
            setTimeout(() => {
                window.location.href = finalRedirectUrl;
            }, 1000);
        } else {
            throw new Error('No redirect URL received');
        }
        
    } catch (error) {
        throw error;
    }
}

// Check payment status on page load (after redirect)
async function checkPaymentStatus() {
    const chargeId = sessionStorage.getItem('pendingChargeId');
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    
    if (chargeId && status) {
        console.log('Checking payment status for charge:', chargeId);
        
        showStatus('Verifying payment...', 'pending');
        
        try {
            await checkPaymentStatusById(chargeId);
            
            // Clear session storage
            sessionStorage.removeItem('pendingChargeId');
            sessionStorage.removeItem('idempotencyKey');
            
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
        } catch (error) {
            console.error('Status check error:', error);
            showError('Failed to verify payment status');
        }
    }
}

// Check payment status by ID
async function checkPaymentStatusById(chargeId) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/payments/status/${chargeId}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to get payment status');
        }
        
        console.log('Payment status:', data);
        
        // Display status
        switch (data.status.toLowerCase()) {
            case 'successful':
            case 'success':
                showStatus('✓ Payment successful! Thank you for your purchase.', 'success');
                break;
            case 'pending':
            case 'processing':
                showStatus('⏳ Payment is being processed...', 'pending');
                setTimeout(() => checkPaymentStatusById(chargeId), 2000);
                break;
            case 'failed':
            case 'error':
                showStatus('✗ Payment failed. Please try again.', 'failed');
                break;
            default:
                showStatus(`Payment status: ${data.status}`, 'pending');
        }
        
    } catch (error) {
        console.error('Error checking status:', error);
        throw error;
    }
}

// Utility Functions

function generateIdempotencyKey() {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function setButtonLoading(loading) {
    const button = elements.payButton;
    const text = button.querySelector('.button-text');
    const loader = button.querySelector('.button-loader');
    
    if (loading) {
        button.disabled = true;
        text.style.display = 'none';
        loader.style.display = 'inline-block';
    } else {
        button.disabled = false;
        text.style.display = 'inline-flex';
        loader.style.display = 'none';
    }
}

function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = 'block';
    elements.errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideError() {
    elements.errorMessage.style.display = 'none';
}

function showStatus(message, type = 'pending') {
    elements.paymentStatus.textContent = message;
    elements.paymentStatus.className = `payment-status ${type}`;
    elements.paymentStatus.style.display = 'block';
    elements.paymentStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideStatus() {
    elements.paymentStatus.style.display = 'none';
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handlePayment, checkPaymentStatus };
}
