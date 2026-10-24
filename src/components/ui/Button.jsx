import { Loader2 } from 'lucide-react';

const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    success: 'btn-success',
    danger: 'btn-danger',
    warning: 'btn-warning',
    ghost: 'btn-ghost',
};

// Fixed heights (32 / 40 / 48 / 56): side by side, buttons and fields line up
const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4',
    lg: 'h-12 px-6 text-lg',
    xl: 'h-14 px-8 text-xl',
    icon: 'h-10 w-10 px-0',
    iconSm: 'h-8 w-8 px-0',
};

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    className = '',
    ...props
}) {
    return (
        <button
            className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children}
        </button>
    );
}

export function IconButton({
    icon: Icon,
    variant = 'ghost',
    size = 'icon',
    className = '',
    ...props
}) {
    return (
        <button
            className={`btn ${variants[variant]} ${sizes[size]} ${className}`}
            {...props}
        >
            <Icon className="w-5 h-5" />
        </button>
    );
}
