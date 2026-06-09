import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Container, ScreenHeader } from '../../components/ui';
import { SportGroupBody } from '../../components/SportGroupBody';

export default function SportGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [title, setTitle] = useState('Sports');

  return (
    <View className="flex-1 bg-bg">
      <ScreenHeader title={title} showBack />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        <Container>
          <SportGroupBody groupId={id} onTitle={setTitle} />
        </Container>
      </ScrollView>
    </View>
  );
}
