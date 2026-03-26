/* =====================================================
   SmartShop – app.js
   Main application logic – API, rendering, filters
   ===================================================== */

'use strict';

/* ── Constants ──────────────────────────────────────── */
const API_BASE   = 'https://dummyjson.com';
const PAGE_SIZE  = 20;

/* ── State ──────────────────────────────────────────── */
let allProducts   = [];     // all products fetched from API
let filtered      = [];     // after client-side filter/search
let categories    = [];     // list of category names
let currentPage   = 1;
let totalProducts = 0;
let isListView    = false;
let searchTimer   = null;

const filters = {
  category: null,
  minPrice: 0,
  maxPrice: 2000,
  minRating: 0,
  inStock: false,
  search: '',
  sort: 'default'
};

/* ── DOM Refs ────────────────────────────────────────── */
const productGrid   = () => document.getElementById('productGrid');
const resultsCount  = () => document.getElementById('resultsCount');
const emptyState    = () => document.getElementById('emptyState');
const pagination    = () => document.getElementById('pagination');
const categoryList  = () => document.getElementById('categoryList');
const activeFilters = () => document.getElementById('activeFilters');
const heroBanner    = () => document.getElementById('heroBanner');
const heroStats     = () => document.getElementById('heroStats');

/* =====================================================
   API FUNCTIONS
   ===================================================== */
async function fetchAllProducts() {
  try {
    const res  = await fetch(`${API_BASE}/products?limit=0`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.products || [];
  } catch (err) {
    showToast('Failed to load products. Please refresh.', 'error');
    return [];
  }
}

async function fetchCategories() {
  try {
    const res  = await fetch(`${API_BASE}/products/categories`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return [];
  }
}

/* =====================================================
   INITIALISATION
   ===================================================== */
async function init() {
  Cart.init();
  setupEventListeners();
  bindSidebarToggles();
  bindSortSelect();
  bindPriceRanges();
  bindRatingStars();
  bindInStockCheckbox();

  // Fetch data in parallel
  const [products, cats] = await Promise.all([fetchAllProducts(), fetchCategories()]);

  allProducts   = products;
  totalProducts = products.length;
  categories    = cats;

  renderHeroStats();
  renderCategoryList();
  applyFiltersAndRender();
}

/* =====================================================
   RENDER HERO STATS
   ===================================================== */
function renderHeroStats() {
  const cats    = new Set(allProducts.map(p => p.category)).size;
  const brands  = new Set(allProducts.map(p => p.brand).filter(Boolean)).size;
  const avgDisc = (allProducts.reduce((s, p) => s + (p.discountPercentage || 0), 0) / allProducts.length).toFixed(0);

  heroStats().innerHTML = `
    <div class="hero-stat">
      <span class="stat-val">${totalProducts}+</span>
      <span class="stat-label">Products</span>
    </div>
    <div class="hero-stat">
      <span class="stat-val">${cats}</span>
      <span class="stat-label">Categories</span>
    </div>
    <div class="hero-stat">
      <span class="stat-val">${brands}</span>
      <span class="stat-label">Brands</span>
    </div>
    <div class="hero-stat">
      <span class="stat-val">~${avgDisc}%</span>
      <span class="stat-label">Avg Discount</span>
    </div>
  `;
}

/* =====================================================
   RENDER CATEGORIES
   ===================================================== */
function renderCategoryList() {
  const list = categoryList();
  if (!list) return;

  // Count per category
  const counts = {};
  allProducts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });

  const all = document.createElement('div');
  all.className = 'category-item active';
  all.dataset.cat = '';
  all.innerHTML = `<span>All Products</span><span class="cat-count">${totalProducts}</span>`;
  all.addEventListener('click', () => selectCategory(''));
  list.appendChild(all);

  // Support both array of strings and array of objects
  const catNames = categories.map(c => (typeof c === 'string' ? c : c.name || c.slug || c));

  catNames.forEach(cat => {
    const el = document.createElement('div');
    el.className = 'category-item';
    el.dataset.cat = cat;
    const label = cat.replace(/-/g, ' ');
    el.innerHTML = `<span>${label}</span><span class="cat-count">${counts[cat] || 0}</span>`;
    el.addEventListener('click', () => selectCategory(cat));
    list.appendChild(el);
  });
}

