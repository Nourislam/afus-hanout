// Settings › Phone and price checker: the shop's own server on its WiFi.
// Off until the owner turns it on. A device pairs once by scanning the QR
// code shown here (or typing its 6 digits on the price checker page).
import { useEffect, useState } from 'react';
import { Smartphone, Tablet, Trash2, QrCode, Wifi, WifiOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from '../ui/Toast';
import { t } from '../../i18n';
import { translateError } from '../../i18n/errors';
import { Switch } from './ModulesSettings';
import { secondsLeft, countdown } from '../../lib/devices';

interface PairedDevice { id: string; name: string; role: 'phone' | 'kiosk'; created_at: string; last_seen: string | null }
interface DevicesStatus { enabled: boolean; running: boolean; port: number; addresses: string[]; devices: PairedDevice[] }
interface Pairing { code: string; expiresAt: number; link: string; qr: string; kiosk: string }
interface DevicesBridge {
    status(): Promise<DevicesStatus>;
    enable(on: boolean): Promise<DevicesStatus>;
    pairingCode(): Promise<Pairing>;
    remove(id: string): Promise<DevicesStatus>;
}
const bridge = (): DevicesBridge => (window as unknown as { electronAPI: { devices: DevicesBridge } }).electronAPI.devices;

export function DevicesSettings() {
    const [status, setStatus] = useState<DevicesStatus | null>(null);
    const [pairing, setPairing] = useState<Pairing | null>(null);
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        let cancelled = false;
        bridge().status().then(s => { if (!cancelled) setStatus(s); }).catch(() => {});
        return () => { cancelled = true; };
    }, []);

    // The code's countdown; when it runs out the QR code goes away and the list is read again
    useEffect(() => {
        if (!pairing) return undefined;
        const timer = setInterval(() => {
            setNow(Date.now());
            bridge().status().then(setStatus).catch(() => {});
        }, 1000);
        return () => clearInterval(timer);
    }, [pairing]);
    const left = pairing ? secondsLeft(pairing.expiresAt, now) : 0;
    useEffect(() => { if (pairing && left <= 0) setPairing(null); }, [pairing, left]);

    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        try { await fn(); } catch (error) { toast.error(translateError(error)); } finally { setBusy(false); }
    };
    const toggle = (on: boolean) => run(async () => {
        setStatus(await bridge().enable(on));
        if (!on) setPairing(null);
    });
    const pair = () => run(async () => {
        const p = await bridge().pairingCode();
        setPairing(p);
        setNow(Date.now());
        setStatus(await bridge().status());
    });
    const remove = (device: PairedDevice) => run(async () => {
        setStatus(await bridge().remove(device.id));
        toast.success(t('devices.removed', { name: device.name }));
    });

    if (!status) return null;
    const address = status.addresses[0];

    return (
        <div className="space-y-5" data-testid="devices-settings">
            <label className="flex items-center justify-between gap-4 p-4 rounded-xl bg-dark-surface border border-dark-border cursor-pointer">
                <span className="flex items-center gap-3 min-w-0">
                    {status.running ? <Wifi className="w-5 h-5 text-emerald-400 flex-none" /> : <WifiOff className="w-5 h-5 text-zinc-500 flex-none" />}
                    <span className="min-w-0">
                        <span className="block font-medium text-white">{t('devices.enable')}</span>
                        <span className="block text-sm text-zinc-400">{status.running ? t('devices.on', { address: address ? `${address}:${status.port}` : '—' }) : t('devices.off')}</span>
                    </span>
                </span>
                <Switch checked={status.enabled} disabled={busy} onChange={toggle} label={t('devices.enable')} />
            </label>

            {status.enabled && !address && (
                <p className="text-sm text-amber-400" data-testid="devices-no-wifi">{t('devices.noWifi')}</p>
            )}

            {status.enabled && (
                <div className="space-y-3">
                    {!pairing ? (
                        <Button onClick={pair} loading={busy} data-testid="devices-pair"><QrCode className="w-4 h-4" />{t('devices.pair')}</Button>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-5 items-start p-4 rounded-xl bg-white/5 border border-dark-border" data-testid="devices-pairing">
                            {pairing.qr && (
                                // The QR code is drawn on this computer by bwip-js (no outside content)
                                <div className="bg-white p-2 rounded-lg w-48 h-48 flex-none [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: pairing.qr }} />
                            )}
                            <div className="space-y-3 min-w-0">
                                <p className="text-sm text-zinc-300">{t('devices.scan')}</p>
                                <p className="text-4xl font-bold tracking-[0.3em] text-white" dir="ltr" data-testid="devices-code">{pairing.code}</p>
                                <p className="text-xs text-zinc-500">{t('devices.validFor', { time: countdown(left) })}</p>
                                <p className="text-sm text-zinc-300">{t('devices.kioskHint')}</p>
                                <p className="text-sm font-mono text-indigo-300 break-all" dir="ltr">{pairing.kiosk}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-2">
                <h3 className="text-sm font-medium text-zinc-300">{t('devices.paired')}</h3>
                {status.devices.length === 0 ? (
                    <p className="text-sm text-zinc-500">{t('devices.none')}</p>
                ) : (
                    <ul className="divide-y divide-dark-border rounded-xl border border-dark-border" data-testid="devices-list">
                        {status.devices.map(d => {
                            const Icon = d.role === 'phone' ? Smartphone : Tablet;
                            return (
                                <li key={d.id} className="flex items-center gap-3 p-3">
                                    <Icon className="w-5 h-5 text-zinc-400 flex-none" />
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-white truncate">{d.name}</span>
                                        <span className="block text-xs text-zinc-500">{t(`devices.role.${d.role}`)}{d.last_seen ? ` · ${t('devices.lastSeen', { date: d.last_seen.slice(0, 16) })}` : ''}</span>
                                    </span>
                                    <Button variant="ghost" size="iconSm" onClick={() => remove(d)} disabled={busy} aria-label={t('devices.remove', { name: d.name })} title={t('devices.remove', { name: d.name })}><Trash2 className="w-4 h-4" /></Button>
                                </li>
                            );
                        })}
                    </ul>
                )}
                <p className="text-xs text-zinc-500">{t('devices.privacy')}</p>
            </div>
        </div>
    );
}
