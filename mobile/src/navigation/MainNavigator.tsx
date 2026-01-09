import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/home/HomeScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { JobDetailScreen } from '../screens/jobs/JobDetailScreen';
import { ReviewPromptScreen } from '../screens/reviews/ReviewPromptScreen';
import { ServiceCatalogScreen } from '../screens/services/ServiceCatalogScreen';
import { RequestServiceScreen } from '../screens/services/RequestServiceScreen';
import { ServiceRequestDetailScreen } from '../screens/services/ServiceRequestDetailScreen';
import { NotificationCenterScreen } from '../screens/notifications/NotificationCenterScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import type { MainTabParamList, JobsStackParamList, ServicesStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const JobsStack = createNativeStackNavigator<JobsStackParamList>();
const ServicesStack = createNativeStackNavigator<ServicesStackParamList>();

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

export function MainNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Services" component={ServicesNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Notifications" component={NotificationCenterScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
