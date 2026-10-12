import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseButton from '../Components/Common/BaseButton';
import BaseCard from '../Components/Common/BaseCard';
import DashboardHeadline from '../Components/Household/Dashboard/DashboardHeadline';
import EnvelopeProgressList from '../Components/Household/Dashboard/EnvelopeProgressList';
import MembersSpending from '../Components/Household/Dashboard/MembersSpending';
import { useTheme } from '../theme/ThemeContext';
import { householdActions } from '../services/householdApp';
import { describeHouseholdError } from '../utils/householdErrors';
import { buildDashboardView } from '../utils/householdDashboard';

// The household's budget for the current cycle, filtered by what the signed-in member is
// allowed to see (the server decides; this screen just draws it).
function HouseholdDashboardScreen() {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await dispatch(householdActions.fetchDashboard()));
    } catch (e) {
      setError(describeHouseholdError(e));
    }
  }, [dispatch]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const view = useMemo(() => (data ? buildDashboardView(data) : null), [data]);

  const manage = (
    <BaseButton onPress={() => navigation.navigate('Household')} hitSlop={12} accessibilityLabel="Manage household">
      <Text style={styles.manage}>{'⚙'}</Text>
    </BaseButton>
  );

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <CustomHeader title={view?.title ?? 'Household'} rightContent={manage} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.gradientStart} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.teal} />
          }
        >
          {error ? (
            <BaseCard style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <BaseButton onPress={handleRefresh} style={styles.retry}>
                <Text style={styles.retryLabel}>Try again</Text>
              </BaseButton>
            </BaseCard>
          ) : null}

          {view ? (
            <View>
              <DashboardHeadline view={view} />

              <BaseCard style={styles.mine}>
                <Text style={styles.mineLabel}>Your spending this cycle</Text>
                <Text style={styles.mineAmount}>{view.mine.spentLabel}</Text>
                {view.mine.allowanceLabel ? <Text style={styles.mineNote}>{view.mine.allowanceLabel}</Text> : null}
                {view.mine.givenLabel ? <Text style={styles.mineNote}>{view.mine.givenLabel}</Text> : null}
              </BaseCard>

              {view.isEmpty ? (
                <BaseCard style={styles.empty}>
                  <Text style={styles.emptyTitle}>Nothing here yet</Text>
                  <Text style={styles.emptyText}>
                    Spending and budgets show up here once they are in the household. You can bring in
                    the data from this phone from the household settings.
                  </Text>
                  <BaseButton onPress={() => navigation.navigate('Household')} style={styles.retry}>
                    <Text style={styles.retryLabel}>Open household settings</Text>
                  </BaseButton>
                </BaseCard>
              ) : null}

              <EnvelopeProgressList title="Shared budgets" rows={view.sharedEnvelopes} />
              <EnvelopeProgressList title="Personal budgets" rows={view.personalEnvelopes} />
              <MembersSpending members={view.members} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 },
    manage: { color: colors.text, fontSize: 22, paddingHorizontal: 8 },
    mine: { marginTop: 16 },
    mineLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
    mineAmount: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 4 },
    mineNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: 6 },
    errorCard: { marginBottom: 16, backgroundColor: colors.warningTint },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18 },
    retry: { marginTop: 12, alignSelf: 'flex-start' },
    retryLabel: { color: colors.teal, fontSize: 14, fontWeight: '700' },
    empty: { marginTop: 16 },
    emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 6 },
    emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  });

export default HouseholdDashboardScreen;
