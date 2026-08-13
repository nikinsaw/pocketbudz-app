import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import EnvelopeCard from './EnvelopeCard';
import CreateEnvelopeButton from './CreateEnvelopeButton';
import colors from '../../theme/colors';

function EnvelopesSection({ envelopes, onEdit, onCreate }) {
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    color: colors.white,
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
