import { View, Text } from '@tarojs/components';
import styles from './LoginBrand.module.scss';

export default function LoginBrand() {
  return (
    <View className={styles.brand}>
      <Text className={styles.brand__title}>yishan</Text>
      <Text className={styles.brand__slogan}>简单可依赖的后台基座</Text>
    </View>
  );
}
