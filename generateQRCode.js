const CONFIG = {
  API_BASE_URL: "http://localhost:3000/api",
  POLLING_INTERVAL: 5000, // 5 seconds
  QR_EXPIRY_TIME: 300, // 5 minutes in seconds
};

const state = {
  orderId: null,
  chargeId: null,
  paymentMethod: null,
  amount: null,
  currency: null,
  qrData: null,
  pollingInterval: null,
  timerInterval: null,
  remainingTime: CONFIG.QR_EXPIRY_TIME,
};

const elements = {
  pageTitle: document.getElementById("pageTitle"),
  qrCode: document.getElementById("qrCode"),
  qrPlaceholder: document.getElementById("qrPlaceholder"),
  statusMessage: document.getElementById("statusMessage"),
  timer: document.getElementById("timer"),
  timerValue: document.getElementById("timerValue"),
  orderId: document.getElementById("orderId"),
  paymentMethod: document.getElementById("paymentMethod"),
  amount: document.getElementById("amount"),
  instructionsList: document.getElementById("instructionsList"),
  cancelBtn: document.getElementById("cancelBtn"),
  checkStatusBtn: document.getElementById("checkStatusBtn"),
};

// Parse URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get("orderId"),
    chargeId: params.get("chargeId"),
    qrData: params.get("qrData"),
    paymentMethod: params.get("paymentMethod"),
    amount: params.get("amount"),
    currency: params.get("currency"),
  };
}

// Format amount for display
function formatAmount(amount, currency) {
  const symbols = {
    EUR: "€",
    PLN: "zł",
  };
  const symbol = symbols[currency] || currency;
  const value = (amount / 100).toFixed(2);
  return `${symbol}${value}`;
}

// Generate QR Code using QRCode.js
function generateQRCode(data) {
  try {
    // Clear previous QR code
    elements.qrCode.innerHTML = "";

    // Create new QR code
    const qr = new QRCode(elements.qrCode, {
      text: data,
      width: 256,
      height: 256,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });

    // Show QR code, hide placeholder
    elements.qrPlaceholder.style.display = "none";
    elements.qrCode.style.display = "block";

    return true;
  } catch (error) {
    console.error("Error generating QR code:", error);
    showStatus("Failed to generate QR code", "error");
    return false;
  }
}

// Start countdown timer
function startTimer() {
  elements.timer.style.display = "block";

  state.timerInterval = setInterval(() => {
    state.remainingTime--;

    const minutes = Math.floor(state.remainingTime / 60);
    const seconds = state.remainingTime % 60;
    const timeString = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    elements.timerValue.textContent = timeString;

    if (state.remainingTime <= 0) {
      clearInterval(state.timerInterval);
      elements.timerValue.classList.add("expired");
      elements.timerValue.textContent = "EXPIRED";
      showStatus("QR code has expired. Please start a new payment.", "error");
      stopPolling();
      elements.checkStatusBtn.style.display = "none";
      elements.cancelBtn.textContent = "Return to Checkout";
    }
  }, 1000);
}

// Poll payment status
async function pollPaymentStatus() {
  if (!state.chargeId) return;

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/payments/status/${state.chargeId}`,
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch status");
    }

    const statusLower = (data.tatus || "").toLowerCase();

    if (statusLower.includes("success") || statusLower.includes("captured")) {
      stopPolling();
      showStatus("✓ Payment successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = `/payment-return?orderId=${state.orderId}&chargeId=${state.chargeId}&status=success&method=${state.paymentMethod}`;
      }, 2000);
    } else if (
      statusLower.includes("failed") ||
      statusLower.includes("error") ||
      statusLower.includes("cancel")
    ) {
      stopPolling();
      showStatus("✗ Payment failed. Please try again.", "error");
      elements.checkStatusBtn.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Error polling status:", error);
  }
}

// Start polling
function startPolling() {
  state.pollingInterval = setInterval(
    pollPaymentStatus,
    CONFIG.POLLING_INTERVAL,
  );
  showStatus("Waiting for payment confirmation...", "pending");
}

// Stop polling
function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// Show status message
function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.style.display = "block";
}

// Cancel payment handler
elements.cancelBtn.addEventListener("click", () => {
  stopPolling();
  console.log("state:", state);
  if (elements.cancelBtn.textContent === "Return to Checkout") {
    window.location.href = "/";
  } else {
    const confirmCancel = confirm(
      "Are you sure you want to cancel this payment?",
    );
    if (confirmCancel) {
      window.location.href = `/payment-return?orderId=${state.orderId}&status=cancelled&method=${state.paymentMethod}`;
    }
  }
});

// Check status manually
elements.checkStatusBtn.addEventListener("click", async () => {
  elements.checkStatusBtn.disabled = true;
  elements.checkStatusBtn.textContent = "Checking...";

  await pollPaymentStatus();

  setTimeout(() => {
    elements.checkStatusBtn.disabled = false;
    elements.checkStatusBtn.textContent = "Check Status";
  }, 2000);
});

// Initialize page
function initialize() {
  const params = getUrlParams();

  // Store state
  state.orderId = params.orderId;
  state.chargeId = params.chargeId;
  state.paymentMethod = params.paymentMethod;
  state.amount = params.amount;
  state.currency = params.currency;
  state.qrData = params.qrData;

  // Update UI
  elements.orderId.textContent = params.orderId || "-";
  elements.paymentMethod.textContent = params.paymentMethod || "-";
  elements.amount.textContent =
    params.amount && params.currency
      ? formatAmount(parseInt(params.amount), params.currency)
      : "-";

  // Update page title based on payment method
  if (params.paymentMethod) {
    elements.pageTitle.textContent = `${params.paymentMethod.toUpperCase()} Payment`;
  }

  // Generate QR code
  let qrData = params.qrData;

  if (qrData) {
    const success = generateQRCode(qrData);
    if (success) {
      startTimer();
      startPolling();
    }
  } else {
    showStatus("Invalid QR code data. Please try again.", "error");
    elements.qrPlaceholder.innerHTML = "<p>Unable to generate QR code</p>";
  }
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", initialize);

// Cleanup on page unload
window.addEventListener("beforeunload", stopPolling);
