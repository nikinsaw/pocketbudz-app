import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AGREEMENT_SECTIONS, AGREEMENT_TITLE } from '../../data/householdAgreement';

function AgreementView() {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{AGREEMENT_TITLE}</Text>
      {AGREEMENT_SECTIONS.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          {section.body.map((line) => (
            <Text key={line} style={styles.line}>
              {'•  '}
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    box: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginTop: 12 },
    title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
    section: { marginTop: 12 },
    heading: { color: colors.text, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    line: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  });

export default AgreementView;
