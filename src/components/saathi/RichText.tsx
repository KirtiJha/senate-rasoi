import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme';

/**
 * The small slice of markdown Saathi actually writes.
 *
 * WHY NOT A LIBRARY
 * The model emits bold, italics, inline code, bullet and numbered lists, and
 * the occasional heading — a handful of constructs, into a chat bubble. A
 * general markdown renderer brings tables, blockquotes, images, HTML passthrough
 * and its own typography to override, for output we control the shape of. This
 * is ~100 lines, has no dependency to keep current, and inherits the app's own
 * type scale instead of approximating it.
 *
 * WHY RENDER IT AT ALL, rather than telling the model to stop
 * Because a list of three plumbers should be a list. Suppressing markdown does
 * not make the answer plainer, it makes it worse — one long sentence with
 * commas where three lines belong. The fix for `**Ramesh**` showing up as
 * asterisks is to draw it bold, not to forbid emphasis.
 *
 * Deliberately NOT supported: links and images. Saathi points at result cards,
 * which are real navigation with real permissions behind them; a tappable URL
 * invented by a model is a phishing surface, and one assembled from a
 * neighbour's post text is worse.
 */

type Token = { text: string; bold?: boolean; italic?: boolean; code?: boolean };

/**
 * Inline emphasis. Ordered longest-marker-first so `**` is consumed before the
 * `*` rule can see it — otherwise bold parses as two empty italics.
 */
function tokenize(input: string): Token[] {
  const out: Token[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3|`([^`]+)`/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input)) !== null) {
    if (m.index > last) out.push({ text: input.slice(last, m.index) });
    if (m[2] != null) out.push({ text: m[2], bold: true });
    else if (m[4] != null) out.push({ text: m[4], italic: true });
    else if (m[5] != null) out.push({ text: m[5], code: true });
    last = m.index + m[0].length;
  }
  if (last < input.length) out.push({ text: input.slice(last) });
  return out;
}

function Inline({ text, size, color }: { text: string; size: number; color: string }) {
  const c = useThemeColors();
  return (
    <>
      {tokenize(text).map((t, i) => (
        <Text
          key={i}
          className={t.bold ? 'font-sans-bold' : t.code ? 'font-sans-md' : 'font-sans'}
          style={{
            fontSize: t.code ? size - 1 : size,
            lineHeight: size + 6,
            color: t.code ? c.accent : color,
            fontStyle: t.italic ? 'italic' : 'normal',
            backgroundColor: t.code ? c.inset : 'transparent',
          }}
        >
          {t.text}
        </Text>
      ))}
    </>
  );
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBER = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,4}\s+(.*)$/;

export function RichText({
  text,
  size = 14,
  color,
}: {
  text: string;
  size?: number;
  color?: string;
}) {
  const c = useThemeColors();
  const ink = color ?? c.ink;

  // Collapse runs of blank lines: the model sometimes double-spaces, which
  // leaves a chat bubble looking half empty.
  const lines = text.replace(/\n{3,}/g, '\n\n').split('\n');

  const blocks: React.ReactNode[] = [];
  let para: string[] = [];

  const flush = () => {
    if (!para.length) return;
    blocks.push(
      <Text key={`p${blocks.length}`} style={{ marginBottom: 2 }}>
        <Inline text={para.join(' ')} size={size} color={ink} />
      </Text>,
    );
    para = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }

    const h = line.match(HEADING);
    if (h) {
      flush();
      blocks.push(
        <Text key={`h${blocks.length}`} className="font-sans-bold" style={{ fontSize: size + 1, lineHeight: size + 8, color: ink, marginTop: blocks.length ? 6 : 0, marginBottom: 2 }}>
          {h[1]}
        </Text>,
      );
      continue;
    }

    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBER);
    if (b || n) {
      flush();
      blocks.push(
        <View key={`l${blocks.length}`} style={{ flexDirection: 'row', gap: 7, marginTop: 3 }}>
          <Text
            className={b ? 'font-sans' : 'font-sans-sb'}
            style={{ fontSize: size, lineHeight: size + 6, color: b ? c.accent : c.subtle, minWidth: b ? 0 : 14 }}
          >
            {b ? '•' : `${n![1]}.`}
          </Text>
          <Text style={{ flex: 1 }}>
            <Inline text={b ? b[1] : n![2]} size={size} color={ink} />
          </Text>
        </View>,
      );
      continue;
    }

    para.push(line.trim());
  }
  flush();

  return <View>{blocks}</View>;
}
