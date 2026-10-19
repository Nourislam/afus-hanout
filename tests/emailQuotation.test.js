// The Quote window's Send button: the main process has a handler for it, the
// PDF is attached and SMTP not set up is said plainly (it used to have no handler).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function setup(settings) {
    const sent = [];
    const servicePath = require.resolve('../electron/services/emailService');
    require.cache[servicePath] = {
        id: servicePath, filename: servicePath, loaded: true,
        exports: { initEmailService: (c) => !!c.smtp_host, sendQuotationEmail: async (args) => { sent.push(args); } },
    };
    const map = {};
    require('../electron/ipc/email')({
        ipcMain: { handle: (name, fn) => { map[name] = fn; } },
        getStoreSettings: () => settings,
        receiptService: { generateQuotationPdf: async () => '/tmp/q.pdf', generatePurchaseOrderPdf: async () => null, generatePdf: async () => null },
        getOne: () => null, runQuery: () => [], BRAND: {}, ReceiptService: function () {},
        sendTestEmail: () => {}, testEmailConnection: () => {},
    });
    delete require.cache[servicePath];
    return { handler: map['email:sendQuotation'], sent };
}

describe('email:sendQuotation', () => {
    it('sends the quotation with its PDF', async () => {
        const { handler, sent } = setup({ email_host: 'smtp.x.dz', email_user: 'a@x.dz', email_password: 'p', businessName: 'Boutique Islam' });
        const r = await handler(null, { to: 'client@x.dz', quote: { quote_number: 'Q-1', items: [{ product_name: 'Robe', quantity: 1, unit_price: '3500', total: '3500' }] } });
        expect(r).toEqual({ success: true });
        expect(sent[0]).toMatchObject({ to: 'client@x.dz', pdfPath: '/tmp/q.pdf', quote: { items: [{ unit_price: 3500, total: 3500 }] } });
    });

    it('SMTP not set up: says so, sends nothing', async () => {
        const { handler, sent } = setup({});
        const r = await handler(null, { to: 'client@x.dz', quote: { quote_number: 'Q-1', items: [] } });
        expect(r.success).toBe(false);
        expect(r.message).toMatch(/not configured/);
        expect(sent).toHaveLength(0);
    });
});
