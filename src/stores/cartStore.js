import { t } from '../i18n';
import { isTaxEnabled } from '../lib/tax';
import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { bestPromotion } from '../lib/promotions';
import { isWeighed, weighedPrice, cartonDeal, lineCounts, pricePerKg } from '../../electron/shared/grocery.ts';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const lineTotal = (quantity, unitPrice, discount = 0) => round2(quantity * unitPrice - (discount || 0));

/** A line at a new unit price; a carton line keeps its carton price as a ceiling (its discount follows). */
function withPrice(item, price) {
    const discount = item.sold_as === 'carton'
        ? (cartonDeal({ price, carton_qty: item.carton_qty, carton_price: item.carton_price }, item.cartons || 1)?.discount ?? 0)
        : item.discount;
    return { ...item, unit_price: price, discount, total: lineTotal(item.quantity, price, discount) };
}

/** Pieces (grams for a weighed article) of an article already in the other lines of the cart. */
const usedElsewhere = (items, productId, exceptId = null) => items
    .filter(i => i.product_id === productId && !i.variant_id && i.id !== exceptId)
    .reduce((sum, i) => sum + (Number(i.weight_grams) > 0 ? Number(i.weight_grams) : Number(i.quantity) || 0), 0);

/** The fields every new line of an article starts with. */
const baseLine = (product) => ({
    id: uuid(),
    product_id: product.id,
    product_name: product.name,
    category_id: product.category_id || null,
    brand: product.brand || null,
    image_path: product.image_path || null,
    variant_id: null,
    variant_label: null,
    sku: product.sku || null,
});

/** Lines of a ticket put on hold (stored as JSON); a damaged record gives none. */
export function heldLines(held) {
    let lines = held?.items_json ?? held?.items;
    try {
        while (typeof lines === 'string') lines = JSON.parse(lines);
    } catch {
        lines = [];
    }
    return Array.isArray(lines) ? lines : [];
}

