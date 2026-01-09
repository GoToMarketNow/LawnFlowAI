import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { fetchProviderServices } from '../../services/api/services';
import { useServiceStore } from '../../store/serviceStore';
import { useAuthStore } from '../../store/authStore';
import { ServiceCard } from '../../components/services/ServiceCard';
import { analytics } from '../../services/analytics';

export function ServiceCatalogScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const user = useAuthStore((state) => state.user);
  const { setServices, setSelectedService } = useServiceStore();

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', user?.businessId],
    queryFn: () => fetchProviderServices(user!.businessId),
    enabled: !!user?.businessId,
    onSuccess: (data) => {
      setServices(data);
    },
  });

  useEffect(() => {
    analytics.track('service_catalog_opened', {});
  }, []);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <Text>Loading services...</Text>
      </View>
    );
  }

  const handleServicePress = (service: any) => {
    analytics.track('service_selected', { serviceId: service.id, serviceName: service.name });
    setSelectedService(service);
    navigation.navigate('RequestService');
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={services}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ServiceCard service={item} onPress={() => handleServicePress(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No services available</Text>
          </View>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999' },
});
