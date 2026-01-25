import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IconButton } from 'react-native-paper';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { JobDetailScreen } from '../screens/jobs/JobDetailScreen';
import { ReviewPromptScreen } from '../screens/reviews/ReviewPromptScreen';
import { ServiceCatalogScreen } from '../screens/services/ServiceCatalogScreen';
import { RequestServiceScreen } from '../screens/services/RequestServiceScreen';
import { ServiceRequestDetailScreen } from '../screens/services/ServiceRequestDetailScreen';
import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
// New Phase 2 screens
import { OwnerDashboardScreen } from '../screens/owner/OwnerDashboardScreen';
import { ThreadsListScreen } from '../screens/messages/ThreadsListScreen';
import { ThreadScreen } from '../screens/messages/ThreadScreen';
import { PaymentMethodsScreen } from '../screens/payments/PaymentMethodsScreen';
import { PaymentHistoryScreen } from '../screens/payments/PaymentHistoryScreen';
import { CrewsListScreen } from '../screens/crews/CrewsListScreen';
import { CrewDetailScreen } from '../screens/crews/CrewDetailScreen';
import type {
  MainTabParamList,
  JobsStackParamList,
  ServicesStackParamList,
  MessagesStackParamList,
  PaymentsStackParamList,
  CrewsStackParamList,
} from './types';
import { colors } from '../theme/tokens';

const Tab = createBottomTabNavigator<MainTabParamList>();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const PaymentsStack = createNativeStackNavigator<PaymentsStackParamList>();
const CrewsStack = createNativeStackNavigator<CrewsStackParamList>();

function JobsNavigator() {
  return (
    <JobsStack.Navigator>
      <JobsStack.Screen
        name="JobsList"
        component={JobsScreen}
        options={{ title: 'Jobs' }}
      />
      <JobsStack.Screen
        name="JobDetail"
        component={JobDetailScreen}
        options={{ title: 'Job Details' }}
      />
      <JobsStack.Screen
        name="ReviewPrompt"
        component={ReviewPromptScreen}
        options={{ title: 'Leave a Review' }}
      />
    </JobsStack.Navigator>
  );
}

function ServicesNavigator() {
  return (
    <ServicesStack.Navigator>
      <ServicesStack.Screen
        name="ServiceCatalog"
        component={ServiceCatalogScreen}
        options={{ title: 'Services' }}
      />
      <ServicesStack.Screen
        name="RequestService"
        component={RequestServiceScreen}
        options={{ title: 'Request Service' }}
      />
      <ServicesStack.Screen
        name="ServiceRequestDetail"
        component={ServiceRequestDetailScreen}
        options={{ title: 'Request Status' }}
      />
    </ServicesStack.Navigator>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen
        name="ThreadsList"
        component={ThreadsListScreen}
        options={{ title: 'Messages', headerShown: false }}
      />
      <MessagesStack.Screen
        name="Thread"
        component={ThreadScreen}
        options={{ title: 'Conversation' }}
      />
    </MessagesStack.Navigator>
  );
}

function PaymentsNavigator() {
  return (
    <PaymentsStack.Navigator>
      <PaymentsStack.Screen
        name="PaymentMethods"
        component={PaymentMethodsScreen}
        options={{ title: 'Payment Methods', headerShown: false }}
      />
      <PaymentsStack.Screen
        name="PaymentHistory"
        component={PaymentHistoryScreen}
        options={{ title: 'Payment History', headerShown: false }}
      />
    </PaymentsStack.Navigator>
  );
}

function CrewsNavigator() {
  return (
    <CrewsStack.Navigator>
      <CrewsStack.Screen
        name="CrewsList"
        component={CrewsListScreen}
        options={{ title: 'Crews', headerShown: false }}
      />
      <CrewsStack.Screen
        name="CrewDetail"
        component={CrewDetailScreen}
        options={{ title: 'Crew Details' }}
      />
    </CrewsStack.Navigator>
  );
}

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Jobs':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case 'Crews':
              iconName = focused ? 'account-group' : 'account-group-outline';
              break;
            case 'Messages':
              iconName = focused ? 'message' : 'message-outline';
              break;
            case 'Payments':
              iconName = focused ? 'credit-card' : 'credit-card-outline';
              break;
            case 'Notifications':
              iconName = focused ? 'bell' : 'bell-outline';
              break;
            case 'Settings':
              iconName = focused ? 'cog' : 'cog-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <IconButton icon={iconName} size={size} iconColor={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.neutral[400],
      })}
    >
      <Tab.Screen name="Home" component={OwnerDashboardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Jobs" component={JobsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Crews" component={CrewsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Messages" component={MessagesNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Payments" component={PaymentsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Notifications" component={NotificationCenterScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
