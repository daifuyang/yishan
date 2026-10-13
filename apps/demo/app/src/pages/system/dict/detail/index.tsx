import DictionaryDetail from '../DictionaryDetail'
import { withAccountScope } from '@/utils/account-scope'
function Page() {
  return <DictionaryDetail />
}
export default withAccountScope(Page)
