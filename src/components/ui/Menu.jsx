import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The list that opens under a button (the "More" of the tabs, the Excel files
 * of a screen). Drawn above everything, so a window or a scrolling box never
 * cuts it; opens upwards when there is no room below, and stays inside the
 * window on both sides. It follows its button when the page scrolls or the
 * window changes; a click elsewhere or Escape closes it (Escape closes only
 * the list, not the window under it). With the keyboard: the first line gets
 * the focus, the arrows move, Tab or Escape go back to the button.
 * `anchorRef`: the element it opens from (its end side lines up).
 */
export function Menu({ open, onClose, anchorRef, children, className = 'min-w-[12rem]' }) {
    const menuRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const [place, setPlace] = useState(null);

    const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
    const back = () => { closeRef.current?.(); anchorRef.current?.querySelector('button')?.focus({ preventScroll: true }); };

    // Under (or above) the button, its end side lined up, kept inside the window
    const measure = () => {
        const anchor = anchorRef.current, menu = menuRef.current;
        if (!anchor || !menu) return;
        const r = anchor.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) { closeRef.current?.(); return; }
        const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
        const up = menu.offsetHeight > below && above > below;
        const width = Math.min(menu.offsetWidth, window.innerWidth - 16);
        const rtl = getComputedStyle(anchor).direction === 'rtl';
        const left = Math.min(Math.max(8, rtl ? r.left : r.right - width), window.innerWidth - width - 8);
        const next = {
            ...(up ? { bottom: Math.round(window.innerHeight - r.top + 4) } : { top: Math.round(r.bottom + 4) }),
            left: Math.round(left),
            maxWidth: window.innerWidth - 16,
            maxHeight: Math.max(120, Math.round(up ? above : below)),
        };
        setPlace(prev => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    useLayoutEffect(() => { if (!open) setPlace(null); }, [open]);
    // Again after every change of the page around it (the button may have moved)
    useLayoutEffect(() => { if (open) measure(); });

    // The first line gets the focus once the list is in place
    const placed = !!place;
    useEffect(() => {
        if (open && placed) items()[0]?.focus({ preventScroll: true });
    }, [open, placed]);

    useEffect(() => {
        if (!open) return undefined;
        const inside = (node) => menuRef.current?.contains(node) || anchorRef.current?.contains(node);
        const onDown = (e) => { if (!inside(e.target)) closeRef.current?.(); };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            back();
        };
        const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) measure(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', measure);
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure());
        if (menuRef.current) observer?.observe(menuRef.current);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', measure);
            observer?.disconnect();
        };
    }, [open, anchorRef]);

    const onMenuKey = (e) => {
        const list = items();
        const at = list.indexOf(document.activeElement);
        const go = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[e.key];
        if (go !== undefined && list.length) {
            e.preventDefault();
            list[(go + list.length) % list.length].focus();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            back();
        }
    };

    if (!open) return null;
    return createPortal(
        <div ref={menuRef} role="menu" onKeyDown={onMenuKey} style={place || { top: 0, left: 0, visibility: 'hidden' }}
            className={`fixed z-[60] overflow-y-auto p-1 rounded-lg bg-dark-secondary border border-dark-border shadow-xl shadow-black/40 flex flex-col ${className}`}>
            {children}
        </div>,
        document.body,
    );
}

/** One line of a Menu. */
export function MenuItem({ children, onClick, testId }) {
    return (
        <button type="button" role="menuitem" onClick={onClick} data-testid={testId}
            className="flex flex-none items-center gap-2 h-9 px-3 rounded-md text-sm text-start whitespace-nowrap text-zinc-300 hover:bg-dark-tertiary hover:text-white focus-visible:bg-dark-tertiary focus-visible:text-white focus:outline-none">
            {children}
        </button>
    );
}

export default Menu;
