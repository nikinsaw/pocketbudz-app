import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import EnvelopeCard from './EnvelopeCard';
import CreateEnvelopeButton from './CreateEnvelopeButton';
import { useTheme } from '../../theme/ThemeContext';

function EnvelopesSection({ envelopes, onEditEnvelope, onCreate }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Your Envelopes</Text>
      </View>

      {envelopes.map((envelope) => (
        <EnvelopeCard
          key={envelope.id ?? envelope.title}
          {...envelope}
          onPress={onEditEnvelope ? () => onEditEnvelope(envelope) : undefined}
        />
      ))}

      <CreateEnvelopeButton onPress={onCreate} />
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
    },
  });

export default EnvelopesSection;
