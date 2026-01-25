// ============================================
// Crew Weather Screen
// Mobile screen for crew members to view weather and safety guidance
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Types
interface WeatherConditions {
  temp: number;
  humidity: number;
  windSpeed: number;
  windGust?: number;
  feelsLike: number;
  uvIndex?: number;
  visibility?: number;
  weather: Array<{ main: string; description: string }>;
}

interface WeatherAlert {
  id: string;
  event: string;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Extreme';
  description: string;
  start: number;
  end: number;
}

interface ScheduleChange {
  jobId: number;
  customerName: string;
  originalTime: string;
  newTime: string;
  reason: string;
}

interface SafetyGuideline {
  condition: string;
  icon: string;
  iconColor: string;
  guidelines: string[];
  severity: 'info' | 'warning' | 'danger';
}

// Color theme
const colors = {
  primary: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#06B6D4',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB'
};

// Weather icon mapping
const weatherIcons: Record<string, string> = {
  clear: 'weather-sunny',
  clouds: 'weather-cloudy',
  rain: 'weather-rainy',
  drizzle: 'weather-rainy',
  snow: 'weather-snowy',
  thunderstorm: 'weather-lightning',
  default: 'weather-cloudy'
};

// Safety guidelines based on conditions
function getSafetyGuidelines(conditions: WeatherConditions, alerts: WeatherAlert[]): SafetyGuideline[] {
  const guidelines: SafetyGuideline[] = [];

  // Check for alerts
  const hasExtremeAlert = alerts.some(a => a.severity === 'Extreme' || a.severity === 'Severe');
  if (hasExtremeAlert) {
    guidelines.push({
      condition: 'Active Weather Alert',
      icon: 'alert-circle',
      iconColor: colors.danger,
      guidelines: [
        'Check with dispatch before starting work',
        'Monitor conditions continuously',
        'Be prepared to take shelter or evacuate'
      ],
      severity: 'danger'
    });
  }

  // Heat guidelines
  if (conditions.temp >= 95 || (conditions.feelsLike && conditions.feelsLike >= 100)) {
    guidelines.push({
      condition: 'Extreme Heat',
      icon: 'thermometer-high',
      iconColor: colors.danger,
      guidelines: [
        'Take breaks every 20-30 minutes in shade',
        'Drink water every 15 minutes',
        'Watch for signs of heat exhaustion',
        'Wear light-colored, loose clothing',
        'Use sunscreen and wear a hat'
      ],
      severity: 'danger'
    });
  } else if (conditions.temp >= 85) {
    guidelines.push({
      condition: 'Hot Weather',
      icon: 'thermometer',
      iconColor: colors.warning,
      guidelines: [
        'Stay hydrated - drink water regularly',
        'Take shade breaks as needed',
        'Wear sunscreen'
      ],
      severity: 'warning'
    });
  }

  // Cold guidelines
  if (conditions.temp <= 32) {
    guidelines.push({
      condition: 'Freezing Conditions',
      icon: 'snowflake',
      iconColor: colors.info,
      guidelines: [
        'Wear layered clothing',
        'Check for ice on walking surfaces',
        'Take warming breaks every 30-40 minutes',
        'Watch for signs of frostbite',
        'Keep extremities covered'
      ],
      severity: 'warning'
    });
  }

  // Wind guidelines
  if (conditions.windSpeed >= 25 || (conditions.windGust && conditions.windGust >= 35)) {
    guidelines.push({
      condition: 'High Winds',
      icon: 'weather-windy',
      iconColor: colors.warning,
      guidelines: [
        'Secure loose equipment',
        'Avoid working near trees or structures',
        'Be extra cautious with ladders',
        'Watch for flying debris'
      ],
      severity: 'warning'
    });
  }

  // Rain/lightning
  const isThunderstorm = conditions.weather.some(w => w.main.toLowerCase() === 'thunderstorm');
  if (isThunderstorm) {
    guidelines.push({
      condition: 'Thunderstorm',
      icon: 'weather-lightning',
      iconColor: colors.danger,
      guidelines: [
        'STOP all outdoor work immediately',
        'Seek shelter in a building or vehicle',
        'Stay away from trees and tall objects',
        'Wait 30 minutes after last thunder to resume'
      ],
      severity: 'danger'
    });
  }

  // Low visibility
  if (conditions.visibility && conditions.visibility < 1000) {
    guidelines.push({
      condition: 'Low Visibility',
      icon: 'weather-fog',
      iconColor: colors.warning,
      guidelines: [
        'Use extra caution when driving',
        'Turn on headlights',
        'Reduce speed and increase following distance'
      ],
      severity: 'warning'
    });
  }

  // UV Index
  if (conditions.uvIndex && conditions.uvIndex >= 8) {
    guidelines.push({
      condition: 'High UV Index',
      icon: 'weather-sunny-alert',
      iconColor: colors.warning,
      guidelines: [
        'Apply SPF 30+ sunscreen',
        'Wear UV-protective sunglasses',
        'Seek shade during peak hours (10am-4pm)'
      ],
      severity: 'warning'
    });
  }

  // Default good conditions
  if (guidelines.length === 0) {
    guidelines.push({
      condition: 'Good Conditions',
      icon: 'check-circle',
      iconColor: colors.success,
      guidelines: [
        'Weather conditions are favorable for work',
        'Stay hydrated and take regular breaks',
        'Monitor for any changes in conditions'
      ],
      severity: 'info'
    });
  }

  return guidelines;
}

