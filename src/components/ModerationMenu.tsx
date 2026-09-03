import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Button, Sheet } from './ui';
import { useAuth } from '../context/auth';
import { useBlocks } from '../context/blocks';
import { useConfirm } from '../context/confirm';
import { useToast } from '../context/toast';
import {
  REPORT_REASONS, ReportReason, ReportTargetType, blockUser, reportContent,
} from '../lib/moderation';
import { useThemeColors } from '../theme';

/**
 * The "⋯" overflow control that gives every piece of user-generated content a
 * Report and Block action — required by App Store Guideline 1.2. Renders
 * nothing on your own content, and nothing when signed out.
 */
export function ModerationMenu({
  targetType, targetId, targetOwnerId, targetOwnerName, size = 18, tint,
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetOwnerId: string | null;
  targetOwnerName?: string | null;
  size?: number;
  tint?: string;
}) {
  const c = useThemeColors();
  const toast = useToast();
  const confirm = useConfirm();
  const { userId, communityId } = useAuth();
  const { refresh: refreshBlocks } = useBlocks();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [saving, setSaving] = useState(false);

  // Nothing to moderate on your own content.
  if (!userId || (targetOwnerId && targetOwnerId === userId)) return null;

  const who = targetOwnerName?.trim() || 'this neighbour';

  const submitReport = async () => {
    if (!reason) return toast.show('Pick a reason');
    setSaving(true);
    try {
      await reportContent({
        communityId,
        reporterId: userId,
        targetType,
        targetId,
        targetOwnerId,
        reason,
        details: details || null,
      });
      setReportOpen(false);
      setReason(null);
      setDetails('');
      toast.show('Reported — your society admins will review it 🚩');
    } catch {
      toast.show('Could not send the report — try again');
    } finally {
      setSaving(false);
    }
  };

  const doBlock = async () => {
    if (!targetOwnerId) return;
    setMenuOpen(false);
    const ok = await confirm({
      title: `Block ${who}?`,
      message: `You won't see their posts, listings or messages, and they won't see yours. You can undo this in Profile → Blocked members.`,
      confirmLabel: 'Block',
      destructive: true,
    });
    if (!ok) return;
    try {
      await blockUser(userId, targetOwnerId);
      refreshBlocks();
      toast.show(`Blocked ${who}`);
    } catch {
      toast.show('Could not block — try again');
    }
  };

  const row = 'flex-row items-center gap-3 rounded-2xl px-3.5 py-3.5 active:opacity-70';

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        hitSlop={8}
        accessibilityLabel="More options"
        className="h-8 w-8 items-center justify-center rounded-full active:bg-inset"
      >
        <Ionicons name="ellipsis-horizontal" size={size} color={tint ?? c.faint} />
      </Pressable>

      {/* Action menu */}
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Options">
        <Pressable
          onPress={() => { setMenuOpen(false); setReportOpen(true); }}
          className={row}
          style={{ backgroundColor: c.inset }}
        >
          <Ionicons name="flag-outline" size={19} color={c.ink} />
          <View className="flex-1">
            <Text className="font-sans-sb text-[14px] text-ink">Report this {label(targetType)}</Text>
            <Text className="font-sans text-[12px] text-muted">Send it to your society admins</Text>
          </View>
        </Pressable>

        {targetOwnerId ? (
          <Pressable onPress={doBlock} className={`mt-2 ${row}`} style={{ backgroundColor: '#EF444412' }}>
            <Ionicons name="ban-outline" size={19} color={c.danger} />
            <View className="flex-1">
              <Text className="font-sans-sb text-[14px] text-nonveg">Block {who}</Text>
              <Text className="font-sans text-[12px] text-muted">Hide their content and stop messages, both ways</Text>
            </View>
          </Pressable>
        ) : null}
      </Sheet>

      {/* Report reason picker */}
      <Sheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        title={`Report this ${label(targetType)}`}
        footer={
          <Button
            label={saving ? 'Sending…' : 'Send report'}
            icon="flag"
            fullWidth
            loading={saving}
            disabled={!reason}
            onPress={submitReport}
          />
        }
      >
        <Text className="font-sans mb-3 text-[13px] leading-[19px] text-muted">
          Reports go to your society admins. They can see what you reported and why.
        </Text>

        <View className="gap-2">
          {REPORT_REASONS.map((r) => {
            const on = reason === r.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setReason(r.key)}
                className="flex-row items-center gap-3 rounded-2xl border px-3.5 py-3"
                style={{ borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent + '12' : c.surface }}
              >
                <Ionicons
                  name={on ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={on ? c.accent : c.faint}
                />
                <View className="flex-1">
                  <Text className="font-sans-sb text-[14px] text-ink">{r.label}</Text>
                  <Text className="font-sans text-[12px] text-muted">{r.blurb}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text className="mb-1.5 mt-4 text-[11px] font-sans-sb uppercase tracking-wider text-muted">
          Anything else? (optional)
        </Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder="Add any detail that helps the admins"
          placeholderTextColor={c.faint}
          multiline
          className="rounded-2xl border border-line bg-inset px-3.5 py-2.5 text-[15px] text-ink"
          style={{ minHeight: 72, outline: 'none' } as any}
        />
      </Sheet>
    </>
  );
}

function label(t: ReportTargetType): string {
  switch (t) {
    case 'post': return 'post';
    case 'comment': return 'comment';
    case 'listing': return 'listing';
    case 'dish': return 'dish';
    case 'borrow': return 'item';
    case 'lost_found': return 'report';
    case 'recommend': return 'recommendation';
    case 'property': return 'property';
    case 'place': return 'place';
    case 'message': return 'conversation';
    case 'profile': return 'member';
    case 'directory_entry': return 'directory listing';
    default: return 'content';
  }
}