function selectCategory(cat) {
  filters.category = cat || null;
  currentPage = 1;
  // Update active state
  document.querySelectorAll('.category-item').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === (cat || ''));
  });
  applyFiltersAndRender();
}

/* =====================================================
   FILTERS & SORTING
   ===================================================== */
function applyFiltersAndRender() {
  let result = [...allProducts];

  // Category
  if (filters.category) {
    result = result.filter(p => p.category === filters.category);
  }

  // Search
  if (filters.search.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(p =>
      p.title.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // Price
  result = result.filter(p => p.price >= filters.minPrice && p.price <= filters.maxPrice);

  // Rating
  if (filters.minRating > 0) {
    result = result.filter(p => (p.rating || 0) >= filters.minRating);
  }

  // In-stock
  if (filters.inStock) {
    result = result.filter(p => p.availabilityStatus === 'In Stock' || (p.stock && p.stock > 0));
  }

  // Sort
  switch (filters.sort) {
    case 'price-asc':     result.sort((a, b) => a.price - b.price); break;
    case 'price-desc':    result.sort((a, b) => b.price - a.price); break;
    case 'rating-desc':   result.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case 'discount-desc': result.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0)); break;
    case 'name-asc':      result.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'name-desc':     result.sort((a, b) => b.title.localeCompare(a.title)); break;
    default: break; // featured: keep original order
  }

  filtered = result;
  renderResultsCount();
  renderActiveFilters();
  renderProducts();
  renderPagination();
}

function renderResultsCount() {
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, filtered.length);
  const rc    = resultsCount();
  if (filtered.length === 0) {
    rc.textContent = 'No products found';
  } else {
    rc.textContent = `Showing ${start}–${end} of ${filtered.length} products`;
  }
}

function renderActiveFilters() {
  const el = activeFilters();
  if (!el) return;
  el.innerHTML = '';
  const tags = [];

  if (filters.category) {
    tags.push({ label: filters.category.replace(/-/g, ' '), key: 'category' });
  }
  if (filters.search) {
    tags.push({ label: `"${filters.search}"`, key: 'search' });
  }
  if (filters.minPrice > 0 || filters.maxPrice < 2000) {
    tags.push({ label: `$${filters.minPrice} – $${filters.maxPrice}`, key: 'price' });
  }
  if (filters.minRating > 0) {
    tags.push({ label: `${filters.minRating}★+`, key: 'rating' });
  }
  if (filters.inStock) {
    tags.push({ label: 'In Stock', key: 'inStock' });
  }

  tags.forEach(tag => {
    const span = document.createElement('span');
    span.className = 'filter-tag';
    span.innerHTML = `${tag.label} <button onclick="removeFilter('${tag.key}')"><i class="fa-solid fa-xmark"></i></button>`;
    el.appendChild(span);
  });
}

window.removeFilter = function(key) {
  if (key === 'category') { filters.category = null; selectCategory(''); }
  else if (key === 'search') { filters.search = ''; document.getElementById('searchInput').value = ''; document.getElementById('searchClearBtn').classList.add('hidden'); }
  else if (key === 'price') { filters.minPrice = 0; filters.maxPrice = 2000; document.getElementById('minPrice').value = 0; document.getElementById('maxPrice').value = 2000; document.getElementById('minPriceDisplay').textContent = '0'; document.getElementById('maxPriceDisplay').textContent = '2000'; }
  else if (key === 'rating') { filters.minRating = 0; document.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('active', b.dataset.rating === '0')); }
  else if (key === 'inStock') { filters.inStock = false; document.getElementById('inStockOnly').checked = false; }
  currentPage = 1;
  applyFiltersAndRender();
};

