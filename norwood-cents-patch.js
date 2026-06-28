/**
 * norwood-cents-patch.js
 * Norwood Supply — Decimal Price Fix
 * Add this AFTER norwood-patch.js in index.html:
 *   <script src="norwood-cents-patch.js"></script>
 *
 * What it does:
 *  1. Sets all price/unit-price inputs to accept decimals (step="0.01")
 *  2. Fixes any parseInt() rounding on price fields → parseFloat()
 *  3. Ensures all currency displays use 2 decimal places
 *  4. Re-hooks line total and invoice total calculations
 *  5. Watches for dynamically added rows (MutationObserver) so new
 *     line items added after load are also fixed automatically.
 */

(function () {
  'use strict';

  /* ─── 1. UTILITY ─────────────────────────────────────────────── */

  /** Format a number as currency string: "9.59" */
  function toCurrency(val) {
    var n = parseFloat(val);
    if (isNaN(n)) return '0.00';
    return n.toFixed(2);
  }

  /** Parse a price string safely — always returns a float */
  function parsePrice(val) {
    if (val === null || val === undefined) return 0;
    // Strip dollar signs, commas, spaces
    var cleaned = String(val).replace(/[$,\s]/g, '');
    var result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
  }

  /* ─── 2. FIX PRICE INPUT FIELDS ──────────────────────────────── */

  /**
   * Finds every input that looks like a price or unit price field
   * and ensures it allows decimals.
   */
  function fixPriceInputs() {
    // Common selectors used in the Norwood tool for price fields
    var selectors = [
      'input[name*="price"]',
      'input[name*="Price"]',
      'input[name*="unit"]',
      'input[name*="Unit"]',
      'input[name*="cost"]',
      'input[name*="Cost"]',
      'input[id*="price"]',
      'input[id*="Price"]',
      'input[id*="unit"]',
      'input[id*="Unit"]',
      'input.price',
      'input.unit-price',
      'input.unitPrice',
      'input.item-price',
      'td input[type="number"]'   // catch-all for table row number inputs
    ];

    var found = document.querySelectorAll(selectors.join(','));
    found.forEach(function (input) {
      // Allow decimals
      input.setAttribute('step', '0.01');
      // Remove any integer-only pattern
      if (input.getAttribute('pattern') === '\\d*' ||
          input.getAttribute('pattern') === '[0-9]*') {
        input.removeAttribute('pattern');
      }
      // If inputmode is set to numeric without decimals, fix it
      input.setAttribute('inputmode', 'decimal');
    });

    return found.length;
  }

  /* ─── 3. RECALCULATE LINE TOTALS ─────────────────────────────── */

  /**
   * Recalculates a single table row's extended total.
   * Looks for qty × price and writes result to the total cell/input.
   */
  function recalcRow(row) {
    // Try various naming conventions used across Norwood tool versions
    var qtyEl   = row.querySelector('[name*="qty"],[name*="Qty"],[name*="quantity"],[id*="qty"],[class*="qty"]');
    var priceEl = row.querySelector('[name*="price"],[name*="Price"],[name*="unit"],[id*="price"],[class*="price"]');
    var totalEl = row.querySelector('[name*="total"],[name*="Total"],[id*="total"],[class*="total"],[class*="line-total"],[class*="lineTotal"],[class*="ext"]');

    if (!qtyEl || !priceEl) return;

    var qty   = parseFloat(qtyEl.value) || 0;
    var price = parsePrice(priceEl.value);
    var total = qty * price;

    if (totalEl) {
      if (totalEl.tagName === 'INPUT') {
        totalEl.value = toCurrency(total);
      } else {
        totalEl.textContent = '$' + toCurrency(total);
      }
    }
  }

  /** Walk all rows in all invoice/quote tables and recalculate */
  function recalcAllRows() {
    var tables = document.querySelectorAll('table');
    tables.forEach(function (table) {
      var rows = table.querySelectorAll('tr');
      rows.forEach(function (row) {
        recalcRow(row);
      });
    });
  }

  /* ─── 4. FIX GRAND TOTAL / SUBTOTAL DISPLAY ──────────────────── */

  /**
   * Finds total / subtotal display elements and re-formats them
   * to always show two decimal places.
   */
  function fixTotalDisplays() {
    var totalSelectors = [
      '[id*="subtotal"],[id*="Subtotal"]',
      '[id*="grandtotal"],[id*="grandTotal"],[id*="GrandTotal"]',
      '[id*="total"],[id*="Total"]',
      '[class*="subtotal"],[class*="Subtotal"]',
      '[class*="grand-total"],[class*="grandTotal"]',
      '[class*="invoice-total"],[class*="invoiceTotal"]'
    ];

    document.querySelectorAll(totalSelectors.join(',')).forEach(function (el) {
      var raw = el.tagName === 'INPUT' ? el.value : el.textContent;
      var num = parsePrice(raw);
      if (num !== 0) {
        var formatted = '$' + toCurrency(num);
        if (el.tagName === 'INPUT') {
          el.value = toCurrency(num);
        } else {
          // Only rewrite if it looks like a plain number (no other text)
          if (/^\$?[\d,]+(\.\d{0,2})?$/.test(raw.trim())) {
            el.textContent = formatted;
          }
        }
      }
    });
  }

  /* ─── 5. INTERCEPT GLOBAL CALCULATION FUNCTIONS ──────────────── */

  /**
   * The Norwood tool likely has functions like calculateTotal(),
   * updateLineTotal(), recalc() etc. We wrap the window-level ones
   * to ensure toFixed(2) is applied after they run.
   */
  var calcFunctionNames = [
    'calculateTotal',
    'calcTotal',
    'updateTotal',
    'recalc',
    'recalculate',
    'updateLineTotal',
    'calcLineTotal',
    'computeTotal',
    'refreshTotals',
    'updateInvoice'
  ];

  calcFunctionNames.forEach(function (fnName) {
    if (typeof window[fnName] === 'function') {
      var original = window[fnName];
      window[fnName] = function () {
        var result = original.apply(this, arguments);
        // After original runs, clean up any ragged decimal displays
        fixTotalDisplays();
        return result;
      };
      console.log('[cents-patch] Wrapped ' + fnName + '()');
    }
  });

  /* ─── 6. EVENT DELEGATION — catch price changes in real time ─── */

  document.addEventListener('input', function (e) {
    var el = e.target;
    // If a price or qty field changed, recalc its row
    if (el.tagName === 'INPUT' &&
        (/price|Price|unit|Unit|qty|Qty|quantity/i.test(el.name || '') ||
         /price|unit|qty/i.test(el.className || '') ||
         /price|unit|qty/i.test(el.id || ''))) {
      var row = el.closest('tr');
      if (row) recalcRow(row);
      // Small delay then fix totals
      setTimeout(fixTotalDisplays, 50);
    }
  }, true);

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName === 'INPUT') {
      var row = el.closest('tr');
      if (row) recalcRow(row);
      setTimeout(fixTotalDisplays, 50);
    }
  }, true);

  /* ─── 7. MUTATIONOBSERVER — handle dynamically added rows ─────── */

  var observer = new MutationObserver(function (mutations) {
    var needsFix = false;
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) { // Element node
          needsFix = true;
        }
      });
    });
    if (needsFix) {
      fixPriceInputs();
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /* ─── 8. INIT — run once DOM is ready ────────────────────────── */

  function init() {
    var inputsFixed = fixPriceInputs();
    recalcAllRows();
    fixTotalDisplays();
    console.log('[cents-patch] Loaded. Fixed ' + inputsFixed + ' price input(s). Decimals enabled.');
  }

  // Run immediately if DOM is already ready, otherwise wait
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
