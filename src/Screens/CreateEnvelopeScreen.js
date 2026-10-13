import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { addCategory } from '../store/slices/profileSlice';
import { dataActions } from '../services/householdApp';
import { selectEnvelopes, selectIsHousehold } from '../store/selectors';
import { describeHouseholdError } from '../utils/householdErrors';

// Household only: who a new envelope is for. Spenders can only make personal ones.
const SCOPES = [
  { key: 'PERSONAL', label: 'Just me', description: 'Only you see this budget and what you spend from it.' },
  { key: 'SHARED', label: 'The household', description: 'Everyone in the household sees this budget and all spending in it.' },
];

// Rotated through for custom categories a user adds inline, since asking
// for a color pick on top of everything else here would be a lot of UI for
// a minor cosmetic choice.
const NEW_CATEGORY_COLOR_KEYS = [
  'healthMedical',
  'personalCare',
  'familySupport',
  'utilities',
  'householdHelp',
  'giftsJewelry',
];

const ENVELOPE_TYPES = [
  {
    key: 'spending',
    label: 'Spending budget',
    description: 'A monthly limit — e.g. Dining Out, Shopping',
  },
  {
    key: 'fixed',
    label: 'Fixed / recurring',
    description: 'A set amount you pay each cycle — e.g. Rent, EMI',
  },
];

