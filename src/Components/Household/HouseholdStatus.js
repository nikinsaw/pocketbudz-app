import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Share } from 'react-native';
import BaseButton from '../Common/BaseButton';
import { useTheme } from '../../theme/ThemeContext';
import { describeHouseholdError } from '../../utils/householdErrors';

const ROLE_LABEL = { OWNER: 'Owner', EARNER: 'Earner', SPENDER: 'Spender' };
const INVITE_ROLES = [
  ['EARNER', 'Earner', 'Has income, sees the household budget'],
  ['SPENDER', 'Spender', 'Spends from shared and personal envelopes'],
];

export function inviteMessage(householdName, code) {
  return (
    `Join "${householdName}" on PocketBudz.\n` +
    `Open PocketBudz, go to Settings > Household mode, sign in, choose "Join with code" and enter:\n${code}`
  );
}

// What a person sees once they are in a household: who is in it, invite others (owner
// only), leave, sign out.
function HouseholdStatus({
  household,
  fetchMembers,
  createInvite,
  onLeave,
  onSignOut,
  busy,
  error,
  importSection = null,
  share = Share.share,
}) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isOwner = household.role === 'OWNER';

  const [members, setMembers] = useState(null); // null = loading
  const [membersError, setMembersError] = useState('');
  const [inviteRole, setInviteRole] = useState('SPENDER');
  const [invite, setInvite] = useState(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadMembers = useCallback(async () => {
    setMembersError('');
    try {
      setMembers(await fetchMembers());
    } catch (e) {
      setMembers([]);
      setMembersError(describeHouseholdError(e));
    }
  }, [fetchMembers]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers, household.id]);

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    setInviteError('');
    try {
      setInvite(await createInvite({ role: inviteRole }));
    } catch (e) {
      setInviteError(describeHouseholdError(e));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleShare = () => {
    share({ message: inviteMessage(household.name, invite.code) }).catch(() => {});
  };

  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroName}>{household.name}</Text>
        <Text style={styles.heroRole}>You are the {ROLE_LABEL[household.role] ?? 'member'}</Text>
      </View>

      <Text style={styles.sectionTitle}>Members</Text>
      <View style={styles.card}>
        {members === null ? (
          <ActivityIndicator color={colors.gradientStart} />
        ) : (
          members.map((member, index) => (
            <View
              key={member.membershipId}
              style={[styles.memberRow, index > 0 && styles.memberDivider]}
            >
              <Text style={styles.memberName}>
                {member.name}
                {member.membershipId === household.membershipId ? ' (you)' : ''}
              </Text>
              <Text style={styles.memberRole}>{ROLE_LABEL[member.role] ?? member.role}</Text>
            </View>
          ))
        )}
        {membersError ? (
          <View>
            <Text style={styles.errorText}>{membersError}</Text>
            <BaseButton onPress={loadMembers} style={styles.linkButton}>
              <Text style={styles.linkLabel}>Try again</Text>
            </BaseButton>
          </View>
        ) : null}
      </View>

      {importSection}

      {isOwner ? (
        <View>
          <Text style={styles.sectionTitle}>Invite someone</Text>
          <View style={styles.card}>
            {INVITE_ROLES.map(([role, label, description]) => (
              <BaseButton
                key={role}
                onPress={() => {
                  setInviteRole(role);
                  setInvite(null);
                }}
                style={styles.roleRow}
                accessibilityRole="radio"
                accessibilityState={{ selected: inviteRole === role }}
              >
                <Text style={styles.radio}>{inviteRole === role ? '◉' : '○'}</Text>
                <View style={styles.roleTexts}>
                  <Text style={styles.roleLabel}>{label}</Text>
                  <Text style={styles.roleDescription}>{description}</Text>
                </View>
              </BaseButton>
            ))}

            {invite ? (
              <View style={styles.inviteBox}>
                <Text style={styles.inviteCode} selectable>
                  {invite.code}
                </Text>
                <Text style={styles.inviteNote}>
                  One person can use this code, and it expires in 7 days.
                </Text>
                <BaseButton onPress={handleShare} style={styles.primaryButton}>
                  <Text style={styles.primaryLabel}>Share invite</Text>
                </BaseButton>
              </View>
            ) : (
              <BaseButton
                onPress={handleCreateInvite}
                disabled={inviteBusy}
                style={[styles.primaryButton, inviteBusy && styles.disabled]}
              >
                {inviteBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryLabel}>Create invite code</Text>
                )}
              </BaseButton>
            )}
            {inviteError ? <Text style={styles.errorText}>{inviteError}</Text> : null}
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <BaseButton onPress={onLeave} disabled={busy} style={[styles.dangerButton, busy && styles.disabled]}>
        <Text style={styles.dangerLabel}>Leave household</Text>
      </BaseButton>
      <BaseButton onPress={onSignOut} disabled={busy} style={styles.linkButton}>
        <Text style={styles.linkLabel}>Sign out</Text>
      </BaseButton>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    hero: { backgroundColor: colors.gradientEnd, borderRadius: 20, padding: 20, marginBottom: 24 },
    heroName: { color: colors.white, fontSize: 24, fontWeight: '800' },
    heroRole: { color: colors.onGradientMuted, fontSize: 14, marginTop: 4 },
    sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
    card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 24 },
    memberRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    memberDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.cardBorder },
    memberName: { color: colors.text, fontSize: 15, flexShrink: 1 },
    memberRole: { color: colors.textMuted, fontSize: 13 },
    roleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
    radio: { color: colors.gradientStart, fontSize: 22, width: 32 },
    roleTexts: { flex: 1 },
    roleLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
    roleDescription: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    inviteBox: { alignItems: 'center', marginTop: 12 },
    inviteCode: { color: colors.text, fontSize: 28, fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
    inviteNote: { color: colors.textMuted, fontSize: 12, marginBottom: 12, textAlign: 'center' },
    primaryButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
      alignSelf: 'stretch',
    },
    primaryLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
    disabled: { opacity: 0.45 },
    errorText: { color: colors.dining, fontSize: 13, lineHeight: 18, marginTop: 10, marginBottom: 6 },
    dangerButton: {
      borderWidth: 1,
      borderColor: colors.dining,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    dangerLabel: { color: colors.dining, fontSize: 15, fontWeight: '700' },
    linkButton: { paddingVertical: 12, alignItems: 'center' },
    linkLabel: { color: colors.teal, fontSize: 14, fontWeight: '700' },
  });

export default HouseholdStatus;
