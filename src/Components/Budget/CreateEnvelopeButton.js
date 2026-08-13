import React from 'react';
import { Text, StyleSheet } from 'react-native';
import BaseCard from '../Common/BaseCard';
import colors from '../../theme/colors';

function CreateEnvelopeButton({ onPress }) {
  return (
    <BaseCard
      clickable
      onPress={onPress}
      backgroundColor="transparent"
      style={styles.card}
    >
      <Text style={styles.label}>＋ Create New Envelope</Text>
    </BaseCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateEnvelopeButton;
