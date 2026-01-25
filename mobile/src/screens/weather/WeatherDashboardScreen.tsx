// ============================================
// Owner Weather Dashboard Screen
// Mobile screen for operators to view weather and manage approvals
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Types
interface ForecastData {
  current?: {
    temp: number;
    humidity: number;
    windSpeed: number;
    weather: Array<{ main: string; description: string }>;
  };
  hourly: Array<{
    dt: number;
    temp: number;
    pop: number;
    weather: Array<{ main: string }>;
  }>;
  daily: Array<{
    dt: number;
    temp: { min: number; max: number };
    pop: number;
    weather: Array<{ main: string }>;
  }>;
  alerts?: Array<{
    event: string;
    description: string;
    severity: string;
  }>;
}

interface RiskSummary {
  total: number;
  byTier: {
    STOP: number;
    HIGH: number;
    MED: number;
    LOW: number;
  };
}

interface PendingApproval {
  id: string;
  type: 'schedule' | 'campaign';
  title: string;
  impactedCount: number;
  createdAt: string;
}

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

// Color theme
const colors = {
  primary: '#3B82F6',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1F2937',
  textMuted: '#6B7280',
  border: '#E5E7EB'
};

export default function WeatherDashboardScreen({ navigation }: any) {
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // In production, these would be API calls
      // Simulated data for demo
      setForecast({
        current: {
          temp: 72,
          humidity: 65,
          windSpeed: 12,
          weather: [{ main: 'Clear', description: 'clear sky' }]
        },
        hourly: Array(12).fill(null).map((_, i) => ({
          dt: Date.now() / 1000 + i * 3600,
          temp: 72 + Math.random() * 10 - 5,
          pop: Math.random() * 0.4,
          weather: [{ main: 'Clear' }]
        })),
        daily: Array(7).fill(null).map((_, i) => ({
          dt: Date.now() / 1000 + i * 86400,
          temp: { min: 65 + Math.random() * 5, max: 78 + Math.random() * 5 },
          pop: Math.random() * 0.5,
          weather: [{ main: i % 3 === 0 ? 'Rain' : 'Clear' }]
        })),
        alerts: []
      });

      setRiskSummary({
        total: 45,
        byTier: {
          STOP: 2,
          HIGH: 5,
          MED: 12,
          LOW: 26
        }
      });

      setPendingApprovals([
        {
          id: '1',
          type: 'schedule',
          title: 'Weather Reschedule',
          impactedCount: 8,
          createdAt: new Date().toISOString()
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

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      hour12: true
    });
  };

  const formatDay = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      weekday: 'short'
    });
  };

  const handleApprovalPress = (approval: PendingApproval) => {
    Alert.alert(
      'Review Required',
      `${approval.impactedCount} jobs affected. Review in the approvals screen.`,
      [
        { text: 'Later', style: 'cancel' },
        { 
          text: 'Review Now', 
          onPress: () => navigation.navigate('WeatherApprovals', { id: approval.id })
        }
      ]
    );
  };

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
          <Text style={styles.headerTitle}>Weather</Text>
          <TouchableOpacity onPress={onRefresh}>
            <Icon name="refresh" size={24} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Alerts Banner */}
        {forecast?.alerts && forecast.alerts.length > 0 && (
          <View style={styles.alertBanner}>
            <Icon name="alert" size={20} color="#FFFFFF" />
            <Text style={styles.alertText}>
              {forecast.alerts.length} active weather alert{forecast.alerts.length > 1 ? 's' : ''}
            </Text>
          </View>
        )}

        {/* Pending Approvals */}
        {pendingApprovals.length > 0 && (
          <View style={styles.approvalsCard}>
            <View style={styles.approvalsHeader}>
              <Icon name="clock-alert-outline" size={20} color={colors.warning} />
              <Text style={styles.approvalsTitle}>Pending Approvals</Text>
            </View>
            {pendingApprovals.map((approval) => (
              <TouchableOpacity
                key={approval.id}
                style={styles.approvalItem}
                onPress={() => handleApprovalPress(approval)}
              >
                <View style={styles.approvalInfo}>
                  <Text style={styles.approvalTitle}>{approval.title}</Text>
                  <Text style={styles.approvalSubtitle}>
                    {approval.impactedCount} jobs affected
                  </Text>
                </View>
                <Icon name="chevron-right" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Current Conditions */}
        {forecast?.current && (
          <View style={styles.currentCard}>
            <View style={styles.currentMain}>
              <Icon
                name={getWeatherIcon(forecast.current.weather[0]?.main)}
                size={64}
                color={colors.primary}
              />
              <View style={styles.currentTemp}>
                <Text style={styles.tempText}>{Math.round(forecast.current.temp)}°</Text>
                <Text style={styles.conditionText}>
                  {forecast.current.weather[0]?.description}
                </Text>
              </View>
            </View>
            <View style={styles.currentDetails}>
              <View style={styles.detailItem}>
                <Icon name="water-percent" size={20} color={colors.primary} />
                <Text style={styles.detailText}>{forecast.current.humidity}%</Text>
              </View>
              <View style={styles.detailItem}>
                <Icon name="weather-windy" size={20} color={colors.textMuted} />
                <Text style={styles.detailText}>{Math.round(forecast.current.windSpeed)} mph</Text>
              </View>
            </View>
          </View>
        )}

        {/* Risk Summary */}
        {riskSummary && (
          <View style={styles.riskCard}>
            <Text style={styles.sectionTitle}>Job Risk Summary</Text>
            <View style={styles.riskGrid}>
              <View style={[styles.riskItem, styles.riskStop]}>
                <Text style={styles.riskCount}>{riskSummary.byTier.STOP}</Text>
                <Text style={styles.riskLabel}>Stop</Text>
              </View>
              <View style={[styles.riskItem, styles.riskHigh]}>
                <Text style={styles.riskCount}>{riskSummary.byTier.HIGH}</Text>
                <Text style={styles.riskLabel}>High</Text>
              </View>
              <View style={[styles.riskItem, styles.riskMed]}>
                <Text style={styles.riskCount}>{riskSummary.byTier.MED}</Text>
                <Text style={styles.riskLabel}>Med</Text>
              </View>
              <View style={[styles.riskItem, styles.riskLow]}>
                <Text style={styles.riskCount}>{riskSummary.byTier.LOW}</Text>
                <Text style={styles.riskLabel}>Low</Text>
              </View>
            </View>
            <Text style={styles.riskTotal}>{riskSummary.total} jobs assessed</Text>
          </View>
        )}

        {/* Hourly Forecast */}
        {forecast?.hourly && (
          <View style={styles.forecastCard}>
            <Text style={styles.sectionTitle}>Today's Forecast</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {forecast.hourly.slice(0, 8).map((hour, i) => (
                <View key={i} style={styles.hourItem}>
                  <Text style={styles.hourTime}>{formatTime(hour.dt)}</Text>
                  <Icon
                    name={getWeatherIcon(hour.weather[0]?.main)}
                    size={28}
                    color={colors.textMuted}
                  />
                  <Text style={styles.hourTemp}>{Math.round(hour.temp)}°</Text>
                  {hour.pop > 0.2 && (
                    <Text style={styles.hourPop}>{Math.round(hour.pop * 100)}%</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 7-Day Forecast */}
        {forecast?.daily && (
          <View style={styles.forecastCard}>
            <Text style={styles.sectionTitle}>7-Day Forecast</Text>
            {forecast.daily.map((day, i) => (
              <View key={i} style={styles.dayItem}>
                <Text style={styles.dayName}>{formatDay(day.dt)}</Text>
                <Icon
                  name={getWeatherIcon(day.weather[0]?.main)}
                  size={24}
                  color={colors.textMuted}
                />
                <View style={styles.dayTemps}>
                  <Text style={styles.dayHigh}>{Math.round(day.temp.max)}°</Text>
                  <Text style={styles.dayLow}>{Math.round(day.temp.min)}°</Text>
                </View>
                {day.pop > 0.2 && (
                  <View style={styles.dayPop}>
                    <Icon name="water" size={14} color={colors.primary} />
                    <Text style={styles.dayPopText}>{Math.round(day.pop * 100)}%</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    gap: 8
  },
  alertText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  approvalsCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.warning
  },
  approvalsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12
  },
  approvalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.warning
  },
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8
  },
  approvalInfo: {
    flex: 1
  },
  approvalTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text
  },
  approvalSubtitle: {
    fontSize: 12,
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
    justifyContent: 'center',
    gap: 16
  },
  currentTemp: {
    alignItems: 'center'
  },
  tempText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text
  },
  conditionText: {
    fontSize: 16,
    color: colors.textMuted,
    textTransform: 'capitalize'
  },
  currentDetails: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  detailText: {
    fontSize: 14,
    color: colors.textMuted
  },
  riskCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12
  },
  riskGrid: {
    flexDirection: 'row',
    gap: 8
  },
  riskItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8
  },
  riskStop: {
    backgroundColor: '#FEE2E2'
  },
  riskHigh: {
    backgroundColor: '#FFEDD5'
  },
  riskMed: {
    backgroundColor: '#FEF3C7'
  },
  riskLow: {
    backgroundColor: '#DCFCE7'
  },
  riskCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text
  },
  riskLabel: {
    fontSize: 12,
    color: colors.textMuted
  },
  riskTotal: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 12
  },
  forecastCard: {
    backgroundColor: colors.card,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16
  },
  hourItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4
  },
  hourTime: {
    fontSize: 12,
    color: colors.textMuted
  },
  hourTemp: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text
  },
  hourPop: {
    fontSize: 12,
    color: colors.primary
  },
  dayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  dayName: {
    width: 50,
    fontSize: 14,
    color: colors.text
  },
  dayTemps: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginRight: 16
  },
  dayHigh: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text
  },
  dayLow: {
    fontSize: 14,
    color: colors.textMuted
  },
  dayPop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 50
  },
  dayPopText: {
    fontSize: 12,
    color: colors.primary
  }
});