export const useCartStore = create((set, get) => ({
    items: [],
    customer: null,
    // Reservation picked up at the till: { id, number, deposit }
    reservation: null,
    discount: 0,
    discountType: 'fixed', // 'fixed' or 'percent'
    notes: '',

    taxType: 'inclusive', // 'exclusive' or 'inclusive' - default to inclusive
    globalTaxRate: 0,
    currency: 'DZD',
    serviceCharge: 0,
    taxExempt: false,
    // Promotions that can apply automatically, and a coupon typed at checkout
    promotions: [],
    coupon: '',
    // Line added last (highlighted in the ticket after a scan)
    lastAddedId: null,

    loadPromotions: async () => {
        try {
            const promotions = await window.electronAPI.promotions.getActive();
            set({ promotions: Array.isArray(promotions) ? promotions : [] });
        } catch {
            set({ promotions: [] });
        }
    },

    setCoupon: (coupon) => set({ coupon: String(coupon || '').trim() }),

    loadSettings: async () => {
        try {
            const settings = await window.electronAPI.settings.getAll();
            let parsed = { ...settings };
            if (settings.store_config) {
                try {
                    // store_config may already be an object (from new getAll) or a string (legacy)
                    let storeConfig = settings.store_config;
                    if (typeof storeConfig === 'string') {
                        storeConfig = JSON.parse(storeConfig);
                    }
                    parsed = { ...parsed, ...storeConfig };
                } catch (e) {
                    console.error('Error parsing store_config:', e);
                }
            }

            const finalTaxType = parsed.taxType || 'inclusive';
            // 0 is a valid rate (most small Algerian shops sell without TVA)
            const rate = parseFloat(parsed.taxRate);
            const finalTaxRate = Number.isFinite(rate) && rate >= 0 ? rate : 0;
            const finalCurrency = parsed.currency || 'DZD';

            set({
                taxType: finalTaxType,
                globalTaxRate: finalTaxRate,
                taxEnabled: isTaxEnabled(parsed),
                currency: finalCurrency
            });
        } catch (e) {
            console.error('Failed to load settings in cart store', e);
        }
    },

    setServiceCharge: (amount) => set({ serviceCharge: amount }),
    setTaxExempt: (isExempt) => set({ taxExempt: isExempt }),

    /**
     * Add a product, or one variant (colour/size) of it, to the cart.
     * Lines are keyed by product + variant, so scanning the same variant again
     * increases its quantity while a different size gets its own line.
     */
    addItem: (product, quantity = 1, variant = null) => {
        const { items, globalTaxRate } = get();
        // An article sold by weight is weighed first (addWeighed)
        if (!variant && isWeighed(product)) return { success: false, needsWeight: true, message: t('cart.needsWeight') };
        const variantId = variant ? variant.id : null;
        // Pieces only: a carton or a weighed line of the same article is its own line
        const existingIndex = items.findIndex(item =>
            item.product_id === product.id && (item.variant_id || null) === variantId && !item.sold_as);
        // Use product-specific tax only if explicitly set (> 0), otherwise use global rate
        const itemTaxRate = (product.tax_rate && product.tax_rate > 0) ? product.tax_rate : globalTaxRate;
        const retailPrice = variant && variant.price !== null && variant.price !== undefined && variant.price !== ''
            ? Number(variant.price)
            : Number(product.price) || 0;
        // Wholesale customer: the article's wholesale price when it has one
        const wholesalePrice = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : null;
        const unitPrice = get().customer?.is_wholesale && wholesalePrice ? wholesalePrice : retailPrice;
        const available = variant ? (variant.stock_quantity ?? 0) : product.stock_quantity;

        if (existingIndex >= 0) {
            const newItems = [...items];
            const line = newItems[existingIndex];
            const maxStock = line.max_stock ?? available ?? 999999;
            const others = variant ? 0 : usedElsewhere(items, product.id, line.id);

            if (line.quantity + quantity + others > maxStock) {
                return { success: false, message: t('cart.insufficientStock') };
            }

            newItems[existingIndex] = {
                ...line,
                quantity: line.quantity + quantity,
                total: lineTotal(line.quantity + quantity, line.unit_price, line.discount),
            };
            set({ items: newItems, lastAddedId: line.id });
            return { success: true, quantity: newItems[existingIndex].quantity };
        }

        if (quantity + (variant ? 0 : usedElsewhere(items, product.id)) > available) {
            return { success: false, message: t('cart.insufficientStock') };
        }

        const variantLabel = variant ? [variant.color, variant.size].filter(Boolean).join(' / ') : '';
        const newItem = {
            id: uuid(),
            product_id: product.id,
            product_name: product.name,
            category_id: product.category_id || null,
            brand: product.brand || null,
            image_path: product.image_path || null,
            variant_id: variantId,
            variant_label: variantLabel || null,
            color: variant?.color || null,
            color_code: variant?.color_code || null,
            size: variant?.size || null,
            sku: variant ? variant.sku : (product.sku || null),
            quantity,
            unit_price: unitPrice,
            original_price: unitPrice,
            retail_price: retailPrice,
            wholesale_price: wholesalePrice,
            tax_rate: itemTaxRate,
            discount: 0,
            total: lineTotal(quantity, unitPrice),
            max_stock: available
        };
        set({ items: [...items, newItem], lastAddedId: newItem.id });
        return { success: true, quantity };
    },

    updateItemQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
            get().removeItem(itemId);
            return { success: true };
        }

        const { items } = get();
        const item = items.find(i => i.id === itemId);
        if (!item) return { success: false, message: t('cart.itemNotFound') };

        // A weighed line is one weighing: weigh again for more
        if (item.sold_as === 'weight') return quantity === 1 ? { success: true } : { success: false, message: t('cart.weighAgain') };
        // A carton line: + and − add or take one carton
        if (item.sold_as === 'carton') {
            const cartons = (item.cartons || 1) + (quantity > item.quantity ? 1 : -1);
            if (cartons <= 0) { get().removeItem(itemId); return { success: true }; }
            const deal = cartonDeal({ price: item.unit_price, carton_qty: item.carton_qty, carton_price: item.carton_price }, cartons);
            if (!deal) return { success: false, message: t('cart.noCarton') };
            if (item.max_stock !== undefined && deal.quantity + usedElsewhere(items, item.product_id, item.id) > item.max_stock) {
                return { success: false, message: t('cart.insufficientStock') };
            }
            set(state => ({ items: state.items.map(i => i.id === itemId
                ? { ...i, cartons, quantity: deal.quantity, discount: deal.discount, total: lineTotal(deal.quantity, i.unit_price, deal.discount) }
                : i) }));
            return { success: true };
        }

        const others = item.variant_id ? 0 : usedElsewhere(items, item.product_id, item.id);
        if (item.max_stock !== undefined && quantity + others > item.max_stock) {
            return { success: false, message: t('cart.insufficientStock') };
        }

        set(state => ({
            items: state.items.map(item =>
                item.id === itemId
                    ? { ...item, quantity, total: lineTotal(quantity, item.unit_price, item.discount) }
                    : item
            )
        }));
        return { success: true };
    },

    /** One carton (or more) of an article: its pieces, at the carton price. */
    addCarton: (product, cartons = 1) => {
        const { items, globalTaxRate } = get();
        const existing = items.find(i => i.product_id === product.id && i.sold_as === 'carton');
        const count = (existing?.cartons || 0) + cartons;
        // A wholesale customer pays the wholesale price: the carton is never dearer than its pieces
        const wholesale = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : null;
        const listPrice = get().customer?.is_wholesale && wholesale ? wholesale : Number(product.price) || 0;
        const deal = cartonDeal({ ...product, price: existing ? existing.unit_price : listPrice }, count);
        if (!deal) return { success: false, message: t('cart.noCarton') };
        const stock = Number(product.stock_quantity) || 0;
        if (deal.quantity + usedElsewhere(items, product.id, existing?.id) > stock) {
            return { success: false, message: t('cart.insufficientStock') };
        }
        const unitPrice = listPrice;
        if (existing) {
            set({
                items: items.map(i => i.id === existing.id
                    ? { ...i, cartons: count, quantity: deal.quantity, discount: deal.discount, total: lineTotal(deal.quantity, i.unit_price, deal.discount) }
                    : i),
                lastAddedId: existing.id,
            });
            return { success: true, quantity: deal.quantity };
        }
        const line = {
            ...baseLine(product),
            sold_as: 'carton',
            cartons: count,
            carton_qty: product.carton_qty,
            carton_price: product.carton_price ?? null,
            quantity: deal.quantity,
            unit_price: unitPrice,
            original_price: unitPrice,
            retail_price: Number(product.price) || 0,
            wholesale_price: wholesale,
            tax_rate: (product.tax_rate && product.tax_rate > 0) ? product.tax_rate : globalTaxRate,
            discount: deal.discount,
            total: lineTotal(deal.quantity, unitPrice, deal.discount),
            max_stock: stock,
        };
        set({ items: [...items, line], lastAddedId: line.id });
        return { success: true, quantity: deal.quantity };
    },

    /**
     * One weighing of an article sold by weight: its own line of quantity 1,
     * priced per kg, or at the price read on a scale label.
     */
    addWeighed: (product, grams, labelPrice = null) => {
        const { items, globalTaxRate } = get();
        const g = Math.round(Number(grams) || 0);
        if (!(g > 0)) return { success: false, message: t('cart.needsWeight') };
        const stock = Number(product.stock_quantity) || 0;
        if (g + usedElsewhere(items, product.id) > stock) {
            return { success: false, message: t('cart.insufficientStock') };
        }
        const wholesale = Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : null;
        const perKg = get().customer?.is_wholesale && wholesale ? wholesale : Number(product.price) || 0;
        const unitPrice = labelPrice !== null && labelPrice !== undefined ? round2(labelPrice) : weighedPrice(perKg, g);
        const line = {
            ...baseLine(product),
            sold_as: 'weight',
            weight_grams: g,
            price_per_kg: perKg,
            // Both prices per kg, so the line follows the customer; a scale label keeps its price
            retail_per_kg: Number(product.price) || 0,
            wholesale_per_kg: wholesale,
            label_price: labelPrice !== null && labelPrice !== undefined,
            quantity: 1,
            unit_price: unitPrice,
            original_price: unitPrice,
            retail_price: unitPrice,
            tax_rate: (product.tax_rate && product.tax_rate > 0) ? product.tax_rate : globalTaxRate,
            discount: 0,
            total: unitPrice,
            max_stock: 1,
        };
        set({ items: [...items, line], lastAddedId: line.id });
        return { success: true, quantity: 1 };
    },

    removeItem: (itemId) => {
        set(state => ({
            items: state.items.filter(item => item.id !== itemId)
        }));
    },

    setItemDiscount: (itemId, discount) => {
        set(state => ({
            items: state.items.map(item =>
                item.id === itemId
                    ? { ...item, discount, total: lineTotal(item.quantity, item.unit_price, discount) }
                    : item
            )
        }));
    },

    /** Price agreed with the customer for one line (the usual bargaining). */
    setLinePrice: (itemId, price) => {
        const value = Math.max(0, round2(price));
        set(state => ({
            items: state.items.map(item =>
                item.id === itemId ? withPrice(item, value) : item
            )
        }));
    },

    setCustomer: (customer) => {
        // Wholesale customer chosen (or removed): lines at their list price
        // change to the wholesale (or retail) price; prices typed by hand stay
        const wholesale = !!customer?.is_wholesale;
        const items = get().items.map(item => {
            if (item.unit_price !== item.original_price) return item;
            // A weighed line: the price per kg of this customer, for its weight (a scale label keeps its price)
            if (item.sold_as === 'weight') {
                if (item.label_price || item.retail_per_kg === undefined) return item;
                const perKg = wholesale && item.wholesale_per_kg ? item.wholesale_per_kg : item.retail_per_kg;
                const price = weighedPrice(perKg, item.weight_grams);
                return { ...withPrice(item, price), original_price: price, price_per_kg: perKg };
            }
            if (item.retail_price === undefined) return item;
            const price = wholesale && item.wholesale_price ? item.wholesale_price : item.retail_price;
            return { ...withPrice(item, price), original_price: price };
        });
        set({ customer, items });
    },

    setDiscount: (discount, discountType = 'fixed') => {
        set({ discount, discountType });
    },

    setNotes: (notes) => {
        set({ notes });
    },

    getSubtotal: () => {
        const { items } = get();
        return round2(items.reduce((sum, item) => sum + item.total, 0));
    },

    /** Discount typed by the cashier for the whole ticket (fixed DA or %). */
    getManualDiscount: () => {
        const { discount, discountType } = get();
        const subtotal = get().getSubtotal();
        const value = Number(discount) || 0;
        const amount = discountType === 'percent' ? subtotal * Math.min(100, Math.max(0, value)) / 100 : value;
        return round2(Math.min(Math.max(0, amount), subtotal));
    },

    /** Best active promotion for this ticket: { promotion, amount } or null. */
    getPromotion: () => {
        const { promotions, items, coupon } = get();
        return bestPromotion(promotions, items, { coupon });
    },

    getDiscountAmount: () => {
        const subtotal = get().getSubtotal();
        const promo = get().getPromotion();
        return round2(Math.min(subtotal, get().getManualDiscount() + (promo ? promo.amount : 0)));
    },

    // Tax is computed on what the customer really pays (after discounts)
    getTaxAmount: () => round2(get().getLineTaxes().reduce((sum, tax) => sum + tax, 0)),

    // The TVA of each line, on what the customer really pays for it (the
    // ticket discount spread over the lines); rounded so the lines add up to
    // the ticket's TVA exactly (the cent left over goes to the last taxed line)
    getLineTaxes: () => {
        const { items, taxType, taxExempt, globalTaxRate, taxEnabled } = get();
        // TVA turned off in Settings: none is computed
        if (taxExempt || taxEnabled === false) return items.map(() => 0);
        const subtotal = get().getSubtotal();
        if (subtotal <= 0) return items.map(() => 0);
        const factor = (subtotal - get().getDiscountAmount()) / subtotal;
        const exact = items.map(item => {
            const effectiveRate = (item.tax_rate && item.tax_rate > 0) ? item.tax_rate : globalTaxRate;
            const rate = (Number(effectiveRate) || 0) / 100;
            const paid = item.total * factor;
            return taxType === 'inclusive' ? paid - paid / (1 + rate) : paid * rate;
        });
        const total = round2(exact.reduce((sum, tax) => sum + tax, 0));
        const lines = exact.map(round2);
        const last = lines.map((tax, i) => (exact[i] > 0 ? i : -1)).filter(i => i >= 0).pop();
        if (last !== undefined) lines[last] = round2(lines[last] + total - round2(lines.reduce((sum, tax) => sum + tax, 0)));
        return lines;
    },

    getTotal: () => {
        const { taxType, serviceCharge } = get();
        const net = get().getSubtotal() - get().getDiscountAmount();
        const total = taxType === 'inclusive' ? net : net + get().getTaxAmount();
        return round2(Math.max(0, total + (Number(serviceCharge) || 0)));
    },

    /** Pieces in the cart (a weighed line is grams, not a piece: see lineCounts). */
    getItemCount: () => lineCounts(get().items).pieces,

    /** What the ticket holds now, to put it back with restore (the «تراجع» button). */
    snapshot: () => {
        const { items, customer, reservation, discount, discountType, serviceCharge, taxExempt, notes, coupon } = get();
        return { items, customer, reservation, discount, discountType, serviceCharge, taxExempt, notes, coupon };
    },

    /**
     * Put back a snapshot, only if the ticket is still what the action left
     * (`expectedItems`): after a scan, a sale or a hold, «تراجع» does nothing.
     */
    restore: (snapshot, expectedItems) => {
        if (!snapshot || get().items !== expectedItems) return false;
        set({ ...snapshot, lastAddedId: null });
        return true;
    },

    clearCart: () => {
        set({
            items: [],
            customer: null,
            reservation: null,
            discount: 0,
            discountType: 'fixed',
            serviceCharge: 0,
            taxExempt: false,
            notes: '',
            coupon: '',
            lastAddedId: null,
        });
    },

    /**
     * A reservation picked up: its pieces at the reserved price, its customer,
     * and the deposit already paid (taken off at payment).
     */
    loadReservation: (reservation, customer) => {
        get().clearCart();
        const items = (reservation.items || []).map(line => {
            const grams = Number(line.weight_grams) || 0;
            const discount = Number(line.discount) || 0;
            return {
                id: uuid(),
                product_id: line.product_id,
                product_name: line.product_name,
                variant_id: line.variant_id || null,
                variant_label: line.variant_label || null,
                quantity: line.quantity,
                unit_price: line.unit_price,
                original_price: line.unit_price,
                tax_rate: get().globalTaxRate,
                // A weighed line keeps its weight; a carton its carton price
                ...(grams > 0 ? { sold_as: 'weight', weight_grams: grams, price_per_kg: pricePerKg(line.unit_price, grams) } : {}),
                ...(line.sold_as === 'carton' ? { sold_as: 'carton' } : {}),
                discount,
                total: lineTotal(line.quantity, line.unit_price, discount),
                // The reserved pieces are this customer's: no more than reserved
                max_stock: line.quantity,
            };
        });
        set({ items, customer: customer || null, reservation: { id: reservation.id, number: reservation.number, deposit: Number(reservation.deposit) || 0 } });
    },

    holdTransaction: async (employeeId) => {
        const { items, customer, notes } = get();
        if (items.length === 0) return null;
        const held = {
            id: uuid(),
            employee_id: employeeId,
            customer_id: customer?.id,
            items,
            subtotal: get().getSubtotal(),
            notes,
        };
        await window.electronAPI.held.create(held);
        get().clearCart();
        return held;
    },

    recallTransaction: (held) => {
        const items = heldLines(held);
        set({
            items,
            customer: held.customer_id ? { id: held.customer_id, name: held.customer_name } : null,
            notes: held.notes || '',
            discount: 0,
            discountType: 'fixed',
            serviceCharge: 0, // Reset these as they might not be in held data yet
            taxExempt: false
        });
    },

    loadQuote: (quote) => {
        set({
            items: quote.items.map(item => ({
                id: uuid(),
                product_id: item.product_id,
                product_name: item.product_name,
                variant_id: item.variant_id || null,
                variant_label: item.variant_label || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tax_rate: 0,
                total: item.quantity * item.unit_price
            })),
            customer: quote.customer_id ? { id: quote.customer_id, name: quote.customer_name } : null,
            discount: quote.discount_amount || 0,
            discountType: 'fixed',
            notes: quote.notes || '',
        });
    },

    processPayment: async (payments, employeeId, employeeName = null, approval = null, credit = null, changeKept = 0) => {
        const { items, customer, notes, serviceCharge, taxExempt } = get();
        if (items.length === 0) throw new Error(t('cart.empty'));

        const receiptNumber = await window.electronAPI.generateReceiptNumber();
        const subtotal = get().getSubtotal();
        const taxAmount = get().getTaxAmount();
        const discountAmount = get().getDiscountAmount();
        const total = get().getTotal();

        const promo = get().getPromotion();
        const lineTaxes = get().getLineTaxes();
        const saleItems = items.map((item, i) => ({ ...item, tax_amount: lineTaxes[i] || 0 }));

        const sale = {
            id: uuid(),
            receipt_number: receiptNumber,
            employee_id: employeeId,
            employee_name: employeeName,
            created_at: new Date().toISOString(),
            customer_id: customer?.id || null,
            subtotal,
            tax_amount: taxAmount,
            discount_amount: discountAmount,
            service_charge: serviceCharge || 0, // NEW field
            tax_exempt: taxExempt ? 1 : 0,      // NEW field
            total,
            status: 'completed',
            notes: promo ? [notes, promo.promotion.name].filter(Boolean).join(' · ') : notes,
            promotion_id: promo ? promo.promotion.id : null,
            promotion_name: promo ? promo.promotion.name : null,
            // Checked again by the main process: discount typed by hand, coupon typed
            manual_discount: get().getManualDiscount(),
            coupon: get().coupon || null,
            approval: approval || null,
            // Reservation picked up (its deposit is one of the payments)
            reservation_id: get().reservation?.id || null,
            // Change under 5 DA written on the customer's name (checked by the main process)
            change_kept: changeKept > 0 ? changeKept : 0,
            // Kridi: written with the sale by the main process (customer, due date)
            credit: credit ? { ...credit, notes: credit.notes || t('pos.creditNote', { n: receiptNumber }) } : null,
            items: saleItems,
            payments: payments.map(p => ({ ...p, id: uuid() })),
        };

        // The saved sale comes back with the variant/SKU snapshot of each line
        const saved = await window.electronAPI.sales.create(sale);
        if (saved && saved.items) sale.items = saved.items;
        if (saved && saved.credit_sale) sale.credit_sale = saved.credit_sale;
        // The manager's PIN is never kept with the sale
        delete sale.approval;

        // Loyalty points and total spent are updated by the main process in
        // the same transaction as the sale.
        get().clearCart();
        return sale;
    },
}));
