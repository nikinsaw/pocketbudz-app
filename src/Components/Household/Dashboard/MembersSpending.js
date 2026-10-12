import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BaseCard from '../../Common/BaseCard';
import { useTheme } from '../../../theme/ThemeContext';

// Who spent what this cycle. Each row's second line says how much the viewer is
// allowed to see ("Total only", "Details shared with you"), so a total never reads as
// the whole story.
function MembersSpending({ members }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Who{'’'}s spending</Text>
      <BaseCard>
        {members.map((member, index) => (
          <View key={member.membershipId} style={[styles.row, index > 0 && styles.divider]}>
            <View style={styles.names}>
              <Text style={styles.name}>
                {member.name}
                {member.isMe ? ' (you)' : ''}
              </Text>
              <Text style={styles.detail}>
                {member.roleLabel} {'·'} {member.detail}
              </Text>
            </View>
            <Text style={styles.total}>{member.totalLabel}</Text>
          </View>
        ))}
      </BaseCard>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    section: { marginTop: 28 },
    title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 14 },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardBorder },
    names: { flex: 1, paddingRight: 12 },
    name: { color: colors.text, fontSize: 15, fontWeight: '700' },
    detail: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    total: { color: colors.text, fontSize: 16, fontWeight: '800' },
  });

export default MembersSpending;
