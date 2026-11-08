import { useState, useEffect } from 'react';
import { CreditCard, Banknote, FileText, Gift, Smartphone } from 'lucide-react';
import { useCartStore } from '../../stores/cartStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { toast } from '../ui/Toast';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalBody, ModalFooter } from '../ui/Modal';
import { NumPad } from '../ui/NumPad';
import { DatePicker } from '../ui/DatePicker';
import { paymentLabel, quickCashAmounts, cashReceived, baridiPayProblem } from '../../lib/payments';
import { BARIDI_PAY_MIN, centimesLabel, CHANGE_KEEP_MAX } from '../../../electron/shared/grocery.ts';
import { methodAllowed, resolvePosControls } from '../../lib/posControls';
import { formatMoney } from '../../i18n/format';
import { t, currentLanguage } from '../../i18n';

/**
 * Payment: cash (amount received, change), card CIB/Edahabia, Baridi Pay,
 * customer credit and gift cards, with split payments.
 */
export default function PaymentModal({ isOpen, onClose, total, onComplete }) {
    const features = useSettingsStore(state => state.settings.features);
    // Card, transfer and kridi can be turned off by the owner (Settings › Sales screen)
    const posControls = useSettingsStore(state => state.settings.pos_controls);
    const showCentimes = resolvePosControls(posControls).showCentimes;
    const lang = currentLanguage();
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [smsReceived, setSmsReceived] = useState(false);
    // Change under 5 DA: given (default) or written on the customer's name
    const [keepChange, setKeepChange] = useState(false);
    // Change kept for this customer on earlier tickets
    const [changeBalance, setChangeBalance] = useState(0);
    const [cashAmount, setCashAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [creditInfo, setCreditInfo] = useState(null);
    const [loadingCredit, setLoadingCredit] = useState(false);
    const [dueDate, setDueDate] = useState('');

    // Gift Card States
    const [giftCardCode, setGiftCardCode] = useState('');
    const [giftCardBalance, setGiftCardBalance] = useState(null);
    const [giftCardError, setGiftCardError] = useState(null);
    const [checkingGiftCard, setCheckingGiftCard] = useState(false);

    // Split Payments
    const [splitPayments, setSplitPayments] = useState([]);
    // The shop's Baridi Pay QR code (Settings › Sales screen), as a picture
    const [baridiQr, setBaridiQr] = useState(null);

    const paidAmount = splitPayments.reduce((sum, p) => sum + p.amount, 0);
    const remainingDue = total - paidAmount;
    // The SMS confirms one amount: when the amount changes, it must be ticked again
    useEffect(() => { setSmsReceived(false); }, [remainingDue]);

    // Auto-complete if fully paid (handled in render/effect, or check in addPayment)

    const cart = useCartStore();

    useEffect(() => {
        if (isOpen) {
            // Each opening starts again in cash: a Baridi Pay SMS ticked before a Cancel never pays another amount
            setPaymentMethod('cash');
            setCashAmount('');
            setSmsReceived(false);
            setKeepChange(false);
            setChangeBalance(0);
            window.electronAPI.settings.get('baridi_qr')
                .then(name => (name ? window.electronAPI.images.get(name) : null))
                .then(data => setBaridiQr(data || null)).catch(() => setBaridiQr(null));
            const customerId = useCartStore.getState().customer?.id;
            if (customerId) window.electronAPI.changeBalance?.get(customerId).then(b => setChangeBalance(Number(b) || 0)).catch(() => {});
            // Reservation picked up: its deposit is already paid
            const reservation = useCartStore.getState().reservation;
            setSplitPayments(reservation && reservation.deposit > 0
                ? [{ method: 'deposit', amount: Math.min(reservation.deposit, total), reference: reservation.number }]
                : []);
            loadCustomers();
            // If cart already has a customer selected, use that
            if (cart.customer) {
                setSelectedCustomer(cart.customer);
                if (paymentMethod === 'credit') {
                    loadCreditInfo(cart.customer.id);
                }
            }
        }
    }, [isOpen]);

    useEffect(() => {
        if (selectedCustomer && paymentMethod === 'credit') {
            loadCreditInfo(selectedCustomer.id);
            // Default due date: 30 days from now
            const date = new Date();
            date.setDate(date.getDate() + 30);
            setDueDate(date.toISOString().split('T')[0]);
        } else {
            setCreditInfo(null);
        }
    }, [selectedCustomer, paymentMethod]);

    const loadCustomers = async () => {
        try {
            const data = await window.electronAPI.customers.getAll();
            setCustomers(data);
        } catch (error) {
            console.error('Failed to load customers:', error);
        }
    };

    const loadCreditInfo = async (customerId) => {
        setLoadingCredit(true);
        try {
            const info = await window.electronAPI.customerCredit.getCreditInfo(customerId);
            setCreditInfo(info);
        } catch (error) {
            console.error('Failed to load credit info:', error);
            setCreditInfo(null);
        } finally {
            setLoadingCredit(false);
        }
    };

    const checkGiftCardBalance = async () => {
        if (!giftCardCode) return;
        setCheckingGiftCard(true);
        setGiftCardError(null);
        try {
            const card = await window.electronAPI.giftCards.getByCode(giftCardCode);
            if (card && card.is_active) {
                setGiftCardBalance(card.current_balance);
                if (card.current_balance < remainingDue) {
                    // Just informational, allowing partial payment now
                }
            } else {
                setGiftCardError(t('pos.giftInvalid'));
                setGiftCardBalance(null);
            }
        } catch {
            setGiftCardError(t('pos.giftCheckFailed'));
        } finally {
            setCheckingGiftCard(false);
        }
    };

    const formatCurrency = (amount) => {
        return formatMoney(amount);
    };

    // Nothing typed = the exact amount: the big button or Enter finishes the sale
    const cashValue = cashReceived(cashAmount, remainingDue);
    const change = cashValue - remainingDue;
    const ticketCustomer = cart.customer || selectedCustomer;
    const smallChange = paymentMethod === 'cash' && change > 0.004 && change < CHANGE_KEEP_MAX;

    const filteredCustomers = customers.filter(c =>
        c.name?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone?.includes(customerSearch) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const canProcessCredit = () => {
        if (!selectedCustomer) return false;
        if (!creditInfo) return false;
        // Above the limit the sale still goes on, with a manager's PIN
        return !!creditInfo.credit_enabled;
    };

    const handlePayment = async () => {
        // Handle Partial Gift Card
        if (paymentMethod === 'gift_card') {
            if (!giftCardBalance) return;

            const amountToPay = Math.min(giftCardBalance, remainingDue);

            // Add to split payments
            const newPayment = {
                method: 'gift_card',
                amount: amountToPay,
                reference: giftCardCode
            };

            const newSplit = [...splitPayments, newPayment];
            setSplitPayments(newSplit);

            // Check if fully paid
            if (amountToPay >= remainingDue - 0.01) { // float tolerance
                // Fully paid
                await onComplete(newSplit, null, null);
            } else {
                // Partially paid
                setGiftCardCode('');
                setGiftCardBalance(null);
                setPaymentMethod('cash');
                toast.success(t('pos.giftApplied', { amount: formatCurrency(amountToPay) }));
            }
            return;
        }

        if (paymentMethod === 'cash' && cashValue < remainingDue) {
            toast.error(t('pos.insufficientCash'));
            return;
        }

        // Baridi Pay: 100 DA at least, and the SMS of Algérie Poste arrived
        const baridi = paymentMethod === 'transfer' ? baridiPayProblem(remainingDue, smsReceived) : null;
        if (baridi) {
            toast.error(t(baridi));
            return;
        }

        if (paymentMethod === 'credit') {
            if (!selectedCustomer) {
                toast.error(t('pos.selectCustomerCredit'));
                return;
            }
            if (!creditInfo?.credit_enabled) {
                toast.error(t('pos.noCreditEnabled'));
                return;
            }
            // Above the limit: the main process asks a manager's PIN
        }

        setLoading(true);
        try {
            const finalPayment = {
                method: paymentMethod,
                // For cash: record the SALE amount (what stays in drawer), not the tendered amount
                amount: remainingDue,
                // Cash keeps the amount handed over, printed on the receipt with the change
                reference: paymentMethod === 'cash' ? JSON.stringify({ tendered: cashValue }) : null
            };

            const allPayments = [...splitPayments, finalPayment];

            // For credit sales, set the customer on cart before processing
            if (paymentMethod === 'credit' && selectedCustomer) {
                cart.setCustomer(selectedCustomer);
            }

            // Change under 5 DA written on the customer's name instead of given
            const changeKept = paymentMethod === 'cash' && keepChange && smallChange && ticketCustomer ? Math.round(change * 100) / 100 : 0;
            await onComplete(allPayments, paymentMethod === 'credit' ? selectedCustomer : null, dueDate, { changeKept });
            resetForm();
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setCashAmount('');
        setPaymentMethod('cash');
        setSmsReceived(false);
        setSelectedCustomer(null);
        setCreditInfo(null);
        setGiftCardCode('');
        setGiftCardBalance(null);
        setGiftCardError(null);
        setSplitPayments([]);
    };

    const quickCashValues = quickCashAmounts(remainingDue);
    const methods = [
        { id: 'cash', icon: Banknote, label: t('pay.cash'), active: 'border-accent-primary bg-accent-primary/10' },
        { id: 'card', icon: CreditCard, label: t('pay.cardCib'), active: 'border-accent-primary bg-accent-primary/10' },
        { id: 'transfer', icon: Smartphone, label: t('pay.transferShort'), active: 'border-accent-primary bg-accent-primary/10' },
        ...(features?.credit !== false ? [{ id: 'credit', icon: FileText, label: t('pay.credit'), active: 'border-amber-500 bg-amber-500/10' }] : []),
        ...(features?.giftCards ? [{ id: 'gift_card', icon: Gift, label: t('pay.giftCard'), active: 'border-purple-500 bg-purple-500/10' }] : []),
    ].filter(m => methodAllowed(posControls, m.id));

    const amountBox = (value, tone = 'text-white') => <bdi className={`tabular ${tone}`}>{formatCurrency(value)}</bdi>;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('pos.payment')} size="xl" closeOnOverlay={false}>
            <ModalBody>
                <div className="space-y-5">
                    {/* Amount to collect */}
                    <div className="rounded-2xl bg-dark-tertiary px-5 py-4 flex flex-wrap items-end justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm text-zinc-400">{splitPayments.length > 0 ? t('pos.remaining') : t('pos.totalAmount')}</p>
                            <p className="text-4xl font-bold leading-tight">{amountBox(remainingDue, 'text-accent-primary')}</p>
                            {/* As people say it: 250 DA = «25 ألف» */}
                            {showCentimes && centimesLabel(remainingDue, lang) && <p className="text-lg text-zinc-300 font-semibold" data-testid="pay-centimes">{centimesLabel(remainingDue, lang)}</p>}
                        </div>
                        {splitPayments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {splitPayments.map((p, i) => (
                                    <span key={i} className="badge badge-success">{paymentLabel(p.method)} · <bdi>{formatCurrency(p.amount)}</bdi></span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Payment method: one row, same size for every method */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={t('pos.paymentMethod')}>
                        {methods.map(m => (
                            <button
                                key={m.id}
                                type="button"
                                role="radio"
                                aria-checked={paymentMethod === m.id}
                                onClick={() => setPaymentMethod(m.id)}
                                title={m.label}
                                className={`h-[72px] px-2 rounded-xl border-2 transition-colors flex flex-col items-center justify-center gap-1.5 min-w-0
                                    ${paymentMethod === m.id ? m.active : 'border-dark-border hover:border-zinc-600'}`}
                            >
                                <m.icon className="w-5 h-5 flex-none" />
                                <span className="text-xs font-medium leading-tight text-center line-clamp-2">{m.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Change kept for this customer on an earlier ticket: one press takes it off */}
                    {changeBalance > 0 && remainingDue > 0.004 && !splitPayments.some(p => p.method === 'change_balance') && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2" data-testid="change-balance">
                            <span className="text-sm">{t('change.balanceOf', { name: cart.customer?.name || '', amount: formatCurrency(changeBalance) })}</span>
                            <Button size="sm" onClick={() => setSplitPayments([...splitPayments, { method: 'change_balance', amount: Math.min(changeBalance, Math.round(remainingDue * 100) / 100) }])}>
                                {t('change.use')}
                            </Button>
                        </div>
                    )}
                    {paymentMethod === 'cash' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-3">
                                <p className="text-sm text-zinc-400">{t('pos.cashReceived')}</p>
                                <div className="rounded-xl bg-dark-tertiary border border-dark-border px-4 h-16 flex items-center justify-end">
                                    <span className="text-3xl font-bold">{amountBox(parseFloat(cashAmount) || 0)}</span>
                                </div>
                                {showCentimes && centimesLabel(parseFloat(cashAmount) || 0, lang) && <p className="text-sm text-zinc-400 text-end">{centimesLabel(parseFloat(cashAmount) || 0, lang)}</p>}
                                {/* Quick amounts: exact, then the next round notes */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button type="button"
                                        onClick={() => setCashAmount(String(Math.round(remainingDue * 100) / 100))}
                                        className="h-11 px-2 rounded-lg bg-accent-primary/15 text-accent-primary font-medium hover:bg-accent-primary/25 transition-colors truncate">
                                        {t('pos.exact')}
                                    </button>
                                    {quickCashValues.map(val => (
                                        <button key={val} type="button" onClick={() => setCashAmount(val.toString())}
                                            className="h-11 px-2 rounded-lg bg-dark-tertiary hover:bg-zinc-700 font-medium transition-colors truncate">
                                            <bdi className="tabular">{formatCurrency(val)}</bdi>
                                        </button>
                                    ))}
                                </div>
                                <div className={`rounded-xl px-4 py-3 flex items-center justify-between gap-3 ${cashValue <= 0 ? 'bg-dark-tertiary/60' : change >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                    <span className="text-sm text-zinc-400">{cashValue > 0 && change < 0 ? t('pos.amountDue') : t('pos.change')}</span>
                                    <span className={`text-2xl font-bold ${cashValue <= 0 ? 'text-zinc-500' : change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {amountBox(cashValue > 0 ? Math.abs(change) : 0, '')}
                                    </span>
                                </div>
                                {/* Coins under 5 DA are rare: give it, or write it on the customer's name */}
                                {smallChange && (
                                    <div className="grid grid-cols-2 gap-2" data-testid="small-change">
                                        <Button variant={keepChange ? 'secondary' : 'primary'} onClick={() => setKeepChange(false)}>{t('change.give')}</Button>
                                        <Button variant={keepChange ? 'primary' : 'secondary'} onClick={() => setKeepChange(true)} disabled={!ticketCustomer}
                                            title={ticketCustomer ? undefined : t('change.needCustomer')} data-testid="small-change-keep">
                                            {ticketCustomer ? t('change.keepFor', { name: ticketCustomer.name }) : t('change.keep')}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <NumPad value={cashAmount} onChange={setCashAmount} onEnter={handlePayment} thousand={showCentimes} />
                        </div>
                    )}

                    {(paymentMethod === 'credit' || paymentMethod === 'gift_card') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-3 min-w-0">
                        {/* Gift Card Input */}
                                {paymentMethod === 'gift_card' && (
                                    <div className="space-y-3">
                                        <p className="text-sm text-zinc-400">{t('pos.scanGift')}</p>
                                        <div className="flex gap-2">
                                            <Input
                                                value={giftCardCode}
                                                onChange={(e) => setGiftCardCode(e.target.value)}
                                                placeholder={t('pos.scanOrEnter')}
                                                className="flex-1"
                                                data-scan-passthrough
                                                autoFocus
                                            />
                                            <Button onClick={checkGiftCardBalance} disabled={!giftCardCode || checkingGiftCard}>
                                                {checkingGiftCard ? t('pos.checking') : t('pos.check')}
                                            </Button>
                                        </div>
                                        {giftCardError && (
                                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                                {giftCardError}
                                            </div>
                                        )}
                                        {giftCardBalance !== null && !giftCardError && (
                                            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                                                <p className="text-sm text-purple-300">{t('pos.availableBalance')}</p>
                                                <p className="text-2xl font-bold text-purple-400">{formatCurrency(giftCardBalance)}</p>
                                                {giftCardBalance < total && (
                                                    <p className="text-xs text-red-400 mt-2">{t('pos.insufficientGift')}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                        {/* Credit Sale - Customer Selection */}
                                {paymentMethod === 'credit' && (
                                    <div className="space-y-3">
                                        <p className="text-sm text-zinc-400">{t('pos.selectCustomer')}</p>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder={t('pos.searchCustomer')}
                                                value={selectedCustomer ? selectedCustomer.name : customerSearch}
                                                onChange={(e) => {
                                                    setCustomerSearch(e.target.value);
                                                    setSelectedCustomer(null);
                                                    setShowCustomerDropdown(true);
                                                }}
                                                onFocus={() => setShowCustomerDropdown(true)}
                                                className="input w-full"
                                            />
                                            {showCustomerDropdown && customerSearch && filteredCustomers.length > 0 && (
                                                <div className="absolute z-10 w-full mt-1 bg-dark-secondary border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                    {filteredCustomers.map(customer => (
                                                        <button
                                                            key={customer.id}
                                                            onClick={() => {
                                                                setSelectedCustomer(customer);
                                                                setCustomerSearch('');
                                                                setShowCustomerDropdown(false);
                                                            }}
                                                            className="w-full px-4 py-3 text-start hover:bg-dark-tertiary flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <p className="font-medium">{customer.name}</p>
                                                                <p className="text-xs text-zinc-500">{customer.phone || customer.email}</p>
                                                            </div>
                                                            {customer.credit_enabled ? (
                                                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">{t('pos.creditOk')}</span>
                                                            ) : null}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Credit Info Display */}
                                        {selectedCustomer && (
                                            <div className={`p-4 rounded-xl ${creditInfo?.credit_enabled ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                                                {loadingCredit ? (
                                                    <p className="text-center text-zinc-400">{t('pos.loadingCredit')}</p>
                                                ) : creditInfo ? (
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-zinc-400">{t('pos.creditStatus')}</span>
                                                            <span className={`text-sm font-medium ${creditInfo.credit_enabled ? 'text-green-400' : 'text-red-400'}`}>
                                                                {creditInfo.credit_enabled ? t('pos.enabled') : t('pos.notEnabled')}
                                                            </span>
                                                        </div>
                                                        {creditInfo.credit_enabled && (
                                                            <>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm text-zinc-400">{t('pos.creditLimitLabel')}</span>
                                                                    <span className="font-medium">{creditInfo.credit_limit > 0 ? formatCurrency(creditInfo.credit_limit) : t('partners.creditAllowedNoLimit')}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-sm text-zinc-400">{t('pos.currentBalance')}</span>
                                                                    <span className="font-medium text-amber-400">{formatCurrency(creditInfo.credit_balance)}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center pt-2 border-t border-dark-border">
                                                                    <span className="text-sm font-medium">{t('pos.availableCredit')}</span>
                                                                    <span className={`font-bold ${creditInfo.credit_limit <= 0 || creditInfo.available_credit >= total ? 'text-green-400' : 'text-red-400'}`}>
                                                                        {creditInfo.credit_limit > 0 ? formatCurrency(Math.max(0, creditInfo.available_credit)) : '—'}
                                                                    </span>
                                                                </div>

                                                                <div className="flex justify-between items-center pt-2">
                                                                    <span className="text-sm text-zinc-400">{t('pos.dueDate')}</span>
                                                                    <div className="w-40">
                                                                        <DatePicker
                                                                            value={dueDate}
                                                                            onChange={setDueDate}
                                                                            className="w-full"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                {creditInfo.credit_limit > 0 && creditInfo.available_credit < total && (
                                                                    <p className="text-xs text-red-400 mt-2">
                                                                        {t('pos.insufficientCredit')}
                                                                    </p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-center text-zinc-400">{t('pos.noCreditInfo')}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                    {paymentMethod === 'credit' && (
                        <div className="flex items-center justify-center rounded-xl bg-dark-tertiary/40 p-6">
                            <div className="text-center">
                                <FileText className="w-20 h-20 mx-auto mb-4 text-amber-500/50" />
                                <p className="text-zinc-400">
                                    {selectedCustomer
                                        ? canProcessCredit()
                                            ? t('pos.creditReady')
                                            : t('pos.creditCannot')
                                        : t('pos.selectCustomerContinue')}
                                </p>
                                {selectedCustomer && canProcessCredit() && (
                                    <p className="text-sm text-amber-400 mt-2">
                                        {t('pos.invoiceAuto')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {paymentMethod === 'gift_card' && (
                        <div className="flex items-center justify-center rounded-xl bg-dark-tertiary/40 p-6">
                            <div className="text-center">
                                <Gift className="w-20 h-20 mx-auto mb-4 text-purple-500/50" />
                                <p className="text-zinc-400">
                                    {giftCardBalance !== null
                                        ? t('pos.giftBalance', { amount: formatCurrency(giftCardBalance) })
                                        : t('pos.scanToCheck')}
                                </p>
                                {giftCardBalance !== null && giftCardBalance < remainingDue && (
                                    <p className="text-sm text-amber-400 mt-2">
                                        {t('pos.partialAvailable')}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                        </div>
                    )}

                    {(paymentMethod === 'card' || paymentMethod === 'transfer') && (
                        <div className="flex items-center justify-center rounded-xl bg-dark-tertiary/40 p-8">
                            <div className="text-center">
                                {paymentMethod === 'card'
                                    ? <CreditCard className="w-20 h-20 mx-auto mb-4 text-zinc-600" />
                                    : baridiQr
                                        // The shop's Baridi Pay code, for the customer to scan from this screen
                                        ? <img src={baridiQr} alt={t('baridi.title')} className="w-56 h-56 mx-auto mb-4 rounded-xl bg-white p-2 object-contain" data-testid="baridi-qr" />
                                        : <Smartphone className="w-20 h-20 mx-auto mb-4 text-zinc-600" />}
                                <p className="text-zinc-400">{paymentMethod === 'card' ? t('pos.cardReady') : t('pos.transferReady')}</p>
                                {paymentMethod === 'transfer' && (remainingDue < BARIDI_PAY_MIN
                                    ? <p className="mt-3 text-amber-300 font-semibold" data-testid="baridi-min">{t('pay.baridiMin')}</p>
                                    : (
                                        <label className="mt-4 inline-flex items-center gap-3 text-lg cursor-pointer" data-testid="baridi-sms">
                                            <input type="checkbox" className="w-6 h-6" checked={smsReceived} onChange={(e) => setSmsReceived(e.target.checked)} />
                                            {t('pay.smsReceived')}
                                        </label>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" onClick={onClose}>
                    {t('common.cancel')}
                </Button>
                <Button
                    variant={paymentMethod === 'credit' ? 'primary' : paymentMethod === 'gift_card' ? 'primary' : 'success'}
                    loading={loading}
                    onClick={handlePayment}
                    disabled={
                        (paymentMethod === 'cash' && cashValue < remainingDue) ||
                        (paymentMethod === 'transfer' && !!baridiPayProblem(remainingDue, smsReceived)) ||
                        (paymentMethod === 'credit' && !canProcessCredit()) ||
                        (paymentMethod === 'gift_card' && !giftCardBalance)
                    }
                >
                    {paymentMethod === 'credit' ? t('pos.createCredit') :
                        paymentMethod === 'gift_card' ? (giftCardBalance < remainingDue ? t('pos.applyPartial') : t('pos.redeemGift')) :
                            t('pos.complete')}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