window.resetFilters = function() {
  filters.category = null;
  filters.search   = '';
  filters.minPrice = 0;
  filters.maxPrice = 2000;
  filters.minRating = 0;
  filters.inStock  = false;
  filters.sort     = 'default';
  currentPage      = 1;

  document.getElementById('searchInput').value   = '';
  document.getElementById('searchClearBtn').classList.add('hidden');
  document.getElementById('minPrice').value      = 0;
  document.getElementById('maxPrice').value      = 2000;
  document.getElementById('minPriceDisplay').textContent = '0';
  document.getElementById('maxPriceDisplay').textContent = '2000';
  document.getElementById('inStockOnly').checked = false;
  document.getElementById('sortSelect').value    = 'default';
  document.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('active', b.dataset.rating === '0'));
  document.querySelectorAll('.category-item').forEach(el => el.classList.toggle('active', el.dataset.cat === ''));

  applyFiltersAndRender();
};

/* =====================================================
   RENDER PRODUCTS
   ===================================================== */
function renderProducts() {
  const grid = productGrid();
  const empty = emptyState();
  if (!grid) return;

  // Paginate
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  if (page.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    heroBanner().classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  heroBanner().classList.toggle('hidden', filters.search !== '' || filters.category !== null);
  grid.classList.toggle('list-view', isListView);
  grid.innerHTML = '';

  page.forEach((product, idx) => {
    const card = buildProductCard(product);
    card.style.animationDelay = `${idx * 0.03}s`;
    grid.appendChild(card);
  });
}

/* ── Build a product card ── */
function buildProductCard(p) {
  const discountedPrice = (p.price * (1 - (p.discountPercentage || 0) / 100)).toFixed(2);
  const saving = (p.price - discountedPrice).toFixed(2);
  const inStock = p.availabilityStatus === 'In Stock' || (p.stock && p.stock > 0);
  const wishlisted = Cart.isWishlisted(p.id);

  const card = document.createElement('div');
  card.className = 'product-card card-animate';
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', p.title);

  card.innerHTML = `
    <div class="product-image-wrap">
      <img src="${p.thumbnail}" alt="${escapeHtml(p.title)}" loading="lazy" />
      <div class="card-badges">
        ${p.discountPercentage ? `<span class="badge-pill badge-discount">-${Math.round(p.discountPercentage)}%</span>` : ''}
        ${!inStock ? `<span class="badge-pill badge-out">Out of Stock</span>` : ''}
      </div>
      <div class="card-actions">
        <button class="card-action-btn wishlist-btn ${wishlisted ? 'wishlisted' : ''}"
                data-id="${p.id}"
                title="${wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                onclick="event.stopPropagation(); handleWishlist(${p.id})">
          <i class="fa-${wishlisted ? 'solid' : 'regular'} fa-heart"></i>
        </button>
        <button class="card-action-btn" title="Quick View"
                onclick="event.stopPropagation(); openModal(${p.id})">
          <i class="fa-solid fa-eye"></i>
        </button>
      </div>
    </div>
    <div class="product-info">
      <span class="product-category">${p.category.replace(/-/g, ' ')}</span>
      <h3 class="product-title">${escapeHtml(p.title)}</h3>
      <span class="product-brand">${escapeHtml(p.brand || '')}</span>
      <div class="product-rating">
        <div class="stars">${renderStarsHTML(p.rating)}</div>
        <span class="rating-count">(${p.rating ? p.rating.toFixed(1) : 'N/A'})</span>
      </div>
      <div class="product-price-row">
        <span class="product-price">$${discountedPrice}</span>
        ${p.discountPercentage ? `<span class="product-original-price">$${p.price.toFixed(2)}</span>` : ''}
        ${saving > 0.01 ? `<span class="product-saving">Save $${saving}</span>` : ''}
      </div>
      <button class="btn-add-cart ${!inStock ? 'out-of-stock' : ''}"
              onclick="event.stopPropagation(); ${inStock ? `addToCart(${p.id})` : ''}"
              ${!inStock ? 'disabled' : ''}>
        <i class="fa-solid fa-cart-plus"></i>
        ${inStock ? 'Add to Cart' : 'Out of Stock'}
      </button>
    </div>
  `;

  // Click to open modal
  card.addEventListener('click', () => openModal(p.id));
  card.addEventListener('keydown', e => { if (e.key === 'Enter') openModal(p.id); });

  return card;
}

/* ── Stars HTML helper ── */
function renderStarsHTML(rating = 0) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i)       html += '<i class="fa-solid fa-star"></i>';
    else if (rating >= i - 0.5) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    else                   html += '<i class="fa-regular fa-star"></i>';
  }
  return html;
}

