import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useAuthStore } from '../../stores/authStore';

/**
 * A slim bar for the owner only when the weekly "Check the figures"
 * (electron/services/figuresWatch.js) found something that does not add up.
 * It stays until a new check (weekly or by hand) finds everything right;
 * closed for this login only. Employees never see it.
 */
export default function FiguresAlert() {
    const { t } = useT();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const owner = useAuthStore(state => state.currentEmployee?.role === 'admin');
    const userId = useAuthStore(state => state.currentEmployee?.id);
    const [last, setLast] = useState(null);
    const [closed, setClosed] = useState(false);
    useEffect(() => { setClosed(false); }, [userId]);
    useEffect(() => {
        if (!owner || !window.electronAPI?.figures?.last) { setLast(null); return undefined; }
        const read = () => window.electronAPI.figures.last().then(setLast).catch(() => setLast(null));
        read();
        // A check made by hand in Settings › Backup updates the bar at once
        window.addEventListener('afus:figures-checked', read);
        return () => window.removeEventListener('afus:figures-checked', read);
    }, [owner, userId, pathname]);

    if (!owner || !last || last.ok || closed) return null;
    return (
        <div data-testid="figures-alert" role="status"
            className="shrink-0 bg-red-500/15 border-b border-red-500/30 text-red-200 px-4 py-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span className="min-w-0">{t('figures.weeklyAlert', { n: last.failed?.length || 1 })}</span>
            <span className="ms-auto flex items-center gap-1">
                <button type="button" onClick={() => navigate('/settings?tab=backup')}
                    className="rounded-md bg-red-500/20 px-2.5 py-0.5 font-semibold hover:bg-red-500/30" data-testid="figures-alert-open">{t('figures.weeklyOpen')}</button>
                <button type="button" onClick={() => setClosed(true)} aria-label={t('common.close')} title={t('common.close')}
                    className="rounded-md p-1 hover:bg-red-500/20"><X className="w-4 h-4" /></button>
            </span>
        </div>
    );
}