export default function CrewWeatherScreen() {
  const [conditions, setConditions] = useState<WeatherConditions | null>(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);
  const [scheduleChanges, setScheduleChanges] = useState<ScheduleChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // In production, these would be API calls
      // Simulated data for demo
      setConditions({
        temp: 85,
        humidity: 60,
        windSpeed: 15,
        windGust: 22,
        feelsLike: 90,
        uvIndex: 7,
        visibility: 10000,
        weather: [{ main: 'Clear', description: 'clear sky' }]
      });

      setAlerts([]);

      setScheduleChanges([
        {
          jobId: 123,
          customerName: 'Johnson Residence',
          originalTime: '10:00 AM',
          newTime: '2:00 PM',
          reason: 'Rain expected in morning'
        }
      ]);
    } catch (error) {
      console.error('Failed to fetch weather data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getWeatherIcon = (main: string = 'default') => {
    return weatherIcons[main.toLowerCase()] || weatherIcons.default;
  };

  const safetyGuidelines = conditions ? getSafetyGuidelines(conditions, alerts) : [];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading weather data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Today's Weather</Text>
          <Text style={styles.headerSubtitle}>
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
        </View>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <View style={styles.alertsSection}>
            {alerts.map((alert) => (
              <View 
                key={alert.id} 
                style={[
                  styles.alertCard,
                  alert.severity === 'Extreme' || alert.severity === 'Severe' 
                    ? styles.alertDanger 
                    : styles.alertWarning
                ]}
              >
                <View style={styles.alertHeader}>
                  <Icon 
                    name="alert" 
                    size={20} 
                    color={alert.severity === 'Extreme' || alert.severity === 'Severe' ? '#DC2626' : '#D97706'} 
                  />
                  <Text style={styles.alertTitle}>{alert.event}</Text>
                </View>
                <Text style={styles.alertDescription} numberOfLines={3}>
                  {alert.description}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Current Conditions */}
        {conditions && (
          <View style={styles.currentCard}>
            <View style={styles.currentMain}>
              <Icon
                name={getWeatherIcon(conditions.weather[0]?.main)}
                size={56}
                color={colors.primary}
              />
              <View style={styles.currentInfo}>
                <Text style={styles.tempText}>{Math.round(conditions.temp)}°F</Text>
                <Text style={styles.conditionText}>
                  {conditions.weather[0]?.description}
                </Text>
                <Text style={styles.feelsLike}>
                  Feels like {Math.round(conditions.feelsLike)}°
                </Text>
              </View>
            </View>

            <View style={styles.conditionsGrid}>
              <View style={styles.conditionItem}>
                <Icon name="water-percent" size={20} color={colors.primary} />
                <Text style={styles.conditionLabel}>Humidity</Text>
                <Text style={styles.conditionValue}>{conditions.humidity}%</Text>
              </View>
              <View style={styles.conditionItem}>
                <Icon name="weather-windy" size={20} color={colors.textMuted} />
                <Text style={styles.conditionLabel}>Wind</Text>
                <Text style={styles.conditionValue}>{Math.round(conditions.windSpeed)} mph</Text>
              </View>
              {conditions.uvIndex !== undefined && (
                <View style={styles.conditionItem}>
                  <Icon name="white-balance-sunny" size={20} color={colors.warning} />
                  <Text style={styles.conditionLabel}>UV Index</Text>
                  <Text style={styles.conditionValue}>{conditions.uvIndex}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Safety Guidelines */}
        <View style={styles.safetySection}>
          <Text style={styles.sectionTitle}>Safety Guidelines</Text>
          {safetyGuidelines.map((guide, index) => (
            <View 
              key={index} 
              style={[
                styles.guidelineCard,
                guide.severity === 'danger' && styles.guidelineDanger,
                guide.severity === 'warning' && styles.guidelineWarning
              ]}
            >
              <View style={styles.guidelineHeader}>
                <Icon name={guide.icon} size={24} color={guide.iconColor} />
                <Text style={styles.guidelineTitle}>{guide.condition}</Text>
              </View>
              <View style={styles.guidelineList}>
                {guide.guidelines.map((item, i) => (
                  <View key={i} style={styles.guidelineItem}>
                    <Icon name="check" size={16} color={colors.success} />
                    <Text style={styles.guidelineText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Schedule Changes */}
        {scheduleChanges.length > 0 && (
          <View style={styles.changesSection}>
            <Text style={styles.sectionTitle}>Schedule Changes</Text>
            {scheduleChanges.map((change) => (
              <View key={change.jobId} style={styles.changeCard}>
                <View style={styles.changeHeader}>
                  <Icon name="swap-horizontal" size={20} color={colors.primary} />
                  <Text style={styles.changeName}>{change.customerName}</Text>
                </View>
                <View style={styles.changeDetails}>
                  <View style={styles.changeTime}>
                    <Text style={styles.changeTimeLabel}>Was</Text>
                    <Text style={[styles.changeTimeValue, styles.changeTimeOld]}>
                      {change.originalTime}
                    </Text>
                  </View>
                  <Icon name="arrow-right" size={16} color={colors.textMuted} />
                  <View style={styles.changeTime}>
                    <Text style={styles.changeTimeLabel}>Now</Text>
                    <Text style={[styles.changeTimeValue, styles.changeTimeNew]}>
                      {change.newTime}
                    </Text>
                  </View>
                </View>
                <Text style={styles.changeReason}>{change.reason}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Emergency Contact */}
        <View style={styles.emergencyCard}>
          <Icon name="phone-in-talk" size={24} color={colors.primary} />
          <View style={styles.emergencyInfo}>
            <Text style={styles.emergencyTitle}>Emergency Contact</Text>
            <Text style={styles.emergencyText}>
              If conditions become unsafe, contact dispatch immediately
            </Text>
          </View>
          <TouchableOpacity style={styles.callButton}>
            <Text style={styles.callButtonText}>Call</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollView: {
    flex: 1
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted
  },
  header: {
    padding: 16,
    paddingBottom: 8
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textMuted
  },
  alertsSection: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16
  },
  alertCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1
  },
  alertDanger: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA'
  },
  alertWarning: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A'
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  alertDescription: {
    fontSize: 14,
    color: colors.textMuted
  },
  currentCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  currentMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20
  },
  currentInfo: {
    flex: 1
  },
  tempText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text
  },
  conditionText: {
    fontSize: 16,
    color: colors.textMuted,
    textTransform: 'capitalize'
  },
  feelsLike: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4
  },
  conditionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  conditionItem: {
    alignItems: 'center',
    gap: 4
  },
  conditionLabel: {
    fontSize: 12,
    color: colors.textMuted
  },
  conditionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  safetySection: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12
  },
  guidelineCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.success
  },
  guidelineDanger: {
    borderLeftColor: colors.danger,
    backgroundColor: '#FEF2F2'
  },
  guidelineWarning: {
    borderLeftColor: colors.warning,
    backgroundColor: '#FFFBEB'
  },
  guidelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  guidelineTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  guidelineList: {
    gap: 8
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  guidelineText: {
    flex: 1,
    fontSize: 14,
    color: colors.text
  },
  changesSection: {
    paddingHorizontal: 16,
    marginBottom: 16
  },
  changeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8
  },
  changeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  changeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text
  },
  changeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8
  },
  changeTime: {
    alignItems: 'center'
  },
  changeTimeLabel: {
    fontSize: 12,
    color: colors.textMuted
  },
  changeTimeValue: {
    fontSize: 16,
    fontWeight: '600'
  },
  changeTimeOld: {
    color: colors.danger,
    textDecorationLine: 'line-through'
  },
  changeTimeNew: {
    color: colors.success
  },
  changeReason: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center'
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 12,
    padding: 16,
    gap: 12
  },
  emergencyInfo: {
    flex: 1
  },
  emergencyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  emergencyText: {
    fontSize: 12,
    color: colors.textMuted
  },
  callButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  callButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  }
});
