// Weighing an article sold by weight: type its weight in kg (or press a
// common weight), see its price, add it as one line.
import { useEffect, useState } from 'react';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { NumPad } from '../ui/NumPad';
import { t } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { weighedPrice } from '../../../electron/shared/grocery.ts';
import { weightLabel } from '../../lib/units';
import { useCartStore } from '../../stores/cartStore';

export { weightLabel };

export interface Weighable { id: string; name: string; price: number; wholesale_price?: number | null }

interface Props {
    product: Weighable | null;
    onClose: () => void;
    onWeighed: (grams: number) => void;
}

/** The weights a shop weighs most, one press each. */
const QUICK_GRAMS = [250, 500, 1000, 2000];

const gramsOf = (kg: string): number => Math.round((parseFloat(kg) || 0) * 1000);


export default function WeightModal({ product, onClose, onWeighed }: Props) {
    const [kg, setKg] = useState('');
    const wholesale = useCartStore(state => !!state.customer?.is_wholesale);
    useEffect(() => { setKg(''); }, [product?.id]);
    if (!product) return null;
    // The price per kg this customer pays (a wholesale customer: the wholesale one)
    const perKg = wholesale && Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : product.price;

    const grams = gramsOf(kg);
    const add = (g: number) => { if (g > 0) onWeighed(g); };

    return (
        <Modal isOpen={!!product} onClose={onClose} title={t('pos.weighTitle', { name: product.name })} size="sm">
            <ModalBody className="space-y-4">
                <div className="text-center">
                    <p className="text-4xl font-bold tabular ltr" data-testid="weight-value">
                        {kg || '0'} <span className="text-lg text-zinc-400">{t('pos.kg')}</span>
                    </p>
                    <p className="text-zinc-400 tabular ltr">{formatMoney(weighedPrice(perKg, grams))}</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {QUICK_GRAMS.map(g => (
                        <Button key={g} variant="secondary" onClick={() => add(g)} data-testid={`weight-quick-${g}`}>
                            {weightLabel(g)}
                        </Button>
                    ))}
                </div>
                <NumPad value={kg} onChange={setKg} onEnter={() => add(grams)} maxLength={6} />
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
                <Button onClick={() => add(grams)} disabled={!(grams > 0)} data-testid="weight-add">{t('pos.addWeighed')}</Button>
            </ModalFooter>
        </Modal>
    );
}
