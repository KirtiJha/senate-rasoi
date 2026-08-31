import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { openPhotoPicker } from '../lib/photo';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useToast } from '../context/toast';
import { updateTiffinPlan } from '../lib/tiffin';
import { SLOT_EMOJI, SLOTS, Slot, TiffinPlan, VEG_TYPES, VegType } from '../lib/types';
import { useThemeColors } from '../theme';
import { Button, Sheet, TimeField } from './ui';

const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // 0 = Sunday … 6 = Saturday

/** Edit a tiffin plan (owner or admin). Reused from the chef's manager and the food board. */
export function TiffinEditSheet({ plan, visible, onClose, onSaved }: { plan: TiffinPlan; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const c = useThemeColors();
  const toast = useToast();
  const [title, setTitle] = useState(plan.title);
  const [desc, setDesc] = useState(plan.description ?? '');
  const [veg, setVeg] = useState<VegType>(plan.veg_type);
  const [slot, setSlot] = useState<Slot>(plan.slot);
  const [price, setPrice] = useState(String(plan.price));
  const [maxPerDay, setMaxPerDay] = useState(String(plan.max_per_day));
  const [days, setDays] = useState<number[]>(plan.days_of_week);
  const [cutoff, setCutoff] = useState(plan.cutoff_time ?? '');
  const [photo, setPhoto] = useState<{ uri: string; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(plan.title); setDesc(plan.description ?? ''); setVeg(plan.veg_type); setSlot(plan.slot);
    setPrice(String(plan.price)); setMaxPerDay(String(plan.max_per_day)); setDays(plan.days_of_week); setCutoff(plan.cutoff_time ?? '');
    setPhoto(plan.photo_url ? { uri: plan.photo_url, isNew: false } : null);
  }, [visible, plan.id]);

  const pickPhoto = async () => {
    const res = await openPhotoPicker({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [4, 3] });
    if (!res.canceled) setPhoto({ uri: res.assets[0].uri, isNew: true });
  };

  const toggleDay = (d: number) => setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const save = async () => {
    if (!title.trim()) return toast.show('Add a title');
    if (!days.length) return toast.show('Pick at least one day');
    const p = parseInt(price.replace(/\D/g, ''), 10);
    const m = parseInt(maxPerDay.replace(/\D/g, ''), 10);
    setSaving(true);
    try {
      await updateTiffinPlan(plan.id, {
        title, description: desc || null, vegType: veg, slot,
        price: Number.isFinite(p) ? p : plan.price,
        maxPerDay: Number.isFinite(m) ? m : plan.max_per_day,
        daysOfWeek: days, cutoffTime: cutoff.trim() || null,
        photoUri: photo === null ? null : photo.uri,
      });
      toast.show('Tiffin updated ✓'); onSaved();
    } catch { toast.show('Could not save'); } finally { setSaving(false); }
  };

  const input = 'rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink';
  const label = 'mb-1.5 text-[11px] font-sans-sb uppercase tracking-wider text-muted';

  return (
    <Sheet visible={visible} onClose={onClose} title="Edit tiffin">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
        <Text className={label}>Photo</Text>
        <View className="mb-3 flex-row items-center gap-3">
          <Pressable onPress={pickPhoto} className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line bg-surface active:opacity-70">
            {photo ? <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="camera-outline" size={22} color={c.accent} />}
          </Pressable>
          <View className="flex-1 gap-1.5">
            <Pressable onPress={pickPhoto} hitSlop={6} className="self-start"><Text className="text-[13px] font-sans-sb text-accent">{photo ? 'Change photo' : 'Add a photo'}</Text></Pressable>
            {photo ? <Pressable onPress={() => setPhoto(null)} hitSlop={6} className="self-start"><Text className="text-[13px] font-sans-sb text-nonveg">Remove</Text></Pressable> : null}
          </View>
        </View>
        <Text className={label}>Title</Text>
        <TextInput value={title} onChangeText={setTitle} className={`mb-3 ${input}`} style={{ outline: 'none' } as any} />
        <Text className={label}>Description</Text>
        <TextInput value={desc} onChangeText={setDesc} multiline className={`mb-3 ${input}`} style={{ minHeight: 56, outline: 'none' } as any} />
        <View className="mb-3 flex-row gap-3">
          <View className="flex-1"><Text className={label}>Price ₹/day</Text><TextInput value={price} onChangeText={setPrice} keyboardType="number-pad" className={input} style={{ outline: 'none' } as any} /></View>
          <View className="flex-1"><Text className={label}>Max / day</Text><TextInput value={maxPerDay} onChangeText={setMaxPerDay} keyboardType="number-pad" className={input} style={{ outline: 'none' } as any} /></View>
        </View>
        <Text className={label}>Meal</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {SLOTS.map((s) => { const on = slot === s; return (
            <Pressable key={s} onPress={() => setSlot(s)} className="rounded-full border px-3 py-1.5" style={{ borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }}>
              <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{SLOT_EMOJI[s]} {s}</Text>
            </Pressable>); })}
        </View>
        <Text className={label}>Type</Text>
        <View className="mb-3 flex-row flex-wrap gap-2">
          {VEG_TYPES.map((v) => { const on = veg === v; return (
            <Pressable key={v} onPress={() => setVeg(v)} className="rounded-full border px-3 py-1.5" style={{ borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }}>
              <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{v}</Text>
            </Pressable>); })}
        </View>
        <Text className={label}>Days served</Text>
        <View className="mb-3 flex-row gap-1.5">
          {DAY_INITIALS.map((d, i) => { const on = days.includes(i); return (
            <Pressable key={i} onPress={() => toggleDay(i)} className="h-9 w-9 items-center justify-center rounded-full border" style={{ borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }}>
              <Text className="text-[12px] font-sans-sb" style={{ color: on ? '#fff' : c.muted }}>{d}</Text>
            </Pressable>); })}
        </View>
        <Text className={label}>Order cutoff (optional, e.g. 21:00)</Text>
        <View className="mb-4">
          <TimeField value={cutoff || null} onChange={(v) => setCutoff(v ?? '')} placeholder="No cut-off" />
        </View>
        <Button label="Save changes" icon="checkmark" fullWidth loading={saving} onPress={save} />
      </ScrollView>
    </Sheet>
  );
}
