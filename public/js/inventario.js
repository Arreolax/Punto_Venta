let debounceTimer = null;

function getFiltersForm() {
  return document.getElementById('inventoryFilters');
}

function getSearchInput() {
  return document.getElementById('inventorySearch');
}

function getResultsContainer() {
  return document.getElementById('inventoryResults');
}

function getMovementsContainer() {
  return document.getElementById('inventoryMovementsSection');
}

function buildUrlFromForm(form) {
  const formData = new FormData(form);
  const params = new URLSearchParams(window.location.search);

  for (const [key, value] of formData.entries()) {
    if (value === '') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  if (form.id === 'inventoryFilters') {
    params.set('page', '1');
  }

  const url = new URL(form.action || window.location.href, window.location.origin);
  url.search = params.toString();
  return url.toString();
}

async function refreshInventory(url, replaceState = false) {
  const resultsContainer = getResultsContainer();
  const movementsContainer = getMovementsContainer();
  if (!resultsContainer && !movementsContainer) {
    window.location.assign(url);
    return;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    if (!response.ok) {
      throw new Error('No se pudo actualizar el inventario');
    }

    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const nextResults = nextDocument.getElementById('inventoryResults');
    const nextMovements = nextDocument.getElementById('inventoryMovementsSection');

    if (!nextResults && !nextMovements) {
      window.location.assign(url);
      return;
    }

    if (resultsContainer && nextResults) {
      resultsContainer.outerHTML = nextResults.outerHTML;
    }

    if (movementsContainer && nextMovements) {
      movementsContainer.outerHTML = nextMovements.outerHTML;
    }

    if (replaceState) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
  } catch (error) {
    window.location.assign(url);
  }
}

function submitFiltersDebounced() {
  const filtersForm = getFiltersForm();
  if (!filtersForm) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (typeof filtersForm.requestSubmit === 'function') {
      filtersForm.requestSubmit();
    } else {
      filtersForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }, 400);
}

document.addEventListener('submit', (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  const isInventoryFilters = form.id === 'inventoryFilters';
  const isMovementFilters = form.id === 'movementFilters';
  const isInventoryPagination = Boolean(form.closest('#inventoryResults'));
  const isMovementSection = Boolean(form.closest('#inventoryMovementsSection'));

  if (!isInventoryFilters && !isMovementFilters && !isInventoryPagination && !isMovementSection) return;

  event.preventDefault();
  const url = buildUrlFromForm(form);
  refreshInventory(url, isInventoryFilters);
}, true);

window.addEventListener('popstate', () => {
  refreshInventory(window.location.href, true);
});

// Event delegation for filter form inputs and selects
document.addEventListener('input', (event) => {
  const input = event.target;
  const filtersForm = getFiltersForm();
  if (!filtersForm || !filtersForm.contains(input)) return;
  if (input.id === 'inventorySearch') {
    submitFiltersDebounced();
  }
}, true);

document.addEventListener('search', (event) => {
  const input = event.target;
  const filtersForm = getFiltersForm();
  if (!filtersForm || !filtersForm.contains(input)) return;
  if (input.id === 'inventorySearch') {
    submitFiltersDebounced();
  }
}, true);

document.addEventListener('change', (event) => {
  const control = event.target;
  const filtersForm = getFiltersForm();
  if (!filtersForm || !filtersForm.contains(control)) return;
  
  // Skip if it's the search input (handled by debounce above)
  if (control.id === 'inventorySearch') return;
  
  // For selects and other controls, submit immediately
  if (typeof filtersForm.requestSubmit === 'function') {
    filtersForm.requestSubmit();
  } else {
    filtersForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }
}, true);
