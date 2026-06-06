import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Brandfull } from '../../components/Brand';
import { Field } from '../../components/forms';
import { Button, Container, VegMark } from '../../components/ui';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { signIn, signUp } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { Role } from '../../lib/types';
import { useThemeColors } from '../../theme';

export default function SignInScreen() {
  const toast = useToast();
  const c = useThemeColors();
  const { refreshProfile } = useAuth();

  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [flat, setFlat] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [upi, setUpi] = useState('');
  const [roles, setRoles] = useState<Role[]>(['foodie']);
  const [busy, setBusy] = useState(false);

  const toggleRole = (r: Role) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const submit = async () => {
    if (!isSupabaseConfigured) {
      toast.show('Supabase isn’t configured yet ⚙️');
      return;
    }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) return toast.show('Enter a valid phone number');
    if (!/^\d{6}$/.test(code)) return toast.show('Your code must be exactly 6 digits');

    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(phone, code);
      } else {
        if (!name.trim()) {
          setBusy(false);
          return toast.show('Please enter your name');
        }
        const chosen = roles.length ? roles : (['foodie'] as Role[]);
        await signUp({ phone, code, name, flat, whatsapp, upi, roles: chosen });
      }
      await refreshProfile();
      // (auth)/_layout will redirect once the session is live.
    } catch (e) {
      toast.show(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-bg" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20 }} keyboardShouldPersistTaps="handled">
        <Container narrow>
          <View className="mb-7 items-center">
            <Brandfull />
            <Text className="mt-3 text-center text-[14px] leading-5 text-muted">
              {mode === 'in'
                ? 'Welcome back to our society’s kitchen 🍲\nSign in with your phone & 6-digit code.'
                : 'Good home food, cooked by neighbours you know 🍲\nJoin with your phone & a 6-digit code.'}
            </Text>
          </View>

          {/* mode switch */}
          <View className="mb-5 flex-row rounded-2xl bg-inset p-1">
            {(['in', 'up'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} className={`flex-1 rounded-xl py-2.5 ${mode === m ? 'bg-surface' : ''}`}>
                <Text className={`text-center text-[14px] ${mode === m ? 'font-sans-sb text-ink' : 'font-sans-md text-muted'}`}>
                  {m === 'in' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field label="Phone number" required placeholder="98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
          <Field
            label="6-digit code"
            required
            hint={mode === 'up' ? 'Choose any 6 digits — your secret code to sign in.' : undefined}
            placeholder="••••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
          />

          {mode === 'up' ? (
            <>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field label="Your name" required placeholder="Priya Sharma" value={name} onChangeText={setName} />
                </View>
                <View className="w-28">
                  <Field label="Flat" placeholder="A-204" value={flat} onChangeText={setFlat} />
                </View>
              </View>
              <Field label="WhatsApp" hint="For order coordination" placeholder="98765 43210" keyboardType="phone-pad" value={whatsapp} onChangeText={setWhatsapp} />
              <Field label="UPI ID" hint="Optional — so neighbours can pay you" autoCapitalize="none" placeholder="priya@ybl" value={upi} onChangeText={setUpi} />

              <Text className="mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted">I want to…</Text>
              <View className="mb-4 flex-row gap-2.5">
                <RolePick label="Order food" sublabel="as a Foodie" icon="bag-handle-outline" active={roles.includes('foodie')} onPress={() => toggleRole('foodie')} c={c} />
                <RolePick label="Cook & sell" sublabel="as a Chef" leading={<VegMark type="Veg" size={16} />} active={roles.includes('chef')} onPress={() => toggleRole('chef')} c={c} />
              </View>
            </>
          ) : null}

          <Button
            label={busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Create account'}
            size="lg"
            fullWidth
            loading={busy}
            onPress={submit}
          />

          <Pressable onPress={() => setMode(mode === 'in' ? 'up' : 'in')} className="mt-4">
            <Text className="text-center text-[13px] text-muted">
              {mode === 'in' ? "New here? " : 'Already have an account? '}
              <Text className="font-sans-sb text-accent">{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
            </Text>
          </Pressable>
        </Container>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RolePick({
  label,
  sublabel,
  icon,
  leading,
  active,
  onPress,
  c,
}: {
  label: string;
  sublabel: string;
  icon?: keyof typeof Ionicons.glyphMap;
  leading?: React.ReactNode;
  active: boolean;
  onPress: () => void;
  c: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 rounded-2xl border-[1.5px] p-3 ${active ? 'border-accent bg-accent-soft' : 'border-line bg-inset'}`}
    >
      <View className="mb-1.5 flex-row items-center justify-between">
        {leading ?? <Ionicons name={icon!} size={20} color={active ? c.accent : c.muted} />}
        <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? c.accent : c.faint} />
      </View>
      <Text className="font-sans-sb text-[14px] text-ink">{label}</Text>
      <Text className="text-[11px] text-faint">{sublabel}</Text>
    </Pressable>
  );
}
