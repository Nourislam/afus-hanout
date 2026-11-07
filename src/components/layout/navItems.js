// The menu's pages, grouped. Brands, categories, suppliers and customers live
// together in "Catalogue"; promotions and packs together in "Offers".
// Shared by the menu and by Settings › Modules (pages of the simple menu).
import {
    LayoutDashboard, ShoppingCart, Package, Boxes, UserCog, BarChart3, Percent, QrCode,
    History, CreditCard, FileText, LibraryBig, Users, Truck, CalendarClock, MessageCircleQuestion,
} from 'lucide-react';
import { PERMISSIONS } from '../../stores/authStore';
import { offerTabs } from '../../lib/modules';

export const NAV_GROUPS = [
    {
        id: 'sell',
        items: [
            { path: '/', icon: LayoutDashboard, label: 'nav.dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
            { path: '/pos', icon: ShoppingCart, label: 'nav.sales', permission: PERMISSIONS.POS_VIEW },
            { path: '/transactions', icon: History, label: 'nav.transactions', permission: PERMISSIONS.POS_VIEW },
            { path: '/credit-sales', icon: CreditCard, label: 'nav.credit', permission: PERMISSIONS.CUSTOMERS_VIEW, feature: 'credit' },
        ],
    },
    {
        id: 'stock',
        items: [
            { path: '/products', icon: Package, label: 'nav.products', permission: PERMISSIONS.PRODUCTS_VIEW },
            { path: '/inventory', icon: Boxes, label: 'nav.inventory', permission: PERMISSIONS.INVENTORY_VIEW },
            { path: '/labels', icon: QrCode, label: 'nav.labels', permission: PERMISSIONS.PRODUCTS_VIEW },
            { path: '/catalog', icon: LibraryBig, label: 'nav.catalog', permission: PERMISSIONS.PRODUCTS_VIEW },
            { path: '/customers', icon: Users, label: 'nav.customers', permission: PERMISSIONS.CUSTOMERS_VIEW, feature: 'customers' },
            // The distributors' days, their order and the quick receiving
            { path: '/distributors', icon: CalendarClock, label: 'nav.distributors', permission: PERMISSIONS.INVENTORY_ADJUST, feature: 'suppliers' },
            { path: '/suppliers', icon: Truck, label: 'nav.suppliers', permission: PERMISSIONS.INVENTORY_ADJUST, feature: 'suppliers' },
            { path: '/purchase-orders', icon: FileText, label: 'nav.purchases', permission: PERMISSIONS.INVENTORY_ADJUST, feature: 'purchaseOrders' },
        ],
    },
    {
        id: 'grow',
        items: [
            // Promotions, packs and gift cards: shown while one of them is on and allowed
            { path: '/offers', icon: Percent, label: 'nav.offers', show: (features, can) => offerTabs(features, can).length > 0 },
        ],
    },
    {
        id: 'manage',
        items: [
            { path: '/employees', icon: UserCog, label: 'nav.employees', permission: PERMISSIONS.EMPLOYEES_VIEW },
            { path: '/reports', icon: BarChart3, label: 'nav.reports', permission: PERMISSIONS.REPORTS_VIEW },
            // Ready questions about the shop, answered without the internet
            { path: '/ask', icon: MessageCircleQuestion, label: 'nav.ask', permission: PERMISSIONS.REPORTS_VIEW },
        ],
    },
];
