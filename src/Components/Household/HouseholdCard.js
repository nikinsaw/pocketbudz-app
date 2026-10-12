import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import BaseCard from '../Common/BaseCard';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';
import { selectHouseholdMode } from '../../store/slices/householdSlice';
import { dismissHouseholdPromo } from '../../store/slices/settingsSlice';

const ROLE_LABEL = { OWNER: 'Owner', EARNER: 'Earner', SPENDER: 'Spender' };

// Home entry point to Household Mode. What it says follows the account state:
//   solo       -> an invitation (dismissable, so it never nags)
//   signed-in  -> a nudge to finish setting up
//   household  -> which household you're in
function HouseholdCard() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const mode = useSelector(selectHouseholdMode);
  const current = useSelector((state) => state.household.current);
  const promoDismissed = useSelector((state) => state.settings.householdPromoDismissed);

  if (mode === 'solo' && promoDismissed) {
    return null;
  }

  const content = {
    solo: {
      title: 'Budget together with family',
      subtitle: 'Share envelopes and see one household budget. Optional, and your data stays on this phone until you choose.',
    },
    'signed-in': {
      title: 'Finish setting up your household',
      subtitle: 'Create a household or join one with an invite code.',
    },
    household: {
      title: current?.name ?? 'Your household',
      subtitle: current
        ? `You’re the ${ROLE_LABEL[current.role] ?? 'member'}. Tap to see this cycle’s budget.`
        : 'Tap to see this cycle’s budget.',
    },
  }[mode];

  return (
    <BaseCard
      clickable
      onPress={() => navigation.navigate(mode === 'household' ? 'HouseholdDashboard' : 'Household')}
      padding={18}
      borderRadius={20}
    >
      <View style={styles.row}>
        <Text style={styles.icon}>👨‍👩‍👧</Text>
        <View style={styles.texts}>
          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.subtitle}>{content.subtitle}</Text>
        </View>
        {mode === 'solo' ? (
          <BaseButton
            onPress={() => dispatch(dismissHouseholdPromo())}
            hitSlop={12}
            accessibilityLabel="Dismiss"
          >
            <Text style={styles.dismiss}>✕</Text>
          </BaseButton>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </View>
    </BaseCard>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center' },
    icon: { fontSize: 28, marginRight: 14 },
    texts: { flex: 1 },
    title: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
    dismiss: { color: colors.textMuted, fontSize: 16, paddingLeft: 12, paddingVertical: 4 },
    chevron: { color: colors.textMuted, fontSize: 24, paddingLeft: 12 },
  });

export default HouseholdCard;
