import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import EnvelopeCard from './EnvelopeCard';
import CreateEnvelopeButton from './CreateEnvelopeButton';
import { useTheme } from '../../theme/ThemeContext';

function EnvelopesSection({ envelopes, onEdit, onCreate }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Your Envelopes</Text>
        <Pressable onPress={onEdit}>
          <Text style={styles.edit}>Edit</Text>
        </Pressable>
      </View>

      {envelopes.map((envelope) => (
        <EnvelopeCard key={envelope.title} {...envelope} />
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
    edit: {
      color: colors.teal,
      fontSize: 15,
      fontWeight: '600',
    },
  });

export default EnvelopesSection;
