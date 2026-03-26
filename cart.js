/* =====================================================
   SmartShop – cart.js
   Cart & Wishlist management with localStorage
   ===================================================== */

/* global renderCartSidebar, renderWishlistSidebar */

// eslint-disable-next-line no-unused-vars
const Cart = (() => {
  const CART_KEY = 'smartshop_cart';
  const WISH_KEY = 'smartshop_wishlist';

  /* ── Storage helpers ───────────────────────────── */
  const load = (key) => {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch { return []; }
  };
  const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  /* ── Cart State ────────────────────────────────── */
  let items = load(CART_KEY);

  const persist = () => save(CART_KEY, items);

  const getItems   = () => items;
  const getCount   = () => items.reduce((s, i) => s + i.qty, 0);
  const getTotal   = () => items.reduce((s, i) => s + i.price * i.qty, 0);
  const getSubtotal = () => getTotal();

  const findIdx = (id) => items.findIndex(i => i.id === id);

  const add = (product, qty = 1) => {
    const idx = findIdx(product.id);
    if (idx > -1) {
      items[idx].qty += qty;
    } else {
      items.push({
        id: product.id,
        title: product.title,
        price: product.price,
        thumbnail: product.thumbnail,
        brand: product.brand,
        category: product.category,
        stock: product.stock,
        qty
      });
    }
    persist();
    updateUI();
  };

  const remove = (id) => {
    items = items.filter(i => i.id !== id);
    persist();
    updateUI();
  };

  const updateQty = (id, qty) => {
    const idx = findIdx(id);
    if (idx === -1) return;
    if (qty <= 0) { remove(id); return; }
    items[idx].qty = Math.min(qty, items[idx].stock || 99);
    persist();
    updateUI();
  };

  const clear = () => { items = []; persist(); updateUI(); };

  /* ── Wishlist State ────────────────────────────── */
  let wishlist = load(WISH_KEY);
  const persistWish = () => save(WISH_KEY, wishlist);

  const getWishlist     = () => wishlist;
  const getWishCount    = () => wishlist.length;
  const isWishlisted    = (id) => wishlist.some(p => p.id === id);

  const toggleWish = (product) => {
    if (isWishlisted(product.id)) {
      wishlist = wishlist.filter(p => p.id !== product.id);
    } else {
      wishlist.push(product);
    }
    persistWish();
    updateWishlistUI();
    return isWishlisted(product.id);
  };

  /* ── UI Updates ────────────────────────────────── */
  const updateUI = () => {
    const badge = document.getElementById('cartBadge');
    const count = getCount();
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
    // Re-render cart sidebar if open
    if (typeof renderCartSidebar === 'function') renderCartSidebar();
  };

  const updateWishlistUI = () => {
    const badge = document.getElementById('wishlistBadge');
    const count = getWishCount();
    if (badge) {
      badge.textContent = count;
      badge.classList.toggle('hidden', count === 0);
    }
    // Re-render wishlist sidebar if open
    if (typeof renderWishlistSidebar === 'function') renderWishlistSidebar();
  };

  const init = () => { updateUI(); updateWishlistUI(); };

  return {
    init, add, remove, updateQty, clear,
    getItems, getCount, getTotal, getSubtotal,
    toggleWish, isWishlisted, getWishlist, getWishCount,
    updateUI, updateWishlistUI
  };
})();