/* ── Escape HTML ── */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* =====================================================
   PAGINATION
   ===================================================== */
function renderPagination() {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  const el    = pagination();
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  let html = '';
  html += `<button class="page-btn" onclick="gotoPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-left"></i></button>`;

  const pages = getPageRange(currentPage, total);
  pages.forEach(p => {
    if (p === '...') html += `<span class="page-dots">…</span>`;
    else html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="gotoPage(${p})">${p}</button>`;
  });

  html += `<button class="page-btn" onclick="gotoPage(${currentPage + 1})" ${currentPage === total ? 'disabled' : ''}>
              <i class="fa-solid fa-chevron-right"></i></button>`;

  el.innerHTML = html;
}

function getPageRange(cur, total) {
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;
  for (let i = Math.max(2, cur - delta); i <= Math.min(total - 1, cur + delta); i++) range.push(i);
  if (cur - delta > 2) range.unshift('...');
  if (cur + delta < total - 1) range.push('...');
  range.unshift(1);
  if (total > 1) range.push(total);
  range.forEach(i => {
    if (l) {
      if (i === '...' && rangeWithDots[rangeWithDots.length - 1] !== '...') rangeWithDots.push('...');
      else if (i !== '...') rangeWithDots.push(i);
    } else rangeWithDots.push(i);
    if (i !== '...') l = i;
  });
  return rangeWithDots;
}

window.gotoPage = function(page) {
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (page < 1 || page > total) return;
  currentPage = page;
  renderProducts();
  renderPagination();
  renderResultsCount();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* =====================================================
   PRODUCT MODAL
   ===================================================== */
window.openModal = function(id) {
  const product = allProducts.find(p => p.id === id);
  if (!product) return;

  const overlay  = document.getElementById('productModal');
  const body     = document.getElementById('modalBody');
  const discPrice = (product.price * (1 - (product.discountPercentage || 0) / 100)).toFixed(2);
  const inStock   = product.availabilityStatus === 'In Stock' || (product.stock && product.stock > 0);
  const wishlisted = Cart.isWishlisted(id);
  const images    = (product.images && product.images.length) ? product.images : [product.thumbnail];

  let thumbsHTML = images.slice(0, 6).map((img, i) =>
    `<div class="modal-thumb ${i === 0 ? 'active' : ''}" data-img="${img}" onclick="switchImage(this, '${img}')">
       <img src="${img}" alt="Product image ${i + 1}" loading="lazy" />
     </div>`
  ).join('');

  let reviewsHTML = '';
  if (product.reviews && product.reviews.length) {
    reviewsHTML = `<div class="modal-reviews">
      <h4 class="reviews-title"><i class="fa-solid fa-comments"></i> Customer Reviews (${product.reviews.length})</h4>
      ${product.reviews.slice(0, 5).map(r => `
        <div class="review-item">
          <div class="review-header">
            <span class="reviewer-name">${escapeHtml(r.reviewerName)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="stars" style="font-size:.7rem">${renderStarsHTML(r.rating)}</div>
              <span class="review-date">${new Date(r.date).toLocaleDateString()}</span>
            </div>
          </div>
          <p class="review-comment">${escapeHtml(r.comment)}</p>
        </div>
      `).join('')}
    </div>`;
  }

  body.innerHTML = `
    <div class="modal-layout">
      <div class="modal-image-col">
        <div class="modal-image-main">
          <img id="modalMainImg" src="${images[0]}" alt="${escapeHtml(product.title)}" />
        </div>
        ${images.length > 1 ? `<div class="modal-thumbs">${thumbsHTML}</div>` : ''}
      </div>
      <div class="modal-info-col">
        <p class="modal-category">${product.category.replace(/-/g, ' ')}</p>
        <h2 class="modal-title" id="modalTitle">${escapeHtml(product.title)}</h2>
        <p class="modal-brand">by <strong>${escapeHtml(product.brand || 'N/A')}</strong> &nbsp;·&nbsp; SKU: ${escapeHtml(product.sku || 'N/A')}</p>
        <div class="modal-rating">
          <div class="stars">${renderStarsHTML(product.rating)}</div>
          <span style="font-size:.83rem;color:var(--text-secondary)">${product.rating ? product.rating.toFixed(1) : 'N/A'} / 5</span>
          ${product.reviews ? `<span style="font-size:.78rem;color:var(--text-muted)">(${product.reviews.length} reviews)</span>` : ''}
        </div>
        <div class="modal-price-row">
          <span class="modal-price">$${discPrice}</span>
          ${product.discountPercentage ? `<span class="modal-original">$${product.price.toFixed(2)}</span>` : ''}
          ${product.discountPercentage ? `<span class="modal-discount-badge">-${Math.round(product.discountPercentage)}% OFF</span>` : ''}
        </div>
        <p class="modal-description">${escapeHtml(product.description)}</p>
        <div class="modal-meta-grid">
          <div class="meta-item"><p class="meta-label">Availability</p><p class="meta-value" style="color:${inStock ? 'var(--success)' : 'var(--danger)'}">
            <i class="fa-solid fa-circle" style="font-size:.5rem;vertical-align:middle;margin-right:4px"></i>${product.availabilityStatus || (inStock ? 'In Stock' : 'Out of Stock')}
          </p></div>
          <div class="meta-item"><p class="meta-label">Stock</p><p class="meta-value">${product.stock} units</p></div>
          <div class="meta-item"><p class="meta-label">Shipping</p><p class="meta-value">${escapeHtml(product.shippingInformation || 'Standard')}</p></div>
          <div class="meta-item"><p class="meta-label">Return Policy</p><p class="meta-value">${escapeHtml(product.returnPolicy || 'N/A')}</p></div>
          <div class="meta-item"><p class="meta-label">Warranty</p><p class="meta-value">${escapeHtml(product.warrantyInformation || 'N/A')}</p></div>
          <div class="meta-item"><p class="meta-label">Min. Order</p><p class="meta-value">${product.minimumOrderQuantity || 1} unit(s)</p></div>
        </div>
        ${inStock ? `
        <div class="modal-qty-row">
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="changeModalQty(-1)"><i class="fa-solid fa-minus"></i></button>
            <input type="number" class="qty-val" id="modalQty" value="1" min="1" max="${product.stock || 99}" />
            <button class="qty-btn" onclick="changeModalQty(1)"><i class="fa-solid fa-plus"></i></button>
          </div>
          <button class="modal-add-cart" onclick="addToCartFromModal(${product.id})">
            <i class="fa-solid fa-cart-plus"></i> Add to Cart
          </button>
          <button class="modal-wishlist-btn ${wishlisted ? 'wishlisted' : ''}" id="modalWishBtn"
                  title="${wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}"
                  onclick="handleWishlistFromModal(${product.id})">
            <i class="fa-${wishlisted ? 'solid' : 'regular'} fa-heart"></i>
          </button>
        </div>` : `<p style="color:var(--danger);font-weight:700;padding:12px 0"><i class="fa-solid fa-ban"></i> Currently out of stock</p>`}
      </div>
    </div>
    ${reviewsHTML}
  `;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
};

window.switchImage = function(thumbEl, imgSrc) {
  document.getElementById('modalMainImg').src = imgSrc;
  document.querySelectorAll('.modal-thumb').forEach(t => t.classList.toggle('active', t === thumbEl));
};

window.changeModalQty = function(delta) {
  const input = document.getElementById('modalQty');
  if (!input) return;
  const newVal = Math.max(1, Math.min(parseInt(input.max) || 99, parseInt(input.value) + delta));
  input.value = newVal;
};

function closeModal() {
  document.getElementById('productModal').classList.add('hidden');
  document.body.style.overflow = '';
}

/* =====================================================
   CART ACTIONS
   ===================================================== */
window.addToCart = function(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  Cart.add(p, 1);
  showToast(`<i class="fa-solid fa-cart-plus"></i> "${p.title.slice(0, 30)}…" added to cart`, 'success');
};

window.addToCartFromModal = function(id) {
  const p   = allProducts.find(x => x.id === id);
  const qty = parseInt(document.getElementById('modalQty')?.value) || 1;
  if (!p) return;
  Cart.add(p, qty);
  showToast(`<i class="fa-solid fa-cart-plus"></i> ${qty}x "${p.title.slice(0, 25)}…" added to cart`, 'success');
};

/* ── Wishlist ── */
window.handleWishlist = function(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  const added = Cart.toggleWish(p);
  // Update all wishlist buttons for this product
  document.querySelectorAll(`.wishlist-btn[data-id="${id}"]`).forEach(btn => {
    btn.classList.toggle('wishlisted', added);
    btn.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-heart"></i>`;
    btn.title = added ? 'Remove from Wishlist' : 'Add to Wishlist';
  });
  showToast(
    added
      ? `<i class="fa-solid fa-heart"></i> Added to wishlist`
      : `<i class="fa-regular fa-heart"></i> Removed from wishlist`,
    added ? 'info' : 'warning'
  );
};

