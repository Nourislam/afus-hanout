// A service (flexy, a bill paid…): the amount the customer asks for, one
// press for the usual ones. Added as one line; no stock.
import { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumPad } from '../ui/NumPad';
import { t } from '../../i18n';
import { formatMoney } from '../../i18n/format';

export interface ServiceArticle { id: string; name: string }

interface Props {
    product: ServiceArticle | null;
    onClose: () => void;
    onAmount: (amount: number) => void;
}

/** The amounts asked most for a flexy. */
const QUICK_AMOUNTS = [100, 200, 500, 1000];

export default function ServiceAmountModal({ product, onClose, onAmount }: Props) {
    const [amount, setAmount] = useState('');
    useEffect(() => { setAmount(''); }, [product?.id]);
    if (!product) return null;
    const value = Number(amount) || 0;
    const add = (v: number) => { if (v > 0) onAmount(v); };
    return (
        <Modal isOpen={!!product} onClose={onClose} title={product.name} size="sm">
            <ModalBody className="space-y-4">
                <p className="text-4xl font-bold tabular text-center" data-testid="service-amount">{formatMoney(value)}</p>
                <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map(a => <Button key={a} variant="secondary" onClick={() => add(a)}>{formatMoney(a)}</Button>)}
                </div>
                <NumPad value={amount} onChange={setAmount} onEnter={() => add(value)} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={() => add(value)} disabled={!(value > 0)} data-testid="service-add">{t('pos.addLine')}</Button>
            </ModalFooter>
        </Modal>
    );
}
