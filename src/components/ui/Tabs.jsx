import { useContext, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useT } from '../../i18n';
import { Menu, MenuItem } from './Menu';
import { ToolbarContext } from './PageHeader';

/**
 * Tabs. Controlled with `value` + `onChange`, or uncontrolled with
 * `defaultTab`. variant: 'pills' (default) or 'underline'.
 * tabs: [{ id, label, icon?, count? }]
 *
 * Always one line: the tabs that do not fit go into a "More" menu (the open
 * tab always stays in sight), so none is cut, hidden or put on a second line.
 * In the top row of a screen they keep room for a few tabs: the buttons
 * beside them go to the next line first.
 */
export function Tabs({ tabs, value, defaultTab, onChange, variant = 'pills', className = '', testId = '' }) {
    const { t } = useT();
    const inToolbar = useContext(ToolbarContext);
    const [internal, setInternal] = useState(defaultTab || tabs[0]?.id);
    const active = value ?? internal;
    const boxRef = useRef(null);
    const measureRef = useRef(null);
    const moreRef = useRef(null);
    // The width of each tab (measured once per set of tabs) and the room there is
    const [sizes, setSizes] = useState(null);
    const [room, setRoom] = useState(0);
    const [open, setOpen] = useState(false);
    const underline = variant === 'underline';
    const signature = tabs.map(tab => `${tab.id}:${tab.label}:${tab.count ?? ''}`).join('|');

    const select = (id) => {
        setOpen(false);
        if (value === undefined) setInternal(id);
        onChange?.(id);
    };

    // The tabs drawn once, out of sight: again only when they change (or the font loads)
    useLayoutEffect(() => {
        const measure = measureRef.current;
        if (!measure) return undefined;
        // The layout width (not the drawn one: a window still growing in would give less)
        const width = (el) => parseFloat(getComputedStyle(el).width) || 0;
        const read = () => {
            const items = [...measure.children];
            const more = width(items.pop());
            const style = getComputedStyle(measure);
            const frame = parseFloat(style.paddingInlineStart) + parseFloat(style.paddingInlineEnd) + parseFloat(style.borderInlineStartWidth) + parseFloat(style.borderInlineEndWidth);
            const widths = items.map(width);
            setSizes({ widths, more, gap: parseFloat(style.columnGap) || 0, frame, all: width(measure) });
        };
        read();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(read);
        observer.observe(measure);
        return () => observer.disconnect();
    }, [signature, variant]);

    // The room follows the window
    useLayoutEffect(() => {
        const box = boxRef.current;
        if (!box) return undefined;
        const read = () => setRoom(box.clientWidth);
        read();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(read);
        observer.observe(box);
        return () => observer.disconnect();
    }, []);

    // The open tab first, then the others in their order, as long as they fit with "More"
    const at = tabs.findIndex(tab => tab.id === active);
    let shown = tabs.map((_, i) => i);
    if (sizes && room && sizes.all > room + 0.5) {
        const { widths, more, gap, frame } = sizes;
        const keep = new Set(at >= 0 ? [at] : []);
        let used = frame + more + (at >= 0 ? gap + widths[at] : 0);
        for (let i = 0; i < widths.length; i += 1) {
            if (i === at) continue;
            if (used + gap + widths[i] > room) break;
            used += gap + widths[i];
            keep.add(i);
        }
        shown = shown.filter(i => keep.has(i));
    }
    const hidden = tabs.map((_, i) => i).filter(i => !shown.includes(i));
    // Every tab fits again: the list is closed (it must not open by itself later)
    useLayoutEffect(() => { if (!hidden.length) setOpen(false); }, [hidden.length]);

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
        ? 'flex flex-nowrap items-center gap-1 border-b border-dark-border'
        : 'segmented';
    // In the top row: room for all the tabs, or at least for a few of them
    const minWidth = inToolbar && sizes ? `min(${Math.ceil(sizes.all)}px, 26rem)` : undefined;

    return (
        <div ref={boxRef} className={`relative w-full min-w-0 [contain:inline-size] ${className}`} style={{ minWidth }}>
            {/* Every tab, out of sight (and taking no room): their widths decide how many fit */}
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden invisible pointer-events-none">
                <div ref={measureRef} className={`${barClass} absolute top-0 start-0 w-max border-transparent`} style={{ maxWidth: 'none' }}>
                    {tabs.map(tab => <button key={tab.id} type="button" tabIndex={-1} className={tabClass(false)}>{content(tab, false)}</button>)}
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
                    <div ref={moreRef} className="segmented-slot flex-none">
                        <button
                            type="button"
                            aria-haspopup="menu"
                            aria-expanded={open}
                            onClick={() => setOpen(v => !v)}
                            className={tabClass(false)}
                            data-testid={testId ? `${testId}-more` : undefined}
                        >
                            {t('nav.more')} <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        <Menu open={open} onClose={() => setOpen(false)} anchorRef={moreRef}>
                            {hidden.map(i => {
                                const tab = tabs[i];
                                return (
                                    <MenuItem key={tab.id} onClick={() => select(tab.id)} testId={testId ? `${testId}-${tab.id}` : undefined}>
                                        {tab.icon && <tab.icon className="w-4 h-4 flex-none" />}
                                        <span className="flex-1">{tab.label}</span>
                                        {tab.count !== undefined && <span className="text-xs text-zinc-500 tabular">{tab.count}</span>}
                                    </MenuItem>
                                );
                            })}
                        </Menu>
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
