import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/auth';
import { useToast } from '../context/toast';
import { NewPayment, createPayment, upiUri } from '../lib/payments';
import { useThemeColors } from '../theme';
import { Button, Sheet, useResponsive } from './ui';

export interface Payee {
  id: string;
  name: string;
  upi: string | null;
}
type Ctx = { type: 'dish' | 'tiffin' | 'listing' | 'other'; id?: string | null };

/** A "Pay ₹X via UPI" button that opens a payment sheet. Records the payment so
 *  both parties can track it; the receiver confirms receipt separately. */
export function PayButton({
  payee, amount, note, context, label, variant = 'outline', size = 'md', fullWidth, onPaid,
}: {
  payee: Payee | null;
  amount: number;
  note?: string;
  context?: Ctx;
  label?: string;
  variant?: 'primary' | 'outline' | 'whatsapp' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  onPaid?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (!payee || amount <= 0) return null;
  return (
    <>
      <Button
        label={label ?? `Pay ₹${amount}`}
        icon="card-outline"
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onPress={() => setOpen(true)}
      />
      <PaySheet visible={open} onClose={() => setOpen(false)} payee={payee} defaultAmount={amount} note={note} context={context} onPaid={onPaid} />
    </>
  );
}

export function PaySheet({
  visible, onClose, payee, defaultAmount, note, context, onPaid,
}: {
  visible: boolean;
  onClose: () => void;
  payee: Payee;
  defaultAmount: number;
  note?: string;
  context?: Ctx;
  onPaid?: () => void;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const { isDesktop } = useResponsive();
  const { userId, communityId } = useAuth();
  const [amountStr, setAmountStr] = useState(String(defaultAmount));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (visible) setAmountStr(String(defaultAmount)); }, [visible, defaultAmount]);

  const amount = Math.round(parseFloat(amountStr || '0') * 100) / 100;
  const valid = amount > 0;
  const link = payee.upi && valid ? upiUri(payee.upi, payee.name, amount, note) : '';

  const openUpiApp = () => { if (link) Linking.openURL(link).catch(() => toast.show('No UPI app found')); };

  const copyUpi = () => {
    if (!payee.upi) return;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(payee.upi).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
    }
  };

  const record = async () => {
    if (!userId || !communityId || !valid) return;
    setBusy(true);
    try {
      const input: NewPayment = {
        communityId, payerId: userId, payeeId: payee.id, amount,
        note: note ?? null, contextType: context?.type ?? 'other', contextId: context?.id ?? null, upiId: payee.upi,
      };
      await createPayment(input);
      onClose();
      toast.show('Payment recorded — awaiting confirmation 🕓');
      onPaid?.();
    } catch { toast.show('Could not record — try again'); }
    finally { setBusy(false); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={`Pay ${payee.name.split(' ')[0]}`}
      footer={
        payee.upi ? (
          <Button label={busy ? 'Recording…' : `I've paid ₹${valid ? amount : ''} — record it`} loading={busy} fullWidth disabled={!valid} onPress={record} />
        ) : undefined
      }
    >
      {!payee.upi ? (
        <View className="items-center py-6">
          <Ionicons name="card-outline" size={32} color={c.faint} />
          <Text className="mt-3 text-center text-[14px] text-muted">{payee.name} hasn't added a UPI ID yet. Ask them for it to pay directly.</Text>
        </View>
      ) : (
        <>
          <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">Amount (₹)</Text>
          <View className="mb-4 flex-row items-center rounded-2xl border border-line bg-inset px-3.5">
            <Text className="font-display-x text-[20px] text-muted">₹</Text>
            <TextInput
              value={amountStr}
              onChangeText={setAmountStr}
              keyboardType="decimal-pad"
              className="flex-1 py-2.5 pl-1 font-display-x text-[20px] text-ink"
              style={{ outline: 'none' } as any}
            />
          </View>

          {note ? <Text className="mb-4 text-[13px] text-muted">For: {note}</Text> : null}

          {isDesktop ? (
            <View className="items-center rounded-2xl border border-line bg-surface p-4">
              {valid ? (
                <View className="rounded-xl bg-white p-3">
                  <QRCode value={link} size={180} />
                </View>
              ) : null}
              <Text className="mt-3 text-center text-[13px] text-muted">Scan with any UPI app to pay</Text>
              <Pressable onPress={copyUpi} className="mt-2 flex-row items-center gap-1.5 rounded-full bg-inset px-3 py-1.5 active:opacity-70">
                <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={c.muted} />
                <Text className="text-[13px] font-sans-sb text-ink">{copied ? 'Copied' : payee.upi}</Text>
              </Pressable>
            </View>
          ) : (
            <Button label="Pay via UPI app" icon="open-outline" variant="whatsapp" fullWidth disabled={!valid} onPress={openUpiApp} />
          )}

          <Text className="mt-3 text-center text-[11px] leading-4 text-faint">
            Pays {payee.name} directly via UPI. After paying, tap “record it” so they can confirm receipt.
          </Text>
        </>
      )}
    </Sheet>
  );
}
