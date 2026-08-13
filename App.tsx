import * as React from 'react';
import { View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { IconHome, IconInsights, IconBudget, IconSettings } from './src/SVGs/BottomTabIcons';
import { CustomAddButton } from './src/Components';
import HomeScreen from './src/Screens/HomeScreen';
import InsightsScreen from './src/Screens/InsightsScreen';

function BudgetScreen() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Budget Screen</Text></View>;
}

function SettingsScreen() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text>Settings Screen</Text></View>;
}

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MyTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarShowLabel: false, headerShown: false, tabBarStyle: { height:80 } }}>
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
          tabBarButton: (props) => (
            <CustomAddButton 
              onPress={() => {
                // Handle the button press here, e.g., navigate to a new screen or open a modal
                console.log('Custom Add Button Pressed');
              }} 
            />
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
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={MyTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default App;