window.handleWishlistFromModal = function(id) {
  handleWishlist(id);
  const added = Cart.isWishlisted(id);
  const btn = document.getElementById('modalWishBtn');
  if (btn) {
    btn.classList.toggle('wishlisted', added);
    btn.innerHTML = `<i class="fa-${added ? 'solid' : 'regular'} fa-heart"></i>`;
  }
};

/* =====================================================
   CART SIDEBAR RENDER  (called by Cart module)
   ===================================================== */
window.renderCartSidebar = function() {
  const items    = Cart.getItems();
  const itemsEl  = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');
  if (!itemsEl || !footerEl) return;

  if (items.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty">
      <i class="fa-solid fa-cart-shopping"></i>
      <p>Your cart is empty</p>
    </div>`;
    footerEl.innerHTML = '';
    return;
  }

  itemsEl.innerHTML = items.map(item => {
    const total = (item.price * item.qty).toFixed(2);
    return `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-img">
        <img src="${item.thumbnail}" alt="${escapeHtml(item.title)}" loading="lazy" />
      </div>
      <div class="cart-item-info">
        <p class="cart-item-title">${escapeHtml(item.title)}</p>
        <p class="cart-item-price">$${total}</p>
        <div class="cart-item-controls">
          <div class="cart-qty-ctrl">
            <button class="cart-qty-btn" onclick="Cart.updateQty(${item.id}, ${item.qty - 1})">
              <i class="fa-solid fa-minus"></i>
            </button>
            <span class="cart-qty-val">${item.qty}</span>
            <button class="cart-qty-btn" onclick="Cart.updateQty(${item.id}, ${item.qty + 1})">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
          <button class="cart-remove-btn" onclick="Cart.remove(${item.id})" title="Remove">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  const subtotal = Cart.getSubtotal().toFixed(2);
  const shipping = Cart.getSubtotal() > 100 ? 0 : 9.99;
  const total    = (Cart.getSubtotal() + shipping).toFixed(2);

  footerEl.innerHTML = `
    <div class="cart-summary">
      <div class="cart-summary-row"><span>Subtotal (${Cart.getCount()} items)</span><span>$${subtotal}</span></div>
      <div class="cart-summary-row"><span>Shipping</span><span>${shipping === 0 ? '<span style="color:var(--success)">Free</span>' : `$${shipping}`}</span></div>
      <div class="cart-summary-row total"><span>Total</span><span>$${total}</span></div>
    </div>
    <button class="btn-checkout" onclick="handleCheckout()">
      <i class="fa-solid fa-lock"></i> Checkout · $${total}
    </button>
    <button class="btn-text" style="width:100%;text-align:center;margin-top:8px;font-size:.8rem;color:var(--text-muted)" onclick="Cart.clear()">
      Clear Cart
    </button>
  `;
};

window.handleCheckout = function() {
  showToast('<i class="fa-solid fa-check-circle"></i> Order placed successfully! (Demo)', 'success');
  Cart.clear();
  closeCartSidebar();
};

/* =====================================================
   WISHLIST SIDEBAR RENDER
   ===================================================== */
window.renderWishlistSidebar = function() {
  const items = Cart.getWishlist();
  const el    = document.getElementById('wishlistItems');
  if (!el) return;

  if (items.length === 0) {
    el.innerHTML = `<div class="cart-empty">
      <i class="fa-regular fa-heart"></i>
      <p>Your wishlist is empty</p>
    </div>`;
    return;
  }

  el.innerHTML = items.map(p => {
    const discPrice = (p.price * (1 - (p.discountPercentage || 0) / 100)).toFixed(2);
    return `
    <div class="cart-item">
      <div class="cart-item-img">
        <img src="${p.thumbnail}" alt="${escapeHtml(p.title)}" loading="lazy" />
      </div>
      <div class="cart-item-info">
        <p class="cart-item-title">${escapeHtml(p.title)}</p>
        <p class="cart-item-price">$${discPrice}</p>
        <div class="cart-item-controls">
          <button class="btn-add-cart" style="flex:1;height:30px;font-size:.75rem" onclick="addToCart(${p.id}); Cart.toggleWish(${JSON.stringify({id: p.id}).replace(/"/g, "'")})">
            <i class="fa-solid fa-cart-plus"></i> Add to Cart
          </button>
          <button class="cart-remove-btn" onclick="Cart.toggleWish(${JSON.stringify({id: p.id}).replace(/"/g, "'")})" title="Remove">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
};

/* =====================================================
   TOAST NOTIFICATIONS
   ===================================================== */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

/* =====================================================
   SIDEBAR CART / WISHLIST TOGGLES
   ===================================================== */
function openCartSidebar() {
  renderCartSidebar();
  document.getElementById('cartSidebar').classList.remove('hidden');
  document.getElementById('cartOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCartSidebar() {
  document.getElementById('cartSidebar').classList.add('hidden');
  document.getElementById('cartOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function openWishlistSidebar() {
  renderWishlistSidebar();
  document.getElementById('wishlistSidebar').classList.remove('hidden');
  document.getElementById('wishlistOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeWishlistSidebar() {
  document.getElementById('wishlistSidebar').classList.add('hidden');
  document.getElementById('wishlistOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}

/* =====================================================
   SIDEBAR FILTER TOGGLES
   ===================================================== */
function bindSidebarToggles() {
  // Collapsible filter sections
  document.querySelectorAll('.toggle-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.target);
      const isOpen = !target.classList.contains('hidden');
      target.classList.toggle('hidden', isOpen);
      btn.classList.toggle('open', !isOpen);
    });
  });
}

function openMobileSidebar() {
  document.getElementById('sidebar').classList.add('open');
  const overlay = document.getElementById('sidebarOverlay');
  overlay.classList.remove('hidden');
  overlay.classList.add('visible');
}

function closeMobileSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  const overlay = document.getElementById('sidebarOverlay');
  overlay.classList.add('hidden');
  overlay.classList.remove('visible');
}

function bindSortSelect() {
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    filters.sort = e.target.value;
    currentPage  = 1;
    applyFiltersAndRender();
  });
}

function bindPriceRanges() {
  const minInput = document.getElementById('minPrice');
  const maxInput = document.getElementById('maxPrice');
  const minDisp  = document.getElementById('minPriceDisplay');
  const maxDisp  = document.getElementById('maxPriceDisplay');

  const onRangeChange = () => {
    let min = parseInt(minInput.value);
    let max = parseInt(maxInput.value);
    if (min > max) { [min, max] = [max, min]; }
    minDisp.textContent = min;
    maxDisp.textContent = max;
    filters.minPrice = min;
    filters.maxPrice = max;
    currentPage = 1;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFiltersAndRender, 300);
  };

  minInput.addEventListener('input', onRangeChange);
  maxInput.addEventListener('input', onRangeChange);
}

function bindRatingStars() {
  document.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating = parseInt(btn.dataset.rating);
      filters.minRating = rating;
      currentPage = 1;
      document.querySelectorAll('.star-btn').forEach(b => b.classList.toggle('active', b === btn));
      applyFiltersAndRender();
    });
  });
}

function bindInStockCheckbox() {
  document.getElementById('inStockOnly').addEventListener('change', (e) => {
    filters.inStock = e.target.checked;
    currentPage = 1;
    applyFiltersAndRender();
  });
}

/* =====================================================
   SEARCH
   ===================================================== */
function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('searchInput');
  const clearBtn    = document.getElementById('searchClearBtn');

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value;
    clearBtn.classList.toggle('hidden', val.length === 0);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      filters.search = val;
      currentPage = 1;
      applyFiltersAndRender();
    }, 350);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value   = '';
    clearBtn.classList.add('hidden');
    filters.search = '';
    currentPage = 1;
    applyFiltersAndRender();
    searchInput.focus();
  });

  // Modal close
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('productModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModal(); closeCartSidebar(); closeWishlistSidebar(); }
  });

  // Cart sidebar
  document.getElementById('cartToggle').addEventListener('click', openCartSidebar);
  document.getElementById('cartClose').addEventListener('click', closeCartSidebar);
  document.getElementById('cartOverlay').addEventListener('click', closeCartSidebar);

  // Wishlist sidebar
  document.getElementById('wishlistToggle').addEventListener('click', openWishlistSidebar);
  document.getElementById('wishlistClose').addEventListener('click', closeWishlistSidebar);
  document.getElementById('wishlistOverlay').addEventListener('click', closeWishlistSidebar);

  // Mobile sidebar toggle
  document.getElementById('mobileMenuBtn').addEventListener('click', openMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // Clear filters
  document.getElementById('clearFiltersBtn').addEventListener('click', resetFilters);

  // View toggle
  document.getElementById('gridViewBtn').addEventListener('click', () => {
    isListView = false;
    document.getElementById('gridViewBtn').classList.add('active');
    document.getElementById('listViewBtn').classList.remove('active');
    renderProducts();
  });
  document.getElementById('listViewBtn').addEventListener('click', () => {
    isListView = true;
    document.getElementById('listViewBtn').classList.add('active');
    document.getElementById('gridViewBtn').classList.remove('active');
    renderProducts();
  });
}

/* =====================================================
   BOOT
   ===================================================== */
document.addEventListener('DOMContentLoaded', init);
