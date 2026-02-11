const CONFIG = {
  API_BASE_URL: "http://localhost:3000/api",
};

const elements = {
  statusIcon: document.getElementById("statusIcon"),
  statusTitle: document.getElementById("statusTitle"),
  statusMessage: document.getElementById("statusMessage"),
  paymentDetails: document.getElementById("paymentDetails"),
  chargeId: document.getElementById("chargeId"),
  paymentMethod: document.getElementById("paymentMethod"),
  status: document.getElementById("status"),
  errorDetails: document.getElementById("errorDetails"),
  retryBtn: document.getElementById("retryBtn"),
  infoBox: document.getElementById("infoBox"),
};

// Parse URL parameters
function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    status: params.get("status"),
    chargeId:
      params.get("chargeId") || sessionStorage.getItem("pendingChargeId"),
    method: params.get("method"),
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

// Update UI based on payment status
function updateUI(statusData) {
  const {
    status,
    chargeId = sessionStorage.getItem("pendingChargeId"),
    paymentMethod,
    error,
  } = statusData;

  console.log("statusData:", status, paymentMethod);

  // Show payment details
  elements.paymentDetails.style.display = "block";
  elements.chargeId.textContent = chargeId || "-";
  elements.paymentMethod.textContent = paymentMethod || "-";
  elements.status.textContent = status || "-";

  // Update based on status
  const statusLower = (status || "").toLowerCase();

  if (statusLower.includes("success") || statusLower.includes("captured")) {
    // Success state
    elements.statusIcon.className = "status-icon success";
    elements.statusIcon.innerHTML = "✓";
    elements.statusTitle.textContent = "Payment Successful!";
    elements.statusMessage.textContent =
      "Your payment has been processed successfully.";
    elements.infoBox.style.display = "block";
  } else if (
    statusLower.includes("pending") ||
    statusLower.includes("processing")
  ) {
    // Pending state
    elements.statusIcon.className = "status-icon pending pulse";
    elements.statusIcon.innerHTML = "⏳";
    elements.statusTitle.textContent = "Payment Processing";
    elements.statusMessage.textContent =
      "Your payment is being processed. This may take a few moments.";
    elements.retryBtn.style.display = "inline-block";

    // Auto-retry after 5 seconds
    setTimeout(checkPaymentStatus, 5000);
  } else if (statusLower.includes("failed") || statusLower.includes("error")) {
    // Failed state
    elements.statusIcon.className = "status-icon failed";
    elements.statusIcon.innerHTML = "✗";
    elements.statusTitle.textContent = "Payment Failed";
    elements.statusMessage.textContent =
      "Unfortunately, your payment could not be processed.";

    if (error) {
      elements.errorDetails.textContent = error;
      elements.errorDetails.style.display = "block";
    }
  } else if (statusLower.includes("cancel")) {
    // Cancelled state
    elements.statusIcon.className = "status-icon failed";
    elements.statusIcon.innerHTML = "✗";
    elements.statusTitle.textContent = "Payment Cancelled";
    elements.statusMessage.textContent = "Your payment has been cancelled.";
  } else if (statusLower.includes("expired")) {
    // Cancelled state
    elements.statusIcon.className = "status-icon failed";
    elements.statusIcon.innerHTML = "✗";
    elements.statusTitle.textContent = "Payment Expired";
    elements.statusMessage.textContent = "Your payment has been expired.";
  } else {
    // Unknown status
    elements.statusIcon.className = "status-icon pending";
    elements.statusIcon.innerHTML = "?";
    elements.statusTitle.textContent = "Payment Status Unknown";
    elements.statusMessage.textContent =
      "We are unable to determine the payment status at this time.";
    elements.retryBtn.style.display = "inline-block";
  }
}

// Check payment status via API
async function checkPaymentStatus() {
  const params = getUrlParams();
  // Try to get charge ID from session storage if not in URL
  const chargeId = params.chargeId || sessionStorage.getItem("pendingChargeId");
  console.log("checkpaymentstatus", chargeId);

  if (!chargeId) {
    updateUI({
      status: params.status || "Unknown",
      error: "Unable to verify payment status - no charge ID available",
      paymentMethod: params.method,
    });
    return;
  }

  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/payments/status/${chargeId}`,
    );
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch payment status");
    }

    console.log("check status", data);
    updateUI({
      status: data.status,
      chargeId: data.chargeId,
      paymentMethod: data.method,
    });
  } catch (error) {
    console.error("Error checking payment status:", error);
    updateUI({
      status: "Error",
      error: error.message || "Failed to verify payment status",
      paymentMethod: params.method,
      chargeId,
    });
  }
}

// Retry button handler
elements.retryBtn.addEventListener("click", () => {
  elements.statusIcon.className = "status-icon loading";
  elements.statusIcon.innerHTML = '<div class="spinner"></div>';
  elements.statusTitle.textContent = "Checking Status...";
  elements.statusMessage.textContent = "Please wait...";
  elements.retryBtn.style.display = "none";

  setTimeout(checkPaymentStatus, 1000);
});

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  const params = getUrlParams();
  const chargeId = params.chargeId || sessionStorage.getItem("pendingChargeId");
  // Update based on status
  const statusLower = (params.status || "").toLowerCase();
  console.log("Payment return loaded status:", statusLower);
  // If status is explicitly cancelled, show immediately
  if (
    !statusLower ||
    statusLower.includes("pending") ||
    statusLower.includes("processing")
  ) {
    // Check status via API
    setTimeout(checkPaymentStatus, 1000);
  } else {
    updateUI({
      chargeId,
      status: params.status,
      paymentMethod: params.method,
    });
  }
});
