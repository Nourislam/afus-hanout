// Website › Settings tab: features, delivery prices, messages, tracking, blocked phones, sizes, couriers.
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Package, Shirt, XCircle, ShoppingBag, Store, PhoneCall, SlidersHorizontal, KeyRound, BarChart3 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { WILAYAS } from '../../data/wilayas';
import { toast } from '../ui/Toast';
import { formatDate } from '../../i18n/format';
import { useT } from '../../i18n';
import { SettingsCard } from './shared';

/** The website's settings, one subject per tab (saved each on its own). */
const SETTINGS_TABS = ['features', 'delivery', 'messages', 'tracking', 'blocked', 'sizes', 'couriers'];
export function WebsiteSettings({ site, busy, run }) {
    const { t } = useT();
    const [params, setParams] = useSearchParams();
    const tab = SETTINGS_TABS.includes(params.get('s')) ? params.get('s') : 'features';
    const setTab = (id) => setParams((p) => { const next = new URLSearchParams(p); next.set('s', id); return next; }, { replace: true });
    return (
        <div className="space-y-4" data-testid="website-settings">
            <Tabs tabs={SETTINGS_TABS.map(id => ({ id, label: t(`website.settingsTab.${id}`) }))} value={tab} onChange={setTab} testId="website-settings-tab" />
            <div className="max-w-4xl">
                {tab === 'features' && <FeaturesCard site={site} busy={busy} run={run} />}
                {tab === 'delivery' && <DeliveryPricesCard site={site} busy={busy} run={run} />}
                {tab === 'delivery' && <CouriersCard site={site} busy={busy} run={run} />}
                {tab === 'messages' && <MessagesCard site={site} busy={busy} run={run} />}
                {tab === 'tracking' && <TrackingCard site={site} busy={busy} run={run} />}
                {tab === 'blocked' && <BlockedPhonesCard site={site} busy={busy} run={run} />}
                {tab === 'sizes' && <SizeGuidesCard site={site} busy={busy} run={run} />}
                {tab === 'couriers' && <CourierApiCard site={site} busy={busy} run={run} />}
            </div>
        </div>
    );
}

/**
 * Opening hours, social pages and a map link: shown on the website only
 * (kept with the website, not in the shop's settings). The shop's name,
 * phone, address and logo come from Settings.
 */
