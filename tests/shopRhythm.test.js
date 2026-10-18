// Reports › Shop intelligence: the busy hours and days learnt from the sales,
// the occasions of the Algerian year and, before each, what to buy.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import { createShop, sell } from './helpers/shop';

const require = createRequire(import.meta.url);
const rhythmService = require('../electron/services/shopRhythm');

const at = (api, id, local) => api.run('UPDATE sales SET created_at = ? WHERE id = ?', [new Date(local).toISOString().replace('T', ' ').slice(0, 19), id]);

describe('shop rhythm', () => {
    it('busy hours and days: from the shop\'s own tickets (its clock)', async () => {
        const { api, v } = await createShop();
        let n = 0;
        // Saturdays 17h are busy, a few Tuesday mornings
        for (const day of ['2026-10-03', '2026-10-10', '2026-10-17']) {
            for (let i = 0; i < 4; i++) { const id = `s${n++}`; sell(api, id, [{ product: 'jean', variant: v['J-N-38'], qty: 1, price: 3000 }]); at(api, id, `${day}T17:${10 + i}:00`); }
        }
        for (const day of ['2026-10-06', '2026-10-13']) { const id = `s${n++}`; sell(api, id, [{ product: 'belt', qty: 1, price: 800 }]); at(api, id, `${day}T10:05:00`); }
        const r = rhythmService.rhythm(api, { now: Date.parse('2026-10-18T12:00:00'), weeks: 4 });
        expect(r.tickets).toBe(14);
        expect(r.busiestHour.hour).toBe(17);
        expect(r.busiestDay.day).toBe(6);
        expect(r.grid[6][17].tickets).toBe(12);
        expect(r.peak.from).toBeLessThanOrEqual(17);
        expect(r.enough).toBe(false);
    });

    it('Eid al-Fitr by the Hijri calendar; last year\'s rise and what to buy now', async () => {
        const { api, v } = await createShop();
        // 1 Shawwal 1447 = 20 March 2026; the next one in March 2027
        expect(rhythmService.hijriOf(new Date('2026-03-20T12:00:00'))).toMatchObject({ month: 10, day: 1 });
        let n = 0;
        // Usual weeks (January / February): a ticket every 4 days
        for (let d = 0; d < 56; d += 4) { const id = `u${n++}`; sell(api, id, [{ product: 'belt', qty: 1, price: 800 }]); at(api, id, new Date(Date.parse('2026-01-06T11:00:00') + d * 86400000)); }
        // The three weeks before Eid: jeans in 38 sell every day
        for (let d = 0; d < 19; d++) { const id = `e${n++}`; sell(api, id, [{ product: 'jean', variant: v['J-N-38'], qty: 1, price: 3000 }]); at(api, id, new Date(Date.parse('2026-03-01T15:00:00') + d * 86400000)); }
        const list = rhythmService.calendar(api, { now: Date.parse('2027-02-15T09:00:00') });
        const eid = list.find(e => e.id === 'eidFitr');
        expect(eid.date.startsWith('2027-03')).toBe(true);
        expect(eid.history.date).toBe('2026-03-20');
        expect(eid.history.change).toBeGreaterThan(100);
        const jean38 = eid.history.toBuy.find(x => x.variantId === v['J-N-38']);
        // 1 to 19 March (the window ends on the day of Eid)
        expect(jean38.sold).toBe(19);
        expect(jean38.buy).toBe(Math.ceil(19 * 1.1) - jean38.stock);
        expect(list.map(e => e.days)).toEqual([...list.map(e => e.days)].sort((a, b) => a - b));
    });

    it('the shop\'s own dates: kept in shop_events, every year or once, checked', async () => {
        const { api } = await createShop();
        const e = rhythmService.addEvent(api, { name: 'Soldes d\'hiver', date: '2026-01-20', daysBefore: 10, yearly: true }, 'ev1');
        expect(e.daysBefore).toBe(10);
        expect(() => rhythmService.addEvent(api, { name: '', date: '2026-01-20' }, 'x')).toThrow('EVENT_NAME_REQUIRED');
        expect(() => rhythmService.addEvent(api, { name: 'X', date: '20/01/2026' }, 'x')).toThrow('EVENT_DATE_INVALID');
        const own = rhythmService.calendar(api, { now: Date.parse('2026-12-01T09:00:00'), limit: 20 }).find(x => x.id === 'ev1');
        expect(own).toMatchObject({ name: 'Soldes d\'hiver', kind: 'own', date: '2027-01-20', before: 10 });
        rhythmService.deleteEvent(api, 'ev1');
        expect(rhythmService.listEvents(api)).toEqual([]);
    });
});
