import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';
import CustomHeader from '../Components/Common/CustomHeader';
import BaseCard from '../Components/Common/BaseCard';
import BaseButton from '../Components/Common/BaseButton';
import { useTheme } from '../theme/ThemeContext';
import { addEnvelope, updateEnvelope } from '../store/slices/budgetSlice';
import { addCategory } from '../store/slices/profileSlice';

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
  const envelopes = useSelector((state) => state.budget.envelopes);

  const envelopeId = route.params?.envelopeId;
  const editingEnvelope = envelopeId
    ? envelopes.find((envelope) => envelope.id === envelopeId)
    : null;
  const isEditing = !!editingEnvelope;

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

  const handleSubmit = () => {
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

    if (isEditing) {
      dispatch(updateEnvelope({ id: editingEnvelope.id, ...payload }));
    } else {
      dispatch(addEnvelope(payload));
    }
    navigation.goBack();
  };

  return (
    <View style={styles.screen}>
      <CustomHeader title={isEditing ? 'Edit Envelope' : 'New Envelope'} leftAction="close" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <BaseButton onPress={handleSubmit} style={styles.createButton}>
            <Text style={styles.createButtonLabel}>
              {isEditing ? 'Save Changes' : 'Create Envelope'}
            </Text>
          </BaseButton>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
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
  });

export default CreateEnvelopeScreen;
