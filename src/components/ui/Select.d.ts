// Types of the shared Select (Select.jsx stays JavaScript; TypeScript reads this).
import type { ReactNode } from 'react';

export interface SelectOption<V extends string = string> { value: V; label: ReactNode }
export function Select<V extends string = string>(props: {
    label?: ReactNode;
    value: V;
    onChange: (value: V) => void;
    options: SelectOption<V>[];
    placeholder?: ReactNode;
    error?: ReactNode;
    className?: string;
}): JSX.Element;
