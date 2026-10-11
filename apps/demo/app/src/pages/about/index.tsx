import { Image, View } from '@tarojs/components'

import logo from '@/assets/brand/logo.png'
import { AppText } from '@/components/atoms'
import { PageContainer } from '@/components/layout'
import { APP_NAME, APP_VERSION } from '@/constants'

import styles from './index.module.scss'

export default function AboutPage() {
  return (
    <PageContainer>
      <View className={styles.about}>
        <Image className={styles.about__logo} src={logo} mode="aspectFit" />
        <AppText size={20} weight="semibold">
          {APP_NAME}
        </AppText>
        <AppText size={13} variant="tertiary">
          版本 {APP_VERSION}
        </AppText>
      </View>
    </PageContainer>
  )
}
