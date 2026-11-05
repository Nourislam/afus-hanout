import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';
import { codeOfMessage } from '../../i18n/errors';
import { actionForCode, ERROR_ACTIONS } from '../../lib/errorActions';
import { t } from '../../i18n';

const iconMap = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
};

const colorMap = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
};

export function Toast({ toast }) {
    const { removeToast } = useToastStore();
    const Icon = iconMap[toast.type] || Info;
    // An error says what to do: one button that opens the right place
    // A success may also carry one button ({ label, to }), e.g. "Open" after turning an add-on on
    const action = toast.type === 'error'
        ? (typeof toast.action === 'string' ? ERROR_ACTIONS[toast.action] : toast.action) || actionForCode(codeOfMessage(toast.message))
        : toast.action?.to || toast.action?.run ? toast.action : null;

    return (
        <div
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm animate-slide-up ${colorMap[toast.type]}`}
        >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <p className="flex-1 text-sm font-medium whitespace-pre-line">{toast.message}</p>
            {action && (
                <button type="button" data-testid="toast-action"
                    onClick={() => { if (action.run) action.run(); else window.location.hash = `#${action.to}`; removeToast(toast.id); }}
                    className="flex-shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold hover:bg-white/20 whitespace-nowrap">
                    {t(action.label)}
                </button>
            )}
            <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}

export function Toaster() {
    const { toasts } = useToastStore();

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 end-4 z-[100] flex flex-col gap-2 max-w-sm">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    );
}

export const toast = {
    success: (message, duration, action) => useToastStore.getState().success(message, duration, action),
    // action: one of ERROR_ACTIONS (lib/errorActions.js) or { label, to }; else found from the error's code
    error: (message, duration, action) => useToastStore.getState().error(message, duration ?? (action || actionForCode(codeOfMessage(message)) ? 8000 : undefined), action),
    warning: (message, duration) => useToastStore.getState().warning(message, duration),
    info: (message, duration, action) => useToastStore.getState().info(message, duration, action),
    loading: (message) => useToastStore.getState().addToast(message, 'info', 0),
    dismiss: (id) => useToastStore.getState().removeToast(id),
};
