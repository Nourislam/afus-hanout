import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * The list that opens under a button (the "More" of the tabs, the Excel files
 * of a screen). Drawn above everything, so a window or a scrolling box never
 * cuts it; opens upwards when there is no room below. A click elsewhere, a
 * scroll, or Escape closes it (Escape closes only the list, not the window
 * under it). `anchorRef`: the element it opens from (its end side lines up).
 */
export function Menu({ open, onClose, anchorRef, children, className = 'min-w-[12rem]' }) {
    const menuRef = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    const [place, setPlace] = useState(null);

    useLayoutEffect(() => {
        if (!open) { setPlace(null); return; }
        const anchor = anchorRef.current, menu = menuRef.current;
        if (!anchor || !menu) return;
        const r = anchor.getBoundingClientRect();
        const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
        const up = menu.offsetHeight > below && above > below;
        const rtl = getComputedStyle(anchor).direction === 'rtl';
        setPlace({
            ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
            ...(rtl ? { left: Math.max(8, r.left) } : { right: Math.max(8, window.innerWidth - r.right) }),
            maxHeight: Math.max(120, up ? above : below),
        });
    }, [open, anchorRef]);

    useEffect(() => {
        if (!open) return undefined;
        const inside = (node) => menuRef.current?.contains(node) || anchorRef.current?.contains(node);
        const onDown = (e) => { if (!inside(e.target)) closeRef.current?.(); };
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            e.stopPropagation();
            closeRef.current?.();
            anchorRef.current?.querySelector('button')?.focus();
        };
        const onScroll = (e) => { if (!menuRef.current?.contains(e.target)) closeRef.current?.(); };
        const onResize = () => closeRef.current?.();
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        document.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open, anchorRef]);

    if (!open) return null;
    return createPortal(
        <div ref={menuRef} role="menu" style={place || { top: 0, left: 0, visibility: 'hidden' }}
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
            className="flex flex-none items-center gap-2 h-9 px-3 rounded-md text-sm text-start whitespace-nowrap text-zinc-300 hover:bg-dark-tertiary hover:text-white">
            {children}
        </button>
    );
}

export default Menu;