/** The website's features, one switch each, saved at once (on the website at the next update). */
const FEATURE_KEYS = [
    ['orderForm', 'website.features.orderForm'], ['whatsappOrder', 'website.features.whatsappOrder'], ['cart', 'website.features.cart'],
    ['homeDelivery', 'website.features.homeDelivery'], ['officeDelivery', 'website.features.officeDelivery'],
    ['noteField', 'website.features.noteField'], ['trustBar', 'website.features.trustBar'],
    ['coupons', 'website.features.coupons'], ['fewLeft', 'website.features.fewLeft'],
];
function FeaturesCard({ site, busy, run }) {
    const { t } = useT();
    const f = site.publicInfo?.features || {};
    const toggle = (key, on) => run(`feature-${key}`, () => window.electronAPI.website.setFeatures({ [key]: on }), (next) => {
        const now = next?.publicInfo?.features || {};
        // A switch the program kept on (always a way to order and to deliver)
        if (now[key] !== on) toast.error(t('website.features.keptOn'), 6000);
        else toast.success(t('website.info.saved'));
    });
    return (
        <section className="card space-y-3" data-testid="website-features">
            <h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-indigo-300" /> {t('website.features.title')}</h2>
            <p className="text-xs text-zinc-500 leading-relaxed">{t('website.features.hint')}</p>
            <ul className="divide-y divide-white/5">
                {FEATURE_KEYS.map(([key, label]) => (
                    <li key={key} className="flex items-start justify-between gap-4 py-2.5">
                        <span className="min-w-0">
                            <span className="block text-sm">{t(label)}</span>
                            <span className="block text-xs text-zinc-500 leading-relaxed">{t(`${label}Hint`)}</span>
                        </span>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                            <input type="checkbox" className="sr-only peer" checked={f[key] !== false} disabled={busy === `feature-${key}`}
                                onChange={(e) => toggle(key, e.target.checked)} data-testid={`website-feature-${key}`} aria-label={t(label)} />
                            <span className="w-10 h-6 rounded-full bg-zinc-700 peer-checked:bg-indigo-500 transition-colors" />
                            <span className="absolute top-1 start-1 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4" />
                        </label>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function CouriersCard({ site, busy, run }) {
    const { t } = useT();
    const saved = site.publicInfo?.couriers || [];
    const [couriers, setCouriers] = useState(saved);
    useEffect(() => { setCouriers(saved); }, [JSON.stringify(saved)]);
    // The opening hours, social pages and map are in Settings › Shop; only the companies are saved here
    const save = () => run('info', () => window.electronAPI.website.setPublicInfo({ ...site.publicInfo, couriers }), () => toast.success(t('website.info.saved')));
    return (
        <SettingsCard testId="website-info-couriers" icon={Store} title={t('website.info.couriers')} hint={t('website.info.couriersHint')} onSave={save} saving={busy === 'info'}>
            <div className="flex flex-wrap gap-2">
                {(site.couriersList || []).map(c => (
                    <label key={c.id} className="flex items-center gap-2 rounded-lg bg-dark-tertiary/60 px-2 py-1 text-sm cursor-pointer">
                        <input type="checkbox" checked={couriers.includes(c.id)} data-testid={`website-courier-${c.id}`}
                            onChange={(e) => setCouriers(list => (e.target.checked ? [...list, c.id] : list.filter(x => x !== c.id)))} />
                        <span dir="ltr">{c.name}</span>
                    </label>
                ))}
            </div>
            <p className="text-xs text-zinc-500">
                {t('website.info.movedToShop')} <Link className="text-indigo-300 hover:text-indigo-200 underline" to="/settings?tab=business" data-testid="website-info-shop-link">{t('website.info.openShop')}</Link>
            </p>
        </SettingsCard>
    );
}

/** Delivery prices: home and courier office everywhere, the wilayas that differ, free above an amount. */
function DeliveryPricesCard({ site, busy, run }) {
    const { t, lang } = useT();
    const saved = site.publicInfo?.delivery || { home: null, office: null, freeOver: null, wilayas: [] };
    const asText = (v) => (v === null || v === undefined ? '' : String(v));
    const fromSaved = () => ({
        home: asText(saved.home), office: asText(saved.office), freeOver: asText(saved.freeOver),
        rows: Object.fromEntries((saved.wilayas || []).map(w => [w.code, { home: asText(w.home), office: asText(w.office), off: !!w.off }])),
    });
    const [form, setForm] = useState(fromSaved);
    useEffect(() => { setForm(fromSaved()); }, [JSON.stringify(saved)]);
    const setRow = (code, key, value) => setForm(f => ({ ...f, rows: { ...f.rows, [code]: { home: '', office: '', off: false, ...f.rows[code], [key]: value } } }));
    const num = (v) => (String(v).trim() === '' ? null : Number(v));
    const save = () => run('delivery', () => window.electronAPI.website.setSettings({
        delivery: {
            home: num(form.home), office: num(form.office), freeOver: num(form.freeOver),
            wilayas: Object.entries(form.rows).map(([code, r]) => ({ code: Number(code), home: num(r.home), office: num(r.office), off: !!r.off })),
        },
    }), () => toast.success(t('website.info.saved')));
    const money = (value, onChange, testid, label) => (
        <input className="input w-full" type="number" min="0" step="10" inputMode="numeric" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)}
            placeholder="—" aria-label={label} data-testid={testid} />
    );
    return (
        <SettingsCard testId="website-delivery" icon={Package} title={t('website.delivery.title')} hint={t('website.delivery.hint')} onSave={save} saving={busy === 'delivery'}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.delivery.home')}</span>{money(form.home, (v) => setForm(f => ({ ...f, home: v })), 'website-delivery-home', t('website.delivery.home'))}</label>
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.delivery.office')}</span>{money(form.office, (v) => setForm(f => ({ ...f, office: v })), 'website-delivery-office', t('website.delivery.office'))}</label>
                <label className="space-y-1"><span className="text-xs text-zinc-400">{t('website.delivery.freeOver')}</span>{money(form.freeOver, (v) => setForm(f => ({ ...f, freeOver: v })), 'website-delivery-free', t('website.delivery.freeOver'))}</label>
            </div>
            <p className="text-xs text-zinc-500">{t('website.delivery.perWilaya')}</p>
            <div className="max-h-[420px] overflow-y-auto border border-dark-border rounded-lg">
                <table className="w-full text-sm" data-testid="website-delivery-wilayas">
                    <thead className="text-xs text-zinc-500 sticky top-0 bg-dark-secondary"><tr>
                        <th className="text-start font-medium p-2">{t('website.delivery.wilaya')}</th><th className="text-start font-medium p-2">{t('website.delivery.home')}</th>
                        <th className="text-start font-medium p-2">{t('website.delivery.office')}</th><th className="text-start font-medium p-2">{t('website.delivery.off')}</th>
                    </tr></thead>
                    <tbody>
                        {WILAYAS.map(({ code, fr, ar }) => {
                            const n = Number(code);
                            const r = form.rows[n] || { home: '', office: '', off: false };
                            return (
                                <tr key={code} className="border-t border-dark-border">
                                    <td className="p-2 whitespace-nowrap"><bdi>{code} - {lang === 'ar' ? ar : fr}</bdi></td>
                                    <td className="p-1.5 w-32">{money(r.home, (v) => setRow(n, 'home', v), `website-delivery-${n}-home`, `${code} ${t('website.delivery.home')}`)}</td>
                                    <td className="p-1.5 w-32">{money(r.office, (v) => setRow(n, 'office', v), `website-delivery-${n}-office`, `${code} ${t('website.delivery.office')}`)}</td>
                                    <td className="p-2"><input type="checkbox" checked={!!r.off} onChange={(e) => setRow(n, 'off', e.target.checked)} aria-label={`${code} ${t('website.delivery.off')}`} data-testid={`website-delivery-${n}-off`} /></td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </SettingsCard>
    );
}

/** The WhatsApp message to confirm an order, and the new-order alert. */
function MessagesCard({ site, busy, run }) {
    const { t } = useT();
    const saved = site.tools?.confirmMessage || '';
    const [text, setText] = useState(saved || site.defaultConfirmMessage || '');
    useEffect(() => { setText(saved || site.defaultConfirmMessage || ''); }, [saved]);
    return (
        <div className="space-y-4">
            <SettingsCard testId="website-messages" icon={PhoneCall} title={t('website.messages.title')} hint={t('website.messages.hint')}
                onSave={() => run('messages', () => window.electronAPI.website.setSettings({ confirmMessage: text === site.defaultConfirmMessage ? '' : text }), () => toast.success(t('website.info.saved')))} saving={busy === 'messages'}>
                <textarea className="input w-full font-sans" rows={7} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} data-testid="website-messages-text" />
                <p className="text-xs text-zinc-500">{t('website.messages.fields')}</p>
                <button type="button" className="text-xs text-indigo-300 underline" onClick={() => setText(site.defaultConfirmMessage || '')}>{t('website.messages.reset')}</button>
            </SettingsCard>
            <SettingsCard testId="website-notify" icon={ShoppingBag} title={t('website.notify.title')} hint={t('website.notify.hint')}>
                <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input type="checkbox" checked={site.tools?.notify !== false} data-testid="website-notify-on"
                        onChange={(e) => run('notify', () => window.electronAPI.website.setSettings({ notify: e.target.checked }))} />
                    {t('website.notify.on')}
                </label>
            </SettingsCard>
        </div>
    );
}

const TRACKERS = [
    ['facebook', 'website.tracking.facebook', '1234567890123456'],
    ['tiktok', 'website.tracking.tiktok', 'C4ABCDEFGHIJ1234KLMN'],
    ['snapchat', 'website.tracking.snapchat', 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'],
    ['google', 'website.tracking.google', 'G-XXXXXXXXXX'],
];
/** Ads and visit tools of the shop's own accounts: an id each, checked; empty = off. */
function TrackingCard({ site, busy, run }) {
    const { t } = useT();
    const saved = site.publicInfo?.tracking || {};
    const [form, setForm] = useState(saved);
    useEffect(() => { setForm(saved); }, [JSON.stringify(saved)]);
    const save = () => run('tracking', () => window.electronAPI.website.setSettings({ tracking: form }), (next) => {
        const kept = next?.publicInfo?.tracking || {};
        const refused = TRACKERS.filter(([k]) => String(form[k] || '').trim() && !kept[k]).map(([, label]) => t(label));
        if (refused.length) toast.error(t('website.tracking.refused', { list: refused.join('، ') }), 7000);
        else toast.success(t('website.info.saved'));
    });
    return (
        <SettingsCard testId="website-tracking" icon={BarChart3} title={t('website.tracking.title')} hint={t('website.tracking.hint')} onSave={save} saving={busy === 'tracking'}>
            {TRACKERS.map(([k, label, ph]) => (
                <label key={k} className="block space-y-1">
                    <span className="text-xs text-zinc-400 flex items-center gap-2">{t(label)} {saved[k] && <span className="badge bg-emerald-500/15 text-emerald-300">{t('website.tracking.on')}</span>}</span>
                    <input className="input w-full font-mono" dir="ltr" value={form[k] || ''} onChange={(e) => setForm(f => ({ ...f, [k]: e.target.value }))} placeholder={ph} maxLength={60} data-testid={`website-tracking-${k}`} />
                </label>
            ))}
            <p className="text-xs text-zinc-500">{t('website.tracking.privacy')}</p>
        </SettingsCard>
    );
}

/** Numbers the website takes no order from; customers who often send parcels back. */
function BlockedPhonesCard({ site, busy, run }) {
    const { t } = useT();
    const [phone, setPhone] = useState('');
    const [note, setNote] = useState('');
    const [suggested, setSuggested] = useState([]);
    const list = site.tools?.blocked || [];
    useEffect(() => { window.electronAPI.website.blockSuggestions().then(setSuggested).catch(() => setSuggested([])); }, [list.length]);
    const block = (p, n = '') => run('block', () => window.electronAPI.website.blockPhone({ phone: p, note: n }), () => { setPhone(''); setNote(''); toast.success(t('website.blocked.added')); });
    return (
        <SettingsCard testId="website-blocked" icon={XCircle} title={t('website.blocked.title')} hint={t('website.blocked.hint')}>
            <div className="flex flex-wrap gap-2">
                <input className="input flex-1 min-w-[10rem] font-mono" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0661 22 33 44" data-testid="website-blocked-phone" />
                <input className="input flex-1 min-w-[10rem]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('website.blocked.note')} maxLength={120} />
                <Button size="sm" onClick={() => block(phone, note)} disabled={!phone.trim()} loading={busy === 'block'} data-testid="website-blocked-add">{t('website.blocked.add')}</Button>
            </div>
            {list.length === 0 ? <p className="text-sm text-zinc-500">{t('website.blocked.none')}</p> : (
                <ul className="divide-y divide-white/5" data-testid="website-blocked-list">
                    {list.map(b => (
                        <li key={b.phone} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0"><bdi dir="ltr" className="font-mono">{b.phone}</bdi>{b.note && <span className="ms-2 text-xs text-zinc-500">{b.note}</span>}</span>
                            <Button size="sm" variant="ghost" onClick={() => run('unblock', () => window.electronAPI.website.unblockPhone({ phone: b.phone }))} data-testid={`website-unblock-${b.phone}`}>{t('website.blocked.remove')}</Button>
                        </li>
                    ))}
                </ul>
            )}
            {suggested.length > 0 && (
                <div className="space-y-2" data-testid="website-blocked-suggested">
                    <p className="text-xs text-amber-300">{t('website.blocked.suggested')}</p>
                    <ul className="divide-y divide-white/5">
                        {suggested.map(c => (
                            <li key={c.phone} className="flex items-center justify-between gap-3 py-2 text-sm">
                                <span className="min-w-0"><bdi>{c.name}</bdi> <bdi dir="ltr" className="font-mono text-zinc-400">{c.phone}</bdi>
                                    <span className="ms-2 text-xs text-amber-300">{t('website.customers.returnedN', { n: c.returned })}</span></span>
                                <Button size="sm" variant="ghost" onClick={() => block(c.phone, t('website.blocked.autoNote'))}>{t('website.blocked.add')}</Button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </SettingsCard>
    );
}

/** A size guide per category, the "few left" level, coupons on the website. */
function SizeGuidesCard({ site, busy, run }) {
    const { t } = useT();
    const cats = site.categoriesList || [];
    const saved = site.publicInfo?.sizeGuides || [];
    const fromSaved = () => Object.fromEntries(saved.map(g => [g.categoryId, g.text]));
    const [texts, setTexts] = useState(fromSaved);
    const [few, setFew] = useState(String(site.publicInfo?.fewLeftAt ?? 3));
    useEffect(() => { setTexts(fromSaved()); }, [JSON.stringify(saved)]);
    const save = () => run('sizes', () => window.electronAPI.website.setSettings({
        sizeGuides: Object.entries(texts).filter(([, v]) => String(v || '').trim()).map(([categoryId, text]) => ({ categoryId, text })),
        fewLeftAt: Math.min(20, Math.max(1, parseInt(few, 10) || 3)),
    }), () => toast.success(t('website.info.saved')));
    return (
        <SettingsCard testId="website-sizes" icon={Shirt} title={t('website.sizes.title')} hint={t('website.sizes.hint')} onSave={save} saving={busy === 'sizes'}>
            <label className="flex items-center gap-3 text-sm">
                <span className="text-zinc-300">{t('website.sizes.fewAt')}</span>
                <input className="input w-20" type="number" min="1" max="20" value={few} onChange={(e) => setFew(e.target.value)} data-testid="website-few-at" />
            </label>
            {cats.length === 0 ? <p className="text-sm text-zinc-500">{t('website.sizes.noCategories')}</p> : cats.map(c => (
                <label key={c.id} className="block space-y-1">
                    <span className="text-xs text-zinc-400"><bdi>{c.name}</bdi></span>
                    <textarea className="input w-full" rows={3} maxLength={800} value={texts[c.id] || ''} onChange={(e) => setTexts(x => ({ ...x, [c.id]: e.target.value }))}
                        placeholder={t('website.sizes.placeholder')} data-testid={`website-size-guide-${c.id}`} />
                </label>
            ))}
        </SettingsCard>
    );
}

/** The couriers: their tracking pages, and Yalidine's own account (to send parcels from AFUS). */
function CourierApiCard({ site, busy, run }) {
    const { t } = useT();
    const saved = site.tools?.trackingLinks || {};
    const [links, setLinks] = useState(saved);
    const [key, setKey] = useState({ id: '', token: '', fromWilaya: '' });
    useEffect(() => { setLinks(saved); }, [JSON.stringify(saved)]);
    const companies = (site.couriersList || []).map(c => c.name);
    const linked = !!site.tools?.yalidine?.linked;
    return (
        <div className="space-y-4">
            <SettingsCard testId="website-tracking-links" icon={Package} title={t('website.couriers.linksTitle')} hint={t('website.couriers.linksHint')}
                onSave={() => run('links', () => window.electronAPI.website.setSettings({ trackingLinks: links }), (next) => {
                    const kept = next?.tools?.trackingLinks || {};
                    const refused = Object.entries(links).filter(([k, v]) => String(v || '').trim() && !kept[k]).map(([k]) => k);
                    if (refused.length) toast.error(t('website.couriers.linkRefused', { list: refused.join('، ') }), 7000);
                    else toast.success(t('website.info.saved'));
                })} saving={busy === 'links'}>
                {companies.map(name => (
                    <label key={name} className="block space-y-1">
                        <span className="text-xs text-zinc-400" dir="ltr">{name}</span>
                        <input className="input w-full font-mono text-xs" dir="ltr" value={links[name] || ''} onChange={(e) => setLinks(l => ({ ...l, [name]: e.target.value }))}
                            placeholder="https://…{number}" maxLength={300} data-testid={`website-tracking-link-${name.replace(/\W+/g, '-')}`} />
                    </label>
                ))}
            </SettingsCard>
            <SettingsCard testId="website-yalidine" icon={KeyRound} title={t('website.couriers.yalidineTitle')} hint={t('website.couriers.yalidineHint')}>
                {linked ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="badge bg-emerald-500/15 text-emerald-300" data-testid="website-yalidine-linked">{t('website.couriers.linked', { when: formatDate(site.tools.yalidine.linkedAt, 'date') })}</span>
                        <Button size="sm" variant="ghost" loading={busy === 'yforget'} onClick={() => run('yforget', () => window.electronAPI.website.yalidineForget())}>{t('website.couriers.forget')}</Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input className="input font-mono" dir="ltr" placeholder="API ID" value={key.id} onChange={(e) => setKey(k => ({ ...k, id: e.target.value }))} autoComplete="off" data-testid="website-yalidine-id" />
                        <input className="input font-mono" dir="ltr" type="password" placeholder="API TOKEN" value={key.token} onChange={(e) => setKey(k => ({ ...k, token: e.target.value }))} autoComplete="off" data-testid="website-yalidine-token" />
                        <input className="input" placeholder={t('website.couriers.fromWilaya')} value={key.fromWilaya} onChange={(e) => setKey(k => ({ ...k, fromWilaya: e.target.value }))} data-testid="website-yalidine-from" />
                        <div className="sm:col-span-3 flex justify-end">
                            <Button size="sm" loading={busy === 'ylink'} disabled={!key.id || !key.token} data-testid="website-yalidine-link"
                                onClick={() => run('ylink', () => window.electronAPI.website.yalidineLink(key), () => { setKey({ id: '', token: '', fromWilaya: '' }); toast.success(t('website.couriers.linkedOk')); })}>
                                {t('website.couriers.link')}
                            </Button>
                        </div>
                    </div>
                )}
                <p className="text-xs text-zinc-500">{t('website.couriers.yalidineNote')}</p>
            </SettingsCard>
        </div>
    );
}
