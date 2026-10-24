import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '../../i18n';

/**
 * Tabs. Controlled with `value` + `onChange`, or uncontrolled with
 * `defaultTab`. variant: 'pills' (default) or 'underline'.
 * tabs: [{ id, label, icon?, count? }]
 *
 * Always one line: the tabs that do not fit go into a "More" menu (the open
 * tab always stays in sight), so none is cut, hidden or put on a second line.
 */
export function Tabs({ tabs, value, defaultTab, onChange, variant = 'pills', className = '', testId = '' }) {
    const { t } = useT();
    const [internal, setInternal] = useState(defaultTab || tabs[0]?.id);
    const active = value ?? internal;
    const boxRef = useRef(null);
    const measureRef = useRef(null);
    const moreRef = useRef(null);
    const [fit, setFit] = useState(tabs.length);
    const [open, setOpen] = useState(false);
    const underline = variant === 'underline';
    const signature = tabs.map(tab => `${tab.id}:${tab.label}:${tab.count ?? ''}`).join('|');

    const select = (id) => {
        setOpen(false);
        if (value === undefined) setInternal(id);
        onChange?.(id);
    };

    // How many tabs fit, from their real width (drawn once, out of sight)
    useLayoutEffect(() => {
        const box = boxRef.current, measure = measureRef.current;
        if (!box || !measure) return undefined;
        const compute = () => {
            const items = [...measure.children];
            const more = items.pop().getBoundingClientRect().width;
            const style = getComputedStyle(measure);
            const gap = parseFloat(style.columnGap) || 0;
            const frame = parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd) + parseFloat(style.borderInlineStartWidth) + parseFloat(style.borderInlineEndWidth);
            const widths = items.map(el => el.getBoundingClientRect().width);
            const room = box.clientWidth - frame;
            const all = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, widths.length - 1);
            if (all <= room + 0.5) { setFit(widths.length); return; }
            let used = more, n = 0;
            for (const w of widths) {
                if (used + gap + w > room) break;
                used += gap + w; n += 1;
            }
            setFit(Math.max(1, n));
        };
        compute();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(compute);
        observer.observe(box);
        observer.observe(measure);
        return () => observer.disconnect();
    }, [signature, variant]);

    // The menu closes on a click elsewhere or Escape
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!moreRef.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
    }, [open]);

    const at = tabs.findIndex(tab => tab.id === active);
    let shown = tabs.map((_, i) => i).slice(0, fit);
    if (at >= fit && fit > 0) shown = [...shown.slice(0, fit - 1), at];
    const hidden = tabs.map((_, i) => i).filter(i => !shown.includes(i));

    const tabClass = (on) => underline
        ? `relative flex flex-none items-center gap-2 px-3 h-10 text-sm font-medium whitespace-nowrap transition-colors ${on ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'}`
        : `flex flex-none items-center gap-2 ${on ? 'active' : ''}`;
    const content = (tab, on) => (
        <>
            {tab.icon && <tab.icon className="w-4 h-4 flex-none" />}
            {tab.label}
            {tab.count !== undefined && (underline
                ? <span className="badge bg-dark-tertiary text-zinc-400">{tab.count}</span>
                : <span className="text-xs text-zinc-500 tabular">{tab.count}</span>)}
            {underline && on && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-400" />}
        </>
    );
    const barClass = underline
        ? 'flex items-center gap-1 border-b border-dark-border'
        : 'segmented';
    const moreOn = hidden.includes(at);

    return (
        <div ref={boxRef} className={`relative w-full min-w-0 [contain:inline-size] ${className}`}>
            {/* Every tab, out of sight (and taking no room): their widths decide how many fit */}
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden invisible pointer-events-none">
                <div ref={measureRef} className={`${barClass} absolute top-0 start-0 w-max border-transparent`} style={{ maxWidth: 'none' }}>
                    {tabs.map(tab => <button key={tab.id} type="button" tabIndex={-1} className={tabClass(tab.id === active)}>{content(tab, false)}</button>)}
                    <button type="button" tabIndex={-1} className={tabClass(false)}>{t('nav.more')} <ChevronDown className="w-4 h-4" /></button>
                </div>
            </div>
            <div className={`${barClass} ${underline ? '' : 'max-w-full'}`} role="tablist">
                {shown.map(i => {
                    const tab = tabs[i];
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={active === tab.id}
                            onClick={() => select(tab.id)}
                            data-testid={testId ? `${testId}-${tab.id}` : undefined}
                            className={tabClass(active === tab.id)}
                        >
                            {content(tab, active === tab.id)}
                        </button>
                    );
                })}
                {hidden.length > 0 && (
                    <div ref={moreRef} className="segmented-slot relative flex-none">
                        <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={open}
                            onClick={() => setOpen(v => !v)}
                            className={tabClass(moreOn)}
                            data-testid={testId ? `${testId}-more` : undefined}
                        >
                            {t('nav.more')} <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                            <div role="menu" className="absolute top-full end-0 mt-1 z-40 min-w-[12rem] p-1 rounded-lg bg-dark-secondary border border-dark-border shadow-xl shadow-black/40 flex flex-col">
                                {hidden.map(i => {
                                    const tab = tabs[i];
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="menuitem"
                                            onClick={() => select(tab.id)}
                                            data-testid={testId ? `${testId}-${tab.id}` : undefined}
                                            className="flex items-center gap-2 h-9 px-3 rounded-md text-sm text-start whitespace-nowrap text-zinc-300 hover:bg-dark-tertiary hover:text-white"
                                        >
                                            {tab.icon && <tab.icon className="w-4 h-4 flex-none" />}
                                            <span className="flex-1">{tab.label}</span>
                                            {tab.count !== undefined && <span className="text-xs text-zinc-500 tabular">{tab.count}</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function TabsContainer({ children }) {
    return <div className="space-y-4">{children}</div>;
}

export function TabPanel({ children, isActive }) {
    if (!isActive) return null;
    return <div className="animate-fade-in">{children}</div>;
}
