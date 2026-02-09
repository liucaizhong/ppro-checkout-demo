// Configuration
const CONFIG = {
  API_BASE_URL: "http://localhost:3000/api",
};

// State management
const state = {
  selectedMethod: null,
  selectedCurrency: "EUR",
  recurringEnabled: false,
};

const symbols = {
  EUR: "€",
  PLN: "zł",
};

// DOM Elements
const elements = {
  currencySelect: document.getElementById("currency"),
  paymentMethods: document.querySelectorAll('input[name="paymentMethod"]'),
  payButton: document.getElementById("payButton"),
  recurringOption: document.getElementById("recurringOption"),
  enableRecurring: document.getElementById("enableRecurring"),
  errorMessage: document.getElementById("errorMessage"),
  paymentStatus: document.getElementById("paymentStatus"),
  formSection: document.querySelector(".form-section"),
};

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  initializeEventListeners();
  updatePaymentMethodAvailability();
  initSessionStorage();
});

// Event Listeners
function initializeEventListeners() {
  // Currency change
  elements.currencySelect.addEventListener("change", (e) => {
    state.selectedCurrency = e.target.value;
    updatePaymentMethodAvailability();
    updatePayButton();
  });

  // Payment method selection
  elements.paymentMethods.forEach((input) => {
    input.addEventListener("change", (e) => {
      state.selectedMethod = e.target.value;
      updateRecurringOption();
      updatePayButton();
    });
  });

  // Recurring checkbox
  elements.enableRecurring.addEventListener("change", (e) => {
    state.recurringEnabled = e.target.checked;
  });

  // Pay button
  elements.payButton.addEventListener("click", handlePayment);
}

// Update payment method availability based on currency
function updatePaymentMethodAvailability() {
  const currency = state.selectedCurrency;

  document.querySelectorAll(".payment-method").forEach((method) => {
    const allowedCurrency = method.getAttribute("data-currency");
    const input = method.querySelector('input[type="radio"]');

    if (allowedCurrency && allowedCurrency !== currency) {
      method.style.opacity = "0.4";
      method.style.pointerEvents = "none";
      input.disabled = true;
      if (input.checked) {
        input.checked = false;
        state.selectedMethod = null;
      }
    } else {
      method.style.opacity = "1";
      method.style.pointerEvents = "auto";
      input.disabled = false;
    }
  });

  updatePayButton();
}

// Update recurring option visibility
function updateRecurringOption() {
  if (state.selectedMethod === "ideal") {
    elements.recurringOption.style.display = "block";
    // Animate in
    setTimeout(() => {
      elements.recurringOption.style.animation = "slideUp 0.3s ease";
    }, 10);
  } else {
    elements.recurringOption.style.display = "none";
    state.recurringEnabled = false;
    elements.enableRecurring.checked = false;
  }
}

// Update pay button state
function updatePayButton() {
  if (state.selectedMethod) {
    elements.payButton.disabled = false;
    const amount = "€119.79";
    elements.payButton.querySelector(".button-text").textContent =
      `Pay ${amount}`;
  } else {
    elements.payButton.disabled = true;
    elements.payButton.querySelector(".button-text").textContent =
      "Select a payment method";
  }
}

// Handle payment
async function handlePayment() {
  hideError();
  hideStatus();

  if (!state.selectedMethod) {
    showError("Please select a payment method");
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
      idempotencyKey: generateIdempotencyKey(),
    };

    console.log("Initiating payment:", paymentData);

    await handleRedirectFlow(paymentData);
  } catch (error) {
    console.error("Payment error:", error);
    showError(error.message || "Payment failed. Please try again.");
    setButtonLoading(false);
  }
}

// Redirect Flow
async function handleRedirectFlow(paymentData) {
  try {
    const response = await fetch(`${CONFIG.API_BASE_URL}/payments/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": paymentData.idempotencyKey,
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();

    console.log("handleRedirectFlow response:", JSON.stringify(data));

    if (!data.success) {
      throw new Error(data.error || "Failed to create payment");
    }

    // Store charge ID in session for status check after redirect
    sessionStorage.setItem("pendingChargeId", data.chargeId);
    console.log("pendingChargeId:", data.chargeId);

    if (data.qrCode) {
      console.log("qrcode payload:", data.qrCode);
      // Redirect to QR code page for BLIK and similar methods
      showStatus(`Generating ${data.method} QR code...`, "pending");

      const qrPageUrl = new URL("/qr-payment", window.location.origin);
      qrPageUrl.searchParams.set("orderId", data.orderId);
      qrPageUrl.searchParams.set("chargeId", data.chargeId);
      qrPageUrl.searchParams.set("paymentMethod", data.method);
      qrPageUrl.searchParams.set("amount", data.amount);
      qrPageUrl.searchParams.set("currency", data.currency);

      // Add QR data if provided by API, otherwise generate BEP format on QR page
      qrPageUrl.searchParams.set("qrData", data.qrCode);

      setTimeout(() => {
        window.location.href = qrPageUrl.toString();
      }, 1000);
    } else if (data.redirectUrl) {
      showStatus(`Redirecting to ${data.method}...`, "pending");
      setTimeout(() => {
        window.location.href = data.redirectUrl;
      }, 1000);
    } else {
      throw new Error("No redirect URL received");
    }
  } catch (error) {
    throw error;
  }
}

// Initiate Session Store
function initSessionStorage() {
  const pendingChargeId = sessionStorage.getItem("pendingChargeId");
  if (pendingChargeId) sessionStorage.removeItem("pendingChargeId");
  console.log("remove pending chargeId");
}

// Utility Functions

function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function setButtonLoading(loading) {
  const button = elements.payButton;
  const text = button.querySelector(".button-text");
  const loader = button.querySelector(".button-loader");

  if (loading) {
    button.disabled = true;
    text.style.display = "none";
    loader.style.display = "inline-block";
  } else {
    button.disabled = false;
    text.style.display = "inline-flex";
    loader.style.display = "none";
  }
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.style.display = "block";
  elements.errorMessage.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function hideError() {
  elements.errorMessage.style.display = "none";
}

function showStatus(message, type = "pending") {
  elements.paymentStatus.textContent = message;
  elements.paymentStatus.className = `payment-status ${type}`;
  elements.paymentStatus.style.display = "block";
  elements.paymentStatus.scrollIntoView({
    behavior: "smooth",
    block: "nearest",
  });
}

function hideStatus() {
  elements.paymentStatus.style.display = "none";
}
