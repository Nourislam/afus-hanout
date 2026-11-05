// Types of the shared Input (Input.jsx stays JavaScript; TypeScript reads this).
import type { ForwardRefExoticComponent, InputHTMLAttributes, RefAttributes, TextareaHTMLAttributes, ComponentType, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: ReactNode;
    error?: ReactNode;
    icon?: ComponentType<{ className?: string }>;
    containerClassName?: string;
}
export const Input: ForwardRefExoticComponent<InputProps & RefAttributes<HTMLInputElement>>;

export function SearchInput(props: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }): JSX.Element;

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: ReactNode; error?: ReactNode }
export function TextArea(props: TextAreaProps): JSX.Element;