function CreateEnvelopeScreen() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();

  const categories = useSelector((state) => state.profile.categories);
  const envelopes = useSelector(selectEnvelopes);
  const isHousehold = useSelector(selectIsHousehold);
  const household = useSelector((state) => state.household.current);

  const envelopeId = route.params?.envelopeId;
  const editingEnvelope = envelopeId
    ? envelopes.find((envelope) => envelope.id === envelopeId)
    : null;
  const isEditing = !!editingEnvelope;

  // Household rules: shared budgets are managed by owners and earners, personal ones only
  // by their owner. Anyone else (e.g. a personal budget someone shared with you in full)
  // gets a read-only view.
  const isSpender = household?.role === 'SPENDER';
  const readOnly =
    isHousehold &&
    isEditing &&
    (editingEnvelope.shared ? isSpender : editingEnvelope.ownerId !== household?.membershipId);
  const [scope, setScope] = useState('PERSONAL');

  const [selectedCategoryKey, setSelectedCategoryKey] = useState(
    editingEnvelope?.categoryKey ?? null,
  );
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [type, setType] = useState(editingEnvelope?.type ?? 'spending');
  const [budgetLimit, setBudgetLimit] = useState(
    editingEnvelope ? String(editingEnvelope.budgetLimit) : '',
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCategory = categories.find((category) => category.key === selectedCategoryKey);

  const handleAddCategory = () => {
    const label = newCategoryLabel.trim();
    if (!label) {
      return;
    }
    const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const colorKey =
      NEW_CATEGORY_COLOR_KEYS[categories.length % NEW_CATEGORY_COLOR_KEYS.length];

    dispatch(addCategory({ key, label, icon: '🏷️', colorKey }));
    setSelectedCategoryKey(key);
    setNewCategoryLabel('');
    setIsAddingCategory(false);
  };

  const handleSubmit = async () => {
    if (saving) {
      return;
    }
    setError('');

    if (!selectedCategory) {
      setError('Pick a category for this envelope.');
      return;
    }
    const parsedLimit = Number(budgetLimit.replace(/,/g, ''));
    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Enter a budget amount greater than zero.');
      return;
    }

    const payload = {
      categoryKey: selectedCategory.key,
      icon: selectedCategory.icon,
      title: selectedCategory.label,
      colorKey: selectedCategory.colorKey,
      type,
      budgetLimit: parsedLimit,
    };

    setSaving(true);
    try {
      if (isEditing) {
        await dispatch(dataActions.updateEnvelope({ id: editingEnvelope.id, ...payload }));
      } else {
        await dispatch(
          dataActions.addEnvelope({ ...payload, scope: isSpender ? 'PERSONAL' : scope }),
        );
      }
    } catch (e) {
      setError(describeHouseholdError(e, 'Couldn’t save. Please try again.'));
      setSaving(false);
      return;
    }
    navigation.goBack();
  };

  const handleDelete = () => {
    const sharedNote =
      isHousehold && editingEnvelope.shared
        ? ' It is removed for everyone in the household. Spending in it is kept.'
        : '';
    Alert.alert('Delete envelope?', `This cannot be undone.${sharedNote}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await dispatch(dataActions.deleteEnvelope(editingEnvelope.id));
          } catch (e) {
            Alert.alert('Couldn’t delete', describeHouseholdError(e));
            return;
          }
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <CustomHeader title={isEditing ? 'Edit Envelope' : 'New Envelope'} leftAction="close" />
      <KeyboardAwareScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid
        extraScrollHeight={20}
      >
        <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.chipWrap}>
            {categories.map((category) => (
              <Pressable
                key={category.key}
                onPress={() => setSelectedCategoryKey(category.key)}
                style={[
                  styles.chip,
                  selectedCategoryKey === category.key && styles.chipSelected,
                ]}
              >
                <Text style={styles.chipText}>
                  {category.icon} {category.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setIsAddingCategory((prev) => !prev)}
              style={[styles.chip, styles.chipAdd]}
            >
              <Text style={styles.chipAddText}>＋ New category</Text>
            </Pressable>
          </View>

          {isAddingCategory ? (
            <BaseCard style={styles.addCategoryCard}>
              <TextInput
                value={newCategoryLabel}
                onChangeText={setNewCategoryLabel}
                placeholder="e.g. Pet Care"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                autoFocus
              />
              <BaseButton onPress={handleAddCategory} style={styles.smallButton}>
                <Text style={styles.smallButtonLabel}>Add category</Text>
              </BaseButton>
            </BaseCard>
          ) : null}

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>Envelope type</Text>
          <View style={styles.typeList}>
            {ENVELOPE_TYPES.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setType(option.key)}
                style={[styles.typeRow, type === option.key && styles.typeRowSelected]}
              >
                <Text style={styles.typeLabel}>{option.label}</Text>
                <Text style={styles.typeDescription}>{option.description}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.spacer} />

          <Text style={styles.sectionTitle}>
            {type === 'fixed' ? 'Amount' : 'Monthly budget'}
          </Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.amountPrefix}>₹</Text>
            <TextInput
              value={budgetLimit}
              onChangeText={setBudgetLimit}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              style={styles.amountInput}
            />
          </View>

          {isHousehold && !isEditing && !isSpender ? (
            <View>
              <View style={styles.spacer} />
              <Text style={styles.sectionTitle}>Who is this budget for?</Text>
              <View style={styles.typeList}>
                {SCOPES.map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setScope(option.key)}
                    style={[styles.typeRow, scope === option.key && styles.typeRowSelected]}
                  >
                    <Text style={styles.typeLabel}>{option.label}</Text>
                    <Text style={styles.typeDescription}>{option.description}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {isHousehold && !isEditing && isSpender ? (
            <Text style={styles.helperText}>
              This will be your own budget. Only you see it, unless you choose to share it.
            </Text>
          ) : null}

          {isHousehold && isEditing ? (
            <Text style={styles.helperText}>
              {editingEnvelope.shared
                ? 'Shared with the household.'
                : readOnly
                  ? 'Someone shared this budget with you. Only they can change it.'
                  : 'Just yours.'}
            </Text>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {readOnly ? null : (
            <BaseButton onPress={handleSubmit} disabled={saving} style={[styles.createButton, saving && styles.createButtonDisabled]}>
              <Text style={styles.createButtonLabel}>
                {saving ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Envelope'}
              </Text>
            </BaseButton>
          )}

          {isEditing && !readOnly ? (
            <Pressable onPress={handleDelete} style={styles.deleteButton}>
              <Text style={styles.deleteButtonLabel}>Delete Envelope</Text>
            </Pressable>
          ) : null}
      </KeyboardAwareScrollView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 12,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingVertical: 9,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    chipSelected: {
      borderColor: colors.teal,
    },
    chipText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    chipAdd: {
      backgroundColor: 'transparent',
      borderColor: colors.teal,
      borderStyle: 'dashed',
    },
    chipAddText: {
      color: colors.teal,
      fontSize: 14,
      fontWeight: '700',
    },
    addCategoryCard: {
      marginTop: 12,
    },
    input: {
      color: colors.text,
      fontSize: 15,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    smallButton: {
      alignSelf: 'flex-start',
      backgroundColor: colors.gradientStart,
      borderRadius: 10,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    smallButtonLabel: {
      color: colors.white,
      fontSize: 13,
      fontWeight: '700',
    },
    spacer: {
      height: 24,
    },
    typeList: {
      gap: 10,
    },
    typeRow: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    typeRowSelected: {
      borderColor: colors.teal,
    },
    typeLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    typeDescription: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 2,
    },
    amountInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
    },
    amountPrefix: {
      color: colors.textMuted,
      fontSize: 20,
      fontWeight: '700',
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
      paddingVertical: 14,
    },
    errorText: {
      color: colors.dining,
      fontSize: 13,
      marginTop: 12,
    },
    helperText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 16,
    },
    createButtonDisabled: {
      opacity: 0.6,
    },
    createButton: {
      backgroundColor: colors.gradientStart,
      borderRadius: 12,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    createButtonLabel: {
      color: colors.white,
      fontSize: 16,
      fontWeight: '700',
    },
    deleteButton: {
      alignItems: 'center',
      marginTop: 20,
      padding: 8,
    },
    deleteButtonLabel: {
      color: colors.dining,
      fontSize: 15,
      fontWeight: '700',
    },
  });

export default CreateEnvelopeScreen;
