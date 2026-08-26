import * as React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconHome, IconInsights, IconBudget, IconSettings } from './src/SVGs/BottomTabIcons';
import { CustomAddButton } from './src/Components';
import HomeScreen from './src/Screens/HomeScreen';
import InsightsScreen from './src/Screens/InsightsScreen';
import BudgetScreen from './src/Screens/BudgetScreen';
import SettingsScreen from './src/Screens/SettingsScreen';
import AIAssistantScreen from './src/Screens/AIAssistantScreen';
import AllTransactionsScreen from './src/Screens/AllTransactionsScreen';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { Provider as StoreProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor } from './src/store/store';
import AppLockGate from './src/Components/AppLock/AppLockGate';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MyTabs({ navigation }) {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarShowLabel: false,
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          height: 80,
          backgroundColor: colors.card,
          borderTopColor: colors.cardBorder,
          borderTopWidth: 1,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <View>
            <IconHome fill={color} />
          </View>
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <IconInsights fill={color} width={57} height={57} />
          </View>
        }}
      />
      <Tab.Screen 
        name="AddAction" 
        component={()=><View/>} // Component is required but won't be rendered
        options={{
          tabBarIcon: ({ color }) => (
            <View>
              <IconInsights fill={color} />
            </View>
          ),
          // Override the default tab button
          tabBarButton: () => (
            <CustomAddButton onPress={() => navigation.navigate('AIAssistant')} />
          )
        }}
      />
      <Tab.Screen
        name="Budget"
        component={BudgetScreen}
        options={{
          tabBarIcon: ({ color, size }) => <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <IconBudget fill={color} width={57} height={57} />
          </View>
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <IconSettings fill={color} width={57} height={57} />
          </View>}
        }
      />
    </Tab.Navigator>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <ThemeProvider>
            <AppLockGate>
              <NavigationContainer>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="Tabs" component={MyTabs} />
                  <Stack.Screen
                    name="AIAssistant"
                    component={AIAssistantScreen}
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen name="AllTransactions" component={AllTransactionsScreen} />
                </Stack.Navigator>
              </NavigationContainer>
            </AppLockGate>
          </ThemeProvider>
        </PersistGate>
      </StoreProvider>
    </SafeAreaProvider>
  );
}

export default App;