import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../../Common/BaseCard';
import { useTheme } from '../../../theme/ThemeContext';

// Envelope progress bars, in the same style as the solo Budget Progress card.
// Renders nothing when there are no rows, so empty sections simply don't appear.
function EnvelopeProgressList({ title, rows, emptyHint }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  if (rows.length === 0 && !emptyHint) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {rows.length === 0 ? (
        <BaseCard>
          <Text style={styles.hint}>{emptyHint}</Text>
        </BaseCard>
      ) : (
        <BaseCard>
          {rows.map((row, index) => (
            <View key={row.id} style={index < rows.length - 1 && styles.rowGap}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {row.icon} {row.title}
                </Text>
                <Text style={styles.rowAmount}>{row.amountLabel}</Text>
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round(row.progress * 100)}%`,
                      backgroundColor: row.warning ? colors.dining : colors[row.colorKey] ?? colors.teal,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.status, row.warning && { color: colors.dining }]}>
                {row.status}
                {row.ownerLabel ? ` · ${row.ownerLabel}` : ''}
              </Text>
            </View>
          ))}
        </BaseCard>
      )}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    section: { marginTop: 28 },
    title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 },
    hint: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    rowGap: { marginBottom: 20 },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1, paddingRight: 8 },
    rowAmount: { color: colors.textMuted, fontSize: 13 },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.trackDark, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4 },
    status: { color: colors.textMuted, fontSize: 12, marginTop: 6 },
  });

export default EnvelopeProgressList;
